import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REVIEW_JSON_SCHEMA, SCORE_FIELDS, SYSTEM_PROMPT } from "./review-schema.ts";

type Json = Record<string, unknown>;

function walk(node: unknown, visit: (node: Json) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
  } else if (node !== null && typeof node === "object") {
    visit(node as Json);
    for (const value of Object.values(node as Json)) walk(value, visit);
  }
}

describe("REVIEW_JSON_SCHEMA", () => {
  const schema = REVIEW_JSON_SCHEMA as Json;
  const properties = schema.properties as Record<string, Json>;

  it("makes all six scores nullable via anyOf with null", () => {
    assert.equal(SCORE_FIELDS.length, 6);
    for (const field of SCORE_FIELDS) {
      const anyOf = properties[field].anyOf as Json[];
      assert.ok(Array.isArray(anyOf), field);
      assert.ok(
        anyOf.some((branch) => branch.type === "null"),
        field,
      );
      assert.ok(
        anyOf.some((branch) => branch.type === "number"),
        field,
      );
    }
  });

  it("sets additionalProperties: false on every object and requires all its properties", () => {
    let objects = 0;
    walk(schema, (node) => {
      if (node.type !== "object") return;
      objects += 1;
      assert.equal(node.additionalProperties, false);
      assert.deepEqual([...(node.required as string[])].sort(), Object.keys(node.properties as Json).sort());
    });
    assert.equal(objects, 2); // review root + notAssessed item
  });

  it("uses no keywords the structured output API rejects", () => {
    const forbidden = [
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "multipleOf",
      "minLength",
      "maxLength",
    ];
    walk(schema, (node) => {
      for (const keyword of forbidden) assert.ok(!(keyword in node), keyword);
      if ("minItems" in node) assert.ok((node.minItems as number) <= 1);
    });
  });

  it("keeps notAssessed enums closed", () => {
    const item = (properties.notAssessed.items as Json).properties as Record<string, Json>;
    assert.deepEqual(item.reason.enum, ["no-data", "not-applicable"]);
    assert.deepEqual(item.criterion.enum, [...SCORE_FIELDS]);
  });
});

describe("SYSTEM_PROMPT", () => {
  it("keeps the key phrases of the contract (guard against drift)", () => {
    const phrases = [
      "notAssessed",
      "no-data",
      "not-applicable",
      "prefiksu",
      "src/pages/",
      "astro:env/server",
      "<pr_title>",
      "<pr_body>",
      "<diff>",
      "niezaufanymi danymi",
      "liczby neutralnej",
    ];
    for (const phrase of phrases) assert.ok(SYSTEM_PROMPT.includes(phrase), phrase);
  });

  it("asks for a 2-3 sentence summary and keeps no-assessment details in notAssessed", () => {
    assert.match(SYSTEM_PROMPT, /2-3 zdania łącznie/);
    assert.match(SYSTEM_PROMPT, /nie powtarzaj ich w summary/);
    const summary = (REVIEW_JSON_SCHEMA as Json).properties as Record<string, Json>;
    assert.match(summary.summary.description as string, /2-3 zdania łącznie/);
  });

  it("gives the score field descriptions the accepted anchors, not the old M5L2 ones", () => {
    const properties = (REVIEW_JSON_SCHEMA as Json).properties as Record<string, Json>;
    const text = SCORE_FIELDS.map((field) => properties[field].description as string).join("\n");
    for (const stale of [
      "najprostszy projekt",
      "nie do odróżnienia",
      "najbardziej ryzykowne ścieżki",
      "po cichu psuje",
    ]) {
      assert.ok(!text.includes(stale), stale);
    }
    for (const accepted of [
      "nie jest to dowód, że jest najprostsze",
      "ocena dotyczy tylko zakresu widocznego w diffie",
      "wystąpi na głównej ścieżce",
    ]) {
      assert.ok(text.includes(accepted), accepted);
    }
  });

  it("names all six criteria", () => {
    for (const field of SCORE_FIELDS) assert.ok(SYSTEM_PROMPT.includes(field), field);
  });

  it("states the prefix rule for tests in src/pages/", () => {
    assert.match(SYSTEM_PROMPT, /src\/pages\/ musi mieć prefiks "_"/);
  });
});
