import { describe, expect, it } from "vitest";
import { recipeCountLabel } from "@/lib/recipe-count";

describe("recipeCountLabel", () => {
  it("uses the singular for 1", () => {
    expect(recipeCountLabel(1)).toBe("Znaleziono 1 przepis");
  });

  it.each([2, 4, 22, 24, 102])("uses 'przepisy' for %i", (total) => {
    expect(recipeCountLabel(total)).toBe(`Znaleziono ${String(total)} przepisy`);
  });

  // 12–14 and 112 end in 2–4 but take the genitive plural, unlike 22–24.
  it.each([0, 5, 11, 12, 14, 21, 112])("uses 'przepisów' for %i", (total) => {
    expect(recipeCountLabel(total)).toBe(`Znaleziono ${String(total)} przepisów`);
  });
});
