# S-06 Autor edytuje i usuwa swój przepis — Plan Brief

> Full plan: `context/changes/author-edits-own-recipe/plan.md`
> Research: `context/changes/author-edits-own-recipe/research.md`

## What & Why

Autor edytuje i usuwa wyłącznie przepisy, które sam dodał (FR-009, issue #8). Reguła „tylko autor” musi trzymać się w bazie, także przy bezpośrednim wywołaniu PostgREST. Edycja składników nie może zostawić starych kluczy dopasowania, bo przepuściłyby wykluczony składnik.

## Starting Point

`authenticated` ma dziś tylko `select` i kolumnowy `insert` (S-05). Formularz S-05 obsługuje tylko dodawanie (`POST`, „Dodaj przepis”). Strona szczegółów nie zna autora, a `matchRecipes` ufa zapisanym kluczom, jeśli zgadza się ich kształt.

## Desired End State

Autor widzi na `/recipes/[id]` przyciski „Edytuj” i „Usuń”. Edycja otwiera wypełniony formularz S-05 i po zapisie wraca na szczegóły. Usunięcie wymaga potwierdzenia w oknie dialogowym i kończy się na `/`. Inni użytkownicy nie widzą przycisków, `/edit` daje im 404, a baza odrzuca ich zapisy. Zmiana składników zeruje klucze dopasowania.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Klucze po edycji | Trigger `before update` zeruje `match_keys` i wersję przy zmianie `ingredients`; brak grantu na te kolumny | Reguła działa też z pominięciem API i nie wymaga service role w Workerze | Research / Plan |
| Kształt API | `PUT /api/recipes/[id]` z pełnym przepisem, ten sam walidator i limity co `POST` | Walidator i tak zwraca pełny przepis | Plan |
| Wyścig ze starymi kluczami | Akceptujemy bez kodu | Okno to czas jednego żądania | Plan |
| Usuwanie | shadcn `alert-dialog`, potem `location.assign("/")` | Komponent z biblioteki, nowa nawigacja odświeża listę | Plan |
| Cudzy / nieistniejący przepis | Serwis robi `.select()`, pusty wynik → 404 | PostgREST przy odmowie RLS zwraca 0 wierszy, nie błąd | Research / Plan |
| Test RLS w CI | Krok na wierszu, który sam wstawia i usuwa (z `trap`) | Nie psuje kroków liczących 5 wierszy | Research / Plan |
| Kafelek po „Wstecz” (bfcache) | Prowadzi do 404, akceptujemy | Kosmetyka, brak zmian w stanie listy | Plan |
| `author_id = null` | Bez edycji do S-07 | Poza zakresem roli autora | Research / Plan |
| Gdzie czytać autora | Tylko `getRecipe` zwraca `{ recipe, authorId }`; `Recipe`, lista, `/match` bez zmian | UUID autorów nie trafiają do list | Plan |
| Po zapisie edycji | Przekierowanie na `/recipes/[id]` | Wynik widać od razu, bez nowego stanu komponentu | Plan |
| Testy na bazie | Tylko lokalny Supabase z Dockera; migracja na produkcję ręcznie przed merge | `.dev.vars` wskazuje produkcję | Plan |

## Scope

**In scope:**
- migracja `20261018120000`: granty update (kolumnowy) i delete, polityki `_own`, trigger zerujący klucze;
- krok CI dla update i delete na PostgREST;
- `readJsonBody` wspólny dla `POST` i `PUT`; `getRecipe` z autorem; `updateRecipe` i `deleteRecipe`; `PUT` i `DELETE /api/recipes/[id]`;
- `/recipes/[id]/edit`, formularz S-05 w trybie edycji, przyciski autora z `alert-dialog`, kitchen sink, `CLEAN_FILES`;
- kroki smoke, akapit „Dostęp (RLS)” w kontrakcie danych.

**Out of scope:** admin (S-07); `authorId` w `Recipe`; `PATCH`; kod przeciw wyścigowi kluczy i bfcache; zmiany w stanie listy; ekran „Zmiany zapisane”.

## Architecture / Approach

Granicę trzyma baza: RLS `author_id = auth.uid()` na update i delete, a kolumnowy grant bez `author_id`, `id` i kluczy. Trigger przenosi edytowany przepis do istniejącej ścieżki „przelicz klucze per żądanie”. API tylko przekłada pusty wynik na 404. UI używa formularza S-05 (`useRecipeForm({ recipe })`, cel `PUT`). Przyciski autora to wyspa w nazwanym slocie statycznego `RecipeDetails`, wyświetlana, gdy `authorId === user.id`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Baza i testy RLS w CI | Migracja + krok CI | Założenia o PostgREST i triggerze (0 wierszy zamiast błędu, trigger bez grantu) sprawdza dopiero CI |
| 2. Serwis i API | `PUT`/`DELETE /api/recipes/[id]`, testy | Zmiana zachowania `POST` przy wydzielaniu `readJsonBody` |
| 3. UI | Strona edycji, przyciski autora, dialog | Odtworzenie `productEdited` i zamienników w formularzu |
| 4. Smoke i dokumentacja | Kroki smoke, kontrakt danych, migracja na produkcji | Smoke odpalony przypadkiem na produkcji |

**Prerequisites:** S-05 (autorstwo, `POST`, formularz) — done; Docker z lokalnym Supabase.
**Estimated effort:** ~2–3 sesje w 4 fazach.

## Open Risks & Assumptions

- Zakładamy, że PostgREST przy odmowie z `using` zwraca `[]`, a trigger `BEFORE` zeruje kolumny bez grantu. Oba założenia sprawdza krok CI w fazie 1.
- Każda edycja składników dokłada przepis do puli przeliczanej per żądanie (limit 200). `npm run match-keys` ją opróżnia.
- Migracja musi trafić na produkcję przed merge, bo inaczej `PUT`/`DELETE` dostaną 42501 i zwrócą 500.

## Success Criteria (Summary)

- Autor edytuje i usuwa swoje przepisy z poziomu strony szczegółów; nikt inny nie może tego zrobić ani przez UI, ani przez PostgREST.
- Przepis z nowym, wykluczonym składnikiem znika z dopasowania od razu po edycji.
- CI (krok RLS, testy, smoke) jest zielone, a baza po testach ma 5 przepisów z seeda.
