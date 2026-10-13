# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Close roadmap issues explicitly with "Closes #N"

- **Context**: Every roadmap change that has a GitHub issue (S-xx, F-xx), plus any open-question issues (Q-x) it resolves.
- **Problem**: Issue S-01 (#3) stayed open after deploy and archive, because neither GitHub nor /10x-archive closes issues automatically.
- **Rule**: Always put "Closes #N" for the change's issue and any Q-x it resolves in the PR description or the commit that lands on master. At archive time, check the issues are closed and close them manually if not.
- **Applies to**: plan, implement

## Assert status and body type before content in HTTP checks

- **Context**: .github/workflows/ci.yml:47 — "Check that recipes are hidden from the anon key" step (row count of the seeded recipes).
- **Problem**: `curl -s` (without `-f`) accepts HTTP errors, and `jq 'length'` on a PostgREST error object counts its keys (4), not rows. The check fails only because 4 ≠ 5; a 5-key error object or a string body would pass or give a misleading result.
- **Rule**: In CI and smoke checks against an HTTP API, first assert the status and the response type (`curl -f`, `jq -e 'type == "array"'`), then the content; never count `length` on a body of unknown type.
- **Applies to**: plan, implement, impl-review

## Bound user-driven CPU work per request

- **Context**: Każdy endpoint API i serwis na Cloudflare Workers, który przetwarza dane użytkownika w pętli (tagi, odczytania, kombinacje, pętle po katalogu przepisów).
- **Problem**: Liczba iteracji rośnie z danymi użytkownika (np. wykładniczo: 12 tagów „maka” dało 4096 odczytań), a na Workers Free limit CPU to 10 ms na zapytanie. Po przekroczeniu Worker kończy się błędem 1102 zamiast czytelnej odpowiedzi.
- **Rule**: Przed pętlą ogranicz wejście twardym limitem (np. MAX_TOKENS) i przy przekroczeniu zwróć 400 z czytelnym kodem błędu. Unikaj kombinatoryki po każdym wystąpieniu – licz warianty po unikalnych kluczach. Limity trzymaj w jednym pliku współdzielonym przez API i UI.
- **Applies to**: plan, implement, impl-review (src/pages/api/**, src/lib/matching/**)
