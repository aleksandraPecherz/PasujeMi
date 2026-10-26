import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_INPUT_CHARS } from "./input.ts";
import { runReview, type QueryFn, type QueryMessage, type QueryParams, type RunInput } from "./run.ts";
import { BASE_REVIEW } from "./test-fixtures.ts";

const input: RunInput = {
  title: "Tytuł",
  body: "Opis",
  diff: "diff --git a/x b/x",
  excludedFiles: [],
  requireToken: false,
  hasToken: false,
};

const success = (structured_output: unknown): QueryMessage => ({
  type: "result",
  subtype: "success",
  structured_output,
  total_cost_usd: 0.1234,
  num_turns: 1,
  duration_ms: 4200,
  usage: { input_tokens: 10, output_tokens: 20 },
});
const failure = (subtype: string): QueryMessage => ({ type: "result", subtype, total_cost_usd: 0.4, num_turns: 2 });

// Fake query(): counts calls, yields the given messages, optionally throws afterwards.
function fakeQuery(messages: QueryMessage[], thrown?: Error) {
  const calls: QueryParams[] = [];
  const queryFn: QueryFn = (params) => {
    calls.push(params);
    return (async function* () {
      yield { type: "system" } satisfies QueryMessage;
      for (const message of messages) yield message;
      if (thrown) throw thrown;
    })();
  };
  return { queryFn, calls };
}

describe("runReview timeout", () => {
  it("ends with the timeout error after one query() and aborts it, even if the stream never ends", async () => {
    const calls: QueryParams[] = [];
    const hanging: QueryFn = (params) => {
      calls.push(params);
      return (async function* () {
        yield { type: "system" } satisfies QueryMessage;
        await new Promise<never>(() => {});
      })();
    };
    const out = await runReview(input, hanging, 20);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.abortController.signal.aborted, true);
    assert.deepEqual(out.result, { status: "error", outcome: "error", category: "timeout" });
    assert.equal(out.metrics, null);
    assert.ok(out.logs.some((line) => line.includes("limit czasu")));
  });

  it("does not time out a run that finishes in time", async () => {
    const { queryFn, calls } = fakeQuery([success(BASE_REVIEW)]);
    const out = await runReview(input, queryFn, 5_000);
    assert.equal(out.result.status, "reviewed");
    assert.equal(calls[0].options.abortController.signal.aborted, false);
  });
});

describe("runReview", () => {
  it("calls query exactly once on success and derives the outcome", async () => {
    const { queryFn, calls } = fakeQuery([success(BASE_REVIEW)]);
    const out = await runReview(input, queryFn);
    assert.equal(calls.length, 1);
    assert.equal(out.result.status, "reviewed");
    assert.equal(out.result.outcome, "passed");
    assert.deepEqual(out.metrics, {
      total_cost_usd_estimate: 0.1234,
      num_turns: 1,
      duration_ms: 4200,
      usage: { input_tokens: 10, output_tokens: 20 },
    });
  });

  it("passes the pinned options and the untrusted-data blocks to query", async () => {
    const { queryFn, calls } = fakeQuery([success(BASE_REVIEW)]);
    await runReview(input, queryFn);
    const { prompt, options } = calls[0];
    assert.match(prompt, /<pr_title>\nTytuł\n<\/pr_title>/);
    assert.equal(options.model, "claude-sonnet-5-5");
    assert.deepEqual(options.tools, []);
    assert.deepEqual(options.settingSources, []);
    assert.equal(options.maxTurns, 2);
    assert.equal(options.maxBudgetUsd, 0.5);
    assert.equal(options.outputFormat.type, "json_schema");
  });

  it("calls query once on an SDK error result and maps its subtype", async () => {
    const { queryFn, calls } = fakeQuery([failure("error_max_turns")]);
    const out = await runReview(input, queryFn);
    assert.equal(calls.length, 1);
    assert.deepEqual(out.result, { status: "error", outcome: "error", category: "max-turns" });
    assert.equal(out.metrics?.num_turns, 2);
  });

  it("calls query once when it throws after an error result and keeps the result's category", async () => {
    const { queryFn, calls } = fakeQuery([failure("error_max_budget_usd")], new Error("process exited with code 1"));
    const out = await runReview(input, queryFn);
    assert.equal(calls.length, 1);
    assert.deepEqual(out.result, { status: "error", outcome: "error", category: "budget-exceeded" });
    assert.ok(out.logs.some((line) => line.includes("process exited with code 1")));
  });

  it("maps a throw without any result to unexpected", async () => {
    const { queryFn, calls } = fakeQuery([], new Error("boom"));
    const out = await runReview(input, queryFn);
    assert.equal(calls.length, 1);
    assert.deepEqual(out.result, { status: "error", outcome: "error", category: "unexpected" });
    assert.equal(out.metrics, null);
  });

  it("returns no-result when the stream ends without a result", async () => {
    const { queryFn, calls } = fakeQuery([]);
    const out = await runReview(input, queryFn);
    assert.equal(calls.length, 1);
    assert.deepEqual(out.result, { status: "error", outcome: "error", category: "no-result" });
  });

  it("returns invalid-output when the answer breaks the contract", async () => {
    const { queryFn } = fakeQuery([success({ ...BASE_REVIEW, complexity: 11 })]);
    const out = await runReview(input, queryFn);
    assert.deepEqual(out.result, { status: "error", outcome: "error", category: "invalid-output" });
    assert.ok(out.metrics);
  });

  it("makes zero calls on skip, too-large and missing-secret", async () => {
    const skip = fakeQuery([success(BASE_REVIEW)]);
    const skipped = await runReview({ ...input, diff: "  ", excludedFiles: ["package-lock.json"] }, skip.queryFn);
    assert.equal(skipped.result.status, "skipped");
    assert.equal(skip.calls.length, 0);

    const big = fakeQuery([success(BASE_REVIEW)]);
    const tooLarge = await runReview({ ...input, diff: "x".repeat(MAX_INPUT_CHARS) }, big.queryFn);
    assert.equal(tooLarge.result.status, "error");
    assert.equal(tooLarge.result.outcome, "error");
    assert.equal((tooLarge.result as { category: string }).category, "input-too-large");
    assert.equal(big.calls.length, 0);

    const secret = fakeQuery([success(BASE_REVIEW)]);
    const missing = await runReview({ ...input, requireToken: true, hasToken: false }, secret.queryFn);
    assert.deepEqual(missing.result, { status: "error", outcome: "error", category: "missing-secret" });
    assert.equal(secret.calls.length, 0);
  });

  it("checks in order: skip, then too-large, then missing-secret", async () => {
    const { queryFn, calls } = fakeQuery([]);
    const strict = { ...input, requireToken: true, hasToken: false };
    const skipped = await runReview({ ...strict, diff: "" }, queryFn);
    assert.equal(skipped.result.status, "skipped");
    const tooLarge = await runReview({ ...strict, diff: "x".repeat(MAX_INPUT_CHARS + 1) }, queryFn);
    assert.equal((tooLarge.result as { category: string }).category, "input-too-large");
    assert.equal(calls.length, 0);
  });

  it("runs the SDK when the token is required and present", async () => {
    const { queryFn, calls } = fakeQuery([success(BASE_REVIEW)]);
    const out = await runReview({ ...input, requireToken: true, hasToken: true }, queryFn);
    assert.equal(out.result.status, "reviewed");
    assert.equal(calls.length, 1);
  });
});
