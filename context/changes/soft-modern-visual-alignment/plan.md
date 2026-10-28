# Soft Modern visual alignment Implementation Plan

## Overview

Correct the discrepancies found in the aggregate comparison of M-2 with the mockups (D01–D05, M01–M22). The 182 findings are in `visual-findings.md` with stable ids, a mockup reference, a scope and a status; this plan assigns each one to a phase or keeps it with a reason (section "Finding map"). Presentation only: data semantics, validation, permissions and API behaviour do not change. Illustration rules are not touched (M-3). The mockups are visual references, not instructions: proportions are compared at matching widths, and 780 px exports are not 780 CSS px.

## Current State Analysis

- Containers: `AppLayout.astro:17` and `AppHeader.astro:21` use `max-w-5xl`, or `max-w-6xl` when the `wide` prop is set (only `pages/index.astro:29` sets it). The details page and the form therefore use the narrow width; the header inner width follows the same prop.
- The list: `PantryMatch.tsx:141` is `lg:grid-cols-3` (panel 1/3, results 2/3) with tiles in `lg:grid-cols-2` (`:214`). The panel takes the room the tiles need for titles and missing items.
- Details: `RecipeDetails.tsx:102` splits ingredients and steps `md:grid-cols-5` (2/5 and 3/5); the macro is a separate card; the illustration strip on phone is tall.
- Typography: `ui/label.tsx` is `font-medium`; button and label weights come from shared components, so one token change reaches every screen (and may overshoot some mobile headings, e.g. "Co masz dziś w domu?").
- Error handling after a refresh failure: `PantryMatch.tsx:197` shows `LoadError` above the list and the previous results stay, so the "outdated results" marking (M19-02/03) is a UI-only change.
- The auth screens are `AuthShell.astro` with `SignInForm`/`SignUpForm`/`FormField`/`SubmitButton`/`ServerError`; M04 is `pages/auth/confirm-email.astro`; 404 is `NotFoundView.astro`; the account menu is the Popover in `AppHeader.astro`; the delete dialog is `RecipeAuthorActions.tsx` with `ui/alert-dialog.tsx`.
- Existing analyses to reuse (no new audit): `context/changes/soft-modern-*/` research, plans and verification of the earlier views, and `palette.md` of `soft-modern-foundation-auth` for token values.

## Desired End State

Every `do poprawy` finding is fixed, every `jeszcze nieporównane` point has been compared on matching screenshots and either fixed or recorded, and every accepted deviation is still true. One content width and one header width on desktop; calmer, consistent typography from shared components; desktop tiles of one size across the whole grid without cut information; mobile tiles keep M10A (height follows content). Verified by the existing checks and by looking at desktop and phone, in both themes. M-2 is closed only after phase 7.

### Key Discoveries:

- `AppLayout.astro:17` / `AppHeader.astro:21` — one place decides both widths; the fix is a single shared width, not per-page widths.
- `PantryMatch.tsx:141,214` — the panel/list proportion and the tile grid are two classes; `auto-rows-fr` over the single tile grid equalises every row of the grid, not only one row.
- `ui/label.tsx`, `ui/button.tsx` — weight and size tokens live here; `src/components/ui/` is not scanned by `check:ui`, so a new variant there must use tokens only.
- Decisions of 2026-10-28 (author): keep the author-actions popover (M12A-01), keep the preview in the name card (M13-07), no "Zmiany zapisane" bubble (M16-10), no dimming behind the account menu (M21-04).

## What We're NOT Doing

- Changes to data shape, validation, permissions, endpoints, RLS, migrations, matching or illustration rules (M-3).
- Rebuilding the author actions as a bottom sheet, the "Zmiany zapisane" bubble, dimming behind the account menu, a drag gesture or special Back handling in the pantry sheet, "Jak to działa?" (deferred earlier).
- Copying descriptive notes of the mockups (the white notes in M04 and M07b), the 780 px export size, the keyboard-area height of M07, or message texts only because the mockup has other words (M19).
- New dependencies, a new test infrastructure, a new broad audit, subagents or an extra review pass; screenshot baselines (the visual gate is looking at both themes and both sizes).
- Push, PR, remote migrations, deployment.

## Implementation Approach

Seven phases, each one commit, in the order of dependency: shared width, navbar and typography first (every later screen inherits them), then the list and tiles, the pantry sheet, details, form and success, auth and overlays, and a final comparison. Values (container width, panel ratio, tile size, weights) are chosen against the rendered screens by comparing proportions at matching widths, and then written once as tokens or shared classes; no arbitrary values (`p-[13px]`) and no literal colors. A dark-theme or light-theme fix is made in the token layer (`:root` / `.dark` in `global.css`) or a `ui/` variant, never as a theme override in a view. After each phase: the existing checks, a look at desktop (about 1280 and 1440 px) and phone (390 px), light and dark, with the checked screens named in the phase. Each phase pauses for the author's visual check before its commit.

## Phase 1: Containers, navbar and typography

### Overview

One shared desktop width for content and header, a consistent type scale, and a navbar with equal controls. Covers G-01…G-12.

### Changes Required:

#### 1. One content width

**File**: `src/layouts/AppLayout.astro`, `src/components/AppHeader.astro`, `src/pages/index.astro`

**Intent**: Widen the container to the proportions of D02–D04 and use the same width for the header's inner part, with reasonable side margins and a maximum on very large screens. Retire the `wide` split so list, details and form share one width.

**Contract**: A single width class (from the Tailwind scale) shared by `main` and the header inner `div`; `AppLayout` and `AppHeader` lose the `wide` prop (the home page stops passing it). Side margins `px-4 sm:px-8` stay unless the comparison says otherwise.

#### 2. Typography and navbar

**File**: `src/components/ui/label.tsx`, `src/components/ui/button.tsx`, `src/components/ThemeToggle.tsx`, `src/components/AppHeader.astro`, `src/components/Logo.astro`, `src/styles/global.css` (only if a token is needed)

**Intent**: Restore the hierarchy of the mockups (stronger labels, button texts and headings; calm helper text) through the shared components, without enlarging everything: mobile headings that already dominate stay as they are. Make the theme toggle and "Wyloguj" the same height, alignment and rounding (widths follow content), match logo size and weight to the mockups, keep the mobile "+" and account button, leave the sign-out logic and permissions untouched.

**Contract**: Weight and size changes are made in `label.tsx` / `button.tsx` variants or a shared class, not per view; the toggle and "Wyloguj" use the same button size token.

### Success Criteria:

#### Automated Verification:

- Lint, UI literal guard and types pass: `npm run lint`, `npm run check:ui`, `npx astro check`
- Tests pass: `npm test`
- Build passes (Astro layout files changed): `npm run build`

#### Manual Verification:

- Home, a recipe page and the form at about 1280 and 1440 px: the same content width, header inner width equal to it, margins reasonable on very large screens (G-01…G-04)
- Typography on desktop and phone, light and dark: labels and buttons stronger, no mobile heading enlarged (G-05…G-08)
- Navbar: toggle and "Wyloguj" equal height and rounding; "+" and account button on phone unchanged (G-09…G-12)

**Implementation Note**: After this phase and its automated checks, pause for the author's visual check before the commit.

---

## Phase 2: List and tiles

### Overview

The pantry view on desktop and the tiles, empty, loading, no-results and error states. Covers D02, M05, M10, M08, M09, M19.

### Changes Required:

#### 1. List layout and tiles

**File**: `src/components/pantry/PantryMatch.tsx`, `src/components/recipes/RecipeTile.tsx`, `src/components/pantry/PantrySummary.tsx`

**Intent**: Give the results the room of D02/D05 (panel ratio matched to the list so titles and missing items are not squeezed) and make desktop tiles equal in height within each row (tile `h-full` in the grid row; rows may differ, decided 2026-10-28 after measuring real data: whole-grid equality let one 236 px tile make 15 of 21 tiles 88 px too tall) with nothing cut or overlapped (three-line title, missing items, substitute information). Mobile keeps M10A: height follows the content, percentage next to the time, title up to three lines. Fix the metadata hierarchy and spacing, the percentage (stronger text, proper fill, no outline), "+N" never alone on a row, and the list header hierarchy.

**Contract**: The agreed name and missing-items limits stay; tile data and ordering are untouched.

#### 2. States

**File**: `src/components/pantry/PantryStates.tsx`, `src/components/ui/skeleton.tsx`, `src/components/pantry/PantryMatch.tsx`, `src/styles/global.css`

**Intent**: M05: lower the prompt card, calm "Co masz dziś w domu?" (about one line at a typical phone width, not forced on the narrowest), fix the "Dodaj produkty…" button layout, spacing and description typography. M08: neutral skeleton color, shapes and spacing of the corrected M10A tile, percentage place as in the tile, height derived from the tile. M09: slightly larger icon circle, tags without borders and stronger text, card spacing, stronger and better sized "Zmień wykluczenia". M19: spacing and weights; keep the previous results after a refresh error, mark them outdated and dim them, and distinguish that case from a first failed load without results. M17: the dark-theme "Mam / Stałe / Wykluczam" dots less pastel, changed in the `.dark` token values.

**Contract**: No change to `usePantryMatch` behaviour or to messages beyond spacing and weight; dark dot colors are token values.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check:ui`, `npx astro check`
- Tests pass: `npm test`

#### Manual Verification:

- Desktop (1280 and 1440, light and dark): proportions against D02/D05, tiles equal within each row, no cut substitute information (D02-01…07, D02-05 accepted as row-equal), checked with a long-title, a long-missing and a substitute recipe
- Phone (390, light and dark): M05, M10A tiles, M08, M09, M19 states; the first load shows skeletons and later filtering dims the previous results (M08-05, M08-06); "Pokaż więcej" compared (M10-11)

**Implementation Note**: Pause for the author's visual check before the commit.

---

## Phase 3: Pantry sheet and filters

### Overview

The pantry sheet and the "filters not applied" notice. Covers M07 and M07B.

### Changes Required:

#### 1. Sheet

**File**: `src/components/pantry/PantryEditor.tsx`, `src/components/pantry/TagInput.tsx`, `src/components/pantry/sections.tsx`

**Intent**: A taller panel with scrolling content and the action at the bottom (the height comes from the viewport, not from the keyboard area of the drawing), a short visual handle at the top (no drag gesture), stronger header, tabs, counters and buttons, calmer tag borders, a checked active field focus, content reachable with many products and the keyboard open.

**Contract**: "Dodaj" stays disabled for an empty field; tags and typed text are kept after closing; no special Back handling.

#### 2. Filters not applied

**File**: `src/components/pantry/PantrySummary.tsx` or `src/components/pantry/PantryStates.tsx` (where the notice lives)

**Intent**: White background and an amber border instead of the yellow fill in the light theme, matched rounding and border thickness, stronger counters and action texts, "Wyniki dla poprzedniej spiżarki" kept.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`

#### Manual Verification:

- Phone, light and dark: the sheet against M07 with few and with many products and the keyboard open; M07b against the mockup (M07-01…07, M07B-01…03)

**Implementation Note**: Pause for the author's visual check before the commit.

---

## Phase 4: Recipe details

### Overview

Details on desktop and phone. Covers D03 and M11/M18.

### Changes Required:

#### 1. Desktop top card and split

**File**: `src/components/recipes/RecipeDetails.tsx`, `src/components/recipes/RecipeAuthorActions.tsx`

**Intent**: Desktop: the macro belongs to the top card: illustration on the left, on the right the title, author actions, pills and nutrition values (left-aligned, full labels such as "węglowodany"); the separate full-width macro card disappears on desktop. The lower split becomes about 1/3 ingredients and 2/3 steps (`md:grid-cols-3`, 1 and 2). Headings, content and section spacing match the mockup; author actions sit as in the top-card composition. The page uses the widened container from phase 1.

**Contract**: Mobile macro stays a separate card; missing optional data creates no empty elements; steps keep real `recipe.steps` numbers; the illustration stays smaller than the huge tile of D03 (accepted).

#### 2. Phone

**File**: `src/components/recipes/RecipeDetails.tsx`

**Intent**: A more compact illustration strip, full-width title and pills, light theme time and servings on white, dark theme pill backgrounds less lightened, stronger pill labels, spacing between title, metadata and macro, a separator under the ingredients header (also before the first item), dark macro tiles darker than the card. Tokens in `global.css` or a variant, no literal colors.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test` (the details markup test is updated where the structure of the top card changes)

#### Manual Verification:

- Desktop (1280, 1440, both themes) against D03: top card, left-aligned macro, 1/3 and 2/3 split (D03-01…10)
- Phone (390, both themes) against M11/M18 including the lower part with ingredients and steps (M11-01…08, M11-13)

**Implementation Note**: Pause for the author's visual check before the commit.

---

## Phase 5: Form and success screen

### Overview

The recipe form (desktop and phone) and the "Przepis dodany" screen. Covers D04, M13/M14/M22 B and M16.

### Changes Required:

#### 1. Desktop form

**File**: `src/components/recipes/RecipeFormView.tsx`, `src/components/recipes/IngredientFields.tsx`, `src/components/recipes/RecipeIllustrationPreview.tsx`

**Intent**: Widths and column proportions as in D04 (on the phase 1 container); the preview becomes a large square filling the width of the right card, caption and "Zapisz / Anuluj" below it; stronger headings, labels and buttons; on desktop the nutrition fields move inside "Dodatkowe informacje" (the separate collapsible card stays on phone); lower ingredient rows (paddings, spacing, the helper text place) with number, fields and bin in one row; number and bin alignment must not depend on field-height margins, also with errors and longer labels.

**Contract**: Disclosure state stays keyed by row `key`; collapsed content stays mounted; request body and validation unchanged.

#### 2. Phone form

**File**: `src/components/recipes/RecipeFormView.tsx`, `src/components/recipes/IngredientFields.tsx`

**Intent**: A more compact bar "× Dodaj/Edytuj przepis" and less empty space before the first card; stronger labels, headings and buttons; the error banner with a stronger heading and visibly bulleted links; icons by field error messages; red borders and the order of opening sections and focus kept. The preview stays in the name card (decided).

#### 3. "Przepis dodany"

**File**: `src/components/recipes/RecipeSaved.tsx`

**Intent**: Without the bordered card around the whole screen: a large centered success icon in a light circle, a strong heading, a separate white summary card (time and servings when they exist), two full-width 48 px actions outside the card (main olive, secondary filled), matched vertical spacing.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test` (form and saved-screen markup tests adjusted to the new structure)
- `npm run build`

#### Manual Verification:

- Desktop `/recipes/new` and edit against D04 in both themes (D04-01…08), with a failed save and a long label
- Phone against M13/M14/M22 B including an expanded substitute with an error, an invalid step and the lower sections (M13-01…06, M13-13…15)
- "Przepis dodany" against M16 in both themes (M16-01…09)

**Implementation Note**: Pause for the author's visual check before the commit.

---

## Phase 6: Auth, messages and overlays

### Overview

Sign-in and sign-up, check-your-mail, the delete dialog, 404 and the account menu. Covers D01, M01–M04, M12A (styling only), M12B, M20, M21.

### Changes Required:

#### 1. Auth screens

**File**: `src/components/auth/AuthShell.astro`, `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/FormField.tsx`, `src/components/auth/SubmitButton.tsx`, `src/components/auth/ServerError.tsx`, `src/pages/auth/confirm-email.astro`

**Intent**: Desktop D01: a wider form, a larger logo, stronger labels and main button, the slogan as a compact two-line block and a matching subtitle width and breaking. Phone: stronger labels and buttons, logo proportions, the small sign-in illustration crossing the band edge, a compact sign-up band, the minimum password length hint taken from the real validation constant. Password errors: a red border, a warning icon, the message under the right field, correct empty and mismatched-repeat states, a focus ring that keeps the error visible. M04: stronger button text and width, the logo shared with the other auth screens, both variants checked in the shared layout.

**Contract**: The general sign-in error must not reveal whether the e-mail or the password is wrong; if the text comes from the API, the API is left as it is and the UI chooses the neutral wording. No change to validation or the auth flow.

#### 2. Overlays and 404

**File**: `src/components/ui/alert-dialog.tsx`, `src/components/recipes/RecipeAuthorActions.tsx`, `src/components/AppHeader.astro`, `src/components/NotFoundView.astro`

**Intent**: M12B: a white dialog background in the light theme, stronger button labels, matched rounding and spacing, a smaller icon circle. M21: larger rounding, a calmer border, the shadow of the design, matched icon, text and spacing sizes, no dimming (decided). The author-actions popover takes the same popover styling (M12A-01 stays a recorded deviation). M20: the block moved toward the middle of the available area, a larger icon circle with a calmer icon, matched spacing, button width and weight.

**Contract**: "Usuń" stays above "Anuluj" and request-time locks stay; `ui/` changes use tokens only.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`, `npm run build`

#### Manual Verification:

- Desktop D01 and phone M01–M04 in both themes, including empty password, mismatched repeat and wrong credentials (D01-01…05, M01-01…11, M01-15, M04-01…03)
- M12b, M20 and M21 in both themes (M12B-01…04, M20-01…04, M21-01…03)

**Implementation Note**: Pause for the author's visual check before the commit.

---

## Phase 7: Final comparison

### Overview

Close the loop: compare what was left uncompared, document the states, and decide on M-2.

### Changes Required:

#### 1. Remaining comparison and states

**File**: `context/changes/soft-modern-visual-alignment/visual-findings.md`, `src/components/dev/KitchenSink.tsx`, `AGENTS.md`

**Intent**: Compare the remaining "jeszcze nieporównane" points on matching screenshots (fix small ones, record larger ones), update the kitchen sink for the states changed by phases 1–6, and add one short UI rule line about the shared container width if it is not obvious from the code. Update each finding's status to its final value.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`, `npm run build`

#### Manual Verification:

- The author's final look at the screens of phases 1–6 at desktop and phone widths in both themes
- Every finding has a final status; M-2 is closed only if no `do poprawy` or unresolved `jeszcze nieporównane` point remains

**Implementation Note**: This phase is the closing decision of M-2.

---

## Finding map

Every id of `visual-findings.md` appears below exactly once. "Fix" = status `do poprawy`; "Compare" = `jeszcze nieporównane` (compared in that phase and re-checked in phase 7); "Kept" = `wcześniej zaakceptowane odstępstwo`: no change, the deviation or decision stays and the phase must not break it.

**Phase 1: Containers, navbar and typography**

- Fix (10): G-01, G-02, G-03, G-04, G-05, G-06, G-07, G-08, G-09, G-10
- Compare (0): none
- Kept (2): G-11, G-12. Reason: prior decisions: mobile "+" and account button, sign-out logic and permissions unchanged.

**Phase 2: List and tiles**

- Fix (27): D02-01, D02-02, D02-03, D02-04, D02-06, D02-07, M05-01, M05-02, M05-03, M05-04, M05-05, M10-01, M10-02, M10-03, M10-04, M10-05, M08-01, M08-02, M08-03, M08-04, M09-01, M09-02, M09-03, M09-04, M19-01, M19-02, M19-03
- Compare (3): M10-11, M08-05, M08-06
- Kept (13): D02-05, D02-08, D02-09, D02-10, D02-11, D02-12, M10-06, M10-07, M10-08, M10-09, M10-10, M09-05, M19-04. Reason: agreed name and missing-items limits, accepted colors, M10A percentage next to the time, substitute information, data differences are not visual errors, M19 text "Brak połączenia…" is an acceptable variant.

**Phase 3: Pantry sheet and filters**

- Fix (10): M07-01, M07-02, M07-03, M07-04, M07-05, M07-06, M07-07, M07B-01, M07B-02, M07B-03
- Compare (0): none
- Kept (6): M07-08, M07-09, M07-10, M07-11, M07B-04, M07B-05. Reason: no drag gesture or Back handling, "Dodaj" disabled when empty, tags and text kept, "Jak to działa?" deferred, the white note of M07b is not an app element.

**Phase 4: Recipe details**

- Fix (18): D03-01, D03-02, D03-03, D03-04, D03-05, D03-06, D03-07, D03-08, D03-09, D03-10, M11-01, M11-02, M11-03, M11-04, M11-05, M11-06, M11-07, M11-08
- Compare (1): M11-13
- Kept (8): D03-11, D03-12, D03-13, D03-14, M11-09, M11-10, M11-11, M11-12. Reason: smaller illustration than D03 (conscious), real step numbers, no empty elements for missing data, mobile macro stays a separate card, title 20 px, extra navbar, band color follows the illustration, no author actions for other people's recipes.

**Phase 5: Form and success screen**

- Fix (23): D04-01, D04-02, D04-03, D04-04, D04-05, D04-06, D04-07, D04-08, M13-01, M13-02, M13-03, M13-04, M13-05, M13-06, M16-01, M16-02, M16-03, M16-04, M16-05, M16-06, M16-07, M16-08, M16-09
- Compare (3): M13-13, M13-14, M13-15
- Kept (11): D04-09, D04-10, D04-11, D04-12, M13-07, M13-08, M13-09, M13-10, M13-11, M13-12, M16-10. Reason: right column with preview and actions, no "Zmień", placeholder, stored illustration not changed on rename, M22 B and one expanded ingredient on phone, no bin for a single ingredient, mobile save bar, automatic preview, decisions of 2026-10-28 (preview in the name card; no "Zmiany zapisane" bubble).

**Phase 6: Auth, messages and overlays**

- Fix (30): D01-01, D01-02, D01-03, D01-04, D01-05, M01-01, M01-02, M01-03, M01-04, M01-05, M01-06, M01-07, M01-08, M01-09, M01-10, M01-11, M04-01, M04-02, M04-03, M12B-01, M12B-02, M12B-03, M12B-04, M20-01, M20-02, M20-03, M20-04, M21-01, M21-02, M21-03
- Compare (1): M01-15
- Kept (16): D01-06, D01-07, D01-08, D01-09, M01-12, M01-13, M01-14, M04-04, M04-05, M04-06, M04-07, M12A-01, M12B-05, M12B-06, M20-05, M21-04. Reason: two halves and palette, four-illustration composition, theme toggle, other drawings than D01, login error banner, "Załóż konto", ready illustrations, M04 variants and icon circle, "Usuń" above "Anuluj" and locks, 404 content and target, decisions of 2026-10-28 (author-actions popover kept, no dimming behind the menu).

**Phase 7: Final comparison**: re-checks every "Compare" id above, confirms every "Kept" id still holds and gives each finding its final status.

Coverage: 182 of 182 ids mapped, each once.

## Testing Strategy

### Unit Tests:

- Existing Vitest suites must stay green. Markup tests are adjusted only where a structure changes: the details top card with the macro (phase 4), the form and the saved screen (phase 5).
- No new test infrastructure; no screenshot baselines.

### Manual Testing Steps:

1. For each phase, look at the screens named in its manual criteria at about 1280 and 1440 px and at 390 px, in the light and the dark theme.
2. Check the behaviour next to the look where the finding is behavioural (skeleton, dimmed previous results, sheet with the keyboard, failed save, wrong credentials).
3. Compare proportions with the mockup at the matching width, not pixel sizes of the 780 px exports.

## Performance Considerations

None expected; equal-height grid rows and CSS changes only.

## Migration Notes

None: no schema, data or API change.

## References

- Findings: `context/changes/soft-modern-visual-alignment/visual-findings.md`
- Earlier views, research and plans: `context/changes/soft-modern-recipe-form/`, `context/changes/soft-modern-recipe-details/`, `context/changes/soft-modern-pantry-recipes/`, `soft-modern-foundation-auth` (palette)
- Containers and grid: `src/layouts/AppLayout.astro:17`, `src/components/AppHeader.astro:21`, `src/components/pantry/PantryMatch.tsx:141`, `src/components/recipes/RecipeDetails.tsx:102`
- Mockups: `.tmp-style-review/` (local, not committed)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Containers, navbar and typography

#### Automated

- [x] 1.1 Lint, UI literal guard and types pass: `npm run lint`, `npm run check:ui`, `npx astro check`
- [x] 1.2 Tests pass: `npm test`
- [x] 1.3 Build passes: `npm run build`

#### Manual

- [x] 1.4 One content width and header width, reasonable margins on very large screens (G-01…G-04)
- [x] 1.5 Typography on desktop and phone, light and dark, no mobile heading enlarged (G-05…G-08)
- [x] 1.6 Navbar: toggle and "Wyloguj" equal height and rounding; phone "+" and account button unchanged (G-09…G-12)

### Phase 2: List and tiles

#### Automated

- [x] 2.1 `npm run lint`, `npm run check:ui`, `npx astro check` — f54a1da
- [x] 2.2 Tests pass: `npm test` — f54a1da

#### Manual

- [x] 2.3 Desktop against D02/D05: proportions, tiles equal within each row, no cut substitute information (D02-01…07) — f54a1da
- [ ] 2.4 Phone: M05, M10A tiles, M08, M09, M19 states, skeletons and dimming behaviour, "Pokaż więcej"

### Phase 3: Pantry sheet and filters

#### Automated

- [x] 3.1 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test` — fe6de2d

#### Manual

- [ ] 3.2 Sheet against M07 with few and many products and the keyboard open; M07b against the mockup

### Phase 4: Recipe details

#### Automated

- [x] 4.1 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test` — 0d1f374

#### Manual

- [x] 4.2 Desktop against D03: top card, left-aligned macro, 1/3 and 2/3 split
- [x] 4.3 Phone against M11/M18 including the lower part — 0d1f374

### Phase 5: Form and success screen

#### Automated

- [x] 5.1 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test` — bbf40f3
- [x] 5.2 Build passes: `npm run build` — bbf40f3

#### Manual

- [ ] 5.3 Desktop form against D04 in both themes, with a failed save and a long label
- [x] 5.4 Phone form against M13/M14/M22 B including substitute error, invalid step and lower sections
- [x] 5.5 "Przepis dodany" against M16 in both themes

### Phase 6: Auth, messages and overlays

#### Automated

- [x] 6.1 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`, `npm run build` — 4db569b

#### Manual

- [ ] 6.2 Desktop D01 and phone M01–M04 in both themes, including empty password, mismatched repeat and wrong credentials
- [x] 6.3 M12b, M20 and M21 in both themes

### Phase 7: Final comparison

#### Automated

- [x] 7.1 `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`, `npm run build`

#### Manual

- [x] 7.2 The author's final look at the screens of phases 1–6, desktop and phone, both themes
- [x] 7.3 Every finding has a final status; M-2 closed only if no `do poprawy` or unresolved `jeszcze nieporównane` point remains
