<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Logowanie jako brama do aplikacji (S-01)

- **Plan**: context/changes/login-gated-app-shell-review/plan.md (kopia z context/archive/2026-10-12-login-gated-app-shell/plan.md)
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Reviewed code**: 522cebd..5783335 (p1 4480069, p2 5379e27); każde ustalenie sprawdzone też na master @ 29d24cf
- **Date**: 2026-10-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Evidence

- Plan vs diff: all 5 changes in Phase 1 and all 5 in Phase 2 match the plan (MATCH). Middleware: `PUBLIC_PREFIXES` with a trailing slash; 401 JSON for `/api/*`; signed-in users are redirected only from `/auth/signin` and `/auth/signup`, with the trailing slash tolerated. Endpoints pass `error.code ?? "unknown"` in the URL. `authErrorMessage` uses `Object.hasOwn`, so `__proto__` cannot match a code. The Polish plural form is correct for 1–5.
- Extra relative to the plan: `eslint.config.js` (F2). `context/foundation/roadmap.md` is an expected epilogue change.
- Current state on master: `src/middleware.ts`, `src/lib/auth-errors.ts`, the auth endpoints and the pages are unchanged since S-01. F-01 extended `scripts/smoke.mjs` (body parsing plus a `check` on `/api/recipes` for signed-in users) and `ci.yml` (RLS check). It did not change the S-01 assertions.
- Automated checks (run on master @ 29d24cf): `npm run lint` passes; `npx astro check` passes (0 errors, 0 warnings); `npm run build` passes; grep for starter files returns nothing; grep for English strings returns nothing.
- `npm run smoke` was **not run locally**. The running dev server uses the hosted Supabase project (`*.supabase.co`), so the test would create a real account there. Evidence instead: CI is green on 5379e27 and 5783335 (the smoke job ran against local Supabase; the epilogue cites run 38255748072), and CI is green on current master.
- Read-only anonymous checks against the dev server on master: `/`, `/cokolwiek`, `/authors` and `/auth` → 302 `/auth/signin`; `/api/recipes` and `/api/auth` → 401 `{"error":"unauthorized"}`; `/auth/signin` → 200; `?error=Kliknij tutaj evil.com` and `?error=__proto__` → the generic Polish message, with the URL text absent from the page; `?error=invalid_credentials` → "Nieprawidłowy e-mail lub hasło."

## Findings

### F1 — Smoke checks of the gate assert only the status, not what was returned

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:45, 51-55, 74 (master; in 5783335: lines 42, 48-52, 58)
- **Detail**: Several smoke steps check only the status code. "app shell renders for signed-in user" expects `200` without checking that this is the PasujeMi shell: a starter page or any other 200 would pass, so manual criterion 1.7 has no automated counterpart. "anonymous api request gets 401" ignores the `{ "error": "unauthorized" }` body promised in the plan's contract; master already parses JSON in `request()` but does not check this step. "signin rejects wrong password" uses only the prefix `/auth/signin?error=`, even though since Phase 2 the code is deterministic (`invalid_credentials`). This is the class of problem described in the lesson "Assert status and body type before content in HTTP checks". The plan itself specified only statuses, so this is partly a flaw in the plan. **Still present on master.**
- **Fix**: Add `check` assertions (the mechanism already exists on master): the 401 step gets `body?.error === "unauthorized"`; wrong password gets `location: "/auth/signin?error=invalid_credentials"`; for the shell, `request()` returns the HTML text and the step checks that it contains "Wyloguj".
- **Decision**: FIXED — Fix now; also removed the unused `locationPrefix` mechanism (at the user's request: no dead code)

### F2 — Unplanned change to eslint.config.js

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:3, 83
- **Detail**: Phase 1 added `globalIgnores([".claude/"])`, which neither the plan nor the commit description mentions. It is harmless and needed, since the course tooling in `.claude/` is not app code, but it went in without a trace in the plan. **Still present on master** (as intended).
- **Fix**: Accept it as is; optionally add a one-line note to the review notes. The archived plan must not be edited.
- **Decision**: ACCEPTED — ignoring .claude/ in ESLint is needed because it holds course tooling, not app code; the change was deliberate and stays.

### F3 — Phase 2 manual criteria ticked in the epilogue without recorded evidence

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/archive/2026-10-12-login-gated-app-shell/plan.md (Progress 2.6–2.10)
- **Detail**: Items 2.6–2.10 were ticked in the closing commit 5783335 together with the automated ones, without any record of how they were checked. Item 1.5 (smoke for Phase 1) was also confirmed only in CI after p2, because p1 had no CI run of its own. During this review I confirmed 2.10 and part of 1.6 with read-only HTTP requests. I checked 2.9 (plural form) by reading the code. Items 2.6–2.8 cannot be confirmed from the diff. Item 2.8 depends on the setting: with email confirmation turned on, Supabase does not return `user_already_exists`, so the message appears only with confirmation turned off. **Not a code problem; the status on master is the same.**
- **Fix**: Accept as a risk; a short visual check of the signup form against the hosted environment is optional.
- **Decision**: FIXED (differently) — 2.6 and 2.7 checked by hand locally (npm run dev, 2026-10-12): the screens and messages are in Polish, and a wrong password shows „Nieprawidłowy e-mail lub hasło.” 2.8 ACCEPTED: with email confirmation turned on, Supabase deliberately does not return user_already_exists (anti-enumeration). 2.9 and 2.10 were confirmed during the review.

### F4 — Unknown path for a signed-in user shows Astro's English 404 page

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/ (no 404.astro)
- **Detail**: The gate correctly lets a signed-in user reach any path, but the project has no `src/pages/404.astro`. `/cokolwiek` and the old `/dashboard` therefore show Astro's default English 404 page, without the PasujeMi header. The plan accepted the 404 for `/dashboard` and limited the translation to auth screens, so this is outside the scope of S-01. Even so, it is the only English screen a signed-in user can reach in a Polish-language app. **Still present on master.**
- **Fix**: As a follow-up (outside S-01), add `src/pages/404.astro` on `AppLayout` with a Polish message and a link to `/`.
- **Decision**: ACCEPTED (follow-up) — outside S-01's scope; a Polish 404 page will be added in S-02 (recipe list and details), where the first links that can lead nowhere appear. Recorded in follow-ups/review-fixes.md.

## Triage summary

- Fixed: F1 (Fix now + removed locationPrefix), F3 (checked by hand; 2.8 accepted)
- Accepted: F2 (deliberate), F4 (follow-up in S-02)
