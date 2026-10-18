# Browse recipes and details Implementation Plan

## Overview

Dokładamy stronę szczegółów przepisu `/recipes/[id]` (renderowaną po stronie serwera), robimy z kafelka link do niej, zapamiętujemy stan listy w `sessionStorage` (tagi, filtry, liczbę załadowanych przepisów, pozycję przewijania), żeby po powrocie ze szczegółów lista wróciła w to samo miejsce, oraz dodajemy polską stronę 404 (#15). Lista 10 przepisów bez % i „Pokaż więcej” już istnieją (dostarczył je S-03), więc zakres S-02 to: szczegóły, link z kafelka, kontekst listy i 404. Zmiana zamyka S-02 (#4) i #15.

## Current State Analysis

- Lista bez filtrów, kafelek bez % i „Pokaż więcej” działają (`src/components/hooks/usePantryMatch.ts:5,180-191,230-232`, `src/components/pantry/PantryMatch.tsx:106-124`).
- Brakuje trasy `src/pages/recipes/[id]` (jest tylko `new.astro`), `getRecipe` w `src/lib/services/recipes.ts` i `src/pages/404.astro`.
- `RecipeTile` to `<article>` bez linku (`RecipeTile.tsx:48`); jest wspólny dla listy (`PantryMatch.tsx:110`), podglądu po zapisie (`RecipeSaved.tsx:37`) i kitchen-sink (`KitchenSink.tsx:201-202`).
- Cały stan listy żyje w `useState` wyspy (`usePantryMatch.ts:127-144`); `sessionStorage` ani URL nie są używane. Pełne przejście na inną stronę i „wstecz” przeładowuje `/` od zera.
- `Recipe` zawiera wszystko, czego wymaga FR-006 (`src/types.ts:18-31`), `RECIPE_COLUMNS` i `toRecipe` mapują te kolumny (`recipes.ts:15,36-50`). RLS `recipes_select_authenticated` pozwala każdemu zalogowanemu czytać każdy przepis, więc nie ma migracji ani nowych polityk.
- Middleware chroni wszystkie trasy poza `/auth/` i `/api/auth/` i przepuszcza zalogowanego do `next()` (`src/middleware.ts:10-40`); nowe trasy nie wymagają zmian w middleware.
- `/api/recipes/match` czyta cały katalog przy każdym żądaniu (`recipes.ts:158`), a `limit` jest ograniczony do 50 (`api/recipes/match.ts:8`).

## Desired End State

Zalogowany użytkownik klika kafelek (cały kafelek jest klikalny, a fokus klawiaturą trafia na tytuł) i widzi stronę przepisu: nazwa, czas, porcje, rodzaje, wartości odżywcze na porcję, składniki z ilościami i zamiennikami oraz kroki. Strona nie pokazuje statusu składników względem spiżarki. „Wstecz” przeglądarki albo link „Wróć do listy” przywraca listę: te same tagi, te same filtry, tyle samo załadowanych przepisów i ta sama pozycja przewijania. Nieistniejący lub niepoprawny adres (także przepis, którego nie ma) daje polską 404 z linkiem do `/` i statusem 404.

Weryfikacja: `npm test`, `npm run lint`, `npx astro check`, `npm run check:ui`, `npm run build`, `npm run smoke` oraz ręczny scenariusz z sekcji „Manual Testing Steps”.

### Key Discoveries:

- Odtworzenie N stron nie może iść N żądaniami po 10: każde `/api/recipes/match` robi pełny przebieg po katalogu (`recipes.ts:158`), a limit CPU na Workers Free to 10 ms (`lessons.md`, „Bound user-driven CPU work per request”). Odtwarzamy jednym żądaniem z `limit` do 50, a cały odtwarzany zakres ograniczamy twardym limitem.
- `RecipeSaved` pokazuje ten sam kafelek, więc link w `RecipeTile` zadziała też tam bez dodatkowej pracy (`recipe.id` jest dostępne).
- Nieprawidłowy format UUID w `.eq("id", …)` powoduje błąd Postgresa 22P02 (wniosek z zachowania Postgresa, nie sprawdzony w repo), czyli 500 zamiast 404. Walidujemy format przed zapytaniem i weryfikujemy to w testach i smoke.
- `PantryMatch` jest renderowany z `client:load` (`index.astro:7`), więc stan z `sessionStorage` wolno czytać dopiero w efekcie po montażu, inaczej hydratacja różni się od HTML z serwera.
- Spiżarka „posiadane” ma być tylko sesyjna (PRD FR-003, `match.ts:19`); `sessionStorage` (per karta) jest zgodne z tą zasadą.

## What We're NOT Doing

- Statusu składników względem spiżarki na stronie szczegółów (decyzja: szczegóły pokazują sam przepis) ani przekazywania filtrów do `/recipes/[id]`.
- Stanu listy w URL (decyzja: `sessionStorage`).
- Endpointu `GET /api/recipes/:id` (szczegóły renderowane w SSR).
- Edycji i usuwania przepisu (S-06, S-07) oraz trwałych produktów stałych i wykluczeń (S-04).
- Odtwarzania więcej niż `MAX_RESTORE_RECIPES` (100) przepisów; dalsze są ucinane do tej wartości (katalog docelowy to 50–100 przepisów, F-02).
- Zachowania stanu między kartami i po zamknięciu karty (to własność `sessionStorage`).
- Zmian w middleware, schemacie bazy i RLS.
- Zapisywania samych przepisów w `sessionStorage`: zapisujemy tylko parametry (tagi, liczba przepisów, przewijanie), a dane pobieramy ponownie.

## Implementation Approach

Trzy fazy, każda weryfikowalna osobno. Najpierw strona szczegółów z 404, bo od niej zależy link (faza 1). Potem link w kafelku (faza 2). Na końcu zachowanie kontekstu listy (faza 3), czyli jedyna część z asynchronicznym stanem i wyścigami. Szczegóły renderujemy w `.astro` przez `createClient(Astro.request.headers, Astro.cookies)` (jak `recipes/new.astro` i API), a treść w komponencie React bez dyrektywy `client:*`, żeby ten sam komponent pokazać w kitchen-sink. Nowe pliki widoków trafiają do `CLEAN_FILES` i używają wyłącznie tokenów.

## Critical Implementation Details

- **State sequencing**: odczyt snapshotu z `sessionStorage` musi nastąpić w efekcie startowym `usePantryMatch` przed jakimkolwiek zapisem. Zapis (na `pagehide` i `visibilitychange` → hidden) jest wyłączony, dopóki odtwarzanie się nie zakończy; inaczej pusty stan z pierwszego renderu nadpisze snapshot, zanim zostanie odczytany.
- **User experience spec**: przewijanie ustawiamy dopiero po tym, jak odtworzona lista jest wyrenderowana (`loading === false` i `recipes.length > 0`), jednorazowo; przeglądarka sama próbuje przywrócić scroll przy „wstecz” zanim treść istnieje, więc nasze `scrollTo` musi mieć ostatnie słowo.

## Phase 1: Szczegóły przepisu i polska 404

### Overview

Trasa `/recipes/[id]` renderuje pełny przepis po stronie serwera, a nieistniejący albo niepoprawny id oraz każdy nieznany adres dają polską 404 (#15).

### Changes Required:

#### 1. Walidacja id i `getRecipe`

**File**: `src/lib/recipes/id.ts` (nowy), `src/lib/services/recipes.ts`, `src/lib/services/recipes.test.ts`

**Intent**: Jedno miejsce decyduje, czy tekst jest poprawnym id przepisu, a serwis udostępnia pobranie jednego przepisu. Zły format ma zwrócić „brak przepisu”, nie błąd bazy.

**Contract**: `isRecipeId(value: string): boolean` (UUID, bez rozróżniania wielkości liter). `getRecipe(supabase: SupabaseClient, id: string): Promise<Recipe | null>`: dla niepoprawnego id zwraca `null` bez zapytania; w pozostałych przypadkach `select(RECIPE_COLUMNS).eq("id", id).maybeSingle()` mapowane przez `toRecipe`; błąd bazy jest rzucany jak w `listRecipes`. Testy rozszerzają `fakeClient` o `eq` i `maybeSingle` i obejmują: znaleziony, brak wiersza, niepoprawny format (brak wywołania klienta).

#### 2. Formatowanie szczegółów

**File**: `src/lib/recipes/format.ts` (nowy), `src/lib/recipes/format.test.ts` (nowy)

**Intent**: Czysta logika wyświetlania (ilość i jednostka składnika, czas, wartości odżywcze) wydzielona z komponentu, żeby dało się ją testować w środowisku `node`.

**Contract**: funkcje przyjmujące typy z `src/types.ts` i zwracające tekst po polsku; `amount`/`unit` równe `null` są pomijane, bez „null” i bez podwójnych spacji; brakujące czas, porcje i wartości odżywcze nie dają pustych etykiet.

#### 3. Widok szczegółów

**File**: `src/components/recipes/RecipeDetails.tsx` (nowy), `src/pages/recipes/[id].astro` (nowy), `scripts/check-ui-literals.mjs`

**Intent**: Komponent bez interakcji (bez `client:*`) pokazuje przepis; strona pobiera go w SSR i dla braku przepisu ustawia status 404 z tą samą treścią co `404.astro`. Błąd bazy to status 500 z polskim komunikatem i `console.error` jak w API. Obie nowe pliki widoku dopisujemy do `CLEAN_FILES`.

**Contract**: `RecipeDetails({ recipe }: { recipe: Recipe })` – `<h1>` z nazwą, meta (czas, porcje, rodzaje), wartości odżywcze „na porcję”, lista składników (nazwa, ilość, jednostka, zamienniki), numerowana lista kroków, link „Wróć do listy” (`href="/"`). Tylko tokeny. `[id].astro`: `AppLayout title={recipe.name}`; `Astro.params.id` przechodzi przez `getRecipe`; `null` → `Astro.response.status = 404` i widok „nie znaleziono”.

#### 4. Strona 404

**File**: `src/pages/404.astro` (nowy), `src/components/NotFoundView.astro` (nowy), `scripts/check-ui-literals.mjs`

**Intent**: Polska 404 na `AppLayout` z komunikatem i linkiem do `/`, współdzielona z trasą szczegółów.

**Contract**: `NotFoundView` przyjmuje opcjonalny komunikat (domyślnie „Nie znaleziono strony”, dla przepisu „Nie znaleziono przepisu”) i renderuje link „Wróć do listy przepisów” (`href="/"`). `404.astro` używa `AppLayout` i `NotFoundView`. Do sprawdzenia w dev i na buildzie: `Astro.locals.user` jest ustawione przy renderze `404.astro` (nagłówek `AppHeader` pokazuje e-mail i „Wyloguj”); jeśli nie, dostosować tak, by nagłówek działał. Niezalogowany nadal dostaje redirect do `/auth/signin` (middleware, bez zmian).

#### 5. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Zweryfikować trasę szczegółów i 404 na działającym serwerze, najpierw status i typ odpowiedzi, potem treść (lekcja o kontrolach HTTP). Kroki działają, gdy użytkownik jest zalogowany, przed krokiem wylogowania.

**Contract**: kroki: szczegóły istniejącego przepisu (id z `/api/recipes`) → 200 i tekst HTML z nagłówkiem kroków; nieistniejące, poprawne UUID → 404 z komunikatem „Nie znaleziono przepisu”; `/recipes/nie-uuid` → 404; nieznany adres → 404 z „Wyloguj” (nagłówek zalogowanego); anonimowy `/recipes/<id>` → 302 `/auth/signin`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass (UUID, `getRecipe`, formatowanie): `npm test`
- Linting passes: `npm run lint`
- Type check passes: `npx astro check`
- UI literal guard passes with the new files in `CLEAN_FILES`: `npm run check:ui`
- Production build passes: `npm run build`
- Smoke passes against a running server (`BASE_URL`, Supabase z wyłączonym potwierdzeniem e-mail): `npm run smoke`

#### Manual Verification:

- Strona `/recipes/<id>` pokazuje nazwę, czas, porcje, rodzaje, wartości na porcję, składniki z ilościami i zamiennikami oraz kroki; nie ma statusu „mam/brak”
- Przepis bez czasu, porcji lub wartości odżywczych wygląda poprawnie (bez pustych etykiet)
- Nieznany adres jako zalogowany pokazuje polską 404 z nagłówkiem i linkiem do `/`; `/recipes/nie-uuid` i nieistniejące UUID też
- Wygląd poprawny w jasnym i ciemnym motywie oraz przy szerokości 375 px

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Kafelek jako link

### Overview

Cały kafelek prowadzi do `/recipes/[id]`, bez zagnieżdżonych elementów interaktywnych.

### Changes Required:

#### 1. Link w `RecipeTile`

**File**: `src/components/recipes/RecipeTile.tsx`

**Intent**: Tytuł kafelka staje się linkiem, który rozciąga się na cały kafelek (wzorzec „stretched link”: link w nagłówku z pseudo-elementem pokrywającym `<article>`), więc jest jeden element fokusowalny i nie ma zagnieżdżonych interaktywnych elementów (tagi składników są `Badge`, nie linkami). Zmiana dotyczy wspólnego kafelka, więc obejmuje listę i podgląd po zapisie.

**Contract**: `<article>` dostaje `relative`, `<h3>` zawiera `<a href={`/recipes/${recipe.id}`}>` z klasą rozciągającą (`after:absolute after:inset-0`), stany hover kafelka i `focus-visible` linku wyłącznie z tokenów (`ring`, `border`, `accent`; bez wartości dowolnych). Brak zmiany właściwości `RecipeTile`.

#### 2. Kitchen sink

**File**: `src/components/dev/KitchenSink.tsx`

**Intent**: Pokazać nowe stany kafelka (domyślny link, hover i fokus przez interakcję) oraz widok szczegółów, zgodnie z `AGENTS.md` (każdy nowy stan w kitchen-sink).

**Contract**: sekcja z `RecipeTile` (z `match` i bez) opisana jako klikalna oraz sekcja z `RecipeDetails` na przykładowym przepisie i na przepisie z brakami danych (bez czasu, porcji, wartości odżywczych).

#### 3. Link „Wróć do listy” na górze i na dole szczegółów

**File**: `src/components/recipes/RecipeDetails.tsx`

**Intent**: Przy długim przepisie link powrotu nie jest widoczny bez przewijania, więc pojawia się na górze strony, a ten pod krokami zostaje (dodane po ręcznych testach fazy 2).

**Contract**: ten sam link `href="/"` renderowany na górze karty (przed nagłówkiem `<h1>`) i pod krokami, jako jeden wspólny element w komponencie; bez zmiany właściwości `RecipeDetails`.

### Success Criteria:

#### Automated Verification:

- Unit tests still pass: `npm test`
- Linting passes: `npm run lint`
- Type check passes: `npx astro check`
- UI literal guard passes: `npm run check:ui`

#### Manual Verification:

- Kliknięcie w dowolne miejsce kafelka (także w tag składnika) otwiera szczegóły tego przepisu
- Klawiatura: Tab zatrzymuje się raz na kafelek, widoczny jest pierścień fokusu, Enter otwiera szczegóły
- Kafelek w podglądzie po dodaniu przepisu (`RecipeSaved`) prowadzi do szczegółów nowego przepisu
- Na stronie szczegółów długiego przepisu link „Wróć do listy” jest widoczny na górze i pod krokami
- `/dev/kitchen-sink` pokazuje kafelki i widok szczegółów w jasnym i ciemnym motywie

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Zachowanie stanu listy

### Overview

Po wejściu w szczegóły i powrocie (przycisk „wstecz” albo „Wróć do listy”) lista wraca do tych samych tagów, filtrów, liczby załadowanych przepisów i pozycji przewijania.

### Changes Required:

#### 1. Moduł stanu listy

**File**: `src/lib/list-state.ts` (nowy), `src/lib/list-state.test.ts` (nowy)

**Intent**: Czysta, testowalna logika snapshotu: serializacja, odczyt z walidacją i ograniczeniami oraz bezpieczny dostęp do `sessionStorage`. Odczyt jest nieufny: zapis w `sessionStorage` może być uszkodzony lub podmieniony, a odtwarzanie uruchamia pracę po stronie serwera (lekcja o ograniczaniu wejścia).

**Contract**: klucz `LIST_STATE_KEY`; typ `ListSnapshot { lists: PantryLists; applied: PantryLists; loaded: number; scrollY: number }`; `parseSnapshot(raw: string | null): ListSnapshot | null` odrzuca (zwraca `null`) wszystko, co nie ma kształtu snapshotu, a przy poprawnym kształcie ogranicza wartości do limitów z `src/lib/matching/limits.ts` (`MAX_TAGS`, `MAX_TAG_LENGTH`, `MAX_TOKENS`, `MAX_URL_LENGTH`), `loaded` do 0…`MAX_RESTORE_RECIPES` (100) i `scrollY` do skończonej liczby ≥ 0. `readSnapshot()` / `writeSnapshot(snapshot)` owijają `sessionStorage` w `try/catch` (zablokowane storage nie psuje strony, jak `saveTheme` w `src/lib/theme.ts`). Testy: round-trip, uszkodzony JSON, zły kształt, przekroczone limity, `loaded` ponad limit, ujemny/NaN `scrollY`, wyjątek z storage.

#### 2. Integracja w `usePantryMatch`

**File**: `src/components/hooks/usePantryMatch.ts`

**Intent**: Efekt startowy najpierw próbuje odczytać snapshot. Gdy go nie ma, zachowuje się jak dziś (pierwsza strona bez filtrów). Gdy jest, ustawia `lists` i `applied`, odtwarza `loaded` przepisów z filtrami `applied` i dopiero potem zwalnia zapis i przewijanie. Zapis snapshotu jest podpięty do `pagehide` i `visibilitychange` (hidden), odczytując najnowszy stan z `ref`.

**Contract**: odtwarzanie wykonuje kolejne żądania `limit ≤ 50` (jedno dla ≤ 50 przepisów, dwa dla ≤ 100) przez istniejące `requestPage`/`buildUrl` (`limit` jako parametr; `PAGE_SIZE` zostaje dla „Pokaż więcej”), sklejając wyniki pod tym samym `requestId`, tak by nowsze żądanie (np. „Zastosuj filtry” w trakcie odtwarzania) unieważniało stare. Po sukcesie: `offset = loaded`, `hasMore` i `total` z ostatniej odpowiedzi, `recipes` = suma stron. Po błędzie odtwarzania: snapshot jest usuwany, a hook wraca do widoku bez filtrów z komunikatem błędu jak dziś. Hook zwraca dodatkowo sygnał `restoredScrollY` wykorzystywany przez widok.

#### 3. Przewijanie

**File**: `src/components/pantry/PantryMatch.tsx`

**Intent**: Po wyrenderowaniu odtworzonej listy jednorazowo wywołać `window.scrollTo` na zapisaną pozycję. Bez snapshotu zachowanie bez zmian.

**Contract**: efekt zależny od `restoredScrollY`, `loading` i liczby przepisów; po wykonaniu zeruje sygnał, żeby kolejne ładowania („Pokaż więcej”) nie przewijały strony.

### Success Criteria:

#### Automated Verification:

- Unit tests pass (parse/limity/round-trip/storage zablokowane): `npm test`
- Linting passes: `npm run lint`
- Type check passes: `npx astro check`
- UI literal guard passes: `npm run check:ui`
- Production build passes: `npm run build`

#### Manual Verification:

- Dodaj tagi, zastosuj filtry, kliknij „Pokaż więcej” (min. raz), przewiń, otwórz przepis, „wstecz” → te same tagi w polach, te same filtry, tyle samo przepisów i ta sama pozycja przewijania
- To samo przez link „Wróć do listy” na stronie szczegółów
- Tagi dopisane, ale niezastosowane przed wejściem w szczegóły, są po powrocie w polach (bez zmiany wyświetlonej listy)
- Nowa karta z `/` zaczyna z pustą spiżarką i pierwszymi 10 przepisami
- Uszkodzony lub zbyt duży wpis w `sessionStorage` (edycja w DevTools) jest ignorowany i lista ładuje się normalnie
- Z zablokowanym `sessionStorage` strona działa jak dotąd, bez błędów w konsoli
- Pierwsze wejście bez snapshotu i odświeżenie strony nie psują listy (brak migania pustych tagów dłużej niż stan ładowania)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `isRecipeId`: poprawne UUID (małe i duże litery), pusty tekst, `nie-uuid`, UUID ze zbędnymi znakami
- `getRecipe`: znaleziony, brak wiersza, niepoprawny id (klient nie jest wywoływany), błąd bazy jest rzucany
- Formatowanie: ilość i jednostka z `null`, ułamki, brak czasu/porcji/wartości odżywczych
- `parseSnapshot`: round-trip, uszkodzony JSON, zły kształt, przekroczone limity, `loaded` > 100, `scrollY` ujemny/NaN, zablokowane storage

### Integration Tests:

- `npm run smoke`: szczegóły istniejącego przepisu 200; nieistniejące UUID, `nie-uuid` i nieznany adres 404 (z „Wyloguj” dla zalogowanego); anonimowy dostęp do szczegółów → 302 `/auth/signin`

### Manual Testing Steps:

1. Zaloguj się, na `/` dodaj tagi „mam”, „stałe” i „wykluczam”, kliknij „Zastosuj filtry” i „Pokaż więcej”, przewiń w dół.
2. Kliknij kafelek: otwiera się `/recipes/<id>` z samym przepisem. Wróć przyciskiem „wstecz”: stan jak w kroku 1.
3. Powtórz przez link „Wróć do listy”.
4. Otwórz `/recipes/nie-uuid`, nieistniejące UUID i `/cokolwiek`: polska 404, nagłówek i link do `/`.
5. Otwórz `/` w nowej karcie: pusta spiżarka i pierwsze 10 przepisów.
6. W DevTools wpisz w klucz snapshotu śmieci i odśwież: lista ładuje się normalnie.

## Performance Considerations

Odtwarzanie 11–100 przepisów po filtrach kosztuje 1–2 żądania `/api/recipes/match` (pełny przebieg po katalogu każde), a nie `N/10`. Odczyt snapshotu jest nieufny i ograniczony do limitów z `limits.ts`, więc zmieniony wpis w `sessionStorage` nie zwiększy pracy po stronie serwera ponad to, co dopuszcza endpoint. Szczegóły to jedno zapytanie po kluczu głównym.

## Migration Notes

Nie dotyczy: brak zmian schematu, RLS ani danych. Wycofanie to usunięcie nowych plików i cofnięcie zmian w `RecipeTile`, `usePantryMatch`, `PantryMatch`, `KitchenSink`, `CLEAN_FILES` i `smoke.mjs`. Stary `/dashboard`, który dziś daje 404 Astro, po tej zmianie daje polską 404.

## References

- Related research: `context/changes/browse-recipes-and-details/research.md`
- Similar implementation: `src/pages/recipes/new.astro` (strona w `AppLayout`), `src/lib/theme.ts` (bezpieczny dostęp do storage), `src/pages/api/recipes/index.ts:12-34` (obsługa błędów serwisu)
- Issues: S-02 = #4, 404 = #15. Commit/PR na master musi zawierać `Closes #4` i `Closes #15` (`context/foundation/lessons.md`).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Szczegóły przepisu i polska 404

#### Automated

- [x] 1.1 Unit tests pass (UUID, `getRecipe`, formatowanie): `npm test` — dbe3433
- [x] 1.2 Linting passes: `npm run lint` — dbe3433
- [x] 1.3 Type check passes: `npx astro check` — dbe3433
- [x] 1.4 UI literal guard passes with the new files in `CLEAN_FILES`: `npm run check:ui` — dbe3433
- [x] 1.5 Production build passes: `npm run build` — dbe3433
- [x] 1.6 Smoke passes against a running server (`BASE_URL`, Supabase z wyłączonym potwierdzeniem e-mail): `npm run smoke` — dbe3433

#### Manual

- [x] 1.7 Strona `/recipes/<id>` pokazuje nazwę, czas, porcje, rodzaje, wartości na porcję, składniki z ilościami i zamiennikami oraz kroki; nie ma statusu „mam/brak” — dbe3433
- [x] 1.8 Przepis bez czasu, porcji lub wartości odżywczych wygląda poprawnie (bez pustych etykiet) — dbe3433
- [x] 1.9 Nieznany adres jako zalogowany pokazuje polską 404 z nagłówkiem i linkiem do `/`; `/recipes/nie-uuid` i nieistniejące UUID też — dbe3433
- [x] 1.10 Wygląd poprawny w jasnym i ciemnym motywie oraz przy szerokości 375 px — dbe3433

### Phase 2: Kafelek jako link

#### Automated

- [x] 2.1 Unit tests still pass: `npm test`
- [x] 2.2 Linting passes: `npm run lint`
- [x] 2.3 Type check passes: `npx astro check`
- [x] 2.4 UI literal guard passes: `npm run check:ui`

#### Manual

- [x] 2.5 Kliknięcie w dowolne miejsce kafelka (także w tag składnika) otwiera szczegóły tego przepisu
- [x] 2.6 Klawiatura: Tab zatrzymuje się raz na kafelek, widoczny jest pierścień fokusu, Enter otwiera szczegóły
- [x] 2.7 Kafelek w podglądzie po dodaniu przepisu (`RecipeSaved`) prowadzi do szczegółów nowego przepisu
- [x] 2.8 `/dev/kitchen-sink` pokazuje kafelki i widok szczegółów w jasnym i ciemnym motywie
- [x] 2.9 Na stronie szczegółów długiego przepisu link „Wróć do listy” jest widoczny na górze i pod krokami

### Phase 3: Zachowanie stanu listy

#### Automated

- [ ] 3.1 Unit tests pass (parse/limity/round-trip/storage zablokowane): `npm test`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Type check passes: `npx astro check`
- [ ] 3.4 UI literal guard passes: `npm run check:ui`
- [ ] 3.5 Production build passes: `npm run build`

#### Manual

- [ ] 3.6 Dodaj tagi, zastosuj filtry, kliknij „Pokaż więcej” (min. raz), przewiń, otwórz przepis, „wstecz” → te same tagi w polach, te same filtry, tyle samo przepisów i ta sama pozycja przewijania
- [ ] 3.7 To samo przez link „Wróć do listy” na stronie szczegółów
- [ ] 3.8 Tagi dopisane, ale niezastosowane przed wejściem w szczegóły, są po powrocie w polach (bez zmiany wyświetlonej listy)
- [ ] 3.9 Nowa karta z `/` zaczyna z pustą spiżarką i pierwszymi 10 przepisami
- [ ] 3.10 Uszkodzony lub zbyt duży wpis w `sessionStorage` (edycja w DevTools) jest ignorowany i lista ładuje się normalnie
- [ ] 3.11 Z zablokowanym `sessionStorage` strona działa jak dotąd, bez błędów w konsoli
- [ ] 3.12 Pierwsze wejście bez snapshotu i odświeżenie strony nie psują listy (brak migania pustych tagów dłużej niż stan ładowania)
