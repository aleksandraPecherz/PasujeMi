# Soft Modern — fundament, nagłówek i logowanie (#60) Implementation Plan

## Overview

Etap 1 migracji do Soft Modern v2: nowe tokeny obu motywów, Plus Jakarta Sans, płaskie karty i przyciski, nowy nagłówek (z menu konta na telefonie) oraz ekrany logowania, rejestracji i potwierdzenia konta. Pozostałe widoki dziedziczą tokeny i komponenty bez zmiany układu. Bez zmian logiki, bazy i uprawnień.

## Current State Analysis

- Tokeny w `src/styles/global.css` (`:root` / `.dark` → `@theme inline`), `--radius: 0.425rem`, gradient marki (`brand-from/to`), tło `bg-cosmic`, cienie `shadow-brutal*`.
- Neo-brutal jest tylko w `cardVariants` → `brutal` i `Button` → `pressable`. Użycia: `signin/signup/confirm-email.astro`, `RecipeTile.tsx:52`, `SignInForm.tsx:90`, `SignUpForm.tsx:144`, `KitchenSink.tsx` (≈417–501). `bg-cosmic`: `AppLayout.astro:13`, 3 strony auth, KitchenSink.
- Brak fontu (nic nie ładuje Plus Jakarta Sans), `public/` ma tylko `favicon.png` i `template.png`.
- `AppHeader.astro` ma gradientowy tekst logo, e-mail, `ThemeToggle`, „Wyloguj” i „Dodaj przepis” w jednym rzędzie — bez wariantu na telefon.
- `Input` ma `h-9`, `text-base md:text-sm`; `Button` `default` h-9, `lg` h-10, `icon` size-9.

## Desired End State

Logowanie, rejestracja, potwierdzenie konta i nagłówek odpowiadają makietom M01–M04, D01, M21 i „System wyglądu”, w jasnym i ciemnym motywie, na telefonie i komputerze. Kod nie zawiera `brutal`, `pressable`, `shadow-brutal*`, `bg-cosmic` ani gradientowego logo. Weryfikacja: lint, `astro check`, `check:ui`, testy oraz akceptacja wizualna autorki.

### Key Discoveries:

- Wspólna wartość dwóch tokenów w ciemnym motywie (`Oliwka ciemna` i `Mam` = `#2F3A22`) jest zamierzona.
- Wpływ globalny jest ograniczony do 4 plików `ui/` + `global.css`; reszta widoków zmienia się tylko przez tokeny, rozmiar pól i promień.
- `CLEAN_FILES` w `scripts/check-ui-literals.mjs` już obejmuje `AppHeader`, `AppLayout`, `RecipeTile`, `KitchenSink`, `ServerError` — nowe pliki muszą być bez literałów.

## What We're NOT Doing

- Ilustracji (zostają do #61), przebudowy układu pozostałych widoków, zmian logiki, bazy, RLS, uprawnień.
- Nowych narzędzi testowych / wizualnych, subagentów, rozbudowanego mechanizmu menu.
- Automatycznego powiększania wszystkich wariantów przycisków.
- Zmian w `.tmp-style-review/`, `context/archive/`, `context/foundation/`.

## Implementation Approach

Najpierw fundament (tokeny, font, `ui/`) razem z migracją wszystkich odwołań, żeby po każdej fazie repo przechodziło lint i build. Potem nagłówek, potem ekrany auth, na końcu reguły i kitchen sink. Wartości kolorów z makiet (hex → `oklch`, 1:1): jasny — tło `#F7F4EC`, karta `#FFFFFF`, pole/drugorzędne `#EFEBE0`, linia `#E6E1D3`, tekst `#24261F`, tekst drugorzędny `#5B5E52`, oliwka `#4D6A25`, oliwka jasna `#E7EDD8`, mam `#E4ECD3`, stałe `#F5E9CC`, wykluczam `#F6DDD6`, błąd `#A33A24`; ciemny — `#1A1C17`, `#23261F`, `#2C3027`, `#393D33`, `#ECEAE0`, `#B5B3A6`, `#A9C47A`, `#2F3A22`, `#2F3A22`, `#3D3320`, `#43251F`, `#F08F78`. Mapowanie na istniejące nazwy tokenów (`have`, `staple`, `exclude`, `destructive`…) zostaje; panel logowania używa oliwki jasnej/ciemnej.

## Critical Implementation Details

- **Rozmiary:** główne akcje 48 px = `Button` `size="lg"` (zmiana h-10 → h-12) używany na ekranach auth; `icon` 44 px; `default`/`sm` zostają kompaktowe. Pola `Input` 48 px, tekst 16 px (także na desktopie). To jedyna zmiana globalna widoczna w formularzach przepisu — sprawdzić wizualnie `/recipes/new` i edycję.
- **Menu konta (telefon):** natywny, dostępny z klawiatury element (`<details>`/`<summary>` albo atrybut `popover`) zawierający e-mail, „Dodaj przepis”, przełącznik motywu i „Wyloguj”; bez własnej biblioteki. Formularz wylogowania zachowuje `data-signout` i `endListState`.
- **Fokus:** wariant `pressable` miał własny outline; nowe warianty zachowują widoczny `focus-visible`.

## Faza 1: Fundament — tokeny, font, komponenty `ui/`

### Overview

Nowa paleta, font, promienie, płaskie karty/przyciski/pola oraz migracja wszystkich odwołań do usuwanych wariantów.

### Changes Required:

#### 1. Tokeny i font

**File**: `src/styles/global.css`, `src/layouts/Layout.astro`, `package.json`

**Intent**: Podmienić wartości obu motywów na paletę z makiet, ustawić `--radius` na 12 px (sm/md/lg/xl wynikają z niego), dodać `--font-sans` i token jasnego panelu auth; usunąć `shadow-brutal*`, `bg-cosmic`, `brand-from/to` i `background-glow`. Zainstalować `@fontsource-variable/plus-jakarta-sans` (zaakceptowana zależność) i zaimportować lokalnie.

**Contract**: nazwy istniejących tokenów bez zmian; usunięte: `shadow-brutal`, `shadow-brutal-sm`, `bg-cosmic`, `brand-*`, `background-glow`.

#### 2. Komponenty `ui/`

**File**: `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`

**Intent**: Usunąć `pressable` i `brutal`; karta `default` płaska (kolor, bez ramki i cienia), wariant główny przycisku płaski, `lg` = 48 px, `icon` = 44 px, `Input` 48 px / 16 px, ramka `--border`, wyraźny fokus i stan błędu.

**Contract**: `buttonVariants`/`cardVariants` bez usuniętych kluczy; pozostałe warianty bez zmian nazw.

#### 3. Migracja odwołań

**File**: `SignInForm.tsx`, `SignUpForm.tsx`, `RecipeTile.tsx`, `AppLayout.astro`, `signin/signup/confirm-email.astro`, `KitchenSink.tsx`

**Intent**: Zamienić `variant="pressable"` na domyślny z `size="lg"`, `variant: "brutal"` na `default`, `bg-cosmic` na `bg-background`; w `RecipeTile` zmienić tylko styl karty. Usunąć z kitchen sinka sekcje brutal/pressable i opisy (uzupełnia je Faza 4). Układ stron auth jeszcze bez zmian.

### Success Criteria:

#### Automated Verification:

- `grep -rE "brutal|pressable|bg-cosmic|brand-(from|to)" src` zwraca 0 trafień
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro sync && npx astro check`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Strona główna, szczegóły i formularz przepisu w obu motywach są czytelne, bez zepsutego układu
- Pola i przyciski mają widoczny fokus z klawiatury

---

## Faza 2: Nagłówek i menu konta

### Overview

Nowy nagłówek 56 px (telefon) i desktopowy, z logo-liściem i menu konta na telefonie.

### Changes Required:

#### 1. Nagłówek

**File**: `src/components/AppHeader.astro` (+ ewentualny mały komponent menu w `src/components/`)

**Intent**: Logo (ikona liścia w oliwkowym kwadracie + `PasujeMi` tekstem w kolorze `foreground`), na desktopie rząd jak dziś w nowym stylu, na telefonie ikony: „+” (Dodaj przepis) i menu konta z e-mailem, motywem i wylogowaniem.

**Contract**: wylogowanie nadal `POST /api/auth/signout` z `data-signout`; `aria-current` na „Dodaj przepis”; menu zamykane klawiszem Esc lub przez natywne zachowanie, nawigowalne Tab.

### Success Criteria:

#### Automated Verification:

- `npm run lint` i `npm run check:ui` przechodzą
- `npx astro check` przechodzi

#### Manual Verification:

- Nagłówek odpowiada M05/M21 na telefonie i komputerze, w obu motywach
- Menu konta obsługuje Tab, Enter/Spacja i Esc; wylogowanie działa i czyści stan listy

---

## Faza 3: Logowanie, rejestracja, potwierdzenie konta

### Overview

Układ dwukolumnowy na komputerze, pas z hasłem u góry na telefonie; bez ilustracji.

### Changes Required:

#### 1. Strony auth

**File**: `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro`

**Intent**: Jasny panel (tło, logo, hasło „Gotuj z tego, co już masz w domu.” i podtytuł) + kolumna formularza; link „Załóż konto” (ujednolicony wszędzie), link „Zaloguj się” na rejestracji; przełącznik motywu jako tekstowy link „Ciemny motyw” na dole.

**Contract**: bez zmian akcji formularzy i parametrów zapytania (`error`, `email`).

#### 2. Formularze

**File**: `src/components/auth/FormField.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`, `SubmitButton.tsx`, `ServerError.tsx`

**Intent**: Pola bez ikon wewnątrz (jak w makiecie), etykiety nad polem, błąd pola z ikoną wg M02, pełna szerokość przycisku 48 px, zachowane stany pending i walidacja.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test` przechodzą
- Smoke przepływu logowania z działającym serwerem: `BASE_URL=http://localhost:4321 npm run smoke`

#### Manual Verification:

- Ekrany odpowiadają M01–M04 i D01 (bez ilustracji) w obu motywach na telefonie i komputerze
- Błędny e-mail/hasło, błąd serwera, pending i przełącznik hasła działają jak dotąd

---

## Faza 4: Reguły i kitchen sink

### Overview

Zamknięcie zmiany: reguły UI i demonstracja stanów.

### Changes Required:

#### 1. Reguły i strażnik

**File**: `AGENTS.md`, `scripts/check-ui-literals.mjs`

**Intent**: Zamienić regułę neo-brutal na opis Soft Modern (płaskie karty, kolor zamiast cienia, rozmiary 48/44); dodać nowe pliki auth/menu do `CLEAN_FILES`.

#### 2. Kitchen sink

**File**: `src/components/dev/KitchenSink.tsx`

**Intent**: Dodać nowe stany: przyciski (główny, drugorzędny, tekstowy, usuwający, nieaktywny, ikonowy), pola (zwykłe, aktywne, błąd), karta płaska, tagi mam/stałe/wykluczam.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`, `npm run build` przechodzą

#### Manual Verification:

- Autorka akceptuje całość wizualnie (telefon + komputer, jasny + ciemny)

---

## Testing Strategy

### Unit Tests:

- Brak nowych testów — nie zmieniamy zachowania ani zapisu danych; istniejące testy muszą przejść.

### Manual Testing Steps:

1. Zaloguj się, wyloguj, zarejestruj konto (e-mail potwierdzenie wyłączone) w obu motywach.
2. Menu konta na szerokości 320–430 px samą klawiaturą.
3. Przejrzyj `/`, `/recipes/new`, szczegóły przepisu w obu motywach pod kątem odziedziczonego stylu.

## Performance Considerations

Font wariantowy ładowany lokalnie, tylko podzbiory łacińskie (w tym `latin-ext` dla polskich znaków).

## References

- Issue #60; makiety w `.tmp-style-review/` (M01–M05, M21, D01, „System wyglądu”)
- `src/components/ui/button.tsx`, `card.tsx`, `src/styles/global.css`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fundament — tokeny, font, komponenty ui

#### Automated

- [x] 1.1 Brak odwołań do brutal, pressable, bg-cosmic i brand-from/to w src
- [x] 1.2 Lint przechodzi
- [x] 1.3 Typy przechodzą (astro sync + astro check)
- [x] 1.4 Testy przechodzą
- [x] 1.5 Build przechodzi

#### Manual

- [x] 1.6 Widoki dziedziczące styl są czytelne w obu motywach
- [x] 1.7 Pola i przyciski mają widoczny fokus z klawiatury

### Phase 2: Nagłówek i menu konta

#### Automated

- [x] 2.1 Lint i check:ui przechodzą
- [x] 2.2 Typy przechodzą

#### Manual

- [ ] 2.3 Nagłówek odpowiada makietom na telefonie i komputerze w obu motywach
- [ ] 2.4 Menu konta obsługuje klawiaturę, a wylogowanie działa

### Phase 3: Logowanie, rejestracja, potwierdzenie konta

#### Automated

- [x] 3.1 Lint, check:ui, typy i testy przechodzą
- [ ] 3.2 Smoke przepływu logowania przechodzi

#### Manual

- [ ] 3.3 Ekrany auth odpowiadają makietom w obu motywach na telefonie i komputerze
- [x] 3.4 Błędy, pending i przełącznik hasła działają jak dotąd

### Phase 4: Reguły i kitchen sink

#### Automated

- [x] 4.1 Lint, check:ui, typy, testy i build przechodzą

#### Manual

- [ ] 4.2 Autorka akceptuje całość wizualnie
