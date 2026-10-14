# Widok spiżarki na tokenach — plan implementacji

## Overview

Widok `/` (layout, nagłówek, spiżarka, kafelki przepisów) przechodzi z literałów Tailwind na semantyczne tokeny
shadcn z `src/styles/global.css` i na niezmienione warianty komponentów z `src/components/ui/`. Ciemna paleta
„cosmic”, którą widok dziś maluje literałami, staje się wartościami `.dark`. Każdy z 7 stanów jest widoczny na
stronie kitchen-sink (tylko dev), a skan literałów w CI pilnuje, żeby kolejny agent nie wrócił do literałów.

## Current State Analysis

Z `research.md` (audyt `/10x-ui`, 2026-10-14, commit `8faa5fd`):

- Kontrakt tokenów jest kompletny i poprawnie podłączony (`global.css:6` `:root`, `:41` `.dark`, `:75` `@theme
inline`), ale martwy: 6 plików widoku ma 25 linii z literałami i 0 klas tokenów.
- Aktywne są jasne, szare wartości `:root`, bo nic nie ustawia `.dark` (`Layout.astro:14,21`); wszystkie klasy
  `dark:` w `ui/` są nieaktywne (`global.css:4`).
- Widok maluje własny motyw: `bg-cosmic` z hex (`global.css:113`), powierzchnie `white/10`, akcent `purple-600`,
  tekst pomocniczy `blue-100/70|80`.
- `cn()` = `twMerge(clsx())` (`src/lib/utils.ts:4-5`), więc literał w `className` po cichu wygrywa z wariantem —
  dlatego `Button`/`Input`/`Badge` są importowane, a i tak wyglądają inaczej.
- Stany: błąd bez `role="alert"` i bez `destructive` (`ServerError.tsx:11`), komunikat limitu sygnalizowany tylko
  kolorem (`PantryMatch.tsx:66`), ładowanie to sam tekst pod listą (`PantryMatch.tsx:106-108`), fokus na
  `Button` to szary `ring-ring/50` na ciemnym tle.
- Ekrany auth (`signin`/`signup`/`confirm-email`) powielają ten sam motyw literałami (C5, odroczone).

## Desired End State

- `<html class="dark">`; paleta „cosmic” żyje w `.dark` i w kilku tokenach ról, opublikowanych przez `@theme
inline`; surowe wartości i ich źródło są zapisane w `context/changes/ui-pantry-tokens/tokens.md`.
- Pliki widoku (lista w Fazie 4) nie zawierają literałów kolorów ani wartości arbitralnych: `npm run check:ui`
  kończy się kodem 0, a CI go uruchamia.
- `Button`, `Badge`, `Input` są używane z wariantami; `className` w miejscu użycia zmienia tylko układ (szerokość,
  odstępy, rozmiar), nie kolor.
- Wszystkie 7 stanów (default, hover, focus-visible, disabled, error, empty, loading) jest widocznych na
  `/dev/kitchen-sink`, a zrzuty desktop i 360 px leżą w folderze zmiany.
- Zachowania z PRD bez zmian: pusta spiżarka = zachęta + 10 przepisów bez %, tagi zielony = mam / szary = brak
  informacji, status składnika także tekstem dla czytnika ekranu, układ działa na telefonie.
- Ekrany auth wyglądają jak przed zmianą (poza drobną zmianą odcienia `ServerError`, patrz Faza 3).

### Key Discoveries:

- `src/styles/global.css:41-73` — `.dark` ma już `--border: oklch(1 0 0 / 10%)`, czyli dokładnie dzisiejsze
  `border-white/10`; reszta wartości do nadpisania.
- `src/components/ui/button.tsx:8` — baza ma `focus-visible:ring-ring/50 ring-[3px]` i `disabled:opacity-50`;
  wariant `outline` (`:16`) ma gotowe `dark:bg-input/30 dark:border-input`, czyli odpowiednik dzisiejszego
  „Pokaż więcej”.
- `src/components/ui/input.tsx:10-12` — `dark:bg-input/30`, `placeholder:text-muted-foreground`, fokus na `ring`.
- `src/components/AppHeader.astro` to Astro, nie React: używa `buttonVariants()` z `@/components/ui/button`.
- `src/middleware.ts:5` — każda strona poza `/auth/` wymaga zalogowania, więc `/dev/kitchen-sink` też.
- `AGENTS.md:24` — komponenty shadcn dodaje się przez `npx shadcn@latest add <name>`; `skeleton` jeszcze nie ma.
- Brak elementu roadmapy z Change ID `ui-pantry-tokens`.

## What We're NOT Doing

- Ekrany auth (`src/pages/auth/*`, `FormField.tsx`, `PasswordToggle.tsx`, `SubmitButton.tsx`, `SignUpForm.tsx`) i
  `Banner.astro` zostają na literałach — osobna zmiana (C5 w `research.md`).
- Jasny motyw ani przełącznik motywu: `:root` zostaje, ale nie jest używany.
- Nowe wartości/nowy wygląd: przenosimy obecną paletę do tokenów, nie projektujemy nowej. Jedyne zamierzone
  różnice wizualne: hover przycisków z wariantów (`primary/90` zamiast `purple-500`), widoczny fokus, szkielet
  przy ładowaniu, ikona przy komunikacie limitu, a także skutki klas `dark:` z `ui/`, które wygrywają z literałami
  (specyficzność `:is(.dark *)`, twMerge ich nie usuwa): tło pól `Input` `input/30` (~6% bieli zamiast 10%),
  przyciski `outline` („Wyloguj”, „Pokaż więcej”) `input/30` / hover `input/50` zamiast `white/10` / `white/20`,
  kolor fokusu (`--ring`, także `outline-ring/50` na linkach auth i `PasswordToggle`) oraz zaznaczenia tekstu w polach
  (`--primary`).
- Przeniesienie `ServerError` z `src/components/auth/` do wspólnego katalogu.
- Playwright i automatyczne porównywanie zrzutów w CI.
- Strona 404 (odroczone F4 z S-01).
- Zmiany w logice: `usePantryMatch`, API, dopasowanie.

## Implementation Approach

Kolejność z `/10x-ui`: biblioteka i tokeny → jeden widok → stany → zabezpieczenie. Faza 1 zmienia tylko warstwę
tokenów i nie dotyka plików widoku, więc `/` po niej wygląda tak samo poza tłem pól `Input` i kolorami fokusu/zaznaczenia
(klasy `dark:` z `ui/` wygrywają z literałami; reszta literałów nadal wygrywa) — to sprawdza, że `.dark` nie psuje
ekranów auth. Faza 2 podmienia literały na tokeny jeden do jednego. Faza 3 dodaje brakujące stany
i kitchen sink, Faza 4 zostawia regułę i skan.

## Critical Implementation Details

- **Wartości tylko w `:root`/`.dark`, nigdy w `@theme inline`.** `@theme inline` publikuje wyłącznie
  `var(--…)`; surowy kolor wpisany tam łamie przełączanie `.dark`.
- **Kolor przez `className` na komponencie z `ui/` to regresja**, bo `twMerge` wygrywa z wariantem bez
  ostrzeżenia. Brakujący wygląd = nowy wariant w `ui/*.tsx`, nie klasa w miejscu użycia.
- **Skan łapie też `-[Npx]`**: w plikach widoku nie używać `ring-[3px]` itp.; fokus pochodzi z bazy komponentu
  albo z `ring-2`.

## Faza 1: Tokeny i biblioteka

### Overview

Paleta „cosmic” staje się aktywnymi tokenami; dochodzą tokeny ról, `skeleton` i warianty ról w `Badge`. Pliki
widoku jeszcze bez zmian.

### Changes Required:

#### 1. Rejestr wartości

**File**: `context/changes/ui-pantry-tokens/tokens.md`

**Intent**: Zapisać w repo, skąd pochodzi każda wartość, żeby kolejna sesja jej nie wymyślała.

**Contract**: Tabela `token | wartość (oklch) | źródło (dzisiejszy literał, plik:linia)`, obejmująca każdy token
z punktu 2. Wartości to przeliczenie dzisiejszych literałów (hex / klasy palety Tailwind v4) na oklch. Osobna
lista „scalone odcienie”: dzisiejsze literały, które trafiają do jednego tokenu (np. `white/80` i `white/60` tagów
kafelka → `muted-foreground`).

#### 2. Wartości tokenów

**File**: `src/styles/global.css`

**Intent**: Przenieść dzisiejszą paletę widoku do `.dark` i dodać tokeny ról, których shadcn nie ma.

**Contract**:

- `.dark` — nadpisać: `--background` (← `#0a0e1a`), `--foreground` (← `white`), `--card` (← `white/10`, z alfą),
  `--card-foreground`, `--muted-foreground` (← `blue-100/70`), `--primary` (← `purple-600`),
  `--primary-foreground` (← `white`), `--input` (← `white/20`), `--ring` (← `purple-400`), `--accent` (← `white/10`
  dla hoverów `ghost`/`outline`); `--border` już pasuje. `--destructive` zostaje wartością shadcn.
- Nowe tokeny w `:root` i `.dark` (w `:root` wartości jasne, rozsądne odpowiedniki): `--background-glow` (←
  `#0f1529`, środkowy przystanek gradientu), `--have` (← `emerald-500`), `--have-foreground` (← `emerald-50`),
  `--staple` (← `blue-500`), `--warning` (← `amber-200`), `--brand-from` (← `blue-200`), `--brand-to` (←
  `purple-200`). Wykluczenia używają `destructive`.
- `@theme inline` — opublikować nowe tokeny jako `--color-background-glow`, `--color-have`,
  `--color-have-foreground`, `--color-staple`, `--color-warning`, `--color-brand-from`, `--color-brand-to`.
- `@utility bg-cosmic` — gradient z `var(--background)` → `var(--background-glow)` → `var(--background)`, bez hex.
- Kontrast `--muted-foreground` i `--warning` na `--background` ≥ 4.5:1 (zapisać zmierzoną wartość w
  `tokens.md`).

#### 3. Ciemny motyw włączony

**File**: `src/layouts/Layout.astro`

**Intent**: Uaktywnić `.dark` i klasy `dark:` z `ui/` na wszystkich stronach.

**Contract**: `<html lang="pl" class="dark">`. Strony auth używają literałów i `bg-cosmic`, więc ich wygląd ma się
nie zmienić — sprawdzane ręcznie.

#### 4. Biblioteka komponentów

**File**: `src/components/ui/skeleton.tsx` (nowy), `src/components/ui/badge.tsx`

**Intent**: Dodać szkielet ładowania ścieżką stosu i warianty `Badge` dla ról dopasowania, żeby widok nie
nadpisywał kolorów.

**Contract**:

- `npx shadcn@latest add skeleton` bez ręcznych przeróbek kolorów.
- `badgeVariants` — nowe warianty: `have` (tło/obramowanie z `have` z alfą, tekst `have-foreground`), `staple`
  (`staple` z alfą, tekst `foreground`), `exclude` (`destructive` z alfą, tekst `foreground`), `muted`
  (`border-border bg-card/50 text-muted-foreground`, dla tagów „brak informacji” / „bez dopasowania”). Istniejące
  warianty bez zmian.

### Success Criteria:

#### Automated Verification:

- Lint, typy, testy i build przechodzą: `npm run lint && npx astro check && npm test && npm run build`
- `<html>` ma klasę `dark`: `grep -c 'class="dark"' src/layouts/Layout.astro` zwraca 1
- `bg-cosmic` nie zawiera hex: `sed -n '/@utility bg-cosmic/,/}/p' src/styles/global.css | grep -cE '#[0-9a-fA-F]{3,8}'` zwraca 0
- `@theme inline` zawiera tylko `var(...)` i `calc(...)`: `sed -n '/@theme inline/,/^}/p' src/styles/global.css | grep -cE 'oklch\(|#[0-9a-fA-F]{3,8}'` zwraca 0
- `src/components/ui/skeleton.tsx` istnieje

#### Manual Verification:

- `/` na desktopie i przy 360 px wygląda tak samo jak przed zmianą (porównanie ze zrzutem sprzed Fazy 1), poza
  tłem trzech pól `TagInput` (`input/30`) oraz kolorem fokusu i zaznaczenia tekstu
- `/auth/signin`, `/auth/signup`, `/auth/confirm-email` wyglądają tak samo jak przed zmianą bez fokusu; z fokusu
  zmienia się tylko kolor obrysu (`--ring`)
- `tokens.md` ma źródło dla każdego tokenu z punktu 2 i zmierzony kontrast `muted-foreground` oraz `warning`

**Implementation Note**: Przed zmianą zrób zrzuty `/` i trzech ekranów auth (desktop + 360 px) do
`context/changes/ui-pantry-tokens/screenshots/before/`. Po fazie poczekaj na ręczne potwierdzenie.

---

## Faza 2: Widok na tokenach

### Overview

Wszystkie literały w plikach widoku zastępują tokeny i warianty. Wygląd ma zostać ten sam, poza zamierzonymi
różnicami z „What We're NOT Doing”.

### Changes Required:

#### 1. Layout i nagłówek

**File**: `src/layouts/AppLayout.astro`, `src/components/AppHeader.astro`

**Intent**: Powłoka `/` czyta tokeny; „Wyloguj” korzysta z tego samego wariantu co reszta przycisków.

**Contract**:

- `AppLayout`: `bg-cosmic text-foreground` (bez `text-white`).
- `AppHeader`: pasek `border-border bg-card/50`; tytuł gradient `from-brand-from to-brand-to`; e-mail
  `text-muted-foreground`; „Wyloguj” = `buttonVariants({ variant: "outline", size: "sm" })` na `<button>`.

#### 2. Spiżarka

**File**: `src/components/pantry/PantryMatch.tsx`, `src/components/pantry/TagInput.tsx`

**Intent**: Sekcje, przyciski, pola i tagi bez literałów kolorów.

**Contract**:

- `SECTIONS`: `tagClassName` zastąpione `badgeVariant: "have" | "staple" | "exclude"`, przekazywanym do
  `TagInput` (prop `tagVariant` zamiast `tagClassName`).
- Karta spiżarki: `bg-card border-border` (+ `backdrop-blur-xl`, `rounded-2xl`, odstępy bez zmian).
- Teksty pomocnicze: `text-muted-foreground`; komunikat limitu (`:66`): `text-warning` (ikona dochodzi w Fazie 3).
- „Zastosuj filtry”: `Button` bez klas kolorów (wariant `default` = `primary`); zostaje `w-full sm:w-auto mt-5`.
- „Pokaż więcej”: `Button variant="outline"`.
- `TagInput`: etykieta `text-muted-foreground`; `Input` bez nadpisań kolorów; `Badge variant={tagVariant}`;
  przycisk × = `Button variant="ghost" size="icon"` ze zmniejszonym rozmiarem (`size-5 rounded-full`), z
  zachowanym `aria-label`.

#### 3. Kafelek przepisu

**File**: `src/components/recipes/RecipeTile.tsx`

**Intent**: Kafelek i tagi składników czytają tokeny; znaczenie kolorów zostaje (zielony = mam, szary = brak
informacji).

**Contract**: `article` — `bg-card border-border`; tytuł `text-card-foreground`; procent `Badge` wariant
`default`; tag „mam” — `Badge variant="have"`; tag „brak informacji” i tag bez dopasowania — `Badge
variant="muted"` bez klas kolorów (dwa dzisiejsze odcienie `white/80` i `white/60` łączą się w jeden — zapisane w
`tokens.md` jako zamierzone); przekreślenie `decoration-muted-foreground`. Teksty `sr-only` bez
zmian.

### Success Criteria:

#### Automated Verification:

- Skan literałów na plikach widoku zwraca 0 linii: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b' src/pages/index.astro src/layouts/AppLayout.astro src/components/AppHeader.astro src/components/pantry/PantryMatch.tsx src/components/pantry/TagInput.tsx src/components/recipes/RecipeTile.tsx | wc -l` zwraca 0
- Lint, typy, testy i build przechodzą: `npm run lint && npx astro check && npm test && npm run build`

#### Manual Verification:

- `/` (desktop i 360 px) wygląda jak zrzut `before/` poza zamierzonymi różnicami z „What We're NOT Doing” (hover
  przycisków, fokus, tło pól, przyciski `outline` „Wyloguj” i „Pokaż więcej”)
- Tagi „Mam w domu” / „Produkty stałe” / „Wykluczam” i tag „mam” na kafelku mają te same kolory co przed zmianą
- Fokus z klawiatury (Tab) jest widoczny na: polach, przycisku ×, „Zastosuj filtry”, „Pokaż więcej”, „Wyloguj”

**Implementation Note**: Po fazie poczekaj na ręczne potwierdzenie.

---

## Faza 3: Stany i kitchen sink

### Overview

Brakujące stany (błąd, komunikat, ładowanie, puste) dostają tokeny i komponenty; wszystkie 7 stanów jest
widocznych naraz na stronie tylko dla dev.

### Changes Required:

#### 1. Błąd

**File**: `src/components/auth/ServerError.tsx`

**Intent**: Błąd jest ogłaszany przez czytnik ekranu i używa tokenu `destructive`.

**Contract**: `role="alert"`; klasy `border-destructive/30 bg-destructive/10 text-destructive`; ikona
`aria-hidden`. Komponent jest współdzielony z formularzami auth — odcień błędu na ekranach logowania zmieni się
nieznacznie (zamierzone, sprawdzane ręcznie).

#### 2. Komunikat limitu, puste stany, szkielet

**File**: `src/components/pantry/PantryMatch.tsx`, `src/components/pantry/PantryStates.tsx` (nowy)

**Intent**: Wydzielić małe komponenty stanów, których używa zarówno widok, jak i kitchen sink, żeby kitchen sink
pokazywał prawdziwy kod.

**Contract**: `PantryStates.tsx` eksportuje:

- `LimitNotice({ message })` — `role="status"`, ikona `TriangleAlert` (`aria-hidden`) + tekst `text-warning`;
  nic nie renderuje przy `null`.
- `EmptyState({ children })` — `rounded-2xl border border-border bg-card/50 p-4 text-muted-foreground`; oba puste
  stany z `PantryMatch.tsx:87-94` go używają (treść bez zmian).
- `RecipeListSkeleton({ count })` — siatka jak lista (`grid gap-4 sm:grid-cols-2`) z `count` kafelkami z
  `Skeleton` o wysokości zbliżonej do kafelka; `aria-hidden`.

`PantryMatch`: przy `loading && recipes.length === 0` renderuje `RecipeListSkeleton count={4}` zamiast pustego
miejsca; przy `loading` z istniejącą listą lista dostaje `opacity-60` (bez zmiany układu); tekst
„Wczytywanie przepisów…” zostaje jako `sr-only` w `role="status"`.

#### 3. Kitchen sink

**File**: `src/pages/dev/kitchen-sink.astro` (nowy), `src/components/dev/KitchenSink.tsx` (nowy)

**Intent**: Jedna strona z widokiem w każdym stanie — bramka wizualna i dowód do przeglądu.

**Contract**:

- Strona zwraca `404` poza `import.meta.env.DEV` (pierwsza instrukcja frontmattera), używa `AppLayout`.
- `KitchenSink` (wyspa `client:load`) pokazuje, z danymi przykładowymi w pliku, sekcje opisane nazwą stanu:
  - default: 3 × `TagInput` z tagami, `RecipeTile` bez dopasowania, z dopasowaniem (mam / brak / wykluczony z
    zamiennikiem), przyciski `default` / `outline` / `ghost`;
  - hover i focus-visible: te same kontrolki, z dopiskiem „najedź / Tab” (stany interaktywne);
  - disabled: `Button disabled`, `TagInput` pełny (30 tagów → pole wyłączone);
  - error: `ServerError` z komunikatem;
  - empty: oba `EmptyState`;
  - loading: `RecipeListSkeleton`, `LimitNotice`.
- Komórka macierzy, której nie da się pokazać, jest opisana na stronie jako „N/A — powód”.

### Success Criteria:

#### Automated Verification:

- Skan literałów (polecenie z Fazy 2) na plikach widoku oraz `src/components/pantry/PantryStates.tsx`,
  `src/components/dev/KitchenSink.tsx`, `src/pages/dev/kitchen-sink.astro`, `src/components/auth/ServerError.tsx`
  zwraca 0 linii
- Strona sprawdza tryb dev: `grep -c 'import.meta.env.DEV' src/pages/dev/kitchen-sink.astro` zwraca 1
- Lint, typy, testy i build przechodzą: `npm run lint && npx astro check && npm test && npm run build`

#### Manual Verification:

- `/dev/kitchen-sink` w `npm run dev` pokazuje wszystkie 7 stanów (lub „N/A — powód”); zrzuty desktop i 360 px w
  `context/changes/ui-pantry-tokens/screenshots/after/`
- `/dev/kitchen-sink` w buildzie produkcyjnym (`npm run preview`) zwraca 404
- Pierwsze wczytanie `/` pokazuje szkielet, a kafelki pojawiają się bez przeskoku układu
- Błąd serwera na `/` (np. zatrzymany Supabase) jest ogłaszany przez czytnik ekranu (`role="alert"`)
- Zamknięcie trzech otwartych kontroli z S-03: komunikat limitu słów widoczny z ikoną, tekst zostaje w polu po
  odrzuconym tagu, „Zastosuj filtry” wyłączony podczas ładowania
- Ekrany auth: jedyną różnicą względem `before/` jest odcień komunikatu błędu

**Implementation Note**: Po fazie poczekaj na ręczne potwierdzenie.

---

## Faza 4: Zabezpieczenie

### Overview

Reguła dla agentów i skan w CI utrzymują kontrakt po tej zmianie.

### Changes Required:

#### 1. Skan literałów

**File**: `scripts/check-ui-literals.mjs` (nowy), `scripts/check-ui-literals.test.ts` (nowy), `package.json`,
`.github/workflows/ci.yml`, `vitest.config.ts`

**Intent**: Zmiana koloru literałem w wyczyszczonym pliku kończy się błędem przed przeglądem.

**Contract**:

- Skrypt ma listę plików `CLEAN_FILES` (pliki widoku z Fazy 2 + nowe z Fazy 3 + `ServerError.tsx`) i regex skanu
  z Fazy 2. Bez argumentów sprawdza całą listę; z argumentami (lint-staged) sprawdza tylko te z listy. Przy
  trafieniu wypisuje `plik:linia: treść` i kończy się kodem 1; eksportuje funkcję `findLiterals(text)` dla
  testu. Argumenty z lint-staged są absolutne (na Windows z `\`): przed porównaniem z `CLEAN_FILES` normalizować je
  przez `path.relative(process.cwd(), p)` i zamianę `\` na `/`. Moduły Node importować przez `node:*` — ESLint
  (`eslint.config.js:76`) zna w `scripts/**/*.mjs` tylko `console`, `process`, `fetch`, `URLSearchParams`.
- Test (Vitest): `findLiterals` znajduje `bg-purple-600`, `text-white/60`, `#0a0e1a`, `p-[13px]`, a nie znajduje
  `bg-primary`, `bg-card/50`, `text-muted-foreground`, `border-border`.
- `vitest.config.ts`: `include` rozszerzone o `scripts/**/*.test.ts` (dziś tylko `src/**/*.test.ts`, więc test w
  `scripts/` nie zostałby uruchomiony).
- `package.json`: skrypt `"check:ui": "node scripts/check-ui-literals.mjs"`; w `lint-staged` dla
  `*.{ts,tsx,astro}` drugi krok `node scripts/check-ui-literals.mjs`.
- CI (`ci.yml`, job z `npm run lint`): krok `npm run check:ui` po `npm run lint`.

#### 2. Reguła UI dla agentów

**File**: `AGENTS.md`

**Intent**: Kolejny agent wie, gdzie są tokeny i komponenty, i nie wraca do literałów.

**Contract**: Nowa sekcja `## UI` (AGENTS.md nie jest nadpisywany przez 10x-cli; nie w `CLAUDE.md`):

- tokeny: `src/styles/global.css` — wartości w `:root`/`.dark`, publikacja w `@theme inline`; motyw ciemny przez
  `class="dark"` w `Layout.astro`; źródła wartości w `context/changes/ui-pantry-tokens/tokens.md`;
- komponenty: sprawdź `src/components/ui/` przed utworzeniem komponentu; brakujący dodaj przez `npx shadcn@latest
add <name>`; brakujący wygląd = nowy wariant w `ui/`, nie kolor w `className`;
- brak literalnych kolorów i wartości arbitralnych w widokach — używaj tokenów; `npm run check:ui` pilnuje plików z
  listy w `scripts/check-ui-literals.mjs` (dopisz plik, gdy go wyczyścisz);
- kitchen sink: `/dev/kitchen-sink` (tylko dev) — dodaj tam nowy stan, gdy go tworzysz.

### Success Criteria:

#### Automated Verification:

- `npm run check:ui` kończy się kodem 0
- Test skanu przechodzi: `npm test`, a jego wynik wymienia `scripts/check-ui-literals.test.ts`
- CI uruchamia skan: `grep -c 'npm run check:ui' .github/workflows/ci.yml` zwraca 1
- Lint, typy i build przechodzą: `npm run lint && npx astro check && npm run build`

#### Manual Verification:

- Dopisanie `bg-blue-500` do `RecipeTile.tsx` i `git commit` zatrzymuje commit na lint-staged (potem cofnij)
- Sekcja `## UI` w `AGENTS.md` jest zrozumiała i wskazuje istniejące ścieżki

**Implementation Note**: Po fazie poczekaj na ręczne potwierdzenie; potem `/10x-impl-review ui-pantry-tokens`.

---

## Testing Strategy

### Unit Tests:

- `scripts/check-ui-literals.test.ts` — przypadki trafień i nie-trafień skanu (Faza 4).
- Istniejące testy (`npm test`) bez zmian — zmiana nie dotyka logiki.

### Manual Testing Steps:

1. Przed Fazą 1: zrzuty `/` i ekranów auth (desktop + 360 px) do `screenshots/before/`.
2. Po każdej fazie wizualnej: zrzuty `/` desktop + 360 px i skan literałów; liczba trafień ma maleć.
3. Klawiatura: Tab przez cały widok, fokus widoczny na każdej kontrolce.
4. Kitchen sink: każda z 7 komórek macierzy pokazana albo „N/A — powód”.
5. Ekrany auth bez zmian poza odcieniem błędu.

## Performance Considerations

Brak wpływu na Worker: zmiany dotyczą CSS i komponentów klienta. Szkielet nie dodaje zapytań.

## Migration Notes

Nie dotyczy (bez zmian danych). Wycofanie = revert commitów fazy.

## References

- Research: `context/changes/ui-pantry-tokens/research.md` (zarzuty C1–C5)
- Skill: `.claude/skills/10x-ui/SKILL.md`, lista kontrolna `.claude/skills/10x-ui/references/ui-quality-checklist.md`
- Wymagania UI: `context/foundation/prd.md:37-41,95,114,124`
- Kafelek i dostępność: `context/archive/2026-10-12-first-pantry-match/plan.md:318-325`
- Otwarte kontrole S-03: `context/archive/2026-10-12-first-pantry-match/reviews/impl-review.md:156`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tokeny i biblioteka

#### Automated

- [x] 1.1 Lint, typy, testy i build przechodzą — 4b63860
- [x] 1.2 `<html>` ma klasę `dark` — 4b63860
- [x] 1.3 `bg-cosmic` nie zawiera hex — 4b63860
- [x] 1.4 `@theme inline` zawiera tylko `var(...)` i `calc(...)` — 4b63860
- [x] 1.5 `src/components/ui/skeleton.tsx` istnieje — 4b63860

#### Manual

- [x] 1.6 `/` na desktopie i przy 360 px wygląda tak samo jak przed zmianą — 4b63860
- [x] 1.7 Ekrany auth wyglądają tak samo jak przed zmianą — 4b63860
- [x] 1.8 `tokens.md` ma źródło każdego tokenu i zmierzony kontrast — 4b63860

### Phase 2: Widok na tokenach

#### Automated

- [x] 2.1 Skan literałów na plikach widoku zwraca 0 linii — 13597d4
- [x] 2.2 Lint, typy, testy i build przechodzą — 13597d4

#### Manual

- [x] 2.3 `/` wygląda jak `before/` poza zamierzonymi różnicami — 13597d4
- [x] 2.4 Kolory tagów ról bez zmian w spiżarce i na kafelku — 13597d4
- [x] 2.5 Fokus z klawiatury widoczny na każdej kontrolce — 13597d4

### Phase 3: Stany i kitchen sink

#### Automated

- [x] 3.1 Skan literałów na plikach widoku i nowych plikach stanów zwraca 0 linii
- [x] 3.2 Strona kitchen sink sprawdza tryb dev
- [x] 3.3 Lint, typy, testy i build przechodzą

#### Manual

- [x] 3.4 Kitchen sink pokazuje 7 stanów; zrzuty desktop i 360 px zapisane
- [x] 3.5 Kitchen sink zwraca 404 w buildzie produkcyjnym
- [ ] 3.6 Pierwsze wczytanie pokazuje szkielet bez przeskoku układu
- [ ] 3.7 Błąd serwera ogłaszany przez czytnik ekranu
- [x] 3.8 Trzy otwarte kontrole S-03 potwierdzone
- [ ] 3.9 Ekrany auth: jedyna różnica to odcień błędu

### Phase 4: Zabezpieczenie

#### Automated

- [ ] 4.1 `npm run check:ui` kończy się kodem 0
- [ ] 4.2 Test skanu przechodzi
- [ ] 4.3 CI uruchamia skan
- [ ] 4.4 Lint, typy i build przechodzą

#### Manual

- [ ] 4.5 Literał w wyczyszczonym pliku zatrzymuje commit
- [ ] 4.6 Sekcja `## UI` w `AGENTS.md` jest zrozumiała
