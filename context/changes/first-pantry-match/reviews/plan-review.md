<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Pierwsze dopasowanie ze spiżarki (S-03)

- **Plan**: context/changes/first-pantry-match/plan.md
- **Mode**: Deep
- **Date**: 2026-10-13
- **Verdict**: REVISE → SOUND after triage
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

9/9 paths ✓, 5/5 symbols ✓ (max_rows=1000, parseIntParam, scriptsConfig, listRecipes, middleware 401), brief↔plan ✓, Progress↔Phase ✓

## Findings

### F1 — Stale-key fallback breaks at full-catalog scale

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3 step 2; Implementation Approach; Migration Notes
- **Detail**: After a version bump, or if code ships before the script, every row is stale. At 1000 recipes that costs ≈36 ms CPU (1102 on Free), and `in('id', …)` with ~1000 UUIDs is a ~37 KB URL. The claim "correctness never depends on the script" does not hold at target scale.
- **Fix**: Fetch stale rows with a server-side `.or("match_keys_version.is.null,match_keys_version.neq.<V>")` filter and range paging. v1 rollout: migration → match-keys → deploy. Reword the guarantee.
- **Decision**: FIXED

### F2 — Visible recipe shows the excluded main ingredient with no hint

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §2 (IngredientMatch), Phase 3 §2 (RecipeTile)
- **Detail**: With the main option excluded and a non-excluded substitute, the recipe stays visible, but the tile showed the allergen as a grey tag; `via` was set only on "mam".
- **Fix**: Add `mainExcluded`; `via` points to the first non-excluded substitute; the tile shows "→ użyj: …"; add a test case.
- **Decision**: FIXED

### F3 — Exclusion checks are vacuous or untestable on the seed data

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §5, criteria 2.5, 3.5
- **Detail**: No seeded option has the product "jogurt"; have=banan leaves everything at 0%; 3.5 needs a recipe the seed lacks; 2.5 credits `npm run smoke` with a separate CI step.
- **Fix**: Smoke `have=pomidor&have=chleb&exclude=jogurt` with name-based assertions; rewrite 3.5 against the seed; reword 2.5.
- **Decision**: FIXED

### F4 — `index.d.ts` won't type `polish-stemmer.js` imports

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §1
- **Detail**: There is no index.js; TS needs a sibling `polish-stemmer.d.ts`.
- **Fix**: Rename the declaration to `polish-stemmer.d.ts`.
- **Decision**: FIXED

### F5 — Phase 1 build criterion doesn't exercise the stemmer

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 criteria 1.4 / 1.6
- **Detail**: Nothing imports src/lib/matching in Phase 1, so the build does not bundle the vendor code.
- **Fix**: Run `npm run build` in 1.6 while the temporary import is present.
- **Decision**: FIXED
