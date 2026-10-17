# Paleta „oliwka” — plan implementacji

## Overview

Wdrażamy paletę „oliwka” z tagami „A · ochra” (`context/changes/ui-palette/paleta-oliwka.md`) w tokenach
`src/styles/global.css` i wariantach `src/components/ui/`. Widok `/` i kitchen sink dostają nowy wygląd bez zmian
w logice. Tagi przechodzą z półprzezroczystych na pełne pary tło/tekst, a każda para tekstu ma co najmniej 4,5:1
w obu motywach.

## Current State Analysis

- `.dark` (`global.css:50-91`) to paleta „cosmic” z `ui-pantry-tokens`. `:root` (`global.css:6-48`) to szarości
  shadcn plus tokeny ról. Publikacja przez `@theme inline` jest w `global.css:93-138`.
- Brakuje `--staple-foreground`, `--exclude`, `--exclude-foreground` (research, „Tokeny w global.css”).
- Warianty tagów mieszają kolor z tłem przez alfę (`badge.tsx:18-20`). `exclude` korzysta z `--destructive`.
- Widoki wybierają warianty po nazwie (`TagInput.tsx:64`, `RecipeTile.tsx:16,24`). Klas `*-have*`/`*-staple*` poza
  `badge.tsx` nie ma (research, Summary).
- Przycisk × na tagu to `Button variant="ghost"` (`TagInput.tsx:66-77`). Ghost ustawia
  `hover:bg-accent hover:text-accent-foreground` (`button.tsx:18`), a `--accent` w nowej palecie prawie nie różni
  się od tła tagu (1,04–1,19:1).
- `ServerError` (`ServerError.tsx:13`) to tekst `text-destructive` na `bg-destructive/10`. W spiżarce leży na tle
  (`PantryMatch.tsx:80`).
- Karty `PantryMatch.tsx:40`, `RecipeTile.tsx:48`, `KitchenSink.tsx:71` mają `backdrop-blur-xl`. Przy pełnej
  `--card` rozmycie nie daje żadnego efektu.

## Desired End State

- `global.css` ma wartości z `paleta-oliwka.md` z dwiema korektami z planowania (`--destructive`, jasny
  `--muted-foreground`). Trzy nowe tokeny są zdefiniowane w `:root` i `.dark` oraz opublikowane w `@theme inline`.
- Tagi „mam”, „stałe”, „wykluczam” są pełne. Tag „brak informacji” jest na `bg-muted`. × na każdym tagu ma
  widoczny hover w kolorze tekstu tagu.
- `context/changes/ui-palette/tokens.md` zapisuje źródło każdej wartości i tabelę kontrastu.
- Zrzuty przed i po (`screenshots/before|after/`) pokazują kitchen sink i element `main` strony `/`, bez nagłówka
  z adresem e-mail.

### Key Discoveries:

- Przy `--destructive` 0.74 / 0.48 tekst `ServerError` z podkładem `/10` ma 4,28:1 na tle i 3,87:1 na karcie
  (ciemny) oraz 4,40:1 na karcie (jasny). Stąd korekta do 0.80 / 0.45 (decyzja z planowania).
- Jasny `--muted-foreground` 0.48 na `bg-muted` daje 4,22:1. Korekta do 0.45 daje 4,80:1.
- `ghost` podmienia kolor tekstu przy hoverze, więc `hover:bg-current/20` dołożone w `className` wzięłoby
  `currentColor` = `accent-foreground` zamiast koloru tagu. Dlatego potrzebny jest osobny wariant bez zmiany tekstu.
- `src/components/ui/` nie jest skanowany przez `check:ui` (`scripts/check-ui-literals.mjs:11-22`). Nowe klasy
  w wariantach muszą używać wyłącznie tokenów i `current`.

## What We're NOT Doing

- Ekrany logowania, rejestracji, potwierdzenia e-maila, `components/auth/*` (poza `ServerError`) i `Banner.astro`.
  Przechodzą na tokeny w zmianie `ui-neo-brutal`. Do tego czasu fioletowa karta na oliwkowym tle jest akceptowana.
- `--sidebar-*`: zostają bez zmian (nieużywane).
- Przekreślenie tagu „wykluczam”: nie dodajemy (jedyne przekreślenie zostaje w `RecipeTile.tsx:29`).
- Włączenie jasnego motywu: `:root` dostaje wartości, ale `class="dark"` (`Layout.astro:14`) zostaje.
- Czcionka i styl neo-brutal.
- `backdrop-blur-xl` w `AppHeader.astro:7`: zostaje, bo `bg-card/50` nadal przepuszcza tło.

## Implementation Approach

Najpierw tokeny, potem warianty. Po fazie 1 aplikacja działa w nowych kolorach, choć tagi mają jeszcze stary kształt
(alfa). Faza 2 domyka kontrakt wariantów, a faza 3 to bramka zrzutu ekranu i ręczny test hovera. Każda wartość spoza
`paleta-oliwka.md` trafia do `tokens.md` z uzasadnieniem kontrastu.

## Critical Implementation Details

- **Kolejność zrzutów**: zrzuty `before` trzeba zrobić na początku fazy 1, przed pierwszą edycją `global.css`.
  Potem nie da się ich odtworzyć bez cofania zmian.
- **Prywatność zrzutów**: zrzut `/` obejmuje tylko element `main`, bez `AppHeader` z adresem e-mail. Pliki
  `localhost_4321_*.png` (pełne zrzuty z e-mailem) nie trafiają do commitu.
- **Narzędzie zrzutów**: Chrome DevTools. `kitchen-sink.png` to „Capture full size screenshot”, a `pantry-main.png`
  to „Capture node screenshot” na elemencie `<main>` w panelu Elements. Pliki zapisuj od razu pod docelową nazwą
  w `screenshots/before|after/`. Pełne zrzuty robocze (np. `localhost_4321_*.png`) trzymaj poza repozytorium,
  w katalogu tymczasowym.

## Faza 1: Tokeny

### Overview

Nowe wartości `:root` i `.dark`, trzy nowe tokeny tagów oraz rejestr źródeł.

### Changes Required:

#### 1. Zrzuty „przed”

**File**: `context/changes/ui-palette/screenshots/before/`

**Intent**: Zachować stan wyjściowy do porównania w fazie 3, zanim zmieni się jakikolwiek kolor.

**Contract**: `kitchen-sink.png` (`/dev/kitchen-sink`, cała strona) i `pantry-main.png` (`/`, tylko element `main`,
po zalogowaniu, z kilkoma tagami w każdej sekcji i zastosowanymi filtrami).

#### 2. Tokeny w `global.css`

**File**: `src/styles/global.css`

**Intent**: Podmienić wartości `.dark` i `:root` na bloki z `paleta-oliwka.md`, z korektami z planowania. Dodać
trzy nowe tokeny tagów.

**Contract**:

- `.dark` i `:root`: wszystkie tokeny z bloków `paleta-oliwka.md` (w tym `--chart-*`, `--radius: 0.425rem`
  w `:root`, `--primary-hover`, `--input-hover`). Wyjątki:
  - `.dark --destructive: oklch(0.80 0.11 30)` (plik: 0.74),
  - `:root --destructive: oklch(0.45 0.12 30)` (plik: 0.48),
  - `:root --muted-foreground: oklch(0.45 0.03 60)` (plik: 0.48).
- Nowe tokeny `--staple-foreground`, `--exclude`, `--exclude-foreground` w `:root` i `.dark`. W `@theme inline`
  dochodzą `--color-staple-foreground`, `--color-exclude`, `--color-exclude-foreground` (obok `--color-staple`).
- `--sidebar-*` bez zmian.

#### 3. Rejestr tokenów

**File**: `context/changes/ui-palette/tokens.md`

**Intent**: Zapisać, skąd pochodzi każda wartość, tak jak `context/archive/2026-10-14-ui-pantry-tokens/tokens.md`.
AGENTS.md po archiwizacji wskaże ten plik.

**Contract**: Sekcje:

- „Źródło”: tweakcn „oliwka” plus poprawki z `paleta-oliwka.md`.
- „Odstępstwa od palety”: trzy korekty z kontrastem przed i po.
- „Nowe tokeny”: trzy tokeny tagów.
- „Kontrast (WCAG 2.x)”: tabela par dla obu motywów, policzona skryptem oklch → sRGB, alfa nałożona na tło w gamma
  sRGB. Obowiązkowe pary: tekst/tło, primary, muted-foreground na tle/karcie/`muted`, `ServerError` na tle i karcie,
  biały na `destructive` (jasny) i na `destructive/45` (ciemny), trzy tagi, hover × wobec tagu, ikona × na hoverze,
  pierścień fokusu × wobec tagu (`ring-current`), warning na karcie.
- „Zastąpione decyzje”: półprzezroczysta `--card` (F10 z `ui-pantry-tokens`) przestaje obowiązywać.

### Success Criteria:

#### Automated Verification:

- `grep -c "color-exclude-foreground\|color-exclude:\|color-staple-foreground" src/styles/global.css` zwraca 3
- `npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run check:ui` przechodzi
- `npm run build` przechodzi

#### Manual Verification:

- Zrzuty `screenshots/before/kitchen-sink.png` i `screenshots/before/pantry-main.png` istnieją i powstały przed edycją `global.css`
- Tabela kontrastu w `tokens.md` ma każdą parę tekstu ≥ 4,5:1 i każdą parę ikony/hovera ≥ 3:1 (poza hoverem × wobec tagu, gdzie wymagany jest tylko widoczny krok)
- `/` w przeglądarce ma oliwkowe tło i karty, bez błędów konsoli

**Implementation Note**: Po fazie i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie.

---

## Faza 2: Warianty i komponenty

### Overview

Pełne warianty tagów, bezpieczny wariant `destructive`, wariant przycisku × oraz usunięcie zbędnego rozmycia.

### Changes Required:

#### 1. Warianty `Badge`

**File**: `src/components/ui/badge.tsx`

**Intent**: Tagi jako pełne pary tło/tekst z własnych tokenów, `exclude` niezależny od `--destructive`. Tag
„brak informacji” na `bg-muted`. Biały tekst `destructive` czytelny przy jasnym `--destructive` w ciemnym motywie.

**Contract**:

- `have`: `border-have-foreground/30 bg-have text-have-foreground`
- `staple`: `border-staple-foreground/30 bg-staple text-staple-foreground`
- `exclude`: `border-exclude-foreground/30 bg-exclude text-exclude-foreground`
- `muted`: `border-border bg-muted text-muted-foreground`
- `destructive`: `dark:bg-destructive/60` → `dark:bg-destructive/45`

#### 2. Warianty `Button`

**File**: `src/components/ui/button.tsx`

**Intent**: `destructive` jak w `Badge`. Nowy wariant `ghost-current` dla przycisków wewnątrz kolorowego tła (×
na tagu): hover to 20% koloru tekstu rodzica, a kolor tekstu przy hoverze się nie zmienia. Pierścień fokusu też
bierze kolor tekstu, bo `--ring` (oliwkowy) ma na tagach „mam” i „stałe” tylko 2,77 i 2,84:1 (ciemny).

**Contract**:

- `destructive`: `dark:bg-destructive/60` → `dark:bg-destructive/45`
- nowy klucz `variant: "ghost-current"` = `hover:bg-current/20 focus-visible:ring-current`, bez `hover:text-*`
  (`cn()` usuwa bazowe `focus-visible:ring-ring` na rzecz `ring-current`)

#### 3. Przycisk × na tagu

**File**: `src/components/pantry/TagInput.tsx`

**Intent**: Przełączyć × na nowy wariant, żeby hover był widoczny na każdym z trzech tagów.

**Contract**: `variant="ghost"` → `variant="ghost-current"` (`TagInput.tsx:68`). Reszta przycisku bez zmian.
Kitchen sink pokazuje ten stan przez `SampleTagInput` (`KitchenSink.tsx:81-100`) i nie potrzebuje nowej sekcji.

#### 4. Usunięcie rozmycia z pełnych kart

**File**: `src/components/pantry/PantryMatch.tsx`, `src/components/recipes/RecipeTile.tsx`, `src/components/dev/KitchenSink.tsx`

**Intent**: Usunąć `backdrop-blur-xl` z kart na pełnym `bg-card`, bo nie daje żadnego efektu.

**Contract**: Klasa znika z `PantryMatch.tsx:40`, `RecipeTile.tsx:48`, `KitchenSink.tsx:71`. `AppHeader.astro:7` bez zmian.

### Success Criteria:

#### Automated Verification:

- `grep -rn "backdrop-blur" src/components/pantry/PantryMatch.tsx src/components/recipes/RecipeTile.tsx src/components/dev/KitchenSink.tsx` nic nie zwraca
- `grep -rn "bg-destructive/60" src/components/ui` nic nie zwraca
- `grep -rn "bg-have/\|bg-staple/\|bg-destructive/15" src/components/ui/badge.tsx` nic nie zwraca
- `npm run lint` przechodzi
- `npx astro check` przechodzi
- `npm run check:ui` przechodzi
- `npm test` przechodzi
- `npm run build` przechodzi
- `grep -rl "currentcolor 20%" dist/` po buildzie zwraca co najmniej jeden plik CSS

#### Manual Verification:

- W DevTools hover × na tagu ma `background-color` z `currentcolor` (color-mix), a nie `--accent`
- Tagi „mam”, „stałe”, „wykluczam” w spiżarce i tagi na kafelku przepisu mają pełne tło w kolorze z palety

**Implementation Note**: Po fazie i przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie.

---

## Faza 3: Weryfikacja wizualna

### Overview

Bramka zrzutu ekranu, ręczny test interakcji i przygotowanie wskazania w AGENTS.md na archiwizację.

### Changes Required:

#### 1. Zrzuty „po”

**File**: `context/changes/ui-palette/screenshots/after/`

**Intent**: Udokumentować wynik w tych samych kadrach co `before`.

**Contract**: `kitchen-sink.png` (cała strona) i `pantry-main.png` (tylko element `main` strony `/`, bez
`AppHeader` z e-mailem), w tym samym stanie danych co `before`. Pliki `localhost_4321_*.png` nie są commitowane.

#### 2. Wskazanie rejestru tokenów w AGENTS.md

**File**: `AGENTS.md` (sekcja UI, zdanie o `tokens.md`)

**Intent**: Po archiwizacji AGENTS.md ma wskazywać nowy rejestr zamiast `2026-10-14-ui-pantry-tokens/tokens.md`.

**Contract**: Edycja należy do kroku `/10x-archive`, kiedy znana jest ścieżka `context/archive/<data>-ui-palette/tokens.md`.
W tej fazie tylko zapis w `change.md` → `## Notes` jako przypomnienie dla archiwizacji.

### Success Criteria:

#### Automated Verification:

- `git diff --cached --name-only; git ls-files context/changes/ui-palette` przepuszczone przez `grep localhost_4321` nic nie zwraca
- `npm run check:ui` przechodzi

#### Manual Verification:

- `screenshots/after/kitchen-sink.png` i `screenshots/after/pantry-main.png` istnieją, a `pantry-main.png` nie zawiera nagłówka ani adresu e-mail
- Hover × jest widoczny na tagu „mam”, „stałe” i „wykluczam”, a fokus klawiaturą na × pokazuje pierścień
- `ServerError` w kitchen sinku jest czytelny (jasnoczerwony tekst na ciemnym tle)
- Tag „brak informacji” na kafelku przepisu odróżnia się od karty ramką
- Logo w nagłówku (gradient brand) jest czytelne
- `change.md` → `## Notes` zawiera przypomnienie o aktualizacji ścieżki `tokens.md` w AGENTS.md przy archiwizacji

---

## Testing Strategy

### Unit Tests:

- Brak nowych: zmiana dotyczy tylko klas i tokenów. `npm test` pilnuje, że logika dopasowania i API są nietknięte.

### Integration Tests:

- `npm run check:ui` na `CLEAN_FILES` (bez nowych literałów w widokach) i `npm run build` (Tailwind generuje nowe klasy).

### Manual Testing Steps:

1. Zrób zrzuty `before` (faza 1, krok 1).
2. Na `/` dodaj po 2 tagi w każdej sekcji, zastosuj filtry i najedź na × każdego tagu.
3. Przejdź Tabem do × i sprawdź pierścień fokusu.
4. Na `/dev/kitchen-sink` porównaj stany `error`, limitu i tagów z zrzutem `before`.
5. Zrób zrzuty `after` w tym samym stanie.

## Performance Considerations

Bez wpływu. Usunięcie `backdrop-blur-xl` z trzech kart zmniejsza koszt rysowania.

## Migration Notes

Brak danych do migracji. Wycofanie to revert commitów tej zmiany.

## References

- Specyfikacja palety: `context/changes/ui-palette/paleta-oliwka.md`
- Research: `context/changes/ui-palette/research.md`
- Poprzedni rejestr tokenów: `context/archive/2026-10-14-ui-pantry-tokens/tokens.md`
- Reguła hovera: tamże, sekcja „Poprawka hover”

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tokeny

#### Automated

- [x] 1.1 grep zwraca 3 nowe wpisy w @theme inline
- [x] 1.2 npm run lint przechodzi
- [x] 1.3 npx astro check przechodzi
- [x] 1.4 npm run check:ui przechodzi
- [x] 1.5 npm run build przechodzi

#### Manual

- [x] 1.6 Zrzuty before istnieją i powstały przed edycją global.css — 06da291
- [x] 1.7 Tabela kontrastu w tokens.md spełnia progi — 06da291
- [x] 1.8 / ma oliwkowe tło i karty, bez błędów konsoli

### Phase 2: Warianty i komponenty

#### Automated

- [x] 2.1 Brak backdrop-blur w trzech kartach — 06da291
- [x] 2.2 Brak bg-destructive/60 w ui/ — 06da291
- [x] 2.3 Brak alfy w wariantach tagów badge.tsx — 06da291
- [x] 2.4 npm run lint przechodzi — 06da291
- [x] 2.5 npx astro check przechodzi — 06da291
- [x] 2.6 npm run check:ui przechodzi — 06da291
- [x] 2.7 npm test przechodzi — 06da291
- [x] 2.8 npm run build przechodzi — 06da291
- [x] 2.9 Build zawiera color-mix z currentcolor 20% — 06da291

#### Manual

- [x] 2.10 Hover × używa currentcolor, nie --accent — 06da291
- [x] 2.11 Tagi w spiżarce i na kafelku mają pełne tło z palety — 06da291

### Phase 3: Weryfikacja wizualna

#### Automated

- [x] 3.1 Brak localhost_4321_*.png w commicie
- [x] 3.2 npm run check:ui przechodzi

#### Manual

- [x] 3.3 Zrzuty after istnieją, pantry-main bez nagłówka i e-maila
- [x] 3.4 Hover × widoczny na trzech tagach, fokus z pierścieniem
- [x] 3.5 ServerError czytelny w kitchen sinku
- [x] 3.6 Tag brak informacji odróżnia się od karty ramką
- [x] 3.7 Logo w nagłówku czytelne
- [x] 3.8 Przypomnienie o AGENTS.md w change.md Notes
