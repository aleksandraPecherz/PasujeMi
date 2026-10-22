import { describe, expect, it } from "vitest";
import { MAX_TAG_LENGTH, countTokens, exceedsMatchUrl } from "@/lib/matching/limits";

describe("countTokens", () => {
  it("is 0 for an empty list", () => {
    expect(countTokens([])).toBe(0);
  });

  it("sums the words of every tag", () => {
    expect(countTokens(["pomidor", "ser mozzarella kulka", "orzechy włoskie"])).toBe(6);
  });

  it.each([
    ["mleko 1,5%", 1],
    ["200 g mąki", 2],
    ["mleko z cukrem", 2],
    ["chleb bez glutenu", 2],
    ["z", 0],
  ])("does not count numbers, percentages or stopwords: %s", (tag, words) => {
    expect(countTokens([tag])).toBe(words);
  });
});

describe("exceedsMatchUrl", () => {
  it("accepts empty and small lists, with missing sections counted as empty", () => {
    expect(exceedsMatchUrl({})).toBe(false);
    expect(exceedsMatchUrl({ have: [], staple: [], exclude: [] })).toBe(false);
    expect(exceedsMatchUrl({ have: ["pomidor"], staple: ["sól"] })).toBe(false);
  });

  it("rejects lists whose encoded URL passes the budget", () => {
    // Each "ą" is 6 characters once percent-encoded.
    const tags = Array.from({ length: 30 }, (_, i) => "ą".repeat(MAX_TAG_LENGTH - i));
    expect(exceedsMatchUrl({ staple: tags, exclude: tags })).toBe(true);
  });

  it("counts every section, not only the ones passed first", () => {
    const tags = Array.from({ length: 30 }, (_, i) => "ą".repeat(MAX_TAG_LENGTH - i));
    expect(exceedsMatchUrl({ exclude: tags })).toBe(true);
    expect(exceedsMatchUrl({ have: tags })).toBe(true);
  });
});
