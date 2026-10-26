import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoryFromSubtype, ERROR_CATEGORIES, safeMessage } from "./errors.ts";
import { MAX_INPUT_CHARS } from "./input.ts";

describe("categoryFromSubtype", () => {
  it("maps known SDK subtypes", () => {
    assert.equal(categoryFromSubtype("error_max_budget_usd"), "budget-exceeded");
    assert.equal(categoryFromSubtype("error_max_turns"), "max-turns");
    assert.equal(categoryFromSubtype("error_max_structured_output_retries"), "structured-output-retries");
  });

  it("maps error_during_execution and unknown subtypes to sdk-error", () => {
    assert.equal(categoryFromSubtype("error_during_execution"), "sdk-error");
    assert.equal(categoryFromSubtype("something_new"), "sdk-error");
    assert.equal(categoryFromSubtype(""), "sdk-error");
  });
});

describe("safeMessage", () => {
  it("is a non-empty fixed text for every category", () => {
    for (const category of ERROR_CATEGORIES) {
      const message = safeMessage(category);
      assert.ok(message.length > 0, category);
      assert.ok(!message.includes("undefined"), category);
    }
  });

  it("shows the size and the limit for input-too-large", () => {
    const message = safeMessage("input-too-large", 61_234);
    assert.ok(message.includes("61234"));
    assert.ok(message.includes(String(MAX_INPUT_CHARS)));
  });
});
