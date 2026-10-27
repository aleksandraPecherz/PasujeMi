// The "_" prefix keeps this file out of the Astro router (every .ts in src/pages is a route).
// The service and client are mocked, so this proves the endpoint's contract, not RLS on saved_pantry.
import type { APIContext } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TAG_LENGTH, MAX_TAGS } from "@/lib/matching/limits";
import { MAX_PANTRY_BODY_BYTES } from "@/lib/pantry/limits";

const { saveSavedPantry, createClient } = vi.hoisted(() => ({ saveSavedPantry: vi.fn(), createClient: vi.fn() }));

// "@/lib/supabase" imports astro:env/server, which Vitest cannot resolve.
vi.mock("@/lib/supabase", () => ({ createClient }));
vi.mock("@/lib/services/pantry", () => ({ saveSavedPantry }));

import { PUT } from "./pantry";

const USER_ID = "user-1";

interface CallOptions {
  user?: { id: string } | null;
  body?: unknown;
  raw?: string;
  contentType?: string | null;
}

function call({ user = { id: USER_ID }, body, raw, contentType = "application/json" }: CallOptions): Promise<Response> {
  const headers = new Headers();
  if (contentType !== null) headers.set("content-type", contentType);
  const request = new Request("http://localhost/api/pantry", {
    method: "PUT",
    headers,
    // Bytes, not a string: a string body makes Request add "text/plain" itself, so there would be no missing header.
    body: new TextEncoder().encode(raw ?? JSON.stringify(body)),
  });
  const context = { request, cookies: {}, locals: { user } } as unknown as APIContext;
  return PUT(context) as Promise<Response>;
}

/** `count` distinct one-word, letter-only tags (digits vanish in tokenize), each far below MAX_TAG_LENGTH. */
function oneWordTags(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `a${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
  );
}

const valid = { ownerId: USER_ID, staple: ["sól", "pieprz"], exclude: ["orzechy"] };

beforeEach(() => {
  saveSavedPantry.mockReset();
  saveSavedPantry.mockResolvedValue(undefined);
  createClient.mockReset();
  createClient.mockReturnValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PUT /api/pantry", () => {
  it("saves the lists for the session user and answers 204 without a body", async () => {
    const response = await call({ body: valid });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(saveSavedPantry).toHaveBeenCalledTimes(1);
    expect(saveSavedPantry).toHaveBeenCalledWith(expect.anything(), USER_ID, {
      staple: ["sól", "pieprz"],
      exclude: ["orzechy"],
    });
  });

  it("saves trimmed tags and accepts empty lists", async () => {
    expect((await call({ body: { ownerId: USER_ID, staple: ["  sól "], exclude: [] } })).status).toBe(204);
    expect(saveSavedPantry).toHaveBeenLastCalledWith(expect.anything(), USER_ID, { staple: ["sól"], exclude: [] });

    expect((await call({ body: { ownerId: USER_ID, staple: [], exclude: [] } })).status).toBe(204);
    expect(saveSavedPantry).toHaveBeenLastCalledWith(expect.anything(), USER_ID, { staple: [], exclude: [] });
  });

  it("answers a signed-out request with 401 and saves nothing", async () => {
    const response = await call({ user: null, body: valid });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(saveSavedPantry).not.toHaveBeenCalled();
  });

  it("refuses lists that belong to another account with 409 owner_mismatch", async () => {
    const response = await call({ body: { ...valid, ownerId: "user-2" } });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "owner_mismatch" });
    expect(saveSavedPantry).not.toHaveBeenCalled();
  });

  it.each<[string, unknown]>([
    ["a missing ownerId", { staple: [], exclude: [] }],
    ["a non-string ownerId", { ownerId: 1, staple: [], exclude: [] }],
    ["a body that is not an object", ["sól"]],
    ["a null body", null],
    ["missing lists", { ownerId: USER_ID }],
    ["a list that is not an array", { ownerId: USER_ID, staple: "sól", exclude: [] }],
    ["a non-string tag", { ownerId: USER_ID, staple: [1], exclude: [] }],
    ["an empty tag", { ownerId: USER_ID, staple: ["  "], exclude: [] }],
    ["a duplicate tag", { ownerId: USER_ID, staple: ["Sól", "sól"], exclude: [] }],
    ["more than MAX_TAGS tags", { ownerId: USER_ID, staple: oneWordTags(MAX_TAGS + 1), exclude: [] }],
    ["a tag longer than MAX_TAG_LENGTH", { ownerId: USER_ID, staple: ["a".repeat(MAX_TAG_LENGTH + 1)], exclude: [] }],
  ])("rejects %s with 400 invalid_pantry", async (_name, body) => {
    const response = await call({ body });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_pantry" });
    expect(saveSavedPantry).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON with 400 invalid_json", async () => {
    const response = await call({ raw: "{not json" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_json" });
    expect(saveSavedPantry).not.toHaveBeenCalled();
  });

  it.each<[string | null]>([["text/plain"], ["text/plain; x=application/json"], [null]])(
    "rejects content type %j with 415 unsupported_media_type",
    async (contentType) => {
      const response = await call({ body: valid, contentType });

      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({ error: "unsupported_media_type" });
      expect(saveSavedPantry).not.toHaveBeenCalled();
    },
  );

  it("rejects a body over MAX_PANTRY_BODY_BYTES with 413 payload_too_large", async () => {
    const response = await call({ raw: JSON.stringify({ ...valid, padding: "a".repeat(MAX_PANTRY_BODY_BYTES) }) });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "payload_too_large" });
    expect(saveSavedPantry).not.toHaveBeenCalled();
  });

  it("answers 503 not_configured when Supabase is not configured", async () => {
    createClient.mockReturnValue(null);

    const response = await call({ body: valid });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "not_configured" });
    expect(saveSavedPantry).not.toHaveBeenCalled();
  });

  it("answers 500 database_error without leaking the cause when saving fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    saveSavedPantry.mockRejectedValue(new Error("connection string leaked"));

    const response = await call({ body: valid });

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: "database_error" });
    expect(text).not.toContain("leaked");
  });
});
