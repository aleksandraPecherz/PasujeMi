# card-style (#21) — Plan Brief

> Full plan: `context/changes/card-style/plan.md`
> Research: `context/changes/card-style/research.md`

## What & Why

Issue #21: wygląd „neo-brutal” (gruba ramka w `--foreground`, twardy cień, wciskany przycisk) jako wariant w
`src/components/ui/`, użyty tylko na kafelku przepisu i kartach auth. Przy okazji `Banner.astro` schodzi z literałów
hex na tokeny i trafia pod skaner `check:ui`.

## Starting Point

W `ui/` nie ma karty. Każda karta to ręczny zestaw `border-border bg-card rounded-2xl border` (14 miejsc).
`Banner.astro` ma 9 literałów hex w `<style>` i trzy warianty, z których używany jest tylko `error`. Strony auth
mają `backdrop-blur-xl`, które przy pełnym tle nic nie robi.

## Desired End State

Kafelek przepisu i karty `signin` / `signup` / `confirm-email` mają ramkę 2px i cień `6px 6px 0` w kolorze tekstu,
przełączany z motywem. Przycisk logowania i rejestracji przy kliknięciu przesuwa się o 3px i traci cień. Banner błędu
korzysta z tokenów `--destructive`. Kitchen sink pokazuje wszystkie nowe stany.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Kafelek | Wariant karty `brutal`, bez wciskania, hover jak dziś, `after:rounded-lg` | Kafelek jest linkiem, nie przyciskiem; pierścień fokusu musi pasować do rogów | Plan (użytkownik) |
| Zakres auth | signin, signup, confirm-email; `SubmitButton` z propem `variant`; pola bez zmian | Trzy strony mają ten sam zestaw klas | Plan (użytkownik) |
| `backdrop-blur-xl` | Usunięte | Przy pełnym `bg-card` nie daje efektu | Research / Plan |
| Cień | Tokeny `--shadow-brutal(-sm)` w `@theme inline` | Bez wartości arbitralnych, kolor idzie za motywem | Plan (użytkownik) |
| Karta | `ui/card.tsx` (shadcn) + `cardVariants` `default`/`brutal`; w Astro przez `class:list` | Wzorzec `buttonVariants` w `AppHeader.astro` | Plan (użytkownik) |
| Przycisk | Nowy wariant `pressable` w `button.tsx` | Wygląd jako wariant w `ui/`, nie klasy w widoku | Plan |
| Banner | Własne `cva` w `ui/banner.ts`, tylko `error`; `info`/`warning` usunięte; do `CLEAN_FILES` | Jedyne użycie to `error` | Plan (użytkownik) |
| Promień | `rounded-lg` na karcie i przycisku; szkielet listy też `rounded-lg` | Istniejący token, najbliżej 8px/6px z galerii | Plan (użytkownik) |
| Reduced motion | `motion-reduce:transition-none` na `pressable` | Zostaje informacja „wciśnięte”, znika ruch | Plan |
| Banner w kitchen sink | W `kitchen-sink.astro`, nad wyspą React | Komponent Astro nie wejdzie do wyspy | Plan |

## Scope

**In scope:**
- Tokeny cienia, `ui/card.tsx`, wariant `pressable`, `ui/banner.ts`
- `Banner.astro` + `CLEAN_FILES`
- `RecipeTile`, szkielet w `PantryStates`
- Trzy strony auth, `SubmitButton`, `SignInForm`, `SignUpForm`
- Stany w kitchen sink, jedna linia w `AGENTS.md`

**Out of scope:**
- Strona szczegółów przepisu (S-07) i pozostałe karty w aplikacji
- Wciskanie kafelka, pola formularza, tagi składników
- Nowy token promienia, migracje, API

## Architecture / Approach

Najpierw kontrakt w `ui/` i `global.css`, potem widoki, które go tylko wybierają: React przez `cn(cardVariants(...))`
i `<Button variant="pressable">`, Astro przez `class:list={[cardVariants(...)]}` i `bannerVariants(...)`. `ui/` nie
jest skanowany, więc nowe warianty używają tylko tokenów. Widoki pilnuje `check:ui`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Kontrakt w ui/ i tokeny | Tokeny cienia, `card.tsx`, `pressable`, `banner.ts` | Literał w `ui/` (skaner go nie złapie) |
| 2. Banner na tokenach | Banner bez hex, w `CLEAN_FILES`, w kitchen sink | Link w bannerze traci wyróżnienie po usunięciu `<style>` |
| 3. Kafelek przepisu | Kafelek `brutal`, szkielet `rounded-lg` | `tailwind-merge` gubi hover; pierścień fokusu nie pokrywa rogów |
| 4. Karty auth | Karty auth, przycisk wciskany, kitchen sink, `AGENTS.md` | `rounded-lg` przegrywa z `rounded-md` w rozmiarach `sm`/`lg` |

**Prerequisites:** lokalny Supabase dla `npm run smoke`; gałąź `card-style`.
**Estimated effort:** ~1–2 sesje, 4 krótkie fazy.

## Open Risks & Assumptions

- Cień 6px w siatce `gap-4` (16px) się mieści; ręcznie trzeba sprawdzić `RecipeSaved` i szerokość 375px.
- `pressable` zakłada rozmiar `default`; w `sm`/`lg` promień wraca do `rounded-md` (zapisane w planie).

## Success Criteria (Summary)

- Kafelek i karty auth mają nowy wygląd w obu motywach; przycisk auth wciska się, kafelek nie.
- `Banner.astro` jest w `CLEAN_FILES`, a `check:ui`, lint, `astro check`, testy, build i smoke przechodzą.
- PR zamyka #21 („Closes #21”).
