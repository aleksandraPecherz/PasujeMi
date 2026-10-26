import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_INPUT_CHARS, prepareInput } from "./input.ts";

const base = { title: "T", body: "B", diff: "D", excludedFiles: [] as string[] };

describe("prepareInput", () => {
  it("accepts exactly the limit and rejects one char more (title + body + diff)", () => {
    const diff = "x".repeat(MAX_INPUT_CHARS - 2);
    assert.equal(prepareInput({ ...base, diff }).kind, "ok");
    assert.deepEqual(prepareInput({ ...base, diff: diff + "x" }), { kind: "too-large", chars: MAX_INPUT_CHARS + 1 });
  });

  it("counts Unicode characters, not UTF-16 units", () => {
    // 60 000 emoji are 60 000 characters (120 000 UTF-16 units): still within the limit.
    const emoji = "😀".repeat(MAX_INPUT_CHARS);
    assert.equal(prepareInput({ title: "", body: "", diff: emoji, excludedFiles: [] }).kind, "ok");
    assert.equal(prepareInput({ title: "ż", body: "", diff: emoji, excludedFiles: [] }).kind, "too-large");
    const polish = "ąęść".repeat(MAX_INPUT_CHARS / 4);
    assert.equal(prepareInput({ title: "", body: "", diff: polish, excludedFiles: [] }).kind, "ok");
  });

  it("skips an empty diff with excluded files and lists them", () => {
    const excludedFiles = ["package-lock.json", "tools/x/package-lock.json"];
    assert.deepEqual(prepareInput({ ...base, diff: " \n", excludedFiles }), {
      kind: "skip",
      reason: "wyłącznie pominięte pliki: package-lock.json, tools/x/package-lock.json",
    });
  });

  it("skips an empty diff without excluded files as 'pusty diff'", () => {
    assert.deepEqual(prepareInput({ ...base, diff: "" }), { kind: "skip", reason: "pusty diff" });
  });

  it("puts title, body and diff in separate blocks and marks an empty body", () => {
    const result = prepareInput({ ...base, title: "Tytuł", body: "  ", diff: "diff --git a b" });
    assert.equal(result.kind, "ok");
    if (result.kind !== "ok") return;
    assert.match(result.prompt, /<pr_title>\nTytuł\n<\/pr_title>/);
    assert.match(result.prompt, /<pr_body>\n\(pusty opis\)\n<\/pr_body>/);
    assert.match(result.prompt, /<diff>\ndiff --git a b\n<\/diff>/);
  });
});
