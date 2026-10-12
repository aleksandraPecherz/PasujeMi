# Logowanie jako brama do aplikacji (S-01) — Implementation Plan

## Overview

Domykamy bramę dostępu z PRD (FR-001, Access Control): niezalogowana osoba widzi wyłącznie ekrany logowania/rejestracji, a każda inna ścieżka przekierowuje do logowania. Po zalogowaniu `/` pokazuje powłokę aplikacji PasujeMi (nagłówek + pusty stan), w której zamieszkają kolejne slice'y, zamiast ekranu powitalnego startera. Ekrany uwierzytelniania mówią po polsku.

## Current State Analysis

- Rejestracja, logowanie i wylogowanie e-mailem działają (`src/pages/api/auth/*.ts`, `src/components/auth/*`), sesja trafia do `locals.user` w middleware.
- Middleware chroni tylko listę ścieżek: `PROTECTED_ROUTES = ["/dashboard"]` (`src/middleware.ts:4`) — wszystko inne jest publiczne, odwrotnie niż wymaga PRD.
- `/` to nadal ekran startera (`src/pages/index.astro` → `Welcome.astro` → `Topbar.astro`); `/dashboard` to angielska strona demonstracyjna startera.
- Logowanie przekierowuje na `/` (`src/pages/api/auth/signin.ts:20`), wylogowanie też na `/` (`src/pages/api/auth/signout.ts:9`).
- Ekrany auth są po angielsku, `Layout.astro` ma `lang="en"` i tytuł „10x Astro Starter”; endpointy przekazują w `?error=` surowy angielski `error.message` z Supabase.
- `scripts/smoke.mjs` (uruchamiany też w CI, job `smoke`) zakłada publiczne `/` i chronione `/dashboard`; porównanie `location` przez `startsWith` sprawia, że oczekiwanie `"/"` przechodzi dla dowolnego przekierowania.
- `src/components/ui/LibBadge.astro` nie jest nigdzie importowany.

## Desired End State

- Niezalogowany: `/`, dowolna nieznana ścieżka → 302 na `/auth/signin`; `/api/*` poza `/api/auth/*` → 401; `/auth/*` i `/api/auth/*` działają normalnie.
- Zalogowany: `/` pokazuje powłokę PasujeMi (nazwa, e-mail, „Wyloguj”, zachęta „Wypełnij spiżarkę, żeby zobaczyć dopasowanie”), czytelną na telefonie i desktopie; wejście na `/auth/signin` lub `/auth/signup` → 302 na `/`.
- Wylogowanie → `/auth/signin`.
- Ekrany logowania, rejestracji i potwierdzenia e-maila oraz komunikaty błędów są po polsku; strona ma `lang="pl"`.
- Brak plików startera `/dashboard`, `Welcome`, `Topbar`, `LibBadge`; smoke test weryfikuje nową bramę.

### Key Discoveries:

- `src/middleware.ts:19` — jedyne miejsce decyzji o dostępie; tu odwracamy domyślność.
- `src/pages/api/auth/signin.ts:16`, `signup.ts:16` — błędy idą do URL jako tekst; zamiana na kod błędu usuwa możliwość wstrzyknięcia dowolnego tekstu przez link.
- `src/lib/config-status.ts` — baner o braku konfiguracji Supabase jest już po polsku i renderuje się w `Layout.astro`, więc bez Supabase użytkownik trafi na ekran logowania z banerem.
- `scripts/smoke.mjs:72` — dopasowanie `startsWith` wymaga zaostrzenia, inaczej asercje o `/` są puste.

## What We're NOT Doing

- Powrót na pierwotnie żądaną ścieżkę po zalogowaniu (`?next=`) — zawsze lądujemy na `/` (decyzja: brak ryzyka open-redirect, jest jedna strona aplikacji).
- Sekcje spiżarni, lista przepisów, kafelki — to S-02/S-03; powłoka ma tylko pusty stan.
- Rola admina, reset hasła, logowanie przez OAuth, zmiana ustawień potwierdzania e-maila w Supabase.
- Przekierowanie ze starego `/dashboard` (aplikacja nie ma jeszcze użytkowników z zakładkami).
- Framework testowy — jedyną automatyczną kontrolą pozostaje `scripts/smoke.mjs`.

## Implementation Approach

Odwracamy middleware z listy chronionych na listę publicznych prefiksów — każda nowa trasa z kolejnych slice'ów jest chroniona domyślnie, bez pamiętania o rejestracji. Powłoka aplikacji to osobny layout, który S-02/S-03 wypełnią treścią. Tłumaczenie idzie w drugiej fazie, żeby pierwsza dostarczyła działającą bramę zweryfikowaną smoke testem; błędy Supabase przechodzą przez URL jako kod i są tłumaczone przy renderowaniu strony.

## Critical Implementation Details

- **Dopasowanie prefiksów** — publiczne prefiksy muszą kończyć się ukośnikiem (`/auth/`, `/api/auth/`), żeby przyszłe ścieżki typu `/authors` nie stały się publiczne. Przekierowanie zalogowanego dotyczy tylko `/auth/signin` i `/auth/signup` (z tolerancją końcowego `/`) — `/auth/confirm-email` zostaje dostępne, bo przy wyłączonym potwierdzaniu e-maila rejestracja od razu tworzy sesję i kieruje właśnie tam.
- **Polska odmiana w podpowiedzi hasła** — licznik brakujących znaków przyjmuje wartości 1–5: 1 → „znak”, 2–4 → „znaki”, 5 → „znaków”. Obecna angielska logika liczby mnogiej (`!== 1 ? "s"`) nie przenosi się wprost.

## Phase 1: Brama dostępu i powłoka aplikacji

### Overview

Wszystko poza ekranami auth wymaga zalogowania; zalogowany widzi powłokę PasujeMi pod `/`; pozostałości startera znikają; smoke test sprawdza nowe zachowanie.

### Changes Required:

#### 1. Middleware

**File**: `src/middleware.ts`

**Intent**: Zastąpić `PROTECTED_ROUTES` listą publicznych prefiksów i chronić wszystko inne; odesłać zalogowanego z ekranów logowania/rejestracji do aplikacji.

**Contract**: `PUBLIC_PREFIXES = ["/auth/", "/api/auth/"]`. Niezalogowany poza publicznymi: ścieżka zaczynająca się od `/api/` → `401` z JSON `{ "error": "unauthorized" }`; pozostałe → `redirect("/auth/signin")`. Zalogowany na `/auth/signin` lub `/auth/signup` → `redirect("/")`. Ustawianie `locals.user` bez zmian. Zaktualizować wpis o `PROTECTED_ROUTES` w `AGENTS.md` (Project Structure) — nowe trasy są chronione domyślnie, publiczne dodaje się do `PUBLIC_PREFIXES`.

#### 2. Wylogowanie

**File**: `src/pages/api/auth/signout.ts`

**Intent**: Po wylogowaniu kierować prosto na ekran logowania zamiast przez przekierowanie z `/`.

**Contract**: `redirect("/auth/signin")`.

#### 3. Powłoka aplikacji

**Files**: `src/layouts/AppLayout.astro` (nowy), `src/components/AppHeader.astro` (nowy), `src/pages/index.astro`

**Intent**: Layout dla zalogowanych stron, z którego skorzystają S-02/S-03: nagłówek z nazwą PasujeMi, e-mailem użytkownika i przyciskiem „Wyloguj” (formularz `POST /api/auth/signout`) oraz obszar treści. `index.astro` używa go i pokazuje pusty stan z zachętą „Wypełnij spiżarkę, żeby zobaczyć dopasowanie”. Styl spójny z ekranami auth; układ działa od ~360 px szerokości.

**Contract**: `AppLayout` przyjmuje `title?: string`, owija `Layout` i renderuje `<slot />` w obszarze treści; użytkownika czyta z `Astro.locals.user`.

#### 4. Usunięcie startera

**Files**: `src/pages/dashboard.astro`, `src/components/Welcome.astro`, `src/components/Topbar.astro`, `src/components/ui/LibBadge.astro` — usunąć.

**Intent**: Brak martwych ścieżek i angielskiej strony „Dashboard” dla agentów i użytkowników w kolejnych slice'ach.

**Contract**: Żaden plik w `src/` nie odwołuje się do usuniętych komponentów.

#### 5. Smoke test

**File**: `scripts/smoke.mjs`

**Intent**: Sprawdzać nową bramę zamiast `/dashboard` i porównywać `location` dokładnie, chyba że krok jawnie oczekuje prefiksu.

**Contract**: Asercja: `location === expected.location`, a dla kroków z prefiksem (np. `/auth/signin?error=`) `startsWith`. Kroki w kolejności:

1. Anonim `GET /` → 302 `/auth/signin`
2. Anonim `GET /auth/signin` → 200
3. Anonim `GET /api/recipes` → 401
4. Signup → 302 `/auth/confirm-email`
5. Signin złym hasłem → 302 z prefiksem `/auth/signin?error=`
6. Signin poprawnym → 302 `/`
7. Zalogowany `GET /` → 200
8. Zalogowany `GET /auth/signin` → 302 `/`
9. Signout → 302 `/auth/signin`
10. Po wylogowaniu `GET /` → 302 `/auth/signin`

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- Starter files are gone and unreferenced: `grep -rnE "Welcome|Topbar|LibBadge|/dashboard" src` returns nothing
- Smoke test passes against a running dev server: `npm run smoke`

#### Manual Verification:

- Signed-out visit to `/` and to a made-up path (e.g. `/cokolwiek`) lands on the sign-in screen
- After signing in, `/` shows the PasujeMi header with email, „Wyloguj” and the empty-state prompt
- App shell is readable without horizontal scroll at phone width (~375 px) and on desktop
- „Wyloguj” returns to sign-in, and `/` redirects to sign-in afterwards

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Polskie ekrany uwierzytelniania

### Overview

Wszystko, co widzi niezalogowana osoba, jest po polsku, a błędy Supabase docierają do użytkownika jako polskie komunikaty.

### Changes Required:

#### 1. Layout bazowy

**File**: `src/layouts/Layout.astro`

**Intent**: Oznaczyć dokument jako polski i zastąpić domyślny tytuł startera.

**Contract**: `<html lang="pl">`, domyślny `title = "PasujeMi"`.

#### 2. Mapa błędów uwierzytelniania

**File**: `src/lib/auth-errors.ts` (nowy)

**Intent**: Jedno miejsce tłumaczące kody błędów na polskie komunikaty, z ogólnym komunikatem dla nieznanych kodów — tekst z URL nigdy nie trafia na ekran wprost.

**Contract**: `authErrorMessage(code: string | null): string | null` — `null` dla braku kodu. Kody: `invalid_credentials`, `email_not_confirmed`, `user_already_exists`, `weak_password`, `email_address_invalid`, `over_email_send_rate_limit`, `over_request_rate_limit`, `not_configured`; każdy inny → „Coś poszło nie tak. Spróbuj ponownie.”

#### 3. Endpointy auth

**Files**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: Przekazywać w `?error=` kod błędu zamiast angielskiego komunikatu.

**Contract**: `?error=<error.code ?? "unknown">`; brak konfiguracji Supabase → `?error=not_configured`. Docelowe ścieżki przekierowań bez zmian.

#### 4. Strony auth

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Polskie tytuły, nagłówki i linki („Zaloguj się”, „Nie masz konta? Zarejestruj się”, „Załóż konto”, „Masz już konto? Zaloguj się”, obie wersje ekranu potwierdzenia e-maila); `serverError` przechodzi przez `authErrorMessage`.

**Contract**: Formularze dostają `serverError={authErrorMessage(Astro.url.searchParams.get("error"))}`.

#### 5. Komponenty formularzy

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/PasswordToggle.tsx`

**Intent**: Polskie etykiety („E-mail”, „Hasło”, „Powtórz hasło”), placeholdery, komunikaty walidacji, teksty przycisków i stanów oczekiwania („Logowanie…”, „Zakładanie konta…”), `aria-label` przełącznika hasła („Pokaż hasło” / „Ukryj hasło”) oraz podpowiedź o brakujących znakach z polską odmianą.

**Contract**: Reguły walidacji (wzorzec e-maila, `MIN_PASSWORD_LENGTH = 6`) bez zmian — zmienia się tylko tekst.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`
- No English UI strings remain in auth screens: `grep -rnE "Sign (in|up)|Create account|Check your email|Your password|is required|do not match|Hide password|Show password" src/pages src/components` returns nothing
- Smoke test still passes: `npm run smoke`

#### Manual Verification:

- Sign-in, sign-up and confirm-email screens are fully Polish, including client-side validation messages
- Wrong password shows „Nieprawidłowy e-mail lub hasło.” (or equivalent Polish message)
- Signing up with an existing email shows a Polish message
- Password hint reads correctly for 1, 2–4 and 5 missing characters
- `/auth/signin?error=<dowolny tekst>` shows the generic Polish message, not the URL text

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human.

---

## Testing Strategy

### Integration Tests:

- `scripts/smoke.mjs` covers the gate end-to-end: anonymous redirects, API 401, signup, signin (bad/good), signed-in shell, signed-in redirect away from sign-in, signout. Runs locally against `npm run dev` with local Supabase (email confirmation off) and in CI job `smoke`.

### Manual Testing Steps:

1. Signed out, open `/`, `/cokolwiek` → sign-in screen.
2. Register a new account, sign in → PasujeMi shell with email and empty state.
3. While signed in, open `/auth/signin` → back on `/`.
4. Resize to ~375 px → no horizontal scroll, header readable.
5. „Wyloguj” → sign-in screen; `/` redirects again.
6. Trigger each auth error (wrong password, existing email) → Polish messages.

## Performance Considerations

Brak — middleware już wywołuje `getUser()` na każdym żądaniu; zmienia się tylko logika decyzji.

## Migration Notes

Brak danych do migracji. Stare zakładki na `/dashboard` po zalogowaniu dadzą 404 Astro (zaakceptowane — brak użytkowników).

## References

- Roadmap: `context/foundation/roadmap.md` — S-01
- PRD: `context/foundation/prd.md` — FR-001, Access Control
- Middleware: `src/middleware.ts:4`
- Auth endpoints: `src/pages/api/auth/signin.ts:16`, `src/pages/api/auth/signup.ts:16`
- Smoke test: `scripts/smoke.mjs:45`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Brama dostępu i powłoka aplikacji

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — 4480069
- [x] 1.2 Type checking passes: `npx astro check` — 4480069
- [x] 1.3 Production build succeeds: `npm run build` — 4480069
- [x] 1.4 Starter files are gone and unreferenced — 4480069
- [ ] 1.5 Smoke test passes against a running dev server: `npm run smoke`

#### Manual

- [x] 1.6 Signed-out visit to `/` and to a made-up path lands on the sign-in screen — 4480069
- [x] 1.7 After signing in, `/` shows the PasujeMi header with email, „Wyloguj” and the empty-state prompt — 4480069
- [x] 1.8 App shell is readable without horizontal scroll at phone width and on desktop — 4480069
- [x] 1.9 „Wyloguj” returns to sign-in, and `/` redirects to sign-in afterwards — 4480069

### Phase 2: Polskie ekrany uwierzytelniania

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Type checking passes: `npx astro check`
- [x] 2.3 Production build succeeds: `npm run build`
- [x] 2.4 No English UI strings remain in auth screens
- [ ] 2.5 Smoke test still passes: `npm run smoke`

#### Manual

- [x] 2.6 Sign-in, sign-up and confirm-email screens are fully Polish, including validation messages
- [x] 2.7 Wrong password shows a Polish message
- [x] 2.8 Signing up with an existing email shows a Polish message
- [x] 2.9 Password hint reads correctly for 1, 2–4 and 5 missing characters
- [x] 2.10 `/auth/signin?error=<dowolny tekst>` shows the generic Polish message, not the URL text
