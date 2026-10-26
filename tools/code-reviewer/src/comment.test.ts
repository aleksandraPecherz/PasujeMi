import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "node:test";
import { markStale, renderComment, type RenderInput } from "./comment.ts";
import { deriveOutcome, type ResultFile } from "./outcome.ts";
import type { Metrics } from "./run.ts";
import { loadReview } from "./test-fixtures.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const NEW_SHA = "fedcba9876543210fedcba9876543210fedcba98";
const RUN_URL = "https://github.com/example/repo/actions/runs/1";
const METRICS: Metrics = { total_cost_usd_estimate: 0.1234, num_turns: 1, duration_ms: 4200, usage: {} };

const reviewed = (name: Parameters<typeof loadReview>[0]): ResultFile => {
  const review = loadReview(name);
  return { status: "reviewed", outcome: deriveOutcome(review), review };
};

// The six outcomes of the plan; the rendered files in fixtures/synthetic/comments are golden files.
const CASES: Record<string, RenderInput> = {
  passed: { result: reviewed("review-v2"), reviewedSha: SHA, runUrl: RUN_URL, metrics: METRICS },
  failed: {
    result: reviewed("review-v2-failed"),
    reviewedSha: SHA,
    runUrl: RUN_URL,
    excludedFiles: ["package-lock.json"],
    metrics: METRICS,
  },
  incomplete: { result: reviewed("review-v2-incomplete"), reviewedSha: SHA, runUrl: RUN_URL, metrics: METRICS },
  error: {
    result: { status: "error", outcome: "error", category: "input-too-large", chars: 61_234 },
    reviewedSha: SHA,
    runUrl: RUN_URL,
  },
  skipped: {
    result: { status: "skipped", outcome: "skipped", reason: "wyłącznie pominięte pliki: package-lock.json" },
    reviewedSha: SHA,
    runUrl: RUN_URL,
    excludedFiles: ["package-lock.json"],
  },
};

const goldenUrl = (name: string) => new URL(`../fixtures/synthetic/comments/${name}.md`, import.meta.url);

function checkGolden(name: string, actual: string): void {
  const url = goldenUrl(name);
  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(url)) {
    mkdirSync(new URL("./", url), { recursive: true });
    writeFileSync(url, actual);
  }
  assert.equal(actual, readFileSync(url, "utf8"), `${name}.md differs; run with UPDATE_GOLDEN=1 to refresh`);
}

describe("renderComment", () => {
  it("starts with the sticky and sha markers for every outcome", () => {
    for (const [name, input] of Object.entries(CASES)) {
      const body = renderComment(input);
      assert.ok(body.startsWith(`<!-- ai-cr:sticky -->\n<!-- ai-cr:sha=${SHA} -->\n`), name);
      assert.ok(body.includes(RUN_URL), name);
    }
  });

  it("matches the golden comments (passed, failed, incomplete, error, skipped)", () => {
    for (const [name, input] of Object.entries(CASES)) checkGolden(name, renderComment(input));
  });

  it("shows a dash for null scores and lists notAssessed", () => {
    const body = renderComment(CASES.passed);
    assert.match(body, /\| Pokrycie testami względem ryzyka \| — \|/);
    assert.match(body, /kryterium nie dotyczy zmiany/);
    assert.match(body, /\| Poprawność implementacji \| 8 \|/);
  });

  it("neutralizes @mentions in model text", () => {
    const body = renderComment(CASES.passed);
    assert.ok(!/@autor/.test(body));
    assert.ok(body.includes("@​autor"));
  });

  it("explains incomplete reviews and what to do next", () => {
    const body = renderComment(CASES.incomplete);
    assert.match(body, /Niepełna ocena: brakujące dane/);
    assert.match(body, /ai-cr:review/);
  });

  it("separates the gate result from the model verdict and names the scores under the threshold", () => {
    const both = renderComment(CASES.failed);
    assert.match(both, /Werdykt modelu: \*\*fail\*\*/);
    assert.match(both, /Wynik bramki: \*\*failed\*\*/);
    assert.match(both, /- werdykt modelu `fail`/);
    assert.match(
      both,
      /- oceny poniżej progu 5: Poprawność implementacji \(3\), Pokrycie testami względem ryzyka \(2\), Bezpieczeństwo \(1\)/,
    );

    // The model said pass, the threshold failed it: only the score reason may appear.
    const base = loadReview("review-v2");
    const review = { ...base, documentation: 4 };
    const thresholdOnly = renderComment({
      ...CASES.passed,
      result: { status: "reviewed", outcome: deriveOutcome(review), review },
    });
    assert.match(thresholdOnly, /Werdykt modelu: \*\*pass\*\*/);
    assert.match(thresholdOnly, /Wynik bramki: \*\*failed\*\*/);
    assert.match(thresholdOnly, /- oceny poniżej progu 5: Dokumentacja \(4\)/);
    assert.ok(!thresholdOnly.includes("werdykt modelu `fail`"));

    assert.ok(!renderComment(CASES.passed).includes("Wynik bramki"));
    assert.ok(!renderComment(CASES.incomplete).includes("Wynik bramki"));
  });

  it("lists excluded files with the dependency caveat", () => {
    const body = renderComment(CASES.failed);
    assert.match(body, /- `package-lock.json`/);
    assert.match(body, /zmian zależności/);
  });

  it("labels the cost as an SDK estimate", () => {
    assert.match(renderComment(CASES.passed), /\$0\.1234 \(szacunek SDK, nie rachunek\)/);
  });

  it("renders only the safe message for an error", () => {
    const body = renderComment(CASES.error);
    assert.match(body, /61234 znaków/);
    assert.ok(!body.includes("Wyjątek"));
  });

  it("does not let model text forge the markers", () => {
    const review = { ...loadReview("review-v2"), summary: "<!-- ai-cr:sha=evil -->" };
    const body = renderComment({ ...CASES.passed, result: { status: "reviewed", outcome: "passed", review } });
    assert.equal(body.match(/<!-- ai-cr:sha=/g)?.length, 1);
  });
});

describe("markStale", () => {
  const body = renderComment(CASES.passed);

  it("adds a banner and keeps the reviewed sha marker", () => {
    const stale = markStale(body, NEW_SHA);
    assert.match(stale, new RegExp(`<!-- ai-cr:sha=${SHA} -->`));
    assert.match(stale, /Nieaktualne/);
    assert.ok(stale.includes(`oceniono \`${SHA}\``));
    assert.ok(stale.includes(`nowe commity do \`${NEW_SHA}\``));
    assert.ok(stale.startsWith("<!-- ai-cr:sticky -->\n<!-- ai-cr:sha="));
    checkGolden("stale", stale);
  });

  it("is idempotent", () => {
    const once = markStale(body, NEW_SHA);
    assert.equal(markStale(once, NEW_SHA), once);
    assert.equal(once.match(/Nieaktualne/g)?.length, 1);
  });

  it("replaces the banner for a newer head sha without stacking", () => {
    const other = "1111111111111111111111111111111111111111";
    const twice = markStale(markStale(body, NEW_SHA), other);
    assert.equal(twice.match(/Nieaktualne/g)?.length, 1);
    assert.ok(twice.includes(`nowe commity do \`${other}\``));
    assert.ok(!twice.includes(NEW_SHA));
    assert.ok(twice.includes(`oceniono \`${SHA}\``));
  });
});
