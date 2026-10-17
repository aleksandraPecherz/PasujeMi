<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Paleta „oliwka” — plan implementacji

- **Plan**: context/changes/ui-palette/plan.md
- **Mode**: Deep (weryfikacja inline)
- **Date**: 2026-10-17
- **Verdict**: REVISE → SOUND po poprawkach
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

10/10 ścieżek ✓, 9/9 odwołań file:line ✓, brief↔plan ✓, Progress↔Faza ✓. Kontrast przeliczony (oklch→sRGB): wszystkie liczby z planu się zgadzają.

## Findings

### F1 — Pierścień fokusu × poniżej 3:1 na tagach (ciemny)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 2 §2 (`ghost-current`), Faza 1 §3 (tabela kontrastu)
- **Detail**: × dziedziczy `focus-visible:ring-ring`. Oliwkowy `--ring` na tagach w ciemnym motywie: „mam” 2,77, „stałe” 2,84, „wykluczam” 3,17:1. Ta sama klasa błędu co F2 w `ui-pantry-tokens` (`tokens.md:91`). Para nie była w tabeli obowiązkowych par.
- **Fix A ⭐ Recommended**: `focus-visible:ring-current` w `ghost-current` + para ring/tag w tabeli (4,79–6,01:1). Sprawdzone: twMerge usuwa `ring-ring`, a Tailwind 4.3.3 generuje `--tw-ring-color: currentcolor`.
- **Fix B**: globalna zmiana `--ring`.
- **Decision**: FIXED (Fix A)

### F2 — Zrzuty: brak narzędzia i nieprecyzyjne kryterium 3.1

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1 §1, Faza 3 §1, kryterium 3.1
- **Detail**: Plan nie wskazywał narzędzia do zrzutu samego `<main>`. W poprzedniej zmianie pełne zrzuty `localhost_4321_*.png` (także `/` z nagłówkiem) trafiły do repozytorium. `git status --porcelain` pokazuje też pliki nieśledzone.
- **Fix**: DevTools („Capture node screenshot” na `<main>`), pełne zrzuty robocze poza repozytorium, kryterium 3.1 sprawdza `git diff --cached` i `git ls-files`.
- **Decision**: FIXED

### F3 — Hover × z currentcolor da się sprawdzić automatycznie

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2, kryterium 2.9; brief „Open Risks”
- **Detail**: Tailwind 4.3.3 kompiluje `hover:bg-current/20` do `color-mix(in oklab, currentcolor 20%, transparent)`.
- **Fix**: nowe kryterium automatyczne 2.9 (grep po `dist/`), ręczne przenumerowane na 2.10–2.11, ryzyko w briefie zaktualizowane.
- **Decision**: FIXED
