import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { emitAndExit } from "./output.ts";
import { runReview, type QueryFn, type QueryMessage } from "./run.ts";

const input = {
  title: "Tytuł",
  body: "Opis",
  diff: "diff --git a/x b/x",
  excludedFiles: [],
  requireToken: false,
  hasToken: false,
};

describe("emitAndExit on timeout", () => {
  it("writes result.json and the error comment before exit(1)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-cr-output-"));
    try {
      const hanging: QueryFn = () =>
        (async function* () {
          yield { type: "system" } satisfies QueryMessage;
          await new Promise<never>(() => {});
        })();
      const { result, metrics } = await runReview(input, hanging, 20);
      const out = join(dir, "result.json");
      const commentOut = join(dir, "comment.md");

      const seen: { code: number; resultJson: string; comment: string }[] = [];
      let exitCode: number | undefined;
      await emitAndExit(
        { result, metrics, excludedFiles: [], out, commentOut, sha: "0123456789abcdef0123456789abcdef01234567" },
        {
          setExitCode: (code) => (exitCode = code),
          // At exit time both files must already be on disk.
          exit: (code) => {
            assert.ok(existsSync(out), "result.json missing at exit");
            assert.ok(existsSync(commentOut), "comment.md missing at exit");
            seen.push({ code, resultJson: readFileSync(out, "utf8"), comment: readFileSync(commentOut, "utf8") });
          },
        },
      );

      assert.equal(seen.length, 1);
      assert.equal(seen[0].code, 1);
      assert.equal(exitCode, 1);
      assert.deepEqual(JSON.parse(seen[0].resultJson), { status: "error", outcome: "error", category: "timeout" });
      assert.ok(seen[0].comment.startsWith("<!-- ai-cr:sticky -->\n<!-- ai-cr:sha=0123456789abcdef"));
      assert.match(seen[0].comment, /przekroczyło limit czasu/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not force an exit for other errors, only sets the exit code", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-cr-output-"));
    try {
      let exited = false;
      let exitCode: number | undefined;
      await emitAndExit(
        {
          result: { status: "error", outcome: "error", category: "missing-secret" },
          metrics: null,
          excludedFiles: [],
          out: join(dir, "result.json"),
        },
        { setExitCode: (code) => (exitCode = code), exit: () => (exited = true) },
      );
      assert.equal(exitCode, 1);
      assert.equal(exited, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
