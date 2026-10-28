import { describe, expect, it } from "vitest";
import {
  afterIngredientRemoved,
  errorSummary,
  initialDisclosure,
  openNewIngredient,
  orderedErrorPaths,
  revealErrors,
  toggleIngredient,
  toggleSubstitutes,
} from "./recipeFormDisclosure";
import { emptyRecipeForm, recipeToFormState, toBody } from "./useRecipeForm";
import type { Recipe } from "@/types";

function recipeWith(count: number): Recipe {
  return {
    id: "6f1d2a4e-3b8c-4c57-9a0e-1d2f3a4b5c6d",
    name: "Zupa",
    steps: ["Gotuj."],
    ingredients: Array.from({ length: count }, (_, i) => ({
      name: `Składnik ${i + 1}`,
      product: `składnik ${i + 1}`,
      amount: null,
      unit: null,
      substitutes: [],
    })),
    prepTimeMin: null,
    servings: null,
    kinds: [],
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };
}

const form = recipeToFormState(recipeWith(5));
const keys = form.ingredients.map((row) => row.key);

describe("initialDisclosure", () => {
  it("opens the first ingredient of a new recipe", () => {
    const empty = emptyRecipeForm();
    expect(initialDisclosure(empty, false).openIngredient).toBe(empty.ingredients[0]?.key);
  });

  it("opens nutrition at the start only when it already has values", () => {
    expect(initialDisclosure({ ...form, kcal: "420" }, true).nutritionOpen).toBe(true);
    expect(initialDisclosure({ ...form, kcal: "  ", fatG: "" }, true).nutritionOpen).toBe(false);
  });

  it("starts an edit with every ingredient collapsed", () => {
    expect(initialDisclosure(form, true)).toEqual({ openIngredient: null, openSubstitutes: [], nutritionOpen: false });
  });
});

describe("one open ingredient, by key", () => {
  it("opens an added ingredient and collapses the previous one", () => {
    const opened = openNewIngredient(initialDisclosure(form, false), keys[4] ?? "");
    expect(opened.openIngredient).toBe(keys[4]);
  });

  it("toggles an ingredient open and closed, switching the open one", () => {
    const first = toggleIngredient(initialDisclosure(form, true), keys[1] ?? "");
    expect(first.openIngredient).toBe(keys[1]);
    expect(toggleIngredient(first, keys[2] ?? "").openIngredient).toBe(keys[2]);
    expect(toggleIngredient(first, keys[1] ?? "").openIngredient).toBeNull();
  });

  it("keeps the same ingredient open when an earlier one is removed", () => {
    const open = toggleIngredient(initialDisclosure(form, true), keys[3] ?? "");
    expect(afterIngredientRemoved(open, keys[0] ?? "").openIngredient).toBe(keys[3]);
  });

  it("leaves none open when the open ingredient is removed, and forgets its substitutes section", () => {
    const open = toggleSubstitutes(toggleIngredient(initialDisclosure(form, true), keys[2] ?? ""), keys[2] ?? "");
    const after = afterIngredientRemoved(open, keys[2] ?? "");
    expect(after.openIngredient).toBeNull();
    expect(after.openSubstitutes).toEqual([]);
  });
});

describe("revealErrors", () => {
  const collapsed = initialDisclosure(form, true);

  it("opens the ingredient with the first error", () => {
    const errors = { "ingredients.3.name": "Nazwa: pole jest wymagane.", "ingredients.1.unit": "Jednostka: podaj." };
    expect(revealErrors(collapsed, form, errors).openIngredient).toBe(keys[1]);
  });

  it("opens the ingredient and its substitutes section for a substitute error", () => {
    const result = revealErrors(collapsed, form, { "ingredients.2.substitutes.0.name": "Nazwa: pole jest wymagane." });
    expect(result.openIngredient).toBe(keys[2]);
    expect(result.openSubstitutes).toEqual([keys[2]]);
    expect(result.nutritionOpen).toBe(false);
  });

  it("opens the substitutes section for a list-level substitutes error", () => {
    const result = revealErrors(collapsed, form, { "ingredients.0.substitutes": "Zamienniki: najwyżej 5." });
    expect(result.openSubstitutes).toEqual([keys[0]]);
  });

  it("opens nutrition for a nutrition error but not for time or servings", () => {
    expect(revealErrors(collapsed, form, { kcal: "Kcal: wpisz liczbę." }).nutritionOpen).toBe(true);
    expect(revealErrors(collapsed, form, { servings: "Liczba porcji: wpisz liczbę." }).nutritionOpen).toBe(false);
  });

  it("keeps what is open when the error is elsewhere", () => {
    const open = toggleIngredient(collapsed, keys[4] ?? "");
    expect(revealErrors(open, form, { name: "Nazwa: pole jest wymagane." })).toEqual(open);
  });

  it("ignores errors for rows that no longer exist (stale server answer)", () => {
    expect(revealErrors(collapsed, form, { "ingredients.9.name": "Nazwa: pole jest wymagane." })).toEqual(collapsed);
  });

  it("does not collapse an open section that has no error", () => {
    const open = toggleSubstitutes(collapsed, keys[0] ?? "");
    const result = revealErrors(open, form, { "ingredients.1.name": "Nazwa: pole jest wymagane." });
    expect(result.openSubstitutes).toEqual([keys[0]]);
  });
});

describe("error order", () => {
  const errors = {
    fatG: "f",
    "steps.1": "s1",
    "ingredients.2.substitutes.0.unit": "sub-unit",
    "ingredients.2.substitutes.0.name": "sub-name",
    "ingredients.10.name": "i10",
    "ingredients.2.unit": "i2-unit",
    "ingredients.2.name": "i2-name",
    "ingredients.2.substitutes": "list",
    name: "n",
    servings: "sv",
    kcal: "k",
    steps: "steps",
    prepTimeMin: "p",
    ingredients: "ing",
    "steps.0": "s0",
  };

  it("follows the order of the fields in the form", () => {
    expect(orderedErrorPaths(errors)).toEqual([
      "name",
      "ingredients",
      "ingredients.2.name",
      "ingredients.2.unit",
      "ingredients.2.substitutes",
      "ingredients.2.substitutes.0.name",
      "ingredients.2.substitutes.0.unit",
      "ingredients.10.name",
      "steps",
      "steps.0",
      "steps.1",
      "prepTimeMin",
      "servings",
      "kcal",
      "fatG",
    ]);
  });

  it("labels the banner items with where the error is", () => {
    const items = errorSummary({
      "ingredients.1.name": "Nazwa: pole jest wymagane.",
      "ingredients.1.substitutes.0.name": "Nazwa: pole jest wymagane.",
      "steps.1": "Krok: pole jest wymagane.",
    });
    expect(items.map((item) => item.label)).toEqual(["Składnik 2", "Składnik 2 · Zamiennik 1", "Krok 2"]);
    expect(items[0]).toEqual({
      path: "ingredients.1.name",
      label: "Składnik 2",
      message: "Nazwa: pole jest wymagane.",
      text: "Składnik 2 · Nazwa: pole jest wymagane.",
    });
    expect(items.map((item) => item.text)).toEqual([
      "Składnik 2 · Nazwa: pole jest wymagane.",
      "Składnik 2 · Zamiennik 1 · Nazwa: pole jest wymagane.",
      "Krok 2: pole jest wymagane.",
    ]);
  });

  it("sorts unknown paths last", () => {
    expect(orderedErrorPaths({ "": "x", kcal: "k", name: "n" })).toEqual(["name", "kcal", ""]);
  });
});

describe("collapsing loses no data", () => {
  it("leaves the request body unchanged whatever is open", () => {
    const typed = recipeToFormState(recipeWith(3));
    const before = toBody(typed);
    // The disclosure lives outside the form state, so no toggle can touch `toBody`.
    toggleIngredient(initialDisclosure(typed, true), typed.ingredients[0]?.key ?? "");
    expect(toBody(typed)).toEqual(before);
  });
});
