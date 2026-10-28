# Soft Modern — spiżarka, lista przepisów i ilustracje (#61) Implementation Plan

## Overview

Główny ekran w Soft Modern v2: mobilny pasek spiżarki z arkuszem edycji i panel na komputerze, kafelki M10A z ilustracją, stany pusty/ładowania/błędu w nowym stylu oraz niewielki zestaw statycznych ilustracji SVG ze stałym przypisaniem do przepisów. Bez zmian algorytmu dopasowania, uprawnień, trwałości spiżarki, szczegółów i formularza przepisu.

## Current State Analysis

- `PantryMatch.tsx` renderuje jedną sekcję z trzema `TagInput` (siatka 3 kolumn) i listę kafelków w siatce 2 kolumn; stan tagów, `applied`, ładowanie, snapshot i zapis spiżarki żyją w `usePantryMatch.ts`. `applied` istnieje, ale nie jest wystawiony.
- `RecipeTile.tsx` pokazuje tytuł, procent i listę wszystkich składników jako tagi, w tym zamienniki (`(zamiennik: …)`, `→ użyj: …`, przekreślenie wykluczonego głównego składnika).
- Przepis nie ma pola ilustracji (`RECIPE_COLUMNS` w `src/lib/services/recipes.ts`, `Recipe` w `src/types.ts`). `toRecipeValues` (wspólne dla `POST` i `PUT`) nie zawiera kolumn spoza formularza, więc nowa kolumna nie jest przez `PUT` nadpisywana.
- `data/recipes.xlsx` (lokalnie) ma 76 przepisów; importer `scripts/import-recipes.ts` jest idempotentny po nazwie (`normalizeRecipeName`), z podglądem domyślnie i `--write`, klucz serwisowy tylko w shellu.
- Tokeny, `Button`/`Input`/`Badge`, motyw i wzorce (popover, `ThemeLink`, `check:ui`) z #60 (`656c7f7`).

## Desired End State

Na telefonie: pasek „Twoja spiżarka · N mam · N stałych · N wykluczam · Edytuj” (lub karta „Co masz dziś w domu?” przy pustej spiżarce), arkusz z zakładkami, komunikat o niezastosowanych filtrach. Na komputerze: panel spiżarki obok listy. Kafelki zgodne z M10A (ilustracja, tytuł do 3 wierszy, procent przy czasie, „Masz X z Y”, „Brakuje: …”). W obu motywach, z ilustracjami przypisanymi do istniejących przepisów i obrazem zastępczym dla reszty.

### Key Discoveries:

- Nazwa kolumny `illustration` i format klucza (`^[a-z][a-z0-9-]*$`) wystarczą w bazie; zestaw dozwolonych kluczy żyje tylko w kodzie, więc nowa ilustracja to plik SVG i jedna linia, bez migracji.
- `addTag` rozstrzyga duplikaty przez `trim` + `toLocaleLowerCase("pl")`; ten sam klucz posłuży do porównania filtrów (jedna normalizacja).
- Wymuszony otwarty modalny `<dialog>` jako panel odpada (decyzja autorki): edytor jest jednym elementem, a CSS decyduje, czy to panel, czy arkusz.
- Rozkład 76 przepisów daje 12 ilustracji (nie 9): `illustration-map.md`; próbki stylu: `preview/index.html`.
- Lokalny Supabase działa (Docker, baza `127.0.0.1:54322`), więc migrację można sprawdzić lokalnie przez `npx supabase migration up --local`. `supabase status` pokazuje też powiązany projekt zdalny, dlatego żadnych poleceń `--linked` ani `db push` w tej zmianie.
- Układ ma się przełączać w CSS, nie w stanie React: `useMediaQuery` z wartością serwerową dawałby przeskok telefon → komputer przy hydracji.

## What We're NOT Doing

- Zmian algorytmu dopasowania, API, RLS, trwałości spiżarki, szczegółów i formularza przepisu (formularz nie dostaje pola ilustracji; nowy przepis ma obraz zastępczy).
- Automatycznego doboru obrazków w aplikacji, wybieraka, generowania AI, gestu przeciągania i obsługi Wstecz arkusza.
- Migracji ani zapisów w zdalnej bazie w tej zmianie; `db push` i `--write` skryptu przypisania wykonuje autorka po akceptacji.
- Linku „Jak to działa?” (brak strony docelowej).
- Wyjątków w `check:ui` dla komponentów widoku.

## Implementation Approach

Najpierw dane (kolumna, serwis, test, że `PUT` jej nie kasuje), potem ilustracje i kafelek (widoczny efekt na istniejącej liście), potem przebudowa spiżarki, na końcu jednorazowe przypisanie istniejących przepisów i domknięcie. Kod z `illustration` w `RECIPE_COLUMNS` **wymaga migracji**: bez kolumny zapytanie kończy się błędem. Fallback na obraz zastępczy obsługuje tylko `NULL` i nieznany lub pusty klucz, nie brak kolumny. Dlatego zmiana zapytań w serwisie wchodzi dopiero po migracji lokalnej, a na środowiskach zdalnych kolejność to zawsze migracja, potem wdrożenie kodu. Ilustracje to osobne pliki SVG w `public/illustrations/` (talerz i danie, przezroczyste tło, te same w obu motywach); dekoracyjne tło rysunku daje kontener z nowymi tokenami `--illus-green|yellow|pink|lilac` (jasny i ciemny), osobnymi od semantycznych `--have`, `--staple`, `--exclude`, `--warning`. Literały kolorów są tylko w plikach SVG, których `check:ui` nie skanuje (nie jest to wyjątek dla komponentu).

## Critical Implementation Details

- **Zamienniki w kafelku (semantyka bez zmian):** składnik ze statusem `have` jest liczony do „Masz X z Y”; gdy `via` jest ustawione, pojawia się osobna linia „Zamiennik: {via} zamiast {nazwa}” (do 2 + „+N”). Do „Brakuje:” trafiają tylko składniki `unknown`; jeśli główny jest wykluczony, wpis to „użyj: {via} (zamiast {nazwa})”, a bez `via` nazwa z `sr-only` „(wykluczony)”. Zachowane `sr-only` „— mam” / „(wykluczony)”. „Brakuje” nie może sugerować zakupu składnika, który użytkownik ma jako zamiennik.
- **Edytor spiżarki, CSS najpierw:** jeden element w DOM (jedne `id`, jeden stan `TagInput`), więc tekst w polach i aktywna zakładka nie giną przy zamknięciu ani zmianie szerokości, a tagi i tak żyją w `usePantryMatch`. Od `md` CSS robi z niego statyczny panel obok wyników; poniżej `md` jest ukryty, a pasek podsumowania (`md:hidden`) otwiera go jako arkusz. Układ zależy wyłącznie od klas Tailwind, bez `matchMedia` w renderze, więc nie ma przeskoku przy hydracji.
- **Arkusz:** element z atrybutem `popover="auto"` otwierany przez `showPopover()`; Esc i klik w tło (`::backdrop`) zamykają go natywnie, fokus wraca na przycisk, który go otworzył, a przycisk zamknięcia wywołuje `hidePopover()`. Zakładki Mam/Stałe/Wykluczam są widoczne tylko poniżej `md` (nieaktywne sekcje `max-md:hidden`, nadal zamontowane); na `md+` widać trzy sekcje jedna pod drugą. Jedyny JS poza tym: `matchMedia("(min-width: 48rem)")` w efekcie wywołuje `hidePopover()`, gdy okno rośnie do komputera przy otwartym arkuszu (element z warstwy wierzchniej nie wróciłby sam do układu). To arkusz niemodalny; własny mechanizm pułapki fokusu odpada.
- **Porównanie filtrów:** funkcja czysta porównująca trzy listy jako zbiory kluczy `tagKey` (trim + `toLocaleLowerCase("pl")`), niezależnie od kolejności; porównywane są listy wpisane z `applied` (stan po udanym żądaniu). Staple i wykluczenia zapisują się od razu, ale wyniki zostają stare, więc pasek „zmienione” dotyczy też ich. Po błędzie żądania `applied` się nie zmienia, więc pasek zostaje.
- **Migracja:** plik w `supabase/migrations/` jest tworzony, ale nie stosowany zdalnie; lokalnie tylko jeśli lokalny Supabase działa.

## Faza 1: Kolumna ilustracji i serwis

### Overview

Trwałe przypisanie ilustracji do przepisu bez zmiany `POST`/`PUT`.

### Changes Required:

#### 1. Migracja i seed

**File**: `supabase/migrations/<timestamp>_add_recipe_illustration.sql`, `supabase/seed.sql`

**Intent**: Dodać `illustration text null` do `public.recipes` z `check` na format klucza; RLS i polityki bez zmian (kolumna dziedziczy). Seed: wartości dla 5 lokalnych przepisów. Migracja jest stosowana tylko lokalnie (`npx supabase migration up --local`, lokalny Supabase działa); zdalnie nigdy w tej zmianie.

**Contract**: kolumna opcjonalna, `illustration ~ '^[a-z][a-z0-9-]*$'` (długość ≤ 40); brak `grant`/polityk — istniejące wystarczają. Kolejność w fazie: migracja lokalna, dopiero potem zmiana `RECIPE_COLUMNS`.

#### 2. Typ, serwis, kontrakt

**File**: `src/types.ts`, `src/lib/services/recipes.ts`, `docs/reference/recipe-data-contract.md`

**Intent**: `Recipe.illustration?: string | null`; `illustration` w `RECIPE_COLUMNS` i w mapowaniu wiersza; `toRecipeValues` bez zmian (pole nie jest zapisywane przez API). Opis kolumny w kontrakcie.

#### 3. Test niezmienności przy edycji

**File**: `src/lib/services/recipes.test.ts`

**Intent**: Jeden test: `updateRecipe` i `createRecipe` nie wysyłają `illustration`, a edycja zachowuje wartość wiersza.

### Success Criteria:

#### Automated Verification:

- Test serwisu przechodzi: `npx vitest run src/lib/services/recipes.test.ts`
- Typy przechodzą: `npx astro check`

#### Manual Verification:

- Migracja przejrzana przez autorkę (nic nie zastosowano zdalnie)

---

## Faza 2: Ilustracje i kafelek M10A

### Overview

Zestaw SVG, tła i nowy kafelek, od razu widoczne na obecnej liście.

### Changes Required:

#### 1. Assety i tokeny

**File**: `public/illustrations/*.svg` (12 plików wg `illustration-map.md`), `src/styles/global.css`

**Intent**: Proste SVG (talerz i danie z góry, szablon kwadratowy, czytelne w 56 px) w stylu makiet; trzy próbki (`kanapka-jajko`, `slodka-miska`, `talerz`) są już w `preview/` do akceptacji stylu przed narysowaniem reszty; tokeny `--illus-*` w obu motywach jako osobna grupa od kolorów semantycznych.

**Contract**: każdy plik `viewBox` kwadratowy, tło przezroczyste, bez tekstu.

#### 2. Wybór ilustracji

**File**: `src/lib/recipes/illustrations.ts`, `src/components/recipes/RecipeIllustration.tsx`

**Intent**: Mapa klucz → ton tła, rozwiązanie nieznanego/pustego klucza na obraz zastępczy (ikona sztućców na neutralnym tle, token); komponent renderuje kontener z tłem i `<img alt="" loading="lazy">` o stałych wymiarach (88 px kafelek, 56 px gęsta lista, jeśli użyta).

#### 3. Kafelek

**File**: `src/components/recipes/RecipeTile.tsx`, `src/lib/recipes/format.ts`

**Intent**: Układ M10A: ilustracja po lewej (też na komputerze), tytuł `line-clamp-3` na pełną szerokość, procent (100% pełny, pozostałe jasny) przy „czas · porcje”, „Masz X z Y składników” / „Masz wszystkie składniki”, „Brakuje: …” (3 wpisy + „+N”, 2 poniżej 360 px), bez filtrów „N składników”. Zachowana semantyka zamienników (patrz Critical Implementation Details); cały kafelek nadal jest linkiem.

#### 4. Szkielet i kitchen sink

**File**: `src/components/pantry/PantryStates.tsx`, `src/components/dev/KitchenSink.tsx`

**Intent**: Szkielet w kształcie kafelka (M08); w kitchen sinku kafelki: z dopasowaniem 100%, długą nazwą, długą listą braków, z zamiennikiem, bez filtrów, obraz zastępczy, ciemny motyw.

### Success Criteria:

#### Automated Verification:

- Lint i `check:ui` przechodzą: `npm run lint && npm run check:ui`
- Typy przechodzą: `npx astro check`

#### Manual Verification:

- Kafelki zgodne z M10A i D05 na 320, 390 px i komputerze, w obu motywach
- „Brakuje” nie sugeruje zakupu składnika dostępnego jako zamiennik

---

## Faza 3: Spiżarka — pasek, arkusz, panel, stany

### Overview

Nowy układ ekranu głównego i rozróżnienie filtrów wpisanych od zastosowanych.

### Changes Required:

#### 1. Logika porównania

**File**: `src/lib/pantry/filters.ts`, `src/lib/pantry/filters.test.ts`, `src/components/hooks/usePantryMatch.ts`

**Intent**: Wspólny `tagKey` (używany także przez `addTag`) i `filtersChanged(lists, applied)` jako zbiory kluczy; hook wystawia `applied`. Test: kolejność, wielkość liter, spacje, dodanie/usunięcie, sekcje niezależne.

#### 2. Układ i edytor

**File**: `src/components/pantry/PantryMatch.tsx`, `PantrySummary.tsx`, `PantryEditor.tsx`, `TagInput.tsx`

**Intent**: Pasek podsumowania i karta pustej spiżarki (tylko poniżej `md`), jeden `PantryEditor` z zakładkami Mam/Stałe/Wykluczam i licznikami (poniżej `md`, jako `popover`) albo z trzema sekcjami (od `md`, jako panel), przełączany klasami CSS; `TagInput` bez zmiany własności stanu, z przyciskiem „Dodaj” i tagami w stylu M07. Komunikat „Spiżarka zmieniona · wyniki jeszcze nie odświeżone” z „Zastosuj filtry” i „Edytuj”, podtytuł „Wyniki dla poprzedniej spiżarki”.

#### 3. Stany i układ strony

**File**: `PantryStates.tsx`, `ServerError.tsx`, `src/pages/index.astro`, `src/layouts/AppLayout.astro`, `src/components/AppHeader.astro`

**Intent**: Brak wyników z listą aktywnych wykluczeń i „Zmień wykluczenia” (otwiera zakładkę Wykluczam), błąd z „Spróbuj ponownie”, ostrzeżenia o limicie i zapisie jako bursztynowe bloki (token `--warning`/`--staple`), nagłówki i podtytuły z M05/M06, spinner „Wczytywanie przepisów…”; przy ponownym zastosowaniu stara lista tylko przygasa. Szerszy kontener tylko na stronie głównej (prop przekazany do nagłówka, żeby się wyrównały).

### Success Criteria:

#### Automated Verification:

- Test filtrów przechodzi: `npx vitest run src/lib/pantry/filters.test.ts`
- Lint, `check:ui`, typy przechodzą: `npm run lint && npm run check:ui && npx astro check`

#### Manual Verification:

- Telefon: pasek, arkusz, zamknięcie krzyżykiem/Esc/tłem, produkty i tekst w polu zostają, „Zastosuj filtry” odświeża listę
- Pierwszy render na komputerze od razu pokazuje panel, bez błysku układu telefonu
- Komunikat o zmienionej spiżarce widać po dodaniu produktu i znika po zastosowaniu
- Komputer: panel jak D02/D05; zmiana szerokości okna nie gubi tagów ani tekstu
- Stany pusty, ładowania i błędu w obu motywach

---

## Faza 4: Przypisanie istniejących przepisów i domknięcie

### Overview

Jednorazowe, sprawdzone przypisanie 76 przepisów i końcowe kontrole.

### Changes Required:

#### 1. Mapa i skrypt

**File**: `scripts/illustration-map.json`, `scripts/assign-illustrations.ts`, `package.json` (skrypty `assign-illustrations`, `assign-illustrations:write`)

**Intent**: Mapa z zaakceptowanego `illustration-map.md`. Skrypt w stylu importera: `--check` offline porównuje nazwy z `data/recipes.xlsx` z mapą (komplet, bez nadmiarowych, znane klucze); tryb domyślny to podgląd względem bazy (klucz serwisowy tylko w shellu); `--write` aktualizuje tylko wiersze z pustą `illustration`, po `normalizeRecipeName`, atomowo, i zgłasza niedopasowane nazwy.

**Contract**: bez nadpisywania istniejących przypisań; nie uruchamiany przeciw zdalnej bazie przez agenta.

#### 2. Reguły i runbook

**File**: `scripts/check-ui-literals.mjs`, `AGENTS.md`, `docs/reference/recipe-data-contract.md`, `context/changes/soft-modern-pantry-recipes/runbook.md`

**Intent**: Nowe pliki widoków do `CLEAN_FILES`; reguła o ilustracjach (assety w `public/illustrations/`, tła tokenami, nowy przepis = obraz zastępczy); runbook: `db push --dry-run` → `db push` (decyzja autorki) → `assign-illustrations` podgląd → `--write`.

### Success Criteria:

#### Automated Verification:

- Mapa zgodna z arkuszem: `npm run assign-illustrations -- --check`
- Końcowy zestaw (raz): `npm run lint`, `npm run check:ui`, `npx astro check`, `npm test`, `npm run build`

#### Manual Verification:

- Autorka akceptuje mapę przepis → ilustracja przed zapisem
- Autorka uruchamia migrację i `--write` na wybranym środowisku
- Akceptacja wizualna całości: telefon i komputer, jasny i ciemny motyw

---

## Testing Strategy

### Unit Tests:

- `filtersChanged` (kolejność, wielkość liter, spacje) — istotna zmiana zachowania.
- `updateRecipe`/`createRecipe` nie wysyłają `illustration`.

### Manual Testing Steps:

1. Telefon 320/390 px: pusta spiżarka → dodanie produktów w arkuszu → zamknięcie → pasek i komunikat → „Zastosuj filtry”.
2. Komputer: panel, zmiana szerokości okna przy otwartym arkuszu i wpisanym tekście.
3. Przepis z zamiennikiem i z wykluczonym głównym składnikiem: czytelne „użyj: …”, bez wrażenia braku.
4. Błąd sieci (tryb offline): „Spróbuj ponownie”.

## Performance Considerations

SVG ładowane leniwie, ze stałymi wymiarami (bez przesunięć układu); 12 małych plików, cache jak inne assety. Bez zmian zapytań i dopasowania.

## Migration Notes

Kolumna jest opcjonalna dla danych (`NULL` = obraz zastępczy), ale kod pobierający `recipes.illustration` **wymaga migracji**: bez kolumny każde zapytanie o przepisy kończy się błędem. Kolejność na każdym środowisku: migracja → wdrożenie kodu → przypisanie. Lokalnie migracja jest stosowana w fazie 1 przed zmianą zapytań; zdalnie decyzję o `db push` podejmuje autorka.

## References

- Mockups: `.tmp-style-review/` (M05–M09, M10A, M19, M23b, D02, D05, „Ilustracje”); issue-2.md
- Fundament: `context/changes/soft-modern-foundation-auth/` (commit 656c7f7), `palette.md`
- Przypisanie: `context/changes/soft-modern-pantry-recipes/illustration-map.md`
- Importer: `scripts/import-recipes.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Kolumna ilustracji i serwis

#### Automated

- [x] 1.1 Test serwisu: create i update nie wysyłają illustration
- [x] 1.2 Typy przechodzą

#### Manual

- [ ] 1.3 Autorka przegląda migrację (zastosowana tylko lokalnie)

### Phase 2: Ilustracje i kafelek M10A

#### Automated

- [x] 2.1 Lint i check:ui przechodzą
- [x] 2.2 Typy przechodzą

#### Manual

- [ ] 2.3 Kafelki zgodne z M10A i D05 w obu motywach
- [ ] 2.4 Brakuje nie sugeruje zakupu składnika dostępnego jako zamiennik

### Phase 3: Spiżarka — pasek, arkusz, panel, stany

#### Automated

- [x] 3.1 Test porównania filtrów przechodzi
- [x] 3.2 Lint, check:ui i typy przechodzą

#### Manual

- [ ] 3.3 Telefon: pasek, arkusz, zamykanie i zachowanie wpisanych danych
- [ ] 3.4 Komunikat o niezastosowanych filtrach działa
- [ ] 3.5 Komputer: panel i zmiana szerokości okna
- [ ] 3.6 Stany pusty, ładowania i błędu w obu motywach

### Phase 4: Przypisanie istniejących przepisów i domknięcie

#### Automated

- [x] 4.1 Mapa zgodna z arkuszem (assign-illustrations --check)
- [x] 4.2 Lint, check:ui, typy, testy i build przechodzą

#### Manual

- [x] 4.3 Autorka akceptuje mapę przepis → ilustracja
- [ ] 4.4 Autorka stosuje migrację i przypisanie na wybranym środowisku
- [ ] 4.5 Autorka akceptuje całość wizualnie
