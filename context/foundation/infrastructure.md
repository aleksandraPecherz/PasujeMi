---
project: pasuje-mi
researched_at: 2026-10-11
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7 (SSR) + React 19
  runtime: Cloudflare Workers (workerd) via @astrojs/cloudflare 14
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare Workers is the only candidate that passed all five agent-friendly criteria. Rollback is a single command (`wrangler rollback`), and the CLI, docs and MCP coverage are all strong. On cost, the developer named cost as the top priority and Workers starts at $0, with a $5/month fallback if the Free plan's 10 ms CPU limit proves too tight. On fit, the app needs only request/response, serves a single region, and keeps Supabase as an external data layer, so nothing in the stack counts against Workers. The repo is already configured for Workers, but that was used only as a tie-breaker, not a scoring input. `tech-stack.md` names Cloudflare Pages, but `@astrojs/cloudflare` v14 no longer supports Pages, so Workers is the only Cloudflare target.

Interview answers that drove the weighting:

- Persistent connections: **No**, so no hard filter applied.
- Priority: **minimize cost**, which penalized Fly.io, Railway and Render.
- Prior familiarity: **none**, so no tie-break.
- Reach: **single region (Poland)**, so edge gave no bonus, and Netlify was penalized because its Free plan runs functions in US-East.
- Co-location: **external providers are fine**, so the integrated databases gave no bonus.

## Platform Comparison

Scoring: ✓ Pass (1) / ½ Partial (0.5) / ✗ Fail (0). Research done 2026-10-11 against official docs and pricing pages.

| Platform               | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration    | Total   | Cost at <100 users, 10k–100k req/mo               | Free-plan usage restriction                                                                                                                     |
| ---------------------- | --------- | ------------------ | ------------------- | ----------------- | -------------------- | ------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloudflare Workers** | ✓         | ✓                  | ✓                   | ✓                 | ✓ (status unlabeled) | **5**   | $0 Free; $5/mo Paid if the 10 ms CPU limit is hit | None on commercial use. Free Services can be ended at Cloudflare's discretion (ToS §2.6), and you may not process card data on Free (§2.2.1(h)) |
| **Vercel**             | ✓         | ✓                  | ✓                   | ✓                 | ½ (beta, maybe GA)   | **4.5** | $0 Hobby                                          | **Hobby is non-commercial personal use only.** Pro costs $20/mo                                                                                 |
| **Netlify**            | ½         | ✓                  | ✓                   | ½                 | ✓                    | **4**   | $0 Free (300 credits hard cap)                    | Not checked                                                                                                                                     |
| Fly.io                 | ✓         | ½                  | ✓                   | ½                 | ½ (experimental)     | 3.5     | ~$0.50–3/mo; no free tier, card required          | No free plan                                                                                                                                    |
| Railway                | ½         | ✓                  | ✓                   | ½                 | ½ (public testing)   | 3.5     | $5/mo Hobby (the Free plan has no custom domains) | Not checked                                                                                                                                     |
| Render                 | ½         | ✓                  | ✓                   | ½                 | ½ (status unlabeled) | 3.5     | $0 with ~1 min cold start, or $7/mo               | Not checked                                                                                                                                     |

**Cloudflare Workers.**

- **CLI and deploys:** `wrangler deploy`, `wrangler rollback` (last 100 versions), `wrangler tail`, `wrangler versions upload/deploy` and `wrangler secret put` cover the full loop.
- **Docs:** they publish `llms.txt`, serve `index.md` pages, and keep their source on GitHub (cloudflare/cloudflare-docs).
- **MCP:** managed remote servers exist (`mcp.cloudflare.com/mcp`, docs, observability), but no status label is published.
- **Free plan:** 100k requests/day and 10 ms CPU per invocation. Static assets are free.
- **Paid plan:** $5/mo, with 10M requests and 30M CPU-ms included.
- **Persistence:** stateless isolates; WebSockets only via Durable Objects. Not needed here.
- **Adapter:** `@astrojs/cloudflare` v14 targets Workers only.

**Vercel.**

- **CLI and deploys:** strong. `vercel deploy --prod`, `vercel rollback`, `vercel promote` and `vercel logs --follow`.
- **Docs:** `llms.txt` and `.md` pages. No official docs repo on GitHub was confirmed.
- **MCP:** `mcp.vercel.com` was announced as Public Beta and the current docs drop the label, so it's scored Partial.
- **Cost:** Hobby is $0 and the expected usage fits comfortably.
- **Gaps against Cloudflare:**
  - Hobby is non-commercial only.
  - Functions default to `iad1`, so `regions: ["fra1"]` must be set.
  - Runtime logs are kept for 1 hour on Hobby.
  - Functions that go uninvoked for 2 weeks are archived, adding a cold start of 1 s or more.
  - Moving means swapping the adapter to `@astrojs/vercel` 11 and dropping workerd and `.dev.vars`.

**Netlify.**

- **Docs and MCP:** good. `llms.txt`, `.md` pages, and official remote and local MCP servers.
- **Rollback:** no CLI command, only the UI or the API. Scored Partial on CLI and on deploy API.
- **Free plan credits:** a 300-credit hard cap that pauses every project on the account when exhausted, and each production deploy costs 15 credits (about 10–18 prod deploys a month).
- **Region:** on Free, functions run in US-East (Ohio). Picking `fra` needs Pro, so every SSR request to an EU Supabase crosses the Atlantic.

**Fly.io.**

- **CLI and docs:** an excellent CLI (`flyctl`), with docs as `llms.txt` and source on GitHub.
- **Ops burden:** you run a container (Dockerfile plus `@astrojs/node`) rather than a bundle.
- **Rollback:** two steps (`fly releases --image`, then `fly deploy --image`), and it does not revert secrets.
- **MCP:** experimental.
- **Free tier:** none (a 2 h / 7-day trial, then a credit card).
- **Region:** `waw` is deprecated; `fra` is the closest.

**Railway.**

- **CLI:** good (`railway up`, `railway logs`), but rollback is dashboard-only.
- **Config churn:** Config-as-Code is being deprecated, with a 2026-12-01 cutoff.
- **MCP:** remote MCP is in "public testing" and the local one is experimental.
- **Plans:** the Free plan has no custom domains, so Hobby at $5/mo is the realistic minimum.
- **Region:** the only EU region is Amsterdam.

**Render.**

- **CLI:** `render deploys create` and `render logs --tail`. Rollback is by API or dashboard only.
- **Free plan:** the service spins down after 15 minutes idle and takes about 1 minute to start again, which conflicts with the "< 1 s" NFR. The paid floor is $7/mo.
- **Previews:** full-stack preview environments need Pro.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

This is the only 5/5 platform. Rollback, deploy, previews, secrets and logs each have a single CLI command, and the docs are published for agents. It costs $0 to start, with a $5 ceiling that does not depend on traffic at this scale. No adapter migration is needed, and the adapter's current major version supports only Workers as its Cloudflare target.

#### 2. Vercel

Vercel ties on cost ($0 Hobby) and is close on agent operability. It falls behind on four points:

- MCP is only Partial.
- The non-commercial clause is a concern if the app ever charges money.
- Logs are kept for 1 hour.
- Switching requires an adapter change and pinning the region to `fra1`.

It is the fallback if Cloudflare's CPU limit or workerd's compatibility with libraries becomes blocking.

#### 3. Netlify

Netlify has good docs and MCP. On Free, though, it runs functions in Ohio, which risks the "< 1 s" NFR against an EU Supabase. Every production deploy also burns limited credits, and there is no CLI rollback.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **The 10 ms CPU cap on Free.** React SSR, Supabase cookie parsing, and fuzzy ingredient matching (typos, Polish inflection, synonyms) done in JS across hundreds of recipes can exceed 10 ms. The result is error 1102, not a slower response.
2. **workerd is not Node.** Polish stemming and fuzzy-matching libraries are often CommonJS or rely on Node built-ins. Because the dev server already runs on workerd, they will fail in `npm run dev`, which limits library choice for the matching feature.
3. **Latency to Supabase.** The Worker runs at the nearest Cloudflare PoP, while Supabase sits in its project region. Smart Placement (beta) needs traffic from several locations and will not engage with fewer than 100 Polish users. If the Supabase project is in a US region, every request makes several transatlantic round-trips.
4. **`wrangler secret put` deploys a new version immediately.** An agent that only rotates a secret can push undeployed code to production at the same time.
5. **Weak observability on Free.** Logs are kept for 3 days, and observability pricing changes on 2026-12-01, five days before the 2026-12-06 hard deadline.

### Pre-Mortem — How This Could Fail

The team shipped the starter's configuration unchanged. They assumed that because `npm run dev` ran on workerd, production would behave identically. The first deploy went live as `10x-astro-starter`. The ingredient-matching logic was written in JavaScript and recomputed inflections, typos and synonyms for every recipe on every request. With 60 seed recipes it stayed under 10 ms of CPU; at 300 it started exceeding the Free limit. Users saw intermittent 1102 errors that could not be reproduced locally, because local dev has no CPU cap. The 3-day log retention showed no pattern. The Supabase project had been created in the default US region, so each list view made several ocean crossings, and the "< 1 s" NFR quietly failed while everyone blamed the network. Two days before the deadline, the observability pricing change forced a rushed upgrade. Then a secret rotation deployed a half-finished feature to production. `wrangler rollback` reverted the code but not the Supabase migration the feature depended on, which left production broken during the final review week.

### Unknown Unknowns

- **`@astrojs/cloudflare` v14 does not support Cloudflare Pages.** `tech-stack.md` (`deployment_target: cloudflare-pages`) is stale. Deploys must use `wrangler deploy`; `wrangler pages deploy` is wrong for this repo.
- **When `.dev.vars` exists, wrangler ignores `.env`.** AGENTS.md says local secrets go in "`.env` and `.dev.vars`", which invites two diverging copies. Neither file exists yet; only `.env.example` does.
- **Preview version URLs work only on `workers.dev`.** `wrangler tail` and Workers Logs do not capture them. Their domains must also be added to the Supabase Auth redirect allowlist, or sign-in flows break on previews.
- **`Astro.locals.runtime` was removed in the current adapter.** Bindings come from `import { env } from "cloudflare:workers"`, so older tutorials and agent memory will suggest dead APIs. The repo currently reads secrets only through `astro:env/server`, which is correct.
- **Free Supabase projects pause after a period of inactivity.** This is a Supabase behaviour, not Cloudflare's, and was not verified in this research. A rarely used MVP may fail on its first visit after a quiet week.

## Operational Story

- **Preview deploys**:
  - Run `npx wrangler versions upload --preview-alias <branch>`, which gives a `https://<branch>-pasuje-mi.<subdomain>.workers.dev` URL without touching production.
  - Previews are public by default and are not captured by `wrangler tail` or Workers Logs, so use test data only and debug them locally.
  - Add each preview domain to the Supabase Auth redirect URLs.
  - Per-branch previews could later be automated with Workers Builds; CI/CD is out of scope here.
- **Secrets**:
  - In production, `SUPABASE_URL` and `SUPABASE_KEY` are Workers secrets, read only via `astro:env/server`.
  - Set them with `npx wrangler versions secret put <NAME>` and then `npx wrangler versions deploy`, which stages the change. Avoid plain `wrangler secret put`, because it deploys immediately.
  - Locally they live in `.dev.vars` only (gitignored); `.env` is ignored by wrangler once `.dev.vars` exists.
  - Only the account owner can read them, via the dashboard; the CLI can list names but not values.
  - Rotation: regenerate the key in Supabase, stage it with `versions secret put`, deploy, then run `npm run smoke`.
- **Rollback**:
  - `npx wrangler deployments list`, then `npx wrangler rollback <version-id>` (any of the last 100 versions). It takes effect in seconds.
  - It does **not** revert Supabase migrations or data. Migrations must be backward-compatible and applied before the code that needs them.
- **Approval**:
  - **A human approves:** production `wrangler deploy` and `versions deploy`, any secret change, `wrangler rollback`, Supabase migrations against the production project, Worker deletion, custom-domain or DNS changes, and plan upgrades.
  - **An agent may run unattended:** `npm run build`, `npm run lint`, `npx astro check`, `npx wrangler deploy --dry-run`, `npx wrangler versions upload` (previews), `wrangler deployments list`, `wrangler versions list` and `wrangler tail`.
- **Logs**:
  - `npx wrangler tail pasuje-mi --format pretty` gives a live stream; `--status error` shows failures only.
  - Workers Logs are enabled by `observability.enabled: true` in `wrangler.jsonc` and kept for 3 days on Free.
  - The Cloudflare observability MCP server gives structured queries.
  - Check per-request CPU time there after the first deploy.

## Risk Register

Decision legend:

- **Accept**: the risk is real, mitigated, and we proceed.
- **Known limitation**: a platform property we design around, not something we expect to remove.

| Risk                                                                                                  | Source                       | Likelihood | Impact | Decision         | Mitigation                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ---------------------------- | ---------- | ------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free plan's 10 ms CPU per request exceeded by SSR + auth + matching → error 1102                      | Devil's advocate             | M          | H      | Accept           | Implement ingredient matching in Postgres (SQL, e.g. `pg_trgm`), not per-request JS. After the first deploy, read CPU time in Workers Logs. Move to Workers Paid ($5/mo) on the first 1102 or if CPU time nears the limit.    |
| CommonJS or Node-only libraries (stemming, fuzzy match) fail on workerd                               | Devil's advocate             | M          | M      | Known limitation | Prefer ESM, runtime-agnostic libraries, and try each new dependency in `npm run dev` (workerd) before building on it. Push text normalization into Postgres where possible.                                                   |
| Worker ↔ Supabase latency breaks the "< 1 s" list NFR                                                 | Devil's advocate, Pre-mortem | M          | H      | Accept           | Confirm the Supabase project region is in the EU (Frankfurt) before go-live. Keep sequential Supabase round-trips per request to a minimum. Consider a Placement Hint only if measured latency demands it (status unlabeled). |
| `wrangler secret put` deploys a new version immediately                                               | Devil's advocate             | M          | M      | Known limitation | Use `wrangler versions secret put` + `wrangler versions deploy`. Secret changes require human approval.                                                                                                                       |
| 3-day log retention; observability pricing changes 2026-12-01, 5 days before the deadline             | Devil's advocate, Pre-mortem | H          | M      | Known limitation | Re-check Workers Logs pricing by mid-November 2026. Budget the $5 Paid plan (7-day retention). Keep `observability.enabled: true`.                                                                                            |
| `wrangler rollback` reverts code but not Supabase migrations or data                                  | Pre-mortem                   | M          | H      | Known limitation | Write additive, backward-compatible migrations, apply them before the dependent code, and test them against local Supabase first.                                                                                             |
| Worker deployed under the starter name `10x-astro-starter`                                            | Pre-mortem                   | H          | L      | Accept           | Rename `name` in `wrangler.jsonc` to `pasuje-mi` before the first deploy (renaming later creates a new Worker and URL).                                                                                                       |
| `tech-stack.md` says Cloudflare Pages; adapter v14 supports Workers only                              | Unknown unknowns             | H          | M      | Known limitation | Deploy only with `wrangler deploy`, never `wrangler pages deploy`. Correct `tech-stack.md` deliberately (re-run `/10x-tech-stack-selector`) rather than as a side effect.                                                     |
| `.env` silently ignored by wrangler when `.dev.vars` exists; AGENTS.md lists both                     | Unknown unknowns             | M          | M      | Known limitation | Keep local secrets in `.dev.vars` only, and update the AGENTS.md wording in a separate change.                                                                                                                                |
| Preview URLs are `workers.dev`-only, public, and not captured by logs                                 | Unknown unknowns             | M          | L      | Known limitation | Use test data only on previews, reproduce issues locally, and add preview domains to the Supabase Auth redirect URLs.                                                                                                         |
| Agents or tutorials suggest the removed `Astro.locals.runtime` API                                    | Unknown unknowns             | M          | L      | Known limitation | Read secrets via `astro:env/server` and bindings via `import { env } from "cloudflare:workers"`. Reject code using `locals.runtime` in review.                                                                                |
| Free Supabase project pauses after inactivity; first visit fails                                      | Unknown unknowns             | M          | M      | Accept           | Verify the current pause policy in the Supabase docs. If it applies, open the app at least weekly or add a scheduled keep-alive later (out of scope here).                                                                    |
| Smart Placement (beta) will not engage at <100 users                                                  | Research finding             | H          | L      | Known limitation | Do not enable it. Rely on the Supabase region choice instead.                                                                                                                                                                 |
| Cloudflare may end Free Services at its discretion (ToS §2.6); no card processing on Free (§2.2.1(h)) | Research finding             | L          | M      | Accept           | MVP has no payments. If payments are ever added, move to Workers Paid first.                                                                                                                                                  |

## Getting Started

Checked against the pinned versions: `astro` ^7.3.2, `@astrojs/cloudflare` ^14.3.1 and `wrangler` ^4.131.1. `npm run dev` already runs on workerd, so no separate `wrangler dev` step is needed.

1. In `wrangler.jsonc`, rename `"name": "10x-astro-starter"` to `"name": "pasuje-mi"`. Then run `npx wrangler login` (it opens a browser once; for CI, use a `CLOUDFLARE_API_TOKEN` instead).
2. Confirm the Supabase project's region is in the EU. Put `SUPABASE_URL` and `SUPABASE_KEY` in `.dev.vars` (not `.env`), then check that `npm run dev` signs in locally.
3. Run `npm run build`, then `npx wrangler deploy --dry-run` to see which config and bundle wrangler would upload. Then run `npx wrangler deploy` (needs human approval).
4. Set the production secrets with `npx wrangler versions secret put SUPABASE_URL` and `npx wrangler versions secret put SUPABASE_KEY`, then run `npx wrangler versions deploy`. Add `https://pasuje-mi.<subdomain>.workers.dev` to the Supabase Auth Site URL and redirect URLs.
5. Verify with `BASE_URL=https://pasuje-mi.<subdomain>.workers.dev npm run smoke` while `npx wrangler tail pasuje-mi` runs in a second terminal, and check CPU time per request in Workers Logs.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
