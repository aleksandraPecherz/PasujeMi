# Przełącznik jasny/ciemny motyw — Implementation Plan

## Overview

Dodajemy dwustanowy przełącznik motywu (jasny/ciemny) w nagłówku aplikacji i w prawym górnym rogu stron logowania (issue #22). Motyw wybiera skrypt inline w `<head>` przed renderem: zapisany wybór z `localStorage`, a bez niego `prefers-color-scheme`. Żeby jasny tryb był czytelny na stronach auth, ta zmiana przenosi też strony i komponenty auth z kolorów literalnych na tokeny (część issue #21; w #21 zostaje `Banner.astro` i nowy styl kart).

## Current State Analysis

- Klasa `dark` jest na sztywno: `<html lang="pl" class="dark">` (`src/layouts/Layout.astro:14`). W `src/` nie ma żadnego skryptu motywu ani przełącznika.
- Warianty CSS są gotowe: `@custom-variant dark (&:is(.dark *))` (`src/styles/global.css:4`), jasne tokeny w `:root` (`:6–51`), ciemne w `.dark` (`:53–97`). Kontrast ≥ 4,5:1 dla par jasnego motywu jest opisany w `context/archive/2026-10-17-ui-palette/tokens.md`.
- `Layout.astro` jest jedynym `<head>` wspólnym dla stron auth (używają `Layout` bezpośrednio) i `AppLayout` (opakowuje `Layout`, `AppLayout.astro:12`). Brak `ClientRouter` i CSP, więc jeden skrypt inline wystarcza.
- Nagłówek (`AppHeader.astro`), `AppLayout.astro` i `index.astro` są na tokenach i w `CLEAN_FILES`.
- Strony `auth/{signin,signup,confirm-email}.astro` oraz `FormField`, `PasswordToggle`, `SignUpForm`, `SubmitButton` w `src/components/auth/` mają kolory literalne pod ciemne tło (`text-white`, `bg-white/10`, `text-blue-100/80`, `text-purple-300`, `bg-purple-600`, `border-red-400/60`) i nie są w `CLEAN_FILES`. W jasnym trybie byłyby nieczytelne. `SignInForm.tsx` i `ServerError.tsx` są już czyste (`SignInForm` nie jest w `CLEAN_FILES`).
- `button.tsx:26` ma rozmiar `icon: "size-9"`; przycisk „Wyloguj” to `size="sm"` (`h-8`, `button.tsx:24`).
- `ui/input.tsx` ma już tokeny, hover, focus ring i `aria-invalid`.
- Vitest łapie `src/**/*.test.ts`; `jsdom` nie ma w `package.json`, więc testy DOM odpadają.

## Desired End State

- `<html>` nie ma stałej klasy `dark`. Przy ładowaniu strony skrypt ustawia motyw: zapisany wybór (`light`/`dark`), a bez zapisu `prefers-color-scheme`. Bez JS strona jest jasna; gdy `localStorage` rzuca wyjątek, motyw bierze się z systemu.
- Przycisk-ikona (księżyc w jasnym, słońce w ciemnym) jest w `AppHeader` obok „Wyloguj” oraz w prawym górnym rogu `signin`, `signup` i `confirm-email`. Kliknięcie przełącza klasę `dark` i zapisuje wybór.
- Strony i komponenty auth używają tylko tokenów, są czytelne w obu trybach i są w `CLEAN_FILES`.
- `<meta name="color-scheme">` i `color-scheme` w CSS są ustawione, żeby kontrolki i paski przewijania pasowały do motywu.
- Kitchen sink ma sekcję przełącznika, a zrzuty kitchen sink i stron auth w obu trybach leżą w `context/changes/theme-toggle/screenshots/`.

Weryfikacja: `npm test`, `npm run lint`, `npx astro check`, `npm run check:ui`, `npm run build` na zielono oraz ręczny przegląd obu trybów.

### Key Discoveries:

- `Layout.astro:14` to jedyne miejsce na klasę i skrypt dla całej aplikacji; `ui-palette` zostawiło `class="dark"` celowo do tej zmiany (`context/archive/2026-10-17-ui-palette/plan.md:52`).
- Wariant `dark:` w Tailwindzie działa po klasie na przodku (`&:is(.dark *)`), więc ikony słońce/księżyc można przełączać samym CSS (`dark:hidden` / `hidden dark:block`). Wyspa nie potrzebuje stanu, więc nie ma rozjazdu hydracji i migania ikony.
- `check:ui` skanuje tylko pliki z `CLEAN_FILES` (`scripts/check-ui-literals.mjs:11–22`); po migracji pliki trzeba tam dopisać.
- Kitchen sink i cała aplikacja poza `/auth/` wymagają logowania (`src/middleware.ts`), więc zrzuty wymagają zalogowanego konta.

## What We're NOT Doing

- Trzeci stan „system” w przełączniku (tylko jasny/ciemny; po pierwszym kliknięciu nie ma powrotu do „system”).
- Nasłuchiwania `matchMedia` na żywo: bez zapisanego wyboru zmiana motywu systemu działa po odświeżeniu strony.
- `Banner.astro` oraz nowego stylu kart (gruba ramka, twardy cień, „wciskany” przycisk) — zostają w #21. Po scaleniu trzeba zawęzić opis #21.
- `<meta name="theme-color">`.
- Zmian w `src/components/ui/` (w tym `button.tsx`; rozmiar `icon` zostaje, jak jest) i nowych tokenów w `global.css`.
- Obsługi `astro:after-swap` (brak `ClientRouter`) oraz nonce/CSP (brak CSP).
- Testów DOM i dodawania `jsdom`.
- Ukrywania przycisku, gdy JS jest wyłączony (bez hydracji przycisk się wyrenderuje, ale nic nie zrobi).

## Implementation Approach

Kolejność idzie od najmniejszego ryzyka: najpierw migracja auth na tokeny, gdy aplikacja jest jeszcze tylko ciemna (czytelność w ciemnym trybie sprawdza się od razu), potem mechanizm motywu bez UI, na końcu przełącznik. Wygląd auth w ciemnym trybie zmieni się celowo: oliwkowa paleta zamiast fioletu i błękitu. Współdzielona logika (klucz `localStorage`, wybór motywu, zapis, skrypt inline) mieszka w `src/lib/theme.ts`, a skrypt inline jest z niej eksportowany jako string, żeby kod ze skryptu `<head>` i testy miały jedno źródło.

## Critical Implementation Details

- **Timing & lifecycle**: skrypt w `<head>` musi być synchroniczny (`is:inline`, bez `type="module"`, bez `defer`), bo Astro przetwarza zwykłe `<script>` jako moduł i przesuwa wykonanie po renderze, co daje FOUC. Odczyt `localStorage` i `matchMedia` w osobnych blokach `try`, żeby wyjątek ze storage nie omijał sprawdzenia systemu (wymóg: gdy `localStorage` nie działa, tryb z systemu). Wartość zapisana inna niż `light`/`dark` traktować jak brak zapisu.

---

## Phase 1: Strony i komponenty auth na tokenach

### Overview

Przenosi trzy strony auth i komponenty formularza na tokeny, bez zmiany logiki. Aplikacja jest jeszcze tylko ciemna, więc wynik sprawdza się w ciemnym trybie; po fazie 3 te same pliki są czytelne w jasnym.

### Changes Required:

#### 1. Strony auth

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Zamienić kolory literalne karty, nagłówka, tekstów pomocniczych i linków na tokeny. Karta dostaje wygląd oparty na kartach aplikacji (`bg-card`, `border-border`, `text-card-foreground`); nowy styl kart zostaje w #21.

**Contract**: Mapowanie: `border-white/10 bg-white/10 text-white` → `border-border bg-card text-card-foreground`; gradient `from-blue-200 to-purple-200` → `from-brand-from to-brand-to`; `text-blue-100/60|80` → `text-muted-foreground`; `text-purple-300` → `text-primary`. Struktura, treści i `client:load` bez zmian.

#### 2. Komponenty formularza

**File**: `src/components/auth/FormField.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/SubmitButton.tsx`

**Intent**: Usunąć kolory literalne. `FormField` ma używać `Input` z `@/components/ui/input` (z `className="pl-10"` na ikonę i `aria-invalid` przy błędzie) zamiast własnej klasy `inputBase`, żeby dostać tokeny, hover, focus ring i stan błędu z `ui/`. `SubmitButton` ma używać domyślnego wariantu `Button` bez nadpisań koloru.

**Contract**: Mapowanie: etykieta `text-blue-100/80` → `text-foreground`; ikona `text-white/40` → `text-muted-foreground`; błąd `text-red-300` → `text-destructive`; podpowiedź hasła w `SignUpForm` (`text-blue-100/50`) → `text-muted-foreground`; `PasswordToggle` `text-white/40 hover:text-white/70` → `text-muted-foreground hover:text-foreground`; `SubmitButton` zostaje z `w-full`, spinner `border-white/30 border-t-white` → `border-primary-foreground/30 border-t-primary-foreground`. Publiczne propsy komponentów bez zmian (`FormField`, `SignInForm`, `SignUpForm` są używane też w kitchen sink).

#### 3. Strażnik literałów

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Dopisać do `CLEAN_FILES` pliki objęte tą fazą, żeby literały nie wróciły.

**Contract**: Dodać: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`, `src/components/auth/FormField.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/SubmitButton.tsx`, `src/components/auth/SignInForm.tsx` (już czysty, dotąd poza listą).

### Success Criteria:

#### Automated Verification:

- Strażnik literałów przechodzi z rozszerzoną listą: `npm run check:ui`
- Linting przechodzi: `npm run lint`
- Type check przechodzi: `npx astro check`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`

#### Manual Verification:

- `/auth/signin`, `/auth/signup`, `/auth/confirm-email` są czytelne w ciemnym trybie (tekst, linki, pola, przycisk, placeholdery).
- Stany formularza w kitchen sink (sekcja „Formularze logowania”): pusty, błąd serwera, błąd pola, podpowiedź „Brakuje jeszcze N znaków”, focus, hover pola, przycisk w stanie `pending` — bez regresji układu.
- Przycisk „Zaloguj się”/„Załóż konto” używa koloru `primary`; nie ma fioletu ani błękitu.

**Implementation Note**: Po zakończeniu fazy i przejściu testów automatycznych zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz dalej. Checkboxy dla tych punktów są w sekcji `## Progress` na dole planu.

---

## Phase 2: Mechanizm motywu

### Overview

Dodaje logikę wyboru motywu i skrypt przed renderem. Bez przełącznika motyw da się już sprawdzić z `prefers-color-scheme` i ręcznie przez `localStorage`.

### Changes Required:

#### 1. Logika motywu

**File**: `src/lib/theme.ts` (nowy), `src/lib/theme.test.ts` (nowy)

**Intent**: Jedno źródło prawdy dla klucza `localStorage`, reguły wyboru motywu, zapisu wyboru i treści skryptu inline. Test dowodzi reguł bez DOM.

**Contract**:

- `THEME_STORAGE_KEY = "theme"`, typ `Theme = "light" | "dark"`.
- `resolveTheme(stored: string | null, systemDark: boolean): Theme` — `"light"`/`"dark"` wygrywa; każda inna wartość i `null` → według `systemDark`.
- `applyTheme(theme: Theme): void` — ustawia/zdejmuje klasę `dark` na `document.documentElement`.
- `saveTheme(theme: Theme): void` — zapis do `localStorage` w `try/catch` (błąd połyka).
- `THEME_INIT_SCRIPT: string` — treść skryptu inline wykonującego to samo co `resolveTheme` + `applyTheme` bez importów (odczyt storage i `matchMedia` w osobnych `try`).
- Test (`src/lib/theme.test.ts`): `resolveTheme` — zapisany `dark`/`light` bije system; `null` i wartość śmieciowa idą za systemem. `THEME_INIT_SCRIPT` uruchomiony z atrapami `localStorage`, `matchMedia` i `document` (np. przez `new Function`) — przypadki: zapis `dark`+system jasny → `dark`; zapis `light`+system ciemny → brak `dark`; brak zapisu + system ciemny → `dark`; `localStorage.getItem` rzuca + system ciemny → `dark`; brak zapisu + system jasny → brak `dark`.

#### 2. Layout

**File**: `src/layouts/Layout.astro`

**Intent**: Zdjąć stałą klasę `dark`, dodać meta `color-scheme` i wstawić skrypt inicjalizujący jako pierwszy element `<head>` po `charset`/`viewport`.

**Contract**: `<html lang="pl">` bez `class`; `<meta name="color-scheme" content="light dark" />`; `<script is:inline set:html={THEME_INIT_SCRIPT} />` w `<head>` przed `<link>`/`<title>` i przed jakimkolwiek `<body>`.

#### 3. CSS

**File**: `src/styles/global.css`

**Intent**: Dopasować kontrolki przeglądarki i paski przewijania do wybranego motywu, niezależnie od meta.

**Contract**: `color-scheme: light` w bloku `:root`, `color-scheme: dark` w bloku `.dark`. Tokeny bez zmian.

#### 4. Strażnik literałów

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Dopisać `src/layouts/Layout.astro` do `CLEAN_FILES` (po zmianie jest bez literałów); jeśli skrypt inline wywoła fałszywy alarm regexu, zmienić zapis skryptu, a nie wyłączać pliku ze skanu.

**Contract**: Wpis `src/layouts/Layout.astro` w `CLEAN_FILES`.

### Success Criteria:

#### Automated Verification:

- Nowe testy motywu przechodzą razem z resztą: `npm test`
- W `Layout.astro` nie ma już stałej klasy: `rg 'class="dark"' src` zwraca 0 trafień
- Strażnik literałów przechodzi: `npm run check:ui`
- Linting przechodzi: `npm run lint`
- Type check przechodzi: `npx astro check`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Bez zapisu w `localStorage`: system ciemny → strona ciemna, system jasny → jasna; przy przeładowaniu nie ma błysku złego motywu.
- `localStorage.setItem("theme","dark")` / `"light"` w konsoli i przeładowanie → motyw zgodny z zapisem, niezależnie od systemu.
- Wyłączony JavaScript → strona jasna.
- Zablokowane dane witryn (localStorage rzuca) → motyw z systemu, brak błędu w konsoli.
- Zmiana motywu systemu przy otwartej karcie, bez zapisu, niczego nie przełącza (zachowanie zamierzone).

**Implementation Note**: Po tej fazie zatrzymaj się na ręczne potwierdzenie. Jasny motyw na stronach auth i w aplikacji staje się widoczny dopiero tu, więc przy okazji obejrzyj obie sekcje.

---

## Phase 3: Przełącznik w UI

### Overview

Dodaje przycisk-przełącznik w nagłówku i na stronach auth, sekcję w kitchen sink, zrzuty w obu trybach i końcowy przegląd kontrastu.

### Changes Required:

#### 1. Komponent przełącznika

**File**: `src/components/ThemeToggle.tsx` (nowy)

**Intent**: Wyspa React bez stanu: `Button` `variant="outline"` `size="icon"` z dwiema ikonami `lucide-react` (`Moon` widoczny w jasnym, `Sun` w ciemnym) przełączanymi samym CSS. Kliknięcie odczytuje bieżący tryb z klasy `dark` na `<html>`, wybiera przeciwny, wywołuje `applyTheme` i `saveTheme` z `@/lib/theme`.

**Contract**: `export default function ThemeToggle()` bez propsów. Ikony: `Moon` z `dark:hidden`, `Sun` z `hidden dark:block`, obie `aria-hidden="true"`. Dostępna nazwa: `aria-label="Przełącz motyw jasny/ciemny"`. Tylko tokeny i warianty `ui/`; bez nowego wariantu w `button.tsx`.

#### 2. Nagłówek aplikacji

**File**: `src/components/AppHeader.astro`

**Intent**: Dodać przełącznik w prawej części nagłówka obok „Wyloguj”.

**Contract**: `<ThemeToggle client:load />` w `div.flex.items-center.gap-3`, przed formularzem wylogowania. Należy ocenić wzrokowo różnicę wysokości `icon` (`size-9`) względem „Wyloguj” (`h-8`); zmian w `button.tsx` nie robimy w tej zmianie.

#### 3. Strony auth

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Dodać przełącznik w prawym górnym rogu strony.

**Contract**: Kontener strony dostaje `relative`; wewnątrz `<div class="absolute top-4 right-4"><ThemeToggle client:load /></div>`. Układ karty bez zmian.

#### 4. Kitchen sink

**File**: `src/components/dev/KitchenSink.tsx`, `scripts/check-ui-literals.mjs`

**Intent**: Pokazać przełącznik jako nową sekcję (`StateSection`) z opisem stanów: default, hover, focus-visible, ikona w obu trybach (kliknięcie pokazuje drugi stan). Dopisać `src/components/ThemeToggle.tsx` do `CLEAN_FILES`.

**Contract**: Nowa sekcja „Przełącznik motywu” w `KitchenSink`; wpis w `CLEAN_FILES`. Opis aktualizujący zdanie wstępne strony tylko jeśli liczba sekcji jest tam wymieniona.

#### 5. Zrzuty

**File**: `context/changes/theme-toggle/screenshots/{light,dark}/` (nowe)

**Intent**: Dowód wizualny w obu trybach według wzorca `context/archive/2026-10-17-ui-palette/screenshots`.

**Contract**: Po jednym zrzucie w każdym trybie: kitchen sink (cała strona, zalogowany), `/auth/signin`, `/auth/signup`, `/auth/confirm-email`.

### Success Criteria:

#### Automated Verification:

- Strażnik literałów przechodzi: `npm run check:ui`
- Linting przechodzi: `npm run lint`
- Type check przechodzi: `npx astro check`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Przełącznik działa w nagłówku i na każdej z trzech stron auth; wybór jest zachowany po przeładowaniu i przechodzi między `/auth/signin` a aplikacją po zalogowaniu.
- Brak błysku złego motywu przy przeładowaniu w obu trybach.
- Przełącznik obsługuje klawiaturę (Tab, Enter/Spacja), ma widoczny focus ring i dostępną nazwę.
- Wysokość `icon` obok „Wyloguj” (`size-9` vs `h-8`) wygląda akceptowalnie; jeśli nie, zanotować jako wniosek, nie zmieniać `button.tsx`.
- Na szerokości 360 × 640 przełącznik w rogu nie zasłania karty auth.
- Kontrast w jasnym trybie ≥ 4,5:1 dla nowo użytych par tekst/tło na karcie auth: `text-primary` na `bg-card`, `text-muted-foreground` na `bg-card`, `text-destructive` na `bg-card`, placeholder na polu.
- Zrzuty kitchen sink i stron auth w obu trybach są zapisane w `context/changes/theme-toggle/screenshots/`.

**Implementation Note**: Po tej fazie zmiana jest gotowa do `/10x-impl-review`. W opisie PR dodaj „Closes #22” i wzmiankę, że część #21 (tokeny auth) została wykonana tutaj.

---

## Testing Strategy

### Unit Tests:

- `resolveTheme`: zapisany wybór bije system; `null` i wartość śmieciowa idą za systemem.
- `THEME_INIT_SCRIPT` z atrapami: pięć przypadków z fazy 2, w tym `localStorage.getItem` rzucający wyjątek.

### Integration Tests:

- Brak automatycznych testów DOM (nie ma `jsdom`); `scripts/smoke.mjs` sprawdza, że `/auth/signin` nadal zwraca 200 i nie wymaga zmian.

### Manual Testing Steps:

1. Z czystym `localStorage` załaduj `/auth/signin` przy systemie ciemnym, potem jasnym — motyw idzie za systemem, bez błysku.
2. Kliknij przełącznik, przeładuj, przejdź do `/auth/signup`, zaloguj się — wybór jest zachowany w aplikacji.
3. Wyłącz JS (DevTools) → strona jasna; zablokuj dane witryn → motyw z systemu, bez błędów w konsoli.
4. Przejrzyj kitchen sink w obu trybach i zrób zrzuty.

## Performance Considerations

Skrypt inline jest mały i synchroniczny; blokuje render na mikrosekundy. Wyspa `ThemeToggle` to jeden przycisk bez stanu.

## Migration Notes

Nie ma danych do migracji. Użytkownicy bez zapisanego wyboru zobaczą motyw zgodny z systemem zamiast dotychczasowego stałego ciemnego, co jest zamierzoną zmianą zachowania z issue #22. Brak nowych tokenów, więc rejestr `tokens.md` z archiwum nie wymaga uzupełnienia. Po scaleniu zawęzić opis issue #21 do `Banner.astro` i nowego stylu kart.

## References

- Related research: `context/changes/theme-toggle/research.md`
- Issue: #22 (zamyka), #21 (część: tokeny auth)
- Poprzednia zmiana: `context/archive/2026-10-17-ui-palette/plan.md:52`, `context/archive/2026-10-17-ui-palette/tokens.md`
- Wzorzec CSS/wariant: `src/styles/global.css:4`
- Wzorzec testu: `src/lib/recipe-count.test.ts`

## Addenda (impl-review 2026-10-18)

- **Autofill w `ui/input.tsx`** (poza zakresem planu): faza 1 dodała regułę `autofill:` (inset box-shadow z `--background`/`--input`, `-webkit-text-fill-color`), bo Chrome maluje autouzupełnione pola tłem UA, ignorując `bg-*`. Zostaje; reguła używa tylko tokenów, ale `check:ui` nie skanuje `ui/`. Wypełnienie to `--background`, nie `bg-card`.
- **Linki na stronach auth**: zamiast `text-purple-300` → `text-primary` używają `text-foreground underline hover:no-underline`. Dlatego `text-primary` na `bg-card` (3.11) nie dotyczy już tekstu na kartach auth.
- **Zrzuty (3.12)**: w `screenshots/` są tylko zrzuty kitchen sink (jasny/ciemny, płasko, bez podkatalogów `light/`/`dark/`). Strony `/auth/signin`, `/auth/signup`, `/auth/confirm-email` sprawdzono ręcznie, bez zapisanych zrzutów.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Strony i komponenty auth na tokenach

#### Automated

- [x] 1.1 Strażnik literałów przechodzi z rozszerzoną listą: `npm run check:ui` — 67b558c
- [x] 1.2 Linting przechodzi: `npm run lint` — 67b558c
- [x] 1.3 Type check przechodzi: `npx astro check` — 67b558c
- [x] 1.4 Testy przechodzą: `npm test` — 67b558c
- [x] 1.5 Build przechodzi: `npm run build` — 67b558c

#### Manual

- [x] 1.6 `/auth/signin`, `/auth/signup`, `/auth/confirm-email` są czytelne w ciemnym trybie (tekst, linki, pola, przycisk, placeholdery) — 67b558c
- [x] 1.7 Stany formularza w kitchen sink (pusty, błąd serwera, błąd pola, podpowiedź hasła, focus, hover pola, przycisk `pending`) bez regresji układu — 67b558c
- [x] 1.8 Przycisk „Zaloguj się”/„Załóż konto” używa koloru `primary`; nie ma fioletu ani błękitu — 67b558c

### Phase 2: Mechanizm motywu

#### Automated

- [x] 2.1 Nowe testy motywu przechodzą razem z resztą: `npm test` — 84fbafb
- [x] 2.2 W `Layout.astro` nie ma stałej klasy: `rg 'class="dark"' src` zwraca 0 trafień — 84fbafb
- [x] 2.3 Strażnik literałów przechodzi: `npm run check:ui` — 84fbafb
- [x] 2.4 Linting przechodzi: `npm run lint` — 84fbafb
- [x] 2.5 Type check przechodzi: `npx astro check` — 84fbafb
- [x] 2.6 Build przechodzi: `npm run build` — 84fbafb

#### Manual

- [x] 2.7 Bez zapisu w `localStorage` motyw idzie za systemem (ciemny/jasny), bez błysku przy przeładowaniu — 84fbafb
- [x] 2.8 `localStorage.setItem("theme", ...)` + przeładowanie → motyw zgodny z zapisem, niezależnie od systemu — 84fbafb
- [x] 2.9 Wyłączony JavaScript → strona jasna — 84fbafb
- [x] 2.10 Zablokowane dane witryn → motyw z systemu, bez błędu w konsoli — 84fbafb
- [x] 2.11 Zmiana motywu systemu przy otwartej karcie, bez zapisu, niczego nie przełącza — 84fbafb

### Phase 3: Przełącznik w UI

#### Automated

- [x] 3.1 Strażnik literałów przechodzi: `npm run check:ui` — ce90ca1
- [x] 3.2 Linting przechodzi: `npm run lint` — ce90ca1
- [x] 3.3 Type check przechodzi: `npx astro check` — ce90ca1
- [x] 3.4 Testy przechodzą: `npm test` — ce90ca1
- [x] 3.5 Build przechodzi: `npm run build` — ce90ca1

#### Manual

- [x] 3.6 Przełącznik działa w nagłówku i na trzech stronach auth; wybór zachowany po przeładowaniu i po zalogowaniu — ce90ca1
- [x] 3.7 Brak błysku złego motywu przy przeładowaniu w obu trybach — ce90ca1
- [x] 3.8 Przełącznik obsługuje klawiaturę, ma widoczny focus ring i dostępną nazwę — ce90ca1
- [x] 3.9 Wysokość `icon` (`size-9`) obok „Wyloguj” (`h-8`) wygląda akceptowalnie — ce90ca1
- [x] 3.10 Na szerokości 360 × 640 przełącznik nie zasłania karty auth — ce90ca1
- [x] 3.11 Kontrast w jasnym trybie ≥ 4,5:1 dla `text-primary`, `text-muted-foreground`, `text-destructive` na `bg-card` i placeholdera na polu — ce90ca1
- [x] 3.12 Zrzuty kitchen sink i stron auth w obu trybach zapisane w `context/changes/theme-toggle/screenshots/` — ce90ca1
