# Paleta „oliwka” — Plan Brief

> Full plan: `context/changes/ui-palette/plan.md`
> Research: `context/changes/ui-palette/research.md`

## What & Why

Aplikacja przechodzi z palety „cosmic” (granat i fiolet) na „oliwkę” z tagami „A · ochra” z tweakcn. Przy okazji tagi
przestają mieszać kolor z tłem przez alfę. Każdy tag dostaje pełną parę tło/tekst, więc kontrast przestaje zależeć
od tła pod tagiem.

## Starting Point

Tokeny żyją w `src/styles/global.css` (`:root`, `.dark`, `@theme inline`), a widoki znają tylko nazwy wariantów
`Badge`/`Button` z `src/components/ui/`. Dzięki temu zmiana tokenów i kilku wariantów przestawia cały widok `/`.

## Desired End State

Widok `/` i kitchen sink są oliwkowe. Tagi „mam”, „stałe” i „wykluczam” są pełne, a × na każdym z nich ma widoczny
hover w kolorze tagu. Każdy tekst ma co najmniej 4,5:1 w obu motywach. `tokens.md` zapisuje źródło każdej wartości,
a zrzuty przed i po dokumentują wynik.

## Key Decisions Made

| Decision                    | Choice                                                                                         | Why (1 sentence)                                                        | Source                     |
| --------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------- |
| Tagi                        | Pełne tło + `<x>-foreground`, nowe tokeny `staple-foreground`, `exclude`, `exclude-foreground` | Kontrast niezależny od tła                                              | Research / paleta          |
| `--destructive`             | `.dark` 0.80, `:root` 0.45 (plik: 0.74 / 0.48)                                                 | Tekst `ServerError` z podkładem `/10` miał 4,28 i 3,87:1                | Plan                       |
| `--muted-foreground`        | `.dark` 0.78 (z pliku), `:root` 0.45 (plik: 0.48)                                              | Tag „brak informacji” na `bg-muted` ≥ 4,5:1 w obu motywach              | Plan                       |
| Przycisk `destructive`      | `dark:bg-destructive/45` w `Badge` i `Button`                                                  | Biały tekst ≥ 4,5:1 przy jasnym `--destructive`                         | paleta (poprawka 1)        |
| Hover ×                     | Nowy wariant `Button` `ghost-current` = `hover:bg-current/20`                                  | `ghost` podmienia kolor tekstu, więc `current` musi zostać kolorem tagu | paleta (poprawka 2) / Plan |
| Tag `muted`                 | `bg-muted` + ramka `border-border`                                                             | Tekst czytelny, ramka odróżnia od karty (1,13:1)                        | paleta (poprawka 3)        |
| Auth, `Banner`              | Poza zakresem → `ui-neo-brutal`                                                                | Karta logowania i tak dostanie nowy styl                                | paleta (poprawka 4)        |
| `--sidebar-*` / `--chart-*` | Bez zmian / wartości z palety                                                                  | Sidebar nieużywany, wykresy nic nie kosztują                            | paleta (poprawka 5)        |
| Rejestr                     | `context/changes/ui-palette/tokens.md`; ścieżka w AGENTS.md przy archiwizacji                  | Ciągłość z `ui-pantry-tokens`                                           | paleta (poprawka 6)        |
| `backdrop-blur`             | Usunięty z 3 pełnych kart, zostaje w nagłówku                                                  | Na pełnym tle nic nie robi                                              | paleta (poprawka 8)        |
| Zrzuty                      | `/` tylko element `main`, bez `localhost_4321_*.png` w commicie                                | Nie publikować adresu e-mail                                            | Plan                       |

## Scope

**In scope:**

- `global.css` (`:root`, `.dark`, `@theme inline`)
- `ui/badge.tsx`, `ui/button.tsx`
- `TagInput.tsx` (wariant ×)
- usunięcie `backdrop-blur` z 3 kart
- `tokens.md`, zrzuty przed i po

**Out of scope:**

- ekrany logowania, rejestracji i potwierdzenia e-maila, `Banner.astro`
- `--sidebar-*`
- przekreślenie tagu „wykluczam”
- włączenie jasnego motywu
- czcionka i neo-brutal

## Architecture / Approach

Zmiana jest wyłącznie na warstwie kontraktu systemu projektowego: tokeny → warianty `ui/` → widoki bez zmian
(oprócz wyboru wariantu × i usunięcia rozmycia). Odstępstwa od palety są uzasadnione kontrastem i zapisane w
`tokens.md`.

## Phases at a Glance

| Phase                    | What it delivers                                                      | Key risk                                                |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Tokeny                | Nowe wartości i 3 tokeny w `global.css`, `tokens.md`, zrzuty `before` | Zapomniany wpis w `@theme inline` daje cichy brak klasy |
| 2. Warianty i komponenty | Pełne tagi, `destructive/45`, `ghost-current`, bez blur               | `ui/` nie jest skanowany przez `check:ui`               |
| 3. Weryfikacja wizualna  | Zrzuty `after`, test hovera i fokusu, przypomnienie o AGENTS.md       | Zrzut z e-mailem trafi do repozytorium                  |

**Prerequisites:** lokalny Supabase z przepisami (seed) i konto do zalogowania na `/`. Działający `npm run dev`.
**Estimated effort:** ~1 sesja, 3 krótkie fazy.

## Open Risks & Assumptions

- Kontrast z alfą jest liczony przy mieszaniu w gamma sRGB. Tailwind 4 miesza w oklab, więc realne wartości mogą
  się różnić o kilka setnych. Najmniejszy zapas to `ServerError` na karcie w ciemnym motywie (4,64:1).
- `hover:bg-current/20`: sprawdzone w przeglądzie planu, Tailwind 4.3.3 generuje
  `color-mix(in oklab, currentcolor 20%, transparent)`. Faza 2 sprawdza to grepem po buildzie.
- Do czasu `ui-neo-brutal` ekrany auth mają fioletową kartę na oliwkowym tle (zaakceptowane).

## Success Criteria (Summary)

- Widok `/` w nowej palecie, wszystkie teksty ≥ 4,5:1, hover × widoczny na każdym tagu.
- lint, `astro check`, `check:ui`, testy i build przechodzą.
- Zrzuty przed i po w repozytorium, bez adresu e-mail.
