# Oczekiwania evali recenzenta

Status: **zaakceptowane w całości** (`correct`, `no-data`, poprawiony `bug` i zasady oceny). Po akceptacji ten plik i asercje w `promptfooconfig.yaml` nie zmieniają się do końca macierzy. Zmiana po zobaczeniu jakiegokolwiek wyniku tworzy nową wersję i unieważnia pilotaż (zmienia odcisk).

## Zakres

- 3 fikcyjne przypadki × 2 modele = **6 przebiegów łącznie**, po jednym na komórkę. Bez powtórek, bez ponawiania po błędzie, bez `fallbackModel`.
- **Pilotaż: przypadek `bug` na modelu A.** Liczy się do sześciu wyników tylko wtedy, gdy odcisk konfiguracji przy pozostałych pięciu jest identyczny. Pozostałe pięć po Twojej zgodzie.
- Modele A i B: dwa z pickera `/model` (wybór w Fazie 2, przed pilotażem).
- Asercje deterministyczne + ręczna ocena merytoryczna. **Brak gradera modelowego** (`llm-rubric`, `agent-rubric`); to nie jest ocena rubryką.
- Wszystkie diffy są wymyślone (`src/lib/demo/...`, `shopping_items`); nie zawierają prawdziwego kodu repo, danych ani sekretów. Tytuł i opis PR w `diffs/*.title.txt` i `diffs/*.body.txt`.

## Asercje wspólne (każda komórka)

1. `output` jest poprawnym JSON-em z `status` i `outcome` (`is-json`).
2. `status === "reviewed"`. Wynik `error` lub `skipped` oblewa komórkę i **nie jest powtarzany**.
3. Pole `review` przechodzi `REVIEW_SCHEMA.safeParse` (dla `status: reviewed`).
4. `metadata.modelsUsed` zawiera żądany model (brak cichej podmiany).

Czas, tokeny i szacunek kosztu SDK są tylko raportowane, bez progów.

## Przypadki

### `correct` — poprawna zmiana z testem

`mergeQuantities()` (sumowanie ilości po nazwie, `RangeError` dla ilości ujemnej lub nieskończonej) z testem Vitest w tym samym diffie. Opis zgodny z diffem.

Asercje: `outcome === "passed"` oraz `review.testRiskCoverage !== null`.

Ręcznie: czy zgłoszone zarzuty (jeśli są) są zasadne? Jeśli recenzent obniży ocenę z zasadnego powodu, którego nie przewidziałam, komórka pozostaje oblana, a zarzut notuję jako "zasadny, spoza oczekiwań" (nie jako błąd modelu). Fałszywy alarm = zarzut niezasadny.

### `bug` — celowy błąd (pilotaż)

`POST /api/shopping-list` obsługuje niepoprawny JSON (400 `invalid_json`) i waliduje wejście (`name` niepusty string, `quantity` skończona liczba > 0, inaczej 400 `invalid_body`), więc jedyną planowaną wadą jest brak obsługi błędu zapisu: wynik `insert` (`error` z bazy) jest ignorowany i endpoint zawsze zwraca 200 `{ ok: true }`, a opis PR obiecuje 500 `{ error: "db_error" }`. Test (status przed body) obejmuje ścieżkę udaną i oba 400, ale nie błąd bazy.

Asercje: `outcome === "failed"` oraz `review.implementationCorrectness` jest liczbą < 5.

To są warunki konieczne, **nie dowód wykrycia wady**: `failed` i niska ocena mogą wynikać z innego powodu.

Ręcznie, **"wada wskazana"** (tak / częściowo / nie, z cytatem): z `summary` lub `notAssessed[].note` musi wynikać, że endpoint zwraca sukces mimo błędu zapisu do bazy (zignorowany `error`), co przeczy opisowi PR.

- `tak`: wskazano ten problem wprost albo równoważnie.
- `częściowo`: wskazano brak obsługi błędów bazy bez związku z odpowiedzią 200 albo z opisem.
- `nie`: ogólne uwagi o jakości, inne wady, samo `failed`.

Komórka jest "wykryta" tylko przy `tak`. Dodatkowo notuję zarzuty zasadne spoza oczekiwań i fałszywe alarmy.

### `no-data` — brak danych do oceny

`formatQuantity()` (g → kg i ml → l od 1000) bez żadnego testu w diffie. Opis zgodny z diffem, kod poprawny.

Asercje: `outcome === "incomplete"`, `review.testRiskCoverage === null`, a `notAssessed` ma dokładnie jeden wpis `{ criterion: "testRiskCoverage", reason: "no-data" }`.

Ręcznie: czy `note` pyta o testy lub ich wyniki, a nie zmyśla oceny? Czy inne kryteria dostały sensowne liczby (nie `null` bez powodu)?

## Zasady oceny

- Asercje decydują o statusie komórki; ręczna ocena jest osobnym polem w `results.md` i nie zmienia wyniku asercji.
- Wynik z `bug`: raportuję osobno "asercje przeszły" i "wada wskazana". "Asercje przeszły, wady nie wskazano" nie jest wykryciem.
- Próg `PASS_THRESHOLD = 5` jest tylko obserwowany (notatka); nie zmieniam go ani promptu.
- Pojedynczy wynik na komórkę jest niedeterministyczny: sześć wyników to obserwacja, nie pomiar.

## Do akceptacji

- [x] `correct` i `no-data`: diffy, tytuły, opisy PR i asercje (zaakceptowane)
- [x] Zasady oceny, w tym: oblana komórka (także `error`) nie jest powtarzana (zaakceptowane)
- [x] `bug` w wersji poprawionej: `diffs/bug.diff`, `bug.title.txt`, `bug.body.txt`
- [x] Asercja `bug`: `outcome === "failed"` i `implementationCorrectness < 5`, oraz definicja "wada wskazana" (treść bez zmian)
