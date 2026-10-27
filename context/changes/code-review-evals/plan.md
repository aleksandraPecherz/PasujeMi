# Evale recenzenta w promptfoo — plan implementacji

## Overview

Mały, powtarzalny zestaw evali dla recenzenta z `tools/code-reviewer/`: własny provider promptfoo wywołuje rzeczywisty `runReview()`, więc prompt, schemat, walidacja i bramka `deriveOutcome` są dokładnie te z produkcji. Porównujemy dwa modele dostępne w Claude Pro na trzech krótkich, w pełni fikcyjnych diffach (poprawna zmiana z testem, celowy błąd, brak danych do oceny). Oczekiwania są zapisane i zatwierdzone przed pierwszym uruchomieniem. Asercje są deterministyczne, a ocena merytoryczna jest ręczna. Najpierw jeden pilotaż, a pozostałe pięć uruchomień dopiero po zgodzie autorki. Nie zmieniamy `tools/code-reviewer/`, workflow review ani domyślnego modelu produkcyjnego.

## Current State Analysis

- `runReview(input, queryFn, timeoutMs)` jest czystym modułem z wstrzykiwanym `queryFn` (`tools/code-reviewer/src/run.ts:72`). Buduje prompt (`prepareInput`, `input.ts:17-44`), wywołuje jedno `query()` z `SYSTEM_PROMPT`, `REVIEW_JSON_SCHEMA`, `tools: []`, `settingSources: []`, `maxTurns: 2`, `maxBudgetUsd: 0.5` (`run.ts:107-118`), waliduje (`validate.ts:10-34`) i wylicza wynik (`outcome.ts:29-38`).
- Model jest stałą `MODEL = "claude-sonnet-5-5"` (`run.ts:9`, użyta w `run.ts:110`). Podmiana modelu bez zmiany `run.ts` jest możliwa w opakowaniu `queryFn`, bo `QueryParams.options.model` to zwykły string (`run.ts:16-17`).
- `index.ts` przekazuje prawdziwe `query` z SDK (`index.ts:57`). SDK w pakiecie recenzenta: 0.3.310 (`tools/code-reviewer/package.json`, lockfile).
- Schemat nie ma pola z zarzutami (`review-schema.ts:139-193`), więc „oczekiwane ustalenia" sprawdzamy ocenami, `notAssessed` i `outcome`. Zmiana kontraktu jest poza zakresem.
- `ci.yml:27-29`, `ai-code-review.yml:232-235` i `.github/actions/code-review/action.yml:51-54` instalują `tools/code-reviewer` przez `npm ci --ignore-scripts`; dodanie tam promptfoo zmieniłoby instalację w jobie z sekretem.
- Root `eslint.config.js:89` i `tsconfig.json:4` wykluczają wyłącznie `tools/code-reviewer`; lint-staged i hooki agenta uruchamiają ESLint na zmienianych plikach `.ts`.
- promptfoo w rejestrze npm: 0.125.1, `engines.node >=22.22.0`; repo ma Node 22.23.3 (`.nvmrc`). Nie jest zainstalowany ani skonfigurowany w repo.
- Obowiązują wnioski z `research.md` tej zmiany; jedyne rozbieżności to luki, które ta faza zamyka bez modeli (loader `.ts`, walidacja `is-json`, telemetria, flagi filtrów).

## Desired End State

- Pakiet `tools/code-review-evals/` z konfiguracją promptfoo, providerem, trzema fikcyjnymi przypadkami, plikiem oczekiwań i skryptem odcisku konfiguracji. Nic z tego nie wchodzi do CI ani do instalacji workflow review.
- Wynik sześciu komórek (3 przypadki × 2 modele, po jednym uruchomieniu każda) zapisany w `context/changes/code-review-evals/results.md` razem z surowymi plikami JSON, czasem, tokenami, szacunkiem kosztu SDK i ręczną oceną merytoryczną autorki.
- Pilotaż (przypadek „celowy błąd" × model A) zapisany z odciskiem konfiguracji; liczy się do sześciu wyników tylko wtedy, gdy odcisk przy pozostałych pięciu uruchomieniach jest identyczny.
- Brak zmian w `tools/code-reviewer/`, `.github/`, `context/foundation/`, `context/archive/`.

### Key Discoveries:

- Wstrzykiwane `queryFn` pozwala zachować cały kontrakt i podmienić tylko model (`run.ts:14-38,107-118`).
- Opakowanie `queryFn` może przechwycić wiadomość `result` z `modelUsage`, aby sprawdzić, że uruchomiono żądany model, a nie podmieniony; w `QueryMessage` brak tego pola (`run.ts:29-37`), ale typ jest strukturalnie otwarty.
- Poprawny przypadek musi zawierać test w diffie. Bez niego `testRiskCoverage` to `null`/`no-data` (`review-schema.ts:88`), czyli `incomplete`, a nie `passed`.
- `not-applicable` nie zmienia wyniku (`outcome.ts:35`), a ocena < 5 daje `failed` niezależnie od `verdict` (`outcome.ts:30-34`); próg 5 jest tymczasowy (`outcome.ts:4-5`).
- Wbudowany provider Agent SDK pomijałby `prepareInput`, walidację i bramkę (`research.md`, P1); dlatego własny provider.
- `ANTHROPIC_API_KEY` przesłania subskrypcję w trybie nieinteraktywnym (`ci-cd-code-review/research.md` §4.A); zmienne kluczy muszą być nieustawione na czas evali.

## What We're NOT Doing

- Żadnego `llm-rubric`, `agent-rubric` ani innego gradera modelowego. LLM-as-a-judge jest odłożony; wyniki nie mogą być opisywane jako ocena rubryką.
- Żadnego pola `findings` ani innej zmiany schematu, promptu, walidacji, bramki i progu 5 (próg jest tylko obserwowany).
- Żadnych zmian w `tools/code-reviewer/`, `.github/workflows/`, `.github/actions/`, w `MODEL` ani w CI.
- Żadnego `fallbackModel`, automatycznych powtórek, `repeat` > 1 ani retry po błędzie.
- Żadnego bezpośredniego czytania poświadczeń przez provider ani wywołań `anthropic:messages`. Wyłącznie standardowe uwierzytelnianie Agent SDK.
- Żadnego ustawiania `ANTHROPIC_API_KEY` ani generowania tokenów.
- Żadnych prób modelowych przed Fazą 3 i bez zgody autorki; wybór kandydatów z pickera `/model`, nie z sondy SDK.
- Żadnej bramki kosztowej: `total_cost_usd` jest szacunkiem SDK i jest tylko raportowany.
- Nie commitujemy ani nie wypychamy zmian bez prośby autorki.

## Implementation Approach

Osobny pakiet `tools/code-review-evals/` (decyzja autorki) z własnym `package.json` i lockfile, z dokładnie przypiętymi wersjami `promptfoo` i `@anthropic-ai/claude-agent-sdk` (0.3.310, jak w recenzencie). Provider importuje `runReview` oraz typy z `../code-reviewer/src/` (bez zmiany tego pakietu), a `query` bierze z własnej kopii SDK. Konfiguracja: jeden `promptfooconfig.yaml`, dwa providery (etykiety modeli A i B), trzy testy, `maxConcurrency: 1`, `--no-cache`. Uruchomienie pojedynczej komórki odbywa się przez filtr promptfoo, więc pilotaż i reszta macierzy korzystają z tego samego pliku konfiguracji. Skrypt odcisku haszuje wszystko, co wpływa na wynik, i jest zapisywany przy każdym wyniku.

## Critical Implementation Details

- **State sequencing**: pierwszą zmianą w Fazie 1 jest dopisanie `tools/code-review-evals/` do `globalIgnores` w `eslint.config.js` i do `exclude` w `tsconfig.json`; inaczej hooki agenta (ESLint po każdym zapisie) i lint-staged zablokują kolejne edycje nowych plików.
- **Instalacja**: `npm ci --ignore-scripts` jak w repo; jeśli promptfoo wymaga skryptów instalacyjnych do działania (np. zależności natywne), zatrzymaj się i zapytaj autorkę zamiast je włączać.
- **Debug & observability**: provider nie wpisuje surowych `logs` do `metadata` (mogą zawierać komunikaty wyjątków); zapisuje tylko `status`, `outcome`, `category`, `Metrics`, żądany model i modele z `modelUsage`.

## Faza 1: Pakiet i provider (bez modeli)

### Overview

Szkielet pakietu i provider, zweryfikowane wyłącznie fałszywym `queryFn`. Zamyka luki z badania, które nie wymagają modelu.

### Changes Required:

#### 1. Wykluczenia lintu i typów

**File**: `eslint.config.js`, `tsconfig.json`

**Intent**: Nowy pakiet nie jest kodem aplikacji i nie ma być sprawdzany przez root ESLint ani `astro check`, tak jak recenzent.

**Contract**: dopisać `tools/code-review-evals/` obok `tools/code-reviewer/` w `globalIgnores` (`eslint.config.js:89`) i w `exclude` (`tsconfig.json:4`). Bez innych zmian.

#### 2. Szkielet pakietu

**File**: `tools/code-review-evals/package.json`, `tsconfig.json`, `.gitignore`, `README.md`

**Intent**: Osobny pakiet ESM z przypiętymi zależnościami i skryptami, spójny z `tools/code-reviewer/package.json`.

**Contract**: `"type": "module"`, `engines.node >=22`; zależności bez `^`: `promptfoo` (0.125.1 albo najnowsza z rejestru w dniu instalacji, zapisana dokładnie) i `@anthropic-ai/claude-agent-sdk` `0.3.310`; devDependencies `tsx`, `typescript`, `@types/node` w wersjach recenzenta; skrypty `test` (`tsx --test "src/**/*.test.ts"`), `typecheck`, `fingerprint`, `preflight`. `.gitignore`: `node_modules/`. README opisuje cel, zasadę „bez gradera modelowego" i polecenia.

#### 3. Provider promptfoo

**File**: `tools/code-review-evals/src/provider.ts` (+ `provider.test.ts`)

**Intent**: Klasa providera wołająca `runReview()` z `queryFn` opakowującym prawdziwe `query()`, z modelem z konfiguracji providera.

**Contract**:

- Konstruktor wymaga `config.model` (string); brak = błąd konstrukcji, żadnego modelu domyślnego. `fallbackModel` nigdy nie jest przekazywany (test).
- `callApi(prompt, context)` bierze `title`, `body`, `diff` z `context.vars`, wywołuje `runReview({ title, body, diff, excludedFiles: [], requireToken: false, hasToken: true }, queryFn)`. `queryFn` podmienia `options.model` na `config.model`, zapisuje `params.prompt` i `modelUsage` z wiadomości `result`.
- Odpowiedź: `output` = `JSON.stringify(result)` (cały `ResultFile`; błędy i skip też, bez pola `error`, więc pada asercja statusu); `prompt` = faktycznie wysłany prompt; `tokenUsage` = `{ prompt: input + cache_creation + cache_read, completion: output_tokens, total: suma }` z `Metrics.usage`; `cost` = `total_cost_usd_estimate`; `metadata` = `{ status, outcome, category?, requestedModel, modelsUsed, numTurns, durationMs, costIsEstimate: true, usage }`. Gdy `metrics` jest `null`, brak `tokenUsage` i `cost`.
- Tryb testowy: provider przyjmuje wstrzykiwane `queryFn` (parametr konstruktora lub eksport fabryki), tak aby `provider.test.ts` nie importował SDK ani nie robił żądań.

#### 4. Preflight i odcisk konfiguracji

**File**: `tools/code-review-evals/src/preflight.ts`, `src/fingerprint.ts` (+ testy)

**Intent**: Preflight przerywa, gdy w środowisku są zmienne kluczy, które przesłoniłyby subskrypcję; odcisk jednoznacznie określa „konfigurację niezmienioną".

**Contract**:

- `preflight`: sprawdza wyłącznie obecność (nie wartości) `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `OPENAI_API_KEY` i kończy kodem ≠ 0, jeśli którakolwiek jest ustawiona. Nie czyta plików poświadczeń.
- `fingerprint`: sha256 z posortowanej listy `ścieżka:sha256(treść)`. Lista nie jest wpisana na sztywno dla kodu recenzenta, tylko wyliczana: statyczne domknięcie importów zaczynające się od `../code-reviewer/src/run.ts` (dziś m.in. `errors.ts`, `input.ts`, `outcome.ts`, `review-schema.ts`, `validate.ts`) oraz importy providera, więc nowy moduł wpływający na przebieg wejdzie do odcisku sam. Do odcisku wchodzą też: `promptfooconfig.yaml` (w tym asercje i flagi), `expectations.md`, wszystkie pliki asercji i funkcji pomocniczych używanych przez konfigurację (np. `src/assertions.ts`), `src/provider.ts`, `diffs/*`, `package.json` i lockfile pakietu evali, `package.json` recenzenta (wersja SDK) oraz identyfikatory modeli z konfiguracji. Wypisuje hash i pełną listę składników. Filtr wyboru komórki nie wchodzi do odcisku. Test odcisku sprawdza, że każdy plik z domknięcia importów `run.ts` jest na liście składników (dodanie nowego importu do `run.ts` bez zmiany listy nie może przejść niezauważone), i że zmiana pliku z domknięcia (np. `errors.ts`) oraz pliku asercji zmienia hash.

#### 5. Konfiguracja szkieletowa i kontrole bez modeli

**File**: `tools/code-review-evals/promptfooconfig.yaml` (szkielet), `src/loader.test.ts` lub skrypt kontrolny

**Intent**: Zamknąć luki z badania: (a) czy loader `.ts` promptfoo rozwiązuje importy z rozszerzeniem `.ts` z `../code-reviewer/src/`, (b) czy `is-json` z minimalnym, ręcznie napisanym schematem `ResultFile` (obiekt z wymaganym `status` i `outcome`) działa w walidatorze promptfoo i odrzuca tekst niebędący JSON-em (`REVIEW_JSON_SCHEMA` nie jest tu używany; `review` waliduje osobna asercja, zob. Fazę 2), (c) nazwy zmiennych wyłączających telemetrię i sprawdzanie aktualizacji promptfoo według oficjalnej dokumentacji, (d) czy `promptfoo eval` ma filtry wyboru providera i testu (np. `--filter-providers`, `--filter-pattern`, `--filter-first-n`), (e) czy zmienne `file://` ładują treść diffów jako tekst.

**Contract**: kontrole (a), (b) i (e) wykonuje się z providerem pod fałszywym `queryFn` (np. testowy provider zwracający zapisany `ResultFile`), nigdy z prawdziwym SDK; (c) i (d) przez dokumentację lub `promptfoo eval --help`. Jeśli (a) zawiedzie, fallback: kompilacja providera do JS przed uruchomieniem (zgodnie z dokumentacją promptfoo) i zapis tej decyzji w README. Wynik każdej kontroli trafia do README.

### Success Criteria:

#### Automated Verification:

- Zależności zainstalowane bez skryptów: `npm ci --ignore-scripts` w `tools/code-review-evals`
- Testy providera, preflightu i odcisku przechodzą: `npm test` w `tools/code-review-evals`
- Odcisk obejmuje całe domknięcie importów `run.ts` (w tym `errors.ts`) i pliki asercji; zmiana któregokolwiek z nich zmienia hash (test)
- Typecheck przechodzi: `npm run typecheck` w `tools/code-review-evals`
- Testy recenzenta nadal przechodzą bez zmian: `npm test` w `tools/code-reviewer`
- Root lint i typy nie widzą nowego pakietu: `npm run lint` i `npx astro check` w katalogu głównym
- Brak zmian w zabronionych ścieżkach: `git diff --name-only` nie zawiera `tools/code-reviewer/`, `.github/`, `context/foundation/`, `context/archive/`
- Test providera potwierdza: model z konfiguracji trafia do `options.model`, brak `fallbackModel`, brak `config.model` rzuca błąd

#### Manual Verification:

- Wynik kontroli (a)–(e) zapisany w README i przejrzany przez autorkę
- Autorka potwierdza, że instalacja nie wymagała skryptów (albo świadomie je dopuściła)

---

## Faza 2: Fikcyjne diffy, oczekiwania i modele

### Overview

Trzy przypadki, plik oczekiwań i asercje zatwierdzone przed jakimkolwiek wywołaniem modelu oraz wybór dwóch modeli przez autorkę.

### Changes Required:

#### 1. Trzy fikcyjne diffy z tytułem i opisem PR

**File**: `tools/code-review-evals/diffs/` (`correct.diff`, `bug.diff`, `no-data.diff`, plus `*.title.txt` i `*.body.txt` lub zmienne w YAML)

**Intent**: Krótkie, w pełni wymyślone zmiany w stylu repo (Astro/TypeScript/Vitest), bez fragmentów prawdziwego kodu, danych i sekretów. Nazwy modułów generyczne; przed zapisem sprawdzić, że żadna ścieżka nie koliduje z plikiem śledzonym przez git.

**Contract**:

- `correct`: mała funkcja z obsługą błędów i adekwatny test w tym samym diffie (poprawne asercje, w teście endpointu status przed body, jeśli jest endpoint); opis zgodny z diffem. Oczekiwany `outcome: passed`.
- `bug`: jeden wyraźny błąd w kryterium `implementationCorrectness`: endpoint fikcyjny ignoruje `error` z klienta bazy i zwraca sukces, a opis PR deklaruje zwrot 500 przy błędzie bazy. Zawiera test ścieżki szczęśliwej z poprawnymi asercjami (żeby `testRiskCoverage` było liczbą), bez drugiego, niepowiązanego błędu. Oczekiwany `outcome: failed`.
- `no-data`: nowa, poprawna logika bez żadnego testu w diffie; opis zgodny z diffem; brak innych wad. Oczekiwany `testRiskCoverage: null` z jednym wpisem `no-data`, `outcome: incomplete`.
- Wszystkie trzy przechodzą `prepareInput` (poniżej 60 000 znaków).

#### 2. Plik oczekiwań i asercje

**File**: `tools/code-review-evals/expectations.md`, `promptfooconfig.yaml` (tests + assert)

**Intent**: Oczekiwania zapisane w dwóch miejscach zgodnie: czytelny `expectations.md` dla autorki i deterministyczne asercje w YAML. Zatwierdzone przed pierwszym uruchomieniem.

**Contract** (asercje `javascript` na sparsowanym `ResultFile`, plus `is-json`):

- Walidacja `output` w dwóch warstwach, wspólnych dla wszystkich przypadków: (1) `is-json` sprawdza, że cały `output` (serializowany `ResultFile`) jest poprawnym JSON-em, z minimalnym schematem `{ status, outcome }`; obejmuje też `status: error` i `skipped`. (2) Asercja `javascript` waliduje pole `review` przez `REVIEW_SCHEMA.safeParse`, tylko gdy `status === "reviewed"`; dla `error`/`skipped` ta warstwa nie jest stosowana, a wynik taki oblewa osobną asercję `status === "reviewed"` (nie jest to błąd formatu JSON). Dodatkowo `metadata.modelsUsed` zawiera żądany model.
- `correct`: `outcome === "passed"` oraz `review.testRiskCoverage !== null`.
- `bug`: `outcome === "failed"` oraz `review.implementationCorrectness` jest liczbą < 5. To są warunki konieczne, ale nie dowód wykrycia wady: `failed` i ocena < 5 mogą wynikać z innego powodu. Wykrycie konkretnej wady („endpoint zwraca sukces mimo błędu zapisu do bazy") ocenia autorka ręcznie (zob. niżej i Fazę 3).
- `no-data`: `outcome === "incomplete"`, `review.testRiskCoverage === null` i `notAssessed` zawiera dokładnie jeden wpis `{ criterion: "testRiskCoverage", reason: "no-data" }`.
- Brak asercji `cost`; czas i tokeny tylko raportowane. Brak asercji modelowych.
- Ocena merytoryczna jest ręczna i opisana w `expectations.md` jako lista pytań kontrolnych na przypadek (fałszywe alarmy, trafność `summary`/`note`). Dla `bug` wymagane jest konkretne wskazanie wady: z `summary` lub `notAssessed[].note` musi wynikać, że endpoint zwraca sukces mimo błędu zapisu do bazy (zignorowany `error`), co przeczy opisowi PR. Ogólna uwaga o jakości kodu, samo `failed` albo niska ocena nie spełniają tego wymagania. Wynik oceny (`wada wskazana: tak / częściowo / nie`, z cytatem fragmentu) jest osobnym polem w `results.md`, niezależnym od wyniku asercji; komórka `bug` jest „wykryta" tylko przy `tak`. Dopasowanie słów kluczowych nie zastępuje tej oceny.

#### 3. Wybór dwóch modeli

**File**: `tools/code-review-evals/promptfooconfig.yaml` (etykiety A i B), `README.md`

**Intent**: Kandydaci pochodzą z pickera `/model` autorki (bez żądania do modelu), a nie z założeń z dokumentacji.

**Contract**: autorka uruchamia `/model`, wkleja listę (łącznie z wierszami „Requires usage credits") i wybiera dwa modele spoza wierszy rozliczanych z usage credits; identyfikatory dla `query()` ustala się z listy i dokumentacji, a rozbieżność alias/ID zgłasza się do autorki. Do konfiguracji trafiają dokładne identyfikatory; bez `fallbackModel`. Bez prób modelowych na tym etapie.

#### 4. Zamrożenie

**File**: `tools/code-review-evals/src/fingerprint.ts` (użycie), `context/changes/code-review-evals/results.md` (szkielet)

**Intent**: Zapisać odcisk „przed pilotażem" i szkielet tabeli wyników.

**Contract**: `npm run fingerprint` wypisuje hash i składniki (łącznie z asercjami i całym domknięciem importów `run.ts`); ten sam hash wraca w Fazie 3 i 4. Szkielet `results.md` ma osobną kolumnę „wada wskazana" (tak / częściowo / nie, z cytatem) obok wyniku asercji.

### Success Criteria:

#### Automated Verification:

- Konfiguracja parsuje się bez wywołań modeli: walidacja konfiguracji promptfoo (dokładne polecenie ustalone w Fazie 1.5)
- Testy jednostkowe asercji na zapisanych wynikach (poprawny, błędny, brak danych, `status: error`, `skipped`) przechodzą: `npm test` w `tools/code-review-evals`; w tym: `is-json` odrzuca tekst niebędący JSON-em, a `REVIEW_SCHEMA` odrzuca niepoprawne `review` tylko dla `status: reviewed`
- Każdy diff przechodzi `prepareInput` poniżej limitu (test)
- Preflight przechodzi: `npm run preflight`
- `npm run fingerprint` wypisuje stabilny hash przy dwóch kolejnych uruchomieniach
- Brak zmian w zabronionych ścieżkach (jak w Fazie 1)

#### Manual Verification:

- Autorka przeczytała i zatwierdziła `expectations.md` (w tym kryterium konkretnej wady dla `bug`) oraz diffy (fikcyjne, bez prywatnych danych) przed jakimkolwiek uruchomieniem modelu
- Autorka wybrała dwa modele z pickera `/model` i potwierdziła, że żaden nie jest rozliczany z usage credits; extra usage na koncie potwierdzone jako wyłączone
- Oczekiwania zatwierdzone przed pilotażem (zapisany SHA commita albo hash plików z odcisku)

---

## Faza 3: Pilotaż

### Overview

Jedno uruchomienie: przypadek „celowy błąd" na modelu A. Po nim stop.

### Changes Required:

#### 1. Uruchomienie pilotażu

**File**: `tools/code-review-evals/` (komenda), `tools/code-review-evals/results/<data>-bug-A.json`

**Intent**: Jedno wywołanie `runReview()` przez promptfoo na standardowym uwierzytelnianiu Agent SDK.

**Contract**: przed uruchomieniem zgoda autorki w rozmowie, `npm run preflight`, zapis odcisku; polecenie ze stałymi flagami `--no-cache`, `--max-concurrency 1`, `repeat` = 1, filtrem na jedną komórkę; wyjście do pliku JSON. Bez ponowienia po błędzie, niezależnie od wyniku. Wynik (także `error`, `timeout`, `invalid-output`) jest rejestrowany jako wynik komórki.

#### 2. Zapis i ocena

**File**: `context/changes/code-review-evals/results.md`

**Intent**: Wiersz pilotażu z `outcome`, ocenami, `notAssessed`, `verdict`, czasem, tokenami, szacunkiem kosztu SDK (oznaczonym jako szacunek), odciskiem i wynikiem asercji; miejsce na ręczną ocenę autorki.

**Contract**: wiersz zawiera odcisk, `git rev-parse HEAD` i informację o niezacommitowanych zmianach w plikach z odcisku. Wynik asercji i ocena „wada wskazana" są zapisane osobno: przejście asercji `failed` + ocena < 5 przy „wada wskazana: nie" jest raportowane jako „asercje przeszły, wady nie wskazano", a nie jako wykrycie. Obserwacje o progu 5 tylko jako notatka.

### Success Criteria:

#### Automated Verification:

- Dokładnie jedna komórka została uruchomiona: plik wyniku zawiera jeden wynik, jeden model, jeden przypadek
- Odcisk po uruchomieniu równa się odciskowi zapisanemu przed (`npm run fingerprint`)
- Plik wyniku nie zawiera surowych `logs` ani wartości zmiennych środowiskowych (grep po nazwach zmiennych)
- Brak zmian w zabronionych ścieżkach

#### Manual Verification:

- Autorka wyraziła zgodę przed uruchomieniem i oceniła wynik merytorycznie: czy wskazano konkretną wadę (sukces mimo błędu zapisu; samo `failed` i ocena < 5 nie wystarczają) oraz czy są fałszywe alarmy
- Autorka zdecydowała: uruchamiamy pozostałe pięć komórek albo zmieniamy konfigurację (wtedy pilotaż się nie liczy)

---

## Faza 4: Pozostała macierz po zgodzie

### Overview

Pięć brakujących komórek, tylko po wyraźnej zgodzie autorki po Fazie 3.

### Changes Required:

#### 1. Uruchomienie pozostałych pięciu komórek

**File**: `tools/code-review-evals/results/`

**Intent**: Dokończyć macierz 3 × 2 przy niezmienionej konfiguracji.

**Contract**: najpierw porównanie odcisku z zapisanym w pilotażu. Jeśli różny, nie uruchamiamy nic, pilotaż przestaje się liczyć i pytamy autorkę. Jeśli identyczny, pięć uruchomień z tymi samymi flagami i filtrami wybierającymi pozostałe komórki, bez powtórek i bez ponawiania błędów.

#### 2. Tabela sześciu wyników i wnioski

**File**: `context/changes/code-review-evals/results.md`

**Intent**: Jedna tabela 3 × 2: wynik asercji, dla `bug` osobno „wada wskazana" (zgodnie z Fazą 2), `outcome`, oceny, `notAssessed`, `verdict`, czas, tokeny, szacunek kosztu SDK, rozbieżności między modelami; ręczna ocena autorki; notatka o progu 5 jako obserwacja (bez zmiany progu); lista pytań na kolejną zmianę (m.in. LLM-as-a-judge, `findings`).

**Contract**: wyraźnie zapisane, że nie wykonano `llm-rubric` ani oceny modelowej oraz że koszt to szacunek SDK, nie rachunek ani zużycie limitu planu.

### Success Criteria:

#### Automated Verification:

- Łącznie 6 różnych komórek (3 przypadki × 2 modele) ma po jednym wyniku: sprawdzenie plików w `results/`
- Odcisk wszystkich sześciu wyników jest taki sam
- Zero ponowień: żadna komórka nie ma więcej niż jednego pliku wyniku
- Brak zmian w zabronionych ścieżkach; testy pakietu nadal przechodzą

#### Manual Verification:

- Autorka przejrzała tabelę i dopisała ocenę merytoryczną każdego wyniku, w tym „wada wskazana" dla obu wyników `bug`
- Autorka zdecydowała, co dalej (np. osobna zmiana na LLM-as-a-judge albo korektę progu/promptu)

---

## Testing Strategy

### Unit Tests:

- Provider: wybór modelu z konfiguracji, brak `fallbackModel`, mapowanie `Metrics` na `tokenUsage`/`cost`, `metrics: null`, zachowanie dla `status: error`/`skipped`, przechwycenie `modelUsage`.
- Asercje: poprawny wynik, błędny wynik, `null`/`no-data`, `notAssessed` z błędnym powodem, zły model w `modelsUsed`.
- Preflight (obecność zmiennych bez odczytu wartości) i odcisk (stabilność, wrażliwość na zmianę pliku i modelu).

### Integration Tests:

- Provider pod fałszywym `queryFn` załadowany przez promptfoo bez prawdziwego SDK (kontrola loadera i `file://`).

### Manual Testing Steps:

1. Przed Fazą 3 przeczytać `expectations.md` i potwierdzić nieustawione klucze API.
2. Po pilotażu ocenić merytorycznie wynik i zdecydować o reszcie macierzy.
3. Po Fazie 4 przejrzeć tabelę i dopisać oceny.

## Performance Considerations

Sześć wywołań `query()` w sumie (3 × 2), po jednym na komórkę, kolejno (`maxConcurrency: 1`), bez cache i bez powtórek. Każde jest ograniczone istniejącymi `maxTurns: 2`, `maxBudgetUsd: 0.5` i timeoutem 10 min z `runReview`. `maxBudgetUsd` to miękki limit oparty na szacunku SDK (`research.md`), więc limitem całego zestawu jest liczba komórek.

## Migration Notes

Nie dotyczy: nic w produkcji się nie zmienia. Pakiet evali można usunąć jednym katalogiem plus dwoma wpisami wykluczeń.

## References

- Related research: `context/changes/code-review-evals/research.md`
- Kontrakt recenzenta: `tools/code-reviewer/src/run.ts:72-157`, `outcome.ts:29-38`, `review-schema.ts:139-193`
- Poprzednia zmiana (kontekst, próg 5, `incomplete`): `context/changes/ci-cd-code-review/plan-brief.md`
- Dokumentacja promptfoo (custom provider, asercje): promptfoo.dev/docs/providers/custom-api, /docs/configuration/expected-outputs/deterministic

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pakiet i provider (bez modeli)

#### Automated

- [x] 1.1 Zależności zainstalowane bez skryptów: `npm ci --ignore-scripts` w `tools/code-review-evals`
- [x] 1.2 Testy providera, preflightu i odcisku przechodzą: `npm test` w `tools/code-review-evals`
- [x] 1.3 Typecheck przechodzi: `npm run typecheck` w `tools/code-review-evals`
- [x] 1.4 Testy recenzenta nadal przechodzą bez zmian: `npm test` w `tools/code-reviewer`
- [x] 1.5 Root lint i typy nie widzą nowego pakietu: `npm run lint` i `npx astro check` w katalogu głównym
- [x] 1.6 Brak zmian w zabronionych ścieżkach: `git diff --name-only` nie zawiera `tools/code-reviewer/`, `.github/`, `context/foundation/`, `context/archive/`
- [x] 1.7 Test providera potwierdza: model z konfiguracji trafia do `options.model`, brak `fallbackModel`, brak `config.model` rzuca błąd
- [x] 1.8 Odcisk obejmuje całe domknięcie importów `run.ts` (w tym `errors.ts`) i pliki asercji; zmiana któregokolwiek z nich zmienia hash (test)

#### Manual

- [x] 1.9 Wynik kontroli (a)–(e) zapisany w README i przejrzany przez autorkę
- [x] 1.10 Autorka potwierdza, że instalacja nie wymagała skryptów (albo świadomie je dopuściła)

### Phase 2: Fikcyjne diffy, oczekiwania i modele

#### Automated

- [x] 2.1 Konfiguracja parsuje się bez wywołań modeli (polecenie walidacji ustalone w Fazie 1)
- [x] 2.2 Testy jednostkowe asercji na zapisanych wynikach (poprawny, błędny, brak danych, `status: error`, `skipped`) przechodzą: `npm test` w `tools/code-review-evals`; w tym: `is-json` odrzuca tekst niebędący JSON-em, a `REVIEW_SCHEMA` odrzuca niepoprawne `review` tylko dla `status: reviewed`
- [x] 2.3 Każdy diff przechodzi `prepareInput` poniżej limitu (test)
- [x] 2.4 Preflight przechodzi: `npm run preflight`
- [x] 2.5 `npm run fingerprint` wypisuje stabilny hash przy dwóch kolejnych uruchomieniach
- [x] 2.6 Brak zmian w zabronionych ścieżkach (jak w Fazie 1)

#### Manual

- [x] 2.7 Autorka przeczytała i zatwierdziła `expectations.md` (w tym kryterium konkretnej wady dla `bug`) oraz diffy (fikcyjne, bez prywatnych danych) przed jakimkolwiek uruchomieniem modelu
- [x] 2.8 Autorka wybrała dwa modele z pickera `/model`, potwierdziła brak rozliczenia z usage credits i wyłączone extra usage
- [x] 2.9 Oczekiwania zatwierdzone przed pilotażem (zapisany SHA commita albo hash plików z odcisku)

### Phase 3: Pilotaż

#### Automated

- [x] 3.1 Dokładnie jedna komórka została uruchomiona: plik wyniku zawiera jeden wynik, jeden model, jeden przypadek
- [x] 3.2 Odcisk po uruchomieniu równa się odciskowi zapisanemu przed
- [x] 3.3 Plik wyniku nie zawiera surowych `logs` ani wartości zmiennych środowiskowych
- [x] 3.4 Brak zmian w zabronionych ścieżkach

#### Manual

- [x] 3.5 Autorka wyraziła zgodę przed uruchomieniem i oceniła wynik merytorycznie: czy wskazano konkretną wadę (sukces mimo błędu zapisu; samo `failed` i ocena < 5 nie wystarczają) oraz czy są fałszywe alarmy
- [x] 3.6 Autorka zdecydowała: pozostałe pięć komórek albo zmiana konfiguracji (pilotaż się wtedy nie liczy)

### Phase 4: Pozostała macierz po zgodzie

#### Automated

- [x] 4.1 Łącznie 6 różnych komórek (3 przypadki × 2 modele) ma po jednym wyniku w `results/`
- [x] 4.2 Odcisk wszystkich sześciu wyników jest taki sam
- [x] 4.3 Zero ponowień: żadna komórka nie ma więcej niż jednego pliku wyniku
- [x] 4.4 Brak zmian w zabronionych ścieżkach; testy pakietu nadal przechodzą

#### Manual

- [x] 4.5 Autorka przejrzała tabelę i dopisała ocenę merytoryczną każdego wyniku, w tym „wada wskazana" dla obu wyników `bug`
- [x] 4.6 Autorka zdecydowała, co dalej (np. osobna zmiana na LLM-as-a-judge albo korekta progu/promptu)
