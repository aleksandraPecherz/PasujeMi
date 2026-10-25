---
title: "PasujeMi — Anti-Corruption Layer: ocena potrzeby izolacji zależności"
created: 2026-10-24
type: refactor-plan
---

# Anti-Corruption Layer: ocena potrzeby izolacji

**Decyzja: nie rekomenduję dodawania nowej ACL.** Obecna izolacja Supabase, formatu Excela i stemmera jest wystarczająca w zbadanym zakresie. Uzasadnienie w §5, warunki ponownego rozważenia w §7.

## 1. Zakres i metoda

- **HEAD:** `9500dbd355c6dbbe90b157b63fcfa09675c9215b` (`master`); w working tree tylko nieśledzone pliki `context/domain/`.
- **Pytanie:** czy pojęcia zewnętrznej zależności lub formatu danych przenikają do logiki produktu (dopasowanie spiżarki, przepis, spiżarka) w sposób, który generuje koszt, i czy nowa warstwa tłumacząca ten koszt usunie.
- **Kandydaci:** (1) Supabase / PostgREST, (2) format źródła `data/recipes.xlsx`, (3) stemmer Snowball.
- **Metoda:** odczyt kodu (K) i dokumentacji. Testów, skryptów ani buildów nie uruchamiano w tej sesji. Jedyny wynik uruchomienia (U) pochodzi spoza sesji i jest oznaczony jako zewnętrzny (§4.3).
- **Zasady oceny:** import pakietu w wielu plikach nie jest dowodem przecieku; standardowe użycie frameworka lub klienta bazy za warstwą serwisów nie uzasadnia ACL; przy formacie danych biblioteka (`exceljs`) jest oddzielona od konwencji źródła (zapis w arkuszu autorki).
- **Poza zakresem:** zależności UI (React, shadcn, Radix), runtime Cloudflare, szczegóły Supabase Auth.

## 2. Porównanie kandydatów

|                                  | **Supabase / PostgREST**                                                                                                                                                                                       | **Format `data/recipes.xlsx`**                                                                                    | **Stemmer Snowball**                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Rodzaj                           | klient bazy i auth                                                                                                                                                                                             | biblioteka + konwencje źródła                                                                                     | algorytm (kod skopiowany do repo)                                                                       |
| Kod produkcyjny                  | serwisy: `src/lib/services/recipes.ts:1`, `pantry.ts:1`, `admins.ts:1`; klient: `src/lib/supabase.ts:1`; auth: `src/middleware.ts:1`, `:18`, `src/pages/api/auth/signin.ts:15`, `signup.ts:15`, `signout.ts:7` | brak (w `src/` nie znaleziono `xlsx`, `import-recipes`, `zamiennik:` poza etykietami UI)                          | `src/lib/matching/normalize.ts:2`, `:11-18` (jedyne wywołanie `stemWord`)                               |
| Skrypty / import                 | `scripts/import-recipes.ts:18`, `scripts/match-keys.ts:5`                                                                                                                                                      | biblioteka: `scripts/import-recipes.ts:19`; konwencje: `scripts/import-recipes/parse.ts`, `brands.ts`, `sheet.ts` | pośrednio: klucze zapisywane przez `scripts/import-recipes/sheet.ts:59-60` i `scripts/match-keys.ts:47` |
| Testy                            | atrapa łańcucha zapytań, np. asercja treści filtra `src/lib/services/recipes.test.ts:474-476`                                                                                                                  | `scripts/import-recipes/parse.test.ts`, `sheet.test.ts`                                                           | fingerprint kluczy `src/lib/matching/keys.test.ts:161-178`; tabele w `rank.test.ts`                     |
| Obce pojęcia                     | wiersze snake_case, `numeric` jako tekst, `PostgrestError`, kody `PGRST…`, `max_rows`, kody błędów auth                                                                                                        | nagłówki, `[zamienniki: …]`, zapisy ilości, kcal „na całość”, marki w nazwach                                     | rdzeń słowa (stem)                                                                                      |
| Istniejące mapowanie             | tak (§3.1)                                                                                                                                                                                                     | tak (§3.2)                                                                                                        | tak, techniczne (§3.3)                                                                                  |
| Wykazany koszt w logice produktu | brak dowodu                                                                                                                                                                                                    | brak dowodu poza adapterem                                                                                        | tak, ale niezwiązany z brakiem ACL (§4)                                                                 |
| Ocena                            | izolacja wystarczająca                                                                                                                                                                                         | izolacja wystarczająca                                                                                            | izolacja wystarczająca; koszt dotyczy reguł normalizacji i słownika                                     |

## 3. Istniejące mapowania i granice

### 3.1 Supabase / PostgREST

- Wiersz bazy → typ domeny: `RecipeRow` i `toRecipe` z konwersją `numeric` z tekstu (`src/lib/services/recipes.ts:18-55`).
- Ograniczenie PostgREST (`max_rows`) obsłużone stronicowaniem w serwisie (`recipes.ts:188-219`); kod `PGRST103` obsłużony w serwisie (`recipes.ts:71`).
- Błędy bazy nie wychodzą do klienta: endpoint loguje i zwraca `database_error` (`src/pages/api/recipes/match.ts:52-55`).
- Kody błędów auth przechodzą przez whitelistę polskich komunikatów z wartością domyślną (`src/lib/auth-errors.ts:1`, `:16-18`).
- Moduł dopasowania nie zależy od Supabase (`src/lib/matching/index.ts:1`).

**Granica:** warstwa serwisów (`src/lib/services/`). Typy domeny (`src/types.ts`) nie zawierają typów Supabase.

### 3.2 Format `data/recipes.xlsx`

- Nagłówki i komórki: `scripts/import-recipes/sheet.ts:7`, `:22`, `:36`.
- Konwencje źródła: ilości (`parse.ts:80`), zamienniki (`:148`), podział składników (`:169`), kcal na porcję (`:248`), marki (`brands.ts:4`, `:22-24`).
- Wynik przechodzi przez ten sam walidator co API: `parseRecipeInput` (`src/lib/recipes/validate.ts:176`, wywołanie `parse.ts:309`) → `NewRecipe`.
- Reguły konwersji i pułapki danych opisane w `docs/reference/recipe-data-contract.md:103-136`.

**Granica:** katalog `scripts/import-recipes/` działa już jako warstwa tłumacząca źródło na model domeny. Proces jest ręczny i okazjonalny (`scripts/import-recipes.ts:1-17`).

### 3.3 Stemmer Snowball

- Interfejs techniczny: `stem(word): string` z cache (`normalize.ts:7-18`). Jedyny konsument: `dictionary.ts:3`.
- Słownik pisany zwykłymi słowami, rdzeniowany przy ładowaniu (`dictionary.ts:1`, `:26`, `:34`, `:62-65`) — autor nie wpisuje rdzeni ręcznie.
- Wymiana stemmera wymaga zmiany jednego miejsca w kodzie (`normalize.ts:2`, `:14`).

**Granica techniczna** kończy się na `stem()`. Od `wordKey` zaczynają się reguły produktu (§4.1).

## 4. Diagnoza stemmera

### 4.1 Gdzie kończy się interfejs, a zaczynają reguły produktu

| Warstwa                                                              | Gdzie                                                           | Charakter                                                             |
| -------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Rdzeniowanie słowa                                                   | `normalize.ts:11-18`                                            | technika (algorytm zewnętrzny)                                        |
| Kompozycja klucza: rdzeń → synonim → usunięcie znaków diakrytycznych | `dictionary.ts:28-39`                                           | reguła produktu („ten sam składnik”, `prd.md:120`)                    |
| Wyjątki (mąka ≠ mak) i dwa odczytania słowa dwuznacznego             | `dictionary.ts:21-24`, `:41-52`; `keys.ts:40-50`, `:87-103`     | reguła produktu kompensująca artefakt rdzeń + diakrytyki              |
| Synonimy i zdrobnienia, osobne produkty z rodzicem                   | `dictionary.ts:5-19`                                            | reguła produktu (dane autorki)                                        |
| Równość kluczy z tolerancją literówek                                | `keys.ts:15-23`                                                 | reguła produktu wyrażona na kluczach (długość ≥ 4 liczona na rdzeniu) |
| Wykluczenie i posiadanie                                             | `rank.ts:101-109`                                               | reguła produktu                                                       |
| Wersja kluczy i przechowywanie                                       | `keys.ts:6-10`, `20261013120000_add_recipe_match_keys.sql:6-13` | technika utrwalająca wynik normalizacji                               |

Obce pojęcie „rdzeń” przekracza `stem()` w dwóch miejscach: jest zapisywane w bazie jako część `match_keys` (`src/types.ts:36-44`) oraz wyznacza, które formy trzeba wpisać do słownika („List each inflected form whose stem differs”, `dictionary.ts:5`).

### 4.2 Co usunęłaby dodatkowa ACL, a czego nie

**Usunęłaby:** praktycznie nic ponad to, co już daje `stem()`. Stemmer ma jedno wywołanie, słownik jest pisany zwykłymi słowami, a moduł dopasowania jest czysty. Nie znaleziono drugiego konsumenta stemmera ani obcych typów do tłumaczenia (stemmer zwraca `string`).

**Nie usunęłaby:**

- **Wersjonowania i przeliczania danych.** Każda zmiana normalizacji, stemmera lub słownika zmienia klucze i wymaga podbicia `MATCH_KEYS_VERSION` oraz przeliczenia kluczy w bazie (`keys.ts:6-9`; `scripts/match-keys.ts:30-48`; ryzyka opisane w `02-invariant-aggregate-refactor.md`). To konsekwencja utrwalania wyniku normalizacji, niezależna od tego, czy algorytm stoi za dodatkową warstwą.
- **Zależności treści słownika od zachowania algorytmu.** Które formy trzeba wpisać jako synonimy, wynika z tego, co algorytm scala, a czego nie (`dictionary.ts:5`).
- **Reguł zdefiniowanych na kluczach** (próg literówek, wyjątki), bo są to decyzje produktu o znormalizowanej formie, nie tłumaczenie obcego modelu.
- **Luk zakresu „tego samego składnika”** (R1, `context/foundation/test-plan.md:154`; D-04, D-10 w `01-domain-distillation.md`).

### 4.3 Pary orzechowe: koszt stemmera czy słownika

**Wynik uruchomienia zewnętrznego (spoza tej sesji, HEAD `9500dbd`):** wykluczenie „orzechy” nie ukrywa „masło orzechowe”, a wykluczenie „orzech” nie ukrywa „orzeszki ziemne”.

**Ocena:**

- Wykluczenie trafia opcję tylko przy równości kluczy (`keys.ts:19-23`, `rank.ts:82-86`, `rank.ts:104-105`). Wynik zewnętrzny oznacza, że normalizacja nie zrównała tych form — samych rdzeni w tej sesji nie odczytano.
- Stemmer Snowball sprowadza formy fleksyjne; relacje słowotwórcze (przymiotnik od rzeczownika, zdrobnienie) nie są jego zadaniem w tym projekcie. Repo przypisuje je słownikowi: `SYNONYMS` obejmuje „synonyms and diminutives” (`dictionary.ts:5-12`, np. `pomidorek → pomidor`), a `SEPARATE_PRODUCTS` relacje ogólny→szczegółowy (`dictionary.ts:14-19`). Zdrobnienia poza słownikiem i pełna lematyzacja zostały świadomie wyłączone (`context/archive/2026-10-12-first-pantry-match/plan.md:93`).
- **Wniosek:** to przede wszystkim **luka słownika i nierozstrzygnięta decyzja produktowa** (D-10: czy wykluczenie ogólne obejmuje produkty pochodne), a nie defekt stemmera. Stemmer tylko określa, gdzie słownik musi uzupełnić relacje. Mechanizmy do wyrażenia takich relacji już istnieją w słowniku; ich użycie zależy od decyzji właścicielki. Dodatkowa ACL wokół stemmera nie zmieniłaby tego wyniku.
- Wynik nie przesądza o innych parach; dotyczy dwóch zbadanych przypadków.

## 5. Ocena kosztu sprzężenia i decyzja

| Kandydat             | Koszt sprzężenia                                                                                                                                                    | Czy ACL by go usunęła                                                                    | Decyzja                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| Supabase / PostgREST | W logice produktu nie wykazano. W testach serwisu: atrapa odwzorowuje łańcuch zapytań (`recipes.test.ts:474-476`) — koszt utrzymania testów, nie przeciek do domeny | Nie dotyczy (mapowanie już istnieje w serwisach)                                         | pozostawić obecną izolację |
| Format Excela        | Istnieje (lista marek, heurystyka kcal, pułapki danych), ale zamknięty w `scripts/import-recipes/`                                                                  | Nie — adapter importu już pełni tę rolę                                                  | pozostawić obecną izolację |
| Stemmer              | Istnieje: utrwalone rdzenie, wersjonowanie, dobór wpisów słownika, luki zakresu                                                                                     | Nie — koszt wynika z utrwalania normalizacji i z decyzji o zakresie słownika (§4.2–§4.3) | pozostawić obecną izolację |

**Decyzja: brak nowej ACL.** Nie rekomenduję portu, value object ani adaptera. Koszty, które realnie występują, należą do innych obszarów:

- spójność utrwalonych kluczy → `02-invariant-aggregate-refactor.md` (N-9);
- zakres „tego samego składnika” i produkty pochodne → decyzje D-04, D-10 w `01-domain-distillation.md`.

## 6. Ograniczenia

- Analiza statyczna w tej sesji; jedyny wynik uruchomienia (pary orzechowe) jest zewnętrzny i nie ujawnia samych rdzeni.
- Nie badano rdzeni innych słów ani zachowania stemmera dla całego słownictwa przepisów.
- `data/recipes.xlsx` jest tylko u autorki; konwencje znane z kontraktu danych i parsera.
- Supabase Auth oceniony powierzchownie (poza zakresem domeny dopasowania).
- Brak znalezionego przecieku nie dowodzi jego braku poza zbadanym zakresem (§1).

## 7. Warunki ponownego rozważenia (sprawdzalne)

| Kandydat      | Rozważyć ACL lub inne odizolowanie, gdy…                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase      | typy `@supabase/*` lub kształt wierszy (snake_case, `numeric` jako tekst) pojawią się w `src/types.ts`, `src/lib/matching/` albo w odpowiedziach API; logika produktu zacznie rozgałęziać się po kodach `PGRST…`/Postgres poza serwisami; zapadnie decyzja o zmianie dostawcy bazy                                                                                                                                                                                                |
| Format źródła | import stanie się procesem stałym lub dostępnym dla użytkowników; pojawi się drugie źródło przepisów (np. FR-008, zdjęcie przepisu — `prd.md:102`); konwencje arkusza (marki, `[zamienniki: …]`, kcal „na całość”) pojawią się w `src/`                                                                                                                                                                                                                                           |
| Stemmer       | normalizacja będzie potrzebna drugiemu konsumentowi o innych wymaganiach (np. rozszerzenie kontroli konfliktu list W-01 poza nazwę 1:1, dopasowanie w bazie — `plan.md:91`); zapadnie decyzja o wymianie stemmera na lematyzację lub inny algorytm (`plan.md:93`); wyniki stemmera będą różne między środowiskami uruchomieniowymi; utrzymanie słownika (liczba wpisów na formę, `it.todo` R1) zostanie uznane przez właścicielkę za koszt wymagający zmiany sposobu normalizacji |
