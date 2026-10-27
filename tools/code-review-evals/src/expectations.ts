// Deterministic checks that mirror expectations.md. Pure functions on the serialized ResultFile, so they can be
// tested on stored results. They never judge content quality: "wada wskazana" for the bug case stays manual.
import type { ResultFile } from "../../code-reviewer/src/outcome.ts";
import { REVIEW_SCHEMA } from "../../code-reviewer/src/review-schema.ts";

export type Verdict = { pass: boolean; score: number; reason: string };

const pass = (reason: string): Verdict => ({ pass: true, score: 1, reason });
const fail = (reason: string): Verdict => ({ pass: false, score: 0, reason });

// Upper bound (exclusive) for the score of the criterion that carries the planted defect.
export const BUG_SCORE_LIMIT = 5;

type Parsed = { ok: true; result: ResultFile } | { ok: false; reason: string };

export function parseResult(output: unknown): Parsed {
  let value: unknown = output;
  if (typeof output === "string") {
    try {
      value = JSON.parse(output);
    } catch {
      return { ok: false, reason: "output is not valid JSON" };
    }
  }
  if (typeof value !== "object" || value === null) return { ok: false, reason: "output is not a JSON object" };
  const status = (value as { status?: unknown }).status;
  if (status !== "reviewed" && status !== "error" && status !== "skipped") {
    return { ok: false, reason: `unknown status: ${String(status)}` };
  }
  return { ok: true, result: value as ResultFile };
}

const describeResult = (result: ResultFile): string =>
  result.status === "error"
    ? `status error (${result.category})`
    : result.status === "skipped"
      ? `status skipped (${result.reason})`
      : "status reviewed";

export function statusReviewed(output: unknown): Verdict {
  const parsed = parseResult(output);
  if (!parsed.ok) return fail(parsed.reason);
  return parsed.result.status === "reviewed"
    ? pass("status reviewed")
    : fail(`expected reviewed, got ${describeResult(parsed.result)}`);
}

// error/skipped have no review to validate; they fail statusReviewed instead.
export function reviewSchema(output: unknown): Verdict {
  const parsed = parseResult(output);
  if (!parsed.ok) return fail(parsed.reason);
  if (parsed.result.status !== "reviewed") return pass(`not applicable: ${describeResult(parsed.result)}`);
  const checked = REVIEW_SCHEMA.safeParse(parsed.result.review);
  return checked.success
    ? pass("review matches REVIEW_SCHEMA")
    : fail(`review does not match REVIEW_SCHEMA: ${checked.error.message}`);
}

export function modelUsed(metadata: Record<string, unknown> | undefined): Verdict {
  const requested = metadata?.requestedModel;
  const used = metadata?.modelsUsed;
  if (typeof requested !== "string" || requested === "") return fail("metadata.requestedModel is missing");
  if (!Array.isArray(used) || !used.includes(requested)) {
    return fail(`requested ${requested}, SDK reported ${JSON.stringify(used ?? null)}`);
  }
  return pass(`SDK reported the requested model ${requested}`);
}

function reviewedOrFail(
  output: unknown,
): { result: Extract<ResultFile, { status: "reviewed" }> } | { verdict: Verdict } {
  const parsed = parseResult(output);
  if (!parsed.ok) return { verdict: fail(parsed.reason) };
  if (parsed.result.status !== "reviewed") {
    return { verdict: fail(`expected reviewed, got ${describeResult(parsed.result)}`) };
  }
  return { result: parsed.result };
}

export function correctCase(output: unknown): Verdict {
  const checked = reviewedOrFail(output);
  if ("verdict" in checked) return checked.verdict;
  const { outcome, review } = checked.result;
  if (outcome !== "passed") return fail(`expected outcome passed, got ${outcome}`);
  if (review.testRiskCoverage === null) return fail("testRiskCoverage is null although the diff contains tests");
  return pass("outcome passed and testRiskCoverage is a number");
}

export function bugCase(output: unknown): Verdict {
  const checked = reviewedOrFail(output);
  if ("verdict" in checked) return checked.verdict;
  const { outcome, review } = checked.result;
  if (outcome !== "failed") return fail(`expected outcome failed, got ${outcome}`);
  const score = review.implementationCorrectness;
  if (typeof score !== "number" || score >= BUG_SCORE_LIMIT) {
    return fail(`expected implementationCorrectness < ${BUG_SCORE_LIMIT}, got ${String(score)}`);
  }
  // Necessary, not sufficient: whether the planted defect was named is judged by hand.
  return pass(`outcome failed and implementationCorrectness ${score} < ${BUG_SCORE_LIMIT} (defect named: manual)`);
}

export function noDataCase(output: unknown): Verdict {
  const checked = reviewedOrFail(output);
  if ("verdict" in checked) return checked.verdict;
  const { outcome, review } = checked.result;
  if (outcome !== "incomplete") return fail(`expected outcome incomplete, got ${outcome}`);
  if (review.testRiskCoverage !== null) return fail(`expected testRiskCoverage null, got ${review.testRiskCoverage}`);
  const [entry] = review.notAssessed;
  if (review.notAssessed.length !== 1 || entry?.criterion !== "testRiskCoverage" || entry.reason !== "no-data") {
    return fail(
      `expected exactly one notAssessed entry testRiskCoverage/no-data, got ${JSON.stringify(review.notAssessed)}`,
    );
  }
  return pass("outcome incomplete, testRiskCoverage null with one no-data entry");
}
