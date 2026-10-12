# Kontrakt danych przepisu

Źródło prawdy o kształcie przepisu w PasujeMi i o regułach konwersji z pliku autorki `data/recipes.xlsx`. Korzystają z niego: import F-02, dopasowanie S-03 i dodawanie przepisów S-05.

- Tabela: `public.recipes` (`supabase/migrations/20261012120000_create_recipes.sql`).
- Typy TS: `src/types.ts` (`Recipe`, `RecipeIngredient`, `IngredientOption`, `RecipeKind`).
- Odczyt: `src/lib/services/recipes.ts` (`listRecipes`), `GET /api/recipes?limit=&offset=`.
- `data/recipes.xlsx` jest tylko lokalnie u autorki (`data/` w `.gitignore`); nigdy nie trafia do repo.

## Kształt rekordu

| Kolumna (baza)  | Pole (`Recipe`) | Typ                     | Reguła                                                                         |
| --------------- | --------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `id`            | `id`            | `uuid`                  | generowane przez bazę                                                          |
| `name`          | `name`          | `text`                  | niepuste po przycięciu                                                         |
| `steps`         | `steps`         | `text[]`                | co najmniej 1 krok                                                             |
| `ingredients`   | `ingredients`   | `jsonb`                 | tablica, co najmniej 1 element (kształt elementu niżej)                        |
| `prep_time_min` | `prepTimeMin`   | `integer` / `null`      | ≥ 0, w minutach                                                                |
| `servings`      | `servings`      | `integer` / `null`      | > 0                                                                            |
| `kinds`         | `kinds`         | `text[]`                | podzbiór: `na słodko`, `na wytrawnie`, `na ciepło`, `na zimno`; domyślnie `{}` |
| `kcal`          | `kcal`          | `integer` / `null`      | ≥ 0, **na 1 porcję**                                                           |
| `protein_g`     | `proteinG`      | `numeric(6,1)` / `null` | ≥ 0, **na 1 porcję**                                                           |
| `carbs_g`       | `carbsG`        | `numeric(6,1)` / `null` | ≥ 0, **na 1 porcję**                                                           |
| `fat_g`         | `fatG`          | `numeric(6,1)` / `null` | ≥ 0, **na 1 porcję**                                                           |
| `created_at`    | —               | `timestamptz`           | domyślnie `now()`                                                              |

`numeric` przychodzi z PostgREST jako tekst — serwis zamienia go na `number` (`null` zostaje `null`).

Dostęp (RLS): zalogowany (`authenticated`) czyta wszystkie przepisy; anonim nie ma uprawnień ani polityk; zapisu przez API na razie nie ma (dojdzie w S-05–S-07 addytywną migracją).

## Kształt składnika

Każdy element `ingredients`:

```ts
{
  name: string; // tekst jak w przepisie
  product: string; // ogólny produkt do dopasowania (małe litery, bez marki)
  amount: number | null; // liczba; null, gdy brak ilości
  unit: string | null; // "g" albo słowo w mianowniku l.p. ("szczypta"); null, gdy brak ilości
  substitutes: Array<{ name: string; product: string; amount: number | null; unit: string | null }>;
}
```

Zamienniki mają ten sam kształt co składnik, ale bez własnych `substitutes`.

### Przykład rekordu (JSON, po stronie API)

```json
{
  "id": "6f1c2a9e-0b7d-4c1e-9a3f-2d5e8b7c4a10",
  "name": "Owsianka z borówkami",
  "steps": ["Płatki zalej mlekiem i gotuj 5 minut.", "Dodaj borówki i odrobinę soli."],
  "ingredients": [
    {
      "name": "Płatki owsiane",
      "product": "płatki owsiane",
      "amount": 40,
      "unit": "g",
      "substitutes": [{ "name": "Płatki jaglane", "product": "płatki jaglane", "amount": 40, "unit": "g" }]
    },
    {
      "name": "Mleko 1,5%",
      "product": "mleko 1,5%",
      "amount": 200,
      "unit": "g",
      "substitutes": [{ "name": "Napój sojowy Go Vege", "product": "napój sojowy", "amount": 200, "unit": "g" }]
    },
    { "name": "Sól", "product": "sól", "amount": 1, "unit": "szczypta", "substitutes": [] }
  ],
  "prepTimeMin": 10,
  "servings": 1,
  "kinds": ["na słodko", "na ciepło"],
  "kcal": 405,
  "proteinG": 15.2,
  "carbsG": 60.1,
  "fatG": 9.8
}
```

## Źródło: `data/recipes.xlsx`

Jeden arkusz, 76 przepisów. Kolumny: Nazwa dania, czas przygotowania (min), rodzaj, Ilość porcji, PRODUKTY, waga (g), Kcal, Białko (g), Węglowodany(g), Tłuszcze (g), Jak zrobić?.

Formaty spotykane w pliku:

- **PRODUKTY**: 74× `Nazwa (40g) [zamienniki: a (40g), b (20g)] ; …`; 2× `Nazwa - 120 g [zamienniki: x – 125 g], …` rozdzielane przecinkami (przecinek bywa też w nazwie: „Borówki amerykańskie, świeże lub mrożone - 100 g”). Etykieta `zamiennik:` (28×) i `zamienniki:`. Ilości: `5g`, `0,3 g`, `0.3g`, `25 g`, `1szczypta`.
- **Jak zrobić?**: 42× numerowane (`1.` lub `1)`), 26× rozdzielane `;`, 8× nowymi liniami (z `;` w środku linii).
- **rodzaj**: tylko `na słodko` / `na wytrawnie` + `na ciepło` / `na zimno`, rozdzielane średnikiem ze spacją przed lub bez (`na słodko ; na zimno`, `na słodko; na zimno`).
- **Kcal i makro**: zwykle ~400 kcal na porcję, ale część przepisów wielu porcji ma wartość na całość (pizza 4 porcje = 1704 kcal, spaghetti 2 porcje = 844 kcal), a część na porcję (babeczki 2 porcje = 406 kcal).
- **waga (g)**: wypełniona 16×, pusta 36×, `BRAK` 24× — pomijana.

## Reguły konwersji z Excela

- **Składniki — podział**: najpierw wydziel bloki `[zamiennik(i): …]`; na najwyższym poziomie dziel po `;` poza nawiasami. Gdy na najwyższym poziomie nie ma `;` (układ „- 120 g”), dziel po `,` tylko tam, gdzie poprzedza go ilość (`- N g`) lub zamknięcie `]` — przecinek wewnątrz nazwy zostaje.
- **Ilość**: ostatni nawias na końcu pozycji w postaci `(liczba jednostka)` (dopuszczalna spacja i przecinek dziesiętny) albo końcówka `- N g` / `– N g`. `amount` = liczba (przecinek → kropka), `unit` = `g` lub słowo w mianowniku liczby pojedynczej (`szczypta`). Inne nawiasy zostają w nazwie („Kasza gryczana niepalona (biała)”). Brak ilości → `amount` i `unit` = `null`.
- **Zamienniki**: zawartość po `zamiennik:`/`zamienniki:`, dzielona po `;` lub `,` (poza nawiasami); każdy parsowany jak składnik, bez własnych zamienników.
- **`name`**: tekst jak w przepisie, przycięty, z zachowaną wielkością liter pierwszej litery jak w źródle.
- **`product`**: małe litery, nazwa bez marki i nazw linii produktowych (Lazur, Mlekovita, Ryki, Go Vege, Vemondo, „active protein plus” itp.); pozostałe określenia zostają („ser żółty active protein plus Ryki” → „ser żółty”, „ser z niebieską pleśnią Lazur” → „ser z niebieską pleśnią”, „Mleko 1,5%” → „mleko 1,5%”). Rozpoznawanie odmian i ogólne/szczegółowe należy do S-03.
- **Duplikaty**: ten sam składnik dwa razy zostaje dwiema pozycjami (np. sól do ciasta i do sosu).
- **Kroki**: pierwszeństwo separatorów numeracja (`1.`/`1)`) > nowa linia > `;`; separator niższego rzędu wewnątrz kroku zostaje w tekście. Usuń numerację, przytnij, zacznij wielką literą, pomiń puste.
- **rodzaj → `kinds`**: podział po `;`, przycięte, małe litery; dozwolone `na słodko`, `na wytrawnie`, `na ciepło`, `na zimno`.
- **Kcal i makro — reguła autorki**: w bazie zawsze na 1 porcję. Gdy `servings > 1` i `kcal` jest bliskie `400 × servings`, podziel kcal i makro przez `servings`; w przeciwnym razie zostaw bez zmian. „Bliskie” = `0,75 ≤ kcal / (400 × servings) ≤ 1,25` (w danych przepisy „na całość” mają 0,96–1,07, „na porcję” co najwyżej 0,51). Zaokrąglenie: kcal do liczby całkowitej, makro do 0,1 g. **Przy imporcie F-02 lista przeliczonych przepisów trafia do autorki do potwierdzenia** — import musi ją pokazać przed zapisem.
- **Czas i porcje**: liczby całkowite (`5.0` → 5); `waga (g)` pomijana.

## Znane marki i linie produktowe

Usuwane z `product`, zostają w `name`. Występują prawie zawsze w zamiennikach:

- Lazur
- Mlekovita
- Ryki
- Go Vege
- Vemondo
- linia „active protein plus” (i podobne nazwy linii produktowych)

## Znane pułapki danych

- **Duplikaty składników** — ten sam składnik dwa razy w przepisie („Sól (0,5g)” i „Sól (0,3g)”); nie scalać, zostają dwie pozycje.
- **Nawiasy w nazwach, które nie są ilością** — „(biała)”, „(z łopatki)”; ilością jest tylko ostatni nawias na końcu pozycji w postaci `(liczba jednostka)`.
- **`;` wewnątrz `[...]`** — średnik w bloku zamienników nie dzieli składników; dlatego bloki `[zamiennik(i): …]` wydziela się przed podziałem.
- **Separator `;` bez spacji przed** — obok `składnik ; składnik` występuje `składnik; składnik`; dzielić po samym `;` i przycinać części, nie po „spacja + `;`”.
- **Przecinek w nazwie** — w układzie „- 120 g” przecinek dzieli pozycje tylko po ilości lub po `]`.
- **Różne zapisy ilości** — `5g`, `0,3 g`, `0.3g`, `1szczypta` (bez spacji, przecinek lub kropka dziesiętna).
- **Kcal na całość vs na porcję** — patrz reguła autorki wyżej.

## Granica walidacji

Baza (CHECK-i) sprawdza tylko kolumny: niepustą nazwę, co najmniej 1 krok, zakresy liczb, dozwolone `kinds` oraz to, że `ingredients` jest **niepustą tablicą JSON**. **Kształtu elementów `ingredients`** (`name`, `product`, `amount`, `unit`, `substitutes`) baza nie sprawdza — muszą go walidować piszący: formularz dodawania S-05 i import F-02. Typy TS w `src/types.ts` opisują kształt, ale nie walidują danych w czasie działania.
