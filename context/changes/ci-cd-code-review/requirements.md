# Requirements: CI/CD code review

Sekcje od „Overall concept” do „Otwarte decyzje bramki” są **propozycjami do akceptacji**, a nie wcześniejszymi decyzjami. Wyjątek: ograniczenie „bez dodatkowo płatnego API” w sekcji „Uwierzytelnienie” jest obowiązującą decyzją. Zaakceptowana jest też sekcja „Code Review Criteria” poniżej.

## Overall concept

Propozycja: workflow GitHub Actions uruchamiany dla każdego PR-a do `master`. Samo review jest wydzielone do lokalnej composite action w `.github/actions/` i korzysta z pakietu `tools/code-reviewer/`. Workflow odpowiada za wyzwalanie, uprawnienia i efekty uboczne w PR-ze, a composite action za uruchomienie recenzenta i zwrócenie jego wyniku.

## Uwierzytelnienie

Obowiązujące ograniczenie (decyzja): review nie korzysta z dodatkowo płatnego API.

Propozycja realizacji, do zweryfikowania w CI:

- token subskrypcji Claude Pro wygenerowany przez `claude setup-token`, przechowywany jako sekret repozytorium `CLAUDE_CODE_OAUTH_TOKEN`,
- to kierunek do potwierdzenia rzeczywistą próbą w CI. Do tego czasu nie wiadomo, czy ta ścieżka działa w tym workflow,
- na tym etapie nie generujemy tokenu i nie zmieniamy sekretów.

## PR-y z forków

Propozycja: review, które wymaga sekretu, jest dla PR-ów z forków pomijane. Nie obchodzimy ograniczeń dostępu do sekretów. Status pominiętego review jest otwartą decyzją (zob. „Otwarte decyzje bramki”).

## Input parameters

Propozycja: agent dostaje wyłącznie trzy wejścia:

- tytuł PR-a,
- opis PR-a,
- `git diff` względem gałęzi bazowej.

Agent ocenia wyłącznie dostępne dowody. Jeśli są niewystarczające lub kryterium nie dotyczy zmiany, zgłasza to jawnie zgodnie z zasadami wspólnymi.

## Parked for later

Propozycja: odłożone na później są dopasowanie biznesowe i architektoniczne zmiany. Nie wchodzą w zakres pierwszego workflow.

## Expected side-effects

Propozycja: po każdym przeglądzie workflow

- dodaje w PR komentarz z podsumowaniem,
- ustawia etykietę `ai-cr:passed` albo `ai-cr:failed`.

Sposób oznaczania błędu wykonania lub braku pełnej oceny pozostaje otwartą decyzją.

## Expected behavior

Propozycja: ponowne review uruchamia dodanie etykiety `ai-cr:review`.

## Koszt

Propozycja: każdy przebieg loguje dostępne metryki i działa z limitem `maxBudgetUsd`. Wymagane jest rozróżnienie trzech wielkości, których nie zakładamy jako równych:

- szacunek kosztu raportowany przez SDK,
- faktyczna opłata,
- zużycie limitów subskrypcji.

## Otwarte decyzje bramki

Nie rozstrzygamy ich na tym etapie. Mają zostać rozstrzygnięte podczas planowania:

- progi ocen i sposób wyznaczania werdyktu,
- reprezentacja „brak danych do oceny” i „kryterium nie dotyczy zmiany” (zob. „Otwarte kwestie kontraktu i bramki” w sekcji „Code Review Criteria”),
- zachowanie przy błędzie modelu, przekroczeniu limitu lub niepoprawnej odpowiedzi,
- status dla pominiętego review PR-a z forka,
- wymagany status check i ochrona gałęzi.

## Code Review Criteria

Status: kryteria i reguły zaakceptowane 2026-10-25. Reprezentacja braku oceny i wpływ na bramkę CI pozostają otwarte (sekcja „Otwarte kwestie kontraktu i bramki”). Nazwy pól schematu w `tools/code-reviewer/src/review-schema.ts` pozostają bez zmian.

Agent w CI dostaje wyłącznie tytuł PR-a, jego opis i `git diff`. Agent ocenia wyłącznie dostępne dowody. Jeśli są niewystarczające lub kryterium nie dotyczy zmiany, zgłasza to jawnie zgodnie z zasadami wspólnymi.

### Zasady wspólne

Obowiązkowo trafiają do instrukcji agenta CI.

- Agent ocenia tylko to, co widać w tytule, opisie i diffie. Nie zakłada ani istnienia, ani braku kodu poza przekazanym kontekstem.
- Brak dowodu nie jest ani wysoką, ani niską jakością. Ocenę obniża wykazana sprzeczność lub wada, a nie brak informacji.
- Niejasności agent zgłasza jako pytania do autora, nie jako zarzuty.
- Ocena 10 dotyczy zakresu możliwego do sprawdzenia z przekazanego kontekstu. Nie jest dowodem doskonałości całego repozytorium.
- To samo naruszenie nie obniża dwóch ocen.
- Pojedyncze drobne odstępstwo nie oznacza oceny 1. Ocena uwzględnia skalę naruszenia i wagę ryzyka.
- Agent rozróżnia dwa przypadki i opisuje je wprost w podsumowaniu:
  - brak danych do oceny: kryterium dotyczy zmiany, ale przekazany kontekst nie pozwala go ocenić,
  - kryterium nie dotyczy zmiany: diff nie zawiera niczego, co to kryterium obejmuje.
- Agent nie wymyśla w żadnym z tych przypadków liczby neutralnej. Do czasu decyzji o kontrakcie ocenia tylko to, co widać w diffie, a gdy kryterium nie ma czego ocenić, mówi to wprost w podsumowaniu.

### 1. Poprawność implementacji (`implementationCorrectness`)

Zakres: poprawność kodu oraz zgodność z deklarowanym zachowaniem z tytułu i opisu PR. Dotyczy też pliku testu w `src/pages/` bez prefiksu `_`, bo Astro traktuje taki plik jako trasę.

- **Widoczne dowody:** sprzeczność opisu z diffem, pominięta obsługa błędów (np. zignorowany `error` z Supabase), niezgodność typów, regresja w zmienianych liniach, plik testu w `src/pages/` bez prefiksu `_`.
- **Czego nie uznawać za błąd:** brak lokalnego sprawdzenia `locals.user` w nowej trasie, bo middleware wymaga zalogowania poza `/auth/` i `/api/auth/` (reguła 1).
- **Ograniczenia oceny:** diff nie pokazuje wywołujących ani plików, których nie zmieniono. Agent nie zakłada zachowania niewidocznego kodu. Może wskazać wpływ poza diffem, jeśli wynika on jednoznacznie z przekazanych dowodów. Niejasność w opisie zgłasza jako pytanie.
- **Ocena 1:** zmiana widocznie nie robi tego, co deklaruje opis, albo diff zawiera błąd logiczny, który wystąpi na głównej ścieżce.
- **Ocena 10:** główna ścieżka, przypadki brzegowe i obsługa błędów zmienianego kodu są poprawne, a opis zgadza się z diffem w sprawdzalnym zakresie.

### 2. Idiomatyczność (`idiomaticity`)

Zakres: idiomy Astro 7 SSR, React 19, TypeScript i Tailwind 4 oraz konwencje projektu z reguły 2.

- **Widoczne dowody:** dodane linie łamiące konwencje:
  - brak aliasu `@/` w imporcie z `src`,
  - sklejanie klas Tailwind bez `cn()`,
  - `"use client"`,
  - hook poza `src/components/hooks/`,
  - literalne kolory i wartości arbitralne w widokach (np. `bg-purple-600`, `p-[13px]`).
- **Wyjątek:** w `src/components/ui/` istniejące literały upstream shadcn są dopuszczone, ale nowe warianty muszą używać tokenów. Przy niejasnym pochodzeniu kodu w tym katalogu agent zadaje pytanie zamiast stawiać zarzut.
- **Zakres reguł:** `cn()` dotyczy składania klas Tailwind. Alias `@/` dotyczy importów z `src`, nie wszystkich importów.
- **Ograniczenia oceny:** agent nie wie, czy istnieje gotowy komponent z `ui/` lub helper, którego zmiana nie użyła. Może o to tylko zapytać. Plik testu w `src/pages/` bez prefiksu `_` ocenia kryterium 1, nie to.
- **Ocena 1:** liczne lub rażące naruszenia konwencji w widocznym zakresie.
- **Ocena 10:** wszystkie widoczne konstrukcje są zgodne z konwencjami i idiomami stacku.

### 3. Złożoność (`complexity`)

- **Widoczne dowody:** konkretny, zbędny koszt złożoności, np. duplikacja w obrębie diffu, funkcja lub komponent robiące kilka niepowiązanych rzeczy, a także wykazane mieszanie niezwiązanych wątków w jednym PR-ze, jeśli utrudnia zrozumienie, testowanie lub review zmiany.
- **Czego nie uznawać za naruszenie:** abstrakcja użyta raz i rozgałęzienia same w sobie. Brak wzmianki o wątku w opisie PR nie wystarcza do obniżenia oceny, wtedy agent zadaje pytanie.
- **Ograniczenia oceny:** agent nie zna prostszych alternatyw poza diffem. Może o nie tylko zapytać.
- **Ocena 1:** przypadkowa złożoność zasłania intencję zmiany.
- **Ocena 10:** rozwiązanie jest proste i czytelne w widocznym zakresie. Nie jest to dowód, że jest najprostsze ze wszystkich możliwych.

### 4. Pokrycie testami względem ryzyka (`testRiskCoverage`)

Oceniamy jakość i adekwatność testów dostępnych w diffie, bez wymagania nowych testów w każdym PR-ze. Oceny zależą od wagi ryzyk i adekwatności testów, nie od kompletności każdej ścieżki.

- **Widoczne dowody:** wykazane wady testów obecnych w diffie:
  - brak asercji lub asercje tautologiczne,
  - mockowanie tego, co test ma sprawdzać,
  - w teście endpointu asercja body przed statusem,
  - RLS i uprawnienia egzekwowane przez bazę (reguła 4): Mock Supabase nie jest dowodem działania RLS ani uprawnień egzekwowanych przez bazę. Te zabezpieczenia wymagają testów na realnym Supabase. Testy jednostkowe logiki autoryzacji endpointu mogą używać mocków, ale nie zastępują testów integracyjnych.
- **Ograniczenia oceny:**
  - diff nie pokazuje istniejących testów jednostkowych, integracyjnych ani E2E, które mogą obejmować również nowy kod,
  - brak testów w diffie nie dowodzi braku pokrycia poza diffem,
  - pominięcie jakiegoś ryzyka przez pojedynczy widoczny test też tego nie dowodzi,
  - dane w `seed.sql` same nie potwierdzają przetestowania migracji ani RLS,
  - testy migracji mogą korzystać z innych narzędzi niż Vitest.
- **Brak danych do oceny:** nowa lub zmieniona logika bez żadnego testu w diffie. Agent oznacza ograniczenie i pyta o odpowiednie testy lub wyniki ich uruchomienia. Nie obniża oceny za sam brak zmian w testach.
- **Kryterium nie dotyczy zmiany:** diff nie zmienia ani nie dodaje logiki, którą trzeba by testować (np. sama dokumentacja).
- **Ocena 1:** testy widoczne w diffie mają wykazane wady, przez które nie chronią głównych ryzyk zmiany (np. nie mają asercji albo mockują dokładnie to, co miały sprawdzać).
- **Ocena 10:** główne ryzyka widocznej zmiany mają celowe i adekwatne testy: poprawne asercje, w testach endpointów status przed body, mockowanie tam, gdzie moduł jest importowany, i brak mockowania tam, gdzie test ma sprawdzać RLS lub uprawnienia egzekwowane przez bazę. Ocena dotyczy tylko zakresu widocznego w diffie.

### 5. Dokumentacja (`documentation`)

- **Widoczne dowody:** komentarze wyjaśniające „dlaczego” w nieoczywistych miejscach, zmiany w `docs/` lub README towarzyszące zmianie kontraktu lub zachowania, opis PR wyjaśniający intencję.
- **Rola opisu PR:** jest źródłem wyjaśnienia intencji, ale nie zastępuje trwałej dokumentacji tam, gdzie jest ona potrzebna. Pusty opis sam w sobie nie obniża oceny. Obniża ją brak potrzebnego wyjaśnienia w całym dostępnym kontekście (kod, diff, opis).
- **Ograniczenia oceny:** agent nie widzi istniejącej dokumentacji, więc nie ocenia jej aktualności poza diffem. Brak zmian w dokumentacji nie jest błędem, gdy zmiana jej nie wymaga.
- **Ocena 1:** w diffie jest nieoczywista logika, decyzja lub zmiana kontraktu, której wyjaśnienie jest potrzebne, a nie ma go ani w kodzie, ani w diffie, ani w opisie PR.
- **Ocena 10:** wszystko, co nieoczywiste, jest wyjaśnione tyle, ile trzeba (w kodzie, dokumentacji lub opisie PR), bez powtarzania oczywistości.

### 6. Bezpieczeństwo (`securitySafety`)

- **Widoczne dowody:**
  - sekrety w kodzie lub plikach diffu,
  - `SUPABASE_URL` lub `SUPABASE_KEY` czytane inaczej niż przez `astro:env/server` albo przekazane do komponentu klienckiego,
  - dane prywatne (stałe spiżarni, wykluczenia) dostępne innym użytkownikom,
  - edycja przepisu dozwolona komuś innemu niż autor lub admin,
  - brak walidacji konkretnego niezaufanego wejścia, ze wskazaniem ryzyka,
  - niebezpieczne renderowanie niezaufanych danych.
- **Nowa tabela bez RLS:** gdy pełny przekazany diff tworzy tabelę i żadna z jego migracji nie włącza dla niej RLS, agent raportuje naruszenie reguły projektu. Nie twierdzi automatycznie, że doszło do wycieku danych.
- **Polityki RLS:** agent ocenia je według operacji i ról rzeczywiście dozwolonych przez domenę. Nie wymaga przyznania każdej operacji każdej roli.
- **Ograniczenia oceny:** agent nie widzi istniejących polityk ani konfiguracji poza diffem. Ocenia treść polityki, nie jej nazwę.
- **Ocena 1:** wykazana podatność, wyciek sekretu lub ujawnienie danych prywatnych.
- **Ocena 10:** widoczna powierzchnia ataku jest odpowiednio zabezpieczona.

### Reguły projektu do instrukcji agenta CI

Agent CI nie czyta `AGENTS.md` (w `tools/code-reviewer/src/index.ts` jest `settingSources: []`), więc te reguły muszą trafić do jego instrukcji wprost.

1. **Middleware.** Każda trasa wymaga zalogowania poza `/auth/` i `/api/auth/`. Niezalogowane `/api/*` dostaje 401, strony przekierowują na `/auth/signin`. Brak lokalnego sprawdzenia `locals.user` nie jest sam w sobie błędem.
2. **Konwencje idiomatyczności.**
   - Importy z `src` przez alias `@/`.
   - Klasy Tailwind składane przez `cn()` z `@/lib/utils`.
   - Brak dyrektyw `"use client"`.
   - Hooki React w `src/components/hooks/`.
   - W widokach tokeny zamiast literalnych kolorów i wartości arbitralnych.
   - Wyjątek: w `src/components/ui/` istniejące literały upstream shadcn są dopuszczone, nowe warianty muszą używać tokenów, a przy niejasnym pochodzeniu kodu agent pyta.
3. **Trasy Astro.** Plik testu w `src/pages/` musi mieć prefiks `_`. Inaczej Astro traktuje go jako trasę.
4. **Testy.**
   - Testy endpointów mockują `@/lib/supabase` tylko tam, gdzie test importuje ten moduł bezpośrednio lub pośrednio, bo importuje on `astro:env/server`, którego Vitest nie rozwiąże.
   - W asercjach najpierw status, potem body.
   - Dane w `seed.sql` nie potwierdzają przetestowania migracji ani RLS.
   - Mock Supabase nie jest dowodem działania RLS ani uprawnień egzekwowanych przez bazę. Te zabezpieczenia wymagają testów na realnym Supabase. Testy jednostkowe logiki autoryzacji endpointu mogą używać mocków, ale nie zastępują testów integracyjnych (`context/foundation/test-plan.md`, ryzyka #2 i #3).
5. **Bezpieczeństwo.**
   - `SUPABASE_URL` i `SUPABASE_KEY` tylko przez `astro:env/server`, nigdy do komponentów klienckich.
   - RLS na każdej nowej tabeli Supabase, z politykami per operacja i rola.
   - Stałe spiżarni i wykluczenia są prywatne.
   - Przepis może edytować tylko jego autor lub admin.
6. **Zasady wspólne** z początku tej sekcji.

### Otwarte kwestie kontraktu i bramki

Do rozstrzygnięcia podczas planowania. Tu nie ma decyzji ani zadania implementacyjnego.

- **Reprezentacja braku oceny.** Trzeba rozstrzygnąć, jak schemat i bramka CI mają wyrażać dwa różne przypadki: „brak danych do oceny” oraz „kryterium nie dotyczy zmiany”. Obejmuje to zmieniony lub nowy kod bez żadnych testów w diffie (kryterium 4) oraz każde kryterium, któremu diff nie daje niczego do oceny.
- **Wpływ na bramkę.** Nierozstrzygnięte, jak brak oceny wpływa na werdykt `pass`/`fail`.
- **Liczba zastępcza.** Nierozstrzygnięta. Jako propozycję rozważano `0` jako znacznik „nie do oceny”.
- **Stan faktyczny:** schemat wymaga liczby w każdym polu ocen (`z.number()`), ale nie wymusza zakresu 1–10 (zakres jest tylko w opisie pola). Dopiero walidacja w `tools/code-reviewer/src/index.ts:63` odrzuca liczby niecałkowite i wartości spoza 1–10, w tym `0`.
- **Teksty schematu i promptu.** Opisy pól w `review-schema.ts` i `SYSTEM_PROMPT` nie zawierają jeszcze ograniczeń oceny ani reguł z tej sekcji. Ich aktualizacja jest osobną zmianą kontraktu, poza zakresem tego dokumentu.
