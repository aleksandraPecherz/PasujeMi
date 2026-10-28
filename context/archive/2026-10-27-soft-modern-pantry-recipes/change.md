---
change_id: soft-modern-pantry-recipes
title: Soft Modern pantry, recipe list and illustrations
status: archived
created: 2026-10-27
updated: 2026-10-28
archived_at: 2026-10-28T21:33:34Z
---

## Notes

Issue #61: M-2 / Etap 1 — spiżarka, lista przepisów i ilustracje w Soft Modern v2.
Foundation and auth: commit 656c7f7 (`soft-modern-foundation-auth`). Mockups: `.tmp-style-review/` (M05–M09, M10A, M19, M23b, D02, D05, "Ilustracje"; reference data only).
Recipe → illustration mapping accepted 2026-10-28: `illustration-map.md`; verification state: `verification.md`.

## Archive notes (2026-10-28)

- Integration: PR #65 (https://github.com/aleksandraPecherz/PasujeMi/pull/65), merged 2026-10-28 as merge commit 53758df; checks on that commit: Workers Builds `pasuje-mi` success, `ci` success, `smoke` success.
- Closed issue: #61 (milestone M-2). Commit 4ff91c4.
- Migration `20261027120000_add_recipe_illustration.sql` (column `recipes.illustration`): found applied on the production Supabase project `zocbniggvvctublymudo` (read-only check on 2026-10-28; `migration list` in sync; 76 of 76 recipes have an illustration, 0 empty). The application of the migration and of the assignment was not performed or logged inside this change.
- Accepted limitation (2026-10-28, the author): the rows below were NOT verified and are NOT checked as passed; archiving does not turn them into passes. Nothing was tested on a real phone or with a real on-screen keyboard.
- Rows left unchecked: 1.3 (the author reviews the migration), 2.3, 2.4, 3.3, 3.4, 3.5, 3.6, 4.5 (tiles, substitute wording, phone bar and sheet, unapplied-filters message, desktop panel, empty/loading/error states, overall visual acceptance), and 4.4 (the author applies the migration and the assignment on a chosen environment; as of 2026-10-28 production already has the column, 76/76 assigned, but this was observed, not logged as the author's step). Pantry tiles, sheet and states were revisited and accepted in `soft-modern-visual-alignment` (phases 2 and 3) for the variants the author viewed.
