import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/http/json-body";

const LIMIT = 100;

function jsonRequest(body: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/recipes", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

async function failure(result: Awaited<ReturnType<typeof readJsonBody>>) {
  if (result.ok) throw new Error("expected a failure");
  return { status: result.response.status, body: (await result.response.json()) as unknown };
}

describe("readJsonBody", () => {
  it("returns the parsed body", async () => {
    const result = await readJsonBody(jsonRequest('{"name":"Zupa"}'), LIMIT);

    expect(result).toEqual({ ok: true, body: { name: "Zupa" } });
  });

  it("accepts a media type with parameters", async () => {
    const result = await readJsonBody(jsonRequest("[1]", { "content-type": "Application/JSON; charset=utf-8" }), LIMIT);

    expect(result).toEqual({ ok: true, body: [1] });
  });

  it("answers 415 for another media type, even one that mentions application/json in a parameter", async () => {
    const result = await readJsonBody(jsonRequest("{}", { "content-type": "text/plain; x=application/json" }), LIMIT);

    expect(await failure(result)).toEqual({ status: 415, body: { error: "unsupported_media_type" } });
  });

  it("answers 413 when content-length is over the limit", async () => {
    const result = await readJsonBody(jsonRequest("{}", { "content-length": String(LIMIT + 1) }), LIMIT);

    expect(await failure(result)).toEqual({ status: 413, body: { error: "payload_too_large" } });
  });

  it("answers 413 for a streamed body over the limit without a content-length", async () => {
    const chunk = new TextEncoder().encode(JSON.stringify({ text: "x".repeat(60) }));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(request.headers.get("content-length")).toBeNull();

    const result = await readJsonBody(request, LIMIT);

    expect(await failure(result)).toEqual({ status: 413, body: { error: "payload_too_large" } });
  });

  it("answers 400 for broken JSON", async () => {
    const result = await readJsonBody(jsonRequest("{nope"), LIMIT);

    expect(await failure(result)).toEqual({ status: 400, body: { error: "invalid_json" } });
  });
});
