---
date: 2026-10-20T22:04:21+02:00
researcher: Aleksandra Pęcherz (z Claude Code)
git_commit: 80b43a8
branch: master
repository: 10xdevs (PasujeMi)
topic: "Etap 1 test-planu — kontrakt dopasowania: ryzyka #1, #4, #5"
tags: [research, testing, matching, exclusions, ranking, limits]
status: complete
last_updated: 2026-10-20
last_updated_by: Aleksandra Pęcherz (z Claude Code)
last_updated_note: "Dodano Decisions (odpowiedzi autorki na 4 Open Questions) i listę otwartych ryzyk R1–R3"
---

# Research: Etap 1 test-planu — kontrakt dopasowania (ryzyka #1, #4, #5)

**Date**: 2026-10-20T22:04:21+02:00
**Git Commit**: 80b43a8 (working tree ma niezatwierdzone zmiany poza `src/`; kotwice to lokalne `file:line`)
**Branch**: master

## Research Question

Etap 1 z `context/foundation/test-plan.md` §3 (ryzyka #1, #4, #5). Dla każdego ryzyka:

1. gdzie przechodzi przez kod (plik/funkcja),
2. jakie zachowanie udowodni ochronę — wyrocznia z PRD (i zaakceptowanych decyzji autorki), nie z kształtu kodu,
3. jaki jest najtańszy test.
   Oraz: co już pokrywają testy w `src/lib/matching/`, a czego nie.

## Summary

- **#1 (wykluczenia)** — reguła żyje w czystym module: `normalizeExclusion` (`src/lib/matching/keys.ts:92-103`) → `evaluateOption`/`TagIndex.someTagWithin` (`src/lib/matching/rank.ts:101-109`, `:82-86`) → blokada składnika w `rankRecipes` (`rank.ts:139-169`). Istniejące testy pokrywają ogólne/szczegółowe, zamienniki, „mąka/mak” i pusty klucz, ale poza przypadkami dwuznacznego „maka/maki” (`rank.test.ts:100-109`) żaden test wykluczenia nie podaje formy innej niż forma składnika. Liczba mnoga, wielkość liter, literówka i synonim są przetestowane wyłącznie po stronie _posiadania_ (`rank.test.ts:43-54`), a nie wykluczenia — a to właśnie scenariusz ryzyka #1 („inna nazwa, odmiana, synonim, literówka”). Najtańszy test: unit, `it.each` w `rank.test.ts`.
- **#4 (procent i ranking)** — `rankRecipes` liczy % i sortuje (`rank.ts:171-189`); scalenie stałych z posiadanymi dzieje się w serwisie (`src/lib/services/recipes.ts:278-282`). Pokryte: 100% z PRD, duplikaty, sortowanie po ułamku, 0% na końcu, brak % przy samych wykluczeniach. **Niepokryte:** przykład z PRD „jajecznica z samego jajka = 33%”, % dla przepisu dostępnego przez zamiennik, oraz dedykowana asercja „stałe liczą się dokładnie jak posiadane” (jest tylko pośrednio w teście kluczy nieaktualnych, `recipes.test.ts:465-471`), w tym przypadek „tylko stałe, brak posiadanych” → % nie jest `null`. Najtańszy test: unit w `rank.test.ts` + hermetyczny w `recipes.test.ts` (istniejący `fakeClient`).
- **#5 (limity wejścia)** — limity w `src/lib/matching/limits.ts:5-10`, egzekwowane serwerowo w `GET /api/recipes/match` (`src/pages/api/recipes/match.ts:11-17`, `:29-42`) jednym kodem `400 {"error":"invalid_query"}`. **Handler endpointu nie ma żadnego testu**; `countTokens` też nie. W `src/lib/matching/` testowane jest tylko `exceedsMatchUrl` (`limits.test.ts`) i regresja „12× maka” (`keys.test.ts:52-54`). Najtańszy test: hermetyczny test handlera `GET` z `vi.mock("@/lib/supabase")` — walidacja zwraca 400 przed utworzeniem klienta (`match.ts:41` vs `:44`).

## Detailed Findings

### Ryzyko #1 — przepis z wykluczonym składnikiem trafia na listę

**Ścieżka w kodzie (zaobserwowana):**

- Wejście: `matchRecipes` buduje `exclude: exclude.flatMap(normalizeExclusion)` (`src/lib/services/recipes.ts:278-282`).
- Normalizacja: `tokenize` (małe litery, NFC, podział na nie-literach, stopwordy) `src/lib/matching/tokenize.ts:7-13`; `wordKey` = stem → synonim → usunięcie diakrytyków (`src/lib/matching/dictionary.ts:28-39`); osobne produkty i rodzice w `wordsToOptionKeys` (`keys.ts:52-76`); dwa odczyty słowa dwuznacznego w `normalizeExclusion` (`keys.ts:92-103`).
- Klucze przepisu: `computeMatchKeys` → `textToOptionKeys`, gdzie `p` = rodzic + słowa frazy + odczyt wyjątku (`keys.ts:44-50`, `:106-111`).
- Decyzja: opcja wykluczona, gdy klucze tagu ⊆ klucze opcji ∪ `p` (`rank.ts:105`), z równością rozmytą `keysEqual` — identyczne albo oba ≥ 4 znaki i Damerau–Levenshtein ≤ 1 (`keys.ts:16-23`). Składnik zablokowany, gdy każda opcja wykluczona; zablokowany składnik usuwa przepis (`rank.ts:153-157`, `:169`).
- Doładowanie: cały katalog jest rankowany, potem cięty `slice(offset, offset+limit)` (`recipes.ts:282-286`), więc wykluczenie działa przed paginacją; ten sam `rankRecipes` jest wywołany ponownie dla przepisu, którego klucze nie pasują do składników (`recipes.ts:316-318`).

**Wyrocznia (źródła):**

- PRD Guardrails `prd.md:50`, US-01 AC `prd.md:64`: przepis z choć jednym wykluczonym składnikiem nigdy się nie pojawia.
- PRD Business Logic `prd.md:120`: ten sam składnik = odmiany, liczba mnoga, wielkość liter, literówki („mozarella” = „mozzarella”), synonimy („ziemniak” = „kartofel”). PRD nie zawęża tej reguły do posiadania — dotyczy też wykluczeń (`prd.md:87`, Socrates FR-002: „wykluczenie się przemknie”).
- PRD `prd.md:122`: ogólne ukrywa szczegółowe („mleko” → „mleko kokosowe”), szczegółowe nie ukrywa ogólnego; składnik blokuje dopiero, gdy wszystkie opcje wykluczone.
- Zaakceptowane decyzje autorki (zawężające/doprecyzowujące PRD): literówki tylko od 4 znaków klucza (`context/archive/2026-10-12-first-pantry-match/plan.md:61`); „kokosowe” ukrywa „mleko kokosowe”, „mąka” ukrywa „maka pszenna” (`plan.md:73`); słowo po „bez” zostaje tokenem — wykluczenia nadmiarowe (`plan.md:52`); wykluczona opcja nigdy nie daje „mam” (`plan.md:77`).

**Pokrycie w `src/lib/matching/` (sprawdzone pliki: `rank.test.ts`, `keys.test.ts`, `limits.test.ts`):**

| Zachowanie z wyroczni                                                                                                                                                                                                                                                                 | Pokryte?                                                                                                                     | Gdzie                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ogólne ukrywa szczegółowe (orzechy→orzechy włoskie, mleko→mleko kokosowe, kokosowe, sojowe)                                                                                                                                                                                           | tak                                                                                                                          | `rank.test.ts:87-98`                                                                                                                                                                                                                           |
| Szczegółowe nie ukrywa ogólnego (mleko kokosowe ↛ mleko, orzechy włoskie ↛ orzechy)                                                                                                                                                                                                   | tak                                                                                                                          | `rank.test.ts:90`, `:95`                                                                                                                                                                                                                       |
| mąka/mak i odczyty dwuznaczne w wykluczeniach                                                                                                                                                                                                                                         | tak                                                                                                                          | `rank.test.ts:93-94`, `:100-109`; `keys.test.ts:46-61`                                                                                                                                                                                         |
| Zamiennik niewykluczony ratuje przepis; wszystkie opcje wykluczone → ukryty                                                                                                                                                                                                           | tak                                                                                                                          | `rank.test.ts:117-120`                                                                                                                                                                                                                         |
| Wykluczona opcja nie daje „mam”, także jako zamiennik                                                                                                                                                                                                                                 | tak                                                                                                                          | `rank.test.ts:122-130`                                                                                                                                                                                                                         |
| Pusty zbiór kluczy nie jest wykluczany                                                                                                                                                                                                                                                | tak                                                                                                                          | `rank.test.ts:146-149`                                                                                                                                                                                                                         |
| **Wykluczenie w innej formie niż składnik:** liczba mnoga/odmiana („pomidory” vs „pomidor”, „mleka” vs „mleko kokosowe”), WIELKIE litery, bez polskich znaków („orzechy wloskie”), literówka („mozarella” vs „ser mozzarella kulka”), synonim („kartofel” vs „ziemniaki” i odwrotnie) | **nie**                                                                                                                      | normalizacja testowana tylko dla posiadania (`rank.test.ts:43-54`) i równości kluczy (`keys.test.ts:6-44`, `:63-91`); w bloku `exclusions` (`rank.test.ts:86-150`) formę wariantową mają tylko przypadki dwuznacznego „maka/maki” (`:100-109`) |
| Wykluczenie wariantowe względem **zamiennika** (np. zamiennik „Mleko kokosowe” przy wykluczeniu „mleka”)                                                                                                                                                                              | **nie**                                                                                                                      | —                                                                                                                                                                                                                                              |
| Pozostałe osobne produkty („mleko” ukrywa „mleko owsiane”)                                                                                                                                                                                                                            | **nie** wprost (ten sam mechanizm co „mleko sojowe” przez słowo frazy, ale rodzic `mleko` dla owsianego nie jest asertowany) | —                                                                                                                                                                                                                                              |
| Wykluczenie działa tak samo na stronie 2+ (doładowanie)                                                                                                                                                                                                                               | częściowo, poza `src/lib/matching/`                                                                                          | `recipes.test.ts:480-491` (wykluczenie + offset za końcem), `:550` (paging offset 3, bez wykluczenia)                                                                                                                                          |

**Najtańszy test:** unit, jedna tabela `it.each` w `src/lib/matching/rank.test.ts` (blok `exclusions`) z parami `[forma wykluczenia, produkt w przepisie, ukryty]`, używając istniejącego helpera `one()` (`rank.test.ts:31-35`). Brak I/O, brak mocków — moduł jest czysty (`index.ts:1`). Wartości oczekiwane to wyłącznie `true/false` z PRD, nie liczby z implementacji. Warstwa serwisowa nie jest potrzebna dla tej reguły; paginacja jest już osłonięta przez „rank-then-slice” i `recipes.test.ts:480-491`.

### Ryzyko #4 — zły % albo przepis za nisko

**Ścieżka w kodzie:**

- Stałe = posiadane: `have: [...have, ...staple].map(normalizeTag)` (`src/lib/services/recipes.ts:278-282`) — scalenie jest **poza** `rankRecipes`, więc unit test `rankRecipes` nie może go udowodnić.
- Posiadanie: tag ⊆ opcja albo opcja ⊆ tag, bez `p` (`rank.ts:107`); zamiennik posiadany → składnik dostępny (`rank.ts:143-152`, `:162`).
- %: `Math.round(available/total*100)`, `null` gdy brak tagów `have`, `0` dla przepisu bez składników (`rank.ts:171`).
- Sortowanie: dokładny ułamek (mnożenie krzyżowe), potem więcej dostępnych, nazwa (`Intl.Collator("pl")`), `id` (`rank.ts:179-189`).

**Wyrocznia:**

- PRD `prd.md:44`, `:63`: pomidor + chleb + mozzarella → „mozzarella z pomidorem” = 100%; przepis nie musi zużyć wszystkich produktów.
- PRD `prd.md:120`: % = część składników dostępna; składnik dostępny, gdy jest on **lub którykolwiek zamiennik** w posiadanych albo stałych; stałe liczą się **dokładnie** jak posiadane.
- PRD `prd.md:124`: sortowanie malejąco po %; przepisy z 0% pokazywane na końcu; jajecznica (jajko, sól, pieprz) przy samym jajku = 33%.
- PRD US-01 Given `prd.md:58`: wystarczy produkt w „posiadane” **lub** „stałe”.
- Decyzje autorki: duplikaty liczą się osobno, wyświetlany `Math.round`, sort po dokładnym ułamku; remisy: więcej dostępnych → nazwa → `id` (`first-pantry-match/plan.md:79-80`). Remis nie pochodzi z PRD — test-plan §2 ostrzega przed kruchym założeniem kolejności przy remisach.

**Pokrycie:**

| Zachowanie                                                                                 | Pokryte?                                                                                                                   | Gdzie                  |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Mozzarella z pomidorem = 100% (PRD)                                                        | tak                                                                                                                        | `rank.test.ts:38-41`   |
| Duplikaty osobno (sól, sól, pieprz → 67%)                                                  | tak                                                                                                                        | `rank.test.ts:153-155` |
| Sort po ułamku, 0% na końcu, remisy wg decyzji autorki                                     | tak (asercja dokładnej kolejności z remisami, oparta na `plan.md:80`)                                                      | `rank.test.ts:157-174` |
| Same wykluczenia → `percent: null`, kolejność po nazwie                                    | tak                                                                                                                        | `rank.test.ts:176-185` |
| **Jajecznica z samego jajka = 33% (PRD)**                                                  | **nie**                                                                                                                    | —                      |
| **Zamiennik posiadany liczy się do % (np. 1/1 → 100%)**                                    | **nie** (testowany tylko `status`/`via`, `rank.test.ts:75-83`)                                                             | —                      |
| **Stałe = posiadane: ten sam przepis daje ten sam % przy produkcie w `staple` i w `have`** | **nie wprost**; pośrednio `recipes.test.ts:465-471` (`staple: ["chleb"]` daje 100%, ale test dotyczy kluczy nieaktualnych) | —                      |
| **Tylko stałe, puste posiadane → % liczony (nie `null`)**                                  | **nie**                                                                                                                    | —                      |
| Stała, która jest wykluczona, nie daje „mam”                                               | pośrednio (`rank.test.ts:122-125` dla `have`; scalenie w serwisie niesprawdzone)                                           | —                      |

**Najtańszy test:**

- Unit w `rank.test.ts` (blok `percent and order`): jajecznica = 33%, zamiennik → 100%. Wartości wprost z PRD.
- Hermetyczny w `src/lib/services/recipes.test.ts` (blok `matchRecipes`, istniejący `fakeClient`): ta sama baza, `{have:["jajko"], staple:["sól","pieprz"]}` vs `{have:["jajko","sól","pieprz"], staple:[]}` → ten sam % (100), oraz `{have:[], staple:[...]}` → % nie `null`. Integracja z prawdziwą bazą nie daje tu dodatkowego sygnału — reguła nie zależy od ograniczeń DB.
- Nowe testy nie powinny asertować kolejności remisów poza tym, co już przypina `rank.test.ts:157-174`.

### Ryzyko #5 — skrajne wejście → 1102 zamiast 400, albo omija walidację serwera

**Ścieżka w kodzie:**

- Stałe: `MAX_TAG_LENGTH = 60`, `MAX_TAGS = 30`, `MAX_TOKENS = 100`, `MAX_URL_LENGTH = 8000`, `countTokens` (`src/lib/matching/limits.ts:5-14`).
- Serwer: `parseTagList` odrzuca > 30 tagów w sekcji, pusty tag po `trim`, tag > 60 znaków (`match.ts:11-17`); handler odrzuca też `limit` poza 1–50, zły `offset`, wszystkie listy puste, `countTokens(have+staple+exclude) > 100` — każde z nich jako `400 {"error":"invalid_query"}` (`match.ts:29-42`). Walidacja zwraca przed `createClient` (`match.ts:44`). `MAX_URL_LENGTH`/`exceedsMatchUrl` **nie** są sprawdzane w endpoincie (import `match.ts:3`).
- Klient używa tych samych stałych z tego samego pliku: `usePantryMatch.ts:10`, `:105-110`, `:324-354`; `TagInput.tsx:6`. Klient nie odróżnia `invalid_query` od innych błędów (`usePantryMatch.ts:123-131`).
- Ograniczenia CPU w samym rankingu: `keysEqual` liczone raz na (unikalny klucz katalogu × unikalny klucz tagów) i cache'owane (`rank.ts:31-70`, `:118-132`); liczba odczytów wykluczenia to `2^(liczba unikalnych kluczy dwuznacznych)` (`keys.ts:94-96`), dziś ograniczona słownikiem (`EXCEPTIONS` ma 1 wpis, `dictionary.ts:22-24`), nie wejściem. Rozmiar katalogu nie ma limitu (`recipes.ts:204-219`, 1000 wierszy na stronę, bez górnej granicy); przeliczenie kluczy ograniczone `MAX_RECOMPUTED_RECIPES = 200` (`src/lib/recipes/limits.ts:23`).
- Walidacja przepisu po stronie serwera (zapis): `parseRecipeInput` w `src/lib/recipes/validate.ts` — maks. 40 składników, 5 zamienników, 80 znaków produktu; pokryta przez `src/lib/recipes/validate.test.ts:151-213` (zgłoszone przez agenta, nie czytane w całości).

**Wyrocznia:**

- `context/foundation/lessons.md:19-24`: ogranicz wejście przed pętlą, przy przekroczeniu zwróć 400 z czytelnym kodem; warianty po unikalnych kluczach; limity w jednym pliku współdzielonym przez API i UI.
- Kody i wartości: `first-pantry-match/plan.md:264-266` (limit 10/50, tag ≤ 60 znaków, ≤ 30 tagów na listę, `400 invalid_query`) oraz `first-pantry-match/reviews/impl-review.md:35-52` (F1: `MAX_TOKENS = 100` → 400 `invalid_query`).
- Test-plan §2 #5: „Zbyt duże wejście daje 400 z czytelnym kodem, nie 1102; serwer sam waliduje”. Antywzorzec: test tylko z małym wejściem; limit zduplikowany w teście — test powinien importować stałe z `limits.ts`.
- NFR PRD `prd.md:113`: < 1 s przy kilkuset przepisach (roadmap podnosi cel do ~1000, wg raportu agenta `roadmap.md:143`, `:212`).

**Pokrycie:**

| Zachowanie                                                                                       | Pokryte?                                                                                                                                                                      | Gdzie                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Patologiczny tag „maka ×12” nie mnoży odczytów                                                   | tak                                                                                                                                                                           | `keys.test.ts:52-54`                                                     |
| `exceedsMatchUrl` (budżet URL dla zapisanej spiżarki/snapshotu)                                  | tak                                                                                                                                                                           | `limits.test.ts:4-22`                                                    |
| Snapshot i zapisana spiżarka przycinane/odrzucane wg limitów                                     | tak, poza `src/lib/matching/`                                                                                                                                                 | `src/lib/list-state.test.ts:46-84`, `src/lib/pantry/saved.test.ts:42-76` |
| Walidacja przepisu przy zapisie                                                                  | tak, poza `src/lib/matching/`                                                                                                                                                 | `src/lib/recipes/validate.test.ts:151-213`                               |
| **`countTokens`** (słowa liczone po `tokenize`, liczby/stopwordy się nie liczą)                  | **nie**                                                                                                                                                                       | —                                                                        |
| **Endpoint: 31 tagów / tag 61 znaków / pusty tag / 101 słów w sumie list → 400 `invalid_query`** | **nie** (brak jakiegokolwiek testu `match.ts`)                                                                                                                                | —                                                                        |
| **Endpoint: wartości graniczne (30 tagów, 60 znaków, 100 słów) przechodzą walidację**            | **nie**                                                                                                                                                                       | —                                                                        |
| **Limit słów liczony łącznie na trzech listach** (np. 50 + 51 rozbite między `have` i `exclude`) | **nie**                                                                                                                                                                       | —                                                                        |
| Czas `rankRecipes` przy ~1000 przepisów i maks. wejściu                                          | poza testami: `scripts/bench-match.ts` (`npm run bench:match`); w archiwum pomiar 8,26–8,88 ms przy progu 8 ms nieodhaczony (wg agenta, `first-pantry-match/plan.md:439-441`) | —                                                                        |

**Najtańszy test:**

- Unit w `limits.test.ts`: `countTokens` (liczby, procenty i stopwordy nie są słowami; suma po tagach).
- Hermetyczny test handlera, np. `src/pages/api/recipes/match.test.ts`: `vi.mock("@/lib/supabase")` (moduł importuje `astro:env/server`, `src/lib/supabase.ts:3`, którego Vitest nie rozwiąże — w `vitest.config.ts` jest tylko alias `@/`) i `vi.mock("@/lib/services/recipes")`; wywołać `GET({ url: new URL(...), request, cookies } as APIContext)` i asertować najpierw status 400, potem `body.error === "invalid_query"` (lessons „Assert status and body type before content”). Graniczne wartości przechodzą = mock `matchRecipes` zostaje wywołany. Limity budowane z importowanych stałych, nie z literałów. Integracja z lokalnym Supabase nie daje tu sygnału — walidacja nie dotyka bazy.
- Test wydajności (CPU) nie jest najtańszym sygnałem w unit — czas w Vitest/Node nie odpowiada limitowi CPU Workers; benchmark już istnieje jako skrypt. Do decyzji w planie, czy dodawać asercję czasu.

## Code References

- `src/lib/matching/rank.ts:101-109` — werdykt opcji: wykluczona / posiadana
- `src/lib/matching/rank.ts:139-169` — blokada składnika i odrzucenie przepisu
- `src/lib/matching/rank.ts:171-189` — % i sortowanie
- `src/lib/matching/keys.ts:16-23` — `keysEqual` (literówki od 4 znaków)
- `src/lib/matching/keys.ts:44-76` — klucze produktu, osobne produkty, `p`
- `src/lib/matching/keys.ts:83-103` — `normalizeTag`, `normalizeExclusion`
- `src/lib/matching/dictionary.ts:6-24` — synonimy, osobne produkty, wyjątki
- `src/lib/matching/tokenize.ts:4-13` — tokenizacja i stopwordy
- `src/lib/matching/limits.ts:5-14` — limity i `countTokens`
- `src/lib/services/recipes.ts:278-286` — scalenie stałych z posiadanymi, rank-then-slice
- `src/pages/api/recipes/match.ts:11-42` — walidacja zapytania i `400 invalid_query`
- `src/components/hooks/usePantryMatch.ts:10`, `:105-110` — te same limity po stronie klienta
- `src/lib/services/recipes.test.ts:420-617` — testy `matchRecipes` z `fakeClient`

## Architecture Insights

- Reguła dopasowania jest czystym modułem (`src/lib/matching/index.ts:1`) — ryzyka #1 i #4 (poza scaleniem stałych) są testowalne jednostkowo bez mocków.
- Scalenie `have + staple` i rank-then-slice żyją w serwisie; serwis ma gotowy hermetyczny `fakeClient`, więc rozszerzenie jest tanie.
- Endpoint `match.ts` jest jedynym miejscem egzekwowania limitów #5 po stronie serwera i nie ma żadnego wzorca testu endpointu w repo — plan musi ustalić wzorzec (to też uzupełni test-plan §6.4, który wskazuje na Fazę 2).
- `keys.test.ts:115-169` (fingerprint) wymusza podbicie `MATCH_KEYS_VERSION` przy zmianie słownika — nowe testy nie zmieniają słownika, więc go nie ruszą.

## Historical Context (from prior changes)

- `context/archive/2026-10-12-first-pantry-match/plan.md:48-83` — kontrakt domenowy „Reguła dopasowania” z przykładami (źródło wyroczni obok PRD); addendum `:73` (F2, F7).
- `context/archive/2026-10-12-first-pantry-match/plan.md:264-266` — parametry endpointu i kody błędów.
- `context/archive/2026-10-12-first-pantry-match/reviews/impl-review.md:35-52` — F1, incydent „maka”: wg review 12 powtórzeń w **jednym** tagu → 4096 odczytów; `lessons.md:22` mówi „12 tagów” — rozbieżność opisu, nie reguły; obecny test `keys.test.ts:53` odtwarza wariant z jednym tagiem.
- Otwarte luki słownika zgłoszone w archiwum (wg agenta): „ser” nie pokrywa „serek”, wykluczenie „mleko” nie ukrywa „napój sojowy” (`context/archive/2026-10-18-seed-recipe-import/research.md:44`, `:116`, `:234`); formy, których stemmer nie łączy (cukier/cukru) — `first-pantry-match/plan-brief.md`, Open Risks; F3 (posiadane „maku/maki” liczone jako mąka) świadomie pominięte (`impl-review.md:68-76`).

## Related Research

- `context/archive/2026-10-12-first-pantry-match/external-research.md` — stemmer i jego wyniki (źródło przypadków odmian).
- `context/archive/2026-10-18-seed-recipe-import/research.md` — szum z danych przepisów (marki, formy).

## Decisions (autorka, 2026-10-20)

Odpowiedzi na Open Questions poniżej. Zastępują je jako wejście dla `/10x-plan`.

1. **Literówki od 4 znaków → przypiąć testem jako świadomą granicę.** Kod celowo toleruje literówki tylko od 4 znaków klucza (`keys.ts:16-23`, `first-pantry-match/plan.md:61`). Test ma potwierdzić obie strony granicy w kontekście wykluczenia: literówka w kluczu ≥ 4 znaki ukrywa przepis, literówka w kluczu < 4 znaki go nie ukrywa. Ta druga asercja dokumentuje zaakceptowane zawężenie PRD (`prd.md:120`), a nie błąd.
2. **Luki słownika → `it.todo` + otwarte ryzyko, bez naprawy w tej zmianie.** Naprawa zmienia zachowanie i wymaga podbicia `MATCH_KEYS_VERSION`, więc nie jest pracą testową. Luki: wykluczenie „mleko” nie ukrywa napoju roślinnego nazwanego „napój …” (archiwum podaje „napój sojowy”, `seed-recipe-import/research.md:44`), „ser” nie pokrywa „serek”, stemmer nie łączy „cukier”/„cukru”. Uwaga: „mleko owsiane” jest w słowniku jako osobny produkt z rodzicem `mleko` (`dictionary.ts:17`), więc wykluczenie „mleko” je ukrywa — to nie jest luka, tylko przypadek bez wprost asertowanego testu (tabela #1); należy go dodać jako zwykły test, nie `it.todo`.
3. **Brak `MAX_URL_LENGTH` w endpoincie → otwarte ryzyko, bez testu w tej fazie.**
4. **Pomiar czasu → bez testu; zostaje ręczny `npm run bench:match`.** Testy czasu są niestabilne.

### Otwarte ryzyka (do odnotowania przez plan, poza zakresem tej zmiany)

- R1: luki słownika z decyzji 2 — przepis z „napój sojowy” nie jest ukryty przy wykluczeniu „mleko”; „serek” nie liczy się jako posiadany przy „ser”; „cukru” vs „cukier”.
- R2: endpoint `GET /api/recipes/match` nie sprawdza `MAX_URL_LENGTH` (`match.ts:3`); górną granicę daje tylko limit URL Cloudflare (`limits.ts:9`).
- R3: brak automatycznej bramki CPU dla `rankRecipes`; pomiar ręczny `npm run bench:match`.

## Open Questions (rozstrzygnięte — patrz Decisions)

Pierwotne pytania do autorki:

1. **Literówka w krótkim słowie przy wykluczeniu.** PRD (`prd.md:120`) mówi o literówkach bez progu; decyzja autorki (`plan.md:61`) toleruje je od 4 znaków klucza. Dla alergenu z krótkim rdzeniem literówka w tagu nie ukryje przepisu. Czy test ma przypiąć to jako świadomie zaakceptowaną granicę (asercja „nie ukrywa”), czy pominąć?
2. **Znane luki słownika jako testy.** „mleko” vs „napój sojowy”, „ser” vs „serek”, „cukier” vs „cukru” — to nie są odmiany nazwy w sensie PRD (`prd.md:122`) albo zależą od słownika. Czy faza ma dodać `it.todo`/test „known gap”, czy zostawić poza zakresem (zmiana słownika = osobna zmiana z podbiciem wersji)?
3. **Brak sprawdzania `MAX_URL_LENGTH` w endpoincie** (`match.ts:3`). Czy to luka do zgłoszenia (serwer „nie ufa klientowi”, test-plan #5), czy akceptowalne, bo `MAX_TAGS × MAX_TAG_LENGTH × 3` mieści się w 16 KB Cloudflare? Test fazy powinien chronić zachowanie istniejące, nie wymuszać nowego bez decyzji.
4. **Benchmark CPU jako bramka.** Czy w Fazie 1 dodać asercję czasu dla `rankRecipes` (ryzyko flaky w CI), czy zostawić `npm run bench:match` jako ręczny pomiar?
