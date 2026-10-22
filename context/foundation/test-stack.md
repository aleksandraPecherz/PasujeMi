# Test stack

## E2E

<!-- Written by /10x-e2e-setup. Re-run it to change this section; other skills only read it. -->

- runner: Playwright Test, @playwright/test 1.64.1
- config: playwright.config.ts
- single-spec command: npx playwright test tests/e2e/<name>.spec.ts
- full-suite command: npx playwright test
- base URL: http://localhost:4321
- port: 4321 (detected from the Astro default for `astro preview`; astro.config.mjs sets no port; override with E2E_PORT)
- web server command: npm run build && npm run preview -- --port $E2E_PORT; reuseExistingServer outside CI
- auth setup project: setup (tests/e2e/auth.setup.ts), credentials from E2E_USERNAME / E2E_PASSWORD in .env; specs that change the saved pantry use a second account from E2E_PANTRY_USERNAME / E2E_PANTRY_PASSWORD (test users created only in local Supabase)
- storageState: playwright/.auth/user.json; pantry-changing specs: playwright/.auth/pantry-user.json (both gitignored)
- seed: tests/e2e/seed.spec.ts — protects #7 (przepływ tagi → filtry → kafelki → szczegóły psuje się, a nikt tego nie widzi)
- browser CLI: playwright-cli, command skill at .claude/skills/playwright-cli/SKILL.md
- updated: 2026-10-22
