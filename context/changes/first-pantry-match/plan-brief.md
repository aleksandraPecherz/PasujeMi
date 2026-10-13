# Pierwsze dopasowanie ze spiżarki (S-03) — Plan Brief

> Full plan: `context/changes/first-pantry-match/plan.md`
> Research: `context/changes/first-pantry-match/research.md`, `context/changes/first-pantry-match/external-research.md`

## What & Why

Użytkownik wpisuje tagi w trzech sekcjach: posiadane, stałe i wykluczenia. Dostaje listę przepisów posortowaną po % dopasowania, bez przepisów z wykluczonym składnikiem. To główne kryterium sukcesu PRD. Wykluczenia są twardym filtrem, bo dotyczą alergii.

## Starting Point

- Przepisy leżą w `public.recipes`, a składniki i zamienniki w `ingredients jsonb`. Kluczem dopasowania jest `product`.
- Lista przepisów istnieje tylko jako `GET /api/recipes` (sortowanie po nazwie). Strona główna to placeholder.
- W repo nie ma runnera testów ani polskiego stemmera.

## Desired End State

- Strona `/` ma trzy sekcje tagów i przycisk „Zastosuj filtry”.
- Kafelki pokazują % oraz składniki jako „mam” (zielony) albo „brak informacji” (szary). Bez filtrów widać 10 przepisów bez % i przycisk doczytywania.
- Klucze dopasowania są policzone wcześniej, więc ocena 1000 przepisów mieści się w 10 ms CPU.
- Reguła jest przypięta testami z PRD w CI.

## Key Decisions Made

| Decision                           | Choice                                                                            | Why (1 sentence)                                                             | Source                                   |
| ---------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| Silnik dopasowania                 | TS: Snowball + odległość edycyjna + słownik                                       | PG 17 nie ma polskiego stemmera, a `pg_trgm` daje `sól/soli` = 0,13.         | Research (external-research.md:25-27,74) |
| Konflikt z `infrastructure.md:170` | Klucze liczone przy zapisie w kolumnie `match_keys` z wersją                      | Pomiar: per żądanie ≈ 15 ms, z gotowymi kluczami ≈ 5 ms przy 1000 przepisów. | Plan (pomiar + decyzja autorki)          |
| Nieaktualne klucze                 | Liczone w żądaniu, zapisuje je tylko skrypt                                       | Poprawność wykluczeń nie zależy od uruchomienia przeliczenia.                | Plan                                     |
| Stemmer                            | Kopia w repo z licencją BSD-3, bez zależności npm                                 | Pakiet nie ma `"type": "module"` ani typów, ma jednego opiekuna.             | Research (research.md:130-152)           |
| Posiadane vs szczegółowe           | Zawieranie tokenów w obie strony; liczby i % pomijane                             | „mleko” pokrywa „mleko 1,5%”, „jogurt naturalny” pokrywa „jogurt”.           | Plan (autorka)                           |
| Mleko kokosowe/owsiane/sojowe      | Osobne produkty dla posiadanych; wykluczenie „mleko” nadal je ukrywa              | Zgodność z PRD Business Logic i bezpieczeństwo przy alergiach.               | Plan (autorka) + PRD                     |
| Krótkie słowa                      | Literówka (odl. 1) tylko gdy oba rdzenie ≥ 4 znaki                                | `jajko/jajek` łączy, `sól≠sok`, `ryż≠ryby`.                                  | Plan (autorka)                           |
| Słownik                            | `src/lib/matching/dictionary.ts`: synonimy, osobne produkty, wyjątki (`mąka≠mak`) | Wersjonowany i testowany; zmiana wymusza podbicie wersji kluczy.             | Plan (autorka)                           |
| Remisy %                           | Więcej dostępnych pozycji, potem nazwa                                            | 5/5 przed 2/2, 3/6 przed 1/2.                                                | Plan (autorka)                           |
| Transport                          | Wyspa React + `GET /api/recipes/match` z tagami w zapytaniu                       | Posiadane żyją tylko w sesji (FR-003).                                       | Research (research.md:120-124)           |
| Testy                              | Vitest + krok `npm test` w CI                                                     | AGENTS.md wymaga runnera; roadmapa wymaga przypadków z PRD.                  | Research (research.md:153-156)           |

## Scope

**In scope:**

- reguła dopasowania i jej testy, kopia stemmera, słownik;
- migracja `match_keys`, skrypt `npm run match-keys`;
- serwis `matchRecipes`, endpoint, rozszerzenie smoke i CI;
- widok tagów, kafelek wspólny z S-02, lista z doczytywaniem.

**Out of scope:**

- trwałe stałe i wykluczenia (S-04);
- szczegóły przepisu (S-02);
- zapis przepisów (S-05, F-02);
- słownik w bazie, `pg_trgm`;
- zmiany w `infrastructure.md` i PRD;
- Workers Paid.

## Architecture / Approach

`dictionary.ts` → `computeMatchKeys` liczy klucze przepisu i zapisuje je w `recipes.match_keys`. Robi to skrypt z kluczem service role, a w przyszłości zapis przepisu w S-05/F-02.

Przy żądaniu `matchRecipes`:

1. pobiera `id, name, match_keys` w porcjach po 1000 (limit `max_rows`);
2. dla nieaktualnych wierszy liczy klucze w pamięci;
3. wywołuje `rankRecipes`, czyli dopasowanie tagów raz na unikalny klucz i sprawdzanie zbiorów;
4. pobiera pełne wiersze tylko dla strony 10 przepisów.

Wyspa `PantryMatch` woła `/api/recipes`, gdy nie ma filtrów, a `/api/recipes/match`, gdy są.

## Phases at a Glance

| Phase                           | What it delivers                                                | Key risk                                                                   |
| ------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Rdzeń dopasowania            | Moduł reguły, stemmer, słownik, Vitest w CI, benchmark          | Kopia stemmera na workerd lub w buildzie; fałszywe zlewki krótkich słów    |
| 2. Klucze w bazie, serwis i API | Migracja, `npm run match-keys`, `matchRecipes`, endpoint, smoke | Ucięcie katalogu przez `max_rows = 1000`; klucz service role poza Workerem |
| 3. Widok spiżarki i lista       | Tagi w 3 sekcjach, `RecipeTile`, lista z % i doczytywaniem      | Rozjazd kafelka z S-02                                                     |

**Prerequisites:** F-01 i S-01 ukończone (są); lokalny Supabase; klucz service role do przeliczenia na produkcji (przeliczenie uruchamia człowiek).
**Estimated effort:** ok. 3–4 sesje, po jednej na fazę, plus weryfikacja po wdrożeniu.

## Open Risks & Assumptions

- Pomiar CPU pochodzi z Node na komputerze autorki, nie z workerd. Weryfikacja: Workers Logs po wdrożeniu; ścieżka awaryjna to Workers Paid (`infrastructure.md:170`).
- Benchmark na danych o kształcie Excela (ok. 10 składników, 0,8 zamiennika na składnik) daje ok. 7,8 ms lokalnie (JSON.parse ok. 5,5 ms + ocena ok. 2,3 ms) przy 1000 przepisów, więc zapas do 10 ms jest mały. Zmierzyć ponownie (`npm run bench:match` i Workers Logs) po imporcie F-02, na prawdziwym katalogu.
- Słowo po „bez” zostaje tokenem, więc wykluczenia działają nadmiarowo. To bezpieczne, ale może ukryć np. „jogurt bez laktozy” przy wykluczeniu „laktoza”.
- Zdrobnienia i formy, których stemmer nie łączy (np. `cukier/cukru`), wymagają wpisów w słowniku. Jakość zależy od jego uzupełniania.

## Success Criteria (Summary)

- Przepis z wykluczonym składnikiem (bez niewykluczonego zamiennika) nigdy nie pojawia się na liście. Przypadki z PRD przechodzą w CI.
- Lista po filtrach jest posortowana według % i reguły remisów, a tagi „mam” i „brak informacji” są poprawne.
- Endpoint mieści się w 10 ms CPU w Workers Logs, a lista pojawia się w < 1 s.
