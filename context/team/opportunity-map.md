# Mapa okazji

## Kontekst

- **Projekt / kontekst**: Samodzielny projekt kursowy PasujeMi (M5L1 kursu 10xDevs). Sygnał 1 pochodzi z pracy z modelami AI przy tym projekcie; sygnały 2–5 to ogólne mechanizmy z doświadczeń współpracy z developerami i biznesem w innych projektach.
- **Ograniczenie danych**: Polityka firmy zabrania pracy na projektach firmowych. Analizujemy wyłącznie mechanizmy, bez repozytoriów, kodu, ticketów i dokumentacji firmowej. Pierwsze wersje działają na danych fikcyjnych (`mock`) albo, przy sygnale 1, na materiałach z własnego projektu; bez danych firmowych. Wynik na fikcyjnych danych pokazuje działanie helpera, ale nie dowodzi jego skuteczności w firmie.
- **Data**: 2026-10-25
- **Pomiary**: Brak danych o straconym czasie, liczbie spotkań i PR-ów. Częstotliwości poniżej to deklaracje autorki, nie pomiary. Mapa nie ustala rankingu według częstotliwości.
- **Różne projekty**: Sygnały 2–5 pochodzą z różnych projektów. Wspomniane narzędzia i role (Jira, wiki/Confluence/repo, szablon PR lub checklista, brak analityka w części projektów) nie muszą występować razem w jednym zespole; kolumna „Istniejąca odpowiedź" opisuje je per sygnał, nie jako jedną wspólną konfigurację.
- **Oznaczenia**: **[Obs.]** = obserwacja autorki, **[Hip.]** = hipoteza lub propozycja Claude, do weryfikacji. Propozycje sprawdzeń poniżej nie są wykonanymi próbami ani procedurami zatwierdzonymi przez autorkę; mapa nie zawiera wyników ani pomiarów.

## Mapa

| Sygnał                                                                              | Istniejąca / domyślna odpowiedź                                                                | Cienkie uzupełnienie                                                                                 | Pierwsza użyteczna wersja                                                   | Ryzyko danych                              | Kierunek, jeśli wartościowe                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| 1. Przekazywanie materiałów między modelami AI (niemal każda praca z AI)            | Pliki w repo (`context/`, `AGENTS.md`); ręczne kopiowanie między różnymi narzędziami           | Skrypt/skill składający pakiet kontekstu i zbierający uwagi w jednym pliku                           | Szablon pakietu + jeden plik porównawczy, ręcznie                           | mock/local (własny projekt)                | Mały helper do przygotowania/przekazywania pakietu kontekstu albo Wait / no build |
| 2. Rozwijanie funkcji po innym developerze (raz do kilku razy w miesiącu)           | `git log`/`blame`, historia PR, `/10x-research`, `/10x-repo-map` (hipoteza: mogą wystarczać)   | Ustandaryzowane zapytanie badawcze wskazujące ślady, hipotezy i niewiadome                           | `/10x-research` na fikcyjnym repo z historią                                | mock (w firmie: kod)                       | Wait / no build                                                                   |
| 3. Ginące lub niespójne ustalenia (niemal co sprint)                                | Jira jako system zapisu, notatki, dokumentacja, rola PO                                        | Raport tylko do odczytu zestawiający 3 źródła i wskazujący rozbieżności                              | 3 fikcyjne pliki + zapytanie o rozbieżności                                 | mock (w firmie: dane firmowe)              | Internal tool / Team agent                                                        |
| 4. Powierzchowne review bez kontekstu (każdy PR większy niż prosty komponent/widok) | Szablon PR, checklista review, wskazanie recenzenta znającego kontekst                         | Brief z dostępnego, zapisanego kontekstu lub informacji od developera; luki oznaczone, nie zgadywane | Ręczny brief dla jednego fikcyjnego PR-a                                    | mock (w firmie: kod)                       | Review / CI gate: wsparcie review; ewentualna integracja z pipeline’em            |
| 5. Bariera językowa biznes–technologia (większość spotkań)                          | Analityk (brakuje w części projektów), wspólny słownik, potwierdzenie ustaleń własnymi słowami | Glosariusz pojęć + opis ustaleń w dwóch rejestrach                                                   | Fikcyjna notatka ze spotkania → dwa opisy + lista pojęć rozumianych dwojako | mock (w firmie: notatki mogą być wrażliwe) | Wait / praktyka z udziałem człowieka                                              |

## Sygnały szczegółowo

### 1. Przekazywanie materiałów między modelami AI

- **[Obs.]** Ręcznie przenosi materiały i kontekst między różnymi narzędziami (np. Claude Code, czat, inne), a potem zbiera uwagi. Rodzaj przenoszonych materiałów zależy od zadania; żaden nie dominuje. Niemal przy każdej pracy z AI.
- **[Hip.]** Ponieważ narzędzia są różne, subagenci w jednym narzędziu tego nie rozwiążą. Część tarcia może być istotna (każde zadanie wymaga innego wycinka materiałów), więc helper musiałby obsłużyć zmienny zestaw, nie jeden stały rodzaj. Rozprowadzanie skilli między repozytoriami nie jest zgłoszonym problemem, więc kierunkiem jest mały helper do pakietu kontekstu, a nie rejestr artefaktów.
- **Propozycja sprawdzenia działania [Hip.]**: zebranie materiałów i uwag w jednym pliku sprawdza organizację.
- **Propozycja sprawdzenia wartości [Hip.]**: mniej ręcznego przygotowania i ponownego wyjaśniania kontekstu, bez utraty potrzebnych informacji. Metrykę i sposób obserwacji ustala autorka.
- **Ryzyko danych**: niskie, własny projekt. Nie wklejać `.env` ani sekretów do pakietu.

### 2. Rozwijanie funkcji po innym developerze

- **[Obs.]** Trzeba odtworzyć działanie funkcji i powody decyzji. Dokumentacja uboga, autor bywa niedostępny. Raz do kilku razy w miesiącu.
- **[Hip.]** Istniejące narzędzia (`git`, historia PR, `/10x-research`, `/10x-repo-map`) mogą wystarczać do ustalenia, co funkcja robi; to hipoteza do sprawdzenia. Narzędzie nie może wiarygodnie ustalić niezapisanej intencji. Może wskazać ślady, hipotezy i niewiadome.
- **Propozycja sprawdzenia działania [Hip.]**: czy wynik oznacza luki jako niewiadome zamiast je zgadywać.
- **Propozycja sprawdzenia wartości**: do ustalenia przez autorkę.
- **Ryzyko danych**: w firmie to kod i dane rzeczywiste, poza zakresem tej analizy.

### 3. Ginące lub niespójne ustalenia

- **[Obs.]** Trzeba porównywać ustalenia ze spotkań, zadania w Jirze i dokumentację (wiki/Confluence/repo), żeby ustalić, co obowiązuje. Niemal co sprint. Dotyczy tego, która decyzja obowiązuje, a nie wzajemnego rozumienia (to sygnał 5).
- **[Hip.]** Wartość wynika z połączenia trzech źródeł. Raport nie zastępuje Jiry jako systemu zapisu, tylko linkuje do źródeł.
- **Propozycja sprawdzenia działania [Hip.]**: wykrycie znanych, podłożonych sprzeczności na mockach. Pokazuje działanie, nie skuteczność w firmie.
- **Propozycja sprawdzenia wartości [Hip.]**: ułatwienie człowiekowi porównania źródeł, bez samodzielnego rozstrzygania, która decyzja obowiązuje.
- **Ryzyko danych**: w firmie dane firmowe; przed budową trzeba rozstrzygnąć dostęp i audytowalność.

### 4. Powierzchowne review przy braku kontekstu

- **[Obs.]** Jeden developer zna projekt na bieżąco, pozostali recenzują sporadycznie i skupiają się na literówkach i ogólnej jakości kodu. Problemem jest brak kontekstu merytorycznego mimo istniejącego szablonu lub checklisty. Przy każdym PR-ze wykraczającym poza prosty komponent lub widok.
- **[Hip.]** Szablon lub checklista nie rozwiązują braku wiedzy o działaniu projektu, więc wartość leży w dostarczeniu kontekstu merytorycznego, a nie w strukturze review. Sam komentarz AI pod PR-em nie dowodzi poprawy review. Powiązanie z M5L2–M5L3 jest dodatkową korzyścią i nie przesądza wyboru.
- **Ograniczenie briefu**: brief może zebrać wyłącznie dostępny, zapisany kontekst lub informacje dostarczone przez developera. Nie zakładamy, że wymagania, reguły i powody decyzji są udokumentowane; dostępność tych źródeł pozostaje niewiadomą. Jeśli wiedza istnieje tylko w głowie developera, trzeba ją najpierw uzyskać. Helper ma oznaczać luki, a nie je zgadywać.
- **Propozycja sprawdzenia działania i wartości [Hip.]**: porównanie oceny tego samego fikcyjnego PR-a bez briefu i z briefem, według wcześniej określonych kwestii merytorycznych. Zestaw kwestii ustala autorka przed próbą.
- **Ryzyko danych**: w firmie kod i dane rzeczywiste.

### 5. Bariera językowa biznes–technologia

- **[Obs.]** Obie strony mogą zgadzać się co do rezultatu, ale nie rozpoznawać zgody, bo inaczej rozumieją pojęcia. Na większości spotkań, szczególnie gdy brakuje analityka.
- **[Hip.]** Rola człowieka (analityk) lub praktyka potwierdzania ustaleń własnymi słowami może być silniejszą odpowiedzią niż helper; to hipoteza do sprawdzenia. Narzędzie mogłoby co najwyżej uzupełniać.
- **Propozycja sprawdzenia wartości [Hip.]**: ocenę wzajemnego zrozumienia mogą przeprowadzić rzeczywiści ludzie na fikcyjnych materiałach. Symulacja rozmowy modeli nie dowodzi porozumienia ludzi.
- **Ryzyko danych**: w firmie notatki ze spotkań mogą zawierać dane wrażliwe.

## Porównanie kandydatów

Porównanie rozważonych opcji, sporządzone przed wyborem; uzasadnia rozważone kandydatury. Wybrano sygnał 4 (sekcja „Wybrany helper"). Wiersze są uporządkowane według numerów sygnałów, a deklarowane częstotliwości nie tworzą rankingu.

| Kandydat                            | Deklarowana częstotliwość / kontekst                  | Czy istniejąca odpowiedź wystarcza                                                                    | Czy da się sprawdzić na mock          | Główne ryzyko                                                                         |
| ----------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Pakiet kontekstu między modelami | Niemal każda praca z AI; własny projekt               | Częściowo (pliki w repo), ale narzędzia są różne                                                      | Tak, na własnych materiałach          | Może okazać się tylko wygodą, jeśli kopiowanie jest szybkie                           |
| 2. Kontekst po innym developerze    | Raz do kilku razy w miesiącu                          | Hipoteza: w dużej mierze tak (git, `/10x-research`, `/10x-repo-map`)                                  | Tak                                   | Niezapisanej intencji nie ustali wiarygodnie żadne narzędzie; może wskazać niewiadome |
| 3. Rozbieżności ustaleń             | Niemal co sprint; łączy 3 źródła                      | Częściowo (Jira, dokumentacja, rola PO)                                                               | Tak, na 3 fikcyjnych plikach          | W firmie dane rzeczywiste; ryzyko stworzenia drugiego systemu zapisu                  |
| 4. Brief kontekstowy do PR          | Każdy PR wykraczający poza prosty komponent lub widok | Struktura review jest, brakuje kontekstu merytorycznego; dostępność źródeł kontekstu to niewiadoma    | Jakościowo, na jednym fikcyjnym PR-ze | Wiedza tylko w głowie developera; trudno ocenić poprawę review bez porównania         |
| 5. Słownik biznes–technologia       | Większość spotkań                                     | Hipoteza: rola analityka lub praktyka silniejsza niż narzędzie (analityka brakuje w części projektów) | Słabo (efekt zależy od ludzi)         | Narzędzie bez analityka może pogłębić fałszywe poczucie zgody                         |

## Wybrany helper

Autorka wybrała sygnał 4: brief kontekstowy do PR-a.

Helper:
Brief kontekstowy do PR-a pomaga recenzentowi poznać cel zmiany i przygotować się do oceny merytorycznej.

Czyta:
W pierwszej wersji korzysta z fikcyjnego PR-a, opisu zadania oraz zapisanych wymagań i reguł domenowych.

Zwraca:
Krótki brief wskazujący oczekiwane zachowanie, istotne reguły i pytania do sprawdzenia podczas review, z odwołaniami do źródeł.
Brakujący lub sprzeczny kontekst oznacza jako pytania do autora.

Nie robi:
Nie zastępuje recenzenta, nie zatwierdza PR-a ani nie dopowiada niezapisanych powodów decyzji.
Pierwsza wersja jest raportem Markdown, bez integracji z GitHubem, logowania, bazy i wdrożenia.

Ryzyko danych:
Korzysta wyłącznie z całkowicie fikcyjnych materiałów, bez kodu i danych firmowych.

Sprawdzenie wartości — propozycja:
Porównanie ocen fikcyjnego PR-a bez briefu i z briefem pod kątem wcześniej określonych kwestii merytorycznych, przy zachowaniu niezależności ocen; wynik nie będzie dowodem skuteczności w firmie.

Kierunek, jeśli się sprawdzi: wsparcie review przez generowanie briefu przy PR-ze; ewentualna integracja z pipeline’em w dalszych etapach.

Pozostałe sygnały (1, 2, 3, 5) zostają w porównaniu powyżej jako uzasadnienie rozważonych opcji.

## Następny krok

- Wybór helpera i opis jego pierwszej wersji w tej mapie kończą artefakt M5L1.
- `/10x-mom-test` jest opcjonalny.
- `/10x-shape` ani implementacja nie są obowiązkową kontynuacją M5L1. Mapa nie zawiera planu implementacji ani decyzji o budowie.
