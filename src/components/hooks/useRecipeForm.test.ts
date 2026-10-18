import { describe, expect, it } from "vitest";
import { defaultProduct, parseRecipeInput } from "@/lib/recipes/validate";
import type { Recipe } from "@/types";
import { recipeToFormState, toBody } from "./useRecipeForm";

const RECIPE: Recipe = {
  id: "6f1d2a4e-3b8c-4c57-9a0e-1d2f3a4b5c6d",
  name: "Owsianka z jabłkiem",
  steps: ["Podgrzej mleko.", "Dodaj płatki."],
  ingredients: [
    {
      name: "Mleko 1,5%",
      // Edited by hand: differs from defaultProduct(name).
      product: "mleko",
      amount: 0.5,
      unit: "l",
      substitutes: [
        { name: "Napój owsiany", product: "napój owsiany", amount: 250, unit: "ml" },
        { name: "Woda", product: "woda", amount: null, unit: null },
      ],
    },
    { name: "Cynamon", product: "cynamon", amount: null, unit: null, substitutes: [] },
  ],
  prepTimeMin: 10,
  servings: null,
  kinds: ["na słodko", "na ciepło"],
  kcal: 320,
  proteinG: null,
  carbsG: 52,
  fatG: null,
};

describe("recipeToFormState", () => {
  it("turns numbers into text and null into an empty string", () => {
    const form = recipeToFormState(RECIPE);
    expect(form.prepTimeMin).toBe("10");
    expect(form.servings).toBe("");
    expect(form.kcal).toBe("320");
    expect(form.ingredients[0].amount).toBe("0.5");
    expect(form.ingredients[1].unit).toBe("");
  });

  it("sets productEdited only where product differs from the default", () => {
    const form = recipeToFormState(RECIPE);
    expect(defaultProduct(RECIPE.ingredients[0].name)).not.toBe(RECIPE.ingredients[0].product);
    expect(form.ingredients[0].productEdited).toBe(true);
    expect(form.ingredients[1].productEdited).toBe(false);
    expect(form.ingredients[0].substitutes.map((s) => s.productEdited)).toEqual([false, false]);
  });

  it("gives every row a unique key", () => {
    const form = recipeToFormState(RECIPE);
    const keys = [
      ...form.steps.map((s) => s.key),
      ...form.ingredients.flatMap((i) => [i.key, ...i.substitutes.map((s) => s.key)]),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("sends back the same recipe", () => {
    const parsed = parseRecipeInput(toBody(recipeToFormState(RECIPE)));
    expect(parsed.ok ? [] : parsed.issues).toEqual([]);
    if (!parsed.ok) return;
    const { id: _id, ...fields } = RECIPE;
    expect(parsed.value).toEqual(fields);
  });
});
