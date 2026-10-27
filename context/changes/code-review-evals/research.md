---
date: 2026-10-27T16:36:21+01:00
researcher: Aleksandra Pęcherz (z Claude Code)
git_commit: fa116be919f1d877d0f5ea08177d647719d0a624
branch: master
repository: 10xdevs (PasujeMi)
topic: "Evale recenzenta w promptfoo (M5L3, zadanie 3): uruchamianie kodu z tools/code-reviewer/, porównanie modeli na logowaniu Claude Pro, fikcyjne diffy, asercje i metryki, grader llm-rubric bez płatnego API"
tags: [research, promptfoo, evals, code-reviewer, claude-agent-sdk, llm-rubric]
status: partial
last_updated: 2026-10-27
last_updated_by: Aleksandra Pęcherz (z Claude Code)
---

# Research: Evale recenzenta w promptfoo

**Date**: 2026-10-27T16:36:21+01:00
**Git Commit**: fa116be (master po fast-forward; drzewo robocze czyste przed badaniem)
**Branch**: master
**Repository**: 10xdevs (PasujeMi)

## Research Question

Pięć pytań z zadania 3 M5L3:

1. Jak uruchamiać w promptfoo rzeczywisty kod recenzenta z `tools/code-reviewer/`, zachowując prompt, schemat, walidację i wyprowadzanie wyniku?
2. Jak porównać 2–3 modele przez Claude Agent SDK z logowaniem Claude Pro, bez dodatkowo płatnego API?
3. Jak przygotować mały zestaw całkowicie fikcyjnych diffów: poprawna zmiana, celowy błąd, brak kontekstu?
4. Jak sprawdzać JSON, oczekiwane ustalenia i werdykt oraz zbierać czas, tokeny i dostępny szacunek kosztu?
5. Jak uwierzytelniać grader `llm-rubric` bez płatnego API i jakie ma ograniczenia?

Poza zakresem (zgodnie z poleceniem): implementacja, instalacja, generowanie tokenów, wywołania modeli, zmiany w `context/archive/`, `context/foundation/` i workflow review.

Oznaczenia: **[Ustalenie]** = potwierdzone w kodzie lub dokumentacji (ze źródłem), **[Propozycja]** = mój wniosek, **[Decyzja]** = należy do autorki, **[Luka]** = niezweryfikowane.

## Summary

- **P1: da się zachować cały kontrakt przez własnego providera.** [Ustalenie] `runReview()` w `tools/code-reviewer/src/run.ts:72` dostaje funkcję `queryFn` wstrzykiwaną z zewnątrz i sama buduje prompt (`prepareInput`), woła `query()` z `SYSTEM_PROMPT` i `REVIEW_JSON_SCHEMA`, waliduje (`validateReview`) i wylicza wynik (`deriveOutcome`) (`run.ts:80-156`). Provider promptfoo w pliku `.ts`/`.mjs` może więc wywołać `runReview()` z prawdziwym `query()` z SDK i zwrócić `ResultFile`. [Propozycja] To lepsze niż wbudowany `anthropic:claude-agent-sdk`, który omijałby `prepareInput`, walidację i bramkę, a te reguły trzeba by duplikować w asercjach.
- **Model jest dziś na sztywno** [Ustalenie]: `MODEL = "claude-sonnet-5-5"` (`run.ts:9`) i `model: MODEL` w opcjach (`run.ts:110`). [Propozycja] Porównanie modeli nie wymaga zmiany `run.ts`: opakowanie `queryFn` w providerze może podmienić `params.options.model` przed wywołaniem SDK (`QueryParams.options.model` jest zwykłym stringiem, `run.ts:16-17`). To wybór implementacyjny dla planu.
- **P2: lista modeli w planie Pro nie jest ustalona w dokumentacji.** [Ustalenie] Strona o konfiguracji modeli nie podaje listy modeli per plan; mówi, że domyślnym modelem w Pro, Max, Team, Enterprise i API jest Opus 5.5, że Fable „can bill to usage credits instead of drawing on your plan's included limits" zależnie od planu, a sonnet/opus/haiku to aliasy zależne od dostawcy. SDK ma `supportedModels()` i `initializationResult()` (`models`, `account`), ale strona nie mówi, czy lista zależy od konta [Luka]. [Decyzja] Lista 2–3 modeli powinna wyjść z sondy na koncie autorki (bez generowania odpowiedzi modelu), a nie z założeń.
- **P3: obecny kontrakt nie ma listy ustaleń.** [Ustalenie] Schemat zawiera sześć ocen `number | null`, `notAssessed`, `verdict`, `summary` (`review-schema.ts:139-193`); nie ma pola z konkretnymi zarzutami. „Oczekiwane ustalenia" można więc sprawdzać tylko pośrednio: progami ocen konkretnych kryteriów, `notAssessed` z powodem, wyliczonym `outcome` i (słabo) tekstem `summary`. Dodanie pola `findings` byłoby zmianą kontraktu (reguła z `CLAUDE.md`: najpierw schemat). [Decyzja]
- **P4: promptfoo zbiera czas, tokeny i koszt, jeśli provider je zwróci.** [Ustalenie] `ProviderResponse` ma `tokenUsage`, `cost`, `metadata`; asercje `is-json` (z JSON Schema), `javascript`, `cost`, `latency` istnieją w dokumentacji; eksport wyniku zawiera `latencyMs`, `cost`, `tokenUsage`. Wbudowany provider Agent SDK przy braku danych o użyciu oznacza `metadata.usageAccounting = 'unavailable'` i „cost assertions then fail rather than treating unknown cost as zero". Dla własnego providera mapowanie `Metrics` → `tokenUsage`/`cost` robi nasz kod.
- **P5: dwie ścieżki gradera bez klucza API, obie z zastrzeżeniami.** (a) [Ustalenie] `anthropic:messages:<model>` z `apiKeyRequired: false` czyta poświadczenie OAuth z `%USERPROFILE%\.claude\.credentials.json` (Windows) i wysyła zwykłe żądania Messages z nagłówkami beta `claude-code-20250219,oauth-2025-04-20` oraz dopisanym blokiem „You are Claude Code, Anthropic's official CLI for Claude."; dokumentacja promptfoo nie wspomina o `CLAUDE_CODE_OAUTH_TOKEN` ani o warunkach korzystania. (b) [Ustalenie] `agent-rubric` przyjmuje `anthropic:claude-agent-sdk` jako grader, ale dokumentacja nie opisuje jego uwierzytelnienia; czy `llm-rubric` przyjmie provider agentowy, strona nie mówi [Luka]. Bez jawnie ustawionego gradera `llm-rubric` wybiera domyślny według dostępnych kluczy, więc nie wolno zostawiać wyboru domyślnego (zob. P5 niżej).
- **Stan środowiska** [Ustalenie, odczyt lokalny 2026-10-27]: plik `~/.claude/.credentials.json` istnieje; zmienne `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `GOOGLE_API_KEY` są nieustawione w tej powłoce (sprawdzono tylko obecność, bez odczytu wartości). Promptfoo nie jest zainstalowany ani wzmiankowany w konfiguracji repo poza dokumentami zmian i promptem lekcji (`rg promptfoo`: `.claude/prompts/m5l2-agent.md:17`, trzy pliki w `context/changes/ci-cd-code-review/`).

## Detailed Findings

### P1. Uruchomienie rzeczywistego kodu recenzenta w promptfoo

**Co robi kod dziś** [Ustalenie]

- `runReview(input, queryFn, timeoutMs)` zwraca `{ result: ResultFile, metrics, logs }` (`run.ts:56,72-157`). Kolejność: `prepareInput` (pusty diff → `skipped`, >60 000 znaków → błąd `input-too-large`, `input.ts:5,17-27`), brak tokenu przy `requireToken` → `missing-secret` (`run.ts:88`), jedno `query()` z limitem czasu 10 min (`run.ts:12,92-130`), błąd SDK → kategoria (`run.ts:142-145`), `validateReview` (`run.ts:147`), `deriveOutcome` (`run.ts:153`).
- Opcje wywołania SDK są stałe w `run.ts:107-118`: `systemPrompt: SYSTEM_PROMPT`, `tools: []`, `settingSources: []`, `maxTurns: 2`, `maxBudgetUsd: 0.5`, `outputFormat: json_schema` z `REVIEW_JSON_SCHEMA`.
- `index.ts:57` przekazuje prawdziwe `query` z SDK rzutowane na `QueryFn`; `index.ts` jest cienkim CLI (pliki, `parseArgs`, `emitAndExit`). `run.ts` nie importuje SDK (komentarz `run.ts:1-2`), co jest istniejącym szwem testowym (`run.test.ts`).
- `validateReview` (`validate.ts:10-34`) egzekwuje to, czego structured output nie wyraża: całkowite 1–10, niepusty `note`, null ⇔ dokładnie jeden wpis w `notAssessed`. `deriveOutcome` (`outcome.ts:29-38`): `failed`, gdy `verdict === "fail"` lub jakakolwiek ocena < 5 (`PASS_THRESHOLD`, komentarz „Tymczasowy, do weryfikacji w ewaluacjach", `outcome.ts:4-5`); `incomplete`, gdy jest wpis `no-data`; inaczej `passed`.
- Wersja SDK w `node_modules` pakietu: 0.3.310 (`tools/code-reviewer/node_modules/@anthropic-ai/claude-agent-sdk/package.json`). Pakiet ma własny `package.json` z `"type": "module"`, `tsx`, importy z rozszerzeniem `.ts` (`tsconfig.json`: `allowImportingTsExtensions`).

**Co mówi dokumentacja promptfoo** [Ustalenie]

- Provider własny: wpis `file://...` w `providers`; obsługiwane `.js/.cjs`, ESM (`.mjs` lub `.js` w pakiecie `"type": "module"`) i `.ts`. Dla `.ts` promptfoo ładuje plik w Node (nie przez bundler), wymaga uruchomienia z katalogu z `tsconfig.json`, a przy funkcjach tylko-bundlerowych zaleca kompilację do JS. Strona nie wspomina o `tsx` ([custom-api](https://www.promptfoo.dev/docs/providers/custom-api/)).
- Konstruktor dostaje `options` (`id`, `config`); `callApi(prompt, context, options)` zwraca `ProviderResponse`. `context.vars` niesie zmienne testu. Brakujące/`null` `output` jest traktowane jako błąd; `error` zgłasza porażkę żądania (ta sama strona).
- Wbudowany provider `anthropic:claude-agent-sdk` (alias `anthropic:claude-code`) wymaga SDK `^0.3.273` w gałęzi 0.3.x, rozwiązuje je z katalogu konfiguracji lub jego przodków, ma `output_format`, `setting_sources`, `model`, `max_turns`, `max_budget_usd`, `tools`, `custom_system_prompt`, a surowy structured output kładzie w `metadata.structuredOutput` ([claude-agent-sdk](https://www.promptfoo.dev/docs/providers/claude-agent-sdk/)). Cache odpowiedzi działa, gdy zgadzają się prompt, konfiguracja i zawartość `working_dir`.
- Aktualny pakiet `promptfoo` w rejestrze npm: 0.125.1, `engines.node >=22.22.0`, `@anthropic-ai/claude-agent-sdk` jako peer `*` (odczyt `npm view`, 2026-10-27; nic nie instalowano). Repo: `.nvmrc` 22.23.3 i lokalny Node v22.23.3 spełniają wymaganie.

**Warianty** [Propozycja]

| Wariant                                                                              | Co zachowuje                                                                                                        | Co trzeba odtworzyć                                                                                               | Ryzyko                                                                                                                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Własny provider (`file://`) wołający `runReview()` z prawdziwym `query()`         | Prompt systemowy, schemat, `prepareInput`, walidację, `deriveOutcome`, limity (`maxTurns`, `maxBudgetUsd`, timeout) | Mapowanie `ResultFile`/`Metrics` na `ProviderResponse`; podmiana modelu w opakowaniu `queryFn`                    | Czy loader `.ts` promptfoo rozwiązuje importy z rozszerzeniem `.ts` w pakiecie [Luka, sprawdzalne bez modelu: provider z fałszywym `queryFn`] |
| B. Wbudowany `anthropic:claude-agent-sdk` z `custom_system_prompt` i `output_format` | Prosta konfiguracja YAML, wbudowane liczenie kosztu/tokenów                                                         | Budowa promptu z tytułu/opisu/diffu, `settingSources`, walidacja reguł `notAssessed`, `deriveOutcome` w asercjach | Dryf względem produkcyjnego kodu; dwa źródła prawdy dla promptu i bramki, co łamie zasadę „schemat jest kontraktem"                           |

[Propozycja] Wariant A, bo cel zadania to ocena „rzeczywistego kodu". Wariant B zostaje jako punkt odniesienia.

**Otwarte punkty dla P1**

- Gdzie trzymać konfigurację i zależność `promptfoo` (w `tools/code-reviewer/` obok SDK, czy osobno) [Decyzja]. Provider wbudowany rozwiązuje SDK z katalogu konfiguracji w górę; własny provider użyje SDK z `node_modules` pakietu.
- Co zwraca provider jako `output`: `JSON.stringify(result)` całego `ResultFile` (z `status`/`outcome`) czy samego `review` [Decyzja]. [Ustalenie] `REVIEW_JSON_SCHEMA` opisuje wyłącznie obiekt `review`, więc `is-json` ze schematem pasuje do `review`, a `outcome` trzeba asertować osobno.
- Błędy (`status: "error"`) zwrócić jako `error` providera czy jako normalny `output` z `outcome: "error"` [Decyzja]; wpływa to na to, czy promptfoo liczy je jako „błąd" czy jako nieudaną asercję.

### P2. Porównanie 2–3 modeli na logowaniu Claude Pro

**Uwierzytelnienie** [Ustalenie]

- Lokalnie SDK używa logowania Claude Code; komentarz w `index.ts:2-3` mówi, że `ANTHROPIC_API_KEY` jest „deliberately never set". W tej powłoce zmienne kluczy API są nieustawione (zob. Summary). Pierwszeństwo: `ANTHROPIC_API_KEY` w trybie nieinteraktywnym przesłania subskrypcję ([Authentication](https://code.claude.com/docs/en/authentication#authentication-precedence), cytowane w `ci-cd-code-review/research.md` §4.A), więc przed evalami nie wolno ustawiać tej zmiennej.
- Wbudowany provider Agent SDK pozwala na `apiKeyRequired: false`, „such as Claude Code monthly plans"; „the SDK still needs to be able to authenticate on its own" ([claude-agent-sdk](https://www.promptfoo.dev/docs/providers/claude-agent-sdk/)). Własny provider A nie ma kontroli promptfoo nad kluczem, bo woła `query()` bezpośrednio.

**Dostępność modeli** [Ustalenie z zastrzeżeniami]

- [Model configuration](https://code.claude.com/docs/en/model-config): domyślnie „Pro, Max, Team, Enterprise, and Anthropic API: defaults to Opus 5.5"; aliasy `opus`, `sonnet`, `haiku` na API Anthropic rozwiązują się do Opus 5.5, Sonnet 5.5, Haiku 5.5; `fable` jest aliasem dodatkowym i „are not the account-type default on any plan or provider". Fable: „Depending on your plan and seat tier, Fable usage can bill to usage credits instead of drawing on your plan's included limits". Rozszerzony kontekst 1M dla Sonnet 4.6 „requires usage credits on every subscription plan". Strona nie podaje tabeli „model × plan". Przeczytałem ok. 100 000 z 127 888 znaków strony; reszta nieprzejrzana [Luka].
- [TypeScript SDK](https://code.claude.com/docs/en/agent-sdk/typescript): `Options.model` to „Claude model alias or full model name"; `fallbackModel` przyjmuje listę po przecinku (**uwaga**: ustawienie `fallbackModel` w evalach mogłoby po cichu podmienić porównywany model — [Propozycja] nie ustawiać go); `Query.supportedModels()` zwraca `ModelInfo[]`, a `initializationResult()` zawiera `models` i `account`. Strona nie definiuje `ModelInfo`/`AccountInfo` ani nie mówi, czy lista zależy od konta (przeczytano ok. 100 000 z 326 110 znaków) [Luka].
- Przykłady w dokumentacji promptfoo używają identyfikatorów `claude-opus-5`, `claude-sonnet-5` (alias bez numeru podwersji), a kod repo używa `claude-sonnet-5-5`. Które identyfikatory przyjmie to konto, nie wynika z dokumentacji [Luka].

**Koszt i limity — czego dotyczy „bez dodatkowo płatnego API"** [Ustalenie]

- Dokumentacja SDK: `total_cost_usd` to „client-side estimates, not authoritative billing data" ([cost-tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)); pozostaje w mocy ustalenie z `ci-cd-code-review/research.md` §5, że nie jest to pomiar zużycia limitu planu.
- [Propozycja] Każdy dodatkowy model to dodatkowe zużycie limitów planu; 3 modele × N przypadków × `repeat` mnoży liczbę wywołań. Domyślne `evaluateOptions.maxConcurrency` w promptfoo to 4 ([configuration reference](https://www.promptfoo.dev/docs/configuration/reference/)); strona providera Agent SDK nie podaje zalecenia ogólnego, tylko `maxConcurrency: 1` dla testów z efektami ubocznymi. Dla planu subskrypcyjnego sensowna jest mała równoległość [Decyzja].
- [Decyzja] Czy użycie Fable (potencjalnie rozliczane z usage credits) w ogóle wchodzi w grę, skoro obowiązuje ograniczenie „bez dodatkowo płatnego API"; stan extra usage na koncie zna tylko autorka (`ci-cd-code-review/research.md` §5, D2).
- Zgodność tego scenariusza (własny skrypt SDK na własnym logowaniu, lokalnie) z warunkami korzystania pozostaje po stronie autorki; kategoria C z `ci-cd-code-review/research.md` §4 nie została zmieniona tym badaniem.

### P3. Mały zestaw całkowicie fikcyjnych diffów

**Istniejące zasoby** [Ustalenie]

- `tools/code-reviewer/fixtures/sample.diff` to fikcyjny diff (komentarz „Fictional example, not part of the real project") z wadami: `items[0].toUpperCase()` bez sprawdzenia pustej tablicy, SQL sklejany konkatenacją, słaby test (`toContain("Ola")`). To materiał z M5L2; plan CI zachował „historyczne fixture'y M5L2 bez zmian".
- `fixtures/synthetic/review-v2*.json` to przykładowe **odpowiedzi** w nowym kontrakcie (nie diffy), plus złote komentarze w `fixtures/synthetic/comments/`.

**Propozycja trzech klas przypadków** [Propozycja, zgodna z poleceniem]

| Klasa           | Konstrukcja diffu                                                                                                                                                                                                                 | Oczekiwany `outcome` z `deriveOutcome`                                                   | Uwaga                                                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Poprawna zmiana | Mała fikcyjna funkcja z obsługą błędów **i adekwatnym testem** w tym samym diffie, opis zgodny z diffem                                                                                                                           | `passed`                                                                                 | Bez testu w diffie kryterium `testRiskCoverage` według promptu to `null`/`no-data` (`review-schema.ts:88`), czyli `incomplete`, nie `passed`. Poprawny przypadek musi więc zawierać test |
| Celowy błąd     | Jedna wyraźna wada o jednoznacznym kryterium: np. pominięty `error` z klienta bazy (kryterium `implementationCorrectness`), sekret w kodzie lub SQL z konkatenacji (`securitySafety`), plik testu w `src/pages/` bez prefiksu `_` | `failed`                                                                                 | Wada powinna dotyczyć jednego kryterium, bo „to samo naruszenie nie obniża dwóch ocen" (`review-schema.ts:36`)                                                                           |
| Brak kontekstu  | Zmieniona logika bez żadnego testu w diffie; ewentualnie osobny przypadek `not-applicable` (sama dokumentacja)                                                                                                                    | `incomplete` (dla `no-data`); dla `not-applicable` zależnie od pozostałych ocen `passed` | `not-applicable` nie wpływa na wynik (`outcome.ts:35`)                                                                                                                                   |

- Wszystkie diffy muszą być całkowicie wymyślone: bez fragmentów prawdziwego kodu repo, danych użytkowników, prawdziwych sekretów. [Propozycja] Sekret w przypadku błędu to ewidentnie atrapa (np. `sk-test-FAKE-0000`), a nazwy modułów generyczne, jak w `sample.diff`.
- [Propozycja] Każdy przypadek ma też tytuł i opis PR (kontrakt wejścia z `prepareInput`), w tym jeden z opisem sprzecznym z diffem lub pustym, bo „pusty opis sam w sobie nie obniża oceny" (`review-schema.ts:96`).
- [Propozycja] Rozmiar: 3–5 przypadków; wynik modelu jest niedeterministyczny, więc pojedyncze uruchomienie nie wystarcza do wniosków. `evaluateOptions.repeat` jest dostępne (domyślnie 1), ale każdy powtórzony przebieg zużywa limit planu [Decyzja o liczbie powtórzeń].
- [Ustalenie] Zawartość diffów i opisów trafia do modelu (i, przy graderze opartym na API, do gradera), więc nie może zawierać niczego prywatnego.

### P4. Asercje i metryki

**JSON** [Ustalenie]

- `is-json` waliduje tekst wyjścia jako JSON i opcjonalnie względem JSON Schema (`value:` inline lub `file://`) ([deterministic assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/deterministic/)). `REVIEW_JSON_SCHEMA` jest eksportowany jako draft-07 z gałęziami `anyOf` dla `null` (`review-schema.ts:206`), ale nie zawiera zakresu 1–10 ani reguł `notAssessed` (celowo, `review-schema.ts:135-136`; to robi `validateReview`). [Propozycja] W praktyce `validateReview` już został wykonany wewnątrz `runReview`, więc asercja `javascript` może sprawdzać `result.status === "reviewed"`, a `is-json` jest dodatkowym, tanim sprawdzeniem kształtu. Czy walidator JSON Schema promptfoo akceptuje ten schemat (w tym `additionalProperties`, `anyOf`) nie było sprawdzane [Luka].

**Oczekiwane ustalenia i werdykt** [Propozycja na bazie Ustaleń]

- Deterministycznie, bez gradera: asercje `javascript` na `outcome` (wyliczony przez `deriveOutcome`, więc nie zależy od zgodności `verdict` z liczbami, `outcome.ts:1`), na progach konkretnych ocen (np. dla przypadku z SQL-injection `securitySafety` ≤ próg), na `notAssessed` (kryterium + `reason`) dla przypadku bez kontekstu. `javascript` dostaje `output` i `context` (`context.vars`, `context.providerResponse`) ([przykład w dokumentacji](https://www.promptfoo.dev/docs/providers/openai-codex-security/)) i może zwracać `{pass, score, reason}`.
- Ponieważ schemat nie ma listy zarzutów (zob. Summary), sprawdzanie „czy wskazano konkretny błąd" opiera się na ocenach liczbowych lub tekście `summary`. Dopasowanie słów kluczowych w `summary` jest kruche (pole ma 2–3 zdania łącznie, `review-schema.ts:51`). [Propozycja] Rubryka `llm-rubric` na `summary` jest drugą, droższą warstwą. [Decyzja] Czy rozszerzać kontrakt o `findings` (zmiana schematu → prompt → walidacja → bramka → evale), czy zostać przy ocenach.
- Próg `PASS_THRESHOLD = 5` jest wprost oznaczony jako tymczasowy „do weryfikacji w ewaluacjach" (`outcome.ts:4-5`); `plan-brief.md` zapisuje to samo jako otwarte ryzyko. Evale są miejscem, gdzie ten próg można zmierzyć; zmiana progu to osobna decyzja.

**Czas, tokeny, koszt** [Ustalenie]

- `Metrics` z `runReview` zawiera `total_cost_usd_estimate`, `num_turns`, `duration_ms`, `usage` (`run.ts:40-45`); przy braku wyniku SDK `metrics` jest `null` (`run.ts:134,138`), a przy `timeout` także `null`.
- Pola `usage` w przykładowych metrykach lokalnych: `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens` (`fixtures/sample.review.metrics.json`; jedna próbka, `total_cost_usd` ≈ 0,0184). SDK: tokeny wyjściowe należy czytać z wyniku, bo wartość na wiadomościach asystenta jest placeholderem; `usage` pomija odpowiedź, która przekroczyła budżet, a `total_cost_usd`/`modelUsage` ją zawierają; po awarii sesji pola mogą być wyzerowane; `modelUsage` ma rozbicie po modelu, a `costBasis` (`list`/`managed`/`unknown`) mówi, jaką tabelą wyceniono ([cost-tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)).
- Promptfoo: `tokenUsage {total, prompt, completion}` i `cost` w odpowiedzi providera; asercje `cost` i `latency` z `threshold`; eksport zawiera `latencyMs`, `cost`, `tokenUsage` ([configuration reference](https://www.promptfoo.dev/docs/configuration/reference/)). Wbudowany provider Agent SDK przy niedostępnym zużyciu zapisuje `metadata.usageAccounting = 'unavailable'`, a asercje kosztu wtedy zawodzą (strona providera).
- [Propozycja] Provider własny: `cost` = `total_cost_usd_estimate` oznaczony w `metadata` jako szacunek; `tokenUsage` z `usage` (sposób sumowania tokenów z cache to wybór, bo `prompt` ≠ `input_tokens`); `metadata.durationMs` z SDK obok `latencyMs` promptfoo. Asercja `cost` w planie subskrypcyjnym mierzy szacunek SDK, nie rachunek ani zużycie limitu [Decyzja, czy w ogóle jej używać jako bramki].
- Cache: wbudowany provider cache'uje odpowiedzi; dla własnego providera dokumentacja opisuje tylko jawne API cache, nie automatyczne cache'owanie. [Propozycja] Przy porównaniu modeli upewnić się, że cache nie zafałszowuje czasu i kosztu (`--no-cache`/`PROMPTFOO_CACHE_ENABLED=false`).
- Telemetria: strona referencyjna promptfoo nie wspomina o opcji wyłączenia telemetrii [Luka]; sprawdzić przed pierwszym uruchomieniem, bo wynik evali zawiera diffy (fikcyjne).

### P5. Uwierzytelnienie gradera `llm-rubric` bez płatnego API

**Jak promptfoo wybiera gradera** [Ustalenie] ([llm-rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/), [model-graded](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/))

- Kolejność: `provider` na asercji > `test.options.provider` > `defaultTest.options.provider` > flaga `--grader`; potem, jeśli brak gradera, `defaultTest.provider` bywa użyty jako zapasowy, **co oznacza, że provider ustawiony jako cel testu może zacząć też oceniać**.
- Domyślny grader zależy od poświadczeń w środowisku: klucz OpenAI → `gpt-5`; logowanie Codex → `openai:codex-sdk`; klucz Anthropic → `claude-sonnet-5`; Google, Mistral, GitHub, Azure analogicznie. Przy obu kluczach, OpenAI i Anthropic, wygrywa OpenAI. [Propozycja] Nie zostawiać wyboru domyślnego: jawny `defaultTest.options.provider`, bo przyszłe ustawienie klucza w środowisku zmieniłoby gradera po cichu (i rachunek).
- Grader ma zwrócić JSON `{reason, score 0–1, pass}`; z `threshold` obowiązują oba warunki; brak i `pass`, i `score` oznacza porażkę oceny. Dokumentacja nie omawia kosztu ani zużycia tokenów oceny i nie rozwija tematu niedeterminizmu poza uwagą o `temperature` (strona llm-rubric) [Luka].

**Ścieżka (a): `anthropic:messages` na logowaniu Claude Code** [Ustalenie] ([anthropic provider](https://www.promptfoo.dev/docs/providers/anthropic/))

- Konfiguracja z dokumentacji (Pro/Max bez klucza Console):
  `defaultTest.options.provider: { id: anthropic:messages:claude-sonnet-5, config: { apiKeyRequired: false } }`.
- Poświadczenie: wpis Keychain `Claude Code-credentials` (macOS) albo `%USERPROFILE%\.claude\.credentials.json` (Windows); `CLAUDE_CONFIG_DIR` wskazuje inny profil. Żądanie: Bearer + nagłówki beta `claude-code-20250219,oauth-2025-04-20` + dopisany blok tożsamości „You are Claude Code, Anthropic's official CLI for Claude." przed własnym promptem.
- Ograniczenia: wymagany istniejący login (`claude /login`), wygasłe poświadczenie wymaga ponownego logowania; sekcja nie wspomina `CLAUDE_CODE_OAUTH_TOKEN` ani warunków korzystania, a o rozliczeniu mówi, że żądania powinny liczyć się do subskrypcji „the same way Claude Code CLI calls do", odsyłając do dokumentacji Anthropic.
- [Ustalenie lokalne] Plik `.credentials.json` istnieje na tej maszynie (nie czytano zawartości). [Propozycja] To nie to samo co CLI Claude Code: promptfoo (aplikacja trzecia) sam wysyła żądania z poświadczeniem OAuth. Zestawienie z [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use) (cytowane w `ci-cd-code-review/research.md` §4.C: OAuth „designed to support ordinary use of Claude Code and other native Anthropic applications"; zakaz dotyczy m.in. kierowania żądań przez poświadczenia Free/Pro/Max w produktach dla użytkowników) nie rozstrzyga tego scenariusza; interpretacja należy do autorki. [Decyzja]

**Ścieżka (b): grader przez Agent SDK** [Ustalenie] ([agent-rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/agent-rubric/))

- `agent-rubric` przyjmuje `anthropic:claude-agent-sdk` (alias `anthropic:claude-code`), odrzuca providery czysto tekstowe; bez jawnego gradera używa `openai:codex-sdk` (logowanie Codex, bez klucza Claude), więc **domyślny `agent-rubric` nie jest ścieżką Claude Pro**. Dokumentacja nie opisuje uwierzytelniania gradera Agent SDK; rekomenduje `llm-rubric`, gdy grader potrzebuje tylko wyjścia i rubryki, i nie mówi, czy `llm-rubric` przyjmie provider agentowy [Luka]. Grader agentowy domyślnie nie ma być wyposażony w zapis/shell; dokumentacja ostrzega, że włączenie narzędzi daje im efekt w trakcie evali.
- [Propozycja] Przy tej ścieżce grader pracuje na tym samym logowaniu co recenzent, więc ocena gradera zużywa ten sam limit planu.

**Ograniczenia wspólne dla obu ścieżek** [Propozycja]

- Grader ocenia tekst (`summary`, ew. `note`), nie pewność technicznych ustaleń; ten sam model (rodzina) jako recenzent i grader grozi stronniczością, a ocena jest niedeterministyczna. Rubryki w języku polskim: dokumentacja wskazuje `rubricPrompt` jako drogę dla wyjścia nie-angielskiego.
- Każda asercja `llm-rubric` to dodatkowe wywołanie modelu na przypadek, więc mnoży zużycie limitu: modele × przypadki × powtórzenia × asercje rubrykowe.
- Rubryki warto ograniczyć do tego, czego nie da się sprawdzić deterministycznie (jakość `summary`/`note`), a werdykt i oceny sprawdzać kodem.

## Code References

- `tools/code-reviewer/src/run.ts:9,12` - `MODEL` na sztywno i limit czasu 10 min.
- `tools/code-reviewer/src/run.ts:14-38` - typy `QueryParams`/`QueryFn`/`QueryMessage`, szew do wstrzyknięcia `query`.
- `tools/code-reviewer/src/run.ts:72-157` - `runReview`: wejście → SDK → walidacja → `deriveOutcome`.
- `tools/code-reviewer/src/run.ts:107-118` - stałe opcje SDK (prompt, `tools: []`, `maxTurns: 2`, `maxBudgetUsd: 0.5`, `outputFormat`).
- `tools/code-reviewer/src/index.ts:2-3,48-58` - auth z logowania, brak klucza API; prawdziwe `query` przekazane do `runReview`.
- `tools/code-reviewer/src/input.ts:5,17-44` - limit 60 000 znaków i format promptu z blokami `<pr_title>`, `<pr_body>`, `<diff>`.
- `tools/code-reviewer/src/review-schema.ts:139-193,206` - schemat zod i `REVIEW_JSON_SCHEMA` (draft-07).
- `tools/code-reviewer/src/validate.ts:10-34` - reguły spoza JSON Schema.
- `tools/code-reviewer/src/outcome.ts:4-5,29-38` - próg tymczasowy 5 i `deriveOutcome`.
- `tools/code-reviewer/fixtures/sample.diff`, `fixtures/sample.review.metrics.json` - fikcyjny diff z M5L2 i przykład metryk.
- `tools/code-reviewer/package.json` - skrypty `review`, `test` (`tsx --test`), SDK `^0.3.310`.

## Architecture Insights

- `runReview` oddziela logikę (czysty moduł z wstrzykniętym `queryFn`) od CLI; to jest naturalny punkt wejścia dla evali i powód, dla którego wariant A nie wymaga refaktoru produkcyjnego kodu.
- Bramka (`deriveOutcome`) jest deterministyczna i nie ufa polu `verdict` samodzielnie, więc evale mają sens na poziomie `outcome` + ocen, a `verdict` modelu jest tylko jednym z wejść.
- Kontrakt nie ma pola z konkretnymi zarzutami, więc jakość „trafienia w błąd" mierzy się pośrednio. To ograniczenie evali wynika z kontraktu, nie z promptfoo.
- Zasada z `CLAUDE.md`: koszt każdego uruchomienia ma być logowany, a twardy limit ustawiony zanim agent zacznie działać bez nadzoru; pole `Metrics` już to realizuje dla pojedynczego przebiegu, ewale muszą dodać limit na cały zestaw (liczba wywołań), bo `maxBudgetUsd` dotyczy jednego `query()`.

## Historical Context (from prior changes)

- `context/changes/ci-cd-code-review/plan-brief.md` - ewaluacje promptfoo są jawnie poza zakresem tamtej zmiany; próg 5 „tymczasowy, do weryfikacji w ewaluacjach"; `incomplete` może być częstym wynikiem (nowa logika bez testów w diffie).
- `context/changes/ci-cd-code-review/research.md` §4–§5 - kategorie A/B/C dotyczące uwierzytelnienia subskrypcją, `total_cost_usd` jako szacunek, jedna próbka metryk; nadal obowiązujące i niezmieniane tym badaniem.
- `context/changes/ci-cd-code-review/requirements.md` - zaakceptowane kryteria i reguły dla promptu (źródło oczekiwań w evalach).
- `.claude/prompts/m5l2-agent.md:17` - wcześniejszy zamiar: eksportować recenzenta tak, aby można na nim uruchamiać evale promptfoo, bez konfigurowania środowiska evali w tamtej zmianie.
- `context/archive/`: nie przeszukiwano poza grepem `promptfoo` w repo (poza `node_modules`), który nie zwrócił plików archiwum.

## Related Research

- `context/changes/ci-cd-code-review/research.md` - pokrewne (auth, koszt, kontrakt); nie dotyczy promptfoo.

## Open Questions

Decyzje autorki:

1. Lista 2–3 porównywanych modeli: po sondzie `supportedModels()`/`/model` na koncie, bez założeń; czy Fable (możliwe rozliczenie z usage credits) jest wykluczony.
2. Grader `llm-rubric`: ścieżka (a) `anthropic:messages` + `apiKeyRequired: false`, (b) grader Agent SDK (po sprawdzeniu, czy działa), czy (c) w ogóle bez gradera LLM i tylko asercje deterministyczne. Ocena zgodności (a) z warunkami korzystania.
3. Czy rozszerzać kontrakt o listę zarzutów (`findings`), czy oprzeć „oczekiwane ustalenia" na ocenach i `notAssessed`.
4. Liczba przypadków, powtórzeń i równoległość (zużycie limitu planu) oraz górny budżet zestawu.
5. Gdzie trzymać konfigurację promptfoo i jej zależność; co provider zwraca jako `output` i jak raportuje błędy.
6. Czy asercje `cost` mają być bramką, czy tylko raportem (szacunek SDK ≠ rachunek).

Luki do sprawdzenia bez wywoływania modeli (w fazie planu/implementacji):

7. Czy loader `.ts` promptfoo rozwiązuje importy z rozszerzeniem `.ts` w `tools/code-reviewer/` (test na fałszywym `queryFn`).
8. Czy `is-json` ze schematem `REVIEW_JSON_SCHEMA` (draft-07, `anyOf` z `null`) przechodzi w walidatorze promptfoo.
9. Wynik `supportedModels()` na koncie i definicja `ModelInfo`/`AccountInfo` (nieprzeczytana część strony SDK).
10. Czy `llm-rubric` przyjmuje provider `anthropic:claude-agent-sdk` oraz jak uwierzytelnia się grader agentowy.
11. Opcja wyłączenia telemetrii promptfoo i czy cache dotyczy własnego providera.

Nie badano: kodu źródłowego promptfoo (tylko oficjalna dokumentacja), ustawień konta Claude i stanu extra usage, treści `.credentials.json`, `context/archive/`. Nie uruchamiano modeli, instalacji ani testów.
