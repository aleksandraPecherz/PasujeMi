// Writes the result file, metrics and sticky comment, then decides how the process ends.
// Kept apart from index.ts so tests can check, without the SDK, that the files exist before exit.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { renderComment } from "./comment.ts";
import type { ResultFile } from "./outcome.ts";
import type { Metrics } from "./run.ts";

export type OutputArgs = {
  result: ResultFile;
  metrics: Metrics | null;
  excludedFiles: readonly string[];
  out?: string;
  metricsOut?: string;
  commentOut?: string;
  sha?: string;
  runUrl?: string;
};

export type ExitDeps = {
  setExitCode: (code: number) => void;
  exit: (code: number) => void;
};

async function writeOut(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

export async function emitAndExit(args: OutputArgs, deps: ExitDeps): Promise<void> {
  const { result, metrics } = args;

  const resultJson = JSON.stringify(result, null, 2);
  if (args.out) await writeOut(args.out, resultJson);
  else console.log(resultJson);

  if (metrics) {
    const metricsJson = JSON.stringify(metrics, null, 2);
    if (args.metricsOut) await writeOut(args.metricsOut, metricsJson);
    else console.error(metricsJson);
  }

  if (args.commentOut) {
    await writeOut(
      args.commentOut,
      renderComment({
        result,
        reviewedSha: args.sha ?? "",
        runUrl: args.runUrl,
        excludedFiles: args.excludedFiles,
        metrics,
      }),
    );
  }

  if (result.status === "error") deps.setExitCode(1);
  // A timed-out query() may leave handles open; exit only after all files are written.
  if (result.status === "error" && result.category === "timeout") deps.exit(1);
}
