---
date: 2026-10-17T14:44:56+02:00
researcher: Claude (Opus 5.5)
git_commit: 6db46a955d4311f64b1b66ed5c62829412a1fc5d
branch: master
repository: PasujeMi
topic: "Wdrożenie palety „oliwka” (paleta-oliwka.md): tokeny w global.css, tokeny tagów, warianty badge.tsx i wszystkie użycia have/staple/destructive/warning/brand w src/"
tags: [research, ui, design-tokens, global-css, badge, palette]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (Opus 5.5)
---

# Research: wdrożenie palety „oliwka”

**Date**: 2026-10-17T14:44:56+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 6db46a9
**Branch**: master
**Repository**: PasujeMi

## Research Question

Wdróż paletę z `context/changes/ui-palette/paleta-oliwka.md`: tokeny w `global.css`, nowe tokeny tagów i warianty
w `badge.tsx`. Sprawdź wszystkie użycia `have`/`staple`/`destructive`/`warning`/`brand` w `src/`.

## Summary

- Zmiana mieści się w dwóch plikach z zakresu specyfikacji (`src/styles/global.css`, `src/components/ui/badge.tsx`).
  Żaden widok nie odwołuje się do tokenów tagów bezpośrednio: w przeszukanym `src/` klasy `*-have*`/`*-staple*` występują
  tylko w `badge.tsx:18-19`, a widoki wybierają warianty po nazwie (`TagInput.tsx:64`, `RecipeTile.tsx:16,24`).
  Nowe wartości `.dark` i `:root` przechodzą więc bez zmian w widokach.
- Kontrast ze specyfikacji potwierdzam dla par, które ona podaje (mój skrypt daje te same liczby dla tagów:
  5,81/5,36, 5,85/5,28, 6,01/4,79). Specyfikacja **nie obejmuje** jednak trzech par, które po zmianie wypadają poniżej progów:
  1. **`ServerError`** (`ServerError.tsx:13`, `text-destructive` na `bg-destructive/10`) w `.dark`: **≈1,73:1**
     (dziś `--destructive` to jasna czerwień `0.704`, po zmianie ciemna `0.52`). Komponent jest używany w
     `PantryMatch.tsx:80`, `SignInForm.tsx:80`, `SignUpForm.tsx:134`, `KitchenSink.tsx:192`.
  2. **Hover przycisku × na tagu** (`ghost` → `hover:bg-accent`, `button.tsx:18`, użyty w `TagInput.tsx:66-77`):
     `--accent` wobec pełnego tła tagu ma 1,04–1,19:1 w obu motywach, więc hover znika. To ten sam problem, który
     rozwiązano w `ui-pantry-tokens` („Poprawka hover”, 1,16 → 1,80).
  3. Obramowanie `aria-invalid:border-destructive` (`input.tsx:12`, `button.tsx:8`, `badge.tsx:7`) na `--background`
     w `.dark`: ≈2,10:1 (próg dla elementów niebędących tekstem to 3:1). Dziś w przeszukanym `src/` poza `ui/` nikt nie ustawia
     `aria-invalid`, więc to ryzyko na przyszłość, a nie widoczny błąd.
- `--card` przestaje być półprzezroczysta (`.dark` dziś `oklch(1 0 0 / 10%)`, `global.css:53`; po zmianie pełna
  `0.3583`). To świadomie zamyka decyzję F10 z poprzedniej zmiany: `backdrop-blur-xl` w trzech kartach przestaje
  cokolwiek robić. Inaczej jest z nagłówkiem: przy `bg-card/50` (`AppHeader.astro:7`) rozmycie zostaje.
- Ekrany auth (`signin.astro`, `signup.astro`, `confirm-email.astro`, `components/auth/*` poza `ServerError`) oraz
  `Banner.astro` mają literały (`bg-white/10`, `from-blue-200`, `bg-purple-600`, hex) i palety **nie przejmą**.
  Wyjątkiem jest tło `bg-cosmic`, które czyta tokeny. Na tych ekranach powstanie mieszanka: oliwkowe tło pod
  fioletowo-niebieską kartą.

## Detailed Findings

### Tokeny w `global.css`

- Dziś `:root` (`global.css:6-48`) to szarości shadcn plus tokeny ról z `ui-pantry-tokens`. `.dark` (`global.css:50-91`)
  to paleta „cosmic”. Publikacja przez `@theme inline` jest w `global.css:93-138`.
- Brakujące tokeny ze specyfikacji: `--staple-foreground`, `--exclude`, `--exclude-foreground`. Nie ma ich w żadnym bloku
  ani w `@theme inline` (`--color-staple` w `:132`, potem od razu `--color-warning` w `:133`). Każdy trzeba dodać w trzech
  miejscach: `:root`, `.dark` i `@theme inline`.
- Specyfikacja zmienia też `--radius` (0.625rem → 0.425rem, tylko w `:root`, `global.css:7`). To wpływa na
  `--radius-sm|md|lg|xl` (`global.css:94-97`), a więc na zaokrąglenia przycisków (`rounded-md`) i pól. Karty
  (`rounded-2xl`) i tagi (`rounded-full`) używają stałych z Tailwinda, więc tego nie odczują.
- `--sidebar-*` (`global.css:31-38`, `74-81`, `121-128`): w przeszukanym `src/` żaden plik ich nie używa (grep `sidebar` poza
  `src/styles` jest pusty). Tak samo `--chart-*`: nie ma użyć poza definicjami. Specyfikacja zostawia wybór: ustawić
  jak `--card`/`--primary` albo pominąć.
- `bg-cosmic` (`global.css:140-142`) to gradient `background → background-glow → background`. W `.dark` po zmianie:
  0.3303 → 0.36 → 0.3303 (subtelny). Użyty w `AppLayout.astro:13` i trzech stronach auth (`signin.astro:10`,
  `signup.astro:10`, `confirm-email.astro:22`).

### Warianty `badge.tsx`

- Dziś (`badge.tsx:18-20`): `have` = `border-have/40 bg-have/20 text-have-foreground`, `staple` = `border-staple/40
bg-staple/15 text-foreground`, `exclude` = `border-destructive/40 bg-destructive/15 text-foreground`.
- Specyfikacja: pełne tło plus `border-<x>-foreground/30` i `text-<x>-foreground` dla wszystkich trzech. Po zmianie
  `exclude` przestaje zależeć od `--destructive`.
- **Przekreślenie**: specyfikacja mówi przy `exclude`: „+ przekreślenie zostaje jak jest”. Wariant `exclude`
  (`badge.tsx:20`) **nie ma** dziś przekreślenia. Jedyne `line-through` w przeszukanym `src/` to `RecipeTile.tsx:29`
  (`decoration-muted-foreground`). Działa ono wewnątrz badge `have` lub `muted` dla składnika z `mainExcluded`. Czytam
  to zdanie jako „nie dodawać przekreślenia do wariantu”. Kolor `decoration-muted-foreground` na nowym pełnym `have`
  nie jest tekstem i nie ma progu WCAG.
- Pozostałe warianty (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`, `muted`) czytają ogólne tokeny
  i zmienią się same. `destructive` w `.dark` używa `dark:bg-destructive/60` (`badge.tsx:14`, `button.tsx:14`); biały
  tekst na tym kolorze nałożonym na kartę ma ≈7,15:1. W przeszukanym `src/` żaden plik nie używa wariantu
  `destructive` (grep `variant="destructive"` jest pusty). Specyfikacja liczy 5,80 dla pełnego `--destructive`.

### Użycia w `src/` (grep `have|staple|destructive|warning|brand-(from|to)|background-glow|bg-cosmic|exclude|primary-hover|input-hover`)

Użycia **wizualne** (klasy i tokeny), wszystkie, które grep zwrócił:

| plik:linia                                                   | użycie                                                     | skutek palety                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `ui/badge.tsx:18-20`                                         | warianty tagów                                             | zmiana wg specyfikacji                                             |
| `ui/badge.tsx:7,14`, `ui/button.tsx:8,14`, `ui/input.tsx:12` | `destructive` (aria-invalid, wariant destructive)          | obramowanie aria-invalid w `.dark` ≈2,10:1 (patrz Summary 3)       |
| `auth/ServerError.tsx:13`                                    | `border-destructive/30 bg-destructive/10 text-destructive` | **≈1,73:1 w `.dark`**, ≈3,92:1 w `:root` (oba < 4,5)               |
| `pantry/PantryStates.tsx:9`                                  | `text-warning` (`LimitNotice`)                             | specyfikacja: 6,90 / 5,52 na karcie ✓                              |
| `AppHeader.astro:9`                                          | `from-brand-from to-brand-to` (logo, `bg-clip-text`)       | ≈6,75–7,28 (`.dark`), ≈4,94–5,18 (`:root`) na `card/50` nad tłem ✓ |
| `AppLayout.astro:13`, `auth/*.astro`                         | `bg-cosmic`                                                | czyta `--background(-glow)`                                        |
| `ui/button.tsx:12`                                           | `hover:bg-primary-hover`                                   | nowa wartość w specyfikacji                                        |
| `ui/input.tsx:11`                                            | `enabled:hover:border-input-hover`                         | `.dark` 0.62 wobec `--input` 0.4448                                |

Użycia **niewizualne** (nazwy sekcji i statusów, nie tokeny, bez wpływu): `types.ts:47`, `hooks/usePantryMatch.ts:8-86`,
`pantry/PantryMatch.tsx:12-27` (mapa sekcja → wariant), `pantry/TagInput.tsx:8` (`TagVariant`), `dev/KitchenSink.tsx:46-62,187`,
`pages/api/recipes/match.ts`, `lib/services/recipes.ts`, `lib/matching/*`, testy. `Banner.astro:2,32` ma wariant
`warning` z literałami hex (`Banner.astro:27-41`), więc nie czyta tokenu `--warning`.

### Pary bez pokrycia w specyfikacji (policzone)

Skrypt: oklch → OKLab → liniowe sRGB → luminancja WCAG. Kolory z alfą mieszałem w liniowym sRGB (Tailwind 4 używa
`color-mix(in oklab)`), więc wartości z alfą są przybliżone. Wartości bez alfy zgadzają się ze specyfikacją.

| para                                                                 | `.dark`   | `:root`   |
| -------------------------------------------------------------------- | --------- | --------- |
| `text-destructive` / `bg-destructive/10` na karcie (`ServerError`)   | 1,73      | 3,92      |
| `--destructive` / `--background` (obramowanie aria-invalid)          | 2,10      | 4,07      |
| `--accent` / `--have` (hover × na tagu)                              | 1,04      | 1,11      |
| `--accent` / `--staple`                                              | 1,07      | 1,03      |
| `--accent` / `--exclude`                                             | 1,19      | 1,12      |
| `*-foreground` tagu / `--accent` (ikona × przy hoverze)              | 5,04–5,57 | 5,34–5,92 |
| `--primary-foreground` / `--primary` (badge % w `RecipeTile.tsx:52`) | 5,29      | 5,65      |
| `--muted-foreground` / `--card`                                      | 4,91      | 4,79      |
| `--foreground` / `--card`                                            | 8,68      | 6,04      |

### Pozostałe skutki uboczne

- `--accent`, `--secondary`, `--border` i `--input` w `.dark` dostają tę samą wartość `0.4448 0.0239 84.5498`.
  Skutek dla przycisku `outline` (`button.tsx:16`): obramowanie i tło przy hoverze mają ten sam kolor. `Skeleton`
  (`skeleton.tsx:7`, `bg-accent`) na karcie ma ≈0.4448 wobec 0.3583, więc pozostaje widoczny.
- Wariant `muted` (`bg-card/50`) leży na `bg-card` kafelka (`RecipeTile.tsx:48`). Przy nieprzezroczystej karcie
  `card/50` na `card` daje kolor karty, więc tag „brak informacji” odróżnia się tylko obramowaniem `border-border`.
- `backdrop-blur-xl` przy pełnej `bg-card`: `PantryMatch.tsx:40`, `RecipeTile.tsx:48`, `KitchenSink.tsx:71` (bez efektu
  wizualnego). `AppHeader.astro:7` (`bg-card/50`) zachowuje efekt.

## Code References

- `src/styles/global.css:6-48` — `:root`; `:50-91` — `.dark`; `:93-138` — `@theme inline`; `:140-142` — `bg-cosmic`
- `src/components/ui/badge.tsx:18-20` — warianty `have`/`staple`/`exclude`
- `src/components/ui/button.tsx:16,18` — hover `outline`/`ghost` przez `--accent`
- `src/components/pantry/TagInput.tsx:64-77` — badge tagu z przyciskiem `ghost` ×
- `src/components/recipes/RecipeTile.tsx:16,24,29,48,52` — warianty `muted`/`have`, przekreślenie, karta, badge %
- `src/components/auth/ServerError.tsx:13` — komunikat błędu na `--destructive`
- `src/components/pantry/PantryStates.tsx:9` — `LimitNotice` (`text-warning`)
- `src/components/AppHeader.astro:7,9` — nagłówek `bg-card/50`, logo z gradientem brand
- `src/layouts/Layout.astro:14` — `class="dark"` na `<html>`
- `scripts/check-ui-literals.mjs:11-22` — `CLEAN_FILES` (10 plików; auth `.astro`, `FormField`, `SubmitButton`,
  `PasswordToggle`, `Banner` są poza listą)

## Architecture Insights

- Kontrakt z AGENTS.md („brakujący wygląd to nowy wariant w `ui/`, a nie kolor w `className`”) ułatwia tę zmianę.
  Widoki znają tylko nazwy wariantów, więc zmiana tokenów i trzech linii w `badge.tsx` wystarcza dla widoku `/`.
- `src/components/ui/` nie jest skanowany przez `check:ui`. Nowe warianty muszą używać tylko tokenów (specyfikacja to
  spełnia), a skaner tego nie wymusi.
- Dodanie trzech tokenów wymaga wpisów w trzech blokach. Pominięcie `@theme inline` sprawi, że klasy `bg-exclude`
  i inne nie zostaną wygenerowane, i nic tego nie zgłosi: build przejdzie, a tag pozostanie bez koloru.
- KitchenSink (`KitchenSink.tsx:53-62`) już renderuje wszystkie trzy warianty tagów i `ServerError`/`LimitNotice`, więc
  nadaje się do bramki zrzutu ekranu bez nowych stanów. Przycisku × w stanie hover nie da się jednak pokazać statycznie.

## Historical Context (from prior changes)

- `context/archive/2026-10-14-ui-pantry-tokens/tokens.md`, sekcja „Półprzezroczysta `--card`”: `.dark --card` 10% bieli
  była wyborem celowym (prześwit `bg-cosmic`), z adnotacją „do przemyślenia przy zmianie palety (F10)”. Nowa paleta
  rozstrzyga to na rzecz pełnej karty. Popover, secondary i muted przestają też być szarościami shadcn spoza palety.
  Zastrzeżenie z tej sekcji o shadcn Card/Popover się dezaktualizuje.
- Tamże, „Poprawka hover”: każdy hover musi mieć widoczny krok wobec stanu spoczynku. Przycisk × miał 1,80 po
  poprawce, a po nowej palecie spada do ≈1,04–1,19 (patrz wyżej). To regresja względem wcześniej zaakceptowanego ustalenia.
- Tamże, „Poprawka hover”: `outline` potrzebuje `dark:hover:bg-accent`, bo `dark:bg-input/30` przykrywa
  `hover:bg-accent`. To nadal obowiązuje (`button.tsx:16`) i nie wymaga zmian.
- Tamże: `SubmitButton` nadpisuje hover literałem `hover:bg-purple-500`. Nadal prawda (`SubmitButton.tsx:18`), więc
  przycisk na ekranach auth zostanie fioletowy.

## Related Research

- `context/archive/2026-10-14-ui-pantry-tokens/research.md`

## Open Questions

Decyzje do `/10x-plan` (fakty są ustalone, wybór należy do autorki):

1. **`ServerError` w `.dark`**: specyfikacja przyciemnia `--destructive` pod biały tekst przycisku, a to psuje tekst
   błędu na ciemnym tle. Opcje: (a) osobny token tekstu błędu, np. `--destructive-foreground` / `--error`, jasny w
   `.dark`, i `ServerError` na nim; (b) `ServerError` na `bg-exclude text-exclude-foreground` (≈6,0:1, ale miesza
   semantykę tagu i błędu); (c) jaśniejsze `--destructive` w `.dark`, ale wtedy biały tekst na `dark:bg-destructive/60`
   musi zostać sprawdzony ponownie.
2. **Hover × na tagu**: osobny hover dla przycisku w tagu (np. `hover:bg-<x>-foreground/15` przez wariant w `ui/`)
   albo wspólny token. Musi przejść regułę „widoczny krok” z `ui-pantry-tokens`.
3. **Ekrany auth i `Banner.astro`**: zostają poza zakresem (specyfikacja: „tylko global.css + badge.tsx”), czy mają
   być osobną zmianą? Po wdrożeniu ich wygląd będzie mieszanką oliwkowego tła z fioletem.
4. **`--sidebar-*` / `--chart-*`**: ustawić wg specyfikacji czy usunąć. Nieużywane w `src/`.
5. **Rejestr tokenów**: czy plan ma zapisać źródła nowych wartości (jak `tokens.md` w archiwum). AGENTS.md wskazuje
   archiwalny `tokens.md` jako rejestr źródeł, a po tej zmianie będzie on nieaktualny.
