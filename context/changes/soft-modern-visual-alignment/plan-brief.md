# Soft Modern visual alignment — Plan Brief

> Full plan: `context/changes/soft-modern-visual-alignment/plan.md`
> Findings: `context/changes/soft-modern-visual-alignment/visual-findings.md`

## What & Why

The aggregate comparison of M-2 with the mockups (D01–D05, M01–M22) found discrepancies, so M-2 is not closed. This change fixes them: 182 findings with stable ids, each mapped to a phase or kept with a reason. Presentation only; the mockups are visual references, not instructions.

## Starting Point

Desktop content is too narrow (`max-w-5xl`, `max-w-6xl` only on the home page), typography from shared components is lighter than the mockups, tiles and details are squeezed, the details macro is a separate card, and several auth, overlay and state screens differ in proportions, weights and colors.

## Desired End State

One shared desktop width for content and header, calmer consistent typography, equal-size desktop tiles without cut information (mobile keeps M10A), D03/D04/D01 compositions, the form and success screens as in M13/M16, and auth, dialogs, 404 and the account menu close to their mockups, in both themes. Every finding ends with a final status.

## Key Decisions Made

| Decision                             | Choice                                                                                                                    | Why (1 sentence)                                              | Source             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------ |
| Author actions (M12A-01)             | Keep the popover, restyle with M21                                                                                        | A working accessible flow; recorded as a deviation            | Author, 2026-10-28 |
| Illustration on mobile form (M13-07) | Preview stays in the name card                                                                                            | Less empty space before the first card                        | Author, 2026-10-28 |
| "Zmiany zapisane" (M16-10)           | Not added                                                                                                                 | Beyond a visual correction                                    | Author, 2026-10-28 |
| Dimming behind account menu (M21-04) | None                                                                                                                      | Keeps the earlier simplification and the dismissal behaviour  | Author, 2026-10-28 |
| Order                                | Container/navbar/typography, list and tiles, pantry sheet, details, form and success, auth and overlays, final comparison | Later screens inherit the shared width and type scale         | Author             |
| Values                               | Chosen against rendered screens at matching widths, written once as tokens or shared classes                              | 780 px exports are not CSS pixels                             | Author             |
| Desktop tiles                        | One size across the whole grid, sized for the longest accepted case                                                       | No cut substitute information, no low cards next to tall ones | Author             |
| Checks                               | Existing checks plus a look at desktop and phone, both themes                                                             | No new infrastructure                                         | Author             |

## Scope

**In scope:** shared container, navbar and typography; list, tiles and states; pantry sheet and filters notice; details; form and success screen; auth, M04, dialogs, 404, account menu; final comparison.

**Out of scope:** data, validation, permissions, API, migrations, illustration rules (M-3); bottom sheet for author actions, "Zmiany zapisane" bubble, menu dimming, drag gesture, Back handling, "Jak to działa?"; copying the descriptive notes of mockups; new dependencies, screenshot baselines, a new audit.

## Architecture / Approach

Shared components (`label`, `button`, layout, header) and tokens in `global.css` carry the typography, width and color fixes; views only compose them. Seven phases, one commit each, with a pause for the author's visual check.

## Phases at a Glance

| Phase                             | What it delivers                                                            | Key risk                                                  |
| --------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1. Containers, navbar, typography | One width, stronger labels and buttons, equal navbar controls               | A global weight change overshoots some mobile headings    |
| 2. List and tiles                 | D02/D05 proportions, equal desktop tiles, M05/M08/M09/M19 states, dark dots | Equal height cutting long substitute or missing-item text |
| 3. Pantry sheet and filters       | Taller sheet with handle, M07b notice                                       | Keyboard and many products                                |
| 4. Recipe details                 | Top card with macro, 1/3–2/3 split, M11/M18                                 | Desktop and phone share one component                     |
| 5. Form and success               | D04, M13/M14/M22 B, M16                                                     | Aligning number and bin without margin hacks              |
| 6. Auth, messages, overlays       | D01, M01–M04, M12B, M20, M21                                                | Neutral login error if the text comes from the API        |
| 7. Final comparison               | Remaining comparisons, kitchen sink, M-2 decision                           | Newly visible discrepancies                               |

**Prerequisites:** soft-modern-recipe-form phase 6 committed (`8a1e540`); the local mockups in `.tmp-style-review/`.
**Estimated effort:** about 5–7 sessions across 7 phases.

## Open Risks & Assumptions

- Container width, panel ratio and tile size are decided during phases 1–2 by comparing proportions; they are not fixed numbers yet.
- If the sign-in error text is produced by the API, the UI picks neutral wording and the API stays unchanged.
- Dark-theme token values change in `global.css`; light and dark must both be checked after each token edit.
- 8 findings are "not yet compared" and are compared in their phase; M-2 closes only after phase 7.

## Success Criteria (Summary)

- All 119 `do poprawy` findings fixed and the 8 `jeszcze nieporównane` points compared; the 55 accepted deviations still hold.
- Lint, `check:ui`, `astro check`, tests and build stay green; desktop and phone looked at in both themes.
- Data semantics, validation, permissions and API behaviour unchanged.
