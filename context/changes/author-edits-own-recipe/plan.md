# S-06 Autor edytuje i usuwa swój przepis — Implementation Plan

## Overview

Autor edytuje (pełna zamiana przez `PUT`) i usuwa (po potwierdzeniu w oknie dialogowym) wyłącznie przepisy, które sam dodał. Regułę „tylko autor” egzekwuje baza (kolumnowe granty + polityki RLS na update i delete), a nie interfejs. Trigger w bazie zeruje `match_keys` i `match_keys_version` przy zmianie składników, żeby nieaktualne klucze nie przepuściły wykluczonego składnika. Issue: #8 (roadmapa S-06, FR-009).

## Current State Analysis

- `authenticated` ma tylko `select` i kolumnowy `insert` z polityką `recipes_insert_own` (`supabase/migrations/20261012120000_create_recipes.sql:26-37`, `20261017120000_add_recipe_author_and_insert.sql:21-30`). Update i delete są dziś niemożliwe.
- `matchRecipes` ufa zapisanym kluczom z bieżącą wersją (`src/lib/services/recipes.ts:210-218`) i w kroku 4 sprawdza tylko kształt (`:165-170`, `:257-261`). Edycja `product` przy niezmienionej liczbie składników zostawiłaby stare klucze — dziura otwierana przez S-06.
- `POST /api/recipes` (`src/pages/api/recipes/index.ts:36-109`) ma lokalne `readTextWithLimit` i kontrole 415/413/`invalid_json`; walidator `parseRecipeInput` zwraca pełny `NewRecipe`.
- `getRecipe` (`recipes.ts:84-98`) nie czyta `author_id`; woła go tylko `src/pages/recipes/[id].astro:18` i testy (`recipes.test.ts:227-273`).
- Formularz S-05: `useRecipeForm()` startuje z `emptyRecipeForm`, `sendRecipe` ma na sztywno `POST /api/recipes` i sukces `201` (`src/components/hooks/useRecipeForm.ts:148-169`, `:185-186`); `RecipeFormView` ma na sztywno „Dodaj przepis” / „Zapisz przepis” (`RecipeFormView.tsx:59-60`, `:231`); `RecipeForm` po zapisie zawsze pokazuje `RecipeSaved` (`RecipeForm.tsx:16-18`).
- `src/components/ui/` nie ma dialogu; `Button` ma wariant `destructive` na tokenie `--destructive` (`button.tsx:13-14`, `global.css:23`, `:70`).
- CI: krok „Check recipe insert permissions” (`.github/workflows/ci.yml:57-94`) to wzorzec signup A/B + `expect_denied`; dalsze kroki liczą `length == 5` (`:94`) i `updated 5` (`:101`).
- Snapshot listy (`src/lib/list-state.ts:11-19`) nie przechowuje przepisów — nie wymaga zmian (research, sekcja 3).

## Desired End State

- Autor na `/recipes/[id]` widzi przyciski „Edytuj” i „Usuń”; inni użytkownicy ich nie widzą, a `/recipes/[id]/edit` daje im 404.
- „Edytuj” otwiera formularz S-05 wypełniony danymi przepisu; zapis wysyła `PUT /api/recipes/[id]` i przekierowuje na `/recipes/[id]`.
- „Usuń” otwiera okno potwierdzenia (shadcn `alert-dialog`); po potwierdzeniu `DELETE /api/recipes/[id]` i powrót na `/`.
- Bezpośrednie wywołanie PostgREST tokenem innego użytkownika nie zmienia ani nie usuwa przepisu; zmiana `author_id`, `match_keys`, `match_keys_version` lub `id` przez `authenticated` daje 42501; zmiana `ingredients` zeruje klucze. Sprawdza to krok CI.
- Weryfikacja: CI (lint, check, testy, krok RLS, smoke) zielone; ręczny przegląd ścieżek w przeglądarce.

### Key Discoveries:

- PostgREST przy odmowie z `using` zwraca 0 wierszy, nie błąd — serwis musi robić `.select()` i traktować pusty wynik jako 404 (research, sekcja RLS).
- Astro przekazuje nazwany slot do komponentu React jako prop (`slot="actions"` → `props.actions`), a wyspa `client:load` w slocie jest hydrowana (docs Astro, „Passing children to framework components”). `RecipeDetails` może zostać statyczny.
- `defaultProduct(name)` = `name.trim().toLocaleLowerCase("pl")` (`src/lib/recipes/validate.ts:37-39`) — potrzebne do odtworzenia `productEdited` przy wczytaniu przepisu do formularza (`useRecipeForm.ts:175-178`).
- `match-keys.ts` (service role) zmienia tylko kolumny kluczy (`scripts/match-keys.ts:45-48`), import F-02 tylko wstawia (`scripts/import-recipes.ts:181`) — trigger na zmianę `ingredients` żadnego z nich nie dotyka.

## What We're NOT Doing

- Admin i edycja dowolnego przepisu (S-07). Przepisy z `author_id = null` (seed, usunięte konta) zostają nieedytowalne do S-07.
- `authorId` w typie `Recipe`, w liście i w `/api/recipes/match` — autor jest czytany tylko w `getRecipe`.
- Kod przeciw krótkiemu wyścigowi w `matchRecipes` (krok 1 czyta stare klucze tuż przed edycją, krok 4 nowe składniki) — akceptujemy, okno to czas jednego żądania.
- Obsługa bfcache: kafelek usuniętego przepisu po „Wstecz” prowadzi do 404 — akceptujemy.
- Zmiany w `src/lib/list-state.ts` i `usePantryMatch`.
- `PATCH` / częściowa edycja; ekran „Zmiany zapisane”.
- Zawężanie triggera do „ingredients zmienione, a match_keys nie” — żadna ścieżka nie zapisuje obu naraz.
- Automatyczne wdrożenie migracji na produkcję — robi to autorka ręcznie przed merge.

## Implementation Approach

Od dołu: najpierw baza (granty, polityki, trigger) z dowodem w CI na bezpośrednim PostgREST, potem serwis i API (które tylko przekładają pusty wynik RLS na 404), potem UI na istniejących komponentach S-05, na końcu smoke i dokumentacja. Każda faza jest wdrażalna sama: migracja jest addytywna i stary kod jej nie używa.

## Critical Implementation Details

- **Kolejność kroków CI.** Nowy krok RLS musi biec po „Check recipe insert permissions”, a przed „Compute recipe match keys”, i zostawić 5 wierszy. Wiersz testowy usuwa `trap … EXIT` (service role), żeby nieudany krok nie zostawił śmieci dla kolejnych asercji w lokalnym powtórzeniu.
- **Trigger bez grantu.** Uprawnienia kolumnowe są sprawdzane dla kolumn z polecenia `UPDATE`, nie dla wartości zmienionych w `NEW` przez trigger `BEFORE` — trigger nie potrzebuje `security definer`. To wniosek z semantyki Postgresa; krok CI go potwierdza.

## Phase 1: Baza i testy RLS w CI

### Overview

Migracja daje autorowi update i delete własnych wierszy oraz trigger zerujący klucze; krok CI dowodzi reguł na bezpośrednim PostgREST.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/20261018120000_add_recipe_update_delete_own.sql`

**Intent**: Otworzyć update i delete tylko dla autora i zagwarantować, że edycja składników unieważnia klucze dopasowania. Komentarz nagłówka rozszerza model z migracji S-05: „zapisy użytkowników — insert i update składników — zostawiają klucze null”; zapowiada admina w S-07.

**Contract**:
- `grant update (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g) on public.recipes to authenticated` — bez `id`, `created_at`, `author_id`, `match_keys`, `match_keys_version`.
- `grant delete on public.recipes to authenticated`.
- Polityka `recipes_update_own`: `for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()))`.
- Polityka `recipes_delete_own`: `for delete to authenticated using (author_id = (select auth.uid()))`.
- Funkcja `public.recipes_reset_match_keys()` (`returns trigger`, `language plpgsql`, `set search_path = ''`) ustawia `new.match_keys := null; new.match_keys_version := null` i zwraca `new`. Trigger `recipes_reset_match_keys_on_ingredients` `before update on public.recipes for each row when (old.ingredients is distinct from new.ingredients)`. `jsonb` porównuje semantycznie, więc `PUT` z niezmienionymi składnikami zostawia klucze.

#### 2. Krok CI dla update i delete

**File**: `.github/workflows/ci.yml`

**Intent**: Dowieść reguł S-06 przez PostgREST z anon key i tokenami, na wierszu, który krok sam wstawia i usuwa. Najpierw status i typ ciała, potem treść (lessons.md).

**Contract**: nowy krok „Check recipe update and delete permissions” między krokiem insert a „Compute recipe match keys”. Signup A i B (nowy `suffix`); A wstawia przepis (`Prefer: return=representation`, mleko) i zapisuje `id`; `trap` usuwa go service role przy wyjściu. Przypadki (PATCH/DELETE z `Prefer: return=representation`):
- service role ustawia `match_keys` i `match_keys_version = 2`; A zmienia tylko `name` → 200, tablica z 1 wierszem, klucze dalej nie-null (odczyt service role);
- A zmienia `ingredients` (mleko → orzechy) → 200, 1 wiersz; service role widzi `match_keys` i `match_keys_version` = null;
- B zmienia `name` → 200, `[]`; B usuwa → 200, `[]`; service role widzi wiersz bez zmian;
- A na nieistniejącym id → 200, `[]`;
- A z `author_id` = B, `author_id: null`, `match_keys`, `id` → 403, `.code == "42501"`;
- anon PATCH i DELETE → 401 lub 403, `42501`;
- A usuwa → 200, 1 wiersz; na końcu service role liczy `length == 5`.

### Success Criteria:

#### Automated Verification:

- Migracja aplikuje się na czystej bazie: `npx supabase db reset`
- Krok CI „Check recipe update and delete permissions” przechodzi, a „Compute recipe match keys” nadal daje `updated 5` / `updated 0`
- `npm run lint` i `npx astro check` przechodzą

#### Manual Verification:

- Przegląd migracji: lista kolumn w grancie update nie zawiera `author_id`, `match_keys`, `match_keys_version`, `id`, `created_at`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Serwis i API

### Overview

Wspólny odczyt body JSON, `getRecipe` z autorem, `updateRecipe` / `deleteRecipe` z pustym wynikiem jako „nie znaleziono” i endpoint `PUT` / `DELETE /api/recipes/[id]`.

### Changes Required:

#### 1. Wspólny odczyt body

**File**: `src/lib/http/json-body.ts` (nowy), `src/pages/api/recipes/index.ts`

**Intent**: Wynieść z `index.ts` kontrole media type, rozmiaru (deklarowany i liczony w strumieniu) i parsowania JSON, żeby `POST` i `PUT` miały identyczne limity i kody błędów. `POST` zachowuje zachowanie bez zmian.

**Contract**: `readJsonBody(request: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }>`; błędy: 415 `unsupported_media_type`, 413 `payload_too_large`, 400 `invalid_json`. Limit: `MAX_RECIPE_BODY_BYTES`.

#### 2. Serwis przepisów

**File**: `src/lib/services/recipes.ts`

**Intent**: Strona szczegółów i edycji muszą znać autora; zapis i usunięcie przekładają brak wiersza po RLS na `null` / `false`. Mapowanie pól `NewRecipe` → wiersz współdzielone przez insert i update (update bez `author_id`).

**Contract**:
- `getRecipe(supabase, id): Promise<{ recipe: Recipe; authorId: string | null } | null>` — select `RECIPE_COLUMNS` + `author_id`; `RECIPE_COLUMNS` i `Recipe` bez zmian.
- `updateRecipe(supabase, id, recipe: NewRecipe): Promise<Recipe | null>` — niepoprawne id → `null` bez zapytania; `.update(...).eq("id", id).select(RECIPE_COLUMNS).maybeSingle()`; brak wiersza → `null`; błąd → throw.
- `deleteRecipe(supabase, id): Promise<boolean>` — niepoprawne id → `false` bez zapytania; `.delete().eq("id", id).select("id")`; `true` gdy usunięto wiersz.
- Komentarz przy `updateRecipe`: klucze zeruje trigger z migracji `20261018120000`.

#### 3. Endpoint

**File**: `src/pages/api/recipes/[id].ts` (nowy)

**Intent**: `PUT` z pełnym przepisem i tym samym walidatorem co `POST`; `DELETE`. Cudzy i nieistniejący przepis są nieodróżnialne (404).

**Contract**:
- `PUT`: 401 `unauthorized` (bez użytkownika) → 404 `not_found` (niepoprawne id) → `readJsonBody` → 400 `invalid_recipe` z `issues` → 503 `not_configured` → `updateRecipe`: `null` → 404 `not_found`, sukces → 200 `{ recipe }`, wyjątek → 500 `database_error` + `console.error`.
- `DELETE`: 401 → 404 (niepoprawne id) → 503 → `deleteRecipe`: `false` → 404 `not_found`, `true` → 204 bez ciała, wyjątek → 500.

#### 4. Strona szczegółów (dopasowanie do nowego zwrotu)

**File**: `src/pages/recipes/[id].astro`

**Intent**: Dostosować do `{ recipe, authorId }`; wyliczyć `isAuthor = authorId !== null && authorId === Astro.locals.user?.id` (używane w fazie 3).

**Contract**: zachowanie 404/500/503 bez zmian.

#### 5. Testy

**File**: `src/lib/services/recipes.test.ts`, `src/lib/http/json-body.test.ts` (nowy)

**Intent**: Pokryć nowe ścieżki serwisu i odczytu body bez bazy.

**Contract**: `fakeClient` dostaje `update` i `delete` (z `eq` i `select`). Przypadki: `getRecipe` zwraca `authorId` (także `null`); `updateRecipe` / `deleteRecipe` z niepoprawnym id nie robią zapytania; pusty wynik → `null` / `false`; payload update nie zawiera `author_id`, `match_keys`, `match_keys_version`, `id`; błąd PostgREST jest rzucany. `readJsonBody`: 415, 413 z `content-length`, 413 przy strumieniu ponad limit bez nagłówka, 400 na zepsutym JSON, sukces.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- `npm run lint` i `npx astro check` przechodzą
- `npm run build` przechodzi

#### Manual Verification:

- Na lokalnym Supabase (Docker): `PUT` i `DELETE` cudzego przepisu przez API zwracają 404, a przepis zostaje bez zmian

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI — edycja i usuwanie

### Overview

Strona `/recipes/[id]/edit` z formularzem S-05, przyciski autora z oknem potwierdzenia na stronie szczegółów, stany w kitchen sink.

### Changes Required:

#### 1. Komponent dialogu

**File**: `src/components/ui/alert-dialog.tsx` (przez `npx shadcn@latest add alert-dialog`)

**Intent**: Okno potwierdzenia usunięcia z biblioteki zamiast własnego. Bez ręcznych zmian w wygenerowanym pliku poza tym, czego wymaga lint.

**Contract**: eksporty shadcn `AlertDialog*`; przycisk potwierdzenia używa istniejącego wariantu `destructive`.

#### 2. Hook formularza

**File**: `src/components/hooks/useRecipeForm.ts`

**Intent**: Ten sam hook obsługuje dodawanie i edycję: stan początkowy z `Recipe`, cel zapisu zależny od trybu, przekierowanie po udanej edycji.

**Contract**:
- `useRecipeForm({ recipe }: { recipe?: Recipe } = {})`.
- Eksportowana `recipeToFormState(recipe: Recipe): RecipeFormState` — odwrotność `toBody`: liczby na tekst, `null` na `""`, `productEdited = product !== defaultProduct(name)`, nowe klucze przez `nextKey()`. Eksport `toBody` na potrzeby testu.
- `sendRecipe` przyjmuje cel: dodawanie `POST /api/recipes` + `201`, edycja `PUT /api/recipes/${id}` + `200`. Nowy komunikat dla 404: „Nie znaleziono przepisu albo nie możesz go edytować.”. Mapowanie `400 invalid_recipe` bez zmian.
- Po sukcesie edycji `window.location.assign(`/recipes/${id}`)`; formularz zostaje zablokowany (bez ponownego wysłania) do nawigacji.

#### 3. Widok i wyspa formularza

**File**: `src/components/recipes/RecipeFormView.tsx`, `src/components/recipes/RecipeForm.tsx`

**Intent**: Teksty zależne od trybu; w edycji link „Anuluj” wraca do szczegółów.

**Contract**: `RecipeFormView` dostaje `title` (domyślnie „Dodaj przepis”), `submitLabel` (domyślnie „Zapisz przepis”) i opcjonalne `cancelHref`. `RecipeForm` przyjmuje `recipe?: Recipe`; w edycji „Edytuj przepis” / „Zapisz zmiany” / `cancelHref = /recipes/${id}`; `RecipeSaved` tylko w trybie dodawania.

#### 4. Strona edycji

**File**: `src/pages/recipes/[id]/edit.astro` (nowy)

**Intent**: Wczytać przepis jak `[id].astro` i pokazać formularz tylko autorowi. To UX — granicę trzyma RLS.

**Contract**: `getRecipe`; 503/500 jak w `[id].astro`; brak przepisu lub `authorId !== Astro.locals.user?.id` (w tym `null`) → status 404 i `NotFoundView` „Nie znaleziono przepisu”; w przeciwnym razie `AppLayout title="Edytuj przepis"` + `<RecipeForm client:load recipe={recipe} />`.

#### 5. Przyciski autora i usuwanie

**File**: `src/components/hooks/useDeleteRecipe.ts` (nowy), `src/components/recipes/RecipeAuthorActions.tsx` (nowy), `src/components/recipes/RecipeDetails.tsx`, `src/pages/recipes/[id].astro`

**Intent**: Autor widzi „Edytuj” (link do `/recipes/[id]/edit`) i „Usuń” obok „Wróć do listy”. „Usuń” otwiera `AlertDialog` z nazwą przepisu i informacją, że operacji nie można cofnąć. Po potwierdzeniu: `DELETE`, a przy 204 `window.location.assign("/")`.

**Contract**:
- `useDeleteRecipe(recipeId)` → `{ status: "idle" | "deleting" | "error", error: string | null, remove() }`. Status przed ciałem; 204 → przekierowanie; 404 → „Nie znaleziono przepisu. Mógł zostać już usunięty.”; 401 → komunikat wygasłej sesji; błąd sieci / inne → komunikat ogólny. Błąd pokazany w dialogu, dialog zostaje otwarty; w trakcie usuwania oba przyciski dialogu są zablokowane.
- Dialog sterowany (`open` / `onOpenChange`): `onOpenChange(false)` jest ignorowane przy `status === "deleting"` (Escape, „Anuluj”). Radix `AlertDialog.Action` zamyka dialog przy każdym kliknięciu, więc przycisk potwierdzenia woła `event.preventDefault()` przed `remove()`.
- `RecipeAuthorActions({ recipeId, recipeName })` — wyspa; prezentacja wydzielona tak, żeby kitchen sink mógł pokazać stany bez sieci (`RecipeAuthorActionsView` z propsami `status`, `error`, `onConfirm` i opcjonalnym `defaultOpen`, którym kitchen sink pokazuje stany „w trakcie” i „błąd” od razu otwarte).
- `RecipeDetails` dostaje `actions?: ReactNode` renderowane w wierszu z `BackLink` (zawijanie na telefonie).
- `[id].astro`: przy `isAuthor` `<RecipeAuthorActions slot="actions" client:load recipeId=… recipeName=… />`.

#### 6. Kitchen sink i strażnik literałów

**File**: `src/components/dev/KitchenSink.tsx`, `scripts/check-ui-literals.mjs`

**Intent**: Każdy nowy stan komponentu w kitchen sink (AGENTS.md); nowe pliki widoków bez literałów kolorów.

**Contract**: kitchen sink — `RecipeFormView` w trybie edycji, `RecipeDetails` z akcjami autora, stany dialogu usuwania (bezczynny, w trakcie, błąd). `CLEAN_FILES` += `src/pages/recipes/[id]/edit.astro`, `src/components/recipes/RecipeAuthorActions.tsx` (oraz `RecipeDetails.tsx` i `src/pages/recipes/[id].astro`, jeśli przechodzą skan).

#### 7. Testy

**File**: `src/components/hooks/useRecipeForm.test.ts` (nowy)

**Intent**: Wczytanie przepisu do formularza i ponowne wysłanie daje ten sam przepis.

**Contract**: dla przepisu z zamiennikami, ułamkami, `null` i ręcznie zmienionym `product`: `parseRecipeInput(toBody(recipeToFormState(r)))` jest `ok` i równe polom `r`; `productEdited` jest `true` tylko tam, gdzie `product !== defaultProduct(name)`.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, `npm run check:ui`, `npx astro check`, `npm run build` przechodzą

#### Manual Verification:

- Autor widzi „Edytuj” i „Usuń” na swoim przepisie; inny użytkownik ich nie widzi, a `/recipes/[id]/edit` daje mu 404; przepis z seeda (`author_id = null`) nie ma przycisków
- Edycja: formularz wypełniony danymi (w tym ręczny `product` i zamienniki), zapis przekierowuje na szczegóły z nowymi danymi, błędy walidacji przy polach jak w S-05
- Zamiana składnika na produkt z wykluczeń ukrywa przepis na liście z tym wykluczeniem
- Usuwanie: „Anuluj” zamyka dialog bez zmian; potwierdzenie wraca na `/` bez usuniętego przepisu; fokus i klawiatura działają w dialogu; widok poprawny na telefonie i w ciemnym motywie
- Kitchen sink pokazuje nowe stany

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Smoke i dokumentacja

### Overview

Smoke pokrywa edycję i usuwanie na przepisie, który sam dodaje; kontrakt danych opisuje nowe reguły dostępu; migracja trafia na produkcję przed merge.

### Changes Required:

#### 1. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Sprawdzić całą ścieżkę przez zbudowaną aplikację na lokalnym Supabase (CI i Docker lokalnie, nigdy produkcja). Przepis dodany w kroku „signed-in user adds a recipe” jest edytowany i usuwany, więc baza wraca do stanu z seeda.

**Contract**: krok dodawania zapamiętuje `id` w zmiennej modułu. Nowe kroki: anonimowy `PUT` i `DELETE` → 401; strona `/recipes/{id}/edit` → 200 z „Edytuj przepis”; szczegóły zawierają „Usuń”; `PUT` z nową nazwą (składnik nadal jogurt, żeby `exclude=jogurt` dalej go ukrywał) → 200 z tym samym `id` i nową nazwą; `PUT` z `ingredients: []` → 400 `invalid_recipe`; `PUT` na `UNKNOWN_RECIPE_ID` → 404 `not_found`; `DELETE` → 204; szczegóły → 404; ponowny `DELETE` → 404. Kroki zależne od `id` failują czytelnie, gdy dodawanie się nie udało.

#### 2. Dokumentacja

**File**: `docs/reference/recipe-data-contract.md`

**Intent**: Akapit „Dostęp (RLS)” opisuje update/delete tylko autora, przez `PUT`/`DELETE /api/recipes/[id]`, bez `author_id` i kluczy; zerowanie kluczy przy zmianie składników; przepisy z `author_id = null` do S-07.

**Contract**: tylko ten akapit (`:30`).

### Success Criteria:

#### Automated Verification:

- Job `smoke` w CI przechodzi (lokalny Supabase w Actions)
- `npm run lint` przechodzi

#### Manual Verification:

- `npm run smoke` przechodzi lokalnie na Supabase z Dockera (`.env` / `.dev.vars` wskazują `supabase start`, nie produkcję)
- Autorka zastosowała migrację `20261018120000` na produkcji przed merge i sprawdziła, że lista i dopasowanie działają
- Opis PR zawiera „Closes #8”

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `recipes.test.ts`: `getRecipe` z `authorId`; `updateRecipe` / `deleteRecipe` — niepoprawne id, pusty wynik, sukces, payload bez kolumn chronionych, błędy.
- `json-body.test.ts`: 415, 413 (nagłówek i strumień), 400, sukces.
- `useRecipeForm.test.ts`: round-trip `Recipe` → formularz → body → walidator; `productEdited`.

### Integration Tests:

- Krok CI na PostgREST: własny / cudzy / nieistniejący wiersz, kolumny chronione, anon, trigger zerujący i niezerujący.
- Smoke: `PUT`/`DELETE` przez aplikację, strona edycji, 404 po usunięciu.

### Manual Testing Steps:

1. Zaloguj się jako A, dodaj przepis, otwórz szczegóły — widać „Edytuj” i „Usuń”.
2. Zaloguj się jako B, otwórz ten przepis — brak przycisków; `/recipes/[id]/edit` → 404.
3. Jako A zamień składnik na produkt wpisany potem w wykluczenia — przepis znika z listy.
4. Jako A usuń przepis, sprawdź „Anuluj” i potwierdzenie; po powrocie na `/` przepisu nie ma.

## Performance Considerations

Każda edycja składników wrzuca przepis do puli przeliczanej per żądanie w `matchRecipes` (limit `MAX_RECOMPUTED_RECIPES = 200`, `src/lib/recipes/limits.ts:18-23`; lessons.md: limit CPU). Przy dużej liczbie edycji `npm run match-keys` (service role) przywraca zapisane klucze — bez zmian w kodzie.

## Migration Notes

- Migracja jest addytywna (granty, polityki, funkcja, trigger); stary kod nie wykonuje update ani delete, więc kolejność „migracja na produkcję → merge” jest bezpieczna.
- Na produkcję stosuje ją ręcznie autorka, przed merge. Wycofanie: `drop trigger`, `drop function`, `drop policy` ×2, `revoke update, delete … from authenticated`.
- Smoke i testy ręczne tylko na lokalnym Supabase z Dockera — `.dev.vars` wskazuje produkcję.

## References

- Related research: `context/changes/author-edits-own-recipe/research.md`
- Wzorzec migracji: `supabase/migrations/20261017120000_add_recipe_author_and_insert.sql`
- Wzorzec kroku CI: `.github/workflows/ci.yml:57-94`
- Endpoint do współdzielenia: `src/pages/api/recipes/index.ts:36-109`
- Plan S-05: `context/archive/2026-10-17-add-recipe/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Baza i testy RLS w CI

#### Automated

- [x] 1.1 Migracja aplikuje się na czystej bazie: `npx supabase db reset`
- [ ] 1.2 Krok CI „Check recipe update and delete permissions” przechodzi, a „Compute recipe match keys” nadal daje `updated 5` / `updated 0`
- [x] 1.3 `npm run lint` i `npx astro check` przechodzą

#### Manual

- [x] 1.4 Przegląd migracji: lista kolumn w grancie update nie zawiera `author_id`, `match_keys`, `match_keys_version`, `id`, `created_at`

### Phase 2: Serwis i API

#### Automated

- [ ] 2.1 Testy jednostkowe przechodzą: `npm test`
- [ ] 2.2 `npm run lint` i `npx astro check` przechodzą
- [ ] 2.3 `npm run build` przechodzi

#### Manual

- [ ] 2.4 Na lokalnym Supabase (Docker): `PUT` i `DELETE` cudzego przepisu przez API zwracają 404, a przepis zostaje bez zmian

### Phase 3: UI — edycja i usuwanie

#### Automated

- [ ] 3.1 `npm test`, `npm run lint`, `npm run check:ui`, `npx astro check`, `npm run build` przechodzą

#### Manual

- [ ] 3.2 Autor widzi „Edytuj” i „Usuń” na swoim przepisie; inny użytkownik ich nie widzi, a `/recipes/[id]/edit` daje mu 404; przepis z seeda (`author_id = null`) nie ma przycisków
- [ ] 3.3 Edycja: formularz wypełniony danymi (w tym ręczny `product` i zamienniki), zapis przekierowuje na szczegóły z nowymi danymi, błędy walidacji przy polach jak w S-05
- [ ] 3.4 Zamiana składnika na produkt z wykluczeń ukrywa przepis na liście z tym wykluczeniem
- [ ] 3.5 Usuwanie: „Anuluj” zamyka dialog bez zmian; potwierdzenie wraca na `/` bez usuniętego przepisu; fokus i klawiatura działają w dialogu; widok poprawny na telefonie i w ciemnym motywie
- [ ] 3.6 Kitchen sink pokazuje nowe stany

### Phase 4: Smoke i dokumentacja

#### Automated

- [ ] 4.1 Job `smoke` w CI przechodzi (lokalny Supabase w Actions)
- [ ] 4.2 `npm run lint` przechodzi

#### Manual

- [ ] 4.3 `npm run smoke` przechodzi lokalnie na Supabase z Dockera (`.env` / `.dev.vars` wskazują `supabase start`, nie produkcję)
- [ ] 4.4 Autorka zastosowała migrację `20261018120000` na produkcji przed merge i sprawdziła, że lista i dopasowanie działają
- [ ] 4.5 Opis PR zawiera „Closes #8”
