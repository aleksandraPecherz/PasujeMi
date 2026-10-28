# Visual findings: M-2 against the mockups

Source: the analyst's list from the aggregate comparison (after soft-modern-recipe-form phase 6, commit `8a1e540`), pasted by the author on 2026-10-28 and accepted as material for the correction plan. Every point of the list is kept here; nothing is merged away.

**Ids** are stable: `<screen>-<nn>`. They are never renumbered; a new finding gets the next number of its screen. **Scope**: desktop, mobile, both. **Status** is one of:

- **do poprawy** — a discrepancy to fix;
- **wcześniej zaakceptowane odstępstwo** — a decision the author already made (includes every "Zostaje" point of the list: what stays, whether or not the mockup differs). An earlier "looks OK" is not consent to discrepancies shown later;
- **wymaga decyzji** — the author decides before the plan is final;
- **jeszcze nieporównane** — not yet compared on matching screenshots; to be compared during implementation.

Mockups are visual references, not instructions. Proportions are compared at matching widths; 780 px exports are not 780 CSS px. Phase column: filled in `plan.md` (the plan maps every id to a phase or to a reason for leaving it).

## G: the whole app

| Id   | Scope   | Mockup  | Finding                                                                                                                               | Status                             |
| ---- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| G-01 | desktop | D02–D04 | Content containers are too narrow compared with D02–D04: a large part of the screen stays empty, cards, fields and text are squeezed. | do poprawy                         |
| G-02 | desktop | D02–D04 | Widen the content container and match the inner width of the navbar to it.                                                            | do poprawy                         |
| G-03 | desktop | D02–D04 | Keep reasonable side margins and a maximum width on very large screens.                                                               | do poprawy                         |
| G-04 | desktop | D02–D04 | The widening covers list, details and form consistently, not as separate accidental widths.                                           | do poprawy                         |
| G-05 | both    | all     | Typography: field labels, button texts and some headings are lighter than in the mockups.                                             | do poprawy                         |
| G-06 | both    | all     | Restore the hierarchy: strong headings and actions, readable content, calmer helper text.                                             | do poprawy                         |
| G-07 | mobile  | M05     | Do not enlarge everything automatically: some mobile headings already dominate, above all "Co masz dziś w domu?".                     | do poprawy                         |
| G-08 | both    | all     | Unify the scale through shared components and tokens.                                                                                 | do poprawy                         |
| G-09 | both    | navbar  | Theme toggle and "Wyloguj" have the same height, alignment and rounding; widths may follow content.                                   | do poprawy                         |
| G-10 | both    | navbar  | Match logo size and text weight to the mockups.                                                                                       | do poprawy                         |
| G-11 | mobile  | navbar  | Keep the mobile "+" and the account button.                                                                                           | wcześniej zaakceptowane odstępstwo |
| G-12 | both    | navbar  | No change to the sign-out logic or permissions.                                                                                       | wcześniej zaakceptowane odstępstwo |

## D01: sign-in on desktop

| Id     | Scope   | Mockup | Finding                                                                                                            | Status                             |
| ------ | ------- | ------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| D01-01 | desktop | D01    | Widen the form relative to the right half of the screen.                                                           | do poprawy                         |
| D01-02 | desktop | D01    | Enlarge the logo to proportions closer to D01.                                                                     | do poprawy                         |
| D01-03 | desktop | D01    | Strengthen the labels "E-mail" and "Hasło" and the main button text.                                               | do poprawy                         |
| D01-04 | desktop | D01    | Narrow the slogan "Gotuj z tego, co już masz w domu." into a compact block, closer to the two lines of the design. | do poprawy                         |
| D01-05 | desktop | D01    | Match the width and line breaking of the subtitle under the slogan.                                                | do poprawy                         |
| D01-06 | desktop | D01    | Two halves and the accepted palette stay.                                                                          | wcześniej zaakceptowane odstępstwo |
| D01-07 | desktop | D01    | The composition of four illustrations from the existing library stays.                                             | wcześniej zaakceptowane odstępstwo |
| D01-08 | desktop | D01    | The subtitle by the form and the theme toggle stay.                                                                | wcześniej zaakceptowane odstępstwo |
| D01-09 | desktop | D01    | Illustrations differ from the original D01; accepted.                                                              | wcześniej zaakceptowane odstępstwo |

## D02/D05: pantry and results on desktop

| Id     | Scope   | Mockup   | Finding                                                                                                                                           | Status                             |
| ------ | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| D02-01 | desktop | D02, D05 | Widen the whole view and the results area.                                                                                                        | do poprawy                         |
| D02-02 | desktop | D02, D05 | Match the pantry panel proportion to the list: the panel must not take the room that tile titles and missing items need.                          | do poprawy                         |
| D02-03 | desktop | D02, D05 | Restore readable sizes of illustrations, titles and metadata.                                                                                     | do poprawy                         |
| D02-04 | desktop | D02, D05 | Strengthen the pantry header and the main actions.                                                                                                | do poprawy                         |
| D02-05 | desktop | D02, D05 | Desktop tiles have one size across the whole grid, not only within a row.                                                                         | do poprawy                         |
| D02-06 | desktop | D02, D05 | Short recipes must not make low cards next to much taller ones.                                                                                   | do poprawy                         |
| D02-07 | desktop | D02, D05 | Equal heights must not cut the substitute information or make content overlap; longer cases are taken into account when the shared layout is set. | do poprawy                         |
| D02-08 | desktop | D02, D05 | Keep the agreed limits of the name and of the presentation of missing items.                                                                      | wcześniej zaakceptowane odstępstwo |
| D02-09 | desktop | D02, D05 | Light and dark theme colors are accepted.                                                                                                         | wcześniej zaakceptowane odstępstwo |
| D02-10 | desktop | D02, D05 | Percentage next to the time (M10A) instead of the older D02/D05 layout.                                                                           | wcześniej zaakceptowane odstępstwo |
| D02-11 | desktop | D02, D05 | The information about a used substitute stays.                                                                                                    | wcześniej zaakceptowane odstępstwo |
| D02-12 | desktop | D02, D05 | Differences in data, order and the number of local recipes are not visual errors.                                                                 | wcześniej zaakceptowane odstępstwo |

## D03: recipe details on desktop

| Id     | Scope   | Mockup | Finding                                                                                   | Status                             |
| ------ | ------- | ------ | ----------------------------------------------------------------------------------------- | ---------------------------------- |
| D03-01 | desktop | D03    | Macro belongs to the top card, together with the title and metadata.                      | do poprawy                         |
| D03-02 | desktop | D03    | Illustration on the left of the top card.                                                 | do poprawy                         |
| D03-03 | desktop | D03    | On the right: title, author actions, pills and nutrition values.                          | do poprawy                         |
| D03-04 | desktop | D03    | Remove the separate full-width macro card on desktop.                                     | do poprawy                         |
| D03-05 | desktop | D03    | Align nutrition values to the left.                                                       | do poprawy                         |
| D03-06 | desktop | D03    | Use full labels on desktop (e.g. "węglowodany") instead of the mobile abbreviation.       | do poprawy                         |
| D03-07 | desktop | D03    | Widen the page.                                                                           | do poprawy                         |
| D03-08 | desktop | D03    | Bottom split closer to 1/3 ingredients and 2/3 steps, instead of the current 2/5 and 3/5. | do poprawy                         |
| D03-09 | desktop | D03    | Match the size and weight of headings and content, and the spacing between sections.      | do poprawy                         |
| D03-10 | desktop | D03    | Place author actions according to the top-card composition.                               | do poprawy                         |
| D03-11 | desktop | D03    | The illustration is smaller than the huge tile of D03; a conscious decision.              | wcześniej zaakceptowane odstępstwo |
| D03-12 | desktop | D03    | Step numbers come from the real `recipe.steps`.                                           | wcześniej zaakceptowane odstępstwo |
| D03-13 | desktop | D03    | Missing optional data creates no empty elements.                                          | wcześniej zaakceptowane odstępstwo |
| D03-14 | mobile  | M11    | Mobile macro stays a separate card.                                                       | wcześniej zaakceptowane odstępstwo |

## D04: recipe form on desktop

| Id     | Scope   | Mockup | Finding                                                                                                                  | Status                             |
| ------ | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| D04-01 | desktop | D04    | Widen the form and the right column in proportions matching the design.                                                  | do poprawy                         |
| D04-02 | desktop | D04    | Enlarge the illustration preview: a large square filling the width of the right card, not a thumbnail.                   | do poprawy                         |
| D04-03 | desktop | D04    | Keep the preview caption and "Zapisz / Anuluj" below it.                                                                 | do poprawy                         |
| D04-04 | desktop | D04    | Strengthen section headings, labels and button texts.                                                                    | do poprawy                         |
| D04-05 | desktop | D04    | On desktop, nutrition values go inside "Dodatkowe informacje".                                                           | do poprawy                         |
| D04-06 | desktop | D04    | Reduce the excessive height of ingredient rows: review paddings, spacing and the place of the helper text.               | do poprawy                         |
| D04-07 | desktop | D04    | Keep number, fields and bin in one row.                                                                                  | do poprawy                         |
| D04-08 | desktop | D04    | Check the alignment of the number and the bin also with errors and longer labels; today margins depend on field heights. | do poprawy                         |
| D04-09 | desktop | D04    | Right column with the preview and the actions stays.                                                                     | wcześniej zaakceptowane odstępstwo |
| D04-10 | desktop | D04    | No "Zmień" button: the illustration is picked automatically.                                                             | wcześniej zaakceptowane odstępstwo |
| D04-11 | desktop | D04    | Placeholder image for an empty or unrecognised name.                                                                     | wcześniej zaakceptowane odstępstwo |
| D04-12 | desktop | D04    | An existing illustration does not change when the name is edited.                                                        | wcześniej zaakceptowane odstępstwo |

## M01–M03: mobile sign-in, errors, sign-up

| Id     | Scope  | Mockup  | Finding                                                                                                                                                  | Status                             |
| ------ | ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M01-01 | mobile | M01–M03 | Strengthen field labels and button texts.                                                                                                                | do poprawy                         |
| M01-02 | mobile | M01–M03 | Match the logo proportions.                                                                                                                              | do poprawy                         |
| M01-03 | mobile | M01     | Sign-in: fix the position of the small illustration; it must not almost vanish. In the design it clearly crosses the band edge.                          | do poprawy                         |
| M01-04 | mobile | M03     | Correct the height of the sign-up band against M03, keeping it compact.                                                                                  | do poprawy                         |
| M01-05 | mobile | M03     | Restore the minimum password length hint, consistent with the real validation.                                                                           | do poprawy                         |
| M01-06 | mobile | M02     | Password error states, mandatory: red border of the invalid field.                                                                                       | do poprawy                         |
| M01-07 | mobile | M02     | Password error states: warning icon by the message.                                                                                                      | do poprawy                         |
| M01-08 | mobile | M02     | Password error states: message under the right field.                                                                                                    | do poprawy                         |
| M01-09 | mobile | M02     | Password error states: correct presentation of an empty password and of a mismatched repeat.                                                             | do poprawy                         |
| M01-10 | mobile | M02     | Password error states: visible focus must not wipe out the error state.                                                                                  | do poprawy                         |
| M01-11 | mobile | M02     | Password error states: the general sign-in error must not suggest whether the e-mail or the password is wrong.                                           | do poprawy                         |
| M01-12 | mobile | M02     | The sign-in error banner stays.                                                                                                                          | wcześniej zaakceptowane odstępstwo |
| M01-13 | mobile | M03     | The unified "Załóż konto" stays.                                                                                                                         | wcześniej zaakceptowane odstępstwo |
| M01-14 | mobile | M01–M03 | Ready illustrations and no extra leaf drawings.                                                                                                          | wcześniej zaakceptowane odstępstwo |
| M01-15 | mobile | M02     | A screenshot with a filled password and wrong data neither confirms nor rules out the empty-field error; the empty-field error still has to be compared. | jeszcze nieporównane               |

## M04: account created / check your mail

| Id     | Scope  | Mockup | Finding                                                                                               | Status                             |
| ------ | ------ | ------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M04-01 | mobile | M04    | Strengthen the button text and match its width.                                                       | do poprawy                         |
| M04-02 | mobile | M04    | Unify the logo with the other auth screens.                                                           | do poprawy                         |
| M04-03 | mobile | M04    | Check both variants in the shared layout.                                                             | do poprawy                         |
| M04-04 | mobile | M04    | The variants stay distinct: "Konto założone" (tick, can sign in).                                     | wcześniej zaakceptowane odstępstwo |
| M04-05 | mobile | M04    | The variants stay distinct: "Sprawdź skrzynkę" (envelope, confirmation needed).                       | wcześniej zaakceptowane odstępstwo |
| M04-06 | mobile | M04    | The icon circle already has a similar proportion.                                                     | wcześniej zaakceptowane odstępstwo |
| M04-07 | mobile | M04    | The white note at the bottom of the mockup is a description of the design, not an element of the app. | wcześniej zaakceptowane odstępstwo |

## M05: empty pantry

| Id     | Scope  | Mockup | Finding                                                                                                                                           | Status     |
| ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| M05-01 | mobile | M05    | The prompt card is too tall.                                                                                                                      | do poprawy |
| M05-02 | mobile | M05    | Reduce the dominance of "Co masz dziś w domu?"; at a typical phone width bring it close to one line, without forcing it on the narrowest screens. | do poprawy |
| M05-03 | mobile | M05    | Fix the layout of the "Dodaj produkty…" button: icon, text and spacing; the text now wraps badly.                                                 | do poprawy |
| M05-04 | mobile | M05    | Match spacing between the prompt card, the list header and the tiles.                                                                             | do poprawy |
| M05-05 | mobile | M05    | Unify the typography of descriptions and metadata.                                                                                                | do poprawy |

## M06, M10A, M17: mobile tiles

| Id     | Scope  | Mockup    | Finding                                                                            | Status                             |
| ------ | ------ | --------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| M10-01 | mobile | M06, M10A | Match the hierarchy of the list header to the tiles.                               | do poprawy                         |
| M10-02 | mobile | M10A      | Improve the readability of metadata and the spacing between pieces of information. | do poprawy                         |
| M10-03 | mobile | M10A      | Percentage: stronger text, proper fill, no visible outline.                        | do poprawy                         |
| M10-04 | mobile | M10A      | "+N" must not stay alone in the next row.                                          | do poprawy                         |
| M10-05 | mobile | M17       | Dark theme: the dots "Mam / Stałe / Wykluczam" are too pastel against the design.  | do poprawy                         |
| M10-06 | mobile | M10A      | Percentage next to the time.                                                       | wcześniej zaakceptowane odstępstwo |
| M10-07 | mobile | M10A      | Title up to three lines.                                                           | wcześniej zaakceptowane odstępstwo |
| M10-08 | mobile | M10A      | Fuller names of missing items instead of the older cutting of M06.                 | wcześniej zaakceptowane odstępstwo |
| M10-09 | mobile | M10A      | Variable tile height on the phone.                                                 | wcześniej zaakceptowane odstępstwo |
| M10-10 | mobile | M10A      | Information about substitutes.                                                     | wcześniej zaakceptowane odstępstwo |
| M10-11 | mobile | M10A      | "Pokaż więcej" was not shown in the latest screenshots; still to be compared.      | jeszcze nieporównane               |

## M07: pantry sheet

| Id     | Scope  | Mockup | Finding                                                                                                 | Status                             |
| ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M07-01 | mobile | M07    | The sheet is a taller panel, closer to the mockup, with scrolling content and the action at the bottom. | do poprawy                         |
| M07-02 | mobile | M07    | Do not copy the height of the keyboard area from the drawing.                                           | do poprawy                         |
| M07-03 | mobile | M07    | Add a short visual handle at the top.                                                                   | do poprawy                         |
| M07-04 | mobile | M07    | Strengthen the header, the tabs, the counters and the buttons.                                          | do poprawy                         |
| M07-05 | mobile | M07    | Reduce the dominance of the tag borders.                                                                | do poprawy                         |
| M07-06 | mobile | M07    | Check the active focus of the field.                                                                    | do poprawy                         |
| M07-07 | mobile | M07    | Keep the content reachable with many products and the keyboard open.                                    | do poprawy                         |
| M07-08 | mobile | M07    | No drag gesture and no special handling of Back.                                                        | wcześniej zaakceptowane odstępstwo |
| M07-09 | mobile | M07    | "Dodaj" disabled for an empty field.                                                                    | wcześniej zaakceptowane odstępstwo |
| M07-10 | mobile | M07    | Tags and typed text are kept after closing.                                                             | wcześniej zaakceptowane odstępstwo |
| M07-11 | mobile | M07    | "Jak to działa?" was deferred earlier.                                                                  | wcześniej zaakceptowane odstępstwo |

## M07b: filters not applied

| Id      | Scope  | Mockup | Finding                                                                             | Status                             |
| ------- | ------ | ------ | ----------------------------------------------------------------------------------- | ---------------------------------- |
| M07B-01 | mobile | M07b   | White background and an amber border instead of the yellow fill in the light theme. | do poprawy                         |
| M07B-02 | mobile | M07b   | Match the rounding and the border thickness.                                        | do poprawy                         |
| M07B-03 | mobile | M07b   | Strengthen the counters and the action texts.                                       | do poprawy                         |
| M07B-04 | mobile | M07b   | Keep the message "Wyniki dla poprzedniej spiżarki".                                 | wcześniej zaakceptowane odstępstwo |
| M07B-05 | mobile | M07b   | The descriptive white note of the mockup does not go into the app.                  | wcześniej zaakceptowane odstępstwo |

## M08: loading

| Id     | Scope  | Mockup | Finding                                                                                   | Status               |
| ------ | ------ | ------ | ----------------------------------------------------------------------------------------- | -------------------- |
| M08-01 | mobile | M08    | Neutral skeleton color instead of greenish.                                               | do poprawy           |
| M08-02 | mobile | M08    | Shapes and spacing matching the target M10A tile.                                         | do poprawy           |
| M08-03 | mobile | M08    | The place of the percentage matches the accepted metadata layout.                         | do poprawy           |
| M08-04 | mobile | M08    | Skeleton height follows the corrected tiles, not set independently.                       | do poprawy           |
| M08-05 | mobile | M08    | To check in behaviour: the first load shows skeletons.                                    | jeszcze nieporównane |
| M08-06 | mobile | M08    | To check in behaviour: later filtering keeps the previous results and dims them slightly. | jeszcze nieporównane |

## M09: no results

| Id     | Scope  | Mockup | Finding                                                                                                    | Status                             |
| ------ | ------ | ------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M09-01 | mobile | M09    | Slightly enlarge the icon circle.                                                                          | do poprawy                         |
| M09-02 | mobile | M09    | Tags without visible borders, with stronger text.                                                          | do poprawy                         |
| M09-03 | mobile | M09    | Match the spacing inside the card.                                                                         | do poprawy                         |
| M09-04 | mobile | M09    | Strengthen the "Zmień wykluczenia" button and match its width.                                             | do poprawy                         |
| M09-05 | mobile | M09    | Layout, content and the list of exclusions are right; a larger number of tags naturally raises the height. | wcześniej zaakceptowane odstępstwo |

## M11, M18: mobile details

| Id     | Scope  | Mockup   | Finding                                                                                    | Status                             |
| ------ | ------ | -------- | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| M11-01 | mobile | M11, M18 | Reduce the height of the illustration band to the compact intent.                          | do poprawy                         |
| M11-02 | mobile | M11, M18 | Keep the full width of the title and the pills.                                            | do poprawy                         |
| M11-03 | mobile | M11      | Light theme: time and servings on a white background.                                      | do poprawy                         |
| M11-04 | mobile | M18      | Dark theme: the backgrounds of the time and servings pills less lightened.                 | do poprawy                         |
| M11-05 | mobile | M11, M18 | Strengthen the pill labels.                                                                | do poprawy                         |
| M11-06 | mobile | M11, M18 | Match the spacing between the title, the metadata and the macro.                           | do poprawy                         |
| M11-07 | mobile | M11, M18 | Add a separator under the ingredients header, also before the first item.                  | do poprawy                         |
| M11-08 | mobile | M18      | Dark macro: tiles darker than the surrounding card, not lighter.                           | do poprawy                         |
| M11-09 | mobile | M11      | Title 20 px.                                                                               | wcześniej zaakceptowane odstępstwo |
| M11-10 | mobile | M11      | The additional navbar.                                                                     | wcześniej zaakceptowane odstępstwo |
| M11-11 | mobile | M11      | The decorative band color follows the illustration.                                        | wcześniej zaakceptowane odstępstwo |
| M11-12 | mobile | M11      | No author actions for other people's recipes.                                              | wcześniej zaakceptowane odstępstwo |
| M11-13 | mobile | M11, M18 | The full lower part (ingredients and steps) has not been compared on matching screenshots. | jeszcze nieporównane               |

## M12a: author actions

| Id      | Scope  | Mockup | Finding                                                                                                                                                                                                                                                                                                                                                                                                              | Status                             |
| ------- | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M12A-01 | mobile | M12a   | Mockup: a sheet from the bottom, dimming, the recipe name and a separate "Anuluj". App: a small popover under "⋯". The popover was an earlier agreed simplification; it is not marked as matching M12a, and it is not rebuilt without a decision. Decision 2026-10-28: keep the popover; it only takes the shared popover styling of M21 (rounding, border, shadow). Not a match with M12a, recorded as a deviation. | wcześniej zaakceptowane odstępstwo |

## M12b: deleting

| Id      | Scope  | Mockup | Finding                                                                   | Status                             |
| ------- | ------ | ------ | ------------------------------------------------------------------------- | ---------------------------------- |
| M12B-01 | mobile | M12b   | White dialog background in the light theme instead of cream.              | do poprawy                         |
| M12B-02 | mobile | M12b   | Stronger button labels.                                                   | do poprawy                         |
| M12B-03 | mobile | M12b   | Match the rounding and the spacing.                                       | do poprawy                         |
| M12B-04 | mobile | M12b   | Reduce the icon circle to the mockup proportion.                          | do poprawy                         |
| M12B-05 | mobile | M12b   | "Usuń" above "Anuluj".                                                    | wcześniej zaakceptowane odstępstwo |
| M12B-06 | mobile | M12b   | The warning text, the destructive color and the locks during the request. | wcześniej zaakceptowane odstępstwo |

## M13, M14, M22 B: mobile form

| Id     | Scope  | Mockup          | Finding                                                                                                                                                                                                                       | Status                             |
| ------ | ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M13-01 | mobile | M13, M14        | A more compact bar "× Dodaj/Edytuj przepis".                                                                                                                                                                                  | do poprawy                         |
| M13-02 | mobile | M13, M14        | Less empty space before the first card.                                                                                                                                                                                       | do poprawy                         |
| M13-03 | mobile | M13, M14, M22 B | Stronger labels, headings and buttons.                                                                                                                                                                                        | do poprawy                         |
| M13-04 | mobile | M13             | Error banner: stronger heading and a visible bullet list of links.                                                                                                                                                            | do poprawy                         |
| M13-05 | mobile | M13             | Icons by the field error messages.                                                                                                                                                                                            | do poprawy                         |
| M13-06 | mobile | M13             | Keep the red borders and the correct order of opening sections and focus.                                                                                                                                                     | do poprawy                         |
| M13-07 | mobile | M13             | Mockup: a separate illustration card before the name. App: the preview inside the name card, agreed earlier. Final decision needed. Decision 2026-10-28: keep the preview in the name card; recorded as a deviation from M13. | wcześniej zaakceptowane odstępstwo |
| M13-08 | mobile | M22 B           | M22 B replaces the older layout of all ingredients open.                                                                                                                                                                      | wcześniej zaakceptowane odstępstwo |
| M13-09 | mobile | M22 B           | One ingredient expanded on the phone.                                                                                                                                                                                         | wcześniej zaakceptowane odstępstwo |
| M13-10 | mobile | M22 B           | No bin for the only ingredient.                                                                                                                                                                                               | wcześniej zaakceptowane odstępstwo |
| M13-11 | mobile | M13             | The mobile save bar.                                                                                                                                                                                                          | wcześniej zaakceptowane odstępstwo |
| M13-12 | mobile | M13             | Automatic preview without a picker.                                                                                                                                                                                           | wcześniej zaakceptowane odstępstwo |
| M13-13 | mobile | M22 B           | Not fully compared: an expanded substitute with an error.                                                                                                                                                                     | jeszcze nieporównane               |
| M13-14 | mobile | M13             | Not fully compared: an invalid step.                                                                                                                                                                                          | jeszcze nieporównane               |
| M13-15 | mobile | M13             | Not fully compared: the lower sections of the form.                                                                                                                                                                           | jeszcze nieporównane               |

## M16: recipe added

| Id     | Scope  | Mockup | Finding                                                                                                                                                                                        | Status                             |
| ------ | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M16-01 | mobile | M16    | Remove the bordered card around the whole screen.                                                                                                                                              | do poprawy                         |
| M16-02 | mobile | M16    | A large centered success icon in a light circle.                                                                                                                                               | do poprawy                         |
| M16-03 | mobile | M16    | A strong heading under the icon.                                                                                                                                                               | do poprawy                         |
| M16-04 | mobile | M16    | A separate white recipe summary card.                                                                                                                                                          | do poprawy                         |
| M16-05 | mobile | M16    | Two actions outside the card, full width.                                                                                                                                                      | do poprawy                         |
| M16-06 | mobile | M16    | The main action olive, the secondary filled.                                                                                                                                                   | do poprawy                         |
| M16-07 | mobile | M16    | 48 px buttons and stronger text.                                                                                                                                                               | do poprawy                         |
| M16-08 | mobile | M16    | Match the vertical spacing.                                                                                                                                                                    | do poprawy                         |
| M16-09 | mobile | M16    | Show time and servings when they exist.                                                                                                                                                        | do poprawy                         |
| M16-10 | mobile | M16    | The bubble "Zmiany zapisane" after editing stays a proposal, not an automatically approved feature. Decision 2026-10-28: the bubble is not added; M16 covers only the "Przepis dodany" screen. | wcześniej zaakceptowane odstępstwo |

## M19: fetch error

| Id     | Scope  | Mockup | Finding                                                                                                 | Status                             |
| ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M19-01 | mobile | M19    | Match the spacing, the weight of the message and of the button.                                         | do poprawy                         |
| M19-02 | mobile | M19    | If old results are kept after a refresh error, mark them as outdated and dim them.                      | do poprawy                         |
| M19-03 | mobile | M19    | Distinguish that case from the first failed load without results.                                       | do poprawy                         |
| M19-04 | mobile | M19    | The text "Brak połączenia…" is an acceptable variant; messages are not changed just to copy the mockup. | wcześniej zaakceptowane odstępstwo |

## M20: 404

| Id     | Scope  | Mockup | Finding                                                    | Status                             |
| ------ | ------ | ------ | ---------------------------------------------------------- | ---------------------------------- |
| M20-01 | mobile | M20    | Move the block closer to the middle of the available area. | do poprawy                         |
| M20-02 | mobile | M20    | Enlarge the icon circle.                                   | do poprawy                         |
| M20-03 | mobile | M20    | Tone down the icon itself.                                 | do poprawy                         |
| M20-04 | mobile | M20    | Match the spacing and the width and weight of the button.  | do poprawy                         |
| M20-05 | mobile | M20    | Content and the return target stay unchanged.              | wcześniej zaakceptowane odstępstwo |

## M21: account menu

| Id     | Scope  | Mockup | Finding                                                                                                                                                                                                               | Status                             |
| ------ | ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M21-01 | mobile | M21    | Larger rounding.                                                                                                                                                                                                      | do poprawy                         |
| M21-02 | mobile | M21    | A less dominant border, a shadow as in the design.                                                                                                                                                                    | do poprawy                         |
| M21-03 | mobile | M21    | Match the size of the icons, texts and vertical spacing.                                                                                                                                                              | do poprawy                         |
| M21-04 | mobile | M21    | The dimming of the background is in the mockup and not in the app; no dimming was an earlier accepted simplification. To be decided again. Decision 2026-10-28: no dimming behind the menu; the other M21 fixes stay. | wcześniej zaakceptowane odstępstwo |

## Count

Total 182 findings (unique ids): do poprawy 119, wcześniej zaakceptowane odstępstwo 55, wymaga decyzji 0, jeszcze nieporównane 8.

The four points that needed a decision (M12A-01, M13-07, M16-10, M21-04) were decided on 2026-10-28 and are now recorded as accepted deviations (see their rows).
