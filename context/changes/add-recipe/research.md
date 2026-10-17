---
date: 2026-10-17T20:34:40+02:00
researcher: Claude (Opus 5.5) dla Aleksandry Pęcherz
git_commit: c104d55
branch: add-recipe
repository: pasujemi-recipe
topic: "S-05 add-recipe: ręczne dodawanie przepisu (kolumna autora, RLS insert, formularz, POST API)"
tags: [research, recipes, supabase, rls, api, form, match-keys]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (Opus 5.5)
---

# Research: S-05 add-recipe — ręczne dodawanie przepisu

**Date**: 2026-10-17T20:34:40+02:00
**Researcher**: Claude (Opus 5.5) dla Aleksandry Pęcherz
**Git Commit**: c104d55
**Branch**: add-recipe
**Repository**: pasujemi-recipe

## Research Question

S-05 z roadmapy: zalogowany użytkownik ręcznie dodaje przepis. Potrzebne są: kolumna autora w `public.recipes`, RLS na insert (wstawiać można tylko jako siebie), formularz i `POST` API. Decyzja już podjęta: przepisy z przyszłego importu F-02 dostaną autorkę aplikacji jako autora. Edycja i usuwanie (S-06) są poza zakresem.

## Summary

- **Baza.** Dziś `authenticated` ma tylko `select`. Insertu nie ma ani w grantach, ani w politykach (`supabase/migrations/20261012120000_create_recipes.sql:28-36`). S-05 dokłada addytywną migrację z trzema elementami:
  - kolumną `author_id`, której nazwę przewidział plan F-01 (`context/archive/2026-10-12-recipe-catalog-contract/plan.md:41`);
  - jawnym `grant insert`, bo migracja F-01 robi `revoke all`;
  - polityką `for insert to authenticated with check (author_id = (select auth.uid()))`.
- **Autor na seedzie.** 5 wierszy w `supabase/seed.sql` (linie 6, 37, 58, 83, 111) nie ma autora, a seed nie tworzy użytkowników. Kolumna `NOT NULL` z FK do `auth.users` wywróciłaby seed. Za nim posypałyby się kroki CI zależne od 5 wierszy (`.github/workflows/ci.yml:51`, `:61-66`) i smoke (`scripts/smoke.mjs:84`, `:96`).
  - Produkcja nie ma dziś przepisów (`context/archive/2026-10-17-recipe-count/change.md:20`), więc tam nie ma czego uzupełniać.
- **`match_keys` (główna sprzeczność do rozstrzygnięcia w planie).** Plan S-03 wymaga, żeby nowe zapisy S-05 wołały `computeMatchKeys` i zapisywały `match_keys_version` (`context/archive/2026-10-12-first-pantry-match/plan.md:410`). Komentarz migracji mówi jednak, że klucze wypełnia tylko service role (`supabase/migrations/20261013120000_add_recipe_match_keys.sql:3`). Klucza service role nie wolno wpuścić do Workera (`scripts/match-keys.ts:3`). POST w Workerze może więc zapisać klucze tylko jako `authenticated`, z grantem na te kolumny. Bez klucza działa fallback, który liczy je przy każdym żądaniu (`src/lib/services/recipes.ts:140-157`).
- **Walidacja.** Kształtu elementów `ingredients` baza nie sprawdza, więc musi go walidować piszący, czyli formularz S-05 (`docs/reference/recipe-data-contract.md:129`). W repo nie ma zod ani react-hook-form w `package.json`. Konwencją są ręczne walidatory i type guardy (`src/components/auth/SignInForm.tsx:23-45`, `src/components/hooks/usePantryMatch.ts:36-87`).
- **Wymagane pola.** Obowiązkowe są nazwa, kroki i składniki. „Opis” z PRD FR-007 (`context/foundation/prd.md:99`) to kroki „Jak zrobić?”, a nie osobne pole (`context/archive/2026-10-12-recipe-catalog-contract/plan.md:44`).
- **UI.** W `src/components/ui/` są 4 komponenty: `badge`, `button`, `input`, `skeleton`. Brakuje `label`, `textarea` i `checkbox`. Wzorcem tokenów są komponenty spiżarki, a nie formularze auth. Nawigacji w `AppHeader.astro` jeszcze nie ma. Nowa strona i `POST /api/recipes` są chronione middlewarem bez żadnych zmian (`src/middleware.ts:5`, `:34-38`).

## Detailed Findings

### 1. Dzisiejszy stan tabeli i uprawnień

- `public.recipes` ma 13 kolumn: `id`…`created_at` (`supabase/migrations/20261012120000_create_recipes.sql:5-22`) oraz `match_keys` i `match_keys_version` (`20261013120000_add_recipe_match_keys.sql:6-8`). Nie ma kolumny autora (sprawdzone: grep `author|user_id` w `supabase/` i `src/` nie dał trafień w schemacie).
- RLS jest włączony. Wykonywane są `revoke all … from anon, authenticated` i `grant select … to authenticated`. Jest jedna polityka, `recipes_select_authenticated` z `using (true)` (`create_recipes.sql:25-36`).
  - **Wniosek:** sama polityka insert nie wystarczy. Potrzebny jest też grant `insert` (tabelowy albo kolumnowy) dla `authenticated`.
- CHECK-i w bazie (`create_recipes.sql:7-21`):
  - niepusta nazwa po `btrim`;
  - `cardinality(steps) >= 1`;
  - `ingredients` jest niepustą tablicą JSON;
  - `prep_time_min >= 0`;
  - `servings > 0`;
  - `kinds` jest podzbiorem 4 wartości;
  - kcal i makro są `>= 0`, a makro ma typ `numeric(6,1)`.
- Kontrakt wymaga migracji addytywnej (`create_recipes.sql:3`, `docs/reference/recipe-data-contract.md:29`). Migracja musi być wstecznie zgodna i zastosowana przed kodem, który jej potrzebuje (`context/foundation/infrastructure.md:151,175`). Migrację produkcyjną zatwierdza człowiek (`infrastructure.md:153`).

### 2. Kolumna autora: ograniczenia i warianty

- PRD daje autorowi przepisu i adminowi prawo edycji i usuwania (`context/foundation/prd.md:52`, `:131-132`). Reguła ma być egzekwowana po stronie danych (`context/foundation/roadmap.md:179`). Z tego wynika, że S-05 musi zapisywać autora wiarygodnie: z sesji, a nie z body żądania.
- Nazwa `author_id` pochodzi z planu F-01 (`context/archive/2026-10-12-recipe-catalog-contract/plan.md:41`). Nie znaleziono `created_by` ani `owner_id` w `context/` ani w `src/`.
- **Nullable czy NOT NULL.**
  - Wiersze seeda wstawia superuser bez użytkowników (`supabase/seed.sql:6` i 4 kolejne inserty). Przy `NOT NULL` seed musiałby najpierw tworzyć użytkownika w `auth.users`.
  - Alternatywa: kolumna nullable z `default auth.uid()`. Wiersze seeda/CI dostają wtedy `null`.
  - W obu wariantach polityka `with check (author_id = (select auth.uid()))` blokuje wstawienie `null` i cudzego id przez `authenticated`.
- **F-02.** Decyzja „import ma autorkę aplikacji jako autora” nie jest jeszcze zapisana w żadnym dokumencie. Sprawdzone: `context/foundation/*.md`, `docs/reference/recipe-data-contract.md` i `context/archive/**`. Import działa lokalnie (`recipe-data-contract.md:8`) i pisze jako service role, który omija RLS. Dlatego musi jawnie ustawić `author_id` na UUID autorki, bo `default auth.uid()` da `null` dla service role. Dla S-05 wynika z tego tylko tyle, że schemat musi pozwalać wstawić `author_id` z zewnątrz, gdy pisze service role.
- **`on delete` dla FK do `auth.users`.** Do wyboru jest `set null` (przepis zostaje we wspólnej bazie bez autora) albo `cascade` (przepis znika z kontem). Żaden dokument tego nie rozstrzyga. To decyzja produktowa (zob. Open Questions).

### 3. `match_keys` przy zapisie

- Wymóg zapisano w planie S-03: „Nowe zapisy przepisów (S-05, F-02) muszą wołać `computeMatchKeys` i zapisywać `match_keys_version = MATCH_KEYS_VERSION`. Do tego czasu brak kluczy obsługuje fallback” (`context/archive/2026-10-12-first-pantry-match/plan.md:410`).
  - `computeMatchKeys` jest czystą funkcją TS (`src/lib/matching/keys.ts:106-111`), eksportowaną z `@/lib/matching` (`src/lib/matching/index.ts`).
- **Sprzeczność.**
  - Komentarz migracji: „No write policies: only the service role (scripts/match-keys.ts, later recipe writes) fills the keys” (`20261013120000_add_recipe_match_keys.sql:3`).
  - Klucz service role nie trafia do Workera: „never goes to astro:env, .dev.vars or the Worker” (`scripts/match-keys.ts:3`). Klient w Workerze używa tylko `SUPABASE_KEY` z sesją użytkownika (`src/lib/supabase.ts:5-21`).
  - Zapis kluczy przy POST wymaga więc grantu insert na `match_keys` i `match_keys_version` dla `authenticated`.
- **Fallback, gdy klucze są `null`.** `matchRecipes` liczy klucze w pamięci dla wierszy z `null` albo inną wersją, osobno dla każdego żądania (`src/lib/services/recipes.ts:140-157`). Dodatkowo `keysFitIngredients` przelicza klucze niepasujące kształtem (`recipes.ts:117-122`, `:197-201`).
  - Przepis bez kluczy będzie więc dopasowywany poprawnie, tyle że kosztem CPU przy każdym żądaniu, aż człowiek uruchomi `npm run match-keys` (`context/archive/2026-10-12-first-pantry-match/plan.md:408`).
- **Ryzyko grantu na klucze.** Użytkownik z JWT i kluczem anon mógłby przez PostgREST wstawić sfałszowane klucze o poprawnym kształcie. `keysFitIngredients` sprawdza tylko długości (`recipes.ts:117-122`). Klucz anon jest tylko w `astro:env/server` (`astro.config.mjs:19-20`, AGENTS.md), więc to wniosek o niskim prawdopodobieństwie. Nie zostało to zweryfikowane testem.

### 4. API: istniejące wzorce

- `src/pages/api/recipes/index.ts` eksportuje tylko `GET` (`:10`). `POST` naturalnie dochodzi w tym samym pliku.
  - Wzorzec obsługi: `createClient(headers, cookies)`. Brak klienta daje 503 `not_configured`, błąd bazy daje 500 `database_error` z `console.error`. Błędy mają kształt `Response.json({ error: "<code>" }, { status })` (`index.ts:15-31`).
- Middleware odpowiada 401 `{ error: "unauthorized" }` dla niezalogowanych na `/api/*`. Ustawia też `locals.user` (`src/middleware.ts:12-36`), więc handler ma id użytkownika bez dodatkowego `getUser()`.
- Serwis mapuje snake_case na camelCase w `toRecipe` (`src/lib/services/recipes.ts:13`, `:33-47`). Kształt body POST (camelCase jak `Recipe` czy snake_case) to decyzja planu. Spójne z odczytem byłoby camelCase plus mapowanie w serwisie.
- `insert(...).select()` z `returning` wymaga, żeby wstawiony wiersz był widoczny przez politykę select. `recipes_select_authenticated` ma `using (true)` (`create_recipes.sql:32-36`), więc ten warunek jest spełniony.
- Formularze auth wysyłają natywny `form POST` z `formData()` i odpowiadają redirectami (`src/pages/api/auth/signup.ts:5-23`). Komponenty spiżarki używają `fetch` z JSON i wynikiem `{ ok } | { ok: false, message }` (`src/components/hooks/usePantryMatch.ts:100-124`). Formularz z dynamiczną listą składników i zamienników lepiej pasuje do drugiego wzorca (JSON). To wniosek, nie decyzja.
- **Limity (lesson „Bound user-driven CPU work per request”, `context/foundation/lessons.md`).** `computeMatchKeys` iteruje po składnikach i zamiennikach (`keys.ts:106-111`). Plan powinien przyjąć twarde limity w jednym pliku współdzielonym przez API i UI, wzorem `src/lib/matching/limits.ts`:
  - liczba składników;
  - liczba zamienników;
  - liczba kroków;
  - długości tekstów;
  - rozmiar body.

### 5. Walidacja kształtu przepisu

- Granica walidacji: baza sprawdza kolumny, piszący sprawdza elementy `ingredients` (`docs/reference/recipe-data-contract.md:127-129`).
- Reguły pól (`recipe-data-contract.md:38-45`):
  - `product` pisane małymi literami, bez marki;
  - `amount` i `unit` są razem `null` przy braku ilości;
  - `unit` to „g” albo słowo w mianowniku l.p.;
  - zamienniki mają kształt składnika bez własnych `substitutes`.
- Kcal i makro są „na 1 porcję” (`recipe-data-contract.md:21-24`). Formularz musi to powiedzieć wprost w etykiecie.
- Ryzyko S-05 z roadmapy: składniki z formularza mają podlegać tej samej regule „tego samego składnika” co S-03 (`context/foundation/roadmap.md:166`). S-03 jest `done` (`roadmap.md:144`), a regułę realizuje `computeMatchKeys`. Formularz nie musi więc normalizować `product` sam.
  - Otwarte zostaje, czy formularz pyta o `name` i `product` osobno, czy wyprowadza `product` z `name` (zob. Open Questions).
- W repo nie ma bibliotek walidacji. Zod 4.6.2 jest tylko przechodnio w `package-lock.json:12627` i nie jest importowany w `src`. Walidator współdzielony przez API i UI byłby nowym modułem w `src/lib/` z testem Vitest (`src/**/*.test.ts`, AGENTS.md).

### 6. Formularz i UI

- Komponenty `src/components/ui/`:
  - `badge` ma własne warianty have/staple/exclude/muted (`badge.tsx:10-21`);
  - `button` ma warianty default, destructive, outline, secondary, ghost, `ghost-current` i link (`button.tsx:11-27`);
  - `input` ma `aria-invalid:border-destructive` (`input.tsx:4-17`);
  - `skeleton`.
- Brakuje `label`, `textarea` (kroki) i `checkbox` (`kinds`). Dodaje się je przez `npx shadcn@latest add …`. Doinstalują pakiety `@radix-ui/react-label` i `@radix-ui/react-checkbox`. Dziś z Radixa zainstalowany jest tylko `@radix-ui/react-slot` (`package.json`).
- **Wzorzec do naśladowania:** komponenty spiżarki, które są w `CLEAN_FILES`:
  - `TagInput.tsx:40-42` (etykieta);
  - `PantryMatch.tsx:52-53` (sekcja/karta);
  - `PantryMatch.tsx:80`, `:86`, `:116-118` (loading: `disabled`, `aria-busy`, sr-only `role="status"`);
  - `ServerError.tsx:7-19` (błąd z `role="alert"`).
- **Nie kopiować** `FormField.tsx` ani `SubmitButton.tsx` z `src/components/auth/`. Mają literalne kolory (`FormField.tsx:5-6,39,56,62`, `SubmitButton.tsx:18`) i nie są w `CLEAN_FILES`. Do tego `SubmitButton` opiera się na `useFormStatus`, które nie działa przy `fetch` w `onSubmit`.
- `TagInput` (`TagInput.tsx:21-85`) obsługuje listę „wpisz, Enter, chip”. Zamienniki są jednak obiektami `{name, product, amount, unit}` (`src/types.ts:3-14`), a nie stringami, więc wprost się go nie użyje.
- Brak runtime'owej tablicy `kinds`: `RecipeKind` jest tylko typem (`src/types.ts:16`), więc checkboxy potrzebują stałej.
- **Strona i nawigacja.**
  - `AppLayout.astro:12-19` przyjmuje `title` i renderuje `<main class="mx-auto … max-w-5xl">`.
  - `AppHeader.astro:7-21` ma logo i grupę z e-mailem i „Wyloguj”, bez nawigacji. Link „Dodaj przepis” trzeba dołożyć.
  - Strona wzorem `src/pages/index.astro:1-8` (wyspa `client:load`).
- **Strażnik UI.** `scripts/check-ui-literals.mjs:11-22` ma 10 plików w `CLEAN_FILES`. Nowe pliki formularza trzeba tam dopisać (AGENTS.md, UI). Nowe stany komponentów trafiają do `/dev/kitchen-sink` (`src/components/dev/KitchenSink.tsx`).
- **„Od razu widzi go na liście”** (`roadmap.md:160`). Lista jest na `/` (`src/pages/index.astro`) i sortuje po `name` (`recipes.ts:62-63`). S-02 (szczegóły przepisu) ma status `proposed` (`roadmap.md:131`), więc nie ma strony szczegółów, na którą można przekierować. Najbliższy cel po sukcesie to `/`.

### 7. Testy, seed, CI

- `scripts/match-keys.ts:18-47` tylko aktualizuje klucze, więc kolumna autora go nie dotyka.
- **Kroki zależne od dokładnych liczb:**
  - CI: `length == 5` (`ci.yml:51`) oraz `updated 5`, a potem `updated 0` (`ci.yml:61-66`);
  - smoke: `recipes.length >= 5` (`smoke.mjs:84`) i `total === 4` (`smoke.mjs:96`).
  - Krok smoke, który wstawia przepis przed tymi asercjami, zmieni wynik `ci.yml:51` i `ci.yml:61-66`. Może też zmienić `smoke.mjs:96`, zależnie od składników testowego przepisu.
- Dobrze byłoby, żeby CI sprawdzało RLS dla insertu: anon dostaje odmowę, a `authenticated` z cudzym `author_id` też odmowę. Wzorem jest krok „recipes are hidden from the anon key” (`ci.yml:45-56`) i lesson „Assert status and body type before content”.

## Code References

- `supabase/migrations/20261012120000_create_recipes.sql:5-36`: tabela, CHECK-i, revoke/grant, polityka select
- `supabase/migrations/20261013120000_add_recipe_match_keys.sql:1-15`: kolumny kluczy; komentarz „only the service role”
- `supabase/seed.sql:6,37,58,83,111`: 5 insertów bez autora i bez kluczy
- `src/pages/api/recipes/index.ts:10-31`: `GET` i wzorzec błędów; tu dochodzi `POST`
- `src/lib/services/recipes.ts:13,33-47`: kolumny odczytu i mapowanie na `Recipe`
- `src/lib/services/recipes.ts:117-122,140-157,197-201`: fallback i naprawa kluczy
- `src/lib/matching/keys.ts:106-111`: `computeMatchKeys`
- `src/lib/matching/limits.ts`: wzorzec współdzielonych limitów API/UI
- `src/lib/supabase.ts:5-21`: klient z sesją użytkownika (bez service role)
- `src/middleware.ts:5,12-38`: ochrona tras, `locals.user`
- `src/types.ts:3-30`: `IngredientOption`, `RecipeIngredient`, `RecipeKind`, `Recipe`
- `src/components/hooks/usePantryMatch.ts:36-124`: fetch, type guardy, polskie komunikaty błędów
- `src/components/pantry/TagInput.tsx`, `PantryMatch.tsx`, `src/components/auth/ServerError.tsx`: wzorce tokenowe
- `src/components/AppHeader.astro:7-21`, `src/layouts/AppLayout.astro:12-19`: miejsce na link i nową stronę
- `scripts/check-ui-literals.mjs:11-22`: `CLEAN_FILES`
- `.github/workflows/ci.yml:45-66`, `scripts/smoke.mjs:84,96`: asercje liczby przepisów

## Architecture Insights

- **Warstwy:** endpoint w `src/pages/api/` parsuje i waliduje, a potem woła serwis w `src/lib/services/recipes.ts`. Serwis mapuje snake_case i camelCase. Czysta logika (dopasowanie, limity) siedzi w `src/lib/` bez Supabase i ma testy Vitest.
- **Autoryzacja w bazie:** RLS plus jawne granty niezależne od domyślnych grantów projektu (`create_recipes.sql:27-29`). Ten sam styl pasuje do insertu, łącznie z grantami kolumnowymi, jeśli plan chce ograniczyć, co `authenticated` może ustawić. Na przykład bez `id` i `created_at`.
- **Service role** żyje tylko w skryptach uruchamianych przez człowieka (`scripts/match-keys.ts:1-4`). Worker zawsze działa jako zalogowany użytkownik.

## Historical Context (from prior changes)

- `context/archive/2026-10-12-recipe-catalog-contract/plan.md:41`: autorstwo `author_id` i rola admina przesunięte do S-05–S-07 (**nadal aktualne**; S-05 wprowadza `author_id`, admin pozostaje w S-07, `roadmap.md:192`).
- `context/archive/2026-10-12-recipe-catalog-contract/plan.md:44`: „opis” z PRD = kroki (**nadal aktualne**; schemat nie ma kolumny opisu).
- `context/archive/2026-10-12-recipe-catalog-contract/reviews/plan-review.md:73`: walidacja kształtu składnika po stronie piszących (**nadal aktualne**, `recipe-data-contract.md:129`).
- `context/archive/2026-10-12-first-pantry-match/plan.md:410`: S-05 musi wołać `computeMatchKeys` (**nadal aktualne co do wymogu**). Komentarz migracji, że klucze wypełnia „only the service role” (`add_recipe_match_keys.sql:3`), jest **częściowo nieaktualny**: dla zapisu z Workera rolą może być tylko `authenticated`.
- `context/archive/2026-10-12-first-pantry-match/reviews/impl-review.md:84-89`: `keysFitIngredients` jako siatka bezpieczeństwa; poprawność rankingu nadal zależy od piszących (**nadal aktualne**).
- `context/archive/2026-10-17-recipe-count/change.md:20`: produkcja nie ma przepisów (**stan na 2026-10-17**; nie zweryfikowany w bazie produkcyjnej w tym badaniu).

## Related Research

- `context/archive/2026-10-12-first-pantry-match/research.md`: reguła dopasowania i klucze.
- `context/archive/2026-10-12-recipe-catalog-contract/`: kontrakt danych przepisu.

## Open Questions

Decyzje dla `/10x-plan` (nie rozstrzygnięte w dokumentach):

1. **`author_id` nullable z `default auth.uid()` czy `NOT NULL`?** Nullable nie psuje seeda ani CI. `NOT NULL` wymaga użytkownika w seedzie. W obu wariantach polityka insert blokuje `null` i cudze id dla `authenticated`.
2. **`on delete` przy usunięciu konta:** `set null` (przepis zostaje we wspólnej bazie) czy `cascade`?
3. **Klucze dopasowania przy POST:** zapis `match_keys` i `match_keys_version` przez `authenticated` (grant kolumnowy, ryzyko sfałszowanych kluczy w §3) czy zostawienie `null` i poleganie na fallbacku plus ręcznym `npm run match-keys`? Trzeba też poprawić komentarz migracji, który mówi o „only the service role”.
4. **Pole `product` w formularzu:** osobne pole „produkt do dopasowania” czy wyprowadzanie z `name`? Kontrakt wymaga małych liter bez marki (`recipe-data-contract.md:38-40`).
5. **Limity wejścia:** liczba składników, zamienników i kroków, długości tekstów. Trzymane w jednym pliku dla API i UI (lesson o CPU).
6. **Gdzie zapisać decyzję F-02 o autorce jako autorze.** Proponowane miejsca: `docs/reference/recipe-data-contract.md` albo wpis F-02 w roadmapie. To dokumenty foundation i reference, więc tylko za zgodą autorki.
7. **Nazwa zmiany:** folder `add-recipe` a Change ID `add-recipe-manually` w roadmapie (`roadmap.md:161`). Wystarczy to odnotować przy zamykaniu.
