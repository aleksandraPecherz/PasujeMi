<!-- PLAN-REVIEW-REPORT -->
# Plan Review: S-05 Ręczne dodawanie przepisu

- **Plan**: context/changes/add-recipe/plan.md
- **Mode**: Deep
- **Date**: 2026-10-17
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding
7/7 paths ✓, 7/7 symbols ✓, brief↔plan ✓, Progress↔Phase ✓

## Findings

### F1 — Kitchen sink wymaga widoku formularza, którego plan nie definiuje

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — #3 Wyspa formularza, #5 Kitchen sink
- **Detail**: `RecipeForm` sam woła `useRecipeForm` i nie przyjmuje propsów, więc kitchen sink nie wyrenderuje stanów `submitting`, błędów pól ani błędu serwera. W repo hook siedzi w `PantryMatch`, a kitchen sink renderuje tylko bezstanowe `PantryStates.tsx`.
- **Fix**: Rozdzielić `RecipeForm` (hook + widok) od bezstanowego `RecipeFormView`. Kitchen sink renderuje `RecipeFormView` i `RecipeSaved`, a nowy plik dochodzi do `CLEAN_FILES`.
  - Strength: Ten sam podział co w spiżarce. Stany da się pokazać bez mockowania `fetch`.
  - Tradeoff: Jeden plik i jeden interfejs propsów więcej.
  - Confidence: HIGH — KitchenSink.tsx importuje dziś tylko bezstanowe części.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — `ghost-current` nie oznacza „bieżącej strony”

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 — #4 Strona i nawigacja
- **Detail**: `ghost-current` to `hover:bg-current/20 focus-visible:ring-current` (button.tsx:19), czyli przycisk w `currentColor`, używany w TagInput.tsx:68. Bez hovera link nie jest wyróżniony, więc sprawdzenie ręczne 4.9 nie przejdzie.
- **Fix**: Nowy wariant `nav-current` (`bg-accent text-accent-foreground`) w `ui/button.tsx` i w kitchen sink, użyty w nagłówku z `aria-current="page"`.
- **Decision**: FIXED

### F3 — Sprawdzenie Content-Type opisane jako „brak application/json”

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — #2 Handler, krok 1
- **Detail**: `includes("application/json")` przepuściłoby `text/plain; x=application/json`, a ten typ przeglądarka wysyła cross-site bez preflightu. Sprawdzenie 415 chroni też przed CSRF. Dziś ryzyko jest małe, bo ciasteczka sesji mają SameSite=Lax.
- **Fix**: Porównywać typ MIME bez parametrów (`split(";")[0].trim().toLowerCase() === "application/json"`).
- **Decision**: FIXED
