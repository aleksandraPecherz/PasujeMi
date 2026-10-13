# External research: first-pantry-match (S-03)

Data: 2026-10-12. Źródła: Exa (wyszukiwanie w sieci), Context7, lokalny test stemmera w scratchpadzie (bez zmian w repo).

## Problem

Tag wpisany przez użytkownika (posiadane / stałe / wykluczenia) ma trafić w `product` składnika przepisu i jego zamienników (`docs/reference/recipe-data-contract.md`) mimo:

- odmiany i liczby mnogiej (`pomidor` = `pomidory`, `jajko` = `jajek`),
- wielkości liter i braku polskich znaków (`Sól` = `sol`),
- literówek (`mozarella` = `mozzarella`),
- synonimów (`ziemniak` = `kartofel`),
- hierarchii wykluczeń: ogólne obejmuje szczegółowe (`orzechy` ukrywa `orzechy włoskie`), a szczegółowe nie obejmuje ogólnego (PRD, Business Logic).

Ograniczenia: Supabase Postgres **17** (`supabase/config.toml: major_version = 17`), TypeScript na Cloudflare Workers, do ok. 1000 przepisów, wynik w < 1 s.

## Kandydaci

### A. Postgres: `pg_trgm` + `unaccent` (+ tabela synonimów)

Dopasowanie w SQL: znormalizowana kolumna `lower(immutable_unaccent(product))` z indeksem GIN `gin_trgm_ops` i operator podobieństwa `%` / `word_similarity`.

| Plusy                                                                         | Minusy                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oba rozszerzenia są dostępne na Supabase (Database → Extensions)              | **Brak polskiego stemmera w PG 17.** `polish_stem` dochodzi dopiero w PostgreSQL 19 (release notes: „Add full text stemmers for Polish and Esperanto”); Supabase jest na 17                                                                                     |
| Wielkość liter i znaki diakrytyczne obsługuje bez kodu (`lower` + `unaccent`) | **Słownika hunspell/ispell `pl_pl` nie da się dodać**: wymaga wgrania plików do `$SHAREDIR/tsearch_data`, a na Supabase to niemożliwe (otwarte zgłoszenie supabase/postgres#555 z 2023 r.)                                                                      |
| Indeks trigramowy — szybkie przy dużych tabelach                              | Trigramy słabo łapią odmianę krótkich słów. Emulacja `similarity()` (próg domyślny 0.3): `sól/soli` **0.13**, `jajko/jajek` 0.33, `ser/sery` 0.50, `orzechy/orzech włoski` 0.38. Niższy próg zwiększa liczbę fałszywych trafień, które przy alergiach są groźne |
| Brak nowej zależności w aplikacji                                             | Hierarchia wykluczeń (`orzechy` ⊂ `orzechy włoskie`) wymaga i tak tokenizacji i odmiany, czego SQL tu nie daje; `unaccent()` jest `STABLE`, więc do indeksu trzeba go opakować w funkcję `IMMUTABLE`                                                            |

### B. TypeScript: polski stemmer Snowball + odległość edycyjna + słownik synonimów (w Workerze)

Normalizacja tekstu w TS: małe litery i NFC → tokeny → `stemWord` (algorytm Snowball dla polskiego) → zamiana synonimów na formę kanoniczną → usunięcie diakrytyków z rdzenia. Porównanie rdzeni tokenów: równe albo w odległości Damerau–Levenshteina ≤ 1 (dla dłuższych rdzeni). Wykluczenie trafia, gdy wszystkie tokeny wykluczenia występują wśród tokenów składnika.

| Plusy                                                                                                                                                                                     | Minusy                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Polski stemmer Snowball jest oficjalny (autor Dmitry Shachnev, w Snowball od X 2025, wersja 3.1) i jest tym samym algorytmem, który trafi do PG 19 — wybór zgodny z kierunkiem ekosystemu | Pakiet npm `snowball-stemmers-js` jest młody (opublikowany 2026-08-13, jeden opiekun, mało pobrań). Ryzyko ogranicza to, że kod jest generowany kompilatorem Snowball (BSD-3), więc można go przypiąć do wersji albo skopiować do repo (`polish-stemmer.js` 8 KB + `base-stemmer.js` 16 KB) |
| Czysty JS, zero zależności, mały rozmiar — mieści się w Workerze                                                                                                                          | `index.js` pakietu używa `fs.readdirSync`, więc **nie zadziała w Workerze**; trzeba importować bezpośrednio `lib/polish-stemmer.js` (ESM, `export default class`)                                                                                                                           |
| Lokalny test na składnikach (niżej): odmiana i liczba mnoga dają ten sam rdzeń dla większości testowanych słów, a resztę (`jajek`, `soli`, `czosnku`) łapie odległość 1                   | Stemmer heurystyczny: obce pozostają tylko „prawie równe” rdzenie (`jajek`/`jajk`, `sól`/`sol`, `czosnek`/`czosnk`) — odległość edycyjna jest konieczna, nie opcjonalna. Zdrobnień (`pomidorki`) i synonimów stemmer nie obsłuży                                                            |
| Hierarchia wykluczeń to prosty test zawierania tokenów po stemmingu; łatwo ją przetestować jednostkowo                                                                                    | Słownik synonimów trzeba utrzymywać ręcznie (na start kilkanaście par z bazy autorki)                                                                                                                                                                                                       |
| 1000 przepisów × kilka składników to kilka tysięcy porównań krótkich stringów — ułamki milisekund; budżet < 1 s zjada głównie pobranie danych z Supabase                                  | Dane trzeba porównywać po stronie Workera (pobranie przepisów lub wcześniej policzonych kluczy) — to decyzja dla `/10x-plan`                                                                                                                                                                |

### C. Lematyzator słownikowy (hunspell `pl_PL` / Morfologik)

Pełna lematyzacja (`robił` → `robić`): hunspell przez `ispell` w Postgresie albo słownik w JS (np. nspell, Morfologik).

| Plusy                                                                     | Minusy                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Najwyższa trafność dla słów ze słownika (prawdziwy lemat zamiast rdzenia) | Nieosiągalne w bazie: Supabase nie pozwala wgrać plików słownika (supabase/postgres#555)                                                                                 |
| Słownik LibreOffice `pl_PL` jest darmowy                                  | W JS słownik `pl_PL.dic`/`.aff` waży kilka MB (ISO-8859-2, trzeba go konwertować) — koliduje z limitem rozmiaru Workera i czasem zimnego startu; Morfologik jest w Javie |
|                                                                           | Słowa spoza słownika (nazwy handlowe, `mozzarella`) nie dają lematu — i tak potrzebny fallback                                                                           |
|                                                                           | Literówek i synonimów samo nie rozwiąże                                                                                                                                  |

## Test stemmera na składnikach

`snowball-stemmers-js@3.1.2`, `newStemmer("polish").stemWord(...)`, uruchomione lokalnie w Node:

```
pomidor/pomidory/pomidorów -> pomidor      jajko/jajka -> jajk, jajek -> jajek (odl. 1)
orzech/orzechy/orzechów    -> orzech       włoskie/włoskich -> włosk
mleko/mleka                -> mlek         kokosowe/kokosowego -> kokosow
ziemniak/ziemniaki         -> ziemniak     ser/sery/sera -> ser
cebula/cebuli              -> cebul        papryka/papryki -> papryk
mąka/mąki                  -> mąk          śmietana/śmietany -> śmietan
sól -> sól, soli -> sol (odl. 1)           czosnek -> czosnek, czosnku -> czosnk (odl. 1)
mozzarella -> mozzarell, mozarella -> mozarell (odl. 1)
kartofel -> kartofel, kartofle -> kartofl (odl. 1; synonim ziemniaka — słownik)
pomidorki -> pomidork (zdrobnienie — nie łączy się z pomidor)
```

Wniosek: dla `orzechy` → `[orzech]` i `orzechy włoskie` → `[orzech, włosk]` test zawierania tokenów daje dokładnie regułę z PRD (ogólne ukrywa szczegółowe, odwrotnie nie).

## Decyzja

**Wybieramy B — normalizację w TypeScripcie opartą na polskim stemmerze Snowball (`snowball-stemmers-js`, import samego `lib/polish-stemmer.js` albo skopiowany wygenerowany plik) z odległością edycyjną ≤ 1 i ręcznym słownikiem synonimów, bo to jedyna opcja, która na Supabase PG 17 i Cloudflare Workers obsługuje polską odmianę oraz hierarchię wykluczeń, a przy ≤ 1000 przepisów mieści się w budżecie < 1 s bez zmian w infrastrukturze.**

`pg_trgm` + `unaccent` (A) zostaje jako możliwa późniejsza optymalizacja (np. wstępne zawężenie kandydatów w SQL), a natywny `polish_stem` stanie się alternatywą, gdy Supabase przejdzie na PostgreSQL 19.

## Dokumentacja zwycięzcy

**Context7:** biblioteki nie ma w indeksie. Trzy próby `resolve-library-id` („Snowball stemmer”, „snowballstem snowball”, „snowballstem”) zwróciły tylko dartowy pakiet `stemmer` (`/japborst/dart_stemmer`), który nie ma polskiego algorytmu i nie dotyczy tego stacku. Poniższe fragmenty pochodzą więc z oficjalnych źródeł pobranych przez Exę.

README pakietu (npm, wersja 3.1.2):

```js
const { newStemmer, stem } = require("snowball-stemmers-js");

newStemmer("english").stemWord("installing"); // "instal"
stem("de", "Häusern"); // "Haus"
```

> Languages accept the snowball algorithm name (`"german"`) or the common ISO-639-1 code (`"de"`). […] The algorithms are the canonical Snowball stemmers (BSD-3-Clause), generated by the snowball compiler at build time — not a hand-maintained port.

Uwaga z lokalnej inspekcji pakietu: `index.js` to CommonJS z `fs.readdirSync(path.join(__dirname, "lib"))`, natomiast `lib/polish-stemmer.js` to ESM (`import B from './base-stemmer.js'` / `export default class extends B`) z metodami `stemWord(word)` i `stemWords(words)`. W Workerze importujemy więc bezpośrednio klasę z `lib/`.

Opis algorytmu (snowballstem.org, „Polish stemming algorithm”):

> Like most of the other Slavic languages, Polish is a heavily inflected and conjugated language […]. Because of that, this stemmer focuses on removing i-suffixes and leaves d-suffixes untouched. Polish also has an inflectional prefix, naj-, that forms superlative forms of adjectives. Removing it is currently not implemented.
>
> Step 3. Normalize ending consonant — Remove the kreska mark from the letters ć, ń, ś and ź, i.e. replace them with c, n, s and z. This is done because in oblique cases, when an inflectional suffix is added to the word, the kreska mark is not written (e.g. nominative miłość but genitive miłości).

Fragment reguł dla rzeczowników (`polish.sbl`):

```
// Noun forms (excluding endings that were already handled above).
'a' R1  'o' R1                            // singular nominative (książka, lato)
'i' R1  'u' R1  'ia' R1                   // singular genitive (książki, stołu, słonia)
'{o'}w' R1                                // plural genitive (stołów)
'ami' R1  'iami' R1                       // plural instrumental (książkami, słoniami)
'ach' R1  'iach' R1                       // plural locative (książkach, słoniach)
  (delete)
```

## Otwarte pytania dla `/10x-plan`

- Gdzie liczyć klucze składników: przy każdym żądaniu w Workerze czy raz, przy zapisie przepisu (kolumna z kluczami w `recipes`)?
- Czy posiadane `mleko` ma pokrywać składnik `mleko 1,5%` tak samo jak wykluczenie (zawieranie tokenów), czy tylko przy pełnej zgodności?
- Próg odległości edycyjnej dla krótkich rdzeni (`ser`, `sól`), żeby nie łączyć różnych produktów.
- Gdzie trzymać słownik synonimów (plik TS w repo czy tabela) i kto go uzupełnia.

## Źródła

- PostgreSQL 19 release notes — https://www.postgresql.org/docs/19/release-19.html
- Commit „Update to latest Snowball sources” (polish_stem) — https://github.com/postgres/postgres/commit/7dc95cc3b94f2f558606e5ec307466a4e3dbc832
- supabase/postgres#555 „Include ispell dictionary configuration files” — https://github.com/supabase/postgres/issues/555
- depesz, „Polish configuration for TSearch” (hunspell `pl_pl` wymaga plików w `tsearch_data`) — https://www.depesz.com/2026/04/21/polish-configuration-for-tsearch/
- Fuzzy search with pg_trgm and Supabase (unaccent IMMUTABLE wrapper, GIN vs GiST) — https://dev.to/thiagolongom/fuzzy-search-in-postgres-with-pgtrgm-and-supabase-multilingual-typo-tolerant-2ipf
- PostgreSQL docs: unaccent — https://www.postgresql.org/docs/17/unaccent.html
- Snowball: Polish stemming algorithm — https://snowballstem.org/algorithms/polish/stemmer.html
- snowball-stemmers-js (npm) — https://www.npmjs.com/package/snowball-stemmers-js
