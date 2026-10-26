<!-- ai-cr:sticky -->
<!-- ai-cr:sha=0123456789abcdef0123456789abcdef01234567 -->

## Wynik AI code review: negatywny (failed)

Oceniony commit: `0123456789abcdef0123456789abcdef01234567` · [przebieg Actions](https://github.com/example/repo/actions/runs/1)

| Kryterium                        | Ocena |
| -------------------------------- | ----- |
| Poprawność implementacji         | 3     |
| Idiomatyczność                   | 6     |
| Złożoność                        | 7     |
| Pokrycie testami względem ryzyka | 2     |
| Dokumentacja                     | 5     |
| Bezpieczeństwo                   | 1     |

Werdykt modelu: **fail**

Wynik bramki: **failed**. Powody:

- werdykt modelu `fail`
- oceny poniżej progu 5: Poprawność implementacji (3), Pokrycie testami względem ryzyka (2), Bezpieczeństwo (1)

### Podsumowanie

`findUser` składa zapytanie SQL z konkatenacji stringów (SQL injection). Użyj zapytań parametryzowanych.

### Pominięte pliki

Te pliki nie weszły do diffu, więc ocena nie obejmuje zmian zależności:

- `package-lock.json`

Koszt: $0.1234 (szacunek SDK, nie rachunek), tury: 1, czas: 4.2 s.
