# Soft Modern recipe details — Plan Brief

> Full plan: `context/changes/soft-modern-recipe-details/plan.md`

## What & Why

#62: give the recipe details page (and its author actions, delete confirmation and not-found view) the Soft Modern look from stage 1, so it matches the pantry and list views. Presentation only; data, permissions and database stay as they are.

## Starting Point

Details are one bordered card without an illustration, with plain-text meta, a 2x2 nutrition grid, a decimal list of steps and a duplicated back link. The author-actions component has already been reworked (phone popover, desktop buttons, restyled dialog) in the working tree but is not committed.

## Desired End State

Illustration (about 192 px on desktop, compact strip on phone), title, pills, nutrition tiles, ingredients with quantities and substitutes, numbered steps; actions as buttons on desktop and a native popover on phones; delete confirmation and `NotFoundView` in the same style; works in light and dark themes, at 320 px and with enlarged text.

## Key Decisions Made

| Decision                  | Choice                                                       | Why                                                  | Source |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ------ |
| Phone actions             | Native popover (Popover API), "Edytuj" link + "Usuń" button  | Pattern already in `AppHeader`, no new dependency    | Plan   |
| Menu semantics            | No `role="menu"`                                             | Full menu keyboard pattern not implemented           | Plan   |
| AlertDialog               | Only for delete confirmation                                 | It is a confirmation, not an action list             | Plan   |
| Steps                     | Numbered from `recipe.steps`                                 | Each element is already one step; no text processing | Plan   |
| Nutrition                 | Separate `amount` and `unit` fields next to existing `value` | No string parsing; existing callers keep working     | Plan   |
| Illustration              | About 192 px on desktop, compact strip on phone              | Reach ingredients faster than in D03                 | Plan   |
| Global `alert-dialog.tsx` | Unchanged unless unavoidable                                 | Restyle only the delete dialog                       | Plan   |
| NotFoundView              | Look only                                                    | Texts and per-state behaviour stay                   | Plan   |

## Scope

**In scope:** `RecipeDetails`, `[id].astro`, `RecipeAuthorActions`, `NotFoundView`, `format.ts` nutrition fields, kitchen sink states, `CLEAN_FILES`.

**Out of scope:** database/RLS/`canManage`/`useDeleteRecipe`, recipe form, pantry and list views, new illustrations, new dependencies, commits as part of planning.

## Architecture / Approach

Four small phases, each closing with lint, `check:ui` and `astro check`: (1) author actions and delete confirmation (already done, awaiting acceptance), (2) `NotFoundView`, (3) details layout with data tweak in `format.ts`, (4) kitchen sink and final checks.

## Phases at a Glance

| Phase                                     | What it delivers                                            | Key risk                                                      |
| ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Author actions and delete confirmation | Popover on phone, buttons on desktop, restyled dialog       | Popover position and focus return are unverified in a browser |
| 2. NotFoundView restyle                   | Centered Soft Modern view for 404 and failure states        | Shared by several callers                                     |
| 3. Recipe details layout                  | New page layout with illustration, tiles and numbered steps | Phone height: illustration must not push ingredients down     |
| 4. Kitchen sink and final checks          | New states documented; themes, 320 px, text zoom checked    | None significant                                              |

**Prerequisites:** phase 1 code is in the working tree (uncommitted).
**Estimated effort:** about 2 sessions across 4 phases.

## Open Risks & Assumptions

- Phase 1 has only been checked statically (lint, types); its visual behaviour needs the author's confirmation.
- No component tests cover deletion; verification relies on the service test and manual checks.
- `format.ts` may have no test file; if so, add a small one for the new fields.

## Success Criteria (Summary)

- The details page matches the Soft Modern mockups in spirit in both themes and on phone and desktop.
- Author/admin actions and deletion work as before; others see no actions.
- Lint, `check:ui` and `astro check` pass.
