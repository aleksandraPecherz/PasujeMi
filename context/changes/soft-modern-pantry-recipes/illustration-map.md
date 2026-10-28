# Przypisanie ilustracji do przepisów

**Status: zaakceptowana przez autorkę (2026-10-28), bez przesunięć.** Gofry, placuszki, pancakes i batoniki zostają jako `deser`, zapiekanka makaronowa jako `makaron`. Mapa jest w `scripts/illustration-map.json`; zastosowanie w bazie (migracja i `--write`) to krok wdrożenia, jeszcze niewykonany.

_Poniżej oryginalna propozycja._

Źródło: lokalny `data/recipes.xlsx` (76 przepisów, odczyt tylko do czytania, nic nie zapisano). Przypisanie jest **jednorazowe**: aplikacja niczego nie dobiera automatycznie. Po akceptacji mapa trafi do `scripts/illustration-map.json` i zostanie użyta przez skrypt przypisania (podgląd domyślnie, zapis tylko z `--write`).

## Zestaw (12 ilustracji, wynik policzony z danych)

| Klucz           | Co przedstawia                                                                                       | Ton tła | Przepisy |
| --------------- | ---------------------------------------------------------------------------------------------------- | ------- | -------- |
| `kanapka`       | kanapka / grzanka z pastą, serem, warzywami                                                          | zielony | 11       |
| `kanapka-jajko` | pieczywo z jajkiem (jak w makiecie)                                                                  | zielony | 5        |
| `wrap`          | zwinięta tortilla, wrap                                                                              | żółty   | 4        |
| `placek`        | płaskie pieczywo: pizza, focaccia                                                                    | żółty   | 2        |
| `salatka`       | miska sałatki                                                                                        | zielony | 6        |
| `slodka-miska`  | owsianka, pudding, granola, komosa, ryż na słodko                                                    | liliowy | 11       |
| `szklanka`      | koktajl                                                                                              | liliowy | 2        |
| `deser`         | ciasto, tarta, babeczki, gofry, placuszki, batoniki                                                  | liliowy | 13       |
| `zupa`          | zupa krem                                                                                            | różowy  | 1        |
| `makaron`       | spaghetti, zapiekanki makaronowe                                                                     | żółty   | 5        |
| `miska`         | curry, chilli, dal, gulasz, dania jednogarnkowe                                                      | różowy  | 9        |
| `talerz`        | neutralny talerz (bez wyraźnego mięsa lub ryby): dania z mięsem, rybą, pierogi, śniadanie angielskie | różowy  | 7        |

Próbki stylu dla `kanapka-jajko`, `slodka-miska` i `talerz`: `preview/index.html` (jasne i ciemne tło). Pozostałe rysunki powstaną dopiero po akceptacji stylu próbek.
Zmiany względem makiety: bez osobnego „caprese” i „ciasta” (nie ma dla nich przepisów — „ciasto” łączę z deserami), z dodanymi „wrap”, „placek”, „makaron”, „miska”, „talerz”, „szklanka”, bo bez nich ponad 20 przepisów trafiłoby na obraz zastępczy lub dostałoby nieprawdziwy rysunek (pizza nie jest zwiniętą tortillą). Zupa (1) ma własną ilustrację, bo to odrębne danie, a obraz z makiety już jest.
Obraz zastępczy (widelec i nóż, neutralne tło) zostaje dla przepisów bez przypisania, w tym dodawanych przez użytkowników.

## Przypisanie

| #   | Przepis                                                                                         | Ilustracja      |
| --- | ----------------------------------------------------------------------------------------------- | --------------- |
| 2   | Angielskie śniadanie                                                                            | `talerz`        |
| 3   | Babeczki z borówkami                                                                            | `deser`         |
| 4   | Babeczki z jogurtem naturalnym                                                                  | `deser`         |
| 5   | Sałatka z serem brie, winogronami oraz orzechami włoskimi i grzankami                           | `salatka`       |
| 6   | Pierogi ze szpinakiem                                                                           | `talerz`        |
| 7   | Bruschetta z burratą                                                                            | `kanapka`       |
| 8   | Ciasto marchewkowe z kakao                                                                      | `deser`         |
| 9   | Cynamonowy ryż z musem jabłkowym i lodami                                                       | `slodka-miska`  |
| 10  | Cytrynowo herbaciany deser ala tiramisu                                                         | `deser`         |
| 11  | Czekoladowa komosanka                                                                           | `slodka-miska`  |
| 12  | Czekoladowa owsianka z borówkami                                                                | `slodka-miska`  |
| 13  | Czekoladowa owsianka z migdałami                                                                | `slodka-miska`  |
| 14  | Czekoladowa owsianka z owocami                                                                  | `slodka-miska`  |
| 15  | Czekoladowe babeczki z bananami                                                                 | `deser`         |
| 16  | Dietetyczne Wrapy                                                                               | `wrap`          |
| 17  | Koktajl bananowo-truskawkowy                                                                    | `szklanka`      |
| 18  | Domowa granola z bananem oraz malinami                                                          | `slodka-miska`  |
| 19  | Focaccia z cukinią oraz pomidorkami koktajlowymi                                                | `placek`        |
| 20  | Gofry twarogowe z sosem malinowym                                                               | `deser`         |
| 21  | Gulasz z indyka z warzywami i pęczakiem                                                         | `miska`         |
| 22  | Gyros bowl                                                                                      | `miska`         |
| 23  | Halloumi z sosem warzywnym i ryżem                                                              | `miska`         |
| 24  | Indyk nadziewany szpinakiem, suszonymi pomidorami, serem typu feta, ziemniakami oraz kalafiorem | `talerz`        |
| 25  | Kanapka z jajkiem sadzonym                                                                      | `kanapka-jajko` |
| 26  | Kanapka z pastą z czerwonej fasoli konserwowej                                                  | `kanapka`       |
| 27  | Kanapka z pastą z awokado i pieczonym kurczakiem                                                | `kanapka`       |
| 28  | Kanapka z pastą z makreli oraz jajka                                                            | `kanapka`       |
| 29  | Kanapka z pastą z jajka oraz awokado                                                            | `kanapka-jajko` |
| 30  | Kanapka z pesto i szynką                                                                        | `kanapka`       |
| 31  | Kanapka z pesto, pomidorami koktajlowymi i mozzarellą                                           | `kanapka`       |
| 32  | Kanapka z serem, szynką i ogórkiem                                                              | `kanapka`       |
| 33  | Kanapki z jajkiem oraz awokado                                                                  | `kanapka-jajko` |
| 34  | Kanapki z kurczakiem, jajkiem i awokado                                                         | `kanapka`       |
| 35  | Kanapki z pastą z jajka i serka wiejskiego                                                      | `kanapka-jajko` |
| 36  | Placuszki twarogowe z tofu w malinowym sosie                                                    | `deser`         |
| 37  | Pudding czekoladowy z truskawkami                                                               | `slodka-miska`  |
| 38  | Pudding czekoladowy z wiśniami                                                                  | `slodka-miska`  |
| 39  | Pudding na mleku roślinnym z gorzką czekoladą oraz malinami                                     | `slodka-miska`  |
| 40  | Sałatka z kurczakiem oraz serem grana padano i grzankami                                        | `salatka`       |
| 41  | Batoniki orzechowo czekoladowe                                                                  | `deser`         |
| 42  | Gofry z serkiem wiejskim i owocami                                                              | `deser`         |
| 43  | Grzanka z jajkiem sadzonym i cebulką                                                            | `kanapka-jajko` |
| 44  | Sałatka z melonem, serem typu feta oraz brzoskwinią                                             | `salatka`       |
| 45  | Sałatka z octem balsamicznym                                                                    | `salatka`       |
| 46  | Sałatka z pesto                                                                                 | `salatka`       |
| 47  | Sałatka z pieczonego batata oraz ciecierzycy                                                    | `salatka`       |
| 48  | Tarta z jabłkami z kratką                                                                       | `deser`         |
| 49  | Tofu wędzone z pieczywem i ogórkiem kiszonym                                                    | `kanapka`       |
| 50  | Tofucznica z awokado, pomidorem i pieczywem                                                     | `kanapka`       |
| 51  | Torcik galaretkowy                                                                              | `deser`         |
| 52  | Tortilla z kurczakiem, warzywami i serem typu feta                                              | `wrap`          |
| 53  | Tortilla z serkiem śmietankowym, kurczakiem gotowanym na parze i warzywami                      | `wrap`          |
| 54  | Tortilla z szynką z kurczaka i warzywami                                                        | `wrap`          |
| 55  | Truskawkowa owsianka na zimno                                                                   | `slodka-miska`  |
| 56  | Twarożek z makrelą, porem, szpinakiem oraz ogórkiem kiszonym i pieczywem                        | `kanapka`       |
| 57  | Zapiekany łosoś z kremowym sosem pomidorowym                                                    | `talerz`        |
| 58  | Ekspresowa pizza                                                                                | `placek`        |
| 59  | Jesienne pancakes z przyprawą do piernika                                                       | `deser`         |
| 60  | Kokosowa owsianka z czekoladą i malinami                                                        | `slodka-miska`  |
| 61  | Kremowy koktajl z mango oraz banana                                                             | `szklanka`      |
| 62  | Mini tarty z truskawkami i jogurtem                                                             | `deser`         |
| 63  | Chilli z mięsem                                                                                 | `miska`         |
| 64  | Chilli z wołowiną i warzywami                                                                   | `miska`         |
| 65  | Curry z bakłażanem                                                                              | `miska`         |
| 66  | Czerwone curry z ryżem                                                                          | `miska`         |
| 67  | Dal z marchwią                                                                                  | `miska`         |
| 68  | Danie jednogarnkowe z mięsem                                                                    | `miska`         |
| 69  | Danie makaronowe z mięsem mielonym a la spaghetti                                               | `makaron`       |
| 70  | Delikatne pulpeciki mięsne w sosie pomidorowo warzywnym z makaronem                             | `makaron`       |
| 71  | Delikatny kurczak pieczony z ziemniakami i mizerią                                              | `talerz`        |
| 72  | Dietetyczne spaghetti carbonara                                                                 | `makaron`       |
| 73  | Domowa zupa pomidorowa z klopsikami                                                             | `zupa`          |
| 74  | Domowe spaghetti                                                                                | `makaron`       |
| 75  | Dorsz z ziemniakami i kiszoną kapustą                                                           | `talerz`        |
| 76  | Dorsz z ziemniakami, szpinakiem oraz pomidorkami koktajlowymi                                   | `talerz`        |
| 77  | Drobiowa zapiekanka makaronowa z brokułem i roztopionym serem                                   | `makaron`       |

Numer to wiersz w arkuszu. Suma: 76 przepisów, każdy dokładnie raz. Skrypt przypisania zweryfikuje to offline (`--check`: każda nazwa z arkusza ma jeden wpis, żaden wpis nie jest nadmiarowy, a klucze są znane), zanim cokolwiek dotknie bazy.

## Przepisy wątpliwe (rozstrzygnięte: zostają bez zmian)

- 6 Pierogi ze szpinakiem → `talerz` (neutralny, jedyny taki przepis).
- 29, 35 pasty jajeczne → `kanapka-jajko`, ale 28 (makrela + jajko) i 34 (kurczak, jajko, awokado) → `kanapka`; granica jest umowna.
- 19 Focaccia z cukinią i pomidorkami → `placek` (razem z pizzą).
