# code-review-evals

Evale recenzenta z `tools/code-reviewer/` w promptfoo. Provider (`src/provider.ts`) wywołuje rzeczywisty `runReview()`, więc prompt, schemat, walidacja i bramka `deriveOutcome` są produkcyjne; podmieniany jest wyłącznie `options.model`. Plan: `context/changes/code-review-evals/plan.md`.

Wyniki pierwszej macierzy 3 × 2 (6 komórek, każda raz, 2026-10-27): `context/changes/code-review-evals/results.md`; surowe pliki w `results/`. Pierwsza macierz jest zakończona; ponowne uruchomienie `npm run eval` wywołuje modele i wymaga świadomej zgody.

Zasady:

- Brak asercji modelowych (`llm-rubric`, `agent-rubric`). LLM-as-a-judge jest odłożony; ocena merytoryczna jest ręczna.
- Brak `fallbackModel`, powtórek i ponawiania. Każde uruchomienie kosztuje limit planu Claude Pro.
- Uwierzytelnianie wyłącznie standardowe (Agent SDK). Pakiet nie czyta plików poświadczeń; `npm run preflight` przerywa, gdy ustawiona jest `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` albo `OPENAI_API_KEY` (sprawdza tylko obecność nazw).
- Koszt z SDK (`total_cost_usd`) to szacunek, nie rachunek ani zużycie limitu.

## Zależności

Pakiet ma własny `package-lock.json` i dokładnie przypięte `promptfoo` oraz `@anthropic-ai/claude-agent-sdk` (ta sama wersja SDK co w recenzencie). Provider importuje kod z `../code-reviewer/src/`, a `zod` rozwiązuje się z `tools/code-reviewer/node_modules`, więc na świeżym checkoucie zainstaluj oba pakiety:

```sh
npm ci --ignore-scripts   # w tools/code-reviewer
npm ci --ignore-scripts   # w tools/code-review-evals
```

`--ignore-scripts` wystarcza: skrypty instalacyjne mają tylko `esbuild` (zależność `tsx`, tak jak w recenzencie) i opcjonalny `fsevents`.

## Polecenia

| Polecenie                     | Co robi                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                    | Testy providera, preflightu, odcisku i wrappera (bez promptfoo, bez modeli).                                                                                                                                        |
| `npm run typecheck`           | `tsc --noEmit` dla `src/` i `checks/`.                                                                                                                                                                              |
| `npm run check:loader`        | Cztery kontrole z prawdziwym promptfoo i providerem z fałszywym `queryFn` (kilkanaście sekund, bez modeli).                                                                                                         |
| `npm run preflight`           | Sprawdza brak zmiennych kluczy API.                                                                                                                                                                                 |
| `npm run fingerprint`         | Wypisuje odcisk konfiguracji i jego składniki.                                                                                                                                                                      |
| `npm run eval -- <args>`      | `promptfoo eval` z `promptfooconfig.yaml`, `--no-cache --max-concurrency 1 --repeat 1`; filtry komórki i `-o` po `--`. **Wywołuje modele**: tylko za zgodą (Faza 3/4). Pusty `model:` w konfiguracji blokuje start. |
| `npm run promptfoo -- <args>` | Jedyne wejście do promptfoo: preflight, wyłączona telemetria/aktualizacje/udostępnianie, stan w `.promptfoo/`.                                                                                                      |

## Odcisk konfiguracji

`npm run fingerprint` haszuje (sha256, z normalizacją końców linii) `promptfooconfig.yaml` (asercje, modele, flagi), `expectations.md`, `diffs/*`, `package.json` i lockfile obu pakietów oraz domknięcie statycznych importów providera i każdego pliku wskazanego w konfiguracji przez `file://`. Pliki recenzenta nie są wypisane ręcznie: nowy import w `run.ts` trafia do odcisku sam (`errors.ts` jest dziś w domknięciu). Filtr wyboru komórki nie wchodzi do odcisku. Brakujący plik albo nierozwiązywalny import przerywa obliczenie.

## Wyniki kontroli z Fazy 1 (bez modeli)

|     | Kontrola                                                                                                                                 | Wynik                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) | Loader `.ts` promptfoo 0.125.1 rozwiązuje importy z rozszerzeniem `.ts` z `../code-reviewer/src/` (łącznie z `zod` z pakietu recenzenta) | Tak, bez kompilacji do JS. `checks/loader.check.test.ts`, test 1                                                                                                                                                                                                                 |
| (b) | `is-json` z minimalnym schematem `ResultFile` (`status`, `outcome`)                                                                      | Działa; odrzuca tekst niebędący JSON-em i JSON bez wymaganych pól (test 4). `REVIEW_JSON_SCHEMA` nie jest tu używany; pole `review` waliduje osobna asercja `REVIEW_SCHEMA.safeParse` dla `status: reviewed` (Faza 2)                                                            |
| (c) | Wyłączenie telemetrii i sprawdzania aktualizacji                                                                                         | Według dokumentacji: `PROMPTFOO_DISABLE_TELEMETRY=1`, `PROMPTFOO_DISABLE_UPDATE=1`, dodatkowo `PROMPTFOO_DISABLE_SHARING=true`, `PROMPTFOO_DISABLE_REMOTE_GENERATION=true`; wrapper `src/cli.ts` ustawia je zawsze (test w `src/cli.test.ts`). Nie weryfikowano ruchu sieciowego |
| (d) | Filtry wyboru komórki                                                                                                                    | `--filter-providers` (regex po `id` lub `label`) i `--filter-pattern` (regex po `description` testu) łączą się w jedną komórkę (test 3); filtr po etykiecie providera działa przy `id: file://...` + `label`                                                                     |
| (e) | Zmienne `file://` w testach                                                                                                              | Treść pliku trafia do `vars.diff` jako tekst; ścieżki z `file://` są względne wobec katalogu pliku konfiguracji (`checks/sample.diff` dla `checks/loader-check.yaml`); właściwa konfiguracja leży w katalogu pakietu, więc odcisk rozwiązuje je względem pakietu (test 1)        |

Dodatkowe obserwacje: promptfoo zapisuje w wyniku `latencyMs`, `cost`, `tokenUsage` oraz `response.metadata` z providera (test 2).

## Znane ograniczenie: `npm audit` (sprawdzone 2026-10-27, promptfoo 0.125.1)

`npm audit` zgłasza 7 pozycji o poziomie high, ale to dwa advisories i ich skutki w łańcuchu zależności:

- `@azure/msal-node` (GHSA-xcx6-jx8p-x3h5): ujawnienie parametrów przepływu authorization code do kontrolowanego przez atakującego endpointu; wchodzi przez `@azure/identity` (dostawcy Azure w promptfoo).
- `basic-ftp` (GHSA-c475-qrg2-pj4r): DoS (backtracking regexu) w parserze listingu FTP; wchodzi przez `get-uri`, `pac-proxy-agent`, `proxy-agent` (obsługa proxy/PAC).

Lokalna ścieżka evali (własny provider wywołujący Agent SDK, bez Azure, bez proxy/PAC, bez FTP, bez serwera `promptfoo view`, bez udostępniania) nie wywołuje żadnej z tych funkcji, więc nie blokują użycia. Proponowana przez audyt "poprawka" to `promptfoo@0.123.1`, czyli starsza wersja, i nie jest stosowana. Zasady utrzymania ograniczenia: nie używać providerów Azure, nie ustawiać proxy/PAC ani adresów FTP w konfiguracji, nie uruchamiać `promptfoo view`/`share` (wrapper wyłącza udostępnianie), uruchamiać evale tylko lokalnie na fikcyjnych danych. Nie wykonywano `npm audit fix` ani pełnego audytu.
