# Soft Modern recipe form Implementation Plan

## Overview

#63: restyle the add/edit recipe form (`RecipeForm` → `RecipeFormView` → `IngredientFields`) to Soft Modern (mockups M13, M14, M22 variant B, D04), with a phone layout where one ingredient is expanded and the rest are summaries. Presentation and UI state, plus (scope change, phases 4-5) automatic illustration for new recipes: a name-based rule picks an illustration from the existing library, enforced by a database trigger and previewed read-only in the form. Form data shape, validation, endpoints and permissions do not change: no new grants, no service role in the app.

## Current State Analysis

- `RecipeFormView.tsx` renders four bordered `rounded-2xl` cards, the title inside the first card, nutrition fields mixed with time/servings, kinds as plain checkboxes, a default-size `Button` at the end of the form and `ServerError` above it.
- `IngredientFields.tsx` renders every ingredient and every substitute fully expanded; "Usuń składnik" is a text button; substitutes have no collapse.
- `useRecipeForm.ts` keeps `form` (rows keyed by a stable `key`), `fieldErrors` by validator path (`ingredients.N.substitutes.M.name`, positional) and `focusToken`. `RecipeForm.tsx:13-17` focuses the first `[aria-invalid="true"]` after a failed submit, so a field that is not in the DOM or is `display:none` cannot take focus.
- Existing tests (`useRecipeForm.test.ts`) cover only `recipeToFormState`/`toBody`. Vitest runs in `node` and includes only `src/**/*.test.ts`.
- `new.astro` is `<RecipeForm client:load />` in `AppLayout` (`max-w-5xl`); `edit.astro` guards author/admin and passes `recipe`. Both stay as they are.
- The three form files have zero literal-colour hits and are already in `CLEAN_FILES`. Cards still use `border`, against the flat Soft Modern rule.
- Illustrations: 12 static SVGs in `public/illustrations/`, keys and tones in `src/lib/recipes/illustrations.ts`; `recipes.illustration` is nullable with a format check only (`20261027120000`). `authenticated` has column-level insert/update grants (`20261017…:21`, `20261018…:12`) that do not list it, so `POST`/`PUT /api/recipes` never write it and a new recipe is always `NULL` (placeholder). Only the one-off `scripts/assign-illustrations.ts` (service role, local map `scripts/illustration-map.json`, only where empty) writes it. `RECIPE_COLUMNS` already returns it on insert/update.
- A `BEFORE` trigger can set `NEW.illustration` without a grant: column privileges are checked for the columns named in the statement, not for values a trigger changes (precedent `recipes_reset_match_keys`, `20261018120000:31-50`). Helpers live in schema `private`, which is not exposed by the API (`supabase/config.toml:13`), with `revoke execute … from public` (precedent `private.is_admin()`, `20261020120000:32-51`).

## Desired End State

Phone: top row with close link and title, flat cards, one expanded ingredient (a new ingredient opens itself and collapses the previous one; edit starts with all collapsed), collapsible "Zamienniki · N" and "Wartości odżywcze", chip-styled kinds (checkbox semantics), a sticky "Zapisz przepis"/"Zapisz zmiany" bar (`Button size="lg"`). Desktop: all ingredients expanded with fields in one row, right column with Save and Cancel. A recipe saved with `illustration` empty gets one from its name (database trigger); the form previews it: phone next to the name, desktop at the top of the right column above Save/Cancel. A recipe that already has an illustration keeps it; a name with no match keeps the placeholder. A failed save shows a "Popraw N pól" banner with links; the ingredient, substitutes or nutrition section holding the first error is open before focus moves, and banner links open their target first. Verified by tests, kitchen sink states, `lint`, `check:ui`, `astro check`, `vitest`.

### Key Discoveries:

- `src/components/recipes/RecipeForm.tsx:13-17` — focus relies on the DOM; opening must happen in the same state batch as `focusToken`.
- `src/components/hooks/useRecipeForm.ts:261-267` and `:284-292` — removals call `setFieldErrors({})` because error paths are positional; expansion state must therefore be keyed by row `key`, never by index.
- `src/components/recipes/IngredientFields.tsx:8-29` — `fieldId`, `errorProps`, `FieldError` already tie errors to inputs; reuse as is.
- Collapsed content must stay mounted (`hidden`, not unmounted) so ids and a11y wiring persist; values live in `form` state either way.

## What We're NOT Doing

- Illustration picker (manual choice), AI, unsaved-changes warning (M26), on-screen-keyboard detection (M25).
- Changes to `RecipeFormState`, `toBody`, `parseRecipeInput`, `sendRecipe`, API endpoints, RLS, column grants or the `edit.astro` guard; service role in the app; `SECURITY DEFINER`.
- Reproducing the 76 hand-made assignments with the rules (they may differ; the accepted map stays authoritative where already stored), backfilling existing `NULL` rows (stays with `assign-illustrations`), re-picking when a recipe with an illustration is renamed.
- Applying the migration to any remote database, a CI step for the SQL check (the check is a local gate), new illustrations.
- `RecipeSaved` (M16), new dependencies (no shadcn `collapsible`, no React Testing Library), commits as part of planning.
- The aggregate comparison of all views with the mockups: still required before M-2 closes.

## Implementation Approach

Keep disclosure state out of `form`: a small UI state (open ingredient key, open substitutes keys, nutrition open) plus pure helpers that compute what to open for a set of errors. Collapsing is CSS (`hidden` on phone, visible from `md`) over always-mounted content, so desktop shows everything without `matchMedia`. Toggles are native `<button aria-expanded aria-controls>`. The save bar is `sticky bottom-0` inside the form (in flow, so it never covers fields or errors when scrolling).

Illustrations (phases 4-5): one ordered list of name rules (stems matched at a word start, case-insensitive; specific forms such as sandwich, wrap, salad, soup, smoothie before dish families, ingredient words last) exists twice: as `pickIllustration(name)` in TS (form preview) and inline in the trigger function `private.recipes_pick_illustration()` in SQL (enforcement). A shared case file (`name → key | null`) is run through both: by Vitest for TS and by a local-only script through the real trigger for SQL, so drift shows as a failing comparison. The trigger fires `BEFORE INSERT OR UPDATE OF name` with `WHEN (new.illustration IS NULL)`, so an existing value is never overwritten and an unknown name stays `NULL` (placeholder).

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

## Phase 4: Illustration rules (TS + SQL)

### Overview

Name rules that pick an illustration from the existing library, enforced by a database trigger and mirrored in TS. No UI yet. The migration is only created and applied to the **local** database; no remote operation.

### Changes Required:

#### 1. Shared cases and TS picker

**File**: `src/lib/recipes/illustrationRules.ts` (new), `src/lib/recipes/illustrationCases.json` (new)

**Intent**: `pickIllustration(name)` returns a key or `null` (no match = placeholder). The case file lists real-looking recipe names with the expected key or `null`, and is the contract both implementations must meet. It covers case, Polish diacritics at word boundaries, precedence (a sandwich with chicken is a sandwich, a salad with chicken is a salad), word-start anchoring (a stem inside a longer word does not match) and unknown names.

**Contract**: `pickIllustration(name: string): string | null`; every key it can return is in `ILLUSTRATION_KEYS` and has `public/illustrations/<key>.svg`. Rules are an ordered list; the first match wins. Exact keywords are chosen during implementation and pinned by the case file; they need not reproduce `scripts/illustration-map.json`.

#### 2. SQL function and trigger

**File**: `supabase/migrations/<timestamp>_auto_recipe_illustration.sql` (new)

**Intent**: One trigger function `private.recipes_pick_illustration()` (`plpgsql`, `set search_path = ''`, no `SECURITY DEFINER`) holding the same ordered rules inline (adapted during implementation: no separate picker function, so no role needs `execute` or schema `usage`, service-role inserts included). Trigger `BEFORE INSERT OR UPDATE OF name ON public.recipes FOR EACH ROW WHEN (new.illustration IS NULL)`: it never overwrites a value and leaves `NULL` for an unknown name.

**Contract**: The function is in schema `private` (not exposed by the API) with `revoke execute … from public, anon, authenticated`; nothing is granted. No change to table grants, policies, the `illustration` check constraint or existing triggers. Additive and idempotent in effect on existing rows (no backfill).

#### 3. Local SQL-vs-TS check

**File**: `scripts/check-illustration-rules.ts` (new), `package.json` (`check:illustration-rules`)

**Intent**: Run the shared cases through the real trigger and compare with `pickIllustration`. Refuses any `SUPABASE_URL` that is not a local host. With the service role, insert each case name (illustration empty) and read back the key; delete the rows. With a throwaway local user (created and removed through the admin API, signed in with the anon key): insert through PostgREST and see the key set by the trigger; an explicit write of `illustration` by that user is rejected (grants unchanged); a rename of a recipe that already has an illustration keeps it; a rename of a `NULL` one picks a key.

**Contract**: Exit code 0 only when every comparison matches; prints the differing names otherwise. Reads `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from the shell, never prints them.

#### 4. Tests and docs

**File**: `src/lib/recipes/illustrationRules.test.ts` (new), `AGENTS.md`, `docs/reference/recipe-data-contract.md` (if it states who writes `illustration`)

**Intent**: Vitest runs the case file through `pickIllustration` and checks that keys exist (`ILLUSTRATION_KEYS`, SVG file). `AGENTS.md` currently says "the forms and API never touch it"; reword: the database trigger fills it from the name, the forms and API still send no value, the form only previews.

### Success Criteria:

#### Automated Verification:

- TS rules pass the shared cases: `npx vitest run src/lib/recipes`
- Migration applies to the local database: `npx supabase migration up --local`
- SQL and TS agree on the shared cases and the grants hold: `npm run check:illustration-rules` (local database)
- `npm run lint`, `npx astro check`, `npm test` pass

#### Manual Verification:

- Review of the migration: no grant or policy change, no `SECURITY DEFINER`, the function in `private`
- Nothing was applied to a remote database

**Implementation Note**: Pause for manual confirmation before the next phase. Deploy order for later (outside this plan): run `assign-illustrations --write` before the migration, otherwise an edited or imported `NULL` recipe gets a rule-based key that the script will not overwrite.

---

## Phase 5: Illustration preview in the form

### Overview

Read-only preview of the illustration the recipe will have; no picker.

### Changes Required:

#### 1. Preview

**File**: `src/components/recipes/RecipeFormView.tsx`, `src/components/recipes/RecipeForm.tsx`, `src/components/recipes/RecipeIllustrationPreview.tsx` (new, if a separate component keeps the view readable)

**Intent**: Show `RecipeIllustration` with a one-line caption. New recipe or stored illustration empty: `pickIllustration(form.name)` for the typed name, caption "Dobierana automatycznie po nazwie"; no match: placeholder and caption "Brak dopasowania — pokażemy ogólną ilustrację". Stored illustration present: show it, caption without the auto note (it is kept on save). Phone: next to the name field inside the name card. Desktop (`lg`): at the top of the right column, above Save/Anuluj. One caption per viewport (the other copy is hidden and decorative).

**Contract**: `RecipeFormView` gains `savedIllustration?: string | null` (from `recipe.illustration`); the request body, `toBody` and endpoints are unchanged. Tokens and `ui/` components only, flat card, no new variant unless it lives in `ui/` with tokens.

#### 2. View tests

**File**: `src/components/recipes/RecipeFormView.test.ts`

**Intent**: Markup for: new with a matching name (picked key in `src`), new with no match (placeholder, caption), edit with a stored illustration (stored key, no auto caption), edit with `NULL` (picked from name).

### Success Criteria:

#### Automated Verification:

- Tests pass: `npm test`
- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm run build` pass

#### Manual Verification:

- Phone: typing "Kanapka z serem" changes the preview next to the name; unknown name shows the placeholder
- Desktop: preview sits above Save/Anuluj in the right column
- Edit of a recipe with an illustration shows it and saving keeps it; a new recipe saves with the previewed illustration (checked on the local database)

**Implementation Note**: Pause for manual confirmation before the next phase.

---

## Phase 6: Kitchen sink and final gate

### Overview

Document the states and leave the guard rule.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/components/dev/KitchenSink.tsx`

**Intent**: Extend the existing form sections (`SampleRecipeForm`) with: one ingredient expanded plus summaries, an error in a collapsed ingredient, open substitutes, nutrition open/closed, banner, submitting, and the illustration preview (match, no match, stored). Cover the 7-state matrix (default, hover, focus-visible, disabled, error, empty, loading) or mark N/A with a reason.

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
- Illustration rules (Phase 4): shared case file through `pickIllustration`, key validity and SVG existence; the same file through the real trigger on the local database (`check:illustration-rules`), including the grant and no-overwrite checks.
- Preview markup (Phase 5): picked, no match, stored, `NULL` on edit.

### Manual Testing Steps:

1. Add a recipe at phone width: add three ingredients, collapse and expand, values survive.
2. Submit with errors in an ingredient name, a substitute and nutrition; check what opens and where focus lands.
3. Edit an 8-ingredient recipe: it starts collapsed; fix an error through a banner link.
4. Remove ingredient 2 while 4 is open: 4 stays the open one.

## Performance Considerations

None; the row count is bounded by `MAX_INGREDIENTS`. The trigger runs a handful of regex tests per insert or name update.

## Migration Notes

Phase 4 adds one additive migration (one function in `private`, one trigger); it is applied to the local database only. Existing rows are untouched. Applying it remotely is a separate, later step; run `assign-illustrations --write` first so the accepted map wins over rule-based keys. Rolling back means dropping the trigger and the function.

## References

- Analysis in the planning conversation; mockups M13, M14, M22 (B), M25, D04 in `.tmp-style-review/` (local, uncommitted)
- Similar change: `context/changes/soft-modern-recipe-details/plan.md`
- Illustrations: `src/lib/recipes/illustrations.ts`, `supabase/migrations/20261027120000_add_recipe_illustration.sql`, `scripts/assign-illustrations.ts`, `context/changes/soft-modern-pantry-recipes/illustration-map.md`
- Trigger and `private` schema precedents: `supabase/migrations/20261018120000_add_recipe_update_delete_own.sql:31`, `20261020120000_add_admin_manages_any_recipe.sql:32`
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

- [x] 2.1 Lint, `check:ui` and types pass: `npm run lint`, `npm run check:ui`, `npx astro check` — de70bfe
- [x] 2.2 Tests pass: `npm test` — de70bfe

#### Manual

- [ ] 2.3 Phone: one ingredient open, the others summaries; collapse then expand keeps typed values
- [ ] 2.4 Desktop: all ingredients expanded, fields in one row

### Phase 3: Form view

#### Automated

- [x] 3.1 Tests pass: `npm test`
- [x] 3.2 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm run build` pass

#### Manual

- [ ] 3.3 Failed save opens the right section and focuses the first invalid field; banner links open and focus their targets
- [ ] 3.4 Removing an ingredient does not open another one
- [ ] 3.5 The sticky bar never blocks scrolling to fields or errors; save works for new and edit; edit still shows 404 for non-authors

### Phase 4: Illustration rules (TS + SQL)

#### Automated

- [x] 4.1 TS rules pass the shared cases: `npx vitest run src/lib/recipes`
- [x] 4.2 Migration applies to the local database: `npx supabase migration up --local`
- [x] 4.3 SQL and TS agree on the shared cases and the grants hold: `npm run check:illustration-rules` (local database)
- [x] 4.4 `npm run lint`, `npx astro check`, `npm test` pass

#### Manual

- [ ] 4.5 Migration reviewed: no grant or policy change, no `SECURITY DEFINER`, the function in `private`
- [ ] 4.6 Nothing was applied to a remote database

### Phase 5: Illustration preview in the form

#### Automated

- [ ] 5.1 Tests pass: `npm test`
- [ ] 5.2 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm run build` pass

#### Manual

- [ ] 5.3 Phone: typing a name changes the preview next to it; unknown name shows the placeholder
- [ ] 5.4 Desktop: preview sits above Save/Anuluj in the right column
- [ ] 5.5 Edit keeps a stored illustration; a new recipe saves with the previewed one (local database)

### Phase 6: Kitchen sink and final gate

#### Automated

- [ ] 6.1 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`, `npm run build` pass
- [ ] 6.2 The hard-coded value scan on the form files returns 0 hits

#### Manual

- [ ] 6.3 Screenshots at desktop and one phone width, light and dark
- [ ] 6.4 Aggregate mockup comparison left open for the M-2 close
