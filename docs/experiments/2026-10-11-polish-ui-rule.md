# A/B: reguła „UI po polsku” w AGENTS.md

**Data:** 2026-10-11
**Prompt (identyczny w każdym przebiegu):** `Add a custom 404 page.`
**Stan bazowy:** commit 699cce3. AGENTS.md wspomina „Polish-language app” tylko w zdaniu opisującym projekt, bez osobnej reguły. Istniejące strony auth ze startera są po angielsku.
**Pytanie:** czy agent bez osobnej reguły pisze teksty UI po polsku?

## Bez reguły

| #   | Język UI | Czas | Eksploracja              | Layout + bg-cosmic |
| --- | -------- | ---- | ------------------------ | ------------------ |
| 1   | PL       | 76 s | 2 pliki, 5 komend        | tak                |
| 2   | PL       | 62 s | 2 katalogi, 4 komendy    | tak                |
| 3   | PL       | 59 s | 2 katalogi, kilka komend | tak                |

Obserwacje:

- Przebieg 1: agent zauważył konflikt (strony ze startera po angielsku) i wprost wybrał polski na podstawie AGENTS.md.
- Przebieg 2: język poprawny, ale uzasadnienie zmyślone („jak reszta aplikacji”, choć reszta jest po angielsku).
- We wszystkich przebiegach agent sam uruchomił ESLint, Prettier, `astro check` i dev server, czyli komendy z sekcji Commands w AGENTS.md.
- Dwie próby odrzucone: Claude uruchomiony w terminalu VS Code przejął plik z poprzedniego przebiegu otwarty w edytorze („Selected 21 lines…”) i go przepisał. Przebiegi A/B trzeba robić w osobnym terminalu albo przy zamkniętym edytorze.

## Z regułą

Nie wykonano: agent trafiał w konwencję bez reguły (3/3).

## Wniosek

Osobna reguła „UI po polsku” jest zbędna, bo zdanie opisu projektu w AGENTS.md wystarcza. Reguły nie dodajemy. Komendy w sekcji Commands zostają, bo agent faktycznie z nich korzysta.

## Do zrobienia później

- `src/layouts/Layout.astro` ustawia `<html lang="en">`; dla polskiej aplikacji powinno być `lang="pl"`.
- Strony auth ze startera (signin, signup, confirm-email, dashboard) są po angielsku i czekają na tłumaczenie.
