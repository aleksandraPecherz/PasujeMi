import { describe, expect, it } from "vitest";
import { computeMatchKeys, normalizeExclusion, normalizeTag } from "@/lib/matching/keys";
import { rankRecipes, resolveMatch, type RankedRecipe } from "@/lib/matching/rank";
import type { RecipeIngredient } from "@/types";

/** Ingredient spec: "product" or ["main product", "substitute", …]. */
type Spec = string | string[];

function ingredients(specs: Spec[]): RecipeIngredient[] {
  return specs.map((spec) => {
    const [main, ...substitutes] = typeof spec === "string" ? [spec] : spec;
    return {
      name: main,
      product: main,
      amount: null,
      unit: null,
      substitutes: substitutes.map((product) => ({ name: product, product, amount: null, unit: null })),
    };
  });
}

function recipe(id: string, specs: Spec[], name = id) {
  const items = ingredients(specs);
  return { id, name, items, keys: computeMatchKeys(items) };
}

function rank(recipes: ReturnType<typeof recipe>[], have: string[], exclude: string[] = []): RankedRecipe[] {
  return rankRecipes(recipes, { have: have.map(normalizeTag), exclude: exclude.flatMap(normalizeExclusion) });
}

function one(specs: Spec[], have: string[], exclude: string[] = []) {
  const r = recipe("r", specs);
  const ranked = rank([r], have, exclude).at(0);
  return ranked === undefined ? undefined : resolveMatch(ranked.match, r.items);
}

describe("owned products", () => {
  it("pomidor + chleb + mozzarella → mozzarella z pomidorem = 100%", () => {
    const result = one(["mozzarella", "pomidor"], ["pomidor", "chleb", "mozzarella"]);
    expect(result?.percent).toBe(100);
  });

  it.each([
    ["pomidory", "pomidor"],
    ["jajek", "jajko"],
    ["soli", "sól"],
    ["czosnku", "czosnek świeży"],
    ["SÓL", "sól"],
    ["sol", "sól"],
    ["mozarella", "ser mozzarella kulka"],
    ["kartofel", "ziemniaki"],
  ])("tag %s owns %s", (tag, product) => {
    expect(one([product], [tag])?.ingredients[0].status).toBe("have");
  });

  it.each([
    ["sól", "sok"],
    ["ryż", "ryby"],
    ["mąka", "mak"],
    ["mak", "mąka pszenna"],
  ])("tag %s does not own %s", (tag, product) => {
    expect(one([product], [tag])?.ingredients[0].status).toBe("unknown");
  });

  it.each([
    ["mleko", "mleko 1,5%", "have"],
    ["jogurt naturalny", "jogurt", "have"],
    ["mleko", "mleko kokosowe", "unknown"],
    ["mleko kokosowe", "mleko", "unknown"],
    ["kokosowe", "mleko kokosowe", "unknown"],
  ])("tag %s → %s: %s", (tag, product, status) => {
    expect(one([product], [tag])?.ingredients[0].status).toBe(status);
  });

  it.todo("tag ser owns serek: dictionary gap R1, the fix needs a dictionary change and a MATCH_KEYS_VERSION bump");

  it.todo("tag cukier owns cukru: dictionary gap R1, the fix needs a dictionary change and a MATCH_KEYS_VERSION bump");

  it("a substitute gives 'have' and names itself in via", () => {
    const result = one([["miód", "syrop z agawy"]], ["syrop z agawy"]);
    expect(result?.ingredients[0]).toEqual({ status: "have", mainExcluded: false, via: "syrop z agawy" });
  });

  it("an owned main option has no via", () => {
    const result = one([["miód", "syrop z agawy"]], ["miód", "syrop z agawy"]);
    expect(result?.ingredients[0]).toEqual({ status: "have", mainExcluded: false, via: null });
  });
});

describe("exclusions", () => {
  it.each([
    ["orzechy", "orzechy włoskie", true],
    ["mleko", "mleko kokosowe", true],
    ["mleko kokosowe", "mleko", false],
    ["kokosowe", "mleko kokosowe", true],
    ["sojowe", "mleko sojowe", true],
    ["mąka", "maka pszenna", true],
    ["mąka", "mak", false],
    ["orzechy włoskie", "orzechy", false],
  ])("exclusion %s hides %s: %s", (exclusion, product, hidden) => {
    expect(one([product, "sól"], ["sól"], [exclusion]) === undefined).toBe(hidden);
  });

  it.each([
    ["pomidory", "pomidor", true],
    ["mleka", "mleko kokosowe", true],
    ["ORZECHY", "orzechy włoskie", true],
    ["orzechy wloskie", "orzechy włoskie", true],
    ["mozarella", "ser mozzarella kulka", true],
    ["kartofel", "ziemniaki", true],
    ["ziemniak", "kartofle", true],
    ["mleko", "mleko owsiane", true],
    // Deliberate boundary, not a bug: typos are tolerated only for keys of 4+ characters (keys.ts MIN_FUZZY_LENGTH).
    ["sir", "ser", false],
  ])("exclusion in another form %s hides %s: %s", (exclusion, product, hidden) => {
    expect(one([product, "sól"], ["sól"], [exclusion]) === undefined).toBe(hidden);
  });

  it("an exclusion in another form hides a variant option but not a substitute that is another product", () => {
    expect(one([["mleko", "mleko kokosowe"]], [], ["mleka"])).toBeUndefined();
    expect(one([["mleko", "napój sojowy"]], [], ["mleka"])).toBeDefined();
  });

  it.each([
    ["maka", "mąka pszenna", true],
    ["maka", "mak", true],
    ["maki", "mąka pszenna", true],
    ["mąka", "mak", false],
    ["mak", "mąka pszenna", false],
    ["mak", "mak", true],
  ])("ambiguous exclusion %s hides %s: %s", (exclusion, product, hidden) => {
    expect(one([product, "sól"], ["sól"], [exclusion]) === undefined).toBe(hidden);
  });

  it.todo(
    "exclusion mleko hides napój sojowy: dictionary gap R1, the fix needs a dictionary change and a MATCH_KEYS_VERSION bump",
  );

  it("an ambiguous owned word keeps one reading: maka counts as mąka", () => {
    expect(one(["mąka pszenna"], ["maka"])?.ingredients[0].status).toBe("have");
    expect(one(["mąka"], ["Maka"])?.ingredients[0].status).toBe("have");
    expect(one(["mak"], ["maka"])?.ingredients[0].status).toBe("unknown");
  });

  it("blocks an ingredient only when all its options are excluded", () => {
    expect(one([["mleko", "mleko kokosowe"]], [], ["mleko"])).toBeUndefined();
    expect(one([["mleko", "napój sojowy"]], [], ["mleko"])).toBeDefined();
  });

  it("an excluded option never gives 'have', even when owned", () => {
    const result = one([["mleko", "napój sojowy"]], ["mleko"], ["mleko"]);
    expect(result?.ingredients[0]).toEqual({ status: "unknown", mainExcluded: true, via: "napój sojowy" });
  });

  it("an excluded substitute does not give 'have'", () => {
    const result = one([["masło", "orzechy włoskie"]], ["orzechy włoskie"], ["orzechy"]);
    expect(result?.ingredients[0]).toEqual({ status: "unknown", mainExcluded: false, via: null });
  });

  it("an excluded main option points to the first allowed substitute, even with status unknown", () => {
    const specs = [["jogurt naturalny 2%", "jogurt roślinny", "jogurt naturalny bez laktozy"], "sól"];
    expect(one(specs, ["sól"], ["jogurt naturalny"])?.ingredients[0]).toEqual({
      status: "unknown",
      mainExcluded: true,
      via: "jogurt roślinny",
    });
    expect(one(specs, ["jogurt roślinny"], ["jogurt naturalny"])?.ingredients[0]).toEqual({
      status: "have",
      mainExcluded: true,
      via: "jogurt roślinny",
    });
  });

  it("an option with no keys is neither owned nor excluded", () => {
    const result = one(["1,5%"], ["mleko"], ["mleko"]);
    expect(result?.ingredients[0].status).toBe("unknown");
  });
});

describe("percent and order", () => {
  it("counts duplicates separately", () => {
    expect(one(["sól", "sól", "pieprz"], ["sól"])?.percent).toBe(67);
  });

  it("scrambled eggs with only the egg owned = 33%", () => {
    expect(one(["jajko", "sól", "pieprz"], ["jajko"])?.percent).toBe(33);
  });

  it("an ingredient available through a substitute counts as available: 100%", () => {
    expect(one([["miód", "syrop z agawy"]], ["syrop z agawy"])?.percent).toBe(100);
  });

  it("sorts by exact fraction, then more available, then name; keeps 0% at the end", () => {
    const recipes = [
      recipe("zero", ["kawa"], "A zero"),
      recipe("two", ["sól", "pieprz"], "B dwa"),
      recipe("five", ["sól", "pieprz", "cebula", "czosnek", "marchew"], "C pięć"),
      recipe("half-small", ["sól", "kawa"], "D pół"),
      recipe("half-big", ["sól", "pieprz", "cebula", "kawa", "herbata", "kakao"], "E pół"),
      recipe("two-twin", ["sól", "pieprz"], "Ą dwa"),
    ];
    const ranked = rank(recipes, ["sól", "pieprz", "cebula", "czosnek", "marchew"]);
    expect(ranked.map((r) => r.id)).toEqual(["five", "two-twin", "two", "half-big", "half-small", "zero"]);
    expect(ranked.map((r) => r.match.percent)).toEqual([100, 100, 100, 50, 50, 0]);
  });

  it("uses id as the last tie-break", () => {
    const ranked = rank([recipe("b", ["sól"], "Same"), recipe("a", ["sól"], "Same")], ["sól"]);
    expect(ranked.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("exclusions only: no percent, exclusions apply, ordered by name", () => {
    const recipes = [
      recipe("1", ["orzechy włoskie"], "Ciasto"),
      recipe("2", ["sól"], "Zupa"),
      recipe("3", ["pieprz"], "Ąbc"),
    ];
    const ranked = rank(recipes, [], ["orzechy"]);
    expect(ranked.map((r) => r.id)).toEqual(["3", "2"]);
    expect(ranked.every((r) => r.match.percent === null)).toBe(true);
  });
});
