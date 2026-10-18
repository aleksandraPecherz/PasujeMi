# F-02 seed-recipe-import — Plan Brief

> Full plan: `context/changes/seed-recipe-import/plan.md`
> Research: `context/changes/seed-recipe-import/research.md`

## What & Why

Importujemy 76 przepisów autorki z lokalnego `data/recipes.xlsx` do `public.recipes`, żeby aplikacja miała realny katalog od pierwszego uruchomienia (F-02, issue #2). Bez tego dopasowanie S-03 i lista S-02 działają tylko na 5 przepisach z seeda.

## Starting Point

Kontrakt konwersji istnieje (`docs/reference/recipe-data-contract.md`), podobnie jak walidator `parseRecipeInput` i wzorzec skryptu service role (`scripts/match-keys.ts`). Brakuje parsera Excela, biblioteki xlsx i samego skryptu. Reguła podziału zamienników w kontrakcie rozcina przecinek dziesiętny („mleko 1,5% (45g)”).

## Desired End State

Autorka uruchamia podgląd, który niczego nie zapisuje. Widzi w nim błędy, 12 przepisów z przeliczonymi kcal do potwierdzenia, ostrzeżenia o możliwych markach i przepisy pomijane jako istniejące. Osobna komenda zapisuje nowe przepisy jako jej autorstwa, z gotowymi kluczami dopasowania. Ponowne uruchomienie jest bezpieczne (`inserted 0`). Lokalnie w aplikacji jest 76 przepisów (71 z importu + 5 z seeda), na produkcji 76 z importu.

## Key Decisions Made

| Decision                    | Choice                                                                                   | Why (1 sentence)                                                                 | Source                    |
| --------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| Zakres                      | Wszystkie 76 przepisów                                                                   | Tyle jest w pliku i w kontrakcie; „70” w roadmapie było przybliżeniem            | Plan (autorka)            |
| Wiersz 39 / limit zamienników | Poprawiony w Excelu do 5; `MAX_SUBSTITUTES` zostaje 5                                  | Jeden limit dla formularza i importu                                             | Research + Plan (autorka) |
| Marki                       | Zostają w `name`; `product` bez marek z jawnej listy; ostrzeżenie o nieznanych           | Dopasowanie działa tylko po `product`; lista chroni przyszłe pliki               | Research + Plan (autorka) |
| Separator zamienników       | Przecinek dzieli tylko po ilości (jak na najwyższym poziomie); dopisane do kontraktu     | Przecinek dziesiętny w nazwie rozcinał 7 bloków                                  | Research + Plan (autorka) |
| Autorka                     | Szukana po e-mailu z flagi `--author-email`                                              | Lokalny i produkcyjny UUID się różnią; e-mail jest ten sam                       | Plan (autorka)            |
| Istniejąca nazwa            | Przepis pomijany; porównanie bez względu na wielkość liter i spacje                      | Ponowne uruchomienie bezpieczne, poprawka kosmetyczna w Excelu nie dubluje       | Plan (autorka)            |
| Podgląd vs zapis            | Domyślnie podgląd (czyta bazę, nie pisze); zapis osobną komendą                          | Kontrakt wymaga pokazania przeliczonych kcal przed zapisem                       | Plan (autorka)            |
| Błędny wiersz               | Zapis blokuje się w całości; jeden insert wszystkich nowych wierszy                      | Baza nigdy nie ma „prawie wszystkich” przepisów                                  | Plan (autorka)            |
| Klucze dopasowania          | Importer zapisuje `match_keys` i `match_keys_version`                                    | Wymaganie S-03; bez nich każde żądanie przelicza klucze (limit CPU)              | Research (S-03)           |
| Odczyt xlsx                 | `exceljs` jako devDependency                                                             | Nie trafia do Workera; brak ręcznego eksportu po stronie autorki                 | Plan (autorka)            |
| Produkcja                   | Najpierw `supabase db push --dry-run`; `db push` to osobna decyzja                       | Nie potwierdzono, że migracja `author_id` jest na produkcji                      | Research + Plan (autorka) |

## Scope

**In scope:**

- Poprawka reguły zamienników w `recipe-data-contract.md`
- Parser wiersza Excela, lista marek, ostrzeżenia, przeliczanie kcal — z testami vitest
- Skrypt `scripts/import-recipes.ts` z komendami `import-recipes` i `import-recipes:write`
- Import lokalny, procedura produkcyjna w nagłówku skryptu, `Closes #2`

**Out of scope:**

- Zmiany limitów, walidatora i kodu dopasowania (luki słownika należą do S-03)
- Aktualizacja lub zastępowanie istniejących przepisów
- Import w CI i dopisywanie przepisów do `seed.sql`
- UI lub endpoint importu; samo `supabase db push` na produkcję

## Architecture / Approach

Czysta logika w `scripts/import-recipes/` (`parse.ts`, `brands.ts`) zamienia wiersz arkusza na `NewRecipe` i przepuszcza go przez `parseRecipeInput`. Wynik to rekord, błędy, ostrzeżenia i informacja o przeliczeniu kcal. Cienki skrypt robi I/O:

- odczyt xlsx przez exceljs ze sprawdzeniem nagłówków;
- autorka przez `auth.admin.listUsers`;
- odczyt istniejących nazw;
- raport;
- przy `--write` i zerze błędów jeden insert z `author_id` i `computeMatchKeys`.

## Phases at a Glance

| Phase                                     | What it delivers                                              | Key risk                                                         |
| ----------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Kontrakt i parser                      | Reguły konwersji jako testowany kod + poprawiony kontrakt     | Pułapki formatu nieujęte w syntetycznych testach                 |
| 2. Skrypt importu                         | Podgląd i zapis wszystko-albo-nic z kluczami dopasowania      | exceljs zwraca nieoczekiwane typy komórek (rich text, formuły)   |
| 3. Import lokalny i procedura produkcyjna | 76 przepisów lokalnie, opisane kroki produkcyjne, issue #2    | Migracja `author_id` jeszcze nie na produkcji                    |

**Prerequisites:** `data/recipes.xlsx` (wersja z 2026-10-18 11:11) na maszynie autorki; lokalny Supabase w Dockerze; konto autorki lokalnie i na produkcji.
**Estimated effort:** ~2–3 sesje w 3 fazach.

## Open Risks & Assumptions

- Zakładamy, że nazwy 5 przepisów z `seed.sql` są (po normalizacji) takie same jak w Excelu. Jeśli nie, lokalny podgląd pokaże mniej pominiętych i liczby 71/5 trzeba skorygować przed zapisem.
- Heurystyka marek może dawać fałszywe ostrzeżenia; one nie blokują, a autorka decyduje o dopisaniu do listy.
- Kroki z wiersza 51 (1476 znaków) muszą po podziale zmieścić się w 1000 znakach na krok — wyjdzie w podglądzie jako błąd blokujący, jeśli nie.

## Success Criteria (Summary)

- Podgląd na prawdziwym pliku: 0 błędów, 12 przeliczonych kcal potwierdzonych przez autorkę.
- Lokalnie `inserted 71, skipped 5`, ponownie `inserted 0, skipped 76`; aplikacja pokazuje 76 przepisów z działającym dopasowaniem.
- Na produkcji, po `db push --dry-run` bez zaległych migracji, `inserted 76, skipped 0`.
