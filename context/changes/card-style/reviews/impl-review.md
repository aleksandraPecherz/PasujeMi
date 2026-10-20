<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: card-style (#21): karta neo-brutal i Banner na tokenach

- **Plan**: context/changes/card-style/plan.md
- **Scope**: Full plan (phase 4 has step 4.6 smoke still pending, reviewed as implemented)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-20
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — cn() does not know shadow-brutal tokens

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/utils.ts:5 (affects src/components/ui/card.tsx, button.tsx)
- **Detail**: `cn()` is plain `twMerge`. Checked in the repo: `twMerge("shadow-brutal shadow-none")` returns both classes (shadow not removed), and `twMerge("shadow-brutal text-red-500 shadow-brutal-sm")` drops `shadow-brutal`. No current call site is affected, but `cn(cardVariants({variant:"brutal"}), "shadow-none")` would silently not work.
- **Fix**: Use `extendTailwindMerge({ extend: { classGroups: { shadow: [{ shadow: ["brutal", "brutal-sm"] }] } } })` in `cn`, and add one test in `src/lib/utils.test.ts`.
- **Decision**: SKIPPED

### F2 — Smoke test (4.6) not yet run

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 4.6
- **Detail**: `npm run smoke` was skipped locally (`.dev.vars` points at production, local override via `.env` did not take effect). Step 4.6 is still `[ ]`; check/lint/astro check/tests/build were re-run in this review and pass. Also not verified by hand: 2.6 (banner with empty SUPABASE_URL), reduced motion in 4.8, RecipeSaved only in kitchen sink (3.7).
- **Fix**: Tick 4.6 only after the CI `smoke` job on PR #40 is green.
- **Decision**: FIXED (CI smoke green on PR #40, step 4.6 ticked)

### F3 — Focus ring radius on the tile is ~2px off the inner border radius

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/recipes/RecipeTile.tsx:61
- **Detail**: The `after:` pseudo-element is positioned against the padding box (inside `border-2`), so its radius should be the card radius minus 2px (`rounded-md`), not `rounded-lg`. The ring is still visible at the corners (3.6 confirmed by hand), so this is cosmetic. The plan chose `after:rounded-lg`.
- **Fix**: `after:rounded-md`.
- **Decision**: FIXED (after:rounded-md)

### F4 — pressable focus ring covers the hard shadow

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/button.tsx:22-23
- **Detail**: Base `focus-visible:ring-[3px]` and `shadow-brutal-sm` (3px) share `box-shadow`; the ring is painted over the shadow, so a focused button loses its visible shadow (reviewer read this from code; only the kitchen sink can confirm). Focus stays clearly visible. Related, already noted in the plan: size `sm`/`lg` set `rounded-md` after the variant and override `pressable`'s `rounded-lg`; no call site uses them.
- **Fix**: Check Tab on the kitchen-sink pressable button; if the look is unwanted, add `focus-visible:ring-offset-2` to `pressable`. Otherwise accept.
- **Decision**: FIXED (outline instead of ring on pressable; ring-offset would not keep the shadow)

### F5 — Auth cards in kitchen sink are cramped at md width

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/dev/KitchenSink.tsx:468-492
- **Detail**: `md:grid-cols-3` columns now hold `bg-cosmic p-6` + brutal card `p-8` (~88px of padding per column), so the forms are narrow at md widths. Dev-only page.
- **Fix**: Use `lg:grid-cols-3` instead of `md:grid-cols-3`.
- **Decision**: FIXED (lg:grid-cols-3)
