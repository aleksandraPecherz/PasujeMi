// Stops an eval run when an environment variable would replace the subscription login of the Agent SDK
// (ANTHROPIC_API_KEY wins over it in non-interactive mode) or would silently pick a different grader.
// Only the presence of the names is checked; values and credential files are never read.
import { pathToFileURL } from "node:url";

export const FORBIDDEN_ENV = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY"] as const;

export function findForbiddenEnv(env: NodeJS.ProcessEnv): string[] {
  return FORBIDDEN_ENV.filter((name) => env[name] !== undefined && env[name] !== "");
}

export function runPreflight(env: NodeJS.ProcessEnv = process.env): number {
  const found = findForbiddenEnv(env);
  if (found.length === 0) {
    console.log("preflight: OK (no API key variables set)");
    return 0;
  }
  console.error(`preflight: unset these variables before running evals: ${found.join(", ")}`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = runPreflight();
