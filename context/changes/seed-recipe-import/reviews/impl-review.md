<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: F-02 seed-recipe-import

- **Plan**: context/changes/seed-recipe-import/plan.md
- **Scope**: Full plan (completed phases only; Phase 3 still has 3.10 and 3.11 open)
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 4 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated checks run: `npm test` (228 passed), `npm run lint` (clean), `npx astro check` (0 errors), exceljs only in devDependencies. `npm run build` not re-run.

## Findings

### F1 — `--write` can run without preview or target confirmation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/import-recipes.ts:164-177
- **Detail**: `npm run import-recipes:write` prints the report and inserts in the same run. The plan requires the author to confirm the 12 recalculated kcal values and an empty skipped list before the write, but nothing enforces it. The script never prints the host of `SUPABASE_URL` or the resolved author, so prod env vars set by mistake write to prod silently.
- **Fix**: Print the Supabase host and the resolved author (email + id) in both modes.
  - Strength: Cheap, no behaviour change, makes a wrong target obvious.
  - Tradeoff: Does not force the preview step; stricter variants (`--confirm-recalculated <n>`) add friction for a one-off script.
  - Confidence: HIGH — only output changes.
  - Blind spot: Whether the author wants a hard gate for prod.
- **Decision**: FIXED — Fix now (host, author, mode printed in scripts/import-recipes.ts)

### F2 — Name dedupe misses Unicode-decomposed names and concurrent inserts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/import-recipes/parse.ts:75-77
- **Detail**: `normalizeRecipeName` does no Unicode normalization, so an NFD "ą" in Excel differs from NFC in the DB and the recipe is inserted twice. `recipes.name` has no unique constraint, so a recipe added via S-05 between preview and write also duplicates. The "idempotent" claim holds for sequential runs only.
- **Fix**: Add `.normalize("NFC")` in `normalizeRecipeName`; accept the preview-to-write race for a one-off script.
- **Decision**: FIXED — Fix now (.normalize("NFC") in normalizeRecipeName)

### F3 — Offset paging with an assumed 1000-row server cap

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/import-recipes.ts:81-105
- **Detail**: Both `findAuthorId` and the existing-names loop stop when a page is shorter than `PAGE_SIZE` (1000). A lower server cap (prod `max_rows`, GoTrue `perPage`) ends the loop early: for names that means missed duplicates, for users a false "Nie ma konta". `scripts/match-keys.ts` uses keyset paging instead.
- **Fix**: Keyset-page recipe names on `id` like match-keys.ts, and use `nextPage`/`lastPage` from `listUsers`.
- **Decision**: FIXED — Fix now (keyset paging on id; empty-page stop for names and listUsers)

### F4 — Parser silently mangles malformed ingredient text

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/import-recipes/parse.ts:95-120, 171-174
- **Detail**: (a) `Mąka (100g) [zamienniki: x (50g)] extra` loses its quantity: text after a block makes `PAREN_QUANTITY` (end-anchored) fail and the amount stays in the name. (b) An unclosed `(`, e.g. `Pomidory (puszka; 400 g ; Sól (1szczypta)`, keeps depth > 0 and merges all later pieces into one ingredient. Neither produces an issue.
- **Fix**: Emit a blocking issue when non-empty text follows a block in a piece, and when paren depth is not 0 at the end of the text.
- **Decision**: FIXED — Fix now (issues for text after a block and unclosed parenthesis; 2 tests added)

### F5 — `perServing` rounding errs on exact ties

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/import-recipes/parse.ts:215-218
- **Detail**: `Math.round(x * 10) / 10` misrounds some exact decimal ties because of floating-point error (e.g. 0.3/6 gives 0 instead of 0.1). The error is 0.1 g on macros only; kcal rounding is fine.
- **Fix**: Round on integer tenths or add a small epsilon.
- **Decision**: SKIPPED

### F6 — `splitSteps` splits on ordinals inside a step

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/import-recipes/parse.ts:197-201
- **Detail**: `1. Piec do 5. minuty` creates a spurious step because any `\d{1,2}[.)]` counts as numbering. The preview does not show steps, so it would go unnoticed.
- **Fix**: Treat numbers as separators only when sequential (n, n+1).
- **Decision**: FIXED — Fix now (numbering split only in sequence; test added)

### F7 — Small robustness and readability items

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/import-recipes/parse.ts:58-59; scripts/import-recipes.ts:32-46, 183
- **Detail**: `BLOCK_START`/`BLOCK_END` are literal invisible private-use characters (U+E000/U+E001). `parseArgs` lets `--author-email --write` take `--write` as the email. The catch handler drops Postgrest `details`/`hint`. The missing-env message is English while the rest of the output is Polish.
- **Fix**: Use `""`/`""` escapes, reject values starting with `--`, and print `details`/`hint`.
- **Decision**: FIXED — Fix now (\uE000/\uE001 escapes, option values reject --flags, Postgrest details/hint printed; Polish env message left as-is to match match-keys.ts)
