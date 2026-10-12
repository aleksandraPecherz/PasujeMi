<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Minimalny kontrakt danych przepisu (F-01)

- **Plan**: context/changes/recipe-catalog-contract-review/plan.md (copy of context/archive/2026-10-12-recipe-catalog-contract/plan.md)
- **Scope**: Full plan — code in commits 02956a9..eebb650 (p1 43a774c, p2 2d54b3f, p3 d290873)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Success criteria evidence (2026-10-12)

- `npm run lint`: pass. `npx astro check`: 0 errors, 0 warnings. `npm run build`: pass.
- `git check-ignore -q data/recipes.xlsx`: pass. `git ls-files data`: empty.
- Migration greps: `enable row level security` = 1; `for (insert|update|delete|all)` = 0; grant on line 29, revoke on line 28.
- Seed: `insert into public.recipes` = 5.
- Production, anon key: `GET /rest/v1/recipes?select=id` → HTTP 401 `42501` (criterion 2.2).
- CI `ci` and `smoke`: success on 43a774c, 2d54b3f, d290873, eebb650, merge 9db5b2a and merge 2c4fbce. Workers Builds: success on both merges, **failure on d290873** (see F8).
- Not re-run here: 2.1 `supabase migration list` (needs `supabase login`/link). The manual items (1.7, 2.4, 2.5, 3.6) are author acts and cannot leave evidence in the diff.

## Findings

### F1 — CI row-count check accepts an error body

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:47
- **Detail**: The command is `curl -s` without `-f`, followed by `jq 'length'`. On a PostgREST error object, `length` counts its keys: there are 4 (code, details, hint, message), so the check fails only because 4 ≠ 5. A 5-key error object or a string body would pass or produce a misleading result. This step is the plan's proof that the seed loaded (criterion 3.5).
- **Fix**: Use `curl -sf …`, then `jq -e 'type == "array" and length == 5'`.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Assert status and body type before content in HTTP checks

### F2 — Huge offset returns 500 and the error is swallowed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/recipes/index.ts:13
- **Detail**: `/^\d+$/` accepts `offset=99999999999999999999`, and `Number()` turns it into 1e20, beyond Postgres bigint or serialized as `1e+21`. The client error then becomes `500 database_error` instead of `400 invalid_query`. In addition, `catch {}` (line 34) logs nothing, so a real database failure leaves no trace in the Workers logs.
- **Fix**: In `parseIntParam`, reject `!Number.isSafeInteger(n)` (or cap offset), and add `console.error` in the catch while keeping the generic response body.
- **Decision**: FIXED

### F3 — Foundation roadmap rewritten beyond the F-01 status mark

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md (commit 43a774c)
- **Detail**: Besides setting F-01 to in-progress, the commit changed the F-02 prerequisite from "recipe Excel/JSON file in repo" to "recipe Excel file (author's machine)". It did so in four places (the table, Prerequisites, the Stream D note and the Backlog Handoff) and reflowed the tables. No plan item calls for this, and AGENTS.md says `context/foundation/` must not be rewritten as a side effect. The new wording does agree with the plan's decision to keep the xlsx out of the repo, which is on master today.
- **Fix**: Accept it as a correct consequence of the plan decision, and record in this change's notes that the edit was intentional (the archived plan stays immutable).
- **Decision**: ACCEPTED — zmiana roadmapy była świadoma i zgodna z decyzją w planie (xlsx poza repo).

### F4 — Contract doc has two self-contradictory `;` rules

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: docs/reference/recipe-data-contract.md:89, :122
- **Detail**: Line 89 reads "rozdzielane `;` lub `;`" and line 122 reads "dzielić po samym `;`, nie po `;`". The bytes confirm that both code spans are the same single `;`, so the intended distinction, probably `" ;"` vs `";"`, has been lost. The plan (Excel formats section, `rodzaj` line) already contains the same defect, so it is inherited from the plan. F-02 will implement the parser from this document.
- **Fix**: Restore the intended variant (e.g. `` ` ;` `` with a space before) on both lines, after checking against the Excel.
- **Decision**: FIXED — Excel check: 620× " ;" and 190× ";" without a space (ASCII only). The cause was Markdown stripping the spaces inside the code span; both lines now describe the variants with an example.

### F5 — "numeric arrives as a string" is probably inaccurate

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/recipes.ts:15
- **Detail**: Both the comment in the service and docs/reference/recipe-data-contract.md:27 claim that PostgREST returns `numeric` as text. PostgREST builds its JSON with Postgres JSON functions, which output `numeric` as a JSON number. `toNumber` handles both, so behaviour is correct; only the documentation may mislead F-02/S-05. Not verified against a live response.
- **Fix**: Check one response from CI or dev, then correct the comment and the doc sentence.
- **Decision**: SKIPPED — toNumber obsługuje i liczbę, i string, więc działanie jest poprawne; nieścisły jest tylko komentarz, a zweryfikować go można dopiero na prawdziwych danych w F-02.

### F6 — Supabase CLI unpinned in CI

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/workflows/ci.yml:37
- **Detail**: The workflow uses `supabase/setup-cli@v1` with `version: latest`. Both the smoke job and the new RLS step depend on the `supabase status -o env` key names (`ANON_KEY`, `SERVICE_ROLE_KEY`) and the service names in `start -x`. Either can change in a CLI release and break CI for reasons unrelated to the code.
- **Fix**: Pin a specific CLI version.
- **Decision**: FIXED — pinned 2.120.0 (= `latest` used by the green CI runs on 2026-10-12).

### F7 — Smoke failure output hides the body

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs:95
- **Detail**: When a step fails, smoke prints only `expected 200`: it shows no body and does not say that the `check(body)` predicate failed. An unexpected body (e.g. `steps` undefined) throws inside `check` and aborts the whole run instead of producing a per-step FAIL. CI still fails, so only diagnosability suffers.
- **Fix**: Print `actual.body` on FAIL and catch exceptions from `check`.
- **Decision**: SKIPPED

### F8 — Workers Builds failed on the phase 3 commit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (check run on d290873, Cloudflare build dbb7b83c)
- **Detail**: The `Workers Builds: pasuje-mi` check failed on d290873 on the PR branch, while `ci` and `smoke` passed. The build on merge 2c4fbce succeeded, so production is fine. No phase 3 criterion covers it, and the plan records neither the failure nor its cause.
- **Fix**: Look at the build log in the Cloudflare dashboard; if it was transient, note that in this change's notes.
- **Decision**: SKIPPED

## Triage summary (2026-10-12)

| Decision       | Findings                                                       |
| -------------- | -------------------------------------------------------------- |
| Fixed          | F2, F4, F6                                                     |
| Rule (+ fixed) | F1 — Assert status and body type before content in HTTP checks |
| Accepted       | F3                                                             |
| Skipped        | F5, F7, F8                                                     |
