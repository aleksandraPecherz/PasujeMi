# Licznik przepisów na liście dopasowań (issue #24) — plan implementacji

## Overview

Domykamy kod próby z #24 (rozpakowany ze stasha, niezacommitowany). Nad listą przepisów pojawia się licznik
„Znaleziono N przepisów”, gdzie N to liczba wszystkich przepisów pokazanej listy, a nie tylko wczytanych stron.

Plan dodaje trzy rzeczy do kodu próby:
- **Brak liczby z bazy.** Licznik się chowa zamiast pokazywać 0.
- **Ładowanie nowych filtrów.** Licznik znika na czas ładowania, żeby nie pokazywać nieaktualnej liczby.
- **Testy.** Dochodzą brakujące testy serwisu i odmiany.

## Current State Analysis

Kod próby jest w drzewie roboczym na `recipe-count` (= `master`, `d3261e3`). Obejmuje 7 plików, nałożył się bez
konfliktów, a `check:ui` i `npm test` przechodzą (`research.md`, Open Question 6).

- **Serwis.** `listRecipes` liczy `total` przez `{ count: "exact" }` z fallbackiem `count ?? 0`
  (`src/lib/services/recipes.ts:57,70`). Przy braku `count` licznik pokazałby więc „Znaleziono 0 przepisów” nad
  niepustą listą. `matchRecipes` zwraca `total = ranked.length` (`:169`).
- **Endpointy.** Oba przekazują wynik serwisu bez zmian (`src/pages/api/recipes/index.ts:25-26`, `match.ts:50-51`).
- **Hook.** Odrzuca odpowiedź bez numerycznego `total` i pokazuje błąd zamiast listy
  (`src/components/hooks/usePantryMatch.ts:67`).
- **Widok.** Renderuje licznik, gdy `recipes.length > 0` (`src/components/pantry/PantryMatch.tsx:90`). W trakcie
  ładowania pokazuje stary `total`, a lista ma wtedy `opacity-60` (`:93`).
- **Rodzaje ładowania.** `loading` jest `true` zarówno przy „Zastosuj filtry” (`apply` → `load(lists, 0)`), jak i
  przy „Pokaż więcej” (`loadMore` → `load(applied, offset)`) (`usePantryMatch.ts:225-231`). Hook nie rozróżnia tych
  dwóch przypadków.
- **Odmiana.** Siedzi inline w komponencie `RecipeCount` (`src/components/pantry/PantryStates.tsx:20-31`). Vitest
  działa w środowisku `node` i zbiera tylko `src/**/*.test.ts` (`vitest.config.ts`), więc jej nie testuje.
- **Testy serwisu.** `src/lib/services/recipes.test.ts` testuje tylko `matchRecipes`. Atrapa klienta (`fakeClient`,
  `:22-104`) obsługuje tylko `order("id")`, a dla każdej innej kolumny rzuca wyjątek. Nie zna też opcji `count`.
- **KitchenSink.** Sekcja `count` już stoi za `error` (`src/components/dev/KitchenSink.tsx:191,195`).

## Desired End State

- `GET /api/recipes` i `GET /api/recipes/match` zwracają `{ recipes, hasMore, total }`, gdzie `total: number | null`.
  `null` pojawia się tylko wtedy, gdy PostgREST nie zwrócił liczby w `listRecipes`.
- Licznik widać wtedy i tylko wtedy, gdy spełnione są trzy warunki naraz: lista ma przepisy, `total` jest liczbą i
  nie trwa ładowanie od pierwszej strony. Przy „Pokaż więcej” licznik zostaje.
- Tekst licznika daje `recipeCountLabel(n)` z `src/lib/recipe-count.ts`, np. „Znaleziono 1 przepis”,
  „Znaleziono 22 przepisy”, „Znaleziono 12 przepisów”.
- Muszą przechodzić: `npm test` (z nowymi testami), `npm run check:ui`, `npm run lint` i `npx astro check`.

### Key Discoveries:

- `count` w postgrest-js jest `null`, gdy brakuje nagłówka `Content-Range` z liczbą (Context7
  `/supabase/supabase-js`, `PostgrestBuilder.ts`). Typ `count` to `number | null`, więc `total: count` przechodzi bez
  fallbacku.
- `parsePage` sprawdza kształt odpowiedzi przed treścią (`lessons.md`, „Assert status and body type”). Nowa reguła
  dla `total` musi zachować tę kolejność.
- `commit` aktualizuje stan tylko dla najnowszego żądania (`usePantryMatch.ts:144-146`). Nowe pole `reloading` musi
  przestrzegać tej samej reguły, inaczej porzucone żądanie zostawi je na stałe w `true`.
- Smoke (`scripts/smoke.mjs:74-75,88`) zakłada liczbowe `total` na seedzie. Lokalny Supabase zwraca `count`, więc
  smoke nie wymaga zmian.

## What We're NOT Doing

- **Wspólny helper polskiej odmiany** (np. `pluralPl`) i zmiany w `SignUpForm.tsx`: poza zakresem (decyzja 5).
  `recipeCountLabel` jest tylko dla przepisów.
- **Korekta zawyżonego `total` w `matchRecipes`** po usunięciu lub wykluczeniu przepisu w kroku 4: akceptujemy
  (decyzja 2), tak samo jak przy `hasMore`.
- **Szkielet w miejscu licznika:** licznik się chowa, bez placeholdera, więc w KitchenSink nie przybywa stanów.
- **Logowanie po stronie serwera** przy `count === null`.
- **Test `parsePage` w hooku:** nie wybrany. Kontrakt `null` chronią testy serwisu i weryfikacja ręczna.
- **Zmiany w endpointach** (przekazują wynik serwisu bez zmian) i w `src/types.ts`.

## Implementation Approach

Najpierw kontrakt i serwis z testami (Faza 1), potem klient: hook, widok i odmiana (Faza 2). Faza 1 jest wstecznie
zgodna z obecnym hookiem tylko połowicznie: hook z kodu próby odrzuca `null`. Lokalnie `count` przychodzi zawsze,
więc między fazami nic się nie psuje, a obie fazy i tak trafiają do jednego PR.

## Faza 1: Kontrakt i serwis

### Overview

`listRecipes` zwraca `total: number | null` zamiast udawać 0. Testy serwisu obejmują `total` w obu funkcjach.

### Changes Required:

#### 1. Serwis przepisów

**File**: `src/lib/services/recipes.ts`

**Intent**: Brak liczby z bazy ma dawać `null`, żeby klient mógł schować licznik (decyzja 1). Komentarz przy
`total` w `listRecipes` mówi, kiedy pojawia się `null`.

**Contract**:
- `listRecipes(...)` zwraca `Promise<{ recipes: Recipe[]; hasMore: boolean; total: number | null }>`, gdzie
  `total: count` bez `?? 0`.
- `matchRecipes` zostaje przy `total: number`. To podtyp `number | null`, więc oba endpointy dają ten sam kształt
  odpowiedzi.

#### 2. Atrapa klienta i testy serwisu

**File**: `src/lib/services/recipes.test.ts`

**Intent**: Rozszerzyć `fakeClient` tak, żeby obsłużył `listRecipes`, i dopisać brakujące asercje `total` (decyzja 4).

**Contract**:
- **`fakeClient`, zmiany:**
  - `order()` przyjmuje kolejno `name` i `id` i sortuje stabilnie w kolejności wywołań; dla każdej innej kolumny
    nadal rzuca wyjątek.
  - `select(columns, options?)` zapamiętuje `options.count`. Odpowiedź zawiera `count` (liczbę wierszy po filtrach,
    przed `range`) tylko wtedy, gdy zapytano o `count` i nie włączono nowej opcji atrapy, np. `omitCount: true`.
    W pozostałych przypadkach `count: null`.
  - Typ `then` rozszerza wynik o `count: number | null`.
- **Nowy blok `describe("listRecipes")`:**
  - Strona środkowa: `total` = liczba wszystkich wierszy, `hasMore: true`, kolejność po nazwie.
  - Ostatnia strona: `hasMore: false`, `total` bez zmian.
  - Bez liczby z bazy (`omitCount`): `total: null`, a `recipes` są nadal zwracane.
  - Zapytanie prosi o `count: "exact"`, sprawdzane przez zapisane wywołania.
- **Nowe asercje w `describe("matchRecipes")`:**
  - Ścieżka wykluczeń: `total` nie liczy wykluczonych przepisów, np. w istniejącym teście „excluded” (`:196`).
  - Pusta strona (`offset` ≥ liczba rankingowanych): `recipes: []`, `hasMore: false`,
    `total` = liczba rankingowanych.

### Success Criteria:

#### Automated Verification:

- Testy przechodzą, w tym nowe testy `listRecipes` i asercje `total` w `matchRecipes`: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`

**Implementation Note**: Po przejściu weryfikacji automatycznej przejdź do Fazy 2. Faza 1 nie ma kroków ręcznych.

---

## Faza 2: Hook, widok i odmiana

### Overview

Klient przepuszcza `total: null` i chowa wtedy licznik. Licznik znika też na czas ładowania od pierwszej strony.
Odmiana przechodzi do testowalnej funkcji.

### Changes Required:

#### 1. Hook

**File**: `src/components/hooks/usePantryMatch.ts`

**Intent**: Przyjmować `total: null` jako poprawną odpowiedź (decyzja 1). Wystawić `reloading`, żeby widok chował
licznik tylko przy nowych filtrach, a nie przy „Pokaż więcej” (decyzja 3).

**Contract**:
- `parsePage` akceptuje `typeof body.total === "number" || body.total === null`. Brak pola albo inny typ nadal daje
  `null` (błąd „nieoczekiwana odpowiedź”).
- `PageResult` i stan `total` mają typ `number | null`. Stan startowy to `null`.
- Nowy stan `reloading: boolean` (`true` = trwa żądanie od `offset` 0):
  - `load` ustawia go na `pageOffset === 0`;
  - `commit` zeruje go dla najnowszego żądania, zarówno przy sukcesie, jak i przy błędzie, w tym samym miejscu co
    `setLoading(false)`.
- Hook zwraca `reloading` obok `loading`.

#### 2. Widok

**File**: `src/components/pantry/PantryMatch.tsx`

**Intent**: Licznik tylko przy znanej liczbie i poza ładowaniem nowych filtrów.

**Contract**: Warunek renderu `recipes.length > 0 && total !== null && !reloading`. `RecipeCount` dostaje `number`.

#### 3. Funkcja odmiany i komponent

**File**: `src/lib/recipe-count.ts` (nowy), `src/components/pantry/PantryStates.tsx`

**Intent**: Wydzielić tekst licznika do pliku `.ts`, żeby Vitest mógł go przetestować. Funkcja dotyczy tylko
przepisów, nie jest wspólnym helperem (decyzja 5). `RecipeCount` zostaje komponentem prezentacyjnym z tymi samymi
klasami tokenów.

**Contract**:
- `export function recipeCountLabel(total: number): string` zwraca pełny tekst „Znaleziono N <forma>”. Formy:
  CLDR `one` → „przepis”, `few` → „przepisy”, pozostałe → „przepisów” (`Intl.PluralRules("pl")`, przeniesione z
  `PantryStates.tsx`).
- `RecipeCount({ total, className })`: sygnatura bez zmian, renderuje `recipeCountLabel(total)`. Klasy:
  `text-muted-foreground text-sm`.

#### 4. Test odmiany

**File**: `src/lib/recipe-count.test.ts` (nowy)

**Intent**: Chronić pułapki polskiej odmiany (12–14 i 112 → „-ów”, ale 22–24 → „-y”).

**Contract**: Pełne teksty dla:
- 1 → „Znaleziono 1 przepis”
- 2, 4, 22, 24, 102 → „… przepisy”
- 0, 5, 11, 12, 14, 21, 112 → „… przepisów”

#### 5. KitchenSink

**File**: `src/components/dev/KitchenSink.tsx`

**Intent**: Bez zmian kodu. Sekcja `count` z kodu próby (1, 3, 12, 22) stoi już za `error` i pokazuje jedyny stan
komponentu. Ukrycie to brak renderu, a nie nowy stan.

**Contract**: Kolejność sekcji: `error` → `count` → `empty` → `loading`.

### Success Criteria:

#### Automated Verification:

- Testy przechodzą, w tym `src/lib/recipe-count.test.ts`: `npm test`
- Brak literałów kolorów w plikach UI: `npm run check:ui`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- `/dev/kitchen-sink`: sekcja `count` stoi za `error` i pokazuje „1 przepis”, „3 przepisy”, „12 przepisów”,
  „22 przepisy” w jasnym i ciemnym motywie
- `/` bez filtrów: licznik pokazuje liczbę całego katalogu, nie tylko 1. strony
- `/` → „Zastosuj filtry”: licznik znika na czas ładowania i wraca z nową liczbą
- `/` → „Pokaż więcej”: licznik zostaje widoczny i ma tę samą liczbę
- Smoke na działającym serwerze z lokalnym Supabase przechodzi: `npm run smoke`

**Implementation Note**: Po weryfikacji automatycznej zatrzymaj się na potwierdzenie weryfikacji ręcznej przez
człowieka. W opisie PR umieść „Closes #24” (`lessons.md`, „Close roadmap issues explicitly”).

---

## Testing Strategy

### Unit Tests:

- `listRecipes`: `total` przy liczbie z bazy, `total: null` bez niej, `hasMore` na środkowej i ostatniej stronie,
  `count: "exact"` w zapytaniu.
- `matchRecipes`: `total` przy wykluczeniach i na pustej stronie (obok istniejącej asercji przy stronicowaniu,
  `recipes.test.ts:150`).
- `recipeCountLabel`: formy `one` / `few` / `many` z pułapkami 12–14, 21, 22–24, 102, 112.

### Integration Tests:

- `npm run smoke`: `total` liczbowe na liście bez filtrów (≥ 5) i równe 4 przy wykluczeniu „jogurt”, bez zmian w
  skrypcie.

### Manual Testing Steps:

1. Otwórz `/dev/kitchen-sink`, sprawdź sekcję `count` w obu motywach.
2. Na `/` kliknij „Zastosuj filtry” z dowolnym tagiem i obserwuj, czy licznik znika na czas ładowania.
3. Przy liście dłuższej niż strona kliknij „Pokaż więcej” i sprawdź, czy licznik zostaje.

## Performance Considerations

`count: "exact"` w `listRecipes` dodaje po stronie Postgresa jedno `count(*)` na żądanie listy bez filtrów. Przy
obecnym rozmiarze katalogu to akceptowalne. `matchRecipes` liczy `total` z tablicy, która już istnieje, więc
reguła „Bound user-driven CPU work” z `lessons.md` nie jest naruszona.

## Migration Notes

Nie dotyczy: bez zmian schematu. Kontrakt API rozszerza się o pole, a jedynym klientem jest `usePantryMatch`.

## References

- Research: `context/changes/recipe-count/research.md`
- Issue: #24 „Licznik przepisów na liście dopasowań”
- Wzorzec walidacji kształtu: `src/components/hooks/usePantryMatch.ts:58-87`
- Wzorzec atrapy klienta: `src/lib/services/recipes.test.ts:22-104`
- Tokeny: `src/styles/global.css:19,65,115`; kontrast: `context/archive/2026-10-17-ui-palette/plan.md:40`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Kontrakt i serwis

#### Automated

- [x] 1.1 Testy przechodzą, w tym nowe testy `listRecipes` i asercje `total` w `matchRecipes`: `npm test` — a1a3a93
- [x] 1.2 Lint przechodzi: `npm run lint` — a1a3a93
- [x] 1.3 Typy przechodzą: `npx astro check` — a1a3a93

### Phase 2: Hook, widok i odmiana

#### Automated

- [x] 2.1 Testy przechodzą, w tym `src/lib/recipe-count.test.ts`: `npm test`
- [x] 2.2 Brak literałów kolorów w plikach UI: `npm run check:ui`
- [x] 2.3 Lint przechodzi: `npm run lint`
- [x] 2.4 Typy przechodzą: `npx astro check`
- [x] 2.5 Build przechodzi: `npm run build`

#### Manual

- [x] 2.6 `/dev/kitchen-sink`: sekcja `count` za `error`, cztery formy w jasnym i ciemnym motywie
- [ ] 2.7 `/` bez filtrów: licznik pokazuje liczbę całego katalogu
- [ ] 2.8 `/` → „Zastosuj filtry”: licznik znika na czas ładowania i wraca z nową liczbą
- [ ] 2.9 `/` → „Pokaż więcej”: licznik zostaje widoczny z tą samą liczbą
- [ ] 2.10 Smoke na działającym serwerze z lokalnym Supabase przechodzi: `npm run smoke`
