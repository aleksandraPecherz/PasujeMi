// Single place that rejects a model answer breaking the contract, before the gate sees it.
// Everything structured output cannot express in JSON Schema (1-10 integers, entry rules) is checked here.
import { REVIEW_SCHEMA, SCORE_FIELDS, type Review } from "./review-schema.ts";

export type ValidationResult = { ok: true; review: Review } | { ok: false; category: "invalid-output"; detail: string };

const invalid = (detail: string): ValidationResult => ({ ok: false, category: "invalid-output", detail });

// `detail` is for logs only; it never goes into the PR comment.
export function validateReview(raw: unknown): ValidationResult {
  const parsed = REVIEW_SCHEMA.safeParse(raw);
  if (!parsed.success) return invalid(`Odpowiedź nie pasuje do schematu recenzji: ${parsed.error.message}`);
  const review = parsed.data;

  for (const entry of review.notAssessed) {
    if (!entry.note.trim()) return invalid(`Pusty note w notAssessed dla ${entry.criterion}.`);
  }

  for (const field of SCORE_FIELDS) {
    const value = review[field];
    const entries = review.notAssessed.filter((entry) => entry.criterion === field);
    if (value === null) {
      if (entries.length !== 1) {
        return invalid(`Ocena ${field} to null, a notAssessed ma ${entries.length} wpisów (oczekiwano dokładnie 1).`);
      }
    } else {
      if (!Number.isInteger(value) || value < 1 || value > 10) {
        return invalid(`Niepoprawna ocena ${field}: ${value}. Oczekiwano liczby całkowitej od 1 do 10.`);
      }
      if (entries.length > 0) return invalid(`Ocena ${field} jest liczbą, a notAssessed zawiera dla niej wpis.`);
    }
  }
  return { ok: true, review };
}
