<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: E-mail zostaje po błędzie logowania

- **Plan**: context/changes/login-keep-email/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-17
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Findings

### F1 — A file in the e-mail field gives a 500 instead of the error redirect

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:7, src/pages/api/auth/signup.ts:7
- **Detail**: `form.get("email") as string | null` hides that the value can be a `File`. A multipart POST with a file in `email` reaches `cleanEmail` (`src/lib/auth-errors.ts:25`), where `value?.trim()` throws a TypeError, so the user gets a 500. Before this change the value went straight to Supabase; the new helper is the first place that calls a string method on it. Only a hand-crafted request can trigger this, because the real form always sends text.
- **Fix**: Narrow the value in both endpoints: `const raw = form.get("email"); const email = typeof raw === "string" ? raw : null;`.
- **Decision**: FIXED — narrowed with `typeof rawEmail === "string"` in both endpoints

### F2 — Manual check 2.7 and gate 1.4 ticked without a local run

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/login-keep-email/plan.md (Progress 1.4, 2.7)
- **Detail**: 2.7 (sign-up error keeps the e-mail) is ticked, but `change.md` notes it could not be triggered by hand: Supabase answers an existing e-mail with success. The evidence is the kitchen sink state and the shared `authErrorRedirect` path. 1.4 (`npm run smoke`) ran only in CI on PR #26. This review could not run it either, since there was no running server or local Supabase. Both gaps are documented honestly, so this is not a false tick, but the sign-up error path has never been seen end to end.
- **Fix**: Accept as documented. Optionally check sign-up by hand with another error code, e.g. a password too weak for Supabase's policy.
- **Decision**: ACCEPTED — gaps are documented in change.md (Supabase hides existing accounts; smoke passed in CI on PR #26)
