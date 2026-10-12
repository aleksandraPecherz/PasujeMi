---
project: PasujeMi
version: 1
status: draft
created: 2026-10-11
updated: 2026-10-12
prd_version: 1
main_goal: speed
top_blocker: time
milestone_id: mvp-pantry-matching
milestone_seq: 1
milestone_status: open
---

# Roadmap: PasujeMi

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: MVP — dopasowanie przepisów do spiżarki** — Status: open

- **Intent:** Zalogowana osoba wpisuje swoje produkty i wykluczenia, widzi przepisy ze wspólnej bazy posortowane po % dopasowania bez żadnego przepisu z wykluczonym składnikiem, a baza przepisów jest zasilona i zarządzana przez autorów i admina.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-001 – FR-007, FR-009, FR-010 (wszystkie wymagania konieczne), US-01. FR-008 / US-02 są poza MVP (PRD §Non-Goals) i leżą w `## Parked`.

## Vision recap

Osoba gotująca dla siebie i domowników chce szybko zobaczyć, co ugotuje z produktów, które ma, zamiast ręcznie przeglądać rozproszone przepisy i dopiero w trakcie odkrywać brakujący lub wykluczony składnik. Kluczowa cecha produktu: wykluczenia są twardą regułą (przepis z wykluczonym składnikiem znika, a nie spada niżej), przeszukiwana jest własna zaufana baza przepisów, a aplikacja pamięta produkty stałe i wykluczenia między sesjami.

## North star

**S-03: Użytkownik wpisuje produkty i wykluczenia, stosuje filtry i widzi listę przepisów z % dopasowania, bez przepisów z wykluczonym składnikiem** — to główne kryterium sukcesu PRD; przy celu „szybkość dostarczenia” idzie tak wcześnie, jak pozwalają zależności, bo reszta produktu ma sens dopiero, gdy dopasowanie działa.

> Gwiazda przewodnia (north star) to najmniejszy kompletny przepływ, którego dostarczenie udowadnia główną hipotezę produktu — dlatego stoi tak wcześnie, jak pozwalają warunki wstępne.

## At a glance

| ID   | Change ID                     | Outcome (user can …)                                                                   | Prerequisites                              | PRD refs                    | Status      |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------- | ----------- |
| F-01 | recipe-catalog-contract       | (foundation) minimalna struktura przepisu z kilkoma prawdziwymi przepisami testowymi   | —                                          | FR-004, FR-006, FR-007      | in-progress |
| F-02 | seed-recipe-import            | (foundation) bazowe 50–100 przepisów zaimportowane w ustalonej strukturze              | F-01, recipe Excel file (author's machine) | FR-004, FR-005, NFR (< 1 s) | proposed    |
| S-01 | login-gated-app-shell         | zakłada konto, loguje się i trafia na widok aplikacji; inne ścieżki → logowanie        | —                                          | FR-001                      | done        |
| S-02 | browse-recipes-and-details    | przegląda pierwsze 10 przepisów, doładowuje kolejne i otwiera szczegóły przepisu       | F-01, S-01                                 | FR-005, FR-006, US-01       | proposed    |
| S-03 | first-pantry-match            | wpisuje produkty i wykluczenia, widzi listę z % dopasowania bez wykluczonych przepisów | F-01, S-01                                 | US-01, FR-002, FR-004       | proposed    |
| S-04 | remembered-staples-exclusions | wraca w kolejnej sesji i zastaje swoje produkty stałe i wykluczenia                    | S-03                                       | FR-003                      | proposed    |
| S-05 | add-recipe-manually           | dodaje przepis do wspólnej bazy ręcznie, z zamiennikami składników                     | F-01, S-01                                 | FR-007                      | proposed    |
| S-06 | author-edits-own-recipe       | jako autor edytuje i usuwa swój przepis                                                | S-05                                       | FR-009                      | proposed    |
| S-07 | admin-manages-any-recipe      | jako admin edytuje i usuwa dowolny przepis                                             | S-06                                       | FR-010                      | proposed    |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                  | Chain                    | Note                                                                                  |
| ------ | ---------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| A      | Wejście i przeglądanie | `S-01` → `S-02`          | `S-02` potrzebuje też `F-01` ze strumienia B.                                         |
| B      | Pętla dopasowania      | `F-01` → `S-03` → `S-04` | Gwiazda przewodnia; dołącza do strumienia A przy `S-01`. Ścieżka priorytetowa.        |
| C      | Zarządzanie przepisami | `S-05` → `S-06` → `S-07` | Dołącza do strumienia B przy `F-01`; może iść równolegle z `S-03`.                    |
| D      | Baza startowa          | `F-02`                   | Dołącza do strumienia B przy `F-01`; czeka na plik z przepisami (lokalnie u autorki). |

## Baseline

What's already in place in the codebase as of `2026-10-11` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro SSR + React islands + Tailwind + shadcn/ui (`src/layouts/Layout.astro`, `src/components/ui/button.tsx`); strona główna to nadal ekran powitalny startera (`src/pages/index.astro`).
- **Backend / API:** partial — tylko endpointy auth (`src/pages/api/auth/`); brak endpointów domenowych.
- **Data:** partial — klient Supabase podłączony (`src/lib/supabase.ts`, `supabase/config.toml`); brak migracji, tabel i RLS. Przepisy bazowe istnieją jako Excel (z którego powstaje JSON) na innym komputerze — nie ma ich w repo.
- **Auth:** partial — rejestracja / logowanie / wylogowanie e-mailem działa (`src/components/auth/`, `src/middleware.ts`), ale chroniona jest tylko `/dashboard` i brak roli admina.
- **Deploy / infra:** present — Cloudflare Workers, produkcja https://pasuje-mi.przepisy-app.workers.dev, auto-deploy z `master` (Workers Builds), CI lint/check (`.github/workflows/ci.yml`), Supabase w UE (Frankfurt). Szczegóły: `context/deployment/deploy-plan.md`.
- **Observability:** partial — Workers Logs włączone (`wrangler.jsonc`); brak śledzenia błędów aplikacji.

## Foundations

### F-01: Minimalny kontrakt danych przepisu

- **Outcome:** (foundation) istnieje minimalna struktura przepisu (nazwa, opis, składniki z jawnymi zamiennikami, opcjonalne dodatki: czas, rodzaj, porcje, makro) z odczytem tylko dla zalogowanych i kilkoma prawdziwymi przepisami testowymi przepisanymi z Excela.
- **Change ID:** recipe-catalog-contract
- **PRD refs:** FR-004, FR-006, FR-007, Business Logic (zamienniki), Access Control
- **Unlocks:** S-02, S-03, S-05, F-02; redukuje Open Roadmap Question 3 (ustala docelową strukturę JSON-a na podstawie Excela)
- **Prerequisites:** —
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:**
  - Jaka struktura JSON-a jest optymalna na bazie kolumn Excela (zwłaszcza zapis składnika z gramaturą i zamiennikami)? — Owner: autorka. Block: no.
- **Risk:** Tylko odczyt i dane testowe — zapis, edycja i role dochodzą w S-05…S-07, a pantry w S-03/S-04, więc foundation nie buduje całej warstwy danych z góry.
- **Status:** in-progress

### F-02: Import bazowych przepisów

- **Outcome:** (foundation) 50–100 przepisów autorki jest dostępnych w aplikacji od pierwszego uruchomienia, w strukturze ustalonej w F-01.
- **Change ID:** seed-recipe-import
- **PRD refs:** FR-004, FR-005, NFR (< 1 s przy kilkuset przepisach), uwaga PRD o bazowych przepisach
- **Unlocks:** ścieżka weryfikacji S-03 na realnej bazie (jakość dopasowania i NFR < 1 s); S-02 z pełną listą do doładowania
- **Prerequisites:** F-01, recipe Excel file (author's machine)
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Jak potraktować pojedyncze składniki zapisane jako nazwy handlowe (np. konkretny serek z marką i gramaturą), by dało się je dopasować do ogólnych tagów? — Owner: autorka. Block: no.
- **Risk:** Celowo odłączone od gwiazdy przewodniej — brak pliku na tym komputerze nie blokuje S-03; konieczne przed uznaniem MVP za gotowe.
- **Status:** proposed

## Slices

### S-01: Logowanie jako brama do aplikacji

- **Outcome:** gość zakłada konto, loguje się i trafia na widok aplikacji (zamiast ekranu startera); każda inna ścieżka dla niezalogowanego przekierowuje do logowania.
- **Change ID:** login-gated-app-shell
- **PRD refs:** FR-001, Access Control
- **Prerequisites:** —
- **Parallel with:** F-01, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Logowanie już działa — slice domyka bramę dostępu z PRD i daje miejsce, w którym zamieszkają kolejne slice'y; mały i bez ryzyka.
- **Status:** done

### S-02: Przeglądanie przepisów i szczegóły

- **Outcome:** użytkownik bez wpisanych produktów widzi zachętę do wypełnienia spiżarki i pierwsze 10 przepisów bez wskaźnika dopasowania, doładowuje kolejne i otwiera szczegóły przepisu bez utraty kontekstu listy.
- **Change ID:** browse-recipes-and-details
- **PRD refs:** FR-005, FR-006, US-01, NFR (telefon i desktop)
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-03, S-04, S-05, S-06, S-07, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Dzieli z S-03 ten sam widok listy — przy równoległej pracy agentów uzgodnić wspólny kafelek przepisu, by nie powstały dwie wersje.
- **Status:** proposed

### S-03: Pierwsze dopasowanie ze spiżarki

- **Outcome:** użytkownik wpisuje produkty jako tagi w trzech sekcjach (posiadane, stałe, wykluczenia), stosuje filtry i widzi kafelki przepisów posortowane malejąco po % dopasowania (składniki jako tagi: mam / brak informacji), bez żadnego przepisu z wykluczonym składnikiem.
- **Change ID:** first-pantry-match
- **PRD refs:** US-01, FR-002, FR-004, Business Logic, NFR (< 1 s), NFR (telefon i desktop)
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-05, S-06, S-07, F-02
- **Blockers:** —
- **Unknowns:**
  - Jak w praktyce rozpoznawać „ten sam składnik” (odmiany, literówki, synonimy, wykluczenie ogólne vs szczegółowe)? — Owner: autorka. Block: no.
- **Risk:** Rdzeń produktu i największe ryzyko logiki domenowej — stoi najwcześniej, jak się da; wykluczenia muszą być twardym filtrem (alergie), więc reguła wymaga przypadków testowych z PRD. Lista ma się pojawiać w < 1 s także przy ok. 1000 przepisów (docelowa skala potwierdzona przez autorkę).
- **Status:** proposed

### S-04: Zapamiętane produkty stałe i wykluczenia

- **Outcome:** użytkownik wraca w kolejnej sesji i zastaje swoje produkty stałe i wykluczenia (prywatne, widoczne tylko dla niego); produkty posiadane wpisuje od nowa.
- **Change ID:** remembered-staples-exclusions
- **PRD refs:** FR-003, Guardrails (prywatność spiżarki), Access Control
- **Prerequisites:** S-03
- **Parallel with:** S-02, S-05, S-06, S-07, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Po gwieździe przewodniej, bo trwałość ma sens dopiero, gdy dopasowanie działa; prywatność danych wymaga reguł dostępu per użytkownik od pierwszego zapisu.
- **Status:** proposed

### S-05: Ręczne dodawanie przepisu

- **Outcome:** użytkownik dodaje przepis do wspólnej bazy (nazwa, opis, składniki obowiązkowe; makro, czas itd. opcjonalne; zamienniki przy składniku) i od razu widzi go na liście.
- **Change ID:** add-recipe-manually
- **PRD refs:** FR-007
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02, S-03, S-04, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Składniki z formularza muszą podlegać tej samej regule „tego samego składnika” co S-03 — jeśli S-03 jeszcze jej nie ustalił, uzgodnić ją przy planowaniu.
- **Status:** proposed

### S-06: Autor edytuje i usuwa swój przepis

- **Outcome:** autor edytuje i usuwa wyłącznie przepisy, które sam dodał.
- **Change ID:** author-edits-own-recipe
- **PRD refs:** FR-009, Guardrails (edycja tylko autor lub admin)
- **Prerequisites:** S-05
- **Parallel with:** S-02, S-03, S-04, F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wymaga autorstwa zapisanego w S-05; reguła „tylko autor” musi być egzekwowana po stronie danych, nie tylko w interfejsie.
- **Status:** proposed

### S-07: Admin zarządza dowolnym przepisem

- **Outcome:** admin edytuje i usuwa dowolny przepis we wspólnej bazie.
- **Change ID:** admin-manages-any-recipe
- **PRD refs:** FR-010, Access Control (rola admina)
- **Prerequisites:** S-06
- **Parallel with:** S-02, S-03, S-04, F-02
- **Blockers:** —
- **Unknowns:**
  - Jak nadawana jest rola admina (ręcznie przez autorkę w bazie czy inaczej)? — Owner: autorka. Block: no.
- **Risk:** Rola admina wprowadzana dopiero tutaj, gdy jest potrzebna; rozszerza regułę z S-06 o drugą rolę.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                     | Suggested issue title                                 | Ready for `/10x-plan` | Notes                                                  |
| ---------- | ----------------------------- | ----------------------------------------------------- | --------------------- | ------------------------------------------------------ |
| F-01       | recipe-catalog-contract       | Minimalny kontrakt danych przepisu + przepisy testowe | yes                   | Run `/10x-plan recipe-catalog-contract`                |
| F-02       | seed-recipe-import            | Import bazowych 50–100 przepisów                      | no                    | Czeka na F-01 i plik z przepisami (lokalnie u autorki) |
| S-01       | login-gated-app-shell         | Logowanie jako brama do aplikacji                     | yes                   | Run `/10x-plan login-gated-app-shell`                  |
| S-02       | browse-recipes-and-details    | Przeglądanie przepisów (10 + doładowanie) i szczegóły | no                    | Czeka na F-01, S-01                                    |
| S-03       | first-pantry-match            | Spiżarka w tagach i lista z % dopasowania             | no                    | Gwiazda przewodnia; czeka na F-01, S-01                |
| S-04       | remembered-staples-exclusions | Zapamiętane produkty stałe i wykluczenia              | no                    | Czeka na S-03                                          |
| S-05       | add-recipe-manually           | Ręczne dodawanie przepisu z zamiennikami              | no                    | Czeka na F-01, S-01                                    |
| S-06       | author-edits-own-recipe       | Autor edytuje i usuwa swój przepis                    | no                    | Czeka na S-05                                          |
| S-07       | admin-manages-any-recipe      | Admin edytuje i usuwa dowolny przepis                 | no                    | Czeka na S-06                                          |

## Open Roadmap Questions

1. **Jak rozpoznawać „ten sam składnik” w praktyce?** — Reguła produktu jest ustalona (odmiany, liczba mnoga, wielkość liter, literówki, synonimy; wykluczenie ogólne obejmuje szczegółowe; zamienniki jawnie w danych przepisu). Otwarty pozostaje sposób realizacji. Owner: autorka. Block: no (dotyczy S-03, S-05).
2. ~~**Czy szacunki skali `target_scale.qps: low` i `target_scale.data_volume: small` są trafne?**~~ — Rozstrzygnięte 2026-10-11 przez autorkę: tak — maksymalnie ok. 1000 przepisów, użytkownicy w wąskim gronie. Uwaga: 1000 to więcej niż „kilkaset” z NFR PRD, więc S-03 weryfikuje < 1 s przy 1000 przepisów. PRD nie został zmieniony (aktualizacja przez `/10x-prd`).
3. **Jaka docelowa struktura JSON-a przepisów, wyprowadzona z Excela?** — Kolumny Excela: nazwa, czas, rodzaj, porcje, produkty z gramaturą i `[zamienniki: …]`, waga, makro, sposób przygotowania. Większość składników jest ogólna; pojedyncze to nazwy handlowe. Owner: autorka. Block: no (rozstrzyga `/10x-plan` dla F-01; dotyczy F-01, F-02, S-03, S-05).

## Parked

- **Wypełnianie formularza ze zdjęcia (FR-008, US-02)** — Why parked: PRD §Non-Goals — najdroższa i najmniej pewna część; rdzeń działa bez niej.
- **Ulubione, kategorie i inne wyszukiwarki** — Why parked: PRD §Non-Goals — MVP wyszukuje wyłącznie po produktach.
- **Przepisy prywatne** — Why parked: PRD §Non-Goals — każdy przepis trafia do wspólnej bazy.
- **Śledzenie ilości i listy zakupów** — Why parked: PRD §Non-Goals — spiżarka to lista nazw produktów.
- **Tryb tylko do odczytu dla szerszego grona (bez dodawania przepisów)** — Why parked: autorka (2026-10-11) — aplikacja zostaje w wąskim gronie; opcja dopiero przy udostępnieniu dalej. Dziś PRD ma otwartą rejestrację z prawem dodawania przepisów (FR-001, FR-007).
- **Śledzenie błędów aplikacji poza Workers Logs** — Why parked: cel „szybkość dostarczenia”; żadne NFR tego nie wymaga, a Workers Logs już działa.

## Milestone History

## Done

- **S-01: gość zakłada konto, loguje się i trafia na widok aplikacji (zamiast ekranu startera); każda inna ścieżka dla niezalogowanego przekierowuje do logowania.** — Archived 2026-10-12 → `context/archive/2026-10-12-login-gated-app-shell/`. Lesson: —.
