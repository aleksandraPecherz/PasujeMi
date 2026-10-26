// Deterministic gate: the outcome does not depend on the model keeping its verdict and numbers consistent.
import { SCORE_FIELDS, type Review } from "./review-schema.ts";

// Tymczasowy, do weryfikacji w ewaluacjach.
export const PASS_THRESHOLD = 5;

export type ReviewOutcome = "passed" | "failed" | "incomplete";
export type Outcome = ReviewOutcome | "error" | "skipped";

export type ReviewedResult = { status: "reviewed"; outcome: ReviewOutcome; review: Review };
export type ErrorResult = { status: "error"; outcome: "error"; category: ErrorCategory; chars?: number };
export type SkippedResult = { status: "skipped"; outcome: "skipped"; reason: string };
export type ResultFile = ReviewedResult | ErrorResult | SkippedResult;

export const ERROR_CATEGORIES = [
  "missing-secret",
  "input-too-large",
  "sdk-error",
  "budget-exceeded",
  "max-turns",
  "structured-output-retries",
  "invalid-output",
  "no-result",
  "unexpected",
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export function deriveOutcome(review: Review): ReviewOutcome {
  const lowScore = SCORE_FIELDS.some((field) => {
    const value = review[field];
    return value !== null && value < PASS_THRESHOLD;
  });
  if (review.verdict === "fail" || lowScore) return "failed";
  // not-applicable never affects the outcome; only missing data makes a review incomplete.
  if (review.notAssessed.some((entry) => entry.reason === "no-data")) return "incomplete";
  return "passed";
}

// Precedence when several outcomes compete: error > failed > incomplete > passed.
export const OUTCOME_PRECEDENCE = ["error", "failed", "incomplete", "passed"] as const;

export function worstOutcome(outcomes: readonly (typeof OUTCOME_PRECEDENCE)[number][]): "error" | ReviewOutcome | null {
  for (const candidate of OUTCOME_PRECEDENCE) {
    if (outcomes.includes(candidate)) return candidate;
  }
  return null;
}

export const RESULT_LABELS = {
  passed: "ai-cr:passed",
  failed: "ai-cr:failed",
  incomplete: "ai-cr:incomplete",
  error: "ai-cr:error",
} as const;
export const STALE_LABEL = "ai-cr:stale";
// Kept apart from RESULT_LABELS: it is never in a set of labels to remove.
export const TRIGGER_LABEL = "ai-cr:review";

export function labelsToRemove(outcome: Outcome): string[] {
  const result = Object.entries(RESULT_LABELS)
    .filter(([key]) => key !== outcome)
    .map(([, label]) => label);
  return [...result, STALE_LABEL];
}
