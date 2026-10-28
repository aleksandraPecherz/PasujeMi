---
change_id: soft-modern-recipe-details
title: Soft Modern recipe details
status: archived
created: 2026-10-28
updated: 2026-10-28
archived_at: 2026-10-28T21:33:45Z
---

## Notes

#62: new Soft Modern layout of the recipe details page (mockups M11, M12a, M12b, M18, D03 in `.tmp-style-review/`, reference only). No database, recipe form or dependency changes; `canManage`, RLS and `useDeleteRecipe` stay as they are.

Decisions:

- Illustration ~192 px on desktop, compact strip on phone.
- Steps are numbered from the existing `recipe.steps`, no text processing.
- Phone actions: native popover (Popover API, pattern from `AppHeader`) with an "Edytuj" link and a "Usuń" button; Esc, outside click and Tab work natively. No `role="menu"`, no `dropdown-menu`. The popover closes before the delete confirmation opens.
- `AlertDialog` is used only for the delete confirmation; the global `alert-dialog.tsx` changes only when unavoidable.
- `formatNutrition` is not split by parsing strings: numeric values and explicit units are used.
- `NotFoundView` keeps its texts and behaviour per state; only the look changes.

Order of work:

1. Author actions (phone popover, desktop buttons) and the delete confirmation look. <- first step
2. `NotFoundView` look.
3. `RecipeDetails`: illustration, pills, nutrition tiles, ingredients, numbered steps, single back link; `[id].astro`.
4. Kitchen sink states.

- Before M-2 is closed, all changed views are compared together with the mockups. "Looks good" is not conformance with the design: every significant difference is either fixed or explicitly accepted by the author.

## Result

Phases 1-4 implemented and committed locally (ff84a6b, 5ef7230, aaf34ef, 8ef4e2e). Lint, check:ui and astro check pass; format tests pass. Author accepted: author actions and delete confirmation (p1), NotFoundView (p2), details look after the phone correction (p3), kitchen sink (p4).

Deferred to the collective M-2 verification (not done, left unchecked on purpose): Progress 4.5 (320 px and 130% text) and measuring a long title at 320/390 px. `status: implemented` means the code is done, not that the visual acceptance is complete. Before M-2 is closed, all changed views are compared with the mockups together (see Notes).

## Archive notes (2026-10-28)

- Integration: PR #66 (https://github.com/aleksandraPecherz/PasujeMi/pull/66), merged 2026-10-28 as merge commit bf2d990 (history kept, merge commit); checks on that commit: Workers Builds `pasuje-mi` success (Build ID bba9e8cf-9013-4ada-9276-d6ba9bb9a9a4, Version ID 08e20bf7-2c30-4c20-a892-d5786c02c653, production), `ci` success, `smoke` success. The AI `review` job failed with an execution error (outcome "error") and was skipped on purpose; it is not a required check.
- Closed issue: #62 (milestone M-2). Commits ff84a6b, 5ef7230, aaf34ef, 8ef4e2e. No migrations.
- Accepted limitation (2026-10-28, the author): the rows below were NOT verified and are NOT checked as passed; archiving does not turn them into passes. Nothing was tested on a real phone or with a real on-screen keyboard.
- Row left unchecked: 4.5 (320 px and 130% text show no clipped text or overlap; a long title at 320/390 px was not measured). It was deferred to the M-2 verification, whose aggregate comparison (`soft-modern-visual-alignment`) did not cover this specific check. The detail page was revisited in `soft-modern-visual-alignment` phase 4 and accepted for desktop light and dark and phone light and dark.
