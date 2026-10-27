// Phase 1 checks that need the real promptfoo but no model: they run the real ReviewProvider with a canned queryFn.
// Run with `npm run check:loader` (a few seconds per promptfoo run; not part of `npm test`).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(tmpdir(), "loader-check-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

type Row = {
  provider: { label: string };
  success: boolean;
  latencyMs: number;
  cost: number;
  tokenUsage: { total: number };
  testCase: { description: string };
  response: { metadata: Record<string, unknown>; prompt?: string };
  gradingResult: { componentResults: { assertion: { type: string }; pass: boolean }[] };
};

function evalConfig(config: string, extra: string[] = []) {
  const out = join(outDir, `${Math.random().toString(36).slice(2)}.json`);
  const run = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/cli.ts", "eval", "-c", config, "--no-cache", "-j", "1", "-o", out, ...extra],
    { cwd: packageDir, encoding: "utf8" },
  );
  let rows: Row[] = [];
  try {
    rows = (JSON.parse(readFileSync(out, "utf8")) as { results: { results: Row[] } }).results.results;
  } catch {
    // leave rows empty; the assertions below report the failure with the process output
  }
  return { status: run.status, rows, log: `${run.stdout}\n${run.stderr}` };
}

describe("promptfoo loader (no model)", () => {
  it("(a)(e) loads the .ts provider with its .ts imports and loads file:// vars as text", () => {
    const { status, rows, log } = evalConfig("checks/loader-check.yaml");
    assert.equal(status, 0, log);
    assert.equal(rows.length, 4, log);
    assert.ok(
      rows.every((row) => row.success),
      log,
    );
    // The javascript assertion of case-one only passes when the diff text (not the path) reached the prompt.
    const kinds = rows.flatMap((row) => row.gradingResult.componentResults.map((c) => c.assertion.type));
    assert.ok(kinds.includes("javascript") && kinds.includes("is-json"));
  });

  it("(a) each provider label uses its own model and the metrics reach promptfoo", () => {
    const { rows } = evalConfig("checks/loader-check.yaml");
    for (const row of rows) {
      const expected = row.provider.label === "model-A" ? "fake-model-a" : "fake-model-b";
      assert.equal(row.response.metadata.requestedModel, expected);
      assert.deepEqual(row.response.metadata.modelsUsed, [expected]);
      assert.equal(row.cost, 0.01);
      assert.equal(row.tokenUsage.total, 3);
      assert.equal(typeof row.latencyMs, "number");
    }
  });

  it("(d) --filter-providers and --filter-pattern select exactly one cell", () => {
    const { status, rows, log } = evalConfig("checks/loader-check.yaml", [
      "--filter-providers",
      "^model-A$",
      "--filter-pattern",
      "^case-one$",
    ]);
    assert.equal(status, 0, log);
    assert.equal(rows.length, 1, log);
    assert.equal(rows[0]?.provider.label, "model-A");
    assert.equal(rows[0]?.testCase.description, "case-one");
  });

  it("(b) is-json rejects text that is not JSON and JSON of the wrong shape", () => {
    const { status, rows, log } = evalConfig("checks/negative.yaml");
    assert.notEqual(status, 0, log);
    assert.equal(rows.length, 2, log);
    for (const row of rows) {
      assert.equal(row.success, false, row.provider.label);
      const isJson = row.gradingResult.componentResults.find((c) => c.assertion.type === "is-json");
      assert.equal(isJson?.pass, false, row.provider.label);
    }
  });
});
