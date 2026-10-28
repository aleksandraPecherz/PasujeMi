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
