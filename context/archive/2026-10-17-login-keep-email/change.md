---
change_id: login-keep-email
title: Login keep email
status: archived
created: 2026-10-17
updated: 2026-10-17
archived_at: 2026-10-17T18:14:49Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- 2026-10-17 — Manual check 2.7: Supabase answers a sign-up with an existing e-mail with success (no `user_already_exists`), so the sign-up error path could not be triggered by hand. Covered by the kitchen sink state and the shared `authErrorRedirect` path.
- 2026-10-17 — Gate 1.4 (`npm run smoke`) left to the CI smoke job: no local Docker/Supabase, and the hosted project has email confirmation on. Passed in CI on PR #26.
