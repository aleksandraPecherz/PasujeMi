<!-- PLAN-REVIEW-REPORT -->
# Plan Review: F-02 seed-recipe-import

- **Plan**: context/changes/seed-recipe-import/plan.md
- **Mode**: Deep
- **Date**: 2026-10-18
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
9/9 paths ✓, 8/8 symbols ✓, brief↔plan ✓

## Findings

### F1 — Unexpected number cells silently become null

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §2 Skrypt — "Odczyt"
- **Detail**: Numbers came only from a `cell.value` of type `number`; anything else became `null`. The validator accepts `null` for czas/porcje/kcal/macros (`validate.ts`, optionalNumber), so a number stored as text or a formula cell would pass as "no data" with no error. With porcje = null the kcal conversion would also be skipped.
- **Fix**: null only for an empty cell; formula → its numeric `result`; any other value → `string` in `RawRecipeRow`, which the parser turns into a blocking issue; unit test added.
- **Decision**: FIXED

### F2 — Name skip also counts other users' recipes

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §2 "Istniejące nazwy"; Phase 3 §2 production step (4)–(5)
- **Detail**: Existing names come from every recipe, including S-05 recipes from other users; a same-named recipe on production would hide the author's version, and the procedure didn't say what to do when `skipped > 0`.
- **Fix**: Production step (4): the skipped list must be empty; otherwise stop before writing and explain each item.
- **Decision**: FIXED

### F3 — Phase 3 "Automated" rows need the author's machine

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Success Criteria / Progress 3.1–3.4
- **Detail**: 3.1–3.4 need the local xlsx, Supabase in Docker and an author account; `/10x-goal-implement` runs `#### Automated` rows with no human present.
- **Fix**: 3.1–3.4 moved to Manual (Phase 3 block and Progress), titles and numbers unchanged.
- **Decision**: FIXED
