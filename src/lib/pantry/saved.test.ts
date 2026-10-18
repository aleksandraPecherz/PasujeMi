import { describe, expect, it } from "vitest";
import { MAX_TAG_LENGTH, MAX_TAGS, countTokens, exceedsMatchUrl } from "@/lib/matching/limits";
import { MAX_SAVED_TOKENS } from "@/lib/pantry/limits";
import { EMPTY_SAVED, initialFilters, parseSavedPantry } from "@/lib/pantry/saved";

/** Unique two-word tags (digits vanish in tokenize), so n tags are 2n words. */
function twoWordTags(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `ser żółty ${String(i)}`);
}

describe("parseSavedPantry", () => {
  it("accepts valid lists, including empty ones", () => {
    expect(parseSavedPantry({ staple: ["sól", "pieprz"], exclude: ["orzechy"] })).toEqual({
      staple: ["sól", "pieprz"],
      exclude: ["orzechy"],
    });
    expect(parseSavedPantry({ staple: [], exclude: [] })).toEqual(EMPTY_SAVED);
  });

  it("returns trimmed values and ignores extra keys", () => {
    expect(parseSavedPantry({ staple: ["  sól "], exclude: [], ownerId: "x" })).toEqual({
      staple: ["sól"],
      exclude: [],
    });
  });

  it.each([null, undefined, "", "text", 42, [], { staple: [] }, { exclude: [] }])("rejects %j", (input) => {
    expect(parseSavedPantry(input)).toBeNull();
  });

  it("rejects sections that are not arrays", () => {
    expect(parseSavedPantry({ staple: "sól", exclude: [] })).toBeNull();
    expect(parseSavedPantry({ staple: [], exclude: { 0: "orzechy" } })).toBeNull();
  });

  it("rejects non-string and empty tags", () => {
    expect(parseSavedPantry({ staple: [1], exclude: [] })).toBeNull();
    expect(parseSavedPantry({ staple: [], exclude: [null] })).toBeNull();
    expect(parseSavedPantry({ staple: ["  "], exclude: [] })).toBeNull();
  });

  it("rejects a tag above MAX_TAG_LENGTH, but accepts exactly MAX_TAG_LENGTH", () => {
    expect(parseSavedPantry({ staple: ["a".repeat(MAX_TAG_LENGTH + 1)], exclude: [] })).toBeNull();
    expect(parseSavedPantry({ staple: [], exclude: ["a".repeat(MAX_TAG_LENGTH)] })).not.toBeNull();
  });

  it("rejects a section above MAX_TAGS", () => {
    const tags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `tag${String(i)}`);
    expect(parseSavedPantry({ staple: tags, exclude: [] })).toBeNull();
    expect(parseSavedPantry({ staple: [], exclude: tags })).toBeNull();
  });

  it("rejects duplicates within a section regardless of case and trimming", () => {
    expect(parseSavedPantry({ staple: ["sól", "Sól"], exclude: [] })).toBeNull();
    expect(parseSavedPantry({ staple: [], exclude: ["Żółty ser", " żółty ser"] })).toBeNull();
  });

  it("allows the same tag in both sections", () => {
    expect(parseSavedPantry({ staple: ["sól"], exclude: ["sól"] })).not.toBeNull();
  });

  it("accepts exactly MAX_SAVED_TOKENS words and rejects one more", () => {
    const staple = twoWordTags(MAX_TAGS);
    expect(countTokens(staple)).toBe(MAX_SAVED_TOKENS);
    expect(parseSavedPantry({ staple, exclude: [] })).not.toBeNull();
    expect(parseSavedPantry({ staple, exclude: ["orzechy"] })).toBeNull();
  });

  it("rejects lists that fit the word limit but not the match URL budget", () => {
    // Single-word tags with "ą" (6 characters each once encoded), unique by length: 2 x 30 words.
    const tags = Array.from({ length: MAX_TAGS }, (_, i) => "ą".repeat(MAX_TAG_LENGTH - i));
    expect(countTokens([...tags, ...tags])).toBeLessThanOrEqual(MAX_SAVED_TOKENS);
    expect(exceedsMatchUrl({ staple: tags, exclude: tags })).toBe(true);
    expect(parseSavedPantry({ staple: tags, exclude: tags })).toBeNull();
  });
});

describe("initialFilters", () => {
  it("starts empty without saved lists", () => {
    expect(initialFilters(null)).toEqual({ have: [], staple: [], exclude: [] });
    expect(initialFilters(EMPTY_SAVED)).toEqual({ have: [], staple: [], exclude: [] });
  });

  it("carries saved staples and exclusions and never has owned products", () => {
    expect(initialFilters({ staple: ["sól"], exclude: ["orzechy"] })).toEqual({
      have: [],
      staple: ["sól"],
      exclude: ["orzechy"],
    });
  });
});
