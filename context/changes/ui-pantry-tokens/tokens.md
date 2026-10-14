# Rejestr tokenów — ui-pantry-tokens

Skąd pochodzi każda wartość w `src/styles/global.css` (`.dark` i nowe tokeny ról). Wartości to przeliczenie
dzisiejszych literałów widoku `/` na oklch: klasy palety Tailwind v4 przepisane z `node_modules/tailwindcss/theme.css`,
hex przeliczony sRGB → OKLab → oklch (L i C zaokrąglone do 3 miejsc). Linie źródeł wskazują stan sprzed Fazy 2
(commit `e77d302`).

## Tokeny `.dark`

| token                  | wartość (oklch)                                 | źródło (dzisiejszy literał, plik:linia)                                                                                            |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `--background`         | `oklch(0.166 0.026 269.371)`                    | `#0a0e1a` — `src/styles/global.css:114` (`bg-cosmic`), użyte w `src/layouts/AppLayout.astro:13`                                    |
| `--background-glow`    | `oklch(0.201 0.041 269.806)`                    | `#0f1529` — `src/styles/global.css:114` (środkowy przystanek gradientu `bg-cosmic`)                                                |
| `--foreground`         | `oklch(1 0 0)`                                  | `text-white` — `src/layouts/AppLayout.astro:13`                                                                                    |
| `--card`               | `oklch(1 0 0 / 10%)`                            | `bg-white/10` — `src/components/pantry/PantryMatch.tsx:38`, `src/components/recipes/RecipeTile.tsx:55`                             |
| `--card-foreground`    | `oklch(1 0 0)`                                  | `text-white` — `src/components/recipes/RecipeTile.tsx:57`                                                                          |
| `--muted-foreground`   | `oklch(0.932 0.032 255.585 / 70%)`              | `text-blue-100/70` — `src/components/AppHeader.astro:11`, `src/components/pantry/PantryMatch.tsx:43,93,106`                        |
| `--primary`            | `oklch(0.558 0.288 302.321)`                    | `bg-purple-600` — `src/components/pantry/PantryMatch.tsx:73`, `src/components/recipes/RecipeTile.tsx:59`                           |
| `--primary-foreground` | `oklch(1 0 0)`                                  | `text-white` — `src/components/pantry/PantryMatch.tsx:73`, `src/components/recipes/RecipeTile.tsx:59`                              |
| `--input`              | `oklch(1 0 0 / 20%)`                            | `border-white/20` — `src/components/pantry/TagInput.tsx:54`                                                                        |
| `--ring`               | `oklch(0.714 0.203 305.504)`                    | `ring-purple-400` — `src/components/pantry/TagInput.tsx:74` (oraz `ring-purple-400/60` w `:54`)                                    |
| `--accent`             | `oklch(1 0 0 / 10%)`                            | `bg-white/10` przycisków drugorzędnych — `src/components/AppHeader.astro:15`, `src/components/pantry/PantryMatch.tsx:115`          |
| `--border`             | `oklch(1 0 0 / 10%)` (bez zmian)                | `border-white/10` — `src/components/AppHeader.astro:5`, `src/components/pantry/PantryMatch.tsx:38`                                 |
| `--destructive`        | `oklch(0.704 0.191 22.216)` (shadcn, bez zmian) | = `red-400`; wykluczenia `border-red-400/40 bg-red-500/15` — `src/components/pantry/PantryMatch.tsx:25`                            |
| `--have`               | `oklch(0.696 0.17 162.48)`                      | `bg-emerald-500/15` — `src/components/pantry/PantryMatch.tsx:13`; `bg-emerald-500/20` — `src/components/recipes/RecipeTile.tsx:29` |
| `--have-foreground`    | `oklch(0.979 0.021 166.113)`                    | `text-emerald-50` — `src/components/recipes/RecipeTile.tsx:29`                                                                     |
| `--staple`             | `oklch(0.623 0.214 259.815)`                    | `bg-blue-500/15` — `src/components/pantry/PantryMatch.tsx:19`                                                                      |
| `--warning`            | `oklch(0.924 0.12 95.746)`                      | `text-amber-200` — `src/components/pantry/PantryMatch.tsx:66`                                                                      |
| `--brand-from`         | `oklch(0.882 0.059 254.128)`                    | `from-blue-200` — `src/components/AppHeader.astro:7`                                                                               |
| `--brand-to`           | `oklch(0.902 0.063 306.703)`                    | `to-purple-200` — `src/components/AppHeader.astro:7`                                                                               |

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

## Scalone odcienie

Dzisiejsze literały, które trafiają do jednego tokenu (Faza 2 podmieni je jeden do jednego, więc te odcienie znikną):

- `text-blue-100/80` (`TagInput.tsx:38`, `PantryMatch.tsx:88`) i `text-blue-100/70` → `muted-foreground`.
- `text-white/80` i `text-white/60` tagów kafelka (`RecipeTile.tsx:17`, `RecipeTile.tsx:29`), `text-white/60` przycisku
  usuwania tagu (`TagInput.tsx:74`) → `muted-foreground`.
- `placeholder:text-white/40` (`TagInput.tsx:54`) → `muted-foreground` (placeholder shadcn `Input`).
- `bg-white/5` (`AppHeader.astro:5`, `PantryMatch.tsx:88`, `RecipeTile.tsx:17,29`) i `bg-white/10` → `card` (wariant
  `muted` `Badge` używa `bg-card/50`, czyli efektywnie `white/5`).
- `hover:bg-white/20` (`AppHeader.astro:15`, `PantryMatch.tsx:115`, `TagInput.tsx:74`) → hover `accent` (`white/10`) z
  wariantów `ghost`/`outline`.
- `border-white/15` tagów kafelka (`RecipeTile.tsx:17,29`) i `border-white/20` → `border` / `input`.
- `border-emerald-400/40` (`PantryMatch.tsx:13`, `RecipeTile.tsx:29`) i `bg-emerald-500/15|20` → `have` (wariant `have`:
  `border-have/40 bg-have/20`).
- `border-blue-400/40` (`PantryMatch.tsx:19`) i `bg-blue-500/15` → `staple` (wariant `staple`: `border-staple/40
bg-staple/15`).
- `border-red-400/40` i `bg-red-500/15` (`PantryMatch.tsx:25`) → `destructive` (`= red-400`; wariant `exclude`:
  `border-destructive/40 bg-destructive/15`).
- `ring-purple-400/60` (`TagInput.tsx:54`) i `ring-purple-400` (`TagInput.tsx:74`) → `ring` (shadcn nakłada własną
  alfę `ring-ring/50`).
- `hover:bg-purple-500` (`PantryMatch.tsx:73`) → `hover:bg-primary/90` wariantu `default` `Button`.

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
