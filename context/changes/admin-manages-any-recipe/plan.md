# S-07 Admin zarządza dowolnym przepisem — plan implementacji

## Overview

Admin (FR-010, issue #9) edytuje i usuwa dowolny przepis we wspólnej bazie, także przepisy bez autora (seed). Regułę pilnuje baza: tabela `public.admins`, funkcja `private.is_admin()` i dwie nowe polityki RLS na `public.recipes`. Strony szczegółów i edycji pokazują przyciski i formularz autorowi albo adminowi. Rolę nadaje autorka ręcznie jednym poleceniem SQL w panelu Supabase.

## Current State Analysis

- Zapis na `recipes` mają tylko polityki `recipes_update_own` i `recipes_delete_own` (`author_id = auth.uid()`) z S-06 (`supabase/migrations/20261018120000_add_recipe_update_delete_own.sql:18-31`). Granty kolumnowy `update` i `delete` dla `authenticated` już są (`:12-15`).
- Przepisy z `author_id = null` (5 wierszy seed) nie są dziś edytowalne dla nikogo (`docs/reference/recipe-data-contract.md:30`).
- Nie ma tabeli adminów ani schematu `private`. PostgREST wystawia `public` i `graphql_public` (`supabase/config.toml:13`).
- Warunek autora jest w dwóch miejscach: `src/pages/recipes/[id].astro:34-35` i `src/pages/recipes/[id]/edit.astro:18-21`. `App.Locals` ma tylko `user`, a middleware nie czyta ról.
- API `PUT`/`DELETE /api/recipes/[id]` nie sprawdza autorstwa. Gdy RLS nie zostawi wiersza, zwraca 404 (`src/pages/api/recipes/[id].ts`, `src/lib/services/recipes.ts:145-189`).
- CI liczy przepisy po każdym kroku RLS: po kroku musi zostać 5 wierszy, a `match-keys` musi zwrócić „updated 5” (`.github/workflows/ci.yml:51`, `:94`, `:184`, `:259`).

## Desired End State

- Użytkownik z wierszem w `public.admins` może przez `PATCH`/`DELETE` na PostgREST oraz przez `PUT`/`DELETE /api/recipes/[id]` zmienić i usunąć każdy przepis, także taki z `author_id = null`. `author_id` po edycji admina się nie zmienia. Zmiana składników zeruje klucze (istniejący trigger).
- Admin nie może zmienić `author_id`, `match_keys` ani `id`, bo istniejące granty kolumnowe nadal obowiązują.
- Nie-admin zachowuje się dokładnie jak dziś.
- `authenticated` widzi w `public.admins` tylko swój wiersz i nie może do tabeli wstawiać, zmieniać ani z niej usuwać. `anon` nie ma żadnych uprawnień.
- `private.is_admin()` nie jest wołalna przez `/rest/v1/rpc`.
- Na `/recipes/<id>` admin widzi „Edytuj” i „Usuń” przy każdym przepisie, a `/recipes/<id>/edit` pokazuje mu formularz.
- Nowy krok CI sprawdza powyższe na wierszach wstawionych w teście, a na końcu w bazie zostaje 5 przepisów z seeda.

Weryfikacja: `npm test`, `npm run lint`, `npx astro check`, CI na PR, ręczny test na lokalnym Supabase z Dockera.

### Key Discoveries:

- Polityki permisywne łączą się przez OR, więc polityki `_own` zostają bez zmian (`20261018120000_…sql:18-31`).
- `authenticated` nie ma grantu update na `author_id`, więc `with check` polityki admina może sprawdzać samą rolę.
- Wzorzec tabeli prywatnej: `revoke all … from anon, authenticated`, potem jawne granty i polityki per operacja (`supabase/migrations/20261018130000_create_saved_pantry.sql:11-46`).
- Wzorzec Supabase („Use security definer functions”): funkcja `security definer` z `set search_path = ''` w schemacie niewystawionym, wołana w polityce jako `(select private.is_admin())`.
- Wzorzec testu serwisu z fałszywym klientem PostgREST: `src/lib/services/pantry.test.ts`.
- Lekcja „Assert status and body type before content in HTTP checks” obowiązuje w nowym kroku CI.

## What We're NOT Doing

- Ekran nadawania ról, endpoint API dla adminów ani wpis admina w aplikacji. Wpis robi autorka SQL-em w panelu.
- Sprawdzanie roli w middleware ani pole roli w `App.Locals`. `isAdmin` wołają tylko dwie strony.
- Wpisy do `auth.users` w `supabase/seed.sql`. Seed zostaje bez zmian.
- Krok admina w `scripts/smoke.mjs`.
- Zmiana nazwy `RecipeAuthorActions`. Poprawiamy tylko komentarze.
- Zmiany grantów na `public.recipes` i zmiany w istniejących migracjach.
- Styl kart (issue #21) oraz ryzyko F1 z `match-keys` przy równoległej edycji (już zapisane w archiwum S-06).
- Uruchamianie smoke ani migracji na produkcji przez agenta. `.dev.vars` wskazuje produkcję, więc smoke idzie tylko na lokalny Supabase z Dockera. Migrację na produkcję autorka puszcza ręcznie przed merge.

## Implementation Approach

Najpierw baza, bo jest granicą bezpieczeństwa: addytywna migracja `20261020120000` sprawdzona lokalnie przez `supabase db reset`. Potem strony, które tylko odzwierciedlają wynik RLS. Na końcu krok CI, który sprawdza całość na prawdziwym PostgREST.

## Critical Implementation Details

- **Kolejność w migracji:** `private.is_admin()` czyta `public.admins`, więc tabela musi powstać przed funkcją, a funkcja przed politykami na `recipes`. Funkcja `security definer` należy do `postgres` i omija RLS na `admins`, więc nie ma rekurencji polityk.
- **Uprawnienia funkcji:** Postgres domyślnie daje `execute` roli `PUBLIC`, więc migracja musi zrobić `revoke execute … from public` przed `grant execute … to authenticated`. Bez `grant usage on schema private to authenticated` polityka zwróci błąd uprawnień dla każdego zalogowanego, także nie-admina, i zepsuje edycję autora.
- **Produkcja:** migracja musi trafić na produkcję przed merge, bo nowy kod stron odpytuje `public.admins`. Bez tabeli `isAdmin` rzuci błąd i strona zwróci 500 każdemu, kto nie jest autorem.

## Faza 1: Migracja i dokumentacja dostępu

### Overview

Baza zna rolę admina i wpuszcza go do update i delete każdego przepisu. Dokumentacja opisuje nową regułę i polecenie SQL do nadania roli.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/20261020120000_add_admin_manages_any_recipe.sql`

**Intent**: Dodać tabelę adminów, funkcję sprawdzającą rolę i dwie polityki admina na `recipes`. Nagłówek w stylu poprzednich migracji (S-07, link do planu, „Additive”), z komentarzem, że wpis robi się ręcznie poleceniem SQL z `docs/reference/recipe-data-contract.md`.

**Contract**:
- `public.admins (user_id uuid primary key references auth.users (id) on delete cascade, created_at timestamptz not null default now())`. RLS włączone, `revoke all … from anon, authenticated`, `grant select … to authenticated`, `grant select, insert, delete … to service_role` (jawnie, niezależnie od domyślnych grantów; CI wpisuje admina kluczem serwisowym). Jedna polityka `admins_select_own` `for select to authenticated using (user_id = (select auth.uid()))`. Bez polityk i grantów insert, update i delete dla `anon` i `authenticated`.
- `create schema private` (nie dodawać do `config.toml` `schemas`). `revoke all on schema private from public`, `grant usage on schema private to authenticated`.
- `private.is_admin() returns boolean language sql stable security definer set search_path = ''`: zwraca `exists` wiersza w `public.admins` z `user_id = (select auth.uid())`, z nazwami kwalifikowanymi schematem. `revoke execute … from public`, `grant execute … to authenticated`.
- `recipes_update_admin`: `for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))`.
- `recipes_delete_admin`: `for delete to authenticated using ((select private.is_admin()))`.

#### 2. Kontrakt danych

**File**: `docs/reference/recipe-data-contract.md`

**Intent**: Zaktualizować akapit „Dostęp (RLS)”: update i delete może autor albo admin (wiersz w `public.admins`), także przepisy z `author_id = null`. Dodać polecenie nadania roli dla panelu Supabase (SQL Editor) i polecenie odebrania roli.

**Contract**: akapit „Dostęp (RLS)” (`:30`). Polecenie nadania: `insert into public.admins (user_id) select id from auth.users where email = '<e-mail>';`. Odebranie: analogiczne `delete`.

### Success Criteria:

#### Automated Verification:

- Migracja wchodzi na czystą bazę lokalną: `supabase db reset` bez błędów
- Linting przechodzi: `npm run lint`

#### Manual Verification:

- `private.is_admin()` działa w SQL i nie jest wołalna przez `/rest/v1/rpc`: w psql albo Studio jako `postgres` zwraca `false`, a `POST /rest/v1/rpc/is_admin` z tokenem użytkownika nie znajduje funkcji (404 albo PGRST202)

**Implementation Note**: Po fazie i automatycznej weryfikacji zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Faza 2: Strony „autor albo admin”

### Overview

Strona szczegółów pokazuje adminowi przyciski „Edytuj”/„Usuń”, a strona edycji pokazuje mu formularz. Komentarze opisują nową regułę.

### Changes Required:

#### 1. Serwis roli

**File**: `src/lib/services/admins.ts`

**Intent**: Jedna funkcja odpowiadająca na pytanie, czy zalogowany użytkownik jest adminem, przez odczyt własnego wiersza w `public.admins` (RLS pokazuje tylko własny wiersz). JSDoc: wynik służy tylko UX, granicą jest RLS.

**Contract**: `isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean>`. Zapytanie `from("admins").select("user_id").eq("user_id", userId).maybeSingle()`. `true`, gdy wiersz jest, `false`, gdy `null`. Błąd PostgREST jest rzucany, tak jak w `getRecipe`.

#### 2. Test serwisu

**File**: `src/lib/services/admins.test.ts`

**Intent**: Pokryć trzy wyniki: wiersz → `true`, brak wiersza → `false`, błąd → rzuca ten sam obiekt. Sprawdzić też, że zapytanie idzie do tabeli `admins` z `eq("user_id", userId)`.

**Contract**: fałszywy klient na wzór `fakeClient` z `src/lib/services/pantry.test.ts`.

#### 3. Strona szczegółów

**File**: `src/pages/recipes/[id].astro`

**Intent**: Pokazać `RecipeAuthorActions` autorowi albo adminowi. `isAdmin` wołać tylko wtedy, gdy przepis istnieje, użytkownik jest zalogowany i nie jest autorem, w tym samym `try` co `getRecipe` (błąd → istniejąca ścieżka 500).

**Contract**: zmienna `canManage` (zamiast `isAuthor`) = autor albo admin. Komentarz „UX only … The boundary is RLS” obejmuje admina.

#### 4. Strona edycji

**File**: `src/pages/recipes/[id]/edit.astro`

**Intent**: Formularz dla autora albo admina. Pozostali dostają 404 jak dziś. `isAdmin` wołać tylko, gdy przepis istnieje, a użytkownik nie jest autorem.

**Contract**: warunek przy `recipe = found.recipe`. Komentarz „the form is shown to the author or an admin”.

#### 5. Komentarze

**Files**: `src/pages/api/recipes/[id].ts:9`, `src/lib/services/recipes.ts:145-149`, `src/components/recipes/RecipeAuthorActions.tsx`

**Intent**: API: dla kogoś, kto nie jest ani autorem, ani adminem, cudzy przepis i brakujący są nie do odróżnienia. JSDoc `updateRecipe`: „not the author nor an admin, or no such recipe”. `RecipeAuthorActions`: krótki JSDoc przy domyślnym eksporcie, że komponent jest pokazywany autorowi albo adminowi, a nazwa została z S-06. Nazwy się nie zmieniają.

**Contract**: tylko komentarze, bez zmian w kodzie.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Linting przechodzi: `npm run lint`
- Kontrola typów przechodzi: `npx astro check`
- Kontrola literałów UI przechodzi: `npm run check:ui`

#### Manual Verification:

- Na lokalnym Supabase (`supabase start`, `.env` i `.dev.vars` tymczasowo na lokalny `API_URL`/`ANON_KEY`) użytkownik dopisany do `public.admins` widzi „Edytuj”/„Usuń” przy przepisie z seeda, zapisuje edycję i usuwa przepis
- Zwykły użytkownik nie widzi przycisków przy przepisie z seeda, a `/recipes/<id>/edit` cudzego przepisu daje 404
- Autor nadal edytuje i usuwa własny przepis

**Implementation Note**: Po fazie i automatycznej weryfikacji zatrzymaj się na ręczne potwierdzenie przed fazą 3. Po teście przywróć `.env`/`.dev.vars` i nie commituj ich (są w gitignore).

---

## Faza 3: Testy admina w CI

### Overview

Nowy krok CI sprawdza reguły admina na prawdziwym PostgREST, a potem przygotowujemy PR.

### Changes Required:

#### 1. Krok „Check admin permissions”

**File**: `.github/workflows/ci.yml`

**Intent**: Nowy krok w jobie `smoke`, po „Check recipe update and delete permissions” i przed „Check saved pantry permissions”. Używa tych samych pomocników `signup`/`call`/`expect_rows`/`expect_denied` (status, potem typ ciała, potem treść). Rejestruje użytkowników A (autor), B (nie-admin) i M (admin). Wpisuje M do `public.admins` kluczem serwisowym (`POST /rest/v1/admins`). Pracuje tylko na wierszach wstawionych w teście: przepis A wstawiony przez A i przepis bez autora wstawiony kluczem serwisowym (`author_id: null`). `trap` usuwa kluczem serwisowym na każdym wyjściu oba wiersze przepisów i wiersz M w `public.admins` (`admins?user_id=eq.$id_m`).

**Contract**: przypadki, które krok musi pokryć:
- M zmienia nazwę przepisu A → 200, 1 wiersz. Kluczem serwisowym: `author_id` dalej A.
- Klucz serwisowy ustawia klucze, M zmienia składniki przepisu A → `match_keys` i `match_keys_version` są `null`.
- M zmienia `author_id` lub `match_keys` przepisu A → 403 + `42501`.
- M edytuje przepis bez autora → 200, 1 wiersz. `author_id` dalej `null`.
- B zmienia i usuwa przepis bez autora → 200, 0 wierszy (filtr RLS). Wiersz bez zmian.
- B dopisuje się do `public.admins` → 401/403 + `42501`. B zmienia lub usuwa wiersz M → 403 + `42501` (brak grantów update i delete). Wiersz M dalej jest (sprawdzenie kluczem serwisowym).
- B czyta `admins` → 200, pusta tablica. M czyta `admins` → 200, dokładnie jego wiersz.
- anon czyta `admins` → 401/403 + `42501`.
- `POST /rest/v1/rpc/is_admin` z tokenem M → 404 + `type == "object" and .code == "PGRST202"` (funkcja niewystawiona).
- M usuwa przepis A i przepis bez autora → 200, po 1 wierszu.
- Na końcu kluczem serwisowym: `recipes` ma dokładnie 5 wierszy (`type == "array" and length == 5`).

#### 2. Smoke lokalny i PR

**Intent**: Uruchomić smoke na lokalnym Supabase z Dockera (nigdy na `.dev.vars` z produkcją), wypchnąć gałąź i otworzyć PR do `master` z „Closes #9” w opisie. Opis PR wspomina, że migrację `20261020120000` autorka puszcza ręcznie na produkcję przed merge.

**Contract**: opis PR zawiera dosłownie `Closes #9`.

### Success Criteria:

#### Automated Verification:

- Linting przechodzi: `npm run lint`
- Job `smoke` w CI przechodzi na PR, łącznie z krokiem „Check admin permissions” i `match-keys` „updated 5”
- Job `ci` w CI przechodzi na PR

#### Manual Verification:

- `npm run smoke` przechodzi na lokalnym Supabase z Dockera (`BASE_URL` na lokalny serwer z lokalnymi kluczami)
- Opis PR zawiera „Closes #9”
- Autorka zastosowała migrację `20261020120000` na produkcji i wpisała siebie do `public.admins` przed merge

---

## Testing Strategy

### Unit Tests:

- `isAdmin`: wiersz → `true`, brak → `false`, błąd → rzuca. Zapytanie do `admins` z `eq("user_id", …)`.

### Integration Tests:

- Krok CI „Check admin permissions” (faza 3) na lokalnym Supabase w CI. Istniejące kroki RLS dla nie-admina zostają bez zmian i pilnują regresji.

### Manual Testing Steps:

1. Lokalnie: `supabase db reset`, rejestracja dwóch kont, dopisanie jednego do `public.admins` w psql/Studio.
2. Admin: przycisk „Edytuj” przy przepisie z seeda → zapis → szczegóły pokazują zmianę. „Usuń” → przekierowanie na `/`.
3. Zwykły użytkownik: brak przycisków przy przepisie z seeda, 404 na `/recipes/<id>/edit`.
4. Autor: edycja i usuwanie własnego przepisu działają jak w S-06.

## Performance Considerations

`isAdmin` to jedno zapytanie po kluczu głównym, tylko na dwóch stronach i tylko dla nie-autora. `(select private.is_admin())` w politykach jest liczone raz na zapytanie (initPlan), nie na wiersz.

## Migration Notes

Migracja jest addytywna: stary kod działa na nowej bazie. Nowy kod stron wymaga tabeli `public.admins`, więc kolejność na produkcji jest taka: autorka stosuje migrację ręcznie, wpisuje siebie do `public.admins`, potem merge. Wycofanie: `drop policy recipes_update_admin`, `drop policy recipes_delete_admin`, `drop function private.is_admin()`, `drop schema private`, `drop table public.admins`.

## References

- Research: `context/changes/admin-manages-any-recipe/research.md`
- Polityki autora: `supabase/migrations/20261018120000_add_recipe_update_delete_own.sql:12-56`
- Wzorzec tabeli prywatnej: `supabase/migrations/20261018130000_create_saved_pantry.sql:11-46`
- Strony: `src/pages/recipes/[id].astro:34-42`, `src/pages/recipes/[id]/edit.astro:18-21`
- Krok CI do naśladowania: `.github/workflows/ci.yml:95-184`
- Poprzednia zmiana: `context/archive/2026-10-18-author-edits-own-recipe/plan.md`
- Lekcje: `context/foundation/lessons.md` („Closes #N”, „Assert status and body type”)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migracja i dokumentacja dostępu

#### Automated

- [x] 1.1 Migracja wchodzi na czystą bazę lokalną: `supabase db reset` bez błędów — 26dc513
- [x] 1.2 Linting przechodzi: `npm run lint` — 26dc513

#### Manual

- [x] 1.3 `private.is_admin()` działa w SQL i nie jest wołalna przez `/rest/v1/rpc` — 26dc513

### Phase 2: Strony „autor albo admin”

#### Automated

- [x] 2.1 Testy jednostkowe przechodzą: `npm test` — 7dcd938
- [x] 2.2 Linting przechodzi: `npm run lint` — 7dcd938
- [x] 2.3 Kontrola typów przechodzi: `npx astro check` — 7dcd938
- [x] 2.4 Kontrola literałów UI przechodzi: `npm run check:ui` — 7dcd938

#### Manual

- [ ] 2.5 Admin na lokalnym Supabase edytuje i usuwa przepis z seeda
- [ ] 2.6 Zwykły użytkownik nie widzi przycisków, edycja cudzego przepisu daje 404
- [ ] 2.7 Autor nadal edytuje i usuwa własny przepis

### Phase 3: Testy admina w CI

#### Automated

- [x] 3.1 Linting przechodzi: `npm run lint` — 5b56401
- [x] 3.2 Job `smoke` w CI przechodzi na PR, łącznie z krokiem „Check admin permissions” — 5b56401
- [x] 3.3 Job `ci` w CI przechodzi na PR — 5b56401

#### Manual

- [ ] 3.4 `npm run smoke` przechodzi na lokalnym Supabase z Dockera
- [ ] 3.5 Opis PR zawiera „Closes #9”
- [ ] 3.6 Migracja `20261020120000` na produkcji i wpis autorki do `public.admins` przed merge
