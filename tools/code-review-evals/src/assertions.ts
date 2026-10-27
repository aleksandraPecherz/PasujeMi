// promptfoo adapters: `value: file://src/assertions.ts:<name>`. promptfoo calls them with (output, context).
import * as expectations from "./expectations.ts";

type AssertContext = { providerResponse?: { metadata?: Record<string, unknown> } };

export const statusReviewed = (output: unknown) => expectations.statusReviewed(output);
export const reviewSchema = (output: unknown) => expectations.reviewSchema(output);
export const modelUsed = (_output: unknown, context: AssertContext) =>
  expectations.modelUsed(context.providerResponse?.metadata);
export const correctCase = (output: unknown) => expectations.correctCase(output);
export const bugCase = (output: unknown) => expectations.bugCase(output);
export const noDataCase = (output: unknown) => expectations.noDataCase(output);
