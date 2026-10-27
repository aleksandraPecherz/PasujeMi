import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASE_REVIEW } from "../../code-reviewer/src/test-fixtures.ts";
import type { QueryFn, QueryMessage, QueryParams } from "../../code-reviewer/src/run.ts";
import ReviewProvider, { toTokenUsage } from "./provider.ts";

const MODEL = "model-under-test";
const vars = { title: "Tytuł", body: "Opis", diff: "diff --git a/x b/x\n+x" };

const success = (structured_output: unknown = BASE_REVIEW): QueryMessage & { modelUsage: Record<string, unknown> } => ({
  type: "result",
  subtype: "success",
  structured_output,
  total_cost_usd: 0.0123,
  num_turns: 2,
  duration_ms: 5000,
  usage: { input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: 10, output_tokens: 40 },
  modelUsage: { [MODEL]: { costUSD: 0.0123 } },
});

function fakeQuery(messages: QueryMessage[], thrown?: Error) {
  const calls: QueryParams[] = [];
  const queryFn: QueryFn = async function* (params) {
    calls.push(params);
    for (const message of messages) yield message;
    if (thrown) throw thrown;
  };
  return { calls, queryFn };
}

const provider = (queryFn: QueryFn, config: Record<string, unknown> = { model: MODEL }) =>
  new ReviewProvider({ id: "label", config }, { queryFn });
const parse = (output: string | undefined) => JSON.parse(output ?? "null") as Record<string, unknown>;

describe("ReviewProvider construction", () => {
  it("requires config.model and never defaults it", () => {
    assert.throws(() => new ReviewProvider({ config: {} }), /config\.model is required/);
    assert.throws(() => new ReviewProvider({}), /config\.model is required/);
    assert.throws(() => new ReviewProvider({ config: { model: "  " } }), /config\.model is required/);
    assert.throws(() => new ReviewProvider({ config: { model: 5 } }), /config\.model is required/);
  });

  it("uses the label as id and falls back to a model-based id", () => {
    assert.equal(new ReviewProvider({ id: "A", config: { model: MODEL } }).id(), "A");
    assert.equal(new ReviewProvider({ config: { model: MODEL } }).id(), `code-reviewer:${MODEL}`);
  });
});

describe("ReviewProvider options passed to the SDK", () => {
  it("replaces only the model and adds no fallbackModel", async () => {
    const { calls, queryFn } = fakeQuery([success()]);
    await provider(queryFn).callApi("ignored", { vars });
    assert.equal(calls.length, 1);
    const options = calls[0]?.options as Record<string, unknown>;
    assert.equal(options.model, MODEL);
    assert.ok(!("fallbackModel" in options));
    // The production options survive untouched.
    assert.deepEqual(options.tools, []);
    assert.deepEqual(options.settingSources, []);
    assert.equal(options.maxTurns, 2);
    assert.equal(options.maxBudgetUsd, 0.5);
    assert.ok(typeof options.systemPrompt === "string" && options.systemPrompt.length > 100);
    assert.equal((options.outputFormat as { type: string }).type, "json_schema");
  });

  it("ignores a fallback_model in the provider config", async () => {
    const { calls, queryFn } = fakeQuery([success()]);
    await provider(queryFn, { model: MODEL, fallbackModel: "other", fallback_model: "other" }).callApi("x", { vars });
    const options = calls[0]?.options as Record<string, unknown>;
    assert.ok(!("fallbackModel" in options) && !("fallback_model" in options));
  });
});

describe("ReviewProvider response", () => {
  it("returns the whole ResultFile as output plus prompt, tokens, cost and metadata", async () => {
    const { queryFn } = fakeQuery([success()]);
    const response = await provider(queryFn).callApi("ignored", { vars });
    assert.equal(response.error, undefined);
    const result = parse(response.output);
    assert.equal(result.status, "reviewed");
    assert.equal(result.outcome, "passed");
    assert.deepEqual(result.review, BASE_REVIEW);
    assert.ok(response.prompt?.includes("<diff>") && response.prompt.includes("diff --git a/x b/x"));
    assert.deepEqual(response.tokenUsage, { prompt: 112, completion: 40, total: 152 });
    assert.equal(response.cost, 0.0123);
    assert.equal(response.metadata?.requestedModel, MODEL);
    assert.deepEqual(response.metadata?.modelsUsed, [MODEL]);
    assert.equal(response.metadata?.status, "reviewed");
    assert.equal(response.metadata?.costIsEstimate, true);
    assert.equal(response.metadata?.numTurns, 2);
    assert.equal(response.metadata?.durationMs, 5000);
  });

  it("reports a model different from the requested one in modelsUsed", async () => {
    const message = { ...success(), modelUsage: { "silently-substituted": {} } };
    const response = await provider(fakeQuery([message]).queryFn).callApi("x", { vars });
    assert.deepEqual(response.metadata?.modelsUsed, ["silently-substituted"]);
    assert.equal(response.metadata?.requestedModel, MODEL);
  });

  it("returns an SDK error as a normal output with a category, not as the error field", async () => {
    const failure: QueryMessage = {
      type: "result",
      subtype: "error_max_turns",
      total_cost_usd: 0.4,
      num_turns: 2,
      usage: { output_tokens: 3 },
    };
    const response = await provider(fakeQuery([failure]).queryFn).callApi("x", { vars });
    assert.equal(response.error, undefined);
    const result = parse(response.output);
    assert.equal(result.status, "error");
    assert.equal(result.category, "max-turns");
    assert.equal(response.metadata?.category, "max-turns");
    assert.equal(response.cost, 0.4);
  });

  it("returns invalid model output as status error", async () => {
    const response = await provider(fakeQuery([success({ nope: true })]).queryFn).callApi("x", { vars });
    const result = parse(response.output);
    assert.equal(result.status, "error");
    assert.equal(result.category, "invalid-output");
  });

  it("omits tokenUsage and cost when there are no metrics, and keeps raw logs out", async () => {
    const { queryFn } = fakeQuery([], new Error("secret-looking path C:\\Users\\x\\token"));
    const response = await provider(queryFn).callApi("x", { vars });
    assert.equal(parse(response.output).status, "error");
    assert.equal(response.tokenUsage, undefined);
    assert.equal(response.cost, undefined);
    assert.ok(!JSON.stringify(response).includes("secret-looking"));
  });

  it("passes a skipped result through without calling the SDK", async () => {
    const { calls, queryFn } = fakeQuery([success()]);
    const response = await provider(queryFn).callApi("x", { vars: { ...vars, diff: "   " } });
    assert.equal(calls.length, 0);
    const result = parse(response.output);
    assert.equal(result.status, "skipped");
    assert.equal(response.metadata?.reason, "pusty diff");
    assert.equal(response.cost, undefined);
  });

  it("reports a missing diff variable as an error response", async () => {
    const { calls, queryFn } = fakeQuery([success()]);
    const response = await provider(queryFn).callApi("x", { vars: { title: "t" } });
    assert.match(response.error ?? "", /vars\.diff/);
    assert.equal(response.output, undefined);
    assert.equal(calls.length, 0);
  });

  it("uses empty title and body when the variables are absent", async () => {
    const { calls, queryFn } = fakeQuery([success()]);
    await provider(queryFn).callApi("x", { vars: { diff: "diff --git a/x b/x" } });
    assert.ok(calls[0]?.prompt.includes("(pusty tytuł)") && calls[0].prompt.includes("(pusty opis)"));
  });
});

describe("toTokenUsage", () => {
  it("counts cache tokens as prompt tokens and tolerates missing fields", () => {
    assert.deepEqual(toTokenUsage({ output_tokens: 5 }), { prompt: 0, completion: 5, total: 5 });
    assert.equal(toTokenUsage(null), undefined);
    assert.equal(toTokenUsage("x"), undefined);
  });
});
