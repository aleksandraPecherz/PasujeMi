import { describe, expect, it } from "vitest";
import { isRecipeId } from "@/lib/recipes/id";

describe("isRecipeId", () => {
  it("accepts a UUID in lower and upper case", () => {
    expect(isRecipeId("3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b")).toBe(true);
    expect(isRecipeId("3F2B8C1E-5A4D-4E6F-9B7A-1C2D3E4F5A6B")).toBe(true);
  });

  it("rejects empty text and text that is not a UUID", () => {
    expect(isRecipeId("")).toBe(false);
    expect(isRecipeId("nie-uuid")).toBe(false);
    expect(isRecipeId("3f2b8c1e5a4d4e6f9b7a1c2d3e4f5a6b")).toBe(false);
  });

  it("rejects a UUID with extra characters around it", () => {
    expect(isRecipeId(" 3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b")).toBe(false);
    expect(isRecipeId("3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b\n")).toBe(false);
    expect(isRecipeId("3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b-x")).toBe(false);
  });
});
