# Soft Modern recipe details Implementation Plan

## Overview

#62: restyle the recipe details page (`/recipes/[id]`) to Soft Modern, together with the author/admin actions, the delete confirmation and `NotFoundView`. Mockups M11, M12a, M12b, M18, M20 and D03 in `.tmp-style-review/` are references, not instructions. No database, permission-logic, recipe-form or dependency changes.

## Current State Analysis

- `RecipeDetails.tsx:34` renders one bordered card with no illustration; meta is plain text, nutrition is a bordered 2x2 grid (`:56-70`), steps are a `list-decimal` (`:98-109`), and "Wróć do listy" appears twice (`BackLink`, `:13`, used at `:35` and `:111`).
- `RecipeAuthorActions.tsx` was already reworked in the working tree before this plan (phase 1): desktop buttons, phone native popover, restyled delete dialog. It is not committed yet.
- `[id].astro:50-61` passes `RecipeAuthorActions` through the `actions` slot only when `canManage`; 404 and failure states use `NotFoundView` (bordered, left-aligned card with an outline button).
- `Recipe` already has `illustration`, `steps: string[]`, nutrition fields and `kinds`; `RecipeIllustration` already renders the tone tile or the placeholder.
- `formatNutrition` (`src/lib/recipes/format.ts`) returns `{ label, value }` with the unit inside `value` ("420 kcal").

### Key Discoveries:

- Each element of `recipe.steps` is one step, so numbered circles need no text processing.
- No component tests cover deletion; the only related test is `src/lib/services/recipes.test.ts` (service delete, 28 tests pass).
- `RecipeDetails.tsx`, `RecipeAuthorActions.tsx`, `[id].astro` and `[id]/edit.astro` are in `CLEAN_FILES`; `NotFoundView.astro` is not and is added once cleaned.
- The Popover API pattern already exists in `AppHeader.astro:45-97`; a popover has no anchor, so its position is set from the trigger rect on `toggle`.
- Project rules: flat cards (`bg-card`, no border/shadow), tokens only, `cn()` for class merging, new states in `/dev/kitchen-sink`.

## Desired End State

The details page shows (top to bottom): back link/button, illustration (about 192 px tile next to the title on desktop, compact tone strip on phone), title, time/servings/kind pills, nutrition tiles, ingredients with quantities and substitutes, numbered steps. Author or admin sees "Edytuj"/"Usuń" buttons on desktop and a "⋯" popover on phone; the delete confirmation and `NotFoundView` use the same Soft Modern look. Light and dark themes work, including 320 px and enlarged text. Verified by lint, `check:ui`, `astro check` and a visual review by the author.

## What We're NOT Doing

- No database, RLS, `canManage`, `useDeleteRecipe` or permission changes.
- No change to the recipe form, pantry or list views.
- No new dependency, no `dropdown-menu`, no `role="menu"`; `AlertDialog` is used only for the delete confirmation.
- No splitting of step text; no parsing of `formatNutrition` strings.
- No change to the global `alert-dialog.tsx` unless unavoidable.
- No new illustrations; no change to `NotFoundView` texts or per-state behaviour.
- No commits, push or GitHub work as part of the plan itself; no deleting real recipes while checking the look.

## Implementation Approach

Small, independent phases, each ending with lint, `check:ui` and `astro check`. Phase 1 is already in the working tree and only needs acceptance. Phase 3 is the largest and builds on the actions component from phase 1.

## Phase 1: Author actions and delete confirmation

### Overview

Desktop buttons, phone popover and the restyled delete dialog (already implemented before this plan).

### Changes Required:

#### 1. Author actions

**File**: `src/components/recipes/RecipeAuthorActions.tsx`

**Intent**: Show "Edytuj"/"Usuń" buttons from `sm` up; on phones a "⋯" button opens a native popover with an "Edytuj przepis" link and a "Usuń przepis" button. The popover closes before the confirmation dialog opens; focus returns to the visible trigger when the dialog closes.

**Contract**: `RecipeAuthorActionsView` props unchanged (`recipeId`, `recipeName`, `status`, `error`, `onConfirm`, `defaultOpen`). Popover uses `popover="auto"` with `popoverTarget`, no `role="menu"`. Dialog: tinted icon via `AlertDialogMedia`, buttons `size="lg"`, destructive on top on phones.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- UI literals guard passes: `npm run check:ui`
- Type check passes: `npx astro check`
- Service delete tests pass: `npx vitest run src/lib/services/recipes.test.ts`

#### Manual Verification:

- On a phone width the popover opens under "⋯", closes with Esc and with a click outside, and Tab moves through its items.
- On desktop both buttons show; "Usuń" is red.
- The confirmation dialog looks right in both themes and focus returns to the trigger after "Anuluj".

**Implementation Note**: After automated checks pass, pause for the author's visual acceptance before continuing.

---

## Phase 2: NotFoundView restyle

### Overview

Same texts and states, new look (M20).

### Changes Required:

#### 1. Not-found view

**File**: `src/components/NotFoundView.astro`

**Intent**: Centered layout with a round tone tile holding the utensils icon, centered heading and description, and a primary-colored "Wróć do listy przepisów" button; flat, no border.

**Contract**: Props `message` and `description` and their defaults stay unchanged; the link stays `/`. Used by `[id].astro` for "Nie znaleziono przepisu" and "Coś poszło nie tak", and by other callers of the default.

#### 2. Literal guard

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Add `src/components/NotFoundView.astro` to `CLEAN_FILES`.

**Contract**: One new entry in the exported list.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- UI literals guard passes: `npm run check:ui`
- Type check passes: `npx astro check`

#### Manual Verification:

- A bad recipe id, a failed load and the generic 404 all show the new layout with their original texts, in both themes and at 320 px.

---

## Phase 3: Recipe details layout

### Overview

Rebuild `RecipeDetails` around the illustration and the Soft Modern cards (M11, M18, D03).

### Changes Required:

#### 1. Nutrition data

**File**: `src/lib/recipes/format.ts` (and its test, if one exists)

**Intent**: Give each nutrition item the number and the unit separately so tiles can show a big number with the unit below, without parsing a string.

**Contract**: `NutritionItem` gains `amount: string` (formatted number) and `unit: string` ("kcal" or "g"); `label` and `value` stay, so existing callers keep working.

#### 2. Details component

**File**: `src/components/recipes/RecipeDetails.tsx`

**Intent**: Flat cards instead of one bordered card. Illustration via `RecipeIllustration`: about 192 px (`size-48`) tile next to the title from `sm`, a compact tone strip on phones. Time, servings and kinds as pills; nutrition as four `bg-secondary` tiles (number, unit/label below); ingredients with a count in the heading, right-aligned bold quantities and "lub …" substitutes; steps as numbered circles from `recipe.steps`; a single back link at the top. Author actions placed in the header row (desktop) / top-right (phone).

**Contract**: `RecipeDetails({ recipe, actions })` signature unchanged; headings keep their `aria-labelledby` ids; the list-based semantics (`ul`/`ol`) stay for ingredients and steps; illustration is decorative (empty alt, from `RecipeIllustration`).

**Correction after review (phone, M11/M18)**: the phone layout is not a scaled-down desktop card. Phone: a full-bleed strip at the top in the illustration tone (`--illus-*`, `bg-secondary` for the placeholder) with the illustration centered (no second plate around the SVG), the round back button and the actions in its top corners (no duplicated "Przepisy" link); the title (`text-xl`, `leading-snug`, bold, never truncated) and the pills (one wrapping flex container) sit on the page background under a rounded top edge, not in a white card; nutrition, ingredients and steps are separate cards below. From `sm` the desktop layout (back link row, card with a 192 px illustration) stays as accepted. The actions node is rendered once and positioned per breakpoint. `RecipeIllustration.tsx` exports `TONE_CLASS` for the strip.

**Acceptance note (phase 3)**: the author accepted the details look after the phone correction. Not performed: measuring a long title at 320 and 390 px (the dev server failed with a Vite dependency-cache 500 and was not restarted by the agent), and the rendering of data variants (no nutrition, no illustration, several kinds) in the real page; 3.5 stays open until phase 4 shows these variants in the kitchen sink.

#### 3. Page

**File**: `src/pages/recipes/[id].astro`

**Intent**: Only what the new layout needs (layout width, passing the existing `recipe.illustration` through `RecipeDetails`); `canManage`, RLS notes and error handling untouched.

**Contract**: Same slot (`actions`) and same `canManage` condition.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- UI literals guard passes: `npm run check:ui`
- Type check passes: `npx astro check`
- Format tests pass: `npx vitest run src/lib/recipes`

#### Manual Verification:

- A recipe with and without nutrition, substitutes, `null` illustration and several kinds renders correctly on desktop and phone.
- Ingredients are reachable quickly: the illustration does not push the list far down on a phone.
- Light and dark themes both match M11/M18 in spirit; long names wrap.

**Implementation Note**: Pause for the author's visual acceptance before phase 4.

---

## Phase 4: Kitchen sink and final checks

### Overview

Document the new states and run the final checks.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/components/dev/KitchenSink.tsx`

**Intent**: Add the new states: details layout variants, popover/actions, delete dialog states (idle, deleting, error) and the new `NotFoundView`.

**Contract**: Uses the existing `RecipeAuthorActionsView`, `RecipeDetails` and `NotFoundView`; dev only.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- UI literals guard passes: `npm run check:ui`
- Type check passes: `npx astro check`

#### Manual Verification:

- `/dev/kitchen-sink` shows all new states in both themes.
- 320 px width and 130% text size: no clipped text, no overlap.

**Deferred**: this check (Progress 4.5) is postponed on purpose to the collective M-2 verification of all changed views against the mockups and stays unchecked until then.

---

## Testing Strategy

### Unit Tests:

- Only `format.ts` changes behavior; keep or extend its tests for the new `amount`/`unit` fields.

### Integration Tests:

- None added; no component tests exist for deletion, and the service delete test stays green.

### Manual Testing Steps:

1. Open a recipe you authored on phone and desktop widths; check popover, buttons and dialog (do not confirm deletion of real recipes; use "Anuluj").
2. Open a recipe you do not own: no actions are shown.
3. Open a bad recipe id and check the not-found view.
4. Repeat in the dark theme, at 320 px and with enlarged text.

## Performance Considerations

None beyond lazy-loaded SVG illustrations already used by `RecipeIllustration`.

## Migration Notes

None; no data or schema change.

## References

- Related research: none (analysis done in the session)
- Existing popover pattern: `src/components/AppHeader.astro:45`
- Mockups (references): `.tmp-style-review/` M11, M12a, M12b, M18, M20, D03

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Author actions and delete confirmation

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — ff84a6b
- [x] 1.2 UI literals guard passes: `npm run check:ui` — ff84a6b
- [x] 1.3 Type check passes: `npx astro check` — ff84a6b
- [x] 1.4 Service delete tests pass: `npx vitest run src/lib/services/recipes.test.ts` — ff84a6b

#### Manual

- [x] 1.5 Phone popover opens under "⋯", closes with Esc and outside click, Tab moves through its items — ff84a6b
- [x] 1.6 Desktop shows both buttons; "Usuń" is red — ff84a6b
- [x] 1.7 Confirmation dialog looks right in both themes and focus returns to the trigger after "Anuluj" — ff84a6b

### Phase 2: NotFoundView restyle

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — 5ef7230
- [x] 2.2 UI literals guard passes: `npm run check:ui` — 5ef7230
- [x] 2.3 Type check passes: `npx astro check` — 5ef7230

#### Manual

- [x] 2.4 Bad id, failed load and generic 404 show the new layout with original texts in both themes and at 320 px — 5ef7230

### Phase 3: Recipe details layout

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — aaf34ef
- [x] 3.2 UI literals guard passes: `npm run check:ui` — aaf34ef
- [x] 3.3 Type check passes: `npx astro check` — aaf34ef
- [x] 3.4 Format tests pass: `npx vitest run src/lib/recipes` — aaf34ef

#### Manual

- [x] 3.5 Recipes with and without nutrition, substitutes, null illustration and several kinds render correctly on desktop and phone — 8ef4e2e
- [x] 3.6 Illustration does not push ingredients far down on a phone — aaf34ef
- [x] 3.7 Light and dark themes match M11/M18; long names wrap — aaf34ef

### Phase 4: Kitchen sink and final checks

#### Automated

- [x] 4.1 Lint passes: `npm run lint` — 8ef4e2e
- [x] 4.2 UI literals guard passes: `npm run check:ui` — 8ef4e2e
- [x] 4.3 Type check passes: `npx astro check` — 8ef4e2e

#### Manual

- [x] 4.4 `/dev/kitchen-sink` shows all new states in both themes — 8ef4e2e
- [ ] 4.5 320 px and 130% text show no clipped text or overlap
