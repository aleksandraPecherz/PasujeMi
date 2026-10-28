# Soft Modern recipe form Implementation Plan

## Overview

#63: restyle the add/edit recipe form (`RecipeForm` → `RecipeFormView` → `IngredientFields`) to Soft Modern (mockups M13, M14, M22 variant B, D04), with a phone layout where one ingredient is expanded and the rest are summaries. Presentation and UI state only: form data shape, validation, endpoints and permissions do not change.

## Current State Analysis

- `RecipeFormView.tsx` renders four bordered `rounded-2xl` cards, the title inside the first card, nutrition fields mixed with time/servings, kinds as plain checkboxes, a default-size `Button` at the end of the form and `ServerError` above it.
- `IngredientFields.tsx` renders every ingredient and every substitute fully expanded; "Usuń składnik" is a text button; substitutes have no collapse.
- `useRecipeForm.ts` keeps `form` (rows keyed by a stable `key`), `fieldErrors` by validator path (`ingredients.N.substitutes.M.name`, positional) and `focusToken`. `RecipeForm.tsx:13-17` focuses the first `[aria-invalid="true"]` after a failed submit, so a field that is not in the DOM or is `display:none` cannot take focus.
- Existing tests (`useRecipeForm.test.ts`) cover only `recipeToFormState`/`toBody`. Vitest runs in `node` and includes only `src/**/*.test.ts`.
- `new.astro` is `<RecipeForm client:load />` in `AppLayout` (`max-w-5xl`); `edit.astro` guards author/admin and passes `recipe`. Both stay as they are.
- The three form files have zero literal-colour hits and are already in `CLEAN_FILES`. Cards still use `border`, against the flat Soft Modern rule.

## Desired End State

Phone: top row with close link and title, flat cards, one expanded ingredient (a new ingredient opens itself and collapses the previous one; edit starts with all collapsed), collapsible "Zamienniki · N" and "Wartości odżywcze", chip-styled kinds (checkbox semantics), a sticky "Zapisz przepis"/"Zapisz zmiany" bar (`Button size="lg"`). Desktop: all ingredients expanded with fields in one row, right column with Save and Cancel (no illustration card). A failed save shows a "Popraw N pól" banner with links; the ingredient, substitutes or nutrition section holding the first error is open before focus moves, and banner links open their target first. Verified by tests, kitchen sink states, `lint`, `check:ui`, `astro check`, `vitest`.

### Key Discoveries:

- `src/components/recipes/RecipeForm.tsx:13-17` — focus relies on the DOM; opening must happen in the same state batch as `focusToken`.
- `src/components/hooks/useRecipeForm.ts:261-267` and `:284-292` — removals call `setFieldErrors({})` because error paths are positional; expansion state must therefore be keyed by row `key`, never by index.
- `src/components/recipes/IngredientFields.tsx:8-29` — `fieldId`, `errorProps`, `FieldError` already tie errors to inputs; reuse as is.
- Collapsed content must stay mounted (`hidden`, not unmounted) so ids and a11y wiring persist; values live in `form` state either way.

## What We're NOT Doing

- Illustration card/picker, AI, unsaved-changes warning (M26), on-screen-keyboard detection (M25).
- Changes to `RecipeFormState`, `toBody`, `parseRecipeInput`, `sendRecipe`, API endpoints, RLS or the `edit.astro` guard.
- `RecipeSaved` (M16), new dependencies (no shadcn `collapsible`, no React Testing Library), commits as part of planning.
- The aggregate comparison of all views with the mockups: still required before M-2 closes.

## Implementation Approach

Keep disclosure state out of `form`: a small UI state (open ingredient key, open substitutes keys, nutrition open) plus pure helpers that compute what to open for a set of errors. Collapsing is CSS (`hidden` on phone, visible from `md`) over always-mounted content, so desktop shows everything without `matchMedia`. Toggles are native `<button aria-expanded aria-controls>`. The save bar is `sticky bottom-0` inside the form (in flow, so it never covers fields or errors when scrolling).

## Phase 1: Disclosure logic

### Overview

State and pure helpers, covered by Vitest; no visual change yet.

### Changes Required:

#### 1. Disclosure helpers

**File**: `src/components/hooks/recipeFormDisclosure.ts` (new)

**Intent**: Pure functions deciding what is open: initial state (new: first ingredient open; edit: none), open-on-add (the new one opens, the previous closes), toggle, remove (never opens another row), open-for-errors (first error path → ingredient key, its substitutes section, or nutrition) and an ordered error list for the banner.

**Contract**: Works on row `key`s and validator paths (`ingredients.N[.substitutes.M].field`, `steps.N`, `name`, `prepTimeMin`, `servings`, `kcal`, `proteinG`, `carbsG`, `fatG`). Error list order = page order (name, ingredients, steps, time/servings, nutrition); each entry is `{ path, label, message }` where the label reads like "Składnik 2 · Nazwa".

#### 2. Hook wiring

**File**: `src/components/hooks/useRecipeForm.ts`

**Intent**: Hold the disclosure state and expose it with toggles and `reveal(path)`; `addIngredient` opens the new row; `fail()` opens what the errors need in the same batch as `focusToken`. `form`, `toBody` and `submit` semantics are unchanged.

**Contract**: The return value gains `disclosure` and actions `toggleIngredient(key)`, `toggleSubstitutes(key)`, `toggleNutrition()`, `reveal(path)`; `RecipeFormActions` for data fields is not widened.

#### 3. Tests

**File**: `src/components/hooks/recipeFormDisclosure.test.ts` (new)

**Intent**: Lock the decided behaviour: a new ingredient opens and the previous closes, edit starts collapsed, removing a row does not open another, an error in ingredient 5 opens ingredient 5 (and its substitutes for a substitute error), a nutrition error opens nutrition, banner order and labels.

### Success Criteria:

#### Automated Verification:

- New tests pass: `npx vitest run src/components/hooks`
- Existing form tests still pass: `npm test`
- Lint and types pass: `npm run lint` and `npx astro check`

#### Manual Verification:

- None (no visible change in this phase)

**Implementation Note**: After this phase and automated verification pass, pause for manual confirmation before proceeding. Phase blocks use plain bullets; the `- [ ]` checkboxes live in `## Progress`.

---

## Phase 2: Ingredient rows

### Overview

`IngredientFields` in the M13/M14/M22-B look, driven by Phase 1 state.

### Changes Required:

#### 1. IngredientFields

**File**: `src/components/recipes/IngredientFields.tsx`

**Intent**: Numbered badge, "Składnik N", trash icon button (`size="icon"`, accessible name keeps the ingredient name), collapsed summary on phone ("Chleb żytni · 80 g · szukamy: chleb", chevron toggle with `aria-expanded`), `border-destructive` on collapsed rows that hold errors. Fields keep labels, ids and required markers; the hint text becomes "Puste = weźmiemy z nazwy. Po nim szukamy w spiżarce."; Ilość/Jednostka stay side by side. Substitutes sit in a collapsible "Zamienniki · N" bar with "Dodaj zamiennik". Content stays mounted: collapsed = `hidden` on phone, always visible from `md`, where the fields sit in one row.

**Contract**: Props gain `expanded`, `substitutesOpen`, `onToggle`, `onToggleSubstitutes`; field ids and `errorProps` unchanged so focus and `aria-invalid` keep working. Tokens and `ui/` components only.

### Success Criteria:

#### Automated Verification:

- Lint, `check:ui` and types pass: `npm run lint`, `npm run check:ui`, `npx astro check`
- Tests pass: `npm test`

#### Manual Verification:

- Phone: one ingredient open, the others summaries; collapse then expand keeps typed values
- Desktop: all ingredients expanded, fields in one row

**Implementation Note**: Pause for manual confirmation before the next phase.

---

## Phase 3: Form view

### Overview

`RecipeFormView` and `RecipeForm`: layout, banner, save bar, cancel path, chips, nutrition.

### Changes Required:

#### 1. RecipeFormView

**File**: `src/components/recipes/RecipeFormView.tsx`

**Intent**: Flat `bg-card rounded-xl` cards without border; title above the cards with a close link on phone; sections Nazwa przepisu, Składniki (counter "Min. 1 składnik" / "N składników"), Kroki (label gets the required marker), Dodatkowe informacje (kinds as chips, time, servings) and a collapsible "Wartości odżywcze" (shorter labels; closed on phone unless it has values or errors; always visible on desktop). Error banner (`role="alert"`, "Popraw N pól, żeby zapisać") whose links call `reveal(path)` before focus; `ServerError` moves next to it. Save: `Button size="lg"` in a sticky bottom bar on phone, in a right column with "Anuluj" from `md` up.

**Contract**: `cancelHref` becomes required; new props carry `disclosure` and the toggle/reveal actions. Kinds stay `Checkbox` + `Label` (chip look from tokens; any new variant lives in `ui/` with tokens only). The sticky bar is in flow (`sticky bottom-0`), not `fixed`.

#### 2. RecipeForm

**File**: `src/components/recipes/RecipeForm.tsx`

**Intent**: Pass `cancelHref` (`/` for new, `/recipes/{id}` for edit) and the disclosure props; keep the `focusToken` effect, now running after the open state is applied.

#### 3. View tests

**File**: `src/components/recipes/RecipeFormView.test.ts` (new)

**Intent**: Render with `react-dom/server` and `createElement`: collapsed ingredient content is still in the markup, required markers and `aria-required` are present, banner links point at existing ids, kinds render as checkboxes, the cancel link target is correct. No new dependency.

### Success Criteria:

#### Automated Verification:

- Tests pass: `npm test`
- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm run build` pass

#### Manual Verification:

- Failed save: banner appears, the right ingredient/substitutes/nutrition opens, focus lands on the first invalid field; banner links open and focus their targets
- Removing an ingredient does not open another one
- The sticky bar never blocks scrolling to fields or errors; save works for new and edit; edit still shows 404 for non-authors

**Implementation Note**: Pause for manual confirmation before the next phase.

---

## Phase 4: Kitchen sink and final gate

### Overview

Document the states and leave the guard rule.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/components/dev/KitchenSink.tsx`

**Intent**: Extend the existing form sections (`SampleRecipeForm`) with: one ingredient expanded plus summaries, an error in a collapsed ingredient, open substitutes, nutrition open/closed, banner, submitting. Cover the 7-state matrix (default, hover, focus-visible, disabled, error, empty, loading) or mark N/A with a reason.

#### 2. Rule

**File**: `AGENTS.md`

**Intent**: One short UI line: ingredient disclosure state is keyed by row `key`, never by index. Written outside the CLI block.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`, `npm run build` pass
- The hard-coded value scan on the three form files returns 0 hits

#### Manual Verification:

- Screenshots at desktop and one phone width (kitchen sink, `/recipes/new`, `/recipes/{id}/edit`), light and dark
- The aggregate mockup comparison stays open for the M-2 close

---

## Testing Strategy

### Unit Tests:

- Disclosure helpers (Phase 1): add, remove, edit start, open-for-errors, banner order and labels.
- View markup via `react-dom/server` (Phase 3): collapsed content mounted, required markers, banner link targets, cancel href.

### Manual Testing Steps:

1. Add a recipe at phone width: add three ingredients, collapse and expand, values survive.
2. Submit with errors in an ingredient name, a substitute and nutrition; check what opens and where focus lands.
3. Edit an 8-ingredient recipe: it starts collapsed; fix an error through a banner link.
4. Remove ingredient 2 while 4 is open: 4 stays the open one.

## Performance Considerations

None; the row count is bounded by `MAX_INGREDIENTS`.

## References

- Analysis in the planning conversation; mockups M13, M14, M22 (B), M25, D04 in `.tmp-style-review/` (local, uncommitted)
- Similar change: `context/changes/soft-modern-recipe-details/plan.md`
- Focus and error handling: `src/components/recipes/RecipeForm.tsx:13`, `src/components/hooks/useRecipeForm.ts:261`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Disclosure logic

#### Automated

- [x] 1.1 New tests pass: `npx vitest run src/components/hooks` — deb53be
- [x] 1.2 Existing form tests still pass: `npm test` — deb53be
- [x] 1.3 Lint and types pass: `npm run lint` and `npx astro check` — deb53be

### Phase 2: Ingredient rows

#### Automated

- [x] 2.1 Lint, `check:ui` and types pass: `npm run lint`, `npm run check:ui`, `npx astro check`
- [x] 2.2 Tests pass: `npm test`

#### Manual

- [ ] 2.3 Phone: one ingredient open, the others summaries; collapse then expand keeps typed values
- [ ] 2.4 Desktop: all ingredients expanded, fields in one row

### Phase 3: Form view

#### Automated

- [ ] 3.1 Tests pass: `npm test`
- [ ] 3.2 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm run build` pass

#### Manual

- [ ] 3.3 Failed save opens the right section and focuses the first invalid field; banner links open and focus their targets
- [ ] 3.4 Removing an ingredient does not open another one
- [ ] 3.5 The sticky bar never blocks scrolling to fields or errors; save works for new and edit; edit still shows 404 for non-authors

### Phase 4: Kitchen sink and final gate

#### Automated

- [ ] 4.1 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`, `npm run build` pass
- [ ] 4.2 The hard-coded value scan on the three form files returns 0 hits

#### Manual

- [ ] 4.3 Screenshots at desktop and one phone width, light and dark
- [ ] 4.4 Aggregate mockup comparison left open for the M-2 close
