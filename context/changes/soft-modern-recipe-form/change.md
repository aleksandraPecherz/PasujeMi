---
change_id: soft-modern-recipe-form
title: Recipe add/edit form in Soft Modern
status: implementing
created: 2026-10-28
updated: 2026-10-28
archived_at: null
---

## Notes

Issue #63. View: RecipeForm (new + edit). Design system: existing Soft Modern tokens in src/styles/global.css, components in src/components/ui/ (variant: existing design system, no new dependencies).
Mockups (.tmp-style-review/, local, not committed): M13, M14, M22 (variant B), M25, D04.

Decisions: desktop = right column with Save + Cancel, no illustration card/picker; close/Cancel: new -> recipe list, edit -> recipe details; kinds keep checkbox semantics with chip look; phone = one ingredient expanded, desktop = all expanded; add opens the new one, edit starts collapsed; removal must not open another ingredient (state by row key); on failed save open the ingredient + its substitutes/nutrition before focusing; error summary links open the target section; no change to data shape, domain validation, endpoints, permissions; no new dependencies; no on-screen keyboard detection, sticky save bar must not block scrolling to fields/errors; keep a11y and required-field markers.
Out of scope: illustration picker, AI, unsaved-changes warning, keyboard handling. Aggregate mockup comparison still required before M-2 closes.

Scope change (2026-10-28, author): new recipes get an illustration from the existing library automatically, with no picker and no AI. Decisions: a database trigger `BEFORE INSERT OR UPDATE OF name ... WHEN (new.illustration IS NULL)` (no grant widening, no service role, no `SECURITY DEFINER`); functions in schema `private`, execute limited; existing illustrations are never overwritten; unknown name keeps the placeholder; rules do not have to reproduce the 76 hand-made assignments; SQL and TS are compared on shared cases (real results through the trigger on the local database); preview on phone next to the name, on desktop in the right column above Save/Anuluj (right column kept). Plan now has 6 phases: 4 Illustration rules (TS + SQL), 5 Illustration preview, 6 Kitchen sink and final gate (was 4). Phase 3 stays implemented and uncommitted until the author's visual check. No migrations applied remotely, no commits, no pushes as part of this planning step.

Phase 2 accepted visually by the author (look of the ingredient rows, M22 variant B on phone, D04 row on desktop). Manual rows 2.3 and 2.4 in plan.md stay unchecked: the detailed checks (typed values after collapse/expand, Tab order) were not run as a separate pass. Aggregate mockup comparison stays for the end of M-2.

Phase 5 accepted visually by the author (illustration preview on phone and desktop). Matching rules stay as they are; extending them is deferred to M-3 with new recipes. Manual row 5.5 (edit keeps a stored illustration, new recipe saves with the previewed one) stays unchecked: it was exercised by an automated browser run on the local database, not confirmed by the author. Aggregate mockup comparison still open before M-2 closes.

Phase 6 implemented, not yet committed (waiting for the author): kitchen sink states added (sections open, error in a collapsed ingredient, illustration preview, state matrix) and the AGENTS.md rule on key-based disclosure. Automated rows 6.1-6.2 pass. Row 6.3 stays open: desktop and phone (390 px) screenshots, light and dark, were taken in a local browser run (kept outside the repo) but not reviewed or confirmed by the author. Row 6.4 stays open: the aggregate mockup comparison must happen before M-2 closes.

Aggregate comparison of M-2 with the mockups (author, after phase 6): it found discrepancies, so full conformance is NOT claimed and M-2 is not closed. Row 6.4 stays open; the findings are tracked in the follow-up change soft-modern-visual-alignment.
