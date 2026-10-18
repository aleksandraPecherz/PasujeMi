import { describe, expect, it } from "vitest";
import { EXPECTED_HEADERS, checkHeaders, readNumericCell, toInsertRow } from "./sheet";

describe("checkHeaders", () => {
  it("accepts the contract headers", () => {
    expect(checkHeaders([...EXPECTED_HEADERS])).toBeNull();
  });

  it("names the first differing column", () => {
    const headers: string[] = [...EXPECTED_HEADERS];
    headers[6] = "Kalorie";
    expect(checkHeaders(headers)).toContain("Kolumna 7");
  });

  it("rejects a missing column", () => {
    expect(checkHeaders(EXPECTED_HEADERS.slice(0, 10))).toContain("Kolumna 11");
  });
});

describe("readNumericCell", () => {
  it("reads numbers, formula results and empty cells", () => {
    expect(readNumericCell(406, "406")).toBe(406);
    expect(readNumericCell({ formula: "A1*2", result: 812 }, "812")).toBe(812);
    expect(readNumericCell(null, "")).toBeNull();
  });

  it("keeps the text of anything else", () => {
    expect(readNumericCell("406", "406")).toBe("406");
    expect(readNumericCell({ formula: "1/0", result: { error: "#DIV/0!" } }, "#DIV/0!")).toBe("#DIV/0!");
  });
});

describe("toInsertRow", () => {
  it("maps fields to snake_case with author and match keys", () => {
    const row = toInsertRow(
      {
        name: "Jajecznica",
        steps: ["Usmaż."],
        ingredients: [{ name: "Jajka", product: "jajka", amount: 3, unit: "szt", substitutes: [] }],
        prepTimeMin: 10,
        servings: 1,
        kinds: ["na wytrawnie"],
        kcal: 300,
        proteinG: 20,
        carbsG: 2,
        fatG: 22,
      },
      "author-id",
    );
    expect(row).toMatchObject({ name: "Jajecznica", prep_time_min: 10, protein_g: 20, author_id: "author-id" });
    expect(row.match_keys).toHaveLength(1);
    expect(row.match_keys_version).toBeTypeOf("number");
  });
});
