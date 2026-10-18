---
date: 2026-10-18T16:17:24+02:00
researcher: Claude (Opus 5.5) dla Aleksandry Pęcherz
git_commit: 8cf1bf3
branch: author-edits-recipe
repository: pasujemi-recipe
topic: "S-06 author-edits-own-recipe: autor edytuje i usuwa tylko swoje przepisy (RLS update/delete, match_keys, formularz S-05, stan listy)"
tags: [research, recipes, supabase, rls, match-keys, form, list-state]
status: complete
last_updated: 2026-10-18
last_updated_by: Claude (Opus 5.5)
---

# Research: S-06 author-edits-own-recipe

**Date**: 2026-10-18T16:17:24+02:00
**Researcher**: Claude (Opus 5.5) dla Aleksandry Pęcherz
**Git Commit**: 8cf1bf3 (badanie na niezatwierdzonym drzewie; zmieniony jest tylko folder tej zmiany)
**Branch**: author-edits-recipe
**Repository**: pasujemi-recipe

## Research Question

S-06 z roadmapy (issue #8): autor edytuje i usuwa tylko swoje przepisy. Regułę pilnuje baza (RLS na update i delete), nie tylko interfejs. Przyciski Edytuj i Usuń na `/recipes/[id]` widzi tylko autor. Zbadać:

1. co z `match_keys` i `match_keys_version` po edycji składników, skoro `authenticated` nie ma grantu na te kolumny, a nieaktualne klucze mogłyby przepuścić wykluczony składnik;
2. ponowne użycie formularza z S-05;
3. co ze stanem listy w sessionStorage (`list-state.ts`) po usunięciu albo zmianie przepisu.

Poza zakresem: admin (S-07). Nowa migracja: znacznik `20261018120000`.

## Summary

- **Baza dziś nie pozwala na update ani delete.** `authenticated` ma tylko `select` i kolumnowy `insert`, a jedyne polityki to `recipes_select_authenticated` i `recipes_insert_own` (`supabase/migrations/20261012120000_create_recipes.sql:29-37`, `20261017120000_add_recipe_author_and_insert.sql:22-30`). S-06 dokłada w migracji `20261018120000_…` kolumnowy grant `update` (bez `author_id`, `match_keys`, `match_keys_version`, `id`, `created_at`), grant `delete` i dwie polityki „własne” na `author_id = (select auth.uid())`.
- **(1) Nieaktualne klucze to realna dziura.** Po edycji składników przy niezmienionej liczbie składników i zamienników zapisane klucze z bieżącą wersją przechodzą przez ranking (`src/lib/services/recipes.ts:210-218`), a jedyna kontrola w kroku 4 sprawdza tylko kształt (`:165-170`, `:257-261`). Zamiana „mleko” → „orzechy” zostawiłaby klucz „mleko” i wykluczenie „orzechy” by go nie ukryło. Rekomendacja: trigger `before update` w bazie, który przy zmianie `ingredients` zeruje `match_keys` i `match_keys_version`. Wtedy wiersz trafia do istniejącej ścieżki „przelicz per request” (`:192-207`) i do `npm run match-keys`. Nie trzeba grantu na te kolumny ani service role w Workerze.
- **(2) Formularz S-05 da się użyć ponownie przy czterech zmianach.** Hook potrzebuje stanu początkowego z `Recipe`, celu zapisu (`POST` vs `PATCH`/`PUT` z id) i obsługi 404/403. Widok potrzebuje nagłówka i etykiety przycisku jako propsów (dziś na sztywno „Dodaj przepis” i „Zapisz przepis”, `RecipeFormView.tsx:59-60`, `:231`). Po zapisie edycji trzeba zastąpić ekran `RecipeSaved` z „Dodaj kolejny”. Walidator `parseRecipeInput` i limity są wspólne bez zmian.
- **(3) Snapshot listy nie wymaga zmian.** Zapisuje tylko tagi, `loaded` i `scrollY`, nigdy przepisów (`src/lib/list-state.ts:13-19`), a przywrócenie ponownie pobiera strony z serwera (`usePantryMatch.ts:133-148`, `:228-237`). Usunięty lub zmieniony przepis po powrocie na `/` pokazuje się w aktualnej postaci (albo wcale). Zostaje jedno kosmetyczne ryzyko: bfcache przeglądarki (brak obsługi `pageshow` w `src/`).
- **Widoczność przycisków** wymaga `author_id` w odczycie: dziś `RECIPE_COLUMNS` i typ `Recipe` go nie mają (`recipes.ts:16`, `src/types.ts:18-31`). Plan S-05 odłożył `authorId` właśnie do S-06 (`context/archive/2026-10-17-add-recipe/plan.md:84`).

## Detailed Findings

### Stan uprawnień w bazie i co musi dodać migracja 20261018120000

- Trzy istniejące migracje: `20261012120000_create_recipes.sql`, `20261013120000_add_recipe_match_keys.sql`, `20261017120000_add_recipe_author_and_insert.sql` (sprawdzony katalog `supabase/migrations/`). Nowy znacznik `20261018120000` jest późniejszy od wszystkich trzech.
- RLS jest włączone, `revoke all … from anon, authenticated`, potem `grant select` (`20261012120000_create_recipes.sql:26-30`). S-05 dodało kolumnowy `grant insert (…, author_id)` i politykę `recipes_insert_own` z `with check (author_id = (select auth.uid()))` (`20261017120000_add_recipe_author_and_insert.sql:22-30`). Komentarz tej migracji zapowiada: „Update and delete policies arrive in S-06 and S-07” (`:8`).
- `author_id` jest `null default auth.uid()` i `on delete set null` (`:12-14`), z indeksem `recipes_author_id_idx` (`:17`). Z tego wynikają dwa przypadki brzegowe:
  - wiersze z `supabase/seed.sql` nie mają `author_id` (grep `author_id` w `seed.sql` nic nie zwraca), więc mają `null`;
  - przepisy usuniętego konta też mają `null`.
  Polityka `author_id = auth.uid()` nie przepuści `null` (porównanie z `null` nie jest prawdą), więc takich przepisów nikt nie edytuje aż do S-07. To zgodne z zakresem.
- Import F-02 zapisuje UUID autorki jawnie (`scripts/import-recipes/sheet.ts:46-60`), więc autorka może edytować swoje zaimportowane przepisy.
- Wniosek co do kształtu migracji (do potwierdzenia w planie i testem CI):
  - `grant update (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g) on public.recipes to authenticated`, bez `author_id`, żeby autor nie mógł „oddać” przepisu ani go przejąć. Pole `with check` i tak by to łapało przy cudzym id, ale grant zamyka też zmianę na `null`;
  - `grant delete on public.recipes to authenticated` (delete nie ma wersji kolumnowej);
  - `create policy "recipes_update_own" … for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()))`;
  - `create policy "recipes_delete_own" … for delete to authenticated using (author_id = (select auth.uid()))`.
- Zachowanie PostgREST przy odmowie (wniosek, nie sprawdzony w tym repo): gdy `using` nie przepuszcza wiersza, `update`/`delete` dotyka 0 wierszy i **nie** zwraca błędu. Odmowa 42501 pojawia się dla braku grantu na kolumnę i dla naruszenia `with check`. Serwis musi więc żądać `.select()` po update/delete i traktować pusty wynik jako „nie istnieje albo nie twój” (404), a nie jako sukces. Kroki CI muszą to zbadać inaczej niż dzisiejsze `expect_denied`, które oczekuje 42501 (`.github/workflows/ci.yml:74-86`).

### 1. `match_keys` i `match_keys_version` po edycji składników

**Jak dziś działa ranking (ścieżka `matchRecipes`, `src/lib/services/recipes.ts:172-267`):**

- Krok 1 czyta `id, name, match_keys, match_keys_version` całego katalogu (`:178-185`).
- Krok 2: wiersze z `match_keys is null`, `match_keys_version is null` lub inną wersją niż `MATCH_KEYS_VERSION` (dziś `2`, `src/lib/matching/keys.ts:10`) dostają klucze liczone w pamięci z `ingredients`, maksymalnie `MAX_RECOMPUTED_RECIPES = 200` na żądanie (`recipes.ts:192-207`, `src/lib/recipes/limits.ts:18-23`). Wiersze ponad limit wypadają z rankingu (`limits.ts:19-21`). To bezpieczny kierunek: wypadają, a nie przechodzą z kluczami nie wiadomo jakimi.
- Ranking używa zapisanych kluczy, gdy wersja jest bieżąca (`recipes.ts:211-212`).
- Krok 4 ponownie liczy klucze dla przepisu ze strony tylko wtedy, gdy zapisane klucze **nie pasują kształtem** do składników: inna liczba składników albo inna liczba zamienników przy którymś składniku (`keysFitIngredients`, `:165-170`, użyte w `:257-261`).

**Dziura:** jeśli autor zmieni `product` składnika (albo zamiennika) i zostawi liczbę składników i zamienników, kształt się zgadza. Wtedy krok 4 nie przelicza kluczy, a ranking i wykluczenia działają na starych produktach. Przepis z nowym, wykluczonym produktem przejdzie przez filtr. Dziś to się nie zdarza, bo `authenticated` nie ma update. S-06 otwiera tę ścieżkę.

**Dlaczego nie grant na `match_keys` dla `authenticated`:** grant pozwoliłby klientowi z anon key i tokenem autora zapisać dowolne klucze bezpośrednio przez PostgREST (z pominięciem API). Autor mógłby wtedy ukryć wykluczony składnik przed innymi użytkownikami. To osłabia gwarancję S-03 „bez żadnego przepisu z wykluczonym składnikiem” (`context/foundation/roadmap.md:135`). Ten sam powód stoi za odmową w S-05 i jest testowany w CI („A with match_keys”, `ci.yml:90`).

**Dlaczego nie service role w Workerze:** klucz service role jest czytany tylko z powłoki i nie trafia do `astro:env`, `.dev.vars` ani Workera (`scripts/match-keys.ts:2-4`). Schemat `astro:env` ma tylko `SUPABASE_URL` i `SUPABASE_KEY` (`astro.config.mjs:19-20`).

**Rekomendowane rozwiązanie: trigger w bazie zerujący klucze.**

- Funkcja `before update on public.recipes for each row`: gdy `new.ingredients is distinct from old.ingredients`, ustawia `new.match_keys = null` i `new.match_keys_version = null`. Reguła siedzi w bazie, więc działa także dla zapisu z pominięciem API.
- Wniosek z semantyki Postgresa (do potwierdzenia testem w CI): uprawnienia kolumnowe sprawdzane są dla kolumn wymienionych w poleceniu `UPDATE`, a nie dla wartości zmienionych przez trigger `BEFORE` w `NEW`. Trigger nie potrzebuje więc grantu ani `security definer`.
- Zgodność z istniejącymi zapisami:
  - `scripts/match-keys.ts:45-48` (service role) zmienia tylko `match_keys` i `match_keys_version`, nie `ingredients`, więc trigger ich nie zeruje i skrypt zostaje idempotentny (CI: `updated 5`, potem `updated 0`, `ci.yml:96-104`);
  - import F-02 używa tylko `insert` (`scripts/import-recipes.ts:181`), więc trigger `update` go nie dotyczy;
  - gdyby kiedyś ktoś aktualizował `ingredients` i `match_keys` razem (np. service role), warunek można zawęzić do „`ingredients` zmienione, a `match_keys` nie”. Dziś żadna sprawdzona ścieżka tak nie robi.
- Po zerowaniu edytowany przepis trafia do ścieżki „przelicz per request” (`recipes.ts:192-207`) i do zbioru, który `npm run match-keys` uzupełnia (`scripts/match-keys.ts:30-35`). Komentarze w `recipes.ts:101-104` i w migracji S-05 (`20261017120000_…:4-6`) już opisują ten model dla wstawionych wierszy. S-06 rozciąga go na edycję.
- Alternatywa (gorsza): serwis po edycji liczy klucze w API i nie zapisuje ich. Nie działa, bo nie ma czym ich zapisać, a zapisane stare klucze z bieżącą wersją dalej by wygrywały w `:211-212`.
- Ryzyko resztkowe (wniosek): wyścig między krokiem 1 a krokiem 4 jednego żądania `matchRecipes`. Krok 1 może przeczytać stare klucze tuż przed edycją, a krok 4 nowe składniki. Kontrola kształtu złapie tylko zmianę kształtu. Okno to czas jednego żądania; odpowiednik komentarza dla wyścigu ze skryptem jest w `:213-214`. Plan może to zaakceptować i opisać albo w kroku 4 zawsze przeliczać klucze stron, o ile mieści się to w budżecie CPU (strona to maksymalnie 50 przepisów, `src/pages/api/recipes/index.ts:9` dla listy; limit `match` nie był tu sprawdzany).

### 2. Ponowne użycie formularza z S-05

**Składowe (sprawdzone pliki w `src/components/recipes/` i `src/components/hooks/`):**

- `RecipeForm.tsx:6-32` to wyspa. Woła `useRecipeForm()` bez argumentów i po zapisie pokazuje `RecipeSaved` z `onAddAnother={reset}` (`:16-18`).
- `useRecipeForm.ts:185-333`:
  - stan startuje z `emptyRecipeForm` (`:186`, `:69-82`);
  - `sendRecipe` wysyła na sztywno `POST /api/recipes` i za sukces uznaje tylko `201` (`:148-169`, `:151-153`, `:162`);
  - obsługuje `401` (`:156`) i `400 invalid_recipe` z mapowaniem `issues` na pola (`:158-161`). Mapowanie zadziała bez zmian dla edycji, jeśli `PATCH` zwróci te same ścieżki;
  - `reset` wraca do pustego formularza (`:324-330`).
- `RecipeFormView.tsx:43` przyjmuje `form, fieldErrors, status, serverError, actions, onSubmit`. Nagłówek „Dodaj przepis” (`:59-60`) i przycisk „Zapisz przepis” (`:231`) są na sztywno.
- `KitchenSink.tsx:8-11`, `:91-147`, `:318-319` renderuje `RecipeFormView` i `RecipeSaved` w stanach. AGENTS.md wymaga dodania tam każdego nowego stanu komponentu.

**Co trzeba dodać (wniosek):**

- **Recipe → stan formularza.** Odwrotność `toBody` (`useRecipeForm.ts:102-115`):
  - liczby na tekst;
  - `null` na `""`;
  - `productEdited = product !== defaultProduct(name)`, gdzie `defaultProduct` to `name.trim().toLocaleLowerCase("pl")` (`src/lib/recipes/validate.ts:37-39`). Bez tego pole „produkt” przy edycji nazwy nadpisałoby ręcznie ustawiony produkt (`useRecipeForm.ts:175-178`);
  - nowe klucze React przez `nextKey()` (`:58-59`).
  Ułamki: walidator przyjmuje przecinek przez `toNumberOrText` (`:85-90`), więc `String(0.5)` = `"0.5"` też przejdzie.
- **Cel zapisu:** `useRecipeForm({ initial?: Recipe })` albo osobny parametr `mode`. Przy edycji `PATCH /api/recipes/[id]` (nowy plik `src/pages/api/recipes/[id].ts`; dziś istnieją tylko `index.ts` i `match.ts`) i sukces `200`. Dodatkowo `404` (nie istnieje albo nie twój, patrz sekcja RLS) i komunikat po polsku.
- **Po zapisie edycji:** przekierowanie na `/recipes/[id]` zamiast ekranu `RecipeSaved` z „Dodaj kolejny”. Albo wariant `RecipeSaved` bez tej akcji.
- **Endpoint:** `PATCH` może współdzielić z `POST` odczyt body z limitem (`readTextWithLimit`, `index.ts:36-57`), kontrole 415/413 (`:67-82`) i `parseRecipeInput` (`:91-94`). Te funkcje są dziś lokalne w `index.ts`. Do ponownego użycia trzeba je wynieść do `src/lib/` albo `[id].ts` musi je zduplikować. Walidator zwraca `NewRecipe`, który jest pełnym przepisem, więc edycja jest pełną zamianą pól. Pasuje do tego `PUT`, ale wybór `PUT` vs `PATCH` jest decyzją planu.
- **Strona edycji:** np. `src/pages/recipes/[id]/edit.astro`, wczytująca przepis jak `[id].astro:12-29`, z 404, gdy przepis nie istnieje lub `authorId !== Astro.locals.user.id`. To tylko UX, bo rzeczywistą granicę trzyma RLS.
- **Usuwanie:** w `src/components/ui/` jest 7 komponentów (`badge, button, checkbox, input, label, skeleton, textarea`), bez dialogu potwierdzenia. Potwierdzenie usunięcia wymaga `npx shadcn@latest add alert-dialog` (albo `dialog`) i stanu w kitchen sink.

**Widoczność przycisków:** `RecipeDetails({ recipe })` (`src/components/recipes/RecipeDetails.tsx:25`) nie zna autora ani użytkownika. `getRecipe` czyta `RECIPE_COLUMNS` bez `author_id` (`recipes.ts:16`, `:88-93`). Potrzebne jest `author_id` w odczycie (pole `authorId` w `Recipe` albo osobny zwracany `isAuthor`) i porównanie z `Astro.locals.user.id` (ustawiane w `src/middleware.ts:12-15`) na stronie `[id].astro`. Dodanie `author_id` do `RECIPE_COLUMNS` wpływa też na `listRecipes`, `createRecipe` i `matchRecipes` (wszystkie używają tej stałej, `recipes.ts:60`, `:121`, `:237`) i ujawnia UUID autorów zalogowanym. Odczyt i tak jest dozwolony przez `recipes_select_authenticated` (`using (true)`); to decyzja do planu, a nie wymóg bezpieczeństwa.

### 3. Stan listy w sessionStorage po usunięciu lub zmianie przepisu

- Snapshot (`pasujemi:list-state`) to `{ lists, applied, loaded, scrollY }`, „never the recipes themselves” (`src/lib/list-state.ts:11-19`). Nie ma w nim id, nazw ani kluczy przepisów.
- Przy wejściu na `/` `usePantryMatch` czyta snapshot i ponownie pobiera pierwsze `loaded` przepisów z `/api/recipes/match` z zapisanymi filtrami (`usePantryMatch.ts:220-237`, `:133-148`). Lista po powrocie jest więc liczona od nowa. Usunięty przepis nie pojawi się, a zmieniony pokaże się z nowymi danymi i na nowym miejscu w rankingu.
- `commit` przesuwa `offset` o liczbę żądaną, nie otrzymaną, właśnie z myślą o przepisie usuniętym w trakcie (`usePantryMatch.ts:187-189`). `matchRecipes` pomija przepis usunięty między zapytaniami (`recipes.ts:253-256`) i zostawia go w `total` tego żądania (`:228`).
- Skutek usunięcia dla przywróconej listy (wniosek): przy `loaded = N` przywrócenie pobierze N pozycji z katalogu krótszego o jeden, więc dociągnie jeden przepis więcej z dalszej części. `scrollY` może wskazać o jeden kafelek dalej. To kosmetyka, nie wymaga zmian w `list-state.ts`.
- `clearSnapshot` jest wołany tylko przy nieudanym przywróceniu (`usePantryMatch.ts:239`), a `endListState` przy wylogowaniu (`src/components/AppHeader.astro:34-37`). S-06 nie musi czyścić snapshotu po usunięciu ani edycji, bo nie ma w nim nic, co by się zdezaktualizowało.
- Ryzyko resztkowe: bfcache. Powrót przyciskiem „wstecz” może pokazać stronę `/` z pamięci przeglądarki, bez ponownego wykonania efektu. Wtedy widać kafelek usuniętego przepisu, a klik w niego daje 404 (`[id].astro:27-29`). W `src/` nie ma obsługi `pageshow`/`persisted` ani nagłówków `Cache-Control` (grep po `src/` nic nie zwrócił). Po usunięciu i przekierowaniu `location.assign("/")` (lub `replace`) na liście nie ma tego problemu, bo to nowa nawigacja. Dotyczy tylko ręcznego „wstecz” przez historię.

## Code References

- `supabase/migrations/20261012120000_create_recipes.sql:26-37` — RLS, revoke, `grant select`, polityka select.
- `supabase/migrations/20261013120000_add_recipe_match_keys.sql:7-13` — kolumny `match_keys`, `match_keys_version`.
- `supabase/migrations/20261017120000_add_recipe_author_and_insert.sql:4-30` — `author_id`, kolumnowy grant insert, `recipes_insert_own`, zapowiedź S-06.
- `src/lib/services/recipes.ts:16` — `RECIPE_COLUMNS` bez `author_id`.
- `src/lib/services/recipes.ts:165-170`, `:257-261` — kontrola tylko kształtu kluczy.
- `src/lib/services/recipes.ts:192-218` — przeliczanie kluczy dla `null`/innej wersji i wybór zapisanych kluczy.
- `src/lib/recipes/limits.ts:18-23` — `MAX_RECOMPUTED_RECIPES = 200`.
- `src/lib/matching/keys.ts:10` — `MATCH_KEYS_VERSION = 2`.
- `scripts/match-keys.ts:30-48` — skrypt service role, aktualizuje tylko kolumny kluczy.
- `scripts/import-recipes.ts:181`, `scripts/import-recipes/sheet.ts:46-60` — import tylko przez insert, z jawnym autorem i kluczami.
- `src/pages/api/recipes/index.ts:36-109` — `POST`, limity body, walidacja.
- `src/components/hooks/useRecipeForm.ts:69-82`, `:102-115`, `:148-169`, `:185-333` — stan, body, wysyłka, hook.
- `src/components/recipes/RecipeFormView.tsx:43`, `:59-60`, `:231` — propsy i teksty na sztywno.
- `src/components/recipes/RecipeForm.tsx:16-18` — ekran po zapisie.
- `src/components/recipes/RecipeDetails.tsx:25` — widok szczegółów bez danych o autorze.
- `src/pages/recipes/[id].astro:12-39` — strona szczegółów.
- `src/lib/list-state.ts:11-19` — kształt snapshotu.
- `src/components/hooks/usePantryMatch.ts:133-148`, `:187-189`, `:220-240` — przywracanie listy.
- `.github/workflows/ci.yml:57-94` — krok CI z testami odmów insertu (wzorzec dla update/delete).

## Architecture Insights

- Granice dostępu siedzą w bazie (RLS + kolumnowe granty), a API to tylko wygodna ścieżka. Każda nowa reguła S-06 musi być prawdziwa przy bezpośrednim wywołaniu PostgREST z anon key i tokenem użytkownika; CI testuje to curl-em, nie przez API (`ci.yml:57-93`).
- Klucze dopasowania są pochodną `ingredients`. Zasada od S-05: piszą je tylko service role (skrypt, import), a brak lub stara wersja oznacza „licz per request”. Trigger zerujący przy edycji trzyma się tej zasady.
- Stan listy w przeglądarce celowo nie trzyma danych przepisów, więc zmiany w katalogu nie wymagają unieważniania pamięci po stronie klienta.
- Lekcje z `context/foundation/lessons.md`, które dotyczą S-06:
  - „Closes #8” w PR;
  - w krokach CI najpierw status i typ ciała, potem treść (ważne przy update/delete, które przy odmowie RLS zwracają pustą tablicę, a nie błąd);
  - limit pracy CPU per request (edytowane przepisy zwiększają pulę przeliczanych w `matchRecipes` aż do `MAX_RECOMPUTED_RECIPES`).

## Historical Context (from prior changes)

- `context/archive/2026-10-17-add-recipe/plan.md:81` — edycja i usuwanie oraz polityki update/delete przesunięte do S-06; admin do S-07. **Aktualne.**
- `context/archive/2026-10-17-add-recipe/plan.md:84` — „Pole `authorId` w typie `Recipe` i w odpowiedziach `GET`. Doda je S-06, gdy będzie potrzebne”. **Aktualne:** pola nadal nie ma (`src/types.ts:18-31`).
- `context/archive/2026-10-17-add-recipe/plan.md:101` i `:152` — kroki CI z RLS nie mogą zostawić wierszy, bo dalsze kroki liczą `length == 5`, `updated 5` i `total === 4`. **Aktualne** (`ci.yml:51`, `:94`, `:101`). Testy update/delete w CI muszą działać na wierszu, który same wstawią i usuną, albo biec po krokach liczących.
- `context/archive/2026-10-17-add-recipe/plan-brief.md:85` — F-02 miało wpisywać UUID autorki jawnie, żeby S-06 dało jej edycję. **Spełnione** (`scripts/import-recipes/sheet.ts:58`).
- `supabase/migrations/20261013120000_add_recipe_match_keys.sql:3` — „only the service role (scripts/match-keys.ts, later recipe writes) fills the keys”. **Częściowo zastąpione** przez komentarz S-05 (`20261017120000_…:4-6`): zapisy użytkowników zostawiają klucze `null`. S-06 powinno dopisać, że edycja też je zeruje.
- `docs/reference/recipe-data-contract.md:30` — akapit „Dostęp (RLS)” mówi, że edycja i usuwanie dojdą w S-06 i S-07. Do aktualizacji w S-06.

## Related Research

- `context/archive/2026-10-17-add-recipe/research.md` — S-05: autorstwo, RLS insert, formularz, `POST`.
- `context/archive/2026-10-12-first-pantry-match/` — reguła dopasowania i klucze (S-03); nie czytane ponownie w tym badaniu.

## Open Questions

- **`PUT` czy `PATCH`** dla `/api/recipes/[id]`: walidator wymaga pełnego przepisu, więc semantycznie pasuje `PUT`. Decyzja planu.
- **`authorId` w `Recipe` czy tylko `isAuthor` na stronie szczegółów:** `authorId` w `RECIPE_COLUMNS` trafi też do listy i dopasowania. Decyzja planu.
- **Wyścig krok 1 / krok 4 w `matchRecipes`:** zaakceptować i opisać, czy przeliczać klucze strony zawsze. Wymaga pomiaru CPU (#19), jeśli wybrane drugie.
- **Do potwierdzenia testem CI (wnioski z semantyki Postgres/PostgREST, nie sprawdzone w tym repo):**
  - trigger `before update` może zerować kolumny bez grantu;
  - update/delete cudzego wiersza zwraca 0 wierszy, a nie 42501;
  - update `author_id` lub `match_keys` przez `authenticated` daje 42501.
- **Przepisy z `author_id = null`** (seed, usunięte konta) zostają nieedytowalne do S-07. To zgodne z zakresem, ale warto to zapisać w kontrakcie.
