import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { computeFingerprint } from "./fingerprint.ts";

const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

// A miniature repo: tools/code-reviewer (run.ts -> errors.ts, input.ts) and tools/code-review-evals.
function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), "fp-"));
  roots.push(root);
  const reviewer = join(root, "tools", "code-reviewer");
  const evals = join(root, "tools", "code-review-evals");
  for (const dir of [join(reviewer, "src"), join(evals, "src"), join(evals, "diffs")])
    mkdirSync(dir, { recursive: true });
  const write = (path: string, content: string) => writeFileSync(path, content);
  write(join(reviewer, "package.json"), "{}");
  write(join(reviewer, "package-lock.json"), "{}");
  write(join(reviewer, "src", "run.ts"), 'import { a } from "./errors.ts";\nimport { b } from "./input.ts";\n');
  write(join(reviewer, "src", "errors.ts"), "export const a = 1;\n");
  write(join(reviewer, "src", "input.ts"), "export const b = 2;\n");
  write(join(reviewer, "src", "run.test.ts"), "// tests are not part of the closure\n");
  write(join(evals, "package.json"), "{}");
  write(join(evals, "package-lock.json"), "{}");
  write(join(evals, "src", "provider.ts"), 'import { runReview } from "../../code-reviewer/src/run.ts";\n');
  write(join(evals, "src", "assertions.ts"), 'import { helper } from "./helper.ts";\n');
  write(join(evals, "src", "helper.ts"), "export const helper = 1;\n");
  write(join(evals, "diffs", "bug.diff"), "diff A\n");
  write(
    join(evals, "promptfooconfig.yaml"),
    "tests:\n  - assert:\n      - type: javascript\n        value: file://src/assertions.ts\n",
  );
  return { root, reviewer, evals, write, fp: () => computeFingerprint({ packageDir: evals, reviewerDir: reviewer }) };
}

describe("fingerprint", () => {
  it("is stable across two runs", () => {
    const repo = makeRepo();
    assert.equal(repo.fp().hash, repo.fp().hash);
  });

  it("includes the whole import closure of run.ts, including errors.ts, and no test files", () => {
    const paths = makeRepo()
      .fp()
      .components.map((c) => c.path);
    for (const expected of [
      "../code-reviewer/src/run.ts",
      "../code-reviewer/src/errors.ts",
      "../code-reviewer/src/input.ts",
      "src/provider.ts",
      "diffs/bug.diff",
      "promptfooconfig.yaml",
    ]) {
      assert.ok(paths.includes(expected), `missing ${expected}`);
    }
    assert.ok(!paths.some((path) => path.endsWith(".test.ts")));
  });

  it("changes when errors.ts changes", () => {
    const repo = makeRepo();
    const before = repo.fp().hash;
    repo.write(join(repo.reviewer, "src", "errors.ts"), "export const a = 99;\n");
    assert.notEqual(repo.fp().hash, before);
  });

  it("picks up a new import added to run.ts without editing any list", () => {
    const repo = makeRepo();
    repo.write(join(repo.reviewer, "src", "extra.ts"), "export const c = 3;\n");
    const before = repo.fp();
    assert.ok(!before.components.some((c) => c.path.endsWith("extra.ts")));
    repo.write(
      join(repo.reviewer, "src", "run.ts"),
      'import "./errors.ts";\nimport "./input.ts";\nimport "./extra.ts";\n',
    );
    const after = repo.fp();
    assert.ok(after.components.some((c) => c.path === "../code-reviewer/src/extra.ts"));
    assert.notEqual(after.hash, before.hash);
  });

  it("covers a file referenced by the config and what that file imports", () => {
    const repo = makeRepo();
    const paths = repo.fp().components.map((c) => c.path);
    assert.ok(paths.includes("src/assertions.ts"));
    assert.ok(paths.includes("src/helper.ts"));
    const before = repo.fp().hash;
    repo.write(join(repo.evals, "src", "helper.ts"), "export const helper = 2;\n");
    assert.notEqual(repo.fp().hash, before);
  });

  it("reads a file:// reference that names a function (path:function)", () => {
    const repo = makeRepo();
    repo.write(
      join(repo.evals, "promptfooconfig.yaml"),
      "assert:\n  - value: file://src/assertions.ts:correctCase\n  - value: file://src/assertions.ts:bugCase\n",
    );
    const paths = repo.fp().components.map((c) => c.path);
    assert.ok(paths.includes("src/assertions.ts"));
    assert.ok(!paths.some((path) => path.includes("correctCase")));
  });

  it("changes with the config, a diff and the versions in package files", () => {
    const repo = makeRepo();
    let previous = repo.fp().hash;
    for (const [path, content] of [
      [
        join(repo.evals, "promptfooconfig.yaml"),
        "tests:\n  - assert:\n      - type: javascript\n        value: file://src/assertions.ts\n# model: x\n",
      ],
      [join(repo.evals, "diffs", "bug.diff"), "diff B\n"],
      [join(repo.evals, "package-lock.json"), '{"v":1}'],
      [join(repo.reviewer, "package-lock.json"), '{"v":2}'],
    ] as const) {
      repo.write(path, content);
      const next = repo.fp().hash;
      assert.notEqual(next, previous, path);
      previous = next;
    }
  });

  it("does not depend on line endings", () => {
    const repo = makeRepo();
    const before = repo.fp().hash;
    repo.write(join(repo.reviewer, "src", "errors.ts"), "export const a = 1;\r\n");
    assert.equal(repo.fp().hash, before);
  });

  it("fails loudly on an unresolvable import or a missing config reference", () => {
    const repo = makeRepo();
    repo.write(join(repo.reviewer, "src", "run.ts"), 'import "./gone.ts";\n');
    assert.throws(() => repo.fp(), /cannot resolve/);
    const other = makeRepo();
    other.write(join(other.evals, "promptfooconfig.yaml"), "value: file://src/missing.ts\n");
    assert.throws(() => other.fp(), /missing file/);
  });
});

describe("fingerprint of the real repository", () => {
  it("includes every module reachable from run.ts, errors.ts among them", () => {
    const paths = computeFingerprint().components.map((c) => c.path);
    for (const name of ["run", "errors", "input", "outcome", "review-schema", "validate"]) {
      assert.ok(paths.includes(`../code-reviewer/src/${name}.ts`), `missing ${name}.ts`);
    }
  });
});
