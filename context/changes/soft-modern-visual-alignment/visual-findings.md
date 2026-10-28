# Visual findings: M-2 against the mockups

Source: the analyst's list from the aggregate comparison (after soft-modern-recipe-form phase 6, commit `8a1e540`), pasted by the author on 2026-10-28 and accepted as material for the correction plan. Every point of the list is kept here; nothing is merged away.

**Ids** are stable: `<screen>-<nn>`. They are never renumbered; a new finding gets the next number of its screen. **Scope**: desktop, mobile, both. **Status** is one of:

- **do poprawy** — a discrepancy to fix;
- **wcześniej zaakceptowane odstępstwo** — a decision the author already made (includes every "Zostaje" point of the list: what stays, whether or not the mockup differs). An earlier "looks OK" is not consent to discrepancies shown later;
- **wymaga decyzji** — the author decides before the plan is final;
- **jeszcze nieporównane** — not yet compared on matching screenshots; to be compared during implementation.

**Final statuses (phase 7):** `zrobione (faza N)` — implemented and checked (the author's acceptance of each screen is tracked in `plan.md` Progress and `change.md`, not here); `porównane, zgodne` — a former "jeszcze nieporównane" point compared on matching screenshots with no discrepancy found; `wcześniej zaakceptowane odstępstwo` — unchanged.

Mockups are visual references, not instructions. Proportions are compared at matching widths; 780 px exports are not 780 CSS px. Phase column: filled in `plan.md` (the plan maps every id to a phase or to a reason for leaving it).

## G: the whole app

| Id   | Scope   | Mockup  | Finding                                                                                                                               | Status                                                                          |
| ---- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| G-01 | desktop | D02–D04 | Content containers are too narrow compared with D02–D04: a large part of the screen stays empty, cards, fields and text are squeezed. | zrobione (faza 1)                                                               |
| G-02 | desktop | D02–D04 | Widen the content container and match the inner width of the navbar to it.                                                            | zrobione (faza 1)                                                               |
| G-03 | desktop | D02–D04 | Keep reasonable side margins and a maximum width on very large screens.                                                               | zrobione (faza 1)                                                               |
| G-04 | desktop | D02–D04 | The widening covers list, details and form consistently, not as separate accidental widths.                                           | zrobione (faza 1)                                                               |
| G-05 | both    | all     | Typography: field labels, button texts and some headings are lighter than in the mockups.                                             | zrobione (faza 1)                                                               |
| G-06 | both    | all     | Restore the hierarchy: strong headings and actions, readable content, calmer helper text.                                             | zrobione (etykiety i przyciski w fazie 1, nagłówki stron i sekcji w fazach 2–7) |
| G-07 | mobile  | M05     | Do not enlarge everything automatically: some mobile headings already dominate, above all "Co masz dziś w domu?".                     | zrobione (faza 1)                                                               |
| G-08 | both    | all     | Unify the scale through shared components and tokens.                                                                                 | zrobione (faza 1)                                                               |
| G-09 | both    | navbar  | Theme toggle and "Wyloguj" have the same height, alignment and rounding; widths may follow content.                                   | zrobione (faza 1)                                                               |
| G-10 | both    | navbar  | Match logo size and text weight to the mockups.                                                                                       | zrobione (faza 1)                                                               |
| G-11 | mobile  | navbar  | Keep the mobile "+" and the account button.                                                                                           | wcześniej zaakceptowane odstępstwo                                              |
| G-12 | both    | navbar  | No change to the sign-out logic or permissions.                                                                                       | wcześniej zaakceptowane odstępstwo                                              |

## D01: sign-in on desktop

| Id     | Scope   | Mockup | Finding                                                                                                            | Status                                                                                                |
| ------ | ------- | ------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| D01-01 | desktop | D01    | Widen the form relative to the right half of the screen.                                                           | zrobione (faza 6)                                                                                     |
| D01-02 | desktop | D01    | Enlarge the logo to proportions closer to D01.                                                                     | zrobione (faza 6)                                                                                     |
| D01-03 | desktop | D01    | Strengthen the labels "E-mail" and "Hasło" and the main button text.                                               | zrobione (faza 6)                                                                                     |
| D01-04 | desktop | D01    | Narrow the slogan "Gotuj z tego, co już masz w domu." into a compact block, closer to the two lines of the design. | zrobione (faza 6)                                                                                     |
| D01-05 | desktop | D01    | Match the width and line breaking of the subtitle under the slogan.                                                | zrobione, drobna różnica: w podtytule „Ci” zostaje w pierwszym wierszu (w makiecie w drugim) (faza 6) |
| D01-06 | desktop | D01    | Two halves and the accepted palette stay.                                                                          | wcześniej zaakceptowane odstępstwo                                                                    |
| D01-07 | desktop | D01    | The composition of four illustrations from the existing library stays.                                             | wcześniej zaakceptowane odstępstwo                                                                    |
| D01-08 | desktop | D01    | The subtitle by the form and the theme toggle stay.                                                                | wcześniej zaakceptowane odstępstwo                                                                    |
| D01-09 | desktop | D01    | Illustrations differ from the original D01; accepted.                                                              | wcześniej zaakceptowane odstępstwo                                                                    |

## D02/D05: pantry and results on desktop

| Id     | Scope   | Mockup   | Finding                                                                                                                                                                                                                                                                | Status                             |
| ------ | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| D02-01 | desktop | D02, D05 | Widen the whole view and the results area.                                                                                                                                                                                                                             | zrobione (faza 2)                  |
| D02-02 | desktop | D02, D05 | Match the pantry panel proportion to the list: the panel must not take the room that tile titles and missing items need.                                                                                                                                               | zrobione (faza 2)                  |
| D02-03 | desktop | D02, D05 | Restore readable sizes of illustrations, titles and metadata.                                                                                                                                                                                                          | zrobione (faza 2)                  |
| D02-04 | desktop | D02, D05 | Strengthen the pantry header and the main actions.                                                                                                                                                                                                                     | zrobione (faza 2)                  |
| D02-05 | desktop | D02, D05 | Desktop tiles have one size across the whole grid, not only within a row. Decision 2026-10-28 after measuring real data (one tile of 236 px made 15 of 21 tiles 88 px too tall, 1626 px of empty space): cards are equal within each row, rows may differ; no cutting. | wcześniej zaakceptowane odstępstwo |
| D02-06 | desktop | D02, D05 | Short recipes must not make low cards next to much taller ones.                                                                                                                                                                                                        | zrobione (faza 2)                  |
| D02-07 | desktop | D02, D05 | Equal heights must not cut the substitute information or make content overlap; longer cases are taken into account when the shared layout is set.                                                                                                                      | zrobione (faza 2)                  |
| D02-08 | desktop | D02, D05 | Keep the agreed limits of the name and of the presentation of missing items.                                                                                                                                                                                           | wcześniej zaakceptowane odstępstwo |
| D02-09 | desktop | D02, D05 | Light and dark theme colors are accepted.                                                                                                                                                                                                                              | wcześniej zaakceptowane odstępstwo |
| D02-10 | desktop | D02, D05 | Percentage next to the time (M10A) instead of the older D02/D05 layout.                                                                                                                                                                                                | wcześniej zaakceptowane odstępstwo |
| D02-11 | desktop | D02, D05 | The information about a used substitute stays.                                                                                                                                                                                                                         | wcześniej zaakceptowane odstępstwo |
| D02-12 | desktop | D02, D05 | Differences in data, order and the number of local recipes are not visual errors.                                                                                                                                                                                      | wcześniej zaakceptowane odstępstwo |

## D03: recipe details on desktop

| Id     | Scope   | Mockup | Finding                                                                                   | Status                             |
| ------ | ------- | ------ | ----------------------------------------------------------------------------------------- | ---------------------------------- |
| D03-01 | desktop | D03    | Macro belongs to the top card, together with the title and metadata.                      | zrobione (faza 4)                  |
| D03-02 | desktop | D03    | Illustration on the left of the top card.                                                 | zrobione (faza 4)                  |
| D03-03 | desktop | D03    | On the right: title, author actions, pills and nutrition values.                          | zrobione (faza 4)                  |
| D03-04 | desktop | D03    | Remove the separate full-width macro card on desktop.                                     | zrobione (faza 4)                  |
| D03-05 | desktop | D03    | Align nutrition values to the left.                                                       | zrobione (faza 4)                  |
| D03-06 | desktop | D03    | Use full labels on desktop (e.g. "węglowodany") instead of the mobile abbreviation.       | zrobione (faza 4)                  |
| D03-07 | desktop | D03    | Widen the page.                                                                           | zrobione (faza 4)                  |
| D03-08 | desktop | D03    | Bottom split closer to 1/3 ingredients and 2/3 steps, instead of the current 2/5 and 3/5. | zrobione (faza 4)                  |
| D03-09 | desktop | D03    | Match the size and weight of headings and content, and the spacing between sections.      | zrobione (faza 4)                  |
| D03-10 | desktop | D03    | Place author actions according to the top-card composition.                               | zrobione (faza 4)                  |
| D03-11 | desktop | D03    | The illustration is smaller than the huge tile of D03; a conscious decision.              | wcześniej zaakceptowane odstępstwo |
| D03-12 | desktop | D03    | Step numbers come from the real `recipe.steps`.                                           | wcześniej zaakceptowane odstępstwo |
| D03-13 | desktop | D03    | Missing optional data creates no empty elements.                                          | wcześniej zaakceptowane odstępstwo |
| D03-14 | mobile  | M11    | Mobile macro stays a separate card.                                                       | wcześniej zaakceptowane odstępstwo |

## D04: recipe form on desktop

| Id     | Scope   | Mockup | Finding                                                                                                                  | Status                             |
| ------ | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| D04-01 | desktop | D04    | Widen the form and the right column in proportions matching the design.                                                  | zrobione (faza 5)                  |
| D04-02 | desktop | D04    | Enlarge the illustration preview: a large square filling the width of the right card, not a thumbnail.                   | zrobione (faza 5)                  |
| D04-03 | desktop | D04    | Keep the preview caption and "Zapisz / Anuluj" below it.                                                                 | zrobione (faza 5)                  |
| D04-04 | desktop | D04    | Strengthen section headings, labels and button texts.                                                                    | zrobione (faza 5)                  |
| D04-05 | desktop | D04    | On desktop, nutrition values go inside "Dodatkowe informacje".                                                           | zrobione (faza 5)                  |
| D04-06 | desktop | D04    | Reduce the excessive height of ingredient rows: review paddings, spacing and the place of the helper text.               | zrobione (faza 5)                  |
| D04-07 | desktop | D04    | Keep number, fields and bin in one row.                                                                                  | zrobione (faza 5)                  |
| D04-08 | desktop | D04    | Check the alignment of the number and the bin also with errors and longer labels; today margins depend on field heights. | zrobione (faza 5)                  |
| D04-09 | desktop | D04    | Right column with the preview and the actions stays.                                                                     | wcześniej zaakceptowane odstępstwo |
| D04-10 | desktop | D04    | No "Zmień" button: the illustration is picked automatically.                                                             | wcześniej zaakceptowane odstępstwo |
| D04-11 | desktop | D04    | Placeholder image for an empty or unrecognised name.                                                                     | wcześniej zaakceptowane odstępstwo |
| D04-12 | desktop | D04    | An existing illustration does not change when the name is edited.                                                        | wcześniej zaakceptowane odstępstwo |

## M01–M03: mobile sign-in, errors, sign-up

| Id     | Scope  | Mockup  | Finding                                                                                                                                                  | Status                             |
| ------ | ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M01-01 | mobile | M01–M03 | Strengthen field labels and button texts.                                                                                                                | zrobione (faza 6)                  |
| M01-02 | mobile | M01–M03 | Match the logo proportions.                                                                                                                              | zrobione (faza 6)                  |
| M01-03 | mobile | M01     | Sign-in: fix the position of the small illustration; it must not almost vanish. In the design it clearly crosses the band edge.                          | zrobione (faza 6)                  |
| M01-04 | mobile | M03     | Correct the height of the sign-up band against M03, keeping it compact.                                                                                  | zrobione (faza 6)                  |
| M01-05 | mobile | M03     | Restore the minimum password length hint, consistent with the real validation.                                                                           | zrobione (faza 6)                  |
| M01-06 | mobile | M02     | Password error states, mandatory: red border of the invalid field.                                                                                       | zrobione (faza 6)                  |
| M01-07 | mobile | M02     | Password error states: warning icon by the message.                                                                                                      | zrobione (faza 6)                  |
| M01-08 | mobile | M02     | Password error states: message under the right field.                                                                                                    | zrobione (faza 6)                  |
| M01-09 | mobile | M02     | Password error states: correct presentation of an empty password and of a mismatched repeat.                                                             | zrobione (faza 6)                  |
| M01-10 | mobile | M02     | Password error states: visible focus must not wipe out the error state.                                                                                  | zrobione (faza 6)                  |
| M01-11 | mobile | M02     | Password error states: the general sign-in error must not suggest whether the e-mail or the password is wrong.                                           | zrobione (faza 6)                  |
| M01-12 | mobile | M02     | The sign-in error banner stays.                                                                                                                          | wcześniej zaakceptowane odstępstwo |
| M01-13 | mobile | M03     | The unified "Załóż konto" stays.                                                                                                                         | wcześniej zaakceptowane odstępstwo |
| M01-14 | mobile | M01–M03 | Ready illustrations and no extra leaf drawings.                                                                                                          | wcześniej zaakceptowane odstępstwo |
| M01-15 | mobile | M02     | A screenshot with a filled password and wrong data neither confirms nor rules out the empty-field error; the empty-field error still has to be compared. | porównane, zgodne (faza 7)         |

## M04: account created / check your mail

| Id     | Scope  | Mockup | Finding                                                                                               | Status                                                                                           |
| ------ | ------ | ------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| M04-01 | mobile | M04    | Strengthen the button text and match its width.                                                       | zrobione (faza 6)                                                                                |
| M04-02 | mobile | M04    | Unify the logo with the other auth screens.                                                           | zrobione (faza 6)                                                                                |
| M04-03 | mobile | M04    | Check both variants in the shared layout.                                                             | zrobione (faza 6); oba warianty porównane w fazie 7 (podgląd `?variant=mail` tylko w trybie dev) |
| M04-04 | mobile | M04    | The variants stay distinct: "Konto założone" (tick, can sign in).                                     | wcześniej zaakceptowane odstępstwo                                                               |
| M04-05 | mobile | M04    | The variants stay distinct: "Sprawdź skrzynkę" (envelope, confirmation needed).                       | wcześniej zaakceptowane odstępstwo                                                               |
| M04-06 | mobile | M04    | The icon circle already has a similar proportion.                                                     | wcześniej zaakceptowane odstępstwo                                                               |
| M04-07 | mobile | M04    | The white note at the bottom of the mockup is a description of the design, not an element of the app. | wcześniej zaakceptowane odstępstwo                                                               |

## M05: empty pantry

| Id     | Scope  | Mockup | Finding                                                                                                                                           | Status            |
| ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| M05-01 | mobile | M05    | The prompt card is too tall.                                                                                                                      | zrobione (faza 2) |
| M05-02 | mobile | M05    | Reduce the dominance of "Co masz dziś w domu?"; at a typical phone width bring it close to one line, without forcing it on the narrowest screens. | zrobione (faza 2) |
| M05-03 | mobile | M05    | Fix the layout of the "Dodaj produkty…" button: icon, text and spacing; the text now wraps badly.                                                 | zrobione (faza 2) |
| M05-04 | mobile | M05    | Match spacing between the prompt card, the list header and the tiles.                                                                             | zrobione (faza 2) |
| M05-05 | mobile | M05    | Unify the typography of descriptions and metadata.                                                                                                | zrobione (faza 2) |

## M06, M10A, M17: mobile tiles

| Id     | Scope  | Mockup    | Finding                                                                            | Status                             |
| ------ | ------ | --------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| M10-01 | mobile | M06, M10A | Match the hierarchy of the list header to the tiles.                               | zrobione (faza 2)                  |
| M10-02 | mobile | M10A      | Improve the readability of metadata and the spacing between pieces of information. | zrobione (faza 2)                  |
| M10-03 | mobile | M10A      | Percentage: stronger text, proper fill, no visible outline.                        | zrobione (faza 2)                  |
| M10-04 | mobile | M10A      | "+N" must not stay alone in the next row.                                          | zrobione (faza 2)                  |
| M10-05 | mobile | M17       | Dark theme: the dots "Mam / Stałe / Wykluczam" are too pastel against the design.  | zrobione (faza 2)                  |
| M10-06 | mobile | M10A      | Percentage next to the time.                                                       | wcześniej zaakceptowane odstępstwo |
| M10-07 | mobile | M10A      | Title up to three lines.                                                           | wcześniej zaakceptowane odstępstwo |
| M10-08 | mobile | M10A      | Fuller names of missing items instead of the older cutting of M06.                 | wcześniej zaakceptowane odstępstwo |
| M10-09 | mobile | M10A      | Variable tile height on the phone.                                                 | wcześniej zaakceptowane odstępstwo |
| M10-10 | mobile | M10A      | Information about substitutes.                                                     | wcześniej zaakceptowane odstępstwo |
| M10-11 | mobile | M10A      | "Pokaż więcej" was not shown in the latest screenshots; still to be compared.      | porównane, zgodne (faza 7)         |

## M07: pantry sheet

| Id     | Scope  | Mockup | Finding                                                                                                 | Status                             |
| ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M07-01 | mobile | M07    | The sheet is a taller panel, closer to the mockup, with scrolling content and the action at the bottom. | zrobione (faza 3)                  |
| M07-02 | mobile | M07    | Do not copy the height of the keyboard area from the drawing.                                           | zrobione (faza 3)                  |
| M07-03 | mobile | M07    | Add a short visual handle at the top.                                                                   | zrobione (faza 3)                  |
| M07-04 | mobile | M07    | Strengthen the header, the tabs, the counters and the buttons.                                          | zrobione (faza 3)                  |
| M07-05 | mobile | M07    | Reduce the dominance of the tag borders.                                                                | zrobione (faza 3)                  |
| M07-06 | mobile | M07    | Check the active focus of the field.                                                                    | zrobione (faza 3)                  |
| M07-07 | mobile | M07    | Keep the content reachable with many products and the keyboard open.                                    | zrobione (faza 3)                  |
| M07-08 | mobile | M07    | No drag gesture and no special handling of Back.                                                        | wcześniej zaakceptowane odstępstwo |
| M07-09 | mobile | M07    | "Dodaj" disabled for an empty field.                                                                    | wcześniej zaakceptowane odstępstwo |
| M07-10 | mobile | M07    | Tags and typed text are kept after closing.                                                             | wcześniej zaakceptowane odstępstwo |
| M07-11 | mobile | M07    | "Jak to działa?" was deferred earlier.                                                                  | wcześniej zaakceptowane odstępstwo |

## M07b: filters not applied

| Id      | Scope  | Mockup | Finding                                                                             | Status                             |
| ------- | ------ | ------ | ----------------------------------------------------------------------------------- | ---------------------------------- |
| M07B-01 | mobile | M07b   | White background and an amber border instead of the yellow fill in the light theme. | zrobione (faza 3)                  |
| M07B-02 | mobile | M07b   | Match the rounding and the border thickness.                                        | zrobione (faza 3)                  |
| M07B-03 | mobile | M07b   | Strengthen the counters and the action texts.                                       | zrobione (faza 3)                  |
| M07B-04 | mobile | M07b   | Keep the message "Wyniki dla poprzedniej spiżarki".                                 | wcześniej zaakceptowane odstępstwo |
| M07B-05 | mobile | M07b   | The descriptive white note of the mockup does not go into the app.                  | wcześniej zaakceptowane odstępstwo |

## M08: loading

| Id     | Scope  | Mockup | Finding                                                                                   | Status                     |
| ------ | ------ | ------ | ----------------------------------------------------------------------------------------- | -------------------------- |
| M08-01 | mobile | M08    | Neutral skeleton color instead of greenish.                                               | zrobione (faza 2)          |
| M08-02 | mobile | M08    | Shapes and spacing matching the target M10A tile.                                         | zrobione (faza 2)          |
| M08-03 | mobile | M08    | The place of the percentage matches the accepted metadata layout.                         | zrobione (faza 2)          |
| M08-04 | mobile | M08    | Skeleton height follows the corrected tiles, not set independently.                       | zrobione (faza 2)          |
| M08-05 | mobile | M08    | To check in behaviour: the first load shows skeletons.                                    | porównane, zgodne (faza 7) |
| M08-06 | mobile | M08    | To check in behaviour: later filtering keeps the previous results and dims them slightly. | porównane, zgodne (faza 7) |

## M09: no results

| Id     | Scope  | Mockup | Finding                                                                                                    | Status                             |
| ------ | ------ | ------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M09-01 | mobile | M09    | Slightly enlarge the icon circle.                                                                          | zrobione (faza 2)                  |
| M09-02 | mobile | M09    | Tags without visible borders, with stronger text.                                                          | zrobione (faza 2)                  |
| M09-03 | mobile | M09    | Match the spacing inside the card.                                                                         | zrobione (faza 2)                  |
| M09-04 | mobile | M09    | Strengthen the "Zmień wykluczenia" button and match its width.                                             | zrobione (faza 2)                  |
| M09-05 | mobile | M09    | Layout, content and the list of exclusions are right; a larger number of tags naturally raises the height. | wcześniej zaakceptowane odstępstwo |

## M11, M18: mobile details

| Id     | Scope  | Mockup   | Finding                                                                                    | Status                             |
| ------ | ------ | -------- | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| M11-01 | mobile | M11, M18 | Reduce the height of the illustration band to the compact intent.                          | zrobione (faza 4)                  |
| M11-02 | mobile | M11, M18 | Keep the full width of the title and the pills.                                            | zrobione (faza 4)                  |
| M11-03 | mobile | M11      | Light theme: time and servings on a white background.                                      | zrobione (faza 4)                  |
| M11-04 | mobile | M18      | Dark theme: the backgrounds of the time and servings pills less lightened.                 | zrobione (faza 4)                  |
| M11-05 | mobile | M11, M18 | Strengthen the pill labels.                                                                | zrobione (faza 4)                  |
| M11-06 | mobile | M11, M18 | Match the spacing between the title, the metadata and the macro.                           | zrobione (faza 4)                  |
| M11-07 | mobile | M11, M18 | Add a separator under the ingredients header, also before the first item.                  | zrobione (faza 4)                  |
| M11-08 | mobile | M18      | Dark macro: tiles darker than the surrounding card, not lighter.                           | zrobione (faza 4)                  |
| M11-09 | mobile | M11      | Title 20 px.                                                                               | wcześniej zaakceptowane odstępstwo |
| M11-10 | mobile | M11      | The additional navbar.                                                                     | wcześniej zaakceptowane odstępstwo |
| M11-11 | mobile | M11      | The decorative band color follows the illustration.                                        | wcześniej zaakceptowane odstępstwo |
| M11-12 | mobile | M11      | No author actions for other people's recipes.                                              | wcześniej zaakceptowane odstępstwo |
| M11-13 | mobile | M11, M18 | The full lower part (ingredients and steps) has not been compared on matching screenshots. | porównane, zgodne (faza 7)         |

## M12a: author actions

| Id      | Scope  | Mockup | Finding                                                                                                                                                                                                                                                                                                                                                                                                              | Status                             |
| ------- | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M12A-01 | mobile | M12a   | Mockup: a sheet from the bottom, dimming, the recipe name and a separate "Anuluj". App: a small popover under "⋯". The popover was an earlier agreed simplification; it is not marked as matching M12a, and it is not rebuilt without a decision. Decision 2026-10-28: keep the popover; it only takes the shared popover styling of M21 (rounding, border, shadow). Not a match with M12a, recorded as a deviation. | wcześniej zaakceptowane odstępstwo |

## M12b: deleting

| Id      | Scope  | Mockup | Finding                                                                   | Status                             |
| ------- | ------ | ------ | ------------------------------------------------------------------------- | ---------------------------------- |
| M12B-01 | mobile | M12b   | White dialog background in the light theme instead of cream.              | zrobione (faza 6)                  |
| M12B-02 | mobile | M12b   | Stronger button labels.                                                   | zrobione (faza 6)                  |
| M12B-03 | mobile | M12b   | Match the rounding and the spacing.                                       | zrobione (faza 6)                  |
| M12B-04 | mobile | M12b   | Reduce the icon circle to the mockup proportion.                          | zrobione (faza 6)                  |
| M12B-05 | mobile | M12b   | "Usuń" above "Anuluj".                                                    | wcześniej zaakceptowane odstępstwo |
| M12B-06 | mobile | M12b   | The warning text, the destructive color and the locks during the request. | wcześniej zaakceptowane odstępstwo |

## M13, M14, M22 B: mobile form

| Id     | Scope  | Mockup          | Finding                                                                                                                                                                                                                       | Status                             |
| ------ | ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M13-01 | mobile | M13, M14        | A more compact bar "× Dodaj/Edytuj przepis".                                                                                                                                                                                  | zrobione (faza 5)                  |
| M13-02 | mobile | M13, M14        | Less empty space before the first card.                                                                                                                                                                                       | zrobione (faza 5)                  |
| M13-03 | mobile | M13, M14, M22 B | Stronger labels, headings and buttons.                                                                                                                                                                                        | zrobione (faza 5)                  |
| M13-04 | mobile | M13             | Error banner: stronger heading and a visible bullet list of links.                                                                                                                                                            | zrobione (faza 5)                  |
| M13-05 | mobile | M13             | Icons by the field error messages.                                                                                                                                                                                            | zrobione (faza 5)                  |
| M13-06 | mobile | M13             | Keep the red borders and the correct order of opening sections and focus.                                                                                                                                                     | zrobione (faza 5)                  |
| M13-07 | mobile | M13             | Mockup: a separate illustration card before the name. App: the preview inside the name card, agreed earlier. Final decision needed. Decision 2026-10-28: keep the preview in the name card; recorded as a deviation from M13. | wcześniej zaakceptowane odstępstwo |
| M13-08 | mobile | M22 B           | M22 B replaces the older layout of all ingredients open.                                                                                                                                                                      | wcześniej zaakceptowane odstępstwo |
| M13-09 | mobile | M22 B           | One ingredient expanded on the phone.                                                                                                                                                                                         | wcześniej zaakceptowane odstępstwo |
| M13-10 | mobile | M22 B           | No bin for the only ingredient.                                                                                                                                                                                               | wcześniej zaakceptowane odstępstwo |
| M13-11 | mobile | M13             | The mobile save bar.                                                                                                                                                                                                          | wcześniej zaakceptowane odstępstwo |
| M13-12 | mobile | M13             | Automatic preview without a picker.                                                                                                                                                                                           | wcześniej zaakceptowane odstępstwo |
| M13-13 | mobile | M22 B           | Not fully compared: an expanded substitute with an error.                                                                                                                                                                     | porównane, zgodne (faza 7)         |
| M13-14 | mobile | M13             | Not fully compared: an invalid step.                                                                                                                                                                                          | porównane, zgodne (faza 7)         |
| M13-15 | mobile | M13             | Not fully compared: the lower sections of the form.                                                                                                                                                                           | porównane, zgodne (faza 7)         |

## M16: recipe added

| Id     | Scope  | Mockup | Finding                                                                                                                                                                                        | Status                             |
| ------ | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M16-01 | mobile | M16    | Remove the bordered card around the whole screen.                                                                                                                                              | zrobione (faza 5)                  |
| M16-02 | mobile | M16    | A large centered success icon in a light circle.                                                                                                                                               | zrobione (faza 5)                  |
| M16-03 | mobile | M16    | A strong heading under the icon.                                                                                                                                                               | zrobione (faza 5)                  |
| M16-04 | mobile | M16    | A separate white recipe summary card.                                                                                                                                                          | zrobione (faza 5)                  |
| M16-05 | mobile | M16    | Two actions outside the card, full width.                                                                                                                                                      | zrobione (faza 5)                  |
| M16-06 | mobile | M16    | The main action olive, the secondary filled.                                                                                                                                                   | zrobione (faza 5)                  |
| M16-07 | mobile | M16    | 48 px buttons and stronger text.                                                                                                                                                               | zrobione (faza 5)                  |
| M16-08 | mobile | M16    | Match the vertical spacing.                                                                                                                                                                    | zrobione (faza 5)                  |
| M16-09 | mobile | M16    | Show time and servings when they exist.                                                                                                                                                        | zrobione (faza 5)                  |
| M16-10 | mobile | M16    | The bubble "Zmiany zapisane" after editing stays a proposal, not an automatically approved feature. Decision 2026-10-28: the bubble is not added; M16 covers only the "Przepis dodany" screen. | wcześniej zaakceptowane odstępstwo |

## M19: fetch error

| Id     | Scope  | Mockup | Finding                                                                                                 | Status                             |
| ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M19-01 | mobile | M19    | Match the spacing, the weight of the message and of the button.                                         | zrobione (faza 2)                  |
| M19-02 | mobile | M19    | If old results are kept after a refresh error, mark them as outdated and dim them.                      | zrobione (faza 2)                  |
| M19-03 | mobile | M19    | Distinguish that case from the first failed load without results.                                       | zrobione (faza 2)                  |
| M19-04 | mobile | M19    | The text "Brak połączenia…" is an acceptable variant; messages are not changed just to copy the mockup. | wcześniej zaakceptowane odstępstwo |

## M20: 404

| Id     | Scope  | Mockup | Finding                                                    | Status                             |
| ------ | ------ | ------ | ---------------------------------------------------------- | ---------------------------------- |
| M20-01 | mobile | M20    | Move the block closer to the middle of the available area. | zrobione (faza 6)                  |
| M20-02 | mobile | M20    | Enlarge the icon circle.                                   | zrobione (faza 6)                  |
| M20-03 | mobile | M20    | Tone down the icon itself.                                 | zrobione (faza 6)                  |
| M20-04 | mobile | M20    | Match the spacing and the width and weight of the button.  | zrobione (faza 6)                  |
| M20-05 | mobile | M20    | Content and the return target stay unchanged.              | wcześniej zaakceptowane odstępstwo |

## M21: account menu

| Id     | Scope  | Mockup | Finding                                                                                                                                                                                                               | Status                             |
| ------ | ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| M21-01 | mobile | M21    | Larger rounding.                                                                                                                                                                                                      | zrobione (faza 6)                  |
| M21-02 | mobile | M21    | A less dominant border, a shadow as in the design.                                                                                                                                                                    | zrobione (faza 6)                  |
| M21-03 | mobile | M21    | Match the size of the icons, texts and vertical spacing.                                                                                                                                                              | zrobione (faza 6)                  |
| M21-04 | mobile | M21    | The dimming of the background is in the mockup and not in the app; no dimming was an earlier accepted simplification. To be decided again. Decision 2026-10-28: no dimming behind the menu; the other M21 fixes stay. | wcześniej zaakceptowane odstępstwo |

## Count (final, phase 7)

Total 182 findings: zrobione 118, wcześniej zaakceptowane odstępstwo 56, porównane, zgodne 8.

The four points that needed a decision (M12A-01, M13-07, M16-10, M21-04) were decided on 2026-10-28 and are recorded as accepted deviations. No finding is left as "do poprawy" or "jeszcze nieporównane"; what remains open is the author's own review of dark-theme and special-state variants (see `plan.md` Progress).
