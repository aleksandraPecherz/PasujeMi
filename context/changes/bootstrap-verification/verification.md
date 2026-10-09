---
bootstrapped_at: 2026-10-09T13:10:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: pasuje-mi
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: pasuje-mi
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

PasujeMi is a web app built solo, after hours, with a roughly three-week MVP and a hard deadline, by a frontend developer working in TypeScript. The standard path was taken: 10x Astro Starter is the recommended default for a web app in the JS family and clears all four agent-friendly gates (typed, convention-based, popular in training data, well documented). Its bundled auth, PostgreSQL database and storage cover the MVP's accounts and the author/admin edit rights without an extra integration, and the React-based UI fits the builder's existing experience. Auth is the only feature flag set; photo-based recipe autofill (the AI feature) is out of MVP scope per the PRD non-goals, and there are no payments, realtime or background jobs. Access rules on the data layer must be configured early, because pantry staples and exclusions are private and shared recipes may be changed only by their author or an admin. Deployment uses the starter's default Cloudflare Pages target, with CI on GitHub Actions and auto-deploy on merge to main. Bootstrapper confidence is first-class, so expect mostly smooth scaffolding with occasional manual steps.

## Pre-scaffold verification

| Signal      | Value                                                        | Severity | Notes                                                                 |
| ----------- | ------------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| npm package | not run                                                      | —        | cmd_template starts with `git clone`; no `create-*` CLI to check      |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-09-12    | fresh    | from card.docs_url; `gh` not installed, read via public GitHub API    |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 21 top-level entries (.env.example, .github/, .gitignore, .husky/, .nvmrc, .prettierrc.json, .vscode/, AGENTS.md, astro.config.mjs, components.json, eslint.config.js, node_modules/, package.json, package-lock.json, public/, README.md, scripts/, src/, supabase/, tsconfig.json, wrangler.jsonc) plus CLAUDE.md as a sibling
**Conflicts (.scaffold siblings)**: CLAUDE.md → CLAUDE.md.scaffold
**.gitignore handling**: moved silently (absent in cwd)
**.bootstrap-scaffold cleanup**: deleted (upstream `.git/` removed before move-up)

**Install warnings**: `npm install` reported EBADENGINE — astro-eslint-parser@3.1.0, eslint-plugin-astro@3.1.0 and undici@8.10.2 require node >=22.19.0; local node is v22.14.0, which matches the starter's own `.nvmrc` (22.14.0) — the starter's pin lags its dependencies' engine requirement. Install still completed (654 packages).

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 9 HIGH, 2 MODERATE, 0 LOW
**Direct vs transitive**: 0/1/0/0 direct of total 0/9/2/0

#### CRITICAL findings

None.

#### HIGH findings

- **@cloudflare/vite-plugin** `<=0.0.0-fff677e35 || 1.2.3 - 1.63.0 || >=2.0.0-beta.sha-238e489d5` — transitive — via miniflare, wrangler. Fix: yes (npm audit fix)
- **brace-expansion** `<=1.1.20 || 4.0.0 - 5.0.11` — transitive — brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service (https://github.com/advisories/GHSA-q2hr-2g5m-vwhr); brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service (https://github.com/advisories/GHSA-q2hr-2g5m-vwhr); brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion (https://github.com/advisories/GHSA-qhr7-859c-m2p7); brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion (https://github.com/advisories/GHSA-qhr7-859c-m2p7); brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion (https://github.com/advisories/GHSA-6j4f-fj2g-mc7p); brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion (https://github.com/advisories/GHSA-6j4f-fj2g-mc7p). Fix: yes (npm audit fix)
- **devalue** `<=5.9.2` — transitive — devalue: `stringify`/`uneval` serialize shared memory (https://github.com/advisories/GHSA-j22f-vq7h-c4qm); devalue: Residual sparse-array CPU amplification in uneval (https://github.com/advisories/GHSA-hx4r-w6wj-j8fg); devalue: Repeated primitive strings cause quadratic expansion in uneval (https://github.com/advisories/GHSA-mcm9-63f2-9j32); devalue: Sparse arrays emitted by uneval cause eager allocation when evaluated (https://github.com/advisories/GHSA-wf3x-273g-mvxv); devalue: stringifyAsync can cause an unhandled rejection despite a caught returned promise (https://github.com/advisories/GHSA-x5rw-q4pp-hg5g); devalue: Malformed null-prototype object keys bypass __proto__ rejection via property-key coercion (https://github.com/advisories/GHSA-4q55-j62x-fr9h). Fix: yes (npm audit fix)
- **http-cache-semantics** `<=4.2.0` — transitive — http-cache-semantics max-stale handling can disclose cross-user cached responses (https://github.com/advisories/GHSA-ch52-4w7c-c8xp). Fix: yes (npm audit fix)
- **miniflare** `<=0.0.0-fec45ed61 || 4.20250508.3 - 5.20261006.0-alpha` — transitive — via sharp, undici. Fix: yes (npm audit fix)
- **sharp** `<0.35.5` — transitive — sharp : Vulnerability in librsvg dependency CVE-2026-96889 (https://github.com/advisories/GHSA-wq5f-xc86-pv6w). Fix: yes (npm audit fix)
- **source-map-js** `1.0.0 - 1.2.1` — transitive — source-map-js allows event-loop denial of service through indexed source-map section offsets (https://github.com/advisories/GHSA-68fv-2mgg-jv7q). Fix: yes (npm audit fix)
- **undici** `7.0.0 - 7.29.0` — transitive — undici vulnerable to Denial of Service via unhandled error in WebSocket permessage-deflate decompression (https://github.com/advisories/GHSA-3wwx-pv8p-q78v); undici vulnerable to Denial of Service via orphaned RetryHandler response body (https://github.com/advisories/GHSA-pmjh-fq2x-6v4x); undici vulnerable to downstream response splitting via retry interceptor (https://github.com/advisories/GHSA-r53p-7pc4-xj5r); undici vulnerable to Denial of Service via unrequested WebSocket subprotocol (https://github.com/advisories/GHSA-rfgv-xxqx-mfg5); undici vulnerable to Denial of Service via unbounded decompression of compressed responses (https://github.com/advisories/GHSA-3xpg-4rpp-hhhm); undici vulnerable to cross-user cookie disclosure via Set-Cookie caching in shared caches (https://github.com/advisories/GHSA-2jfj-6hjv-fm6j); undici vulnerable to response truncation via oversized chunked responses in the dump interceptor (https://github.com/advisories/GHSA-2gqq-gqf2-x968); undici vulnerable to TLS certificate validation bypass via dropped connect options in BalancedPool (https://github.com/advisories/GHSA-w293-vg96-wgc3); undici vulnerable to caching and replay of unsafe HTTP method responses (https://github.com/advisories/GHSA-8436-99hf-9mmv); undici vulnerable to Denial of Service via WebSocketStream unclean close (https://github.com/advisories/GHSA-rx4f-c7p8-82vq). Fix: yes (npm audit fix)
- **wrangler** `<=0.0.0-7ae5dd357 || 4.16.0 - 4.148.0` — direct — via miniflare. Fix: yes (npm audit fix)

#### MODERATE findings

- **fast-uri** `3.0.0 - 3.1.7` — transitive — fast-uri vulnerable to inconsistent host case normalization via percent-encoded octets (https://github.com/advisories/GHSA-hrr3-gc8f-f4qj). Fix: yes (npm audit fix)
- **smol-toml** `<=1.8.0` — transitive — smol-toml: Quadratic-time parse() from parseKey rescanning to end of document on each key line (https://github.com/advisories/GHSA-r4xh-jqrq-34v2). Fix: yes (npm audit fix)

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
