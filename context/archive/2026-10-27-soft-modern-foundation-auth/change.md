---
change_id: soft-modern-foundation-auth
title: Soft Modern foundation, header and sign-in restyle
status: archived
created: 2026-10-27
updated: 2026-10-28
archived_at: 2026-10-28T21:33:22Z
---

## Notes

Issue #60: M-2 / Etap 1 — fundament Soft Modern v2 i nowy wygląd logowania.
Mockups: `.tmp-style-review/` (reference data only). Illustrations come in #61.
Verification status and open manual checks: `verification.md`.

## Archive notes (2026-10-28)

- Integration: PR #65 (https://github.com/aleksandraPecherz/PasujeMi/pull/65), merged 2026-10-28 as merge commit 53758df; checks on that commit: Workers Builds `pasuje-mi` success, `ci` success, `smoke` success.
- Closed issue: #60 (milestone M-2). Commit 656c7f7. No migrations in this change.
- Accepted limitation (2026-10-28, the author): the rows below were NOT verified and are NOT checked as passed; archiving does not turn them into passes. Nothing was tested on a real phone or with a real on-screen keyboard.
- Rows left unchecked: 3.2 (the CI `smoke` job passed on the #65 and #66 merge commits, but the row was not checked off in this plan), 2.3, 2.4, 3.3, 4.2 (visual and keyboard checks of the header, account menu and auth screens in both themes). The aggregate comparison of the M-2 views with the mockups was done later in `soft-modern-visual-alignment` (findings and the author's acceptance of its final screenshot set), which does not replace these rows.
