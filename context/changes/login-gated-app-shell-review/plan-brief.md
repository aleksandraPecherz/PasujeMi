# Logowanie jako brama do aplikacji (S-01) — Plan Brief

> Full plan: `context/changes/login-gated-app-shell/plan.md`

## What & Why

PRD wymaga, żeby niezalogowana osoba widziała wyłącznie logowanie/rejestrację, a każda inna ścieżka przekierowywała do logowania (FR-001, Access Control). Dziś chronione jest tylko `/dashboard`, a `/` to ekran startera — domykamy bramę i dajemy kolejnym slice'om (S-02, S-03) miejsce w aplikacji.

## Starting Point

Rejestracja, logowanie i wylogowanie e-mailem działają, ale middleware chroni tylko listę ścieżek (`PROTECTED_ROUTES = ["/dashboard"]`), ekrany auth są po angielsku, a `/` pokazuje powitanie startera.

## Desired End State

Niezalogowany trafia na polski ekran logowania z każdej ścieżki (API dostaje 401). Po zalogowaniu `/` pokazuje powłokę PasujeMi: nagłówek z e-mailem i „Wyloguj” oraz zachętę „Wypełnij spiżarkę, żeby zobaczyć dopasowanie” — na telefonie i desktopie. Pliki startera są usunięte, smoke test sprawdza bramę.

## Key Decisions Made

| Decision                     | Choice                                                                 | Why (1 sentence)                                                 |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Model dostępu                | Lista publicznych prefiksów (`/auth/`, `/api/auth/`), reszta chroniona | Nowe trasy z kolejnych slice'ów są chronione domyślnie.          |
| Język ekranów auth           | Polski teraz, łącznie z błędami Supabase                               | Brama to pierwszy ekran każdego użytkownika polskiej aplikacji.  |
| Błędy w URL                  | Kod błędu w `?error=`, tłumaczenie przy renderowaniu                   | Polskie komunikaty i brak wyświetlania dowolnego tekstu z linku. |
| Zawartość `/`                | Powłoka (nagłówek + pusty stan) w `AppLayout`                          | S-02/S-03 dostają gotowy layout, bez zgadywania UI spiżarni.     |
| Cel po zalogowaniu           | Zawsze `/`                                                             | Brak ryzyka open-redirect; jest jedna strona aplikacji.          |
| Starter                      | Usunąć `/dashboard`, `Welcome`, `Topbar`, `LibBadge`                   | Brak martwego kodu i mylących ścieżek.                           |
| Niezalogowany na `/api/*`    | 401 zamiast przekierowania                                             | Klient API nie powinien dostawać HTML strony logowania.          |
| Zalogowany na `/auth/signin` | Przekierowanie na `/`                                                  | Nie pokazujemy formularza osobie już zalogowanej.                |

## Scope

**In scope:** odwrócony middleware, wylogowanie → logowanie, `AppLayout` + `AppHeader` + pusty stan pod `/`, usunięcie plików startera, zaostrzony smoke test, polskie ekrany auth i mapa błędów, `lang="pl"`.

**Out of scope:** powrót na żądaną ścieżkę (`?next=`), UI spiżarni i listy przepisów (S-02/S-03), rola admina, reset hasła, OAuth, przekierowanie ze starego `/dashboard`, framework testowy.

## Architecture / Approach

Decyzja o dostępie zapada wyłącznie w `src/middleware.ts` na podstawie `locals.user` i prefiksu ścieżki. Strony dla zalogowanych używają nowego `AppLayout` (owija istniejący `Layout`). Endpointy auth przekazują kod błędu Supabase, a strony auth zamieniają go na polski tekst przez `src/lib/auth-errors.ts`.

## Phases at a Glance

| Phase                                | What it delivers                                                                           | Key risk                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1. Brama dostępu i powłoka aplikacji | Wszystko poza auth chronione, powłoka pod `/`, starter usunięty, smoke test zaktualizowany | Zbyt szeroki prefiks publiczny (`/auth` bez `/`) otworzyłby przyszłe ścieżki |
| 2. Polskie ekrany uwierzytelniania   | Polskie ekrany, walidacja i komunikaty błędów                                              | Nieznane kody błędów Supabase — łapie je komunikat ogólny                    |

**Prerequisites:** lokalny Supabase z wyłączonym potwierdzaniem e-maila (do `npm run smoke`).
**Estimated effort:** ~1 sesja, 2 fazy.

## Open Risks & Assumptions

- Zakładamy, że Supabase zwraca `error.code` dla błędów logowania/rejestracji; brak kodu → komunikat ogólny.
- Przy włączonym potwierdzaniu e-maila Supabase nie zgłasza istniejącego konta przy rejestracji — wtedy komunikat „konto istnieje” się nie pojawi (zachowanie Supabase, nie błąd planu).

## Success Criteria (Summary)

- Niezalogowana osoba nie zobaczy żadnej strony poza logowaniem/rejestracją.
- Po zalogowaniu użytkownik ląduje w powłoce PasujeMi, a wylogowanie wraca do logowania.
- Każdy ekran i komunikat, który widzi gość, jest po polsku.
