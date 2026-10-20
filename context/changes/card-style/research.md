---
date: 2026-10-20T14:29:21+02:00
researcher: Claude (Opus 5.5) dla Aleksandry Pęcherz
git_commit: ed98b7c
branch: card-style
repository: PasujeMi (worktree pasujemi-style)
topic: "card-style (#21): Banner.astro na tokenach + wariant karty neo-brutal na RecipeTile i karcie logowania"
tags: [research, ui, tokens, banner, recipe-tile, signin, shadcn, tailwind4]
status: complete
last_updated: 2026-10-20
last_updated_by: Claude (Opus 5.5)
---

# Research: card-style (#21)

**Date**: 2026-10-20T14:29:21+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: ed98b7c (zmiany lokalne: tylko `context/changes/card-style/`)
**Branch**: card-style
**Repository**: PasujeMi

## Research Question

Issue #21: przenieść `Banner.astro` na tokeny i warianty z `src/components/ui/` (bez literałów kolorów, dopisać do
`CLEAN_FILES`). Dodać w `ui/` nowy wariant karty: gruba ramka w `--foreground`, twardy cień `6px 6px 0` i przycisk,
który „wciska się” po kliknięciu. Zastosować go tylko na kafelkach przepisów (`RecipeTile`) i karcie logowania. Pola
formularza zostają zwykłe. Strona szczegółów przepisu jest poza zakresem (pracuje tam S-07). Bez migracji.

## Summary

- **Banner**: `Banner.astro` ma 9 literałów hex w bloku `<style>` (`src/components/Banner.astro:27-41`), trzy warianty
  `info | warning | error` (`:2`). W sprawdzonym `src/` jedynym wywołaniem jest `Layout.astro:27` z `variant="error"`,
  które pojawia się tylko gdy brakuje `SUPABASE_URL`/`SUPABASE_KEY` (`src/lib/config-status.ts:15,21`). Plik nie jest
  w `CLEAN_FILES` (`scripts/check-ui-literals.mjs:11-43`). W `ui/` nie ma komponentu typu alert/banner (8 plików:
  alert-dialog, badge, button, checkbox, input, label, skeleton, textarea). Tokeny dla `error` istnieją
  (`--destructive`), dla `warning` jest tylko kolor tekstu `--warning` (`global.css:47,94`), dla `info` brak tokenu.
- **Karta**: w `ui/` nie ma `card.tsx`; każda karta w widokach to ręczny zestaw klas
  `border-border bg-card rounded-2xl border` (grep `rounded-2xl border` + `bg-card`/`bg-card/50` poza `ui/`:
  14 miejsc, lista niżej). Wartości z galerii stylów (nr 3 „Neo-brutal”):
  karta `border: 2px solid var(--foreground); border-radius: 8px; box-shadow: 6px 6px 0 var(--foreground)`, przycisk
  `border 2px` + `box-shadow: 3px 3px 0`, a `:active` → `transform: translate(3px,3px); box-shadow: 0 0 0`.
- **Cień jako token**: `shadow-[6px_6px_0_…]` w widoku złamie `check:ui` (reguła wartości arbitralnych,
  `check-ui-literals.mjs:51`), a w `ui/` jest zakazany regułą z `AGENTS.md`. Tailwind 4.3.3 (zainstalowany) tworzy
  utility `shadow-<nazwa>` z każdej zmiennej `--shadow-<nazwa>` w `@theme`, a `@theme inline` pozwala odwołać się do
  `var(--foreground)`, więc cień przełączy się z motywem (docs Tailwind, context7: theme.mdx, colors.mdx).
  Przesunięcia 3px/6px da się zapisać bez wartości arbitralnych: `--spacing: 0.25rem`
  (`node_modules/tailwindcss/theme.css:325`), więc `translate-x-0.75` = 3px, `translate-x-1.5` = 6px.
- **Granica S-07**: `RecipeDetails.tsx`, `pages/recipes/[id].astro`, `[id]/edit.astro`, `RecipeAuthorActions.tsx` nie
  używają `RecipeTile` (sprawdzone grep `RecipeTile` w `src/`). Zmiana `RecipeTile` dotyka tylko `PantryMatch.tsx:142`,
  `RecipeSaved.tsx:37` i kitchen sink (`KitchenSink.tsx:264-265,418-419`).
- **Bez migracji**: zmiana jest czysto wizualna; nie dotyka `supabase/` ani API.

## Detailed Findings

### Banner.astro

- Struktura: `<div class:list={["banner", `banner--${variant}`]} role={variant === "error" ? "alert" : "status"}>`
  (`Banner.astro:11`), padding 0.75rem/1rem, `font-size: 0.875rem`, `text-align: center`, `border-bottom: 1px solid`
  (`:16-21`), linki w środku `color: inherit; underline; font-weight: 600` przez `:global(a)` (`:22-26`).
- Literały: `info` `#dbeafe/#1e3a8a/#3b82f6`, `warning` `#fef3c7/#78350f/#f59e0b`, `error` `#fee2e2/#7f1d1d/#dc2626`
  (`:27-41`). Skaner liniowy (`findLiterals`, `check-ui-literals.mjs:65-70`) złapie każdą z tych linii po dopisaniu
  pliku do `CLEAN_FILES`, także w `<style>` (regex hex `:49`).
- Wywołanie: `Layout.astro:26-39`, w pętli po `missingConfigs`; zawartość to `<strong>Uwaga:</strong>`, komunikat i
  opcjonalny link `target="_blank"`. `Layout.astro` jest już w `CLEAN_FILES` (`check-ui-literals.mjs:34`).
- Kitchen sink nie ma dziś sekcji Bannera (grep `Banner` w `KitchenSink.tsx`: brak). `KitchenSink` to wyspa React
  (`pages/dev/kitchen-sink.astro:10`), a `Banner` to komponent Astro, więc nie da się go wstawić do `KitchenSink.tsx`
  bez zmiany formy (patrz Open Questions).
- Tokeny dostępne dla wariantów (wartości `global.css`, kontrast z `context/archive/2026-10-17-ui-palette/tokens.md`):
  - `error` → `text-destructive` na `bg-destructive/10` (wzorzec `ServerError`, kontrast 4.77 / 5.14 na tle wg
    `tokens.md`), ramka `border-destructive`;
  - `warning` → `--warning` jest tylko kolorem tekstu (`warning` na `background` 5.29 / 7.70 wg `tokens.md`); para
    tło/tekst istnieje tylko jako `staple`/`staple-foreground` (ochra, `global.css:43-44`);
  - `info` → brak dedykowanego tokenu; najbliżej `muted`/`muted-foreground` albo `secondary`.

### RecipeTile

- Kafelek: `<article className="border-border bg-card hover:border-ring hover:bg-accent relative flex min-w-0 flex-col
gap-3 rounded-2xl border p-4 transition-colors sm:p-5">` (`RecipeTile.tsx:48`).
- W kafelku nie ma przycisku. Cały kafelek jest linkiem: `<a>` w tytule z `after:absolute after:inset-0
after:rounded-2xl`, a fokus to `focus-visible:after:ring-2` na pseudo-elemencie (`RecipeTile.tsx:50-55`).
  Promień `after:rounded-2xl` musi zmienić się razem z promieniem karty, inaczej pierścień fokusu nie pokryje rogów.
- Badge % (`:60`) i tagi składników (`Badge` warianty `have`/`muted`, `:16,24`) leżą na `bg-card`; galeria dla stylu
  nr 3 pokazuje tagi z obwódką `1.5px currentColor`, ale issue mówi tylko o karcie i przycisku, więc tagi nie są
  w zakresie (wniosek z treści #21).
- Gdzie się renderuje: `PantryMatch.tsx:139-145` w `<ul className="grid gap-4 sm:grid-cols-2">` (odstęp 16px > cień
  6px), `RecipeSaved.tsx:37` (ekran po zapisaniu nowego przepisu), kitchen sink `:264-265` i `:418-419`.
- Szkielet listy `RecipeListSkeleton` ma `h-40 rounded-2xl` (`PantryStates.tsx:49`); jeśli promień kafelka się zmieni,
  szkielet przestanie mieć ten sam kształt (decyzja dla planu, nie wymóg #21).
- `:active` na `<article>`: kliknięcie trafia w pseudo-element `<a>`, a `:active` dotyczy też przodków aktywowanego
  elementu, więc `active:` na `article` powinno zadziałać (wniosek ze specyfikacji Selectors; niesprawdzone w
  przeglądarce — do potwierdzenia w kitchen sink).

### Karta logowania

- `signin.astro:17`: `w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-card-foreground
backdrop-blur-xl`. Ten sam zestaw klas mają `signup.astro:17` i `confirm-email.astro:27`.
- `backdrop-blur-xl` przy pełnej `--card` nic nie robi; archiwum `ui-palette` zaleciło jego usunięcie
  (`context/archive/2026-10-17-ui-palette/paleta-oliwka.md:134`), a auth zostało wtedy poza zakresem.
- Przycisk na karcie to `SubmitButton` → `<Button type="submit" className="w-full">` z domyślnym wariantem
  (`SubmitButton.tsx:15`), używany przez `SignInForm.tsx` (`:119`) i `SignUpForm.tsx` (`:144`). Nowy wariant przycisku dotknie
  rejestracji, jeśli zostanie podany w `SubmitButton`, a nie przez prop.
- Pola formularza: `FormField.tsx` (używa `Input` z `ui/`); issue wyklucza je z nowego stylu.
- Kitchen sink, sekcja „Formularze logowania” (`KitchenSink.tsx:461-480`): formularze w `bg-cosmic rounded-2xl p-6`,
  bez karty z `signin.astro`, więc dziś nie pokazuje karty logowania.

### Komponenty ui/ i jak dodać wariant

- `button.tsx:7-35`: `cva` z wariantami (w tym lokalne `nav-current`, `ghost-current`) — wzorzec dopisywania
  wariantu w `ui/` już istnieje. Bazowe klasy zawierają `transition-all` (`:8`), więc przesunięcie `active:` będzie
  animowane bez dodatkowych klas.
- `badge.tsx:58-80`: ten sam wzorzec (`have`, `staple`, `exclude`, `muted` dopisane lokalnie).
- `components.json`: styl `new-york`, `cssVariables: true`, `css: src/styles/global.css`. `npx shadcn@latest add card`
  doda `src/components/ui/card.tsx` (reguła `AGENTS.md`, sekcja UI). Wariant karty trzeba wtedy dopisać ręcznie
  (`cva`), bo upstream `Card` nie ma wariantów (wniosek; plik jeszcze nie istnieje).
- `src/components/ui/` nie jest skanowany przez `check:ui` (`check-ui-literals.mjs:72-76` skanuje tylko `CLEAN_FILES`).

### Tokeny i Tailwind 4

- Wersja: `tailwindcss` 4.3.3 (`node_modules/tailwindcss/package.json`), `package.json` `^4.2.4`.
- `global.css` publikuje tokeny przez `@theme inline` (`:101-149`); nie ma tam dziś żadnego `--shadow-*` ani własnego
  `--radius-*` poza `sm/md/lg/xl` (`:102-105`, `--radius: 0.425rem` → `rounded-lg` ≈ 6.8px, `rounded-xl` ≈ 10.8px;
  galeria używa 8px dla karty i 6px dla przycisku).
- Proponowany kształt tokenów (do decyzji w planie): `--shadow-brutal: 6px 6px 0 var(--foreground)` i
  `--shadow-brutal-sm: 3px 3px 0 var(--foreground)` w `@theme inline` → utility `shadow-brutal`, `shadow-brutal-sm`.
  Nazwa nie trafia w regex palety (`check-ui-literals.mjs:53`).
- Kontrast ramki (element nie-tekstowy, próg 3:1): `foreground` na `background` 5.79 (jasny) / 9.68 (ciemny), na
  `card` 6.04 / 8.68 (`tokens.md`, tabela „Tekst”).
- `prefers-reduced-motion`: w `src/` jest jedno użycie, `motion-reduce:animate-none` w `skeleton.tsx:7`. Przesunięcie
  przy kliknięciu warto osłonić `motion-reduce:` (decyzja dla planu).

### Granica z S-07 i reszta kart

- S-07 to `admin-manages-any-recipe`, status `proposed` (`context/foundation/roadmap.md:52`). Strona szczegółów:
  `RecipeDetails.tsx:34` (karta `rounded-2xl border`), `pages/recipes/[id].astro`, `[id]/edit.astro`,
  `RecipeAuthorActions.tsx`.
- Pozostałe karty z tym samym zestawem klas, które **nie** dostają nowego stylu wg #21: `PantryMatch.tsx:83`,
  `PantryStates.tsx:41`, `RecipeFormView.tsx:71,102,137,192`, `RecipeSaved.tsx:25`, `NotFoundView.astro:13`,
  `KitchenSink.tsx:209`, `signup.astro:17`, `confirm-email.astro:27`, `RecipeDetails.tsx:34`.

## Code References

- `src/components/Banner.astro:2,11,15-41` — warianty, rola ARIA, literały hex w `<style>`
- `src/layouts/Layout.astro:26-39` — jedyne wywołanie `Banner` (`variant="error"`)
- `src/lib/config-status.ts:11-21` — kiedy Banner się pokazuje
- `scripts/check-ui-literals.mjs:11-43,45-55,65-70` — `CLEAN_FILES`, regexy, skan liniowy
- `src/components/recipes/RecipeTile.tsx:48,50-55` — klasy kafelka, rozciągnięty link i fokus na `::after`
- `src/pages/auth/signin.astro:17` — karta logowania (`backdrop-blur-xl` bez efektu)
- `src/components/auth/SubmitButton.tsx:15` — przycisk na karcie logowania i rejestracji
- `src/components/ui/button.tsx:7-35` — `cva`, wzorzec lokalnych wariantów
- `src/styles/global.css:6-52,54-99,101-149` — tokeny `:root`, `.dark`, `@theme inline`
- `src/components/pantry/PantryMatch.tsx:139-145`, `src/components/recipes/RecipeSaved.tsx:37` — miejsca `RecipeTile`
- `src/components/pantry/PantryStates.tsx:45-53` — szkielet kafelków
- `src/components/dev/KitchenSink.tsx:263-266,413-421,460-480` — sekcje kafelka i formularzy logowania
- `src/pages/dev/kitchen-sink.astro:9-11` — strona Astro z wyspą React

## Architecture Insights

- Wygląd trzymany jest w wariantach `cva` w `ui/` (`button.tsx`, `badge.tsx`), a widoki tylko je wybierają. Karta jest
  dziś wyjątkiem: brak `ui/card.tsx`, klasy powielone w 14 miejscach.
- Kolory i cienie idą przez tokeny w `global.css` + `@theme inline`; `check:ui` pilnuje tylko plików z `CLEAN_FILES`,
  a `ui/` jest poza skanem, więc nowe warianty w `ui/` muszą być na tokenach z dyscypliny, nie z narzędzia.
- Strony auth są w Astro; React jest tylko w formularzach (`client:load`). Repo ma już wzorzec użycia wariantów `ui/`
  w Astro bez Reacta: `AppHeader.astro:3,18,25` i `NotFoundView.astro:2,16` importują `buttonVariants` i wstawiają je
  przez `class:list`. Grep `components/ui/` w `src/**/*.astro` daje tylko te 2 pliki. Ten sam wzorzec pasuje do
  `cardVariants` na `signin.astro` i do wariantów Bannera w `Banner.astro`.

## Historical Context (from prior changes)

- `context/archive/2026-10-17-ui-palette/plan.md:48-49`, `plan-brief.md:33` — auth i `Banner.astro` odłożone do
  zmiany „ui-neo-brutal” („karta logowania i tak dostaje tam nowy styl”). **Supported**: #21 to ta zmiana pod nazwą
  `card-style`; część auth została jednak zrobiona wcześniej w `theme-toggle` (niżej).
- `context/archive/2026-10-17-ui-palette/paleta-oliwka.md:134` — usunąć `backdrop-blur` z pełnych kart. **Partial**:
  zrobione dla 3 kart w `ui-palette` (`plan.md:324`), na `signin/signup/confirm-email.astro` nadal jest.
- `context/archive/2026-10-17-ui-palette/research.md:104-105` — `Banner` ma wariant `warning` z literałami i nie czyta
  `--warning`. **Supported** (`Banner.astro:32-36`).
- `context/archive/2026-10-17-theme-toggle/plan.md:5,39,274` — strony i komponenty auth przeniesione na tokeny; w #21
  zostaje `Banner.astro` i nowy styl kart. **Supported**: auth-pliki są w `CLEAN_FILES` (`check-ui-literals.mjs:27-34`).
- `context/archive/2026-10-17-ui-palette/tokens.md` — rejestr źródeł tokenów. Archiwum jest niezmienne (`AGENTS.md`),
  więc nowe tokeny (cienie) trzeba opisać w folderze tej zmiany i odnotować w `AGENTS.md`, jeśli ma tam wskazywać.
- Galeria stylów: https://claude.ai/artifact/DSAN9S4A18op3zPXmkjvk9, styl „3 · Neo-brutal” oznaczony „zmiana
  komponentów” (nie „tylko tokeny”).

## Related Research

- `context/archive/2026-10-17-ui-palette/research.md`
- `context/archive/2026-10-17-theme-toggle/research.md`
- `context/archive/2026-10-14-ui-pantry-tokens/` (zasada widocznego kroku hovera)

## Open Questions

Decyzje dla `/10x-plan` (nie blokują badania):

1. **„Przycisk, który się wciska” na kafelku.** `RecipeTile` nie ma przycisku; cały kafelek jest linkiem. Opcje:
   (a) wciska się cały kafelek (`active:translate-x-1.5 active:translate-y-1.5 active:shadow-none` na `article`),
   (b) kafelek tylko ze stylem karty, a wciskany przycisk wyłącznie na karcie logowania. Hover kafelka
   (`hover:border-ring hover:bg-accent`) przy ramce w `--foreground` też wymaga decyzji.
2. **Zakres przycisku auth.** `SubmitButton` jest wspólny dla logowania i rejestracji. Wariant przez prop tylko w
   `SignInForm` czy dla obu? To samo z kartą: issue mówi o karcie logowania, ale `signup.astro` i `confirm-email.astro`
   mają identyczną kartę obok.
3. **Forma Bannera.** (a) shadcn `alert` (React, renderowany w Astro bez `client:*`) z dopisanymi wariantami,
   (b) własne `cva` w `ui/` użyte przez `class:list` w `Banner.astro` — ten wzorzec repo już stosuje
   (`AppHeader.astro:18`, `NotFoundView.astro:16`), więc (b) jest bliższe istniejącemu kodowi. Co z nieużywanymi `info`/`warning` — zostawić na tokenach
   (`muted`/`staple`), czy usunąć (jedyne użycie to `error`)? Gdzie pokazać stany w kitchen sink (strona `.astro` czy
   osobna sekcja poza wyspą React)?
4. **Promień.** Galeria: karta 8px, przycisk 6px. Tokeny dają `rounded-lg` ≈ 6.8px i `rounded-xl` ≈ 10.8px;
   `rounded-2xl` (dziś na kafelku) to wartość domyślna Tailwinda. Wybrać istniejącą klasę czy dodać token.
5. **Szkielet listy** (`PantryStates.tsx:49`) — dopasować do nowego kształtu kafelka czy zostawić.
6. **`:active` na `article` z rozciągniętym linkiem** — do potwierdzenia w przeglądarce (kitchen sink), także dotyk.
