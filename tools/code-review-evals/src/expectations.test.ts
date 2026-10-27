import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveOutcome, type ResultFile } from "../../code-reviewer/src/outcome.ts";
import type { Review } from "../../code-reviewer/src/review-schema.ts";
import { BASE_REVIEW } from "../../code-reviewer/src/test-fixtures.ts";
import {
  BUG_SCORE_LIMIT,
  bugCase,
  correctCase,
  modelUsed,
  noDataCase,
  parseResult,
  reviewSchema,
  statusReviewed,
} from "./expectations.ts";

const reviewed = (review: Review): ResultFile => ({ status: "reviewed", outcome: deriveOutcome(review), review });
const wire = (result: ResultFile): string => JSON.stringify(result);

// Stored results, one per situation the expectations care about.
const passed = reviewed(BASE_REVIEW);
const bugDetected = reviewed({
  ...BASE_REVIEW,
  implementationCorrectness: 3,
  verdict: "fail",
  summary: "Zwraca 200 mimo błędu zapisu.",
});
const noDataReview: Review = {
  ...BASE_REVIEW,
  testRiskCoverage: null,
  notAssessed: [{ criterion: "testRiskCoverage", reason: "no-data", note: "Brak testów w diffie." }],
};
const noData = reviewed(noDataReview);
const errored: ResultFile = { status: "error", outcome: "error", category: "timeout" };
const skipped: ResultFile = { status: "skipped", outcome: "skipped", reason: "pusty diff" };

describe("parseResult", () => {
  it("rejects text that is not JSON, non-objects and unknown statuses", () => {
    assert.equal(parseResult("not json").ok, false);
    assert.equal(parseResult("42").ok, false);
    assert.equal(parseResult(JSON.stringify({ status: "weird" })).ok, false);
    assert.equal(parseResult(wire(passed)).ok, true);
  });
});

describe("statusReviewed and reviewSchema", () => {
  it("statusReviewed fails for error, skipped and non-JSON output", () => {
    assert.equal(statusReviewed(wire(passed)).pass, true);
    for (const output of [wire(errored), wire(skipped), "not json"]) assert.equal(statusReviewed(output).pass, false);
    assert.match(statusReviewed(wire(errored)).reason, /timeout/);
  });

  it("reviewSchema rejects an invalid review, but only for status reviewed", () => {
    const invalid = JSON.stringify({ status: "reviewed", outcome: "passed", review: { nope: true } });
    assert.equal(reviewSchema(wire(passed)).pass, true);
    assert.equal(reviewSchema(invalid).pass, false);
    // error and skipped carry no review: the schema layer does not apply, statusReviewed is what fails.
    assert.equal(reviewSchema(wire(errored)).pass, true);
    assert.equal(reviewSchema(wire(skipped)).pass, true);
    assert.equal(reviewSchema("not json").pass, false);
  });
});

describe("modelUsed", () => {
  it("passes only when the SDK reported the requested model", () => {
    assert.equal(modelUsed({ requestedModel: "m", modelsUsed: ["m"] }).pass, true);
    assert.equal(modelUsed({ requestedModel: "m", modelsUsed: ["other"] }).pass, false);
    assert.equal(modelUsed({ requestedModel: "m", modelsUsed: [] }).pass, false);
    assert.equal(modelUsed({ modelsUsed: ["m"] }).pass, false);
    assert.equal(modelUsed(undefined).pass, false);
  });
});

describe("correctCase", () => {
  it("passes a passed review with a numeric testRiskCoverage", () => {
    assert.equal(correctCase(wire(passed)).pass, true);
  });

  it("fails failed, incomplete, error, skipped and non-JSON results", () => {
    for (const result of [bugDetected, noData, errored, skipped]) assert.equal(correctCase(wire(result)).pass, false);
    assert.equal(correctCase("not json").pass, false);
  });
});

describe("bugCase", () => {
  it("passes a failed outcome with implementationCorrectness below the limit", () => {
    assert.equal(bugCase(wire(bugDetected)).pass, true);
    assert.match(bugCase(wire(bugDetected)).reason, /manual/);
  });

  it("is necessary, not sufficient: a failure for another reason does not pass", () => {
    const otherReason = reviewed({ ...BASE_REVIEW, documentation: 2, verdict: "fail" });
    assert.equal(otherReason.outcome, "failed");
    assert.equal(bugCase(wire(otherReason)).pass, false);
  });

  it("treats the limit as exclusive", () => {
    const atLimit = reviewed({ ...BASE_REVIEW, implementationCorrectness: BUG_SCORE_LIMIT, verdict: "fail" });
    assert.equal(bugCase(wire(atLimit)).pass, false);
  });

  it("fails a null implementationCorrectness, passed, error and skipped results", () => {
    const nullScore = reviewed({
      ...BASE_REVIEW,
      implementationCorrectness: null,
      verdict: "fail",
      notAssessed: [{ criterion: "implementationCorrectness", reason: "no-data", note: "n" }],
    });
    for (const result of [nullScore, passed, errored, skipped]) assert.equal(bugCase(wire(result)).pass, false);
  });
});

describe("noDataCase", () => {
  it("passes incomplete with exactly one testRiskCoverage/no-data entry", () => {
    assert.equal(noDataCase(wire(noData)).pass, true);
  });

  it("fails other outcomes, a numeric score, a wrong reason or criterion, extra entries, error and skipped", () => {
    const entry = (criterion: "testRiskCoverage" | "documentation", reason: "no-data" | "not-applicable") => ({
      criterion,
      reason,
      note: "n",
    });
    const wrongReason = reviewed({ ...noDataReview, notAssessed: [entry("testRiskCoverage", "not-applicable")] });
    const wrongCriterion = reviewed({
      ...BASE_REVIEW,
      documentation: null,
      notAssessed: [entry("documentation", "no-data")],
    });
    const extra = reviewed({
      ...BASE_REVIEW,
      testRiskCoverage: null,
      documentation: null,
      notAssessed: [entry("testRiskCoverage", "no-data"), entry("documentation", "no-data")],
    });
    for (const result of [passed, bugDetected, wrongReason, wrongCriterion, extra, errored, skipped]) {
      assert.equal(noDataCase(wire(result)).pass, false, JSON.stringify(result).slice(0, 80));
    }
  });
});
