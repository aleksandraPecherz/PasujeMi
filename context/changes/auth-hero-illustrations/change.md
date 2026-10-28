---
change_id: auth-hero-illustrations
title: Auth hero illustrations
status: done
created: 2026-10-28
updated: 2026-10-28
archived_at: null
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
