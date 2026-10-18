import { describe, expect, it } from "vitest";
import { brandWarnings, toProduct } from "./brands";
import {
  normalizeRecipeName,
  parseKinds,
  parseQuantity,
  parseRecipeRow,
  perServing,
  splitIngredients,
  splitSteps,
  splitSubstitutes,
  type RawRecipeRow,
} from "./parse";

const row = (overrides: Partial<RawRecipeRow> = {}): RawRecipeRow => ({
  rowNumber: 2,
  name: "Domowe spaghetti",
  prepTimeMin: 30,
  kinds: "na wytrawnie ; na ciepło",
  servings: 1,
  products: "Makaron (80g) ; Sól (1szczypta)",
  kcal: 400,
  proteinG: 20,
  carbsG: 50,
  fatG: 10,
  steps: "1. Ugotuj makaron. 2. Posól.",
  ...overrides,
});

describe("toProduct", () => {
  it.each([
    ["ser żółty active protein plus Ryki", "ser żółty"],
    ["ser z niebieską pleśnią Lazur", "ser z niebieską pleśnią"],
    ["Mleko 1,5%", "mleko 1,5%"],
    ["Napój sojowy Go Vege", "napój sojowy"],
    ["mleko wysokobiałkowe 0,5% Mlekovita", "mleko wysokobiałkowe 0,5%"],
    ["Jogurt Vemondo  naturalny", "jogurt naturalny"],
  ])("%s -> %s", (name, product) => {
    expect(toProduct(name)).toBe(product);
  });

  it("matches whole words only", () => {
    expect(toProduct("Rykiet")).toBe("rykiet");
  });
});

describe("brandWarnings", () => {
  it.each(["Ser Grana Padano starty", "Ser typu Feta", "Mleko 1,5%", "ser żółty active protein plus Ryki"])(
    "accepts %s",
    (name) => {
      expect(brandWarnings(name)).toEqual([]);
    },
  );

  it.each(["Serek Piątnica", "serek 200g", "mleko 1 l"])("warns about %s", (name) => {
    expect(brandWarnings(name)).toHaveLength(1);
  });
});

describe("parseQuantity", () => {
  it.each([
    ["Płatki owsiane (5g)", "Płatki owsiane", 5, "g"],
    ["Sól (0,3 g)", "Sól", 0.3, "g"],
    ["Sól (0.3g)", "Sól", 0.3, "g"],
    ["Mąka (25 g)", "Mąka", 25, "g"],
    ["Sól (1szczypta)", "Sól", 1, "szczypta"],
    ["Kasza gryczana niepalona (biała) (40g)", "Kasza gryczana niepalona (biała)", 40, "g"],
    ["Borówki amerykańskie, świeże lub mrożone - 100 g", "Borówki amerykańskie, świeże lub mrożone", 100, "g"],
    ["Mąka orkiszowa pełnoziarnista – 30 g", "Mąka orkiszowa pełnoziarnista", 30, "g"],
  ])("%s", (text, name, amount, unit) => {
    expect(parseQuantity(text)).toEqual({ name, amount, unit });
  });

  it("leaves a bracket without a quantity in the name", () => {
    expect(parseQuantity("Kasza gryczana (biała)")).toEqual({
      name: "Kasza gryczana (biała)",
      amount: null,
      unit: null,
    });
    expect(parseQuantity("Chleb")).toEqual({ name: "Chleb", amount: null, unit: null });
  });
});

describe("splitIngredients", () => {
  it("splits on ; with and without a space before it", () => {
    const { ingredients, issues } = splitIngredients("Makaron (80g) ; Sól (1szczypta); Pieprz (0,5g)");
    expect(issues).toEqual([]);
    expect(ingredients.map((i) => i.name)).toEqual(["Makaron", "Sól", "Pieprz"]);
  });

  it("splits the dash layout on a comma after a quantity and keeps a comma in a name", () => {
    const { ingredients, issues } = splitIngredients(
      "Borówki amerykańskie, świeże lub mrożone - 100 g, Jogurt naturalny - 150 g, Miód - 10 g",
    );
    expect(issues).toEqual([]);
    expect(ingredients.map((i) => [i.name, i.amount])).toEqual([
      ["Borówki amerykańskie, świeże lub mrożone", 100],
      ["Jogurt naturalny", 150],
      ["Miód", 10],
    ]);
  });

  it("splits on a comma after a substitutes block", () => {
    const { ingredients } = splitIngredients("Mleko - 200 g [zamienniki: Napój sojowy – 200 g], Sól - 1 szczypta");
    expect(ingredients.map((i) => i.name)).toEqual(["Mleko", "Sól"]);
    expect(ingredients[0].substitutes).toEqual([
      { name: "Napój sojowy", product: "napój sojowy", amount: 200, unit: "g" },
    ]);
  });

  it("does not split on a ; inside a substitutes block", () => {
    const { ingredients, issues } = splitIngredients(
      "Maliny (100g) [zamienniki: Truskawki (130g) ; Jagody (85g)] ; Sól (1g)",
    );
    expect(issues).toEqual([]);
    expect(ingredients.map((i) => i.name)).toEqual(["Maliny", "Sól"]);
    expect(ingredients[0].substitutes.map((s) => s.name)).toEqual(["Truskawki", "Jagody"]);
    expect(ingredients[1].substitutes).toEqual([]);
  });

  it("reports an empty ingredient after the split", () => {
    const { ingredients, issues } = splitIngredients("Makaron (80g) ; ; Sól (1g)");
    expect(ingredients).toHaveLength(2);
    expect(issues.map((i) => i.path)).toEqual(["ingredients.1"]);
  });

  it("reports a block that is not closed", () => {
    const { issues } = splitIngredients("Makaron (80g) [zamienniki: Ryż (80g)");
    expect(issues.map((i) => i.path)).toContain("ingredients");
  });

  it("reports an ingredient that is only a brand", () => {
    const { ingredients, issues } = splitIngredients("Lazur (50g)");
    expect(ingredients).toEqual([]);
    expect(issues.map((i) => i.path)).toEqual(["ingredients.0.product"]);
  });
});

describe("splitSubstitutes", () => {
  it("splits on a comma after a quantity, not on a decimal comma", () => {
    const { options, issues } = splitSubstitutes("mleko 1,5% (45g), mleko bez laktozy 2% (45g)");
    expect(issues).toEqual([]);
    expect(options).toEqual([
      { name: "mleko 1,5%", product: "mleko 1,5%", amount: 45, unit: "g" },
      { name: "mleko bez laktozy 2%", product: "mleko bez laktozy 2%", amount: 45, unit: "g" },
    ]);
  });

  it("splits only on ; when the block has one, keeping a comma in a name", () => {
    const { options } = splitSubstitutes("Borówki amerykańskie, świeże lub mrożone – 55 g ; Jagody – 60 g");
    expect(options.map((o) => [o.name, o.amount])).toEqual([
      ["Borówki amerykańskie, świeże lub mrożone", 55],
      ["Jagody", 60],
    ]);
  });

  it("accepts both quantity forms in one block", () => {
    const { options } = splitSubstitutes("Mąka żytnia (30g), Mąka orkiszowa – 30 g");
    expect(options.map((o) => [o.name, o.amount, o.unit])).toEqual([
      ["Mąka żytnia", 30, "g"],
      ["Mąka orkiszowa", 30, "g"],
    ]);
  });

  it("removes brands from the product only", () => {
    const { options } = splitSubstitutes("ser żółty active protein plus Ryki (30g)");
    expect(options[0]).toMatchObject({ name: "ser żółty active protein plus Ryki", product: "ser żółty" });
  });

  it.each(["zamiennik", "zamienniki"])("reads the %s: label", (label) => {
    const { ingredients } = splitIngredients(`Mleko (200g) [${label}: Napój owsiany (200g)]`);
    expect(ingredients[0].substitutes.map((s) => s.name)).toEqual(["Napój owsiany"]);
  });
});

describe("splitSteps", () => {
  it.each([
    ["1. Ugotuj makaron. 2. Posól; wymieszaj. 3. Podaj.", ["Ugotuj makaron.", "Posól; wymieszaj.", "Podaj."]],
    ["1) ugotuj\n2) posól", ["Ugotuj", "Posól"]],
    ["ugotuj makaron; posól\nwymieszaj; podaj", ["Ugotuj makaron; posól", "Wymieszaj; podaj"]],
    ["ugotuj makaron;posól ; ; podaj;", ["Ugotuj makaron", "Posól", "Podaj"]],
    ["Dodaj 2.5 łyżki cukru; wymieszaj", ["Dodaj 2.5 łyżki cukru", "Wymieszaj"]],
    ["", []],
  ])("%j", (text, steps) => {
    expect(splitSteps(text)).toEqual(steps);
  });
});

describe("parseKinds", () => {
  it.each([
    ["na słodko ; na zimno", ["na słodko", "na zimno"]],
    ["na zimno; na wytrawnie", ["na zimno", "na wytrawnie"]],
    ["Na słodko", ["na słodko"]],
  ])("%s", (text, kinds) => {
    expect(parseKinds(text)).toEqual(kinds);
  });

  it("reports an unknown kind through the validator", () => {
    const result = parseRecipeRow(row({ kinds: "na słodko ; na gorąco" }));
    expect(result.recipe).toBeNull();
    expect(result.issues.map((i) => i.path)).toEqual(["kinds.1"]);
  });
});

describe("perServing", () => {
  it("rounds to a whole number or to 0.1", () => {
    expect(perServing(1704, 4, 0)).toBe(426);
    expect(perServing(85.3, 4, 1)).toBe(21.3);
  });
});

describe("kcal recalculation", () => {
  it("divides a total for several servings", () => {
    const result = parseRecipeRow(row({ servings: 4, kcal: 1704, proteinG: 85.3, carbsG: 180, fatG: 70.1 }));
    expect(result.issues).toEqual([]);
    expect(result.recipe).toMatchObject({ servings: 4, kcal: 426, proteinG: 21.3, carbsG: 45, fatG: 17.5 });
    expect(result.kcalRecalculation).toEqual({
      servings: 4,
      before: { kcal: 1704, proteinG: 85.3, carbsG: 180, fatG: 70.1 },
      after: { kcal: 426, proteinG: 21.3, carbsG: 45, fatG: 17.5 },
    });
  });

  it("leaves a per-serving value unchanged", () => {
    const result = parseRecipeRow(row({ servings: 2, kcal: 406 }));
    expect(result.recipe?.kcal).toBe(406);
    expect(result.kcalRecalculation).toBeNull();
  });

  it.each([
    [600, 300],
    [1000, 500],
  ])("includes the ratio boundaries (%i kcal, 2 servings)", (kcal, expected) => {
    const result = parseRecipeRow(row({ servings: 2, kcal }));
    expect(result.recipe?.kcal).toBe(expected);
    expect(result.kcalRecalculation).not.toBeNull();
  });

  it.each([599, 1001])("leaves %i kcal for 2 servings outside the boundaries", (kcal) => {
    const result = parseRecipeRow(row({ servings: 2, kcal }));
    expect(result.recipe?.kcal).toBe(kcal);
    expect(result.kcalRecalculation).toBeNull();
  });

  it("never recalculates a single serving", () => {
    const result = parseRecipeRow(row({ servings: 1, kcal: 400 }));
    expect(result.kcalRecalculation).toBeNull();
    expect(result.recipe?.kcal).toBe(400);
  });

  it("keeps empty macros empty", () => {
    const result = parseRecipeRow(row({ servings: 2, kcal: 800, proteinG: null }));
    expect(result.recipe).toMatchObject({ kcal: 400, proteinG: null });
  });
});

describe("parseRecipeRow", () => {
  it("builds a recipe from a row", () => {
    const result = parseRecipeRow(row({ name: " Domowe spaghetti ", prepTimeMin: 30, servings: 1 }));
    expect(result.issues).toEqual([]);
    expect(result.name).toBe("Domowe spaghetti");
    expect(result.recipe).toEqual({
      name: "Domowe spaghetti",
      steps: ["Ugotuj makaron.", "Posól."],
      ingredients: [
        { name: "Makaron", product: "makaron", amount: 80, unit: "g", substitutes: [] },
        { name: "Sól", product: "sól", amount: 1, unit: "szczypta", substitutes: [] },
      ],
      prepTimeMin: 30,
      servings: 1,
      kinds: ["na wytrawnie", "na ciepło"],
      kcal: 400,
      proteinG: 20,
      carbsG: 50,
      fatG: 10,
    });
  });

  const substitutes = (n: number) =>
    `Maliny (100g) [zamienniki: ${Array.from({ length: n }, (_, i) => `Owoc${i} (10g)`).join(" ; ")}]`;

  it("accepts 5 substitutes and rejects 6", () => {
    expect(parseRecipeRow(row({ products: substitutes(5) })).issues).toEqual([]);
    const result = parseRecipeRow(row({ products: substitutes(6) }));
    expect(result.recipe).toBeNull();
    expect(result.issues.map((i) => i.path)).toEqual(["ingredients.0.substitutes"]);
  });

  it("keeps whole numbers from float cells", () => {
    const result = parseRecipeRow(row({ prepTimeMin: 5.0, servings: 2.0, kcal: 800 }));
    expect(result.recipe).toMatchObject({ prepTimeMin: 5, servings: 2 });
  });

  it("treats empty cells as empty fields without an issue", () => {
    const result = parseRecipeRow(
      row({ prepTimeMin: null, servings: null, kcal: null, proteinG: null, carbsG: null, fatG: null }),
    );
    expect(result.issues).toEqual([]);
    expect(result.recipe).toMatchObject({ prepTimeMin: null, servings: null, kcal: null });
    expect(result.kcalRecalculation).toBeNull();
  });

  it.each([
    ["kcal", "406"],
    ["servings", "dwie"],
  ] as const)("blocks a text in the numeric cell %s", (field, value) => {
    const result = parseRecipeRow(
      row({ [field]: value, servings: field === "servings" ? value : 2, kcal: field === "kcal" ? value : 800 }),
    );
    expect(result.recipe).toBeNull();
    expect(result.issues).toEqual([{ path: field, message: `nieoczekiwana wartość „${value}”` }]);
    expect(result.kcalRecalculation).toBeNull();
  });

  it("reports a missing name, steps and ingredients with the validator's paths", () => {
    const result = parseRecipeRow(row({ name: " ", steps: "", products: "" }));
    expect(result.recipe).toBeNull();
    expect(result.issues.map((i) => i.path).sort()).toEqual(["ingredients", "name", "steps"]);
  });

  it("collects warnings about unknown brands, including substitutes", () => {
    const result = parseRecipeRow(
      row({ products: "Serek Piątnica (100g) [zamienniki: Ser Grana Padano (20g), serek 200g (10g)]" }),
    );
    expect(result.recipe).not.toBeNull();
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("ingredients.0");
    expect(result.warnings[1]).toContain("ingredients.0.substitutes.1");
  });
});

describe("normalizeRecipeName", () => {
  it("treats case and whitespace as insignificant", () => {
    expect(normalizeRecipeName("domowe  spaghetti ")).toBe(normalizeRecipeName("Domowe spaghetti"));
  });
});
