# Runbook: kolumna ilustracji i przypisanie przepisów

Dotyczy środowiska innego niż lokalne (np. produkcji). Nic z tego nie zostało wykonane zdalnie; lokalnie migracja jest zastosowana, a skrypt przetestowany na lokalnej bazie.

**Kolejność jest obowiązkowa:** migracja → wdrożenie kodu → przypisanie. Kod z `illustration` w zapytaniach bez kolumny kończy każde zapytanie o przepisy błędem.

## 0. Zanim zaczniesz

- Mapa `scripts/illustration-map.json` jest zaakceptowana (`illustration-map.md` to jej źródło; zmiany robisz w obu miejscach albo tylko w JSON-ie, a `--check` pilnuje zgodności z arkuszem).
- Offline sprawdzenie mapy: `npm run assign-illustrations -- --check` (oczekiwane: `arkusz 76, mapa 76, błędy 0`).

## 1. Migracja

1. `npx supabase db push --dry-run` na powiązanym projekcie. Oczekiwane: wyłącznie `20261027120000_add_recipe_illustration.sql` (jeśli lista jest dłuższa, zatrzymaj się i wyjaśnij resztę).
2. `npx supabase db push` — decyzja autorki.
3. Kolumna jest opcjonalna i nie zmienia polityk RLS ani grantów; istniejące przepisy mają `null`.

## 2. Wdrożenie kodu

Dopiero po migracji. Do czasu przypisania wszystkie przepisy pokazują obraz zastępczy.

## 3. Przypisanie

Klucz serwisowy podajesz tylko w powłoce (nie trafia do `.dev.vars`, `.env` ani do Workera).

1. Podgląd (nic nie zapisuje):
   `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run assign-illustrations`
   Oczekiwane: `do przypisania 76, już ustawione 0, brak w bazie 0, niejednoznaczne 0, błędy 0`. Lista „Brak w bazie” lub „niejednoznaczne” musi być pusta; jeśli nie jest, wyjaśnij każdą pozycję przed zapisem (np. przepis zmienił nazwę).
2. Zapis, tylko po akceptacji podglądu:
   `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run assign-illustrations:write`
   Oczekiwane: `assigned 76 of 76`.
3. Skrypt jest idempotentny: drugi zapis daje `assigned 0`, a istniejącego przypisania nigdy nie nadpisuje (różnice są tylko wypisane).

`--allow-missing` pozwala zapisać mimo brakujących nazw (np. lokalna baza z samym seedem); na środowisku docelowym nie używaj go bez powodu.

## 4. Po wszystkim

- Zapisz w `verification.md`, na którym środowisku i kiedy wykonano migrację i przypisanie.
- Nowe przepisy dodawane w aplikacji mają `null` (obraz zastępczy); przypisuje się je ponownie tym samym skryptem po dopisaniu do mapy albo ręcznie w panelu bazy.
