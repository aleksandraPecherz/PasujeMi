// PostToolUse (Write|Edit): lint only the file the agent just edited, and scan it for UI literals.
// No --fix: rewriting the file would make the agent's next Edit fail with "file modified since read".
import { LINTED, block, editedFile, readPayload, registerCheckout, runTool } from "./lib.mjs";

const payload = readPayload();
const edited = editedFile(payload);
if (!edited || !LINTED.test(edited.rel)) process.exit(0);
registerCheckout(payload.session_id, edited.root);

const problems = [];
const lint = runTool(edited.root, "eslint", ["--quiet", "--no-warn-ignored", edited.rel]);
if (!lint.ok) problems.push(`ESLint reported errors in ${edited.rel}:\n${lint.output}`);
// Scans the file only when it is listed in CLEAN_FILES; otherwise exits 0.
const ui = runTool(edited.root, "checkUi", [edited.rel]);
if (!ui.ok) problems.push(`check:ui found literal colors or arbitrary values in ${edited.rel}:\n${ui.output}`);

if (problems.length) block(problems.join("\n\n"));
