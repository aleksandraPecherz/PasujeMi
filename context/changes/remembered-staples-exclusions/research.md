---
date: 2026-10-18T16:17:44+02:00
researcher: Claude (Opus 5.5) dla Aleksandry Pęcherz
git_commit: 8cf1bf321b232854daa18813a86c01c9ee2d000a
branch: remembered-pantry
repository: pasujemi-pantry
topic: "S-04 remembered-staples-exclusions: trwałe produkty stałe i wykluczenia vs stan listy w sessionStorage, moment zapisu, limity tokenów"
tags: [research, codebase, pantry, list-state, usePantryMatch, supabase-rls, limits]
status: complete
last_updated: 2026-10-18
last_updated_by: Claude (Opus 5.5)
---

# Research: S-04 — zapamiętane produkty stałe i wykluczenia

**Date**: 2026-10-18T16:17:44+02:00
**Researcher**: Claude (Opus 5.5) dla Aleksandry Pęcherz
**Git Commit**: 8cf1bf321b232854daa18813a86c01c9ee2d000a
**Branch**: remembered-pantry
**Repository**: pasujemi-pantry

## Research Question

S-04 z roadmapy (issue #6, FR-003): po ponownym zalogowaniu użytkownik zastaje swoje produkty stałe i wykluczenia, a produkty posiadane wpisuje od nowa. Dane są prywatne: nowa tabela z RLS dla każdej operacji, dostęp tylko dla właściciela. Zbadać:

1. jak to ma współgrać ze stanem listy w `sessionStorage` (`list-state.ts`) i z `endListState` przy wylogowaniu (#34);
2. kiedy zapisywać: przy każdej zmianie tagów czy przy „Zastosuj filtry”;
3. limity tokenów (`MAX_TOKENS`) przy zapisie.

Ustalenia wejściowe od użytkownika (decyzje, nie do ponownego badania): logika w nowym `src/lib/services/pantry.ts` (nie w `recipes.ts`); migracja `supabase/migrations/20261018130000_<opis>.sql`.

## Summary

- **sessionStorage i trwały zapis to dwie różne warstwy i obie zostają.** Snapshot (`list-state.ts`) przechowuje w karcie stan widoku: `lists`, `applied`, `loaded`, `scrollY` (`src/lib/list-state.ts:14-19`) i odtwarza go po powrocie ze szczegółów przepisu. Trwała tabela ma być źródłem prawdy tylko dla `staple` i `exclude` między sesjami. `endListState` (`src/lib/list-state.ts:102-105`, wywoływane w `src/components/AppHeader.astro:37`) czyści snapshot przy „Wyloguj”; po ponownym zalogowaniu snapshotu nie ma, więc wyspa startuje „od zera”, a stałe/wykluczenia mają przyjść z bazy. To jest dokładnie zachowanie FR-003 — fix #34 nie wymaga zmiany, ale nie obejmuje pending zapisu do bazy (patrz niżej).
- **Rekomendacja na start widoku:** stałe/wykluczenia czytane na serwerze w `src/pages/index.astro` i przekazane jako props do `PantryMatch` (dziś bez propsów: `src/pages/index.astro:7`). Dzięki temu nie ma rozjazdu hydratacji (problem opisany w archiwum S-02) ani dodatkowego żądania. Przy odtwarzaniu snapshotu `lists.have` i `applied` pochodzą ze snapshotu; `staple`/`exclude` w `lists` — wymaga decyzji, czy z bazy, czy ze snapshotu (Open Question 1).
- **Zapis:** rekomendacja — przy każdej zmianie `staple`/`exclude` (add/remove), nie przy „Zastosuj filtry”. „Zastosuj filtry” (`usePantryMatch.ts:313-315`) dotyczy wyszukiwania i zapisuje `applied` dopiero po udanej odpowiedzi (`usePantryMatch.ts:187`); powiązanie z nim trwałości gubi tagi dodane bez kliknięcia. Zapis „przy opuszczeniu strony” (`pagehide`) jest zawodny i ściga się z wylogowaniem. Zapis po zmianie wymaga: blokady zapisu przed wczytaniem stanu początkowego (ta sama klasa błędu co `saveEnabled`, `usePantryMatch.ts:171-172`), „ostatni wygrywa” (pełna zamiana list, nie delta) oraz ochrony przed zapisaniem list użytkownika A na konto B, gdy w tej samej przeglądarce ktoś się przelogował w innej karcie.
- **Limity:** serwer musi walidować zapis tymi samymi limitami co dziś `match.ts` (`MAX_TAGS`, `MAX_TAG_LENGTH`, `countTokens(...) ≤ MAX_TOKENS`, `src/pages/api/recipes/match.ts:11-17,29-42`). Sam limit tokenów nie wystarcza: przy `MAX_TAGS = 30` na sekcję i `MAX_TAG_LENGTH = 60` (`src/lib/matching/limits.ts:4-5`) dwie zapisane sekcje mogą mieć 60 jednowyrazowych tagów (60 tokenów ≤ 100), a URL żądania dopasowania przekroczy `MAX_URL_LENGTH = 8000` (`limits.ts:9`) — wyspa wtedy nie wyśle żadnego zapytania z filtrami (`usePantryMatch.ts:95-100,108-110`). Zapis musi też sprawdzać budżet URL, tak jak `parseLists` w `list-state.ts:46-50`. Otwarta decyzja produktowa: czy zapisane listy mogą zająć cały budżet 100 tokenów (wtedy na „posiadane” nie zostaje nic), czy dostają mniejszy limit (Open Question 2).

## Detailed Findings

### 1. Stan listy w sessionStorage i wylogowanie (#34)

- Snapshot: klucz `pasujemi:list-state` (`src/lib/list-state.ts:11`), kształt `{ lists, applied, loaded, scrollY }` (`list-state.ts:14-19`). Zapis tylko przy `pagehide` i `visibilitychange → hidden` (`src/components/hooks/usePantryMatch.ts:254-274`), tylko gdy `saveEnabled` i `loaded > 0` (`usePantryMatch.ts:258`).
- Odczyt jest nieufny: `parseLists` odrzuca cały snapshot przy przekroczeniu `MAX_TAGS`, `MAX_TAG_LENGTH`, `MAX_TOKENS` (suma trzech list) lub budżetu URL z prefiksem najgorszego przypadku (`list-state.ts:29-52`, prefiks `list-state.ts:22-23`).
- Start wyspy (`usePantryMatch.ts:213-248`): brak snapshotu lub `loaded === 0` → lista bez filtrów z `EMPTY_LISTS`; snapshot → `requestRestore(snapshot.applied, ...)`, potem `setLists(snapshot.lists)` i `commit(..., snapshot.applied, ...)`. Przy błędzie odtwarzania snapshot jest czyszczony i widok wraca do pustych list (`usePantryMatch.ts:237-240`). Wszystkie trzy sekcje `lists` są dziś inicjalizowane wyłącznie z `EMPTY_LISTS` (`usePantryMatch.ts:19,151-153`) albo ze snapshotu.
- Wylogowanie: formularz `POST /api/auth/signout` z `data-signout` (`src/components/AppHeader.astro:24`); skrypt podpina `endListState` pod `submit` (`AppHeader.astro:33-38`). `endListState` ustawia moduł-lokalne `savingStopped = true` i usuwa snapshot (`list-state.ts:81-82,101-105`); `writeSnapshot` po tym nic nie robi (`list-state.ts:84-86`). Test: `src/lib/list-state.test.ts` (dodany w commicie 2c2ef9d, „stops saving after sign-out starts”). Endpoint wylogowania wywołuje `supabase.auth.signOut()` i przekierowuje na `/auth/signin` (`src/pages/api/auth/signout.ts:4-10`). W sprawdzonym `src/` jedynym miejscem wylogowania jest ten formularz (grep `signout|data-signout` poza `AppHeader.astro` znalazł tylko `src/pages/api/auth/signout.ts`).

**Jak S-04 ma z tym współgrać (wnioski):**

- Po „Wyloguj” → zalogowaniu w tej samej karcie snapshotu nie ma (`endListState`), więc `have` jest pusty, a `staple`/`exclude` muszą przyjść z bazy. Fix #34 zostaje bez zmian; nie należy przenosić `staple`/`exclude` do `localStorage` ani innego magazynu przeżywającego wylogowanie — trwałość daje baza z RLS.
- Źródło wartości początkowych: dziś odczyt snapshotu jest w efekcie po montażu, by hydratacja zgadzała się z HTML z serwera (`usePantryMatch.ts:213-215`; decyzja w `context/archive/2026-10-18-browse-recipes-and-details/plan.md:28`). Stałe/wykluczenia przekazane z serwera jako props mogą być wartością początkową `useState` bez rozjazdu hydratacji, bo serwer renderuje z tymi samymi danymi. Alternatywa (GET z wyspy po montażu) dokłada żądanie i stan „ładowania” tagów oraz okno, w którym pusty stan mógłby zostać zapisany.
- Kolizja snapshot vs baza przy powrocie ze szczegółów: snapshot ma własne `lists.staple`/`lists.exclude`. Jeśli zapis do bazy idzie przy każdej zmianie, a snapshot przy `pagehide`, to w jednej karcie obie wartości są zwykle równe. Różnią się, gdy (a) zapis do bazy się nie udał, (b) użytkownik zmienił stałe w innej karcie (snapshot jest per karta). `applied` ze snapshotu musi zostać nietknięte, bo opisuje pokazaną listę (`usePantryMatch.ts:152-153`) i jest użyte do odtworzenia stron (`usePantryMatch.ts:229`) — nadpisanie go danymi z bazy rozjechałoby listę i „Pokaż więcej”.
- Luka poza zakresem #34: wygaśnięcie sesji bez kliknięcia „Wyloguj” nie wywołuje `endListState`, więc snapshot (w tym `have`) zostaje w karcie i zostanie odtworzony po zalogowaniu innej osoby w tej karcie. Archiwalny review proponował alternatywnie przechowywanie id użytkownika w snapshocie (`context/archive/2026-10-18-browse-recipes-and-details/reviews/impl-review.md:34`). Jeśli S-04 bierze `staple`/`exclude` z bazy (nie ze snapshotu), wyciek dotyczy tylko `have`/`applied` — jak dziś.
- Komentarz `src/pages/api/recipes/match.ts:19` („Owned products live only in the session (PRD FR-003), so the island sends all three lists with each request”) pozostaje prawdziwy dla `have`. Rekomendacja: wyspa nadal wysyła wszystkie trzy listy w każdym żądaniu dopasowania; endpoint dopasowania nie czyta tabeli. Zmiana kontraktu `match.ts` nie jest potrzebna dla FR-003.

### 2. Kiedy zapisywać

Opcje i ich konsekwencje (na podstawie przepływu w `usePantryMatch.ts`):

| Opcja | Plusy | Minusy |
|---|---|---|
| A. Po każdej zmianie `staple`/`exclude` (add/remove) | Zgodne z oczekiwaniem „dodałam tag = zapamiętany”; niezależne od wyszukiwania; mały payload | Więcej żądań; trzeba obsłużyć kolejność odpowiedzi i błędy zapisu |
| B. Przy „Zastosuj filtry” | Jedno żądanie na wyszukiwanie | Tag dodany bez kliknięcia ginie; `apply` może się nie udać (`commit` z błędem nie ustawia `applied`, `usePantryMatch.ts:182-185`), więc nie wiadomo, co zapisać; miesza dwie odpowiedzialności |
| C. Przy opuszczeniu strony (`pagehide`, `fetch keepalive`) | Jedno żądanie | Zawodne (zamknięcie karty, mobilne przeglądarki); `pagehide` odpala też przy wysyłce formularza „Wyloguj”, ściga się z `POST /api/auth/signout` |

Rekomendacja: **A**, z ograniczeniami:

- Wyzwalacz: tylko `addTag`/`removeTag` dla sekcji `staple` i `exclude` (`usePantryMatch.ts:284-311`); zmiany `have` nie zapisują nic.
- Treść: pełna zamiana obu list (PUT/upsert całego stanu), nie delta — kolejne zapisy są idempotentne i „ostatni wygrywa”. Krótki debounce (np. kilkaset ms) lub sekwencjonowanie z `AbortController`, analogicznie do `requestId`/`inFlight` (`usePantryMatch.ts:165-168`), by starsza odpowiedź nie nadpisała stanu nowszego.
- Blokada startowa: brak zapisu, dopóki stan początkowy nie jest znany — ta sama klasa błędu co `saveEnabled` dla snapshotu (`usePantryMatch.ts:171-172`; decyzja „State sequencing” w `context/archive/2026-10-18-browse-recipes-and-details/plan.md:48`). Przy propsach z serwera blokada jest prosta (stan znany od pierwszego renderu), ale efekt zapisujący nie może odpalić na samym montażu.
- Przelogowanie w innej karcie: cookie sesji jest wspólne dla przeglądarki (`createServerClient` czyta je z nagłówka `Cookie`, `src/lib/supabase.ts:9-13`). Jeśli w karcie 1 czeka zapis (debounce) użytkownika A, a w karcie 2 nastąpi wylogowanie i zalogowanie B, zapis z karty 1 trafi z cookie B na konto B. Opcje do planu: wysyłać id właściciela w treści i odrzucać niezgodność z `locals.user.id`; albo zapisywać bez debounce (zawęża okno, nie zamyka). `endListState` powinno też anulować oczekujący zapis spiżarki (dziś blokuje tylko `writeSnapshot`, `list-state.ts:84-86`).
- Błąd zapisu: dziś hook nie ma stanu błędu zapisu (zwraca `error` i `limitNotice`, `usePantryMatch.ts:321-339`). Czy pokazywać komunikat („Nie udało się zapisać produktów stałych”) — decyzja UI dla planu.

### 3. Limity tokenów przy zapisie

- Limity współdzielone przez endpoint i wyspę: `MAX_TAG_LENGTH = 60`, `MAX_TAGS = 30` (na sekcję), `MAX_TOKENS = 100` (suma słów we wszystkich trzech listach), `MAX_URL_LENGTH = 8000` (`src/lib/matching/limits.ts:4-9`); `countTokens` = suma `tokenize(tag).length` (`limits.ts:11-13`), `tokenize` dzieli po znakach niebędących literami i pomija 9 stop-słów (`src/lib/matching/tokenize.ts:4-12`).
- Gdzie dziś są sprawdzane: `addTag` (pusty, za długi, duplikat bez rozróżniania wielkości liter, pełna sekcja, `exceedsLimits` = tokeny lub URL; `usePantryMatch.ts:284-300`), `requestPage` (`usePantryMatch.ts:108-110`), `parseLists` dla snapshotu (`list-state.ts:31-52`), `GET /api/recipes/match` (tagi, długość, tokeny — bez URL, bo za długi URL nie dotrze; `match.ts:11-17,29-42`).
- Wymagania dla zapisu (wnioski):
  - Serwer (`POST`/`PUT` nowego endpointu) traktuje treść jako nieufną i sprawdza dla `staple` i `exclude`: tablice stringów, `trim`, niepuste, `≤ MAX_TAG_LENGTH`, `≤ MAX_TAGS` na sekcję, `countTokens(staple ∪ exclude) ≤ MAX_TOKENS`, oraz budżet URL. Przy przekroczeniu 400 z czytelnym kodem (lekcja „Bound user-driven CPU work per request”, `context/foundation/lessons.md`). Rozmiar body ograniczony przed parsowaniem jak w `POST /api/recipes` (`src/pages/api/recipes/index.ts:67-89`, `MAX_RECIPE_BODY_BYTES` w `src/lib/recipes/limits.ts`).
  - Budżet URL jest konieczny: przykład — 2 sekcje × 30 tagów, każdy to jedno 60-literowe słowo z polską literą (np. „ą…”) → 60 tokenów (≤ 100, przechodzi), ale `URLSearchParams` koduje każdą taką literę jako 6 znaków (`%C4%85`), czyli do 60 × 60 × 6 = 21 600 znaków samych wartości > 8000. Wyspa z takimi listami nie wyśle żądania z filtrami (`exceedsLimits`, `usePantryMatch.ts:95-100`), więc zapis nie może ich dopuścić.
  - Duplikaty: `addTag` odrzuca duplikat w sekcji bez rozróżniania wielkości liter (`usePantryMatch.ts:288-293`); serwer powinien je odrzucać lub usuwać, by stan zapisany = stan możliwy do wyklikania.
  - Budżet dla „posiadanych”: `addTag` liczy tokeny ze wszystkich trzech list (`usePantryMatch.ts:297`). Jeśli zapisane `staple ∪ exclude` mają 100 tokenów, po zalogowaniu nie da się dodać żadnego „posiadanego” (komunikat `LIMIT_MESSAGE`, `usePantryMatch.ts:11`). To nie jest błąd techniczny, ale decyzja produktowa (Open Question 2).
  - Walidacja jako czysta funkcja współdzielona przez wyspę i endpoint (jak `parseLists` w `list-state.ts` i `limits.ts`, który celowo nie importuje stemmera, by wyspa mogła go użyć — `tokenize.ts:1`). `parseLists` jest dziś prywatna w `list-state.ts` i zawiera logikę URL dla trzech list; plan może ją wydzielić i użyć ponownie zamiast duplikować.
  - Odczyt z bazy też jest nieufny: użytkownik może pisać do własnego wiersza bezpośrednio przez PostgREST swoim JWT (RLS pozwoli na własny wiersz), z pominięciem walidacji endpointu. Skutek ograniczony do jego konta (`match.ts` i tak odrzuci za duże żądanie 400), ale `pantry.ts` powinien przy odczycie przepuszczać wynik przez tę samą walidację i zwracać puste listy zamiast rzucać. Ograniczenia w bazie (`CHECK` na `cardinality(...) <= 30`; długość elementów przez funkcję `immutable`) są obroną w głąb; limitu tokenów nie da się wyrazić w SQL bez powielenia `tokenize`.

### 4. Baza danych i RLS (kontekst dla planu)

- Wzorzec migracji z repo: `enable row level security`, `revoke all ... from anon, authenticated`, jawne granty, polityki per operacja `to authenticated` z `(select auth.uid())` (`supabase/migrations/20261012120000_create_recipes.sql:25-36`; `supabase/migrations/20261017120000_add_recipe_author_and_insert.sql:20-29`, w tym grant kolumnowy na insert).
- Klient Supabase w API działa z JWT użytkownika z cookie (`src/lib/supabase.ts:5-20`), więc RLS jest egzekwowane dla zapytań z `pantry.ts`.
- Kształt tabeli (do decyzji w planie): jeden wiersz na użytkownika (`user_id uuid primary key references auth.users on delete cascade`, `staple text[]`, `exclude text[]`, `updated_at`) pasuje do zapisu „pełna zamiana” jednym upsertem. Upsert (`INSERT ... ON CONFLICT DO UPDATE`) potrzebuje polityk `insert` i `update`; dokumentacja Supabase wymaga też polityki `select` dla działania `update` (Supabase guides, „Row Level Security → UPDATE policies”, pobrane przez Context7 2026-10-18). Polityka `delete` (właściciel) — jeśli „wyczyść” ma usuwać wiersz; w przeciwnym razie zapis pustych tablic.
- Uwaga AGENTS.md: każda nowa tabela ma RLS z politykami per operacja i per rola; pantry jest prywatna (`AGENTS.md`, Hard Rules). PRD Guardrails: „Spiżarka, produkty stałe i wykluczenia użytkownika są prywatne — widzi je tylko on” (`context/foundation/prd.md:51`).

## Code References

- `src/lib/list-state.ts:11-19` — klucz i kształt snapshotu.
- `src/lib/list-state.ts:22-52` — nieufna walidacja list (tagi, tokeny, budżet URL).
- `src/lib/list-state.ts:81-105` — `savingStopped`, `writeSnapshot`, `clearSnapshot`, `endListState`.
- `src/components/AppHeader.astro:24-38` — formularz „Wyloguj” i podpięcie `endListState`.
- `src/pages/api/auth/signout.ts:4-10` — wylogowanie po stronie serwera.
- `src/components/hooks/usePantryMatch.ts:19,151-173` — stan początkowy, `applied`, `saveEnabled`.
- `src/components/hooks/usePantryMatch.ts:213-248` — odczyt/odtworzenie snapshotu po montażu.
- `src/components/hooks/usePantryMatch.ts:254-274` — zapis snapshotu przy `pagehide`/`visibilitychange`.
- `src/components/hooks/usePantryMatch.ts:284-315` — `addTag`, `removeTag`, `apply`.
- `src/lib/matching/limits.ts:4-13` — limity i `countTokens`.
- `src/lib/matching/tokenize.ts:1-12` — tokenizacja bez stemmera (importowalna w wyspie).
- `src/pages/api/recipes/match.ts:11-17,19,29-42` — walidacja list w endpointcie, komentarz o sesyjności „posiadanych”.
- `src/pages/api/recipes/index.ts:59-108` — wzorzec POST: 401, 415, limit body, JSON, walidacja, 503, 500.
- `src/pages/index.astro:1-8` — `PantryMatch client:load`, dziś bez propsów.
- `src/lib/supabase.ts:5-20` — klient z cookie użytkownika.
- `supabase/migrations/20261012120000_create_recipes.sql:25-36`, `supabase/migrations/20261017120000_add_recipe_author_and_insert.sql:20-29` — wzorzec RLS/grantów.

## Architecture Insights

- Warstwy stanu spiżarki po S-04: React `useState` (bieżąca edycja) → `sessionStorage` (stan widoku w karcie, czyszczony przy „Wyloguj”) → Postgres z RLS (tylko `staple`/`exclude`, między sesjami). `have` nigdy nie trafia do bazy (FR-003, `context/foundation/prd.md:88-89`).
- Limity żyją w jednym pliku współdzielonym przez API i UI (`limits.ts`; zasada z `lessons.md`). Nowe limity zapisu (np. rozmiar body, ewentualny osobny budżet tokenów) powinny trafić tam lub do analogicznego pliku dla spiżarki, nie do endpointu.
- Serwisy przyjmują `SupabaseClient` jako pierwszy argument i rzucają błąd bazy; endpoint mapuje go na `500 database_error` z `console.error` (`src/lib/services/recipes.ts:83,105`; `src/pages/api/recipes/index.ts:101-107`). `pantry.ts` powinien trzymać ten sam kontrakt.

## Historical Context (from prior changes)

- `context/archive/2026-10-18-browse-recipes-and-details/plan.md:29` — „Spiżarka »posiadane« ma być tylko sesyjna (PRD FR-003); `sessionStorage` (per karta) jest zgodne z tą zasadą” — **nadal aktualne** dla `have`.
- `context/archive/2026-10-18-browse-recipes-and-details/plan.md:36` — trwałe stałe i wykluczenia jawnie wyłączone z S-02 i odłożone do S-04 — **aktualne**, to ta zmiana.
- `context/archive/2026-10-18-browse-recipes-and-details/plan.md:48` — zapis snapshotu wyłączony do końca odczytu/odtwarzania — **aktualne**; ta sama zasada dotyczy zapisu do bazy.
- `context/archive/2026-10-18-browse-recipes-and-details/research.md:53` — „trwały zapis (S-04) nie [jest zgodny z sessionStorage]” — **częściowo**: trwały zapis nie może iść do `sessionStorage`, ale obie warstwy mogą współistnieć.
- `context/archive/2026-10-18-browse-recipes-and-details/reviews/impl-review.md:27-38` (F1) — snapshot przeżywał wylogowanie; naprawione przez `endListState` (#34, PR #35, commit 2c2ef9d). Alternatywa z id użytkownika w snapshocie nie została wdrożona — **luka dla wygasłej sesji pozostaje** (sekcja 1).

## Related Research

- `context/archive/2026-10-18-browse-recipes-and-details/research.md` — mechanizm zachowania kontekstu listy (URL vs `sessionStorage`).
- `context/archive/2026-10-12-first-pantry-match/` — S-03, limity dopasowania i kontrakt `match.ts` (nie czytano ponownie; kontrakt sprawdzony bezpośrednio w kodzie).

## Open Questions

1. **Snapshot vs baza dla `lists.staple`/`lists.exclude` przy powrocie ze szczegółów.** Brać ze snapshotu (spójne z tym, co użytkownik widział w tej karcie) czy z bazy (spójne między kartami)? `applied` zawsze ze snapshotu. Rekomendacja robocza: z bazy (props z serwera), bo to źródło prawdy, a przy zapisie po każdej zmianie w jednej karcie wartości są zwykle równe.
2. **Budżet tokenów dla zapisanych list.** Pełne `MAX_TOKENS = 100` dla `staple ∪ exclude` (najprościej; „posiadane” mogą nie mieć miejsca) czy osobny, mniejszy limit (np. stała `MAX_SAVED_TOKENS` w `limits.ts`), gwarantujący miejsce na „posiadane”? Decyzja produktowa.
3. **Ochrona przed zapisem na cudze konto po przelogowaniu w innej karcie** — id właściciela w treści + 409 vs akceptacja ryzyka przy zapisie bez debounce.
4. **Komunikat o nieudanym zapisie** i czy po błędzie ponawiać zapis.
5. **Kształt tabeli i usuwanie** — jeden wiersz z tablicami vs wiersz na tag; puste listy = puste tablice vs `delete` wiersza (wpływa na wymagane polityki).
