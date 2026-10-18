<!-- PLAN-REVIEW-REPORT -->

# Plan Review: S-04: zapamiętane produkty stałe i wykluczenia

- **Plan**: context/changes/remembered-staples-exclusions/plan.md
- **Mode**: Deep
- **Date**: 2026-10-18
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 1 critical, 3 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | FAIL    |

## Grounding

13/13 paths ✓, 8/8 symbols ✓, brief↔plan ✓, 1 stale line ref (F6)

## Findings

### F1 — Smoke userId regex can't match Astro's prop format

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 — #4 Smoke
- **Detail**: Astro 7.3.2 serializes a string prop as `[0, value]` (`node_modules/astro/dist/runtime/server/serialize.js`, `PROP_TYPE.Value = 0`), so the HTML has `userId&quot;:[0,&quot;<uuid>`. The regex `userId[^0-9a-f]{1,40}([0-9a-f-]{36})` can't step over the "0", so it never matches.
- **Fix**: A regex that matches the UUID shape: `/userId.{0,40}?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/`.
- **Decision**: FIXED

### F2 — Invalid saved row is silently wiped on the next edit

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 1 #4 (getSavedPantry), Faza 3 #3
- **Detail**: A row that fails `parseSavedPantry` became `EMPTY_SAVED` with no log. Saving stayed on, so the first edit overwrote the row. A later limit change would then silently erase exclusions (allergies).
- **Fix A ⭐ Recommended**: An invalid row is treated as a failed read (`console.error` + `null`, saving off, notice shown).
  - Strength: Nothing is deleted silently; reuses an existing path.
  - Tradeoff: The user can't save until the data or code is fixed.
  - Confidence: HIGH — the path already exists in the plan.
  - Blind spot: Needs a test.
- **Fix B**: Empty lists + log + notice.
  - Strength: The user keeps working.
  - Tradeoff: The data is still lost, just visibly.
  - Confidence: MED
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A)

### F3 — Phase 2 passes props that PantryMatch doesn't accept yet

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 #3 vs Faza 3 #4
- **Detail**: `index.astro` passes `userId`/`saved` in Faza 2, but `PantryMatch()` (PantryMatch.tsx:33) takes no props until Faza 3, so `npx astro check` (2.1) would fail.
- **Fix**: The `PantryMatchProps` type moves to Faza 2 #3; Faza 3 #4 only passes the props to the hook.
- **Decision**: FIXED

### F4 — Word-limit test with 61 one-word tags is impossible

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 2 #4 (smoke), Faza 1 #3 (test 60/61)
- **Detail**: 2 × 30 tags = 60 at most. Sending 30 + 31 trips `MAX_TAGS` with the same `invalid_pantry` code, so the step passes for the wrong reason.
- **Fix**: Unique multi-word tags (`ser żółty ${i}` × 30 = 60 words + `exclude: ["orzechy"]` = 61).
- **Decision**: FIXED

### F5 — Restore can show a list without an exclusion from the DB

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 3 #3 (restore)
- **Detail**: `applied` comes from the snapshot. An exclusion added in another tab is visible as a tag, but the restored list is filtered without it.
- **Fix**: A pure `missesSavedExclusion(applied, saved)` in `list-state.ts`; when it returns true, the snapshot is skipped and the start is fresh from `initialFilters(saved)`.
- **Decision**: FIXED

### F6 — Stale line reference to the endpoint pattern

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis, References
- **Detail**: `src/pages/api/recipes/index.ts:101-174` — the file ends at ~109.
- **Fix**: Changed to `:59-109`.
- **Decision**: FIXED
