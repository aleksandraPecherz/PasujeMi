# Raport architektoniczny — moduł 4, 10xArchitect

**Autorka: Aleksandra Pęcherz · 25 października 2026**

Raport zbiera mapę repozytorium, research przepływu, plan zabezpieczeń i analizę domeny z dwóch projektów. Opiera się na artefaktach modułu, bez ponownej analizy kodu.

## 1. Opisane projekty

**tldraw — L2–L4:** monorepo pnpm i TypeScript, SDK nieskończonej kanwy dla React oraz aplikacja tldraw.com z backendem synchronizacji na Cloudflare Workers. Nazwę `Editor` importuje 201 plików produkcyjnych w dziesięciu paczkach. Badany HEAD: `12921f6d39`; okno historii od 2025-10-23. (tldraw: mapa L2)

**PasujeMi — L5:** moja polska aplikacja dopasowująca przepisy do spiżarki; Astro 7 SSR, React 19, TypeScript, Tailwind 4, Supabase i Cloudflare Workers. Liczba przepisów na produkcji jest nieznana. Badany HEAD: `9500dbd`. (PasujeMi: dokumenty domeny L5)

## 2. Mapa projektu — L2

- **Warstwy SDK:** `tldraw` → `editor` → fundament danych, schematów i reaktywności. Nie znaleziono zależności w przeciwną stronę, ale nie znaleziono reguły wymuszającej ten kierunek. 98% krawędzi między paczkami idzie przez publiczne wejścia, choć reeksporty zwiększają zasięg zmian.
- **Lokalne centrum:** `Editor` łączy publiczne API, wielu konsumentów i intensywną historię zmian.
- **Pozostałe strefy ryzyka:** akcje i menu UI (największy cykl runtime, 55 plików), Durable Object pliku tldraw.com oraz kontrakt klient–backend. 61-plikowy cykl rdzenia edytora zamykają importy typów, więc nie jest cyklem wykonania.
- **Początek pracy i niewiadome:** najpierw publiczne wejścia `editor` i `tldraw`, potem `Editor` i menedżery. Nie wiadomo, jakie jest faktyczne pokrycie testami backendu i czy schemat Zero zgadza się z SQL. (tldraw: mapa L2)

## 3. Analiza przepływu — L3

Wybrano tworzenie kształtu: przepływ ze strefy ryzyka rdzenia edytora, który da się sprawdzić lokalnie. Multiplayer, zapis serwerowy i renderer zostały poza zakresem.

**Feature overview.** Wywołujący przekazuje częściowe kształty do `createShapes` (`createShape` to jej opakowanie). Po bramkach wejściowych metoda w transakcji ustala rodzica, indeks, właściwości i metadane, emituje zdarzenia, a potem wywołuje `store.put`, gdzie następują walidacja i zapis. Zwraca edytor (`this`), nie utworzone rekordy. UI czyta zmiany reaktywnie, a `store.listen` dostaje je w następnej klatce. (tldraw: research L3)

**Najważniejsze ryzyka:**

- **Zdarzenia przed zapisem:** rollback nie cofa wcześniejszych emisji. **Ast-grep potwierdził kolejność** `created-shapes` → `edit` → `store.put`; skutku produkcyjnego nie wykazano.
- **Ciche nadpisanie:** ponowne użycie istniejącego `id` może zastąpić wcześniejsze wartości domyślnymi; nie wiadomo, czy to zamierzone.
- **Limit kształtów** liczy elementy partii jak nowe, także przy istniejących identyfikatorach. (tldraw: research L3 i evidence ast-grep)

Nie uruchamiano testów, CI ani pomiaru pokrycia.

## 4. Wynik planowania — L4

**Wybrano guard bez refaktoru:** testy charakteryzujące wybór rodzica przez publiczne `createShapes`. Ekstrakcja bloku była możliwa, ale nikt nie wykazał kosztu obecnej struktury.

Zakres **A + D + E1** to osiem izolowanych wariantów: położenie (oba x/y, samo x, samo y, brak obu), ramka ukryta i widoczna, ramka odrzucająca i przyjmująca dany typ kształtu. **Świadomie nie robimy:** ekstrakcji, zmian zachowania API, obrotu i zablokowanej ramki. (tldraw: plan L4)

- **Faza 1:** sprawdzenie istniejących asercji, nowe testy i commit na osobnej gałęzi. Auto: testy, lint, typecheck. Ręcznie: izolacja przypadków i przegląd zmiany.
- **Faza 2:** siedem pojedynczych mutacji `Editor.ts`, każda cofana, bez commita. Auto: oczekiwane niepowodzenia testów. Ręcznie: diagnoza odchyleń; błąd kompilacji to wynik nierozstrzygający.

Po rozstrzygnięciu uwag F1–F7 review oceniło plan jako **SOUND**. Planu jeszcze nie zrealizowano. (tldraw: review planu L4)

## 5. Domena według DDD — L5

**Wspólny język:** **spiżarka** (posiadane, stałe, wykluczenia), **składnik**, **opcja** (produkt główny lub zamiennik), **składnik zablokowany** (wszystkie opcje wykluczone) i **procent dopasowania**. **Rozjazdy model–kod:** „odmiana” w PRD znaczy dwie rzeczy, techniczne klucze dopasowania nie występują w PRD, a zablokowany składnik jest tylko warunkiem, bez własnego typu. W zgłoszonym wyniku uruchomienia wykluczenie „orzechy” nie ukrywało „masła orzechowego”; wyniku nie sprawdzano ponownie, a oczekiwane zachowanie pozostaje otwartą decyzją. Przy błędzie odczytu zapisanych wykluczeń lista pokazuje się bez nich. (PasujeMi: destylacja domeny i słownik)

**Niezmiennik #1 i agregat.** Reguła biznesowa N-1: przepis odpada, gdy wszystkie opcje choć jednego składnika są wykluczone. Chroni ją techniczne N-9: klucze dopasowania muszą odpowiadać bieżącym składnikom. Granicą spójności jest **przepis ze składnikami i odpowiadającymi im kluczami**, ale sama klasa w kodzie nie zabezpieczy wszystkich zapisujących, bo skrypt `match-keys` pisze prosto do bazy. Analiza statyczna wskazała jego możliwy wyścig z edycją składników (nieodtworzony). Proponowany wariant **V2**, czyli licznik zmian składników i zapis warunkowy w bazie, pozostaje niewdrożony. (PasujeMi: analiza N-9)

**ACL: bez nowej warstwy.** Supabase ma mapowanie w serwisach, a format Excela własny adapter importu. Zależnością zewnętrzną jest stemmer Snowball. Pojęcie rdzenia słowa wpływa na reguły dopasowania i klucze zapisane w bazie; analiza nie określiła jednoznacznie liczby przekraczanych warstw. Dodatkowa warstwa nie usunęłaby jednak kosztu przeliczania kluczy po zmianie normalizacji. Dopasowanie nazw nie jest analizą alergenów. (PasujeMi: analiza ACL)

## 6. Decyzje, które należą do mnie

Do L2–L4 celowo wybrałam repozytorium tldraw. Pracowałam z GPT 6.1 Sol i Opus 5.5/Sonnet 5.5. Wybrałam przepływ tworzenia kształtu i świadomie odrzuciłam proponowane przez AI wydzielenie metody, ponieważ nie wykazano wyraźnego kosztu obecnej struktury. Zatwierdziłam testy A + D + E1, bo sprawdzają podstawowe zasady wyboru ramki: położenie, widoczność i to, czy ramka przyjmuje dany kształt. Obrót i blokadę ramki uznałam za mniej istotne na tym etapie. L5 zrobiłam już na własnym projekcie, gdzie jako właścicielka potwierdziłam reguły wykluczeń. Ustaliłam też przyszłe wymaganie: gdy ten sam produkt trafi zarówno do posiadanych lub stałych, jak i do wykluczeń, aplikacja ma zapytać użytkownika, zamiast rozstrzygać sama.
