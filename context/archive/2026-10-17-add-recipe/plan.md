# S-05 Ręczne dodawanie przepisu — plan implementacji

## Overview

Zalogowany użytkownik dodaje przepis do wspólnej bazy na stronie `/recipes/new`. Wymagane są nazwa, kroki i co najmniej jeden składnik. Przy składniku można podać zamienniki. Czas, porcje, rodzaj, kcal i makro są opcjonalne.

Zapis idzie przez `POST /api/recipes` jako rola `authenticated`. `author_id` pochodzi z sesji, a RLS pozwala wstawić wiersz tylko jako siebie i bez kluczy dopasowania. Po zapisie formularz pokazuje zapisany przepis jako kafelek z linkiem do listy.

Autorstwo z tej zmiany jest podstawą dla S-06 (autor edytuje i usuwa swój przepis).

## Current State Analysis

- `public.recipes` nie ma kolumny autora. `authenticated` ma tylko `select` (`supabase/migrations/20261012120000_create_recipes.sql:28-36`), bo migracja F-01 robi `revoke all`. Sama polityka insert nie wystarczy, potrzebny jest też grant.
- Kolumny `match_keys` i `match_keys_version` są nullable (`20261013120000_add_recipe_match_keys.sql:6-8`). Gdy klucze są `null`, `matchRecipes` liczy je w pamięci przy każdym żądaniu (`src/lib/services/recipes.ts:140-157`). Na stałe zapisuje je tylko `npm run match-keys` (service role).
- `POST /api/recipes` nie istnieje. `src/pages/api/recipes/index.ts:10-31` ma tylko `GET` i wzorzec błędów `{ error: "<code>" }`.
- Kształtu elementów `ingredients` baza nie sprawdza. Waliduje go piszący (`docs/reference/recipe-data-contract.md:127-129`). W repo nie ma biblioteki walidacji. Konwencją są ręczne type guardy (`src/components/hooks/usePantryMatch.ts:36-87`).
- W `src/components/ui/` są `badge`, `button`, `input` i `skeleton`. Brakuje `label`, `textarea` i `checkbox`.
- `AppHeader.astro` nie ma nawigacji.
- Lista na `/` sortuje po nazwie i ładuje po 10 przepisów (`recipes.ts:62-63`, `usePantryMatch.ts:5`), więc nowy przepis często nie jest na pierwszej stronie.
- CI i smoke liczą przepisy:
  - `ci.yml:51` sprawdza `length == 5`;
  - `ci.yml:61-66` sprawdza `updated 5`, a potem `updated 0`;
  - `smoke.mjs:96` sprawdza `total === 4` w kroku match.

## Desired End State

- **Migracja.** Tabela `public.recipes` ma kolumnę `author_id uuid null default auth.uid()` z FK do `auth.users(id) on delete set null`. `authenticated` ma kolumnowy `grant insert` tylko na kolumny treści i `author_id`. Polityka `recipes_insert_own` przepuszcza wiersz tylko, gdy `author_id = auth.uid()`.
- **API.** `POST /api/recipes` przyjmuje JSON w camelCase, czyli kształt `Recipe` bez `id`. Waliduje go wspólnym walidatorem i wstawia z `author_id = locals.user.id`. Odpowiedzi:
  - `201 { recipe: Recipe }` po zapisie;
  - `400 { error: "invalid_recipe", issues }` dla błędnego przepisu;
  - `400 invalid_json`, `413 payload_too_large` albo `415 unsupported_media_type` dla błędnego żądania;
  - 503 lub 500 jak w `GET`.
- **Limity.** Siedzą w jednym pliku, `src/lib/recipes/limits.ts`, i korzystają z nich API, walidator i formularz.
- **Strona.** `/recipes/new` ma formularz z dynamicznymi składnikami, zamiennikami i krokami. Pole `product` składnika wypełnia się nazwą małymi literami, dopóki użytkownik go nie zmieni. Po sukcesie widać komunikat, kafelek `RecipeTile` z zapisanym przepisem oraz przyciski „Dodaj kolejny” i „Przejdź do listy”. Nagłówek ma link „Dodaj przepis”.
- **Testy.** CI sprawdza przez PostgREST, że insert jest odrzucany dla anon, dla cudzego lub pustego `author_id` oraz przy próbie zapisu `match_keys` lub `id`. Smoke sprawdza `POST /api/recipes`: 201, 400 i 401 bez sesji.

Weryfikacja: wszystkie kryteria Automated z faz 1–4, zielony job `smoke` w CI i ręczne przejście formularza na telefonie i desktopie.

### Key Discoveries:

- Nazwa `author_id` pochodzi z planu F-01 (`context/archive/2026-10-12-recipe-catalog-contract/plan.md:41`).
- `insert(...).select()` zwraca wiersz, bo polityka `recipes_select_authenticated` ma `using (true)` (`create_recipes.sql:32-36`). Tabelowy `grant select` obejmuje też nową kolumnę.
- `computeMatchKeys` jest jedynym sposobem liczenia kluczy (`src/lib/matching/keys.ts:106-111`). Przy insercie od użytkownika nie jest wołany (decyzja 3).
- Middleware odpowiada 401 dla niezalogowanych na `/api/*` i ustawia `locals.user` (`src/middleware.ts:12-36`). Handler bierze z niego id autora.
- Lokalny Supabase ma `enable_confirmations = false` (`supabase/config.toml:209`), więc CI może założyć użytkowników przez `POST /auth/v1/signup` i dostać JWT.
- `RecipeTile` przyjmuje `recipe` bez `match` (`src/components/recipes/RecipeTile.tsx:5-9`), więc nadaje się do pokazania przepisu po zapisie bez zmian.
- Wzorce tokenowe:
  - etykieta: `TagInput.tsx:40-42`;
  - karta sekcji: `PantryMatch.tsx:52-53`;
  - loading: `PantryMatch.tsx:80,116-118`;
  - błąd: `ServerError.tsx`.
  - Nie kopiować `auth/FormField.tsx` ani `auth/SubmitButton.tsx`, bo mają literalne kolory, a `useFormStatus` nie działa z `fetch`.
- Wzorzec wspólnych limitów: `src/lib/matching/limits.ts`, używany przez `match.ts:3` i `usePantryMatch.ts:2`.

## Decyzje (rejestr)

1. **`author_id`** jest nullable z `default auth.uid()`. Polityka insert wymaga `author_id = (select auth.uid())`, więc `authenticated` nie wstawi `null` ani cudzego id. Wiersze seeda i CI mają `null`.
2. **FK do `auth.users(id)` ma `on delete set null`.** Przepis zostaje we wspólnej bazie po usunięciu konta autora.
3. **Klucze dopasowania zostają puste przy insercie od użytkownika.** `authenticated` nie dostaje grantu na `match_keys` ani `match_keys_version`. Przepisy bez kluczy obsługuje fallback, a na stałe zapisuje je `npm run match-keys` (service role). Wymóg z `first-pantry-match/plan.md:410`, żeby S-05 wołało `computeMatchKeys`, przestaje dotyczyć S-05. Nadal dotyczy F-02, które pisze jako service role.
4. **Pole `product` przy składniku i zamienniku.** Domyślnie to `name` po przycięciu, małymi literami (`toLocaleLowerCase("pl")`). Użytkownik może je zmienić. Walidator stosuje ten sam domyślny `product`, gdy pole jest puste, więc reguła obowiązuje też klientów API.
5. **Limity** w `src/lib/recipes/limits.ts`, wspólne dla API, walidatora i formularza:
   - nazwa ≤ 120 znaków;
   - składniki 1–40;
   - zamienniki na składnik ≤ 5;
   - `name` i `product` ≤ 80 znaków;
   - `unit` ≤ 20 znaków;
   - kroki 1–30, każdy ≤ 1000 znaków;
   - `amount` > 0 i ≤ 100 000;
   - czas 0–1440 min;
   - porcje 1–100;
   - kcal 0–10 000;
   - makro 0–1000 g (zaokrąglane do 0,1);
   - body ≤ 100 000 bajtów.
6. **Decyzja dla F-02 (do zastosowania w imporcie):** przepisy z importu F-02 mają jako autorkę autorkę aplikacji (Aleksandrę Pęcherz). Import działa jako service role i omija RLS, a `default auth.uid()` dałby tam `null`. Dlatego import **wpisuje jej UUID z `auth.users` jawnie** w `author_id` każdego wstawianego wiersza. Decyzja jest zapisana w tym planie, a w migracji w komentarzu kolumny `author_id`. Plan F-02 ma ją przejąć.
7. **Po zapisie:** strona formularza pokazuje komunikat sukcesu, kafelek zapisanego przepisu oraz przyciski „Dodaj kolejny” i „Przejdź do listy” (`/`). To realizuje „od razu widzi go na liście” z roadmapy bez zmian w liście S-02 i S-03.
8. **Testy:** Vitest dla walidatora, krok CI z testem RLS przez PostgREST i kroki smoke dla `POST /api/recipes`.
9. **Odstępstwo (impl-review F1):** `matchRecipes` przelicza w pamięci najwyżej `MAX_RECOMPUTED_RECIPES = 200` przepisów bez aktualnych kluczy na żądanie (`src/lib/recipes/limits.ts`). Reszta jest pomijana w rankingu do czasu `npm run match-keys`. Bez limitu insertów na autora. Wartość jest tymczasowa i do zweryfikowania pomiarem CPU w #19.

## What We're NOT Doing

- Edycja i usuwanie przepisów oraz polityki `update` i `delete` (S-06). Rola admina (S-07).
- Liczenie i zapis `match_keys` przy `POST`. Nie zmieniamy też `scripts/match-keys.ts`.
- Zmiany w liście na `/`: bez przypinania i podświetlania nowego przepisu. Strona szczegółów przepisu należy do S-02.
- Pole `authorId` w typie `Recipe` i w odpowiedziach `GET`. Doda je S-06, gdy będzie potrzebne.
- Uzupełnianie `author_id` w `supabase/seed.sql`. Wiersze seeda zostają z `null`.
- Wykrywanie duplikatów nazw przepisów, szkice formularza i autozapis.
- Biblioteka walidacji (zod) i biblioteka formularzy. Zostajemy przy ręcznym walidatorze zgodnym z konwencją repo.
- Zapis decyzji F-02 w `context/foundation/` i w roadmapie. Zostaje w tym planie i w komentarzu kolumny.

## Implementation Approach

Kolejność według wzorca „schemat → logika → API → UI”. Każda faza da się zweryfikować osobno.

1. **Migracja.** Pierwsza, bo endpoint bez grantu dostałby 42501. Jest addytywna i wstecznie zgodna, więc stary kod działa na nowym schemacie.
2. **Walidator.** Czysta funkcja w `src/lib/recipes/` bez Supabase, z testami Vitest. To jedno źródło prawdy o tym, co jest poprawnym przepisem, i formularz używa tych samych reguł i komunikatów.
3. **Endpoint.** Cienki: limity żądania, parsowanie, walidator, serwis, mapowanie błędów.
4. **UI.** Wyspa React na wzór `PantryMatch`, z `fetch` JSON i hookiem w `src/components/hooks/`.

## Critical Implementation Details

- **Kolejność kroków CI i smoke.** CI sprawdza `length == 5` i `updated 5` przed smoke, a krok RLS w CI nie może zostawić żadnego wstawionego wiersza (testuje tylko odmowy). Smoke wstawia przepis dopiero **po** kroku „signed-in user matches recipes to the pantry” (`total === 4`). Przepis testowy ma składnik „Jogurt naturalny”, więc `exclude=jogurt` go ukrywa. Dzięki temu powtórny smoke na lokalnej bazie też nie psuje `total === 4`.
- **Kolejność sprawdzeń w Postgresie.** Grant kolumnowy jest sprawdzany przed RLS, więc insert z `match_keys` albo `id` kończy się błędem 42501 „permission denied”, nie naruszeniem polityki. W obu przypadkach PostgREST odpowiada 403 z `code: "42501"` dla roli `authenticated` i 401 dla anon.
- **UX formularza:**
  - Po błędzie walidacji fokus trafia na pierwsze błędne pole.
  - Po sukcesie fokus trafia na nagłówek komunikatu sukcesu (`tabIndex={-1}`).
  - Pole błędu ma `aria-invalid` i `aria-describedby`, wskazujące na komunikat pod polem.
  - Przycisk zapisu jest wyłączony w trakcie wysyłki, żeby nie było podwójnego zapisu.

## Phase 1: Migracja autorstwa i insertu

### Overview

Addytywna migracja, która dodaje autora i uprawnienie do wstawiania. Do tego test RLS w CI i aktualizacja kontraktu danych.

### Changes Required:

#### 1. Migracja

**File**: `supabase/migrations/20261017120000_add_recipe_author_and_insert.sql`

**Intent**: Wprowadzić autorstwo i insert przez `authenticated` z egzekwowaniem po stronie bazy. Insert od użytkownika nie może ustawić `id`, `created_at` ani kluczy dopasowania. Nagłówek migracji ma wyjaśniać, że klucze zostają `null` przy zapisie użytkownika (decyzja 3). To uzupełnia nieaktualny komentarz „only the service role … later recipe writes” z migracji S-03, której nie wolno edytować.

**Contract**:

- `author_id uuid null default auth.uid() references auth.users(id) on delete set null`.
- Indeks `recipes_author_id_idx` na `author_id`, pod przyszłe zapytania S-06 i pod `on delete set null`.
- `comment on column public.recipes.author_id` mówi, że autora ustawia sesja (`auth.uid()`). Mówi też, że import F-02 (service role) wpisuje jawnie UUID autorki aplikacji, a wiersze seeda mają `null`.
- `grant insert (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g, author_id) on public.recipes to authenticated;`
- Polityka `recipes_insert_own`: `for insert to authenticated with check (author_id = (select auth.uid()))`.
- Bez polityk i grantów dla `anon`. Bez `update` i `delete`.

#### 2. Test RLS insertu w CI

**File**: `.github/workflows/ci.yml`

**Intent**: Udowodnić po stronie danych, że insert przepuszcza tylko własnego autora i tylko dozwolone kolumny. Krok zgodny z lesson „Assert status and body type before content”: najpierw status, potem `jq -e` na typie i kodzie.

**Contract**: Nowy krok w jobie `smoke`, „Check recipe insert permissions”, po kroku „Check that recipes are hidden from the anon key”. Krok:

- zakłada dwóch użytkowników (A i B) przez `POST $API_URL/auth/v1/signup` z `ANON_KEY`;
- bierze ich `access_token` i `user.id`, sprawdzając `jq -e` na typie;
- dla każdego przypadku wysyła `POST $API_URL/rest/v1/recipes` z poprawną treścią przepisu i oczekuje odmowy.

Przypadki:

- anon → 401 i `code == "42501"`;
- A z `author_id` B → 403 i `42501`;
- A z `author_id: null` → 403 i `42501`;
- A z własnym `author_id` i `match_keys` → 403 i `42501`;
- A z własnym `author_id` i `id` → 403 i `42501`.

Na końcu krok sprawdza service role, że w tabeli nadal jest dokładnie 5 wierszy. Krok nie wstawia żadnego wiersza, więc dalsze `updated 5` i `total === 4` się nie zmieniają.

#### 3. Kontrakt danych

**File**: `docs/reference/recipe-data-contract.md`

**Intent**: Usunąć nieaktualne „zapisu przez API na razie nie ma” i opisać autora.

**Contract**:

- W tabeli „Kształt rekordu” dochodzi wiersz `author_id`: `uuid` albo `null`, z sesji, `on delete set null`, bez pola w `Recipe`.
- Akapit „Dostęp (RLS)” mówi, że `authenticated` wstawia tylko jako siebie, bez `match_keys`, przez `POST /api/recipes`, a edycja i usuwanie przyjdą w S-06 i S-07.

### Success Criteria:

#### Automated Verification:

- Migracja aplikuje się na czystej bazie razem z seedem: `npx supabase db reset`
- Job `smoke` w CI przechodzi z nowym krokiem „Check recipe insert permissions”
- Lint przechodzi: `npm run lint`

#### Manual Verification:

- W Supabase Studio lokalnie: kolumna `author_id` ma FK `on delete set null`. Polityka `recipes_insert_own` jest widoczna, a 5 wierszy seeda ma `author_id = null`.

**Implementation Note**: Po zielonych sprawdzeniach automatycznych zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Wspólne limity i walidator

### Overview

Czysty moduł w `src/lib/recipes/`, który sprawdza i normalizuje wejście przepisu. Używają go API i formularz.

### Changes Required:

#### 1. Limity

**File**: `src/lib/recipes/limits.ts`

**Intent**: Jedno miejsce na limity z decyzji 5. Ograniczają pracę CPU na żądanie (lesson „Bound user-driven CPU work per request”) i koszt fallbacku kluczy na jeden przepis.

**Contract**: Eksportowane stałe:

- `MAX_RECIPE_NAME_LENGTH = 120`
- `MAX_INGREDIENTS = 40`
- `MAX_SUBSTITUTES = 5`
- `MAX_INGREDIENT_TEXT_LENGTH = 80` (dla `name` i `product`)
- `MAX_UNIT_LENGTH = 20`
- `MAX_STEPS = 30`
- `MAX_STEP_LENGTH = 1000`
- `MAX_AMOUNT = 100000`
- `MAX_PREP_TIME_MIN = 1440`
- `MAX_SERVINGS = 100`
- `MAX_KCAL = 10000`
- `MAX_MACRO_G = 1000`
- `MAX_RECIPE_BODY_BYTES = 100000`

Komentarz nagłówka wskazuje, kto ich używa, wzorem `src/lib/matching/limits.ts:1`.

#### 2. Walidator

**File**: `src/lib/recipes/validate.ts`

**Intent**: Zamienić nieznane body na `NewRecipe` albo listę błędów z polskimi komunikatami, przypiętymi do ścieżek pól. Formularz pokazuje te błędy przy polach, a API odsyła je w `issues`. Walidator przepisuje tylko znane pola. Ignoruje `id`, `authorId`, `matchKeys` i inne klucze, bo autor pochodzi z sesji.

**Contract**:

- `export const RECIPE_KINDS = ["na słodko", "na wytrawnie", "na ciepło", "na zimno"] as const satisfies readonly RecipeKind[]`. To runtime'owa lista do checkboxów i walidacji.
- `export type NewRecipe = Omit<Recipe, "id">`.
- `export interface RecipeIssue { path: string; message: string }`. Ścieżki w notacji z kropkami: `name`, `steps.2`, `ingredients.0.product`, `ingredients.1.substitutes.0.amount`, `kcal`.
- `export function parseRecipeInput(body: unknown): { ok: true; value: NewRecipe } | { ok: false; issues: RecipeIssue[] }`.
- `export function defaultProduct(name: string): string`, czyli `name.trim().toLocaleLowerCase("pl")`. Formularz używa jej do automatycznego wypełniania.

Reguły:

- **Teksty** są przycinane. Nazwa przepisu nie może być pusta.
- **Kroki:** 1 do `MAX_STEPS` niepustych kroków. Puste kroki to błąd, nie są pomijane w ciszy.
- **Składniki:** 1 do `MAX_INGREDIENTS`, każdy z niepustym `name`. Pusty `product` dostaje `defaultProduct(name)`.
- **Ilość:** `amount` i `unit` są razem `null` albo razem ustawione. `amount` to skończona liczba z przedziału (0, `MAX_AMOUNT`], a `unit` jest niepusty.
- **Zamienniki:** do `MAX_SUBSTITUTES` na składnik. Mają te same reguły co składnik, ale bez własnych `substitutes`.
- **`kinds`:** podzbiór `RECIPE_KINDS`, deduplikowany. Brak pola daje `[]`.
- **Pola liczbowe:**
  - `prepTimeMin`, `servings` i `kcal` są liczbami całkowitymi w swoich zakresach albo `null`;
  - `proteinG`, `carbsG` i `fatG` są liczbami z przedziału [0, `MAX_MACRO_G`], zaokrąglanymi do 0,1, albo `null`;
  - brak pola daje `null`.
- **Zły typ** (na przykład tekst zamiast tablicy) daje błąd na tej ścieżce, nie wyjątek.

#### 3. Testy

**File**: `src/lib/recipes/validate.test.ts`

**Intent**: Przypadki brzegowe reguł i limitów.

**Contract**: Testy pokrywają:

- minimalny poprawny przepis;
- pełny przepis z przykładu w kontrakcie (`recipe-data-contract.md`, „Przykład rekordu”) bez `id`;
- domyślny `product` („Mleko 1,5%” → „mleko 1,5%”) i zachowanie podanego `product`;
- `amount` bez `unit` i odwrotnie, `amount = 0` i liczby ujemne;
- limity na granicy (`MAX_INGREDIENTS` przechodzi, `MAX_INGREDIENTS + 1` daje błąd `ingredients`; tak samo zamienniki, kroki i długości);
- nieznane `kinds` i duplikaty `kinds`;
- ignorowanie `authorId`, `id` i `matchKeys`;
- body niebędące obiektem (`null`, tablica, tekst);
- ścieżki błędów zagnieżdżonych.

### Success Criteria:

#### Automated Verification:

- Testy przechodzą: `npm test`
- Typy przechodzą: `npx astro check`
- Lint przechodzi: `npm run lint`

**Implementation Note**: Faza bez weryfikacji ręcznej. Po zielonych sprawdzeniach przejdź do fazy 3.

---

## Phase 3: POST /api/recipes

### Overview

Serwis zapisu i handler `POST` obok istniejącego `GET`. Do tego kroki smoke.

### Changes Required:

#### 1. Serwis

**File**: `src/lib/services/recipes.ts`

**Intent**: Zapis przepisu z mapowaniem camelCase na snake_case, w lustrze `toRecipe`. Zwraca wiersz w kształcie `Recipe`.

**Contract**: `export async function createRecipe(supabase: SupabaseClient, authorId: string, recipe: NewRecipe): Promise<Recipe>`. Funkcja:

- wstawia kolumny treści i `author_id: authorId`;
- nie przekazuje `match_keys`, `match_keys_version`, `id` ani `created_at`;
- woła `.select(RECIPE_COLUMNS).single()` i mapuje wynik przez `toRecipe`;
- rzuca błąd bazy jak `listRecipes`.

#### 2. Handler

**File**: `src/pages/api/recipes/index.ts`

**Intent**: Cienki endpoint wzorem `GET`: kolejno sprawdza żądanie, waliduje, zapisuje i mapuje błędy. Limit body jest sprawdzany, zanim body zostanie sparsowane.

**Contract**: `export const POST: APIRoute`. Kolejność kroków:

1. Typ MIME z `Content-Type` bez parametrów (`split(";")[0].trim().toLowerCase()`) różny od `application/json` → 415 `{ error: "unsupported_media_type" }`. Nie `includes`, bo `text/plain; x=application/json` przeszłoby bez preflightu CORS.
2. `Content-Length` > `MAX_RECIPE_BODY_BYTES` → 413 `{ error: "payload_too_large" }`.
3. `await request.text()`. Długość w bajtach (`TextEncoder`) > limit → 413.
4. Błąd `JSON.parse` → 400 `{ error: "invalid_json" }`.
5. `parseRecipeInput` → 400 `{ error: "invalid_recipe", issues }`.
6. `createClient` → `null` daje 503 `not_configured`.
7. `createRecipe(supabase, context.locals.user.id, value)` → 201 `{ recipe }`.
8. Wyjątek → `console.error` i 500 `database_error`.

Jeśli `locals.user` jest pusty mimo middleware, handler zwraca 401 `unauthorized`, jako obronę.

#### 3. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Sprawdzić zapis przez zbudowaną aplikację.

**Contract**:

- `request()` dostaje opcję `json`, która wysyła body JSON z `Content-Type: application/json`.
- Nowy krok przed „signup creates account”: „anonymous recipe post gets 401” → 401 `unauthorized`.
- Nowe kroki **po** „signed-in user matches recipes to the pantry”:
  - „signed-in user adds a recipe” → 201, `typeof body.recipe.id === "string"`. Nazwa przepisu to `Smoke ${Date.now()}`. Składnik „Jogurt naturalny” ma pusty `product`, a odpowiedź ma `product === "jogurt naturalny"`.
  - „invalid recipe is rejected” → 400 `invalid_recipe` z `Array.isArray(body.issues)` dla `ingredients: []`.
- Komentarz przy kroku wyjaśnia, dlaczego składnik to jogurt (`total === 4` przy powtórnym uruchomieniu).

### Success Criteria:

#### Automated Verification:

- Typy przechodzą: `npx astro check`
- Lint przechodzi: `npm run lint`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`
- Smoke przechodzi lokalnie na zresetowanej bazie i w CI: `BASE_URL=http://localhost:4321 npm run smoke`

#### Manual Verification:

- `curl` na lokalnym serwerze z ciasteczkiem sesji: przepis z 41 składnikami dostaje 400 z błędem na `ingredients`, a body ponad 100 KB dostaje 413.
- Wstawiony przepis ma w bazie `author_id` zalogowanego użytkownika i `match_keys = null`. Pojawia się w `/api/recipes/match` z poprawnym dopasowaniem przez fallback.

**Implementation Note**: Po zielonych sprawdzeniach automatycznych zatrzymaj się na ręczne potwierdzenie przed fazą 4.

---

## Phase 4: Formularz, strona i nawigacja

### Overview

Strona `/recipes/new` z wyspą formularza, stanem sukcesu i linkiem w nagłówku. Wszystko na tokenach i komponentach `ui/`.

### Changes Required:

#### 1. Komponenty shadcn

**File**: `src/components/ui/label.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/checkbox.tsx`

**Intent**: Brakujące klocki formularza. Dodane przez `npx shadcn@latest add label textarea checkbox`, które doinstaluje `@radix-ui/react-label` i `@radix-ui/react-checkbox`.

**Contract**: Pliki upstream bez zmian. Brakujący wygląd to nowy wariant w `ui/` na tokenach, bez kolorów w `className` widoków.

#### 2. Hook formularza

**File**: `src/components/hooks/useRecipeForm.ts`

**Intent**: Stan formularza i wysyłka. Hook trzyma wiersze składników, zamienników i kroków. Dla każdego wiersza pamięta, czy `product` był ręcznie zmieniony (decyzja 4). Mapuje `issues` z API albo z lokalnego `parseRecipeInput` na błędy pól i obsługuje stany `idle`, `submitting`, `saved` i `error`.

**Contract**: Hook zwraca:

- stan pól;
- akcje: dodaj i usuń składnik, zamiennik, krok; zmień pole; przełącz rodzaj;
- `submit()`, `reset()`;
- `status`, `fieldErrors: Record<string, string>`, `serverError: string | null`, `saved: Recipe | null`.

Zachowanie:

- Zmiana `name` składnika aktualizuje `product` przez `defaultProduct`, dopóki użytkownik go nie edytował.
- Akcje dodawania nie przekraczają limitów z `limits.ts`.
- Przed wysyłką hook zamienia stan na body. Ilość z przecinkiem jest zamieniana na liczbę, a puste pola opcjonalne na `null`. Hook waliduje body lokalnie tym samym `parseRecipeInput` i dopiero wtedy wysyła `fetch("/api/recipes", { method: "POST", … })`.
- Odpowiedź jest sprawdzana najpierw po statusie, potem po kształcie (type guard na `recipe`).
- Komunikaty błędów:
  - 401: „Sesja wygasła. Zaloguj się ponownie.”
  - 400 `invalid_recipe`: błędy przy polach;
  - pozostałe statusy: „Nie udało się zapisać przepisu. Spróbuj ponownie.”;
  - brak sieci: „Brak połączenia z serwerem. Spróbuj ponownie.”

#### 3. Wyspa formularza

**File**: `src/components/recipes/RecipeForm.tsx`, `src/components/recipes/RecipeFormView.tsx`, `src/components/recipes/IngredientFields.tsx`, `src/components/recipes/RecipeSaved.tsx`

**Intent**: Widok formularza w karcie sekcji, wzorem `PantryMatch.tsx:52-53`. Wymagane pola są oznaczone. Etykiety kcal i makro mówią wprost „na 1 porcję”.

**Contract**:

- **`RecipeForm`** (default export) tylko woła `useRecipeForm` i renderuje `RecipeSaved`, gdy `status === "saved"`, a w przeciwnym razie `RecipeFormView`. Ten sam podział co hook i bezstanowe `PantryStates.tsx` w spiżarce. Dzięki niemu kitchen sink pokazuje stany bez mockowania `fetch`.
- **`RecipeFormView`** (bez stanu) dostaje w propsach stan pól, `fieldErrors`, `status`, `serverError` i handlery z hooka. Zawiera:
  - nazwę;
  - listę składników (`IngredientFields`);
  - kroki jako `Textarea` z numeracją oraz przyciskami dodawania i usuwania;
  - rodzaj jako `Checkbox` dla każdego elementu `RECIPE_KINDS`;
  - czas, porcje, kcal, białko, węglowodany i tłuszcze;
  - `ServerError` i przycisk „Zapisz przepis” z `disabled` i `aria-busy` w trakcie wysyłki.
- **`IngredientFields`** to jeden składnik: nazwa, produkt do dopasowania z podpowiedzią, ilość i jednostka (`list` z podpowiedziami g, sztuka, łyżka, łyżeczka, szczypta, szklanka) oraz lista zamienników z tymi samymi polami. Przyciski usuwania mają `aria-label` z nazwą elementu.
- **`RecipeSaved`** zawiera nagłówek „Przepis dodany” z fokusem, `RecipeTile` z `recipe={saved}` oraz przyciski „Dodaj kolejny” (`reset`) i „Przejdź do listy” (link `/`).
- Błędy przy polach: `aria-invalid`, `aria-describedby` i tekst w `text-destructive`.

#### 4. Strona i nawigacja

**File**: `src/pages/recipes/new.astro`, `src/components/AppHeader.astro`, `src/components/ui/button.tsx`

**Intent**: Trasa formularza chroniona przez istniejący middleware oraz link w nagłówku.

**Contract**:

- `new.astro` używa `AppLayout title="Dodaj przepis"` z `<RecipeForm client:load />`, wzorem `src/pages/index.astro`.
- `AppHeader` dostaje link „Dodaj przepis” w grupie z e-mailem, przez `buttonVariants`:
  - nowy wariant `nav-current` z `aria-current="page"`, gdy `Astro.url.pathname === "/recipes/new"`;
  - `ghost` na pozostałych stronach.
- `buttonVariants` w `ui/button.tsx` dostaje wariant `nav-current` tylko na tokenach (`bg-accent text-accent-foreground`). Nie używać `ghost-current`, który jest przyciskiem w `currentColor` (usuwanie tagu w `TagInput.tsx:68`) i bez hovera niczego nie wyróżnia.
- Układ działa na szerokości telefonu (e-mail już ma `truncate`).

#### 5. Kitchen sink i strażnik UI

**File**: `src/components/dev/KitchenSink.tsx`, `scripts/check-ui-literals.mjs`

**Intent**: Nowe stany komponentów są widoczne w `/dev/kitchen-sink`, a nowe pliki widoków pilnuje skan literałów.

**Contract**:

- Kitchen sink dostaje sekcje: pusty formularz, błędy pól, wysyłka (`submitting`), błąd serwera i stan „Przepis dodany”. Są renderowane przez `RecipeFormView` i `RecipeSaved` z przykładowym stanem i pustymi handlerami. Dochodzi też przycisk w wariancie `nav-current`.
- Do `CLEAN_FILES` dochodzą `src/pages/recipes/new.astro`, `src/components/recipes/RecipeForm.tsx`, `src/components/recipes/RecipeFormView.tsx`, `src/components/recipes/IngredientFields.tsx` i `src/components/recipes/RecipeSaved.tsx`.

### Success Criteria:

#### Automated Verification:

- Skan literałów przechodzi: `npm run check:ui`
- Lint przechodzi: `npm run lint`
- Typy przechodzą: `npx astro check`
- Testy przechodzą: `npm test`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Na `/recipes/new` dodanie przepisu z dwoma składnikami, w tym jednym z zamiennikiem, pokazuje kafelek przepisu. „Przejdź do listy” prowadzi na `/`, gdzie licznik przepisów wzrósł o 1.
- Pole „produkt” wypełnia się nazwą małymi literami, przestaje się synchronizować po ręcznej edycji i nie jest nadpisywane przy dalszej zmianie nazwy.
- Puste wymagane pola, ilość bez jednostki i limit składników pokazują błędy przy polach, a fokus trafia na pierwsze błędne pole.
- Formularz jest użyteczny na telefonie (360 px) i na desktopie, w motywie ciemnym. Link „Dodaj przepis” w nagłówku ma stan bieżącej strony.
- `/dev/kitchen-sink` pokazuje nowe stany formularza.

**Implementation Note**: Po zielonych sprawdzeniach automatycznych zatrzymaj się na ręczne potwierdzenie.

---

## Testing Strategy

### Unit Tests:

- `src/lib/recipes/validate.test.ts`: reguły kontraktu składnika, domyślny `product`, para `amount`/`unit`, limity na granicy, ignorowanie pól spoza whitelisty i ścieżki błędów.

### Integration Tests:

- CI, krok „Check recipe insert permissions”: odmowy RLS i grantów przez PostgREST (anon, cudzy autor, `null`, `match_keys`, `id`). Bez wstawionych wierszy.
- Smoke: `POST /api/recipes` daje 401 bez sesji, 201 z domyślnym `product` i 400 `invalid_recipe`.

### Manual Testing Steps:

1. `npx supabase db reset`, potem `npm run dev`. Zaloguj się, otwórz „Dodaj przepis” i zapisz przepis z zamiennikiem.
2. Sprawdź w Studio `author_id` i `match_keys = null`. Wpisz w spiżarce produkt z przepisu i sprawdź, że przepis ma %.
3. Wyślij formularz z błędami i sprawdź komunikaty i fokus.
4. Przejdź formularz na telefonie i w kitchen sink.

## Performance Considerations

- Insert to jedno zapytanie. Walidacja jest liniowa i ograniczona limitami (≤ 40 × 6 opcji składnika).
- **Koszt decyzji 3.** Każdy przepis bez kluczy jest liczony przez `computeMatchKeys` przy każdym `/api/recipes/match`, dopóki ktoś nie uruchomi `npm run match-keys`. Limity ograniczają koszt jednego przepisu. Liczba przepisów bez kluczy rośnie jednak z liczbą dodań. Przy budżecie 10 ms CPU na Workers Free i docelowych ~1000 przepisach trzeba okresowo uruchamiać `npm run match-keys` (zob. Open Risks w briefie). `npm run bench:match` pozwala zmierzyć wpływ.

## Migration Notes

- Migracja jest addytywna: nowa kolumna nullable, grant i polityka. Stary kod jej nie czyta, więc wdrożenie migracji przed kodem jest bezpieczne (`infrastructure.md:151,175`). Migrację produkcyjną zatwierdza człowiek (`infrastructure.md:153`).
- Produkcja nie ma przepisów (stan z `context/archive/2026-10-17-recipe-count/change.md:20`), więc nie ma czego uzupełniać. Istniejące wiersze mają `author_id = null`.
- Wycofanie: nowa migracja z `drop policy recipes_insert_own`, `revoke insert … from authenticated` i `drop column author_id`, po wycofaniu kodu endpointu.
- **F-02:** import (service role) ustawia `author_id` jawnie na UUID autorki aplikacji (decyzja 6).
- PR: dodaj „Closes #N” dla issue S-05 (lesson „Close roadmap issues explicitly”). Change ID w roadmapie to `add-recipe-manually`, a folder to `add-recipe`. Odnotuj to przy archiwizacji.

## References

- Research: `context/changes/add-recipe/research.md`
- Kontrakt danych: `docs/reference/recipe-data-contract.md`
- Wzorzec endpointu: `src/pages/api/recipes/index.ts:10-31`
- Wzorzec limitów: `src/lib/matching/limits.ts`
- Wzorzec wyspy i hooka: `src/components/pantry/PantryMatch.tsx`, `src/components/hooks/usePantryMatch.ts`
- Wzorzec kroku CI: `.github/workflows/ci.yml:45-56`
- Wymóg S-03 zastąpiony decyzją 3: `context/archive/2026-10-12-first-pantry-match/plan.md:410`
- Nazwa `author_id`: `context/archive/2026-10-12-recipe-catalog-contract/plan.md:41`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migracja autorstwa i insertu

#### Automated

- [x] 1.1 Migracja aplikuje się na czystej bazie razem z seedem: `npx supabase db reset` — e0455c0
- [x] 1.2 Job `smoke` w CI przechodzi z nowym krokiem „Check recipe insert permissions” — e0455c0
- [x] 1.3 Lint przechodzi: `npm run lint` — e0455c0

#### Manual

- [x] 1.4 W Supabase Studio lokalnie: kolumna `author_id` ma FK `on delete set null`, polityka `recipes_insert_own` jest widoczna, a 5 wierszy seeda ma `author_id = null` — e0455c0

### Phase 2: Wspólne limity i walidator

#### Automated

- [x] 2.1 Testy przechodzą: `npm test` — b16cae2
- [x] 2.2 Typy przechodzą: `npx astro check` — b16cae2
- [x] 2.3 Lint przechodzi: `npm run lint` — b16cae2

### Phase 3: POST /api/recipes

#### Automated

- [x] 3.1 Typy przechodzą: `npx astro check` — 4f9d784
- [x] 3.2 Lint przechodzi: `npm run lint` — 4f9d784
- [x] 3.3 Testy przechodzą: `npm test` — 4f9d784
- [x] 3.4 Build przechodzi: `npm run build` — 4f9d784
- [x] 3.5 Smoke przechodzi lokalnie na zresetowanej bazie i w CI: `BASE_URL=http://localhost:4321 npm run smoke` — 4f9d784

#### Manual

- [x] 3.6 `curl` z sesją: przepis z 41 składnikami dostaje 400 z błędem na `ingredients`, a body ponad 100 KB dostaje 413 — 4f9d784
- [x] 3.7 Wstawiony przepis ma `author_id` zalogowanego użytkownika i `match_keys = null`, a `/api/recipes/match` dopasowuje go przez fallback — 4f9d784

### Phase 4: Formularz, strona i nawigacja

#### Automated

- [x] 4.1 Skan literałów przechodzi: `npm run check:ui` — 301fcd7
- [x] 4.2 Lint przechodzi: `npm run lint` — 301fcd7
- [x] 4.3 Typy przechodzą: `npx astro check` — 301fcd7
- [x] 4.4 Testy przechodzą: `npm test` — 301fcd7
- [x] 4.5 Build przechodzi: `npm run build` — 301fcd7

#### Manual

- [x] 4.6 Dodanie przepisu z zamiennikiem pokazuje kafelek, a „Przejdź do listy” prowadzi na `/` z licznikiem większym o 1 — 301fcd7
- [x] 4.7 Pole „produkt” wypełnia się nazwą małymi literami i przestaje się synchronizować po ręcznej edycji — 301fcd7
- [x] 4.8 Błędy walidacji pokazują się przy polach, a fokus trafia na pierwsze błędne pole — 301fcd7
- [x] 4.9 Formularz jest użyteczny na telefonie (360 px) i na desktopie, w motywie ciemnym, a link w nagłówku ma stan bieżącej strony — 301fcd7
- [x] 4.10 `/dev/kitchen-sink` pokazuje nowe stany formularza — 301fcd7
