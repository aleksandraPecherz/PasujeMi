---
change_id: soft-modern-recipe-details
title: Soft Modern recipe details
status: implemented
created: 2026-10-28
updated: 2026-10-28
archived_at: null
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

Not verified: Progress 4.5 (320 px and 130% text) stays open; a long title was not measured at 320/390 px. Before M-2 is closed, all changed views are still compared with the mockups together (see Notes).
