---
date: 2026-10-17T16:25:04+02:00
researcher: Claude (Opus 5.5) for Aleksandra Pęcherz
git_commit: d3261e39b2650480d30fce834fb17118825ab5cf
branch: recipe-count
repository: aleksandraPecherz/PasujeMi
topic: "Licznik przepisów na liście dopasowań (issue #24): stan kodu próby ze stasha po ui-palette"
tags: [research, recipes, pantry-match, kitchen-sink, tokens, supabase-count]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Po npm ci: check:ui exit 0, npm test 100/100 — luka weryfikacji (Open Question 6) zamknięta"
---

# Research: Licznik przepisów na liście dopasowań (issue #24)

**Date**: 2026-10-17T16:25:04+02:00
**Researcher**: Claude (Opus 5.5) for Aleksandra Pęcherz
**Git Commit**: d3261e3 (HEAD = `master`; kod próby niezacommitowany w drzewie roboczym)
**Branch**: recipe-count
**Repository**: aleksandraPecherz/PasujeMi

## Research Question

Zrealizuj issue #24. Kod próby jest rozpakowany ze stasha w drzewie roboczym (7 plików, niezacommitowany).
Licznik ma używać tokenów nowej palety, bez literałów kolorów. Nowa sekcja w KitchenSink ma stać za sekcją „error”.

Issue #24: licznik powstał jako próba w kroku 17 lekcji 2.5 i działał. Dotyka API, serwisu, hooka i testu smoke.
Przed zrobieniem trzeba nałożyć stash na gałąź od aktualnego mastera („po `ui-palette` mogą być konflikty w
komponentach”), a potem przejść cały łańcuch.

## Summary

- **Stash nałożył się bez konfliktów.** `recipe-count` = `master` = `d3261e3` (merge-base to ten sam commit), a
  `git diff --stat` pokazuje 7 plików, +55/−14. Żaden plik nie ma znaczników konfliktu.
- **Wymagania z prośby są już spełnione w kodzie próby:**
  - `RecipeCount` używa tylko tokenów: `text-muted-foreground text-sm` (`src/components/pantry/PantryStates.tsx:27`).
  - Sekcja `count` w KitchenSink stoi bezpośrednio za sekcją `error`, a przed `empty`
    (`src/components/dev/KitchenSink.tsx:191`, `:195`, `:202`).
  - Oba pliki są na liście `CLEAN_FILES` (`scripts/check-ui-literals.mjs:18-19`).
- **Przepływ danych jest kompletny.** Serwis liczy `total` → endpoint zwraca go bez zmian → hook sprawdza typ i
  zapisuje → widok renderuje `RecipeCount` nad listą. Do tego dochodzą asercje w smoke i w teście jednostkowym.
- **Do rozstrzygnięcia w planie** (szczegóły w Open Questions):
  - fallback `count ?? 0` w `listRecipes`,
  - semantyka `total` w `matchRecipes` liczona przed krokiem 4,
  - zachowanie licznika podczas przeładowania,
  - wspólny helper odmiany.
- **Aktualizacja:** po `npm ci` `check:ui` przechodzi (exit 0), a `npm test` daje 100/100 (Open Question 6). Akapit
  poniżej opisuje stan sprzed naprawy.
- **Luka weryfikacyjna (zamknięta):** `npm run check:ui` i Vitest nie uruchomiły się w tym worktree. W `node_modules` brakuje
  `@jridgewell/trace-mapping/dist/trace-mapping.mjs` (jest tylko `trace-mapping.umd.js`) → `ERR_MODULE_NOT_FOUND`.
  Brak literałów potwierdzono ręcznym odczytem diffu, a nie skryptem. `npx prettier --check` na 7 plikach przeszedł.

## Detailed Findings

### Serwis — `src/lib/services/recipes.ts`

- `listRecipes`: dodano `{ count: "exact" }` do `select` (`:57`) i `total: count ?? 0` (`:70`).
  - W postgrest-js `count` jest parsowany z nagłówka `Content-Range` (część po `/`). Dzieje się to tylko na ścieżce
    `res.ok` i tylko przy nagłówku `Prefer: count=…`; w przeciwnym razie zostaje `null`
    (źródło: Context7 `/supabase/supabase-js`, `PostgrestBuilder.ts`).
  - Liczba po `/` w PostgREST to liczba wierszy po filtrach i RLS, niezależnie od `range()`. To wniosek z semantyki
    `Content-Range`, nie zweryfikowany testem w tym repo.
  - `listRecipes` nie ma testu jednostkowego. Sprawdzono importy w `src/lib/services/recipes.test.ts:4`: importowany
    jest tylko `matchRecipes`.
- `matchRecipes`: `total = ranked.length` (`:169`), zwracane na obu ścieżkach wyjścia: pustej strony (`:171`) i
  końcowej (`:206`).
  - Komentarz przy `:168` mówi wprost, że przepis odrzucony w kroku 4 (usunięty albo wykluczony po przeliczeniu
    kluczy) nadal jest wliczony. Licznik może więc w rzadkim wyścigu przewyższać liczbę faktycznie dostępnych
    przepisów.
  - Ta sama asymetria już istnieje dla `hasMore` (`:167`), więc `total` jest z nim spójny.
  - Nie dochodzi żadna nowa pętla ani zapytanie, więc reguła „Bound user-driven CPU work” z `lessons.md` nie jest
    naruszona. W `listRecipes` przybywa jedynie `count=exact` (koszt po stronie Postgresa).

### Endpointy — `src/pages/api/recipes/index.ts`, `match.ts`

- Oba robią `Response.json(page)` z wynikiem serwisu (`index.ts:25-26`, `match.ts:50-51`), więc `total` trafia do
  odpowiedzi bez zmian w tych plikach. To tłumaczy, czemu issue wspomina „API”, a diff go nie dotyka.

### Hook — `src/components/hooks/usePantryMatch.ts`

- `parsePage` odrzuca body bez numerycznego `total` (`:67`). Zgodnie z lekcją „Assert status and body type before
  content” kształt jest sprawdzany przed treścią.
- `total` jest w stanie (`:132`). Ustawia go tylko `commit` przy udanej odpowiedzi najnowszego żądania (`:156`), a
  hook go eksportuje (`:238`).
- Przy błędzie (`!result.ok`) `total` się nie zmienia, podobnie jak `recipes`. Licznik pozostaje spójny ze starą
  listą, która wciąż jest wyświetlana.

### Widok — `src/components/pantry/PantryMatch.tsx`

- `{recipes.length > 0 && <RecipeCount total={total} />}` (`:90`) stoi przed `<ul>`.
- Podczas przeładowania (nowe filtry, `loading`) lista dostaje `opacity-60` (`:93`), a licznik nie. Do tego czasu
  pokazuje stary `total`.
- Przy zerze przepisów licznik się nie renderuje. W tym stanie widoczne jest `EmptyState`.

### Komponent — `src/components/pantry/PantryStates.tsx:20-31`

- Odmiana przez `Intl.PluralRules("pl")` z mapą `{ one: "przepis", few: "przepisy" }` i domyślnym „przepisów”.
  Reguły CLDR dla `pl` dają: 1 → one, 3 i 22 → few, 12 → many. Daje to „1 przepis”, „3 przepisy”, „12 przepisów”,
  „22 przepisy”, czyli zgodnie z polszczyzną.
- Klasy `text-muted-foreground text-sm` to tokeny. `--muted-foreground` ma po ui-palette wartości
  `oklch(0.45 0.03 60)` (jasny, `src/styles/global.css:19`) i `oklch(0.78 0.017 73.6)` (ciemny, `:65`); token jest
  opublikowany w `@theme inline` (`:115`).
- Kontrast tego tokenu na tle był mierzony w ui-palette (`context/archive/2026-10-17-ui-palette/paleta-oliwka.md:114`,
  `plan.md:40`). Licznik stoi na tle sekcji, nie na `bg-muted`.

### KitchenSink — `src/components/dev/KitchenSink.tsx:195-200`

- Sekcja `count` z notatką o odmianie pokazuje 4 przypadki: 1, 3, 12, 22. Obejmuje to wszystkie trzy formy plus
  pułapkę 12 vs 22.
- Kolejność sekcji: `error` (`:191`) → `count` (`:195`) → `empty` (`:202`) → `loading` (`:209`).

### Smoke i testy

- `scripts/smoke.mjs:74-75`: lista bez filtrów wymaga `typeof total === "number"` i `total >= 5`.
- `scripts/smoke.mjs:88`: dopasowanie z wykluczeniem „jogurt” wymaga `total === 4`, sprawdzanego razem z kształtem
  przed treścią. Komentarz przy `:85-86` mówi, że w seedzie zostają 4 przepisy.
- `src/lib/services/recipes.test.ts:150`: `expect(result.total).toBe(rows.length)` w teście stronicowania
  `matchRecipes`. W pozostałych testach `matchRecipes` (`:160-304`) nie ma asercji `total`, w tym w ścieżce
  „excluded” i pustej strony.

## Code References

- `src/lib/services/recipes.ts:57,70` — `count: "exact"` i fallback `count ?? 0` w `listRecipes`
- `src/lib/services/recipes.ts:168-171,206` — `total = ranked.length` w `matchRecipes`
- `src/pages/api/recipes/index.ts:25-26`, `src/pages/api/recipes/match.ts:50-51` — przekazanie wyniku serwisu bez zmian
- `src/components/hooks/usePantryMatch.ts:62-86,132,156,238` — walidacja, stan i eksport `total`
- `src/components/pantry/PantryMatch.tsx:90,93` — render licznika; `opacity-60` tylko na liście
- `src/components/pantry/PantryStates.tsx:20-31` — `RecipeCount` z odmianą
- `src/components/dev/KitchenSink.tsx:191-207` — sekcje `error` → `count` → `empty`
- `scripts/check-ui-literals.mjs:11-22` — `CLEAN_FILES` (zawiera oba pliki UI licznika)
- `scripts/smoke.mjs:74-75,88` — asercje `total`
- `src/lib/services/recipes.test.ts:150` — asercja `total` w teście stronicowania
- `src/components/auth/SignUpForm.tsx:10-15` — istniejąca ręczna odmiana „znak/znaki/znaków”

## Architecture Insights

- Kontrakt odpowiedzi list przepisów `{ recipes, hasMore }` rozszerza się do `{ recipes, hasMore, total }`. Typy są
  inline w sygnaturach serwisu, a nie w `src/types.ts`. Klient ma jeden konsument: `usePantryMatch`.
- Stany widoku mieszkają w `PantryStates.tsx` i są pokazywane w KitchenSink (reguła z AGENTS.md: „add each new
  component state there”). Kod próby to spełnia.
- W repo są teraz dwa wzorce polskiej odmiany: ręczny w `SignUpForm.tsx:11-15` (zakres 1–5) i `Intl.PluralRules` w
  `PantryStates.tsx:21`. Wariant ręczny przy 22 dałby „znaków”, ale tam licznik nie przekracza 5, więc nie jest to
  błąd. Przy przepisach (dowolne N) poprawny jest tylko wariant `Intl`.

## Historical Context (from prior changes)

- `context/archive/2026-10-17-ui-palette/plan.md:40,103`: jasny `--muted-foreground` skorygowano do 0.45, żeby
  dawał ≥4,5:1 także na `bg-muted`. Wspiera to użycie tego tokenu przez licznik.
- `context/archive/2026-10-17-ui-palette/paleta-oliwka.md:114-115`: pomiary kontrastu `muted-foreground` na tle i na
  `muted`. Wartość jasna w tym dokumencie to 0.48 (stan przed korektą z planu). Bieżąca wartość w `global.css:19` to
  0.45, więc ten wiersz jest nieaktualny co do liczby, ale nie co do wniosku (kontrast ≥4,5:1).
- `context/archive/2026-10-12-login-gated-app-shell/plan.md:47`: wcześniejsza decyzja o polskiej odmianie (1 / 2–4 /
  5+) dla zakresu 1–5. Nie obejmuje liczb ≥ 12, w których reguła „2–4” się łamie (12–14 → „-ów”, 22–24 → „-y”).
- `context/foundation/lessons.md`: obowiązują trzy lekcje. „Closes #24” w PR (lekcja 1), kształt przed treścią w
  smoke/hooku (lekcja 2, spełniona), brak nowej pracy CPU per request (lekcja 3, spełniona).
- W `context/foundation/` i `context/archive/` nie znaleziono wcześniejszej decyzji o liczniku przepisów. Szukano
  `licznik`, `total`, `#24`, `recipe count`.

## Related Research

- `context/archive/2026-10-17-ui-palette/research.md` — tokeny palety (źródło wartości `--muted-foreground`)

## Open Questions

1. **`count ?? 0` w `listRecipes` (`recipes.ts:70`).** Gdy `count` nie przyjdzie, licznik pokaże „Znaleziono 0
   przepisów” nad niepustą listą. Hook to przepuści, bo `0` jest liczbą. Do decyzji:
   - rzucić błąd albo zalogować przy `count === null`,
   - albo wziąć `offset + data.length` jako dolne oszacowanie.
2. **Semantyka `total` w `matchRecipes`.** Liczony przed krokiem 4, więc może być zawyżony o przepisy usunięte lub
   wykluczone w trakcie żądania (komentarz `:168`). Akceptujemy, jak przy `hasMore`, czy dokumentujemy w UI?
3. **Licznik podczas przeładowania.** Przy `loading` lista ma `opacity-60`, a licznik nie i pokazuje stary `total`.
   Przyciemnić go razem z listą (`cn(..., loading && "opacity-60")`)? Albo objąć licznik i listę wspólnym wrapperem?
4. **Testy.** Brak testu `listRecipes`. Brak asercji `total` w ścieżce wykluczeń, pustej strony
   (`offset` ≥ `ranked.length`) i usunięcia w trakcie. Brak testu odmiany (`RecipeCount` / funkcja odmiany jest
   kandydatem na test jednostkowy, gdy zostanie wydzielona do `src/lib/`).
5. **Wspólny helper odmiany.** Wydzielić `pluralPl(n, forms)` do `src/lib/` i użyć go też w `SignUpForm.tsx`? Czy
   zostawić lokalnie (poza zakresem #24)?
6. **[Rozwiązane 2026-10-17]** Po `npm ci` (680 pakietów): `node scripts/check-ui-literals.mjs` → exit 0, brak
   trafień; `npm test` (Vitest 5.0.4) → 4 pliki, 100/100 testów. `npm ci` ostrzega `EBADENGINE`: Node v22.14.0, a
   `astro-eslint-parser@3.1.0`, `eslint-plugin-astro@3.1.0` i `undici@8.10.2` wymagają `>=22.19.0`. `npm run lint` i
   `npx astro check` nadal nieuruchomione. Pierwotna treść: **Środowisko (luka weryfikacji).** Przed `/10x-implement` trzeba naprawić `node_modules` w tym worktree
   (np. `npm ci`) i uruchomić `npm run check:ui`, `npm test`, `npm run lint`, `npx astro check`. Obecnie te wyniki
   są nieznane.
