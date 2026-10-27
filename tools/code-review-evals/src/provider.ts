// promptfoo custom provider: runs the real runReview() from tools/code-reviewer with the model taken from
// the provider config. Prompt, schema, validation and gate stay those of production; only options.model is replaced.
// Auth is whatever the Agent SDK does by default; this module never reads credentials.
import { runReview, type Metrics, type QueryFn, type QueryMessage } from "../../code-reviewer/src/run.ts";

type ProviderOptions = { id?: string; config?: Record<string, unknown> };
type CallContext = { vars?: Record<string, unknown> };
type TokenUsage = { prompt: number; completion: number; total: number };
export type ProviderResponse = {
  output?: string;
  error?: string;
  prompt?: string;
  tokenUsage?: TokenUsage;
  cost?: number;
  metadata?: Record<string, unknown>;
};
export type ProviderDeps = { queryFn?: QueryFn };

// The result message carries modelUsage, which run.ts does not type.
type SdkMessage = QueryMessage & { modelUsage?: Record<string, unknown> };

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export function toTokenUsage(usage: unknown): TokenUsage | undefined {
  if (typeof usage !== "object" || usage === null) return undefined;
  const u = usage as Record<string, unknown>;
  // Cache creation and cache reads are input the model processed, so they count as prompt tokens.
  const prompt = num(u.input_tokens) + num(u.cache_creation_input_tokens) + num(u.cache_read_input_tokens);
  const completion = num(u.output_tokens);
  return { prompt, completion, total: prompt + completion };
}

export function toMetadata(base: Record<string, unknown>, metrics: Metrics | null): Record<string, unknown> {
  if (!metrics) return base;
  return {
    ...base,
    numTurns: metrics.num_turns,
    durationMs: metrics.duration_ms,
    costIsEstimate: true,
    usage: metrics.usage,
  };
}

async function sdkQuery(): Promise<QueryFn> {
  // Loaded lazily so tests with an injected queryFn never import the SDK.
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  return query as unknown as QueryFn;
}

export default class ReviewProvider {
  private readonly providerId: string;
  private readonly model: string;
  private readonly deps: ProviderDeps;

  constructor(options: ProviderOptions = {}, deps: ProviderDeps = {}) {
    const model = options.config?.model;
    // No default model on purpose: a silent fallback to production's MODEL would corrupt a comparison.
    if (typeof model !== "string" || model.trim() === "") {
      throw new Error("ReviewProvider: config.model is required (a non-empty model id).");
    }
    this.model = model;
    this.providerId = options.id ?? `code-reviewer:${model}`;
    this.deps = deps;
  }

  id(): string {
    return this.providerId;
  }

  async callApi(_prompt: string, context?: CallContext): Promise<ProviderResponse> {
    const { title, body, diff } = context?.vars ?? {};
    if (typeof diff !== "string") return { error: "ReviewProvider: vars.diff must be a string." };

    const base = this.deps.queryFn ?? (await sdkQuery());
    let sentPrompt: string | undefined;
    let modelsUsed: string[] = [];
    const model = this.model;
    const queryFn: QueryFn = async function* (params) {
      sentPrompt = params.prompt;
      // Spread keeps every production option; only the model is replaced and no fallbackModel is added.
      for await (const message of base({ ...params, options: { ...params.options, model } })) {
        if (message.type === "result") modelsUsed = Object.keys((message as SdkMessage).modelUsage ?? {});
        yield message;
      }
    };

    const { result, metrics } = await runReview(
      {
        title: typeof title === "string" ? title : "",
        body: typeof body === "string" ? body : "",
        diff,
        excludedFiles: [],
        requireToken: false,
        hasToken: true,
      },
      queryFn,
    );

    // Raw logs are left out on purpose: they can carry exception messages.
    const metadata = toMetadata(
      {
        status: result.status,
        outcome: result.outcome,
        ...(result.status === "error" ? { category: result.category } : {}),
        ...(result.status === "skipped" ? { reason: result.reason } : {}),
        requestedModel: this.model,
        modelsUsed,
      },
      metrics,
    );
    const tokenUsage = metrics ? toTokenUsage(metrics.usage) : undefined;
    return {
      output: JSON.stringify(result),
      ...(sentPrompt === undefined ? {} : { prompt: sentPrompt }),
      ...(tokenUsage ? { tokenUsage } : {}),
      ...(metrics ? { cost: metrics.total_cost_usd_estimate } : {}),
      metadata,
    };
  }
}
