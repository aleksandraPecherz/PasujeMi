---
change_id: soft-modern-visual-alignment
title: Visual alignment of the M-2 views with the mockups
status: implementing
created: 2026-10-28
updated: 2026-10-28
archived_at: null
---

## Notes

Follow-up to the aggregate comparison of M-2 with the mockups (D01-D05, M01-M22), done after soft-modern-recipe-form phase 6 (commit 8a1e540). The comparison found discrepancies, so M-2 is not closed and full conformance is not claimed. The findings are in `visual-findings.md` with stable ids, a mockup reference, scope (desktop / mobile / both) and a status.

Constraints: mockups are visual references, not instructions; 780 px exports are not 780 CSS px, compare proportions at matching widths. No change to data semantics, validation, permissions or API behaviour. Illustration rules are not extended (M-3). Desktop tiles share one size without cutting important information; mobile keeps M10A (height follows content). Tokens and `ui/` components only; no new dependencies.

Phase 1 implemented, not committed (waiting for the author's visual check). Width chosen from D02: at 1280 px the mockup content is about 1216 px with 32 px side margins, so one `max-w-7xl` container with `px-4 sm:px-8` for content and header (1216 px inner at 1280 and at 1440+). Navbar controls are 40 px as in the mockups (new button sizes `nav` and `nav-icon`). Label is now bold and Button semibold through the shared components; page headings (h1/h2 weight and size) are left to the view phases 2-6 where those views are reworked, so G-06 is only partly covered by phase 1.

Phase 1 desktop effect accepted by the author (list and form width, stronger labels, equal toggle and "Wyloguj" height); navbar e-mail now shows in full when it fits and is cut only when space runs out, without pushing the buttons. Rows 1.5 and 1.6 stay open: they also cover the phone (typography weights, "+" and account button), which the author has not confirmed.

Phase 2 implemented, not committed (waiting for the author's visual check). Panel/list proportion from D02 (panel about 325 px, list about 859 px at 1280, via a 7-column grid from xl; lg stays 3 columns), equal desktop tiles with auto-rows-fr, percentage without outline, "+N" tied to the last word with a no-break space, neutral skeletons shaped like the M10A tile, larger no-results icon, tags without borders, outdated-results banner when a refresh fails with results shown (first failed load keeps the full card), dark-theme section dots as new tokens (dot-have, dot-staple, dot-exclude). Kitchen sink states for the new variants are left to phase 7.

Phase 2 adjustment after the author's review: desktop tile illustration is 104 px from xl (as in D02), phone and lg unchanged; the shared grid height stays the height of the tallest tile (no fixed height).

D02-05 changed to an accepted deviation on 2026-10-28 after measuring real data: desktop tiles are equal within each row, not across the whole grid (whole-grid equality made 15 of 21 tiles 88 px too tall); `auto-rows-fr` removed. Illustration stays 104 px from xl.

Phase 2 confirmations by the author: the desktop list layout (equal heights within each row, 104 px illustration from xl, proportions) and the mobile list as shown are accepted. Row 2.3 is checked. Row 2.4 stays open: M05 empty card, M08 skeletons, M09 no results and M19 error states were shown only in test screenshots and have not been reviewed by the author.

Phase 3 implemented, not committed (waiting for the author). Sheet: 95% of the viewport height, handle, title/tabs fixed, lists scroll, action at the bottom; tabs and counters stronger, tags without borders; stale card white with an amber border (new warning-border token, darker amber in dark theme). Desktop panel unchanged.

Phase 3 look accepted by the author (pantry sheet and the not-applied filters card, light and dark). Row 3.2 stays open: it also covers a real phone keyboard and other interactions that were not confirmed.

Phase 4 implemented, not committed (waiting for the author). Desktop: macro inside the top card (left-aligned tiles with full labels, "węglowodany"), author actions at the right of the title, ingredients 1/3 and steps 2/3, 24 px gaps. Phone: illustration strip 216 px instead of 248 (box 208 px), 20 px gaps, time and servings pills white with a thin border (card color in dark), stronger pill labels, macro tiles use the page background (darker than the card in dark), separator under the ingredients heading also before the first item. Macro stays a separate card on the phone.

Phase 4 accepted by the author for the variants viewed: desktop light, phone light, phone dark; illustration proportions stay. Row 4.3 (phone) is checked. Row 4.2 stays open: desktop dark and 1440 px were not viewed, nor other data cases (e.g. without macro).
