# E-mail zostaje po błędzie logowania — plan implementacji

## Overview

Realizacja issue #23: po błędnym logowaniu (i rejestracji) formularz traci wpisany e-mail, bo endpoint robi przekierowanie, a strona ładuje się od nowa. Endpointy dopiszą e-mail do przekierowania (`?error=…&email=…`), strony przekażą go do formularza jako wartość startową, a fokus trafi na pole hasła. Hasło nigdy nie trafia do URL.

## Current State Analysis

- `src/pages/api/auth/signin.ts:11,16` i `src/pages/api/auth/signup.ts:11,16` — po dwa przekierowania z błędem (`not_configured` oraz kod błędu Supabase), oba zawierają tylko `?error=`.
- `src/pages/auth/signin.astro:6` i `signup.astro:6` czytają tylko `error` i przekazują `serverError` do formularza.
- `SignInForm.tsx:13` i `SignUpForm.tsx:22` to formularze **kontrolowane** (`useState("")` + `value`) — samo `defaultValue` nie zadziała; e-mail musi zasilić wartość startową `useState`.
- `FormField.tsx:44` ustawia `name={name ?? id}` — `id` służy też jako nazwa pola wysyłanego w POST.
- `src/lib/auth-errors.ts` mapuje kod z URL na polski komunikat (tekst z URL nie jest renderowany wprost) — naturalne miejsce na helper przekierowania.
- `scripts/smoke.mjs:58` porównuje `location` dokładnie z `/auth/signin?error=invalid_credentials` — po zmianie musi się zmienić.
- Kitchen sink (`src/components/dev/KitchenSink.tsx`) pokazuje wyłącznie 7 stanów spiżarni; nie ma tam stanów logowania. Plik jest w `CLEAN_FILES` (`scripts/check-ui-literals.mjs:19`) — nie wolno w nim używać literalnych kolorów.

## Desired End State

Po złym haśle na `/auth/signin` użytkownik widzi komunikat błędu, pole e-mail z wpisanym adresem, puste pole hasła z fokusem. To samo dla błędu rejestracji na `/auth/signup` (oba pola haseł puste). URL przekierowania zawiera `error` i `email`, nigdy hasła. Kitchen sink ma sekcję „Formularze logowania” ze stanem pustym i stanami po błędzie.

### Key Discoveries:

- Formularze kontrolowane → prop `initialEmail` zasila `useState`, nie `defaultValue` (`SignInForm.tsx:13`, `SignUpForm.tsx:22`).
- `name` pola wynika z `id` (`FormField.tsx:44`) — przy kilku formularzach na jednej stronie (kitchen sink) id trzeba prefiksować, a `name` podawać jawnie.
- `bg-cosmic` to utility z `src/styles/global.css:149`, nie literał — można go użyć w kitchen sinku do ramki formularzy.

## What We're NOT Doing

- Wysyłania formularza przez `fetch` w wyspie React (drugie podejście z issue) — wybrano przekierowanie z e-mailem.
- Przenoszenia e-maila linkami „Zaloguj się” / „Zarejestruj się” między stronami (np. po `user_already_exists`) — poza zakresem issue.
- Czytania `?email=` bez `?error=` — nie otwieramy nowej ścieżki wejścia z wypełnionym e-mailem.
- Czyszczenia literalnych kolorów w formularzach i stronach auth (osobna zmiana UI).
- Ukrywania e-maila przed historią przeglądarki / logami (np. flash cookie) — akceptujemy e-mail w URL, jak w issue.

## Implementation Approach

Jedno źródło budowania URL błędu: helper w `src/lib/auth-errors.ts`, który przyjmuje tylko ścieżkę, kod i e-mail — sygnatura nie ma miejsca na hasło. Ten sam moduł czyta e-mail z URL po stronie strony, z tym samym limitem długości. Formularze dostają props `initialEmail`, `autoFocusPassword` (ustawiany przez stronę) oraz `idPrefix` (używany tylko przez kitchen sink).

## Critical Implementation Details

**Fokus w kitchen sinku.** `autoFocusPassword` jest jawnym propem przekazywanym przez stronę (`Boolean(email)`), a nie wyliczanym z `initialEmail` w formularzu — inaczej formularze w kitchen sinku kradłyby fokus i przewijały stronę na dół przy wczytaniu.

**Duplikaty id.** Trzy formularze w kitchen sinku z `id="email"` / `id="password"` psują powiązania `label`→`input`. Formularze przyjmują `idPrefix` (domyślnie `""`) i przekazują `FormField` jawne `name` (`email`, `password`, `confirmPassword`), żeby POST nadal wysyłał te same nazwy pól.

## Faza 1: Przekierowanie z e-mailem

### Overview

Endpointy auth po każdym błędzie przekierowują z `error` i `email`; logika w jednym, przetestowanym helperze.

### Changes Required:

#### 1. Helper przekierowania i odczytu e-maila

**File**: `src/lib/auth-errors.ts`

**Intent**: Dodać budowanie URL błędu z e-mailem oraz bezpieczny odczyt e-maila z URL, żeby endpointy i strony stosowały tę samą regułę (przycięcie, limit długości) i żeby hasło strukturalnie nie mogło trafić do URL.

**Contract**:
- `MAX_EMAIL_LENGTH = 254`.
- `authErrorRedirect(path: "/auth/signin" | "/auth/signup", code: string, email: string | null): string` — buduje `path?error=<code>[&email=<email>]` przez `URLSearchParams`; e-mail po `trim()` dołączany tylko gdy niepusty i ≤ `MAX_EMAIL_LENGTH`.
- `emailFromQuery(value: string | null): string` — zwraca przycięty e-mail albo `""`, gdy brak lub dłuższy niż limit.

#### 2. Test helpera

**File**: `src/lib/auth-errors.test.ts`

**Intent**: Zabezpieczyć kontrakt URL testem Vitest.

**Contract**: przypadki — e-mail dołączony i zakodowany (`@` → `%40`, `+` w adresie zachowany po odczycie); brak e-maila / pusty / same spacje → tylko `?error=`; e-mail > 254 znaków → pominięty; `emailFromQuery` dla `null`, za długiej wartości i wartości ze spacjami; istniejące `authErrorMessage` bez zmian.

#### 3. Endpointy

**File**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: Wszystkie cztery przekierowania błędów (`not_configured` i błąd Supabase) budować przez `authErrorRedirect`, przekazując e-mail z formularza.

**Contract**: sukces bez zmian (`/` i `/auth/confirm-email`); `form.get("email")` traktowane jako `string | null`.

#### 4. Smoke test

**File**: `scripts/smoke.mjs`

**Intent**: Dostosować krok „signin rejects wrong password” do nowego URL i sprawdzić, że hasło nie wycieka.

**Contract**: oczekiwany `location` = `/auth/signin?` + `new URLSearchParams({ error: "invalid_credentials", email })`; dodatkowa asercja, że parametry `location` nie mają klucza `password` ani wartości równej wysłanemu hasłu (`"wrong"`).

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Smoke test przechodzi na uruchomionym serwerze: `npm run smoke`

#### Manual Verification:

- W DevTools (Network) przekierowanie po złym haśle ma `Location` z `error` i `email`, bez hasła

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Faza 2: Formularze i kitchen sink

### Overview

Strony przekazują e-mail do formularzy; formularze startują z wypełnionym e-mailem i fokusem na haśle; kitchen sink pokazuje nowe stany.

### Changes Required:

#### 1. Strony auth

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`

**Intent**: Gdy w URL jest `error`, odczytać `email` przez `emailFromQuery` i przekazać do formularza razem z `autoFocusPassword`.

**Contract**: `<SignInForm serverError={error} initialEmail={email} autoFocusPassword={Boolean(email)} client:load />` (analogicznie `SignUpForm`); bez `error` → `email = ""`.

#### 2. Formularze

**File**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/FormField.tsx`

**Intent**: Zasilić stan e-maila wartością startową, ustawić fokus na pierwszym polu hasła, gdy strona o to prosi, i umożliwić unikalne id przy wielu formularzach na stronie.

**Contract**:
- Props formularzy: `initialEmail?: string` (domyślnie `""`, zasila `useState`), `autoFocusPassword?: boolean`, `idPrefix?: string` (domyślnie `""`).
- Pola: `id={`${idPrefix}email`}` + jawne `name="email"` (analogicznie `password`, `confirmPassword`).
- `FormField` dostaje opcjonalny `autoFocus?: boolean` przekazywany do `<input>`; ustawiany tylko na polu `password`.
- Hasła zawsze startują puste.

#### 3. Kitchen sink

**File**: `src/components/dev/KitchenSink.tsx`

**Intent**: Dodać sekcję „Formularze logowania” za sekcją „loading” (po 7 stanach spiżarni), jako początek osobnej grupy stanów auth.

**Contract**: `StateSection` z trzema formularzami w ramce `bg-cosmic` (tylko tokeny / utility, bez literałów — plik jest w `CLEAN_FILES`): `SignInForm` pusty; `SignInForm` po złym haśle (`initialEmail` przykładowy, `serverError={authErrorMessage("invalid_credentials")}`); `SignUpForm` po błędzie (`serverError={authErrorMessage("user_already_exists")}`). Każdy z innym `idPrefix`, bez `autoFocusPassword`. Notka sekcji wyjaśnia, że e-mail zostaje, hasło jest puste, a na stronie fokus trafia na hasło. Zaktualizować opis strony (nagłówek) o nową sekcję.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Strażnik UI przechodzi: `npm run check:ui`
- Build przechodzi: `npm run build`

#### Manual Verification:

- `/auth/signin`: złe hasło → komunikat błędu, e-mail wpisany, hasło puste z fokusem; poprawne hasło po tym → logowanie działa
- `/auth/signup`: błąd (np. istniejące konto) → e-mail wpisany, oba pola haseł puste, fokus na haśle
- Wejście na `/auth/signin?email=a@b.pl` (bez `error`) → pole e-mail puste
- `/dev/kitchen-sink`: sekcja „Formularze logowania” za „loading”, etykiety klikają właściwe pola, strona nie przewija się sama przy wczytaniu

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie.

---

## Testing Strategy

### Unit Tests:

- `src/lib/auth-errors.test.ts` — budowanie URL (kodowanie, brak/pusty/za długi e-mail) i odczyt `emailFromQuery`.

### Integration Tests:

- `scripts/smoke.mjs` — przekierowanie po złym haśle z dokładnym `location` i bez hasła w URL.

### Manual Testing Steps:

1. Zaloguj się złym hasłem → e-mail zostaje, fokus na haśle, wpisz dobre hasło → wejście do aplikacji.
2. Zarejestruj się na istniejący adres → e-mail zostaje, komunikat „Konto z tym adresem e-mail już istnieje.”.
3. Sprawdź `Location` w DevTools — brak hasła.
4. Obejrzyj sekcję w `/dev/kitchen-sink`.

## Performance Considerations

Brak — jedno `URLSearchParams` na żądanie.

## Migration Notes

Nie dotyczy. Stare linki `?error=…` bez `email` działają jak dotąd (pusty e-mail).

## References

- Issue: #23 (PR zamyka przez „Closes #23” — `context/foundation/lessons.md`)
- Endpointy: `src/pages/api/auth/signin.ts:16`, `src/pages/api/auth/signup.ts:16`
- Mapowanie błędów: `src/lib/auth-errors.ts:16`
- Smoke: `scripts/smoke.mjs:56`
- Strażnik UI: `scripts/check-ui-literals.mjs:11`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Przekierowanie z e-mailem

#### Automated

- [x] 1.1 Testy jednostkowe przechodzą: `npm test` — 0ab89eb
- [x] 1.2 Lint przechodzi: `npm run lint` — 0ab89eb
- [x] 1.3 Typy przechodzą: `npx astro check` — 0ab89eb
- [ ] 1.4 Smoke test przechodzi na uruchomionym serwerze: `npm run smoke`

#### Manual

- [x] 1.5 W DevTools (Network) przekierowanie po złym haśle ma `Location` z `error` i `email`, bez hasła

### Phase 2: Formularze i kitchen sink

#### Automated

- [x] 2.1 Testy jednostkowe przechodzą: `npm test`
- [x] 2.2 Lint przechodzi: `npm run lint`
- [x] 2.3 Typy przechodzą: `npx astro check`
- [x] 2.4 Strażnik UI przechodzi: `npm run check:ui`
- [x] 2.5 Build przechodzi: `npm run build`

#### Manual

- [x] 2.6 `/auth/signin`: złe hasło → komunikat błędu, e-mail wpisany, hasło puste z fokusem; poprawne hasło po tym → logowanie działa
- [x] 2.7 `/auth/signup`: błąd (np. istniejące konto) → e-mail wpisany, oba pola haseł puste, fokus na haśle
- [x] 2.8 Wejście na `/auth/signin?email=a@b.pl` (bez `error`) → pole e-mail puste
- [x] 2.9 `/dev/kitchen-sink`: sekcja „Formularze logowania” za „loading”, etykiety klikają właściwe pola, strona nie przewija się sama przy wczytaniu
