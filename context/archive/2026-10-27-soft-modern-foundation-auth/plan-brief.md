# Soft Modern — fundament, nagłówek i logowanie (#60) — Plan Brief

> Full plan: `context/changes/soft-modern-foundation-auth/plan.md`

## What & Why

Przechodzimy na styl Soft Modern v2: nowe kolory obu motywów, Plus Jakarta Sans, płaskie karty i przyciski, nowy nagłówek oraz logowanie i rejestracja. Reszta aplikacji dziedziczy styl bez zmiany układu.

## Starting Point

Aplikacja ma tokeny i komponenty `ui/` w stylu neo-brutal (`brutal`, `pressable`, cienie), gradientowe logo i jednorzędowy nagłówek bez wariantu na telefon.

## Desired End State

Logowanie, rejestracja, potwierdzenie konta i nagłówek odpowiadają makietom w jasnym i ciemnym motywie, na telefonie i komputerze. W kodzie nie ma neo-brutalu.

## Key Decisions Made

| Decision                | Choice                                                      | Why                                             | Source |
| ----------------------- | ----------------------------------------------------------- | ----------------------------------------------- | ------ |
| Font                    | `@fontsource-variable/plus-jakarta-sans`, lokalnie          | Zaakceptowana zależność, bez zewnętrznych żądań | Plan   |
| Menu konta              | Natywny element z obsługą klawiatury                        | Najmniejszy koszt, poprawna dostępność          | Plan   |
| Ilustracje              | Poza zakresem, panel z tłem, logo i hasłem                  | Assetów jeszcze nie ma (#61)                    | Plan   |
| Kolory                  | Hexy z makiet 1:1                                           | Wspólna wartość dwóch tokenów jest zamierzona   | Plan   |
| Rozmiary                | Główne akcje 48 px (`lg`), ikonowe 44 px, reszta kompaktowa | Bez globalnego powiększania                     | Plan   |
| Wezwanie do rejestracji | „Załóż konto”                                               | Ujednolicenie                                   | Plan   |

## Scope

**In scope:** tokeny, font, `ui/`, nagłówek z menu konta, auth (3 strony + formularze), reguły UI, kitchen sink.

**Out of scope:** ilustracje, układ pozostałych widoków, logika, baza, nowe narzędzia testowe.

## Architecture / Approach

Fundament i migracja odwołań w jednej fazie (repo zawsze zielone), potem nagłówek, auth i reguły. Zmiany globalne: tokeny (wszystkie widoki), wysokość pól 48 px (formularze przepisu), promień 12 px, usunięcie `brutal` z kafelka przepisu.

## Phases at a Glance

| Phase        | What it delivers                         | Key risk                                    |
| ------------ | ---------------------------------------- | ------------------------------------------- |
| 1. Fundament | Paleta, font, `ui/`, migracja odwołań    | Regresje wizualne w niezmienianych widokach |
| 2. Nagłówek  | Nagłówek + menu konta                    | Dostępność menu                             |
| 3. Auth      | Logowanie, rejestracja, potwierdzenie    | Zgodność z makietami bez ilustracji         |
| 4. Reguły    | `AGENTS.md`, `CLEAN_FILES`, kitchen sink | Pominięty literał koloru                    |

**Prerequisites:** branch `codex/soft-modern-stage-1`.
**Estimated effort:** ~3–4 sesje.

## Open Risks & Assumptions

- Pola 48 px zmienią gęstość formularza przepisu (do oceny wizualnej).
- Pozostałe ekrany makiet (M05–M26) są poza tym etapem; część tokenów może wymagać dopracowania przy kolejnych etapach.

## Success Criteria (Summary)

- Ekrany auth i nagłówek zgodne z makietami w obu motywach.
- Pozostałe widoki działają i wyglądają spójnie bez zmian układu.
- Lint, typy, testy, build i smoke przechodzą.
