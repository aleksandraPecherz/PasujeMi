# Rejestr tokenów — ui-pantry-tokens

Skąd pochodzi każda wartość w `src/styles/global.css` (`.dark` i nowe tokeny ról). Wartości to przeliczenie
dzisiejszych literałów widoku `/` na oklch: klasy palety Tailwind v4 przepisane z `node_modules/tailwindcss/theme.css`,
hex przeliczony sRGB → OKLab → oklch (L i C zaokrąglone do 3 miejsc). Linie źródeł wskazują stan sprzed Fazy 2
(commit `e77d302`).

## Tokeny `.dark`

| token                  | wartość (oklch)                                 | źródło (dzisiejszy literał, plik:linia)                                                                                                                                                   |
| ---------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background`         | `oklch(0.166 0.026 269.371)`                    | `#0a0e1a` — `src/styles/global.css:114` (`bg-cosmic`), użyte w `src/layouts/AppLayout.astro:13`                                                                                           |
| `--background-glow`    | `oklch(0.201 0.041 269.806)`                    | `#0f1529` — `src/styles/global.css:114` (środkowy przystanek gradientu `bg-cosmic`)                                                                                                       |
| `--foreground`         | `oklch(1 0 0)`                                  | `text-white` — `src/layouts/AppLayout.astro:13`                                                                                                                                           |
| `--card`               | `oklch(1 0 0 / 10%)`                            | `bg-white/10` — `src/components/pantry/PantryMatch.tsx:38`, `src/components/recipes/RecipeTile.tsx:55`                                                                                    |
| `--card-foreground`    | `oklch(1 0 0)`                                  | `text-white` — `src/components/recipes/RecipeTile.tsx:57`                                                                                                                                 |
| `--muted-foreground`   | `oklch(0.932 0.032 255.585 / 70%)`              | `text-blue-100/70` — `src/components/AppHeader.astro:11`, `src/components/pantry/PantryMatch.tsx:43,93,106`                                                                               |
| `--primary`            | `oklch(0.558 0.288 302.321)`                    | `bg-purple-600` — `src/components/pantry/PantryMatch.tsx:73`, `src/components/recipes/RecipeTile.tsx:59`                                                                                  |
| `--primary-foreground` | `oklch(1 0 0)`                                  | `text-white` — `src/components/pantry/PantryMatch.tsx:73`, `src/components/recipes/RecipeTile.tsx:59`                                                                                     |
| `--input`              | `oklch(1 0 0 / 20%)`                            | `border-white/20` — `src/components/pantry/TagInput.tsx:54`                                                                                                                               |
| `--ring`               | `oklch(0.714 0.203 305.504)`                    | `ring-purple-400` — `src/components/pantry/TagInput.tsx:74` (oraz `ring-purple-400/60` w `:54`)                                                                                           |
| `--accent`             | `oklch(1 0 0 / 20%)`                            | `hover:bg-white/20` — `src/components/AppHeader.astro:15`, `src/components/pantry/PantryMatch.tsx:115`, `src/components/pantry/TagInput.tsx:74` (było `white/10`, patrz „Poprawka hover”) |
| `--border`             | `oklch(1 0 0 / 10%)` (bez zmian)                | `border-white/10` — `src/components/AppHeader.astro:5`, `src/components/pantry/PantryMatch.tsx:38`                                                                                        |
| `--destructive`        | `oklch(0.704 0.191 22.216)` (shadcn, bez zmian) | = `red-400`; wykluczenia `border-red-400/40 bg-red-500/15` — `src/components/pantry/PantryMatch.tsx:25`                                                                                   |
| `--have`               | `oklch(0.696 0.17 162.48)`                      | `bg-emerald-500/15` — `src/components/pantry/PantryMatch.tsx:13`; `bg-emerald-500/20` — `src/components/recipes/RecipeTile.tsx:29`                                                        |
| `--have-foreground`    | `oklch(0.979 0.021 166.113)`                    | `text-emerald-50` — `src/components/recipes/RecipeTile.tsx:29`                                                                                                                            |
| `--staple`             | `oklch(0.623 0.214 259.815)`                    | `bg-blue-500/15` — `src/components/pantry/PantryMatch.tsx:19`                                                                                                                             |
| `--warning`            | `oklch(0.924 0.12 95.746)`                      | `text-amber-200` — `src/components/pantry/PantryMatch.tsx:66`                                                                                                                             |
| `--brand-from`         | `oklch(0.882 0.059 254.128)`                    | `from-blue-200` — `src/components/AppHeader.astro:7`                                                                                                                                      |
| `--brand-to`           | `oklch(0.902 0.063 306.703)`                    | `to-purple-200` — `src/components/AppHeader.astro:7`                                                                                                                                      |
| `--primary-hover`      | `oklch(0.627 0.265 303.9)`                      | `hover:bg-purple-500` — `src/components/pantry/PantryMatch.tsx:73` (dodane w „Poprawka hover”)                                                                                            |
| `--input-hover`        | `oklch(1 0 0 / 40%)`                            | brak literału — pola nie miały hoveru; `2 × --input` (dodane w „Poprawka hover”)                                                                                                          |

## Nowe tokeny w `:root` (jasny motyw)

Brak dzisiejszego źródła — widok działa tylko w ciemnym motywie. To rozsądne jasne odpowiedniki z palety Tailwind v4,
żeby tokeny były zdefiniowane w obu motywach.

| token               | wartość (oklch)              | odpowiednik   |
| ------------------- | ---------------------------- | ------------- |
| `--background-glow` | `oklch(0.97 0 0)`            | `neutral-100` |
| `--have`            | `oklch(0.596 0.145 163.225)` | `emerald-600` |
| `--have-foreground` | `oklch(0.378 0.077 168.94)`  | `emerald-900` |
| `--staple`          | `oklch(0.546 0.245 262.881)` | `blue-600`    |
| `--warning`         | `oklch(0.555 0.163 48.998)`  | `amber-700`   |
| `--brand-from`      | `oklch(0.546 0.245 262.881)` | `blue-600`    |
| `--brand-to`        | `oklch(0.558 0.288 302.321)` | `purple-600`  |
| `--primary-hover`   | `oklch(0.269 0 0)`           | `neutral-800` |
| `--input-hover`     | `oklch(0.708 0 0)`           | `neutral-400` |

## Scalone odcienie

Dzisiejsze literały, które trafiają do jednego tokenu (Faza 2 podmieni je jeden do jednego, więc te odcienie znikną):

- `text-blue-100/80` (`TagInput.tsx:38`, `PantryMatch.tsx:88`) i `text-blue-100/70` → `muted-foreground`.
- `text-white/80` i `text-white/60` tagów kafelka (`RecipeTile.tsx:17`, `RecipeTile.tsx:29`), `text-white/60` przycisku
  usuwania tagu (`TagInput.tsx:74`) → `muted-foreground`.
- `placeholder:text-white/40` (`TagInput.tsx:54`) → `muted-foreground` (placeholder shadcn `Input`).
- `bg-white/5` (`AppHeader.astro:5`, `PantryMatch.tsx:88`, `RecipeTile.tsx:17,29`) i `bg-white/10` → `card` (wariant
  `muted` `Badge` używa `bg-card/50`, czyli efektywnie `white/5`).
- `hover:bg-white/20` (`AppHeader.astro:15`, `PantryMatch.tsx:115`, `TagInput.tsx:74`) → hover `accent` (`white/20`) z
  wariantów `ghost`/`outline` (po „Poprawce hover”; wcześniej `white/10`).
- `border-white/15` tagów kafelka (`RecipeTile.tsx:17,29`) i `border-white/20` → `border` / `input`.
- `border-emerald-400/40` (`PantryMatch.tsx:13`, `RecipeTile.tsx:29`) i `bg-emerald-500/15|20` → `have` (wariant `have`:
  `border-have/40 bg-have/20`).
- `border-blue-400/40` (`PantryMatch.tsx:19`) i `bg-blue-500/15` → `staple` (wariant `staple`: `border-staple/40
bg-staple/15`).
- `border-red-400/40` i `bg-red-500/15` (`PantryMatch.tsx:25`) → `destructive` (`= red-400`; wariant `exclude`:
  `border-destructive/40 bg-destructive/15`).
- `ring-purple-400/60` (`TagInput.tsx:54`) i `ring-purple-400` (`TagInput.tsx:74`) → `ring` (shadcn nakłada własną
  alfę `ring-ring/50`).
- `hover:bg-purple-500` (`PantryMatch.tsx:73`) → `hover:bg-primary-hover` wariantu `default` `Button` (po „Poprawce
  hover”; wcześniej `hover:bg-primary/90`).

## Kontrast (WCAG 2.x)

Zmierzone skryptem: oklch → liniowe sRGB → luminancja względna; kolory z alfą najpierw nałożone na tło (mieszanie w
gamma sRGB, jak w przeglądarce).

| para                                                | kontrast | próg  |
| --------------------------------------------------- | -------- | ----- |
| `muted-foreground` na `background` (`#0a0e1a`)      | 8.00:1   | ≥ 4.5 |
| `muted-foreground` na `background-glow` (`#0f1529`) | 7.53:1   | ≥ 4.5 |
| `muted-foreground` na `card` (nałożonej na tło)     | 6.81:1   | ≥ 4.5 |
| `warning` na `background`                           | 15.45:1  | ≥ 4.5 |
| `warning` na `background-glow`                      | 14.53:1  | ≥ 4.5 |
| `warning` na `card` (nałożonej na tło)              | 12.10:1  | ≥ 4.5 |
| `ring` (pełne krycie) na `background`               | 6.91:1   | ≥ 3   |
| `ring` (pełne krycie) na `card` (nałożonej na tło)  | 5.41:1   | ≥ 3   |

Fokus przycisków: dawniej `ring-ring/50` = 2.55:1 na `background` (poniżej 3:1); od F2 z przeglądu
implementacji `ui/button.tsx` używa `focus-visible:ring-ring` (pełne krycie).

## Poprawka hover (Faza 3, ręczna weryfikacja 2026-10-14)

Ręczny test: hover niewidoczny na żadnej kontrolce. Przyczyna: każdy hover w `.dark` był małym krokiem alfy tego
samego tokenu co stan spoczynkowy, a pola nie miały hoveru wcale. Kontrast spoczynek → hover (WCAG, kolory nałożone na
rzeczywiste tło, ten sam skrypt co wyżej):

| kontrolka                     | hover przed                            | przed | hover po                                | po   |
| ----------------------------- | -------------------------------------- | ----- | --------------------------------------- | ---- |
| „Zastosuj filtry” (`default`) | `hover:bg-primary/90`                  | 1.13  | `hover:bg-primary-hover` (`purple-500`) | 1.35 |
| „Pokaż więcej” (`outline`)    | `dark:hover:bg-input/50` (= 10% bieli) | 1.12  | `dark:hover:bg-accent` (20% bieli)      | 1.59 |
| „Wyloguj” (`outline`)         | jw.                                    | 1.14  | jw.                                     | 1.61 |
| × na tagu (`ghost`)           | `dark:hover:bg-accent/50` (= 5% bieli) | 1.16  | `hover:bg-accent` (20% bieli)           | 1.80 |
| pola `Input`                  | brak                                   | 1.00  | `enabled:hover:border-input-hover`      | 1.91 |

Zmiany:

- `global.css`: `.dark --accent` 10% → 20% bieli (dawny literał hoveru `white/20`); nowe `--primary-hover` i
  `--input-hover` w `:root` i `.dark`, opublikowane w `@theme inline` jako `--color-primary-hover`,
  `--color-input-hover`.
- `ui/button.tsx`: `default` → `hover:bg-primary-hover`; `outline` `dark:hover:bg-input/50` → `dark:hover:bg-accent`;
  `ghost` bez `dark:hover:bg-accent/50` (używa bazowego `hover:bg-accent`). `outline` musi mieć hover z prefiksem
  `dark:`: jego `dark:bg-input/30` ma tę samą specyficzność co `hover:bg-accent`, a stoi później w CSS, więc sam
  `hover:bg-accent` jest przykryty (wykryte w drugim teście ręcznym — „Pokaż więcej” bez hoveru).
- `ui/input.tsx`: `enabled:hover:border-input-hover` (fokus `focus-visible:border-ring` nadal wygrywa; `enabled:`, bo
  wyłączone pole — np. pełny `TagInput` — nie może reagować na hover, wykryte w trzecim teście ręcznym). Przycisk ×
  pełnego `TagInput` zostaje aktywny celowo: usunięcie tagu zwalnia limit.
- Skutek uboczny: `Skeleton` (`bg-accent`) jest jaśniejszy (20% zamiast 10% bieli). Ekrany auth bez zmian —
  `SubmitButton` nadpisuje hover literałem `hover:bg-purple-500` (C5).

## Półprzezroczysta `--card` (decyzja z przeglądu, 2026-10-14)

- `.dark --card` = `oklch(1 0 0 / 10%)` celowo: przez kartę ma prześwitywać tło `bg-cosmic`.
- `--popover`, `--secondary` i `--muted` zostają nieprzezroczystymi szarościami shadcn — nie zostały przeniesione do
  palety „cosmic”. Komponent shadcn, który oczekuje pełnego `bg-card` lub popovera w kolorach palety (Card, Popover,
  Select), wyjdzie przezroczysty albo w szarościach.
- Do przemyślenia przy zmianie palety (ustalenie F10 w `reviews/impl-review.md`).
