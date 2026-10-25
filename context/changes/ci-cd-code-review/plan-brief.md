# CI/CD code review — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Pierwszy, doradczy workflow GitHub Actions, który recenzuje PR-y do `master` agentem z `tools/code-reviewer/`. Agent dostaje tytuł, opis i diff, a wynik trafia do PR-a jako sticky komentarz i etykieta `ai-cr:*`. Wszystko odbywa się bez dodatkowo płatnego API, na tokenie subskrypcji `CLAUDE_CODE_OAUTH_TOKEN`.

## Starting Point

Agent działa tylko lokalnie i przyjmuje sam diff. Każdy błąd kończy się kodem 1 na stderr, a schemat wymaga liczby w każdej ocenie, więc nie da się wyrazić „brak danych” ani „nie dotyczy”. Pakiet nie ma testów i nie jest objęty CI. W repo nie ma żadnej integracji z PR-ami.

## Desired End State

PR nie-draft (albo `ready_for_review`) dostaje jedno review, a `ai-cr:review` uruchamia je ponownie. PR ma jeden komentarz bota i jedną etykietę wyniku: `passed`, `failed`, `incomplete` albo `error`. `failed`/`error` dają czerwony job, a `passed`/`incomplete`/skip zielony. Push nowych commitów tylko ustawia `ai-cr:stale`, bez wywołania modelu. Forki i Dependabot dostają jawny skip.

## Key Decisions Made

| Decyzja               | Wybór                                                                                                                                                              | Dlaczego                                                                                                               | Źródło          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------- |
| D1 Auth               | Agent SDK + `CLAUDE_CODE_OAUTH_TOKEN` jako input composite action                                                                                                  | Zachowuje pakiet, kontrakt i podział z requirements; porażka auth w fazie 3 = stop                                     | Plan            |
| D2 Koszt              | Brak rachunku API, extra usage wyłączone; liczbę przebiegów ograniczają wyzwalacze, bez licznika w MVP; `maxBudgetUsd: 0.5`, `maxTurns: 2`                         | `concurrency` ogranicza równoległość, nie liczbę                                                                       | Plan            |
| D3 Kontrakt           | Oceny `number \| null` (całkowite 1–10) + `notAssessed[{criterion, reason: no-data\|not-applicable, note}]`; null ⇔ dokładnie jeden wpis                           | Dwa jawne powody bez wymyślonej liczby; reguły egzekwuje kod, bo structured output nie przyjmuje `minLength`/`minimum` | Plan            |
| D4.1 Błędy            | `ai-cr:error` + czerwony job, bezpieczna kategoria w komentarzu; nieudana publikacja = błąd joba                                                                   | Odróżnia „słaby kod” od „agent padł”                                                                                   | Plan            |
| D4.2 Werdykt          | `failed`, gdy model `fail` lub ocena liczbowa < 5 (próg tymczasowy); `no-data` → `ai-cr:incomplete` (zielony); `not-applicable` pomijane                           | Deterministyczny dolny próg; niepełna ocena ≠ pass                                                                     | Plan            |
| D4.3 Fork i check     | Fork/Dependabot: jawny skip w job summary; brak sekretu w PR z repo = `error`; review doradcze, bez zmian ochrony gałęzi                                           | Zielony job ≠ pełny pozytywny wynik                                                                                    | Research + Plan |
| D5.1 Wyzwalanie       | Model tylko przy `opened` (nie draft), `ready_for_review`, `labeled=ai-cr:review`; `synchronize` → `ai-cr:stale`; kontrola `head.sha` przed publikacją             | Bez automatycznych przebiegów na każdy push; brak nadpisań przez stary wynik                                           | Plan            |
| D5.2 Komentarz i diff | Sticky (znacznik + autor bot), SHA i link do przebiegu; `base...head` bez `package-lock.json` (wypisane w komentarzu); limit 60 000 znaków → `error` bez obcinania | Brak szumu, przewidywalne wejście                                                                                      | Plan            |
| D6 Bramka             | Czyste moduły TS w pakiecie, CLI na plikach, `node:test` przez `tsx --test`, pakiet w jobie `ci`                                                                   | Reguły kontraktu mają testy bez modelu                                                                                 | Plan            |
| D7 Zaufanie           | `pull_request` + utwardzenie (akcje po SHA, `--ignore-scripts`, minimalne `permissions`, sekret w `env` jednego kroku)                                             | Jednoosobowe MVP; ryzyko rezydualne zaakceptowane i zapisane                                                           | Research + Plan |

## Scope

**In scope:**

- schemat → prompt (kryteria z requirements) → walidacja → bramka w pakiecie;
- CLI i testy;
- typecheck i testy pakietu w `ci.yml`;
- `.github/actions/code-review/` i `.github/workflows/ai-code-review.yml`;
- opis jednorazowego przygotowania 6 etykiet;
- próba z jednym przebiegiem SDK (jedno `query()`, bez automatycznego ponawiania całego review);
- historyczne fixture'y M5L2 bez zmian, nowy kontrakt w osobnym syntetycznym fixture.

**Out of scope:**

- ewaluacje promptfoo;
- ochrona gałęzi, rulesety i CODEOWNERS; wymagany check;
- `pull_request_target`/`workflow_run`/environment;
- licznik przebiegów; review przy `synchronize`;
- fallback `claude -p`;
- generowanie tokenu i sekretu (robi autorka);
- `context/archive/` i `context/foundation/`.

## Architecture / Approach

Workflow (routing, uprawnienia, publikacja, bramka) → composite action (instalacja, diff, uruchomienie CLI z tokenem tylko w jednym kroku, `outputs`) → pakiet (wejście z limitem, SDK, walidacja, wynik, render komentarza). Kolejność w jobie review:

1. zdjęcie `ai-cr:review`,
2. checkout,
3. composite,
4. kontrola bieżącego `head.sha`, która jako jedyna ustawia `publish=true`,
5. komentarz i etykiety, tylko przy `publish == 'true'` i bez `always()` (błąd API, brak wyniku kontroli i anulowanie nie publikują),
6. krok bramki (`failed`/`error` → `exit 1`), pod tym samym warunkiem.

## Phases at a Glance

| Faza                                    | Co dostarcza                                                                                          | Główne ryzyko                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Pakiet: kontrakt, bramka, CLI, testy | Nowy kontrakt z `notAssessed`, prompt z kryteriami, testowana logika wyniku i komentarza, pakiet w CI | `tsx`/`esbuild`/binarka SDK bez skryptów instalacyjnych                      |
| 2. Composite action + workflow          | Pełny przepływ w PR-ze, zweryfikowany bez sekretu i bez modelu                                        | Wyścig SHA i `concurrency` przy nieistotnych zdarzeniach                     |
| 3. Próba z tokenem                      | Jeden przebieg SDK (jedno `query()`, wewnętrzne tury ≤ 2) na prawdziwym PR-ze                         | SDK nie przyjmie tokenu albo API odrzuci `nullable` → stop i powrót do planu |

**Prerequisites:**

- przed ręczną weryfikacją fazy 2: autorka tworzy 6 etykiet;
- przed fazą 3: autorka potwierdza wyłączone extra usage, tworzy sekret i potwierdza gotowość (plan zatrzymuje się po fazie 2).

**Estimated effort:** ~2–3 sesje w 3 fazach (faza 1 największa).

## Open Risks & Assumptions

- **Model zaufania (zaakceptowane ograniczenie):** kod PR-a z gałęzi tego repo może uzyskać dostęp do tokenu mimo utwardzenia. Przed dopuszczeniem innych osób z prawem zapisu trzeba wrócić do modelu zaufania (kierunek C).
- Odczyt `CLAUDE_CODE_OAUTH_TOKEN` przez Agent SDK w CI potwierdzi dopiero faza 3. Zgodność scenariusza z warunkami ocenia autorka.
- `nullable` jest obsługiwane według dokumentacji structured outputs, ale na żywo potwierdza je faza 3.
- `incomplete` może być częstym wynikiem (nowa logika bez testów w diffie = `no-data` dla `testRiskCoverage`).
- Próg 5 jest tymczasowy, do weryfikacji w ewaluacjach.
- Ścieżka forka nie jest testowana ręcznie (brak forka testowego).

## Success Criteria (Summary)

- PR-y z tego repo dostają jeden aktualny komentarz i jedną etykietę wyniku, a status joba odpowiada macierzy wyników.
- Nowe commity unieważniają wynik bez wywołania modelu, a stary przebieg nigdy nie nadpisuje stanu po `synchronize`.
- Reguły kontraktu i bramki są pokryte testami w CI; faza 3 kończy się jednym poprawnym review na tokenie subskrypcji.
