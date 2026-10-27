// Check-only provider: the real ReviewProvider (and so the real runReview) with a canned queryFn. No SDK, no model.
// The canned review depends on the diff, so a dry run of the real config can satisfy every expectation.
import { BASE_REVIEW } from "../../code-reviewer/src/test-fixtures.ts";
import type { Review } from "../../code-reviewer/src/review-schema.ts";
import type { QueryFn } from "../../code-reviewer/src/run.ts";
import ReviewProvider from "../src/provider.ts";

const BUG_REVIEW: Review = {
  ...BASE_REVIEW,
  implementationCorrectness: 3,
  verdict: "fail",
  summary: "Canned: the endpoint answers 200 although the insert failed.",
};
const NO_DATA_REVIEW: Review = {
  ...BASE_REVIEW,
  testRiskCoverage: null,
  notAssessed: [{ criterion: "testRiskCoverage", reason: "no-data", note: "Canned: no tests in the diff." }],
};

function cannedReview(prompt: string): Review {
  if (prompt.includes("shopping-list")) return BUG_REVIEW;
  if (prompt.includes("formatQuantity")) return NO_DATA_REVIEW;
  return BASE_REVIEW;
}

const canned: QueryFn = async function* (params) {
  yield {
    type: "result",
    subtype: "success",
    structured_output: cannedReview(params.prompt),
    total_cost_usd: 0.01,
    num_turns: 1,
    duration_ms: 10,
    usage: { input_tokens: 1, output_tokens: 2 },
    // Echo the requested model so the checks can see which provider label produced the result.
    modelUsage: { [params.options.model]: {} },
  } as never;
};

export default class FakeReviewProvider extends ReviewProvider {
  constructor(options: { id?: string; config?: Record<string, unknown> } = {}) {
    super(options, { queryFn: canned });
  }
}
