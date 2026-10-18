# F-02 seed-recipe-import — plan implementacji

## Overview

Skrypt `tsx` importuje 76 przepisów autorki z `data/recipes.xlsx` do `public.recipes` według `docs/reference/recipe-data-contract.md`. Domyślnie działa jako podgląd (dry-run, tylko odczyt bazy): pokazuje błędy walidacji, przeliczone kcal do potwierdzenia, ostrzeżenia o możliwych markach i przepisy pomijane jako istniejące. Zapis jest osobną komendą: wstawia wszystkie nowe przepisy jednym insertem, z `author_id` autorki (szukanej po e-mailu) i z gotowymi `match_keys`. Issue F-02: #2.

## Current State Analysis

- Brak jakiegokolwiek importu i biblioteki xlsx (`package.json`). Plik `data/recipes.xlsx` jest tylko lokalnie (`.gitignore:30-31`): jeden arkusz, nagłówek + 76 przepisów (wiersze 2–77), nazwy unikalne (research, „Plik źródłowy”).
- Wiersz 39 ma od 2026-10-18 11:11 dokładnie 5 zamienników malin, więc mieści się w `MAX_SUBSTITUTES = 5` (`src/lib/recipes/limits.ts:5`). Limitów nie zmieniamy.
- Kontrakt dzieli zamienniki po `;` lub `,` poza nawiasami (`recipe-data-contract.md:98`). To rozcina 7 bloków z przecinkiem dziesiętnym w nazwie (wiersze 9, 12, 14, 15, 38, 41, 59), np. `mleko 1,5% (45g), mleko bez laktozy 2% (45g)`.
- Marki (Lazur, Mlekovita, Ryki + „active protein plus”, Go Vege, Vemondo) występują tylko w 9 zamiennikach. Gramatury w nazwach brak.
- 12 przepisów z `servings > 1` ma kcal „na całość” (wiersze 48, 51, 57, 58, 59, 64, 65, 66, 70, 73, 74, 77) — reguła kontraktu je przeliczy.
- 5 przepisów z `supabase/seed.sql` to te same przepisy co w pliku; lokalnie import je zduplikowałby. Produkcja nie ma dziś przepisów.

### Key Discoveries:

- `parseRecipeInput` (`src/lib/recipes/validate.ts:176-198`) waliduje `NewRecipe` z komunikatami po polsku i ścieżkami (`ingredients.1.substitutes.0.amount`). Pusty `product` zamienia na nazwę z marką (`:123`), więc importer zawsze podaje `product` jawnie.
- `createRecipe` (`src/lib/services/recipes.ts:85-108`) wstawia jeden wiersz i nie zapisuje `match_keys`. Plan S-03 wymaga, by F-02 zapisywał `computeMatchKeys(...)` i `match_keys_version = MATCH_KEYS_VERSION` (`context/archive/2026-10-12-first-pantry-match/plan.md:410`).
- Wzorzec skryptu service role: `scripts/match-keys.ts:1-24` (klucz tylko z powłoki, `persistSession: false`, `tsx`, alias `@/`).
- `author_id` dla F-02 wpisuje się jawnie (komentarz kolumny w `supabase/migrations/20261017120000_add_recipe_author_and_insert.sql:16-17`). Service role omija RLS i column grants.
- exceljs: `cell.text` spłaszcza rich text do zwykłego tekstu; `cell.value` daje liczbę dla komórek liczbowych (Context7, `/exceljs/exceljs`).
- vitest obejmuje `scripts/**/*.test.ts` (`vitest.config.ts:12`); testy nie mogą czytać `data/recipes.xlsx` (w CI go nie ma).
- CI smoke zakłada dokładnie 5 przepisów (`.github/workflows/ci.yml:51,94-104`). Import nie może być uruchamiany w CI ani dopisywany do `seed.sql`.

## Desired End State

- `npm run import-recipes -- --author-email <e-mail>` czyta xlsx, łączy się z bazą tylko do odczytu i wypisuje raport; nic nie zapisuje.
- `npm run import-recipes:write -- --author-email <e-mail>` wypisuje ten sam raport, a potem — tylko gdy nie ma żadnego błędu — wstawia wszystkie nowe przepisy jednym insertem z `author_id` autorki i aktualnymi `match_keys`. Ponowne uruchomienie wypisuje `inserted 0`.
- Lokalnie: 71 nowych przepisów autorki + 5 z seeda = 76 w aplikacji. Na produkcji: 76.
- `recipe-data-contract.md` opisuje regułę „przecinek dzieli tylko po ilości” także dla zamienników.

Weryfikacja: testy parsera w `npm test`, raport podglądu na prawdziwym pliku, liczba przepisów i dopasowanie w aplikacji.

## What We're NOT Doing

- Nie zmieniamy limitów (`MAX_SUBSTITUTES` zostaje 5) ani `parseRecipeInput`.
- Nie zmieniamy kodu dopasowania ani słownika S-03 (luki „ser”/„serek”, „mleko”/„napój sojowy” należą do S-03).
- Nie zastępujemy ani nie aktualizujemy istniejących przepisów — przepis o istniejącej nazwie jest tylko pomijany.
- Nie importujemy w CI i nie dopisujemy przepisów do `supabase/seed.sql`.
- Nie dodajemy endpointu ani UI do importu; to wyłącznie skrypt autorki.
- Nie obsługujemy reguły „gramatura w nazwie” poza ostrzeżeniem w raporcie.
- Nie wypychamy migracji na produkcję w ramach tego planu — `supabase db push --dry-run` tylko sprawdza; ewentualny `db push` to osobna, zatwierdzona przez autorkę decyzja.

## Implementation Approach

Czysta logika (wiersz Excela → `NewRecipe` + ostrzeżenia + informacja o przeliczeniu kcal) w `scripts/import-recipes/`, testowana w vitest na syntetycznych danych. Cienki skrypt `scripts/import-recipes.ts` robi I/O: czyta xlsx przez exceljs, szuka autorki, czyta istniejące nazwy, drukuje raport i — w trybie zapisu — wstawia wiersze. Każdy rekord przechodzi przez `parseRecipeInput`, więc importer nie ma własnej walidacji kształtu.

Zapis jest wszystko-albo-nic na dwóch poziomach: przy jakimkolwiek błędzie parsera lub walidatora nic nie jest wysyłane, a same nowe wiersze idą jednym żądaniem PostgREST (jeden INSERT, jedna transakcja).

## Critical Implementation Details

- **Kolejność podziału składników.** Najpierw wydziel bloki `[zamiennik(i): …]` (zastąp znacznikiem), dopiero potem dziel najwyższy poziom; inaczej `;` z wnętrza bloku rozcina składniki. Zamienniki przyczepiają się do pozycji, za którą stoi blok.
- **„Przecinek tylko po ilości”.** I na najwyższym poziomie, i w zamiennikach: jeśli fragment zawiera `;` poza nawiasami, dziel tylko po `;`; w przeciwnym razie dziel po `,` wyłącznie wtedy, gdy przed nim (pomijając spacje) kończy się ilość — `(liczba jednostka)` lub `- N jednostka` / `– N jednostka` — albo `]`. Przecinek dziesiętny (`1,5%`) i przecinek w nazwie zostają.
- **Normalizacja nazwy przepisu** do porównań (pomijanie istniejących i duplikaty w pliku): przycięcie, zwinięcie białych znaków do jednej spacji, `toLocaleLowerCase("pl")`. Zapisywana `name` zostaje bez zmian (tylko przycięta).

## Phase 1: Kontrakt i parser

### Overview

Poprawka reguły zamienników w kontrakcie i czysty parser wiersza Excela z listą marek, ostrzeżeniami i przeliczeniem kcal, pokryty testami.

### Changes Required:

#### 1. Kontrakt danych

**File**: `docs/reference/recipe-data-contract.md`

**Intent**: Zapisać decyzję 4: w zamiennikach przecinek dzieli tylko po ilości (jak na najwyższym poziomie), bo przecinek dziesiętny w nazwie („mleko 1,5% (45g)”) rozcinał pozycje. Dopisać, że w bloku zamienników bywają oba zapisy ilości (nawias i `– N g`), i poprawić „co najwyżej 0,51” na 0,52 (wiersz 62).

**Contract**: Sekcja „Reguły konwersji z Excela”, punkt **Zamienniki** (`:98`) — nowa reguła: „w bloku z `;` dziel tylko po `;`; w przeciwnym razie po `,` tylko tam, gdzie poprzedza go ilość”. Sekcja „Znane pułapki danych” — nowy punkt „Przecinek dziesiętny w nazwie zamiennika”. Sekcja „Znane marki” — wskazanie, że lista w kodzie żyje w `scripts/import-recipes/brands.ts` i importer ostrzega o nieznanych.

#### 2. Marki i ostrzeżenia

**File**: `scripts/import-recipes/brands.ts`

**Intent**: Jawna lista marek i linii (decyzja 3) usuwanych z `product` oraz heurystyka ostrzeżeń o nieznanych markach na przyszłe pliki.

**Contract**:
- `KNOWN_BRANDS`: `Lazur`, `Mlekovita`, `Ryki`, `Go Vege`, `Vemondo`, `active protein plus` (dopasowanie bez względu na wielkość liter, całe słowa/frazy).
- `toProduct(name: string): string` — małe litery (`pl`), usunięte marki, zwinięte spacje, przycięte. „ser żółty active protein plus Ryki” → „ser żółty”, „Mleko 1,5%” → „mleko 1,5%”.
- `brandWarnings(name: string): string[]` — ostrzeżenie, gdy po usunięciu znanych marek słowo inne niż pierwsze zaczyna się wielką literą i nie jest na liście `KNOWN_PROPER_NAMES` (`Grana`, `Padano`, `Feta`), albo gdy w nazwie została liczba z jednostką (`\d+\s*(g|kg|ml|l|szt)\b`). Ostrzeżenia nie blokują importu.

#### 3. Parser wiersza

**File**: `scripts/import-recipes/parse.ts`

**Intent**: Zamienić surowy wiersz arkusza na obiekt w kształcie wejścia `parseRecipeInput` i przepuścić go przez walidator; zwrócić też ostrzeżenia i informację o przeliczeniu kcal do raportu. Bez I/O.

**Contract**:
- `RawRecipeRow` — `{ rowNumber; name; prepTimeMin; kinds; servings; products; kcal; proteinG; carbsG; fatG; steps }`, teksty jako `string`, liczby jako `number | string | null` — `string` to nieliczbowa zawartość komórki i daje issue `<pole> — nieoczekiwana wartość „…”` (np. `kcal`, `servings`); kolumna `waga (g)` pomijana.
- `parseRecipeRow(row: RawRecipeRow): RowResult`, gdzie `RowResult = { rowNumber; name; recipe: NewRecipe | null; issues: RecipeIssue[]; warnings: string[]; kcalRecalculation: { servings; before: {kcal, proteinG, carbsG, fatG}; after: {…} } | null }`.
- Funkcje pomocnicze eksportowane do testów: `splitIngredients`, `splitSubstitutes`, `parseQuantity`, `splitSteps`, `parseKinds`, `perServing`, `normalizeRecipeName`.
- Reguły wg kontraktu (`recipe-data-contract.md:96-105`) z decyzją 4 dla zamienników. Ilość: ostatni nawias `(liczba jednostka)` na końcu pozycji albo końcówka `- N jednostka`/`– N jednostka`; przecinek → kropka; inne nawiasy zostają w nazwie. Kroki: numeracja > nowa linia > `;`. Kcal: gdy `servings > 1` i `0,75 ≤ kcal / (400 × servings) ≤ 1,25`, dziel kcal i makro przez `servings` (kcal do całości, makro do 0,1).
- Błąd parsera, którego walidator by nie zauważył (np. pusty składnik po podziale), trafia do `issues` z tą samą konwencją ścieżek.

#### 4. Testy parsera

**File**: `scripts/import-recipes/parse.test.ts` (oraz testy `toProduct`/`brandWarnings` w tym samym pliku lub `brands.test.ts`)

**Intent**: Pokryć każdą regułę i pułapkę z kontraktu na syntetycznych łańcuchach (fragmenty jak w pliku, bez czytania xlsx).

**Contract**: przypadki wymienione w „Testing Strategy → Unit Tests”.

### Success Criteria:

#### Automated Verification:

- Testy parsera i marek przechodzą: `npm test`
- Lint bez błędów: `npm run lint`
- Typy bez błędów: `npx astro check`

#### Manual Verification:

- Autorka akceptuje nowe brzmienie reguły zamienników w `recipe-data-contract.md`

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Skrypt importu

### Overview

exceljs jako devDependency, skrypt z trybem podglądu i osobną komendą zapisu.

### Changes Required:

#### 1. Zależność i komendy

**File**: `package.json`, `package-lock.json`

**Intent**: Decyzja 8 — exceljs tylko jako devDependency (nie trafia do Workera). Dwie komendy: podgląd i zapis (decyzja 7).

**Contract**: `npm i -D exceljs`; skrypty `"import-recipes": "tsx scripts/import-recipes.ts"` i `"import-recipes:write": "tsx scripts/import-recipes.ts --write"`.

#### 2. Skrypt

**File**: `scripts/import-recipes.ts`

**Intent**: I/O wokół parsera: odczyt xlsx, autorka po e-mailu, istniejące nazwy, raport, zapis wszystko-albo-nic.

**Contract**:
- Nagłówek komentarza jak w `scripts/match-keys.ts:1-4`: użycie, klucz service role tylko z powłoki, idempotencja.
- Argumenty: `--author-email <e-mail>` (wymagany), `--file <ścieżka>` (domyślnie `data/recipes.xlsx`), `--write`. Brak `--author-email` lub `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` → błąd i kod 1.
- Odczyt: pierwszy arkusz; sprawdzenie, że nagłówki wiersza 1 to dokładnie kolumny z kontraktu (`recipe-data-contract.md:84`) — inaczej przerwanie. Wiersze od 2, puste pominięte. Tekst przez `cell.text`. Kolumny liczbowe: `cell.value` typu `number` → liczba; formuła z liczbowym `result` → `result`; pusta komórka → `null`; każda inna wartość (tekst „406”, błąd formuły) → jej `cell.text` jako `string`, który parser zamienia na błąd blokujący. Bez tego liczba zapisana jako tekst stałaby się po cichu `null`, a `null` w porcjach wyłączyłoby przeliczenie kcal.
- Autorka: `supabase.auth.admin.listUsers` stronicowane, dopasowanie e-maila bez względu na wielkość liter; brak → błąd „Nie ma konta …” i kod 1 (także w podglądzie).
- Istniejące nazwy: wszystkie `name` z `recipes` (stronicowanie jak `fetchAllPages` w `src/lib/services/recipes.ts:127-142`), porównanie przez `normalizeRecipeName`. Dwa wiersze pliku o tej samej znormalizowanej nazwie → błąd blokujący.
- Raport (oba tryby): błędy `wiersz N „nazwa”: ścieżka — komunikat`; ostrzeżenia o markach; lista przeliczonych kcal `wiersz N „nazwa”: 1704 kcal / 4 porcje → 426 kcal (B/W/T przed → po)`; lista pomijanych; podsumowanie `do zapisu X, pominięte Y, błędy Z, ostrzeżenia W`. Podgląd kończy się kodem 1, gdy są błędy.
- Zapis (`--write`): przy `błędy > 0` nic nie wysyła i kończy się kodem 1. W przeciwnym razie jeden `.insert([...])` wszystkich nowych wierszy: pola snake_case jak w `createRecipe`, `author_id` autorki, `match_keys: computeMatchKeys(ingredients)`, `match_keys_version: MATCH_KEYS_VERSION`. Wypisuje `inserted X, skipped Y`. Gdy nie ma nic do zapisu — `inserted 0` bez żądania.

### Success Criteria:

#### Automated Verification:

- `exceljs` jest w `devDependencies`, nie w `dependencies`
- Testy przechodzą: `npm test`
- Lint bez błędów: `npm run lint`
- Typy bez błędów: `npx astro check`
- Build produkcyjny przechodzi (exceljs nie trafia do Workera): `npm run build`

#### Manual Verification:

- Uruchomienie bez `--author-email` i bez zmiennych środowiskowych kończy się czytelnym błędem i kodem 1
- Podgląd z nieistniejącym e-mailem kończy się błędem „Nie ma konta …”

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 3.

---

## Phase 3: Import lokalny i procedura produkcyjna

### Overview

Import na lokalny Supabase, sprawdzenie w aplikacji, potem procedura produkcyjna wykonywana ręcznie przez autorkę i domknięcie issue #2.

### Changes Required:

#### 1. Import lokalny (bez zmian w kodzie)

**Intent**: Sprawdzić skrypt na prawdziwym pliku. Kroki: `npx supabase start` (seed: 5 przepisów); konto autorki w lokalnej aplikacji (rejestracja na `/auth/signup`); `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` z `npx supabase status -o env`; podgląd; zapis; ponowny zapis.

**Contract**: oczekiwany podgląd: 0 błędów, 12 przeliczonych kcal (wiersze 48, 51, 57, 58, 59, 64, 65, 66, 70, 73, 74, 77), 5 pominiętych (przepisy z seeda), do zapisu 71. Zapis: `inserted 71, skipped 5`. Drugi zapis: `inserted 0, skipped 76`.

#### 2. Procedura produkcyjna

**File**: `scripts/import-recipes.ts` (komentarz nagłówkowy, sekcja „Produkcja”)

**Intent**: Decyzja 9 i kolejność kroków dla autorki, zapisane przy skrypcie, żeby nie zgubić ich po archiwizacji.

**Contract**: kroki: (1) `npx supabase db push --dry-run` na zlinkowanym projekcie produkcyjnym — oczekiwane „Remote database is up to date”; jeśli wypisze migracje do wypchnięcia (np. `20261017120000_add_recipe_author_and_insert.sql`), import czeka, a `db push` jest osobną, zatwierdzoną decyzją; (2) konto autorki istnieje na produkcji; (3) produkcyjne `SUPABASE_URL` i klucz service role tylko w powłoce; (4) podgląd i potwierdzenie listy 12 przeliczonych kcal; lista pominiętych musi być pusta — pominięcie oznacza, że w bazie jest już przepis o tej nazwie (np. dodany przez innego użytkownika przez S-05), więc przed zapisem zatrzymaj się i wyjaśnij każdą pozycję; (5) zapis — oczekiwane `inserted 76, skipped 0`.

#### 3. Domknięcie issue

**Intent**: Lekcja „Close roadmap issues explicitly” (`context/foundation/lessons.md:5-10`).

**Contract**: opis PR lub commit na master zawiera `Closes #2`.

### Success Criteria:

#### Manual Verification:

Wszystkie kroki wymagają maszyny autorki (lokalny `data/recipes.xlsx`, Supabase w Dockerze, konto autorki), więc nie są uruchamiane bez człowieka.

- Lokalny podgląd kończy się kodem 0: `npm run import-recipes -- --author-email <e-mail>`
- Lokalny zapis wypisuje `inserted 71, skipped 5`: `npm run import-recipes:write -- --author-email <e-mail>`
- Ponowny zapis wypisuje `inserted 0, skipped 76`
- Wszystkie zaimportowane wiersze mają aktualne klucze: zapytanie SQL w lokalnej bazie zwraca 0 wierszy dla `author_id = <uuid autorki> and (match_keys is null or match_keys_version <> MATCH_KEYS_VERSION)`
- Autorka potwierdza listę 12 przeliczonych kcal z podglądu
- Ostrzeżenia o markach w podglądzie są puste lub autorka uznała każde (dopisanie marki do listy albo akceptacja)
- W aplikacji licznik pokazuje 76 przepisów, a przepis z wiersza 48 ma kcal na porcję i poprawne makro (liczby, nie tekst)
- Zamiennik z marką (np. „Napój sojowy Go Vege”) pokazuje markę w szczegółach, a wykluczenie „ryki” nie ukrywa przepisu z wiersza 32
- Dopasowanie na pełnym katalogu działa; `npm run bench:match` uruchomione po imporcie
- Produkcja: `supabase db push --dry-run` nie wymaga migracji, podgląd przejrzany, zapis wypisał `inserted 76, skipped 0`
- PR zawiera `Closes #2`

---

## Testing Strategy

### Unit Tests:

- Podział najwyższego poziomu: `;` ze spacją i bez; układ `- 120 g` z przecinkiem w nazwie („Borówki amerykańskie, świeże lub mrożone - 100 g, …”); `;` wewnątrz `[...]` nie dzieli składników.
- Zamienniki: `[zamienniki: mleko 1,5% (45g), mleko bez laktozy 2% (45g)]` → 2 pozycje z `product` „mleko 1,5%” i „mleko bez laktozy 2%”; blok z `;` i przecinkiem w nazwie („Borówki amerykańskie, świeże lub mrożone – 55 g ; …”) → podział tylko po `;`; zapis `– N g` w bloku; etykiety `zamiennik:` i `zamienniki:`.
- Ilość: `(5g)`, `(0,3 g)`, `(0.3g)`, `(25 g)`, `(1szczypta)` → `szczypta`; „Kasza gryczana niepalona (biała) (40g)” → nazwa z „(biała)”; brak ilości → `null`/`null`.
- Marki: `toProduct` dla przykładów z kontraktu; „Ser Grana Padano starty” i „Ser typu Feta” bez ostrzeżeń; nieznane „Serek Piątnica” i „serek 200g” z ostrzeżeniem.
- Kroki: numerowane `1.`/`1)`, nowe linie z `;` w środku, same `;`; usunięta numeracja, wielka litera, puste pominięte.
- `kinds`: `na słodko ; na zimno`, `na zimno; na wytrawnie`, nieznana wartość → issue z walidatora.
- Kcal: 1704 kcal / 4 porcje → 426 (przeliczone, makro /4 zaokrąglone do 0,1); 406 / 2 → bez zmian; granice 0,75 i 1,25 włącznie; `servings = 1` nigdy nie przeliczane.
- Walidacja: 5 zamienników przechodzi, 6 daje issue `ingredients.N.substitutes`; liczby `5.0` → 5.
- Komórki liczbowe: `kcal: "406"` lub `servings: "dwie"` (string) → issue blokujące, rekord `null`, brak przeliczenia kcal; `null` → pole puste bez issue.
- `normalizeRecipeName`: „domowe  spaghetti ” i „Domowe spaghetti” → równe.

### Integration Tests:

- Brak automatycznych testów z bazą — import nie działa w CI (asercje 5 przepisów w `ci.yml`). Ścieżkę end-to-end pokrywa faza 3 na lokalnym Supabase.

### Manual Testing Steps:

1. Lokalny podgląd → sprawdzić liczby z fazy 3 i listę kcal.
2. Lokalny zapis, potem ponowny zapis (idempotencja).
3. Celowo zepsuć kopię pliku (np. 6 zamienników) → zapis odmawia i nic nie wstawia.
4. Aplikacja: licznik, szczegóły przeliczonego przepisu, dopasowanie z wykluczeniem.

## Performance Considerations

Import zapisuje `match_keys`, więc zaimportowane wiersze nie wchodzą do przeliczania per żądanie (`MAX_RECOMPUTED_RECIPES`, lekcja „Bound user-driven CPU work”). Jeden insert 76 wierszy mieści się w jednym żądaniu PostgREST.

## Migration Notes

Brak migracji. Produkcyjny import wymaga, by migracja `20261017120000_add_recipe_author_and_insert.sql` (`author_id`) była już na produkcji — sprawdza to `supabase db push --dry-run` przed importem.

## References

- Research: `context/changes/seed-recipe-import/research.md`
- Kontrakt: `docs/reference/recipe-data-contract.md:84-130`
- Walidator: `src/lib/recipes/validate.ts:176-198`
- Wzorzec skryptu: `scripts/match-keys.ts:1-24`
- Mapowanie pól: `src/lib/services/recipes.ts:85-108`
- Decyzja o `match_keys` z S-03: `context/archive/2026-10-12-first-pantry-match/plan.md:410`
- Decyzja o autorstwie z S-05: `context/archive/2026-10-17-add-recipe/plan.md:74`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Kontrakt i parser

#### Automated

- [x] 1.1 Testy parsera i marek przechodzą: `npm test`
- [x] 1.2 Lint bez błędów: `npm run lint`
- [x] 1.3 Typy bez błędów: `npx astro check`

#### Manual

- [x] 1.4 Autorka akceptuje nowe brzmienie reguły zamienników w `recipe-data-contract.md`

### Phase 2: Skrypt importu

#### Automated

- [ ] 2.1 `exceljs` jest w `devDependencies`, nie w `dependencies`
- [ ] 2.2 Testy przechodzą: `npm test`
- [ ] 2.3 Lint bez błędów: `npm run lint`
- [ ] 2.4 Typy bez błędów: `npx astro check`
- [ ] 2.5 Build produkcyjny przechodzi (exceljs nie trafia do Workera): `npm run build`

#### Manual

- [ ] 2.6 Uruchomienie bez `--author-email` i bez zmiennych środowiskowych kończy się czytelnym błędem i kodem 1
- [ ] 2.7 Podgląd z nieistniejącym e-mailem kończy się błędem „Nie ma konta …”

### Phase 3: Import lokalny i procedura produkcyjna

#### Manual

- [ ] 3.1 Lokalny podgląd kończy się kodem 0
- [ ] 3.2 Lokalny zapis wypisuje `inserted 71, skipped 5`
- [ ] 3.3 Ponowny zapis wypisuje `inserted 0, skipped 76`
- [ ] 3.4 Wszystkie zaimportowane wiersze mają aktualne klucze
- [ ] 3.5 Autorka potwierdza listę 12 przeliczonych kcal z podglądu
- [ ] 3.6 Ostrzeżenia o markach w podglądzie są puste lub autorka uznała każde
- [ ] 3.7 W aplikacji licznik pokazuje 76 przepisów, a przepis z wiersza 48 ma kcal na porcję i poprawne makro
- [ ] 3.8 Zamiennik z marką pokazuje markę w szczegółach, a wykluczenie „ryki” nie ukrywa przepisu z wiersza 32
- [ ] 3.9 Dopasowanie na pełnym katalogu działa; `npm run bench:match` uruchomione po imporcie
- [ ] 3.10 Produkcja: `supabase db push --dry-run` nie wymaga migracji, podgląd przejrzany, zapis wypisał `inserted 76, skipped 0`
- [ ] 3.11 PR zawiera `Closes #2`
