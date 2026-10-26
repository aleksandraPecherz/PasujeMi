import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASE_REVIEW, loadReview } from "./test-fixtures.ts";
import { validateReview } from "./validate.ts";

const entry = (criterion: string, reason: string, note = "powód") => ({ criterion, reason, note });
const rejects = (raw: unknown) => {
  const result = validateReview(raw);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.category, "invalid-output");
};

describe("validateReview", () => {
  it("accepts a valid review without notAssessed", () => {
    assert.equal(validateReview(BASE_REVIEW).ok, true);
  });

  it("accepts null with exactly one no-data entry", () => {
    const raw = { ...BASE_REVIEW, testRiskCoverage: null, notAssessed: [entry("testRiskCoverage", "no-data")] };
    assert.equal(validateReview(raw).ok, true);
  });

  it("accepts null with exactly one not-applicable entry", () => {
    const raw = { ...BASE_REVIEW, documentation: null, notAssessed: [entry("documentation", "not-applicable")] };
    assert.equal(validateReview(raw).ok, true);
  });

  it("accepts the synthetic fixtures", () => {
    for (const name of ["review-v2", "review-v2-failed", "review-v2-incomplete"] as const) {
      assert.equal(validateReview(loadReview(name)).ok, true, name);
    }
  });

  it("rejects null without an entry", () => {
    rejects({ ...BASE_REVIEW, testRiskCoverage: null });
  });

  it("rejects two entries for the same criterion", () => {
    const notAssessed = [entry("testRiskCoverage", "no-data"), entry("testRiskCoverage", "not-applicable")];
    rejects({ ...BASE_REVIEW, testRiskCoverage: null, notAssessed });
  });

  it("rejects an entry for a numeric score", () => {
    rejects({ ...BASE_REVIEW, notAssessed: [entry("documentation", "no-data")] });
  });

  it("rejects an unknown criterion", () => {
    rejects({ ...BASE_REVIEW, notAssessed: [entry("style", "no-data")] });
  });

  it("rejects an empty note and a whitespace-only note", () => {
    for (const note of ["", "   \n\t"]) {
      rejects({ ...BASE_REVIEW, documentation: null, notAssessed: [entry("documentation", "no-data", note)] });
    }
  });

  it("rejects scores 0, 11 and 7.5", () => {
    for (const value of [0, 11, 7.5]) rejects({ ...BASE_REVIEW, complexity: value });
  });

  it("rejects a wrong-case enum value", () => {
    rejects({ ...BASE_REVIEW, verdict: "Pass" });
    rejects({ ...BASE_REVIEW, documentation: null, notAssessed: [entry("documentation", "No-Data")] });
  });

  it("rejects non-object input and missing fields", () => {
    rejects(null);
    rejects("text");
    rejects({ ...BASE_REVIEW, notAssessed: undefined });
  });
});
