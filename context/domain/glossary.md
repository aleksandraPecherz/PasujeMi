# Słownik domeny PasujeMi — dopasowanie spiżarki

Krótki słownik dla agentów. Dowody, rozjazdy i otwarte decyzje: `context/domain/01-domain-distillation.md`. Źródła intencji: `context/foundation/prd.md` oraz decyzje właścicielki z 2026-10-24 (§0 raportu).

Dopasowanie porównuje nazwy produktów. Nie jest analizą alergenów.

## 1. Obowiązująca intencja

- **Spiżarka** — trzy listy tagów jednego użytkownika: posiadane, stałe, wykluczenia.
- **Produkt posiadany** — produkt dostępny do gotowania; wpisywany w każdej sesji, nie jest zapamiętywany.
- **Produkt stały** — produkt dostępny do gotowania, zapamiętany; w dopasowaniu liczy się dokładnie jak posiadany.
- **Wykluczenie** — zapamiętany produkt, którego użytkownik nie może lub nie chce jeść.
- **Zapisana spiżarka** — tylko stałe i wykluczenia; prywatna, czyta i zmienia ją wyłącznie właściciel.
- **Przepis** — pozycja wspólnej bazy.
- **Składnik** — pozycja przepisu: opcja główna plus zamienniki.
- **Zamiennik** — jawnie zapisana w przepisie alternatywa składnika.
- **Opcja składnika** — produkt główny albo jeden z zamienników.
- **Opcja dozwolona** — opcja niewykluczona. Nie musi być posiadana.
- **Składnik zablokowany** — wszystkie opcje składnika są wykluczone. Przepis z choć jednym zablokowanym składnikiem znika z listy, niezależnie od dopasowania pozostałych składników.
- **Wykluczenie ogólne / szczegółowe** — ogólne obejmuje odmiany szczegółowe („mleko” ukrywa „mleko kokosowe”); szczegółowe dotyczy tylko siebie.
- **Składnik dostępny („mam”)** — któraś niewykluczona opcja jest posiadana lub stała. Wykluczona opcja nigdy nie daje „mam” i nie podnosi procentu, nawet gdy jest na liście posiadanych lub stałych.
- **Brak informacji** — składnik bez niewykluczonej opcji posiadanej lub stałej.
- **Procent dopasowania** — dostępne pozycje / wszystkie pozycje przepisu. Bez posiadanych i stałych procentu nie ma. Przepisy z 0% zostają na liście.
- **Ten sam składnik** — odmiany fleksyjne, liczba mnoga, wielkość liter, literówki i synonimy (zakres konkretnych par — patrz §4).

## 2. Obecny kod

- Listy: `PantryLists` z sekcjami `have` / `staple` / `exclude`; w bazie `saved_pantry.staples` / `saved_pantry.exclusions`; zapisywane: `SavedPantry` (bez `have`).
- Przepis i składnik: `Recipe`, `RecipeIngredient`, `IngredientOption`, `substitutes`. Pole `product` to ogólna nazwa do dopasowania, `name` to tekst jak w przepisie. Import usuwa znane marki z `product`; formularz przyjmuje `product` od użytkownika albo, gdy pole jest puste, nazwę małymi literami.
- Reguła: `src/lib/matching/` (tokeny → stem Snowball → słownik → bez znaków diakrytycznych → `keysEqual`), ocena w `rankRecipes`.
- Wynik: `IngredientMatch.status` `"have"` = mam, `"unknown"` = brak informacji; `RecipeMatch.percent` (`null` bez posiadanych i stałych). Składnik zablokowany to warunek w `rankRecipes`, bez osobnego typu.
- Pojęcia techniczne spoza PRD:
  - **klucz dopasowania** (`TagKeys`, `MatchOptionKeys.k`, `MatchKeys`) — znormalizowana forma tagu lub `product`;
  - **klucze rodzica** (`MatchOptionKeys.p`) — liczą się tylko dla wykluczeń;
  - **osobny produkt** (`SEPARATE_PRODUCTS`) — fraza słownika z rodzicem;
  - **wyjątek** (`EXCEPTIONS`) — mąka ≠ mak;
  - **wersja kluczy** (`MATCH_KEYS_VERSION`) — podbijana przy każdej zmianie normalizacji lub słownika; `match_keys` w bazie zapisuje tylko `npm run match-keys`.
- Dodawanie tagu odrzuca duplikat tylko w tej samej sekcji; kontroli między sekcjami dziś nie ma.

## 3. Wymagania przyszłe

- **Konflikt list** — próba dodania tego samego produktu do posiadanych i wykluczeń albo do stałych i wykluczeń (w obu kierunkach) wymaga komunikatu i rozstrzygnięcia przez użytkownika. Produktu nie usuwa się ani nie przenosi automatycznie. Pierwszy zakres: nazwa 1:1, bez synonimów, literówek i relacji ogólny–szczegółowy. Szczegóły porównania (wielkość liter, białe znaki) nie są rozstrzygnięte.

## 4. Uwagi dla agentów

- „Odmiana” bywa dwuznaczna: fleksja (równość kluczy) ≠ odmiana szczegółowa produktu (relacja tylko dla wykluczeń). Produkty pochodne („masło orzechowe”, „orzeszki ziemne”) nie mają ustalonej reguły.
- „Ten sam produkt” ma dwa zakresy: szeroki w dopasowaniu, 1:1 w przyszłej kontroli konfliktu list. To zamierzone.
- Nazwy list: PRD posiadane/stałe/wykluczenia = TS `have`/`staple`/`exclude` = SQL `staples`/`exclusions`.
- Nie traktuj jako reguł (otwarte decyzje, raport §9): czy tag ogólny pokrywa produkt szczegółowy przy posiadaniu; które konkretne pary są tym samym produktem (np. „mleko” / „napój sojowy”, „ser” / „serek”); czy wykluczenie ogólne obejmuje produkty pochodne; czy formularz ma usuwać marki z `product`; szczegóły porównania 1:1.
