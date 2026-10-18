<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: S-04 zapamiętane produkty stałe i wykluczenia

- **Plan**: context/changes/remembered-staples-exclusions/plan.md
- **Scope**: Full plan (phases 1–3 of 3; fazy 2 i 3 mają jeszcze niezaznaczone kroki ręczne)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-18
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

Automated: `npm test` 316/316, `npm run lint`, `npx astro check` (0 errors), `npm run check:ui`, `npm run build` — all pass.

## Findings

### F1 — Regex `d+` zamiast `\d+` w decodeEntities

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:52
- **Detail**: `.replace(/&#(d+);/g, ...)` dopasowuje literalne „d”, więc dziesiętne encje (`&#243;`) nie są dekodowane. Krok „saved staples come back after signing in again” przejdzie tylko, jeśli Astro wypisze polskie litery surowo lub jako hex.
- **Fix**: Zmienić na `/&#(\d+);/g`.
- **Decision**: FIXED — Fix now (regex zmieniony na \d+ w scripts/smoke.mjs:52)

### F2 — Wiersz niepoprawny w bazie wyłącza zapis bez ścieżki naprawy

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/pantry.ts:142-154, src/components/hooks/usePantryMatch.ts:272
- **Detail**: Wiersz niespełniający `parseSavedPantry` (np. zapis wprost przez PostgREST albo zaostrzony limit) daje `saved = null`: zapis wyłączony na stałe, komunikat bez możliwości odzyskania. Zgodne z planem (świadoma ochrona przed cichym skasowaniem), ale użytkownik utknie.
- **Fix**: Zaakceptować na MVP; ewentualnie później dodać jawny „reset” zapisanych list.
- **Decision**: SKIPPED

### F3 — Snapshot przywraca stare `applied.staple`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/hooks/usePantryMatch.ts:217-225
- **Detail**: Po powrocie ze szczegółów lista pochodzi z `snapshot.applied`, a tagi z bazy; gdy stałe zmieniono w innej karcie, procenty dopasowania i tagi mogą się rozjechać do „Zastosuj filtry”. `missesSavedExclusion` obejmuje tylko wykluczenia (stałe nie ukrywają przepisów). Zgodne z planem.
- **Fix**: Brak działania; opcjonalnie rozszerzyć kontrolę na stałe.
- **Decision**: SKIPPED

### F4 — Niezamknięte kroki ręczne i niezaplanowana zmiana roadmap.md

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 2.4, 2.5, 3.3, 3.7, 3.8, 3.11; context/foundation/roadmap.md
- **Detail**: Kroki 2.4, 2.5, 3.3, 3.7, 3.8, 3.11 są nieodhaczone (oczekujące; nie ma pozornych odhaczeń). `roadmap.md` zmieniony w diffie, choć plan go nie przewiduje; migracja produkcyjna (3.11) musi być zastosowana przed merge. PR ma zawierać „Closes #6”.
- **Fix**: Domknąć kroki ręczne przed archiwizacją; sprawdzić diff `roadmap.md`.
- **Decision**: SKIPPED
