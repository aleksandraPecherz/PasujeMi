---
change_id: auth-hero-illustrations
title: Auth hero illustrations
status: archived
created: 2026-10-28
updated: 2026-10-28
archived_at: 2026-10-28T21:33:40Z
---

## Notes

Soft Modern stage 2, small fix (no plan chain). Fill the decorative panel of `AuthShell` with the existing SVGs from `public/illustrations` (no new drawings or dependencies), matching D01 (desktop) and M01/M03 (phone) from `.tmp-style-review/`.

Scope:

- `AuthShell.astro` gets an explicit `variant` prop: `signin` (green panel, tagline on phone, two tiles) or `signup` (yellow `illus-yellow` panel, logo only on phone, one tile). No path detection.
- Desktop: `kanapka-jajko`, `salatka`, `kanapka`, `slodka-miska` composed as in D01. Phone: strip with illustrations on the right, tagline limited to 3/5 width so nothing overlaps it; no fixed height.
- SVGs already include the plate, so no extra circle. Decorative: empty `alt`, `aria-hidden`, not focusable.
- `confirm-email.astro` stays without a strip. Auth logic, forms and recipe form untouched.
- Verification: lint, `check:ui`, `astro check` only. Visual review by the author.

## Result

Implemented in `AuthShell.astro` (`variant` prop), `signin.astro` / `signup.astro` pass it; `AuthShell.astro` added to `CLEAN_FILES`. `eslint`, `check:ui` and `astro check` pass (0 errors). No full tests or build, by request. Appearance accepted by the author on 2026-10-28: sign-in and sign-up, desktop and phone, light and dark theme.

## Archive notes (2026-10-28)

- Integration: PR #66 (https://github.com/aleksandraPecherz/PasujeMi/pull/66), merged 2026-10-28 as merge commit bf2d990 (history kept, merge commit); checks on that commit: Workers Builds `pasuje-mi` success (Build ID bba9e8cf-9013-4ada-9276-d6ba9bb9a9a4, Version ID 08e20bf7-2c30-4c20-a892-d5786c02c653, production), `ci` success, `smoke` success. The AI `review` job failed with an execution error (outcome "error") and was skipped on purpose; it is not a required check.
- Part of the M-2 stage 2 work. Commit 25d12b5. No migrations.
- Accepted limitation (2026-10-28, the author): the rows below were NOT verified and are NOT checked as passed; archiving does not turn them into passes. Nothing was tested on a real phone or with a real on-screen keyboard.
- No Progress section (a small fix without a plan chain). The appearance was accepted by the author on 2026-10-28; the later auth corrections are in `soft-modern-visual-alignment` phase 6.
