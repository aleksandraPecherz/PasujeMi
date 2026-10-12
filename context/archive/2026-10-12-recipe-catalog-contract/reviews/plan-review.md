<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Minimalny kontrakt danych przepisu (F-01)

- **Plan**: context/changes/recipe-catalog-contract/plan.md
- **Mode**: Deep
- **Date**: 2026-10-12
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | PASS    |

## Grounding

7/7 paths ✓, 4/4 symbols ✓ (`createClient`, `PUBLIC_PREFIXES`, `sql_paths`, `request()`), brief↔plan ✓. Codebase checks done inline (small repo): CI runs on `pull_request` to `master`; `supabase/.temp` already ignored by `supabase/.gitignore`.

## Findings

### F1 — Migration and endpoint first run on production

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 → Phase 2
- **Detail**: No local Supabase and CI runs only after a push, so the migration SQL would first execute in `db push` on production and the signed-in `GET /api/recipes` would first be exercised against production. Phase 1's API gate (signed-out → 401) was already true via the S-01 middleware.
- **Fix A ⭐ Recommended**: Phase 1 adds a signed-in `GET /api/recipes` smoke step and ends with a branch + PR to `master`; `db push` only after green CI on the PR; Phase 2 merges the PR.
  - Strength: `supabase start` in CI applies the migration to a clean DB and smoke tests the endpoint before production.
  - Tradeoff: Extra branch/PR step and waiting for CI before `db push`.
  - Confidence: HIGH — ci.yml has `pull_request: branches: [master]`.
  - Blind spot: Cloudflare "non-production branch builds" setting unverified (deploy-plan l. 166); if on, it only uploads a version.
- **Fix B**: Rely on the `db push` transaction.
  - Strength: No flow change.
  - Tradeoff: Logical RLS/endpoint errors surface only on production.
  - Confidence: MED.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A)

### F2 — RLS for the anon key is never checked against real data

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 (2.2), Phase 3 (smoke), Desired End State
- **Detail**: 2.2 checked anon REST against an empty production table (would pass without RLS); smoke only checks the app-level 401 from middleware.
- **Fix**: CI step after `supabase start`: service role sees the 5 seeded recipes, anon key gets none; 2.2 reworded to "table exists on production".
- **Decision**: FIXED

### F3 — The migration relies on default privileges for authenticated

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1, item 1
- **Detail**: Access depended on the project's default GRANTs, which can differ between production and local/CI.
- **Fix**: Explicit `revoke all … from anon, authenticated` + `grant select … to authenticated` in the migration; anon checks (2.2, 3.5) now expect a permission error instead of `[]`.
- **Decision**: FIXED

### F4 — "Kształt pilnują CHECK-i" overclaims what the database enforces

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Implementation Approach; Phase 1, item 1
- **Detail**: CHECK can enforce a non-empty array, not the element shape.
- **Fix**: State the validation boundary in the plan and the contract document (DB = array; element shape = TS types + S-05 / F-02 write validation).
- **Decision**: FIXED

### F5 — `getRecipe` has no user in F-01

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1, item 3
- **Detail**: No endpoint, page or check uses it in F-01.
- **Fix**: Removed from F-01; S-02 adds it with the detail view.
- **Decision**: FIXED
