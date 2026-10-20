# S-07 Admin zarządza dowolnym przepisem — Plan Brief

> Full plan: `context/changes/admin-manages-any-recipe/plan.md`
> Research: `context/changes/admin-manages-any-recipe/research.md`

## What & Why

Admin edytuje i usuwa dowolny przepis we wspólnej bazie (FR-010, issue #9), także przepisy z seeda, które dziś nie mają autora i których nikt nie może zmienić. Regułę pilnuje baza (RLS), nie tylko interfejs.

## Starting Point

Po S-06 zapis na `recipes` dopuszczają tylko polityki `recipes_update_own` i `recipes_delete_own` (`author_id = auth.uid()`). Granty update (kolumnowy) i delete już są. Strony `[id].astro` i `[id]/edit.astro` pokazują akcje i formularz tylko autorowi. Nie ma tabeli adminów ani pojęcia roli w aplikacji.

## Desired End State

Użytkownik wpisany do `public.admins` widzi „Edytuj”/„Usuń” przy każdym przepisie i może je wykonać przez istniejące API. Baza go wpuszcza, ale nie pozwala zmienić `author_id` ani `match_keys`. Nie-admin działa jak dziś. Autorka nadaje rolę jednym poleceniem SQL w panelu Supabase.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Sprawdzenie roli w RLS | `private.is_admin()`: `security definer`, `set search_path = ''`, schemat `private` niewystawiony; nowe polityki `recipes_update_admin` i `recipes_delete_admin` obok `_own` | Wzorzec Supabase. Funkcja nie jest wołalna przez `/rpc`, a polityki permisywne łączą się przez OR. | Autorka (z research) |
| Tabela adminów | `public.admins` z RLS: zalogowany widzi tylko swój wiersz; brak insert, update i delete dla `anon` i `authenticated` | Strona może zapytać o własny status, a użytkownik nie może się sam dopisać. | Autorka |
| Nadanie roli | Ręcznie: `insert into public.admins (user_id) select id from auth.users where email = '…'` w panelu | Jeden admin, bez ekranu ról. | Autorka |
| Testowy admin w CI | Signup przez `/auth/v1/signup` i wpis do `admins` kluczem serwisowym; bez `auth.users` w `seed.sql` | Nie zależy od wewnętrznego schematu GoTrue. | Autorka |
| Dane testów admina | Tylko wiersze wstawione w teście, sprzątane przez `trap` | Na końcu zostaje 5 przepisów z seeda, liczonych przez późniejsze kroki. | Autorka |
| Gdzie `isAdmin` | Tylko `[id].astro` i `[id]/edit.astro`, i tylko dla nie-autora; nie w middleware | Bez dodatkowego zapytania na każdym żądaniu. | Autorka |
| Błąd `isAdmin` | Rzuca; strona korzysta z istniejącej ścieżki 500 | Spójne z `getRecipe`. | Plan |
| Smoke | Bez kroku admina; uruchamiany tylko na lokalnym Supabase z Dockera | `.dev.vars` wskazuje produkcję. | Autorka |
| `RecipeAuthorActions` | Nazwa zostaje, poprawiamy tylko komentarze | Kosmetyka nie jest warta zmian w kitchen sink. | Autorka |
| Grant dla `service_role` na `admins` | Jawny (`select, insert, delete`) | Niezależny od domyślnych grantów; potrzebny w CI. | Plan |

## Scope

**In scope:**
- Migracja `20261020120000`: tabela, schemat `private`, funkcja, dwie polityki
- `isAdmin` w `src/lib/services/admins.ts` z testem Vitest
- Warunek „autor albo admin” na dwóch stronach, poprawione komentarze
- Akapit „Dostęp (RLS)” w kontrakcie danych z poleceniem SQL
- Krok CI „Check admin permissions”, PR z „Closes #9”

**Out of scope:**
- Ekran ról, sprawdzanie roli w middleware, admin w `seed.sql`, krok admina w smoke
- Zmiana nazwy `RecipeAuthorActions`, granty na `recipes`, edycja starych migracji
- Styl kart (#21), ryzyko F1 z `match-keys`

## Architecture / Approach

RLS jest granicą bezpieczeństwa. `(select private.is_admin())` czyta `public.admins` z uprawnieniami właściciela, a dwie nowe polityki dodają admina przez OR do `_own`. Istniejące granty kolumnowe i trigger zerujący klucze działają bez zmian. API zostaje bez zmian, bo i tak zwraca 404, gdy RLS nie zostawi wiersza. Strony pytają `public.admins` o własny wiersz tylko po to, żeby pokazać akcje.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migracja i dokumentacja dostępu | Tabela, funkcja, polityki admina; akapit RLS i polecenie SQL | Brak `usage` na `private` lub zły `revoke execute` psuje edycję autora albo wystawia funkcję |
| 2. Strony „autor albo admin” | `isAdmin` z testem, akcje i formularz dla admina, komentarze | Bez migracji na bazie `isAdmin` daje 500 nie-autorom |
| 3. Testy admina w CI | Krok RLS admina w `ci.yml`, smoke lokalny, PR „Closes #9” | Test zostawi wiersz i zepsuje licznik 5 / „updated 5” |

**Prerequisites:** lokalny Supabase w Dockerze (CLI 2.120.0), S-06 zarchiwizowane (jest). Migracja na produkcję i wpis autorki do `admins` przed merge (ręcznie, autorka).
**Estimated effort:** ~1–2 sesje w 3 fazach.

## Open Risks & Assumptions

- Zakładamy, że domyślne uprawnienia `service_role` pozwalają mu omijać RLS na `admins`. Migracja i tak daje jawny grant.
- Kolejność wdrożenia: merge przed migracją na produkcji daje 500 na stronach przepisu dla nie-autorów.

## Success Criteria (Summary)

- Admin edytuje i usuwa każdy przepis, także z seeda, z poziomu UI i API. Nie-admin działa jak w S-06.
- Nikt nie może dopisać się do adminów przez API, a `is_admin` nie jest wystawiona przez `/rpc`. Pilnuje tego krok w CI.
- CI jest zielone, a PR zamyka #9.
