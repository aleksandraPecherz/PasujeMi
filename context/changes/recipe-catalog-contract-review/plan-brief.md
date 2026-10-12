# Minimalny kontrakt danych przepisu (F-01) — Plan Brief

> Full plan: `context/changes/recipe-catalog-contract/plan.md`

## What & Why

F-01 ustala, jak wygląda przepis w bazie, zanim powstaną import (F-02), lista (S-02), dopasowanie (S-03) i dodawanie (S-05). Źródłem jest Excel autorki `data/recipes.xlsx` (76 przepisów), którego zapisy są niespójne: różne układy składników i ilości, trzy formaty kroków, kcal raz na porcję, raz na całość. Kontrakt i reguły konwersji rozstrzygają te różnice raz, dla wszystkich kolejnych slice'ów.

## Starting Point

Nie ma żadnej tabeli, migracji ani RLS; `supabase/` ma tylko `config.toml`. Logowanie i ochrona `/api/*` już działają (S-01). Lokalnie nie ma Supabase CLI ani Dockera, `.dev.vars` wskazuje na produkcyjną bazę, a CI uruchamia własny Supabase z migracjami i `seed.sql`.

## Desired End State

Tabela `recipes` z odczytem tylko dla zalogowanych istnieje na produkcji (pusta) i w CI (z 5 przepisami testowymi). Typy, serwis i `GET /api/recipes` dają kolejnym slice'om typowany odczyt. `docs/reference/recipe-data-contract.md` opisuje kształt przepisu i reguły konwersji z Excela dla importu F-02.

## Key Decisions Made

| Decision                  | Choice                                                                                                              | Why (1 sentence)                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Przechowywanie            | Jedna tabela, `ingredients jsonb`, `steps text[]`                                                                   | Przepis czytany jednym zapytaniem, prosty seed i import.                                          |
| Ilość składnika           | `amount` (liczba) + `unit` („g”, „szczypta”)                                                                        | Jednolity zapis bez względu na układ w Excelu, proste pola dla S-05.                              |
| Nazwy handlowe            | `name` jak w przepisie + `product` ogólny („ser żółty”)                                                             | S-03 dopasowuje po produkcie, nie zgaduje marek.                                                  |
| Kcal i makro              | Zawsze na porcję; dzielone przez porcje, gdy `0,75 ≤ kcal / (400 × porcje) ≤ 1,25` i porcje > 1                     | Reguła autorki; F-02 pokaże autorce listę przeliczonych do potwierdzenia.                         |
| Kroki                     | Numeracja > nowa linia > `;`; bez numerów, wielką literą                                                            | Każdy opis krokowy niezależnie od formatu w Excelu.                                               |
| Opis przepisu             | „Opis” = kroki „Jak zrobić?”, bez osobnego krótkiego opisu                                                          | Excel nie ma osobnego opisu; autorka go nie potrzebuje.                                           |
| Dostęp                    | RLS: tylko `select` dla zalogowanych, brak zapisu; jawne `grant select` dla `authenticated`, `revoke all` od `anon` | Dostęp nie zależy od domyślnych GRANT-ów projektu; zapis i role dochodzą w S-05–S-07.             |
| Przepisy testowe          | `supabase/seed.sql` — tylko lokalnie i w CI                                                                         | Produkcja bez duplikatów do czyszczenia przy imporcie F-02.                                       |
| Dane źródłowe             | `data/recipes.xlsx` tylko lokalnie, `data/` w `.gitignore`                                                          | Import F-02 uruchamiany lokalnie z pliku autorki, nie z repo.                                     |
| Migracja produkcyjna      | `npx supabase db push` (dry-run → zgoda autorki)                                                                    | Śledzona historia migracji dla kolejnych slice'ów.                                                |
| Walidacja przed produkcją | Gałąź + PR do `master`; `db push` dopiero po zielonym CI na PR                                                      | CI (`supabase start` + smoke) jako pierwsze uruchomienie migracji i endpointu, zamiast produkcji. |
| Kolejność faz             | Schemat → migracja produkcyjna → seed i smoke                                                                       | Push na `master` od razu wdraża kod, więc tabela musi być na produkcji wcześniej.                 |

## Scope

**In scope:** migracja `recipes` z RLS, `src/types.ts`, `src/lib/services/recipes.ts`, `GET /api/recipes` (limit/offset, `hasMore`), `docs/reference/recipe-data-contract.md`, `data/` w `.gitignore`, `db push` na produkcję, `supabase/seed.sql` z 5 przepisami, krok smoke dla zalogowanego.

**Out of scope:** import 76 przepisów i parser (F-02), zapis/edycja/autorstwo/admin (S-05–S-07), logika „tego samego składnika” (S-03), UI listy i szczegółów (S-02), `data/recipes.xlsx` w repo (plik tylko lokalnie u autorki), kolumna „waga (g)”, przepisy testowe na produkcji.

## Architecture / Approach

Postgres trzyma przepis jako jeden wiersz; kształt `ingredients` (`name`, `product`, `amount`, `unit`, `substitutes[]`) pilnują CHECK-i i typy TS. Serwis mapuje wiersze na `Recipe`, endpoint go wystawia, a middleware z S-01 odcina niezalogowanych. Dane testowe żyją wyłącznie w `seed.sql`, które CI ładuje przy `supabase start`.

## Phases at a Glance

| Phase                            | What it delivers                                                                                                             | Key risk                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Schemat, kontrakt i odczyt    | Migracja z RLS, typy, serwis, `GET /api/recipes`, dokument reguł konwersji, smoke dla zalogowanego; gałąź + PR z zielonym CI | Kod nie może trafić na `master` przed fazą 2 — tylko PR |
| 2. Migracja na produkcję         | Pusta tabela na produkcji przez `db push`, potem scalenie PR do `master`                                                     | Pierwsza konfiguracja CLI (login, link, hasło do bazy)  |
| 3. Przepisy testowe i smoke w CI | 5 przepisów w `seed.sql`, krok smoke dla zalogowanego, kontrola RLS anon w CI na zasilonej bazie                             | Błąd ręcznej konwersji — łapią go wartości kontrolne    |

**Prerequisites:** dostęp autorki do Supabase (login CLI, hasło do bazy); lokalny `data/recipes.xlsx` w aktualnej wersji (76 przepisów) — poza repo.
**Estimated effort:** ~1–2 sesje, 3 fazy.

## Open Risks & Assumptions

- Próg 0,75–1,25 opiera się na obecnych danych (przepisy „na całość” 0,96–1,07, „na porcję” ≤ 0,51); nowe przepisy mogą wymagać korekty — F-02 i tak pokazuje listę przeliczonych.
- Lokalny dev czyta produkcyjną bazę, więc przepisy testowe widać tylko w CI.
- `product` dla 5 przepisów ustalany ręcznie; reguła usuwania marek w F-02 wymaga przeglądu autorki.

## Success Criteria (Summary)

- Zalogowany czyta przepisy przez `GET /api/recipes`, anonim dostaje 401, a RLS ukrywa wiersze przed kluczem anon (sprawdzone w CI na zasilonej bazie).
- Produkcja ma pustą tabelę i działa po wdrożeniu kodu; CI pokazuje 5 przepisów testowych w smoke.
- Reguły konwersji (składniki, kroki, kcal, `product`) są zapisane i potwierdzone przez autorkę.
