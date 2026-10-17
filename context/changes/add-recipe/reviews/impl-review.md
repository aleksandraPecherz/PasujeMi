<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-05 Ręczne dodawanie przepisu

- **Plan**: context/changes/add-recipe/plan.md
- **Scope**: Full plan (Phases 1–4 of 4)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated checks re-run locally: `npm test` (146 passed), `npm run lint`, `npm run check:ui`, `npx astro check` (0 errors), `npm run build` — all pass. `db reset`, CI `smoke` job and local `npm run smoke` were not re-run in this review (need Supabase/running server). Manual items 1.4, 3.6, 3.7, 4.6–4.10 are ticked in Progress with phase commit SHAs; no contradicting evidence in the diff.

## Findings

### F1 — User-created recipes always fall back to per-request key computation, with no cap on inserts

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architecture
- **Location**: supabase/migrations/20261017120000_add_recipe_author_and_insert.sql:21-23; src/lib/services/recipes.ts (matchRecipes stale-key path)
- **Detail**: Decision 3 keeps `match_keys` null for user inserts. Every `/api/recipes/match` call then re-fetches those rows and runs `computeMatchKeys` in-request. Each recipe may have 40 ingredients x 6 options, and any signed-in user can script unlimited POSTs, so the shared CPU cost grows with user data on a 10 ms Workers budget. This is the plan's accepted trade-off (Performance Considerations), but it conflicts with the lesson "Bound user-driven CPU work per request" because the bound now depends on shared, user-growable data.
- **Fix A ⭐ Recommended**: Cap recomputed rows per request in `matchRecipes` and add a per-author insert cap (trigger or count check in `createRecipe`).
  - Strength: Keeps decision 3 and the RLS model; bounds worst-case CPU regardless of how many rows exist.
  - Tradeoff: Rows over the cap are skipped or matched late until `npm run match-keys` runs; needs a product decision on the cap value.
  - Confidence: MED — depends on real per-recipe `computeMatchKeys` cost (`npm run bench:match` not run here).
  - Blind spot: Actual CPU numbers; whether the cap affects match totals visible to users.
- **Fix B**: Persist keys at insert via a server-side path (service role or security-definer function).
  - Strength: Removes the fallback cost for new rows entirely.
  - Tradeoff: Reverses decision 3, requires a service-role key in the request path or a DB function duplicating key logic.
  - Confidence: LOW — larger design change than the plan allows.
  - Blind spot: Service-role exposure in the Worker.
- **Decision**: FIXED via Fix A (modified): only a per-request cap `MAX_RECOMPUTED_RECIPES = 200` in limits.ts, no per-author insert cap; test added; recorded as decision 9 in plan.md; value to be verified in #19.

### F2 — Body size limit can be bypassed with chunked requests

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/recipes/index.ts:47-55
- **Detail**: The first 413 check relies on `Content-Length`. Without that header (chunked), `Number(null)` is 0 and `request.text()` buffers the whole body before the byte-length check. The plan specified exactly this order, so it matches the plan, but the plan's intent (limit before parsing) is only met for requests that declare their length.
- **Fix**: Read `request.body` with a stream reader that aborts once the byte count exceeds `MAX_RECIPE_BODY_BYTES`.
  - Strength: Enforces the limit for all requests, not just those with Content-Length.
  - Tradeoff: ~15 lines of stream code instead of `request.text()`.
  - Confidence: MED — Cloudflare may cap request size upstream; not verified.
  - Blind spot: Platform-level body limits on the deployed Worker.
- **Decision**: FIXED via Fix — `readTextWithLimit` stream reader in src/pages/api/recipes/index.ts (lint, astro check, tests pass; not exercised against a running server).

### F3 — CI step requires exact 401/403 where the neighbouring step accepts either

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:82-92
- **Detail**: Exact statuses follow the plan's Critical Implementation Details, but the existing anon step tolerates 401 or 403, so a PostgREST/CLI upgrade could fail this step for a non-bug reason.
- **Fix**: Accept 401 or 403 for the anon case; keep `code == "42501"` asserted.
- **Decision**: FIXED — anon case accepts 401 or 403 (`expect_denied` takes a list of statuses); `code == "42501"` still asserted. Changed from initial triage.

### F4 — CI has no positive insert case

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: .github/workflows/ci.yml:57-93
- **Detail**: The RLS step covers only denials; a broken grant/policy that rejected valid inserts would be caught only by the smoke step "signed-in user adds a recipe". The plan chose denial-only to keep row counts stable.
- **Fix**: Optionally add a 201 case for user A and delete the row via service role before the `length == 5` check. Smoke already covers the happy path, so skipping is reasonable.
- **Decision**: SKIPPED — smoke covers the happy path.

### F5 — Double-submit guard reads a render-closure state

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useRecipeForm.ts:271
- **Detail**: `status === "submitting"` is read from the closure, so two events fired before re-render can both pass; the button is `disabled`, which covers normal use. Retry after a network error where the server did save creates a duplicate (duplicate detection is out of scope per plan).
- **Fix**: Add a `useRef` in-flight flag set at the start of `submit`.
- **Decision**: FIXED — `submittingRef` in-flight flag in useRecipeForm.ts, reset in `finally`. Changed from initial triage.

### F6 — Array-level form errors are not focusable or linked to a control

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/recipes/RecipeForm.tsx:334-339; RecipeFormView.tsx:98,128; IngredientFields.tsx:426
- **Detail**: Focus-on-first-error uses `[aria-invalid="true"]`, so errors on `ingredients`, `steps`, substitutes and `kinds` neither move focus nor are tied to a control via `aria-describedby`. The UI limits make these errors practically unreachable from the form (only server-only), so low risk. Minor unplanned behaviours also noted and judged harmless: clearing `product` re-enables auto-sync (useRecipeForm.ts:180), errors cleared on edit, `RecipeSaved` `autoFocus` prop, trailing-slash normalisation in AppHeader.
- **Fix**: Render array-level messages with an id and `role="alert"`, or focus the section container when no `aria-invalid` field exists.
- **Decision**: SKIPPED — unreachable from the UI.
