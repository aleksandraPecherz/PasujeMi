# S-04: zapamiętane produkty stałe i wykluczenia — Plan Brief

> Full plan: `context/changes/remembered-staples-exclusions/plan.md`
> Research: `context/changes/remembered-staples-exclusions/research.md`

## What & Why

Po ponownym zalogowaniu użytkownik ma zastać swoje produkty stałe i wykluczenia, a produkty posiadane wpisać od nowa (FR-003, issue #6). Dziś wszystkie trzy listy żyją tylko w karcie (React + snapshot `sessionStorage`) i znikają przy „Wyloguj”.

## Starting Point

`usePantryMatch` startuje z pustych list albo ze snapshotu po powrocie ze szczegółów; `endListState` czyści snapshot przy wylogowaniu (#34). `index.astro` renderuje wyspę bez propsów. Limity dopasowania (`MAX_TAGS`, `MAX_TAG_LENGTH`, `MAX_TOKENS = 100`, budżet URL) są w `src/lib/matching/limits.ts` i `list-state.ts`.

## Desired End State

Stałe i wykluczenia są zapisywane w prywatnej tabeli po każdej edycji i wracają po zalogowaniu, a lista od razu startuje z nimi jako filtrami (bez „Zastosuj filtry”); „Mam w domu” pozostaje sesyjne. Po powrocie ze szczegółów lista i `have` są ze snapshotu, a stałe i wykluczenia z bazy. Zapis z innej sesji jest odrzucany (409), a cudzy wiersz jest niewidoczny i niezmienialny (RLS sprawdzane w CI).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Źródło po powrocie ze szczegółów | `staple`/`exclude` z bazy (props z `index.astro`), `have`/`applied`/`loaded` ze snapshotu | Baza jest źródłem prawdy między kartami; `applied` opisuje pokazaną listę | Research → user |
| Limit zapisanych list | Razem ≤ 60 słów (`countTokens`) + `MAX_TAGS`, `MAX_TAG_LENGTH`, budżet URL; odczyt z bazy walidowany tak samo, niepoprawne = jak błąd odczytu (zapis wyłączony) | Zostaje miejsce na „posiadane”; zapisany stan zawsze da się wysłać | User |
| Ochrona przed cudzym kontem | Body niesie `ownerId` z props; niezgodność z sesją → 409 | Cookie jest wspólne dla kart; przelogowanie w innej karcie nie może zapisać list A na konto B | User |
| Moment i kształt zapisu | Po każdym `addTag`/`removeTag` w staple/exclude, pełna zamiana list, jeden PUT w locie + koalescencja, bez ponawiania, krótki komunikat przy błędzie | Kolejność gwarantuje dopiero zapis „jeden w locie”, nie `abort()` | User + Plan |
| Blokada przed stanem początkowym | Stan z props od pierwszego renderu; zapis tylko z handlerów; odtworzenie ustawia tylko `have` | Montaż i odtwarzanie nie mogą niczego zapisać | User + Plan |
| Start po zalogowaniu | Bez snapshotu i z niepustymi zapisanymi listami: jedno żądanie dopasowania z nimi, `applied` od pierwszego renderu; błąd = komunikat, nigdy lista bez filtrów | Wykluczenia to często alergie — wykluczony przepis nie może pojawić się nawet na chwilę | User |
| Błąd odczytu z bazy | Puste listy, zapis wyłączony, komunikat „zmiany nie zostaną zapisane” | Chwilowa awaria nie może skasować zapisanych list | Plan (pytanie) |
| Powrót ze szczegółów ponad limit | Połącz listy, nic nie usuwaj, pokaż `LimitNotice` | Nic nie znika po cichu | Plan (pytanie) |
| Tabela i RLS | `saved_pantry`: jeden wiersz na użytkownika, `staples`/`exclusions text[]`; select/insert/update tylko właściciel, bez delete | Jeden upsert na zapis; puste listy = puste tablice | User |

## Scope

**In scope:**
- Migracja `20261018130000_create_saved_pantry.sql` z RLS i krok uprawnień w CI
- `src/lib/pantry/{limits,saved,saver}.ts`, `src/lib/services/pantry.ts`, `PUT /api/pantry`
- Odczyt w `index.astro`, props do `PantryMatch`, zmiany w `usePantryMatch`, `SaveNotice` + stany w kitchen sink
- Nowe kroki smoke

**Out of scope:**
- Luka z wygaśnięciem sesji bez „Wyloguj”
- Debounce, ponawianie, zapis przy `pagehide`
- Delete wiersza, zmiany w `GET /api/recipes/match`, synchronizacja na żywo między kartami
- Migracja na produkcji (robi ją autorka ręcznie przed merge)

## Architecture / Approach

`index.astro` → `getSavedPantry` (RLS, nieufna walidacja) → props `{ userId, saved }` → `useState` wyspy. Edycja staple/exclude → `createPantrySaver.save()` → `PUT /api/pantry` (401/415/413/400/409/503/500, 204) → `saveSavedPantry` (upsert). Jeden czysty walidator `parseSavedPantry` służy endpointowi i odczytowi; wyspa używa tych samych stałych. `endListState` zatrzymuje też oczekujący zapis.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dane i walidacja | Tabela z RLS, limity, walidator, serwis, krok CI | Upsert PostgREST wymaga grantu `update` na `user_id` — polityka `with check` musi to pilnować |
| 2. Endpoint i odczyt na stronie | `PUT /api/pantry`, props z `index.astro`, smoke | Odczyt `userId` z HTML w smoke zależy od serializacji propsów Astro |
| 3. Wyspa | Start z bazy i od razu z zapisanymi filtrami, łączenie ze snapshotem, limit 60 słów, kolejka zapisu, komunikaty | Kolejność stanu w StrictMode (zapis nie może siedzieć w updaterze `setLists`) |

**Prerequisites:** lokalny Supabase z Dockera (`supabase start`); `.dev.vars` wskazuje produkcję, więc testy lokalne wymagają tymczasowej podmiany na wartości lokalne.
**Estimated effort:** ~2–3 sesje w 3 fazach.

## Open Risks & Assumptions

- Ostatni zapis wygrywa między kartami; karta ze starszym stanem może nadpisać nowszy przy kolejnej edycji.
- Kod wdrożony przed migracją działa (zapis wyłączony z komunikatem), ale funkcja jest martwa do czasu migracji na produkcji.
- Snapshot `have` po wygaśnięciu sesji nadal może wyciec do kolejnej osoby w tej karcie (znana luka, poza zakresem).

## Success Criteria (Summary)

- Stałe i wykluczenia wracają po wylogowaniu i zalogowaniu, a lista od razu jest dopasowana bez wykluczonych przepisów; „Mam w domu” jest puste.
- Szybkie edycje kończą się stanem zgodnym z ostatnim widocznym; błędy zapisu i odczytu dają krótki komunikat.
- CI potwierdza prywatność wiersza (RLS) i kontrakt endpointu (smoke).
