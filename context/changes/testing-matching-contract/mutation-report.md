# Raport mutacyjny — Faza 4 (Stryker, ad hoc)

> **Obejście błędu Vitest 5.** `@stryker-mutator/vitest-runner` 10.0.0 z Vitest 5.0.4 uruchamia 0 testów na mutanta (`testNamePattern` łączony spacją zamiast `" > "`): zgłoszenie [stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210), poprawka [stryker-js#6214](https://github.com/stryker-mutator/stryker-js/pull/6214). Dlatego `stryker.config.json` używa `testRunner: "command"` z `npx vitest run src/lib/matching src/pages/api/recipes` — dla każdego mutanta uruchamia tylko testy dopasowania i endpointu, nie całe `npm test`. Pakiet `@stryker-mutator/vitest-runner` został usunięty z devDependencies; można go przywrócić (i wrócić do `testRunner: "vitest"`) po wydaniu #6214.

Uruchomienie: `npx stryker run --mutate "src/lib/matching/rank.ts,src/lib/matching/keys.ts,src/lib/matching/limits.ts,src/pages/api/recipes/match.ts"`. Raport HTML: `reports/mutation/mutation.html` (gitignorowany).

## Wynik per plik

| Plik        | Baseline | Po fazie | Przetrwałe (baseline → po) |
| ----------- | -------: | -------: | -------------------------- |
| `keys.ts`   |   86,55% |   90,64% | 23 → 16                    |
| `limits.ts` |   77,78% |   83,33% | 4 → 3                      |
| `rank.ts`   |   80,40% |   84,92% | 39 → 30                    |
| `match.ts`  |   67,82% |   75,86% | 28 → 21                    |
| **Razem**   |   80,21% |   85,26% | 94 → 70                    |

Brak mutantów bez pokrycia. Liczba `timeout` zmienia się między uruchomieniami (7–20): przy command runnerze część zabijanych mutantów przekracza limit czasu; Stryker liczy je jako wykryte.

## Zabite nowymi testami (24)

| Lokalizacja                                 | Mutator                                          | Test                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keys.ts:21` (×3)                           | `\|\|`→`&&`, lewy/prawy warunek → `false`        | `keys.test.ts` „tolerates one edit only from 4 characters” (dopisane `abc`/`abcd` w obie strony; reguła 4 kontraktu: oba klucze ≥ 4 znaki)                     |
| `keys.ts:34` (×4)                           | `&&`→`\|\|`, człony transpozycji → `true`        | `keys.test.ts` „does not tolerate two edits: %s ≠ %s” (`it.each`; odległość D–L ≤ 1)                                                                           |
| `limits.ts:16`                              | `"staple"`→`""`                                  | `limits.test.ts` „counts every section, not only the ones passed first” (dopisane `staple`)                                                                    |
| `rank.ts:92` (`some`→`every` po tagach)     | MethodExpression                                 | `rank.test.ts` „a tag owns a product whatever the other tags on the list”                                                                                      |
| `rank.ts:92` (`every`→`some` po kluczach)   | MethodExpression                                 | `rank.test.ts` „words of different tags do not add up to own a product” (reguła 5: pokrycie per tag)                                                           |
| `rank.ts:115` (×3), `:117` (×3)             | usunięcie filtra pustych tagów                   | `rank.test.ts` „a tag with no product words (1,5%) changes nothing, owned or excluded” (decyzja autorki: tag pusty po normalizacji niczego nie zmienia)        |
| `rank.ts:122` (sygnatura cache → `` ` ` ``) | StringLiteral                                    | `rank.test.ts` „judges each compound product on its own: an excluded one hides the recipe after one that is allowed” (PRD: wykluczony składnik ukrywa przepis) |
| `match.ts:35`, `:36`                        | `staple === null` / `exclude === null` → `false` | `_match.test.ts` „rejects %s with 400 invalid_query”: wiersze „more than MAX_TAGS staple tags”, „an exclusion longer than MAX_TAG_LENGTH”                      |
| `match.ts:38`                               | `+`→`-`                                          | `_match.test.ts` „accepts %s”: wiersz „owned and staple tags without exclusions”                                                                               |
| `match.ts:52`, `:55` (×3)                   | catch `{}`, body `{}`/`""`, status `{}`          | `_match.test.ts` „answers a failed matchRecipes with 500 database_error” (kody z `first-pantry-match/plan.md:264-266`)                                         |

## Świadomie zignorowane (55)

**`keys.ts` (16)**

- `:28` (×4) — usunięcie wczesnego `return` dla różnicy długości > 1: porównanie końcówek i tak daje `false`, mutant równoważny.
- `:30` (×6) — granice pętli wspólnego prefiksu: wyjście poza długość daje `undefined !== znak`, a równe napisy odpada wcześniej (`a === b`); równoważny.
- `:37` — `>`→`>=`: przy `lengthDiff === 0` funkcja wróciła już wyżej; równoważny.
- `:59` (×2) — warunek `words.length > 0` chroni przed pustym wpisem słownika, którego słownik nie ma; martwa gałąź obronna.
- `:84` — `.at(-1)`→`.at(+1)`: odczyty mają długość 1 lub 2, a fallback `wordKey` daje ten sam klucz; równoważny.
- `:98` (×2) — dla słowa jednoznacznego `indexOf` = −1, a `mask & (1 << -1)` = 0 przy realnych maskach; równoważny.

**`limits.ts` (3)**

- `:18` (`URL_PREFIX` → `""`), `:24` (brak sekcji jako jeden sztuczny tag), `:26` (`>`→`>=`) — przesunięcie budżetu URL o kilkadziesiąt znaków przy limicie 8000 i twardej granicy Cloudflare 16 KB; bez szkody, a zabicie wymagałoby przypięcia długości prefiksu.

**`rank.ts` (30)**

- `:39`, `:49`, `:52` — indeksowanie kluczy tagów (sztuczny klucz, brak deduplikacji): ten sam wynik, inna struktura wewnętrzna; równoważne.
- `:62`, `:63`, `:67`, `:127`, `:129` (×5) — cache trafień i werdyktów: wyłączenie zmienia tylko koszt CPU; czasu nie asertujemy (Decisions 4, R3).
- `:84`, `:91` (×4) — skróty `return false` przed pętlą; dalsza logika (`every`/`some` na pustych listach, puste tagi odfiltrowane w `:115`/`:117`) daje ten sam wynik.
- `:92` (`list.some`→`list.every`) — różni się tylko, gdy dwa różne klucze tagów z różnych tagów są o jedną literówkę od tego samego klucza produktu, a posiadanie idzie przez zawieranie; przypadek sztuczny.
- `:103` — `{excluded:false, owned:false}`→`{}`: `undefined` jest fałszywe; równoważny.
- `:122` (`"\n"`→`""` ×2), `:123`, `:125` — kolizja sygnatury cache tylko dla sklejonych kluczy typu `["ab","c"]`/`["a","bc"]`; `:123` równoważny (`join` jednego klucza = klucz).
- `:161` (×2) — `owned === 0` oznacza `firstAllowed === 0`, więc `mainExcluded` jest fałszywe; równoważne.
- `:171` — `total === 0` dla przepisu bez składników: walidacja wymaga ≥ 1 składnika (`validate.ts:185`); martwa gałąź obronna.
- `:180` (×2) — bez posiadanych `available` = 0 dla wszystkich, więc porównanie ułamków zwraca 0; równoważne.
- `:188` (×6) — tie-break po `id` przy identycznej nazwie: plan wyklucza nowe asercje kolejności remisów („What We're NOT Doing”), a `id` to techniczny tie-break, nie reguła z PRD.

**`match.ts` (6)**

- `:45`, `:46` (×5 razem z `:45:18`) — gałąź `503 not_configured` przy braku konfiguracji Supabase: ścieżka operatora, użytkownik i tak widzi błąd, a klient nie rozróżnia kodów błędów.
- `:54` — tekst logu `console.error`; kosmetyczny.

## Znana luka poza zakresem (15)

- **`limit`/`offset` endpointu:** `match.ts:23`, `:24` (nazwa parametru → `""`), `:30` (×7), `:31` (×2), `:32` (×2), `:33`, `:50` (`{limit, offset}` → `{}`). Mutanty są szkodliwe (psują doładowanie listy), a wyrocznia istnieje (`first-pantry-match/plan.md:264-266`: domyślnie 10, maks. 50), ale plan wyklucza testy `limit`/`offset` („What We're NOT Doing”). Decyzja autorki: realna luka, poza zakresem tej zmiany — w Fazie 5 trafia do `test-plan.md` jako nowe ryzyko.
