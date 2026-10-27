# Wyniki evali recenzenta

Status: **zakończone**: macierz 3 × 2 wykonana (6 z 6 komórek, każda raz), ocena merytoryczna zaakceptowana przez autorkę 2026-10-27. Bez commita w momencie zapisu.

Nie wykonano `llm-rubric` ani żadnej oceny modelowej. Koszt to szacunek SDK (`total_cost_usd`), nie rachunek ani zużycie limitu planu.

## Konfiguracja przed pilotażem

| Pole                                    | Wartość                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| model-A                                 | `claude-sonnet-5-5` (model produkcyjny; dowód działania na tokenie: run CI 40522190492 z `ci-cd-code-review`)                                                   |
| model-B                                 | `claude-haiku-5-5` (potwierdzenie autorki 2026-10-27: widoczny w `/model` bez "Requires usage credits")                                                         |
| Extra usage                             | wyłączone (potwierdzenie autorki 2026-10-27)                                                                                                                    |
| Odcisk (`npm run fingerprint`)          | `60c8455b49ac7e0fd53098fa189e1175240af3432a9c7021009f7a5c2119e904` (**zamrożony** 2026-10-27 przed pilotażem; zmiana czegokolwiek w odcisku unieważnia pilotaż) |
| HEAD / niezacommitowane pliki z odcisku | `fa116be` (master); `tools/code-review-evals/` w całości niezacommitowane (nieśledzone), razem z `context/changes/code-review-evals/`                           |
| Wersje                                  | Node v22.23.3, promptfoo 0.125.1, `@anthropic-ai/claude-agent-sdk` 0.3.310                                                                                      |
| Zgoda na pilotaż                        | autorka, 2026-10-27: jedna komórka `bug` × `model-A`, bez powtórek i bez pozostałych pięciu                                                                     |

## Tabela 3 × 2 (sześć wyników, każda komórka uruchomiona raz, odcisk `60c8455b…e904`)

Asercje: liczba przeszłych / wszystkich (`json`, `status-reviewed`, `review-schema`, `model-used`, `expected`). Oceny: implementacja / idiomatyczność / złożoność / testy / dokumentacja / bezpieczeństwo. Czas: promptfoo / SDK. Tokeny: prompt / completion z `usage` (tylko główna pętla). Koszt: `total_cost_usd`, szacunek SDK całego potoku. "Modele w potoku": klucze `modelUsage`. Kolumna oceny merytorycznej: ocena względem niezmienionych oczekiwań, zaakceptowana przez autorkę 2026-10-27.

| Przypadek       | Model   | Asercje | outcome    | Oceny                       | notAssessed                    | verdict | Wada wskazana | Czas           | Tokeny       | Koszt (szacunek SDK) | Modele w potoku | Ocena merytoryczna                                                                                                                                                                                                                                 |
| --------------- | ------- | ------- | ---------- | --------------------------- | ------------------------------ | ------- | ------------- | -------------- | ------------ | -------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bug` (pilotaż) | model-A | 5/5 ok  | failed     | 2 / 9 / 9 / 5 / 8 / 5       | brak                           | fail    | tak (autorka) | 13,1 s / 9,7 s | 9942 / 478   | $0,0450              | haiku + sonnet  | Wada wskazana: tak (autorka). Brak testu błędu bazy: trafne (autorka). Pytanie o `user_id`/RLS: pytanie wymagające kontekstu (klasyfikacja autorki)                                                                                                |
| `bug`           | model-B | 5/5 ok  | failed     | 3 / 8 / 9 / 5 / 8 / 7       | brak                           | fail    | tak (autorka) | 13,5 s / 8,9 s | 15326 / 1644 | $0,0043              | haiku           | Wada wskazana: tak (propozycja asystenta: wprost ignorowany `error` i 200 zamiast 500). Brak testu 500 trafny; uwaga o nieprzyciętym `name` w teście to drobiazg. Pytanie o `user_id`/RLS jak w A                                                  |
| `correct`       | model-A | 5/5 ok  | passed     | 9 / 9 / 10 / 8 / 9 / null   | securitySafety: not-applicable | pass    | n/d           | 6,6 s / 4,8 s  | 9880 / 556   | $0,0145              | haiku + sonnet  | Brak fałszywych alarmów. Uwagi o brakujących testach `Infinity`, `0`, pustej nazwy: zasadne, opcjonalne, bez wpływu na `outcome` (zatwierdzone przez autorkę)                                                                                      |
| `correct`       | model-B | 5/5 ok  | passed     | 9 / 9 / 9 / 8 / 8 / 9       | brak                           | pass    | n/d           | 12,8 s / 7,5 s | 15264 / 1315 | $0,0018              | haiku           | Brak fałszywych alarmów. Pytania o pustą nazwę i `quantity: 0` oraz uwaga o `Infinity`: zasadne, opcjonalne (zatwierdzone przez autorkę)                                                                                                           |
| `no-data`       | model-A | 5/5 ok  | incomplete | 9 / 10 / 10 / null / 9 / 10 | testRiskCoverage: no-data      | pass    | n/d           | 6,6 s / 4,7 s  | 9074 / 547   | $0,0111              | haiku + sonnet  | Poprawnie: jeden wpis `no-data`, pytanie o testy; pozostałe oceny 9–10. Pytanie o istniejący wspólny typ jednostki: dopuszczalne pytanie (zatwierdzone przez autorkę)                                                                              |
| `no-data`       | model-B | 5/5 ok  | incomplete | 9 / 9 / 10 / null / 9 / 10  | testRiskCoverage: no-data      | pass    | n/d           | 9,2 s / 7,5 s  | 9095 / 1417  | $0,0027              | haiku           | Poprawnie: jeden wpis `no-data`, pytanie o testy. `summary` powtarza treść `notAssessed` i prosi o dodanie testów, wbrew promptowi (nie powtarzać szczegółów braku oceny); pytanie o separator dziesiętny spoza diffu (zatwierdzone przez autorkę) |

## Pilotaż `bug` × `model-A` (2026-10-27)

Plik: `tools/code-review-evals/results/2026-10-27-bug-model-A.json`. Jedno uruchomienie, bez ponowień; odcisk po uruchomieniu równy zamrożonemu (`60c8455b…e904`).

- Asercje (5/5): `json`, `status-reviewed`, `review-schema`, `model-used`, `expected` (`outcome failed`, `implementationCorrectness 2 < 5`). Asercja `expected` jest warunkiem koniecznym; "wada wskazana" oceniana ręcznie.
- `metadata.modelsUsed`: `[claude-haiku-5-5, claude-sonnet-5-5]`. Żądany był tylko `claude-sonnet-5-5`; drugi model pojawił się w `modelUsage` SDK mimo braku `fallbackModel`. Przyczyny nie ustalono (hipoteza niezweryfikowana: pomocnicze żądania Claude Code). Asercja `model-used` sprawdza tylko, że żądany model jest na liście, więc przeszła.
- Odpowiedź recenzenta (`summary`): wskazuje, że endpoint ignoruje wynik `insert` i zwraca 200 zamiast 500 z opisu; zauważa brak testu 500 (mock zawsze zwraca `error: null`); dodaje pytanie, czy wiersze w `shopping_items` mają mieć właściciela (`user_id`) i RLS (poza oczekiwaniami; `securitySafety` 5). Klasyfikacja autorki: **pytanie wymagające kontekstu**, bo diff nie tworzy tabeli ani polityk; nie jest to wykazana podatność i nie liczy się jako zarzut ani jako fałszywy alarm.
- Koszt $0,0450 to szacunek SDK (`total_cost_usd`) obejmujący wszystkie wywołania potoku, w tym drugi model; nie rachunek ani zużycie limitu Pro. Tokeny w tabeli (9942 / 478) pochodzą z `usage` i obejmują tylko główną pętlę, więc **tokeny i koszt mają różny zakres**.

## Rozbicie `modelUsage` Sonnet / Haiku: czego nie da się ustalić (sprawdzone 2026-10-27, bez wywołań modeli)

**Tokeny i koszt per model: niedostępne.** Provider zapisał z `modelUsage` tylko nazwy modeli (`modelsUsed`), bez wartości; plik wyniku i lokalny stan promptfoo (`promptfoo.db`, `logs/`) nie zawierają pól `inputTokens`, `outputTokens`, `costUSD`. Z danych da się podać wyłącznie sumy:

| Zakres                                    | Tokeny                                   | Koszt               |
| ----------------------------------------- | ---------------------------------------- | ------------------- |
| `usage` (główna pętla agenta)             | input 2, cache creation 9940, output 478 | nie podawany osobno |
| `total_cost_usd` (cały potok, oba modele) | n/d                                      | $0,0449531          |
| Sonnet 5.5 osobno / Haiku 5.5 osobno      | niedostępne                              | niedostępne         |

Nie szacuję udziałów z cennika: bez `costUSD` per model byłoby to zgadywanie. Odzyskanie rozbicia wymaga zmiany providera (zapis wartości `modelUsage`), co zmienia odcisk i unieważnia pilotaż, albo ponownego uruchomienia; żadne z tych działań nie zostało wykonane.

**Rola Haiku: nie da się ustalić.** Co jest udokumentowane:

- Typy SDK (`sdk.d.ts`, wersja 0.3.310): `usage` to "MAIN AGENT LOOP ONLY — excludes Task subagent, sidechain, and auxiliary model calls", a `modelUsage` obejmuje "every model call made through the query pipeline … main loop, Task subagents, sidechains, and internal calls such as compaction and Workflow agents"; `total_cost_usd` obejmuje te same wywołania co `modelUsage`. Zgadza się to z obserwacją: `modelsUsed` ma dwa modele, a `usage` odpowiada jednej pętli. Nasza konfiguracja ma `tools: []`, więc w głównej pętli nie powstają subagenci.
- Dokumentacja modeli Claude Code (`model-config`): zmienna `ANTHROPIC_DEFAULT_HAIKU_MODEL` to "the model to use for `haiku`, or background functionality"; strona kosztów (`costs`, "Background token usage") wymienia jako działania w tle podsumowywanie wcześniejszych rozmów dla `claude --resume` i przetwarzanie poleceń.
- Czego dokumentacja nie mówi: do którego wywołania w naszym przebiegu użyto Haiku, ani czy "background functionality" obejmuje uruchomienia Agent SDK w trybie nieinteraktywnym. Nie ma tam też tabeli rodzaj wywołania → model.

Wniosek: że Haiku został użyty obok żądanego Sonneta, jest zmierzone; do czego, nie jest ustalone.

## Ograniczenie interpretacji wyników

**Porównujemy konfiguracje SDK, a nie izolowane modele.** Każda komórka to wynik "żądany model w głównej pętli + wszystko, co SDK dodaje w potoku" (co najmniej w komórce `bug` × `model-A` także wywołanie Haiku). Różnice między komórkami modelu A i B mogą więc wynikać z modelu głównego, z dodatkowych wywołań SDK albo z obu naraz. Dodatkowo asercja `model-used` sprawdza tylko, że żądany model jest na liście `modelsUsed`, więc nie wykrywa obecności modeli dodatkowych, a tokeny (`usage`) i koszt (`total_cost_usd`) w raporcie mają różny zakres.

## Obserwacje (po Fazie 4; liczby z plików w `tools/code-review-evals/results/`)

**Zgodność z oczekiwaniami.** Sześć z sześciu komórek spełnia zatwierdzone oczekiwania (30 z 30 pojedynczych asercji), bez błędu technicznego i bez ponowień; oczekiwania ani odcisk nie zostały zmienione po żadnym wyniku. To obserwacja z jednego uruchomienia na komórkę, nie pomiar.

**`bug`.** Obie komórki wskazują planowaną wadę (ignorowany `error` z `insert`, 200 zamiast 500) i trafnie zauważają brak testu ścieżki błędu. `implementationCorrectness` wynosi 2 (A) i 3 (B). Oba modele zadają to samo pytanie o `user_id`/RLS (klasyfikacja jak w pilotażu: pytanie wymagające kontekstu); `securitySafety` to 5 (A) i 7 (B). `testRiskCoverage` wynosi 5 w obu, czyli dokładnie na progu, nie poniżej.

**`correct`.** Oba modele: `passed`, bez fałszywych alarmów, tylko opcjonalne uwagi o brakujących testach brzegowych. Model A uznał `securitySafety` za `not-applicable` (czysta funkcja), co zgodnie z regułą nie wpływa na wynik.

**`no-data`.** Oba modele: `incomplete`, `testRiskCoverage` `null` z jednym wpisem `no-data` i pytaniem o testy; pozostałe oceny 9–10. W B `summary` powtarza treść `notAssessed` i prosi o dodanie testów, wbrew promptowi.

**Próg `PASS_THRESHOLD = 5` (tylko obserwacja).** Poza `implementationCorrectness` w `bug` żadna ocena nie była poniżej 5; w `correct` i `no-data` najniższe oceny to 8–9. Zestaw nie zawiera przypadków granicznych, więc o właściwym progu nic z niego nie wynika.

**Zakres `summary`.** Prompt wymaga 2–3 zdań łącznie. Liczone ręcznie (z pytaniami), cztery z sześciu odpowiedzi (`bug` A i B, `correct` A i B) mają ich więcej; `validate.ts` długości nie sprawdza.

**Czas, tokeny, koszt (szacunek SDK, jedno uruchomienie na komórkę).**

- Czas promptfoo: A 13,1 / 6,6 / 6,6 s, B 13,5 / 12,8 / 9,2 s (`bug` / `correct` / `no-data`).
- Koszt: A $0,0450 / $0,0145 / $0,0111, B $0,0043 / $0,0018 / $0,0027. Komórki B wyszły w tym przebiegu około 4–10 razy taniej według szacunku SDK.
- Tokeny `usage` (prompt / completion) różnią się mimo identycznego wejścia: `bug` A 9942 / 478, B 15326 / 1644; `correct` A 9880 / 556, B 15264 / 1315; `no-data` A 9074 / 547, B 9095 / 1417. W komórkach B SDK zgłasza tokeny myślenia (1087, 851, 772), w A 0. Przyczyn tych różnic nie ustalono.
- Koszty nie są porównywalne 1:1: komórki były uruchamiane kolejno w ciągu ok. 7 minut i korzystały z wspólnego cache promptu (np. `correct` A i `no-data` A: `cache_read` 7914, `bug` A: 0), więc koszt zależy też od kolejności.

**Haiku w potoku (ograniczenie z sekcji wyżej obowiązuje).** `modelUsage` zawiera `claude-haiku-5-5` we wszystkich trzech komórkach A obok Sonneta; w komórkach B jest tylko Haiku, więc nie da się odróżnić Haiku jako modelu głównego od Haiku jako dodatku SDK. Porównujemy konfiguracje SDK, nie izolowane modele.

**Pytania na kolejną zmianę (bez decyzji tutaj).** Zapis wartości `modelUsage` w providerze; ścisłe sprawdzanie zbioru `modelsUsed`; sprawdzanie długości `summary` w walidacji; przypadki graniczne dla progu 5; LLM-as-a-judge i ewentualne pole `findings`.

## Anonimizacja ścieżek lokalnych w plikach wynikowych

Opublikowane pliki `tools/code-review-evals/results/*.json` mają **zanonimizowane ścieżki lokalne**: prefiks katalogu repo na maszynie autorki zastąpiono napisem `<repo>` (np. `file://<repo>\tools\code-review-evals\diffs\bug.diff`). Surowe pliki z promptfoo zawierały po 16 takich napisów na plik (zmienne `title`, `body`, `diff` i `basePath`), z nazwą użytkownika systemu; razem 96 podmian w sześciu plikach. Sprawdzono, że po podmianie każdy plik jest poprawnym JSON-em i że dokument różni się od surowego wyłącznie tymi napisami: odpowiedzi modeli, oceny, metryki, czasy i metadane są bez zmian, a odcisk konfiguracji (`60c8455b…e904`) nie zmienił się, bo pliki wyników nie wchodzą do odcisku.

**Sprostowanie.** Wcześniejsze stwierdzenie z weryfikacji wyników (2026-10-27, po pilotażu i po macierzy), że pliki wyników nie zawierają ścieżek z katalogu domowego autorki, było błędne: kontrola użyła nieprawidłowego wzorca. Poprawna kontrola wykryła te ścieżki przed commitem; w plikach nie było kluczy, tokenów, surowych `logs` ani adresów e-mail.

## Odstępstwa od kontraktu promptu (zapisane, bez poprawiania)

Zaakceptowane przez autorkę 2026-10-27 jako obserwacje. Nie zmieniono promptu, schematu ani walidacji i nie ponawiano żadnej próby.

1. **Przekraczanie 2–3 zdań w `summary`.** Prompt wymaga "2–3 zdania łącznie" (`review-schema.ts`, `SYSTEM_PROMPT`). Liczone ręcznie (razem z pytaniami) cztery z sześciu odpowiedzi mają więcej: `bug` A i B (po 5 zdań), `correct` A i B (po 4). `validate.ts` długości `summary` nie sprawdza, więc nic tego nie wychwytuje. Pozostałe dwie (`no-data` A i B) mają po 3.
2. **`no-data` B: powtarzanie `notAssessed` w `summary` i żądanie dodania testów.** Prompt każe szczegóły braku oceny zostawić w `notAssessed.note` i "nie powtarzać ich w summary", a kryterium 4 mówi, że nie obniża się oceny za sam brak testów i że agent pyta o testy lub ich wyniki. Odpowiedź B pisze w `summary`: "Brak testów w diffie, więc pokrycie oceniam jako brak danych; prosimy o dodanie testów granicznych (999, 1000, 1500, 250 g, ml, l, kg, pcs) lub wskazanie, gdzie już istnieją". Powtarza więc treść `notAssessed` i formułuje prośbę o dodanie testów zamiast samego pytania. Wynik (`incomplete`, jeden wpis `no-data`) jest poprawny, więc asercje przeszły; odstępstwo dotyczy treści `summary`, a nie kontraktu strukturalnego.

Oba odstępstwa dotyczą jednego uruchomienia na komórkę (częstość nieznana).

## Decyzje końcowe autorki (2026-10-27)

- Oba wyniki `bug`: wada wskazana. `correct`: brak wykazanych fałszywych alarmów. `no-data`: poprawne rozpoznanie braku danych.
- **Nie poprawiamy teraz promptu** ani nie ponawiamy prób.
- **Wyniki nie uzasadniają zmiany modelu produkcyjnego** (`claude-sonnet-5-5` w `run.ts`) **ani progu `PASS_THRESHOLD = 5`.** Szczegóły: sześć wyników z jednego uruchomienia na komórkę to obserwacja, nie pomiar; porównujemy konfiguracje SDK, a nie izolowane modele (obecność Haiku w potoku, brak rozbicia `modelUsage`); zestaw nie zawiera przypadków granicznych dla progu; koszty zależą od kolejności (cache).
- Brak LLM-as-a-judge; nie wykonano `llm-rubric` ani żadnej oceny modelowej.
