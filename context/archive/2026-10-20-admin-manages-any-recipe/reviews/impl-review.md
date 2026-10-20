<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: S-07 Admin zarządza dowolnym przepisem

- **Plan**: context/changes/admin-manages-any-recipe/plan.md
- **Scope**: Full plan (kod faz 1–3; ręczne 2.5–2.7, 3.4–3.6 oczekujące)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-20
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Automatyczne: `npm test` 338 OK, lint OK, `astro check` 0 błędów, `check:ui` OK, CI (`ci`, `smoke`) zielone na PR #41. Ręczne 2.5–2.7, 3.4–3.6 oczekujące (nieodhaczone, zgodnie z Progress).

## Findings

### F1 — Błąd isAdmin daje 500 z pełną treścią przepisu

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/recipes/[id].astro:21-31
- **Detail**: `recipe` jest ustawiane przed `await isAdmin`. Gdy `isAdmin` rzuci (np. 42P01, gdy migracja nie jest jeszcze na produkcji, albo chwilowy błąd), `catch` ustawia status 500, a szablon sprawdza `recipe ?` jako pierwsze, więc nie-autor dostaje stronę przepisu z HTTP 500 i bez przycisków. Dotyczy każdego nie-autora w oknie deploy-przed-migracją. Plan mówił „błąd → istniejąca ścieżka 500”, więc to skutek projektu planu.
- **Fix**: Owiń wywołanie `isAdmin` w osobny try/catch, który loguje i ustawia `canManage = false` (przyciski to tylko UX, granicą jest RLS).
- **Decision**: FIXED (Fix now: osobny try/catch wokół isAdmin w [id].astro, degradacja do canManage = false)

### F2 — Drugie zapytanie do bazy dla nie-autorów

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/recipes/[id].astro:25, src/pages/recipes/[id]/edit.astro:22
- **Detail**: Sekwencyjne zapytanie po `getRecipe` dla każdego nie-autora i przepisów bez autora. Plan to przewidział (Performance Considerations), skala jest mała.
- **Fix**: Bez zmian; ewentualnie `Promise.all` w przyszłości.
- **Decision**: SKIPPED

### F3 — Słabe asercje w kroku CI

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: .github/workflows/ci.yml (krok „Check admin permissions”)
- **Detail**: „B updates the admin row of M” sprawdza tylko 403, nie to, że `created_at` się nie zmienił (sprawdzane jest tylko istnienie wiersza). Przypadek tokenu zwykłego użytkownika na `rpc/is_admin` nie jest pokryty (jest token admina).
- **Fix**: Dopisz odczyt `created_at` kluczem serwisowym przed i po PATCH-u B i porównaj.
- **Decision**: SKIPPED

### F4 — Przyszłe funkcje w schemacie private dostają EXECUTE dla PUBLIC

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261020120000_add_admin_manages_any_recipe.sql:35
- **Detail**: `grant usage on schema private to authenticated` jest bezpieczne dziś (jedna funkcja z odebranym EXECUTE), ale każda przyszła funkcja w `private` będzie domyślnie wołalna przez PUBLIC w kontekstach SQL.
- **Fix**: Jednoliniowy komentarz w migracji albo `alter default privileges in schema private revoke execute on functions from public` (nowa migracja, bo istniejącej nie zmieniamy po fazie 1 na produkcji).
- **Decision**: ACCEPTED-AS-RULE: Revoke PUBLIC execute on every new function in the private schema (lesson only, kod bez zmian)
