<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Licznik przepisów na liście dopasowań (issue #24)

- **Plan**: context/changes/recipe-count/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-17
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Automated checks rerun on HEAD c602feb: `npm test` (116 passed), `npm run check:ui`, `npm run lint`,
`npx astro check` (0 errors), `npm run build` all pass.

## Findings

### F1 — `count: "exact"` can turn an out-of-range page into a 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/recipes.ts:57
- **Detail**: When the request asks for an exact count, PostgREST knows the total and answers a range that starts past it with 416 / PGRST103 ("invalid range", PostgREST errors table). Without a count it returned 200 with an empty array. `listRecipes` throws on `error`, so `GET /api/recipes?offset=<past the end>` now returns 500 `database_error`, and "Pokaż więcej" shows the error if the catalog shrank by 2+ recipes between pages. Rare in practice, but the endpoint's behavior changed and no test covers it. Verdict PLAUSIBLE: the strict `offset > total` condition comes from PostgREST's range handling and was not reproduced against local Supabase.
- **Fix**: In `listRecipes`, treat `error.code === "PGRST103"` as an empty last page (`{ recipes: [], hasMore: false, total: null }`), and add a fake-client case for it.
  - Strength: Restores the old empty-page contract at the single place that requests the count; the client already hides the counter for `null`.
  - Tradeoff: Adds a PostgREST-specific error code to the service; a few lines plus one test.
  - Confidence: MED — PGRST103/416 is documented; the exact boundary (`>` vs `>=`) is from memory.
  - Blind spot: Not reproduced with `curl` against local Supabase (`/rest/v1/recipes?offset=999` + `Prefer: count=exact`).
- **Decision**: FIXED — `listRecipes` maps PGRST103 to `{ recipes: [], hasMore: false, total: null }`; the fake client raises PGRST103 for a counted range past the total, with a new `listRecipes` test.

### F2 — Manual checks 2.6–2.9 are ticked without being run as written

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/recipe-count/plan.md (Progress 2.6–2.9)
- **Detail**: `change.md` Notes say 2.7–2.9 were not clicked on `/` (production has no recipes), and 2.6 was checked in the dark theme only. Smoke covers the number in `total` (2.7) but not the view behavior: `reloading` hiding the counter on "Zastosuj filtry" and keeping it on "Pokaż więcej" (2.8, 2.9) has no test (the plan declined a hook test) and no manual run. That is the one piece of new client logic.
- **Fix**: Run `npm run dev` against local Supabase with the seed (5 recipes; use the dev tools network throttle so loading is visible) and click through 2.8 and 2.9; if that is not possible now, untick 2.8–2.9 and record them as pending in `change.md`.
  - Strength: Verifies the only untested logic before archive; the seed already exists from smoke.
  - Tradeoff: 2.9 needs more than one page: with PAGE_SIZE above 5, temporarily lower it or add rows locally.
  - Confidence: HIGH — the gap is stated in `change.md` itself.
  - Blind spot: The light theme (2.6) may not be reachable at all until #22; that part can stay deferred.
- **Decision**: FIXED (differently) — 2.8 and 2.9 unticked in plan Progress; `change.md` Notes record them as manual checks on `/` after the recipe import (F-02), since production has no recipes and local Supabase is not run.

### F3 — Counter value is not announced to screen readers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/pantry/PantryMatch.tsx:103,115
- **Detail**: The status region says "Wczytywanie przepisów…" and then goes empty; the new count appears in a plain `<p>`, so a screen reader user gets no result after applying filters. Not required by the plan.
- **Fix**: Put `recipeCountLabel(total)` into the existing `role="status"` region when loading ends (or leave it for #22).
- **Decision**: FIXED — the `role="status"` region shows `recipeCountLabel(total)` after loading when the list has recipes and the count is known.
