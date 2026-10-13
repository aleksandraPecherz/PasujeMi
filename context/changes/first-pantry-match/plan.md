# Pierwsze dopasowanie ze spiżarki (S-03) — plan implementacji

## Overview

Użytkownik wpisuje tagi w trzech sekcjach (posiadane, stałe, wykluczenia), klika „Zastosuj filtry” i widzi kafelki przepisów posortowane malejąco po % dopasowania. Przepisy z wykluczonym składnikiem są ukryte (`roadmap.md` S-03, PRD US-01, FR-002, FR-004, Business Logic).

Dopasowanie działa w TypeScripcie: polski stemmer Snowball, odległość edycyjna i słownik (`external-research.md:74`). Klucze dopasowania są liczone przy zapisie przepisu i trzymane w kolumnie, żeby ocena 1000 przepisów zmieściła się w limicie 10 ms CPU planu Free (`infrastructure.md:45,170`).

## Current State Analysis

- **Dane.** Jedna tabela `public.recipes`. Składniki i zamienniki są zagnieżdżone w `ingredients jsonb`; kluczem dopasowania jest `product` (`research.md:28-31`, `supabase/migrations/20261012120000_create_recipes.sql:9-12`). Nie ma kolumn pochodnych ani indeksów. RLS daje tylko `select` dla `authenticated` (`:25-36`).
- **Szczegółowe `product` w danych.** Przykłady: „jogurt naturalny 2%”, „borówki amerykańskie, świeże lub mrożone”, „syrop z agawy” (`supabase/seed.sql:22-30`). Tag ogólny musi więc trafiać w produkt o większej liczbie tokenów (`research.md:80-85`).
- **Odczyt.** Przepisy czyta tylko `listRecipes` (`src/lib/services/recipes.ts:41-62`), wołany z `GET /api/recipes` (`src/pages/api/recipes/index.ts:21-43`). `src/pages/index.astro:1-10` to placeholder. Komponentów tagów i kafelków nie ma (`research.md:107-111`).
- **Brak runnera testów.** AGENTS.md wymaga dodania runnera przed testami. Roadmapa wymaga przypadków z PRD dla wykluczeń (`roadmap.md:143`).
- **Pakiet stemmera.** `snowball-stemmers-js@3.1.2` nie ma `exports`, `"type": "module"`, typów ani pliku LICENSE. API to `stem(input)` i `stemWord`; metody `stemWords` nie ma (`research.md:130-138`).
- **Konflikt z infrastrukturą.** `infrastructure.md:170` każe dopasowywać w Postgresie (`pg_trgm`). PG 17 na Supabase nie ma polskiego stemmera, a trigramy nie łapią odmian krótkich słów: `sól`/`soli` = 0,13 (`external-research.md:25-28`).

### Pomiar CPU (sesja planowania, Node 22 na komputerze autorki, 1000 syntetycznych przepisów, ok. 29 tys. tokenów)

| Wariant                              | `JSON.parse`    | Normalizacja / ocena                             | Razem   |
| ------------------------------------ | --------------- | ------------------------------------------------ | ------- |
| Wszystko per żądanie, bez cache      | 6,4 ms (1,3 MB) | 29,4 ms stemming                                 | ≈ 36 ms |
| Per żądanie, cache rdzeni w izolacie | 6,4 ms          | 8,2 ms (tokenizacja)                             | ≈ 15 ms |
| Klucze z kolumny                     | 3,4 ms (329 KB) | 1,9 ms (dopasowanie do słownika rdzeni i zbiory) | ≈ 5 ms  |

Wniosek: przy docelowej skali 1000 przepisów (`roadmap.md:212`) tylko gotowe klucze mieszczą się w 10 ms.

## Desired End State

- Po zalogowaniu `/` pokazuje trzy sekcje tagów, podpowiedź o produktach stałych, przycisk „Zastosuj filtry” i listę kafelków.
- Bez filtrów lista ma 10 przepisów bez % i przycisk „Pokaż więcej” (FR-005).
- Po zastosowaniu filtrów:
  - kafelki są posortowane po %, każdy składnik jest tagiem „mam” (zielony) albo „brak informacji” (szary);
  - przepis z wykluczonym składnikiem bez niewykluczonego zamiennika nie pojawia się nigdy;
  - przepisy z 0% stoją na końcu listy.
- Kolumna `match_keys` jest wypełniona dla każdego przepisu przez `npm run match-keys`. Wiersz z nieaktualną wersją kluczy jest oceniany poprawnie, bo klucze dla niego są liczone w żądaniu.
- `npm test` uruchamia testy reguły z przypadkami z PRD i działa w CI.

### Key Discoveries:

- `supabase/config.toml:18`: `max_rows = 1000`, więc pojedyncze zapytanie bez stronicowania obetnie katalog przy ok. 1000 przepisów.
- `src/lib/services/recipes.ts:41-62`: wzorzec serwisu, czyli wstrzyknięty klient, `throw error` i `{ recipes, hasMore }`.
- `src/pages/api/recipes/index.ts:9-18`: `parseIntParam` i błędy w postaci `{ error: "snake_code" }`.
- `eslint.config.js:73-83`: wyjątki lintu przez `scriptsConfig` i `globalIgnores`.
- `.github/workflows/ci.yml:31-34`: job smoke ma lokalny Supabase i `SERVICE_ROLE_KEY`.
- `context/foundation/lessons.md`: w sprawdzeniach HTTP najpierw status i typ odpowiedzi, potem treść.

## Reguła dopasowania (kontrakt domenowy)

Każdy punkt wskazuje źródło. „Plan” oznacza decyzję autorki podjętą w tej sesji planowania.

1. **Normalizacja tekstu** (tag albo `product`): małe litery i NFC; tokeny na granicach nie-liter. Pomijane są tokeny czysto liczbowe i procentowe (`1,5%`, `2%`) oraz spójniki i przyimki (`z`, `ze`, `i`, `lub`, `oraz`, `w`, `na`, `do`, `bez`). Słowo po „bez” zostaje tokenem, więc wykluczenia działają nadmiarowo, czyli bezpiecznie (Plan: decyzja „mleko ↔ mleko 1,5%”; PRD Guardrails).
2. **Rdzeń.** `stemWord` ze stemmera Snowball, następnie słownik, na końcu usunięcie znaków diakrytycznych (ą→a, ł→l, …) (`external-research.md:32`).
3. **Słownik** w `src/lib/matching/dictionary.ts`, uzupełniany przez autorkę przez PR (Plan). Zawiera trzy rodzaje wpisów:
   - **synonimy**: forma → forma kanoniczna, np. `kartofel → ziemniak`, `pomidorki → pomidor` (PRD Business Logic);
   - **osobne produkty**: frazy wielowyrazowe, np. `mleko kokosowe`, `mleko owsiane`, `mleko sojowe`. Fraza staje się jednym kluczem i ma klucz rodzica `mleko` (Plan);
   - **wyjątki**: rdzenie, które po usunięciu znaków diakrytycznych zlewają się z innymi. Na start `mąka ≠ mak` (Plan).

   Wpisy pisze się zwykłymi słowami; moduł przepuszcza je przez stemmer przy ładowaniu.

4. **Równość kluczy.** Dwa klucze są równe, gdy są identyczne albo gdy oba mają ≥ 4 znaki i odległość Damerau–Levenshteina ≤ 1 (Plan: „literówki od 4 znaków”). Wynik: `jajk`/`jajek` ✓, `sol`/`sol` ✓, `sól` ≠ `sok`, `ryż` ≠ `ryby`.
5. **Posiadanie.** Tag z posiadanych lub stałych pokrywa opcję składnika, gdy klucze tagu ⊆ klucze opcji albo klucze opcji ⊆ klucze tagu (Plan). Stałe liczą się dokładnie jak posiadane (PRD Business Logic). Klucze rodzica osobnego produktu się nie liczą (Plan: „tylko posiadane”). Przykłady:
   - mam „mleko” → „mleko 1,5%” ✓
   - mam „jogurt naturalny” → „jogurt” ✓
   - mam „mleko” → „mleko kokosowe” ✗
   - mam „mleko kokosowe” → „mleko” ✗
6. **Wykluczenie.** Wykluczenie trafia opcję, gdy klucze wykluczenia ⊆ (klucze opcji ∪ klucze rodziców). Ogólne obejmuje więc szczegółowe, a szczegółowe nie obejmuje ogólnego (PRD Business Logic; Plan: osobne produkty nadal dziedziczą wykluczenie rodzica). Przykłady:
   - „orzechy” ukrywa „orzechy włoskie”
   - „mleko” ukrywa „mleko kokosowe”
   - „mleko kokosowe” nie ukrywa „mleko”
7. **Składnik.**
   - Jest **zablokowany**, gdy wykluczone są wszystkie jego opcje (główna i zamienniki). Zablokowany składnik ukrywa przepis (PRD Business Logic).
   - Jest **dostępny („mam”)**, gdy któraś niewykluczona opcja jest pokryta przez tag. Wykluczona opcja nigdy nie daje „mam”, nawet jeśli jest też w posiadanych (PRD Guardrails, bezpieczeństwo).
   - Pusty zbiór kluczy (np. `product` złożony z samych liczb) niczego nie pokrywa i nie jest wykluczany.
8. **Procent** = dostępne pozycje / wszystkie pozycje. Duplikaty, np. dwa razy sól, liczą się osobno (`recipe-data-contract.md:100`). Wyświetlany jest `Math.round`, a sortuje się po dokładnym ułamku.
9. **Kolejność.** Malejąco po ułamku, przy remisie więcej dostępnych pozycji wyżej, potem nazwa (`localeCompare` z `pl`), na końcu `id` jako techniczny tie-break (Plan: „więcej posiadanych, potem nazwa”; `recipes.ts:49-50`). Przykłady: 5/5 przed 2/2, 3/6 przed 1/2. Przepisy z 0% zostają na liście (PRD Business Logic).
10. **Brak posiadanych i stałych.**
    - Same wykluczenia: lista bez %, wykluczenia nadal działają, kolejność po nazwie (PRD Business Logic: „Bez wpisanych produktów lista pokazuje przepisy bez wskaźnika dopasowania”).
    - Wszystkie trzy listy puste: lista z FR-005 (`listRecipes`).

## What We're NOT Doing

- Trwałe produkty stałe i wykluczenia, migracja spiżarki z RLS. To S-04 (`roadmap.md:49`); w S-03 tagi żyją w stanie wyspy.
- Szczegóły przepisu po kliknięciu (FR-006). To S-02; kafelek jeszcze nie jest linkiem.
- Formularz i import przepisów. To S-05 i F-02. Muszą jednak wołać `computeMatchKeys` przy zapisie (patrz Migration Notes).
- Panel administracyjny słownika i słownik jako tabela w bazie (Plan: moduł TS).
- Dopasowanie w Postgresie (`pg_trgm`, `unaccent`). Odrzucone dowodami powyżej; `external-research.md:76` zostawia je jako ewentualne zawężanie kandydatów w przyszłości.
- Zmiany w `context/foundation/infrastructure.md` i PRD. Rozstrzygnięcie konfliktu zapisuje ten plan; aktualizacja dokumentów fundamentu to osobna, świadoma zmiana (AGENTS.md Hard Rules).
- Rozpoznawanie alergenów z nazw („bez laktozy”), zdrobnienia poza słownikiem i pełna lematyzacja (`external-research.md:42-51`).
- Przejście na Workers Paid. To ścieżka awaryjna z `infrastructure.md:170`, nie część tej zmiany.

## Implementation Approach

1. Najpierw czysty moduł reguły z testami, bo wykluczenia są twardym filtrem przy alergiach (`roadmap.md:143`).
2. Potem trwałe klucze, skrypt przeliczania, serwis i endpoint.
3. Na końcu UI, z kafelkiem napisanym tak, żeby S-02 mógł go przejąć (`roadmap.md:130`).

Klucze są wersjonowane. Każda zmiana normalizacji, stemmera lub słownika podnosi `MATCH_KEYS_VERSION`, a serwis liczy na bieżąco klucze dla wierszy z inną wersją. Wynik jest więc poprawny także bez przeliczenia, ale tylko przy kilku nieaktualnych wierszach. Gdy nieaktualny jest cały katalog (≈ 36 ms przy 1000 przepisów), plan Free może zwrócić błąd 1102, dopóki skrypt nie przeliczy kluczy.

## Critical Implementation Details

- **Limit wierszy PostgREST.** `max_rows = 1000` (`supabase/config.toml:18`, tak samo na hostowanym Supabase). Pobieranie kluczy musi stronicować przez `range` w porcjach po 1000, uporządkowanych po `id`, aż porcja będzie krótsza. Inaczej przy ok. 1000 przepisów część katalogu po cichu zniknie z oceny.
- **Budżet CPU.** Dopasowanie kluczy tagów do kluczy przepisów odbywa się raz na unikalny klucz w katalogu: najpierw zbiór unikalnych kluczy, potem dopasowanie tagów do niego, a dla przepisów już tylko sprawdzanie przynależności do zbiorów. Odległość edycyjna dla każdej pary (przepis × tag) to ok. 240 tys. porównań i przekroczy limit.
- **Nieaktualne klucze bez zapisu.** Rola `authenticated` nie ma prawa `update` na `recipes`. Klucze policzone w żądaniu dla nieaktualnych wierszy żyją tylko w pamięci żądania; zapisuje je wyłącznie skrypt z kluczem service role.

## Phase 1: Rdzeń dopasowania

### Overview

Czysty moduł bez Supabase: stemmer, normalizacja, słownik, klucze, ocena i sortowanie. Do tego Vitest w CI i testy przypadków z PRD.

### Changes Required:

#### 1. Kopia stemmera Snowball

**File**: `src/lib/matching/vendor/snowball/polish-stemmer.js`, `base-stemmer.js`, `LICENSE`, `polish-stemmer.d.ts`

**Intent**: Skopiować wygenerowany kod z `snowball-stemmers-js@3.1.2` zamiast dodawać zależność. Powody: pakiet nie ma `"type": "module"`, a ten sam kod musi działać w workerd, Vite, Vitest i Node/tsx; pakiet jest też młody i ma jednego opiekuna (`research.md:144-152`, `external-research.md:36`).

**Contract**:

- Kod skopiowany bez zmian, z nagłówkiem wskazującym źródło i wersję.
- `LICENSE` zawiera tekst BSD-3 Snowball (pakiet go nie ma, `research.md:148`).
- `polish-stemmer.d.ts` (obok pliku `.js`, żeby TS go znalazł przy imporcie `./vendor/snowball/polish-stemmer.js`) deklaruje domyślny eksport klasy z `stemWord(word: string): string`.
- Katalog jest dopisany do `globalIgnores` w `eslint.config.js` i do `.prettierignore`.

#### 2. Moduł reguły

**File**: `src/lib/matching/normalize.ts`, `dictionary.ts`, `keys.ts`, `rank.ts`, `index.ts`

**Intent**: Zaimplementować regułę z sekcji „Reguła dopasowania”, punkty 1–10.

**Contract**:

- Eksporty nazwane, bez `default` (`research.md:117`).
- `MATCH_KEYS_VERSION: number`, startowo `1`.
- `computeMatchKeys(ingredients: RecipeIngredient[]): MatchKeys`. To jedyna funkcja liczenia kluczy przepisu; wołają ją skrypt, serwis i w przyszłości S-05/F-02.
- `normalizeTag(text: string): TagKeys`.
- `rankRecipes(candidates: { id; name; keys: MatchKeys }[], pantry: { have: TagKeys[]; exclude: TagKeys[] }): RankedRecipe[]`. Zwraca tylko niewykluczone przepisy, posortowane według punktu 9, z `percent: number | null` i statusem każdej pozycji.
- Typy w `src/types.ts`:
  - `MatchKeys`: tablica równoległa do `ingredients`; element to tablica opcji `{ k: string[]; p?: string[] }`, gdzie `p` to klucze rodziców osobnego produktu;
  - `IngredientMatch`: `{ status: "have" | "unknown"; mainExcluded: boolean; via: string | null }`. `via` to `product` zamiennika, który dał „mam”. Gdy główna opcja jest wykluczona, a żaden zamiennik nie daje „mam”, `via` to pierwszy niewykluczony zamiennik. Użytkownik z alergią musi widzieć, czym zastąpić wykluczony składnik;
  - `MatchedRecipe`: `Recipe & { match: { percent: number | null; ingredients: IngredientMatch[] } }`.

#### 3. Runner testów

**File**: `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml`

**Intent**: Dodać Vitest jako runner wymagany przez AGENTS.md i roadmapę.

**Contract**:

- devDependency `vitest`; skrypt `"test": "vitest run"`.
- `vitest.config.ts` ze środowiskiem `node` i aliasem `@/` → `src/`. Ścieżkę budować przez `fileURLToPath(new URL("./src/", import.meta.url))`, bo `.pathname` na Windows daje `/C:/…` (Context7 `/vitest-dev/vitest`, common-errors: alias musi być ścieżką absolutną).
- W jobie `ci` krok `npm test` po `npx astro check`.

#### 4. Testy reguły

**File**: `src/lib/matching/*.test.ts`

**Intent**: Przypiąć regułę przypadkami z PRD i decyzjami z tej sesji.

**Contract**: Testy obejmują co najmniej:

- pomidor + chleb + mozzarella → „mozzarella z pomidorem” = 100%;
- odmiana (`pomidory`, `jajek`, `soli`, `czosnku`), wielkość liter, brak polskich znaków (`sol`), literówka (`mozarella`), synonim (`kartofel`);
- krótkie słowa: `sól ≠ sok`, `ryż ≠ ryby`, `mąka ≠ mak`;
- posiadanie i wykluczenia z przykładów w punktach 5 i 6;
- zamienniki: zablokowany tylko przy wszystkich opcjach wykluczonych; wykluczony zamiennik nie daje „mam”;
- wykluczona główna opcja z niewykluczonym zamiennikiem: `mainExcluded: true`, a `via` wskazuje zamiennik (np. wykluczenie „jogurt naturalny” → `via: "jogurt roślinny"`) także przy statusie „brak informacji”;
- duplikaty, przepis 0% na końcu, remisy (5/5 przed 2/2, 3/6 przed 1/2), same wykluczenia → `percent: null`;
- strażnik wersji: odcisk (hash) kluczy dla stałej listy słów i całego słownika jest zapisany w teście razem z `MATCH_KEYS_VERSION`. Zmiana słownika lub normalizacji bez podniesienia wersji wywraca test.

#### 5. Benchmark

**File**: `scripts/bench-match.ts`, `package.json` (`"bench:match"`)

**Intent**: Powtarzalny pomiar parsowania i oceny 1000 syntetycznych przepisów (deterministyczne dane) przez `rankRecipes`.

**Contract**:

- Uruchamiany przez `tsx` (nowa devDependency, rozwiązuje alias z `tsconfig.json`).
- Wypisuje medianę ms dla `JSON.parse` kluczy i dla `rankRecipes`.

### Success Criteria:

#### Automated Verification:

- Testy reguły przechodzą: `npm test`
- Lint przechodzi z wyłączonym katalogiem `vendor`: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi z zaimportowanym stemmerem: `npm run build`

#### Manual Verification:

- `npm run bench:match` pokazuje medianę parsowania i oceny ≤ 8 ms lokalnie przy 1000 przepisów; w Workers Logs < 10 ms (sprawdzane po wdrożeniu w 3.8)
- Tymczasowe wywołanie `stemWord` w endpoincie działa w `npm run dev` na workerd (sprawdzenie z `infrastructure.md:171`), a `npm run build` z tym importem przechodzi; potem wywołanie jest usunięte

**Implementation Note**: Po automatycznej weryfikacji zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Klucze w bazie, serwis i API

### Overview

Kolumna kluczy, skrypt przeliczania, serwis z fallbackiem dla nieaktualnych wierszy i endpoint dopasowania.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/20261013120000_add_recipe_match_keys.sql`

**Intent**: Dodać kolumny pochodne. Wybrany wariant „klucze przy zapisie” (Plan) opiera się na pomiarze CPU powyżej.

**Contract**:

- `alter table public.recipes add column match_keys jsonb, add column match_keys_version integer;`, obie nullable, z komentarzem wskazującym `computeMatchKeys`.
- Migracja jest addytywna i zgodna wstecz (`infrastructure.md:175`).
- Nie dodaje polityk zapisu: zapis kluczy idzie tylko przez service role. Istniejąca polityka `select` obejmuje nowe kolumny.

#### 2. Skrypt przeliczania

**File**: `scripts/match-keys.ts`, `package.json` (`"match-keys": "tsx scripts/match-keys.ts"`)

**Intent**: Wypełnić `match_keys` dla wierszy z `match_keys_version` równym null lub różnym od `MATCH_KEYS_VERSION`.

**Contract**:

- Czyta `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` z `process.env`. Klucz service role nie trafia do `astro:env`, do `.dev.vars` ani do Workera (AGENTS.md Hard Rules).
- Stronicuje po 1000 i aktualizuje wiersz po wierszu po `id`.
- Wypisuje `updated <n>`. Przy błędzie kończy się kodem ≠ 0.
- Jest idempotentny: drugie uruchomienie wypisuje `updated 0`.
- Lint dla `scripts/**/*.ts` dostaje `no-console: off` na wzór `scriptsConfig` (`eslint.config.js:73-78`), z zachowaną kontrolą typów.

#### 3. Serwis

**File**: `src/lib/services/recipes.ts`

**Intent**: Dodać `matchRecipes` obok `listRecipes`, w tym samym stylu (`research.md:119`).

**Contract**: `matchRecipes(supabase, pantry: { have: string[]; staple: string[]; exclude: string[] }, { limit, offset }): Promise<{ recipes: MatchedRecipe[]; hasMore: boolean }>`. Kroki:

1. Pobrać `id, name, match_keys, match_keys_version` w porcjach po 1000 (Critical Implementation Details).
2. Jeśli są wiersze z nieaktualną wersją, pobrać ich `id, ingredients` filtrem po stronie serwera: `.or("match_keys_version.is.null,match_keys_version.neq.<MATCH_KEYS_VERSION>")`, w porcjach po 1000 przez `range`, po `id`. Klucze policzyć w pamięci. Nie używać listy `in('id', …)`: 1000 UUID to ok. 37 KB w adresie.
3. Zbudować klucze spiżarki: posiadane i stałe przez `normalizeTag`, wykluczenia przez `exclude.flatMap(normalizeExclusion)` (jedno wykluczenie może dać kilka tagów, np. „maka” → mak i mąka). Wywołać `rankRecipes`, wyciąć stronę `offset..offset+limit`.
4. Pobrać pełne wiersze strony (`RECIPE_COLUMNS`, `in('id', …)`), ułożyć je w kolejności rankingu i dołączyć `match`.

Błędy Supabase są rzucane dalej bez zmian (`recipes.ts:54-56`).

#### 4. Endpoint

**File**: `src/pages/api/recipes/match.ts`; `parseIntParam` przeniesiony do `src/lib/query-params.ts` i używany w obu endpointach

**Intent**: `GET /api/recipes/match` dla wyspy (`research.md:120-124`). Posiadane żyją tylko w sesji (PRD FR-003), więc listy przychodzą w żądaniu.

**Contract**:

- Parametry powtarzane: `have`, `staple`, `exclude`. Do tego `limit` (domyślnie 10, maks. 50) i `offset`, jak w `index.ts:5-6`.
- Tag po `trim` musi być niepusty i mieć ≤ 60 znaków; ≤ 30 tagów na listę. Wszystkie trzy listy puste → 400 `invalid_query`. Pusty widok obsługuje `/api/recipes`.
- Kody `400 invalid_query`, `503 not_configured`, `500 database_error`, `401` z middleware (`src/middleware.ts:34-36`).
- Odpowiedź: `{ recipes: MatchedRecipe[], hasMore }`.

#### 5. Smoke i CI

**File**: `scripts/smoke.mjs`, `.github/workflows/ci.yml`

**Intent**: Sprawdzić skrypt kluczy i endpoint na prawdziwym Supabase.

**Contract**:

- W jobie smoke po `supabase start` krok `npm run match-keys` z `SUPABASE_URL=$API_URL` i `SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY`, sprawdzający `updated 5`, a przy drugim uruchomieniu `updated 0`.
- Smoke po zalogowaniu woła `/api/recipes/match?have=pomidor&have=chleb&exclude=jogurt`. Najpierw sprawdza status 200 i `Array.isArray(body.recipes)` (lessons.md), potem treść:
  - „Babeczki z jogurtem naturalnym” nie ma na liście (wszystkie opcje jogurtu w seedzie zawierają „jogurt”);
  - pozostałe 4 przepisy z seeda są na liście;
  - co najmniej jeden `match.percent` > 0, a wartości są nierosnące.

### Success Criteria:

#### Automated Verification:

- Migracja nakłada się czysto: `npx supabase db reset`
- Testy przechodzą, w tym testy `matchRecipes` na sztucznym kliencie: stronicowanie po 1000, fallback dla nieaktualnej wersji, kolejność strony: `npm test`
- Lint i typy: `npm run lint`, `npx astro check`
- Build: `npm run build`
- CI: krok `npm run match-keys` wypisuje `updated 5`, potem `updated 0`; sprawdzenia endpointu przechodzą w `npm run smoke`

#### Manual Verification:

- `curl` na `/api/recipes/match` przy wyzerowanych `match_keys` (bez skryptu) zwraca te same wyniki co po przeliczeniu

**Implementation Note**: Po automatycznej weryfikacji zatrzymaj się na ręczne potwierdzenie przed fazą 3.

---

## Phase 3: Widok spiżarki i lista

### Overview

Wyspa React na `/`: trzy sekcje tagów, przycisk zastosowania, lista kafelków z doczytywaniem.

### Changes Required:

#### 1. Komponenty shadcn

**File**: `src/components/ui/input.tsx`, `badge.tsx`

**Intent**: Dodać przez `npx shadcn@latest add input badge` (AGENTS.md).

**Contract**: Pliki wygenerowane przez CLI, bez ręcznych przeróbek.

#### 2. Kafelek przepisu wspólny z S-02

**File**: `src/components/recipes/RecipeTile.tsx`

**Intent**: Jeden kafelek dla listy bez filtrów i z filtrami, żeby S-02 nie budował drugiego (`roadmap.md:130`).

**Contract**:

- Props: `recipe: Recipe`, `match?: MatchedRecipe["match"]`.
- Pokazuje nazwę, odznakę `NN%` tylko przy `percent !== null` i składniki jako tagi. Zielony = „mam”, szary = „brak informacji” (PRD FR-006).
- Status jest podany także tekstem dostępnym dla czytników ekranu, a nie tylko kolorem.
- Przy `via` tag pokazuje zamiennik, np. „Miód (zamiennik: syrop klonowy)”.
- Przy `mainExcluded` tag pokazuje, że główna opcja jest wykluczona, i wskazuje zamiennik, np. „Jogurt naturalny 2% → użyj: jogurt roślinny”.
- Klasy łączone przez `cn()`.

#### 3. Wejście tagów i stan

**File**: `src/components/pantry/TagInput.tsx`, `src/components/hooks/usePantryMatch.ts`

**Intent**: Tag dodaje się Enterem, usuwa przyciskiem ×. Duplikaty w sekcji są pomijane bez względu na wielkość liter (PRD przepływ MVP, krok 3).

**Contract**: Hook trzyma trzy listy, wynik, `hasMore`, `offset`, stan ładowania i błędu. Wybiera endpoint:

- wszystkie listy puste → `/api/recipes`;
- w przeciwnym razie `/api/recipes/match`.

Najpierw sprawdza `res.ok` i kształt odpowiedzi, potem jej treść (lessons.md). Zmiana tagów nie odświeża listy sama; dopiero „Zastosuj filtry” (PRD krok 4).

#### 4. Strona

**File**: `src/components/pantry/PantryMatch.tsx`, `src/pages/index.astro`

**Intent**: Zastąpić placeholder wyspą `client:load` w `AppLayout` (`research.md:112`).

**Contract**:

- Podpowiedź nad sekcjami: dodaj przyprawy i dodatki do stałych (PRD Business Logic).
- Bez filtrów: zachęta „Wypełnij spiżarkę, żeby zobaczyć dopasowanie” i 10 przepisów (FR-005).
- Pusty wynik po filtrach: komunikat, że wszystkie przepisy zawierają wykluczony składnik.
- „Pokaż więcej” doczytuje kolejne 10 z tymi samymi filtrami.
- Układ działa na telefonie i na desktopie (PRD NFR).

### Success Criteria:

#### Automated Verification:

- Lint, typy, testy i build: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- Smoke w CI nadal przechodzi: `npm run smoke`

#### Manual Verification:

- Po zalogowaniu `/` pokazuje zachętę i 10 przepisów bez %; „Pokaż więcej” doczytuje kolejne
- Posiadane „banan, płatki owsiane, miód, sól” podnoszą „Babeczki z jogurtem naturalnym” na górę z zielonymi tagami tych składników
- Wykluczenie „jogurt” ukrywa „Babeczki z jogurtem naturalnym”; wykluczenie „jogurt naturalny” ich nie ukrywa (zostaje „jogurt roślinny”), a kafelek wskazuje zamiennik
- Tagi dodają się Enterem i usuwają ×; lista zmienia się dopiero po „Zastosuj filtry”
- Widok jest używalny na szerokości telefonu (ok. 375 px) i na desktopie
- Po wdrożeniu Workers Logs pokazują CPU dla `/api/recipes/match` poniżej 10 ms (`infrastructure.md:159`)

---

## Testing Strategy

### Unit Tests:

- Reguła dopasowania, czyli wszystkie przypadki z Phase 1 §4. To one blokują regresje wykluczeń.
- `matchRecipes` na sztucznym kliencie: stronicowanie po 1000, fallback dla nieaktualnej wersji, kolejność strony zgodna z rankingiem.

### Integration Tests:

- CI smoke na lokalnym Supabase: przeliczenie kluczy (idempotentne) i `GET /api/recipes/match` z wykluczeniem z seeda.

### Manual Testing Steps:

1. `npx supabase db reset`, potem `npm run match-keys` z lokalnym kluczem service role, potem `npm run dev`; zalogować się.
2. Sprawdzić widok pusty, filtry, wykluczenia i doczytywanie według kryteriów fazy 3.
3. Wyzerować `match_keys` w lokalnej bazie i potwierdzić, że wyniki się nie zmieniają.

## Performance Considerations

- Budżet: ≤ 10 ms CPU na żądanie na planie Free (`infrastructure.md:45`); pomiar lokalny z gotowymi kluczami to ok. 5 ms przy 1000 przepisów.
- Ścieżka awaryjna z `infrastructure.md:170`: przy błędzie 1102 albo CPU blisko limitu przejść na Workers Paid ($5/mies.); wymaga zgody człowieka.
- Opóźnienie: normalnie 2 kolejne zapytania (klucze, strona), z nieaktualnymi wierszami 3 (`infrastructure.md:172`: minimum sekwencyjnych zapytań). Cel: lista w < 1 s (PRD NFR).

## Migration Notes

- Migracja jest addytywna. Wdrożenie: najpierw migracja, potem kod (`infrastructure.md:175`). Migracja na produkcji wymaga zgody człowieka (`infrastructure.md:153`).
- **Pierwsze wdrożenie (v1):** migracja → `npm run match-keys` → wdrożenie kodu. Stary kod nie czyta kolumny, więc nie ma okna z nieaktualnymi kluczami.
- Do czasu przeliczenia kod działa poprawnie, bo dla wierszy bez kluczy liczy je na bieżąco, kosztem CPU. Przy dużym katalogu cały katalog nieaktualny może przekroczyć 10 ms CPU, dlatego skrypt uruchamia się zaraz po wdrożeniu.
- **Przeliczanie po zmianie słownika, normalizacji lub stemmera:**
  1. PR zmienia `dictionary.ts` i podnosi `MATCH_KEYS_VERSION`. Test odcisku wymusza podniesienie wersji.
  2. Po wdrożeniu wiersze ze starą wersją są liczone w żądaniu, więc wyniki są poprawne od razu. Przy katalogu bliskim 1000 przepisów może to przekroczyć 10 ms CPU, więc krok 3 następuje zaraz po wdrożeniu.
  3. `npm run match-keys` przelicza tylko wiersze z inną wersją i wypisuje `updated <n>`. Na produkcji uruchamia go człowiek z kluczem service role.
  4. Drugie uruchomienie musi wypisać `updated 0`.
- **Nowe zapisy przepisów (S-05, F-02)** muszą wołać `computeMatchKeys` i zapisywać `match_keys_version = MATCH_KEYS_VERSION`. Do tego czasu brak kluczy obsługuje fallback.

## References

- Research wewnętrzny: `context/changes/first-pantry-match/research.md`
- Research zewnętrzny: `context/changes/first-pantry-match/external-research.md`
- Infrastruktura i ryzyka CPU: `context/foundation/infrastructure.md:45,170-175`
- PRD Business Logic, US-01, FR-002–FR-006: `context/foundation/prd.md`
- Roadmapa S-03: `context/foundation/roadmap.md:133-144`
- Kontrakt danych: `docs/reference/recipe-data-contract.md:35-45,99-100`
- Wzorzec serwisu: `src/lib/services/recipes.ts:41-62`; endpoint: `src/pages/api/recipes/index.ts:9-43`
- Vitest alias: Context7 `/vitest-dev/vitest` (common-errors)
- Lekcje: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Rdzeń dopasowania

#### Automated

- [x] 1.1 Testy reguły przechodzą: `npm test` — f5b7c22
- [x] 1.2 Lint przechodzi z wyłączonym katalogiem `vendor`: `npm run lint` — f5b7c22
- [x] 1.3 Typy przechodzą: `npx astro check` — f5b7c22
- [x] 1.4 Build przechodzi z zaimportowanym stemmerem: `npm run build` — f5b7c22

#### Manual

- [x] 1.5 `npm run bench:match` pokazuje medianę parsowania i oceny ≤ 8 ms lokalnie, < 10 ms w Workers Logs — f5b7c22
- [x] 1.6 Tymczasowe wywołanie `stemWord` w endpoincie działa w `npm run dev` na workerd i w `npm run build`, a potem jest usunięte — f5b7c22

### Phase 2: Klucze w bazie, serwis i API

#### Automated

- [ ] 2.1 Migracja nakłada się czysto: `npx supabase db reset`
- [x] 2.2 Testy przechodzą, w tym testy `matchRecipes` na sztucznym kliencie: `npm test`
- [x] 2.3 Lint i typy: `npm run lint`, `npx astro check`
- [x] 2.4 Build: `npm run build`
- [ ] 2.5 CI: krok `npm run match-keys` wypisuje `updated 5`, potem `updated 0`; sprawdzenia endpointu przechodzą w `npm run smoke`

#### Manual

- [ ] 2.6 `curl` na `/api/recipes/match` przy wyzerowanych `match_keys` zwraca te same wyniki co po przeliczeniu

### Phase 3: Widok spiżarki i lista

#### Automated

- [ ] 3.1 Lint, typy, testy i build: `npm run lint`, `npx astro check`, `npm test`, `npm run build`
- [ ] 3.2 Smoke w CI nadal przechodzi: `npm run smoke`

#### Manual

- [ ] 3.3 Po zalogowaniu `/` pokazuje zachętę i 10 przepisów bez %; „Pokaż więcej” doczytuje kolejne
- [ ] 3.4 Posiadane „banan, płatki owsiane, miód, sól” podnoszą „Babeczki z jogurtem naturalnym” na górę z zielonymi tagami
- [ ] 3.5 Wykluczenie „jogurt” ukrywa Babeczki; „jogurt naturalny” ich nie ukrywa, a kafelek wskazuje zamiennik
- [ ] 3.6 Tagi dodają się Enterem i usuwają ×; lista zmienia się dopiero po „Zastosuj filtry”
- [ ] 3.7 Widok jest używalny na szerokości telefonu i na desktopie
- [ ] 3.8 Po wdrożeniu Workers Logs pokazują CPU dla `/api/recipes/match` poniżej 10 ms
