# Weryfikacja — soft-modern-pantry-recipes

## Styl ilustracji — zaakceptowany (autorka, 2026-10-28)

- Zestaw 12 SVG w `public/illustrations/` zaakceptowany stylistycznie.
- `deser.svg`: wersja v3 (`preview/v3/deser.svg`): kawałek ciasta z czekoladową polewą, bez wisienki, bez szczelin.
- `wrap.svg`: pierwotna wersja (przywrócona); odrzucone warianty (babeczka, tarta, dwie połówki) zostają tylko jako ślad w `preview/`.
- Podgląd biblioteki: `preview/library.html` (czyta pliki z `public/illustrations/`, więc zawsze pokazuje aktualny stan).

## Mapa przepisów — zaakceptowana (autorka, 2026-10-28)

- Mapa 76 przepisów (`illustration-map.md`, `scripts/illustration-map.json`) zaakceptowana bez przesunięć: gofry, placuszki, pancakes i batoniki zostają `deser`, zapiekanka makaronowa zostaje `makaron`.
- Zastosowanie w bazie (migracja i `--write`) nie zostało wykonane; to krok wdrożenia (`runbook.md`).

## Potwierdzenia autorki (bez odhaczania szczegółowych kryteriów)

- Styl ilustracji zaakceptowany; panel desktopowy obejrzany; układ mobilny działa.
- Na tej podstawie nie odhaczono szczegółowych kryteriów ręcznych z `plan.md` (1.3, 2.3, 2.4, 3.3–3.6, 4.4, 4.5).

## Kontrole automatyczne (2026-10-28, jeden końcowy zestaw)

- `npm run lint`, `npm run check:ui`, `npx astro check` (0 błędów, 0 ostrzeżeń), `npm test` (25 plików, 442 testy, 3 todo), `npm run build`: przeszły.
- `npm run assign-illustrations -- --check`: arkusz 76, mapa 76, błędy 0.
- Skrypt przypisania sprawdzony na lokalnym Supabase: podgląd, zapis wstrzymany przy brakujących nazwach, `--write --allow-missing` przypisał jeden wyczyszczony przepis; lokalna baza wróciła do stanu 5 przepisów / 5 przypisań.

## Niewykonane i otwarte

- Migracja i przypisanie w bazie zdalnej (świadomie; kroki w `runbook.md`).
- Szczegółowe kryteria ręczne w `plan.md`: 1.3 (przegląd migracji), 2.3, 2.4, 3.3–3.6, 4.4, 4.5 pozostają nieodhaczone.
- Ręczne kryteria z `plan.md` (1.3, 2.3, 2.4, 3.3–3.6, 4.4, 4.5) pozostają do Twojego potwierdzenia; nie są błędami aplikacji.

## Ponowna weryfikacja dwóch zgłoszonych problemów (2026-10-28, serwer dev uruchomiony od nowa)

Serwer na 4321 zatrzymałam (`astro dev stop`, pid 50492) i uruchomiłam ponownie tym samym poleceniem (`npm run dev`, pid 52088); drugiego serwera nie uruchamiałam. Sprawdzenie w Chrome (Playwright), po zalogowaniu na lokalne konto, przy 390 i 1280 px:

1. **Błąd hydracji strony głównej: nie wystąpił** (0 błędów strony i konsoli po załadowaniu `/`, w obu szerokościach). Przyczyny wcześniejszego błędu nie udowodniono; nie wiadomo, czy był skutkiem tego samego stanu serwera co pkt 2.
2. **HTTP 500 na `/dev/kitchen-sink`: ustąpił** (HTTP 200, 54 nagłówki `h2`, obecne wszystkie nowe sekcje: „Kafelek przepisu”, „Biblioteka ilustracji”, „Spiżarka: pasek na telefonie”, „Spiżarka: brak wyników, błąd i ładowanie”; 0 błędów).

Przyczyna 500 (ustalona z komunikatów i plików, przed restartem): przed restartem serwer zwracał 500 także na `/auth/signin` z komunikatem „The file does not exist at …/node_modules/.vite/deps_ssr/class-variance-authority.js?v=9b8b0ffd which is in the optimize deps directory”. Serwer (uruchomiony ok. 34 minuty wcześniej) trzymał w pamięci hash optymalizacji `9b8b0ffd`, a na dysku `node_modules/.vite/deps_ssr` miał już inną zawartość: `_metadata.json` z `browserHash f513d79c`, znaczniki czasu 10:42:53–54 (dokładnie moment mojego `npm run build` z 10:43) i brak wpisu `class-variance-authority`. Czyli `npm run build` uruchomiony przy działającym serwerze dev przepisał wspólny katalog optymalizacji zależności Vite. Cache nie był usuwany; wystarczył restart serwera.

Uwaga operacyjna: nie uruchamiać `npm run build` przy działającym `npm run dev` (albo po buildzie zrestartować serwer dev).

## Niewykonane

- Migracja i przypisanie w bazie zdalnej (świadomie; kroki w `runbook.md`).
- Szczegółowe kryteria ręczne wymienione wyżej.
- Po tej weryfikacji nie uruchamiano ponownie lint, testów ani builda (zmieniły się tylko dokumenty).
