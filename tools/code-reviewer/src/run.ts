// One review run with an injected `query` function. This module never imports the SDK, so tests can
// count calls with a fake; only index.ts wires the real query().
import { categoryFromSubtype } from "./errors.ts";
import { prepareInput } from "./input.ts";
import { deriveOutcome, type ErrorCategory, type ResultFile } from "./outcome.ts";
import { REVIEW_JSON_SCHEMA, SYSTEM_PROMPT } from "./review-schema.ts";
import { validateReview } from "./validate.ts";

export const MODEL = "claude-sonnet-5-5";
// Hard wall-clock limit for the single query(); must stay below the job timeout-minutes (15) in
// ai-code-review.yml, which leaves time for install and for publishing the error comment.
export const REVIEW_TIMEOUT_MS = 10 * 60_000;

export type QueryParams = {
  prompt: string;
  options: {
    model: string;
    systemPrompt: string;
    tools: never[];
    settingSources: never[];
    maxTurns: number;
    maxBudgetUsd: number;
    outputFormat: { type: "json_schema"; schema: Record<string, unknown> };
    abortController: AbortController;
  };
};

// The subset of SDK messages this module reads; the real SDK messages are structurally compatible.
export type QueryMessage = {
  type: string;
  subtype?: string;
  structured_output?: unknown;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  usage?: unknown;
};
export type QueryFn = (params: QueryParams) => AsyncIterable<QueryMessage>;

export type Metrics = {
  total_cost_usd_estimate: number;
  num_turns: number;
  duration_ms: number;
  usage: unknown;
};

export type RunInput = {
  title: string;
  body: string;
  diff: string;
  excludedFiles: readonly string[];
  requireToken: boolean;
  hasToken: boolean;
};
// `logs` are raw details for stderr only; they must not be written to the comment.
export type RunOutput = { result: ResultFile; metrics: Metrics | null; logs: string[] };

function toMetrics(message: QueryMessage): Metrics {
  return {
    total_cost_usd_estimate: message.total_cost_usd ?? 0,
    num_turns: message.num_turns ?? 0,
    duration_ms: message.duration_ms ?? 0,
    usage: message.usage ?? null,
  };
}

const errorResult = (category: ErrorCategory, chars?: number): ResultFile =>
  chars === undefined
    ? { status: "error", outcome: "error", category }
    : { status: "error", outcome: "error", category, chars };

export async function runReview(
  input: RunInput,
  queryFn: QueryFn,
  timeoutMs: number = REVIEW_TIMEOUT_MS,
): Promise<RunOutput> {
  const logs: string[] = [];

  // Order: nothing to review -> too large -> missing token -> SDK. Skip and limit need no secret.
  const prepared = prepareInput(input);
  if (prepared.kind === "skip") {
    return { result: { status: "skipped", outcome: "skipped", reason: prepared.reason }, metrics: null, logs };
  }
  if (prepared.kind === "too-large") {
    logs.push(`Wejście za duże: ${prepared.chars} znaków.`);
    return { result: errorResult("input-too-large", prepared.chars), metrics: null, logs };
  }
  if (input.requireToken && !input.hasToken) {
    return { result: errorResult("missing-secret"), metrics: null, logs };
  }

  // Exactly one query() per run, no retries: the category comes from the last result before any throw.
  let lastResult: QueryMessage | undefined;
  let thrown: unknown;
  const abortController = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The deadline races the stream, so a query() that ignores the abort signal still ends the run.
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      abortController.abort();
      resolve();
    }, timeoutMs);
  });
  const consume = async (): Promise<void> => {
    for await (const message of queryFn({
      prompt: prepared.prompt,
      options: {
        model: MODEL,
        systemPrompt: SYSTEM_PROMPT,
        tools: [],
        settingSources: [],
        maxTurns: 2,
        maxBudgetUsd: 0.5,
        outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
        abortController,
      },
    })) {
      if (message.type === "result") lastResult = message;
    }
  };
  try {
    await Promise.race([consume(), deadline]);
  } catch (error) {
    thrown = error;
    logs.push(`Wyjątek z query(): ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }

  if (timedOut) {
    logs.push(`Przekroczono limit czasu query(): ${timeoutMs} ms.`);
    return { result: errorResult("timeout"), metrics: null, logs };
  }

  if (!lastResult) {
    return { result: errorResult(thrown === undefined ? "no-result" : "unexpected"), metrics: null, logs };
  }

  const metrics = toMetrics(lastResult);
  if (lastResult.subtype !== "success") {
    logs.push(`Wynik SDK: ${lastResult.subtype ?? "brak subtype"}.`);
    return { result: errorResult(categoryFromSubtype(lastResult.subtype ?? "")), metrics, logs };
  }

  const validation = validateReview(lastResult.structured_output);
  if (!validation.ok) {
    logs.push(validation.detail);
    return { result: errorResult(validation.category), metrics, logs };
  }
  return {
    result: { status: "reviewed", outcome: deriveOutcome(validation.review), review: validation.review },
    metrics,
    logs,
  };
}
