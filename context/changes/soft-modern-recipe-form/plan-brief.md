# Soft Modern recipe form — Plan Brief

> Full plan: `context/changes/soft-modern-recipe-form/plan.md`

## What & Why

#63: give the add/edit recipe form the Soft Modern look and a phone layout where one ingredient is expanded and the rest are summaries, so long recipes can be edited without endless scrolling. Presentation and UI state only.

## Starting Point

Four bordered cards, every ingredient and substitute always expanded, nutrition mixed with time/servings, the save button at the end of the form, and focus after a failed save going to the first `aria-invalid` field in the DOM. Tests cover only state conversion.

## Desired End State

Flat cards, collapsible ingredients (phone), substitutes and nutrition, chip-styled kinds, an error banner with links, a sticky save bar on phone and a right column with Save/Cancel on desktop. After a failed save the right section opens before focus moves.

## Key Decisions Made

| Decision             | Choice                                                 | Why                                | Source |
| -------------------- | ------------------------------------------------------ | ---------------------------------- | ------ |
| Desktop right column | Save + Cancel, no illustration card                    | Picker is out of scope             | Plan   |
| Close / Cancel       | New → `/`, edit → `/recipes/{id}`                      | Natural return points              | Plan   |
| Kinds                | Checkboxes styled as chips                             | Keeps semantics                    | Plan   |
| Phone / desktop      | One ingredient open / all open (CSS, no `matchMedia`)  | Mockup M22 B + A                   | Plan   |
| Add / edit           | Add opens the new one; edit starts collapsed           | Mockup rules                       | Plan   |
| Disclosure state     | Keyed by row `key`, outside `form`                     | Removals shift indices             | Plan   |
| Errors               | Open section first, then focus; banner links also open | Collapsed fields cannot take focus | Plan   |
| Collapsing           | CSS over mounted content                               | No data loss, no new dependency    | Plan   |
| Tests                | Pure helpers + `react-dom/server` markup in `.test.ts` | Vitest is `node`, no new deps      | Plan   |
| Save bar             | `sticky` in flow, not `fixed`                          | Cannot block scrolling to errors   | Plan   |

## Scope

**In scope:** `useRecipeForm`, new disclosure helpers, `IngredientFields`, `RecipeFormView`, `RecipeForm`, kitchen sink, tests, one `AGENTS.md` line.

**Out of scope:** data shape, validation, endpoints, permissions, illustration picker, AI, unsaved-changes warning, keyboard handling, `RecipeSaved`, new dependencies.

## Architecture / Approach

Disclosure state (open ingredient key, open substitutes, nutrition) lives beside `form`; pure helpers compute what to open for a set of errors. The view hides collapsed content with CSS on phone only.

## Phases at a Glance

| Phase                    | What it delivers                                     | Key risk                       |
| ------------------------ | ---------------------------------------------------- | ------------------------------ |
| 1. Disclosure logic      | State, helpers, Vitest tests                         | Index shifts on removal        |
| 2. Ingredient rows       | Summaries, collapse, trash, substitutes              | Hidden fields and a11y         |
| 3. Form view             | Layout, banner, sticky bar, chips, nutrition, cancel | Focus after open; sticky bar   |
| 4. Kitchen sink and gate | States, screenshots, checks, rule                    | Screenshots need a running app |

**Prerequisites:** auth fix and #62 already committed; leave them untouched.
**Estimated effort:** about 2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Sticky bar with the on-screen keyboard is not handled (out of scope).
- The aggregate mockup comparison remains required before M-2 closes.

## Success Criteria (Summary)

- Phone and desktop match M13/M14/M22-B/D04 in structure; a failed save lands focus on a visible invalid field; collapsing loses no data; lint, `check:ui`, `astro check`, tests and build are green.
