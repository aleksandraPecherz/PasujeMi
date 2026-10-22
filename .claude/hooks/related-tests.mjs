// PostToolUse (Write|Edit): run only the Vitest tests that depend on the edited file.
// `vitest related` exits 0 when no test depends on it, so files without tests never block.
import { TESTED, block, editedFile, readPayload, runTool } from "./lib.mjs";

const edited = editedFile(readPayload());
if (!edited || !TESTED.test(edited.rel)) process.exit(0);

const tests = runTool(edited.root, "vitest", ["related", edited.rel, "--run"]);
if (!tests.ok) block(`Tests related to ${edited.rel} fail:\n${tests.output}`);
