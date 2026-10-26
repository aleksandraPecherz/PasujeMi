<!-- ai-cr:sticky -->
<!-- ai-cr:sha=0123456789abcdef0123456789abcdef01234567 -->

## Wynik AI code review: niepełna ocena (incomplete)

Oceniony commit: `0123456789abcdef0123456789abcdef01234567` · [przebieg Actions](https://github.com/example/repo/actions/runs/1)

> **Niepełna ocena: brakujące dane.** Żadna ocena nie jest negatywna, ale część kryteriów nie miała danych do oceny.
> Wskaż istniejące testy lub uzupełnij opis PR-a, a potem dodaj etykietę `ai-cr:review`.

| Kryterium                        | Ocena |
| -------------------------------- | ----- |
| Poprawność implementacji         | 8     |
| Idiomatyczność                   | 8     |
| Złożoność                        | 7     |
| Pokrycie testami względem ryzyka | —     |
| Dokumentacja                     | 6     |
| Bezpieczeństwo                   | 8     |

Werdykt modelu: **pass**

### Nieocenione kryteria

- Pokrycie testami względem ryzyka: brak danych do oceny. Nowa logika w `src/lib/matching.ts` nie ma testów w diffie. Czy istnieją testy poza tą zmianą?

### Podsumowanie

Kod jest czytelny i spójny z opisem.

Koszt: $0.1234 (szacunek SDK, nie rachunek), tury: 1, czas: 4.2 s.
