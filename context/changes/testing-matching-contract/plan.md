# Kontrakt dopasowania (test-plan Etap 1: ryzyka #1, #4, #5) — plan implementacji

## Overview

Zmiana wyłącznie testowa. Dowodzi trzech reguł z PRD na przypadkach, których dziś nic nie pilnuje: twardy filtr wykluczeń działa także dla wykluczenia w innej formie niż składnik (#1), % i rola produktów stałych zgadzają się z przykładami z PRD (#4), a serwer sam odrzuca zbyt duże wejście kodem `400 invalid_query` (#5). Na końcu selektywna bramka mutacyjna Stryker sprawdza, czy nowe asercje łapią realne regresje, a cookbook test-planu i AGENTS.md dostają wzorce.

## Current State Analysis

Wg `research.md` (sekcje pokrycia dla #1, #4, #5):

- Reguła dopasowania jest czystym modułem (`src/lib/matching/index.ts:1`); `rank.test.ts` ma helpery `recipe()`, `rank()`, `one()` (`src/lib/matching/rank.test.ts:9-35`) i tabele `it.each`.
- #1: normalizacja (liczba mnoga, wielkie litery, bez polskich znaków, literówka, synonim) jest testowana tylko po stronie **posiadania** (`rank.test.ts:43-54`). W bloku `exclusions` (`rank.test.ts:86-150`) formę wariantową mają tylko przypadki „maka/maki”. Brak testu wykluczenia wariantowego względem zamiennika i wprost asertowanego „mleko” → „mleko owsiane” (`dictionary.ts:17`).
- #4: brak przykładu z PRD „jajecznica z samego jajka = 33%”, brak % dla składnika dostępnego przez zamiennik. Scalenie `have + staple` żyje w serwisie (`src/lib/services/recipes.ts:278-282`), pokryte tylko pośrednio (`recipes.test.ts:465-471`). Brak przypadku „tylko stałe → % nie `null`”.
- #5: `GET /api/recipes/match` (`src/pages/api/recipes/match.ts:11-42`) nie ma żadnego testu; `countTokens` (`src/lib/matching/limits.ts:12-14`) też nie. W repo nie ma jeszcze żadnego `vi.mock`.
- Stryker nie jest zainstalowany; `.gitignore` nie zna `reports/` ani `.stryker-tmp/`.

## Desired End State

- `npm test` przechodzi i zawiera: tabelę wykluczeń wariantowych + `it.todo` dla luk słownika (R1); testy % z PRD i hermetyczne testy „stałe = posiadane”; testy `countTokens` i hermetyczny test handlera `GET /api/recipes/match` w `src/pages/api/recipes/_match.test.ts`.
- Dla każdej z faz 1–3 autorka celowo zepsuła jedną regułę w kodzie i zobaczyła, że pada właściwy test (zmiana cofnięta).
- Raport Stryker dla `rank.ts`, `keys.ts`, `limits.ts`, `match.ts` jest przejrzany: przetrwałe mutanty szkodliwe dla użytkownika zabite, pozostałe świadomie zignorowane z uzasadnieniem.
- `context/foundation/test-plan.md` §5 i §6 opisują wzorce i bramkę; AGENTS.md zna konwencję `_*.test.ts` w `src/pages` i sekcję „Mutation testing”.

### Key Discoveries:

- Astro routuje każdy plik `.ts` w `src/pages/`; plik z prefiksem `_` jest wyłączony z routera i z `dist/` (dokumentacja Astro, „Excluding pages”). Dlatego test endpointu to `_match.test.ts`, nie `match.test.ts`. Vitest i tak go łapie (`include: ["src/**/*.test.ts"]`, `vitest.config.ts`).
- `match.ts:2` importuje `@/lib/supabase`, który importuje `astro:env/server` — Vitest go nie rozwiąże (w `vitest.config.ts` tylko alias `@/`), więc `vi.mock("@/lib/supabase")` jest konieczny, a nie opcjonalny.
- Walidacja zwraca 400 przed `createClient` (`match.ts:41` vs `:44`), więc odrzucenie da się udowodnić bez bazy; przepuszczenie = wywołanie zamockowanego `matchRecipes`.
- Limit słów jest liczony łącznie dla trzech list (`match.ts:39`), a nie per lista.
- Literówki tolerowane od 4 znaków klucza (`MIN_FUZZY_LENGTH = 4`, `src/lib/matching/keys.ts:16-23`) — świadome zawężenie PRD (`research.md`, Decisions 1).
- Stryker: `testRunner: "vitest"`, raport HTML domyślny (`reports/mutation/mutation.html`), `vitest.related` domyślnie `true` (dokumentacja stryker-js, vitest-runner).

## What We're NOT Doing

- Żadnych zmian w kodzie produkcyjnym (`src/lib/**`, `src/pages/**` poza nowym plikiem testu) ani w słowniku — więc bez podbicia `MATCH_KEYS_VERSION`.
- Bez naprawy luk słownika R1 („napój sojowy” przy wykluczeniu „mleko”, „ser”/„serek”, „cukier”/„cukru”) — tylko `it.todo`.
- Bez testu i bez sprawdzania `MAX_URL_LENGTH` w endpoincie (R2).
- Bez asercji czasu / bramki CPU; zostaje ręczne `npm run bench:match` (R3).
- Bez testów `limit`/`offset` endpointu (paginacja, nie rozmiar wejścia; `MAX_LIMIT` nie jest eksportowany, a test z literałem `50` duplikowałby limit).
- Bez nowych asercji kolejności remisów poza tym, co przypina `rank.test.ts:157-174`.
- Bez Strykera w CI ani w `npm test`; bez gonienia 100% wyniku mutacji.
- Bez integracji z lokalnym Supabase — reguły #1, #4, #5 nie zależą od ograniczeń DB.
- Bez zmiany statusu w `test-plan.md` §3 przed ukończeniem faz (zostaje dla Fazy 5).

## Implementation Approach

Najtańszy test z realnym sygnałem dla każdego ryzyka: unit w czystym module (#1, #4), hermetyczny `fakeClient` tam, gdzie reguła żyje w serwisie (stałe), hermetyczny handler z `vi.mock` na granicy bazy (#5). Wartości oczekiwane pochodzą z PRD i zaakceptowanych decyzji autorki (`research.md`, sekcje Wyrocznia i Decisions), nigdy z uruchomienia kodu. Każda faza 1–3 kończy się ręcznym „celowym psuciem” jednej reguły, a Faza 4 robi to systematycznie Strykerem.

## Critical Implementation Details

- **Wyrocznia przed kodem.** Każdy wiersz tabeli ma wynik wyprowadzony z PRD (`prd.md:120`, `:122`, `:124`) lub z Decisions w `research.md`. Jeśli nowy wiersz pada na obecnym kodzie, to nie jest powód do zmiany oczekiwania: zatrzymaj się i zgłoś autorce (to może być błąd produkcyjny albo luka słownika do `it.todo`).
- **Krótka literówka.** Przykład „< 4 znaki” wybierz tak, by klucz (`wordKey`) zarówno produktu, jak i wykluczenia miał < 4 znaki, a literówka miała dystans 1; nazwij w tytule testu, że to świadoma granica (`keys.ts:16-23`), nie błąd.
- **`vi.mock` przed importem handlera.** `vi.mock` jest hoistowany, ale fabryka nie może odwoływać się do zmiennych spoza siebie bez `vi.hoisted`; mock `createClient` musi zwracać obiekt różny od `null`, inaczej przepuszczone zapytanie skończy się 503 zamiast wywołania `matchRecipes`.

## Faza 1: Wykluczenia w formach wariantowych (#1)

### Overview

Udowodnić, że wykluczenie w innej formie niż składnik (odmiana, wielkość liter, brak polskich znaków, literówka, synonim, zamiennik) ukrywa przepis, oraz przypiąć świadome granice.

### Changes Required:

#### 1. Tabela wykluczeń wariantowych

**File**: `src/lib/matching/rank.test.ts` (blok `describe("exclusions")`)

**Intent**: Dodać `it.each` z wierszami `[forma wykluczenia, produkt w przepisie, ukryty]`, używając istniejącego wzorca `one([product, "sól"], ["sól"], [exclusion])`. Każdy wiersz łapie inną regresję normalizacji po stronie wykluczenia.

**Contract**: Wiersze (oczekiwanie z PRD `prd.md:120`, `:122`):

- liczba mnoga/odmiana: „pomidory” ukrywa „pomidor”; „mleka” ukrywa „mleko kokosowe” → `true`;
- wielkie litery: np. „ORZECHY” ukrywa „orzechy włoskie” → `true`;
- bez polskich znaków: „orzechy wloskie” ukrywa „orzechy włoskie” → `true`;
- literówka w kluczu ≥ 4 znaki: „mozarella” ukrywa „ser mozzarella kulka” → `true`;
- literówka w kluczu < 4 znaki: wybrany krótki produkt → `false` (świadoma granica, Decisions 1);
- synonim w obie strony: „kartofel” ukrywa „ziemniaki”, „ziemniak” ukrywa „kartofle” → `true`;
- osobny produkt: „mleko” ukrywa „mleko owsiane” → `true` (PRD: wykluczenie ogólne obejmuje odmiany szczegółowe, `prd.md:122`).

#### 2. Wykluczenie wariantowe względem zamiennika

**File**: `src/lib/matching/rank.test.ts`

**Intent**: Pokazać, że wykluczenie w innej formie blokuje także opcję-zamiennik: składnik `["mleko", "mleko kokosowe"]` przy wykluczeniu „mleka” → przepis ukryty; składnik z niewykluczonym zamiennikiem (np. `["mleko", "napój sojowy"]`) przy „mleka” → widoczny (`prd.md:122`).

**Contract**: Nowy `it` lub wiersze tabeli w bloku `exclusions`; bez nowych helperów.

#### 3. Znane luki słownika jako `it.todo`

**File**: `src/lib/matching/rank.test.ts`

**Intent**: Udokumentować R1 bez naprawy: `it.todo` dla „mleko” → „napój sojowy”, „ser” → „serek” (posiadanie), „cukier” → „cukru”. Tytuł wskazuje, że naprawa wymaga zmiany słownika i podbicia `MATCH_KEYS_VERSION`.

**Contract**: Trzy `it.todo` w odpowiednich blokach; `npm test` raportuje je jako todo, nie jako błąd.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification:

- Celowe psucie: w `src/lib/matching/rank.ts:105` usuń sumę z `p` (rodzic/słowa frazy) albo w `keys.ts` podnieś `MIN_FUZZY_LENGTH` do 10 — pada dokładnie właściwy wiersz tabeli (osobny produkt / literówka ≥ 4), reszta przechodzi; zmiana cofnięta (`git diff src/lib/matching/rank.ts src/lib/matching/keys.ts` pusty)
- Każdy oczekiwany wynik w nowej tabeli ma źródło w PRD lub Decisions (przegląd autorki)

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed Fazą 2.

---

## Faza 2: Procent i produkty stałe (#4)

### Overview

Przypiąć przykłady % z PRD i udowodnić, że stałe liczą się dokładnie jak posiadane — w serwisie, gdzie następuje scalenie list.

### Changes Required:

#### 1. % z PRD w rankingu

**File**: `src/lib/matching/rank.test.ts` (blok `describe("percent and order")`)

**Intent**: Dodać: jajecznica `["jajko", "sól", "pieprz"]` przy `have: ["jajko"]` → `percent` 33 (`prd.md:124`); składnik dostępny przez zamiennik, np. `[["miód", "syrop z agawy"]]` przy `have: ["syrop z agawy"]` → 100 (`prd.md:120`).

**Contract**: Asercje na `percent` przez helper `one()`; bez asercji kolejności.

#### 2. Stałe = posiadane w serwisie

**File**: `src/lib/services/recipes.test.ts` (blok `describe("matchRecipes")`, istniejący `fakeClient` i `recipeRow`)

**Intent**: Na tej samej bazie (np. jajecznica + przepis kontrolny):

- `{have: ["jajko"], staple: ["sól", "pieprz"]}` i `{have: ["jajko", "sól", "pieprz"], staple: []}` dają ten sam % (100) i tę samą kolejność;
- `{have: [], staple: ["sól", "pieprz"], exclude: []}` daje liczbowy % (nie `null`);
- stała, która jest też wykluczona (`staple: ["mleko"], exclude: ["mleko"]`), nie daje „mam”, a przepis z jedynym składnikiem „mleko” jest ukryty.

**Contract**: Wywołania `matchRecipes(supabase, lists, page)` z istniejącymi helperami; asercje na `recipes[].match.percent` i listę `id`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification:

- Celowe psucie: w `src/lib/services/recipes.ts:278-282` usuń `...staple` ze scalenia — padają testy „stałe = posiadane” i „tylko stałe”, a testy rankingu w `rank.test.ts` przechodzą; zmiana cofnięta (`git diff src/lib/services/recipes.ts` pusty)
- Wartości 33 i 100 pochodzą z PRD, nie z uruchomienia kodu (przegląd autorki)

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed Fazą 3.

---

## Faza 3: Limity wejścia na serwerze (#5)

### Overview

Udowodnić, że `GET /api/recipes/match` sam odrzuca zbyt duże wejście kodem `400 invalid_query`, przepuszcza wartości graniczne i liczy słowa łącznie na trzech listach. Ustalić wzorzec testu endpointu dla repo.

### Changes Required:

#### 1. `countTokens`

**File**: `src/lib/matching/limits.test.ts`

**Intent**: Dodać testy: słowa liczone po `tokenize` (suma po tagach), liczby i procenty („1,5%”) oraz stopwordy („z”, „bez”) nie są słowami; pusta lista → 0.

**Contract**: `countTokens(tags: string[]): number`; oczekiwania z kontraktu tokenizacji (`tokenize.ts:4-13`, komentarz o stopwordach i liczbach).

#### 2. Hermetyczny test handlera

**File**: `src/pages/api/recipes/_match.test.ts` (nowy; prefiks `_` wyklucza go z routera Astro)

**Intent**: Wywołać `GET` z kontekstem `{ url, request, cookies }` (rzutowanym na `APIContext`) i zbudować zapytania z importowanych `MAX_TAGS`, `MAX_TAG_LENGTH`, `MAX_TOKENS`:

- odrzucenie → najpierw `status === 400`, potem `body.error === "invalid_query"`, a `matchRecipes` nie został wywołany: `MAX_TAGS + 1` tagów w jednej sekcji; tag o długości `MAX_TAG_LENGTH + 1`; pusty tag (same spacje); `MAX_TOKENS + 1` słów rozbitych między `have` i `exclude` (żadna lista osobno nie przekracza limitu); brak tagów w ogóle;
- granica przechodzi → `matchRecipes` wywołany z przyciętymi listami, status 200: dokładnie `MAX_TAGS` tagów, tag o długości `MAX_TAG_LENGTH`, dokładnie `MAX_TOKENS` słów łącznie.
  Odrzucenia jako jeden `it.each` (jedna właściwość: „przekroczenie → 400”), granice jako drugi.

**Contract**: `vi.mock("@/lib/supabase", …)` z `createClient` zwracającym obiekt różny od `null`; `vi.mock("@/lib/services/recipes", …)` z `matchRecipes` jako `vi.fn()` zwracającym pustą stronę `{ recipes: [], hasMore: false, total: 0 }`. Żadnych literałów limitów w teście.

### Success Criteria:

#### Automated Verification:

- Unit tests pass (including `_match.test.ts`): `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build does not emit a route for the test file: `npm run build` succeeds and `dist/` contains no `match.test` / `_match.test` output

#### Manual Verification:

- Celowe psucie: w `src/pages/api/recipes/match.ts:39` zmień `> MAX_TOKENS` na `> MAX_TOKENS + 1` (albo usuń warunek `countTokens`) — pada tylko przypadek „`MAX_TOKENS + 1` słów na dwóch listach”; zmiana cofnięta (`git diff src/pages/api/recipes/match.ts` pusty)

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed Fazą 4.

---

## Faza 4: Bramka mutacyjna Stryker (ad hoc)

### Overview

Sprawdzić mutacjami, czy testy z faz 1–3 łapią regresje w zmienionych modułach. Bramka selektywna, uruchamiana ręcznie, nie w CI.

### Changes Required:

#### 1. Zależności i konfiguracja

**File**: `package.json`, `stryker.config.json` (nowy), `.gitignore`

**Intent**: Dodać `@stryker-mutator/core` i `@stryker-mutator/vitest-runner` jako devDependencies; skonfigurować `testRunner: "vitest"` z istniejącym `vitest.config.ts`; dodać `reports/` i `.stryker-tmp/` do `.gitignore`. Bez skryptu w CI i bez dopinania do `npm test`.

**Contract**: `stryker.config.json` z `testRunner`, `vitest.configFile`, `reporters: ["clear-text", "progress", "html"]`; `mutate` przekazywane z linii poleceń.

#### 2. Przegląd przetrwałych mutantów

**File**: `src/lib/matching/rank.test.ts`, `src/lib/matching/keys.test.ts`, `src/lib/matching/limits.test.ts`, `src/pages/api/recipes/_match.test.ts` (tylko jeśli potrzebne)

**Intent**: Uruchomić `npx stryker run --mutate "src/lib/matching/rank.ts,src/lib/matching/keys.ts,src/lib/matching/limits.ts,src/pages/api/recipes/match.ts"`. Dla każdego przetrwałego mutanta zapytać „czy ta zmiana zaszkodziłaby użytkownikowi?”: tak → dodać asercję z wyrocznią z PRD/Decisions; nie (równoważny, kosmetyczny, komunikat logu) → świadomie zignorować. Nie przypinać szczegółów implementacji, żeby zabić kosmetyczny mutant.

**Contract**: Notatka `context/changes/testing-matching-contract/mutation-report.md`: wynik mutacji per plik, lista zabitych mutantów (z testem) i zignorowanych (z jednozdaniowym powodem).

### Success Criteria:

#### Automated Verification:

- Stryker runs to completion: `npx stryker run --mutate "src/lib/matching/rank.ts,src/lib/matching/keys.ts,src/lib/matching/limits.ts,src/pages/api/recipes/match.ts"`
- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- `git status` shows no files under `reports/` or `.stryker-tmp/`

#### Manual Verification:

- Raport HTML (`reports/mutation/mutation.html`) przejrzany; każdy przetrwały mutant ma decyzję w `mutation-report.md`
- Żaden nowy test nie powiela logiki implementacji (przegląd autorki)

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed Fazą 5.

---

## Faza 5: Cookbook, AGENTS.md i synchronizacja test-planu

### Overview

Zapisać wzorce z faz 1–4, żeby kolejny test w tych obszarach powstawał tak samo, i zaktualizować stan Etapu 1.

### Changes Required:

#### 1. Cookbook i bramki

**File**: `context/foundation/test-plan.md`

**Intent**: Uzupełnić §6.1 (reference test: tabela wykluczeń w `rank.test.ts`), §6.4 (wzorzec `_*.test.ts` + `vi.mock("@/lib/supabase")` + najpierw status, potem body), §6.5 (reguła dopasowania: wyrocznia z PRD, `it.each` per właściwość, `it.todo` dla luk słownika), §6.6 (notatka Etapu 1 z R1–R3 jako otwartymi ryzykami); w §5 dodać wiersz bramki mutacyjnej „ad hoc (lokalnie, po fazie ryzyka)”; w §4 dodać Stryker do stacku; w §3 ustawić Status Etapu 1 na `complete`.

**Contract**: Tylko wskazane sekcje; §1–§2 bez zmian.

#### 2. AGENTS.md

**File**: `AGENTS.md` (sekcja `## Testing`)

**Intent**: Dopisać: testy w `src/pages/` nazywaj `_<name>.test.ts`, bo Astro routuje każdy plik `.ts` w `src/pages`, a prefiks `_` go wyklucza; endpoint testuj z `vi.mock("@/lib/supabase")` (moduł importuje `astro:env/server`). Dodać krótką sekcję „Mutation testing”: Stryker selektywnie, `npx stryker run --mutate "<plik>"` po fazie ryzyka, przetrwałe mutanty ocenia się pod kątem szkody dla użytkownika, bez gonienia 100% i bez Strykera w CI.

**Contract**: Kilka punktów w istniejącej sekcji `## Testing` + nowy podrozdział; zwięźle, w stylu reszty pliku.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- `test-plan.md` §3 row 1 has Status `complete`: `grep -n "Kontrakt dopasowania" context/foundation/test-plan.md`

#### Manual Verification:

- Cookbook §6.1, §6.4, §6.5, §6.6 nie zawiera już „TBD — see §3 Phase 1” i wskazuje istniejące pliki testów
- AGENTS.md: konwencja `_*.test.ts` i sekcja „Mutation testing” czytelne dla kogoś spoza tej zmiany

---

## Testing Strategy

### Unit Tests:

- `rank.test.ts`: wykluczenia wariantowe (odmiana, wielkość liter, diakrytyki, literówka po obu stronach granicy 4 znaków, synonim w obie strony, osobny produkt, zamiennik); % jajecznicy 33 i zamiennika 100.
- `limits.test.ts`: `countTokens`.

### Integration Tests:

- Hermetyczne: `recipes.test.ts` (stałe = posiadane, tylko stałe, wykluczona stała) z `fakeClient`; `_match.test.ts` (odrzucenia i granice) z `vi.mock`. Bez prawdziwej bazy — reguły nie zależą od ograniczeń DB.

### Manual Testing Steps:

1. Faza 1–3: celowe psucie jednej reguły na fazę i cofnięcie zmiany.
2. Faza 4: przegląd raportu HTML Strykera i decyzja per przetrwały mutant.
3. Faza 5: przegląd cookbooka i AGENTS.md.

## Performance Considerations

Bez asercji czasu (Decisions 4). Stryker uruchamiany lokalnie na czterech plikach z `vitest.related: true`, poza CI.

## Migration Notes

Nie dotyczy — bez zmian schematu i danych.

## References

- Research: `context/changes/testing-matching-contract/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (#1, #4, #5), §3 Etap 1, §6
- PRD: `context/foundation/prd.md:120-124`
- Kontrakt domenowy: `context/archive/2026-10-12-first-pantry-match/plan.md:48-83`, `:264-266`
- Lessons: `context/foundation/lessons.md` („Bound user-driven CPU work”, „Assert status and body type”)
- Wzorce: `src/lib/matching/rank.test.ts:31-35`, `:86-109`; `src/lib/services/recipes.test.ts:420-471`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Wykluczenia w formach wariantowych (#1)

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — a99a6f1
- [x] 1.2 Lint passes: `npm run lint` — a99a6f1
- [x] 1.3 Type check passes: `npx astro check` — a99a6f1

#### Manual

- [x] 1.4 Celowe psucie reguły wykluczeń: pada właściwy wiersz, zmiana cofnięta — a99a6f1
- [x] 1.5 Każdy oczekiwany wynik ma źródło w PRD lub Decisions — a99a6f1

### Phase 2: Procent i produkty stałe (#4)

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — a99a6f1
- [x] 2.2 Lint passes: `npm run lint` — a99a6f1
- [x] 2.3 Type check passes: `npx astro check` — a99a6f1

#### Manual

- [x] 2.4 Celowe psucie scalenia stałych: padają testy stałych, zmiana cofnięta — a99a6f1
- [x] 2.5 Wartości 33 i 100 pochodzą z PRD — a99a6f1

### Phase 3: Limity wejścia na serwerze (#5)

#### Automated

- [x] 3.1 Unit tests pass (including `_match.test.ts`): `npm test` — 72f0845
- [x] 3.2 Lint passes: `npm run lint` — 72f0845
- [x] 3.3 Type check passes: `npx astro check` — 72f0845
- [x] 3.4 Build does not emit a route for the test file — 72f0845

#### Manual

- [x] 3.5 Celowe psucie limitu słów: pada tylko przypadek łącznego limitu, zmiana cofnięta — 72f0845

### Phase 4: Bramka mutacyjna Stryker (ad hoc)

#### Automated

- [x] 4.1 Stryker runs to completion on the four modules — 18fdac9
- [x] 4.2 Unit tests pass: `npm test` — 18fdac9
- [x] 4.3 Lint passes: `npm run lint` — 18fdac9
- [x] 4.4 No files under `reports/` or `.stryker-tmp/` in `git status` — 18fdac9

#### Manual

- [x] 4.5 Każdy przetrwały mutant ma decyzję w `mutation-report.md` — 18fdac9
- [x] 4.6 Żaden nowy test nie powiela logiki implementacji — 18fdac9

### Phase 5: Cookbook, AGENTS.md i synchronizacja test-planu

#### Automated

- [x] 5.1 Unit tests pass: `npm test`
- [x] 5.2 Lint passes: `npm run lint`
- [x] 5.3 `test-plan.md` §3 row 1 has Status `complete`

#### Manual

- [x] 5.4 Cookbook §6.1, §6.4, §6.5, §6.6 bez „TBD — see §3 Phase 1”
- [x] 5.5 AGENTS.md: konwencja `_*.test.ts` i sekcja „Mutation testing” czytelne
