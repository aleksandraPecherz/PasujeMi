# Paleta „oliwka” + tagi „A · ochra” — wartości do `ui-palette`

Źródło: paleta z tweakcn (wklejona przez Olę 14.10), podgląd: https://claude.ai/artifact/DSAN9S4A18op3zPXmkjvk9 (zakładka „Oliwka”, wariant „A · ochra”).
Zakres zmiany `ui-palette`: tylko `src/styles/global.css` + warianty tagów w `src/components/ui/badge.tsx`. Czcionka bez zmian (systemowa). Styl neo‑brutal to osobna, późniejsza zmiana.

## Decyzje

- Kolory tagów są **pełne (nieprzezroczyste)**: osobna para tło/tekst dla każdego tagu. Dziś badge miesza `bg-have/20`, `bg-staple/15`, `bg-destructive/15` z tłem, więc kontrast zależy od tła. Po zmianie:
  - `have:    border-have-foreground/30 bg-have text-have-foreground`
  - `staple:  border-staple-foreground/30 bg-staple text-staple-foreground`
  - `exclude: border-exclude-foreground/30 bg-exclude text-exclude-foreground`
- Nowe tokeny: `--staple-foreground`, `--exclude`, `--exclude-foreground` (+ publikacja w `@theme inline` jako `--color-…`). `--destructive` zostaje dla błędów i przycisku „usuń”, nie dla tagu.
- Poprawki kontrastu względem oryginału z tweakcn (oryginał nie spełnia 4,5:1):
  - jasny `--primary` przyciemniony 0.6657 → 0.50 (biały tekst 2,87 → 5,65:1)
  - jasny `--muted-foreground` 0.5761 → 0.48 (3,05 → 4,59:1 na tle)
  - `--destructive` (wersja 2, po research): ciemny 0.74 — jest używany jako **tekst** błędu (ServerError) na tle/karcie, więc musi być jasny; jasny 0.48
  - ciemny `--muted-foreground` 0.7096 → 0.78 (≥4,5:1 także na `--muted`)
- Aplikacja jest dziś tylko ciemna (`class="dark"` na `<html>`), więc `.dark` ma pierwszeństwo; `:root` przygotowane pod krok 21.
- Przed wdrożeniem: `grep` po `have`, `staple`, `destructive`, `warning`, `brand-`, `background-glow` w `src/` — sprawdzić każde użycie (np. czipy na kafelku przepisu, LimitNotice, nagłówek).

## `.dark`

```css
.dark {
  --background: oklch(0.3303 0.0214 88.0737);
  --foreground: oklch(0.9217 0.0235 82.1191);
  --card: oklch(0.3583 0.0165 82.3257);
  --card-foreground: oklch(0.9217 0.0235 82.1191);
  --popover: oklch(0.3583 0.0165 82.3257);
  --popover-foreground: oklch(0.9217 0.0235 82.1191);
  --primary: oklch(0.6762 0.0567 132.4479);
  --primary-foreground: oklch(0.2686 0.0105 61.0213);
  --primary-hover: oklch(0.74 0.06 132);
  --secondary: oklch(0.4448 0.0239 84.5498);
  --secondary-foreground: oklch(0.9217 0.0235 82.1191);
  --muted: oklch(0.3892 0.0197 82.7084);
  --muted-foreground: oklch(0.78 0.017 73.6);
  --accent: oklch(0.4448 0.0239 84.5498);
  --accent-foreground: oklch(0.9217 0.0235 82.1191);
  --destructive: oklch(0.74 0.11 30);
  --border: oklch(0.4448 0.0239 84.5498);
  --input: oklch(0.4448 0.0239 84.5498);
  --input-hover: oklch(0.62 0.03 84);
  --ring: oklch(0.6762 0.0567 132.4479);
  --chart-1: oklch(0.6762 0.0567 132.4479);
  --chart-2: oklch(0.735 0.0564 130.8494);
  --chart-3: oklch(0.5929 0.0464 137.6224);
  --chart-4: oklch(0.654 0.0723 90.7629);
  --chart-5: oklch(0.5183 0.039 137.1892);
  --background-glow: oklch(0.36 0.03 100);
  --have: oklch(0.43 0.055 130);
  --have-foreground: oklch(0.89 0.065 128);
  --staple: oklch(0.43 0.055 82);
  --staple-foreground: oklch(0.89 0.065 85);
  --exclude: oklch(0.41 0.06 30);
  --exclude-foreground: oklch(0.87 0.055 32);
  --warning: oklch(0.85 0.09 85);
  --brand-from: oklch(0.82 0.08 128);
  --brand-to: oklch(0.85 0.08 85);
}
```

## `:root` (jasny, pod krok 21)

```css
:root {
  --radius: 0.425rem;
  --background: oklch(0.8798 0.0534 91.7893);
  --foreground: oklch(0.4265 0.031 59.2153);
  --card: oklch(0.8937 0.0395 87.5676);
  --card-foreground: oklch(0.4265 0.031 59.2153);
  --popover: oklch(0.8937 0.0395 87.5676);
  --popover-foreground: oklch(0.4265 0.031 59.2153);
  --primary: oklch(0.5 0.1 122);
  --primary-foreground: oklch(0.9882 0.0069 88.6415);
  --primary-hover: oklch(0.44 0.095 122);
  --secondary: oklch(0.8532 0.0631 91.1493);
  --secondary-foreground: oklch(0.4265 0.031 59.2153);
  --muted: oklch(0.8532 0.0631 91.1493);
  --muted-foreground: oklch(0.48 0.03 60);
  --accent: oklch(0.8361 0.0713 90.3269);
  --accent-foreground: oklch(0.4265 0.031 59.2153);
  --destructive: oklch(0.48 0.12 30);
  --border: oklch(0.6918 0.044 59.8448);
  --input: oklch(0.6918 0.044 59.8448);
  --input-hover: oklch(0.55 0.04 60);
  --ring: oklch(0.5 0.1 122);
  --chart-1: oklch(0.735 0.0564 130.8494);
  --chart-2: oklch(0.6762 0.0567 132.4479);
  --chart-3: oklch(0.8185 0.0332 136.6539);
  --chart-4: oklch(0.5929 0.0464 137.6224);
  --chart-5: oklch(0.5183 0.039 137.1892);
  --background-glow: oklch(0.9 0.05 95);
  --have: oklch(0.8 0.085 125);
  --have-foreground: oklch(0.38 0.07 128);
  --staple: oklch(0.83 0.075 82);
  --staple-foreground: oklch(0.41 0.065 70);
  --exclude: oklch(0.81 0.06 32);
  --exclude-foreground: oklch(0.42 0.09 30);
  --warning: oklch(0.45 0.09 70);
  --brand-from: oklch(0.46 0.1 122);
  --brand-to: oklch(0.46 0.09 70);
}
```

Zostawić bez zmian: `--sidebar-*` (nieużywane) można ustawić jak `--card`/`--primary` albo pominąć.

## Kontrast (WCAG 2, policzony z oklch)

| Para                              | jasny | ciemny                               |
| --------------------------------- | ----- | ------------------------------------ |
| tekst / tło                       | 5,79  | 9,68                                 |
| tekst przycisku / primary         | 5,65  | 5,29                                 |
| muted-foreground / tło            | 4,59  | 6,09                                 |
| muted-foreground / muted          | —     | 4,81                                 |
| tekst błędu (destructive) / tło   | 4,84  | 5,06                                 |
| tekst błędu (destructive) / karta | 5,05  | 4,54                                 |
| biały / przycisk destructive      | 6,93  | 5,58 (przy `dark:bg-destructive/45`) |
| tag „mam”                         | 5,36  | 5,81                                 |
| tag „stałe” (ochra)               | 5,28  | 5,85                                 |
| tag „wykluczam”                   | 4,79  | 6,01                                 |
| warning / karta                   | 5,52  | 6,90                                 |

## Poprawki po `/10x-research` (17.10)

1. **Tekst błędu (ServerError)** — `--destructive` w `.dark` = `oklch(0.74 0.11 30)`, w `:root` = `oklch(0.48 0.12 30)`. Ramka `aria-invalid` w ciemnym przy okazji ma 5,06:1 (było 2,10).
   Przycisk `destructive` w `button.tsx` (i `badge.tsx`) ma `text-white` na `dark:bg-destructive/60` → przy jasnym `--destructive` biały spada do 4,35:1. Zmień `dark:bg-destructive/60` → `dark:bg-destructive/45` (5,58:1 na tle, 5,27:1 na karcie). Jeśli wariant nigdzie nie jest używany — i tak zmienić, żeby nie zostawić pułapki.
2. **Hover × na tagu** — zamiast `hover:bg-accent` tło hovera z koloru tekstu tagu: `hover:bg-current/20`. Hover odcina się od tagu 1,53:1, a × na hoverze ma 3,8:1 (ikona, wymóg 3:1). Działa dla każdego wariantu bez nowych tokenów.
3. **Tag „brak informacji” (wariant `muted`)** — `bg-card/50` → `bg-muted`. Tekst 4,81:1. Odróżnia się od karty nadal słabo (1,13:1), więc zostaje ramka `border-border`.
4. **Logowanie / rejestracja / Banner.astro** — **poza tą zmianą**. Przejdą na tokeny w zmianie `ui-neo-brutal` (karta logowania i tak dostaje tam nowy styl). Do tego czasu fioletowa karta na oliwkowym tle jest akceptowalna.
5. **`--sidebar-*`** — nieużywane, zostawić bez zmian. **`--chart-*`** — wpisać wartości z palety (są w blokach wyżej), nic nie kosztują.
6. **Źródła tokenów** — tak, nowy `context/changes/ui-palette/tokens.md` jak w poprzedniej zmianie (źródło: tweakcn „oliwka” + poprawki kontrastu z tego pliku), a w `AGENTS.md` ścieżka do niego po archiwizacji.
7. **Przekreślenie** — bez zmian: tylko `RecipeTile.tsx:29`. Tagi „wykluczam” w spiżarni nie są przekreślone i tak zostaje.
8. **`backdrop-blur`** na kartach — usunąć przy okazji (karty są teraz pełne, blur nic nie robi).
