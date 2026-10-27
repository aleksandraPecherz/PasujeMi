# Weryfikacja — stan na 2026-10-27

Źródło potwierdzeń ręcznych: wyraźne potwierdzenie autorki w rozmowie. Kontrole automatyczne (lint, check:ui, astro check, npm test, npm run build) przeszły i nie były powtarzane po ostatniej zmianie kodu.

## Zaakceptowane ręcznie

- Widoki dziedziczące styl czytelne w obu motywach (1.6).
- Widoczny fokus pól i przycisków z klawiatury (1.7).
- Błędy, pending i przełącznik hasła działają jak dotąd (3.4).
- Pozostałe ręczne sprawdzenia nagłówka (wygląd na komputerze i telefonie) oraz ekranów logowania i rejestracji, poza punktami poniżej.

## Niesprawdzone / niewykonane

- **Menu konta na telefonie i zamykanie Esc** — niesprawdzone; wylogowanie z menu również. Krok 2.4 zostaje nieodhaczony. Krok 2.3 (nagłówek na telefonie) zostaje nieodhaczony, bo obejmuje menu z M21.
- **Smoke auth (3.2)** — niewykonany. `.dev.vars` wskazuje na zdalny Supabase niepotwierdzony jako testowy; smoke tworzy konta, więc nie uruchamiano go.
- **Wariant „Sprawdź skrzynkę” (`/auth/confirm-email` w buildzie produkcyjnym)** — nieoceniony wizualnie; dev pokazuje tylko „Konto założone”. Dlatego 3.3 (ekrany auth zgodne z makietami) zostaje nieodhaczony.
- **4.2 (akceptacja całości)** — nieodhaczony, dopóki powyższe punkty są otwarte.

## Znane uwagi

- Panel auth bez ilustracji (zakres #61).
- Popover menu nie przyciemnia tła jak w M21 (natywny popover bez `::backdrop`).
