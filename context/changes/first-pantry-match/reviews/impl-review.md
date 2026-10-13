<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Pierwsze dopasowanie ze spiżarki (S-03)

- **Plan**: context/changes/first-pantry-match/plan.md
- **Scope**: Full plan (Phase 3 reviewed except post-deploy item 3.8, which is still open)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-13
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

## Automated checks (2026-10-13, local)

- `npm test`: 3 files, 66 tests passed
- `npm run lint`: clean
- `npx astro check`: 0 errors / 0 warnings / 0 hints
- `npm run build`: complete
- `npm run match-keys` (local Supabase): `updated 5`, then `updated 0`
- `npm run bench:match`: total median 8.68 ms and 8.26 ms (JSON.parse ≈ 5.8–6.1 ms, rankRecipes ≈ 2.4–2.6 ms)
- CI on PR (runs 38377768193, 38380224147): success, smoke included

## Findings

### F1 — Exclusion readings and tag limits let one request blow the CPU budget

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/matching/keys.ts:82-89, src/pages/api/recipes/match.ts:8-9
- **Detail**: `normalizeExclusion` builds the Cartesian product of ambiguous readings without deduplication. Twelve repetitions of "maka" (a valid 59-char tag) produce 4096 readings, verified locally at 9 ms for one tag. 30 such exclusions measured 183 ms plus 35 ms in `rankRecipes`. Separately, 90 tags × 60 chars allow about 1000 distinct ≥4-char keys, and each catalog key is compared against all of them via Damerau–Levenshtein: 25–35 ms measured. Any signed-in user can trigger Workers error 1102 (10 ms Free plan). The blast radius is only the caller's own request, but the ≤10 ms claim in the plan holds only for small inputs.
- **Fix A ⭐ Recommended**: Deduplicate readings after each token (unique key sets) and cap total distinct tag keys per request (e.g. 100 → 400 `invalid_query`), plus a unit test with a pathological tag.
  - Strength: Removes both the exponential blow-up and the linear worst case; the limit is enforced at the boundary that already validates tags.
  - Tradeoff: Another limit to keep in sync with the client (see F8).
  - Confidence: HIGH — the readings collapse to two distinct sets for repeated words; measured costs come from these two paths.
  - Blind spot: workerd timing differs from Node; not measured in Workers Logs.
- **Fix B**: Only cap readings per tag (e.g. 8) and tokens per tag (e.g. 5).
  - Strength: Smallest change, local to `keys.ts`.
  - Tradeoff: Leaves the 90-tag × many-keys linear case at ~25 ms.
  - Confidence: MED — fixes the exponential part only.
  - Blind spot: Real users rarely send 90 tags, so the residual risk may be acceptable.
- **Decision**: FIXED via Fix A — readings chosen per ambiguous key (2 instead of 4096 for "maka" ×12, test added); endpoint caps 100 tokens across all lists (400 `invalid_query`). Client is not yet aware of the token cap (see F8).

### F2 — Exclusion of a modifier word does not hide a separate-product phrase

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/matching/keys.ts:44-67 (phrase → single key `mlek kokosow` with `p: [mlek]`)
- **Detail**: Exclusion "kokosowe" (or "sojowe", "owsiane") does not hide "mleko kokosowe" (verified: recipe stays visible). Without the dictionary entry, `{kokosow} ⊆ {mlek, kokosow}` would have hidden it, so adding a dictionary entry weakened an exclusion. This follows plan point 6 literally (only the parent is added to the exclusion set), so it is a gap in the contract, not drift, and exclusions are the allergy hard filter (`roadmap.md:143`).
- **Fix**: Put the phrase's word keys into `p` as well, so they count for exclusions but not for ownership; bump `MATCH_KEYS_VERSION` and add a test for "kokosowe" → hides "mleko kokosowe".
  - Strength: Restores the "general covers specific" direction; ownership rule (point 5) is unaffected because `p` never counts for "have".
  - Tradeoff: Requires a key recompute (`npm run match-keys`) after deploy and an addendum to rule point 6.
  - Confidence: HIGH — `p` is already used exactly for exclusion-only keys.
  - Blind spot: Haven't checked whether any future phrase entry has a modifier word that is also a common exclusion and would now over-hide.
- **Decision**: FIXED — phrase word keys added to `p` (`keys.ts` wordsToOptionKeys), `MATCH_KEYS_VERSION` = 2 with new fingerprint, tests for "kokosowe"/"sojowe", plan addendum to rule point 6. Run `npm run match-keys` after deploy.

### F3 — An owned "maku"/"maki" counts as mąka

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/matching/keys.ts:74-76, src/lib/matching/dictionary.ts:48-52
- **Detail**: `normalizeTag` takes `wordKeyReadings(token).at(-1)`, the exception reading, for every token whose stripped stem is "mak" except "mak" itself. Verified: have = "maku" → "mąka pszenna" 100%, "mak" 0%. That breaks the "mąka ≠ mak" decision (rule point 3). Reading an owned tag as mąka was an unplanned decision; it is correct only for "maka" written without diacritics.
- **Fix**: In `normalizeTag`, choose the exception reading only when the token equals the exception word without diacritics ("maka"); otherwise keep the plain stem, and add tests for "maku" and "maki".
- **Decision**: SKIPPED — affects only owned products (ranking), not safety: exclusions go through `normalizeExclusion` and hide both mak and mąka. The proposed fix would trade one error for another ("maki" without diacritics is more often "mąki" than the plural of mak). Users type products in the nominative, which works. Revisit if it shows up in real data.

### F4 — Keys out of sync with ingredients crash or drop a recipe

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/matching/rank.ts:194-200, src/lib/services/recipes.ts (stale detection / `freshKeys.get`)
- **Detail**: Freshness is judged only by `match_keys_version`. If `ingredients` change while the version stays current (manual SQL, a future S-05 write that forgets `computeMatchKeys`, or the race in `scripts/match-keys.ts:44-48` between read and update), `resolveMatch` indexes `ingredients[index].substitutes[viaSubstitute]` and throws a TypeError → 500 for the whole page. A shorter key array makes the client's shape check reject the whole page. Also, a row with `match_keys = null` but a current version is excluded from the stale query and silently skipped.
- **Fix**: When the page rows (which already carry `ingredients`) are fetched, check that the key shape matches (ingredient count, substitute count per ingredient); on a mismatch recompute with `computeMatchKeys(row.ingredients)` for that row, and treat `match_keys is null` as stale in the `.or` filter.
  - Strength: Fails safe without fetching ingredients for the whole catalog, so the CPU budget is kept.
  - Tradeoff: The ranking of a mismatched row was computed from stale keys; only its page entry is corrected.
  - Confidence: MED — covers crashes and nulls; ranking correctness for edited rows still depends on writers calling `computeMatchKeys` (Migration Notes).
  - Blind spot: An ingredients hash next to the version would close the gap fully; not evaluated.
- **Decision**: FIXED — `keysFitIngredients` checks page rows; a mismatch is recomputed and re-ranked for that recipe (left out if now excluded). `match_keys.is.null` added to the stale filter in `matchRecipes` and `scripts/match-keys.ts`. Test added.

### F5 — Benchmark criterion 1.5 is ticked but the measurement is above 8 ms

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/first-pantry-match/plan.md:435
- **Detail**: Criterion 1.5 requires a median ≤ 8 ms locally. Two runs today gave 8.68 ms and 8.26 ms (plan-brief records ≈ 7.8 ms). The box is `[x]` with commit f5b7c22, and its "< 10 ms in Workers Logs" half can only be checked after deploy (3.8). Possible false tick; the 10 ms headroom is thin.
- **Fix**: Annotate 1.5 in Progress with the measured value and move the Workers Logs half to 3.8 (or untick until the deploy check).
- **Decision**: FIXED differently — 1.5 unticked in Progress with measured values (8.26–8.68 ms; after F1/F2 8.71–8.88 ms); decision deferred to 3.8 (Workers Logs), fallback Workers Paid on ≥ 10 ms or 1102.

### F6 — Version guard does not cover the stored-key path

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/matching/keys.test.ts:108-157
- **Detail**: The fingerprint hashes `normalizeTag` output and the dictionary, but not `computeMatchKeys` output. A change confined to the recipe-key path (`{k, p}` shaping, recipe readings of ambiguous words, e.g. the F2 fix) would not force a `MATCH_KEYS_VERSION` bump, leaving stored keys silently stale.
- **Fix**: Add `computeMatchKeys` over a fixed product list to the fingerprint input.
- **Decision**: FIXED (together with F2) — fingerprint snapshot now includes `computeMatchKeys` over `FINGERPRINT_WORDS`.

### F7 — Recipe text without diacritics escapes the "mąka" exclusion

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/matching/keys.ts:92-97 (`computeMatchKeys` uses `wordKey`, not readings)
- **Detail**: A recipe product "maka pszenna" gets key `mak`; exclusion "mąka" gives only `[mąk]`, so the recipe stays visible. Seed and Excel data use diacritics, but this is the unsafe direction for a hard filter.
- **Fix**: In `computeMatchKeys`, add the exception reading of an ambiguous word to `p` (exclusion-only), mirroring `normalizeExclusion`; bump the version.
- **Decision**: FIXED — `textToOptionKeys` adds the exception reading of an ambiguous word to `p`; tests "mąka" hides "maka pszenna" and not "mak"; "maka pszenna" added to fingerprint words. Kept at `MATCH_KEYS_VERSION` = 2 (v2 not yet in production), v2 fingerprint updated.

### F8 — Tag limits duplicated between client and endpoint; URL can exceed 16 KB

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/hooks/usePantryMatch.ts:6-7, src/pages/api/recipes/match.ts:8-9
- **Detail**: `MAX_TAG_LENGTH`/`MAX_TAGS` are defined twice and kept in sync only by a comment. At the limits (3 × 30 tags × 60 Polish chars percent-encoded) the query string reaches about 32 KB, over Cloudflare's 16 KB URL limit, giving a generic error instead of `invalid_query`.
- **Fix**: Move the limits to a shared `src/lib/matching/limits.ts` and lower them (or add a total-length check) so the maximum URL stays well under 16 KB.
- **Decision**: FIXED — shared `src/lib/matching/limits.ts` (MAX_TAG_LENGTH, MAX_TAGS, MAX_TOKENS = 100, MAX_URL_LENGTH = 8000, `countTokens`); `tokenize` moved to stemmer-free `tokenize.ts` (stemmer not in client bundle, verified). Hook blocks a tag above the word/URL limit with a readable `limitNotice`, and `requestPage` refuses such a request with the same message.

### F9 — Tag input and request lifecycle rough edges

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/pantry/TagInput.tsx:14,31; src/components/hooks/usePantryMatch.ts:86,135-144
- **Detail**: `onAdd` is typed `void` and the input is cleared even when `addTag` rejects a duplicate, so the text disappears with no feedback. There is no `AbortController` and "Zastosuj filtry" is not disabled while loading; stale responses are correctly dropped by `requestId`, but each superseded request still runs a full-catalog match on the Worker.
- **Fix**: Return `boolean` from `onAdd` and clear only on success; abort the previous fetch in `load` (ignore `AbortError`) and disable "Zastosuj" while loading.
- **Decision**: FIXED — `onAdd` returns boolean and TagInput clears only on success; `load` aborts the previous fetch (`inFlight` AbortController, initial request aborted on unmount); "Zastosuj filtry" disabled while loading.

### F10 — Fallback path is exercised only by mocked unit tests

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: .github/workflows/ci.yml:56-65, scripts/smoke.mjs:78-103
- **Detail**: Smoke runs after `match-keys`, so end to end only the stored-key path is tested; the per-request fallback (null/old version) is covered by the fake-client tests in `recipes.test.ts` and by manual check 2.6.
- **Fix**: Call the match endpoint once before the `match-keys` step in CI (same assertions), so both paths run on real Supabase.
- **Decision**: SKIPPED — fallback covered by unit tests in `recipes.test.ts` (including the race) and checked manually today on real local Supabase (2.6: 4 queries with empty `match_keys` and after recompute gave identical results). Reworking CI lengthens the job; test strategy and quality gates come in module 3.

## Triage summary (2026-10-13)

- Fixed: F1 (Fix A), F2, F4, F5 (differently: 1.5 unticked), F6 (with F2), F7, F8, F9
- Skipped: F3, F10
- Follow-up: run `npm run match-keys` after deploy (`MATCH_KEYS_VERSION` = 2); re-check the manual UI items (limit notice, input kept on rejected tag, disabled "Zastosuj filtry"); decide 1.5 together with 3.8 in Workers Logs.

## Notes

- Plan drift: none structural. All planned files exist; rule points 1–10, pagination, stale `.or` filter, endpoint limits and UI contract match. `normalizeExclusion` is an intended EXTRA (used by Phase 2 step 3). The shadcn `input`/`badge` imports were adjusted by hand (justified, no functional impact).
- Scope: "What We're NOT Doing" respected; `roadmap.md` changed only the S-03 status.
- Uncommitted: `plan.md` ticks for 2.6 and 3.3–3.7. Item 3.8 (Workers Logs CPU after deploy) is pending.
