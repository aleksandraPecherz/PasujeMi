# card-style (#21): karta neo-brutal i Banner na tokenach — plan implementacji

## Overview

Dodajemy do `src/components/ui/` wygląd „neo-brutal”: kartę z ramką 2px w `--foreground` i twardym cieniem `6px 6px 0`
oraz przycisk, który wciska się przy kliknięciu. Stosujemy go na kafelku przepisu (`RecipeTile`) i na kartach auth
(`signin`, `signup`, `confirm-email`). Przy okazji przenosimy `Banner.astro` z literałów hex na tokeny i dopisujemy go
do `CLEAN_FILES`. Zmiana jest czysto wizualna: bez migracji i bez API. PR zamyka #21.

## Current State Analysis

- W `ui/` nie ma karty. Każda karta w widokach to ręczny zestaw `border-border bg-card rounded-2xl border`
  (14 miejsc, `research.md` → „Granica z S-07 i reszta kart”).
- `RecipeTile.tsx:48` — kafelek `rounded-2xl border` z `hover:border-ring hover:bg-accent transition-colors`. Cały
  kafelek jest linkiem: `<a>` w tytule ma `after:absolute after:inset-0 after:rounded-2xl`, a fokus to
  `focus-visible:after:ring-2` na pseudo-elemencie (`:50-55`).
- `signin.astro:17`, `signup.astro:17`, `confirm-email.astro:27` — ta sama karta z `backdrop-blur-xl`, które przy
  pełnym `bg-card` nic nie daje.
- `SubmitButton.tsx:15` — `<Button type="submit" className="w-full">` z domyślnym wariantem. Używają go
  `SignInForm.tsx:90` i `SignUpForm.tsx:144`.
- `Banner.astro` — 3 warianty i 9 literałów hex w `<style>` (`:27-41`). Jedyne wywołanie to `Layout.astro:27`
  z `variant="error"`. Pliku nie ma w `CLEAN_FILES`.
- `global.css:101-149` — `@theme inline` bez żadnego `--shadow-*`. `--radius: 0.425rem`, więc `rounded-lg` ≈ 6.8px.
- `PantryStates.tsx:49` — szkielet kafelka `h-40 rounded-2xl`.
- Wzorzec wariantów `ui/` w Astro: `AppHeader.astro` i `NotFoundView.astro` importują `buttonVariants` i wstawiają
  je przez `class:list`.

## Desired End State

- `npx shadcn add card` dodało `ui/card.tsx`, rozszerzone o eksport `cardVariants` z wariantami `default` i `brutal`.
- `button.tsx` ma wariant `pressable`: ramka 2px, cień `shadow-brutal-sm`, przy `:active` przesuwa się o 3px i traci
  cień.
- `global.css` publikuje tokeny `--shadow-brutal` i `--shadow-brutal-sm` przez `@theme inline` (cień w kolorze
  `--foreground`, przełącza się z motywem). Utility to `shadow-brutal` i `shadow-brutal-sm`.
- `RecipeTile` używa `cardVariants({ variant: "brutal" })` z `rounded-lg`. Hover jest jak dziś, bez wciskania,
  `after:rounded-lg` pasuje do karty. Szkielet listy też ma `rounded-lg`.
- Trzy strony auth używają `cardVariants({ variant: "brutal" })` przez `class:list`, bez `backdrop-blur-xl`. Przycisk
  logowania i rejestracji ma wariant `pressable` przez nowy prop `variant` w `SubmitButton`. Pola formularza bez zmian.
- `Banner.astro` nie ma bloku `<style>` z kolorami. Bierze klasy z `ui/banner.ts` (`bannerVariants`, tylko `error`)
  i jest w `CLEAN_FILES`.
- Kitchen sink pokazuje: Banner (w `kitchen-sink.astro`), przycisk `pressable` w stanach default / disabled /
  pending, kartę auth z formularzem logowania, nowy kafelek i szkielet.
- `npm run lint`, `npx astro check`, `npm run check:ui`, `npm test` i `npm run build` przechodzą.

### Key Discoveries:

- `check-ui-literals.mjs:51` łapie `shadow-[…]` jako wartość arbitralną, a `:53` łapie paletę (`shadow-black`).
  Nazwa `shadow-brutal` nie trafia w żaden regex.
- `--spacing: 0.25rem` (`node_modules/tailwindcss/theme.css:325`), więc `translate-x-0.75` = 3px bez wartości
  arbitralnych.
- `button.tsx:8` ma w bazie `rounded-md` i `transition-all`. Rozmiary `sm` i `lg` (`:25-26`) dopisują `rounded-md`
  **po** wariancie, więc `rounded-lg` z wariantu `pressable` działa tylko z rozmiarem `default`. Ten rozmiar ma
  `SubmitButton`.
- `src/components/ui/` nie jest skanowany przez `check:ui`. Nowe warianty muszą używać wyłącznie tokenów z dyscypliny,
  nie z narzędzia (`AGENTS.md`, sekcja UI).
- `KitchenSink` to wyspa React (`kitchen-sink.astro:10`), więc komponent Astro `Banner` trzeba wstawić w stronę
  `.astro`, poza wyspą.

## What We're NOT Doing

- Strona szczegółów przepisu (`RecipeDetails.tsx`, `pages/recipes/[id].astro`, `[id]/edit.astro`,
  `RecipeAuthorActions.tsx`) — pracuje tam S-07.
- Pozostałe karty z tym samym zestawem klas (`PantryMatch.tsx:83`, `PantryStates.tsx:41`, `RecipeFormView.tsx`,
  `RecipeSaved.tsx:25`, `NotFoundView.astro:13`, `KitchenSink.tsx:209`) — zostają, nie migrujemy ich na
  `cardVariants`.
- Efekt wciskania na kafelku — kafelek dostaje tylko wygląd karty.
- Pola formularza (`FormField.tsx`, `ui/input.tsx`) i tagi składników na kafelku (`Badge`).
- Warianty Bannera `info` i `warning` — usunięte, bo nikt ich nie używa.
- Nowy token promienia — używamy istniejącego `rounded-lg`.
- Komponent `Card` i jego podkomponenty w widokach — widoki biorą tylko `cardVariants`.
- Migracje, API, `supabase/`.

## Implementation Approach

Najpierw kontrakt (tokeny + warianty w `ui/`), potem widoki, które go tylko wybierają. To ta sama kolejność co
w `ui-palette` i `theme-toggle`. Każda faza kończy się zielonym `check:ui` i stanami w kitchen sink, więc da się ją
obejrzeć osobno. Warianty żyją w `cva` w `ui/`; React bierze je przez `cn(...)`, a Astro przez `class:list`, jak
`buttonVariants` w `AppHeader.astro`.

## Critical Implementation Details

- **Kolejność klas w `cn` na kafelku.** `RecipeTile` łączy `cardVariants({ variant: "brutal" })` z klasami układu
  i hovera. Klasy po wariancie nie mogą nadpisać jego wyglądu: bez `rounded-*`, `border`, `border-*` i `bg-*` bez
  modyfikatora, bo `tailwind-merge` zostawia ostatnią. `hover:border-ring` i `hover:bg-accent` z wariantem nie
  kolidują (inny modyfikator). Wariant `brutal` nie może zawierać `hover:`, bo hover kafelka jest jego własny.
- **Pressable i reduced motion.** `transition-all` z bazy przycisku animuje przesunięcie. Pod `motion-reduce:` wyłącz
  transition (`motion-reduce:transition-none`), ale zostaw samo przesunięcie i zniknięcie cienia. Informacja „wciśnięte”
  zostaje, znika tylko ruch.

## Phase 1: Kontrakt w ui/ i tokeny

### Overview

Tokeny cienia i trzy elementy w `ui/`: karta z wariantami, wariant przycisku i warianty Bannera. Widoki jeszcze się nie
zmieniają.

### Changes Required:

#### 1. Tokeny cienia

**File**: `src/styles/global.css`

**Intent**: Dodać twardy cień jako token, żeby widoki i `ui/` nie miały wartości arbitralnych, a cień zmieniał kolor
z motywem.

**Contract**: W `@theme inline` dwa nowe wpisy: `--shadow-brutal: 6px 6px 0 var(--foreground)` i
`--shadow-brutal-sm: 3px 3px 0 var(--foreground)`. Utility: `shadow-brutal`, `shadow-brutal-sm`. Wartości pochodzą
z galerii stylów (styl „3 · Neo-brutal”, `research.md`). Nic nie trzeba dodawać w `:root` / `.dark`, bo
`--foreground` już tam jest.

#### 2. Karta

**File**: `src/components/ui/card.tsx` (nowy, przez `npx shadcn@latest add card`)

**Intent**: Wspólny wygląd karty w `ui/` zamiast ręcznych zestawów klas.

**Contract**: Eksport `cardVariants` (`cva`) z bazą `bg-card text-card-foreground` i wariantami:
`default` — klasy wyglądu (promień, ramka, cień) z wygenerowanego `card.tsx`, `brutal` —
`rounded-lg border-2 border-foreground shadow-brutal`; `defaultVariants: { variant: "default" }`. Komponent `Card`
przyjmuje `variant` i składa `cardVariants` z pozostałymi (układowymi) klasami wygenerowanego `Card`. Źródłem prawdy
jest plik z `npx shadcn@latest add card`, nie lista klas w planie (dziś np. `rounded-xl border shadow-sm` i
`flex flex-col gap-6 py-6`). Układ nie trafia do
`cardVariants`, żeby kafelek i strony Astro brały sam wygląd. Pozostałe podkomponenty upstream (`CardHeader` itd.)
zostają bez zmian. Tylko tokeny, bez literałów.

#### 3. Wariant przycisku `pressable`

**File**: `src/components/ui/button.tsx`

**Intent**: Przycisk, który wciska się po kliknięciu, jako wariant obok `default`.

**Contract**: Nowy klucz `variant.pressable`: kolory jak `default` (`bg-primary text-primary-foreground
hover:bg-primary-hover`) plus `rounded-lg border-2 border-foreground shadow-brutal-sm active:translate-x-0.75
active:translate-y-0.75 active:shadow-none motion-reduce:transition-none`. Bez `shadow-xs`. Stan `disabled:` z bazy
zostaje (cień widoczny, `opacity-50`).

#### 4. Warianty Bannera

**File**: `src/components/ui/banner.ts` (nowy)

**Intent**: Wygląd Bannera w `ui/` na tokenach, do użycia w Astro przez `class:list`.

**Contract**: Eksport `bannerVariants` (`cva`) i typu `BannerVariant`. Baza: `px-4 py-3 text-center text-sm border-b`
oraz styl linków w środku (`[&_a]:font-semibold [&_a]:underline`; kolor linku dziedziczony). Jedyny wariant:
`error` — `bg-destructive/10 text-destructive border-destructive` (kontrast z `tokens.md`: 4.77 / 5.14).
`defaultVariants: { variant: "error" }`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- UI literal scan passes: `npm run check:ui`
- Production build passes: `npm run build`

#### Manual Verification:

- `src/components/ui/card.tsx`, `button.tsx` i `banner.ts` używają wyłącznie tokenów (bez hex, palety i wartości arbitralnych długości)

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne przed fazą 2.

---

## Phase 2: Banner na tokenach

### Overview

`Banner.astro` przechodzi na `bannerVariants` i trafia pod skaner. Stan pojawia się w kitchen sink.

### Changes Required:

#### 1. Banner

**File**: `src/components/Banner.astro`

**Intent**: Usunąć literały hex i nieużywane warianty, zachowując wygląd błędu i semantykę.

**Contract**: `Props { variant?: BannerVariant }`, domyślnie `"error"`. Element `<div class:list={[bannerVariants({
variant })]} role="alert">` ze slotem. Cały blok `<style>` znika. Wywołanie w `Layout.astro:27` bez zmian.

#### 2. Skaner

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Pilnować, żeby literały nie wróciły do Bannera.

**Contract**: `"src/components/Banner.astro"` dopisane do `CLEAN_FILES`.

#### 3. Kitchen sink

**File**: `src/pages/dev/kitchen-sink.astro`

**Intent**: Pokazać Banner, którego nie da się wstawić do wyspy React.

**Contract**: Nad `<KitchenSink client:load />` sekcja z nagłówkiem i notką w tym samym stylu co `StateSection`
(tylko klasy tokenów) i `<Banner>` z treścią jak w `Layout.astro` (`<strong>Uwaga:</strong>`, komunikat, link).

### Success Criteria:

#### Automated Verification:

- UI literal scan passes with Banner in CLEAN_FILES: `npm run check:ui`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Tests pass: `npm test`

#### Manual Verification:

- Banner w kitchen sink jest czytelny w jasnym i ciemnym motywie, link podkreślony i pogrubiony
- Banner pojawia się na stronie przy brakującym `SUPABASE_URL` (np. tymczasowo pusty w `.dev.vars`)

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne przed fazą 3.

---

## Phase 3: Kafelek przepisu

### Overview

`RecipeTile` dostaje wariant karty `brutal`, a szkielet listy ten sam kształt.

### Changes Required:

#### 1. Kafelek

**File**: `src/components/recipes/RecipeTile.tsx`

**Intent**: Nowy wygląd karty bez efektu wciskania, z hoverem jak dziś i pierścieniem fokusu w kształcie karty.

**Contract**: `<article>` dostaje `cn(cardVariants({ variant: "brutal" }), "hover:border-ring hover:bg-accent relative
flex min-w-0 flex-col gap-3 p-4 transition-colors sm:p-5")`. Znika `border-border bg-card rounded-2xl border`.
Na `<a>` `after:rounded-2xl` → `after:rounded-lg`. Bez `active:`.

#### 2. Szkielet

**File**: `src/components/pantry/PantryStates.tsx`

**Intent**: Szkielet ma ten sam kształt co kafelek, żeby lista nie zmieniała kształtu po załadowaniu.

**Contract**: `RecipeListSkeleton`: `h-40 rounded-2xl` → `h-40 rounded-lg`.

#### 3. Kitchen sink

**File**: `src/components/dev/KitchenSink.tsx`

**Intent**: Sekcja kafelka opisuje nowy wygląd.

**Contract**: Notka sekcji „Kafelek przepisu: link” (`:413-421`) wspomina ramkę i cień oraz to, że kafelek nie wciska
się przy kliknięciu. Kafelki i szkielet (`:349`) renderują się już z nowymi klasami.

### Success Criteria:

#### Automated Verification:

- UI literal scan passes: `npm run check:ui`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification:

- Kafelek w kitchen sink i na `/` ma ramkę 2px i twardy cień w obu motywach; cień nie jest ucięty w siatce
- Hover zmienia ramkę na `--ring` i tło na `--accent`; kliknięcie nie przesuwa kafelka
- Pierścień fokusu (Tab) pokrywa rogi kafelka
- Szkielet listy ma ten sam promień co kafelek; ekran po zapisie przepisu (`RecipeSaved`) wygląda poprawnie

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne przed fazą 4.

---

## Phase 4: Karty auth

### Overview

Trzy strony auth dostają kartę `brutal`, a przyciski logowania i rejestracji wariant `pressable`. Reguła w `AGENTS.md`
utrzymuje następnego agenta przy kontrakcie.

### Changes Required:

#### 1. Strony auth

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Nowy wygląd karty na wszystkich trzech stronach, bo mają ten sam zestaw klas.

**Contract**: Karta to `class:list={[cardVariants({ variant: "brutal" }), "w-full max-w-sm p-8"]}` (na
`confirm-email` dodatkowo `text-center`). Znikają `rounded-2xl border border-border bg-card text-card-foreground
backdrop-blur-xl`. Import `cardVariants` z `@/components/ui/card`, jak `buttonVariants` w `AppHeader.astro`.

#### 2. SubmitButton

**File**: `src/components/auth/SubmitButton.tsx`

**Intent**: Wariant przycisku wybiera wywołujący.

**Contract**: Nowy opcjonalny prop `variant?: React.ComponentProps<typeof Button>["variant"]` (bez nowego eksportu
z `ui/button.tsx`), przekazany do `<Button>`. Bez propa przycisk zostaje `default`.

#### 3. Formularze

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`

**Intent**: Przycisk na karcie auth wciska się.

**Contract**: `<SubmitButton variant="pressable" …>`. Pola formularza bez zmian.

#### 4. Kitchen sink

**File**: `src/components/dev/KitchenSink.tsx`

**Intent**: Pokazać nowe stany: kartę auth i przycisk `pressable`.

**Contract**: Sekcja „Formularze logowania” (`:461-480`): formularze w `bg-cosmic` dostają w środku kartę
`cardVariants({ variant: "brutal" })` z `p-8`, jak na stronie. Nowa sekcja „Przycisk wciskany” z `Button
variant="pressable"` w stanach default i disabled oraz notką: najedź (hover), przytrzymaj (active), Tab
(focus-visible). Stan pending widać w formularzach (`SubmitButton`).

#### 5. Reguła dla agentów

**File**: `AGENTS.md`

**Intent**: Następny agent użyje kontraktu zamiast przepisać klasy.

**Contract**: W sekcji UI jedna linia: wygląd neo-brutal to `cardVariants({ variant: "brutal" })` z `ui/card.tsx`
i `Button variant="pressable"`, cienie to tokeny `shadow-brutal` / `shadow-brutal-sm` z `global.css`. Stosowane tylko
na `RecipeTile` i kartach auth.

### Success Criteria:

#### Automated Verification:

- UI literal scan passes: `npm run check:ui`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Tests pass: `npm test`
- Production build passes: `npm run build`
- Auth smoke test passes against the dev server: `npm run smoke`

#### Manual Verification:

- `/auth/signin`, `/auth/signup`, `/auth/confirm-email` mają kartę z ramką i cieniem w obu motywach
- Przycisk logowania i rejestracji przesuwa się o 3px i traci cień przy kliknięciu; przy reduced motion bez animacji
- Fokus klawiaturą na przycisku jest widoczny; stan pending i disabled są czytelne
- Pola formularza wyglądają jak przed zmianą
- Kitchen sink pokazuje kartę auth i przycisk wciskany

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne. PR musi mieć
w opisie „Closes #21” (`lessons.md`).

---

## Testing Strategy

### Unit Tests:

- Brak nowych testów jednostkowych: zmiana nie ma logiki. Ochronę przed literałami daje `check:ui` z Bannerem
  w `CLEAN_FILES`. Istniejące testy (`npm test`) muszą przejść.

### Integration Tests:

- `npm run smoke` — logowanie i rejestracja działają po zmianie `SubmitButton`.

### Manual Testing Steps:

1. `npm run dev`, otwórz `/dev/kitchen-sink` w jasnym i ciemnym motywie: Banner, kafelki, szkielet, karta auth, przycisk.
2. Na `/` najedź na kafelek, kliknij go (bez przesunięcia), przejdź Tab-em (pierścień w rogach).
3. Na `/auth/signin` przytrzymaj przycisk (wciśnięcie), włącz reduced motion w DevTools i powtórz.
4. Na telefonie (DevTools 375px): cień kafelka i karty auth nie powoduje poziomego przewijania.

## Performance Considerations

Brak. `backdrop-blur-xl` znika, więc strony auth renderują się odrobinę taniej.

## Migration Notes

Nie dotyczy.

## References

- Research: `context/changes/card-style/research.md`
- Wzorzec wariantów w Astro: `src/components/AppHeader.astro`, `src/components/NotFoundView.astro`
- Wzorzec lokalnych wariantów `cva`: `src/components/ui/button.tsx:7-35`, `src/components/ui/badge.tsx:58-80`
- Rejestr tokenów (archiwum, tylko do odczytu): `context/archive/2026-10-17-ui-palette/tokens.md`
- Issue: #21

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Kontrakt w ui/ i tokeny

#### Automated

- [x] 1.1 Type check passes: `npx astro check` — 821245c
- [x] 1.2 Lint passes: `npm run lint` — 821245c
- [x] 1.3 UI literal scan passes: `npm run check:ui` — 821245c
- [x] 1.4 Production build passes: `npm run build` — 821245c

#### Manual

- [x] 1.5 `src/components/ui/card.tsx`, `button.tsx` i `banner.ts` używają wyłącznie tokenów (bez hex, palety i wartości arbitralnych długości) — 821245c

### Phase 2: Banner na tokenach

#### Automated

- [x] 2.1 UI literal scan passes with Banner in CLEAN_FILES: `npm run check:ui` — 67cf065
- [x] 2.2 Lint passes: `npm run lint` — 67cf065
- [x] 2.3 Type check passes: `npx astro check` — 67cf065
- [x] 2.4 Tests pass: `npm test` — 67cf065

#### Manual

- [x] 2.5 Banner w kitchen sink jest czytelny w jasnym i ciemnym motywie, link podkreślony i pogrubiony — 67cf065
- [x] 2.6 Banner pojawia się na stronie przy brakującym `SUPABASE_URL` (np. tymczasowo pusty w `.dev.vars`) — niesprawdzone ręcznie, Layout.astro bez zmian — 67cf065

### Phase 3: Kafelek przepisu

#### Automated

- [x] 3.1 UI literal scan passes: `npm run check:ui` — d124396
- [x] 3.2 Lint passes: `npm run lint` — d124396
- [x] 3.3 Type check passes: `npx astro check` — d124396

#### Manual

- [x] 3.4 Kafelek w kitchen sink i na `/` ma ramkę 2px i twardy cień w obu motywach; cień nie jest ucięty w siatce — d124396
- [x] 3.5 Hover zmienia ramkę na `--ring` i tło na `--accent`; kliknięcie nie przesuwa kafelka — d124396
- [x] 3.6 Pierścień fokusu (Tab) pokrywa rogi kafelka — d124396
- [x] 3.7 Szkielet listy ma ten sam promień co kafelek; ekran po zapisie przepisu (`RecipeSaved`) wygląda poprawnie — d124396

### Phase 4: Karty auth

#### Automated

- [x] 4.1 UI literal scan passes: `npm run check:ui`
- [x] 4.2 Lint passes: `npm run lint`
- [x] 4.3 Type check passes: `npx astro check`
- [x] 4.4 Tests pass: `npm test`
- [x] 4.5 Production build passes: `npm run build`
- [ ] 4.6 Auth smoke test passes against the dev server: `npm run smoke`

#### Manual

- [x] 4.7 `/auth/signin`, `/auth/signup`, `/auth/confirm-email` mają kartę z ramką i cieniem w obu motywach
- [x] 4.8 Przycisk logowania i rejestracji przesuwa się o 3px i traci cień przy kliknięciu; przy reduced motion bez animacji — reduced motion niesprawdzone ręcznie
- [x] 4.9 Fokus klawiaturą na przycisku jest widoczny; stan pending i disabled są czytelne
- [x] 4.10 Pola formularza wyglądają jak przed zmianą
- [x] 4.11 Kitchen sink pokazuje kartę auth i przycisk wciskany
