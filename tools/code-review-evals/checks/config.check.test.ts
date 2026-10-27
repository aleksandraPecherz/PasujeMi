// Dry run of the REAL promptfooconfig.yaml: the provider is swapped for the canned one and the model slots get
// fake names, everything else (tests, vars, diffs, assertions, flags) is used as written. No SDK, no model.
// Run with `npm run check:loader`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryConfig = join(packageDir, ".tmp-dryrun.yaml");
const outDir = mkdtempSync(join(tmpdir(), "config-check-"));
after(() => {
  rmSync(outDir, { recursive: true, force: true });
  try {
    unlinkSync(dryConfig);
  } catch {
    // already gone
  }
});

type Row = {
  provider: { label: string };
  success: boolean;
  testCase: { description: string };
  response: { metadata: Record<string, unknown>; prompt?: string };
  namedScores: Record<string, number>;
  gradingResult: { componentResults: { assertion: { metric?: string }; pass: boolean; reason: string }[] };
};

function dryRun(): { status: number | null; rows: Row[]; log: string } {
  const original = readFileSync(join(packageDir, "promptfooconfig.yaml"), "utf8");
  let slot = 0;
  const dry = original
    .replaceAll("file://src/provider.ts", "file://checks/fake-provider.ts")
    .replace(/^(\s+model:) \S+/gm, (_match, key: string) => `${key} dry-model-${++slot === 1 ? "a" : "b"}`);
  assert.equal(slot, 2, "expected exactly two model slots in promptfooconfig.yaml");
  // Safety: never start promptfoo while the real provider (and so the real SDK) is still referenced.
  assert.ok(!dry.includes("src/provider.ts") && dry.includes("checks/fake-provider.ts"), "provider was not swapped");
  writeFileSync(dryConfig, dry);
  const out = join(outDir, "dry.json");
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "src/cli.ts",
      "eval",
      "-c",
      ".tmp-dryrun.yaml",
      "--no-cache",
      "--max-concurrency",
      "1",
      "-o",
      out,
    ],
    { cwd: packageDir, encoding: "utf8" },
  );
  let rows: Row[] = [];
  try {
    rows = (JSON.parse(readFileSync(out, "utf8")) as { results: { results: Row[] } }).results.results;
  } catch {
    // reported through the assertions below together with the log
  }
  return { status: run.status, rows, log: `${run.stdout}\n${run.stderr}` };
}

describe("real promptfooconfig.yaml, dry run with canned reviews", () => {
  const run = dryRun();

  it("produces the 6 cells (3 cases x 2 models) and every canned ideal result satisfies its expectations", () => {
    assert.equal(run.status, 0, run.log);
    assert.equal(run.rows.length, 6, run.log);
    const failed = run.rows.filter((row) => !row.success);
    assert.deepEqual(
      failed.map((row) => `${row.provider.label}/${row.testCase.description}`),
      [],
      run.log,
    );
    const cells = new Set(run.rows.map((row) => `${row.provider.label}/${row.testCase.description}`));
    assert.equal(cells.size, 6);
  });

  it("runs the five named assertions per cell, loaded from src/assertions.ts", () => {
    for (const row of run.rows) {
      const metrics = row.gradingResult.componentResults.map((c) => c.assertion.metric).sort();
      assert.deepEqual(
        metrics,
        ["expected", "json", "model-used", "review-schema", "status-reviewed"],
        row.testCase.description,
      );
    }
  });

  it("loads title, description and diff from diffs/ into the prompt", () => {
    const prompts = new Map(run.rows.map((row) => [row.testCase.description, row.response.prompt ?? ""]));
    assert.ok(prompts.get("correct")?.includes("Merge duplicate shopping list items by name"));
    assert.ok(prompts.get("correct")?.includes("export function mergeQuantities"));
    assert.ok(prompts.get("bug")?.includes("Returns 500"));
    assert.ok(prompts.get("bug")?.includes('await supabase.from("shopping_items")'));
    assert.ok(prompts.get("no-data")?.includes("export function formatQuantity"));
  });

  it("requests the model of each provider label", () => {
    for (const row of run.rows) {
      assert.equal(
        row.response.metadata.requestedModel,
        row.provider.label === "model-A" ? "dry-model-a" : "dry-model-b",
      );
    }
  });
});

// Static reading only: this test must never start the real config, because that would call the models.
describe("real promptfooconfig.yaml, static checks", () => {
  const config = readFileSync(join(packageDir, "promptfooconfig.yaml"), "utf8");
  const models = [...config.matchAll(/^\s+model: (\S+)/gm)].map((match) => match[1]);

  it("pins exactly two distinct models and no fallback", () => {
    assert.deepEqual(models, ["claude-sonnet-5-5", "claude-haiku-5-5"]);
    assert.doesNotMatch(config, /fallback/i);
  });

  it("keeps the run flags that bound the cost: no cache, one at a time, no repeats, no graders", () => {
    assert.match(config, /maxConcurrency: 1\b/);
    assert.match(config, /repeat: 1\b/);
    assert.match(config, /cache: false/);
    // Comments are stripped: the header comment itself says "no model-graded assertions".
    const code = config.replace(/#.*$/gm, "");
    assert.doesNotMatch(code, /llm-rubric|agent-rubric|model-graded|--grader|\bgrader\b|options:\s*\n\s+provider/);
  });
});
