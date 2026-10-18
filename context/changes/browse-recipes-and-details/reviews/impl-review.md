<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Browse recipes and details

- **Plan**: context/changes/browse-recipes-and-details/plan.md
- **Scope**: Full plan (3 of 3 phases)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-18
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated: `npm test` (195 passed), `npm run lint`, `npx astro check` (0 errors), `npm run check:ui`, `npm run build` all pass. `npm run smoke` not re-run (needs a running server + Supabase); it was marked done in dbe3433.

## Findings

### F1 — List snapshot survives sign-out in the same tab

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/list-state.ts:15, src/components/hooks/usePantryMatch.ts (save on pagehide)
- **Detail**: Pantry tags ("mam", "stałe", "wykluczam") are private (AGENTS.md, PRD FR-003: session-only). The snapshot lives in per-tab sessionStorage under a fixed key and is not cleared on sign-out. After sign-out and a different user's sign-in in the same tab, `/` restores the previous user's tags and filters.
- **Fix**: Call `clearSnapshot()` in the sign-out flow (or store the user id in the snapshot and ignore a mismatch).
  - Strength: Small change; keeps pantry data session-bound as the PRD requires.
  - Tradeoff: Needs the sign-out handler (or user id) to reach the client code.
  - Confidence: MED — haven't traced the sign-out path.
  - Blind spot: Sign-out may be a full-page POST/redirect with no client hook.
- **Decision**: FIXED — Fix now

### F2 — `history.scrollRestoration = "manual"` is never reset

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/pantry/PantryMatch.tsx:60
- **Detail**: Set once on restore and left in place, so later reloads of `/` lose the browser's native scroll restoration (the snapshot covers it only when one exists).
- **Fix**: Restore the previous value in the effect cleanup after `scrollTo`, or accept as is.
- **Decision**: FIXED — Fix now

### F3 — Error card duplicated in `[id].astro`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/recipes/[id].astro:36-43
- **Detail**: The 500/503 branch (not in the plan's detail beyond "status 500 z polskim komunikatem") hand-rolls the same card markup as `NotFoundView` and uses a plain link instead of `buttonVariants`, so the two screens drift visually.
- **Fix**: Let `NotFoundView` take a title/body, or reuse its markup for the error branch.
- **Decision**: FIXED — Fix now
