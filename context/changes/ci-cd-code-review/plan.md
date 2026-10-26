# CI/CD code review — plan implementacji

## Overview

Pierwszy, doradczy workflow GitHub Actions, który recenzuje PR-y do `master` agentem z `tools/code-reviewer/`. Agent dostaje tytuł, opis i diff PR-a, a jego kontrakt jawnie rozróżnia „brak danych do oceny” (`no-data`) i „kryterium nie dotyczy zmiany” (`not-applicable`). Deterministyczna bramka w pakiecie wyznacza wynik `error > failed > incomplete > passed` albo jawny skip. Workflow publikuje jeden sticky komentarz i etykietę wyniku `ai-cr:*`. Nowe commity tylko unieważniają wynik (`ai-cr:stale`) bez wywołania modelu. Uwierzytelnienie odbywa się tokenem subskrypcji `CLAUDE_CODE_OAUTH_TOKEN`, bez dodatkowo płatnego API.

## Current State Analysis

- Agent działa tylko lokalnie. Wczytuje sam diff z pliku lub stdin (`tools/code-reviewer/src/index.ts:23-34`), a prompt to `Zrecenzuj poniższy diff.\n\n${diff}` (`index.ts:37`). Nie przyjmuje tytułu ani opisu PR-a.
- Wywołanie: `model: "claude-sonnet-5-5"`, `tools: []`, `settingSources: []`, `maxTurns: 2`, `maxBudgetUsd: 0.5` i `outputFormat` z JSON Schema (`index.ts:36-47`).
- Każdy błąd (subtype ≠ success, niezgodność ze schematem, ocena spoza 1–10, brak wyniku) kończy się kodem 1 i komunikatem na stderr (`index.ts:51-66,82,85-88`). Werdykt `fail` kończy się kodem 0. Metryki i błędy trafiają razem na stderr (`index.ts:69-79,86`).
- Schemat ma sześć ocen `z.number()` bez zakresu oraz pola `verdict: "pass" | "fail"` i `summary` (`tools/code-reviewer/src/review-schema.ts:16-61`). `SYSTEM_PROMPT` (`review-schema.ts:7-12`) nie zawiera zasad wspólnych, kryteriów ani reguł projektu z `requirements.md`. `SCORE_FIELDS` żyje w `index.ts:8-15`, a nie przy schemacie.
- Kontrakt jest dziś wewnętrznie sprzeczny dla kryterium bez czego ocenić. Schemat wymaga liczby, walidacja odrzuca wszystko poza 1–10, a `requirements.md:87` zabrania liczby neutralnej (badanie, D3-D).
- Pakiet nie ma testów. Root Vitest obejmuje tylko `src/**` i `scripts/**` (`vitest.config.ts`), a root `tsconfig.json` (`exclude`) i `eslint.config.js:89` wykluczają `tools/code-reviewer/`. Obecny CI w ogóle nie sprawdza pakietu.
- CI: jedyny workflow to `.github/workflows/ci.yml` (joby `ci` i `smoke`). Nie ma bloku `permissions`, akcje są na tagach `@v4`, nie ma `.github/actions/`. Repo ma `default_workflow_permissions = read`, bez ochrony `master` i bez CODEOWNERS (badanie, sekcja 6.1).

## Desired End State

- PR do `master` z gałęzi tego repo, otwarty jako nie-draft albo przełączony na `ready_for_review`, dostaje jedno review. Ponowne review uruchamia dodanie etykiety `ai-cr:review`.
- Po review PR ma jeden sticky komentarz bota i dokładnie jedną etykietę wyniku: `ai-cr:passed`, `ai-cr:failed`, `ai-cr:incomplete` albo `ai-cr:error`. Jawny skip nie daje etykiety wyniku.
- Status joba: `failed` i `error` → czerwony; `passed`, `incomplete` i skip → zielony.
- Push nowych commitów nie wywołuje modelu. Zdejmuje etykietę wyniku, ustawia `ai-cr:stale` i oznacza komentarz jako nieaktualny, zachowując SHA ocenionego commita.
- Wynik rozpoczęty dla starszego SHA nigdy nie nadpisuje stanu po `synchronize`.
- PR z forka lub od Dependabota dostaje jawny skip z powodem w job summary, bez modelu i bez etykiet.
- Koszt każdego przebiegu jest logowany jako „szacunek SDK, nie rachunek”.
- Weryfikacja: testy i typecheck pakietu w jobie `ci`, ręczne scenariusze bez sekretu w fazie 2 i jeden przebieg SDK (jedno `query()`) w fazie 3.

### Key Discoveries:

- Structured output Claude obsługuje typ `null`, `anyOf`, `enum`, `required` i `additionalProperties: false`. Nie obsługuje `minimum`/`maximum`/`multipleOf`, `minLength`/`maxLength` ani `minItems` > 1 (błąd 400). Źródło: platform.claude.com, _Structured outputs → JSON Schema limitations_. Zakres 1–10, niepusty `note` i unikalność wpisów muszą więc być sprawdzane w kodzie walidacji, a nie w schemacie.
- Agent SDK waliduje schemat jako draft-07, a `query()` w trybie single-shot rzuca wyjątek po zwróceniu wyniku błędu (np. `error_max_structured_output_retries`). Źródło: code.claude.com, _Agent SDK → Structured outputs_. Kategorię błędu trzeba więc ustalić z ostatniego `result` przed wyjątkiem.
- Wartości `enum` mogą wrócić z inną wielkością liter (to samo źródło, _Invalid outputs_). Walidacja zostaje ścisła, więc taka odpowiedź daje `invalid-output`.
- `ANTHROPIC_API_KEY` ma pierwszeństwo przed `CLAUDE_CODE_OAUTH_TOKEN` i przełączyłby rozliczanie na API (badanie 4.A). Krok z SDK musi go jawnie usuwać ze środowiska.
- Kontekst `secrets` nie jest dostępny w composite action, więc token przechodzi jako `input` (badanie, sekcja 3).
- Zdarzenia wywołane przez `GITHUB_TOKEN` nie uruchamiają workflow, więc zmiany etykiet przez workflow nie tworzą pętli (badanie, sekcja 3).
- `pull_request` ma domyślnie tylko `opened`/`synchronize`/`reopened`, więc `labeled` i `ready_for_review` trzeba dodać w `types:` (badanie, sekcja 3).
- Lekcja „Assert status and body type before content” (`context/foundation/lessons.md`): kroki shell czytające wynik najpierw sprawdzają kod wyjścia i `jq -e 'type == "object"'`, dopiero potem pola.
- Lekcja „Bound user-driven CPU work”: limit wejścia przed pracą, czytelny błąd i jedna stała.
- W lockfile pakietu `hasInstallScript` mają tylko `esbuild` i `fsevents` (badanie 6.1). Działanie bez skryptów (`--ignore-scripts`) sprawdzamy w fazie 1.

## What We're NOT Doing

- Ewaluacje promptfoo i kalibracja progu 5. To osobna zmiana, a próg jest tymczasowy.
- Zmiany ochrony gałęzi, rulesetów i CODEOWNERS oraz dodanie review do wymaganych checków. Review jest doradcze.
- `pull_request_target`, podział na `workflow_run` i environment z akceptacją (D7 C/D/E). C pozostaje możliwym kierunkiem na później, nie rozszerzeniem tej zmiany.
- Licznik przebiegów (dzienny lub na PR). W MVP liczbę przebiegów ograniczają wyzwalacze, a `concurrency` porządkuje tylko równoległość.
- Review przy `synchronize` i `reopened`.
- Ciche obcinanie wejścia. Przekroczenie limitu daje błąd.
- Review PR-ów z forków i od Dependabota oraz obchodzenie ograniczeń sekretów.
- Fallback na `claude -p` i `claude-code-action`. Wprowadzenie któregoś z nich wymaga nowej decyzji.
- Dopasowanie biznesowe i architektoniczne zmian (odłożone w requirements).
- Generowanie tokenu i tworzenie sekretu. Robi to autorka.
- Przypinanie do SHA akcji w istniejących jobach `ci`/`smoke` (osobne utwardzenie).
- Pomiar zużycia limitów Pro. Obserwacja jest ręczna i nie jest warunkiem zakończenia.
- Więcej niż jeden przebieg SDK (jedno uruchomienie `query()`) w fazie 3 bez osobnej zgody autorki oraz automatyczne ponawianie całego review gdziekolwiek w łańcuchu.
- Zmiany w `context/archive/` i `context/foundation/`.

## Implementation Approach

Logika decyzyjna to czyste, testowalne moduły TypeScript w `tools/code-reviewer/`. Zmiany kontraktu idą w kolejności z `CLAUDE.md`: schemat → prompt → walidacja → bramka. Pakiet obejmuje budowę wejścia z limitem, walidację, wyprowadzenie wyniku, kategorie błędów i render komentarza. CLI zapisuje wynik, metryki i treść komentarza do plików, a nie na stdout/stderr.

Composite action w `.github/actions/code-review/` jest cienka: instaluje pakiet, buduje diff, uruchamia CLI z tokenem tylko w jednym kroku i zwraca `outputs`. Workflow `.github/workflows/ai-code-review.yml` odpowiada za wyzwalanie, uprawnienia, routing (review / unieważnienie / skip), kontrolę bieżącego `head.sha`, publikację komentarza i etykiet, a na końcu za krok bramki, który przekłada `failed`/`error` na czerwony job.

Model zaufania (D7-B, jednoosobowe MVP) jest **ograniczeniem świadomie zaakceptowanym**. Przy `pull_request` z gałęzi tego repo workflow, composite action, kod recenzenta i lockfile pochodzą z merge commitu PR-a. Kod PR-a może więc uzyskać dostęp do `CLAUDE_CODE_OAUTH_TOKEN` mimo utwardzenia (akcje po SHA, `--ignore-scripts`, minimalne `permissions`, sekret tylko w `env` jednego kroku, `persist-credentials: false`). Utwardzenie ogranicza przypadkowe ścieżki wycieku, ale nie chroni przed celowo zmienionym kodem w PR-ze. **Przed dopuszczeniem innych osób z prawem zapisu do repo trzeba wrócić do modelu zaufania** (kierunek C: `pull_request_target` z kodem z `master`).

## Critical Implementation Details

- **Kolejność publikacji i bramki.** Komentarz i etykieta wyniku są publikowane _przed_ krokiem bramki, żeby `failed` nie przerwał publikacji. Nieudana publikacja (błąd API) sama kończy job błędem, także przy wyniku `error`.
- **Wyścig SHA.** Ocenianym SHA jest `pull_request.head.sha` z payloadu zdarzenia, nie merge commit. Bezpośrednio przed publikacją workflow pobiera przez API bieżący `head.sha`. Przy różnicy nie publikuje niczego (ani etykiet, ani komentarza), zapisuje „wynik dla `<sha>` odrzucony jako nieaktualny” w job summary i kończy się zielono. `concurrency` z `cancel-in-progress` nie jest tu gwarancją, tylko porządkiem.
- **Publikacja jest dozwolona tylko jawnie.** Krok kontroli SHA ustawia `publish=true` wyłącznie po udanym odczycie `head.sha` (poprawny 40-znakowy hex) równym ocenionemu SHA. Każdy inny stan oznacza brak publikacji: różnica SHA (`publish=false`), błąd API, brak wyniku kontroli (krok pominięty albo zakończony błędem) i anulowanie runu. Kroki publikacji i bramki mają warunek `!cancelled() && steps.head-check.outputs.publish == 'true'`, nigdy `always()` ani `publish != 'false'`. Pusty output nie może otworzyć publikacji. Sam krok kontroli SHA ma `!cancelled()`, żeby uruchomić się także po nieudanej composite action i dopuścić publikację wyniku `error`.
- **Zdejmowanie `ai-cr:review`.** Run z etykiety zdejmuje `ai-cr:review` _na początku_, przed modelem. Anulowany run nie zostawia wtedy etykiety, a ponowne dodanie znowu wyzwala review. 404 przy usuwaniu etykiety jest tolerowane. Zbiór etykiet wynikowych nigdy nie obejmuje `ai-cr:review`.
- **Kolejność kontroli wejścia w CLI:** pusty diff lub same pominięte pliki → skip; limit 60 000 znaków → `input-too-large`; brak tokenu (tylko z flagą CI) → `missing-secret`; dopiero potem SDK. Dzięki temu skip i limit da się sprawdzić w fazie 2 bez sekretu.
- **`concurrency` a nieistotne zdarzenia.** Grupa jest per PR na poziomie joba, który ma filtr `if`. W fazie 2 trzeba potwierdzić, że dodanie niezwiązanej etykiety nie anuluje trwającego review.
- **Tytuł i opis PR-a to niezaufane dane w shellu.** W skryptach `run` trafiają przez `env`, nigdy przez interpolację `${{ }}`.

## Phase 1: Pakiet `tools/code-reviewer/` — kontrakt, bramka, CLI, testy

### Overview

Zmiana kontraktu w kolejności schemat → prompt → walidacja → bramka, potem budowa wejścia, kategorie błędów, render komentarza i CLI na plikach. Wszystko jest testowane `node:test` przez `tsx --test`, bez sekretu i bez wywołań modelu. Pakiet trafia do joba `ci`.

### Changes Required:

#### 1. Schemat (kontrakt)

**File**: `tools/code-reviewer/src/review-schema.ts`

**Intent**: Pozwolić wyrazić brak oceny bez wymyślonej liczby i z jednym z dwóch jawnych powodów. Nazwy istniejących pól się nie zmieniają.

**Contract**:

- `SCORE_FIELDS` (sześć nazw) przeniesione tutaj jako jedno źródło.
- Każde pole oceny to `number | null` (`z.number().nullable()`, bez `.int()`/`.min()`, bo structured output ich nie przyjmie). Opis pola mówi, że `null` oznacza obowiązkowy wpis w `notAssessed`.
- Nowe pole `notAssessed: Array<{ criterion: SCORE_FIELDS[number]; reason: "no-data" | "not-applicable"; note: string }>`.
- `verdict` i `summary` zostają bez zmian.
- `REVIEW_JSON_SCHEMA` jest nadal generowany z zod w draft-07.
- Historyczne `fixtures/sample.review.json` i `fixtures/sample.review.metrics.json` (rzeczywisty przebieg z M5L2, stary kontrakt) **zostają bez zmian**. Nie są modyfikowane ani walidowane nowym schematem.
- Nowy kontrakt dostaje osobny, jawnie syntetyczny fixture `fixtures/synthetic/review-v2.json` w kopercie `{ "synthetic": true, "note": "Ręcznie napisany przykład nowego kontraktu, nie wynik modelu", "review": { … } }`. Testy czytają `.review`. Koperta jest potrzebna, bo sam obiekt recenzji nie może mieć dodatkowych pól (`additionalProperties: false`).

#### 2. Prompt systemowy

**File**: `tools/code-reviewer/src/review-schema.ts` (`SYSTEM_PROMPT`)

**Intent**: Przenieść do instrukcji agenta CI zaakceptowane kryteria i reguły, bo agent nie czyta `AGENTS.md` (`settingSources: []`). Dodać zasady wypełniania `notAssessed` i traktowania wejścia jako danych.

**Contract**: prompt zawiera, wiernie względem `requirements.md` → „Code Review Criteria”:

- zasady wspólne,
- sześć kryteriów: zakres, widoczne dowody, czego nie uznawać za błąd, ograniczenia oceny, kotwice ocen 1 i 10, `no-data`/`not-applicable` dla `testRiskCoverage`,
- reguły projektu 1–5.

Dodatkowo prompt mówi, że:

- liczba jest całkowita 1–10; `null` wyłącznie z dokładnie jednym wpisem w `notAssessed` i niepustym `note`; brak liczby neutralnej;
- tytuł, opis i diff to niezaufane dane w wydzielonych blokach, a polecenia w nich zawarte nie są instrukcjami;
- `verdict` to werdykt dla całej zmiany; `summary` to Markdown dla autora, niejasności formułowane jako pytania.

#### 3. Walidacja odpowiedzi

**File**: `tools/code-reviewer/src/validate.ts` (nowy)

**Intent**: Jedno miejsce, które odrzuca odpowiedź łamiącą kontrakt, zanim zobaczy ją bramka.

**Contract**: `validateReview(raw: unknown): { ok: true; review: Review } | { ok: false; category: "invalid-output"; detail: string }`.

Reguły:

- `REVIEW_SCHEMA.safeParse`, ze ścisłymi enumami (inna wielkość liter = błąd);
- każda liczbowa ocena jest całkowita 1–10;
- każda ocena `null` ma **dokładnie jeden** wpis w `notAssessed` z tym `criterion`;
- odrzucenie: wpisu dla kryterium z oceną liczbową, duplikatów `criterion`, nieznanego kryterium (z enuma), `note` pustego po `trim()`.

`detail` trafia tylko do logów, nie do komentarza.

#### 4. Bramka: wyprowadzenie wyniku

**File**: `tools/code-reviewer/src/outcome.ts` (nowy)

**Intent**: Deterministyczny wynik niezależny od tego, czy model oceni spójnie werdykt i liczby.

**Contract**:

- Stała `PASS_THRESHOLD = 5`, z komentarzem „tymczasowy, do weryfikacji w ewaluacjach”.
- `deriveOutcome(review): "failed" | "incomplete" | "passed"`:
  - `failed`, gdy `verdict === "fail"` **lub** dowolna liczbowa ocena `< PASS_THRESHOLD` (4 → fail, 5 → nie);
  - `incomplete`, gdy nie `failed` i istnieje wpis `reason: "no-data"`;
  - w pozostałych przypadkach `passed`.
- `not-applicable` nie wpływa na wynik. Gdy wszystkie oceny są `null`, decyduje `verdict`.
- Pełny zbiór wyników CLI: `passed | failed | incomplete | error | skipped`, z pierwszeństwem `error > failed > incomplete > passed`.
- Stałe etykiet:
  - `RESULT_LABELS = { passed: "ai-cr:passed", failed: "ai-cr:failed", incomplete: "ai-cr:incomplete", error: "ai-cr:error" }`,
  - `STALE_LABEL = "ai-cr:stale"`,
  - `TRIGGER_LABEL = "ai-cr:review"` (osobno, nigdy w zbiorze do zdejmowania).
- `labelsToRemove(outcome)` zwraca pozostałe etykiety wynikowe oraz `ai-cr:stale`, bez `ai-cr:review`. Dla `skipped` zwraca wszystkie etykiety wynikowe i `stale`.

#### 5. Budowa wejścia i limit

**File**: `tools/code-reviewer/src/input.ts` (nowy)

**Intent**: Zbudować prompt z trzech wejść i odmówić przed SDK, gdy wejście jest za duże albo nie ma czego oceniać. Bez cichego obcinania.

**Contract**:

- `MAX_INPUT_CHARS = 60_000` (jedna stała; liczone w znakach Unicode na tytule + opisie + diffie łącznie).
- `prepareInput({ title, body, diff, excludedFiles }): { kind: "ok"; prompt } | { kind: "skip"; reason } | { kind: "too-large"; chars }`.
- Skip z powodem, gdy diff jest pusty: „wyłącznie pominięte pliki: …”, jeśli `excludedFiles` nie jest puste, w przeciwnym razie „pusty diff”.
- Prompt zawiera tytuł, opis i diff w wydzielonych blokach (np. `<pr_title>`, `<pr_body>`, `<diff>`). Pusty opis jest oznaczony jako pusty, a nie pominięty.
- Limit nie zastępuje `maxBudgetUsd: 0.5` ani `maxTurns: 2`. Obie wartości zostają.

#### 6. Kategorie błędów

**File**: `tools/code-reviewer/src/errors.ts` (nowy)

**Intent**: Zamknięty zbiór kategorii z bezpiecznymi komunikatami po polsku do komentarza, bez surowego stderr, sekretów i pełnej odpowiedzi dostawcy.

**Contract**:

- Kategorie: `missing-secret`, `input-too-large`, `sdk-error`, `budget-exceeded` (`error_max_budget_usd`), `max-turns` (`error_max_turns`), `structured-output-retries` (`error_max_structured_output_retries`), `invalid-output`, `no-result`, `unexpected`.
- `categoryFromSubtype(subtype)` mapuje subtype wyniku SDK; nieznany subtype daje `sdk-error`.
- `safeMessage(category)` to stały tekst dla każdej kategorii. Dla `input-too-large` dochodzi liczba znaków i limit.

#### 7. Render komentarza i oznaczenie `stale`

**File**: `tools/code-reviewer/src/comment.ts` (nowy)

**Intent**: Jedna treść sticky komentarza dla każdego wyniku i idempotentne oznaczenie nieaktualności.

**Contract**:

- `renderComment({ result, reviewedSha, runUrl, excludedFiles, metrics? })` zwraca Markdown zaczynający się od znaczników `<!-- ai-cr:sticky -->` i `<!-- ai-cr:sha=<sha> -->`.
- Treść:
  - wynik i oceniony SHA, link do przebiegu Actions;
  - dla recenzji: tabela 6 ocen (`—` dla `null`), lista `notAssessed` (kryterium, powód, `note`), przy `incomplete` wprost „niepełna ocena: brakujące dane” i wskazówka, że można wskazać istniejące testy lub uzupełnić opis, a potem dodać `ai-cr:review`;
  - `summary` modelu;
  - lista pominiętych plików z uwagą o ograniczeniu oceny zależności;
  - koszt z dopiskiem „szacunek SDK, nie rachunek”;
  - dla błędu tylko `safeMessage`; dla skipu powód.
- W tekście pochodzącym od modelu `@wzmianki` są neutralizowane, żeby nie powiadamiać użytkowników.
- `markStale(body, newHeadSha)` dodaje lub podmienia baner „nieaktualne: oceniono `<sha>`, nowe commity do `<newHeadSha>`, dodaj `ai-cr:review`”. Zachowuje znacznik SHA ocenionej wersji, a powtórzone wywołanie nie mnoży banerów.

#### 8. CLI na plikach

**File**: `tools/code-reviewer/src/index.ts`, `tools/code-reviewer/src/stale.ts` (nowy), `tools/code-reviewer/package.json`

**Intent**: Maszynowo jednoznaczne odróżnienie „recenzja wykonana” od „błąd”, z metrykami oddzielonymi od komunikatów. Lokalne użycie z samym diffem zostaje.

**Contract**:

- `review` przyjmuje flagi:
  - `--title-file`, `--body-file`, `--diff-file`, `--excluded-file` (lista ścieżek, po jednej w linii),
  - `--out <result.json>`, `--metrics <metrics.json>`, `--comment-out <comment.md>`,
  - `--sha`, `--run-url`,
  - `--require-token` (w CI: pusty `CLAUDE_CODE_OAUTH_TOKEN` daje `missing-secret` bez SDK).
- Pozycyjny diff (`npm run review -- fixtures/sample.diff`) nadal działa dla lokalnego użycia.
- `result.json` to jeden z kształtów: `{ status: "reviewed", outcome, review }`, `{ status: "error", outcome: "error", category }` albo `{ status: "skipped", outcome: "skipped", reason }`.
- Kod wyjścia: 0 dla `reviewed` (także `failed`) i `skipped`, 1 dla `error`. Plik wyniku i komentarz powstają także przy błędzie.
- Kategoria błędu SDK pochodzi z ostatniego `result` sprzed wyjątku, bo `query()` rzuca po wyniku błędu. Wyjątek bez wcześniejszego `result` daje `unexpected`.
- **Jeden przebieg SDK na wywołanie CLI:** `query()` jest uruchamiane dokładnie raz. Ani CLI, ani composite action, ani workflow nie ponawiają całego review po błędzie, który kończy się wynikiem `error`. Wewnętrzne tury i żądania modelowe w ramach tego jednego `query()` (do `maxTurns: 2`, w tym ewentualne wewnętrzne ponowienia structured output SDK zakończone `error_max_structured_output_retries`) należą do tego samego przebiegu. Ich liczbę raportuje `num_turns` w `metrics.json`.
- Logika przebiegu jest wydzielona jako `runReview(input, queryFn)` ze wstrzykiwaną funkcją `query`, więc test może policzyć jej wywołania bez SDK. `index.ts` przekazuje prawdziwe `query()`.
- `metrics.json` zawiera `{ total_cost_usd_estimate, num_turns, duration_ms, usage }`. Surowe błędy idą na stderr tylko do logów.
- Komentarz w nagłówku `index.ts:2` uwzględnia, że auth lokalnie pochodzi z logowania, a w CI z `CLAUDE_CODE_OAUTH_TOKEN`, i że `ANTHROPIC_API_KEY` nigdy nie jest ustawiany.
- `stale.ts` to CLI `--in <body.md> --head-sha <sha> --out <body.md>` wokół `markStale`.
- Skrypty w `package.json`: `review`, `stale`, `test` (`tsx --test "src/**/*.test.ts"`), `typecheck`.

#### 9. Testy jednostkowe

**File**: `tools/code-reviewer/src/*.test.ts` (nowe), `tools/code-reviewer/fixtures/synthetic/*.json` (nowe)

**Intent**: Udowodnić reguły kontraktu i bramki bez modelu.

**Contract**:

- Przypadki z sekcji „Testing Strategy → Unit Tests”.
- Moduł SDK nie jest importowany w testach logiki: testowane moduły są czyste, a `index.ts` składa je z `query()`.
- Wszystkie nowe fixture'y leżą w `fixtures/synthetic/`, w kopercie z `"synthetic": true`.
- Historyczne `fixtures/sample.review*.json` nie są wejściem żadnego nowego testu.

#### 10. Pakiet w CI i `--ignore-scripts`

**File**: `.github/workflows/ci.yml` (job `ci`)

**Intent**: Objąć dziś niesprawdzany pakiet typecheckiem i testami oraz potwierdzić, że instalacja bez skryptów działa (wymóg D7-B dla fazy 2).

**Contract**:

- `actions/setup-node` dostaje `cache-dependency-path` z oboma lockfile'ami.
- Nowe kroki z `working-directory: tools/code-reviewer`: `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`.
- Kontrola obecności natywnej binarki SDK dla `linux-x64` po instalacji, na przykład `npm ls @anthropic-ai/claude-agent-sdk-linux-x64` zakończone sukcesem.

### Success Criteria:

#### Automated Verification:

- Typecheck pakietu przechodzi: `cd tools/code-reviewer && npm run typecheck`
- Testy pakietu przechodzą: `cd tools/code-reviewer && npm test`
- Czysta instalacja bez skryptów i testy na niej przechodzą: `cd tools/code-reviewer && rm -rf node_modules && npm ci --ignore-scripts && npm test`
- Test JSON Schema potwierdza `anyOf` z `null` dla 6 ocen, `additionalProperties: false` w każdym obiekcie oraz brak `minimum`/`maximum`/`multipleOf`/`minLength`/`maxLength` i `minItems` > 1
- Root lint i typecheck nadal przechodzą: `npm run lint` oraz `npx astro check`
- Root testy nadal przechodzą: `npm test`
- Historyczne fixture'y nietknięte: `git diff --exit-code master -- tools/code-reviewer/fixtures/sample.review.json tools/code-reviewer/fixtures/sample.review.metrics.json`

#### Manual Verification:

- Przegląd `SYSTEM_PROMPT` względem `requirements.md` → „Code Review Criteria”: zasady wspólne, 6 kryteriów i reguły 1–5 są obecne i wierne
- Render komentarza dla każdego wyniku (passed, failed, incomplete, error, skipped, stale) obejrzany na fixture'ach i czytelny, bez surowego stderr

**Implementation Note**: Po fazie 1 zatrzymaj się na ręczne potwierdzenie przed fazą 2. W tej fazie nie ma wywołań modelu.

---

## Phase 2: Composite action i workflow `ai-code-review.yml`

### Overview

Lokalna composite action uruchamia recenzenta, a workflow odpowiada za wyzwalanie, routing, uprawnienia, publikację i bramkę. Weryfikacja odbywa się na prawdziwym PR-ze **bez sekretu**, więc model nie zostaje wywołany ani razu.

### Changes Required:

#### 1. Composite action

**File**: `.github/actions/code-review/action.yml` (nowy)

**Intent**: Uruchomić recenzenta i zwrócić jego wynik. Composite nie ma efektów ubocznych w PR-ze i nie kończy się błędem z powodu wyniku recenzji.

**Contract**:

- Wejścia: `oauth-token` (niewymagane, żeby wykryć brak), `base-sha`, `head-sha`, `pr-title`, `pr-body`, `run-url`. Wyjścia: `outcome` (`passed|failed|incomplete|error|skipped`), `result-file`, `comment-file`, `metrics-file`.
- Kroki (każdy `run` z `shell: bash`):
  1. `actions/setup-node` przypięte do pełnego SHA (komentarz z wersją), z `node-version-file: .nvmrc` i cache po `tools/code-reviewer/package-lock.json`.
  2. `npm ci --ignore-scripts` w `tools/code-reviewer`.
  3. Budowa plików w `$RUNNER_TEMP/ai-cr/`:
     - tytuł i opis z `env`,
     - lista pominiętych plików z `git diff --name-only <base>...<head>`, filtrowana po `package-lock.json` w dowolnym katalogu,
     - diff `git diff --no-color --no-ext-diff <base>...<head> -- . ':(exclude,glob)**/package-lock.json'`.
  4. Uruchomienie `npm run review` z flagami z fazy 1 i `--require-token`:
     - `CLAUDE_CODE_OAUTH_TOKEN` ustawiony **tylko w `env` tego kroku**, a `ANTHROPIC_API_KEY` i `ANTHROPIC_AUTH_TOKEN` jawnie usunięte (`env -u`);
     - kod wyjścia zapisywany, krok kończy się 0.
  5. Wyznaczenie `outputs`: najpierw istnienie pliku i `jq -e 'type == "object"'`, potem `.outcome`. Brak pliku lub zły typ daje `outcome=error`.

#### 2. Workflow

**File**: `.github/workflows/ai-code-review.yml` (nowy)

**Intent**: Wyzwalanie, uprawnienia i efekty uboczne w PR-ze zgodnie z D4/D5, z jawnym zapisem ograniczenia D7.

**Contract**:

- Nagłówek: komentarz o modelu zaufania (D7-B, jednoosobowe MVP, kod PR-a może uzyskać dostęp do tokenu; przed dopuszczeniem innych osób z zapisem wrócić do modelu zaufania).
- `on.pull_request`: `branches: [master]`, `types: [opened, ready_for_review, labeled, synchronize]`.
- `permissions: {}` na poziomie workflow. Job ma `contents: read` i `pull-requests: write`.
- Filtr `if` joba:
  - `opened` i nie draft,
  - `ready_for_review`,
  - `labeled` z `label.name == 'ai-cr:review'`,
  - `synchronize`.
  - Pozostałe zdarzenia nie uruchamiają joba.
- `concurrency` na poziomie joba: grupa per numer PR-a, `cancel-in-progress: true`.
- Kroki:
  1. **Routing:**
     - `skip-fork`, gdy `head.repo.full_name != github.repository` albo autor PR-a to `dependabot[bot]`;
     - `invalidate` dla `synchronize`;
     - w pozostałych przypadkach `review`.
     - `skip-fork` zapisuje powód w `$GITHUB_STEP_SUMMARY` i kończy job zielono, bez dalszych kroków, etykiet i modelu.
  2. **`review`:** zdjęcie `ai-cr:review` przez `gh` (404 tolerowane) przed czymkolwiek innym, gdy zdarzenie to `labeled`.
  3. `actions/checkout` przypięty do SHA, `fetch-depth: 0`, `persist-credentials: false`.
  4. **`review`:** `uses: ./.github/actions/code-review` z `oauth-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`, `base-sha`/`head-sha` z `pull_request.base.sha`/`pull_request.head.sha` i tytułem/opisem z payloadu.
  5. **`review`, kontrola SHA** (`id: head-check`, `if: !cancelled()` w trybie `review`, więc uruchamia się także po nieudanej composite action):
     - `gh api repos/{repo}/pulls/{n} --jq .head.sha` i kontrola, że wynik ma format 40 znaków hex;
     - zgodność z ocenionym SHA → `publish=true`, jedyny stan dopuszczający publikację;
     - różnica → `publish=false`, wpis „odrzucony jako nieaktualny” w summary, job zielony;
     - błąd API albo zły format → krok kończy się błędem bez ustawienia `publish`, job czerwony, nic nie jest publikowane.
  6. **`review`, publikacja** (`if: !cancelled() && steps.head-check.outputs.publish == 'true'`; bez `always()`):
     - odszukanie sticky komentarza po znaczniku `<!-- ai-cr:sticky -->` **i** autorze `github-actions[bot]`, potem aktualizacja (PATCH) albo utworzenie;
     - dodanie etykiety wyniku (nie dla `skipped`) i zdjęcie `labelsToRemove`, z tolerancją 404;
     - gdy composite się nie powiodła (brak `outcome`), wynik to `error` ze stałym tekstem „błąd infrastruktury”;
     - każdy inny błąd API kończy krok błędem.
  7. **`review`, summary:** wynik, oceniony SHA i koszt z `metrics-file` jako „szacunek SDK, nie rachunek”.
  8. **`invalidate`:**
     - gdy PR ma etykietę wynikową albo sticky komentarz bota: instalacja pakietu (setup-node po SHA, `npm ci --ignore-scripts`), zdjęcie etykiet wynikowych, dodanie `ai-cr:stale` i aktualizacja komentarza przez `npm run stale` z nowym `head.sha`;
     - bez wcześniejszego wyniku nic się nie dzieje;
     - bez modelu i bez sekretu; job zielony.
  9. **Bramka** (`if: !cancelled() && steps.head-check.outputs.publish == 'true'`): ostatni krok, gdy `outcome` to `failed` albo `error` → `exit 1`. Nie uruchamia się dla wyniku odrzuconego jako nieaktualny ani dla `skip-fork`. Gdy kontrola SHA albo publikacja zakończyła się błędem, job jest już czerwony bez bramki.
- Kroki z `gh` dostają `GH_TOKEN: ${{ github.token }}` w `env`. Sekret nie trafia do żadnego kroku poza krokiem 4 przez input composite action.

#### 3. Jednorazowe przygotowanie etykiet (autorka)

**File**: brak (ustawienie repo, wykonuje autorka przed ręczną weryfikacją fazy 2)

**Intent**: Nie zakładamy, że etykiety istnieją, ani że API tworzy je przy dodawaniu. Ten punkt badania pozostaje otwarty. `ai-cr:review` musi istnieć, żeby dało się go dodać z UI.

**Contract**: sześć etykiet, każda tworzona jedną komendą `gh label create`:

```bash
gh label create "ai-cr:review" --color 1D76DB --description "Uruchom ponownie AI code review"
gh label create "ai-cr:passed" --color 0E8A16 --description "AI review: pozytywny wynik"
gh label create "ai-cr:failed" --color D93F0B --description "AI review: negatywny wynik"
gh label create "ai-cr:incomplete" --color FBCA04 --description "AI review: niepełna ocena (brak danych)"
gh label create "ai-cr:error" --color B60205 --description "AI review: błąd wykonania"
gh label create "ai-cr:stale" --color C5DEF5 --description "AI review: wynik nieaktualny po nowych commitach"
```

### Success Criteria:

#### Automated Verification:

- Job `ci` przechodzi na PR-ze tej zmiany (typecheck i testy pakietu, `npm ci --ignore-scripts`)
- `git grep -nE 'uses: [^.].*@v[0-9]' .github/actions .github/workflows/ai-code-review.yml` nie zwraca nic (akcje przypięte do SHA)
- `git grep -n 'ANTHROPIC_API_KEY' .github/` pokazuje tylko jego jawne usunięcie (`env -u`)
- `git grep -n 'CLAUDE_CODE_OAUTH_TOKEN' .github/` pokazuje wyłącznie input composite action i `env` kroku z recenzentem
- `git grep -nE "always\(\)|publish != " .github/workflows/ai-code-review.yml` nie zwraca nic, a kroki publikacji i bramki mają warunek `steps.head-check.outputs.publish == 'true'`

#### Manual Verification:

- Etykiety `ai-cr:*` utworzone jednorazowo przez autorkę (`gh label list | grep ai-cr` pokazuje 6)
- PR nie-draft bez sekretu: `ai-cr:error` (kategoria `missing-secret`), czerwony job, jeden sticky komentarz z bezpiecznym opisem, bez surowego stderr, bez modelu
- Dodanie `ai-cr:review`: etykieta zdjęta na starcie, ten sam komentarz zaktualizowany (nie drugi), wynik jak wyżej
- Push commita: etykieta wynikowa zdjęta, `ai-cr:stale` ustawiona, komentarz z banerem i SHA ocenionej wersji, job zielony, bez modelu
- Wyścig: `ai-cr:review` i natychmiastowy push. Po `synchronize` nie pojawia się `ai-cr:error` ani nowy wynik (run anulowany albo „odrzucony jako nieaktualny” w summary)
- Ręczne anulowanie trwającego runu review (_Cancel workflow_) nie publikuje komentarza ani etykiety
- Dodanie niezwiązanej etykiety nie uruchamia review i nie anuluje trwającego przebiegu
- PR otwarty jako draft nie uruchamia review; `ready_for_review` uruchamia
- PR zmieniający wyłącznie `package-lock.json`: jawny skip z powodem i listą plików, bez `ai-cr:passed`
- Logi: token nie pojawia się w żadnym kroku poza maskowanym inputem; uprawnienia joba w logu to `contents: read` i `pull-requests: write`

**Implementation Note**: Po fazie 2 **zatrzymaj się i poproś autorkę o potwierdzenie gotowości do fazy 3**. Bez tego potwierdzenia faza 3 się nie zaczyna. Ścieżka forka nie jest sprawdzana ręcznie (brak forka testowego); opiera się na warunku routingu przejrzanym w review kodu.

---

## Phase 3: Próba na prawdziwym PR-ze z `CLAUDE_CODE_OAUTH_TOKEN`

### Overview

Jeden przebieg SDK, czyli jedno uruchomienie `query()`, na prawdziwym PR-ze. Potwierdza na żywo uwierzytelnienie SDK tokenem subskrypcji, akceptację schematu z `nullable` przez API i pełny przepływ publikacji. Wewnętrzne tury i żądania modelowe w tym przebiegu (do `maxTurns: 2`) nie są osobnymi przebiegami. Routing i wyścigi SHA zostały sprawdzone bez modelu w fazie 2.

### Changes Required:

#### 1. Warunki wstępne (autorka, poza repo)

**File**: brak

**Intent**: Spełnić ograniczenie „bez dodatkowo płatnego API” i przygotować sekret bez udziału planu.

**Contract**:

- autorka potwierdza, że extra usage jest wyłączone na koncie;
- autorka samodzielnie generuje token (`claude setup-token`) i tworzy sekret repozytorium `CLAUDE_CODE_OAUTH_TOKEN`;
- etykiety z fazy 2 istnieją;
- autorka wyraźnie potwierdza gotowość do fazy 3.

#### 2. Jeden przebieg SDK

**File**: brak zmian w kodzie (chyba że próba ujawni błąd, który wymaga poprawki i nowej zgody na kolejny przebieg)

**Intent**: Dokładnie jeden run review z jednym uruchomieniem `query()`, wyzwolony dodaniem `ai-cr:review` na wybranym, małym PR-ze z kodem.

**Contract**:

- Bez automatycznego ponawiania całego review: workflow nie ma `retry`, a CLI nie powtarza `query()` (faza 1). Gdy przebieg kończy się `error`, wynik zostaje opublikowany jako `ai-cr:error` i na tym koniec.
- Kolejny przebieg SDK, także ponowienie przez `ai-cr:review` albo _Re-run jobs_, tylko po osobnej zgodzie autorki.
- `num_turns` z `metrics.json` jest zapisywane w summary jako liczba wewnętrznych tur tego jednego przebiegu.
- Jeśli wynik to `error` z kategorią wskazującą na uwierzytelnienie (`sdk-error` przy błędzie auth w logach) albo 400 na schemacie (`nullable`): **stop**, raport z logów i powrót do planu. Fallback `claude -p` lub zmiana schematu to nowa decyzja, a nie cicha zmiana.
- Po udanym przebiegu push commita sprawdza `stale` na prawdziwym wyniku, bez modelu.

### Success Criteria:

#### Automated Verification:

- Job review dla wybranego PR-a zakończył się statusem zgodnym z macierzą (`passed`/`incomplete` → zielony, `failed` → czerwony), a nie `error`

#### Manual Verification:

- Autorka potwierdziła wyłączone extra usage i gotowość do fazy 3 przed uruchomieniem
- Dokładnie jeden przebieg SDK w tej fazie: jeden run review z jednym uruchomieniem `query()`, bez ponowień całego review; `num_turns` ≤ 2 zapisane w summary
- SDK uwierzytelnił się `CLAUDE_CODE_OAUTH_TOKEN` (brak błędu auth, brak `ANTHROPIC_API_KEY` w środowisku kroku)
- API przyjęło schemat z `nullable` i `notAssessed` (brak 400, wynik przeszedł `validateReview`)
- Sticky komentarz zawiera wynik, SHA, link do przebiegu, tabelę ocen, `notAssessed` i koszt oznaczony jako szacunek SDK; jest dokładnie jedna etykieta wynikowa
- Push commita po udanym review daje `ai-cr:stale` i baner w komentarzu, bez nowego przebiegu SDK
- Szacunek kosztu z `metrics-file` zapisany w summary; zużycie limitów Pro obserwowane ręcznie (informacyjnie, nie warunek zakończenia)

**Implementation Note**: Porażka uwierzytelnienia albo odrzucenie schematu przez API zatrzymuje zmianę na tym etapie i wraca do `/10x-plan`.

---

## Testing Strategy

### Unit Tests:

- `validateReview`:
  - poprawna recenzja bez `notAssessed`;
  - `null` + jeden wpis `no-data`; `null` + jeden wpis `not-applicable`;
  - `null` bez wpisu; dwa wpisy dla tego samego kryterium; wpis dla oceny liczbowej;
  - nieznane `criterion`; `note` pusty i z samych spacji;
  - ocena 0, 11 i 7.5; `verdict: "Pass"` (inna wielkość liter → odrzucenie).
- `deriveOutcome`:
  - `verdict: fail` przy wysokich ocenach → `failed`;
  - `pass` z oceną 4 → `failed`; `pass` z oceną 5 → `passed`;
  - `pass` + `no-data` → `incomplete`; `pass` + `not-applicable` → `passed`;
  - `fail` + `no-data` → `failed`;
  - wszystkie `null` + `pass` → `passed` albo `incomplete`, zależnie od powodów.
- `labelsToRemove`: nigdy nie zwraca `ai-cr:review`, zawsze zawiera `ai-cr:stale` i nie zawiera etykiety bieżącego wyniku.
- `prepareInput`:
  - 60 000 znaków → `ok`, 60 001 → `too-large` (licząc tytuł, opis i diff łącznie, ze znakami spoza ASCII);
  - pusty diff z pominiętymi plikami → skip z listą; pusty diff bez pominiętych → skip „pusty diff”;
  - pusty opis oznaczony w prompcie.
- `runReview` z atrapą `queryFn`: dokładnie jedno wywołanie przy sukcesie, przy wyniku błędu SDK (np. `error_max_turns`) i przy wyjątku po wyniku błędu. Skip, `too-large` i `missing-secret` dają zero wywołań.
- `categoryFromSubtype`: każdy znany subtype oraz nieznany → `sdk-error`. `safeMessage` dla każdej kategorii jest niepusty i nie zawiera danych wejściowych.
- `renderComment` / `markStale`:
  - znaczniki obecne; `—` dla `null`; neutralizacja `@wzmianek`;
  - lista pominiętych plików;
  - dopisek o szacunku kosztu;
  - `markStale` idempotentny i zachowuje SHA ocenionej wersji.
- JSON Schema: `anyOf` z `null` dla 6 ocen, `additionalProperties: false` w każdym obiekcie, brak nieobsługiwanych słów kluczowych.
- `SYSTEM_PROMPT`: zawiera kluczowe frazy z kontraktu (`notAssessed`, `no-data`, `not-applicable`, reguła prefiksu `_` w `src/pages/`, `astro:env/server`) jako strażnik przed dryfem.

### Integration Tests:

- Brak automatycznych testów integracyjnych workflow. Przepływ GitHub weryfikują ręczne scenariusze fazy 2 (bez sekretu) i fazy 3 (jeden przebieg SDK).

### Manual Testing Steps:

1. Utwórz 6 etykiet komendami z fazy 2.
2. Otwórz PR tej zmiany jako nie-draft bez sekretu i sprawdź `ai-cr:error` (`missing-secret`), czerwony job oraz jeden komentarz.
3. Dodaj `ai-cr:review` i sprawdź zdjęcie etykiety oraz aktualizację tego samego komentarza.
4. Wypchnij commit i sprawdź `ai-cr:stale`, baner z SHA oraz zielony job.
5. Dodaj `ai-cr:review` i od razu wypchnij commit. Sprawdź, że po `stale` nie pojawia się nowy wynik.
6. Dodaj niezwiązaną etykietę i sprawdź, że review się nie uruchamia ani nie zostaje anulowane.
7. Otwórz osobny draft PR, potem `ready_for_review`. Opcjonalnie otwórz PR tylko z `package-lock.json` i sprawdź skip.
8. Faza 3, po potwierdzeniu gotowości: utwórz sekret, dodaj `ai-cr:review` na małym PR-ze z kodem (jeden przebieg SDK, bez ponowień), sprawdź komentarz, etykietę i status, potem wypchnij commit i sprawdź `stale`.

## Performance Considerations

- Limit wejścia 60 000 znaków, `maxBudgetUsd: 0.5` i `maxTurns: 2` ograniczają pojedynczy przebieg. Liczbę przebiegów ograniczają wyzwalacze (bez `synchronize`/`reopened`), bez licznika w MVP.
- Tryb `invalidate` instaluje pakiet tylko wtedy, gdy jest wcześniejszy wynik. Bez wcześniejszego wyniku kończy się od razu.
- Cache npm dla pakietu przez `cache-dependency-path`.

## Migration Notes

- Zmiana kontraktu (`number | null`, `notAssessed`) dotyczy jedynego konsumenta, czyli tego pakietu. Historyczne `fixtures/sample.review.json` i `sample.review.metrics.json` z M5L2 zostają nietknięte jako zapis starego kontraktu. Nowy kształt dokumentuje syntetyczny `fixtures/synthetic/review-v2.json`. Przyszłe ewaluacje promptfoo muszą przyjąć nowy kształt.
- Wycofanie: usunięcie `.github/workflows/ai-code-review.yml` wyłącza review. Etykiety można zostawić albo usunąć ręcznie.

## References

- Related research: `context/changes/ci-cd-code-review/research.md`
- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Obecny agent: `tools/code-reviewer/src/index.ts:36-88`, `tools/code-reviewer/src/review-schema.ts:7-66`
- Obecny CI: `.github/workflows/ci.yml:3-27`
- Lekcje: `context/foundation/lessons.md` („Assert status and body type…”, „Bound user-driven CPU work…”)
- Structured outputs — JSON Schema limitations: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Agent SDK — structured outputs: https://code.claude.com/docs/en/agent-sdk/structured-outputs

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pakiet `tools/code-reviewer/` — kontrakt, bramka, CLI, testy

#### Automated

- [x] 1.1 Typecheck pakietu przechodzi: `cd tools/code-reviewer && npm run typecheck` — 0eab529
- [x] 1.2 Testy pakietu przechodzą: `cd tools/code-reviewer && npm test` — 0eab529
- [x] 1.3 Czysta instalacja bez skryptów i testy na niej przechodzą: `cd tools/code-reviewer && rm -rf node_modules && npm ci --ignore-scripts && npm test` — 0eab529
- [x] 1.4 Test JSON Schema potwierdza `anyOf` z `null` dla 6 ocen, `additionalProperties: false` w każdym obiekcie oraz brak `minimum`/`maximum`/`multipleOf`/`minLength`/`maxLength` i `minItems` > 1 — 0eab529
- [x] 1.5 Root lint i typecheck nadal przechodzą: `npm run lint` oraz `npx astro check` — 0eab529
- [x] 1.6 Root testy nadal przechodzą: `npm test` — 0eab529
- [x] 1.7 Historyczne fixture'y nietknięte: `git diff --exit-code master -- tools/code-reviewer/fixtures/sample.review.json tools/code-reviewer/fixtures/sample.review.metrics.json` — 0eab529

#### Manual

- [x] 1.8 Przegląd `SYSTEM_PROMPT` względem `requirements.md` → „Code Review Criteria”: zasady wspólne, 6 kryteriów i reguły 1–5 są obecne i wierne — 0eab529
- [x] 1.9 Render komentarza dla każdego wyniku (passed, failed, incomplete, error, skipped, stale) obejrzany na fixture'ach i czytelny, bez surowego stderr — 0eab529

### Phase 2: Composite action i workflow `ai-code-review.yml`

#### Automated

- [x] 2.1 Job `ci` przechodzi na PR-ze tej zmiany (typecheck i testy pakietu, `npm ci --ignore-scripts`) — 49cb5e0
- [x] 2.2 `git grep -nE 'uses: [^.].*@v[0-9]' .github/actions .github/workflows/ai-code-review.yml` nie zwraca nic (akcje przypięte do SHA) — 15b8baf
- [x] 2.3 `git grep -n 'ANTHROPIC_API_KEY' .github/` pokazuje tylko jego jawne usunięcie (`env -u`) — 15b8baf
- [x] 2.4 `git grep -n 'CLAUDE_CODE_OAUTH_TOKEN' .github/` pokazuje wyłącznie input composite action i `env` kroku z recenzentem — 15b8baf
- [x] 2.5 `git grep -nE "always\(\)|publish != " .github/workflows/ai-code-review.yml` nie zwraca nic, a kroki publikacji i bramki mają warunek `steps.head-check.outputs.publish == 'true'` — 15b8baf

#### Manual

- [x] 2.6 Etykiety `ai-cr:*` utworzone jednorazowo przez autorkę (`gh label list | grep ai-cr` pokazuje 6)
- [ ] 2.7 PR nie-draft bez sekretu: `ai-cr:error` (kategoria `missing-secret`), czerwony job, jeden sticky komentarz z bezpiecznym opisem, bez surowego stderr, bez modelu — CZĘŚCIOWO: na GitHubie (#58, runy 40387486698, 40387980786, 40390255268) przepływ ai-cr:error, jeden sticky komentarz, czerwony job, brak modelu potwierdzony, ale kategoria to input-too-large; lokalnie CLI (fikcyjny diff, bez tokenu, --require-token): exit 1, result.json category=missing-secret, bezpieczny komentarz bez stderr; test integracyjny missing-secret odłożony do małego PR-a po scaleniu #58; integracyjne missing-secret na małym PR-ze z master (zob. notatka przy fazie 3)
- [x] 2.8 Dodanie `ai-cr:review`: etykieta zdjęta na starcie, ten sam komentarz zaktualizowany (nie drugi), wynik jak wyżej — wynik input-too-large zamiast missing-secret; ten sam komentarz zaktualizowany, bez duplikatu
- [x] 2.9 Push commita: etykieta wynikowa zdjęta, `ai-cr:stale` ustawiona, komentarz z banerem i SHA ocenionej wersji, job zielony, bez modelu — run 40388439308 (2ab7cde): ai-cr:stale ustawiona, ai-cr:error zdjęta, baner z SHA 49cb5e0 w tym samym komentarzu, bez sekretu i modelu
- [x] 2.10 Wyścig: `ai-cr:review` i natychmiastowy push. Po `synchronize` nie pojawia się `ai-cr:error` ani nowy wynik (run anulowany albo „odrzucony jako nieaktualny” w summary) — runy 40389045490 (review, 2ab7cde, cancelled) i 40389061247 (synchronize, 3538f55, success) nałożyły się 19:42:03–19:42:17; kontrola SHA: publish=false, publikacja pominięta; stan końcowy: tylko ai-cr:stale, ten sam komentarz z banerem; wpis „odrzucony jako nieaktualny” w summary niezweryfikowany
- [ ] 2.11 Ręczne anulowanie trwającego runu review (_Cancel workflow_) nie publikuje komentarza ani etykiety — NIEROZSTRZYGNIĘTE (2 próby): anulowanie nie zadziałało w runnerze przed publikacją; run 40389346268: cancel 19:44:11, publikacja 19:44:20; run 40389631353: cancel 19:45:56, publikacja 19:46:14, run oznaczony cancelled dopiero 19:46:19; wymaga dłuższego kroku review (faza 3) albo uznania opóźnienia anulowania po stronie GitHuba
- [x] 2.12 Dodanie niezwiązanej etykiety nie uruchamia review i nie anuluje trwającego przebiegu — A: run 40389900276 (documentation), job review skipped; B: review 40389967626 (19:48:06–19:48:33) nie anulowany przez niezwiązaną etykietę dodaną 19:48:14 (run 40389991143, job skipped), doszedł do publikacji i bramki (czerwona dla error)
- [ ] 2.13 PR otwarty jako draft nie uruchamia review; `ready_for_review` uruchamia — ready_for_review: run 40390255268 (19:50:02, bez commita i etykiety, wywołanie wnioskowane) uruchomił review, wynik input-too-large, ten sam komentarz, job czerwony; NIEZWERYFIKOWANE: opened jako draft nie uruchamia review (brak dowodu, bez osobnego PR-a); sprawdzenie „opened jako draft” przeniesione na mały PR z master (zob. notatka przy fazie 3)
- [ ] 2.14 PR zmieniający wyłącznie `package-lock.json`: jawny skip z powodem i listą plików, bez `ai-cr:passed` — POKRYTE TESTAMI JEDNOSTKOWYMI, NIEZWERYFIKOWANE NA GITHUBIE: input.test.ts (pusty diff z pominiętymi plikami → skip z listą) i golden komentarza skipped; brak przebiegu na PR-ze zmieniającym wyłącznie package-lock.json
- [ ] 2.15 Logi: token nie pojawia się w żadnym kroku poza maskowanym inputem; uprawnienia joba w logu to `contents: read` i `pull-requests: write` — CZĘŚCIOWO (runy 40387486698, 40390255268): uprawnienia GITHUB_TOKEN w logu = Contents: read, Metadata: read, PullRequests: write; CLAUDE_CODE_OAUTH_TOKEN występuje w logu tylko jako pusta wartość env kroku recenzenta, ANTHROPIC_API_KEY tylko w env -u; sekretu nie ma w repo, więc maskowanie prawdziwego tokenu NIE zostało zweryfikowane (zostaje na fazę 3 lub osobną decyzję)

### Phase 3: Próba na prawdziwym PR-ze z `CLAUDE_CODE_OAUTH_TOKEN`

> Zmiana kolejności (ustalona 2026-10-26): faza 3 odbędzie się na osobnym małym PR-ze z `master` po scaleniu #58, bo diff #58 przekracza limit wejścia (`input-too-large`, ~241 tys. znaków przy limicie 60 tys.). Na tym PR-ze, przed utworzeniem sekretu, sprawdzamy 2.13 (opened jako draft) i integracyjne 2.7 (`missing-secret`). Punkt 2.14 jest pokryty testami jednostkowymi, niezweryfikowany na GitHubie.

#### Automated

- [ ] 3.1 Job review dla wybranego PR-a zakończył się statusem zgodnym z macierzą (`passed`/`incomplete` → zielony, `failed` → czerwony), a nie `error`

#### Manual

- [ ] 3.2 Autorka potwierdziła wyłączone extra usage i gotowość do fazy 3 przed uruchomieniem
- [ ] 3.3 Dokładnie jeden przebieg SDK w tej fazie: jeden run review z jednym uruchomieniem `query()`, bez ponowień całego review; `num_turns` ≤ 2 zapisane w summary
- [ ] 3.4 SDK uwierzytelnił się `CLAUDE_CODE_OAUTH_TOKEN` (brak błędu auth, brak `ANTHROPIC_API_KEY` w środowisku kroku)
- [ ] 3.5 API przyjęło schemat z `nullable` i `notAssessed` (brak 400, wynik przeszedł `validateReview`)
- [ ] 3.6 Sticky komentarz zawiera wynik, SHA, link do przebiegu, tabelę ocen, `notAssessed` i koszt oznaczony jako szacunek SDK; jest dokładnie jedna etykieta wynikowa
- [ ] 3.7 Push commita po udanym review daje `ai-cr:stale` i baner w komentarzu, bez nowego przebiegu SDK
- [ ] 3.8 Szacunek kosztu z `metrics-file` zapisany w summary; zużycie limitów Pro obserwowane ręcznie (informacyjnie, nie warunek zakończenia)
