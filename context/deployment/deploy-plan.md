# First production deploy: PasujeMi on Cloudflare Workers

**Status:** blocked at Phase 5 (2026-10-11). Phases 0–4 are done. `master` is pushed (0604ab2), and Workers Builds is connected but both builds **failed** (`442b0db0`, `94705c21`). Production is unaffected and still runs `b85cc2f0`.
**Approved:** 2026-10-11
**Inputs:** @context/foundation/infrastructure.md, @context/foundation/tech-stack.md

## Context

`context/foundation/infrastructure.md` (commit 516ed96) chose **Cloudflare Workers**.

`tech-stack.md` still says `cloudflare-pages`, but `@astrojs/cloudflare` 14.3.1 supports Workers only. Deploys therefore use `wrangler deploy` and never `wrangler pages deploy`. `tech-stack.md` is not edited here; that is a separate `/10x-tech-stack-selector` re-run.

**Goal:** the app is live at `https://pasuje-mi.<subdomain>.workers.dev` and backed by a new EU Supabase project. After that, every push to `master` auto-deploys through Cloudflare Workers Builds. GitHub Actions stays lint/check/smoke only and gets no deploy step.

**Decisions taken with the user:**

| Topic            | Decision                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| Supabase         | Create a new project in an EU region                                       |
| Deploy method    | First deploy manually from the CLI, then connect Workers Builds            |
| Production check | Anonymous checks by script; manual signup, with email confirmation left ON |
| Plan location    | `context/deployment/deploy-plan.md` (this file)                            |

**Verified state:**

- Versions: wrangler 4.131.1 (4.149.0 since commit a488adf), `@astrojs/cloudflare` 14.3.1, astro 7.3.2.
- The build goes through `@cloudflare/vite-plugin` and emits `dist/server/wrangler.json`. `npx wrangler deploy` uses it as a redirected configuration.
- `supabase/migrations/` does not exist, so there is no schema to push yet.
- `.dev.vars`, `.env` and `.wrangler/` are gitignored.

Legend: 🤖 = agent runs it. 👤 = user does it (browser or dashboard). ✋ = needs explicit user approval before running.

## Phase 0: Prerequisites (tools, accounts, CLI login)

### 0.1 Local tools

Tool state was checked on this machine on 2026-10-11. All the CLIs this deploy needs are project devDependencies, so `npm ci` installs them and nothing has to be installed globally. Always call them with `npx`, so the version pinned in `package-lock.json` runs, not some global copy.

| Tool                      | Required                         | How to get it                                              | Check                    | State on 2026-10-11                                                                                                                                                               |
| ------------------------- | -------------------------------- | ---------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                   | `22.14.0` (`.nvmrc`; CI uses 22) | nvm-windows: `nvm install 22.14.0`, then `nvm use 22.14.0` | `node -v`                | ✅ v22.14.0                                                                                                                                                                       |
| npm                       | ships with Node                  | —                                                          | `npm -v`                 | ✅ 10.9.2                                                                                                                                                                         |
| Project dependencies      | `package-lock.json`              | `npm ci`                                                   | `npx astro --version`    | ✅ installed                                                                                                                                                                      |
| wrangler (Cloudflare CLI) | devDependency `^4.149.0`         | installed by `npm ci`; run as `npx wrangler …`             | `npx wrangler --version` | ✅ 4.149.0 (upgraded from 4.131.1 in commit a488adf)                                                                                                                              |
| Supabase CLI              | devDependency `supabase`         | installed by `npm ci`; run as `npx supabase …`             | `npx supabase --version` | ✅ 2.117.0                                                                                                                                                                        |
| Git                       | any recent version               | git-scm.com                                                | `git --version`          | ✅ 2.49.0                                                                                                                                                                         |
| GitHub CLI (`gh`)         | optional (verification only)     | cli.github.com, then `gh auth login`                       | `gh --version`           | ✅ 2.102.0, logged in as `aleksandraPecherz`. Workers Builds connects to GitHub through the Cloudflare dashboard, so `gh` is used only for read-only checks (check-runs, commits) |
| Docker                    | **not needed for deploy**        | Docker Desktop                                             | `docker --version`       | ➖ not installed. Only `npx supabase start` (local Supabase) needs it                                                                                                             |

- [x] 🤖 Check Node, npm, wrangler, Supabase CLI and Git against the table above.
- [x] 🤖 Dependencies are installed (`npm ci` was already run, and `npm run build` passes).

### 0.2 Accounts

| Account                          | Plan                                          | What it's for                                               | Who |
| -------------------------------- | --------------------------------------------- | ----------------------------------------------------------- | --- |
| Cloudflare (dash.cloudflare.com) | Free                                          | Hosting the Worker, `workers.dev` subdomain, Workers Builds | 👤  |
| Supabase (supabase.com)          | Free (max 2 active projects per org)          | Production Auth + Postgres                                  | 👤  |
| GitHub                           | already exists (`aleksandraPecherz/PasujeMi`) | Source for Workers Builds                                   | ✅  |

- [x] 👤 Create a Cloudflare account, or log in to an existing one.
- [x] 👤 In Cloudflare, go to Workers & Pages and register a **`workers.dev` subdomain**, if the account doesn't have one yet. It becomes part of the URL: `pasuje-mi.<subdomain>.workers.dev`. (Done during the first deploy: wrangler auto-assigned `pecherz-aleksandra`, and the user renamed it to **`przepisy-app`** in the dashboard.)
- [x] 👤 Create a Supabase account, or log in to an existing one.

### 0.3 Logging in the CLIs

- [x] 👤 **wrangler:** type `! npx wrangler login` in the Claude Code prompt. A browser opens; approve access, and the token is saved locally in the user profile, not in the repo. On 2026-10-11 the CLI was not logged in.
- [x] 🤖 `npx wrangler whoami` shows your e-mail and Account ID, and the list of permissions includes `workers (write)`. (2026-10-11: OAuth login, account `b3303b56aea7018d5974a9989a2909e0`, `workers (write)` present. wrangler now resolves to 4.149.0, because `package.json` was bumped to `^4.149.0`, which isn't committed yet. The account has **no `workers.dev` subdomain yet**: API error 10007.)
- [ ] 👤 (Optional) **Supabase CLI:** `! npx supabase login`. It isn't needed for this deploy; it will matter later for `supabase link` and `supabase db push` once the first migrations exist.

### 0.4 Agent access (optional)

- **Cloudflare MCP** (`mcp.cloudflare.com/mcp`, observability): structured log queries for the agent. It isn't needed, because `wrangler tail` and `wrangler deployments list` cover the deploy. Add it only if CLI logs aren't enough.
- **No API token in the repo.** A `CLOUDFLARE_API_TOKEN` would only be needed for deploys from GitHub Actions, which this plan doesn't use: deploys come from Workers Builds, and Cloudflare supplies the token itself.

**Phase 0 is done when** `npx wrangler whoami` shows your account and you have a `workers.dev` subdomain and a Supabase account.

## Phase 1: Repository changes ✅

- [x] 🤖 In `wrangler.jsonc`, rename `"name": "10x-astro-starter"` to `"name": "pasuje-mi"` (commit 1ac376c).
- [x] 🤖 Checks:
  - `npx astro check`: 0 errors.
  - `npm run build`: passes.
  - `npm run lint`: passes once line endings are tolerated (see the findings below).
- [x] 🤖 `npx wrangler deploy --dry-run`:
  - Name `pasuje-mi`.
  - Redirected config `dist/server/wrangler.json`.
  - Upload 2065.92 KiB, 455.48 KiB gzip.
  - Bindings `SESSION` (KV), `IMAGES` and `ASSETS`.
- [x] 🤖 Commit `Rename Worker to pasuje-mi`.

**Phase 1 findings:**

- **Lint fails locally on line endings.** The adapter is not involved. Git stores LF (`i/lf`), but the Windows working copy has CRLF (`w/crlf`), because `core.autocrlf=true` and the files were checked out before `.gitattributes` existed. Every one of the 1086 lint errors is `Delete ␍`. With `prettier/prettier` set to `endOfLine: auto`, lint is clean. CI and Workers Builds check out LF, so production is unaffected. Fixing the local working copy is a separate step.
- **Two extra bindings come from the adapter.** `@astrojs/cloudflare` adds `SESSION` (a KV namespace with no ID) and `IMAGES` (Cloudflare Images). On the first deploy, wrangler provisions the KV namespace in the account automatically. Both are available on Free, and the app does not use them yet.

## Phase 2: Supabase production project

- [x] 👤 Create a Supabase project (ref `zocbniggvvctublymudo`, `eu-central-1`):
  - **Region:** Central EU (Frankfurt, `eu-central-1`).
  - **Name:** `pasuje-mi`.
  - **Password:** a strong DB password, stored in a password manager.
  - Free orgs allow 2 active projects.
- [x] 👤 From Project Settings → API, copy the Project URL and the anon/publishable key. Never use `service_role`.
- [x] 👤 In Authentication → URL Configuration, set **Site URL** and **Redirect URLs** to `https://pasuje-mi.<subdomain>.workers.dev`. (Set after the first deploy, to `https://pasuje-mi.przepisy-app.workers.dev`.) `src/pages/api/auth/signup.ts` sets no `emailRedirectTo`, so the confirmation link goes to the Site URL.
- [x] 👤 Leave **Confirm email** ON.
- [x] 👤/🤖 Create `.dev.vars` (gitignored) with `SUPABASE_URL` and `SUPABASE_KEY`. Do not create `.env`, because wrangler ignores it once `.dev.vars` exists.
- [x] 🤖 Run `npm run dev`. Home must load, and `/auth/signin` must render without the "Supabase is not configured" error. (2026-10-11: `/` 200, `/auth/signin` 200 with no config error, `/dashboard` 302 to `/auth/signin`. The Supabase `/auth/v1/settings` endpoint returned 200 with a `sb_publishable_` key; signups are enabled, and `mailer_autoconfirm` is false, so Confirm email is ON.)

**Edge cases:**

- **Email rate limit.** The built-in Supabase email sender is rate-limited. If the confirmation email doesn't arrive, confirm the user manually in Authentication → Users.
- **No code-exchange route.** The confirmation link lands on `/?code=…` and the app has no route that exchanges the code. The email is still confirmed, because Supabase verifies it before redirecting, so the user then signs in normally. A callback route is a later change.
- **Project pausing.** Free projects pause after inactivity. If the first visit after a quiet period fails, restore the project in the Supabase dashboard.

## Phase 3: First production deploy (manual)

- [x] ✋ Run `npx wrangler deploy`. It creates the `pasuje-mi` Worker and the `SESSION` KV namespace. With no secrets yet, `locals.user` is `null`.
  - The first attempt by the agent failed and created nothing. The run was non-interactive, so wrangler tried to auto-register the subdomain `10x-astro-starter` (the `package.json` name), which was taken. **Lesson:** run the first deploy on an account with no subdomain in an interactive terminal, or register the subdomain first.
  - The user then deployed from PowerShell (wrangler 4.149.0, commit a488adf). This created version `12f6f34f-0162-4f59-b870-e45a882b5bf9` and KV namespace `pasuje-mi-session` (`c56765b72c7d44d1856289a39aa5ef04`).
- [x] ✋ Run `npx wrangler versions secret put SUPABASE_URL` and `npx wrangler versions secret put SUPABASE_KEY`, then `npx wrangler versions deploy` to promote that version to 100% of traffic. (Values were piped from `.dev.vars` through stdin. This created versions `afc12a9e-142c-4698-a15c-c689fef1d9bd` (URL) and `b85cc2f0-db8e-4ba1-8a8d-6cc18e7becbc` (URL + KEY). `b85cc2f0` was deployed at 100% with the message "Add Supabase secrets".)
- [x] 🤖 `npx wrangler secret list` shows both names.
- [x] 🤖 Run `npx wrangler deployments list` and record the version ID (the rollback target). Live: `b85cc2f0-db8e-4ba1-8a8d-6cc18e7becbc`. Rollback target: `12f6f34f-0162-4f59-b870-e45a882b5bf9` (no secrets, so it isn't a useful target).
- Note: the Worker's `previews_enabled` is `true` (account default). Turn it off along with non-production branch builds in Phase 5.

**If the deploy fails:**

- **Authentication error:** re-run `npx wrangler login`.
- **No `workers.dev` subdomain:** register one in the dashboard.
- **Bundle or compatibility error:** read the full wrangler output before changing any config.

## Phase 4: Production verification

- [x] 🤖 Run the anonymous checks with `curl` (2026-10-11, rerun at 16:03 UTC: `/` 200, `/auth/signin` 200 with no "not configured" message, `/dashboard` 302 → `/auth/signin`):
  - `/` returns 200.
  - `/dashboard` returns 302 to `/auth/signin`.
  - `/auth/signin` returns 200.
- [x] 🤖 Keep `npx wrangler tail pasuje-mi --format pretty` running during the manual test. (`--format json` was used instead, because only JSON includes `cpuTime`/`wallTime`.)
- [x] 👤 Manual flow in the browser: sign up → confirm email → sign in → `/dashboard` → sign out. Captured by tail between 15:38 and 15:48 UTC:
  - Signup: `POST /api/auth/signup` 302 → `/auth/confirm-email` 200 (15:42).
  - Signin: `POST /api/auth/signin` 302 → `/` 200, three times (15:42, 15:43, 15:46).
  - Dashboard: `GET /dashboard` **200** as a signed-in user (15:48). The session works.
  - **Not captured:** no request to `/?code=…`, so the confirmation link was either not clicked or the user was confirmed in the Supabase dashboard; signin succeeding means the e-mail is confirmed. Sign-out was verified on the second pass (16:04–16:05 UTC): `POST /api/auth/signout` 302, then `/dashboard` 302 → `/auth/signin`. After sign-in, the session works again. CPU over all 34 requests: median 4 ms, p95 16 ms, max 21 ms, 7 at or above 10 ms.
- [x] 🤖 Look for exceptions in tail and Workers Logs, and record the per-request CPU time. If it comes close to 10 ms, or any request returns error 1102, flag a move to Workers Paid ($5/mo).
  - Tail captured 24 requests. All had `outcome: ok`, with **0 exceptions, 0 5xx responses, no error 1102, and no warn/error logs**.
  - CPU time: **median 6 ms, p95 16 ms, max 21 ms** (the first `GET /auth/signup`, a cold start). 6 of 24 requests were at or above 10 ms.
  - Anonymous `GET /` (warm) took 2–4 ms. Signed-in pages took 4–16 ms. `POST /api/auth/signin` took 8–9 ms of CPU, with 280–350 ms wall time (the Supabase round-trip). `POST /api/auth/signup` took 11 ms of CPU and 1.5 s wall time.
  - ⚠️ **Flag: move to Workers Paid.** The p95 is above the Free 10 ms CPU limit. Nothing failed at this traffic level, but auth pages and cold starts run over the limit, so 1102 errors are likely under real use.

**Rollback:** `npx wrangler rollback <version-id>` ✋. The first deploy has no earlier version, so fix forward or remove the secrets instead.

## Phase 5: Auto-deploy from master with Workers Builds

- [x] 👤 In the dashboard, go to Workers & Pages → `pasuje-mi` → Settings → Builds → Connect (GitHub). Authorize only `aleksandraPecherz/PasujeMi`. (The user reported this done on 2026-10-11. The agent could not verify the app's repo scope: `gh api user/installations` returns 403 for an OAuth token.)
- [ ] 👤 Set the build configuration:

  | Setting           | Value                 |
  | ----------------- | --------------------- |
  | Production branch | `master`              |
  | Build command     | `npm run build`       |
  | Deploy command    | `npx wrangler deploy` |
  | Root directory    | `/`                   |
  | Build variables   | none                  |

- [ ] 👤 Turn non-production branch builds OFF.
  - **2026-10-11 check:** `https://b85cc2f0-pasuje-mi.przepisy-app.workers.dev` and `https://12f6f34f-pasuje-mi.przepisy-app.workers.dev` both return 200. Preview URLs are still on, and the old secret-less version is public.
  - Proposed durable fix: set `"preview_urls": false` in `wrangler.jsonc`, because `wrangler deploy` syncs that setting on every Workers Builds deploy.
  - The branch-builds setting itself is not visible via wrangler or gh.
  - Separately, the user's first deploy (15:25 UTC) reformatted `wrangler.jsonc` with tabs and no final newline, leaving the settings unchanged. The user reverted it.
  - Fix: `"preview_urls": false` was added to `wrangler.jsonc` (commit `Disable Worker preview URLs`) and confirmed in the built `dist/server/wrangler.json`. It takes effect on the first Workers Builds deploy; until then, both preview URLs stay public. Preview URLs are public, invisible to logs, and missing from the Supabase redirect list.
- [x] 🤖 Check that the Worker name in the dashboard equals `name` in `wrangler.jsonc` (`pasuje-mi`). The check run is named `Workers Builds: pasuje-mi`.
- [x] ✋ Push `master` (user approved; `4fbafe9..8be0c5d` at 16:12 UTC). This includes 516ed96, aa8c1a3 and 1ac376c, and triggers the first automatic build.
- [ ] 🤖 Check the result. **❌ Failed.**
  - The `Workers Builds: pasuje-mi` check run on 8be0c5d ended in `failure` at 16:13:40Z. The build itself ran for about 1.5 minutes from 16:12:16Z. Workers Builds posts a separate `in_progress` check run at the start and a final one whose start and end times are both the completion time, so an identical start/end does not mean an instant failure.
  - Build ID: `442b0db0-5212-4baa-8901-da0f4c0fe3c8`. The log is only in the dashboard: https://dash.cloudflare.com/b3303b56aea7018d5974a9989a2909e0/workers/services/view/pasuje-mi/production/builds/442b0db0-5212-4baa-8901-da0f4c0fe3c8
  - GitHub Actions on the same commit: `ci` success, `smoke` success.
  - `wrangler deployments list` still shows `b85cc2f0` at 100%. Both secrets are present, and the curl checks pass.
  - The preview URLs are still public, because `preview_urls: false` only takes effect on the next successful deploy.
  - **Cause (found by the user in the build log):** the build command in Workers Builds was empty (`None`), even though the setting is listed in the table above. The user set it to `npm run build` in Settings → Build and clicked **Retry build** (2026-10-11, about 16:19 UTC). The retry did not start a new build: no new deployment and no new check run appeared. The setting is now saved, and the next push (the commit recording this cause) triggers a fresh build.
  - **Lesson:** after connecting Builds, reopen Settings → Build and confirm the build and deploy commands were saved. The connect flow can leave the build command empty.
  - **Second build, after the build-command fix:** push `8be0c5d..0604ab2` at 16:23 UTC. Build `94705c21-2d58-4e51-be4d-17ffb31dde98` ran 16:23:18Z → 16:24:14Z (about 1 minute) and **failed** again. `ci` and `smoke` passed. Production is unchanged: `b85cc2f0` is at 100%, both secrets are present, the curl checks pass, and both preview URLs still return 200. Build log: https://dash.cloudflare.com/b3303b56aea7018d5974a9989a2909e0/workers/services/view/pasuje-mi/production/builds/94705c21-2d58-4e51-be4d-17ffb31dde98
    - **Cause:** the build step still did not run. After `npm clean-install` (677 packages, 28 s), the log goes straight to `Executing user deploy command: npx wrangler deploy`, with no build-command line. Without `dist/`, wrangler used `wrangler.jsonc` and failed: `✘ [ERROR] The entry-point file at "@astrojs/cloudflare/entrypoints/server" was not found.` The build command saved at about 16:19 UTC was not applied to this build, which started at 16:23:16.
    - **Fix (user, 2026-10-11):** the build command field is left empty, and the deploy command is now `npm run build && npx wrangler deploy`. It persisted after a page reload. The configuration table above is superseded for these two fields.
    - **Side finding (not blocking):** Builds uses Node 22.14.0 from `.nvmrc`. `npm ci` warns `EBADENGINE` for `astro-eslint-parser@3.1.0` and `eslint-plugin-astro@3.1.0` (need `^22.22.3`) and for `undici@8.10.2` (needs `>=22.19.0`). The local build passes on 22.14.0. Consider bumping `.nvmrc` to the current 22.x in a separate change.
  - Original check list:
  - The build succeeds.
  - `npx wrangler deployments list` shows a version deployed by Workers Builds.
  - The curl checks pass.
  - Both secrets are still present.
- [x] 🤖 Confirm `.github/workflows/ci.yml` is unchanged and still has no deploy step. It was last changed in 0cd90ba, has jobs `ci` and `smoke`, and has no wrangler/deploy/`CLOUDFLARE` references.

**Edge case:** Workers Builds does not wait for GitHub Actions, so a commit that fails CI is still deployed. That's accepted for the MVP; run `npm run lint` and `npx astro check` before pushing.

## Phase 6: Close out

- [x] 🤖 Save this plan to `context/deployment/deploy-plan.md`.
- [ ] 🤖 After each phase, update the checkboxes and record results: the URL, version IDs, Supabase region and CPU time.
- [ ] 🤖 Commit `Record first deployment plan`; push ✋.

## Deployment record

| Field                                      | Value                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Production URL                             | https://pasuje-mi.przepisy-app.workers.dev                                                                                      |
| Cloudflare account / workers.dev subdomain | `b3303b56aea7018d5974a9989a2909e0` / `przepisy-app`                                                                             |
| Supabase project ref / region              | `zocbniggvvctublymudo` / `eu-central-1` (Frankfurt)                                                                             |
| First version ID                           | `12f6f34f-0162-4f59-b870-e45a882b5bf9` (no secrets). With secrets, live: `b85cc2f0-db8e-4ba1-8a8d-6cc18e7becbc`                 |
| Workers Builds connected                   | Yes (check runs appear on GitHub). Builds `442b0db0` (8be0c5d) and `94705c21` (0604ab2) **failed**: the build command never ran |
| Measured CPU time per request              | median 4 ms / p95 16 ms / max 21 ms (n=34, 2026-10-11). 7 of 34 at or above 10 ms → Workers Paid flagged                        |

## Out of scope

- `tech-stack.md` (stale Pages target) and the AGENTS.md wording "`.env` and `.dev.vars`".
- The `supabase/config.toml` `project_id`, which is local-only.
- Custom domain, Cloudflare Access on previews, the Paid plan, and CI/CD in GitHub Actions.
- Fixing the CRLF working copy.

## Done when

1. On the `workers.dev` URL, `/` returns 200 and `/dashboard` returns 302 to `/auth/signin`.
2. The manual signup → confirm → signin → dashboard → signout flow works.
3. `wrangler secret list` shows `SUPABASE_URL` and `SUPABASE_KEY`.
4. A push to `master` produces a deployment through Workers Builds.
5. CPU time per request is recorded and under 10 ms, or the move to Workers Paid is flagged.
6. This file is committed with the deployment record filled in.
