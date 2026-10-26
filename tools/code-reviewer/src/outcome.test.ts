import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveOutcome,
  labelsToRemove,
  OUTCOME_PRECEDENCE,
  PASS_THRESHOLD,
  RESULT_LABELS,
  STALE_LABEL,
  TRIGGER_LABEL,
  worstOutcome,
  type Outcome,
} from "./outcome.ts";
import { SCORE_FIELDS } from "./review-schema.ts";
import { BASE_REVIEW } from "./test-fixtures.ts";

const noData = { criterion: "testRiskCoverage" as const, reason: "no-data" as const, note: "brak" };
const notApplicable = {
  criterion: "testRiskCoverage" as const,
  reason: "not-applicable" as const,
  note: "dokumentacja",
};

describe("deriveOutcome", () => {
  it("fails on verdict fail even with high scores", () => {
    assert.equal(deriveOutcome({ ...BASE_REVIEW, verdict: "fail", complexity: 10 }), "failed");
  });

  it("uses the threshold: 4 fails, 5 passes", () => {
    assert.equal(PASS_THRESHOLD, 5);
    assert.equal(deriveOutcome({ ...BASE_REVIEW, complexity: 4 }), "failed");
    assert.equal(deriveOutcome({ ...BASE_REVIEW, complexity: 5 }), "passed");
  });

  it("pass + no-data is incomplete, pass + not-applicable is passed", () => {
    assert.equal(deriveOutcome({ ...BASE_REVIEW, testRiskCoverage: null, notAssessed: [noData] }), "incomplete");
    assert.equal(deriveOutcome({ ...BASE_REVIEW, testRiskCoverage: null, notAssessed: [notApplicable] }), "passed");
  });

  it("fail + no-data stays failed", () => {
    const review = { ...BASE_REVIEW, verdict: "fail" as const, testRiskCoverage: null, notAssessed: [noData] };
    assert.equal(deriveOutcome(review), "failed");
  });

  it("all scores null: reasons and verdict decide", () => {
    const nulls = Object.fromEntries(SCORE_FIELDS.map((field) => [field, null]));
    const entries = (reason: "no-data" | "not-applicable") =>
      SCORE_FIELDS.map((criterion) => ({ criterion, reason, note: "n" }));
    assert.equal(deriveOutcome({ ...BASE_REVIEW, ...nulls, notAssessed: entries("not-applicable") }), "passed");
    assert.equal(deriveOutcome({ ...BASE_REVIEW, ...nulls, notAssessed: entries("no-data") }), "incomplete");
    assert.equal(
      deriveOutcome({ ...BASE_REVIEW, ...nulls, verdict: "fail", notAssessed: entries("no-data") }),
      "failed",
    );
  });
});

describe("worstOutcome", () => {
  it("applies error > failed > incomplete > passed", () => {
    assert.deepEqual([...OUTCOME_PRECEDENCE], ["error", "failed", "incomplete", "passed"]);
    assert.equal(worstOutcome(["passed", "incomplete", "failed", "error"]), "error");
    assert.equal(worstOutcome(["passed", "incomplete", "failed"]), "failed");
    assert.equal(worstOutcome(["passed", "incomplete"]), "incomplete");
    assert.equal(worstOutcome(["passed"]), "passed");
    assert.equal(worstOutcome([]), null);
  });
});

describe("labelsToRemove", () => {
  const outcomes: Outcome[] = ["passed", "failed", "incomplete", "error", "skipped"];

  it("never returns the trigger label and always returns stale", () => {
    for (const outcome of outcomes) {
      const labels = labelsToRemove(outcome);
      assert.ok(!labels.includes(TRIGGER_LABEL), outcome);
      assert.ok(labels.includes(STALE_LABEL), outcome);
    }
  });

  it("excludes the current result label", () => {
    for (const outcome of ["passed", "failed", "incomplete", "error"] as const) {
      assert.ok(!labelsToRemove(outcome).includes(RESULT_LABELS[outcome]), outcome);
      assert.equal(labelsToRemove(outcome).length, 4);
    }
  });

  it("removes every result label for skipped", () => {
    assert.deepEqual(new Set(labelsToRemove("skipped")), new Set([...Object.values(RESULT_LABELS), STALE_LABEL]));
  });

  it("keeps the trigger label out of the result set", () => {
    assert.ok(!(Object.values(RESULT_LABELS) as string[]).includes(TRIGGER_LABEL));
  });
});
