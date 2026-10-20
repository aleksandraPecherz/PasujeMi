# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-20 (§5 gates corrected)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic check that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   author is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (excluding
`src/components/ui/`, `src/pages/dev/`, `src/components/dev/`), `supabase/`,
`scripts/`. Window: last 30 days.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                             | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Przepis z wykluczonym składnikiem (np. alergen) trafia na listę, bo składnik ma inną nazwę, odmianę, synonim, literówkę lub wchodzi przez zamiennik | High   | High       | PRD Guardrails + Business Logic (Wykluczenia); interview Q1, Q3; hot-spot dir `src/lib/matching` (17 commits/30d)                                                     |
| 2   | Obca osoba edytuje lub usuwa cudzy przepis (autoryzacja po stronie danych i API, nie tylko UI)                                                      | High   | Medium     | PRD Guardrails, FR-009, FR-010; interview Q1, Q3, Q4; archive `author-edits-own-recipe`, `admin-manages-any-recipe`; hot-spot dir `src/lib/services` (21 commits/30d) |
| 3   | Spiżarka (stałe, wykluczenia) jest widoczna lub zmienialna przez inną osobę                                                                         | High   | Medium     | PRD Guardrails, FR-003; interview Q4; archive `remembered-staples-exclusions`; lessons.md (uprawnienia w schemacie `private`)                                         |
| 4   | Przepis z posiadanymi produktami ląduje za nisko albo ma zły % (reguła „ten sam składnik", zamienniki, stałe liczone jak posiadane)                 | Medium | High       | PRD US-01, Business Logic; interview Q1, Q3; hot-spot dir `src/lib/matching` (17 commits/30d)                                                                         |
| 5   | Dużo tagów lub skrajne dane wejściowe przekraczają limit CPU na Workers (błąd 1102 zamiast komunikatu) albo omijają walidację serwera               | High   | Medium     | interview Q2 (incydent 12× „mąka"); lessons.md „Bound user-driven CPU work"; roadmap S-03 Risk (< 1 s przy ok. 1000 przepisów)                                        |
| 6   | Niezalogowany lub anon ma dostęp do danych albo API, a check w CI przechodzi z błędnego powodu                                                      | High   | Low        | PRD Access Control; interview Q2; lessons.md „Assert status and body type"; hot-spot dir `src/pages/auth` (17 commits/30d)                                            |
| 7   | Przepływ tagi → filtry → kafelki → szczegóły psuje się, a nikt tego nie widzi (dziś tylko ręcznie)                                                  | High   | Medium     | PRD Primary success; interview Q4; hot-spot dir `src/components/pantry` (19 commits/30d)                                                                              |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                              | Must challenge                                               | Context `/10x-research` must ground                                                                         | Likely cheapest layer                | Anti-pattern to avoid                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| #1   | Wykluczenie „mleko" ukrywa też „mleko kokosowe", odmiany, literówki i synonimy; wykluczenie szczegółowe nie ukrywa ogólnego; składnik z niewykluczonym zamiennikiem nie blokuje przepisu | „Test wykluczenia na jednym słowie dowodzi, że filtr działa" | Skąd pochodzą słowniki synonimów i odmian; czy filtr działa tak samo na liście i przy doładowaniu kolejnych | unit, tabela przypadków z PRD        | Oczekiwane wartości skopiowane z wyniku implementacji (problem wyroczni); tylko happy path    |
| #2   | Obcy dostaje 401/403 przy edycji i usunięciu cudzego przepisu, autor i admin przechodzą, a w bazie nic się nie zmienia                                                                   | „UI ukrywa przycisk, więc API jest bezpieczne"               | Granica autoryzacji w API i politykach RLS; nadawanie roli admina                                           | integration (API + lokalny Supabase) | Mockowanie Supabase, tak że RLS nie jest testowane; sprawdzanie samego statusu bez stanu bazy |
| #3   | Użytkownik B nie czyta ani nie zapisuje spiżarki użytkownika A (każda operacja, każda rola)                                                                                              | „Filtr po user_id w kodzie wystarczy"                        | Polityki per operacja i rola; gdzie przechowywane są stałe i wykluczenia                                    | integration (RLS na realnej bazie)   | Test pod jednym użytkownikiem; asercja na długość odpowiedzi błędu                            |
| #4   | Przepis z samymi posiadanymi i stałymi składnikami ma 100% i jest wyżej niż częściowe; „mozzarella z pomidorem" = 100%, jajecznica z samego jajka = 33%                                  | „Kolejność wygląda dobrze na kilku przepisach"               | Jak liczony jest % (stałe, zamienniki, 0%); źródło danych testowych                                         | unit                                 | Asercja pochodząca z kodu produkcyjnego; kruche założenie kolejności przy remisach            |
| #5   | Zbyt duże wejście daje 400 z czytelnym kodem, nie 1102; serwer sam waliduje dane i nie ufa klientowi                                                                                     | „Limit w UI wystarczy"                                       | Wspólny limit w API i UI; walidacja przepisu po stronie serwera                                             | unit + integration na endpoincie     | Test tylko z małym wejściem; limit zduplikowany w teście                                      |
| #6   | Brak sesji → 401 dla `/api/*` i przekierowanie dla stron; anon key nie czyta przepisów (najpierw status i typ odpowiedzi, potem treść)                                                   | „Status 200 i długość 4 to wiersze"                          | Reguły middleware i lista ścieżek publicznych; konfiguracja RLS dla anon                                    | integration + istniejący smoke/CI    | Liczenie pól obiektu błędu; sprawdzanie treści przed statusem                                 |
| #7   | Zalogowany użytkownik wpisuje tagi, klika filtry i widzi posortowane kafelki bez wykluczonych, a szczegóły zachowują kontekst listy                                                      | „Testy jednostkowe pokrywają przepływ"                       | Punkt wejścia strony, selektory po rolach, dane seedowe                                                     | e2e (1–2 testy krytycznej ścieżki)   | Asercje na styl i położenie pikseli; e2e tam, gdzie wystarczyłaby integracja                  |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name             | Goal (one line)                                                                                                                                                      | Risks covered | Test types                     | Status        | Change folder                              |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------ | ------------- | ------------------------------------------ |
| 1   | Kontrakt dopasowania   | Udowodnić regułę „ten sam składnik", twardy filtr wykluczeń, ranking i limity wejścia na przypadkach z PRD                                                           | #1, #4, #5    | unit                           | change opened | context/changes/testing-matching-contract/ |
| 2   | Autoryzacja i RLS      | Udowodnić, że obcy nie zmieni ani nie usunie cudzego przepisu, nie zobaczy cudzej spiżarki, a anon nic nie czyta; ocenić, czy kontrole curl w CI przenieść do testów | #2, #3, #6    | integration (lokalny Supabase) | not started   | —                                          |
| 3   | Krytyczny przepływ e2e | Jeden smoke w przeglądarce: tagi → filtry → kafelki → szczegóły                                                                                                      | #7            | e2e                            | not started   | —                                          |
| 4   | Quality-gates wiring   | Utrwalić poziom bazowy w CI: testy integracyjne wymagane w CI, e2e najpierw informacyjne, wymagane po ustabilizowaniu                                                | cross-cutting | gates                          | not started   | —                                          |

**Status vocabulary** (fixed — parser literals): `not started`, `change opened`, `researched`, `planned`, `implementing`, `complete`.

AI-native layer (hook, przegląd wizualny przez model) is deliberately not a rollout phase: cost × signal does not justify it for these risks, and no browser MCP is available in the current session.

## 4. Stack

| Layer         | Tool                                                   | Version | Notes                                                                                                          |
| ------------- | ------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| unit          | Vitest                                                 | ^5.0.4  | Środowisko node; picks up `src/**/*.test.ts` i `scripts/**/*.test.ts`; 20 plików testowych w zakresie projektu |
| integration   | Vitest + lokalny Supabase                              | n/a     | none yet — see Phase 2. CI już startuje lokalny Supabase i sprawdza RLS skryptami curl                         |
| API mocking   | none                                                   | n/a     | Mockować tylko na granicy sieci; wewnętrznych modułów nie                                                      |
| e2e           | none yet — see Phase 3                                 | n/a     | Brak Playwrighta; kandydat: `@playwright/test`                                                                 |
| accessibility | none                                                   | n/a     | Poza zakresem tego rolloutu                                                                                    |
| smoke         | `npm run smoke`                                        | n/a     | Przepływ auth przeciw działającemu serwerowi                                                                   |
| static        | ESLint ^10.10.0, `npx astro check`, `npm run check:ui` | n/a     | Lint, typy, brak literałów kolorów; w CI                                                                       |

**Stack grounding tools (current session):**

- Docs: Context7 — dostępny; nie użyto w tej sesji (strategia, bez konfiguracji narzędzi); checked: 2026-10-20
- Search: Exa — dostępna; nie użyto; checked: 2026-10-20
- Runtime/browser: not available in current session (brak Playwright MCP); checked: 2026-10-20
- Provider/platform: Supabase/Cloudflare MCP not available in current session; checked: 2026-10-20

## 5. Quality Gates

| Gate                              | Where                 | Required?                                            | Catches                                                      |
| --------------------------------- | --------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| lint + check:ui                   | local (husky) + CI    | required (wired)                                     | błędy składni, literały kolorów                              |
| typecheck (`npx astro check`)     | CI                    | required (wired)                                     | dryf typów (lokalnie nie jest uruchamiany automatycznie)     |
| unit (`npm test`)                 | CI (lokalnie ręcznie) | required in CI (wired)                               | regresje logiki                                              |
| RLS/permission checks (curl w CI) | CI                    | required (wired)                                     | dostęp anon, uprawnienia zapisu, edycji, usuwania i spiżarki |
| smoke (`npm run smoke`)           | CI (preview)          | required (wired)                                     | błędy środowiskowe i przepływu auth                          |
| integration (autoryzacja i RLS)   | CI (lokalnie ręcznie) | required after §3 Phase 2                            | obca osoba zmienia dane, anon czyta                          |
| e2e na krytycznym przepływie      | CI on PR              | informational after §3 Phase 3; required once stable | zepsuty przepływ tagi → kafelki                              |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

- **Location**: obok testowanego modułu w `src/lib/<area>/` jako `<module>.test.ts`; skrypty w `scripts/`.
- **Reference test**: TBD — see §3 Phase 1 for the matching-rules pattern (excluded-ingredient, ranking, input-limit).
- **Run locally**: `npm test`.

### 6.2 Adding an integration test

- TBD — see §3 Phase 2 for the authorization/RLS pattern (stranger denied on edit/delete, pantry privacy, anon reads).

### 6.3 Adding an e2e test

- TBD — see §3 Phase 3 for the critical-flow pattern (tags → filters → tiles → details).

### 6.4 Adding a test for a new API endpoint

- TBD — see §3 Phase 2.

### 6.5 Adding a test for a new matching rule

- TBD — see §3 Phase 1.

### 6.6 Per-rollout-phase notes

(Appended after each phase lands.)

## 7. What We Deliberately Don't Test

- **Wygląd i style (snapshoty, testy wizualne)** — obecny wygląd jest tymczasowy i będzie zmieniany; liczy się tylko funkcjonalność. Re-evaluate if styl się ustabilizuje. (Source: Phase 2 interview Q5.)
- **Komponenty shadcn w `src/components/ui/` i kitchen sink** — kod z zewnątrz i narzędzie deweloperskie. Re-evaluate if komponenty dostają własną logikę. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-20
- Stack versions last verified: 2026-10-20
- AI-native tool references last verified: 2026-10-20 (none recommended)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
