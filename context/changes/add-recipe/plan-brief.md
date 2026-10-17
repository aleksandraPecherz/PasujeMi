# S-05 Ręczne dodawanie przepisu — Plan Brief

> Full plan: `context/changes/add-recipe/plan.md`
> Research: `context/changes/add-recipe/research.md`

## What & Why

Zalogowany użytkownik dodaje przepis do wspólnej bazy. Wymagane są nazwa, kroki i składniki z opcjonalnymi zamiennikami. Czas, porcje, rodzaj i makro są opcjonalne. Przepis od razu widzi po zapisie.

Zmiana wprowadza też autorstwo przepisu. Na nim S-06 oprze regułę „tylko autor edytuje i usuwa”, egzekwowaną w bazie.

## Starting Point

`public.recipes` jest dziś tylko do odczytu dla zalogowanych: nie ma kolumny autora, grantu insert ani polityki zapisu. Jest `GET /api/recipes` i lista na `/` (sortowana po nazwie, po 10). Klucze dopasowania S-03 mogą być `null`, bo wtedy fallback liczy je przy każdym żądaniu.

## Desired End State

Na stronie `/recipes/new` (link „Dodaj przepis” w nagłówku) użytkownik wypełnia formularz z dynamicznymi składnikami, zamiennikami i krokami. Po zapisie widzi komunikat, kafelek swojego przepisu oraz przyciski „Dodaj kolejny” i „Przejdź do listy”.

Baza zapisuje go jako autora. RLS odrzuca wstawienie cudzego autora, `null` i kluczy dopasowania.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Kolumna autora | `author_id` nullable, `default auth.uid()`; polityka insert `author_id = auth.uid()` | Seed i CI działają bez użytkowników, a `authenticated` i tak nie wstawi `null` ani cudzego id. | Plan (decyzja 1) |
| Usunięcie konta | FK `on delete set null` | Przepis zostaje we wspólnej bazie. | Plan (decyzja 2) |
| Klucze dopasowania | Puste przy insercie od użytkownika, bez grantu | Nie da się wstawić sfałszowanych kluczy. Fallback i `npm run match-keys` liczą je poprawnie. Wymóg z planu S-03 przestaje dotyczyć S-05. | Plan (decyzja 3) |
| `product` składnika | Domyślnie nazwa małymi literami, edytowalne; ten sam default w walidatorze | Zgodne z kontraktem i reguła działa też dla klientów API. | Plan (decyzja 4) |
| Limity | Jeden plik `src/lib/recipes/limits.ts` (np. ≤ 40 składników, ≤ 5 zamienników, ≤ 30 kroków, body ≤ 100 KB) | Ograniczają CPU na żądanie (lesson) i są wspólne dla API i formularza. | Plan (decyzja 5) |
| Autor przepisów z F-02 | Autorka aplikacji; import (service role) wpisuje jej UUID w `author_id` jawnie | Pod service role `auth.uid()` jest `null`. | Plan (decyzja 6) |
| Po zapisie | Kafelek `RecipeTile` + „Dodaj kolejny” / „Przejdź do listy” | Lista sortuje po nazwie, więc przekierowanie na `/` często nie pokazałoby przepisu. | Plan |
| Testy | Vitest walidatora + krok RLS w CI (PostgREST) + smoke POST | Reguła autorstwa jest sprawdzana po stronie danych, nie tylko przez endpoint. | Plan |
| Walidacja | Ręczny walidator w `src/lib/recipes/validate.ts`, bez zod | Zgodnie z konwencją repo, jedno źródło reguł i komunikatów dla API i UI. | Research |
| Kształt API | JSON camelCase (`Recipe` bez `id`), `201 { recipe }`, `400 { error, issues }` | Lustro odczytu i wzorzec `fetch` z wyspy spiżarki. | Research |

## Scope

**In scope:**

- migracja z `author_id`, kolumnowym grantem insert i polityką;
- `POST /api/recipes`;
- wspólne limity i walidator z testami;
- strona `/recipes/new` z formularzem i stanem sukcesu;
- link w nagłówku;
- komponenty shadcn `label`, `textarea` i `checkbox`;
- kitchen sink, `CLEAN_FILES`, krok CI i kroki smoke;
- aktualizacja kontraktu danych.

**Out of scope:**

- edycja i usuwanie (S-06), admin (S-07);
- liczenie kluczy przy zapisie;
- zmiany listy na `/`, strona szczegółów (S-02);
- `authorId` w `Recipe`;
- autor w seedzie;
- duplikaty nazw, szkice formularza;
- zod.

## Architecture / Approach

Formularz (wyspa React i hook `useRecipeForm`) waliduje lokalnie tym samym `parseRecipeInput` i wysyła JSON. `POST /api/recipes` po kolei:
1. sprawdza typ i rozmiar body;
2. waliduje;
3. woła `createRecipe(supabase, locals.user.id, recipe)` w serwisie.

Serwis wstawia wiersz jako `authenticated` i zwraca `Recipe`. Baza egzekwuje autora (polityka) i dozwolone kolumny (grant kolumnowy).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migracja autorstwa i insertu | `author_id`, grant, polityka, test RLS w CI, kontrakt | Krok CI nie może zostawić wierszy, bo zepsułby `length == 5` i `updated 5`. |
| 2. Wspólne limity i walidator | `limits.ts`, `validate.ts` + testy | Komunikaty i ścieżki błędów muszą pasować do pól formularza. |
| 3. POST /api/recipes | Serwis, handler, smoke | Smoke musi wstawiać po kroku `total === 4`, z „jogurtem”, który `exclude=jogurt` ukrywa. |
| 4. Formularz, strona i nawigacja | `/recipes/new`, link w nagłówku, stan sukcesu, kitchen sink | Dynamiczne listy, fokus i dostępność na telefonie, bez literałów kolorów. |

**Prerequisites:** F-01 i S-01 (gotowe). Lokalny Supabase (Docker) do `db reset` i smoke.
**Estimated effort:** ~3–4 sesje w 4 fazach. Faza 4 jest największa.

## Open Risks & Assumptions

- **Fallback kluczy rośnie z liczbą dodań.** Każdy przepis dodany przez użytkownika jest liczony przy każdym `/api/recipes/match`, dopóki ktoś nie uruchomi `npm run match-keys`. Przy ~1000 przepisach i 10 ms CPU trzeba okresowo uruchamiać sync. Do sprawdzenia przez `npm run bench:match`.
- **Plan F-02 musi przejąć decyzję 6.** Import ma wpisywać UUID autorki jawnie, inaczej przepisy z importu będą miały `author_id = null`, a S-06 nie da jej ich edytować.
- **Change ID się różni.** W roadmapie jest `add-recipe-manually`, a folder to `add-recipe`. Synchronizacja roadmapy nie znajdzie wpisu, więc trzeba to odnotować przy archiwizacji.
- **Stan produkcji to założenie.** Brak przepisów na produkcji przyjęto z `recipe-count/change.md:20`, nie zweryfikowano w bazie.

## Success Criteria (Summary)

- Zalogowany użytkownik dodaje przepis z zamiennikami w formularzu i od razu widzi jego kafelek. Przepis jest na liście i jest dopasowywany w spiżarce.
- Baza przypisuje autora z sesji i odrzuca cudzego autora, `null` oraz zapis kluczy dopasowania, co potwierdza CI.
- Za duże albo błędne przepisy dostają czytelny błąd 400 lub 413, zanim zaczną zużywać CPU.
