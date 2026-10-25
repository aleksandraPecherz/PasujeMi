---
title: "PasujeMi — N-9: zgodność match_keys ze składnikami (niezmiennik i granica spójności)"
created: 2026-10-24
type: refactor-plan
---

# N-9: zgodność `match_keys` ze składnikami

- **HEAD:** `9500dbd355c6dbbe90b157b63fcfa09675c9215b` (`master`); w working tree tylko nieśledzone pliki `context/domain/`.
- **Status dokumentu:** plan do przyszłej realizacji. Nic nie zaimplementowano, niczego nie uruchomiono. Skuteczności wariantu nie deklaruję przed weryfikacją z §6.
- **Powiązania:** `01-domain-distillation.md` — N-1 (blokada przy wykluczeniu wszystkich opcji), N-9 (świeżość kluczy), R-04 (kompletność listy), U-02 (uruchamianie skryptu). ID według pierwotnej numeracji raportu.
- **Oznaczenia dowodów:** K = odczyt kodu, A = odczyt asercji, U = wynik uruchomienia (brak dla wszystkich pozycji).

## 1. Diagnoza

### 1.1 Reguła chroniona

**N-1 (biznesowa):** przepis odpada, gdy wszystkie opcje choć jednego składnika są wykluczone (`context/foundation/prd.md:122`, decyzja właścicielki D-01). Decyzję podejmuje czysta funkcja na kluczach (`src/lib/matching/rank.ts:139-156`, `:169`).

**N-9 (techniczna, chroni N-1):** klucze użyte do oceny przepisu muszą odpowiadać jego bieżącym `ingredients` i bieżącej wersji reguły (`MATCH_KEYS_VERSION`, `src/lib/matching/keys.ts:10`). Jeśli klucze opisują inne składniki, N-1 jest liczone dla innego przepisu niż ten, który użytkownik zobaczy.

### 1.2 Obecne mechanizmy (K)

| Mechanizm                                                    | Gdzie                                                                                                                                                                                                                                | Co zapewnia                                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kolumny `match_keys`, `match_keys_version`                   | `supabase/migrations/20261013120000_add_recipe_match_keys.sql:6-8`                                                                                                                                                                   | dane pochodne przechowywane obok przepisu                                                                                                                           |
| Brak prawa zapisu kluczy dla `authenticated`                 | `20261017120000_add_recipe_author_and_insert.sql:20-21`, `20261018120000_add_recipe_update_delete_own.sql:11-12` (uprawnienia kolumnowe)                                                                                             | użytkownik ani admin przez API nie zapisze kluczy                                                                                                                   |
| Trigger zerujący klucze przy zmianie składników              | `20261018120000…sql:33-50` (warunek `old.ingredients is distinct from new.ingredients`, `:49`)                                                                                                                                       | edycja składników unieważnia klucze                                                                                                                                 |
| Programowy zapisujący klucze istniejących wierszy            | `scripts/match-keys.ts:30-48` (rola service, ręcznie: `:2-4`)                                                                                                                                                                        | wypełnia klucze dla wierszy pustych lub z inną wersją (`UPDATE` po odczycie)                                                                                        |
| Importer zapisuje klucze nowych wierszy                      | `scripts/import-recipes/sheet.ts:45-60` (`toInsertRow`: `match_keys = computeMatchKeys(recipe.ingredients)`, `match_keys_version = MATCH_KEYS_VERSION`), wstawienie: `scripts/import-recipes.ts:181` (rola service, ręcznie: `:1-6`) | klucze powstają z tych samych `ingredients` i trafiają razem z nimi w jednym `INSERT` nowego wiersza — to nie jest opisany w §1.3 wyścig odczyt–edycja–aktualizacja |
| Przeliczanie w żądaniu                                       | `src/lib/services/recipes.ts:249-264` (do `MAX_RECOMPUTED_RECIPES = 200`, `src/lib/recipes/limits.ts:23`)                                                                                                                            | wiersze bez aktualnych kluczy są oceniane kluczami policzonymi w pamięci                                                                                            |
| Pominięcie wiersza, który „odświeżył się” między zapytaniami | `recipes.ts:266-275`                                                                                                                                                                                                                 | brak oceny starymi kluczami w obrębie jednego żądania                                                                                                               |
| Kontrola kształtu na stronie wyniku                          | `recipes.ts:222-227`, `:314-318`                                                                                                                                                                                                     | klucze o innej liczbie składników/zamienników są przeliczane                                                                                                        |

### 1.3 Potencjalna droga naruszenia (analiza statyczna, nieodtworzona)

1. Skrypt odczytuje porcję wierszy z pustymi lub nieaktualnymi kluczami: `select("id, ingredients")` (`scripts/match-keys.ts:30-39`).
2. Zanim zapisze klucze danego wiersza, użytkownik (autor lub admin) zmienia jego `ingredients` przez `PUT /api/recipes/[id]`. Trigger zeruje klucze (`20261018120000…sql:46-50`).
3. Skrypt zapisuje `match_keys = computeMatchKeys(<stare ingredients>)` i `match_keys_version = 2`, filtrując wyłącznie po `id` (`match-keys.ts:45-48`). Zapis nie zmienia `ingredients`, więc trigger nie zadziała (`…sql:49`).
4. `matchRecipes` uznaje klucze za aktualne, bo wersja się zgadza (`recipes.ts:268-269`).
5. Jeśli edycja zachowała kształt (ta sama liczba składników i zamienników, ale np. inny `product`), kontrola kształtu go nie wykryje (`recipes.ts:222-227`). Przepis jest oceniany kluczami starych składników, więc wykluczenie nowego produktu nie zadziała.
6. Stan utrzymuje się do kolejnej zmiany składników albo podbicia wersji.

**Warunki wystąpienia:**

- skrypt uruchomiony na tej samej bazie;
- edycja składników tego samego wiersza w oknie między odczytem porcji a zapisem tego wiersza (porcja do 1000 wierszy zapisywana sekwencyjnie, `match-keys.ts:9`, `:44-53`);
- edycja zachowująca kształt (w przeciwnym razie zadziała kontrola z `recipes.ts:314-318`, ale tylko dla wiersza na bieżącej stronie wyniku).

### 1.4 Wcześniej zauważone ryzyko

To nie jest nowe odkrycie. Przegląd implementacji S-03 opisał wyścig skryptu „between read and update” (`context/archive/2026-10-12-first-pantry-match/reviews/impl-review.md:84`). Poprawka objęła kształt kluczy i wartość `null` (`:85`, `:90`). Przegląd sam zaznaczył, że poprawność rankingu dla edytowanych wierszy nadal zależy od zapisujących (`:88`), a odcisk składników obok wersji „would close the gap fully; not evaluated” (`:89`). Trigger zerujący klucze doszedł później (migracja `20261018120000`). Ten dokument dotyczy przypadku, który został po obu zmianach: skrypt kontra edycja przez API.

### 1.5 Ograniczenia diagnozy

- Wyścig nie był odtwarzany. Kolejność i skutek wynikają z odczytu kodu i komentarzy migracji (K).
- Repo opisuje ręczne uruchamianie skryptu na produkcji (`context/archive/2026-10-12-first-pantry-match/plan.md:408`; `impl-review.md:66`, `:156`). Workers Builds go nie uruchamia (`context/deployment/deploy-plan.md:158-162`), a CI uruchamia go tylko na lokalnej bazie (`.github/workflows/ci.yml:41-44`, `:378-387`). Faktyczne uruchomienia, ich częstość i nakładanie się z edycjami są **nieznane** (U-02).
- Asercje: `src/lib/services/recipes.test.ts:511-530` sprawdza wyścig między dwoma zapytaniami jednego żądania; `:532-548` — klucze o innym kształcie. Asercji dla kluczy w bieżącej wersji, o tym samym kształcie, ale starej treści nie znaleziono. Testy serwisu używają atrapy klienta (nie sprawdzają triggera ani uprawnień).
- Semantyka współbieżności Postgresa opisana w §3 to wiedza ogólna, niezweryfikowana na tej bazie.

## 2. Kontrakt (doprecyzowanie)

**K-1 (zgodność w każdym zatwierdzonym stanie wiersza):** przechowywane klucze mogą być **nieobecne** (`null`) lub **nieaktualne** (inna wersja). W żadnym zatwierdzonym stanie wiersza klucze z bieżącą wersją nie mogą jednak opisywać innych `ingredients` niż `ingredients` tego samego stanu. Równoważnie: zapis kluczy z bieżącą wersją może zostać zatwierdzony tylko wtedy, gdy składniki, z których je policzono, są nadal składnikami wiersza w chwili zatwierdzenia.

**K-2 (poprawność rankingu względem migawki):** decyzja o przepisie w `matchRecipes` zapada na kluczach zgodnych z `ingredients` **jednego zatwierdzonego stanu wiersza**, odczytanego w tym żądaniu: kluczach przechowywanych (zgodnych z K-1) albo policzonych w żądaniu z odczytanych `ingredients`. K-2 **nie obiecuje**, że wynik odzwierciedla edycję zatwierdzoną już po odczycie — ta pojawi się w kolejnym żądaniu. Naruszenie K-2 (ocena kluczami innego stanu niż odczytany) może pokazać przepis z wykluczonym składnikiem (N-1) albo dać zły procent.

_Uwaga (istniejące, poza zakresem planu):_ `matchRecipes` czyta klucze (`recipes.ts:235-242`) i pełne wiersze strony (`recipes.ts:292-299`) osobnymi zapytaniami, więc w obrębie jednego żądania ranking może wynikać ze stanu sprzed edycji, a kafelek pokazać składniki po edycji. Kontrola kształtu (`recipes.ts:314-318`) łagodzi to tylko przy zmianie kształtu. To przejściowe (jedno żądanie) i odrębne od trwałego naruszenia K-1 opisanego w §1.3.

**K-3 (kompletność listy) — osobna sprawa:** przepis bez aktualnych kluczy może zostać pominięty w rankingu, gdy przekroczono `MAX_RECOMPUTED_RECIPES` (`recipes.ts:244-247`; R-04). To błąd kompletności, nie poprawności, i nie jest przedmiotem tego planu. Uwaga: każdy wariant, który odrzuca zapis kluczy, zostawia wiersz z `null` — zwiększa obciążenie K-3, ale nie narusza K-1/K-2.

## 3. Porównanie minimalnych zabezpieczeń

Zapisujący `match_keys` (stan obecny): (a) `scripts/match-keys.ts` (rola service); (b) ręczny SQL rolą service/postgres (np. SQL Editor, wzorzec z `docs/reference/recipe-data-contract.md:32-39` dla innej tabeli); (c) kroki CI na lokalnej bazie (`ci.yml:143`, `:262`); (d) importer — klucze nowych wierszy liczone z wstawianych `ingredients` i zapisywane razem z nimi w jednym `INSERT` (`scripts/import-recipes/sheet.ts:45-60`, `scripts/import-recipes.ts:181`); nie aktualizuje istniejących wierszy, więc nie dotyczy go sekwencja z §1.3. Zapisujący `ingredients`: `PUT /api/recipes/[id]` (autor/admin, przez RLS), `POST` (nowe wiersze, klucze `null`), importer (nowe wiersze, z kluczami — jw.), ręczny SQL.

**Odrzucone jako niewystarczające:**

- warunek `match_keys is null` przy zapisie skryptu — po edycji trigger i tak zostawia `null`, więc warunek przechodzi;
- warunek na `match_keys_version` — z tego samego powodu (`null` po edycji);
- „dodać transakcję w skrypcie” bez warunku — transakcja wokół `update … where id` nie zmienia tego, że zapis nie porównuje stanu odczytanego z bieżącym.

|                       | **V1 — zapis warunkowy na danych**                                                                                                                                                                                                                                                      | **V2 — zapis warunkowy na rewizji składników**                                                                                                                                                                                          | **V3 — odcisk składników sprawdzany przy odczycie**                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idea                  | Skrypt zapisuje klucze tylko, gdy `ingredients` w bazie są równe tym, które odczytał                                                                                                                                                                                                    | Baza utrzymuje licznik `ingredients_rev`, zwiększany przy każdej zmianie składników; skrypt zapisuje tylko przy niezmienionym liczniku                                                                                                  | Baza liczy odcisk bieżących `ingredients`; obok kluczy zapisuje się odcisk źródła; serwis używa kluczy tylko przy zgodności odcisków                                                                                                                                                              |
| Kto oblicza           | Skrypt: klucze. Baza: porównanie `jsonb = jsonb` (semantyczne)                                                                                                                                                                                                                          | Baza: licznik (trigger). Skrypt: klucze, odczytuje licznik razem ze składnikami                                                                                                                                                         | Baza: odcisk (kolumna generowana z `ingredients`). Skrypt: klucze + kopiuje odczytany odcisk. Serwis: porównanie                                                                                                                                                                                  |
| Co i kiedy sprawdzane | Przy zapisie: `where id = ? and ingredients = <odczytane>`                                                                                                                                                                                                                              | Przy zapisie: `where id = ? and ingredients_rev = <odczytany>`                                                                                                                                                                          | Przy odczycie w `matchRecipes`: `version` i `source_hash = ingredients_hash`                                                                                                                                                                                                                      |
| Współbieżność         | `UPDATE … WHERE` blokuje wiersz; w READ COMMITTED warunek jest ponownie sprawdzany na najnowszej wersji wiersza po zatwierdzeniu konkurencyjnej edycji → 0 wierszy                                                                                                                      | jw. — warunek na liczbie całkowitej                                                                                                                                                                                                     | Zapis bez warunku może zostawić klucze ze starym odciskiem, ale serwis ich nie użyje                                                                                                                                                                                                              |
| Obejmuje zapisujących | tylko zapisujących, którzy stosują warunek (dziś: nowa wersja skryptu); ręczny SQL i stara wersja skryptu — nie                                                                                                                                                                         | tylko zapisujących, którzy stosują filtr rewizji (baza utrzymuje rewizję, ale filtr stosuje zapisujący); ręczny SQL i stara wersja skryptu — nie. Trigger obejmuje każdego zapisującego `ingredients`                                   | zapisujących, którzy zapisują odcisk źródła, z którego faktycznie liczyli klucze. Wykrywa zapis bez odcisku lub ze starym odciskiem; **nie** wykryje zapisującego, który poda bieżący odcisk przy kluczach policzonych z czegoś innego — odcisk źródła nie dowodzi poprawności obliczonych kluczy |
| Zmiany                | skrypt; prawdopodobnie funkcja SQL (patrz ograniczenia)                                                                                                                                                                                                                                 | migracja: kolumna + rozszerzenie istniejącego triggera; skrypt (jeden filtr)                                                                                                                                                            | migracja: 2 kolumny; skrypt; serwis (zapytania i warunek świeżości); testy serwisu                                                                                                                                                                                                                |
| Ograniczenia          | Filtr PostgREST z całym JSON-em trafia do URL (do 40 składników × 6 opcji); semantyka `eq` dla `jsonb` w PostgREST niezweryfikowana. Bez tego: funkcja RPC z parametrem w treści — nowa funkcja wymaga `revoke … from public` i jawnego `grant` (`context/foundation/lessons.md:26-31`) | Nowa kolumna; trzeba potwierdzić, że `authenticated` nie może jej ustawić (uprawnienia kolumnowe tak sugerują: `20261017…sql:21`, `20261018…sql:12`) i że licznik nie rośnie przy edycji bez zmiany składników (warunek triggera `:49`) | Największy zakres; zależy od kanonicznej postaci tekstowej `jsonb` w funkcji odcisku; zmienia gorącą ścieżkę `matchRecipes` (budżet CPU, `lessons.md:19-24`)                                                                                                                                      |

## 4. Wybór: V2 (zapis warunkowy na rewizji składników)

**Uzasadnienie:**

- Zamyka zdiagnozowaną kolejność odczyt–edycja–zapis przy znanych zapisujących: użytkownicy nie zapisują kluczy (uprawnienia), każda zmiana składników przechodzi przez trigger, a jedyny programowy zapisujący, który aktualizuje klucze istniejących wierszy (skrypt), dostaje warunek. Importer zapisuje klucze tylko w `INSERT` nowych wierszy razem z ich `ingredients`.
- Wykorzystuje istniejący punkt prawdy — trigger, który już reaguje dokładnie na zmianę składników (`20261018…sql:46-50`). Licznik jest unieważniany w tym samym miejscu i w tej samej chwili co klucze.
- Warunek jest małą liczbą całkowitą: mieści się w filtrze PostgREST, bez funkcji RPC i bez przesyłania JSON-a.
- Nie zmienia `matchRecipes` ani gorącej ścieżki dopasowania.

**Czego V2 nie obejmuje:** V2 działa tylko przy współpracy wszystkich zapisujących klucze. Baza utrzymuje rewizję, ale filtr stosuje zapisujący. Nie chroni więc przed ręcznym SQL bez warunku ani przed **starą wersją skryptu** (kopia sprzed zmiany, np. na innym komputerze albo przebieg uruchomiony przed wdrożeniem). Twarde wymuszenie po stronie bazy (np. zapis rewizji źródła obok kluczy i warunek bazy wiążący ją z bieżącą rewizją) albo kontrola przy odczycie (V3) to decyzja otwarta (§7, D-N9-1), nie część minimalnego wariantu. Każda z tych opcji też zależy od tego, czy zapisujący podaje prawdziwe źródło.

### 4.1 Before / after (pseudokod, nie implementacja)

**Before** (`scripts/match-keys.ts:30-48`):

```ts
rows = select("id, ingredients").where(stale).order("id").limit(PAGE_SIZE)
for row of rows:
  update({ match_keys: computeMatchKeys(row.ingredients), match_keys_version: MATCH_KEYS_VERSION })
    .eq("id", row.id)                       // brak warunku na stan odczytany
  updated++
```

**After:**

```sql
-- migracja (szkic): licznik zmian składników
alter table public.recipes add column ingredients_rev integer not null default 0;
-- istniejący trigger recipes_reset_match_keys_on_ingredients (when old.ingredients is distinct from new.ingredients):
--   new.match_keys := null; new.match_keys_version := null;
--   new.ingredients_rev := old.ingredients_rev + 1;      -- nowa linia
-- bez nowych grantów dla authenticated (uprawnienia kolumnowe insert/update nie obejmują ingredients_rev)
```

```ts
// skrypt (szkic sygnatur)
interface IngredientsRow { id: string; ingredients: RecipeIngredient[]; ingredients_rev: number }

rows = select("id, ingredients, ingredients_rev").where(stale).order("id").limit(PAGE_SIZE)
for row of rows:
  written = update({ match_keys: computeMatchKeys(row.ingredients), match_keys_version: MATCH_KEYS_VERSION })
    .eq("id", row.id)
    .eq("ingredients_rev", row.ingredients_rev)   // zapis tylko, jeśli składniki się nie zmieniły
    .select("id")                                  // liczba faktycznie zapisanych wierszy
  if written.length === 1: updated++ else skipped++
print(`updated ${updated}, skipped ${skipped}`)
```

**Co oznacza `skipped`** (0 zapisanych wierszy) — nie zakładać ogólnie, że wiersz ma teraz `match_keys = null`:

- **Edycja składników** po odczycie: trigger podbił rewizję i wyzerował klucze. Wiersz ma `null`, chyba że w międzyczasie inny przebieg poprawnie przeliczył go już dla nowej rewizji — wtedy ma klucze zgodne z bieżącymi składnikami.
- **Usunięcie wiersza** po odczycie: wiersza nie ma.
- **Konkurencyjne poprawne przeliczenie bez edycji** (dwa przebiegi skryptu naraz) **nie** daje `skipped`: rewizja się nie zmienia (trigger reaguje tylko na zmianę `ingredients`, `20261018…sql:49`), więc oba zapisy przechodzą i zapisują te same klucze.

Wspólny niezmiennik po każdym wyniku: wiersz nie istnieje albo ma klucze `null`, w innej wersji, lub równe `computeMatchKeys(<bieżące ingredients>)` (K-1). Asercje w §6 sprawdzają ten niezmiennik, nie samo `null`.

### 4.2 Istniejące klucze zapisane ze starego źródła

Nowa kolumna nie naprawia kluczy, które już mogły zostać zapisane ze starych składników (wyścig sprzed zmiany). Po migracji wszystkie wiersze dostaną tę samą rewizję początkową, a klucze z bieżącą wersją będą traktowane jak dotąd. Potrzebny jest jednorazowy krok po wdrożeniu nowego skryptu, do wyboru (D-N9-7):

- **Audyt i selektywne unieważnienie:** rolą service porównać dla każdego wiersza przechowywane klucze z `computeMatchKeys(ingredients)`; rozbieżne wyzerować (`match_keys`, `match_keys_version` = `null`), zapisać liczbę rozbieżności (to też jedyny dostępny dowód, czy wyścig kiedykolwiek wystąpił).
- **Pełne unieważnienie:** wyzerować klucze wszystkich wierszy (np. w migracji) albo podbić `MATCH_KEYS_VERSION` (wymaga nowego wpisu fingerprintu w `keys.test.ts`, choć klucze się nie zmieniły), a potem uruchomić nowy skrypt. Do tego czasu ranking korzysta z przeliczania w żądaniu do limitu 200 wierszy (`limits.ts:23`); przy większym katalogu część przepisów zniknie z listy (K-3, R-04). Liczba przepisów na produkcji jest nieznana.

### 4.3 Kolejność wdrożenia

1. **Zakończyć wcześniejsze uruchomienia:** upewnić się, że żaden przebieg `match-keys` nie trwa (skrypt nie ma blokady ani śladu wykonania — `match-keys.ts:16-60`; potwierdza to tylko operator).
2. **Migracja** (kolumna `ingredients_rev` + linia w triggerze). Zgodna wstecz: stara wersja skryptu nadal działa, ale bez ochrony.
3. **Nowa wersja skryptu** w repo; wycofać lub zaktualizować każdą inną kopię skryptu z kluczem service role (stara kopia omija filtr).
4. **Jednorazowe naprawienie istniejących kluczy** (§4.2).
5. **Pierwsze uruchomienie nowego skryptu** i zapis wyniku (`updated`, `skipped`).
6. **Procedura** (faza 3): od tej chwili tylko nowa wersja skryptu.

Format wyjścia skryptu jest dziś asertowany w CI (`ci.yml:382-387`: `updated 5` / `updated 0`) — zmiana formatu to decyzja (D-N9-4).

### 4.4 Czy Przepis jest użyteczną granicą spójności

Tak: K-1 dotyczy jednego wiersza `recipes` i jego cyklu życia (utworzenie → edycje → podbicie wersji → synchronizacja kluczy). Granicę tę **egzekwuje baza**, nie obiekt w kodzie aplikacji: trigger (unieważnienie przy każdej zmianie składników), uprawnienia kolumnowe (kto może pisać klucze i licznik) oraz warunkowy `UPDATE` z blokadą wiersza (zapis tylko dla niezmienionej rewizji). Klasa agregatu ani repozytorium w TypeScript nie są uzasadnione: skrypt pisze rolą service bezpośrednio do bazy (`match-keys.ts:3`, `:22-24`), więc obiekt w Workerze by go nie objął.

## 5. Ograniczenia wybranego wariantu

- Wymaga współpracy zapisujących: nie chroni przed ręcznym SQL bez warunku, starą wersją skryptu ani przyszłym zapisującym, który pominie filtr rewizji (§4, §4.3).
- Nie naprawia kluczy zapisanych wcześniej ze starego źródła — wymaga jednorazowego kroku z §4.2.
- Wiersz pominięty z powodu edycji zostaje zwykle z `null` — poprawnie wg K-1, ale do następnego uruchomienia obciąża przeliczanie w żądaniu i limit z K-3.
- Nie naprawia R-04 (kompletność listy) ani R-06 (awaria odczytu spiżarki).
- Zachowanie warunkowego `UPDATE` przy współbieżności i nieobecność prawa zapisu licznika dla `authenticated` są założeniami do weryfikacji na rzeczywistej bazie (§6, faza 2).

## 6. Fazy przyszłej realizacji i weryfikacji

**Kryterium wykrycia regresji (wspólne):** po sekwencji odczyt → edycja zachowująca kształt (zmiana `product`) → zapis skryptu, przepis zawierający nowo wykluczony produkt **nie pojawia się** w wyniku dopasowania, a w bazie wiersz spełnia niezmiennik z §4.1 (klucze `null`, w innej wersji albo równe `computeMatchKeys(<bieżące ingredients>)`). Błąd migracji, kompilacji czy konfiguracji nie jest sygnałem regresji — sygnałem jest błędny wynik.

### Scenariusz referencyjny S (wspólny dla fazy 0 i fazy 2)

Ten sam scenariusz, z tymi samymi danymi i krokami, jest wykonywany przed zmianą (faza 0, HEAD) i po zmianie (faza 2). Różni się wyłącznie wersja kodu skryptu.

- **Fixture:** jeden przepis testowy `T` z **jednym składnikiem bez zamienników**, `product = "jogurt"`, oraz **bez aktualnych kluczy** (`match_keys = null`, `match_keys_version = null`), żeby skrypt go wybrał. Żaden inny przepis nie zawiera „jogurt” ani „orzechy” (żeby wynik dla `T` był jednoznaczny).
- **S1 — odczyt:** funkcja synchronizacji skryptu odczytuje porcję z `T` (rola service).
- **S2 — edycja w oknie:** przez punkt zaczepienia między odczytem a zapisem (kolejność wymuszona kodem testu, nie czasem) autor `T` zmienia `product` na `"orzechy"`, zachowując kształt: nadal jeden składnik, zero zamienników.
- **S3 — zapis:** funkcja synchronizacji kontynuuje zapis dla `T`.
- **S4 — stan bazy:** odczyt `match_keys`, `match_keys_version`, `ingredients` (i po zmianie `ingredients_rev`) wiersza `T`.
- **S5 — kontrola widoczności (bez blokującego wykluczenia):** `GET /api/recipes/match?have=orzechy&exclude=cukier` → `T` **widoczny** przed i po zmianie. Potwierdza, że `T` jest w katalogu i oceniany, więc jego brak w S6 wynika z wykluczenia, a nie z pominięcia (K-3).
- **S6 — próba blokująca:** `GET /api/recipes/match?have=sól&exclude=orzechy` → oczekiwane po zmianie: `T` **nieobecny**.

| Krok | Oczekiwanie przed zmianą (faza 0), jeśli ryzyko się potwierdzi                                          | Oczekiwanie po zmianie (faza 2)                                 |
| ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| S3   | zapis 1 wiersza (filtr tylko po `id`)                                                                   | 0 wierszy (`skipped = 1`)                                       |
| S4   | klucze z bieżącą wersją, równe `computeMatchKeys([jogurt])` ≠ `computeMatchKeys(<bieżące ingredients>)` | niezmiennik z §4.1 spełniony (tu oczekiwane `null`, rewizja +1) |
| S5   | `T` widoczny                                                                                            | `T` widoczny                                                    |
| S6   | `T` **widoczny** (defekt)                                                                               | `T` **nieobecny**                                               |

### Faza 0 — odtworzenie na stanie obecnym (przed zmianą)

Cel: wykazać, że scenariusz S wykrywa problem. Wykonać S na lokalnym Supabase z kodem z HEAD.
**Gotowe, gdy:** zapisano wyniki S3–S6 na HEAD — albo S6 pokazuje `T` przy S5 też pokazującym `T` (ryzyko potwierdzone), albo nie (diagnoza do korekty, plan wstrzymany).

### Faza 1 — testy z atrapą (logika skryptu)

- Wydzielić z `main()` funkcję synchronizacji przyjmującą klienta (szczegół do planu), testowaną atrapą z haczykiem między odczytem a zapisem (wzorzec: `afterKeyQuery` w `recipes.test.ts:518-523`).
- Przypadki: (a) edycja z podbiciem rewizji między odczytem a zapisem → zapis z warunkiem trafia 0 wierszy, `skipped = 1`; (b) kontrola pozytywna bez edycji → `updated = 1`, klucze równe `computeMatchKeys(ingredients)`; (c) dwa przebiegi bez edycji na tej samej rewizji → oba zapisują, brak `skipped`; (d) usunięcie wiersza po odczycie → `skipped = 1`, brak wyjątku.
- Ograniczenie: atrapa sprawdza, że skrypt **wysyła** warunek i liczy wynik — nie dowodzi semantyki bazy.
  **Gotowe, gdy:** oba przypadki mają asercje wyniku (liczniki i zapisane wartości), nie tylko kształtu wywołania.

### Faza 2 — rzeczywista baza, trigger i uprawnienia (lokalny Supabase, wzorzec kroków `ci.yml:95-183`)

Kroki 1–5 to scenariusz S (tabela wyżej, kolumna „po zmianie”), wykonany na rzeczywistej bazie z triggerem i uprawnieniami, a zapytania z S5–S6 — przez preview na runtime Cloudflare jak w smoke. Dodatkowo: 6. **Kontrola pozytywna:** S bez kroku S2 → 1 wiersz zapisany, klucze z bieżącą wersją równe `computeMatchKeys([jogurt])`, rewizja bez zmian; `exclude=jogurt` ukrywa `T`, `have=jogurt&exclude=cukier` pokazuje `T` ze 100%. 7. **Współbieżność z blokadą:** sesja A: `begin; update recipes set ingredients = …` (bez commit); sesja B: warunkowy zapis kluczy — czeka; A: `commit` → B zwraca 0 wierszy. Kolejność wymuszona transakcjami, nie czasem. 8. **Uprawnienia:** `authenticated` nie może ustawić `ingredients_rev` przy `insert` ani `update` (403, kod `42501`); edycja bez zmiany składników nie zmienia rewizji ani kluczy (warunek triggera). 9. **Naprawa istniejących kluczy (§4.2):** wiersz z celowo zapisanymi kluczami starego źródła (bieżąca wersja, inne składniki) po kroku naprawczym spełnia niezmiennik z §4.1, a S6 dla niego daje brak przepisu.
**Gotowe, gdy:** kroki 1–9 mają asercje stanu bazy (niezmiennik z §4.1) i wyniku dopasowania (najpierw status i typ odpowiedzi, potem treść — `lessons.md:12-17`), a faza 0 na HEAD i faza 2 po zmianie dają przeciwne wyniki dla S6 przy tym samym wyniku S5.

### Faza 3 — operacja

- Kolejność wdrożenia z §4.3, w tym potwierdzenie, że żaden wcześniejszy przebieg nie trwa, i wycofanie starych kopii skryptu.
- Jednorazowy krok z §4.2 wykonany na produkcji; zapisana liczba rozbieżnych lub unieważnionych wierszy.
- Wyjście skryptu raportuje `updated` i `skipped`; procedura ręcznego uruchomienia opisana w jednym miejscu.
  **Gotowe, gdy:** właścicielka potwierdziła procedurę (kto, kiedy, po jakich zdarzeniach, którą wersją skryptu) i miejsce jej opisu, a wynik kroku z §4.2 i pierwszego uruchomienia nowego skryptu jest zapisany.

## 7. Nierozstrzygnięte decyzje

| ID     | Decyzja                                                                                                                                                                                                                                                                | Gotowe, gdy…                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| D-N9-1 | Czy oprócz V2 potrzebne jest wymuszenie po stronie bazy (rewizja źródła przy kluczach) lub kontrola przy odczycie (V3) wobec ręcznego SQL, starych kopii skryptu i przyszłych zapisujących — przy świadomości, że żadna z opcji nie dowodzi poprawności samych kluczy? | Właścicielka zdecydowała; przy „tak” — osobny plan (przy V3 z oceną kosztu CPU `matchRecipes`) |
| D-N9-2 | Priorytet: czy realizować teraz, skoro częstość uruchomień skryptu jest nieznana (U-02)?                                                                                                                                                                               | Wynik fazy 0 i decyzja właścicielki zapisane                                                   |
| D-N9-3 | Czy skrypt ma ponawiać pominięte wiersze w tym samym przebiegu, czy zostawić je do następnego?                                                                                                                                                                         | Decyzja zapisana i pokryta przypadkiem w fazie 1                                               |
| D-N9-4 | Format wyjścia skryptu (`updated n, skipped m`) a asercje CI (`ci.yml:382-387`)                                                                                                                                                                                        | Uzgodniony format; asercje CI sprawdzają oba liczniki                                          |
| D-N9-5 | Czy test fazy 2 wchodzi do CI (koszt czasu, dane seedowe; smoke zakłada 5 przepisów — `context/archive/2026-10-18-seed-recipe-import/research.md:173`), czy zostaje lokalną bramką?                                                                                    | Decyzja zapisana; przy CI — test nie zmienia założeń istniejących kroków                       |
| D-N9-6 | Gdzie i przez kogo opisana jest procedura produkcyjna `match-keys`                                                                                                                                                                                                     | Jedno miejsce w repo wskazane przez właścicielkę                                               |
| D-N9-7 | Sposób naprawy istniejących kluczy: audyt z selektywnym unieważnieniem czy pełne unieważnienie (§4.2)                                                                                                                                                                  | Decyzja zapisana; wybrany sposób pokryty krokiem 9 fazy 2                                      |

**Całość gotowa, gdy:** fazy 0–3 są zakończone zgodnie z ich warunkami „gotowe, gdy…” (w tym faza 3: kolejność wdrożenia, naprawa istniejących kluczy i potwierdzona procedura), D-N9-1…D-N9-4 i D-N9-7 mają zapisane decyzje, a `01-domain-distillation.md` (N-9, U-02) zostanie zaktualizowany osobnym, świadomym krokiem.
