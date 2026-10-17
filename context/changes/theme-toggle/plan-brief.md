# Przełącznik jasny/ciemny motyw — Plan Brief

> Full plan: `context/changes/theme-toggle/plan.md`
> Research: `context/changes/theme-toggle/research.md`

## What & Why

Dodajemy przełącznik jasny/ciemny w nagłówku aplikacji i na stronach logowania (issue #22). Dziś `class="dark"` jest na sztywno, a gotowe jasne tokeny z `ui-palette` nie są nigdzie używane. Żeby jasny tryb był czytelny na stronach auth, ta zmiana przenosi je też z kolorów literalnych na tokeny (część #21).

## Starting Point

`Layout.astro:14` ma `<html class="dark">`, a w `src/` nie ma skryptu motywu ani przełącznika. Tokeny obu motywów są w `global.css`, nagłówek i `AppLayout` są już na tokenach. Trzy strony auth i cztery komponenty auth mają `text-white`, `bg-purple-600` itp. i nie są w `CLEAN_FILES`.

## Desired End State

Motyw ustala skrypt w `<head>` przed renderem: zapisany wybór, a bez niego `prefers-color-scheme`. Przycisk-ikona w `AppHeader` i w prawym górnym rogu stron auth przełącza motyw i zapamiętuje wybór. Auth jest czytelne w obu trybach, a zrzuty kitchen sink i stron auth w obu trybach leżą w folderze zmiany.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Zakres auth | Tokeny dla stron i komponentów auth wchodzą tu, pliki do `CLEAN_FILES`; w #21 zostaje `Banner` i nowy styl kart | Bez tego przełącznik na stronach logowania daje nieczytelny jasny tryb | Research / Plan |
| Liczba stanów | Dwa: jasny/ciemny | Wystarcza do wymagań issue #22 | Plan |
| Domyślny motyw | Bez zapisu: `prefers-color-scheme` | Wymóg issue #22 | Research / Plan |
| Zmiana motywu systemu na żywo | Nie nasłuchujemy; działa po odświeżeniu | Brak dodatkowego JS, issue tego nie wymaga | Plan |
| Bez JS / bez `localStorage` | Bez JS jasny; `localStorage` w `try/catch`, błąd → motyw z systemu | Świadomy fallback zamiast dzisiejszego stałego ciemnego | Plan |
| Pozycja na stronach auth | Prawy górny róg strony | Strony auth nie mają nagłówka | Plan |
| `<meta color-scheme>` | Dodana, plus `color-scheme` w CSS | Kontrolki i paski przewijania pasują do motywu | Plan |
| Rozmiar `icon` | Istnieje (`size-9`); używamy go bez zmian w `button.tsx` | `size-9` vs `h-8` „Wyloguj” sprawdzamy wzrokowo | Research / Plan |
| Przełącznik | Wyspa React bez stanu, ikony przełączane CSS (`dark:`) | Brak rozjazdu hydracji i migania ikony | Plan |
| Logika | `src/lib/theme.ts` + test Vitest, skrypt inline jako string z tego modułu | Brak `jsdom`, a skrypt i testy mają jedno źródło | Plan |

## Scope

**In scope:** migracja 3 stron i 4 komponentów auth na tokeny; skrypt motywu w `Layout.astro`; meta i CSS `color-scheme`; `ThemeToggle` w `AppHeader` i na stronach auth; sekcja w kitchen sink; zrzuty w obu trybach.

**Out of scope:** tryb „system” jako trzeci stan; nasłuch `matchMedia`; `Banner.astro` i nowy styl kart (#21); `theme-color`; zmiany w `ui/`; nowe tokeny; testy DOM i `jsdom`.

## Architecture / Approach

`Layout.astro` jest jedynym `<head>` dla stron auth i aplikacji, więc jeden synchroniczny skrypt inline ustawia klasę `dark` na `<html>`. Tokeny i warianty `dark:` już reagują na tę klasę. `ThemeToggle` czyta bieżący tryb z klasy, przełącza ją i zapisuje wybór w `localStorage`. Kolejność prac: tokeny auth (ciemny tryb nadal jedyny), potem mechanizm bez UI, na końcu przycisk i zrzuty.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Auth na tokenach | 3 strony + 4 komponenty bez literałów, w `CLEAN_FILES` | Zmieni się wygląd auth w ciemnym trybie (oliwka zamiast fioletu) |
| 2. Mechanizm motywu | `lib/theme.ts` + test, skrypt w `<head>`, meta/CSS `color-scheme` | FOUC, gdy skrypt nie jest synchroniczny; wyjątek `localStorage` omijający system |
| 3. Przełącznik w UI | `ThemeToggle` w nagłówku i na auth, kitchen sink, zrzuty | Kontrast nowych par w jasnym trybie; wysokość `icon` obok „Wyloguj”; przełącznik w rogu na małym ekranie |

**Prerequisites:** lokalny Supabase z kontem do zalogowania (kitchen sink i aplikacja wymagają logowania).
**Estimated effort:** ~2–3 sesje przez 3 fazy.

## Open Risks & Assumptions

- Kontrast nowych par na karcie auth (`text-primary`, `text-muted-foreground`, `text-destructive` na `bg-card`) nie był liczony; sprawdzamy w fazie 3.
- Bez JS przycisk renderuje się, ale nic nie robi (zaakceptowane).
- Po scaleniu trzeba zawęzić opis #21 do `Banner` i stylu kart, a w PR dodać „Closes #22”.

## Success Criteria (Summary)

- Przełącznik działa w aplikacji i na stronach auth, wybór przeżywa przeładowanie, bez błysku złego motywu.
- Strony auth są czytelne w obu trybach, a ich pliki są w `CLEAN_FILES`.
- `npm test`, `npm run lint`, `npx astro check`, `npm run check:ui` i `npm run build` przechodzą.
