# Browse recipes and details — Plan Brief

> Full plan: `context/changes/browse-recipes-and-details/plan.md`
> Research: `context/changes/browse-recipes-and-details/research.md`

## What & Why

Dokładamy stronę szczegółów przepisu `/recipes/[id]`, kafelek jako link do niej, zachowanie stanu listy po powrocie ze szczegółów oraz polską stronę 404 (#15). Użytkownik ma móc otworzyć przepis, przeczytać go i wrócić dokładnie tam, gdzie był, bez ponownego wpisywania tagów i doładowywania listy. Zmiana zamyka S-02 (#4) i #15.

## Starting Point

Lista 10 przepisów bez % i „Pokaż więcej” już działają (dostarczył je S-03), ale kafelek nie jest linkiem, nie ma trasy szczegółów ani `getRecipe`, a stan listy żyje tylko w pamięci wyspy React, więc każde wyjście ze strony go gubi. Strony 404 też nie ma.

## Desired End State

Cały kafelek prowadzi do `/recipes/[id]`, gdzie widać sam przepis (czas, porcje, rodzaje, wartości na porcję, składniki z zamiennikami, kroki), bez statusu składników. „Wstecz” albo „Wróć do listy” przywraca tagi, filtry, tyle samo załadowanych przepisów i pozycję przewijania. Nieistniejący adres albo przepis daje polską 404 ze statusem 404 i linkiem do `/`.

## Key Decisions Made

| Decision                         | Choice                                                                          | Why (1 sentence)                                                             | Source          |
| -------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------- |
| Gdzie trzymać stan listy         | `sessionStorage`, nie URL                                                       | Spiżarka „posiadane” ma być sesyjna (FR-003), a URL nie rośnie z tagami.     | Plan (user)     |
| Co znaczy „bez utraty kontekstu” | Tagi, filtry, liczba załadowanych przepisów i pozycja przewijania               | Lista ma wrócić do tego samego miejsca.                                      | Plan (user)     |
| Zawartość szczegółów             | Sam przepis, bez statusu składników względem spiżarki                           | Nie trzeba przekazywać filtrów do strony szczegółów.                         | Plan (user)     |
| Render szczegółów                | SSR w `.astro`, komponent React bez `client:*`                                  | Prawdziwy status 404 i ten sam komponent w kitchen-sink.                     | Plan            |
| Odtwarzanie załadowanych stron   | Jedno–dwa żądania z `limit ≤ 50`, nie N po 10; twardy limit 100 przepisów       | Każde `/api/recipes/match` przebiega cały katalog, a limit CPU to 10 ms.     | Plan            |
| Zły format id                    | Walidacja UUID przed zapytaniem → 404                                           | Inaczej Postgres zwraca błąd 22P02, czyli 500.                               | Research / Plan |
| Link w kafelku                   | „Stretched link” na tytule we wspólnym `RecipeTile`                             | Jeden element fokusowalny, brak zagnieżdżonych interaktywnych elementów.     | Research        |
| Odczyt snapshotu                 | Nieufny: walidacja kształtu i limity z `limits.ts`, odczyt w efekcie po montażu | Uszkodzony wpis nie może wywołać pracy ponad limit ani rozjechać hydratacji. | Plan            |

## Scope

**In scope:** `getRecipe` i walidacja id, trasa `/recipes/[id]` (SSR), `404.astro`, link w `RecipeTile`, moduł stanu listy, integracja w `usePantryMatch`, przewijanie, kitchen-sink, smoke, testy jednostkowe.

**Out of scope:** status składników na szczegółach, stan w URL, endpoint `GET /api/recipes/:id`, edycja i usuwanie (S-06, S-07), trwałe produkty stałe (S-04), odtwarzanie ponad 100 przepisów, zmiany w middleware, schemacie i RLS.

## Architecture / Approach

Szczegóły: `[id].astro` pobiera przepis przez `getRecipe` (SSR, `createClient` z cookies), renderuje `RecipeDetails` (czysty komponent) albo `NotFoundView` ze statusem 404. Stan listy: moduł `list-state` serializuje i nieufnie odczytuje snapshot (`lists`, `applied`, `loaded`, `scrollY`) w `sessionStorage`; `usePantryMatch` zapisuje go na `pagehide`/`visibilitychange`, a przy starcie odtwarza listę jedno–dwoma żądaniami i dopiero potem przewija stronę.

## Phases at a Glance

| Phase                              | What it delivers                                                         | Key risk                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1. Szczegóły przepisu i polska 404 | `/recipes/[id]` w SSR, `getRecipe`, `404.astro`, smoke                   | `Astro.locals.user` na `404.astro` (nagłówek) i błąd 22P02 przy złym id          |
| 2. Kafelek jako link               | Klikalny kafelek (stretched link) z fokusem klawiaturą, kitchen-sink     | Dostępność: jeden fokus na kafelek, brak zagnieżdżonych interaktywnych elementów |
| 3. Zachowanie stanu listy          | Snapshot w `sessionStorage`, odtwarzanie listy i przewijania po powrocie | Wyścigi przy starcie (zapis przed odczytem) i koszt odtwarzania na Workers       |

**Prerequisites:** S-03 (kafelek, lista) jest w repo; lokalny Supabase z danymi seed do smoke i testów ręcznych.
**Estimated effort:** ~2–3 sesje w 3 fazach (faza 3 największa).

## Open Risks & Assumptions

- Zakładamy, że `Astro.locals.user` jest dostępne przy renderze `404.astro` w adapterze Cloudflare; do sprawdzenia w dev i na buildzie (faza 1).
- Zakładamy, że nieprawidłowy UUID w `.eq("id", …)` daje błąd 22P02; plan i tak go wychwytuje przed zapytaniem.
- Przy więcej niż 100 załadowanych przepisach powrót ucina listę do 100 (katalog docelowy to 50–100, F-02).
- CI seeduje 5 przepisów, więc doładowania i odtwarzania wielu stron nie da się pokazać w smoke; to sprawdza się ręcznie.

## Success Criteria (Summary)

- Z kafelka (myszą i klawiaturą) wchodzi się w pełny przepis bez statusu składników.
- Po powrocie lista ma te same tagi, filtry, liczbę przepisów i pozycję przewijania; nowa karta zaczyna od zera.
- Nieistniejący lub niepoprawny adres daje polską 404 (status 404, link do `/`); `npm test`, lint, `astro check`, `check:ui`, build i smoke przechodzą.
