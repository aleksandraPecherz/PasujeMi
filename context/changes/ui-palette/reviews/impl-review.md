<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Paleta „oliwka”

- **Plan**: context/changes/ui-palette/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-17
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Dark destructive hover never applies

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/button.tsx:13
- **Detail**: `dark:bg-destructive/45` comes after `hover:bg-destructive/90` in the built CSS with the same specificity, so in dark mode the destructive button has no hover change. This is inherited from upstream shadcn (it was the same with `/60`), and no view uses `Button variant="destructive"` today. Note: a working `/90` hover on the new light dark-mode `--destructive` (L 0.80) would put white text at about 2:1.
- **Fix**: None now; when a destructive Button is first used, design its dark-mode hover against the contrast table in tokens.md.
- **Decision**: ACCEPTED — no code change; design the dark-mode hover when a destructive Button is first used

### F2 — Light palette not visually verified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/layouts/Layout.astro:14
- **Detail**: `<html class="dark">` is hard-coded, so the new `:root` values are unreachable and only `.dark` appears in the screenshots. The light values are backed only by the contrast table in tokens.md. This is consistent with "What We're NOT Doing" (no light-theme switch).
- **Fix**: Check the light theme visually in the change that enables theme switching.
- **Decision**: SKIPPED — covered by issue #22 (theme switch)

### F3 — Stale contrast value in paleta-oliwka.md

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/ui-palette/paleta-oliwka.md:114
- **Detail**: The palette spec gives dark `muted-foreground` on `background` as 5.8. tokens.md:68 says 6.09, and recomputing oklch(0.78 0.017 73.6) against oklch(0.3303 0.0214 88.0737) confirms 6.09. Both pass 4.5, and tokens.md is the register AGENTS.md will point to.
- **Fix**: Correct 5,8 → 6,09 in paleta-oliwka.md, or leave it, since tokens.md is authoritative.
- **Decision**: FIXED — 5,8 → 6,09 in paleta-oliwka.md:114
