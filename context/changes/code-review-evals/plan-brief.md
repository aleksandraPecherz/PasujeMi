# Evale recenzenta w promptfoo — Plan Brief

> Full plan: `context/changes/code-review-evals/plan.md`
> Research: `context/changes/code-review-evals/research.md`

## What & Why

Mały zestaw evali, który uruchamia rzeczywisty `runReview()` recenzenta na trzech fikcyjnych diffach i dwóch modelach z Claude Pro. Dzięki temu widać, czy prompt, schemat, walidacja i bramka zachowują się zgodnie z oczekiwaniami, zanim ktokolwiek zmieni próg 5 albo prompt. Oczekiwania są zapisane przed uruchomieniem, asercje są deterministyczne, a ocena merytoryczna jest ręczna.

## Starting Point

Recenzent (`tools/code-reviewer/`) ma testy z fałszywym `queryFn`, ale nikt nie sprawdził jego odpowiedzi modeli na kontrolowanych przypadkach. `runReview()` przyjmuje wstrzykiwane `query`, a model jest stałą `claude-sonnet-5-5`. promptfoo nie jest zainstalowany ani skonfigurowany. Workflow review instaluje `tools/code-reviewer` w jobie z sekretem.

## Desired End State

Pakiet `tools/code-review-evals/` z providerem, trzema przypadkami, plikiem oczekiwań i odciskiem konfiguracji. Sześć wyników (3 przypadki × 2 modele, po jednym uruchomieniu) w `results.md` z czasem, tokenami, szacunkiem kosztu SDK i ręczną oceną autorki. Nic nie zmienia się w recenzencie, workflow ani modelu produkcyjnym.

## Key Decisions Made

| Decision          | Choice                                                                                                                                                                                 | Why (1 sentence)                                                                     | Source                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| Uruchamianie kodu | Własny provider wołający `runReview()`                                                                                                                                                 | Zachowuje prompt, schemat, walidację i bramkę bez duplikowania                       | Plan (zakres autorki)  |
| Kontrakt          | Bez `findings`, bez zmian schematu                                                                                                                                                     | Schemat jest kontraktem; evale mierzą go takim, jaki jest                            | Plan (zakres autorki)  |
| Lokalizacja       | Nowy pakiet `tools/code-review-evals/`, wersje przypięte dokładnie                                                                                                                     | Install workflow review z sekretem (`npm ci --ignore-scripts`) pozostaje nietknięty  | Plan (decyzja autorki) |
| Modele            | Dwa z pickera `/model`, bez `fallbackModel`, bez prób modelowych przy ustalaniu                                                                                                        | Dokumentacja nie podaje listy modeli per plan                                        | Research + Plan        |
| Kandydaci         | Autorka czyta `/model` (bez żądania do modelu)                                                                                                                                         | Sonda SDK nie ma udokumentowanego braku żądania do modelu                            | Plan (decyzja autorki) |
| Przypadki         | Poprawna z testem, celowy błąd (ignorowany `error` bazy), brak danych (logika bez testu)                                                                                               | Poprawny przypadek bez testu dałby `incomplete`, nie `passed`                        | Research + Plan        |
| Asercje           | Deterministyczne na `outcome`, ocenach i `notAssessed`; brak `llm-rubric`. `is-json` sprawdza cały `ResultFile`, a `REVIEW_SCHEMA` waliduje pole `review` tylko dla `status: reviewed` | LLM-as-a-judge jest odłożony i nie jest udawany; `error`/`skipped` nie mają `review` | Plan (korekta autorki) |
| Ocena błędu       | Dla `bug` ręczne wskazanie konkretnej wady (sukces mimo błędu zapisu); `failed` i ocena < 5 to warunki konieczne, nie dowód                                                            | Inna przyczyna `failed` nie może uchodzić za wykrycie wady                           | Plan (korekta autorki) |
| Uwierzytelnianie  | Standardowe Agent SDK, bez czytania poświadczeń; preflight sprawdza brak kluczy API                                                                                                    | `ANTHROPIC_API_KEY` przesłoniłby subskrypcję                                         | Research + Plan        |
| Pilotaż           | Celowy błąd × model A; liczy się do sześciu wyników przy identycznym odcisku konfiguracji                                                                                              | Najbardziej informatywna komórka; odcisk daje mierzalną definicję „niezmienionej"    | Plan (decyzja autorki) |
| Uruchomienia      | `maxConcurrency: 1`, `--no-cache`, bez powtórek i retry                                                                                                                                | Ogranicza zużycie limitu planu                                                       | Plan                   |
| Koszt             | Tylko raport szacunku SDK, bez bramki `cost`                                                                                                                                           | `total_cost_usd` to szacunek, nie rachunek                                           | Research               |

## Scope

**In scope:** nowy pakiet z providerem, testami i konfiguracją; trzy fikcyjne przypadki; plik oczekiwań; preflight i odcisk; wybór dwóch modeli; pilotaż; pozostała macierz po zgodzie; tabela wyników z ręczną oceną; wykluczenia w root ESLint i tsconfig.

**Out of scope:** `llm-rubric`/`agent-rubric` i jakikolwiek grader modelowy; `findings` i zmiany schematu, promptu, progu; zmiany w `tools/code-reviewer/`, `.github/`, `context/foundation/`, `context/archive/`; `fallbackModel`, powtórki, retry; bramka kosztowa; commity bez prośby.

## Architecture / Approach

`promptfooconfig.yaml` → provider (`src/provider.ts`) → `runReview()` z `queryFn` opakowującym `query()` z SDK i podmieniającym `options.model` → `ResultFile` jako `output`. Provider zwraca też `tokenUsage`, `cost` (szacunek) i `metadata` (żądany i faktyczny model z `modelUsage`). Asercje `javascript` czytają `ResultFile`. Skrypt odcisku haszuje konfigurację z asercjami, oczekiwania, diffy, kod providera, całe domknięcie importów `run.ts` (m.in. `errors.ts`; lista wyliczana, nie wpisana na sztywno) oraz wersje; ten sam odcisk decyduje, czy pilotaż liczy się do sześciu wyników.

## Phases at a Glance

| Phase                             | What it delivers                                                                               | Key risk                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Pakiet i provider (bez modeli) | Szkielet, provider, preflight, odcisk, testy; kontrole loadera, `is-json`, telemetrii, filtrów | Loader `.ts` promptfoo i instalacja bez skryptów                                 |
| 2. Diffy, oczekiwania, modele     | 3 diffy, `expectations.md`, asercje, wybór 2 modeli, odcisk przed pilotażem                    | Oczekiwania napisane po zobaczeniu wyniku, albo model rozliczany z usage credits |
| 3. Pilotaż                        | Jedno uruchomienie i ręczna ocena, potem stop                                                  | Błąd wywołania lub `invalid-output` zużywa jedyną próbę (bez retry)              |
| 4. Pozostała macierz              | 5 komórek po zgodzie, tabela 3 × 2, wnioski                                                    | Zmiana odcisku unieważnia pilotaż                                                |

**Prerequisites:** Node ≥ 22.22 (jest 22.23.3); zalogowany Claude Code na Pro; nieustawione klucze API; autorka odczytuje `/model` i wybiera dwa modele; zgoda przed Fazą 3 i przed Fazą 4.
**Estimated effort:** ~2–3 sesje w 4 fazach (Faza 1 największa).

## Open Risks & Assumptions

- Które modele są w Twoim planie, wiadomo dopiero po odczycie `/model`; identyfikatory dla `query()` mogą różnić się od aliasów z pickera.
- Loader `.ts` promptfoo może nie rozwiązać importów z rozszerzeniem `.ts`; fallback: kompilacja providera do JS.
- Pojedynczy wynik na komórkę jest niedeterministyczny, więc sześć wyników to obserwacja, nie pomiar.
- Szacunek kosztu SDK nie jest rachunkiem ani zużyciem limitu planu.
- promptfoo (aplikacja trzecia) może mieć telemetrię i sprawdzanie aktualizacji; wyłączenie weryfikowane w Fazie 1.
- Zgodność lokalnych evali na własnym logowaniu z warunkami korzystania pozostaje po stronie autorki (bez zmian względem poprzedniej zmiany).

## Success Criteria (Summary)

- Sześć komórek ma po jednym wyniku przy identycznym odcisku konfiguracji, bez powtórek i bez zmian w zabronionych ścieżkach.
- Oczekiwania istniały i były zatwierdzone przed pierwszym uruchomieniem; wyniki są zestawione z nimi i z ręczną oceną autorki, a komórka `bug` jest „wykryta" tylko, gdy wskazano konkretną wadę (sukces mimo błędu zapisu).
- Raport nie przedstawia niczego jako wyniku `llm-rubric` ani kosztu jako rachunku.
