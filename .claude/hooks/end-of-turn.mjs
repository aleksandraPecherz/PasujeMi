// Stop: before the agent finishes, sweep every file this turn changed (also files rewritten
// through a shell command, which never reach the per-edit hooks): lint + check:ui on them,
// the whole unit suite (a few seconds) and `astro check` for the project. One retry only.
import {
  LINTED,
  block,
  changedFiles,
  checkoutOf,
  clearRegistry,
  readPayload,
  registeredCheckouts,
  runTool,
} from "./lib.mjs";

const payload = readPayload();

// Already sent back once by this hook: let it finish, the commit gate and CI catch the rest.
// (loop_count covers Cursor, which imports hooks from .claude/settings.json.)
if (payload.stop_hook_active === true || Number(payload.loop_count ?? 0) > 0) process.exit(0);

const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
const roots = [...new Set([checkoutOf(cwd), ...registeredCheckouts(payload.session_id)])].filter(Boolean);
if (!roots.length) {
  // Not silent: the user sees why nothing was checked.
  process.stdout.write(`${JSON.stringify({ systemMessage: `end-of-turn.mjs: no git checkout at ${cwd}, nothing checked.` })}\n`);
  process.exit(0);
}

const report = [];
for (const root of roots) {
  const changed = changedFiles(root);
  // Nothing changed (a question-and-answer turn): nothing to check here.
  if (!changed.length) continue;

  const linted = changed.filter((file) => LINTED.test(file));
  if (linted.length) {
    const lint = runTool(root, "eslint", ["--quiet", "--no-warn-ignored", ...linted]);
    if (!lint.ok) report.push(`ESLint errors in changed files (${root}):\n${lint.output}`);
    const ui = runTool(root, "checkUi", linted);
    if (!ui.ok) report.push(`check:ui found literals in changed files (${root}):\n${ui.output}`);
  }

  const tests = runTool(root, "vitest", ["run"]);
  if (!tests.ok) report.push(`Unit tests fail (${root}):\n${tests.output}`);

  // astro check also covers .astro files and runs `astro sync` itself (.astro/ is gitignored).
  const types = runTool(root, "astro", ["check"]);
  if (!types.ok) report.push(`Typecheck (astro check) fails (${root}):\n${types.output}`);
}

if (report.length) block(`Fix these before you finish:\n\n${report.join("\n\n")}`);
// Green: start the next turn with an empty registry.
clearRegistry(payload.session_id);
