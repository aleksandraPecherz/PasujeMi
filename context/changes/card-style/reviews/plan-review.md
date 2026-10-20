<!-- PLAN-REVIEW-REPORT -->
# Plan Review: card-style (#21): karta neo-brutal i Banner na tokenach

- **Plan**: context/changes/card-style/plan.md
- **Mode**: Deep
- **Date**: 2026-10-20
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding
12/12 paths ✓ (ui/card.tsx new as planned), 7/8 symbols ✓ (ButtonProps ✗), brief↔plan ✓, Progress↔Phase ✓.
Tailwind 4.3.3 compile: `translate-x-0.75` → `calc(var(--spacing) * 0.75)` ✓; `shadow-brutal` → `var(--tw-shadow-color, var(--foreground))` and combines with the ring shadow ✓. Banner contrast 4.77 / 5.14 matches tokens.md ✓.

## Findings

### F1 — The ButtonProps type doesn't exist

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — #2 SubmitButton
- **Detail**: The contract used `ButtonProps["variant"]`, but `ui/button.tsx` exports only `Button` and `buttonVariants`.
- **Fix**: `variant?: React.ComponentProps<typeof Button>["variant"]`, no new export from ui/.
- **Decision**: FIXED

### F2 — The "default" card variant is hardcoded to an upstream version

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — #2 Karta
- **Detail**: The plan listed upstream classes, but `npx shadcn@latest add card` (4.22.1) may generate a different card.tsx.
- **Fix**: The source of truth is the generated file: look → `default`, the rest → `Card` layout.
- **Decision**: FIXED

### F3 — Wrong reason given for class order in cn on the tile

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details
- **Detail**: tailwind-merge doesn't merge `border-foreground` with `hover:border-ring` (different modifiers); the real risk is classes without a modifier after the variant.
- **Fix**: Rewrote the rationale: after the variant, no `rounded-*`/`border`/`border-*`/`bg-*` without a modifier.
- **Decision**: FIXED
