-- F-01 test recipes: 5 real recipes from the author's local data/recipes.xlsx, converted by hand
-- according to docs/reference/recipe-data-contract.md. Loaded only by `supabase start` / `db reset`
-- (local and CI); never pushed to production.

-- Babeczki z jogurtem naturalnym: 10 ingredients, 9 steps
insert into public.recipes (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g)
values (
  'Babeczki z jogurtem naturalnym',
  array[
    'Rozgrzewamy piekarnik do 180°C, tryb góra-dół (lub 160°C termoobieg). Ustawiamy środkową półkę.',
    'Bardzo dokładnie rozgniatamy banana widelcem, aż do uzyskania jednolitej masy.',
    'Dodajemy płatki owsiane, miód, sól, cynamon oraz ekstrakt waniliowy. Mieszamy do uzyskania gęstej, kleistej masy.',
    'Foremki do muffinek (najlepiej silikonowe, standardowy rozmiar) smarujemy olejem.',
    'Do każdej foremki nakładamy masę, formując łyżeczką kształt małych miseczek – wykładamy dno i boki, zostawiając miejsce na nadzienie.',
    'Wkładamy foremki do piekarnika i pieczemy przez około 20 minut – do lekkiego zrumienienia brzegów i zwartej struktury.',
    'Po upieczeniu wyjmujemy z piekarnika i zostawiamy do całkowitego ostudzenia przed wyjęciem z foremek – masa bez jajka jest delikatna na ciepło.',
    'Do wnętrza każdej babeczki nakładamy jogurt naturalny. Dla osłodzenia mieszamy go wcześniej z erytrolem wedle uznania.',
    'Dekorujemy każdą babeczkę borówkami. Jeśli używamy mrożonych owoców, warto je wcześniej rozmrozić.'
  ]::text[],
  '[
    {"name": "Banan", "product": "banan", "amount": 120, "unit": "g", "substitutes": []},
    {"name": "Płatki owsiane górskie", "product": "płatki owsiane górskie", "amount": 120, "unit": "g", "substitutes": [{"name": "płatki orkiszowe", "product": "płatki orkiszowe", "amount": 125, "unit": "g"}]},
    {"name": "Miód", "product": "miód", "amount": 18, "unit": "g", "substitutes": [{"name": "syrop z agawy", "product": "syrop z agawy", "amount": 20, "unit": "g"}, {"name": "syrop klonowy", "product": "syrop klonowy", "amount": 25, "unit": "g"}]},
    {"name": "Sól", "product": "sól", "amount": 0.3, "unit": "g", "substitutes": []},
    {"name": "Cynamon mielony", "product": "cynamon mielony", "amount": 2, "unit": "g", "substitutes": []},
    {"name": "Wanilia ekstrakt", "product": "wanilia ekstrakt", "amount": 3, "unit": "g", "substitutes": []},
    {"name": "Olej rzepakowy", "product": "olej rzepakowy", "amount": 5, "unit": "g", "substitutes": [{"name": "oliwa z oliwek", "product": "oliwa z oliwek", "amount": 5, "unit": "g"}]},
    {"name": "Jogurt naturalny 2%", "product": "jogurt naturalny 2%", "amount": 120, "unit": "g", "substitutes": [{"name": "jogurt roślinny", "product": "jogurt roślinny", "amount": 110, "unit": "g"}, {"name": "jogurt naturalny bez laktozy", "product": "jogurt naturalny bez laktozy", "amount": 110, "unit": "g"}]},
    {"name": "Erytol", "product": "erytol", "amount": 10, "unit": "g", "substitutes": []},
    {"name": "Borówki amerykańskie, świeże lub mrożone", "product": "borówki amerykańskie, świeże lub mrożone", "amount": 100, "unit": "g", "substitutes": [{"name": "jabłko", "product": "jabłko", "amount": 115, "unit": "g"}, {"name": "kiwi", "product": "kiwi", "amount": 95, "unit": "g"}, {"name": "maliny świeże lub mrożone", "product": "maliny świeże lub mrożone", "amount": 135, "unit": "g"}, {"name": "truskawki świeże lub mrożone", "product": "truskawki świeże lub mrożone", "amount": 175, "unit": "g"}, {"name": "mango świeże lub mrożone", "product": "mango świeże lub mrożone", "amount": 85, "unit": "g"}]}
  ]'::jsonb,
  30, 2, array['na słodko', 'na ciepło']::text[],
  406, 11, 75, 8
);

-- Kanapka z serem, szynką i ogórkiem: 7 ingredients, 2 steps
insert into public.recipes (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g)
values (
  'Kanapka z serem, szynką i ogórkiem',
  array[
    'Pieczywo smarujemy masłem, nakładamy szynkę i ser.',
    'Ogórka kroimy na kawałki. Kanapki podajemy z ogórkiem.'
  ]::text[],
  '[
    {"name": "chleb żytni razowy", "product": "chleb żytni razowy", "amount": 60, "unit": "g", "substitutes": [{"name": "chleb bezglutenowy", "product": "chleb bezglutenowy", "amount": 50, "unit": "g"}, {"name": "chleb graham", "product": "chleb graham", "amount": 60, "unit": "g"}]},
    {"name": "masło extra", "product": "masło extra", "amount": 15, "unit": "g", "substitutes": []},
    {"name": "szynka z kurczaka", "product": "szynka z kurczaka", "amount": 30, "unit": "g", "substitutes": [{"name": "szynka z indyka", "product": "szynka z indyka", "amount": 35, "unit": "g"}]},
    {"name": "ser gouda", "product": "ser gouda", "amount": 30, "unit": "g", "substitutes": [{"name": "ser mozzarella kulka", "product": "ser mozzarella kulka", "amount": 35, "unit": "g"}, {"name": "ser cheddar", "product": "ser cheddar", "amount": 25, "unit": "g"}, {"name": "ser żółty active protein plus Ryki", "product": "ser żółty", "amount": 50, "unit": "g"}]},
    {"name": "ogórek małosolny", "product": "ogórek małosolny", "amount": 100, "unit": "g", "substitutes": [{"name": "ogórek kiszony", "product": "ogórek kiszony", "amount": 100, "unit": "g"}]},
    {"name": "pomidor", "product": "pomidor", "amount": 65, "unit": "g", "substitutes": []},
    {"name": "papryka czerwona", "product": "papryka czerwona", "amount": 40, "unit": "g", "substitutes": []}
  ]'::jsonb,
  5, 1, array['na wytrawnie', 'na zimno']::text[],
  385, 19, 33, 21
);

-- Twarożek z makrelą, porem, szpinakiem oraz ogórkiem kiszonym i pieczywem: 9 ingredients, 4 steps
insert into public.recipes (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g)
values (
  'Twarożek z makrelą, porem, szpinakiem oraz ogórkiem kiszonym i pieczywem',
  array[
    'Rybę obieramy ze skóry i ości',
    'Drobno kroimy pora oraz ogórka kiszonego',
    'Do miski przekładamy ser twarogowy, makrelę, pora, ogórka kiszonego oraz oliwę i dokładnie mieszamy. W razie potrzeby przyprawiamy solą i pieprzem',
    'Pastę podajemy z pieczywem i szpinakiem.'
  ]::text[],
  '[
    {"name": "Ser twarogowy półtłusty", "product": "ser twarogowy półtłusty", "amount": 60, "unit": "g", "substitutes": [{"name": "Ser twarogowy półtłusty bez laktozy", "product": "ser twarogowy półtłusty bez laktozy", "amount": 65, "unit": "g"}]},
    {"name": "Por", "product": "por", "amount": 35, "unit": "g", "substitutes": [{"name": "Cebula", "product": "cebula", "amount": 30, "unit": "g"}, {"name": "Cebula czerwona", "product": "cebula czerwona", "amount": 25, "unit": "g"}]},
    {"name": "Makrela wędzona", "product": "makrela wędzona", "amount": 50, "unit": "g", "substitutes": [{"name": "Łosoś wędzony na zimno", "product": "łosoś wędzony na zimno", "amount": 70, "unit": "g"}, {"name": "Tuńczyk w sosie własnym", "product": "tuńczyk w sosie własnym", "amount": 115, "unit": "g"}, {"name": "Pstrąg wędzony na zimno", "product": "pstrąg wędzony na zimno", "amount": 75, "unit": "g"}]},
    {"name": "Ogórek kiszony", "product": "ogórek kiszony", "amount": 100, "unit": "g", "substitutes": [{"name": "Ogórek świeży", "product": "ogórek świeży", "amount": 85, "unit": "g"}, {"name": "Ogórek małosolny", "product": "ogórek małosolny", "amount": 100, "unit": "g"}, {"name": "Ogórek konserwowy", "product": "ogórek konserwowy", "amount": 50, "unit": "g"}]},
    {"name": "Chleb żytni razowy", "product": "chleb żytni razowy", "amount": 60, "unit": "g", "substitutes": [{"name": "Chleb bezglutenowy", "product": "chleb bezglutenowy", "amount": 50, "unit": "g"}, {"name": "Chleb graham", "product": "chleb graham", "amount": 60, "unit": "g"}]},
    {"name": "Szpinak", "product": "szpinak", "amount": 15, "unit": "g", "substitutes": [{"name": "Miks sałat", "product": "miks sałat", "amount": 20, "unit": "g"}, {"name": "Roszponka", "product": "roszponka", "amount": 15, "unit": "g"}, {"name": "Rukola", "product": "rukola", "amount": 15, "unit": "g"}]},
    {"name": "Sól", "product": "sól", "amount": 1, "unit": "szczypta", "substitutes": []},
    {"name": "Pieprz czarny", "product": "pieprz czarny", "amount": 1, "unit": "szczypta", "substitutes": []},
    {"name": "Oliwa z oliwek", "product": "oliwa z oliwek", "amount": 5, "unit": "g", "substitutes": [{"name": "Olej rzepakowy", "product": "olej rzepakowy", "amount": 5, "unit": "g"}]}
  ]'::jsonb,
  10, 1, array['na zimno', 'na wytrawnie']::text[],
  397, 27, 37, 17
);

-- Danie jednogarnkowe z mięsem: 11 ingredients, 5 steps
insert into public.recipes (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g)
values (
  'Danie jednogarnkowe z mięsem',
  array[
    'Na głębokiej patelni rozgrzewamy olej. Cebulę, czosnek oraz marchew kroimy w drobną kosteczkę i podsmażamy ok. 5 min, mieszając.',
    'Dodajemy mięso, paprykę słodką, sól oraz sos sojowy i podsmażamy 5 min. Dodajemy ryż, mieszamy i chwilę podgrzewamy.',
    'Dodajemy pomidory z puszki, mieszamy i dusimy pod przykryciem ok. 20 min. Doprawiamy do smaku. Jeśli sos jest zbyt gęsty – dolewamy gorący bulion lub wodę; jeśli zbyt rzadki – gotujemy dłużej, aż się zredukuje.',
    'Zdejmujemy z ognia, przykrywamy i odstawiamy na 10 min.',
    'Podajemy z natką pietruszki. Smacznego!'
  ]::text[],
  '[
    {"name": "Ryż basmati", "product": "ryż basmati", "amount": 25, "unit": "g", "substitutes": [{"name": "Ryż brązowy", "product": "ryż brązowy", "amount": 30, "unit": "g"}, {"name": "Kasza gryczana niepalona (biała)", "product": "kasza gryczana niepalona (biała)", "amount": 25, "unit": "g"}, {"name": "Kasza jęczmienna pęczak", "product": "kasza jęczmienna pęczak", "amount": 25, "unit": "g"}, {"name": "Ryż jaśminowy", "product": "ryż jaśminowy", "amount": 25, "unit": "g"}]},
    {"name": "Mięso mielone z indyka", "product": "mięso mielone z indyka", "amount": 125, "unit": "g", "substitutes": [{"name": "Mięso mielone z kurczaka", "product": "mięso mielone z kurczaka", "amount": 120, "unit": "g"}]},
    {"name": "Pomidory z puszki", "product": "pomidory z puszki", "amount": 200, "unit": "g", "substitutes": [{"name": "Passata pomidorowa", "product": "passata pomidorowa", "amount": 140, "unit": "g"}]},
    {"name": "Cebula", "product": "cebula", "amount": 40, "unit": "g", "substitutes": [{"name": "Cebula czerwona", "product": "cebula czerwona", "amount": 35, "unit": "g"}, {"name": "Cebula dymka", "product": "cebula dymka", "amount": 40, "unit": "g"}]},
    {"name": "Czosnek świeży", "product": "czosnek świeży", "amount": 6, "unit": "g", "substitutes": []},
    {"name": "Marchew", "product": "marchew", "amount": 40, "unit": "g", "substitutes": [{"name": "Seler korzeniowy", "product": "seler korzeniowy", "amount": 45, "unit": "g"}, {"name": "Pietruszka korzeń", "product": "pietruszka korzeń", "amount": 25, "unit": "g"}]},
    {"name": "Natka pietruszki posiekana", "product": "natka pietruszki posiekana", "amount": 10, "unit": "g", "substitutes": [{"name": "Szczypiorek siekany", "product": "szczypiorek siekany", "amount": 15, "unit": "g"}, {"name": "Koperek suszony", "product": "koperek suszony", "amount": 2, "unit": "g"}]},
    {"name": "Olej rzepakowy", "product": "olej rzepakowy", "amount": 5, "unit": "g", "substitutes": [{"name": "Oliwa z oliwek", "product": "oliwa z oliwek", "amount": 5, "unit": "g"}]},
    {"name": "Papryka słodka", "product": "papryka słodka", "amount": 0.5, "unit": "g", "substitutes": [{"name": "Papryka ostra suszona", "product": "papryka ostra suszona", "amount": 0.5, "unit": "g"}, {"name": "Papryka wędzona", "product": "papryka wędzona", "amount": 0.5, "unit": "g"}]},
    {"name": "Sól", "product": "sól", "amount": 0.3, "unit": "g", "substitutes": []},
    {"name": "Sos sojowy", "product": "sos sojowy", "amount": 5, "unit": "g", "substitutes": []}
  ]'::jsonb,
  40, 1, array['na ciepło', 'na wytrawnie']::text[],
  396, 29, 37, 11
);

-- Domowe spaghetti: 11 ingredients, 8 steps
insert into public.recipes (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g)
values (
  'Domowe spaghetti',
  array[
    'Makaron gotujemy według instrukcji na opakowaniu',
    'Cebulę oraz czosnek obieramy i drobno siekamy',
    'Na patelni rozgrzewamy oliwę, dodajemy cebulę i podsmażamy do zarumienienia',
    'Dodajemy czosnek i smażymy chwilę',
    'Dodajemy mięso, mieszamy i smażymy aż będzie gotowe',
    'Dodajemy pomidory z puszki i dusimy aż sos zgęstnieje',
    'Doprawiamy bazylią oraz oregano',
    'Makaron polewamy sosem i posypujemy parmezanem'
  ]::text[],
  '[
    {"name": "Makaron spaghetti pełnoziarnisty", "product": "makaron spaghetti pełnoziarnisty", "amount": 90, "unit": "g", "substitutes": [{"name": "Makaron spaghetti", "product": "makaron spaghetti", "amount": 90, "unit": "g"}, {"name": "Makaron bezglutenowy", "product": "makaron bezglutenowy", "amount": 90, "unit": "g"}]},
    {"name": "Mięso mielone z kurczaka", "product": "mięso mielone z kurczaka", "amount": 200, "unit": "g", "substitutes": [{"name": "Mięso mielone z indyka", "product": "mięso mielone z indyka", "amount": 210, "unit": "g"}]},
    {"name": "Pomidory z puszki", "product": "pomidory z puszki", "amount": 400, "unit": "g", "substitutes": [{"name": "Passata pomidorowa", "product": "passata pomidorowa", "amount": 285, "unit": "g"}]},
    {"name": "Cebula", "product": "cebula", "amount": 80, "unit": "g", "substitutes": [{"name": "Cebula czerwona", "product": "cebula czerwona", "amount": 65, "unit": "g"}, {"name": "Cebula dymka", "product": "cebula dymka", "amount": 85, "unit": "g"}]},
    {"name": "Czosnek świeży", "product": "czosnek świeży", "amount": 6, "unit": "g", "substitutes": []},
    {"name": "Oliwa z oliwek", "product": "oliwa z oliwek", "amount": 5, "unit": "g", "substitutes": [{"name": "Olej rzepakowy", "product": "olej rzepakowy", "amount": 5, "unit": "g"}]},
    {"name": "Sól", "product": "sól", "amount": 0.3, "unit": "g", "substitutes": []},
    {"name": "Parmezan starty", "product": "parmezan starty", "amount": 10, "unit": "g", "substitutes": [{"name": "Ser Grana Padano starty", "product": "ser grana padano starty", "amount": 10, "unit": "g"}]},
    {"name": "Pieprz czarny", "product": "pieprz czarny", "amount": 0.3, "unit": "g", "substitutes": []},
    {"name": "Bazylia suszona", "product": "bazylia suszona", "amount": 4, "unit": "g", "substitutes": [{"name": "Zioła prowansalskie", "product": "zioła prowansalskie", "amount": 3.5, "unit": "g"}]},
    {"name": "Oregano suszone", "product": "oregano suszone", "amount": 3, "unit": "g", "substitutes": []}
  ]'::jsonb,
  30, 2, array['na ciepło', 'na wytrawnie']::text[],
  422, 31, 41, 14
);
