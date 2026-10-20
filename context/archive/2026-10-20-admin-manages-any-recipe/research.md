---
date: 2026-10-20T14:29:41+02:00
researcher: Claude (Opus 5.5) dla Aleksandry Pęcherz
git_commit: ed98b7c
branch: admin-any-recipe
repository: pasujemi-admin
topic: "S-07 admin-manages-any-recipe: admin edytuje i usuwa dowolny przepis (tabela adminów z RLS, polityki update/delete, warunek isAuthor, testowy admin w seed dla CI)"
tags: [research, recipes, supabase, rls, admin, seed, ci]
status: complete
last_updated: 2026-10-20
last_updated_by: Claude (Opus 5.5)
---

# Research: S-07 admin-manages-any-recipe

**Date**: 2026-10-20T14:29:41+02:00
**Researcher**: Claude (Opus 5.5) dla Aleksandry Pęcherz
**Git Commit**: ed98b7c (badanie na czystym drzewie; zmieniony jest tylko folder tej zmiany)
**Branch**: admin-any-recipe
**Repository**: pasujemi-admin

## Research Question

S-07 z roadmapy (FR-010, issue #9): admin edytuje i usuwa dowolny przepis.

Decyzje autorki (ustalone, nie do ponownej dyskusji):

- rolę admina nadaje się ręcznie w bazie: osobna tabela adminów z RLS, wpis jednym poleceniem SQL w panelu Supabase, bez ekranu do nadawania ról;
- regułę pilnuje baza (polityki RLS na update i delete obok `recipes_update_own` i `recipes_delete_own`), nie tylko interfejs.

Do zbadania: warunek `isAuthor` w `src/pages/recipes/[id].astro` i `src/pages/recipes/[id]/edit.astro` oraz testowy admin w `supabase/seed.sql` dla CI.

Poza zakresem: styl kart (issue #21). Nowa migracja: znacznik `20261020120000`.

## Summary

- **Dziś baza wpuszcza update i delete tylko autorowi.** Polityki `recipes_update_own` (using i with check `author_id = (select auth.uid())`) i `recipes_delete_own` (using to samo) są jedynymi politykami zapisu poza insertem (`supabase/migrations/20261018120000_add_recipe_update_delete_own.sql:18-31`). Granty już są: kolumnowy `update` bez `id`, `created_at`, `author_id`, `match_keys`, `match_keys_version` (`:12-13`) i `delete` (`:15`). **S-07 nie potrzebuje nowych grantów na `recipes`**, tylko dwóch nowych polityk permisywnych. Postgres łączy polityki permisywne przez OR, więc `recipes_update_own` i `recipes_delete_own` zostają bez zmian.
- **Przepisy z `author_id = null` (5 wierszy seed, konta usunięte) są dziś nieedytowalne dla każdego** (porównanie z `null` nie jest prawdą; zapisane w `docs/reference/recipe-data-contract.md:30` jako „zmieni to S-07”). Polityka admina bez warunku na `author_id` je obejmie.
- **Tabela adminów nie istnieje.** W `supabase/`, `src/` i `scripts/` jedyne trafienia „admin” to `supabase.auth.admin.listUsers` w imporcie i zakomentowane `admin_email` w `config.toml` (sprawdzony `grep -i admin` po tych trzech katalogach). Nie ma też schematu `private`; `config.toml:13` wystawia przez PostgREST `public` i `graphql_public`.
- **Wzorzec z dokumentacji Supabase** (Context7, `/websites/supabase`, „Use security definer functions”): funkcja `security definer` z `set search_path = ''` w schemacie niewystawionym (np. `private`), wołana w polityce jako `(select private.is_admin())`. Funkcja `security definer` w schemacie wystawionym jest wołalna przez `/rpc` z uprawnieniami twórcy — dokumentacja zabrania tego wprost.
- **Warunek `isAuthor` jest w dwóch miejscach i porównuje tylko `authorId` z `Astro.locals.user?.id`**: `src/pages/recipes/[id].astro:35` (przyciski Edytuj/Usuń, `:42`) i `src/pages/recipes/[id]/edit.astro:20` (formularz albo 404). Oba mają komentarz „UX only … The boundary is RLS”. Strona nie ma dziś skąd wiedzieć, że użytkownik jest adminem: `App.Locals` ma tylko `user` (`src/env.d.ts`), a middleware nie czyta ról (`src/middleware.ts:10-18`).
- **API nie wymaga zmian logiki.** `PUT`/`DELETE /api/recipes/[id]` nie sprawdzają autorstwa, tylko oddają 404, gdy RLS nie zostawi wiersza (`src/pages/api/recipes/[id].ts:9`, `:38-41`, `:66-68`; `src/lib/services/recipes.ts:145-189`). Po dodaniu polityki admina te same wywołania zadziałają dla admina.
- **Seed nie ma dziś żadnych użytkowników.** `supabase/seed.sql` (139 linii) to 5 insertów do `public.recipes` bez `author_id`. CI tworzy użytkowników w biegu przez `/auth/v1/signup` w każdym kroku RLS (`.github/workflows/ci.yml:59-63`, `:97-101`, `:187-191`). Testowy admin to nowość; są dwie drogi (zob. „Testowy admin dla CI”).

## Detailed Findings

### Stan RLS na `public.recipes`

- F-01: RLS włączone, `revoke all … from anon, authenticated`, `grant select` dla `authenticated`, polityka `recipes_select_authenticated using (true)` (`supabase/migrations/20261012120000_create_recipes.sql:26-37`).
- S-05: `author_id uuid null default auth.uid() references auth.users (id) on delete set null`, kolumnowy `grant insert`, polityka `recipes_insert_own` (`20261017120000_add_recipe_author_and_insert.sql:10-30`). Komentarz `:8` zapowiada S-07.
- S-06: granty `update` (kolumnowy) i `delete`, polityki `recipes_update_own` i `recipes_delete_own`, trigger `recipes_reset_match_keys_on_ingredients` (`20261018120000_add_recipe_update_delete_own.sql:12-56`). Komentarz `:9`: „The admin who may edit and delete any recipe arrives in S-07.”
- **Trigger zadziała także dla admina**: jest `before update … for each row when (old.ingredients is distinct from new.ingredients)` bez warunku na rolę (`:51-56`). Edycja składników przez admina wyzeruje klucze tak samo jak edycja autora.
- **`author_id` po edycji admina zostaje autora**, bo `authenticated` nie ma grantu update na `author_id` (`:12-13`). Polityka admina może więc mieć `with check` na samą rolę, bez warunku na `author_id`.
- **Wniosek (nie zweryfikowany uruchomieniem):** polityki S-07 to `for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))` i `for delete to authenticated using ((select private.is_admin()))`. Dla nie-admina funkcja zwraca `false`, więc zostaje dotychczasowe zachowanie (`_own` przez OR).

### Tabela adminów — co wynika z kodu i dokumentacji

Decyzja autorki: osobna tabela z RLS, wpis ręczny SQL-em. Fakty, które ograniczają kształt:

- **Konwencja tabel prywatnych** z S-04: `user_id uuid primary key … references auth.users (id) on delete cascade`, `enable row level security`, `revoke all … from anon, authenticated`, potem tylko potrzebne granty i polityki per operacja (`20261018130000_create_saved_pantry.sql:11-46`). AGENTS.md (Hard Rules) wymaga polityk per operacja i per rola.
- **Ryzyko eskalacji**: `authenticated` nie może dostać grantu `insert`/`update`/`delete` na tabelę adminów — inaczej użytkownik dopisze się sam. Wpis z panelu Supabase (SQL Editor) idzie jako `postgres`, który omija RLS, więc granty dla `authenticated` nie są do tego potrzebne. _(Wniosek z dokumentacji: właściciel `postgres` ma `bypassrls`.)_
- **Odczyt własnego statusu przez stronę**: strona Astro używa klienta z kluczem anon i sesją użytkownika (`src/lib/supabase.ts`, `createClient(Astro.request.headers, Astro.cookies)`), przez PostgREST. Funkcja w `private` nie jest wołalna przez `/rpc` (schemat niewystawiony, `config.toml:13`). Żeby strona mogła zapytać „czy jestem adminem”, potrzebna jest jedna z dróg:
  - (a) tabela w `public` z `grant select` i polityką `select … using (user_id = (select auth.uid()))` — użytkownik widzi tylko swój wiersz albo nic; zapytanie `from("admins").select("user_id").eq("user_id", uid).maybeSingle()`;
  - (b) tabela w `private`, a w `public` funkcja `security invoker` opakowująca odczyt — dokłada drugi obiekt i i tak wymaga uprawnień dla `authenticated`.
    Droga (a) jest prostsza i zgodna z wzorcem S-04. Polityka na `recipes` może wtedy nawet obejść się bez funkcji (`exists (select 1 from public.admins where user_id = (select auth.uid()))` działa, bo polityka select na adminach pokazuje własny wiersz i nie czyta `recipes`, więc nie ma rekurencji). Dokumentacja Supabase poleca jednak funkcję `security definer` dla wydajności i niezależności od polityki adminów. Wybór dla planu.
- **Funkcja `security definer`** (jeśli plan ją wybierze): w `private`, `set search_path = ''`, nazwy kwalifikowane schematem, `revoke execute … from public`, `grant usage on schema private to authenticated`, `grant execute … to authenticated` (Context7, „Break recursive policies with security definer function”). Repo ma już funkcję z `set search_path = ''` (`20261018120000_…sql:37-48`), ale bez `security definer`.
- **Polecenie dla autorki do panelu** (do zapisania w planie/dokumentacji): `insert into public.admins (user_id) select id from auth.users where email = '<e-mail>';` — jedno polecenie, bez kopiowania UUID. _(Propozycja, nie sprawdzona w panelu.)_

### Warunek `isAuthor` w stronach

- `src/pages/recipes/[id].astro:20-22` — `getRecipe` zwraca `{ recipe, authorId }`; `:34-35` — `const isAuthor = authorId !== null && authorId === Astro.locals.user?.id;`; `:42` — `{isAuthor && <RecipeAuthorActions … />}`.
- `src/pages/recipes/[id]/edit.astro:18-21` — formularz dostaje przepis tylko, gdy `found.authorId === Astro.locals.user?.id`; w przeciwnym razie strona zwraca 404 (`:32-34`) i pokazuje „Nie znaleziono przepisu”.
- **Do S-07 oba warunki muszą stać się „autor albo admin”.** Najmniej inwazyjnie: jedna funkcja serwisowa (np. `isAdmin(supabase)` w `src/lib/services/`) wołana tylko na tych dwóch stronach, a nie w middleware — middleware działa na każdym żądaniu (`src/middleware.ts:7-18`), więc dodatkowe zapytanie trafiałoby też do `/api/recipes/match` i listy. _(Rekomendacja; plan może wybrać inaczej.)_
- **Komentarze do aktualizacji**: `[id].astro:34`, `edit.astro:19` („the form is shown to the author”), `src/pages/api/recipes/[id].ts:9` („Someone else's recipe and a missing one are indistinguishable” — dalej prawdziwe dla nie-admina), JSDoc `updateRecipe` (`src/lib/services/recipes.ts:145-149`: „not the author, or no such recipe”).
- **Komponent `RecipeAuthorActions`** nie zależy od roli: dostaje `recipeId` i `recipeName` (`src/components/recipes/RecipeAuthorActions.tsx:98-110`). Po zapisie edycji hook przekierowuje na `/recipes/<id>` (`src/components/hooks/useRecipeForm.ts:345-348`), po usunięciu na `/` (`src/components/hooks/useDeleteRecipe.ts:36`) — dla admina tak samo. Nazwa „Author” w komponencie zostaje nieścisła; zmiana nazwy jest opcjonalna (dotyka też `src/components/dev/KitchenSink.tsx`).
- **Typ `Recipe` nie ma `authorId`** (S-06 trzymało go poza `Recipe`, `getRecipe` zwraca go obok, `recipes.ts:86-109`). S-07 nie musi tego zmieniać.

### Testowy admin dla CI

Stan:

- `supabase/seed.sql:1-3` — „Loaded only by `supabase start` / `db reset` (local and CI); never pushed to production.” Zawiera 5 insertów do `public.recipes` (`:6`, `:37`, `:58`, `:83`, `:111`), żadnego wiersza w `auth.users`.
- `config.toml:60-65` — seed włączony, `sql_paths = ["./seed.sql"]`; `config.toml:209` — `enable_confirmations = false` (rejestracja bez potwierdzenia e-mail).
- CI pinuje Supabase CLI `2.120.0` (`ci.yml:37-39`) i liczy wiersze: po krokach RLS musi zostać dokładnie 5 przepisów (`ci.yml:51`, `:94`, `:184`), a `match-keys` musi zwrócić „updated 5”, potem „updated 0” (`:259`, `:262`).
- `scripts/smoke.mjs` rejestruje świeżego użytkownika (`:125-126`) i testuje edycję/usunięcie jego przepisu (`:63-75`); nie ma kroku admina.

Dwie drogi (wybór dla planu; autorka wskazała seed):

1. **Admin w `seed.sql`**: insert do `auth.users` (stały UUID, e-mail, `crypt('<hasło>', gen_salt('bf'))`, `email_confirmed_at`, `aud`/`role = 'authenticated'`) i `auth.identities`, potem do `public.admins`. Plus: działa też lokalnie po `db reset`, smoke może się zalogować przez `/api/auth/signin`. Minus: zależy od wewnętrznego schematu GoTrue. **Luka:** dokumentacja z Context7 nie podaje szablonu insertu do `auth.users`; z doświadczenia (niezweryfikowane tutaj) GoTrue wymaga pustych stringów zamiast `null` w kolumnach tokenów (`confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`), inaczej logowanie kończy się błędem. Trzeba sprawdzić lokalnie (`supabase db reset` + logowanie) przed CI.
2. **Admin tworzony w kroku CI**: `signup`, potem insert do `public.admins` przez service role. Service role omija RLS, ale potrzebuje grantu na tabelę; migracje S-04/F-01 odbierają uprawnienia tylko `anon` i `authenticated` (`20261018130000_…sql:21`, `20261012120000_…sql:29`), więc domyślne granty Supabase dla `service_role` w `public` powinny zostać. _(Wniosek, nie zweryfikowany.)_ Nie wymaga znajomości schematu `auth`, ale nie daje lokalnego admina.

Przypadki do dopisania w kroku „Check recipe update and delete permissions” (`ci.yml:95-184`), z zachowaniem lekcji „Assert status and body type before content”:

- admin zmienia nazwę i składniki przepisu A → 200, 1 wiersz, `author_id` dalej A, klucze wyzerowane przy zmianie składników;
- admin edytuje i usuwa przepis z `author_id = null` — wiersz wstawiony przez service role (nie seedowany, żeby nie zmienić liczby 5);
- admin nie może zmienić `author_id` ani `match_keys` → 403/42501 (granty kolumnowe);
- A (nie-admin) nie może dopisać się do tabeli adminów → 401/403 + 42501; nie widzi cudzych wierszy adminów (pusta tablica);
- B dalej nie edytuje ani nie usuwa cudzego przepisu (obecne przypadki `ci.yml:155-161` zostają).

## Code References

- `supabase/migrations/20261018120000_add_recipe_update_delete_own.sql:12-31` — granty update/delete i polityki `_own`, obok których wchodzą polityki admina
- `supabase/migrations/20261018120000_add_recipe_update_delete_own.sql:37-56` — trigger zerujący klucze (działa dla każdej roli)
- `supabase/migrations/20261018130000_create_saved_pantry.sql:11-46` — wzorzec tabeli prywatnej z RLS per operacja
- `src/pages/recipes/[id].astro:34-42` — `isAuthor` i przyciski
- `src/pages/recipes/[id]/edit.astro:18-21` — warunek autora przy formularzu
- `src/pages/api/recipes/[id].ts:9-87` — `PUT`/`DELETE`, 404 gdy RLS nie zostawi wiersza
- `src/lib/services/recipes.ts:86-109` — `getRecipe` z `authorId`
- `src/lib/services/recipes.ts:145-189` — `updateRecipe`/`deleteRecipe`, JSDoc do aktualizacji
- `src/middleware.ts:7-18` — `locals.user`, brak ról
- `supabase/seed.sql:1-6` — seed bez użytkowników
- `supabase/config.toml:13`, `:60-65`, `:209` — wystawione schematy, seed, brak potwierdzeń e-mail
- `.github/workflows/ci.yml:95-184` — krok RLS update/delete do rozszerzenia
- `docs/reference/recipe-data-contract.md:30` — akapit „Dostęp (RLS)” do aktualizacji

## Architecture Insights

- Granica bezpieczeństwa to RLS; strony i API tylko odzwierciedlają wynik (komentarze „UX only” w obu stronach, 404 w API). S-07 zachowuje ten podział: zmiana uprawnień = migracja, a strony tylko pokazują przyciski/formularz.
- Każdy krok roadmapy dokłada addytywną migrację i nie edytuje starszych (komentarze-zapowiedzi w `20261012120000:3`, `20261017120000:8`, `20261018120000:9`). Nowa migracja: `supabase/migrations/20261020120000_<opis>.sql`.
- Testy RLS żyją w CI jako `curl` + `jq` z asercją statusu i typu ciała przed treścią (`context/foundation/lessons.md`, „Assert status and body type before content in HTTP checks”). Repo nie używa `supabase/tests/` (pgTAP) — katalog nie istnieje.

## Historical Context (from prior changes)

- `context/archive/2026-10-18-author-edits-own-recipe/plan.md:35` — „Przepisy z `author_id = null` (seed, usunięte konta) zostają nieedytowalne do S-07.” **Aktualne** (stan do zmiany w S-07).
- `context/archive/2026-10-18-author-edits-own-recipe/research.md:49` — polityka `author_id = auth.uid()` nie przepuszcza `null`. **Aktualne.**
- `context/archive/2026-10-18-author-edits-own-recipe/plan-brief.md:44` — `authorId` poza `Recipe`. **Aktualne** (`recipes.ts:86-109`).
- `context/archive/2026-10-18-author-edits-own-recipe/follow-ups/review-fixes.md` — F1: `scripts/match-keys.ts` może zostawić nieaktualne klucze przy równoległej edycji. Edycje admina dokładają drugiego piszącego, ale ryzyko jest to samo i jest już zapisane; poza zakresem S-07.
- `context/foundation/roadmap.md:191` — niewiadoma „Jak nadawana jest rola admina” — **rozstrzygnięta** przez autorkę (ręcznie, tabela, SQL w panelu); do odhaczenia w roadmapie przy zamknięciu.

## Related Research

- `context/archive/2026-10-18-author-edits-own-recipe/research.md` — RLS update/delete autora, klucze dopasowania
- `context/archive/2026-10-18-remembered-staples-exclusions/` — wzorzec tabeli prywatnej z RLS

## Open Questions

1. **Kształt sprawdzenia roli w polityce**: funkcja `private.is_admin()` (`security definer`, zalecana przez Supabase) czy `exists` wprost na `public.admins`. Oba spełniają decyzję autorki; to wybór dla planu.
2. **Testowy admin**: insert do `auth.users` w `seed.sql` (wymaga sprawdzenia lokalnie z CLI 2.120.0, zob. luka wyżej) czy tworzenie admina w kroku CI przez signup + service role.
3. **Czy smoke (`scripts/smoke.mjs`) ma mieć krok admina** (np. admin widzi „Edytuj” przy seedowanym przepisie). Wymaga stałych danych logowania admina, więc zależy od pkt 2.
4. **Nazwa `RecipeAuthorActions`** — zostawić czy zmienić (np. `RecipeManageActions`). Kosmetyka; dotyka kitchen sink.
5. Przy PR: „Closes #9” (lekcja „Close roadmap issues explicitly”).
