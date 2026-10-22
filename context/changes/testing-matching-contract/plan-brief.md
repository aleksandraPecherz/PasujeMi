# Kontrakt dopasowania (Etap 1 test-planu) — Plan Brief

> Full plan: `context/changes/testing-matching-contract/plan.md`
> Research: `context/changes/testing-matching-contract/research.md`

## What & Why

Etap 1 z `test-plan.md` §3: udowodnić testami trzy ryzyka dopasowania — przepis z wykluczonym składnikiem (np. alergenem) trafia na listę, bo wykluczenie ma inną formę (#1); zły % albo stałe liczone inaczej niż posiadane (#4); zbyt duże wejście omija walidację serwera albo kończy się 1102 (#5). Zmiana jest wyłącznie testowa.

## Starting Point

Reguła dopasowania to czysty moduł z dobrymi testami posiadania, ale wykluczenia testowane są prawie tylko w formie identycznej ze składnikiem; brak przykładu „jajecznica = 33%” i bezpośredniego testu „stałe = posiadane”; endpoint `GET /api/recipes/match` nie ma żadnego testu, w repo nie ma jeszcze `vi.mock`, Stryker nie jest zainstalowany.

## Desired End State

`npm test` pilnuje wykluczeń w każdej formie z PRD, % z przykładów PRD, scalenia stałych w serwisie oraz limitów endpointu (wartości graniczne przechodzą, przekroczenia dają `400 invalid_query`). Raport Stryker dla czterech modułów jest przejrzany. Cookbook test-planu i AGENTS.md opisują wzorce, a Etap 1 ma status `complete`.

## Key Decisions Made

| Decision                                   | Choice                                                                          | Why (1 sentence)                                                                     | Source         |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------- |
| Literówki < 4 znaki                        | Przypiąć testem „nie ukrywa” jako świadomą granicę                              | Zawężenie PRD zaakceptowane w `first-pantry-match`, ma być widoczne, nie przypadkowe | Research       |
| Luki słownika (napój sojowy, serek, cukru) | `it.todo` + ryzyko R1, bez naprawy                                              | Naprawa zmienia słownik i wymaga podbicia `MATCH_KEYS_VERSION`                       | Research       |
| „mleko” → „mleko owsiane”                  | Oczekiwany wynik z PRD: ukryty                                                  | Wykluczenie ogólne obejmuje odmiany szczegółowe (`prd.md:122`)                       | Plan (autorka) |
| `MAX_URL_LENGTH` w endpoincie              | Bez testu, ryzyko R2                                                            | Test chroni istniejące zachowanie, nie wymusza nowego                                | Research       |
| Czas / CPU                                 | Bez asercji, ręczne `npm run bench:match` (R3)                                  | Testy czasu są niestabilne                                                           | Research       |
| Warstwy                                    | Unit (`rank.test.ts`, `limits.test.ts`) + hermetyczne (`fakeClient`, `vi.mock`) | Reguły nie zależą od DB; najtańszy realny sygnał                                     | Research       |
| Plik testu endpointu                       | `src/pages/api/recipes/_match.test.ts`                                          | Astro routuje każdy `.ts` w `src/pages`; prefiks `_` go wyklucza                     | Plan           |
| Stryker                                    | Ad hoc, Faza 4, na `rank/keys/limits/match.ts`, bez CI                          | Sprawdza, czy asercje łapią regresje, bez kosztu przy każdym commicie                | Plan           |
| Celowe psucie                              | Krok ręczny w fazach 1–3                                                        | Dowód, że pada właściwy test, zanim zaufamy zieleni                                  | Plan (autorka) |
| AGENTS.md                                  | Konwencja `_*.test.ts` + sekcja „Mutation testing”                              | Następny agent nie utworzy trasy z testu i nie będzie gonił 100%                     | Plan (autorka) |

## Scope

**In scope:**

- Nowe testy w `rank.test.ts`, `limits.test.ts`, `recipes.test.ts`, nowy `_match.test.ts`
- `it.todo` dla luk słownika
- Stryker (devDeps, `stryker.config.json`, `.gitignore`) i `mutation-report.md`
- `test-plan.md` §3–§6, `AGENTS.md` sekcja Testing

**Out of scope:**

- Jakiekolwiek zmiany kodu produkcyjnego i słownika
- `MAX_URL_LENGTH` w endpoincie, asercje czasu, testy `limit`/`offset`
- Stryker w CI, integracja z lokalnym Supabase, nowe asercje remisów

## Architecture / Approach

Wyrocznia z PRD i Decisions → najtańsza warstwa per ryzyko: czysty `rankRecipes` dla reguł #1/#4, `matchRecipes` z `fakeClient` dla scalenia stałych, handler `GET` z `vi.mock("@/lib/supabase")` i `vi.mock("@/lib/services/recipes")` dla limitów (walidacja kończy się przed `createClient`). Limity w testach budowane z importowanych stałych z `limits.ts`. Na koniec Stryker sprawdza siłę asercji.

## Phases at a Glance

| Phase                          | What it delivers                                               | Key risk                                                               |
| ------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Wykluczenia wariantowe (#1) | Tabela `it.each` wykluczeń + `it.todo` R1                      | Nowy wiersz pada na obecnym kodzie — zgłosić, nie zmieniać oczekiwania |
| 2. Procent i stałe (#4)        | 33% / zamiennik 100% + hermetyczne „stałe = posiadane”         | Asercja kolejności remisów wkradnie się do testu                       |
| 3. Limity wejścia (#5)         | `countTokens` + `_match.test.ts` z granicami i przekroczeniami | Zły mock `createClient` → 503 zamiast przepuszczenia                   |
| 4. Stryker (ad hoc)            | Raport + decyzje per przetrwały mutant                         | Przypinanie szczegółów implementacji dla kosmetycznych mutantów        |
| 5. Cookbook i AGENTS.md        | §5, §6, §3 `complete`, konwencje dla agentów                   | —                                                                      |

**Prerequisites:** `npm install` (Faza 4 doda devDeps); research zakończony.
**Estimated effort:** ~2–3 sesje w 5 fazach (fazy 1–3 małe, Faza 4 zależy od liczby przetrwałych mutantów).

## Open Risks & Assumptions

- R1: luki słownika („napój sojowy” przy „mleko”, „serek” przy „ser”, „cukru” vs „cukier”) zostają do osobnej zmiany.
- R2: endpoint nie sprawdza `MAX_URL_LENGTH`; górną granicę daje limit URL Cloudflare.
- R3: brak automatycznej bramki CPU dla `rankRecipes`.
- Założenie: `@stryker-mutator/vitest-runner` działa z Vitest ^5 w tym repo — do potwierdzenia przy instalacji w Fazie 4.

## Success Criteria (Summary)

- Zepsucie normalizacji wykluczeń, scalenia stałych albo limitu słów powoduje czerwony, właściwy test.
- Każda oczekiwana wartość w nowych testach ma źródło w PRD lub zaakceptowanej decyzji.
- Kolejna osoba dodająca test reguły dopasowania lub endpointu znajduje gotowy wzorzec w §6 i AGENTS.md.
