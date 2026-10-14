# Widok spiżarki na tokenach — Plan Brief

> Full plan: `context/changes/ui-pantry-tokens/plan.md`
> Research: `context/changes/ui-pantry-tokens/research.md`

## What & Why

Widok `/` (spiżarka i lista przepisów) wygląda poprawnie, ale każdy kolor jest wpisany literałem w każdym pliku.
Repo ma kompletny zestaw tokenów shadcn, z którego nic nie korzysta. Zmiana podpina widok pod tokeny i komponenty
`ui/`, uzupełnia brakujące stany i zostawia regułę oraz skan, żeby kolejne widoki dziedziczyły kontrakt zamiast
literałów.

## Starting Point

6 plików widoku: 25 linii z literałami, 0 klas tokenów. Aktywne są jasne, szare tokeny `:root`, bo nic nie ustawia
`.dark`; widok maluje ciemny motyw „cosmic” sam. `cn()` (tailwind-merge) pozwala literałom po cichu nadpisywać
warianty `Button`/`Badge`/`Input`. Błąd nie jest ogłaszany, ładowanie to sam tekst, fokus na przyciskach ledwo
widoczny.

## Desired End State

`<html class="dark">`, paleta „cosmic” w `.dark` i w kilku tokenach ról; widok używa tylko tokenów i wariantów.
Wszystkie 7 stanów widać na `/dev/kitchen-sink` (tylko dev). `npm run check:ui` w CI i lint-staged blokuje literały
w wyczyszczonych plikach, a `AGENTS.md` mówi agentom, gdzie są tokeny i komponenty. Użytkownik widzi ten sam
ekran, plus widoczny fokus, szkielet przy ładowaniu i ogłaszany błąd.

## Key Decisions Made

| Decision          | Choice                                                                                    | Why (1 sentence)                                                 | Source   |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| Wariant kontraktu | Martwy plik tokenów → przenieść obecną paletę, bez nowego motywu                          | Tokeny i komponenty już są; brakuje tylko wartości i konsumentów | Research |
| Ciemny motyw      | `class="dark"` na `<html>`, paleta w `.dark`                                              | Uaktywnia gotowe klasy `dark:` w `input`/`button`/`badge`        | Plan     |
| Gradient          | `bg-cosmic` zostaje, oparty na `--background` + `--background-glow`                       | Brak zmiany wyglądu `/` i ekranów auth                           | Plan     |
| Zakres            | Widok + `AppLayout`/`AppHeader`; auth odroczone (C5)                                      | Jeden widok na zmianę; cały ekran `/` spójny                     | Plan     |
| Role dopasowania  | Tokeny `have`, `staple`, `warning`; wykluczenia = `destructive`; warianty `Badge`         | Jeden kolor „mam” w spiżarce i na kafelku                        | Plan     |
| Bramka wizualna   | `/dev/kitchen-sink` (404 poza dev) + ręczne zrzuty desktop i 360 px                       | Bez nowej zależności; dowód do przeglądu                         | Plan     |
| Zabezpieczenie    | `scripts/check-ui-literals.mjs` w CI i lint-staged + sekcja `## UI` w `AGENTS.md`         | Działa na `.astro` i `.tsx`, bez nowej zależności                | Plan     |
| Ładowanie         | Szkielet kafelków (shadcn `skeleton`) przy pustej liście, przyciemnienie przy odświeżaniu | Brak przeskoku układu                                            | Plan     |

## Scope

**In scope:**

- `global.css` (`.dark`, tokeny ról, `bg-cosmic`), `Layout.astro` (`class="dark"`), `badge.tsx` (warianty ról),
  `skeleton.tsx`
- `AppLayout`, `AppHeader`, `PantryMatch`, `TagInput`, `RecipeTile`, `ServerError`, nowy `PantryStates.tsx`
- `/dev/kitchen-sink`, `scripts/check-ui-literals.mjs` + test, CI, lint-staged, `AGENTS.md`

**Out of scope:**

- Ekrany auth, `FormField`, `SubmitButton`, `Banner` (osobna zmiana)
- Jasny motyw i przełącznik, nowa paleta, Playwright, strona 404, logika dopasowania

## Architecture / Approach

Wartości żyją w `:root`/`.dark`, `@theme inline` publikuje je jako `--color-*`, widok używa klas ról (`bg-card`,
`text-muted-foreground`, `bg-primary`, `Badge variant="have"`). Brakujący wygląd to nowy wariant w `ui/`, nigdy kolor
w `className` w miejscu użycia.

## Phases at a Glance

| Phase                   | What it delivers                                                        | Key risk                                                    |
| ----------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Tokeny i biblioteka  | `.dark` aktywne, paleta i role w tokenach, `skeleton`, warianty `Badge` | `.dark` zmienia wygląd ekranów auth                         |
| 2. Widok na tokenach    | Skan widoku = 0, warianty bez nadpisań                                  | Odcienie po przeliczeniu na oklch odbiegają od dzisiejszych |
| 3. Stany i kitchen sink | 7 stanów na `/dev/kitchen-sink`, szkielet, `role="alert"`               | Kitchen sink wycieka do produkcji                           |
| 4. Zabezpieczenie       | `check:ui` w CI i lint-staged, `## UI` w `AGENTS.md`                    | Lista plików skanu nie rośnie z kolejnymi widokami          |

**Prerequisites:** lokalny Supabase z przepisami (do `/`), zrzuty „before” przed Fazą 1.
**Estimated effort:** ~2–3 sesje w 4 fazach.

## Open Risks & Assumptions

- `ServerError` jest współdzielony z auth — odcień błędu na ekranach logowania zmieni się nieznacznie (zamierzone).
- Hover przycisków przechodzi z `purple-500` na `primary/90` — mała, zamierzona różnica.
- Klasy `dark:` z `ui/` wygrywają z literałami: tło pól (~6% zamiast 10% bieli), przyciski `outline`, kolor fokusu
  i zaznaczenia zmieniają się już w Fazie 1 — przyjęte i zapisane w kryteriach (przegląd planu, F2).
- Kontrast `muted-foreground` i `warning` ≥ 4.5:1 to założenie do zmierzenia w Fazie 1.

## Success Criteria (Summary)

- `/` wygląda jak dziś, ale każdy kolor pochodzi z tokenu, a skan w CI to pilnuje.
- Fokus jest widoczny na każdej kontrolce, błąd jest ogłaszany, ładowanie nie przesuwa układu.
- Trzy ręczne kontrole otwarte po S-03 są potwierdzone.
