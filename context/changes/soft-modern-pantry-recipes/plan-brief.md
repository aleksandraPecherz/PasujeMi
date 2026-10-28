# Soft Modern — spiżarka, lista przepisów i ilustracje (#61) — Plan Brief

> Full plan: `context/changes/soft-modern-pantry-recipes/plan.md`

## What & Why

Główny ekran dostaje wygląd Soft Modern v2: pasek i arkusz spiżarki na telefonie, panel na komputerze, kafelki M10A z ilustracjami i nowe stany. Dodatkowo użytkownik widzi, kiedy wyniki są nieaktualne względem wpisanej spiżarki.

## Starting Point

Spiżarka to jedna sekcja z trzema polami, a kafelek pokazuje wszystkie składniki jako tagi. Przepis nie ma pola ilustracji; stan tagów i `applied` są w `usePantryMatch`.

## Desired End State

Telefon: pasek spiżarki, arkusz z zakładkami, komunikat „wyniki jeszcze nie odświeżone”. Komputer: panel obok wyników. Kafelki z ilustracją, procentem przy czasie, „Masz X z Y” i „Brakuje: …”, z zachowaną informacją o zamiennikach. 76 istniejących przepisów ma ilustracje, nowe dostają obraz zastępczy.

## Key Decisions Made

| Decision           | Choice                                                                  | Why                                                                          | Source |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Zestaw ilustracji  | 12, policzony z 76 przepisów; próbki 3 w `preview/`                     | Dane pokazały potrzebę wrapów, placków, makaronów, misek, talerzy i szklanki | Plan   |
| Format             | Osobne SVG w `public/illustrations/`, tła z tokenów `--illus-*`         | Bez literałów w komponentach i bez mieszania z kolorami semantycznymi        | Plan   |
| Baza               | `recipes.illustration text null`, format klucza w `check`               | Najprostsze trwałe przypisanie; `PUT` go nie dotyka                          | Plan   |
| Przypisanie        | Jednorazowy skrypt z `--check`, podglądem i `--write`                   | Bez ręcznego SQL, bez doboru w aplikacji                                     | Plan   |
| Arkusz/panel       | Jeden element: CSS robi z niego panel od `md`, `popover="auto"` poniżej | Brak duplikatów `id`, bez przeskoku przy hydracji, Esc i tło natywnie        | Plan   |
| Porównanie filtrów | Zbiory kluczy `trim` + `toLocaleLowerCase("pl")`                        | Ta sama normalizacja co `addTag`                                             | Plan   |
| Zamienniki         | „Zamiennik …” i „użyj … (zamiast …)” zostają                            | Semantyka dopasowania bez zmian                                              | Plan   |

## Scope

**In scope:** kolumna i serwis, SVG i tokeny, kafelek, pasek/arkusz/panel, stany, skrypt przypisania, reguły.

**Out of scope:** algorytm, uprawnienia, szczegóły i formularz przepisu, wybierak i AI, gest przeciągania, Wstecz, link „Jak to działa?”, zdalne migracje i zapisy.

## Architecture / Approach

Dane → ilustracje i kafelek → spiżarka → przypisanie i domknięcie. Kod pobierający `recipes.illustration` wymaga migracji (bez kolumny zapytanie zwraca błąd); fallback obsługuje tylko `NULL` i nieznany klucz. Lokalny Supabase działa, więc migracja jest sprawdzana lokalnie; zdalnie nic nie robię.

## Phases at a Glance

| Phase                   | What it delivers                                     | Key risk                                |
| ----------------------- | ---------------------------------------------------- | --------------------------------------- |
| 1. Kolumna i serwis     | Migracja (lokalnie), typ, serwis, test niezmienności | Kolejność migracja → kod                |
| 2. Ilustracje i kafelek | 12 SVG, tokeny, kafelek M10A                         | Zgodność stylu rysunków z makietami     |
| 3. Spiżarka             | Pasek, arkusz, panel, komunikat, stany               | Zmiana szerokości przy otwartym arkuszu |
| 4. Przypisanie          | Mapa, skrypt, runbook, końcowe kontrole              | Nazwy w bazie różne od arkusza          |

**Prerequisites:** fundament #60 (656c7f7), akceptacja `illustration-map.md`.
**Estimated effort:** ~4–5 sesji.

## Open Risks & Assumptions

- Rysunki są wektorowe, proste, rysowane ręcznie; ich jakość ocenia autorka.
- Arkusz jest niemodalnym `popover`; bez własnej pułapki fokusu. Do sprawdzenia ręcznie na telefonie.
- Nazwy w produkcyjnej bazie mogą się różnić od arkusza; skrypt zgłosi niedopasowane.

## Success Criteria (Summary)

- Ekran główny w Soft Modern na telefonie i komputerze, w obu motywach.
- Użytkownik widzi, że wyniki są nieaktualne, a wpisane produkty nie giną po zamknięciu arkusza.
- Wszystkie 76 przepisów ma ilustrację, `PUT` jej nie kasuje, pełny zestaw kontroli przechodzi.
