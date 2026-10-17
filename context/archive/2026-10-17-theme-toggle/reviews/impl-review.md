<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Przełącznik jasny/ciemny motyw

- **Plan**: context/changes/theme-toggle/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-18
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 1 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Automated checks re-run on HEAD (65034eb): `npm run check:ui`, `npm run lint`, `npx astro check` (0 errors/warnings/hints), `npm test` (135 passed), `npm run build` — all green; `rg 'class="dark"' src` — 0 hits.

## Findings

### F1 — Auth-page screenshots missing, although 3.12 is ticked

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/theme-toggle/screenshots/
- **Detail**: Plan (Phase 3 §5, item 3.12) requires one screenshot per mode for kitchen sink, `/auth/signin`, `/auth/signup` and `/auth/confirm-email` (8 files, in `{light,dark}/`). The folder holds only `localhost_4322_dev_kitchen-sink_{light,dark}.png`, flat. Item 3.12 is `[x]` without evidence for the three auth pages.
- **Fix**: Capture the 6 missing auth screenshots (light + dark), or amend the plan/Progress note to say auth pages were verified manually only.
- **Decision**: FIXED — amended plan addendum (auth screenshots verified manually only)

### F2 — Autofill override added to ui/input.tsx, outside plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/components/ui/input.tsx:13-14
- **Detail**: "What We're NOT Doing" excludes changes in `src/components/ui/`, and the plan states `ui/input.tsx` already has everything needed. Commit 67b558c adds an `autofill:` rule with an inset box-shadow (a hack for Chrome's UA background) and an arbitrary value `shadow-[inset_0_0_0_1000px_...]`. `ui/` is not scanned by `check:ui`. The shadow uses `--background`, but the auth form sits on `bg-card`, so an autofilled field will have a different fill than a normal one.
- **Fix A ⭐ Recommended**: Keep it and document it as an addendum in the plan.
  - Strength: Autofill on a login form is a real contrast problem in light/dark; the change is tokens-only.
  - Tradeoff: Plan becomes a slightly moving target; the fill differs subtly from `bg-card`.
  - Confidence: MED — not verified visually in both modes here.
  - Blind spot: Autofill look in Firefox/Safari not checked.
- **Fix B**: Remove it and handle autofill in a follow-up.
  - Strength: Keeps `ui/` identical to upstream and the plan's boundary strict.
  - Tradeoff: Autofilled fields may show a UA-coloured background in one mode.
  - Confidence: MED — depends on how bad the autofill looks without it.
  - Blind spot: Haven't reproduced the unpatched behaviour.
- **Decision**: FIXED via Fix A — kept autofill rule, documented in plan addenda

### F3 — Auth links use text-foreground + underline instead of text-primary

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/auth/signin.astro:23, signup.astro, confirm-email.astro
- **Detail**: The Phase 1 contract maps `text-purple-300` → `text-primary`; the implementation uses `text-foreground underline hover:no-underline` (likely a contrast decision). Item 3.11 still lists `text-primary` on `bg-card` as checked, though no auth text uses it now.
- **Fix**: Note the deviation in the plan (links: `text-foreground` + underline) so the contract and 3.11 match the code.
- **Decision**: FIXED — deviation noted in plan addenda
