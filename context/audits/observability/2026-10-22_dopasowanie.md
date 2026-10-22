---
type: observability-audit
date: 2026-10-22 22:32
mode: audit
commit: 52c8fb3
branch: m3l5-debugging-lesson
dirty_tree: false
areas: [dopasowanie]
area_source: user
runtime_proof: not-run
error_tracker: none (Workers Logs only)
previous_report: null
findings: { critical: 2, high: 2, medium: 3, low: 1 }
---

# Audyt obserwowalności — dopasowanie przepisów (2026-10-22)

## 1. TL;DR

- **Awaria Supabase Auth wygląda jak wylogowanie.** Middleware ignoruje `error` z `getUser()`, więc przy niedostępnym Auth każde `/api/*` (w tym `/api/recipes/match` i `PUT /api/pantry`) zwraca 401, a użytkownik widzi „Sesja wygasła”. W logach nie ma ani jednej linii o błędzie.
- **Przepisy bez aktualnych kluczy znikają z dopasowania po cichu.** Ponad limit `MAX_RECOMPUTED_RECIPES` (200) przepis po prostu nie trafia do rankingu; odpowiedź to 200, `total` jest zaniżony, brak logu.
- **Nieudany odczyt spiżarki uruchamia pierwszą listę bez zapisanych wykluczeń.** Błąd jest zalogowany, ale użytkownik dostaje tylko komunikat o wyłączonym zapisie, nie o tym, że lista nie uwzględnia wykluczeń (ryzyko #1).
- Brak trackera błędów: jedyny kanał to `console.*` w Workers Logs. Linie logów nie mają kontekstu (użytkownik, liczba tagów).

## 2. Model przechwytywania

- **Środowisko:** Astro 7 SSR na Cloudflare Workers (`wrangler.jsonc:3`), wyspa React `PantryMatch` po stronie klienta.
- **Tracker błędów:** brak w repo (żadnego SDK Sentry/Datadog itp.).
- **Logi:** `observability.enabled: true` w `wrangler.jsonc:13-15` (head sampling domyślnie 1). Serwer loguje przez `console.error` w blokach `catch` endpointów (`src/pages/api/recipes/match.ts:54`, `src/pages/index.astro:25`). Nieobsłużone wyjątki stron SSR Astro zamienia w stronę 500 i loguje.
- **Granice:** każde żądanie przechodzi przez `src/middleware.ts` (sesja). Kod klienta (`src/components/hooks/usePantryMatch.ts`) nie ma żadnego raportowania — jego błędy widzi tylko użytkownik.
- **Czyszczenie / próbkowanie / wydania:** brak w kodzie.

**Założenia (poza repo, niepotwierdzone):** Workers Logs zbierane na produkcji (konfiguracja jest w repo, więc prawdopodobne); brak alertów na linie `console.error` — logi trzeba przeszukiwać ręcznie.

## 3. Co trafia do monitoringu (statycznie, bez sond)

| Kształt awarii                                  | Odpowiedź                            | Workers Logs                         | Werdykt                                  |
| ----------------------------------------------- | ------------------------------------ | ------------------------------------ | ---------------------------------------- |
| Supabase Auth niedostępny (sieć/5xx)            | 401 `unauthorized`                   | tylko linia żądania z 401, bez błędu | **missed**                               |
| Błąd zapytania PostgREST w `matchRecipes`       | 500 `database_error`                 | `matchRecipes failed` + obiekt błędu | good (bez kontekstu)                     |
| >200 przepisów bez aktualnych kluczy            | 200, mniej wyników, zaniżony `total` | nic                                  | **missed**                               |
| Błąd odczytu `saved_pantry` przy wejściu na `/` | 200, lista bez zapisanych wykluczeń  | `getSavedPantry failed` + błąd       | poor                                     |
| Limit CPU (1102) / odpowiedź nie-JSON           | HTML Cloudflare                      | wynik wywołania platformy            | poor (klient pokazuje „Brak połączenia”) |

## 4. Systemowe przyczyny źródłowe

1. **Wynik `{ error }` z Supabase Auth traktowany jak „brak sesji”** — `src/middleware.ts:12-17`. Destrukturyzacja bierze tylko `data.user`; każdy błąd, także awaria, kończy się `user = null`. Wyjaśnia M-1.
2. **Celowa degradacja bez własnego sygnału** — `src/lib/services/recipes.ts:243-275`. Limit CPU (rozsądna decyzja z lessons.md) odcina przepisy, ale usuwa też jedyny ślad, że to się stało. Wyjaśnia M-2.
3. **Fallback „pusty stan” po błędzie odczytu** — `src/pages/index.astro:16-26` + `initialFilters(null)`. Wyjaśnia M-3.
4. **Klient zlewa różne awarie w jeden komunikat i nic nie raportuje** — `src/components/hooks/usePantryMatch.ts:144-147`. Wyjaśnia M-5.

## 5. Ustalenia

### Dopasowanie przepisów

| #   | Lokalizacja                                      | Kategoria          | Ważność  | Co się dzieje na produkcji                                                                                                                                                                                                          | Kierunek poprawki                                                                            |
| --- | ------------------------------------------------ | ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| M-1 | `src/middleware.ts:12-17`                        | flattened-response | critical | Awaria Auth → wszystkie `/api/*` dają 401, użytkownik: „Sesja wygasła. Zaloguj się ponownie.”, strony przekierowują do logowania. Osoba reagująca widzi tylko falę 401, które wyglądają jak wylogowania.                            | Odróżnić awarię (`AuthRetryableFetchError`) od braku sesji: zalogować błąd i zwrócić 503.    |
| M-2 | `src/lib/services/recipes.ts:243-275`            | swallowed          | critical | Gdy przepisów bez aktualnych `match_keys` jest >200 (np. po zmianie `MATCH_KEYS_VERSION` przed `npm run match-keys`, albo po wielu nowych przepisach użytkowników), nadmiarowe znikają z wyników. 200, brak logu, `total` zaniżony. | `console.warn` z liczbą pominiętych przepisów (raz na żądanie); rozważyć flagę w odpowiedzi. |
| M-3 | `src/pages/index.astro:16-26`                    | flattened-response | high     | Błąd odczytu spiżarki → pierwsza lista bez zapisanych wykluczeń (alergeny), komunikat mówi tylko o wyłączonym zapisie. Log jest.                                                                                                    | Komunikat w UI, że lista nie uwzględnia zapisanych wykluczeń.                                |
| M-4 | `src/lib/services/pantry.ts:30-33`               | missing-context    | medium   | `Invalid saved pantry row, ignoring it` bez id użytkownika i bez tego, co nie przeszło walidacji — nie wiadomo, który wiersz naprawić.                                                                                              | Dodać `userId` i pole, które nie przeszło walidacji.                                         |
| M-5 | `src/components/hooks/usePantryMatch.ts:144-147` | flattened-response | medium   | Odpowiedź nie-JSON (np. strona błędu 1102 przy limicie CPU) kończy się w `catch` i użytkownik widzi „Brak połączenia z serwerem”. Kod klienta nie ma trackera.                                                                      | Rozdzielić błąd sieci od błędu parsowania; rozważyć tracker po stronie klienta.              |
| M-6 | `src/pages/api/recipes/match.ts:52-56`           | missing-context    | medium   | `matchRecipes failed` bez liczby tagów, `limit`/`offset` i użytkownika — trudno odtworzyć zapytanie.                                                                                                                                | Dodać kontekst (liczby, bez treści tagów).                                                   |
| M-7 | `src/lib/services/recipes.ts:268-275`            | swallowed          | high     | Wiersz, który zmienił wersję kluczy między zapytaniami, jest pomijany bez śladu (świadomie, komentarz). Rzadkie, ale niewidoczne.                                                                                                   | Objęte poprawką M-2 (ten sam licznik pominiętych).                                           |
| M-8 | `src/lib/services/recipes.ts:288-295`            | swallowed          | low      | Przepis usunięty między zapytaniami jest pomijany (świadomie); `total` go liczy.                                                                                                                                                    | Bez zmian — zachowanie oczekiwane.                                                           |

### Platforma / wspólny kod

- Brak trackera błędów; wszystkie sygnały to `console.*`. Poprawki M-1 i M-2 dają linie logu, które da się wyszukać i podpiąć pod alert (np. Sentry `captureConsoleIntegration`, lekcja 3.5).
- Przegląd repo (bez testów): puste `catch` 8 (głównie `sessionStorage`/`localStorage` w `list-state.ts`, `theme.ts` — uzasadnione), `console.error` na serwerze 7, wszystkie z obiektem błędu.

## 6. Kolejność poprawek

1. **M-1** — jedna zmiana w middleware usuwa ślepotę dla wszystkich `/api/*`. Uwaga: nie logować zwykłego braku sesji ani wygasłego tokenu (szum).
2. **M-2 + M-7** — jeden licznik pominiętych przepisów i `console.warn`.
3. **M-3** — komunikat w UI (decyzja produktowa, ryzyko #1).
4. M-4, M-6, M-5 — kontekst logów i rozróżnienie błędów w kliencie.

## 8. Metoda i ograniczenia

- Audyt jednego obszaru (wybór użytkownika: dopasowanie przepisów), wykonany przez jednego agenta zamiast podagentów — mała baza kodu.
- Sprawdzone ręcznie w źródle zależności: `@supabase/auth-js` 2.116.0 `_getUser` zwraca `{ user: null, error }` dla każdego `AuthError`, a `handleError` (`lib/fetch.js:25-44`) zamienia błąd sieci i 502/503/504 na `AuthRetryableFetchError` — potwierdza M-1.
- Dowód w środowisku uruchomieniowym nie był robiony (`runtime_proof: not-run`); M-1 potwierdza test jednostkowy middleware dodany razem z poprawką.
