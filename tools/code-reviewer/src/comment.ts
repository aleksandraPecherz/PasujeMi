// Sticky PR comment: one body per outcome, plus the idempotent "stale" banner.
import { safeMessage } from "./errors.ts";
import { PASS_THRESHOLD, type Outcome, type ResultFile } from "./outcome.ts";
import { SCORE_FIELDS, type ScoreField } from "./review-schema.ts";
import type { Metrics } from "./run.ts";

export const STICKY_MARKER = "<!-- ai-cr:sticky -->";
const SHA_MARKER_RE = /<!-- ai-cr:sha=([0-9A-Za-z._-]+) -->/;
const STALE_BLOCK_RE = /<!-- ai-cr:stale -->[\s\S]*?<!-- \/ai-cr:stale -->\n/;

const CRITERION_LABELS: Record<ScoreField, string> = {
  implementationCorrectness: "Poprawność implementacji",
  idiomaticity: "Idiomatyczność",
  complexity: "Złożoność",
  testRiskCoverage: "Pokrycie testami względem ryzyka",
  documentation: "Dokumentacja",
  securitySafety: "Bezpieczeństwo",
};

const OUTCOME_LABELS: Record<Outcome, string> = {
  passed: "pozytywny (passed)",
  failed: "negatywny (failed)",
  incomplete: "niepełna ocena (incomplete)",
  error: "błąd wykonania (error)",
  skipped: "pominięty (skipped)",
};

const REASON_LABELS = { "no-data": "brak danych do oceny", "not-applicable": "kryterium nie dotyczy zmiany" } as const;

export type RenderInput = {
  result: ResultFile;
  reviewedSha: string;
  runUrl?: string;
  excludedFiles?: readonly string[];
  metrics?: Metrics | null;
};

const safeSha = (sha: string) => sha.replace(/[^0-9A-Za-z._-]/g, "") || "nieznany";

// Text from the model must not ping users or forge our markers.
function neutralize(text: string): string {
  return text.replace(/@(?=[A-Za-z0-9_])/g, "@​").replace(/<!--/g, "&lt;!--");
}

function renderMetrics(metrics: Metrics): string {
  const cost = `$${metrics.total_cost_usd_estimate.toFixed(4)}`;
  const seconds = (metrics.duration_ms / 1000).toFixed(1);
  return `Koszt: ${cost} (szacunek SDK, nie rachunek), tury: ${metrics.num_turns}, czas: ${seconds} s.`;
}

function renderReview(result: Extract<ResultFile, { status: "reviewed" }>): string[] {
  const { review, outcome } = result;
  const lines: string[] = [];
  if (outcome === "incomplete") {
    lines.push(
      "> **Niepełna ocena: brakujące dane.** Żadna ocena nie jest negatywna, ale część kryteriów nie miała danych do oceny.",
      "> Wskaż istniejące testy lub uzupełnij opis PR-a, a potem dodaj etykietę `ai-cr:review`.",
      "",
    );
  }
  lines.push("| Kryterium | Ocena |", "| --- | --- |");
  for (const field of SCORE_FIELDS) {
    lines.push(`| ${CRITERION_LABELS[field]} | ${review[field] ?? "—"} |`);
  }
  lines.push("", `Werdykt modelu: **${review.verdict}**`);
  if (outcome === "failed") {
    // The gate fails on the model's verdict or on any score under the threshold; say which, so the two are not confused.
    const low = SCORE_FIELDS.flatMap((field) => {
      const value = review[field];
      return value !== null && value < PASS_THRESHOLD ? [`${CRITERION_LABELS[field]} (${value})`] : [];
    });
    lines.push("", `Wynik bramki: **${outcome}**. Powody:`);
    if (review.verdict === "fail") lines.push("- werdykt modelu `fail`");
    if (low.length > 0) lines.push(`- oceny poniżej progu ${PASS_THRESHOLD}: ${low.join(", ")}`);
  }
  lines.push("");
  if (review.notAssessed.length > 0) {
    lines.push("### Nieocenione kryteria", "");
    for (const entry of review.notAssessed) {
      lines.push(
        `- ${CRITERION_LABELS[entry.criterion]}: ${REASON_LABELS[entry.reason]}. ${neutralize(entry.note.trim())}`,
      );
    }
    lines.push("");
  }
  lines.push("### Podsumowanie", "", neutralize(review.summary.trim()), "");
  return lines;
}

export function renderComment({ result, reviewedSha, runUrl, excludedFiles = [], metrics }: RenderInput): string {
  const sha = safeSha(reviewedSha);
  const lines: string[] = [
    STICKY_MARKER,
    `<!-- ai-cr:sha=${sha} -->`,
    "",
    `## Wynik AI code review: ${OUTCOME_LABELS[result.outcome]}`,
    "",
    `Oceniony commit: \`${sha}\`${runUrl ? ` · [przebieg Actions](${runUrl})` : ""}`,
    "",
  ];

  if (result.status === "reviewed") {
    lines.push(...renderReview(result));
  } else if (result.status === "error") {
    lines.push(safeMessage(result.category, result.chars), "");
  } else {
    lines.push(`Review pominięte: ${result.reason}.`, "");
  }

  if (excludedFiles.length > 0) {
    lines.push(
      "### Pominięte pliki",
      "",
      "Te pliki nie weszły do diffu, więc ocena nie obejmuje zmian zależności:",
      "",
      ...excludedFiles.map((file) => `- \`${file}\``),
      "",
    );
  }
  if (metrics) lines.push(renderMetrics(metrics), "");

  return lines.join("\n");
}

// Adds or replaces the stale banner; the SHA marker of the reviewed version stays. Repeated calls do not stack banners.
export function markStale(body: string, newHeadSha: string): string {
  const reviewed = SHA_MARKER_RE.exec(body)?.[1] ?? "nieznany";
  const banner =
    "<!-- ai-cr:stale -->\n" +
    `> **Nieaktualne:** oceniono \`${reviewed}\`, nowe commity do \`${safeSha(newHeadSha)}\`. Dodaj etykietę \`ai-cr:review\`, aby ocenić ponownie.\n` +
    "<!-- /ai-cr:stale -->\n";
  const clean = body.replace(STALE_BLOCK_RE, "");
  const marker = SHA_MARKER_RE.exec(clean);
  if (!marker) return banner + clean;
  const end = marker.index + marker[0].length;
  const afterLine = clean[end] === "\n" ? end + 1 : end;
  return clean.slice(0, afterLine) + banner + clean.slice(afterLine);
}
