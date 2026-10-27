import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findForbiddenEnv, runPreflight } from "./preflight.ts";

describe("preflight", () => {
  it("passes with none of the variables set", () => {
    assert.deepEqual(findForbiddenEnv({ PATH: "x" }), []);
    assert.equal(runPreflight({ PATH: "x" }), 0);
  });

  it("lists every variable that is set", () => {
    const env = { ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "b", ANTHROPIC_AUTH_TOKEN: "" };
    assert.deepEqual(findForbiddenEnv(env), ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
    assert.equal(runPreflight(env), 1);
  });

  it("does not echo values", () => {
    const lines: string[] = [];
    const original = console.error;
    console.error = (line: string) => void lines.push(line);
    try {
      runPreflight({ ANTHROPIC_API_KEY: "sk-secret-value" });
    } finally {
      console.error = original;
    }
    assert.ok(lines.length > 0);
    assert.ok(lines.every((line) => !line.includes("sk-secret-value")));
  });
});
