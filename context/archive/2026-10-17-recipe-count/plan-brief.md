# Licznik przepisów (issue #24) — Plan Brief

> Full plan: `context/changes/recipe-count/plan.md`
> Research: `context/changes/recipe-count/research.md`

## What & Why

Nad listą przepisów pokazujemy „Znaleziono N przepisów”, gdzie N obejmuje wszystkie strony, a nie tylko wczytane.
Kod próby z #24 działa, ale ma trzy braki:

- przy braku liczby z bazy pokazałby 0;
- w trakcie ładowania nowych filtrów pokazuje starą liczbę;
- brakuje testów serwisu i odmiany.

## Starting Point

Kod próby ze stasha leży w drzewie roboczym na `recipe-count` (7 plików, bez konfliktów po ui-palette, `check:ui`
i `npm test` przechodzą). Ma już kilka gotowych elementów:

- serwis liczy `total`, a endpointy go przekazują;
- hook waliduje i zapisuje `total`;
- `RecipeCount` korzysta z tokenów;
- sekcja w KitchenSink stoi za `error`.

## Desired End State

- **Brak liczby z bazy:** API zwraca `total: null`.
- **Kiedy licznik jest widoczny:** gdy lista ma przepisy, liczba jest znana i nie trwa ładowanie nowych filtrów.
  Przy „Pokaż więcej” licznik zostaje.
- **Odmiana:** robi to testowana funkcja `recipeCountLabel` („1 przepis”, „22 przepisy”, „12 przepisów”).

## Key Decisions Made

| Decision                                         | Choice                                                                | Why (1 sentence)                                                              | Source                 |
| ------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------- |
| Brak liczby z bazy                               | `total: null` → licznik ukryty, bez „0”                               | „0” nad niepustą listą wprowadza w błąd                                       | Research → user        |
| Zawyżony `total` po usunięciu przepisu w trakcie | Akceptujemy                                                           | Rzadki wyścig; tak samo działa `hasMore`                                      | Research → user        |
| Licznik w trakcie ładowania                      | Ukryty tylko przy ładowaniu od 1. strony (nowe filtry), bez szkieletu | Przy „Pokaż więcej” liczba się nie zmienia, więc ukrywanie dawałoby mignięcie | Plan                   |
| Sygnał dla widoku                                | Nowe pole `reloading` w hooku                                         | `loading` nie rozróżnia „Zastosuj filtry” od „Pokaż więcej”                   | Plan                   |
| Testy                                            | Serwis (`listRecipes`, `total` w `matchRecipes`) + odmiana            | Chronią kontrakt `null` i pułapkę 12/22                                       | Research → user + Plan |
| Odmiana                                          | `recipeCountLabel` w `src/lib/recipe-count.ts`, tylko dla przepisów   | Testowalna w Vitest (`node`, `*.test.ts`); wspólny helper poza zakresem       | Plan / user            |

## Scope

**In scope:**

- `total: number | null` w `listRecipes`;
- atrapa klienta z `order("name")` i `count` plus testy serwisu;
- `parsePage` przyjmuje `null`, hook dostaje pole `reloading`;
- warunek renderu licznika w widoku;
- `recipeCountLabel` z testem.

**Out of scope:**

- wspólny helper odmiany i zmiany w `SignUpForm.tsx`;
- korekta zawyżonego `total`;
- szkielet licznika;
- logowanie przy `count === null`;
- test `parsePage`;
- zmiany w endpointach i `src/types.ts`.

## Architecture / Approach

Ścieżka danych: serwis (`total` z `count` albo `ranked.length`) → endpoint (bez zmian) → `parsePage` (`number | null`)
→ stan `total` i `reloading` w hooku → `PantryMatch` renderuje `RecipeCount`, gdy
`recipes.length > 0 && total !== null && !reloading`. `reloading` ustawia `load` przy `offset` 0, a zeruje `commit`,
tylko dla najnowszego żądania.

## Phases at a Glance

| Phase                    | What it delivers                                                                            | Key risk                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Kontrakt i serwis     | `total: number \| null`, rozszerzona atrapa, testy `listRecipes` i `total` w `matchRecipes` | Atrapa musi wiernie oddać `count` przed `range`                     |
| 2. Hook, widok i odmiana | Ukrywanie licznika (`null`, `reloading`), `recipeCountLabel` z testem, weryfikacja ręczna   | `reloading` musi respektować `requestId`, inaczej zostanie w `true` |

**Prerequisites:** zainstalowane zależności (`npm ci`, zrobione); lokalny Supabase i działający serwer dla smoke.
Uwaga: Node v22.14.0 jest poniżej `>=22.19.0` wymaganego przez `eslint-plugin-astro` i `astro-eslint-parser`.
**Estimated effort:** ~1 sesja, 2 fazy.

## Open Risks & Assumptions

- Zakładamy, że lokalny i produkcyjny PostgREST zwracają `Content-Range` z liczbą. Gdyby nie, licznik po prostu
  się nie pojawi, a lista działa dalej.
- `npm run lint` i `npx astro check` nie były jeszcze uruchamiane na kodzie próby; mogą zgłosić coś z niego.
- Ostrzeżenie `EBADENGINE` (Node v22.14.0) może wpłynąć na lint plików `.astro`.

## Success Criteria (Summary)

- Licznik pokazuje poprawną, odmienioną liczbę wszystkich przepisów listy i nie pokazuje 0 ani starej liczby.
- „Pokaż więcej” nie powoduje mignięcia licznika.
- Testy, `check:ui`, lint, `astro check`, build i smoke przechodzą; PR zawiera „Closes #24”.
