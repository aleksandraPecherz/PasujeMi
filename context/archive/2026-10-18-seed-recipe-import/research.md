---
date: 2026-10-18T10:58:43+02:00
researcher: Claude (Opus 5.5) dla Aleksandry Pęcherz
git_commit: 5dd85da9ef925c54bfc4688bbbf403e2a6537796
branch: recipe-import
repository: pasujemi-import
topic: "F-02 seed-recipe-import: skrypt importu przepisów z data/recipes.xlsx do public.recipes; nazwy handlowe składników"
tags: [research, import, recipes, xlsx, supabase, matching, F-02]
status: complete
last_updated: 2026-10-18
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Plik xlsx podmieniony o 11:11; wiersz 39 ma teraz 5 zamienników malin (konflikt (b) i pytanie 2)."
---

# Research: F-02 seed-recipe-import

**Date**: 2026-10-18T10:58:43+02:00
**Researcher**: Claude (Opus 5.5) dla Aleksandry Pęcherz
**Git Commit**: 5dd85da9ef925c54bfc4688bbbf403e2a6537796 (zmiany w drzewie roboczym: tylko `context/changes/seed-recipe-import/`)
**Branch**: recipe-import
**Repository**: pasujemi-import

## Research Question

F-02 z roadmapy: skrypt importu „70” przepisów z `data/recipes.xlsx` (plik lokalny, poza gitem) do tabeli `recipes` według `docs/reference/recipe-data-contract.md`. Ustalone przez autorkę:

- autorką importowanych przepisów jest autorka aplikacji (decyzja z S-05);
- import najpierw tylko na lokalny Supabase w Dockerze;
- na produkcji autorka uruchamia go sama, ręcznie, na końcu.

Pytanie otwarte z roadmapy: co zrobić z nazwami handlowymi składników (np. serek z marką i gramaturą)?

## Summary

1. **W pliku jest 76 przepisów, nie 70.** `data/recipes.xlsx` ma jeden arkusz `Arkusz1`: nagłówek w wierszu 1 i 76 niepustych wierszy danych (2–77). Każdy z nich ma nazwę, a żadna nazwa się nie powtarza. Liczba 76 zgadza się z kontraktem (`docs/reference/recipe-data-contract.md:84`) i z planem F-01 (`context/archive/2026-10-12-recipe-catalog-contract/plan.md:5`). W żadnym dokumencie nie pada liczba 70. Plan musi przyjąć 76, chyba że autorka świadomie chce pominąć 6 przepisów.
2. **Nazwy handlowe w obecnych danych:**
   - Marki występują tylko w zamiennikach. Jest 9 wystąpień: Lazur ×2, Mlekovita ×3, Ryki („active protein plus”) ×2, Go Vege ×1, Vemondo ×1. Żaden składnik główny nie zawiera marki z tej listy.
   - Gramatury wpisanej w nazwę (np. „200g” poza nawiasem ilości) nie ma w żadnej pozycji.
   - Wszystkie „serki” w pliku mają nazwy ogólne: „serek wiejski naturalny”, „Serek homogenizowany naturalny”, „Serek śmietankowy”, „serek proteinowy ze skyrem waniliowy”.
   - Wniosek: przykład z roadmapy (serek z marką i gramaturą) w tej wersji pliku nie występuje. Istniejąca reguła kontraktu wystarcza (`recipe-data-contract.md:100,107-116`): marka zostaje w `name`, a `product` jest ogólny. Importer potrzebuje do tego jawnej listy marek.
3. **Dopasowanie korzysta tylko z `product`** (`src/lib/matching/keys.ts:105-111`), więc `product` musi być bez marki:
   - Marka w `product` zwykle nie psuje dopasowania z ogólnego tagu, bo działa ono na zasadzie podzbioru kluczy (`src/lib/matching/rank.ts:104-107`).
   - Zostawia jednak szum: marka staje się celem wykluczeń, pojawiają się fałszywe trafienia przez tolerancję literówek, a etykieta „zamiast …” pokazuje markę.
   - Kodu dopasowania nie trzeba zmieniać pod F-02. Luki w słowniku („ser” nie obejmuje „serek”, wykluczenie „mleko” nie ukrywa „napoju sojowego”) należą do S-03.
4. **Do ponownego użycia:**
   - walidator S-05 `parseRecipeInput` (`src/lib/recipes/validate.ts:176-198`);
   - `computeMatchKeys` i `MATCH_KEYS_VERSION` (`src/lib/matching/keys.ts:10,105`);
   - wzorzec klienta service role z `scripts/match-keys.ts:17-24`.

   W tym łańcuchu importów nie ma `astro:*`, więc całość działa pod `tsx`. Nie ma natomiast żadnej biblioteki do xlsx (sprawdzone `package.json` i `package-lock.json`).

5. **Konflikty danych z kontraktem i walidatorem, które plan musi rozstrzygnąć:**
   - (a) Przecinek dziesiętny w zamiennikach rozdzielanych przecinkami („mleko 1,5% (45g)”, „mleko wysokobiałkowe 0,5% Mlekovita (170g)”). Reguła „dziel po `;` lub `,` poza nawiasami” (`recipe-data-contract.md:98`) rozcina je na „mleko 1” i „5% (45g)”.
   - (b) Wiersz 39 ma 8 zamienników jednego składnika, a `MAX_SUBSTITUTES = 5` (`src/lib/recipes/limits.ts:5`), więc `parseRecipeInput` odrzuci ten przepis.
   - (c) 5 przepisów z `supabase/seed.sql` to prawdziwe przepisy z tego samego pliku. Lokalny import zdubluje je po nazwie.
6. **Nadal otwarte (nie ustalono tego w żadnym dokumencie):**
   - jak skrypt dostaje UUID autorki;
   - idempotencja i ponowne uruchomienie;
   - tryb podglądu i potwierdzenie przeliczonych kcal przed zapisem. Samo potwierdzenie jest obowiązkiem z kontraktu (`recipe-data-contract.md:104`).

## Detailed Findings

### Plik źródłowy `data/recipes.xlsx` (stan z 2026-10-18)

Metoda: pierwszy parser to stdlib Pythona, uruchamiany z flagą `-I` i czytający OOXML (zipfile + xml) bez nowych zależności. Drugi to zgrubny skaner nazw, który nie jest parserem z kontraktu. Oba skrypty leżą w scratchpadzie tej sesji, nie w repo. Odwołania podaję jako „wiersz N”, czyli numer wiersza w Excelu.

- **Liczba:** 77 wierszy, z których 1 to nagłówek, a 76 to przepisy (wiersze 2–77). Brak pustych nazw i brak powtórzonych nazw. Najdłuższa nazwa ma 95 znaków, poniżej `MAX_RECIPE_NAME_LENGTH = 120` (`src/lib/recipes/limits.ts:3`).
- **Kolumny:** dokładnie te z `recipe-data-contract.md:84`. Puste komórki są tylko w `waga (g)`: 36 z 76, co zgadza się z `recipe-data-contract.md:92`.
- **Porcje:** 1.0 ×54, 2.0 ×14, 4.0 ×3, 5.0 ×2, 6.0 ×2, 3.0 ×1. Czas od 3 do 70 min. Wartości w pliku są typu float (`5.0`), zgodnie z regułą „liczby całkowite” (`recipe-data-contract.md:105`).
- **rodzaj:** 13 różnych zapisów. Wszystkie składają się wyłącznie z 4 dozwolonych wartości, rozdzielonych `;` ze spacją przed albo bez. 3 przepisy mają jedną wartość: `na słodko` ×2, `na wytrawnie` ×1. Kolejność bywa odwrócona (`na zimno; na wytrawnie`).
- **Jednostki** w nawiasach ilości: `g` ×1343, `szczypta` ×2. Innych jednostek w nawiasach nie znaleziono.
- **Kcal na porcję.** Wśród 22 przepisów z `servings > 1` stosunek `kcal / (400 × servings)` wynosi:
  - 0,96–1,06 w 12 przepisach; reguła kontraktu je przeliczy. Są to wiersze 48, 51, 57, 58, 59, 64, 65, 66, 70, 73, 74 i 77.
  - 0,16–0,52 w 10 przepisach; zostają bez zmian.

  Kontrakt podaje dla przepisów „na porcję” górną granicę „co najwyżej 0,51” (`recipe-data-contract.md:104`). Wiersz 62 („Mini tarty z truskawkami i jogurtem”) ma 0,52. Ta drobna nieścisłość nie zmienia wyniku, bo próg wynosi 0,75.

- **Brak ilości** (`amount`/`unit` = null): zgrubny skaner nie potwierdził żadnej prawdziwej pozycji bez ilości. Wszystkie 12 jego trafień to artefakty podziału:
  - przecinek dziesiętny („mleko 1” + „5% (45g)”);
  - przecinek w nazwie przy separatorze `;` w bloku zamienników („Placuszki twarogowe z tofu…”: `Borówki amerykańskie, świeże lub mrożone – 55 g`);
  - układ z myślnikiem.

  Liczbę pozycji bez ilości trzeba policzyć parserem z kontraktu, w trybie podglądu.

### Nazwy handlowe: odpowiedź na pytanie z roadmapy

- **Marki w pliku** (lista z `recipe-data-contract.md:111-116`, plus szersze wyszukanie: piątnica, danone, bakoma, zott, president, hochland, almette, alpro, pilos, lidl, biedronka, skyr):

  | Marka / linia                | Wystąpienia | Wiersze   | Gdzie     |
  | ---------------------------- | ----------- | --------- | --------- |
  | Lazur                        | 2           | 5, 58     | zamiennik |
  | Mlekovita                    | 3           | 9, 20, 59 | zamiennik |
  | Ryki + „active protein plus” | 2           | 32, 58    | zamiennik |
  | Go Vege                      | 1           | 54        | zamiennik |
  | Vemondo                      | 1           | 54        | zamiennik |

  Z dodatkowej listy żadna marka nie wystąpiła. „skyr” pojawia się w składniku głównym (wiersze 10 i 14: „serek proteinowy ze skyrem waniliowy”), ale to rodzaj produktu, nie marka.

- **Wielka litera w środku nazwy:** poza wymienionymi markami to „Ser Grana Padano starty” (4 wystąpienia: 2 główne, 2 zamienniki) oraz „Ser typu Feta” (3 wystąpienia, wszystkie główne). To nazwy gatunków sera, nie marki, więc według reguły kontraktu zostają w `product`.
- **Gramatura w nazwie:** brak. Szukałam wzorca `liczba + g|kg|ml|l|szt` po usunięciu właściwej ilości (`(N g)` / `- N g`). Cyfry, które zostają w nazwach, to procenty i typy: „2%”, „1,5%”, „12%”, „70%”, „30%”, „typ 500”. Kontrakt zachowuje je w `product` („Mleko 1,5%” → „mleko 1,5%”, `recipe-data-contract.md:100`), a tokenizer i tak je pomija (`src/lib/matching/tokenize.ts:7-13`).
- **Wniosek:** w obecnym pliku sprawa nazw handlowych sprowadza się do usunięcia 5 marek i linii z `product` w 9 zamiennikach. Reguła dla gramatury w nazwie byłaby dziś martwym kodem.

  Jest też wariant zabezpieczający na przyszłe pliki (dla planu): importer w trybie podglądu wypisuje każdą pozycję, w której słowo zaczyna się wielką literą w środku nazwy albo w nazwie zostaje liczba z jednostką. Autorka decyduje wtedy, czy dopisać markę do listy.

- **Dlaczego `product` bez marki** (analiza `src/lib/matching`):
  - Klucze powstają tylko z `product` składnika i jego zamienników (`keys.ts:105-111`). Pole `name` nie wpływa na dopasowanie.
  - Tokenizacja: małe litery, NFC, podział po znakach niebędących literami, a stopwords to z/ze/i/lub/oraz/w/na/do/bez (`tokenize.ts:4-13`). Liczby i `%` znikają; „200g” zostawia samotny token „g”.
  - Produkt jest „posiadany”, gdy klucze tagu ⊆ klucze produktu albo odwrotnie. Wykluczenie działa jako klucze wykluczenia ⊆ klucze produktu ∪ rodzice (`rank.ts:104-107`).
  - Agent policzył przykładowe klucze vendorowanym stemmerem w skrypcie w scratchpadzie (nie przez `wordKey` ani vitest): „ser żółty active protein plus Ryki” → `[ser, zolt, activ, protein, plus, ryk]`.
  - Marka w `product` sprawia, że wykluczenie „ryki” ukryłoby przepis. Klucze marek o długości co najmniej 4 znaków dopuszczają jedną literówkę (`keys.ts:15-23`), co grozi fałszywymi trafieniami. Do tego etykieta zamiennika (`rank.ts:200`) pokazuje markę.
  - W `src/lib/matching` nie ma listy marek; `dictionary.ts` zawiera 5 synonimów, 3 osobne produkty i 1 wyjątek. Usuwanie marek musi więc zrobić importer, zgodnie z założeniem S-03 (`context/archive/2026-10-12-first-pantry-match/research.md:29`).
- **Poza zakresem F-02, ale widoczne na tych danych:**
  - Tag „ser” nie obejmuje „serek wiejski” (`ser` ≠ `serek`, a krótkie klucze nie mają tolerancji).
  - Wykluczenie „mleko” nie ukrywa „Napój sojowy Go Vege”, bo rodzica „mleko” ma tylko fraza „mleko sojowe” (`dictionary.ts:15-19`).

  Obie sprawy należą do słownika S-03 i wymagają podbicia `MATCH_KEYS_VERSION` (`dictionary.ts:1-2`).

### Konflikty danych z kontraktem i walidatorem

- **(a) Przecinek dziesiętny w zamiennikach.** 10 bloków `[...]` zawiera liczbę z przecinkiem dziesiętnym: w wierszach 9, 12, 14, 15, 38, 41, 44, 50, 59 i 68.
  - W 3 z nich (wiersze 44, 50, 68) przecinek stoi w nawiasie ilości, np. `(7,5g)`, albo blok jest rozdzielany `;`. Reguła „poza nawiasami” obsługuje je poprawnie.
  - W 7 blokach (wiersze 9, 12, 14, 15, 38, 41, 59) przecinek stoi w nazwie, poza nawiasem („1,5%”, „0,5%”), w bloku rozdzielanym przecinkami. Te bloki reguła rozcina źle, np. wiersz 15 `[zamienniki: mleko 1,5% (45g), mleko bez laktozy 2% (45g)]`.

  Na najwyższym poziomie problemu nie ma, bo tam kontrakt dzieli po przecinku tylko po ilości lub `]` (`recipe-data-contract.md:96`). W zamiennikach reguła jest szersza (`:98`).

  Sprawdzenie: w blokach bez `;` każdy przecinek, który nie stoi między cyframi, poprzedza `)` albo `g`. Na tym pliku działa więc reguła „w bloku z `;` dziel tylko po `;`, w przeciwnym razie po `,` stojącym po ilości”. Taką samą regułę kontrakt stosuje na najwyższym poziomie.

  Zmiana dokumentu `docs/reference/recipe-data-contract.md` należy do planu, nie do tego badania. `docs/reference` nie jest w `context/foundation/`, więc może być edytowany w ramach zmiany.

- **(b) Wiersz 39 — rozwiązane w pliku z 2026-10-18 11:11.** „Pudding na mleku roślinnym z gorzką czekoladą oraz malinami” ma teraz 5 zamienników malin: truskawki (130g), borówki amerykańskie (75g), jagody (85g), wiśnie (90g), śliwki (90g). Drugi blok („płatki migdałów”) ma 3 zamienniki.

  5 to dokładnie `MAX_SUBSTITUTES = 5` (`src/lib/recipes/limits.ts:5`, egzekwowane w `validate.ts:152`), więc z tego powodu `parseRecipeInput` już nie odrzuci przepisu.

  > Zastąpione: wcześniejsza wersja pliku (odczyt przed 11:11) miała 8 zamienników malin. Autorka usunęła banana, jabłko i mango, a pozostałe zamienniki zmieniły kolejność bez zmiany gramatur. W tej wersji pliku kolumna PRODUKTY zmieniła się tylko w wierszu 39. Wartości w innych kolumnach są takie same, choć liczby zapisano teraz bez `.0` (`5` zamiast `5.0`).

- **(c) Seed vs import lokalnie.** `supabase/seed.sql` wstawia 5 przepisów (`:5,36,57,82,110`): „Babeczki z jogurtem naturalnym”, „Kanapka z serem, szynką i ogórkiem”, „Twarożek z makrelą…”, „Danie jednogarnkowe z mięsem” i „Domowe spaghetti”. Wszystkie mają `author_id = null` (brak kolumny w insercie, default `auth.uid()` w kontekście seeda daje null; to wniosek z `20261017120000_add_recipe_author_and_insert.sql:11`, nie sprawdzony na bazie).

  Według `config.toml:60-65` seed ładuje się tylko przy `supabase start` i `db reset`, a więc nigdy na produkcji. Lokalny import doda te same przepisy drugi raz. Na produkcji duplikatów nie będzie (`context/archive/2026-10-12-recipe-catalog-contract/plan-brief.md:28`).

- **Mniejsze rozbieżności formatu:**
  - Kontrakt mówi o „74× `Nazwa (40g) …` i 2× `Nazwa - 120 g …`” (`recipe-data-contract.md:88`). Układ z myślnikiem spotkałam też wewnątrz bloku zamienników przepisu w układzie nawiasowym („Placuszki twarogowe z tofu…”: `[zamienniki: Mąka orkiszowa pełnoziarnista – 30 g ; …]`). Parser ilości musi więc w zamiennikach przyjmować oba zapisy. Kontrakt na to pozwala (`:97`), ale nie wspomina o tej mieszance.
  - Kroki: wiersz 51 ma 1476 znaków bez numeracji, z 5 średnikami i bez nowych linii. Po podziale po `;` zmieści się w `MAX_STEP_LENGTH = 1000` (`limits.ts:10`), o ile żaden fragment nie przekroczy limitu. Nie liczyłam długości po podziale.

### Kod do ponownego użycia

- **Walidacja:** `src/lib/recipes/validate.ts`, ręczne sprawdzenia bez zod.
  - `parseRecipeInput(body: unknown)` (`:176-198`) przyjmuje camelCase i zwraca `NewRecipe`.
  - Pusty `product` zamienia na `defaultProduct(name)` (`:37-39,123`), czyli nazwę małymi literami, razem z marką. Importer musi więc podawać `product` jawnie.
  - Ilość 0 jest odrzucana (`:133-135`). W pliku nie znalazłam ilości 0 g.
  - Makro jest zaokrąglane do 0,1 (`:192-194`).
  - Komunikaty błędów są po polsku i mają ścieżki w stylu `ingredients.1.substitutes.0.amount` (`:29`), co przyda się w raporcie importu.
- **Limity:** `src/lib/recipes/limits.ts:3-15`: nazwa ≤120, składników ≤40, zamienników ≤5, tekst składnika ≤80, kroków ≤30, krok ≤1000.
- **Zapis:** `createRecipe(supabase, authorId, recipe)` (`src/lib/services/recipes.ts:85-108`) mapuje pola na snake_case, ale **nie** zapisuje `match_keys` (`:83`). Importer działający jako service role może zapisać klucze sam. Wymaga tego S-03 (`context/archive/2026-10-12-first-pantry-match/plan.md:410`: „Nowe zapisy przepisów (S-05, F-02) muszą wołać `computeMatchKeys` i zapisywać `match_keys_version = MATCH_KEYS_VERSION`”). Inna droga to uruchomić `npm run match-keys` po imporcie.
  - Bez kluczy wiersze są przeliczane przy każdym żądaniu, do `MAX_RECOMPUTED_RECIPES = 200` (`limits.ts:23`). Przy 76 lub 81 wierszach limit nie zostanie przekroczony, ale każde żądanie zapłaci za przeliczenie CPU (por. lekcja „Bound user-driven CPU work”, `context/foundation/lessons.md:19-24`).
- **Wzorzec skryptu:** `scripts/match-keys.ts`.
  - `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` są czytane z `process.env` (`:17-21`), klient powstaje z `persistSession: false` (`:22-24`).
  - Nagłówek mówi, że klucz service role pochodzi tylko z powłoki i nigdy nie trafia do astro:env, `.dev.vars` ani Workera (`:1-4`).
  - Skrypt uruchamia się przez `tsx` (`package.json`: `"match-keys": "tsx scripts/match-keys.ts"`), a alias `@/` rozwiązuje tsx z `tsconfig.json` `paths`.
  - Jedynymi importami `astro:env` są `src/lib/supabase.ts:3` i `src/lib/config-status.ts`. Skryptowi nie wolno ich importować.
- **Brak biblioteki xlsx** w `package.json` i `package-lock.json`. Do wyboru w planie: dodać devDependency (np. `exceljs` lub `read-excel-file`) albo konwersję autorki do CSV/JSON. Plik `.xlsx` to zip z XML; w tym badaniu odczytałam go bez bibliotek, w Pythonie.
- **`data/` w `.gitignore:30-31`.** Plik istnieje lokalnie: 31 347 B, data modyfikacji 2026-10-12.
- **Testy:** vitest obejmuje `scripts/**/*.test.ts` (`vitest.config.ts:12`), więc testy parsera w `scripts/` (albo w `src/lib/...`) pójdą w `npm test` i w CI. `eslint .` sprawdza także `scripts/`. Testy nie mogą czytać `data/recipes.xlsx`, bo w CI go nie ma. Fixture musi być syntetyczna albo pochodzić z fragmentów już obecnych w `seed.sql`.

### Lokalny Supabase, CI i produkcja

- **Lokalnie:** API działa na `54321`, DB na `54322`, Studio na `54323` (`supabase/config.toml:10,29,91`). Rejestracja jest włączona, potwierdzanie e-maili wyłączone (`config.toml:169,209`). Klucz service role da się pobrać przez `supabase status -o env`, tak jak w CI (`.github/workflows/ci.yml:44`).
- **UUID autorki:** nie ustalono, jak skrypt ma go dostać. Decyzja S-05 mówi tylko, _co_ ma trafić do bazy: „import **wpisuje jej UUID z `auth.users` jawnie** w `author_id`” (`context/archive/2026-10-17-add-recipe/plan.md:74`). W repo nie ma użytkowników w seedzie ani wywołań `auth.admin`.
  - Lokalnie autorka musi mieć konto w lokalnym GoTrue; konto produkcyjne to inny UUID.
  - Możliwości:
    - zmienna lub flaga `AUTHOR_ID`;
    - wyszukanie po e-mailu przez `auth.admin.listUsers` (service role);
    - lokalne założenie konta, tak jak CI robi przez `/auth/v1/signup` (`ci.yml:61-71`).
- **CI:** job smoke zakłada dokładnie 5 przepisów i wynik `match-keys` `updated 5` / `updated 0` (`ci.yml:51,94-104`), a `scripts/smoke.mjs:163-180` sprawdza `total === 4` dla `exclude=jogurt`. Import uruchamiany ręcznie nie wpływa na CI. Dopisanie przepisów do `seed.sql` albo uruchomienie importu w CI zepsułoby te asercje.
- **Produkcja:**
  - Projekt Supabase ma ref `zocbniggvvctublymudo` (`context/deployment/deploy-plan.md:99`).
  - Aplikacja nigdy nie używa `service_role` (`deploy-plan.md:104`), a `.dev.vars` zawiera tylko `SUPABASE_URL` i `SUPABASE_KEY` (`deploy-plan.md:107`).
  - Zmiany na produkcji zatwierdza człowiek (`context/foundation/infrastructure.md:153`).
  - Produkcja nie ma dziś przepisów (`context/archive/2026-10-17-recipe-count/change.md:20`).
  - **Nie potwierdzono**, czy migracja `20261017120000_add_recipe_author_and_insert.sql` (kolumna `author_id`) jest już wypchnięta na produkcję. W archiwum S-05 nie znalazłam wpisu „db push done” (`context/archive/2026-10-17-add-recipe/plan.md:479`). To warunek wstępny produkcyjnego importu.

## Code References

- `docs/reference/recipe-data-contract.md:84-126`: źródło, reguły konwersji, marki, pułapki.
- `src/lib/recipes/validate.ts:37-39,115-156,176-198`: `defaultProduct`, parsowanie składnika i zamienników, `parseRecipeInput`.
- `src/lib/recipes/limits.ts:3-15,23`: limity zapisu, `MAX_RECOMPUTED_RECIPES`.
- `src/lib/services/recipes.ts:81-108`: `createRecipe`; `match_keys` zostają null.
- `src/lib/matching/keys.ts:10,15-23,105-111`: `MATCH_KEYS_VERSION`, równość kluczy, `computeMatchKeys`.
- `src/lib/matching/rank.ts:100-108`: reguły „posiadany” i „wykluczony”.
- `src/lib/matching/tokenize.ts:4-13`, `src/lib/matching/dictionary.ts:1-40`: tokenizacja, słownik (bez marek).
- `scripts/match-keys.ts:1-24`: wzorzec skryptu service role.
- `supabase/migrations/20261017120000_add_recipe_author_and_insert.sql:10-17`: `author_id`, komentarz o imporcie F-02.
- `supabase/seed.sql:1-3,5,36,57,82,110`: 5 przepisów z tego samego Excela.
- `supabase/config.toml:10,29,60-65,169,209`: lokalny Supabase.
- `.github/workflows/ci.yml:44,51,61-71,94-104`: asercje liczby przepisów, wzorzec pobierania kluczy i rejestracji.

## Architecture Insights

- Kontrakt zapisu ma dwie warstwy:
  - CHECK-i w bazie sprawdzają kolumny i to, że `ingredients` jest niepustą tablicą (`create_recipes.sql:9-12`);
  - kształt elementów i limity sprawdza piszący (`recipe-data-contract.md:128-130`).

  Importer powinien przepuszczać każdy rekord przez `parseRecipeInput` i nie pisać własnej walidacji. Jeśli limit importu ma być inny, decyzję trzeba podjąć jawnie (konflikt (b)).

- Parser Excela to logika czysta (tekst → `NewRecipe`), oddzielna od I/O (xlsx → wiersze, wiersze → Supabase). Dzięki temu da się ją testować w vitest bez pliku autorki i bez bazy.
- Sekrety: service role tylko z powłoki, nigdy przez `astro:env` (`scripts/match-keys.ts:1-4`, AGENTS.md Hard Rules).

## Historical Context (from prior changes)

- `context/archive/2026-10-17-add-recipe/plan.md:74` (oraz `:482`, `plan-brief.md:31,85`): decyzja 6, czyli autorką importu jest autorka aplikacji, a jej UUID wpisuje się jawnie. **Wciąż obowiązuje.** Sposób dostarczenia UUID nie jest opisany.
- `context/archive/2026-10-12-first-pantry-match/plan.md:410`: F-02 ma wołać `computeMatchKeys` i zapisywać wersję. **Wciąż obowiązuje.** Potwierdza to komentarz w `20261013120000_add_recipe_match_keys.sql:3`.
- `context/archive/2026-10-12-recipe-catalog-contract/plan.md:18,60` i `plan-brief.md:23`: marki zostają w `name`, `product` jest ogólny; „S-03 dopasowuje po produkcie, nie zgaduje marek”. **Wciąż obowiązuje** i zgadza się z kodem (`keys.ts:105-111`, brak listy marek w `src/lib/matching`).
- `context/archive/2026-10-12-recipe-catalog-contract/plan.md:5,13,40`: liczba 76 przepisów. **Potwierdzona** na pliku z 2026-10-18.
- `context/archive/2026-10-12-recipe-catalog-contract/plan.md:64`: próg kcal 0,75–1,25 i lista przeliczonych przepisów do potwierdzenia przez autorkę. **Obowiązuje.** Na pliku obejmuje 12 przepisów. Kontrakt mówi, że przepisy „na porcję” mają stosunek „co najwyżej 0,51”; w pliku jest 0,52 (wiersz 62). To drobna nieścisłość bez wpływu na wynik.
- `context/archive/2026-10-12-recipe-catalog-contract-review/reviews/impl-review.md:81-83` (F5, SKIPPED): twierdzenie, że `numeric` przychodzi z PostgREST jako tekst, było „do zweryfikowania na prawdziwych danych w F-02”. **Nierozstrzygnięte w tym badaniu.** Do sprawdzenia po imporcie lokalnym.
- `context/archive/2026-10-12-first-pantry-match/plan-brief.md:84`: po imporcie F-02 trzeba ponownie uruchomić `npm run bench:match` i sprawdzić CPU w Workers Logs na prawdziwym katalogu.
- `context/archive/2026-10-17-recipe-count/change.md:19-20`: ręczne sprawdzenia licznika 2.8–2.9 odłożono do czasu po imporcie F-02.

## Related Research

- `context/archive/2026-10-12-first-pantry-match/research.md`: dopasowanie po `product`.
- `context/archive/2026-10-17-add-recipe/research.md`: autorstwo i zapis przepisu.

## Open Questions

Decyzje dla planu lub autorki. Żadna nie blokuje samego badania.

1. **76 czy 70?** W pliku jest 76 przepisów. Jeśli 70 to celowy wybór (np. pominięcie 5 z seeda i jednego innego), trzeba wskazać, które.
2. ~~**Wiersz 39 z 8 zamiennikami:** podnieść `MAX_SUBSTITUTES`, ustalić osobny limit importu, przyciąć czy pominąć?~~ Rozstrzygnięte 2026-10-18 przez autorkę w pliku: wiersz 39 ma teraz 5 zamienników malin, czyli mieści się w `MAX_SUBSTITUTES = 5`. Limitów nie trzeba zmieniać.
3. **Separator w zamiennikach:** poprawić `recipe-data-contract.md:98` na regułę „przecinek tylko po ilości” (konflikt (a)).
4. **UUID autorki:** zmienna `AUTHOR_ID` czy wyszukanie po e-mailu? Lokalnie i na produkcji to różne UUID.
5. **Lokalne duplikaty z seeda:** pominąć przepisy, których nazwa już jest w bazie, zastąpić je, czy importować na czystą bazę bez seeda?
6. **Idempotencja i podgląd:** czy ponowne uruchomienie ma być bezpieczne (np. pomijanie istniejących nazw autorki)? Czy tryb podglądu, który pokazuje 12 przeliczonych kcal i zgłoszenia walidatora, wymaga osobnego potwierdzenia przed zapisem? Potwierdzenie przeliczeń wymaga kontrakt (`:104`).
7. **Odczyt xlsx:** nowa devDependency czy eksport do CSV/JSON po stronie autorki?
8. **Nazwy handlowe:** zostaje reguła kontraktu, czyli jawna lista marek. Do decyzji pozostaje, czy importer ma ostrzegać o nieznanych słowach z wielkiej litery i liczbach z jednostką w nazwie (zabezpieczenie na przyszłe pliki). Luki „ser”/„serek” oraz „mleko”/„napój sojowy” trafiają do słownika S-03, nie do F-02.
9. **Produkcja:** sprawdzić przed importem, czy migracja z `author_id` jest wypchnięta. Do tego ustalić, czy klucze dopasowania zapisuje importer, czy `npm run match-keys` po imporcie.
