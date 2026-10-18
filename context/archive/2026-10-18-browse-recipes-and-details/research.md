---
date: 2026-10-18
researcher: Aleksandra Pęcherz
git_commit: 5dd85da9ef925c54bfc4688bbbf403e2a6537796
branch: browse-recipes
repository: pasujemi-browse
topic: "S-02 browse-recipes-and-details + issue #15 (polska strona 404)"
tags: [research, codebase, recipes, pantry, recipe-tile, middleware, 404]
status: complete
last_updated: 2026-10-18
last_updated_by: Aleksandra Pęcherz
---

# Research: S-02 — przeglądanie przepisów, doładowanie i szczegóły przepisu (+ #15)

**Date**: 2026-10-18 · **Branch**: browse-recipes · **Commit**: 5dd85da (working tree: tylko nowy folder zmiany)

## Research Question

Co w kodzie już realizuje S-02 (lista 10 przepisów bez %, doładowanie), czego brakuje do strony szczegółów przepisu z linkiem z kafelka i powrotem do listy bez utraty kontekstu, i co trzeba zrobić dla issue #15 (polska 404). Edycja i usuwanie (S-06) są poza zakresem.

## Summary

- **Lista bez filtrów i „Pokaż więcej” już istnieją** (dostarczone w S-03, nie w S-02): hook startuje od `/api/recipes?limit=10&offset=0` (`usePantryMatch.ts:5,23-34,180-191`), kafelek bez `match` nie pokazuje % (`RecipeTile.tsx:46-56`), przycisk doładowania jest w `PantryMatch.tsx:120-124`. Zakres S-02 sprowadza się więc do: **szczegółów przepisu, linku z kafelka, zachowania kontekstu listy i 404**. Zakres „zachęty do wypełnienia spiżarki” też już jest: nagłówek „Wypełnij spiżarkę, żeby zobaczyć dopasowanie” (`PantryMatch.tsx:88`).
- **Brakuje wszystkiego, co dotyczy szczegółów** na tej sprawdzonej ścieżce: brak trasy `src/pages/recipes/[id]` (w `src/pages/recipes/` jest tylko `new.astro`), brak `getRecipe` w serwisie (`recipes.ts` eksportuje `listRecipes`, `createRecipe`, `matchRecipes`), brak endpointu `GET /api/recipes/:id`, kafelek nie jest linkiem (plan S-03: `first-pantry-match/plan.md:88`).
- **Kontekst listy ginie przy nawigacji**: cały stan (tagi, `applied`, załadowane strony, `offset`) żyje w `useState` wyspy React (`usePantryMatch.ts:127-144`); nic nie trafia do URL ani do `sessionStorage` (grep po `src/components` nie znalazł `history`/`sessionStorage`/`searchParams`). Pełne przejście `<a href>` na stronę szczegółów i „wstecz” przeładuje `/` od zera: pusta spiżarka, 10 pierwszych przepisów.
- **#15**: `src/pages/404.astro` nie istnieje; middleware przepuszcza zalogowanego do `next()` (`middleware.ts:132-136`), więc 404 Astro musi wyrenderować się na `AppLayout` z `Astro.locals.user`. Niezalogowany na nieistniejącym adresie nadal dostaje redirect do `/auth/signin` (`middleware.ts:147`) — to zamierzone.

## Detailed Findings

### Lista i doładowanie (stan obecny)

- `/api/recipes` GET: `limit` domyślnie 10, max 50, `offset`; zwraca `{recipes, hasMore, total}` (`api/recipes/index.ts:7-28`). Serwis sortuje po `name`, potem `id`, pobiera `limit+1` wierszy dla `hasMore` i zwraca `total: null`, gdy offset jest za końcem (PGRST103) (`recipes.ts:52-79`).
- Hook: `PAGE_SIZE = 10`; `loadMore` pobiera `applied` z `offset` (`usePantryMatch.ts:230-232`); stare odpowiedzi są odrzucane przez `requestId` (`:146-149`).
- Widok: `<PantryMatch client:load />` w `index.astro:7`; `RecipeTile` jest renderowany w `<li>` w siatce (`PantryMatch.tsx:106-114`).
- Kafelek jest wspólny dla listy bez filtrów, z filtrami i podglądu po dodaniu (`RecipeSaved.tsx:243`) — S-03 zostawił go wprost „dla S-02” (`first-pantry-match/plan.md:100,317-321`). Roadmapa każe nie tworzyć drugiej wersji (`roadmap.md`, ryzyko S-02).

### Dane do strony szczegółów

- `Recipe` ma już wszystko dla FR-006: nazwa, `steps`, `ingredients` (nazwa, ilość, jednostka, `substitutes`), czas, porcje, rodzaje, kcal i makro na porcję (`types.ts:3-31`). `RECIPE_COLUMNS` pobiera te kolumny (`recipes.ts:15`), a `toRecipe` mapuje wiersz (`:36-50`) — `getRecipe(id)` może użyć ich bez zmian schematu.
- RLS: `recipes_select_authenticated` (`for select to authenticated using (true)`, `create_recipes.sql:32-36`) — każdy zalogowany czyta każdy przepis; szczegóły nie wymagają migracji ani nowych polityk. Pantry nie ma tu związku.
- `id` to UUID (typ w `isRecipe`: string). Nieprawidłowy lub nieistniejący id: `.eq("id", id).maybeSingle()` zwróci `null`, ale **nieprawidłowy format UUID da błąd Postgresa (22P02)** — to wniosek z zachowania Postgresa, nie sprawdzony w repo; plan powinien to zweryfikować (walidacja formatu przed zapytaniem → 404, nie 500).
- Szczegóły można renderować po stronie serwera w `.astro` (jak `recipes/new.astro`) przez `createClient(Astro.request.headers, Astro.cookies)` albo przez wyspę + nowy endpoint. SSR daje poprawny status 404 dla nieistniejącego przepisu i nie wymaga wyspy; to wybór do planu.

### Kontekst listy przy wejściu w szczegóły i powrocie

Obserwowane: stan listy jest tylko w pamięci wyspy (patrz Summary). Wnioski (nie zweryfikowane eksperymentem): zwykły link + „wstecz” przeglądarki odtworzy `/` bez filtrów i bez doładowanych stron. Opcje do wyboru w planie:

1. **Stan w URL** (`?have=…&staple=…&exclude=…&n=<liczba załadowanych>`) — wzorzec zgodny z API (powtarzane parametry w `match.ts:10-17`), działa z „wstecz” i linkami, ale musi respektować istniejące limity (`MAX_TOKENS`, `MAX_URL_LENGTH`, `limits.ts`) i lekcję o ograniczaniu wejścia (`lessons.md`: „Bound user-driven CPU work per request”).
2. **`sessionStorage`** (snapshot tagów + liczba stron) odtwarzany po montażu — prostszy URL, ale odtwarzanie wymaga ponownych zapytań i nie działa między kartami.
3. **Szczegóły jako widok w wyspie** (bez przeładowania) — zachowuje stan, ale traci adresowalność strony szczegółów i zepsuje „wstecz”/link, o co prosi S-02 („link z kafelka”).

Ograniczenie: spiżarka „posiadane” jest celowo tylko sesyjna (PRD FR-003; komentarz `match.ts:19`), więc zapis do `sessionStorage` jest zgodny z tą zasadą, a trwały zapis (S-04) nie.

Powrót do pozycji na liście (scroll) i „doładowane N stron” to osobne wymagania: kontekst = filtry + liczba załadowanych przepisów; pozycję przewijania PRD nie wymienia.

### Kafelek jako link (dostępność i UI)

- Dziś `<article>` bez interakcji; tytuł to `<h3>` (`RecipeTile.tsx:48-50`). Tag składnika jest `Badge`, nie linkiem. Link na całym kafelku wymaga wzorca „stretched link” (link w nagłówku + `after:absolute`), by nie zagnieżdżać interaktywnych elementów; stan fokusu i hover to nowe stany kafelka → trzeba dodać do kitchen-sink (`AGENTS.md`, UI) i tylko tokeny (bez literałów; `check:ui` pilnuje plików z `CLEAN_FILES`: `RecipeTile.tsx`, `index.astro`, `RecipeSaved.tsx`, są na liście, więc nowa trasa/komponent też powinny tam trafić).
- `RecipeSaved` pokazuje ten sam kafelek po zapisie — po dodaniu linku będzie linkował do własnego, właśnie zapisanego przepisu (dobre; zweryfikować, że `recipe.id` jest tam dostępne — jest, `Recipe` go zawiera).

### #15 — polska 404

- Wymagania z issue: `src/pages/404.astro` na `AppLayout`, polski komunikat, link do `/`; ma być zrobione przy S-02, bo „linki do szczegółów mogą prowadzić donikąd” (`gh issue view 15`; stan OPEN, rodzic #4).
- Ta sama strona obsłuży przepis, którego nie ma: trasa `[id].astro` powinna ustawić status 404 i wyrenderować ten sam komunikat (albo `return Astro.rewrite("/404")`). Dopasowanie do `AppLayout` (`AppLayout.astro:12-18`) daje nagłówek; `AppHeader` korzysta z `Astro.locals.user` (`AppHeader.astro:4`) — niezweryfikowane, czy `locals` jest ustawione przy renderze `404.astro` w adapterze Cloudflare; do sprawdzenia w dev (`npm run dev`) i na buildzie.
- Wcześniejsza decyzja: stary `/dashboard` świadomie daje 404 Astro (`login-gated-app-shell/plan.md:220`) — po #15 będzie to polska 404.

### Testy i weryfikacja

- Smoke (`scripts/smoke.mjs`) sprawdza `/api/recipes`, `/api/recipes/match` i POST; dla nowego endpointu/trasy (jeśli będzie) trzeba dodać sprawdzenie statusu i typu odpowiedzi przed treścią (lekcja „Assert status and body type before content”). Testy jednostkowe serwisów w `src/lib/services/recipes.test.ts`.
- CI seeduje 5 przepisów (`smoke.mjs`), więc „doładowanie” nie da się tam wykazać (jedna strona); `F-02` (import 50–100) nadal `proposed`.

## Code References

- `src/components/hooks/usePantryMatch.ts:5,23-34,126-144,180-191,230-232` — PAGE_SIZE, URL listy, stan wyspy, start bez filtrów, `loadMore`
- `src/components/pantry/PantryMatch.tsx:86-125` — sekcja listy, kafelki, „Pokaż więcej”
- `src/components/recipes/RecipeTile.tsx:45-66` — kafelek bez linku; `:46` % tylko z `match`
- `src/lib/services/recipes.ts:15,36-50,52-79` — kolumny, `toRecipe`, `listRecipes`; brak `getRecipe`
- `src/pages/api/recipes/index.ts:12-34` — GET listy
- `src/middleware.ts:114-148` — publiczne prefiksy, redirect/401, zalogowany → `next()`
- `src/layouts/AppLayout.astro`, `src/components/AppHeader.astro:4` — powłoka i `locals.user`
- `supabase/migrations/20261012120000_create_recipes.sql:25-36` — RLS select dla `authenticated`
- `scripts/check-ui-literals.mjs:11-36` — `CLEAN_FILES`
- `src/components/recipes/RecipeSaved.tsx:243` — drugi użytkownik kafelka

## Architecture Insights

- Konwencja: strony `.astro` w `AppLayout`, logika w `src/lib/services/`, wyspy tylko tam, gdzie jest interakcja; wszystkie trasy chronione domyślnie (`middleware.ts:114`), więc `/recipes/[id]` i 404 nie wymagają zmian middleware.
- Jeden wspólny kafelek (decyzja S-03 + roadmapa) — link dodać w nim, nie w kopii.
- Spiżarka „posiadane” nie jest trwała (FR-003) — decyduje o doborze mechanizmu zachowania kontekstu.

## Historical Context (from prior changes)

- `context/archive/2026-10-12-first-pantry-match/plan.md:88,100,317-321` — kafelek nie jest linkiem, wspólny z S-02: supported, nadal aktualne.
- `context/archive/2026-10-12-first-pantry-match/research.md:128` — „bez filtrów to, co daje `listRecipes`”: supported; lista bez filtrów jest zrealizowana.
- `context/archive/2026-10-12-login-gated-app-shell/plan.md:220` — 404 Astro dla `/dashboard`: supported, do zmiany przez #15.
- `context/foundation/lessons.md` — „Close roadmap issues explicitly”: PR/commit musi mieć `Closes #15` i issue S-02 (numer niezweryfikowany: `gh issue list`).

## Related Research

`context/archive/2026-10-12-first-pantry-match/research.md` (wspólny widok z S-02); `context/archive/2026-10-17-add-recipe/research.md` (kafelek w `RecipeSaved`) — nieprzeczytany w tej sesji.

## Open Questions

1. **Mechanizm zachowania kontekstu listy** (URL vs `sessionStorage` vs widok w wyspie) — wybór produktowo-techniczny dla `/10x-plan`; rekomendacja robocza: link do osobnej strony `/recipes/[id]` (adresowalna) + zachowanie filtrów i liczby załadowanych stron w URL lub `sessionStorage`.
2. **Co znaczy „bez utraty kontekstu”** — filtry + doładowane strony, czy także pozycja przewijania? (PRD milczy.)
3. **Szczegóły z kontekstem dopasowania?** Roadmapa S-02 mówi o liście bez %; czy strona szczegółów po wejściu z filtrowanej listy ma pokazywać status składników (mam/brak)? Domyślnie nie — wymagałoby przekazania filtrów.
4. **Render szczegółów**: SSR w `.astro` vs wyspa + endpoint `GET /api/recipes/:id`.
5. **Walidacja `id`** (format UUID → 404, nie 500) i zachowanie `locals.user` na `404.astro` — do sprawdzenia w implementacji.
6. Numer issue S-02 w GitHub — nie ustalony (sprawdzono tylko #15).
