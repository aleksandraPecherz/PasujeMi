---
project: "PasujeMi"
version: 1
status: draft
created: 2026-10-08
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-12-06
  after_hours_only: true
---

# PasujeMi — PRD

## Vision & Problem Statement

Osoba gotująca dla siebie i domowników ma w domu określone produkty i chce szybko zobaczyć, co z nich ugotuje. Dziś przegląda przepisy ręcznie (rozrzucone po screenach, książkach, TikToku) i dopiero w trakcie wychodzi, że brakuje składnika albo przepis zawiera coś, czego domownicy nie jedzą lub na co są uczuleni. Koszt: stracony czas i frustracja; przy dużym wyborze — paraliż decyzyjny i powrót do tego samego co zwykle.

Wgląd: wykluczenia są twardą regułą — przepis z wykluczonym składnikiem znika, a nie spada niżej na liście. Przeszukiwana jest własna, zaufana baza przepisów, a nie losowe przepisy z internetu. Aplikacja pamięta stan użytkownika (produkty stałe, wykluczenia) między sesjami, więc nie trzeba go wpisywać za każdym razem.

## User & Persona

Główna persona: autorka projektu i jej gospodarstwo domowe — osoba gotująca w domu dla siebie i domowników, z określonymi produktami w kuchni oraz z produktami, których domownicy nie jedzą lub na które są uczuleni. Sięga po produkt, gdy ma w domu określone produkty i chce szybko wiedzieć, co z nich ugotować. Inni użytkownicy (od kilkudziesięciu do stu osób) mogą dołączyć, ale MVP służy głównej personie.

## Success Criteria

### Primary
- Zalogowany użytkownik wpisuje produkty (posiadane / stałe / wykluczenia), stosuje filtry i widzi listę przepisów z procentem dopasowania, z której przepisy zawierające wykluczony składnik są usunięte; po kliknięciu przepisu widzi jego szczegóły.

Przepływ MVP (pierwsza sesja):
1. Użytkownik otwiera aplikację → rejestruje się / loguje.
2. Po zalogowaniu trafia na widok spiżarki + listę przepisów. W pierwszej sesji wszystkie 3 sekcje są puste; nad listą widnieje zachęta w rodzaju „Wypełnij spiżarkę, żeby zobaczyć dopasowanie”, a pod nią pierwsze 10 przepisów z bazy bez wskaźnika dopasowania (z opcją doładowania kolejnych).
3. Wpisuje produkty jako tagi (wpis + Enter) w trzech sekcjach: posiadane, stałe, wykluczenia.
4. Klika przycisk zastosowania filtrów.
5. Widzi listę przepisów (kafelki: tytuł, % dopasowania, składniki jako tagi — zielony = mam, szary = brak informacji), posortowaną od najwyższego %; przepisy z wykluczonym składnikiem nie są wyświetlane.
6. Dowolnie zmienia tagi i ponownie stosuje filtry, aż znajdzie przepis.
7. Klika przepis → widzi szczegóły bez utraty kontekstu listy: nazwa, opis, składniki oraz informacje dodatkowe (np. makro, czas przygotowania, na zimno / na ciepło).

Przykład dopasowania: mam „pomidor”, „chleb”, „mozzarella” → przepis „mozzarella z pomidorem” ma 100% dopasowania, bo mam wszystkie jego składniki (przepis nie musi wykorzystać wszystkich moich produktów).

### Secondary
- Formularz dodawania przepisu wypełnia się automatycznie na podstawie zdjęcia przepisu; użytkownik tylko poprawia/uzupełnia. (FR-008 jest poza MVP — kryterium dotyczy kolejnej wersji.)

### Guardrails
- Żaden przepis zawierający wykluczony składnik nie pojawia się na liście (wykluczenia dotyczą m.in. alergii).
- Spiżarka, produkty stałe i wykluczenia użytkownika są prywatne — widzi je tylko on.
- Przepis we wspólnej bazie może zmienić lub usunąć wyłącznie jego autor lub admin.

## User Stories

### US-01: Widzę, co ugotuję z tego, co mam

- **Given** zalogowana użytkowniczka z co najmniej jednym produktem w sekcji „posiadane” lub „stałe”
- **When** klika przycisk zastosowania filtrów
- **Then** widzi listę przepisów z % dopasowania, posortowaną od najwyższego %; przepisy z wykluczonym składnikiem nie są wyświetlane

#### Acceptance Criteria
- Przepis, którego wszystkie składniki użytkowniczka ma, ma 100% — nawet jeśli nie wykorzystuje wszystkich jej produktów (pomidor + chleb + mozzarella → „mozzarella z pomidorem” = 100%)
- Przepis zawierający choć jeden wykluczony składnik nigdy się nie pojawia
- Bez żadnych filtrów: komunikat zachęty + 10 przepisów bez wskaźnika dopasowania, z opcją doładowania
- Kliknięcie przepisu pokazuje jego szczegóły

### US-02: Dodaję przepis ze zdjęcia (po MVP — FR-008 nice-to-have)

- **Given** zalogowana użytkowniczka na formularzu dodawania przepisu
- **When** wgrywa zdjęcie przepisu
- **Then** formularz wypełnia się danymi odczytanymi ze zdjęcia, a użytkowniczka dostaje informację, że musi zweryfikować dane przed zapisem

#### Acceptance Criteria
- Pola, których nie da się odczytać ze zdjęcia (np. makro), zostają puste do uzupełnienia lub pominięcia
- Jeśli zdjęcie jest nieczytelne albo nie przedstawia przepisu (np. instrukcja obsługi pralki — są kroki, ale brak produktów i innych cech przepisu), żadne pole nie zostaje wypełnione, a użytkowniczka dostaje jasny komunikat o błędzie z prośbą o weryfikację i wgranie nowego zdjęcia
- Jeśli zdjęcie przypomina przepis (da się wydzielić tytuł, produkty i opis), formularz zostaje wypełniony, nawet gdy treść nie jest logicznie poprawna — ostateczna weryfikacja należy do użytkowniczki; wypełnienie ze zdjęcia nigdy nie zapisuje przepisu bez jej akceptacji

## Functional Requirements

### Dostęp
- FR-001: Gość może założyć konto i zalogować się. Priority: must-have
  > Socrates: Counter-argument considered: "logowanie to bariera wejścia — nowa osoba musi się zarejestrować, zanim zobaczy dopasowanie". Resolution: kept; aplikacja służy autorce i bliskim, więc bariera dla postronnych jest pożądana. Rejestracja pozostaje otwarta (cudzych przepisów i tak nie zmieni nikt poza autorem i adminem).

### Spiżarka
- FR-002: Użytkownik może dodawać i usuwać produkty jako tagi w trzech sekcjach: posiadane, stałe, wykluczenia. Priority: must-have
  > Socrates: Counter-argument considered: "wolny tekst = literówki i odmiany — tag może nie trafić w składnik przepisu, a wykluczenie się przemknie". Resolution: kept; problem realny — dotyczy też przepisów, które zapisują składniki w różnych formach ("pomidor" / "pomidory"). Reguła, co liczy się jako ten sam składnik, ustalona w Business Logic; sposób realizacji — przy implementacji.
- FR-003: Użytkownik może wrócić w kolejnej sesji i zastać zapisane produkty stałe i wykluczenia; produkty posiadane wpisuje w każdej sesji. Priority: must-have
  > Socrates: Counter-argument considered: "nieaktualna spiżarka — posiadane produkty się zużywają, a zapamiętana lista daje fałszywe 100%". Resolution: changed; zapamiętywane są tylko produkty stałe (sól, pieprz — długo nie zabraknie) i wykluczenia trwałe (nie mogę / nie lubię, np. alergie). Posiadane zmieniają się z dnia na dzień i nie są zapamiętywane; "nie mam" = brak w posiadanych, nie wymaga wykluczenia.

### Dopasowanie przepisów
- FR-004: Użytkownik może zastosować filtry i zobaczyć listę przepisów z % dopasowania, posortowaną od najwyższego %, bez przepisów zawierających wykluczony składnik. Priority: must-have
  > Socrates: Counter-argument considered: "procent bez kolejności nic nie daje — użytkownik i tak przegląda ręcznie". Resolution: changed; lista sortowana malejąco po %.
- FR-005: Użytkownik bez żadnych filtrów może zobaczyć pierwsze 10 przepisów (bez wskaźnika dopasowania) i doładować kolejne. Priority: must-have
  > Socrates: Counter-argument considered: "0% przy pustej spiżarce jest mylące". Resolution: changed; bez wpisanych produktów przepisy są pokazywane bez procentu dopasowania, bo dopasowania realnie nie ma.
- FR-006: Użytkownik może otworzyć przepis i zobaczyć jego szczegóły. Priority: must-have
  > Socrates: Counter-argument considered: "szczegóły bez informacji, czego mi brakuje — przy 70% użytkownik sam porównuje składniki ze spiżarką". Resolution: changed; informacja o dostępności składników trafia na listę, nie do szczegółów. Lista to kafelki z tytułem, procentem dopasowania i składnikami jako tagi (zielony = mam, szary = brak informacji) — już na liście widać, czy warto otwierać przepis. Szczegóły pokazują sam przepis z opisem (bez kontekstu spiżarki), wszystko na jednej karcie, otwierane tak, by po zamknięciu nie utracić kontekstu listy.

### Przepisy
- FR-007: Użytkownik może dodać przepis do wspólnej bazy ręcznie (nazwa, opis i składniki obowiązkowe; makro, czas przygotowania itd. opcjonalne; do składnika można dodać zamienniki). Priority: must-have
  > Socrates: Counter-argument considered: "składniki w formularzu = te same literówki — 'pomidorki' nie dopasują się do 'pomidor'". Resolution: kept; składniki przepisu podlegają tej samej regule rozpoznawania tego samego składnika co tagi w spiżarce (Business Logic).
- FR-008: Użytkownik może wgrać zdjęcie przepisu, a formularz wypełni się danymi, które da się z niego odczytać; brakujące pola zostają puste do uzupełnienia lub pominięcia. Priority: nice-to-have
  > Socrates: Counter-argument considered: "najdroższa i najmniej pewna część MVP — zewnętrzna zależność, koszt, błędy odczytu; rdzeń działa bez niej". Resolution: changed; przeniesione poza MVP (nice-to-have, kolejna wersja). US-02 opisuje docelowe zachowanie na później.
- FR-009: Autor może edytować i usuwać swój przepis. Priority: must-have
  > Socrates: Counter-argument considered: "autor usuwa przepis, którego inni używają — znika wszystkim". Resolution: kept; w MVP nikt nie wiąże się z przepisem trwale (brak ulubionych), więc usunięcie nikomu nic nie psuje.
- FR-010: Admin może edytować i usuwać dowolny przepis. Priority: must-have
  > Socrates: No counter-argument; it stands as written.

Uwaga: bazowe 50–100 przepisów (istniejąca kolekcja autorki, ujednolicona do wspólnej struktury) jest dostępne w aplikacji od pierwszego uruchomienia — zadanie przygotowania danych, nie funkcja dla użytkownika.

## Non-Functional Requirements

- Po zastosowaniu filtrów lista przepisów z dopasowaniem pojawia się w < 1 s przy bazie do kilkuset przepisów.
- Aplikacja jest w pełni użyteczna zarówno na ekranie telefonu, jak i na desktopie, w aktualnych wersjach popularnych przeglądarek.

## Business Logic

PasujeMi pokazuje przepisy ze wspólnej bazy w kolejności od tego, którego składniki użytkownik ma w największej części (licząc produkty posiadane, stałe i zamienniki), i całkowicie ukrywa każdy przepis zawierający wykluczony składnik.

**Dane wejściowe i wynik.** Wejściem są trzy listy użytkownika — produkty posiadane (wpisywane w każdej sesji), produkty stałe (zapamiętane; np. sól, pieprz) i wykluczenia (zapamiętane; nie mogę / nie lubię, np. alergie) — oraz składniki każdego przepisu, gdzie składnik może mieć jawnie zapisane zamienniki (np. skyr [zamiennik: jogurt naturalny, serek wiejski]). Procent dopasowania = jaka część składników przepisu jest dostępna; składnik jest dostępny, gdy użytkownik ma go lub którykolwiek z jego zamienników w posiadanych albo stałych (stałe liczą się dokładnie jak posiadane). Przepis nie musi wykorzystać wszystkich produktów użytkownika (pomidor + chleb + mozzarella → „mozzarella z pomidorem” = 100%). Za ten sam składnik uznaje się odmiany i liczbę mnogą („pomidor” = „pomidory”), różnice wielkości liter, literówki („mozarella” = „mozzarella”) oraz synonimy („ziemniak” = „kartofel”).

**Wykluczenia.** Wykluczenie ogólne obejmuje odmiany szczegółowe („mleko” ukrywa też „mleko kokosowe”), a wykluczenie szczegółowe dotyczy tylko siebie („mleko kokosowe” nie ukrywa „mleka”). Składnik z zamiennikami blokuje przepis dopiero wtedy, gdy wykluczone są wszystkie jego opcje — dopóki istnieje niewykluczony zamiennik, przepis da się przygotować i pozostaje na liście; składnik bez zamienników, który jest wykluczony, od razu ukrywa przepis. Zasada: nie mam produktu i nie mam czym go zastąpić → nie zrobię posiłku; jest niewykluczony zamiennik → nadal jest szansa.

**Jak użytkownik to widzi.** Po zastosowaniu filtrów lista kafelków jest posortowana malejąco po %; każdy kafelek pokazuje składniki jako tagi (zielony = mam, szary = brak informacji). Przepisy z 0% również są pokazywane (na końcu listy) — mogą przypomnieć użytkownikowi o produkcie, który ma. Bez wpisanych produktów lista pokazuje przepisy bez wskaźnika dopasowania. Procent jest sugestią: nad wyszukiwarką widnieje krótka podpowiedź, by dodać przyprawy i dodatki do produktów stałych, bo przepisy uwzględniają je jako pełnoprawne składniki (bez tego np. jajecznica z jajka, soli i pieprzu przy samym jajku daje 33%).

## Access Control

- Dostęp przez logowanie (konto użytkownika). Rejestracja otwarta dla każdego.
- Osoba niezalogowana widzi wyłącznie ekran logowania/rejestracji; każda inna ścieżka przekierowuje do logowania.
- Role:
  - **Użytkownik (zalogowany)** — widzi wspólną bazę przepisów z dopasowaniem; zarządza własnymi produktami posiadanymi, stałymi i wykluczeniami (prywatne; stałe i wykluczenia zapamiętane między sesjami); dodaje przepisy do wspólnej bazy; edytuje i usuwa wyłącznie przepisy, których jest autorem.
  - **Admin** — wszystko co użytkownik oraz edycja i usuwanie dowolnego przepisu we wspólnej bazie.

## Non-Goals

- **Bez wypełniania formularza ze zdjęcia** — FR-008 przeniesione na kolejną wersję; najdroższa i najmniej pewna część, a rdzeń (dopasowanie) działa bez niej.
- **Bez ulubionych, kategorii i innych wyszukiwarek** — MVP wyszukuje wyłącznie po produktach; pozostałe sposoby przeglądania po MVP.
- **Bez przepisów prywatnych** — każdy dodany przepis trafia do wspólnej bazy; opcja „tylko prywatnie” po MVP.
- **Bez śledzenia ilości i list zakupów** — spiżarka to lista nazw produktów: bez gramatur, dat ważności, odejmowania po ugotowaniu i listy zakupów.

## Open Questions

1. **Jak rozpoznawać „ten sam składnik” w praktyce?** — Reguła produktu jest ustalona (odmiany, liczba mnoga, wielkość liter, literówki, synonimy; wykluczenie ogólne obejmuje szczegółowe; zamienniki jawnie w danych przepisu). Otwarty pozostaje sposób realizacji. Owner: autorka. By: przed implementacją dopasowania. Block: no.
2. **Czy szacunki skali `target_scale.qps: low` i `target_scale.data_volume: small` są trafne?** — Wartości oszacowane podczas kształtowania na podstawie 50–100 przepisów startowych i do stu użytkowników; nie podane wprost przez użytkowniczkę. Owner: autorka. Block: no.
