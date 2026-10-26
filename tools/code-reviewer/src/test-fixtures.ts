// Test-only helpers: load synthetic review fixtures (the envelope's `.review` is the contract object).
import { readFileSync } from "node:fs";
import type { Review } from "./review-schema.ts";

export function loadReview(name: "review-v2" | "review-v2-failed" | "review-v2-incomplete"): Review {
  const url = new URL(`../fixtures/synthetic/${name}.json`, import.meta.url);
  const envelope = JSON.parse(readFileSync(url, "utf8")) as { synthetic: boolean; review: Review };
  if (envelope.synthetic !== true) throw new Error(`${name}: fixture bez koperty synthetic`);
  return envelope.review;
}

export const BASE_REVIEW: Review = {
  implementationCorrectness: 8,
  idiomaticity: 8,
  complexity: 8,
  testRiskCoverage: 8,
  documentation: 8,
  securitySafety: 8,
  notAssessed: [],
  verdict: "pass",
  summary: "ok",
};
