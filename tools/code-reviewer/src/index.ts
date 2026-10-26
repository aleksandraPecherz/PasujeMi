// Code-review agent: diff (plus optional PR title/description) in, structured JSON verdict out.
// Auth comes from the Claude Code login locally and from CLAUDE_CODE_OAUTH_TOKEN in CI;
// ANTHROPIC_API_KEY is deliberately never set here.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { renderComment } from "./comment.ts";
import { runReview, type QueryFn } from "./run.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString("utf8");
}

async function readOptional(path: string | undefined): Promise<string> {
  return path ? readFile(path, "utf8") : "";
}

async function readDiff(path: string | undefined): Promise<string> {
  if (path) return readFile(path, "utf8");
  if (process.stdin.isTTY) {
    throw new Error("Brak diffa: podaj plik (npm run review -- fixtures/sample.diff) albo przekaż diff przez stdin.");
  }
  return readStdin();
}

async function writeOut(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "title-file": { type: "string" },
      "body-file": { type: "string" },
      "diff-file": { type: "string" },
      "excluded-file": { type: "string" },
      out: { type: "string" },
      metrics: { type: "string" },
      "comment-out": { type: "string" },
      sha: { type: "string" },
      "run-url": { type: "string" },
      "require-token": { type: "boolean", default: false },
    },
  });

  const diff = await readDiff(values["diff-file"] ?? positionals[0]);
  const excludedFiles = (await readOptional(values["excluded-file"])).split("\n").filter((line) => line.trim() !== "");

  const { result, metrics, logs } = await runReview(
    {
      title: await readOptional(values["title-file"]),
      body: await readOptional(values["body-file"]),
      diff,
      excludedFiles,
      requireToken: values["require-token"],
      hasToken: Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN),
    },
    query as QueryFn,
  );

  // Raw details go to stderr only; the result file and the comment carry safe content.
  for (const line of logs) console.error(line);
  if (result.status === "skipped") console.error(`Pominięto: ${result.reason}`);

  const resultJson = JSON.stringify(result, null, 2);
  if (values.out) await writeOut(values.out, resultJson);
  else console.log(resultJson);

  if (metrics) {
    const metricsJson = JSON.stringify(metrics, null, 2);
    if (values.metrics) await writeOut(values.metrics, metricsJson);
    else console.error(metricsJson);
  }

  if (values["comment-out"]) {
    await writeOut(
      values["comment-out"],
      renderComment({ result, reviewedSha: values.sha ?? "", runUrl: values["run-url"], excludedFiles, metrics }),
    );
  }

  if (result.status === "error") process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
