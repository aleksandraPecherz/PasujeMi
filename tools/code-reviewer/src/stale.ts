// CLI around markStale: stale.ts --in <body.md> --head-sha <sha> --out <body.md>
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { markStale } from "./comment.ts";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { in: { type: "string" }, "head-sha": { type: "string" }, out: { type: "string" } },
  });
  if (!values.in || !values["head-sha"] || !values.out) {
    throw new Error("Użycie: npm run stale -- --in <body.md> --head-sha <sha> --out <body.md>");
  }
  const body = await readFile(values.in, "utf8");
  await mkdir(dirname(values.out), { recursive: true });
  await writeFile(values.out, markStale(body, values["head-sha"]));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
