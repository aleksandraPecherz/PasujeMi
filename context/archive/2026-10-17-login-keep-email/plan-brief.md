# E-mail zostaje po błędzie logowania — Plan Brief

> Full plan: `context/changes/login-keep-email/plan.md`

## What & Why

Issue #23: po złym haśle formularz logowania czyści oba pola i trzeba wpisywać wszystko od nowa. Po zmianie e-mail zostaje wpisany, czyści się tylko hasło. Hasło nigdy nie trafia do URL. Rejestracja ma ten sam wzorzec i dostaje tę samą poprawkę.

## Starting Point

Formularze wysyłają zwykły POST. Przy błędzie endpointy (`signin.ts`, `signup.ts`) przekierowują na `/auth/…?error=<kod>`, więc strona ładuje się od nowa, a kontrolowane formularze React startują z pustym stanem. W kitchen sinku nie ma dziś żadnych stanów logowania.

## Desired End State

Po błędzie logowania lub rejestracji użytkownik widzi komunikat, wpisany e-mail i puste pole hasła z fokusem. URL przekierowania ma `error` i `email`, bez hasła. Kitchen sink ma sekcję „Formularze logowania” ze stanem pustym i stanami po błędzie.

## Key Decisions Made

| Decision                      | Choice                                                       | Why (1 sentence)                                                  |
| ----------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Podejście                     | E-mail w przekierowaniu (`?error=…&email=…`)                 | Wybrane w issue/poleceniu; najmniejsza zmiana przy zwykłym POST.  |
| Wstawienie e-maila            | Prop `initialEmail` zasila `useState`                        | Formularze są kontrolowane, więc `defaultValue` by nie zadziałał. |
| Budowanie URL                 | Helper `authErrorRedirect` w `src/lib/auth-errors.ts` + test | Jedna reguła dla 4 przekierowań; sygnatura nie przyjmuje hasła.   |
| Limit e-maila                 | 254 znaki, przy zapisie i odczycie                           | Wartość z URL jest niezaufana; React i tak ją escapuje.           |
| `?email=` bez `?error=`       | Ignorowany                                                   | Nie otwieramy nowej ścieżki wejścia.                              |
| Fokus                         | Pole hasła, tylko gdy e-mail wrócił z URL                    | Użytkownik od razu poprawia hasło.                                |
| Kitchen sink                  | Nowa sekcja „Formularze logowania” za „loading”              | Osobna grupa auth, nie miesza się z błędem spiżarni.              |
| Link signup→signin z e-mailem | Poza zakresem                                                | Issue dotyczy tego samego formularza.                             |

## Scope

**In scope:**

- 4 przekierowania błędów w `signin.ts` i `signup.ts`
- Strony `/auth/signin` i `/auth/signup`, formularze `SignInForm`, `SignUpForm`, `FormField` (`autoFocus`)
- Test Vitest helpera, aktualizacja `scripts/smoke.mjs`
- Sekcja w kitchen sinku

**Out of scope:**

- Wysyłka przez `fetch` bez przeładowania
- Przenoszenie e-maila linkami między stronami
- Czyszczenie literalnych kolorów w auth
- Ukrywanie e-maila przed historią/logami (flash cookie)

## Architecture / Approach

Endpoint → `authErrorRedirect(path, code, email)` → `302 /auth/signin?error=…&email=…` → strona: `emailFromQuery()` (tylko przy `error`) → `<SignInForm initialEmail autoFocusPassword>` → `useState(initialEmail)`. Formularze dostają też `idPrefix`, żeby trzy kopie w kitchen sinku miały unikalne id. `name` pól podawane jawnie, więc POST się nie zmienia.

## Phases at a Glance

| Phase                        | What it delivers                                          | Key risk                                                                                 |
| ---------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Przekierowanie z e-mailem | Helper + test, 4 przekierowania, smoke z nowym `location` | Smoke porównuje `location` dokładnie, więc kodowanie musi się zgadzać                    |
| 2. Formularze i kitchen sink | E-mail i fokus w formularzach, sekcja w kitchen sinku     | Duplikaty id i autoFocus w kitchen sinku (rozwiązane: `idPrefix`, fokus jako jawny prop) |

**Prerequisites:** lokalny Supabase z wyłączonym potwierdzaniem e-maila (dla `npm run smoke`).
**Estimated effort:** ~1 sesja, 2 fazy.

## Open Risks & Assumptions

- E-mail trafia do historii przeglądarki i logów żądań. Issue akceptuje to świadomie.
- Formularze w kitchen sinku wysyłają prawdziwe POST-y do endpointów auth (tylko w dev).

## Success Criteria (Summary)

- Złe hasło: e-mail zostaje, hasło puste, fokus na haśle, w URL nie ma hasła.
- Błąd rejestracji zachowuje się tak samo.
- `npm test`, `npm run lint`, `npx astro check`, `npm run check:ui`, `npm run smoke` przechodzą.
