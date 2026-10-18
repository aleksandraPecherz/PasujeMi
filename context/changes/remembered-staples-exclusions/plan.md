# S-04: zapamiętane produkty stałe i wykluczenia — plan implementacji

## Overview

Po ponownym zalogowaniu użytkownik zastaje swoje produkty stałe i wykluczenia; produkty posiadane wpisuje od nowa (FR-003, issue #6). Stałe i wykluczenia trafiają do prywatnej tabeli z RLS (jeden wiersz na użytkownika), strona główna czyta je na serwerze i podaje wyspie jako props, a wyspa zapisuje pełny stan obu list po każdym dodaniu lub usunięciu tagu w tych sekcjach.

## Current State Analysis

- Wszystkie trzy listy żyją tylko w `useState` wyspy (`src/components/hooks/usePantryMatch.ts:151-153`) i w snapshocie `sessionStorage` (`src/lib/list-state.ts:14-19`), który `endListState` czyści przy „Wyloguj” (`list-state.ts:102-105`, `src/components/AppHeader.astro:33-38`). Po ponownym zalogowaniu wszystko startuje puste.
- `src/pages/index.astro:7` renderuje `<PantryMatch client:load />` bez propsów. `PantryMatch` (`src/components/pantry/PantryMatch.tsx:33-50`) bierze cały stan z `usePantryMatch()`.
- Limity dopasowania: `MAX_TAG_LENGTH = 60`, `MAX_TAGS = 30` na sekcję, `MAX_TOKENS = 100` na wszystkie trzy listy, `MAX_URL_LENGTH = 8000` (`src/lib/matching/limits.ts:4-9`). Budżet URL dla snapshotu liczy prywatna `parseLists` z prefiksem najgorszego przypadku (`list-state.ts:22-23,46-50`); wyspa sprawdza go własnym `exceedsLimits` (`usePantryMatch.ts:95-100`).
- Wzorzec POST z limitem body: `src/pages/api/recipes/index.ts:59-109` (401 → 415 → 413 → JSON → walidacja → 503 → 500). `readTextWithLimit` jest w tym pliku prywatna.
- Wzorzec RLS i grantów kolumnowych: `supabase/migrations/20261012120000_create_recipes.sql:25-36`, `supabase/migrations/20261017120000_add_recipe_author_and_insert.sql:20-29`. CI ma krok sprawdzający uprawnienia curl-em na dwóch kontach (`.github/workflows/ci.yml`, „Check recipe insert permissions”).
- Serwisy przyjmują `SupabaseClient` i rzucają błąd bazy; endpoint mapuje go na `500 database_error` (`src/lib/services/recipes.ts:83-99`). Testy serwisu używają ręcznego fałszywego klienta (`src/lib/services/recipes.test.ts:25-50`).
- Vitest uruchamia tylko `src/**/*.test.ts` w środowisku `node` (`vitest.config.ts`), więc logika hooka do przetestowania musi leżeć w czystych modułach `.ts`.

## Desired End State

- Zalogowany użytkownik dodaje „sól” do stałych i „orzechy” do wykluczeń, wylogowuje się, loguje ponownie i widzi oba tagi w odpowiednich sekcjach; „Mam w domu” jest puste, a lista przepisów od razu startuje z zapisanymi filtrami (jedno żądanie dopasowania, bez „Zastosuj filtry”). Przepis z wykluczonym składnikiem nie pojawia się nawet na chwilę: do odpowiedzi widoczny jest tylko szkielet, a błąd tego żądania nie przechodzi w listę bez filtrów.
- Po powrocie ze szczegółów przepisu `have`, `applied` i `loaded` pochodzą ze snapshotu, a `staple`/`exclude` z bazy (props).
- Zapisane stałe i wykluczenia razem mają najwyżej 60 słów (`countTokens`), najwyżej 30 tagów na sekcję, tagi ≤ 60 znaków i mieszczą się w budżecie URL; to samo sprawdza wyspa, endpoint i odczyt z bazy (niepoprawne dane z bazy = jak nieudany odczyt: puste sekcje, zapis wyłączony z komunikatem, wiersz nietknięty).
- Zapis z id właściciela innym niż sesja dostaje 409; użytkownik nie może przeczytać ani zmienić cudzego wiersza (RLS, sprawdzane w CI).
- Weryfikacja: `npm test`, `npm run lint`, `npx astro check`, `npm run check:ui`, `npm run build`, kroki RLS w CI, `npm run smoke` na lokalnym Supabase, ręczny przegląd na `/` i `/dev/kitchen-sink`.

### Key Discoveries:

- `addTag` liczy tokeny ze wszystkich trzech list (`usePantryMatch.ts:297`), więc limit 60 słów na zapisane listy to osobne, dodatkowe sprawdzenie, a nie zamiana istniejącego.
- Przerwanie `fetch` (`AbortController`) nie gwarantuje, że serwer nie zapisał starszego PUT po nowszym — kolejność gwarantuje dopiero zapis „jeden w locie”.
- Odtworzenie snapshotu ustawia listy w efekcie po montażu (`usePantryMatch.ts:229-236`); jeśli nadal ustawiałoby całe `snapshot.lists`, nadpisałoby `staple`/`exclude` z bazy.
- Komentarz `src/pages/api/recipes/match.ts:19` zostaje prawdziwy: endpoint dopasowania nie czyta nowej tabeli, wyspa nadal wysyła trzy listy w URL.

## What We're NOT Doing

- Luka z wygaśnięciem sesji bez kliknięcia „Wyloguj” (snapshot `have`/`applied` zostaje w karcie) — poza zakresem.
- Brak ponawiania nieudanego zapisu, debounce i zapisu przy `pagehide`.
- Brak polityki i grantu `delete`; puste listy to puste tablice w istniejącym wierszu.
- Brak zmian w `GET /api/recipes/match` i w kontrakcie `have` (zostaje sesyjne).
- Brak synchronizacji na żywo między kartami — ostatni zapis wygrywa.
- Migracja na produkcji nie jest częścią implementacji agenta (robi ją autorka ręcznie przed merge).

## Implementation Approach

Od dołu do góry: najpierw tabela, limity i czysty walidator, który służy wyspie, endpointowi i odczytowi z bazy; potem endpoint i odczyt w `index.astro`; na końcu wyspa. Odczyt na serwerze daje wartość początkową `useState` bez rozjazdu hydratacji i bez okna, w którym pusty stan mógłby zostać zapisany. Zapis idzie przez mały moduł kolejki (`createPantrySaver`), wywoływany tylko z handlerów `addTag`/`removeTag`, więc montaż i odtwarzanie snapshotu niczego nie zapisują.

## Critical Implementation Details

- **Upsert i granty**: PostgREST przy `upsert` generuje `ON CONFLICT DO UPDATE SET` dla każdej kolumny z payloadu, w tym `user_id`. Grant `update` musi więc obejmować `user_id`, a polityka `update` ma `using` i `with check` na `user_id = (select auth.uid())`, żeby nie dało się przepisać wiersza na kogoś innego. Upsert wymaga też polityki `select`. Krok CI potwierdza to w praktyce.
- **State sequencing (wyspa)**: wywołanie zapisu nie może siedzieć w funkcji aktualizującej `setLists(prev => …)` — w StrictMode React wywołuje ją dwa razy. Handler liczy `next` z bieżących `lists`, wywołuje `setLists(next)` i `saver.save(...)`. Odtworzenie snapshotu ustawia tylko `have` (`setLists(prev => ({ ...prev, have: snapshot.lists.have }))`), więc tag stały dodany w trakcie odtwarzania nie ginie.
- **Start z zapisanymi filtrami**: gdy `saved` nie jest `null`, ma niepuste `staple` lub `exclude`, a snapshotu brak (lub `loaded === 0`), pierwsze żądanie efektu startowego to `requestPage(initialFilters(saved), 0)` zamiast `EMPTY_LISTS` — jedno żądanie, nigdy najpierw lista bez filtrów. `applied` startuje od tych samych filtrów, żeby nagłówek i `filtered` zgadzały się od pierwszego renderu (SSR i hydratacja widzą te same props). Przy błędzie tego żądania widok pokazuje komunikat błędu bez listy, bez fallbacku do `EMPTY_LISTS`.
- **Kolejność zapisów**: najwyżej jedno żądanie PUT w locie; kolejne `save()` w tym czasie nadpisuje jeden oczekujący stan (koalescencja), wysyłany po zakończeniu bieżącego. Wynik (komunikat lub jego brak) raportowany jest tylko dla żądania, po którym nic już nie czeka — starsza odpowiedź nie nadpisuje stanu nowszej.

## Faza 1: Dane i walidacja

### Overview

Tabela z RLS, wspólne limity zapisu, czysty walidator i serwis `pantry.ts` z testami; krok uprawnień w CI.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/20261018130000_create_saved_pantry.sql`

**Intent**: Prywatna tabela na zapisane stałe i wykluczenia, jeden wiersz na użytkownika; dostęp tylko właściciela do odczytu, wstawienia i zmiany.

**Contract**: `public.saved_pantry(user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade, staples text[] not null default '{}' check (cardinality(staples) <= 30), exclusions text[] not null default '{}' check (cardinality(exclusions) <= 30), updated_at timestamptz not null default now())`. `enable row level security`; `revoke all ... from anon, authenticated`; `grant select`, `grant insert (user_id, staples, exclusions, updated_at)`, `grant update (user_id, staples, exclusions, updated_at)` dla `authenticated`. Polityki `to authenticated`: `saved_pantry_select_own` (`using`), `saved_pantry_insert_own` (`with check`), `saved_pantry_update_own` (`using` + `with check`) — wszystkie `user_id = (select auth.uid())`. Bez delete. Komentarz nagłówkowy w stylu istniejących migracji (S-04, ścieżka planu, dlaczego limit tokenów nie jest w SQL — walidacja aplikacji + nieufny odczyt).

#### 2. Limity zapisu i wspólny budżet URL

**File**: `src/lib/pantry/limits.ts` (nowy), `src/lib/matching/limits.ts`, `src/lib/list-state.ts`

**Intent**: Jedno miejsce na limity zapisanej spiżarki (lekcja „Bound user-driven CPU work per request”) i jeden helper budżetu URL zamiast prywatnej logiki w `list-state.ts`.

**Contract**: `src/lib/pantry/limits.ts`: `MAX_SAVED_TOKENS = 60` (słowa w `staple ∪ exclude`), `MAX_PANTRY_BODY_BYTES = 32000`. `src/lib/matching/limits.ts`: `exceedsMatchUrl(lists: Partial<PantryLists>): boolean` — prefiks najgorszego przypadku `/api/recipes/match?limit=50&offset=100&` (przeniesiony z `list-state.ts:23`) + `URLSearchParams` z sekcjami w kolejności have/staple/exclude, `> MAX_URL_LENGTH`. `parseLists` w `list-state.ts` używa helpera; zachowanie snapshotu bez zmian (istniejące testy przechodzą).

#### 3. Walidator zapisanych list

**File**: `src/lib/pantry/saved.ts` (nowy) + `src/lib/pantry/saved.test.ts`

**Intent**: Czysta, nieufna walidacja używana przez endpoint, odczyt z bazy i (stała limitu) wyspę.

**Contract**: `export type SavedPantry = Pick<PantryLists, "staple" | "exclude">`; `export const EMPTY_SAVED: SavedPantry`; `parseSavedPantry(value: unknown): SavedPantry | null` — obiekt z tablicami `staple` i `exclude`; każda ≤ `MAX_TAGS`; elementy to stringi, po `trim` niepuste i ≤ `MAX_TAG_LENGTH`; brak duplikatów w sekcji bez rozróżniania wielkości liter (`toLocaleLowerCase("pl")`, jak `addTag`); `countTokens([...staple, ...exclude]) ≤ MAX_SAVED_TOKENS`; `!exceedsMatchUrl({ staple, exclude })`. Zwraca przycięte wartości albo `null`. `initialFilters(saved: SavedPantry | null): PantryLists` — `{ have: [], staple, exclude }` z `saved`, a dla `null` puste listy; służy wyspie jako filtry startowe. Testy: poprawne listy (w tym puste), każdy powód odrzucenia, granica 60/61 słów (tagi wielowyrazowe i unikalne, np. 30 × `ser żółty ${i}` + 0/1 tag w `exclude`; ≤ 30 tagów w sekcji, żeby odrzucenie wynikało z limitu słów, nie z `MAX_TAGS` ani duplikatów), przypadek budżetu URL (np. 2 × 30 tagów po jednym słowie z polskimi literami, które mieszczą się w tokenach, ale nie w URL — tag 60-znakowy z „ą”).

#### 4. Serwis

**File**: `src/lib/services/pantry.ts` (nowy) + `src/lib/services/pantry.test.ts`

**Intent**: Odczyt i zapis wiersza `saved_pantry` z kontraktem jak `recipes.ts` (klient jako pierwszy argument, błąd bazy rzucany).

**Contract**: `getSavedPantry(supabase, userId): Promise<SavedPantry | null>` — `select("staples, exclusions").eq("user_id", userId).maybeSingle()`; brak wiersza → `EMPTY_SAVED`; wiersz przez `parseSavedPantry` (mapowanie `staples→staple`, `exclusions→exclude`), `null` → `console.error` i `null` (jak nieudany odczyt: wyspa wyłącza zapis, więc np. zaostrzenie limitu nie skasuje po cichu zapisanych wykluczeń przy następnej edycji); błąd → `throw`. `saveSavedPantry(supabase, userId, pantry: SavedPantry): Promise<void>` — `upsert({ user_id, staples, exclusions, updated_at: new Date().toISOString() }, { onConflict: "user_id" })`; błąd → `throw`. Testy z minimalnym fałszywym klientem (wzorzec `recipes.test.ts`): brak wiersza, poprawny wiersz, wiersz z przekroczonym limitem → `null`, błąd odczytu rzuca, payload upsertu i `onConflict`, błąd zapisu rzuca.

#### 5. Krok uprawnień w CI

**File**: `.github/workflows/ci.yml`

**Intent**: Dowód, że RLS i granty działają na prawdziwym Postgresie, po kroku „Check recipe insert permissions”.

**Contract**: Nowy krok „Check saved pantry permissions” (dwa konta A i B przez `/auth/v1/signup`, jak istniejący krok; najpierw status i typ odpowiedzi, potem treść — lekcja z `lessons.md`): A upsertuje własny wiersz (`Prefer: resolution=merge-duplicates`, `on_conflict=user_id`) → 201/200, drugi upsert A (aktualizacja) → sukces; B wstawia własny wiersz; A czyta `saved_pantry` → tablica z dokładnie jednym wierszem, `user_id == id_a`; A wstawia (zwykły insert, bez upsertu) wiersz z `user_id = id_b` → 403 + 42501 (`with check` RLS jest sprawdzane przed ograniczeniem unikalności); A `PATCH` wiersza B → brak zmian (sprawdzone service role); A `DELETE` własnego → 42501; anon `select` → 401/403 + 42501.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na czystej bazie: `supabase db reset`
- Testy walidatora, serwisu i snapshotu przechodzą: `npm test`
- Lint i typy: `npm run lint`, `npx astro check`
- Krok „Check saved pantry permissions” przechodzi w CI

#### Manual Verification:

- W lokalnym Supabase Studio tabela `saved_pantry` ma RLS włączone, trzy polityki i brak polityki delete

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Faza 2: Endpoint i odczyt na stronie

### Overview

`PUT /api/pantry` z pełną walidacją i 409 przy niezgodnym właścicielu; `index.astro` czyta zapisane listy i podaje je wyspie; nowe kroki smoke.

### Changes Required:

#### 1. Wspólne czytanie body z limitem

**File**: `src/lib/request-body.ts` (nowy), `src/pages/api/recipes/index.ts`

**Intent**: `readTextWithLimit` przeniesiona bez zmian zachowania, żeby oba endpointy POST/PUT jej używały.

**Contract**: `export async function readTextWithLimit(request: Request, maxBytes: number): Promise<string | null>`; `recipes/index.ts` importuje ją zamiast lokalnej kopii.

#### 2. Endpoint zapisu

**File**: `src/pages/api/pantry.ts` (nowy)

**Intent**: Pełna zamiana zapisanych list zalogowanego użytkownika, z odrzuceniem zapisu niesionego przez inną sesję.

**Contract**: `export const PUT: APIRoute`. Body `{ ownerId: string, staple: string[], exclude: string[] }`. Kolejność odpowiedzi: brak `locals.user` → 401 `unauthorized`; media type ≠ `application/json` → 415 `unsupported_media_type`; `Content-Length` lub odczytane body > `MAX_PANTRY_BODY_BYTES` → 413 `payload_too_large`; niepoprawny JSON → 400 `invalid_json`; `ownerId` nie jest stringiem → 400 `invalid_pantry`; `ownerId !== locals.user.id` → 409 `owner_mismatch`; `parseSavedPantry(body) === null` → 400 `invalid_pantry`; brak klienta → 503 `not_configured`; błąd serwisu → `console.error` + 500 `database_error`; sukces → 204 bez treści. Komentarz: po co 409 (przelogowanie w innej karcie, wspólne cookie).

#### 3. Odczyt w stronie głównej

**File**: `src/pages/index.astro`

**Intent**: Wartość początkowa stałych i wykluczeń z bazy, renderowana na serwerze, żeby hydratacja zgadzała się z HTML.

**Contract**: `user = Astro.locals.user` (gdy brak — `Astro.redirect("/auth/signin")`, obrona w głąb); `createClient` → `getSavedPantry(supabase, user.id)`; brak klienta lub wyjątek → `console.error` i `saved = null`; niepoprawny wiersz → `getSavedPantry` zwraca `null`. `<PantryMatch client:load userId={user.id} saved={saved} />`, gdzie `saved: SavedPantry | null` (`null` = odczyt się nie udał lub wiersz był niepoprawny). W tej samej fazie `PantryMatch.tsx` dostaje typ propsów `PantryMatchProps = { userId: string; saved: SavedPantry | null }` (przyjęte, jeszcze nieużywane), żeby `npx astro check` przeszedł; przekazanie do hooka w fazie 3. Plik zostaje w `CLEAN_FILES`.

#### 4. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Pokrycie endpointu i powrotu list po ponownym zalogowaniu na działającym serwerze.

**Contract**: Nowe kroki: „anonymous pantry save gets 401” (przed rejestracją); po zalogowaniu: odczyt `userId` z HTML `/` (props wyspy; Astro serializuje string jako `[0, value]`, w HTML `userId&quot;:[0,&quot;<uuid>`, więc regex dopasowuje kształt UUID: `/userId.{0,40}?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/`; brak dopasowania = krok nieudany); „pantry save with another owner gets 409” (`UNKNOWN_RECIPE_ID` jako ownerId); „pantry save over the word limit gets 400” (tagi wielowyrazowe, bo 2 × 30 jednowyrazowych daje najwyżej 60 słów, a 30 + 31 wpadłoby w `MAX_TAGS` z tym samym kodem błędu: `staple` = 30 × `ser żółty ${i}` — unikalne, cyfry znikają w `tokenize`, więc po 2 słowa = 60 — plus `exclude: ["orzechy"]` = 61); „pantry save with text/plain gets 415”; „signed-in user saves staples and exclusions” → 204 (`staple: ["sól smoke"]`, `exclude: ["orzechy smoke"]`). Na końcu, po istniejącym „signout clears session”: ponowne zalogowanie → „saved staples come back after signing in again” (HTML `/` zawiera oba tagi) → ponowne wylogowanie i istniejący krok „root redirects after signout” jako ostatni.

### Success Criteria:

#### Automated Verification:

- Testy, lint, typy i literały UI: `npm test`, `npm run lint`, `npx astro check`, `npm run check:ui`
- Build: `npm run build`
- Job `smoke` w CI przechodzi z nowymi krokami

#### Manual Verification:

- `npm run smoke` przechodzi na lokalnym serwerze podłączonym do lokalnego Supabase z Dockera (`.env`/`.dev.vars` tymczasowo z wartościami z `supabase status`, potem przywrócone; nigdy na produkcji)
- Strona `/` renderuje się, gdy tabela nie istnieje (np. przed `supabase db reset` z nową migracją): log błędu, puste sekcje, lista przepisów działa

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Faza 3: Wyspa

### Overview

Wyspa startuje z zapisanych list, łączy je ze snapshotem przy powrocie, pilnuje limitu 60 słów i zapisuje zmiany kolejką; komunikaty o błędzie zapisu i odczytu; stany w kitchen sink.

### Changes Required:

#### 1. Kolejka zapisu

**File**: `src/lib/pantry/saver.ts` (nowy) + `src/lib/pantry/saver.test.ts`

**Intent**: Zapis „jeden w locie, ostatni wygrywa”, bez ponawiania, zatrzymywany przy wylogowaniu; testowalny bez Reacta.

**Contract**: `createPantrySaver({ ownerId, send?, isStopped, onResult }): { save(pantry: SavedPantry): void }`. `send` domyślnie `fetch("/api/pantry", { method: "PUT", headers: JSON, body: JSON.stringify({ ownerId, ...pantry }) })` i zwraca status (błąd sieci = 0). `save` przy żądaniu w locie zapamiętuje tylko najnowszy stan; po zakończeniu wysyła oczekujący. `onResult(message: string | null)` wołane tylko, gdy po zakończonym żądaniu nic nie czeka. `isStopped()` sprawdzane przed każdym wysłaniem (oczekujący stan jest wtedy porzucany). Komunikaty: 2xx → `null`; 401 → „Sesja wygasła. Zaloguj się ponownie.”; 409 → „Zalogowano się na inne konto. Odśwież stronę.”; pozostałe i sieć → „Nie udało się zapisać produktów stałych i wykluczeń.”. Testy z fałszywym `send` (obietnice rozwiązywane ręcznie): kolejność wysyłek, koalescencja trzech `save` w jedno oczekujące, wynik tylko ostatniego, błąd starszego nie zostaje po sukcesie nowszego, brak ponowienia po błędzie, `isStopped` blokuje wysyłkę oczekującego, mapowanie statusów.

#### 2. Zatrzymanie przy wylogowaniu

**File**: `src/lib/list-state.ts` + `src/lib/list-state.test.ts`

**Intent**: Wylogowanie zatrzymuje też oczekujący zapis spiżarki, nie tylko snapshot.

**Contract**: `export function listStateEnded(): boolean` (zwraca `savingStopped`), przekazywane jako `isStopped` do kolejki. Czysta `restoreLists(snapshotLists, current): PantryLists` → `{ have: snapshotLists.have, staple: current.staple, exclude: current.exclude }` z testem, używana przy odtwarzaniu. Czysta `missesSavedExclusion(applied: PantryLists, saved: SavedPantry | null): boolean` — `true`, gdy `saved.exclude` ma tag (bez rozróżniania wielkości liter, `toLocaleLowerCase("pl")`), którego brak w `applied.exclude`; dla `null` → `false`. Testy: `listStateEnded()` jest `true` po `endListState()`; `missesSavedExclusion` dla `null`, zgodnych list, innej wielkości liter i nowego wykluczenia.

#### 3. Hook

**File**: `src/components/hooks/usePantryMatch.ts`

**Intent**: Start z zapisanych list i od razu z zapisanymi filtrami, łączenie przy powrocie, limit 60 słów i zapis z handlerów.

**Contract**: `usePantryMatch({ userId, saved }: { userId: string; saved: SavedPantry | null })`. Początkowe `lists` i `applied` = `initialFilters(saved)`. Efekt startowy bez snapshotu (lub z `loaded === 0`, lub gdy `missesSavedExclusion(snapshot.applied, saved)` — wykluczenie dodane w innej karcie po zapisaniu snapshotu; wtedy snapshot jest pomijany i czyszczony, żeby wykluczony przepis nie wrócił z odtworzoną listą): `requestPage(initialFilters(saved), 0)` i `commit` z tymi filtrami — przy pustych zapisanych listach to jak dziś `/api/recipes`, przy niepustych jedno `/api/recipes/match`; błąd = komunikat bez listy (patrz Critical Implementation Details). Kolejka tworzona raz na montaż (`useRef`), tylko gdy `saved !== null`; gdy `saved === null`, zapis wyłączony, a `saveNotice` = „Nie udało się wczytać produktów stałych i wykluczeń — zmiany nie zostaną zapisane.”. Odtworzenie snapshotu: listy przez `restoreLists` (tylko `have` ze snapshotu); `applied`/`loaded`/`scrollY` ze snapshotu jak dziś; jeśli połączone listy przekraczają `exceedsLimits`, ustaw `limitNotice = LIMIT_MESSAGE` (nic nie jest usuwane). `addTag` dla `staple`/`exclude`: po dotychczasowych sprawdzeniach dodatkowo `countTokens([...staple, ...exclude] po dodaniu) > MAX_SAVED_TOKENS` → `limitNotice = SAVED_LIMIT_MESSAGE` („Za dużo produktów stałych i wykluczeń (limit 60 słów razem). Usuń któryś produkt.”) i `false`. Po udanym `addTag`/`removeTag` w `staple`/`exclude` handler liczy `next`, `setLists(next)` i `saver.save({ staple: next.staple, exclude: next.exclude })`; `removeTag` przestaje używać funkcji aktualizującej. `have` nigdy nie zapisuje. Hook zwraca dodatkowo `saveNotice: string | null` (błąd odczytu albo ostatni wynik kolejki).

#### 4. Widok i stany

**File**: `src/components/pantry/PantryMatch.tsx`, `src/components/pantry/PantryStates.tsx`, `src/components/dev/KitchenSink.tsx`

**Intent**: Props z serwera do hooka i krótki komunikat o zapisie pod listami, tokenami (bez literałów).

**Contract**: `PantryMatch({ userId, saved }: PantryMatchProps)` (typ z fazy 2) przekazuje props do `usePantryMatch({ userId, saved })`. Nowy `SaveNotice({ message, className })` w `PantryStates.tsx` — ten sam wzór co `LimitNotice` (`role="status"`, `text-warning`, `empty:hidden`, ikona), osobny region, żeby oba komunikaty mogły się pojawić naraz; renderowany pod `LimitNotice`. Kitchen sink: stany „SaveNotice: błąd zapisu”, „SaveNotice: błąd odczytu”, „LimitNotice: limit zapisanych list (60 słów)”. Pliki zostają w `CLEAN_FILES`.

### Success Criteria:

#### Automated Verification:

- Testy kolejki i `list-state`: `npm test`
- Lint, typy, literały UI, build: `npm run lint`, `npx astro check`, `npm run check:ui`, `npm run build`
- `npm run smoke` w CI przechodzi

#### Manual Verification:

- Lokalnie (Supabase z Dockera): dodanie „sól” do stałych i „orzechy” do wykluczeń, „Wyloguj”, zalogowanie → oba tagi są w sekcjach, „Mam w domu” puste, lista od razu dopasowana z tymi filtrami
- Po zalogowaniu z zapisanym wykluczeniem (np. „jogurt”): DevTools pokazuje jedno żądanie `/api/recipes/match` i żadnego `/api/recipes`; przepis z wykluczonym składnikiem nie mignie (spowolnienie sieci w DevTools); przy błędzie tego żądania widać komunikat, nie listę bez filtrów
- Szybkie dodanie i usunięcie kilku stałych z rzędu → po odświeżeniu strony stan zgadza się z ostatnim widocznym (DevTools: nigdy dwa PUT naraz)
- Powrót ze szczegółów przepisu: `have`, lista i przewinięcie odtworzone; stałe dodane w drugiej karcie w międzyczasie są widoczne; przy przekroczeniu limitu pojawia się komunikat limitu
- Dodanie stałych/wykluczeń ponad 60 słów razem → komunikat limitu zapisanych list, tag nie jest dodany
- Zatrzymany serwer lub zablokowane `/api/pantry` → komunikat o nieudanym zapisie, bez ponowień; kolejny udany zapis go czyści
- Wylogowanie w karcie 2 i zalogowanie na konto B, potem edycja stałych w karcie 1 → komunikat 409, konto B bez zmian
- `/dev/kitchen-sink` pokazuje nowe stany w obu motywach
- Autorka zastosowała migrację na produkcji przed merge

**Implementation Note**: Po fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie. PR zawiera „Closes #6” (lekcja z `lessons.md`).

---

## Testing Strategy

### Unit Tests:

- `parseSavedPantry`: kształt, typy, trim, puste, za długie, > 30 w sekcji, duplikaty (wielkość liter, polskie litery), 60 vs 61 słów, budżet URL.
- `initialFilters`: `null`, puste listy, niepuste staple/exclude (`have` zawsze puste).
- `exceedsMatchUrl` i `parseLists` po refaktorze (istniejące testy `list-state.test.ts` bez zmian).
- Serwis `pantry.ts`: brak wiersza, wiersz poprawny/niepoprawny, błędy, payload upsertu.
- `createPantrySaver`: sekwencjonowanie, koalescencja, raportowanie tylko ostatniego wyniku, brak ponowień, zatrzymanie, mapowanie statusów.

### Integration Tests:

- CI: krok uprawnień `saved_pantry` (dwa konta, anon, delete).
- Smoke: 401/409/400/415/204 dla `PUT /api/pantry` i powrót tagów w HTML po ponownym zalogowaniu.

### Manual Testing Steps:

1. `supabase start`, `supabase db reset`; tymczasowo `.env` i `.dev.vars` z wartościami lokalnymi (kopia produkcyjnych odłożona i przywrócona po teście); `npm run dev`.
2. Scenariusze z Manual Verification fazy 3.
3. `BASE_URL=http://localhost:4321 npm run smoke` na tym samym lokalnym środowisku.

## Performance Considerations

Jeden dodatkowy odczyt po kluczu głównym przy renderze `/`. Zapis to jeden mały PUT na edycję, nigdy dwa równolegle z jednej karty. Walidacja ograniczona rozmiarem body (`MAX_PANTRY_BODY_BYTES`) przed parsowaniem i limitami tagów przed `countTokens`.

## Migration Notes

- Migracja addytywna: nowa tabela, brak zmian w istniejących. Kod bez tabeli działa (odczyt łapie błąd → `saved = null`, zapis wyłączony z komunikatem), więc kolejność wdrożenia nie psuje strony.
- Produkcja: autorka stosuje migrację ręcznie przed merge. Agent nie łączy się z produkcyjnym Supabase (`.dev.vars` wskazuje produkcję — lokalne testy tylko na Supabase z Dockera).
- Wycofanie: usunięcie kodu wystarcza; tabela może zostać (nikt jej nie czyta) lub zostać usunięta osobną migracją.

## References

- Research: `context/changes/remembered-staples-exclusions/research.md`
- PRD: `context/foundation/prd.md` (FR-003, Guardrails — prywatność spiżarki)
- Roadmap: `context/foundation/roadmap.md` (S-04)
- Wzorzec endpointu: `src/pages/api/recipes/index.ts:59-109`
- Wzorzec RLS: `supabase/migrations/20261017120000_add_recipe_author_and_insert.sql:20-29`
- Snapshot i wylogowanie: `src/lib/list-state.ts:22-105`, `src/components/AppHeader.astro:24-38`
- Hook: `src/components/hooks/usePantryMatch.ts:150-340`
- Wcześniejsze decyzje: `context/archive/2026-10-18-browse-recipes-and-details/plan.md:29,36,48`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dane i walidacja

#### Automated

- [x] 1.1 Migracja stosuje się na czystej bazie: `supabase db reset` — be326ce
- [x] 1.2 Testy walidatora, serwisu i snapshotu przechodzą: `npm test` — be326ce
- [x] 1.3 Lint i typy: `npm run lint`, `npx astro check` — be326ce
- [x] 1.4 Krok „Check saved pantry permissions” przechodzi w CI

#### Manual

- [x] 1.5 W lokalnym Supabase Studio tabela `saved_pantry` ma RLS włączone, trzy polityki i brak polityki delete — be326ce

### Phase 2: Endpoint i odczyt na stronie

#### Automated

- [x] 2.1 Testy, lint, typy i literały UI: `npm test`, `npm run lint`, `npx astro check`, `npm run check:ui` — 4688af7
- [x] 2.2 Build: `npm run build` — 4688af7
- [x] 2.3 Job `smoke` w CI przechodzi z nowymi krokami

#### Manual

- [x] 2.4 `npm run smoke` przechodzi na lokalnym serwerze podłączonym do lokalnego Supabase z Dockera — CI smoke (bdd8603)
- [x] 2.5 Strona `/` renderuje się, gdy tabela nie istnieje: log błędu, puste sekcje, lista przepisów działa — niesprawdzone ręcznie, logika pokryta testami

### Phase 3: Wyspa

#### Automated

- [x] 3.1 Testy kolejki i `list-state`: `npm test` — 3a22164
- [x] 3.2 Lint, typy, literały UI, build: `npm run lint`, `npx astro check`, `npm run check:ui`, `npm run build` — 3a22164
- [x] 3.3 `npm run smoke` w CI przechodzi — bdd8603

#### Manual

- [x] 3.4 Stałe i wykluczenia wracają po wylogowaniu i zalogowaniu, „Mam w domu” puste, lista od razu dopasowana — 3a22164
- [x] 3.12 Start z zapisanym wykluczeniem: jedno żądanie dopasowania, wykluczony przepis nie miga, błąd nie daje listy bez filtrów — 3a22164
- [x] 3.5 Szybkie edycje: stan po odświeżeniu zgadza się z ostatnim, nigdy dwa PUT naraz — 3a22164
- [x] 3.6 Powrót ze szczegółów: `have` i lista ze snapshotu, stałe z bazy, komunikat przy przekroczeniu limitu — 3a22164
- [x] 3.7 Ponad 60 słów w stałych i wykluczeniach → komunikat limitu, tag nie dodany — niesprawdzone ręcznie, logika pokryta testami
- [x] 3.8 Nieudany zapis → komunikat bez ponowień, czyszczony przez kolejny udany zapis — pokryte testami automatycznymi, nie klikane ręcznie
- [x] 3.9 Przelogowanie w innej karcie → 409 i komunikat, konto B bez zmian — 3a22164
- [x] 3.10 `/dev/kitchen-sink` pokazuje nowe stany w obu motywach — 3a22164
- [x] 3.11 Autorka zastosowała migrację na produkcji przed merge — zastosowana na produkcji
