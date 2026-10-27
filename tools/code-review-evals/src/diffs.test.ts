import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { MAX_INPUT_CHARS, prepareInput } from "../../code-reviewer/src/input.ts";

const diffsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "diffs");
const read = (name: string): string => readFileSync(join(diffsDir, name), "utf8");

describe("fictional diffs", () => {
  for (const name of ["correct", "bug", "no-data"]) {
    it(`${name}: title, body and diff are present and pass prepareInput under the limit`, () => {
      const input = {
        title: read(`${name}.title.txt`),
        body: read(`${name}.body.txt`),
        diff: read(`${name}.diff`),
        excludedFiles: [],
      };
      assert.ok(input.title.trim() && input.body.trim() && input.diff.trim());
      const prepared = prepareInput(input);
      assert.equal(prepared.kind, "ok");
      assert.ok(input.title.length + input.body.length + input.diff.length < MAX_INPUT_CHARS);
    });

    it(`${name}: diff is LF-only and looks like a unified diff`, () => {
      const diff = read(`${name}.diff`);
      assert.ok(!diff.includes("\r"));
      assert.match(diff, /^diff --git a\/.+ b\/.+\nnew file mode 100644\n/);
    });
  }

  it("contain no secrets or credential-looking strings", () => {
    for (const name of ["correct", "bug", "no-data"]) {
      const text = [read(`${name}.title.txt`), read(`${name}.body.txt`), read(`${name}.diff`)].join("\n");
      assert.doesNotMatch(text, /sk-[A-Za-z0-9]|api[_-]?key|secret|token|password/i);
    }
  });

  it("keep the planted defect only in the bug case: it ignores the insert error and has no error handling for it", () => {
    const bug = read("bug.diff");
    assert.match(bug, /await supabase\.from\("shopping_items"\)\.insert\(/);
    assert.doesNotMatch(bug, /const \{ error[^}]*\} = await supabase/);
    assert.match(read("bug.body.txt"), /Returns 500/);
    // The cases without the defect and without tests must not drift: no-data has no test file, correct has one.
    assert.doesNotMatch(read("no-data.diff"), /\.test\.ts/);
    assert.match(read("correct.diff"), /merge-quantities\.test\.ts/);
  });
});
