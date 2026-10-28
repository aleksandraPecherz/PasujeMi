import { describe, expect, it } from "vitest";
import { formatNutrition, formatPrepTime, formatQuantity, formatServings } from "@/lib/recipes/format";

describe("formatQuantity", () => {
  it("joins amount and unit", () => {
    expect(formatQuantity({ amount: 100, unit: "g" })).toBe("100 g");
  });

  it("leaves out a null part without a stray space or the word null", () => {
    expect(formatQuantity({ amount: 2, unit: null })).toBe("2");
    expect(formatQuantity({ amount: null, unit: "szczypta" })).toBe("szczypta");
    expect(formatQuantity({ amount: null, unit: null })).toBe("");
    expect(formatQuantity({ amount: 1, unit: "  " })).toBe("1");
  });

  it("writes fractions with a decimal comma", () => {
    expect(formatQuantity({ amount: 0.5, unit: "szklanki" })).toBe("0,5 szklanki");
    expect(formatQuantity({ amount: 1.25, unit: "l" })).toBe("1,25 l");
    expect(formatQuantity({ amount: 0.3333333, unit: null })).toBe("0,33");
  });
});

describe("formatPrepTime", () => {
  it("formats minutes and hours", () => {
    expect(formatPrepTime(45)).toBe("45 min");
    expect(formatPrepTime(60)).toBe("1 godz.");
    expect(formatPrepTime(90)).toBe("1 godz. 30 min");
  });

  it("returns null without a time", () => {
    expect(formatPrepTime(null)).toBeNull();
    expect(formatPrepTime(0)).toBeNull();
  });
});

describe("formatServings", () => {
  it("uses the Polish plural forms", () => {
    expect(formatServings(1)).toBe("1 porcja");
    expect(formatServings(2)).toBe("2 porcje");
    expect(formatServings(4)).toBe("4 porcje");
    expect(formatServings(5)).toBe("5 porcji");
    expect(formatServings(12)).toBe("12 porcji");
    expect(formatServings(22)).toBe("22 porcje");
  });

  it("returns null without servings", () => {
    expect(formatServings(null)).toBeNull();
  });
});

describe("formatNutrition", () => {
  it("lists every value that is present, with the number and the unit kept apart", () => {
    expect(formatNutrition({ kcal: 350, proteinG: 12.5, carbsG: 40, fatG: 8 })).toEqual([
      { label: "Kalorie", shortLabel: "kcal", amount: "350", unit: "kcal", value: "350 kcal" },
      { label: "Białko", shortLabel: "białko", amount: "12,5", unit: "g", value: "12,5 g" },
      { label: "Węglowodany", shortLabel: "węglow.", amount: "40", unit: "g", value: "40 g" },
      { label: "Tłuszcz", shortLabel: "tłuszcze", amount: "8", unit: "g", value: "8 g" },
    ]);
  });

  it("skips missing values and returns nothing when all are missing", () => {
    expect(formatNutrition({ kcal: 200, proteinG: null, carbsG: null, fatG: 3 }).map((item) => item.label)).toEqual([
      "Kalorie",
      "Tłuszcz",
    ]);
    expect(formatNutrition({ kcal: null, proteinG: null, carbsG: null, fatG: null })).toEqual([]);
  });

  it("keeps a zero as a value", () => {
    expect(formatNutrition({ kcal: 0, proteinG: null, carbsG: null, fatG: null })[0]).toMatchObject({
      amount: "0",
      value: "0 kcal",
    });
  });
});
