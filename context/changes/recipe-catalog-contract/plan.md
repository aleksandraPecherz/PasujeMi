# Minimalny kontrakt danych przepisu (F-01) — Implementation Plan

## Overview

F-01 ustala strukturę przepisu, na której budują F-02 (import 76 przepisów), S-02 (lista i szczegóły), S-03 (dopasowanie) i S-05 (dodawanie). Powstaje tabela `recipes` w Supabase z odczytem wyłącznie dla zalogowanych, typy i serwis odczytu, minimalny `GET /api/recipes`, opis reguł konwersji z Excela oraz 5 prawdziwych przepisów z `data/recipes.xlsx` przepisanych ręcznie według tych reguł (lokalnie i w CI). Produkcja dostaje pustą tabelę migracją przez `supabase db push`, zanim trafi tam kod, który z niej czyta.

## Current State Analysis

- Brak migracji, tabel i RLS (`supabase/` zawiera tylko `config.toml`; `[db.seed] sql_paths = ["./seed.sql"]`, plik nie istnieje). Brak `src/types.ts` i `src/lib/services/`.
- Klient Supabase: `src/lib/supabase.ts:5` (`createClient(headers, cookies)`, zwraca `null` bez konfiguracji). Middleware chroni `/api/*` dla niezalogowanych (401) — `src/middleware.ts:5`.
- Lokalnie nie ma Supabase CLI ani Dockera; `.dev.vars` wskazuje na **produkcyjny** projekt Supabase. CI (`.github/workflows/ci.yml`, job `smoke`) uruchamia `supabase start`, które nakłada migracje i `seed.sql`, a potem `npm run smoke`.
- Push na `master` od razu wdraża kod na produkcję (Workers Builds), a `infrastructure.md` wymaga zgody człowieka na migracje produkcyjne i migracji nakładanych przed kodem, który ich potrzebuje.
- `data/recipes.xlsx` — plik autorki, **tylko lokalnie, nigdy w repo** (dziś nieśledzony i nieignorowany): 1 arkusz, 76 przepisów, kolumny: Nazwa dania, czas przygotowania (min), rodzaj, Ilość porcji, PRODUKTY, waga (g), Kcal, Białko (g), Węglowodany(g), Tłuszcze (g), Jak zrobić?.

### Formaty w Excelu (ustalone w analizie pliku)

- **PRODUKTY**: 74× `Nazwa (40g) [zamienniki: a (40g), b (20g)] ; …`; 2× `Nazwa - 120 g [zamienniki: x – 125 g], …` rozdzielane przecinkami (przecinek bywa też w nazwie: „Borówki amerykańskie, świeże lub mrożone - 100 g”); zdarza się `;` wewnątrz `[...]` i separator `;` bez spacji przed; `zamiennik:` (28×) i `zamienniki:`; nawiasy w nazwie, które nie są ilością („(biała)”, „(z łopatki)”); ilości: `5g`, `0,3 g`, `0.3g`, `25 g`, `1szczypta`; ten sam składnik dwa razy w przepisie („Sól (0,5g)” i „Sól (0,3g)”).
- **Marki** (prawie zawsze w zamiennikach): Lazur, Mlekovita, Ryki, Go Vege, Vemondo.
- **Jak zrobić?**: 42× numerowane (`1.` lub `1)`), 26× rozdzielane `;`, 8× nowymi liniami (z `;` w środku linii).
- **rodzaj**: tylko `na słodko` / `na wytrawnie` + `na ciepło` / `na zimno`, rozdzielane `;` lub `;`.
- **Kcal i makro**: zwykle ~400 kcal na porcję, ale część przepisów wielu porcji ma wartość na całość (pizza 4 porcje = 1704 kcal, spaghetti 2 porcje = 844 kcal), a część na porcję (babeczki 2 porcje = 406 kcal).
- **waga (g)**: wypełniona 16×, pusta 36×, `BRAK` 24×.

## Desired End State

- Migracja tworzy `recipes` z RLS: zalogowany czyta wszystkie przepisy, anonim nie widzi żadnego, nikt nie zapisuje przez API (zapis dochodzi w S-05–S-07).
- `src/types.ts` i `src/lib/services/recipes.ts` dają S-02/S-03 typowany odczyt; `GET /api/recipes` zwraca stronę przepisów zalogowanemu.
- `docs/reference/recipe-data-contract.md` opisuje kontrakt i reguły konwersji z Excela, z których skorzysta import F-02.
- Produkcja ma pustą tabelę `recipes` (migracja zastosowana przez `supabase db push`), kod jest wdrożony.
- Lokalnie/w CI `seed.sql` ładuje 5 przepisów testowych; smoke w CI potwierdza, że zalogowany je widzi, a anonim dostaje 401.

### Key Discoveries:

- `supabase/config.toml` — seed z `./seed.sql` ładuje się tylko przy `supabase start`/`db reset` (lokalnie, CI), nigdy przy `db push` na produkcję — dokładnie to, czego chcemy dla danych testowych.
- `src/middleware.ts` — `/api/recipes` jest już chronione (smoke krok „anonymous api request gets 401” w `scripts/smoke.mjs` dziś trafia w nieistniejącą trasę, po F-01 w prawdziwą).
- Smoke helper `request()` w `scripts/smoke.mjs` zwraca tylko status i `location` — sprawdzenie liczby przepisów wymaga rozszerzenia o treść odpowiedzi.

## What We're NOT Doing

- Import 76 przepisów i parser Excela — F-02 (tu tylko reguły w dokumencie i 5 przepisów przepisanych ręcznie).
- Zapis, edycja, usuwanie przepisów, autorstwo (`author_id`) i rola admina — S-05–S-07 (dołożą kolumny i polityki addytywną migracją).
- Logika „tego samego składnika” i dopasowanie — S-03; F-01 daje tylko pole `product`.
- UI listy i szczegółów oraz odczyt pojedynczego przepisu (`getRecipe`) — S-02.
- Osobny krótki opis przepisu — „opis” z PRD to kroki „Jak zrobić?”.
- Kolumna „waga (g)” — w większości pusta lub `BRAK`, nie występuje w szczegółach z PRD.
- Przepisy testowe na produkcji — tylko lokalnie/CI.
- `data/recipes.xlsx` w repo — plik zostaje tylko lokalnie u autorki (`data/` w `.gitignore`); import F-02 czyta go lokalnie.
- Generowanie typów przez `supabase gen types` (brak lokalnego CLI z Dockerem) — typy pisane ręcznie.

## Implementation Approach

Jedna tabela z `ingredients jsonb` i `steps text[]` — przepis czytany jednym zapytaniem, prosty seed i import. Baza (CHECK-i) pilnuje tylko kolumn i tego, że `ingredients` jest niepustą tablicą; kształtu elementów (`name`, `product`, `amount`, `unit`, `substitutes`) baza nie sprawdza — pilnują go typy TS teraz, a walidacja zapisu w S-05 i w imporcie F-02. Każdy składnik i zamiennik ma `name` (jak w przepisie) i `product` (ogólny produkt do dopasowania), a ilość jako `amount` + `unit`. Kcal i makro zawsze na porcję, według reguły przeliczenia poniżej. Kolejność faz wynika z wdrożenia: push na `master` od razu wdraża kod, więc tabela musi istnieć na produkcji, zanim pójdzie push z kodem, który ją czyta.

### Reguły konwersji z Excela (kontrakt dla F-02 i dla 5 przepisów testowych)

- **Składniki — podział**: najpierw wydziel bloki `[zamiennik(i): …]`; na najwyższym poziomie dziel po `;` poza nawiasami. Gdy na najwyższym poziomie nie ma `;` (układ „- 120 g”), dziel po `,` tylko tam, gdzie poprzedza go ilość (`- N g`) lub zamknięcie `]` — przecinek wewnątrz nazwy zostaje.
- **Ilość**: ostatni nawias na końcu pozycji w postaci `(liczba jednostka)` (dopuszczalna spacja i przecinek dziesiętny) albo końcówka `- N g` / `– N g`. `amount` = liczba (przecinek → kropka), `unit` = `g` lub słowo w mianowniku liczby pojedynczej (`szczypta`). Inne nawiasy zostają w nazwie („Kasza gryczana niepalona (biała)”). Brak ilości → `amount` i `unit` = `null`.
- **Zamienniki**: zawartość po `zamiennik:`/`zamienniki:`, dzielona po `;` lub `,` (poza nawiasami); każdy parsowany jak składnik, bez własnych zamienników.
- **`name`**: tekst jak w przepisie, przycięty, z zachowaną wielkością liter pierwszej litery jak w źródle.
- **`product`**: małe litery, nazwa bez marki i nazw linii produktowych (Lazur, Mlekovita, Ryki, Go Vege, Vemondo, „active protein plus” itp.); pozostałe określenia zostają („ser żółty active protein plus Ryki” → „ser żółty”, „ser z niebieską pleśnią Lazur” → „ser z niebieską pleśnią”, „Mleko 1,5%” → „mleko 1,5%”). Rozpoznawanie odmian i ogólne/szczegółowe należy do S-03.
- **Duplikaty**: ten sam składnik dwa razy zostaje dwiema pozycjami (np. sól do ciasta i do sosu).
- **Kroki**: pierwszeństwo separatorów numeracja (`1.`/`1)`) > nowa linia > `;`; separator niższego rzędu wewnątrz kroku zostaje w tekście. Usuń numerację, przytnij, zacznij wielką literą, pomiń puste.
- **rodzaj → `kinds`**: podział po `;`, przycięte, małe litery; dozwolone `na słodko`, `na wytrawnie`, `na ciepło`, `na zimno`.
- **Kcal i makro — reguła autorki**: w bazie zawsze na 1 porcję. Gdy `servings > 1` i `kcal` jest bliskie `400 × servings`, podziel kcal i makro przez `servings`; w przeciwnym razie zostaw bez zmian. „Bliskie” = `0,75 ≤ kcal / (400 × servings) ≤ 1,25` (w danych przepisy „na całość” mają 0,96–1,07, „na porcję” co najwyżej 0,51). Zaokrąglenie: kcal do liczby całkowitej, makro do 0,1 g. Przy imporcie F-02 lista przeliczonych przepisów trafia do autorki do potwierdzenia.
- **Czas i porcje**: liczby całkowite (`5.0` → 5); `waga (g)` pomijana.

## Critical Implementation Details

- **Kolejność wdrożenia** — kod z fazy 1 (serwis, `GET /api/recipes`) nie może trafić na `master` przed zastosowaniem migracji na produkcji w fazie 2. Faza 1 kończy się wypchnięciem gałęzi `recipe-catalog-contract` i PR do `master`: CI na PR (`supabase start` + smoke) jest pierwszym miejscem, gdzie migracja i endpoint faktycznie działają, zanim dotkną produkcji. `db push` dopiero po zielonym CI na PR; scalenie PR do `master` (= wdrożenie) dopiero po udanym `db push`.
- **Lokalny dev = produkcyjna baza** — `.dev.vars` wskazuje na produkcyjny Supabase, więc ręczne sprawdzenia przez `npm run dev` czytają produkcję (po fazie 2: pusta tabela). Przepisy testowe widać tylko w CI.
- **`db push` bez Dockera** — `npx supabase link --project-ref <ref>` (ref z `SUPABASE_URL` w `.dev.vars`) i `npx supabase db push` nie potrzebują Dockera; wymagają `npx supabase login` i hasła do bazy (wpisuje autorka). Zawsze najpierw `--dry-run`.

## Phase 1: Schemat, kontrakt i odczyt

### Overview

Migracja z tabelą `recipes` i RLS, typy, serwis odczytu, `GET /api/recipes` oraz dokument z kontraktem i regułami konwersji. Nic nie trafia jeszcze na produkcję.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_recipes.sql` (nowy)

**Intent**: Pierwsza tabela domenowa z kształtem pilnowanym w bazie i odczytem tylko dla zalogowanych.

**Contract**: Tabela `public.recipes`:

- `id uuid primary key default gen_random_uuid()`
- `name text not null` (niepusty po przycięciu)
- `steps text[] not null` (co najmniej 1 krok)
- `ingredients jsonb not null` (tablica, co najmniej 1 element)
- `prep_time_min integer null` (≥ 0)
- `servings integer null` (> 0)
- `kinds text[] not null default '{}'` (podzbiór czterech dozwolonych wartości)
- `kcal integer null`, `protein_g`, `carbs_g`, `fat_g numeric(6,1) null` (≥ 0; wartości na porcję)
- `created_at timestamptz not null default now()`

`alter table … enable row level security`; jedna polityka `select` dla roli `authenticated` (`using (true)`); brak polityk dla `anon` i brak polityk insert/update/delete. Uprawnienia jawnie, niezależnie od domyślnych GRANT-ów projektu: `revoke all on public.recipes from anon, authenticated`, a potem `grant select on public.recipes to authenticated`. Komentarz w SQL: kształt elementu `ingredients` jak w `docs/reference/recipe-data-contract.md`.

#### 2. Typy

**File**: `src/types.ts` (nowy)

**Intent**: Wspólne typy domenowe dla serwisu, API i przyszłych slice'ów.

**Contract**: `IngredientOption { name: string; product: string; amount: number | null; unit: string | null }`, `RecipeIngredient extends IngredientOption { substitutes: IngredientOption[] }`, `RecipeKind = "na słodko" | "na wytrawnie" | "na ciepło" | "na zimno"`, `Recipe { id; name; steps: string[]; ingredients: RecipeIngredient[]; prepTimeMin: number | null; servings: number | null; kinds: RecipeKind[]; kcal: number | null; proteinG; carbsG; fatG: number | null }`.

#### 3. Serwis odczytu

**File**: `src/lib/services/recipes.ts` (nowy)

**Intent**: Jedno miejsce mapowania wiersza bazy (snake_case) na `Recipe`, używane przez API i strony.

**Contract**: `listRecipes(supabase, { limit, offset }): Promise<{ recipes: Recipe[]; hasMore: boolean }>` — sortowanie `name` rosnąco, potem `id`; `hasMore` z pobrania `limit + 1`. Błąd zapytania rzucany dalej. Bez `getRecipe` — doda go S-02 razem z widokiem szczegółów. `numeric` z bazy zamieniany na `number`.

#### 4. Endpoint

**File**: `src/pages/api/recipes/index.ts` (nowy)

**Intent**: Minimalna powierzchnia odczytu dla „doładuj kolejne” w S-02 i dla smoke testu RLS.

**Contract**: `GET /api/recipes?limit=&offset=` → `200 { recipes: Recipe[], hasMore: boolean }`; `limit` domyślnie 10, zakres 1–50; `offset` domyślnie 0, ≥ 0; niepoprawne → `400 { error: "invalid_query" }`; brak konfiguracji Supabase → `503 { error: "not_configured" }`; błąd bazy → `500 { error: "database_error" }`. Niezalogowanego zatrzymuje middleware (401).

#### 5. Dokument kontraktu

**File**: `docs/reference/recipe-data-contract.md` (nowy)

**Intent**: Źródło prawdy o kształcie przepisu i regułach konwersji dla F-02, S-03 i S-05.

**Contract**: Sekcje: kształt rekordu i składnika (z przykładem JSON), reguły konwersji z sekcji „Reguły konwersji z Excela” tego planu (w tym reguła kcal z progiem 0,75–1,25 i obowiązkiem pokazania autorce listy przeliczonych przy imporcie), lista znanych marek, znane pułapki danych (duplikaty składników, nawiasy w nazwach, `;` w zamiennikach), granica walidacji: baza sprawdza tylko niepustą tablicę `ingredients`, kształt elementów muszą walidować piszący (S-05, import F-02).

#### 6. Dane źródłowe poza repo i wytyczne repozytorium

**Files**: `.gitignore`, `AGENTS.md`

**Intent**: Plik z przepisami zostaje wyłącznie u autorki — import F-02 będzie uruchamiany lokalnie z jej pliku, nie z repo; `.gitignore` chroni przed przypadkowym commitem. Agenci wiedzą, gdzie jest kontrakt przepisu i że danych źródłowych nie ma w repo.

**Contract**: `.gitignore` dostaje wpis `data/` (z krótkim komentarzem: lokalne dane źródłowe autorki). W `AGENTS.md` (Project Structure) jedna linia: `docs/reference/recipe-data-contract.md` — kształt przepisu i reguły konwersji z lokalnego `data/recipes.xlsx` (ignorowany przez git, tylko u autorki); `supabase/seed.sql` — dane testowe tylko lokalnie/CI.

#### 7. Smoke dla zalogowanego i walidacja w CI przed produkcją

**Files**: `scripts/smoke.mjs`; gałąź `recipe-catalog-contract` + PR do `master`

**Intent**: Migracja i endpoint muszą zadziałać na czystej bazie w CI, zanim cokolwiek trafi na produkcję — lokalnie nie ma Supabase, a CI uruchamia się także na `pull_request` do `master`.

**Contract**: `request()` w smoke zwraca dodatkowo sparsowane JSON-owe ciało (gdy odpowiedź jest JSON). Nowy krok po „signin accepts correct password”: zalogowany `GET /api/recipes` → 200, ciało ma tablicę `recipes` i boolean `hasMore` (bez sprawdzania liczby — seed dochodzi w fazie 3). Commity fazy 1 trafiają na gałąź `recipe-catalog-contract`, wypchniętą za zgodą autorki, z PR do `master` (bez scalania).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- Source data stays out of git: `git check-ignore -q data/recipes.xlsx` succeeds and `git ls-files data` returns nothing
- Migration enables RLS and defines only a select policy: `grep -c "enable row level security" supabase/migrations/*_create_recipes.sql` returns 1, `grep -ciE "for (insert|update|delete|all)" supabase/migrations/*_create_recipes.sql` returns 0, and the file contains `grant select on public.recipes to authenticated` and a `revoke all` for `anon`
- CI (`ci`, `smoke`) passes on the PR, including the signed-in `GET /api/recipes` → 200 step

#### Manual Verification:

- Author confirms the conversion rules in `docs/reference/recipe-data-contract.md` match the Excel (ingredient formats, steps, kcal rule, `product`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding. Push only the branch and open the PR — do not merge; the code must not reach `master` before Phase 2.

---

## Phase 2: Migracja na produkcję

### Overview

Pusta tabela `recipes` na produkcyjnym Supabase przez `supabase db push` (po zielonym CI na PR z fazy 1), a dopiero potem scalenie PR do `master`.

### Changes Required:

#### 1. Połączenie CLI z projektem (jednorazowo, autorka)

**Intent**: Umożliwić śledzone migracje produkcyjne bez Dockera.

**Contract**: Autorka uruchamia `! npx supabase login` i `! npx supabase link --project-ref <ref>` (ref z `SUPABASE_URL` w `.dev.vars`, hasło do bazy wpisuje sama). Pliki tworzone przez `link` w `supabase/.temp/` nie trafiają do repo (sprawdzić `.gitignore`, w razie potrzeby dodać `supabase/.temp/`).

#### 2. Zastosowanie migracji (za zgodą autorki)

**Intent**: Tabela istnieje na produkcji przed kodem, który z niej czyta.

**Contract**: `npx supabase db push --dry-run` pokazuje wyłącznie migrację `*_create_recipes.sql`; po akceptacji autorki `npx supabase db push`. Następnie scalenie PR z fazy 1 (wraz z commitem fazy 2, jeśli powstał) do `master` za zgodą autorki i sprawdzenie CI oraz Workers Builds.

### Success Criteria:

#### Automated Verification:

- Remote migration history includes the recipes migration: `npx supabase migration list` shows it applied on remote
- The `recipes` table exists on production and anon is blocked: REST `GET /rest/v1/recipes?select=id` with the anon key returns a permission error (401/403, code `42501`), not 404 (row-level access is verified on seeded data in Phase 3 — the production table is empty)
- CI (`ci`, `smoke`) and `Workers Builds: pasuje-mi` succeed for the merge commit on `master`

#### Manual Verification:

- Author approved `db push` after seeing the dry-run output
- Signed in on the dev server (production database), `GET /api/recipes` returns `200` with `{ "recipes": [], "hasMore": false }`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding.

---

## Phase 3: Przepisy testowe i smoke w CI

### Overview

5 prawdziwych przepisów przepisanych ręcznie według kontraktu w `supabase/seed.sql`; smoke w CI sprawdza, że zalogowany je czyta przez `GET /api/recipes`.

### Changes Required:

#### 1. Seed

**File**: `supabase/seed.sql` (nowy)

**Intent**: Prawdziwe dane testowe pokrywające każdy format z Excela, dostępne lokalnie i w CI, nigdy na produkcji.

**Contract**: `insert into public.recipes …` dla 5 przepisów, przeliczonych według „Reguł konwersji z Excela”:

| Przepis (wiersz w Excelu)                                                | Co pokrywa                                                                                            | Oczekiwane wartości kontrolne                                                                                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Babeczki z jogurtem naturalnym                                           | układ `- 120 g` z przecinkami, przecinek w nazwie, `–` w zamiennikach, kroki `1.`, 2 porcje na porcję | 10 składników; „Borówki amerykańskie, świeże lub mrożone” 100 g z 5 zamiennikami; „Sól” 0.3 g; 9 kroków; kcal 406 bez zmian (406/800 = 0,51)       |
| Kanapka z serem, szynką i ogórkiem                                       | marka w zamienniku, `zamiennik:` w liczbie pojedynczej                                                | 7 składników; zamiennik „ser żółty active protein plus Ryki” 50 g z `product` „ser żółty”; „szynka z kurczaka” z 1 zamiennikiem; 2 kroki; kcal 385 |
| Twarożek z makrelą, porem, szpinakiem oraz ogórkiem kiszonym i pieczywem | `1szczypta`, kroki po `;`                                                                             | 9 składników; „Sól” i „Pieprz czarny” z `amount` 1, `unit` „szczypta”; 4 kroki (kropka wewnątrz kroku 3 zostaje); kcal 397                         |
| Danie jednogarnkowe z mięsem                                             | kroki `1)`, `;` w zamiennikach, nawias w nazwie, `(25 g)` ze spacją                                   | 11 składników; „Ryż basmati” 25 g z 4 zamiennikami, w tym „Kasza gryczana niepalona (biała)” 25 g; 5 kroków; kcal 396                              |
| Domowe spaghetti                                                         | kroki w nowych liniach, 2 porcje z wartością na całość                                                | 11 składników; 8 kroków; kcal 422, białko 31, węglowodany 41, tłuszcze 14 (844/62/82/28 ÷ 2; 844/800 = 1,055)                                      |

#### 2. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: CI potwierdza w jednym przebiegu: migracja się nakłada, RLS wpuszcza zalogowanego, serwis mapuje dane, seed się ładuje.

**Contract**: Krok „zalogowany `GET /api/recipes`” z fazy 1 dostaje dodatkowe asercje: `recipes.length >= 5`, każdy przepis ma niepuste `steps` i `ingredients`. Istniejący krok „anonymous api request gets 401” zostaje.

#### 3. Kontrola RLS na zasilonej bazie w CI

**File**: `.github/workflows/ci.yml` (job `smoke`)

**Intent**: Udowodnić, że klucz anon nie czyta przepisów bezpośrednio z Supabase REST — na bazie, w której przepisy faktycznie są (seed), a nie na pustej tabeli.

**Contract**: Nowy krok po „Start local Supabase”: z `supabase status -o env` pobrać też `SERVICE_ROLE_KEY`; `GET $API_URL/rest/v1/recipes?select=id` z kluczem service role zwraca 5 wierszy (seed się załadował), a ten sam request z `ANON_KEY` nie zwraca żadnego wiersza (błąd uprawnień 401/403 po `revoke` — nie lista przepisów). Krok kończy job błędem, gdy któryś warunek nie jest spełniony.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Seed covers all five recipes: `grep -c "insert into public.recipes" supabase/seed.sql` (or a single multi-row insert with 5 rows) — 5 recipes present
- CI `smoke` passes, including the new signed-in recipes step, after push
- CI RLS check passes: service role sees 5 seeded recipes, anon key gets no rows (permission error)

#### Manual Verification:

- Author spot-checks the seeded recipes against the Excel (control values in the table above)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human.

---

## Testing Strategy

### Integration Tests:

- CI job `smoke`: `supabase start` nakłada migrację i seed na czystą bazę; krok uprawnień sprawdza, że klucz anon nie dostaje żadnego z 5 przepisów w REST (błąd uprawnień); smoke sprawdza 401 dla anonima w aplikacji i odczyt 5 przepisów przez zalogowanego.

### Manual Testing Steps:

1. Po fazie 1: przeczytać `docs/reference/recipe-data-contract.md` i porównać reguły z kilkoma wierszami Excela.
2. Po fazie 2: zalogowana na dev serwerze otwiera `/api/recipes` → pusta lista; anonim → 401.
3. Po fazie 3: porównać wartości kontrolne z tabeli seed z Excelem.

## Performance Considerations

Brak indeksów poza kluczem — `listRecipes` sortuje po `name` przy ~76–1000 wierszach. Wydajność dopasowania (< 1 s przy 1000 przepisów) należy do S-03.

## Migration Notes

Pierwsza migracja projektu; addytywna, bez danych. Wycofanie: `drop table public.recipes` (brak zależności). Kolejne slice'y (S-05–S-07) dokładają kolumny i polityki nowymi migracjami nakładanymi przed kodem.

## References

- Roadmap: `context/foundation/roadmap.md` — F-01, Open Roadmap Question 3
- PRD: `context/foundation/prd.md` — FR-004, FR-006, FR-007, Business Logic, Access Control
- Infrastruktura: `context/foundation/infrastructure.md` — migracje przed kodem, zgoda na migracje produkcyjne
- Dane: `data/recipes.xlsx` (lokalnie u autorki, poza repo)
- Klient Supabase: `src/lib/supabase.ts:5`; middleware: `src/middleware.ts:5`; smoke: `scripts/smoke.mjs`; CI: `.github/workflows/ci.yml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schemat, kontrakt i odczyt

#### Automated

- [x] 1.1 Linting passes: `npm run lint`
- [x] 1.2 Type checking passes: `npx astro check`
- [x] 1.3 Production build succeeds: `npm run build`
- [x] 1.4 Source data stays out of git
- [x] 1.5 Migration enables RLS and defines only a select policy
- [ ] 1.6 CI passes on the PR, including the signed-in `GET /api/recipes` step

#### Manual

- [ ] 1.7 Author confirms the conversion rules in `docs/reference/recipe-data-contract.md` match the Excel

### Phase 2: Migracja na produkcję

#### Automated

- [ ] 2.1 Remote migration history includes the recipes migration
- [ ] 2.2 The `recipes` table exists on production and anon is blocked (REST permission error, not 404)
- [ ] 2.3 CI and Workers Builds succeed for the merge commit on `master`

#### Manual

- [ ] 2.4 Author approved `db push` after seeing the dry-run output
- [ ] 2.5 Signed in on the dev server, `GET /api/recipes` returns an empty list

### Phase 3: Przepisy testowe i smoke w CI

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Type checking passes: `npx astro check`
- [ ] 3.3 Seed covers all five recipes
- [ ] 3.4 CI `smoke` passes, including the new signed-in recipes step, after push
- [ ] 3.5 CI RLS check passes: service role sees 5 seeded recipes, anon key gets no rows

#### Manual

- [ ] 3.6 Author spot-checks the seeded recipes against the Excel
