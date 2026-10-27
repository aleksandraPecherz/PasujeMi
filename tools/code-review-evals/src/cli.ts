// The one entry point for promptfoo in this package: runs the preflight, switches off telemetry, update checks,
// sharing and remote generation, and keeps promptfoo's own state inside the package (.promptfoo/, gitignored).
// Usage: npm run promptfoo -- eval -c promptfooconfig.yaml --no-cache -j 1 ...
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runPreflight } from "./preflight.ts";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const PROMPTFOO_ENV = {
  PROMPTFOO_DISABLE_TELEMETRY: "1",
  PROMPTFOO_DISABLE_UPDATE: "1",
  PROMPTFOO_DISABLE_SHARING: "true",
  PROMPTFOO_DISABLE_REMOTE_GENERATION: "true",
  PROMPTFOO_CONFIG_DIR: join(packageDir, ".promptfoo"),
} as const;

export function promptfooEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, ...PROMPTFOO_ENV };
}

function promptfooBin(): string {
  // package.json is not in promptfoo's exports map; the main entry (dist/src/index.js) sits next to the CLI entry.
  const main = createRequire(import.meta.url).resolve("promptfoo");
  return join(dirname(main), "entrypoint.js");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (runPreflight() !== 0) process.exit(1);
  const run = spawnSync(process.execPath, [promptfooBin(), ...process.argv.slice(2)], {
    cwd: packageDir,
    env: promptfooEnv(),
    stdio: "inherit",
  });
  process.exit(run.status ?? 1);
}
