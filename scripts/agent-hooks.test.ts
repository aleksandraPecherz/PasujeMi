// Proof for the agent hooks in .claude/hooks (wired in .claude/settings.json).
// Each case pipes a Claude Code payload into the real script and checks the signal the agent gets:
// exit 2 + stderr is the only combination Claude reads; exit 0 means checked and clean, or nothing to check.
// The hooks run in a throwaway git repo with real git and real scripts; only the slow tools
// (eslint, vitest, astro, check:ui) are stubs that fail on a marker in the files they get.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = ["lib.mjs", "lint-edited-file.mjs", "related-tests.mjs", "end-of-turn.mjs"];

// Stub tools: `marker` in any file the tool looks at means failure, printed on stdout with exit 1
// like the real tools. Every start is appended to STUB_LOG, so a case can prove nothing ran.
function stub(name: string, marker: string, scan: string): string {
  return `import { appendFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
if (process.env.STUB_LOG) appendFileSync(process.env.STUB_LOG, "${name}\\n");
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return n === "node_modules" || n === ".git" ? [] : statSync(p).isDirectory() ? walk(p) : [p];
});
const args = process.argv.slice(2).filter((a) => !a.startsWith("-") && a !== "related" && a !== "run" && a !== "check");
const files = ${scan};
const bad = files.filter((f) => readFileSync(f, "utf8").includes("${marker}"));
for (const f of bad) console.log(f + ": ${name} found ${marker}");
process.exit(bad.length ? 1 : 0);
`;
}

const STUBS: Record<string, string> = {
  "node_modules/eslint/bin/eslint.js": stub("eslint", "LINT_ERROR", "args"),
  "scripts/check-ui-literals.mjs": stub("check-ui", "UI_LITERAL", "args"),
  "node_modules/vitest/vitest.mjs": stub(
    "vitest",
    "TEST_FAIL",
    'walk(process.cwd()).filter((f) => f.includes(".test.") && (!args.length || args.some((a) => f.endsWith(a) || readFileSync(f, "utf8").includes(path.basename(a).split(".")[0]))))',
  ),
  "node_modules/astro/bin/astro.mjs": stub("astro", "TYPE_ERROR", 'walk(path.join(process.cwd(), "src"))'),
};

const GIT_ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

function git(cwd: string, ...args: string[]) {
  const result = spawnSync(
    "git",
    ["-c", "user.name=hook-test", "-c", "user.email=hook@test", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8", env: GIT_ENV },
  );
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function write(root: string, rel: string, text: string) {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), text);
}

function installStubs(root: string) {
  for (const [rel, text] of Object.entries(STUBS)) write(root, rel, text);
}

let tmp: string;
let repo: string;
let log: string;
let session: string;

function makeRepo(name: string) {
  const root = path.join(tmp, name);
  mkdirSync(root);
  git(root, "init", "-q");
  write(root, ".gitignore", "node_modules/\n");
  for (const hook of HOOKS) {
    mkdirSync(path.join(root, ".claude/hooks"), { recursive: true });
    copyFileSync(path.join(REPO, ".claude/hooks", hook), path.join(root, ".claude/hooks", hook));
  }
  copyFileSync(path.join(REPO, ".claude/settings.json"), path.join(root, ".claude/settings.json"));
  installStubs(root);
  write(root, "src/lib/math.ts", "export const add = (a: number, b: number) => a + b;\n");
  write(root, "src/lib/math.test.ts", 'import { add } from "./math";\nexpect(add(1, 2)).toBe(3);\n');
  write(root, "README.md", "LINT_ERROR is only text here\n");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "init");
  return root;
}

function runHook(hook: string, payload: unknown, env: Record<string, string> = {}) {
  const input = typeof payload === "string" ? payload : JSON.stringify(payload);
  const result = spawnSync(process.execPath, [path.join(repo, ".claude/hooks", hook)], {
    cwd: repo,
    input,
    encoding: "utf8",
    env: { ...GIT_ENV, STUB_LOG: log, ...env },
  });
  return { code: result.status, stderr: result.stderr, stdout: result.stdout };
}

const edit = (file: string, cwd = repo) => ({
  session_id: session,
  cwd,
  hook_event_name: "PostToolUse",
  tool_name: "Edit",
  tool_input: { file_path: file },
});
const stop = (extra: Record<string, unknown> = {}) => ({
  session_id: session,
  cwd: repo,
  hook_event_name: "Stop",
  stop_hook_active: false,
  ...extra,
});
const ran = () => (existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : []);

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "agent-hooks-"));
  repo = makeRepo("repo");
  log = path.join(tmp, "stub.log");
  session = `test-${path.basename(tmp)}`;
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(path.join(os.tmpdir(), "claude-hooks", `${session}.roots`), { force: true });
});

describe("lint-edited-file.mjs (PostToolUse)", () => {
  it("blocks with the file and the lint error when the edited file is broken", () => {
    write(repo, "src/lib/math.ts", "const LINT_ERROR = 1;\n");
    const result = runHook("lint-edited-file.mjs", edit(path.join(repo, "src/lib/math.ts")));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("ESLint reported errors in src/lib/math.ts");
    expect(result.stderr).toContain("eslint found LINT_ERROR");
  });

  it("blocks when check:ui finds a literal in the edited file", () => {
    write(repo, "src/components/Tile.tsx", "export const Tile = () => <div className='UI_LITERAL' />;\n");
    const result = runHook("lint-edited-file.mjs", edit(path.join(repo, "src/components/Tile.tsx")));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("check:ui found literal colors");
  });

  it("passes silently on a clean file", () => {
    const result = runHook("lint-edited-file.mjs", edit(path.join(repo, "src/lib/math.ts")));
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("lints .astro files too", () => {
    write(repo, "src/pages/index.astro", "---\nconst LINT_ERROR = 1;\n---\n");
    expect(runHook("lint-edited-file.mjs", edit(path.join(repo, "src/pages/index.astro"))).code).toBe(2);
  });

  it("resolves a relative path against the payload cwd", () => {
    write(repo, "src/lib/math.ts", "const LINT_ERROR = 1;\n");
    expect(runHook("lint-edited-file.mjs", edit("src/lib/math.ts")).code).toBe(2);
  });

  it("skips a broken file of another repository", () => {
    const other = makeRepo("other");
    write(other, "src/lib/math.ts", "const LINT_ERROR = 1;\n");
    const result = runHook("lint-edited-file.mjs", edit(path.join(other, "src/lib/math.ts")));
    expect(result.code).toBe(0);
    expect(ran()).toEqual([]);
  });

  it("fails visibly when the linter is not installed", () => {
    rmSync(path.join(repo, "node_modules/eslint"), { recursive: true });
    const result = runHook("lint-edited-file.mjs", edit(path.join(repo, "src/lib/math.ts")));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("node_modules/eslint/bin/eslint.js not found");
  });
});

describe("related-tests.mjs (PostToolUse)", () => {
  it("blocks with the failing test when a test related to the edited file fails", () => {
    write(repo, "src/lib/math.test.ts", 'import { add } from "./math";\n// TEST_FAIL: expected 4, got 3\n');
    const result = runHook("related-tests.mjs", edit(path.join(repo, "src/lib/math.ts")));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Tests related to src/lib/math.ts fail");
    expect(result.stderr).toContain("math.test.ts: vitest found TEST_FAIL");
  });

  it("passes when the related tests pass", () => {
    expect(runHook("related-tests.mjs", edit(path.join(repo, "src/lib/math.ts"))).code).toBe(0);
  });

  it("fails visibly when vitest is not installed", () => {
    rmSync(path.join(repo, "node_modules/vitest"), { recursive: true });
    expect(runHook("related-tests.mjs", edit(path.join(repo, "src/lib/math.ts"))).code).toBe(2);
  });
});

describe("per-edit hooks: nothing to check", () => {
  it.each([
    ["a file the checks do not cover", (r: string) => edit(path.join(r, "README.md"))],
    ["a file that does not exist", (r: string) => edit(path.join(r, "src/lib/gone.ts"))],
    ["an empty payload", () => ({})],
    ["a tool call without a path", () => ({ tool_name: "Edit", tool_input: {} })],
    ["input that is not JSON", () => "not json"],
    ["empty stdin", () => ""],
  ])("both hooks pass on %s", (_label, payload) => {
    for (const hook of ["lint-edited-file.mjs", "related-tests.mjs"]) {
      const result = runHook(hook, payload(repo));
      expect(result.code, hook).toBe(0);
      expect(result.stderr, hook).toBe("");
    }
    expect(ran()).toEqual([]);
  });
});

describe("end-of-turn.mjs (Stop)", () => {
  it("passes without running any check when the turn changed nothing", () => {
    const result = runHook("end-of-turn.mjs", stop());
    expect(result.code).toBe(0);
    expect(ran()).toEqual([]);
  });

  it("runs lint, check:ui, the unit suite and astro check on a clean change", () => {
    write(repo, "src/lib/math.ts", "export const add = (a: number, b: number) => b + a;\n");
    const result = runHook("end-of-turn.mjs", stop());
    expect(result.code).toBe(0);
    expect(ran()).toEqual(["eslint", "check-ui", "vitest", "astro"]);
  });

  it("blocks on a lint error in a file written without the edit tools (e.g. through a shell)", () => {
    write(repo, "src/lib/shell-written.ts", "const LINT_ERROR = 1;\n");
    const result = runHook("end-of-turn.mjs", stop());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Fix these before you finish");
    expect(result.stderr).toContain("shell-written.ts: eslint found LINT_ERROR");
  });

  it("blocks on a type error anywhere in the project", () => {
    write(repo, "src/lib/math.ts", 'export const add = (a: number): number => "TYPE_ERROR";\n');
    const result = runHook("end-of-turn.mjs", stop());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Typecheck (astro check) fails");
  });

  it("blocks on a failing unit test", () => {
    write(repo, "src/lib/math.test.ts", "// TEST_FAIL\n");
    const result = runHook("end-of-turn.mjs", stop());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Unit tests fail");
  });

  it.each([{ stop_hook_active: true }, { loop_count: 1 }])("lets the agent finish on the retry (%o)", (retry) => {
    write(repo, "src/lib/math.ts", "const LINT_ERROR = 1;\n");
    expect(runHook("end-of-turn.mjs", stop(retry)).code).toBe(0);
  });

  it("fails visibly when astro is not installed", () => {
    write(repo, "src/lib/math.ts", "export const add = (a: number, b: number) => b + a;\n");
    rmSync(path.join(repo, "node_modules/astro"), { recursive: true });
    const result = runHook("end-of-turn.mjs", stop());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("node_modules/astro/bin/astro.mjs not found");
  });

  it("sweeps a sibling worktree the session edited in", () => {
    const tree = path.join(tmp, "sibling");
    git(repo, "worktree", "add", "-q", tree);
    installStubs(tree);
    write(tree, "src/lib/math.ts", "const LINT_ERROR = 1;\n");
    expect(runHook("lint-edited-file.mjs", edit(path.join(tree, "src/lib/math.ts"))).code).toBe(2);

    const result = runHook("end-of-turn.mjs", stop());
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("sibling");
  });
});

describe(".claude/settings.json commands", () => {
  const settings = JSON.parse(readFileSync(path.join(REPO, ".claude/settings.json"), "utf8")) as {
    hooks: Record<string, { hooks: { command: string; timeout: number }[] }[]>;
  };
  const commands = Object.values(settings.hooks).flatMap((groups) => groups.flatMap((group) => group.hooks));
  const hasSh = spawnSync("sh", ["-c", "true"]).status === 0;

  it("gives every hook a timeout in seconds, not milliseconds", () => {
    for (const { timeout } of commands) expect(timeout).toBeLessThanOrEqual(120);
  });

  it.skipIf(!hasSh)("reach the script from a subfolder when CLAUDE_PROJECT_DIR is stale", () => {
    write(repo, "src/lib/math.ts", "const LINT_ERROR = 1;\n");
    for (const { command } of commands) {
      const payload = command.includes("end-of-turn") ? stop() : edit(path.join(repo, "src/lib/math.ts"));
      const result = spawnSync("sh", ["-c", command], {
        cwd: path.join(repo, "src/lib"),
        input: JSON.stringify(payload),
        encoding: "utf8",
        env: { ...GIT_ENV, STUB_LOG: log, CLAUDE_PROJECT_DIR: path.join(tmp, "missing") },
      });
      expect(result.status, command).toBe(command.includes("related-tests") ? 0 : 2);
    }
  });
});
