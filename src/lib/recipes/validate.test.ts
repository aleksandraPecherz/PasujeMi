import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT,
  MAX_INGREDIENTS,
  MAX_INGREDIENT_TEXT_LENGTH,
  MAX_RECIPE_NAME_LENGTH,
  MAX_STEPS,
  MAX_STEP_LENGTH,
  MAX_SUBSTITUTES,
  MAX_UNIT_LENGTH,
} from "@/lib/recipes/limits";
import { defaultProduct, parseRecipeInput } from "@/lib/recipes/validate";

const minimal = () => ({
  name: "Kanapka",
  steps: ["Posmaruj chleb."],
  ingredients: [{ name: "Chleb" }],
});

const fullExample = {
  name: "Owsianka z borówkami",
  steps: ["Płatki zalej mlekiem i gotuj 5 minut.", "Dodaj borówki i odrobinę soli."],
  ingredients: [
    {
      name: "Płatki owsiane",
      product: "płatki owsiane",
      amount: 40,
      unit: "g",
      substitutes: [{ name: "Płatki jaglane", product: "płatki jaglane", amount: 40, unit: "g" }],
    },
    {
      name: "Mleko 1,5%",
      product: "mleko 1,5%",
      amount: 200,
      unit: "g",
      substitutes: [{ name: "Napój sojowy Go Vege", product: "napój sojowy", amount: 200, unit: "g" }],
    },
    { name: "Sól", product: "sól", amount: 1, unit: "szczypta", substitutes: [] },
  ],
  prepTimeMin: 10,
  servings: 1,
  kinds: ["na słodko", "na ciepło"],
  kcal: 405,
  proteinG: 15.2,
  carbsG: 60.1,
  fatG: 9.8,
};

function issuePaths(body: unknown): string[] {
  const result = parseRecipeInput(body);
  return result.ok ? [] : result.issues.map((i) => i.path);
}

describe("parseRecipeInput", () => {
  it("accepts a minimal recipe and fills defaults", () => {
    const result = parseRecipeInput(minimal());
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Kanapka",
        steps: ["Posmaruj chleb."],
        ingredients: [{ name: "Chleb", product: "chleb", amount: null, unit: null, substitutes: [] }],
        prepTimeMin: null,
        servings: null,
        kinds: [],
        kcal: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
      },
    });
  });

  it("accepts the full example from the data contract unchanged", () => {
    const result = parseRecipeInput({ id: "6f1c2a9e-0b7d-4c1e-9a3f-2d5e8b7c4a10", ...fullExample });
    expect(result).toEqual({ ok: true, value: fullExample });
  });

  it("trims texts and rejects an empty name", () => {
    const ok = parseRecipeInput({ ...minimal(), name: "  Kanapka  ", steps: ["  Krok  "] });
    expect(ok.ok && ok.value.name).toBe("Kanapka");
    expect(ok.ok && ok.value.steps).toEqual(["Krok"]);
    expect(issuePaths({ ...minimal(), name: "   " })).toEqual(["name"]);
  });

  it("rejects empty steps instead of dropping them", () => {
    expect(issuePaths({ ...minimal(), steps: ["Krok", " "] })).toEqual(["steps.1"]);
    expect(issuePaths({ ...minimal(), steps: [] })).toEqual(["steps"]);
  });

  it("rejects a recipe without ingredients", () => {
    expect(issuePaths({ ...minimal(), ingredients: [] })).toEqual(["ingredients"]);
    expect(issuePaths({ ...minimal(), ingredients: [{ name: " " }] })).toEqual(["ingredients.0.name"]);
  });

  describe("product", () => {
    it("defaults to the lower-cased name", () => {
      expect(defaultProduct("  Mleko 1,5% ")).toBe("mleko 1,5%");
      const result = parseRecipeInput({ ...minimal(), ingredients: [{ name: "Mleko 1,5%", product: "  " }] });
      expect(result.ok && result.value.ingredients[0].product).toBe("mleko 1,5%");
    });

    it("keeps a given product, also for substitutes", () => {
      const result = parseRecipeInput({
        ...minimal(),
        ingredients: [
          {
            name: "Chleb",
            product: "pieczywo",
            substitutes: [{ name: "Bułka Tarta", product: "bułka" }, { name: "Wafel" }],
          },
        ],
      });
      expect(result.ok && result.value.ingredients[0].product).toBe("pieczywo");
      expect(result.ok && result.value.ingredients[0].substitutes.map((s) => s.product)).toEqual(["bułka", "wafel"]);
    });
  });

  describe("amount and unit", () => {
    const withIngredient = (ingredient: object) => ({ ...minimal(), ingredients: [{ name: "Mąka", ...ingredient }] });

    it("accepts both set or both absent", () => {
      expect(parseRecipeInput(withIngredient({ amount: 0.5, unit: "g" })).ok).toBe(true);
      expect(parseRecipeInput(withIngredient({ amount: null, unit: null })).ok).toBe(true);
      expect(parseRecipeInput(withIngredient({ amount: null, unit: "" })).ok).toBe(true);
    });

    it("rejects an amount without a unit and the other way round", () => {
      expect(issuePaths(withIngredient({ amount: 5 }))).toEqual(["ingredients.0.unit"]);
      expect(issuePaths(withIngredient({ amount: 5, unit: " " }))).toEqual(["ingredients.0.unit"]);
      expect(issuePaths(withIngredient({ unit: "g" }))).toEqual(["ingredients.0.amount"]);
    });

    it("rejects zero, negative, non-finite and non-numeric amounts", () => {
      expect(issuePaths(withIngredient({ amount: 0, unit: "g" }))).toEqual(["ingredients.0.amount"]);
      expect(issuePaths(withIngredient({ amount: -1, unit: "g" }))).toEqual(["ingredients.0.amount"]);
      expect(issuePaths(withIngredient({ amount: Infinity, unit: "g" }))).toEqual(["ingredients.0.amount"]);
      expect(issuePaths(withIngredient({ amount: "5", unit: "g" }))).toEqual(["ingredients.0.amount"]);
    });

    it("checks the amount and unit limits at the boundary", () => {
      expect(parseRecipeInput(withIngredient({ amount: MAX_AMOUNT, unit: "g" })).ok).toBe(true);
      expect(issuePaths(withIngredient({ amount: MAX_AMOUNT + 1, unit: "g" }))).toEqual(["ingredients.0.amount"]);
      expect(parseRecipeInput(withIngredient({ amount: 1, unit: "x".repeat(MAX_UNIT_LENGTH) })).ok).toBe(true);
      expect(issuePaths(withIngredient({ amount: 1, unit: "x".repeat(MAX_UNIT_LENGTH + 1) }))).toEqual([
        "ingredients.0.unit",
      ]);
    });
  });

  describe("limits", () => {
    const named = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Składnik ${i}` }));

    it("checks the number of ingredients", () => {
      expect(parseRecipeInput({ ...minimal(), ingredients: named(MAX_INGREDIENTS) }).ok).toBe(true);
      expect(issuePaths({ ...minimal(), ingredients: named(MAX_INGREDIENTS + 1) })).toEqual(["ingredients"]);
    });

    it("checks the number of substitutes", () => {
      const withSubstitutes = (n: number) => ({
        ...minimal(),
        ingredients: [{ name: "Chleb", substitutes: named(n) }],
      });
      expect(parseRecipeInput(withSubstitutes(MAX_SUBSTITUTES)).ok).toBe(true);
      expect(issuePaths(withSubstitutes(MAX_SUBSTITUTES + 1))).toEqual(["ingredients.0.substitutes"]);
    });

    it("checks the number of steps and their length", () => {
      const steps = (n: number) => Array.from({ length: n }, () => "Krok");
      expect(parseRecipeInput({ ...minimal(), steps: steps(MAX_STEPS) }).ok).toBe(true);
      expect(issuePaths({ ...minimal(), steps: steps(MAX_STEPS + 1) })).toEqual(["steps"]);
      expect(parseRecipeInput({ ...minimal(), steps: ["x".repeat(MAX_STEP_LENGTH)] }).ok).toBe(true);
      expect(issuePaths({ ...minimal(), steps: ["x".repeat(MAX_STEP_LENGTH + 1)] })).toEqual(["steps.0"]);
    });

    it("checks the length of names and products", () => {
      expect(parseRecipeInput({ ...minimal(), name: "x".repeat(MAX_RECIPE_NAME_LENGTH) }).ok).toBe(true);
      expect(issuePaths({ ...minimal(), name: "x".repeat(MAX_RECIPE_NAME_LENGTH + 1) })).toEqual(["name"]);
      expect(issuePaths({ ...minimal(), ingredients: [{ name: "x".repeat(MAX_INGREDIENT_TEXT_LENGTH + 1) }] })).toEqual(
        ["ingredients.0.name"],
      );
      expect(
        issuePaths({
          ...minimal(),
          ingredients: [{ name: "Chleb", product: "x".repeat(MAX_INGREDIENT_TEXT_LENGTH + 1) }],
        }),
      ).toEqual(["ingredients.0.product"]);
    });

    it("checks numeric ranges", () => {
      expect(parseRecipeInput({ ...minimal(), prepTimeMin: 0, servings: 1, kcal: 0, proteinG: 0 }).ok).toBe(true);
      expect(parseRecipeInput({ ...minimal(), prepTimeMin: 1440, servings: 100, kcal: 10000, fatG: 1000 }).ok).toBe(
        true,
      );
      expect(
        issuePaths({
          ...minimal(),
          prepTimeMin: 1441,
          servings: 0,
          kcal: 10001,
          proteinG: 1000.1,
          carbsG: -1,
          fatG: "x",
        }),
      ).toEqual(["prepTimeMin", "servings", "kcal", "proteinG", "carbsG", "fatG"]);
      expect(issuePaths({ ...minimal(), servings: 1.5, kcal: 100.5 })).toEqual(["servings", "kcal"]);
    });

    it("rounds macros to 0.1", () => {
      const result = parseRecipeInput({ ...minimal(), proteinG: 15.26, carbsG: 3 });
      expect(result.ok && [result.value.proteinG, result.value.carbsG]).toEqual([15.3, 3]);
    });
  });

  describe("kinds", () => {
    it("deduplicates and rejects unknown kinds", () => {
      const ok = parseRecipeInput({ ...minimal(), kinds: ["na zimno", "na zimno", "na słodko"] });
      expect(ok.ok && ok.value.kinds).toEqual(["na zimno", "na słodko"]);
      expect(issuePaths({ ...minimal(), kinds: ["na słodko", "pikantne"] })).toEqual(["kinds.1"]);
      expect(issuePaths({ ...minimal(), kinds: "na słodko" })).toEqual(["kinds"]);
    });
  });

  it("ignores id, authorId, matchKeys and unknown fields", () => {
    const result = parseRecipeInput({
      ...minimal(),
      id: "x",
      authorId: "y",
      author_id: "y",
      matchKeys: [],
      match_keys: [],
      extra: 1,
    });
    expect(result.ok && Object.keys(result.value).sort()).toEqual(
      ["carbsG", "fatG", "ingredients", "kcal", "kinds", "name", "prepTimeMin", "proteinG", "servings", "steps"].sort(),
    );
  });

  it("returns an issue instead of throwing for a body that is not an object", () => {
    for (const body of [null, undefined, [], "przepis", 5]) {
      const result = parseRecipeInput(body);
      expect(result.ok).toBe(false);
    }
  });

  it("returns an issue instead of throwing for wrong types", () => {
    const body = { name: 5, steps: "krok", ingredients: "mleko" };
    expect(issuePaths(body)).toEqual(["name", "steps", "ingredients"]);
    expect(issuePaths({ ...minimal(), ingredients: [5, { name: "Chleb", substitutes: "x" }] })).toEqual([
      "ingredients.0",
      "ingredients.1.substitutes",
    ]);
  });

  it("reports nested paths", () => {
    const body = {
      ...minimal(),
      ingredients: [
        { name: "Chleb" },
        { name: "Mleko", amount: 1, unit: "l", substitutes: [{ name: "Woda" }, { name: "Sok", amount: 2 }] },
      ],
    };
    expect(issuePaths(body)).toEqual(["ingredients.1.substitutes.1.unit"]);
  });
});
