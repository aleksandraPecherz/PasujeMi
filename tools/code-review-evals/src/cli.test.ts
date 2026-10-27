import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROMPTFOO_ENV, promptfooEnv } from "./cli.ts";

describe("promptfoo wrapper environment", () => {
  it("switches off telemetry, update checks, sharing and remote generation", () => {
    const env = promptfooEnv({});
    assert.equal(env.PROMPTFOO_DISABLE_TELEMETRY, "1");
    assert.equal(env.PROMPTFOO_DISABLE_UPDATE, "1");
    assert.equal(env.PROMPTFOO_DISABLE_SHARING, "true");
    assert.equal(env.PROMPTFOO_DISABLE_REMOTE_GENERATION, "true");
  });

  it("overrides inherited values and keeps promptfoo state inside the package", () => {
    const env = promptfooEnv({ PROMPTFOO_DISABLE_TELEMETRY: "0", PROMPTFOO_CONFIG_DIR: "/elsewhere", KEEP: "me" });
    assert.equal(env.PROMPTFOO_DISABLE_TELEMETRY, "1");
    assert.equal(env.PROMPTFOO_CONFIG_DIR, PROMPTFOO_ENV.PROMPTFOO_CONFIG_DIR);
    assert.match(env.PROMPTFOO_CONFIG_DIR ?? "", /code-review-evals[\\/]\.promptfoo$/);
    assert.equal(env.KEEP, "me");
  });
});
