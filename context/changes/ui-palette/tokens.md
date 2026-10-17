# Rejestr tokenów — ui-palette

Skąd pochodzi każda wartość w `src/styles/global.css` (`:root` i `.dark`) po wdrożeniu palety „oliwka” z tagami
„A · ochra”. Liczby oklch zapisano w postaci znormalizowanej przez Prettiera (bez końcowych zer, np. `0.50` → `0.5`,
`0.7350` → `0.735`), wartości są te same co w źródle.

## Źródło

- Paleta „oliwka” z tweakcn (wklejona przez Olę 14.10), podgląd: zakładka „Oliwka”, wariant tagów „A · ochra”.
- Poprawki kontrastu i tokeny tagów z `context/changes/ui-palette/paleta-oliwka.md` (bloki `.dark` i `:root`):
  - jasny `--primary` 0.6657 → 0.5, jasny `--ring` = `--primary`,
  - jasny `--muted-foreground` 0.5761 → 0.48 (tu dalej korygowany, patrz „Odstępstwa od palety”),
  - ciemny `--muted-foreground` 0.7096 → 0.78,
  - `--destructive` jako tekst błędu: ciemny 0.74, jasny 0.48 (tu dalej korygowany),
  - `--primary-hover`, `--input-hover`, `--background-glow`, `--have*`, `--staple*`, `--exclude*`, `--warning`,
    `--brand-*` dobrane w `paleta-oliwka.md` pod paletę.
- Wszystkie pozostałe tokeny `:root` i `.dark` (w tym `--chart-*` i `--radius: 0.425rem` w `:root`) są przepisane
  z bloków `paleta-oliwka.md` bez zmian.
- `--sidebar-*` bez zmian (nieużywane w `src/`, wartości shadcn z poprzedniego stanu).

## Odstępstwa od palety

Trzy wartości różnią się od bloków `paleta-oliwka.md` (decyzja z `/10x-plan`). Kontrast tą samą metodą co w sekcji
„Kontrast”.

| motyw   | token                | `paleta-oliwka.md`    | `global.css`          | para, która wymusiła zmianę                              | przed | po   |
| ------- | -------------------- | --------------------- | --------------------- | -------------------------------------------------------- | ----- | ---- |
| `.dark` | `--destructive`      | `oklch(0.74 0.11 30)` | `oklch(0.8 0.11 30)`  | `ServerError` (`destructive` na `destructive/10`) na tle | 4.28  | 5.14 |
|         |                      |                       |                       | `ServerError` na karcie                                  | 3.87  | 4.64 |
| `:root` | `--destructive`      | `oklch(0.48 0.12 30)` | `oklch(0.45 0.12 30)` | `ServerError` na tle                                     | 4.23  | 4.77 |
|         |                      |                       |                       | `ServerError` na karcie                                  | 4.40  | 4.97 |
| `:root` | `--muted-foreground` | `oklch(0.48 0.03 60)` | `oklch(0.45 0.03 60)` | `muted-foreground` na `muted` (tag „brak informacji”)    | 4.22  | 4.80 |

Koszt korekty ciemnego `--destructive`: biały tekst na `dark:bg-destructive/45` (faza 2) spada z 5.58 do 4.92 na tle
i z 5.27 do 4.65 na karcie. Obie wartości zostają ≥ 4.5. Przy dzisiejszym `dark:bg-destructive/60` biały na karcie ma
3.58, stąd zmiana wariantu na `/45` w fazie 2.

## Nowe tokeny

Tagi są pełnymi parami tło/tekst (`paleta-oliwka.md`, „Decyzje”). `--have` i `--have-foreground` istniały wcześniej
(dostają nowe wartości), `--staple` też. Nowe są trzy tokeny, opublikowane w `@theme inline` jako
`--color-staple-foreground`, `--color-exclude`, `--color-exclude-foreground`:

| token                  | `.dark`                | `:root`                | użycie (faza 2)                                    |
| ---------------------- | ---------------------- | ---------------------- | -------------------------------------------------- |
| `--staple-foreground`  | `oklch(0.89 0.065 85)` | `oklch(0.41 0.065 70)` | tekst i ramka (`/30`) tagu „stałe” na `bg-staple`  |
| `--exclude`            | `oklch(0.41 0.06 30)`  | `oklch(0.81 0.06 32)`  | tło tagu „wykluczam” (zamiast `bg-destructive/15`) |
| `--exclude-foreground` | `oklch(0.87 0.055 32)` | `oklch(0.42 0.09 30)`  | tekst i ramka (`/30`) tagu „wykluczam”             |

`--destructive` zostaje dla błędów i przycisku „usuń”, tag „wykluczam” przestaje od niego zależeć.

## Kontrast (WCAG 2.x)

Policzone skryptem: oklch → OKLab → liniowe sRGB (przycięte do gamutu) → luminancja względna WCAG. Kolory z alfą
najpierw nałożone na tło, na którym leżą, w gamma sRGB (`c·α + tło·(1−α)`). Tailwind 4 miesza alfę przez
`color-mix(in oklab, …)`, więc wartości z alfą są przybliżeniem. Hover × to `hover:bg-current/20`, czyli 20% koloru
tekstu tagu nałożone na tło tagu. Progi: tekst ≥ 4.5, ikona i pierścień fokusu ≥ 3, hover wobec spoczynku — tylko
widoczny krok (reguła z `ui-pantry-tokens`, „Poprawka hover”: było 1.80 dla × po poprawce).

### Tekst

| para                                                              | `.dark` | `:root` | próg  |
| ----------------------------------------------------------------- | ------- | ------- | ----- |
| `foreground` na `background`                                      | 9.68    | 5.79    | ≥ 4.5 |
| `foreground` na `card`                                            | 8.68    | 6.04    | ≥ 4.5 |
| `primary-foreground` na `primary`                                 | 5.29    | 5.65    | ≥ 4.5 |
| `primary-foreground` na `primary-hover`                           | 6.70    | 7.32    | ≥ 4.5 |
| `muted-foreground` na `background`                                | 6.09    | 5.23    | ≥ 4.5 |
| `muted-foreground` na `card`                                      | 5.46    | 5.45    | ≥ 4.5 |
| `muted-foreground` na `muted`                                     | 4.81    | 4.80    | ≥ 4.5 |
| `ServerError`: `destructive` na `destructive/10` nad `background` | 5.14    | 4.77    | ≥ 4.5 |
| `ServerError`: `destructive` na `destructive/10` nad `card`       | 4.64    | 4.97    | ≥ 4.5 |
| biały na `destructive` (jasny, pełne krycie)                      | —       | 7.89    | ≥ 4.5 |
| biały na `destructive/45` nad `background` (ciemny)               | 4.92    | —       | ≥ 4.5 |
| biały na `destructive/45` nad `card` (ciemny)                     | 4.65    | —       | ≥ 4.5 |
| tag „mam”: `have-foreground` na `have`                            | 5.81    | 5.36    | ≥ 4.5 |
| tag „stałe”: `staple-foreground` na `staple`                      | 5.85    | 5.28    | ≥ 4.5 |
| tag „wykluczam”: `exclude-foreground` na `exclude`                | 6.01    | 4.79    | ≥ 4.5 |
| `warning` na `card`                                               | 6.90    | 5.52    | ≥ 4.5 |
| `warning` na `background`                                         | 7.70    | 5.29    | ≥ 4.5 |

### Ikona × i pierścień fokusu na tagu

| para                                                                              | `.dark` | `:root` | próg |
| --------------------------------------------------------------------------------- | ------- | ------- | ---- |
| ikona × na hoverze: `have-foreground` na `have-foreground/20` nad `have`          | 3.80    | 4.06    | ≥ 3  |
| ikona × na hoverze: `staple-foreground` na `staple-foreground/20` nad `staple`    | 3.82    | 4.01    | ≥ 3  |
| ikona × na hoverze: `exclude-foreground` na `exclude-foreground/20` nad `exclude` | 3.94    | 3.67    | ≥ 3  |
| pierścień fokusu × (`ring-current` = `have-foreground`) wobec `have`              | 5.81    | 5.36    | ≥ 3  |
| pierścień fokusu × (`ring-current` = `staple-foreground`) wobec `staple`          | 5.85    | 5.28    | ≥ 3  |
| pierścień fokusu × (`ring-current` = `exclude-foreground`) wobec `exclude`        | 6.01    | 4.79    | ≥ 3  |

Dla porównania `--ring` (oliwkowy) wobec tła tagu: `.dark` 2.77 („mam”), 2.84 („stałe”), 3.17 („wykluczam”);
`:root` 3.20, 3.45, 3.17. Dlatego × dostaje w fazie 2 `focus-visible:ring-current`.

### Hover × wobec tagu (widoczny krok)

| para                                                  | `.dark` | `:root` |
| ----------------------------------------------------- | ------- | ------- |
| `have-foreground/20` nad `have` wobec `have`          | 1.53    | 1.32    |
| `staple-foreground/20` nad `staple` wobec `staple`    | 1.53    | 1.32    |
| `exclude-foreground/20` nad `exclude` wobec `exclude` | 1.53    | 1.31    |

Dawny hover × przez `--accent` wobec pełnego tła tagu dawałby 1.04–1.19 (research), czyli praktycznie brak kroku.

### Pozostałe pary (informacyjnie)

| para                                                 | `.dark` | `:root` | próg |
| ---------------------------------------------------- | ------- | ------- | ---- |
| `destructive` na `background` (ramka `aria-invalid`) | 6.27    | 5.50    | ≥ 3  |
| `ring` na `background`                               | 4.26    | 4.07    | ≥ 3  |
| `ring` na `card`                                     | 3.82    | 4.25    | ≥ 3  |

## Zastąpione decyzje

- **Półprzezroczysta `--card`** (F10 z `ui-pantry-tokens`, `context/archive/2026-10-14-ui-pantry-tokens/tokens.md`,
  sekcja „Półprzezroczysta `--card`”) przestaje obowiązywać. `.dark --card` to pełne `oklch(0.3583 0.0165 82.3257)`,
  tło `bg-cosmic` już przez kartę nie prześwituje. `backdrop-blur-xl` na pełnych kartach nic nie robi i znika w
  fazie 2 (`PantryMatch.tsx`, `RecipeTile.tsx`, `KitchenSink.tsx`). `AppHeader.astro` (`bg-card/50`) zachowuje
  rozmycie.
- Zastrzeżenie z tej samej sekcji o shadcn Card/Popover w szarościach się dezaktualizuje: `--popover`, `--secondary`
  i `--muted` mają teraz wartości z palety.
- Wartości `.dark` z palety „cosmic” i szarości shadcn w `:root` (rejestr `ui-pantry-tokens`, „Tokeny `.dark`” i „Nowe
  tokeny w `:root`”) są w całości zastąpione tym rejestrem, poza `--sidebar-*`.
