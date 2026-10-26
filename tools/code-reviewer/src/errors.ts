// Closed set of error categories with fixed Polish messages for the PR comment.
// Raw stderr, secrets and provider responses never reach the comment.
import { MAX_INPUT_CHARS } from "./input.ts";
import type { ErrorCategory } from "./outcome.ts";

export { ERROR_CATEGORIES, type ErrorCategory } from "./outcome.ts";

const SUBTYPE_CATEGORIES: Record<string, ErrorCategory> = {
  error_max_budget_usd: "budget-exceeded",
  error_max_turns: "max-turns",
  error_max_structured_output_retries: "structured-output-retries",
};

export function categoryFromSubtype(subtype: string): ErrorCategory {
  return SUBTYPE_CATEGORIES[subtype] ?? "sdk-error";
}

export function safeMessage(category: ErrorCategory, chars?: number): string {
  switch (category) {
    case "missing-secret":
      return "Brak sekretu CLAUDE_CODE_OAUTH_TOKEN w tym uruchomieniu, więc review nie zostało wykonane.";
    case "input-too-large": {
      const size = chars === undefined ? "" : ` (${chars} znaków)`;
      return `Wejście jest za duże${size}. Limit to ${MAX_INPUT_CHARS} znaków łącznie dla tytułu, opisu i diffu. Zmniejsz PR i dodaj etykietę ai-cr:review.`;
    }
    case "budget-exceeded":
      return "Review przekroczyło limit budżetu na jedno uruchomienie i zostało przerwane.";
    case "max-turns":
      return "Review przekroczyło limit tur agenta i zostało przerwane.";
    case "structured-output-retries":
      return "Agent nie zwrócił odpowiedzi zgodnej ze schematem mimo ponowień wewnątrz SDK.";
    case "invalid-output":
      return "Odpowiedź agenta nie spełnia kontraktu recenzji (schemat lub zakres ocen).";
    case "no-result":
      return "Agent nie zwrócił wyniku.";
    case "sdk-error":
      return "Agent zakończył się błędem. Szczegóły są w logach przebiegu Actions.";
    case "unexpected":
      return "Wystąpił nieoczekiwany błąd. Szczegóły są w logach przebiegu Actions.";
  }
}
