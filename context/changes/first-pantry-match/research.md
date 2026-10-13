---
date: 2026-10-12T00:00:00+02:00
researcher: Aleksandra Pęcherz (z Claude Code)
git_commit: 2778edd
branch: master
repository: 10xdevs (PasujeMi)
topic: "Przepisy, składniki i zamienniki dziś; źródło danych listy; miejsce dopasowania spiżarki; wpięcie stemmera Snowball"
tags: [research, codebase, recipes, pantry-match, stemmer, supabase, cloudflare-workers]
status: complete
last_updated: 2026-10-12
last_updated_by: Aleksandra Pęcherz (z Claude Code)
---

# Research: pierwsze dopasowanie ze spiżarki (S-03)

**Date**: 2026-10-12 (godzina niezarejestrowana)
**Researcher**: Aleksandra Pęcherz (z Claude Code)
**Git Commit**: 2778edd (badanie na drzewie roboczym; pliki `src/`, `supabase/`, `docs/` bez lokalnych zmian według `git status`)
**Branch**: master
**Repository**: 10xdevs (PasujeMi)

## Research Question

Jak dziś zapisane są przepisy, składniki i zamienniki (migracje, seed, typy z F-01), skąd lista przepisów pobiera dane, gdzie w kodzie i stronach podpiąć dopasowanie spiżarki, i jak wpiąć stemmer z `context/changes/first-pantry-match/external-research.md` zgodnie z konwencjami projektu.

## Summary

- **Przechowywanie.** W `supabase/migrations/` jest jedna migracja i jedna tabela `public.recipes`. Składniki i zamienniki to tablica `jsonb` w kolumnie `ingredients`. Element ma postać `{ name, product, amount, unit, substitutes: [...] }`, a zamiennik ma ten sam kształt bez `substitutes` (`supabase/migrations/20261012120000_create_recipes.sql:9-12`, `docs/reference/recipe-data-contract.md:35-45`).
  - Kluczem dopasowania jest `product`: małe litery, bez marki.
  - Kontrakt jawnie oddaje S-03 „rozpoznawanie odmian i ogólne/szczegółowe” (`recipe-data-contract.md:99`).
  - W `supabase/` i `src/` nie ma tabel spiżarki, produktów stałych ani wykluczeń, nie ma indeksów na `ingredients` ani rozszerzeń (`pg_trgm`, `unaccent`).
  - Typy TS są pisane ręcznie (`src/types.ts:3-31`). Nie ma typów generowanych z bazy.
- **Źródło danych listy.** Strony z listą przepisów jeszcze nie ma: `src/pages/index.astro:1-10` to statyczny placeholder.
  - Przepisy czyta wyłącznie `GET /api/recipes` (`src/pages/api/recipes/index.ts:21-43`) przez serwis `listRecipes` (`src/lib/services/recipes.ts:41-62`).
  - Serwis sortuje po `name` i `id`, stronicuje przez `range` i pobiera o jeden wiersz więcej, żeby ustalić `hasMore`. Nie stosuje żadnych filtrów.
- **Miejsce dopasowania (wniosek).** Dopasowanie warto podzielić na trzy części:
  - czysty moduł TS (normalizacja i ocena) w `src/lib/`,
  - funkcję serwisu obok `listRecipes`, która pobiera cały katalog (≤ ~1000 wierszy), ocenia, odrzuca wykluczone i sortuje po %, a stronicuje dopiero po ocenie,
  - stronę `src/pages/index.astro` z wyspą React do tagów.

  Ten sam widok listy i kafelek przepisu dzieli z S-02 (`context/foundation/roadmap.md:130`).

- **Stemmer.** Pakiet `snowball-stemmers-js@3.1.2` nie jest zainstalowany w repo; sprawdzono kopię w scratchpadzie.
  - Nie ma pola `exports`, więc głęboki import `lib/polish-stemmer.js` jest dozwolony.
  - Nie ma typów `.d.ts`, pliku LICENSE ani `"type": "module"`, choć `lib/*.js` mają składnię ESM.
  - **Publiczne API to `stem(input)` i pole `stemWord`.** Metody `stemWords` z external-research.md:93 w tym pakiecie nie ma.
  - Wpięcie wymaga deklaracji modułu (`.d.ts`) albo wydzielonego, wyłączonego z lintu katalogu na skopiowany kod.
  - Bundlowanie w workerd jest niezweryfikowane.
- **Konflikt do rozstrzygnięcia w planie.** `context/foundation/infrastructure.md:170` każe robić dopasowanie w Postgresie (`pg_trgm`), a nie w JS przy każdym żądaniu, ze względu na limit 10 ms CPU na planie Free.
  - External research wybrał wariant B, czyli JS w Workerze (`external-research.md:74`), i zostawił otwarte pytanie o liczenie kluczy przy zapisie (`external-research.md:115`).
  - W `infrastructure.md` nie ma późniejszego zapisu, który by ten konflikt rozstrzygał.

## Detailed Findings

### 1. Schemat przepisów (F-01)

- Jedna migracja: `supabase/migrations/20261012120000_create_recipes.sql`. Jedyne `create table` w `supabase/` to `public.recipes` (wyszukiwanie `create table|create index|extension` w `supabase/**/*.sql`).
- Kolumny (`:5-23`):
  - `id uuid`
  - `name text`
  - `steps text[]`, co najmniej 1 element (`:8`)
  - `ingredients jsonb`, CHECK: niepusta tablica (`:12`); kształt elementu opisuje tylko komentarz (`:9-11`)
  - `prep_time_min`, `servings`
  - `kinds text[]`, ograniczone do 4 wartości (`:15-16`)
  - `kcal`, `protein_g`/`carbs_g`/`fat_g numeric(6,1)` (`:18-21`)
  - `created_at`
- RLS jest włączone (`:25`). Grant i polityka obejmują wyłącznie `select` dla `authenticated` z `using (true)` (`:28-36`). Nie ma polityk zapisu ani dostępu `anon`.
- Indeksy: w migracji poza PK nie ma żadnych. Żadna migracja nie tworzy rozszerzeń. `supabase/config.toml:36` → Postgres 17.
- Kontrakt (`docs/reference/recipe-data-contract.md`):
  - `:3`: źródło prawdy dla F-02, **S-03** i S-05.
  - `:38`: `product` to „ogólny produkt do dopasowania (małe litery, bez marki)”.
  - `:45`: zamienniki nie mają własnych `substitutes`.
  - `:99`: normalizacja `product` usuwa marki, a inne określenia zostają („mleko 1,5%”).
  - `:100`, `:119`: duplikaty składników (np. sól dwa razy) pozostają osobnymi pozycjami.
  - `:129`: ani baza, ani typy TS nie walidują kształtu elementu w czasie działania.
  - W kontrakcie nie ma pojęć składnika opcjonalnego ani priorytetu zamienników. Regułę „dowolny zamiennik wystarcza” wprowadza dopiero PRD (`context/foundation/prd.md:120`).

### 2. Seed i realny kształt danych

- `supabase/seed.sql` zawiera 5 instrukcji `insert` (`:6`, `:37`, `:58`, `:83`, `:111`), po jednym przepisie. To dane tylko do lokalnego środowiska i CI.
- Wartości `product` bywają bardzo szczegółowe:
  - `"płatki owsiane górskie"` (`seed.sql:22`)
  - `"jogurt naturalny 2%"` (`:28`)
  - `"borówki amerykańskie, świeże lub mrożone"` (`:30`)

  Tag „borówki” lub „jogurt” musi więc trafiać w produkt, który ma więcej tokenów. To ta sama mechanika zawierania tokenów, co przy wykluczeniach (wniosek; zob. pytanie otwarte o semantykę posiadanych w `external-research.md:116`).

- Zamienniki w seedzie mają pełny kształt, np. ser gouda → „ser mozzarella kulka” (`seed.sql:48`).
- Skala docelowa: 76 przepisów w xlsx (`recipe-data-contract.md:83,87`), do ok. 1000 według roadmapy (`roadmap.md:143`).

### 3. Typy i serwis

- `src/types.ts:3-14`: `IngredientOption { name; product; amount: number|null; unit: string|null }`, a `RecipeIngredient` rozszerza go o `substitutes: IngredientOption[]`. `Recipe` jest w camelCase (`:18-31`).
- `src/lib/services/recipes.ts`:
  - prywatne `RecipeRow` (`:6-19`) i mapper `toRecipe` (`:25-39`),
  - `numeric` przychodzi jako string (`:15-23`),
  - `listRecipes(supabase, { limit, offset })` (`:41-62`): klient Supabase jest wstrzykiwany jako pierwszy argument, błąd z Supabase jest rzucany dalej bez zmian (`:54-56`), a wynik ma postać `{ recipes, hasMore }`.
- `src/lib/supabase.ts`: klient bez generyka `Database`.

### 4. Skąd lista pobiera dane

- `src/pages/api/recipes/index.ts`:
  - `limit` (domyślnie 10, maks. 50) i `offset` parsuje ręcznie napisany regex (`:9-18`, `:22-28`); Zod nie jest używany.
  - Klient powstaje przez `createClient(context.request.headers, context.cookies)` (`:30`).
  - Błędy wracają jako `{ error: "<kod>" }` ze statusem 400, 503 lub 500 (`:27`, `:32`, `:41`).
  - 401 dla `/api/*` zwraca middleware (`src/middleware.ts:34-36`).
- Konsumenci endpointu w sprawdzonym zakresie: `scripts/smoke.mjs:47,66-75` (oczekuje ≥ 5 przepisów). W `src/` żadna strona ani komponent go nie wywołuje.
- `src/pages/index.astro:1-10` pokazuje tylko nagłówek „Wypełnij spiżarkę, żeby zobaczyć dopasowanie”. Nie ma frontmattera z zapytaniem ani wyspy.
- UI do wykorzystania:
  - `src/components/ui/button.tsx` (jedyny komponent shadcn),
  - `src/components/auth/FormField.tsx`,
  - `src/layouts/AppLayout.astro`.
- Brakuje katalogu `src/components/hooks/` oraz komponentów tagów, chipów, kafelków i list.
- Wyspy: tylko `SignInForm` i `SignUpForm` z `client:load` (`src/pages/auth/signin.astro:15`, `signup.astro:15`). Wzorzec `Astro.url.searchParams.get(...)` we frontmatterze występuje w `signin.astro:6` i `signup.astro:6`.

### 5. Punkty wpięcia dopasowania (wnioski)

- **Logika.** Czysty, testowalny moduł bez zależności od Supabase, np. `src/lib/matching/*.ts` albo `src/lib/pantry-match.ts`. Konwencje:
  - nazwy kebab-case, eksporty nazwane, bez `default` (`src/lib/auth-errors.ts:16`, `src/lib/utils.ts:4`),
  - typy domenowe (`PantryInput`, `MatchedRecipe` z % i statusem każdego składnika: mam / brak informacji) w `src/types.ts`.
- **Serwis.** Nowa funkcja obok `listRecipes` w `src/lib/services/recipes.ts`, w tym samym stylu: wstrzyknięty klient, `throw error`. Musi pobrać cały katalog bez `range`, a potem ocenić, odfiltrować, posortować i stronicować. Nie da się tego zrobić filtrem PostgREST na `listRecipes`, bo sortowanie po nazwie i stronicowanie w SQL są niezgodne z sortowaniem po %.
- **Transport.** Dwie zgodne z repo drogi:
  - (A) Frontmatter `index.astro` czyta parametry z URL i przekazuje wynik jako propsy do wyspy `client:load`.
  - (B) Wyspa woła endpoint: rozszerzony `GET /api/recipes` albo nowy `src/pages/api/recipes/match.ts`.

  PRD wymaga wpisywania tagów na żywo (`prd.md:38`) i zostawia „posiadane” wyłącznie w sesji (`prd.md:89`), a S-04 doda później stałe i wykluczenia zapamiętane między sesjami. To przemawia za tym, żeby wyspa przekazywała listy w żądaniu. Wybór należy do planu.

- **Wspólny widok z S-02.** `roadmap.md:130` każe uzgodnić jeden kafelek przepisu. Bez filtrów PRD wymaga 10 przepisów bez % i doładowania (`prd.md:65`, FR-005), czyli tego, co już daje `listRecipes`.
- **S-04.** Trwałe produkty stałe i wykluczenia wymagają nowej migracji z RLS „tylko właściciel” (AGENTS.md Hard Rules). Roadmapa przypisuje to S-04, nie S-03 (`roadmap.md:49`).

### 6. Wpięcie stemmera zgodnie z konwencjami

- **Pakiet** (kopia w scratchpadzie, `snowball-stemmers-js/package.json`):
  - wersja 3.1.2, `"main": "index.js"`, `"files": ["lib","index.js"]`, licencja BSD-3-Clause,
  - nie ma pól `exports` ani `type`.
- **Pliki stemmera:**
  - `lib/polish-stemmer.js:155` → `import B from './base-stemmer.js'`, `:157` → `export default class extends B`.
  - API: `stem(input)` (`:298`) i pole klasy `stemWord = this.stem` (`:304`).
  - `lib/base-stemmer.js:3` → `export default class BaseStemmer`.
  - **`stemWords` nie występuje w żadnym z dwóch plików** (grep). Twierdzenie z `external-research.md:93` jest w tym punkcie nieaktualne; pozostała część opisu importu jest zgodna z kodem.
- `index.js` pakietu korzysta z `fs`/`path`/`require`, więc się do niego nie importujemy (zgodnie z `external-research.md:37`).
- **TypeScript.**
  - `tsconfig.json:2` rozszerza `astro/tsconfigs/strict`, który włącza `allowJs` i nie włącza `checkJs`.
  - Bez `.d.ts` głęboki import z `node_modules` da prawdopodobnie TS7016 w `astro check` oraz typ `any`, czyli błędy `no-unsafe-*` z `strictTypeChecked` (`eslint.config.js:17`).
  - Wniosek: potrzebna jest deklaracja `declare module "snowball-stemmers-js/lib/polish-stemmer.js"` w `src/*.d.ts`. Jedyny dziś plik deklaracji to `src/env.d.ts`.
  - Tego nie uruchamiano.
- **Kopia w repo.**
  - Nie ma precedensu kodu zewnętrznego w repo ani plików `.js` w `src/`.
  - `baseConfig` nie ma filtra `files` i obejmuje każdy plik JS. Wygenerowany kod (etykiety, `break lab0`, nieotypowane tablice `among`) prawdopodobnie wygeneruje wiele błędów lintu.
  - Precedens wyłączenia to `scriptsConfig` z `disableTypeChecked` dla `scripts/**/*.mjs` (`eslint.config.js:73-78`) oraz `globalIgnores([".claude/"])` (`:83`).
  - Kopia wymaga więc wpisu w `globalIgnores` i w `.prettierignore` (dziś: `.claude/`, `.10x-cli.json`, `CLAUDE.md`), deklaracji typów albo `// @ts-nocheck`, oraz dołączenia tekstu licencji BSD-3 Snowball, bo pakiet nie zawiera pliku LICENSE.
- **Bundlowanie.**
  - `astro.config.mjs:11-16`: `output: "server"`, `cloudflare()` bez opcji, w `vite` tylko plugin Tailwind.
  - `wrangler.jsonc:4-6`: `nodejs_compat`.
  - Konfiguracja niczego nie blokuje, ale to, czy Vite/workerd potraktuje ESM-owy `.js` w pakiecie bez `"type": "module"` jako ESM, **nie zostało sprawdzone**. `infrastructure.md:171` każe sprawdzić każdą nową zależność w `npm run dev` (workerd).
- **Testy.**
  - `package.json` nie ma skryptu `test` ani runnera, a CI go nie uruchamia (`.github/workflows/ci.yml:18-22`).
  - AGENTS.md: „Add a runner before writing tests”. Roadmapa wymaga przypadków testowych z PRD dla wykluczeń (`roadmap.md:143`).
  - Wniosek: S-03 musi dodać runner, np. Vitest, oraz krok w CI.
- **lint-staged** (`package.json:57-64`) obejmuje `*.{ts,tsx,astro}` i `*.{json,css,md}`. Plik `.js` nie jest poprawiany przy commicie, ale `npm run lint` w CI go sprawdza.

## Code References

- `supabase/migrations/20261012120000_create_recipes.sql:5-36`: tabela `recipes`, CHECK na `ingredients`, RLS tylko do odczytu
- `supabase/config.toml:36`: Postgres 17
- `supabase/seed.sql:6,37,58,83,111`: 5 przepisów testowych; `:22,28,30,48`: przykłady szczegółowych `product`
- `docs/reference/recipe-data-contract.md:35-45,99`: kształt składnika i podział odpowiedzialności z S-03
- `src/types.ts:3-31`: `IngredientOption`, `RecipeIngredient`, `Recipe`
- `src/lib/services/recipes.ts:41-62`: `listRecipes`, jedyne zapytanie o przepisy
- `src/pages/api/recipes/index.ts:9-43`: endpoint listy z ręcznie parsowanymi parametrami i kodami błędów
- `src/pages/index.astro:1-10`: placeholder, miejsce na listę i spiżarkę
- `src/middleware.ts:5,30-36`: brama logowania, 401 dla `/api/*`
- `eslint.config.js:16-17,73-78,80-83`: reguły z kontrolą typów, wyjątek dla skryptów, globalne ignorowanie
- `astro.config.mjs:11-16`, `wrangler.jsonc:4-6`: adapter Cloudflare, `nodejs_compat`
- `context/foundation/infrastructure.md:118-119,170-171`: limit 10 ms CPU, zalecenie dopasowania w SQL, test zależności na workerd

## Architecture Insights

- Warstwy: strona lub endpoint → serwis z wstrzykniętym `SupabaseClient` → typy w `src/types.ts`. Walidacja jest ręczna, a błędy mają postać `{ error: "snake_code" }`. Nie ma `locals.supabase`; każdy handler sam tworzy klienta (`src/env.d.ts:1-5`).
- Pozycje przepisu, w tym zamienniki, są zagnieżdżone w `jsonb`, a baza nie zna ich kształtu. Normalizacja i dopasowanie muszą więc działać w TS albo na kolumnie lub tabeli pochodnej dodanej w nowej migracji.
- Klucze (rdzenie tokenów) można liczyć:
  - przy każdym żądaniu, co kosztuje CPU Workera,
  - przy zapisie przepisu, co wymaga nowej kolumny lub migracji i przeliczenia przy zmianie słownika synonimów.

  Zapis przepisów jeszcze nie istnieje (S-05, F-02), więc dziś jedynym źródłem kluczy byłby seed i migracja.

## Historical Context (from prior changes)

- `context/archive/2026-10-12-recipe-catalog-contract/plan.md:42`: logika „tego samego składnika” należy do S-03; F-01 dostarcza tylko `product`. Nadal aktualne (`recipe-data-contract.md:99`).
- `context/archive/2026-10-12-recipe-catalog-contract/plan.md:277`: wydajność < 1 s przy 1000 przepisów należy do S-03. Nadal aktualne (`roadmap.md:143`).
- `context/archive/2026-10-12-recipe-catalog-contract/plan.md:27`: wzorzec `src/lib/services/` + `src/types.ts`. Potwierdzony w kodzie (`src/lib/services/recipes.ts`).
- `context/foundation/infrastructure.md:170`: zalecenie „matching in Postgres (`pg_trgm`), not per-request JS”. Częściowo sprzeczne z `external-research.md:72-76`. Research podtrzymuje fakty techniczne: brak polskiego stemmera w PG 17 i niemożność dodania słownika na Supabase. Planowi zostaje mitygacja ryzyka CPU: pomiar w Workers Logs albo przejście na plan Paid, co `infrastructure.md:170` już przewiduje jako ścieżkę awaryjną.
- `context/foundation/lessons.md`: dwie lekcje, obie dotyczą zadań przy PR i sprawdzeń HTTP w CI. Jeśli plan doda smoke lub CI dla dopasowania, ma zastosowanie reguła „najpierw status i typ odpowiedzi, potem treść”.

## Related Research

- `context/changes/first-pantry-match/external-research.md`: badanie zewnętrzne (wybór wariantu B: Snowball + odległość edycyjna + synonimy w TS).
- Inne pliki `research.md` w `context/changes/**` ani `context/archive/**` nie występują.

## Open Questions

1. **Gdzie liczyć klucze:** przy żądaniu w Workerze czy przy zapisie (kolumna lub tabela pochodna)? Wpływa to na zgodność z `infrastructure.md:170` i na limit 10 ms CPU. Niezmierzone.
2. **Transport:** frontmatter i parametry URL czy wyspa i endpoint? Dotyczy też współdzielenia widoku z S-02.
3. **Stemmer:** zależność npm z głębokim importem i `.d.ts` czy kopia w repo z licencją, wyłączeniem z lintu i Prettiera? Bundlowanie na workerd jest niezweryfikowane i wymaga próby `npm run dev` oraz `npm run build`.
4. **Runner testów** (Vitest?) i krok w CI. Wymagany przez roadmapę dla przypadków wykluczeń.
5. Pytania produktowe przeniesione z `external-research.md:113-118`:
   - semantyka posiadanych przy szczegółowych `product` (zawieranie tokenów czy pełna zgodność),
   - próg odległości edycyjnej dla krótkich rdzeni,
   - gdzie trzymać słownik synonimów.
