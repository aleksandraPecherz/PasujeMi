<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: CI/CD code review

- **Plan**: context/changes/ci-cd-code-review/plan.md
- **Scope**: Phases 1–2 of 3 (PR #58, HEAD 9cd0c4e). Phase 3 is deferred to a separate small PR from master after #58 merges and is not treated as missing.
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-26
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 11 observations
- **Triage tag** (per request): blokuje merge / do poprawki przed fazą 3 / na później

## Verdicts

| Dimension           | Verdict                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| Plan Adherence      | PASS (2 prompt/contract deviations, see F11)                            |
| Scope Discipline    | PASS                                                                    |
| Safety & Quality    | WARNING (F1–F3)                                                         |
| Architecture        | PASS                                                                    |
| Pattern Consistency | WARNING (F9)                                                            |
| Success Criteria    | WARNING (F4–F6: open/partial manual checks 2.7, 2.11, 2.13, 2.14, 2.15) |

Automated gates re-run: 1.7 and 2.2–2.5 PASS, package typecheck clean, 63/63 package tests pass, CI green on 9cd0c4e. No finding blocks merge.

## Findings

### F1 — No time bound around the SDK call; a hang gives no signal

- **Tag**: do poprawki przed fazą 3
- **Severity**: ⚠️ WARNING
- **Location**: .github/actions/code-review/action.yml:76-102, .github/workflows/ai-code-review.yml:27
- **Detail**: A hung `query()` runs until the job `timeout-minutes: 15`. The timeout cancels the job, `!cancelled()` is false, nothing is published, and the trigger label was already removed: no comment, no `ai-cr:error`.
- **Fix**: wrap the call in `timeout 600 env -u ... npm run review ...`; a kill leaves no result.json and the existing infra-error comment path handles it.
- **Decision**: FIXED (niezacommitowane) — zamiast `timeout` w shellu limit jest w `runReview` (`REVIEW_TIMEOUT_MS` = 10 min < `timeout-minutes: 15`), z `AbortController` i wyścigiem z terminem, nową kategorią `timeout` (bezpieczny komunikat) i testami: zawieszony strumień → `timeout` po jednym `query()`, przerwany sygnał; run w terminie nie dostaje `timeout`.

### F2 — Golden-comment test cannot fail when a golden file is missing

- **Tag**: do poprawki przed fazą 3
- **Severity**: ⚠️ WARNING
- **Location**: tools/code-reviewer/src/comment.test.ts:187-194
- **Detail**: `checkGolden` writes the golden and passes when the file does not exist, so a deleted/renamed golden regenerates itself on CI.
- **Fix**: create goldens only when `UPDATE_GOLDEN=1`; otherwise fail on a missing file.
- **Decision**: FIXED (niezacommitowane) — brak golden = błąd; zapis tylko przy `UPDATE_GOLDEN=1`; dodany test, że brakujący golden nie jest tworzony. Kontrola: usunięcie `passed.md.golden` → test czerwony.

### F3 — Docs disagree on open point 2.11 / 2.14 / 2.15 (plan.md vs PR #58 vs code)

- **Tag**: do poprawki przed fazą 3
- **Severity**: ⚠️ WARNING
- **Dimension**: Plan Adherence / Success Criteria
- **Location**: plan.md Progress 2.11, 2.14, 2.15; PR #58 body; action.yml:73-74
- **Detail**: (a) 2.11 in plan.md still says it needs "dłuższego kroku review (faza 3)", while the decision is no extra model attempt in phase 3; the PR body does not mention phase 3 for it. (b) 2.14 and the PR say "pokryte testami jednostkowymi", but the lockfile exclusion lives in shell in action.yml (`git diff --name-only | grep`, pathspec exclude), which no test covers; unit tests cover only `prepareInput` and the skipped golden. (c) 2.15 masking of a real token says "faza 3 lub osobna decyzja", but Phase 3 criteria contain no masking check, so it has no owner. 2.7, 2.13 agree across plan, PR and code.
- **Fix**: align wording in plan.md and the PR body: 2.11 stays unresolved without phase 3; 2.14 states the shell part is unverified; assign masking (2.15) to a Phase 3 check or accept it explicitly as not verified.
- **Decision**: FIXED (niezacommitowane) — plan.md (2.11, 2.14, 2.15 i notatka przy fazie 3), opis PR #58 i komentarz w workflow mówią to samo o zakresie kontroli.

### F4 — Race between head-check/publish and the invalidate path

- **Tag**: na później (decyzja autorki: znane ograniczenie, nie zadanie fazy 3)
- **Severity**: ⚠️ WARNING
- **Location**: ai-code-review.yml:123-144, 142-203
- **Detail**: Head-check i publikacja to osobne kroki. Gdy push wyląduje między nimi, run `invalidate` może ustawić `ai-cr:stale`, po czym publikacja starszego review nadpisze komentarz i doda etykietę wyniku dla starego SHA. Okno to ~1–4 s przy `head-check`, a opóźnienie anulowania (>15 s w 2.11) go nie zamyka. Wcześniejsza adnotacja, że plan akceptuje tę lukę, była błędna; akceptację wydała autorka dopiero w tej decyzji.
- **Rozważone i niewdrożone**: (a) `cancel-in-progress: false` (kolejka z jednym oczekującym runem; oczekujący `invalidate` może zostać zastąpiony przez `ai-cr:review`, a okno zostaje); (b) uzgadnianie ze stanem na żywo (live `head.sha` w `invalidate` i po publikacji, czysta funkcja decyzji w TS, test scenariusza bez modelu). To samonaprawa, nie transakcja; krok z `!cancelled()` może zostać pominięty przy anulowaniu.
- **Decision**: ACCEPTED (2026-10-26) jako znane ograniczenie jednoosobowego, doradczego MVP: przy wyścigu publikacji może chwilowo albo do kolejnego zdarzenia pozostać wynik starego SHA bez `stale`. Komentarz wskazuje oceniony SHA, review nie blokuje merge. Bez dodatkowej samonaprawy i bez zmiany `concurrency`. Nie jest zadaniem fazy 3. Zapisane też w plan.md (Progress, faza 2).

### F5 — Label 404 tolerated by string match on "HTTP 404"

- **Tag**: na później
- **Severity**: 👁 OBSERVATION
- **Location**: ai-code-review.yml:68, 191, 252
- **Detail**: Also swallows other 404s (permissions regression). Match the specific message instead.
- **Decision**: PENDING

### F6 — First review dropped by a quick push leaves no signal

- **Tag**: na później
- **Severity**: 👁 OBSERVATION
- **Location**: ai-code-review.yml:74-101, 223-263
- **Detail**: With no prior comment/label, invalidate does nothing; the trigger label is already gone.
- **Decision**: PENDING

### F7 — excludedFiles and skip reason rendered unescaped in the comment

- **Tag**: na później
- **Severity**: 👁 OBSERVATION
- **Location**: tools/code-reviewer/src/comment.ts:21, 116
- **Detail**: Paths with backticks, `@user` or `<!-- ai-cr:... -->` can break out of the code span or forge markers. Author must be a repo writer (D7-B trust model).
- **Decision**: PENDING

### F8 — All-null scores with verdict pass yields `passed`

- **Tag**: na później
- **Severity**: 👁 OBSERVATION
- **Location**: tools/code-reviewer/src/outcome.ts:28-37
- **Detail**: Matches the plan ("wszystkie null → decyduje verdict"), but a prompt injection can force a green result with zero scores. Advisory check; revisit with evals.
- **Decision**: PENDING

### F9 — Label helpers in TS are dead code; YAML hardcodes the lists

- **Tag**: na później
- **Severity**: 👁 OBSERVATION
- **Location**: outcome.ts:40-64 vs ai-code-review.yml:197-203, 258-259
- **Detail**: `labelsToRemove`, `worstOutcome` and their tests protect code the workflow does not use; real label behaviour is untested and can drift. Also review-schema.ts:1-4 keeps a stale template header.
- **Decision**: PENDING

### F10 — Input size and comment length are not capped early

- **Tag**: na później
- **Severity**: 👁 OBSERVATION
- **Location**: input.ts:11-26, index.ts:21-22, comment.ts:41-43
- **Detail**: The full diff is read and counted before the 60k check (mild "Bound user-driven CPU work"); a very long model/note text could exceed GitHub's comment limit and fail the publish step. `</diff>` in PR text is not escaped (covered by the untrusted-data instruction).
- **Decision**: PENDING

### F11 — Small contract deviations and weak Progress evidence

- **Tag**: na później (korekta: `notAssessed` i „2–3 zdania łącznie” były zaakceptowane; poprawiona została nieaktualna dokumentacja)
- **Severity**: 👁 OBSERVATION
- **Location**: review-schema.ts:38, 51-52; requirements.md:84-87; plan.md Progress 2.8, 2.10
- **Detail**: To nie jest odchylenie: `notAssessed` i „2–3 zdania łącznie” były zaakceptowane. Nieaktualne było `requirements.md` (mówiło o opisie w podsumowaniu i o otwartym kontrakcie). 2.8 ticked with input-too-large instead of missing-secret; 2.10 ticked with the "odrzucony jako nieaktualny" summary entry unverified (annotated). After merge the workflow is live: until the secret exists every non-draft PR to master gets a red advisory check with `ai-cr:error` (accepted in the plan; not a required check).
- **Decision**: FIXED (niezacommitowane) — `requirements.md` uaktualnione (`notAssessed`, 2–3 zdania, kontrakt rozstrzygnięty w planie).
