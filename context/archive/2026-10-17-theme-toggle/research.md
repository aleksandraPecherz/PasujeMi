---
date: 2026-10-17T20:44:40+02:00
researcher: Aleksandra Pęcherz
git_commit: c104d557a5d63727fad73316e1f22955b5a008ed
branch: theme-toggle
repository: pasujemi-theme
topic: "Przełącznik jasny/ciemny motyw (issue #22) — co istnieje, czego brakuje"
tags: [research, codebase, theme, Layout, AppHeader, global.css, auth, kitchen-sink]
status: complete
last_updated: 2026-10-17
last_updated_by: Aleksandra Pęcherz
---

# Research: Przełącznik jasny/ciemny motyw (issue #22)

**Date**: 2026-10-17T20:44:40+02:00
**Researcher**: Aleksandra Pęcherz
**Git Commit**: c104d557a5d63727fad73316e1f22955b5a008ed (lokalne, niezatwierdzone zmiany: tylko `context/changes/theme-toggle/`)
**Branch**: theme-toggle
**Repository**: pasujemi-theme

## Research Question

Issue #22 (`gh issue view 22`) wymaga: przełącznika w nagłówku (`AppLayout.astro`) i na stronach logowania; domyślnie motyw z `prefers-color-scheme`, wybór w `localStorage`; skryptu w `<head>` ustawiającego klasę przed renderem (bez FOUC); zrzutów kitchen sink w obu trybach. Co w kodzie już to wspiera, a co blokuje?

## Summary

- Mechanizm motywu jest gotowy po stronie CSS: wariant `dark` to `&:is(.dark *)` (`src/styles/global.css:4`), a wartości jasnego (`:root`, linie 6–54) i ciemnego (`.dark`, linie 56–104) motywu istnieją. Przełączenie sprowadza się do dodawania/usuwania klasy `dark` na `<html>`.
- Klasa jest dziś na sztywno: `<html lang="pl" class="dark">` (`src/layouts/Layout.astro:14`). Na sprawdzonej ścieżce (`src/`, grep `localStorage|prefers-color`) nie ma żadnego skryptu motywu ani przełącznika — 0 trafień.
- **Główna blokada:** trzy strony auth i 4 z 6 komponentów w `src/components/auth/` (`FormField`, `PasswordToggle`, `SignUpForm`, `SubmitButton`) mają kolory literalne zaprojektowane pod ciemne tło (`text-white`, `bg-white/10`, `text-blue-100/80`, `text-purple-300`, `bg-purple-600`, `border-white/20`). W jasnym motywie byłyby nieczytelne (jasny tekst na jasnym tle), a pliki nie są w `CLEAN_FILES`. Wymóg „przełącznik na stronach logowania” wymaga więc najpierw przejścia tych plików na tokeny.
- Nagłówek (`AppHeader.astro`), `AppLayout.astro` i `index.astro` są już na tokenach (są w `CLEAN_FILES`), więc po stronie aplikacji dla zalogowanych dodanie przełącznika jest bezpośrednie.
- Komponenty `ui/` zawierają warianty `dark:` (np. `button.tsx:14,16`, `badge.tsx:14`, `input.tsx:10`), dopasowane do klasy `.dark` — działają w obu trybach bez zmian.

## Detailed Findings

### Stan motywu i miejsce na skrypt przed renderem

- `src/layouts/Layout.astro:14` — `<html lang="pl" class="dark">`. To jedyny plik z `<head>` wspólny dla stron auth i `AppLayout` (AppLayout opakowuje `Layout`, `AppLayout.astro:12`; strony auth używają `Layout` bezpośrednio, np. `signin.astro:11`). Skrypt inline w `<head>` tego layoutu pokryje oba przypadki.
- `<head>` zawiera dziś tylko meta, favicon i `<title>` (`Layout.astro:15–19`); brak skryptów. Kolejność: skrypt musi wykonać się synchronicznie przed `<body>`, żeby nie było FOUC (wymóg z issue).
- Brak `ClientRouter`/view transitions i brak CSP w `astro.config.mjs`, `src`, `public` (grep `ClientRouter|view-transitions|Content-Security|csp`, 0 trafień) — nie trzeba obsługiwać `astro:after-swap` ani nonce dla skryptu inline na sprawdzonej ścieżce.
- Middleware nie ustawia nagłówków odpowiedzi (`src/middleware.ts`, całość przeczytana), więc nic nie blokuje skryptu inline.

### Tokeny i kontrast

- Jasny motyw jest w `:root` (`global.css:6–54`); `bg-cosmic` używa `--background` i `--background-glow` (`global.css:149–151`), więc gradient tła zmienia się razem z motywem.
- Kontrast ≥ 4,5:1 dla par jasnego motywu jest udokumentowany w `context/archive/2026-10-17-ui-palette/tokens.md` (sekcje „Odstępstwa od palety”, „Kontrast”); issue #22 powołuje się na to samo. Nie sprawdzano ponownie obliczeń.
- `ui-palette` świadomie zostawiło `class="dark"` (`context/archive/2026-10-17-ui-palette/plan.md:52`: „Włączenie jasnego motywu: `:root` dostaje wartości, ale `class="dark"` zostaje”) — przełącznik jest zatem zaplanowanym następnym krokiem.

### Nagłówek i miejsce przełącznika

- `src/components/AppHeader.astro:9–20` — prawa strona: e-mail + formularz „Wyloguj” w `div.flex.items-center.gap-3`. Przełącznik naturalnie trafia obok „Wyloguj”.
- Przycisk: `buttonVariants({ variant: "outline", size: "sm" })` (`AppHeader.astro:15`); w `button.tsx` są warianty i rozmiary — przed dodaniem `size: "icon"` trzeba sprawdzić, czy istnieje (`src/components/ui/button.tsx` tu nie czytano w całości; sprawdzono tylko linie z `dark`).
- `lucide-react` jest zależnością (`package.json:34`) i używany w `KitchenSink.tsx:2` (`SlidersHorizontal, X`) — ikony słońce/księżyc są dostępne.
- Reguły projektu: hooki React w `src/components/hooks/` (jedyny dziś: `usePantryMatch.ts`), brak `"use client"` (`AGENTS.md`, Coding Style). Przełącznik może być wyspą React (`client:load`) albo małym skryptem w `.astro`; to decyzja do planu.

### Strony logowania — kolory literalne (blokada)

- `src/pages/auth/signin.astro:13–21`, `signup.astro:13–21`, `confirm-email.astro:23–29` — `border-white/10 bg-white/10 text-white`, gradient `from-blue-200 to-purple-200`, `text-blue-100/60|80`, `text-purple-300`.
- `src/components/auth/FormField.tsx:6,39,43,56,62`, `PasswordToggle.tsx:13`, `SignUpForm.tsx:72`, `SubmitButton.tsx:18,22` — `bg-white/10`, `text-white`, `placeholder-white/40`, `text-blue-100/80`, `border-red-400/60`, `text-red-300`, `bg-purple-600`. `ServerError.tsx` jest czysty (jest w `CLEAN_FILES`); `SignInForm.tsx` nie zawiera trafień grepa na kolory literalne (sprawdzono grepem po `white|blue|purple|red-|slate|gray`).
- Żaden z tych plików nie jest w `CLEAN_FILES` (`scripts/check-ui-literals.mjs:11–22`: 10 plików, w tym `AppHeader`, `AppLayout`, `index.astro`, `KitchenSink`, `ServerError`). Po przejściu na tokeny należy je dopisać do listy (reguła z `AGENTS.md`, sekcja UI).
- Skutek dla jasnego motywu (wniosek, nie obserwacja z przeglądarki): `text-white` na karcie `bg-white/10` nad jasnym `bg-cosmic` daje niski kontrast. Nie uruchamiano aplikacji ani zrzutów.

### Kitchen sink

- `src/pages/dev/kitchen-sink.astro` renderuje `KitchenSink` w `AppLayout`, więc po dodaniu przełącznika do `AppHeader` będzie on dostępny na kitchen sink i pozwoli zrobić zrzuty w obu trybach.
- Sekcja „Formularze logowania” (`KitchenSink.tsx:~216–242`) osadza `SignInForm`/`SignUpForm` w `bg-cosmic rounded-2xl p-6` — czyli zawiera te same literalne kolory; w jasnym trybie pokaże problem, a po poprawce posłuży jako dowód.
- Wcześniejsze zrzuty: `context/archive/2026-10-17-ui-palette/screenshots/{before,after}` — wzorzec do naśladowania (nazewnictwo nie sprawdzane szczegółowo).
- Nowy stan komponentu → dodać do kitchen sink (`AGENTS.md`, UI); stany przełącznika (ikona słońce/księżyc) wchodzą w to.

### Testy i CI

- Vitest łapie `src/**/*.test.ts` i `scripts/**/*.test.ts` (`AGENTS.md`, Testing). Logika wyboru motywu (system vs. zapisany wybór) może być czystą funkcją w `src/lib/` z testem; nie istnieje jeszcze `jsdom`/testing-library w `package.json` (grep `jsdom|testing-library` — 0 trafień), więc testy DOM nie są dostępne bez nowej zależności.
- `scripts/smoke.mjs` sprawdza m.in. że `/auth/signin` zwraca 200 (`smoke.mjs:44`) — nie wpływa na motyw.

## Code References

- `src/layouts/Layout.astro:14` — `class="dark"` na sztywno; `Layout.astro:15–19` — `<head>` bez skryptów.
- `src/layouts/AppLayout.astro:12–19` — opakowuje `Layout`, renderuje `AppHeader`.
- `src/components/AppHeader.astro:9–20` — prawa strona nagłówka (e-mail + Wyloguj).
- `src/styles/global.css:4` — `@custom-variant dark (&:is(.dark *))`; `:6–54` jasne tokeny; `:56–104` ciemne; `:149–151` `bg-cosmic`.
- `src/pages/auth/{signin,signup,confirm-email}.astro` — literalne kolory (linie w sekcji wyżej).
- `src/components/auth/{FormField,PasswordToggle,SignUpForm,SubmitButton}.tsx` — literalne kolory.
- `scripts/check-ui-literals.mjs:11–22` — `CLEAN_FILES`.
- `src/components/dev/KitchenSink.tsx:~216–242` — sekcja formularzy logowania.

## Architecture Insights

- Motyw = klasa `dark` na `<html>` + tokeny CSS; komponenty nie powinny znać trybu (reguła „brakujący wygląd to nowy wariant w `ui/`, nie kolor w `className`”, `AGENTS.md`).
- `Layout.astro` jest jedynym punktem wejścia dla `<head>` — jeden skrypt inline pokrywa auth i aplikację.
- Strażnik `check:ui` działa tylko na plikach z `CLEAN_FILES`; strony auth są poza nim, stąd się „rozjechały” z resztą po `ui-palette`.

## Historical Context (from prior changes)

- `context/archive/2026-10-17-ui-palette/plan.md:52` — świadoma decyzja: tokeny jasnego motywu gotowe, `class="dark"` zostaje do osobnej zmiany (ta zmiana). Zachowuje się: jasne wartości są w `global.css` (potwierdzone).
- `context/archive/2026-10-17-ui-palette/tokens.md` — źródła wartości i kontrast; wymagane przez `AGENTS.md` jako rejestr tokenów. Jeśli plan doda tokeny (np. dla kart auth), rejestr trzeba będzie uzupełnić — ale `context/archive/` jest tylko do odczytu, więc nowy rejestr należałoby prowadzić w `context/changes/theme-toggle/` (do decyzji w planie).
- `context/archive/2026-10-14-ui-pantry-tokens` — wcześniejszy etap migracji na tokeny (wspomniany w `AGENTS.md`); nie czytano szczegółowo.
- `context/foundation/lessons.md` — 4 wpisy; żaden nie dotyczy UI/motywu (dotyczą zamykania issue, asercji w CI i limitów CPU). Pasuje tylko „Closes #22” w PR.

## Related Research

- `context/archive/2026-10-17-ui-palette/research.md` — audyt palety (nie czytano w całości).

## Open Questions

1. **Zakres auth**: czy przejście stron logowania na tokeny wchodzi do tej zmiany (rekomendacja: tak — bez tego wymóg „przełącznik na stronach logowania” daje nieczytelny jasny tryb), czy osobna zmiana?
2. **Forma przełącznika**: dwustanowy (jasny/ciemny) czy trójstanowy (system/jasny/ciemny)? Issue mówi „domyślnie system, wybór zapamiętany” — dwustanowy wystarcza, ale nie da powrotu do „system” po pierwszym kliknięciu.
3. **Reakcja na zmianę ustawienia systemu**: czy bez zapisanego wyboru nasłuchiwać `matchMedia('(prefers-color-scheme: dark)')` na żywo? Issue tego nie wymaga.
4. **Zachowanie bez JS / bez localStorage**: nie ustalono — dziś domyślnie ciemny; po zmianie fallback powinien być wybrany świadomie (np. ciemny jak dziś), a odczyt `localStorage` należy owinąć w try/catch.
5. **Rozmiar `icon` w `button.tsx`** — do sprawdzenia w planie.
6. **Gdzie przełącznik na stronach auth**: karta jest wyśrodkowana na pełnym ekranie, bez nagłówka — pozycja (np. prawy górny róg strony) do decyzji.
7. **Kolor motywu przeglądarki** (`<meta name="color-scheme">` / `theme-color`) — nie istnieje dziś; nie ustalono, czy ma wchodzić w zakres.
