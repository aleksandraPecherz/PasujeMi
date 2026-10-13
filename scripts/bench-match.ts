// Benchmark: parse stored match keys and rank 1000 synthetic recipes (deterministic data).
// Usage: npm run bench:match
import { computeMatchKeys, normalizeExclusion, normalizeTag, rankRecipes, type RankCandidate } from "@/lib/matching";
import type { MatchKeys, RecipeIngredient } from "@/types";

const RECIPES = 1000;
const RUNS = 50;

const PRODUCTS = [
  "pomidor",
  "pomidory z puszki",
  "passata pomidorowa",
  "cebula",
  "cebula czerwona",
  "czosnek świeży",
  "marchew",
  "seler korzeniowy",
  "ryż basmati",
  "ryż brązowy",
  "kasza gryczana niepalona (biała)",
  "makaron spaghetti pełnoziarnisty",
  "mięso mielone z indyka",
  "mięso mielone z kurczaka",
  "jogurt naturalny 2%",
  "jogurt roślinny",
  "mleko 1,5%",
  "mleko kokosowe",
  "napój sojowy",
  "ser gouda",
  "ser mozzarella kulka",
  "ser twarogowy półtłusty",
  "płatki owsiane górskie",
  "borówki amerykańskie, świeże lub mrożone",
  "orzechy włoskie",
  "miód",
  "syrop z agawy",
  "olej rzepakowy",
  "oliwa z oliwek",
  "sól",
  "pieprz czarny",
  "papryka słodka",
  "bazylia suszona",
  "chleb żytni razowy",
  "masło extra",
  "jajko",
  "mąka pszenna",
  "banan",
  "szpinak",
  "makrela wędzona",
];

// Small deterministic PRNG (mulberry32), so every run measures the same data.
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = random(42);
const pick = () => PRODUCTS[Math.floor(next() * PRODUCTS.length)];
const option = (product: string) => ({ name: product, product, amount: 100, unit: "g" });

// Shape of the author's Excel (76 recipes, 762 ingredients): 4–18 ingredients, about 10 per recipe;
// 56% of ingredients have no substitute, then 1 (19%), 2 (15%), 3 (7%), 4+ (3%); about 0.8 per ingredient.
const SUBSTITUTE_COUNTS = [
  [0.56, 0],
  [0.75, 1],
  [0.9, 2],
  [0.97, 3],
  [1, 4],
] as const;
const substituteCount = () => {
  const roll = next();
  return SUBSTITUTE_COUNTS.find(([upTo]) => roll < upTo)?.[1] ?? 0;
};

const rows: { id: string; name: string; match_keys: string }[] = [];
for (let r = 0; r < RECIPES; r++) {
  const ingredients: RecipeIngredient[] = [];
  const count = 6 + Math.floor(next() * 9);
  for (let i = 0; i < count; i++) {
    const substitutes = Array.from({ length: substituteCount() }, () => option(pick()));
    ingredients.push({ ...option(pick()), substitutes });
  }
  // Stored as the jsonb column arrives from PostgREST: one JSON document per row.
  rows.push({ id: `recipe-${r}`, name: `Przepis ${r}`, match_keys: JSON.stringify(computeMatchKeys(ingredients)) });
}

const pantry = {
  have: ["pomidory", "cebula", "czosnek", "sól", "pieprz", "jajka", "mleko", "ser", "chleb", "oliwa"].map(normalizeTag),
  exclude: ["orzechy", "mleko kokosowe"].flatMap(normalizeExclusion),
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

const parseTimes: number[] = [];
const rankTimes: number[] = [];
let ranked = 0;
for (let run = 0; run < RUNS; run++) {
  const parseStart = performance.now();
  const candidates: RankCandidate[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    keys: JSON.parse(row.match_keys) as MatchKeys,
  }));
  const rankStart = performance.now();
  ranked = rankRecipes(candidates, pantry).length;
  const end = performance.now();
  parseTimes.push(rankStart - parseStart);
  rankTimes.push(end - rankStart);
}

const parseMs = median(parseTimes);
const rankMs = median(rankTimes);
const keysKb = rows.reduce((sum, row) => sum + row.match_keys.length, 0) / 1024;
const options = rows.reduce((sum, row) => sum + (JSON.parse(row.match_keys) as MatchKeys).flat().length, 0);
console.log(`recipes: ${RECIPES}, runs: ${RUNS}, visible after exclusions: ${ranked}`);
console.log(`match_keys: ${keysKb.toFixed(0)} KB, ${options} options`);
console.log(`JSON.parse keys: median ${parseMs.toFixed(2)} ms`);
console.log(`rankRecipes:     median ${rankMs.toFixed(2)} ms`);
console.log(`total:           median ${(parseMs + rankMs).toFixed(2)} ms`);
