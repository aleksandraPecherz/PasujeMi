// Shared helpers for the agent hooks in this folder (Claude Code, see .claude/settings.json).
// Node instead of bash + jq: works the same on Windows, macOS and Linux without extra tools.
// Protocol: exit 0 = checked and clean (or nothing to check); exit 2 + stderr = the agent sees the message.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Plain text: the model reads this output, not a terminal.
const PLAIN_ENV = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" };
// astro check colours its diagnostics even with NO_COLOR, so strip escape codes as well.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

// File types ESLint covers here (eslint.config.js: JS/TS, React, Astro).
export const LINTED = /\.(?:[cm]?[jt]s|[jt]sx|astro)$/;
// File types Vitest can relate to tests (it does not import .astro files).
export const TESTED = /\.(?:[cm]?[jt]s|[jt]sx)$/;

// Tools are started with the current node binary, so no shell and no npx: on Windows npx needs a shell.
export const TOOLS = {
  eslint: "node_modules/eslint/bin/eslint.js",
  vitest: "node_modules/vitest/vitest.mjs",
  astro: "node_modules/astro/bin/astro.mjs",
  checkUi: "scripts/check-ui-literals.mjs",
};

/** Payload from stdin. Empty or broken input means "nothing to check", never a hook error. */
export function readPayload() {
  try {
    const parsed = JSON.parse(readFileSync(0, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function block(message) {
  process.stderr.write(message.endsWith("\n") ? message : `${message}\n`);
  process.exit(2);
}

function git(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: PLAIN_ENV });
  return result.status === 0 ? result.stdout.trim() : null;
}

function real(p) {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/** Top folder of the git checkout that holds `dir`, or null outside git. */
export function checkoutOf(dir) {
  const top = existsSync(dir) ? git(dir, ["rev-parse", "--show-toplevel"]) : null;
  return top ? real(top) : null;
}

function repositoryOf(dir) {
  const common = git(dir, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return common ? real(common) : null;
}

/**
 * The edited file and its checkout, or null when there is nothing to check: no path, a file
 * that no longer exists, or a file of another repository (~/.claude, other projects).
 * The checkout comes from the file itself, not $CLAUDE_PROJECT_DIR: after EnterWorktree,
 * or for a sibling worktree, that variable names another checkout.
 */
export function editedFile(payload) {
  const input = payload.tool_input ?? {};
  const raw = input.file_path ?? input.notebook_path;
  if (typeof raw !== "string" || raw === "") return null;
  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const file = path.resolve(cwd, raw);
  if (!existsSync(file)) return null;

  const root = checkoutOf(path.dirname(file));
  if (!root) return null;
  const repo = repositoryOf(root);
  if (!repo || repo !== repositoryOf(cwd)) return null;
  return { file: real(file), root, rel: path.relative(root, real(file)).replaceAll("\\", "/") };
}

/** Runs a repo tool with node. A tool that is not installed is a failure, not a pass. */
export function runTool(root, tool, args) {
  const entry = path.join(root, TOOLS[tool]);
  if (!existsSync(entry)) {
    return { ok: false, output: `${TOOLS[tool]} not found in ${root}: run npm ci.` };
  }
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: root,
    encoding: "utf8",
    env: PLAIN_ENV,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(ANSI, "").trim();
  if (result.error) return { ok: false, output: `${TOOLS[tool]} did not start: ${result.error.message}` };
  return { ok: result.status === 0, output };
}

// Checkouts edited in this session, so the Stop hook sweeps a sibling worktree too.
function registryFile(sessionId) {
  const id = String(sessionId ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  return id ? path.join(os.tmpdir(), "claude-hooks", `${id}.roots`) : null;
}

export function registerCheckout(sessionId, root) {
  const file = registryFile(sessionId);
  if (!file) return;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, `${root}\n`);
  } catch {
    // The registry only widens the end-of-turn sweep; the session checkout is swept anyway.
  }
}

export function registeredCheckouts(sessionId) {
  const file = registryFile(sessionId);
  if (!file || !existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean);
}

export function clearRegistry(sessionId) {
  const file = registryFile(sessionId);
  if (file && existsSync(file)) writeFileSync(file, "");
}

/** Changed and new files of a checkout (relative, forward slashes) that still exist. */
export function changedFiles(root) {
  const tracked = git(root, ["diff", "--name-only", "HEAD"]) ?? "";
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard"]) ?? "";
  const names = new Set(`${tracked}\n${untracked}`.split("\n").filter(Boolean));
  return [...names].filter((name) => existsSync(path.join(root, name))).sort();
}
