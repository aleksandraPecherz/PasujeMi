<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: S-06 Autor edytuje i usuwa swój przepis

- **Plan**: context/changes/author-edits-own-recipe/plan.md
- **Scope**: Full plan (only completed phases)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-18
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 1 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Notes: Phase 4 not reviewed (4.4 — production migration — still unchecked). Re-run now: `npm test` (288 passed), `npm run lint`, `npm run check:ui`, `npx astro check` (0 errors), `npm run build` — all pass. `supabase db reset` and the CI RLS step were not re-run locally (Docker/CI); Progress marks them done.

## Findings

### F1 — match-keys script can overwrite keys reset by a concurrent edit

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/match-keys.ts:42-47
- **Detail**: The script reads `ingredients`, then updates keys with a filter on `id` only. If an author edits ingredients between the read and the write, the new trigger nulls the keys, and the script then writes keys computed from the OLD ingredients with the current version. `matchRecipes` trusts keys when counts match, so an excluded product could slip through until the next edit. Window is small and the script is run manually, but S-06 is what makes concurrent ingredient edits possible.
- **Fix**: Make the write conditional on the ingredients that were read (e.g. also filter on `ingredients` equality), so a concurrent edit makes the update a no-op.
  - Strength: Closes the race at the writer without touching the trigger or the matcher.
  - Tradeoff: jsonb equality filter via PostgREST needs checking; a no-op update is not counted/retried unless handled.
  - Confidence: MED — approach is sound, exact PostgREST syntax unverified.
  - Blind spot: Not tested against local Supabase.
- **Decision**: SKIPPED

### F2 — roadmap.md edited outside the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md
- **Detail**: S-06 status changed to in-progress (2 lines). The plan does not list it and AGENTS.md says not to rewrite `context/foundation/` as a side effect. Harmless status field.
- **Fix**: Keep it (status tracking is the roadmap's purpose) and accept, or revert the two lines.
- **Decision**: SKIPPED

### F3 — Delete/edit UX edge cases

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useDeleteRecipe.ts:14-37
- **Detail**: (a) A 404 on delete shows an error and keeps the dialog open, though the end state is "deleted" (e.g. retry after a lost response). (b) `location.assign` after delete/edit leaves the old page in history, so Back after delete lands on a 404 (plan already accepts this).
- **Fix**: Treat delete 404 as success and use `location.replace`.
- **Decision**: FIXED via Fix now (delete 404 treated as success; `location.replace` in useDeleteRecipe.ts and useRecipeForm.ts; lint and 288 tests pass)
