// Local code-review agent: diff in (file argument or stdin), structured JSON verdict out.
// Auth comes from the Claude Code login; ANTHROPIC_API_KEY is deliberately never set here.
import { readFile } from "node:fs/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { REVIEW_JSON_SCHEMA, REVIEW_SCHEMA, SYSTEM_PROMPT } from "./review-schema.ts";

const MODEL = "claude-sonnet-5-5";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString("utf8");
}

async function readDiff(path: string | undefined): Promise<string> {
  if (path) return readFile(path, "utf8");
  if (process.stdin.isTTY) {
    throw new Error("Brak diffa: podaj plik (npm run review -- fixtures/sample.diff) albo przekaż diff przez stdin.");
  }
  return readStdin();
}

async function main(): Promise<void> {
  const diff = await readDiff(process.argv[2]);
  if (!diff.trim()) throw new Error("Diff jest pusty.");

  for await (const message of query({
    prompt: `Zrecenzuj poniższy diff.\n\n${diff}`,
    options: {
      model: MODEL,
      systemPrompt: SYSTEM_PROMPT,
      tools: [],
      settingSources: [],
      maxTurns: 2,
      maxBudgetUsd: 0.5,
      outputFormat: { type: "json_schema", schema: REVIEW_JSON_SCHEMA },
    },
  })) {
    if (message.type !== "result") continue;

    if (message.subtype !== "success") {
      throw new Error(
        `Przegląd nie powiódł się (${message.subtype}): ${message.errors.join("; ") || "brak szczegółów"}`,
      );
    }

    const parsed = REVIEW_SCHEMA.safeParse(message.structured_output);
    if (!parsed.success) {
      throw new Error(`Odpowiedź nie pasuje do schematu recenzji: ${parsed.error.message}`);
    }

    console.log(JSON.stringify(parsed.data, null, 2));
    console.error(
      JSON.stringify(
        {
          total_cost_usd: message.total_cost_usd,
          num_turns: message.num_turns,
          duration_ms: message.duration_ms,
          usage: message.usage,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
