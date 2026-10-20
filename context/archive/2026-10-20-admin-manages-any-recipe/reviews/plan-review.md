<!-- PLAN-REVIEW-REPORT -->

# Plan Review: S-07 Admin zarządza dowolnym przepisem

- **Plan**: context/changes/admin-manages-any-recipe/plan.md
- **Mode**: Deep
- **Date**: 2026-10-20
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

8/8 paths ✓, 6/6 symbols ✓ (fakeClient, updateRecipe, config.toml:13, ci.yml:51/94/184/259, contract :30), brief↔plan ✓, Progress↔Phase ✓ (3/7/6 items)

## Findings

### F1 — Two CI cases have loose assertions

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — "Check admin permissions", Contract
- **Detail**: "B zmienia lub usuwa wiersz M → odmowa albo 0 wierszy" and "rpc/is_admin → nie 200" accept more than one outcome. With no update or delete grant, PostgREST always answers 403 + 42501. The "not 200" check would also pass on a 500. This goes against the lesson "Assert status and body type before content in HTTP checks".
- **Fix**: B update/delete on M's row → 403 + expect_denied; rpc → 404 + `.code == "PGRST202"`.
- **Decision**: FIXED

### F2 — The trap doesn't remove M's row from admins

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — trap
- **Detail**: The trap deletes the two test recipes, but M's admins row stays. Harmless with a database reset per run, but it breaks the brief's rule that only rows inserted in the test are used and then cleaned up.
- **Fix**: In the same trap, also delete `admins?user_id=eq.$id_m` with the service key.
- **Decision**: FIXED
