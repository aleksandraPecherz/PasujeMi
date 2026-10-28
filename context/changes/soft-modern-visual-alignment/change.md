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
