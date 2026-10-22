// The "_" prefix keeps this file out of the Astro router (every .ts in src/pages is a route).
import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TAG_LENGTH, MAX_TAGS, MAX_TOKENS } from "@/lib/matching/limits";

const { matchRecipes } = vi.hoisted(() => ({ matchRecipes: vi.fn() }));

// "@/lib/supabase" imports astro:env/server, which Vitest cannot resolve.
vi.mock("@/lib/supabase", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/services/recipes", () => ({ matchRecipes }));

import { GET } from "./match";

type Query = Record<string, string[]>;

function call(query: Query): Promise<Response> {
  const url = new URL("http://localhost/api/recipes/match");
  for (const [name, tags] of Object.entries(query)) {
    for (const tag of tags) url.searchParams.append(name, tag);
  }
  const context = { url, request: new Request(url), cookies: {} } as unknown as APIContext;
  return GET(context) as Promise<Response>;
}

/** `count` one-word tags, each a distinct letter-only word. */
function oneWordTags(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `a${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
  );
}

/** Exactly `count` words, packed ten to a tag so the tag-count and tag-length limits stay out of the way. */
function words(count: number): string[] {
  const all = Array.from({ length: count }, () => "ab");
  const tags: string[] = [];
  for (let i = 0; i < all.length; i += 10) tags.push(all.slice(i, i + 10).join(" "));
  return tags;
}

beforeEach(() => {
  matchRecipes.mockReset();
  matchRecipes.mockResolvedValue({ recipes: [], hasMore: false, total: 0 });
});

describe("GET /api/recipes/match input limits", () => {
  it.each<[string, Query]>([
    ["more than MAX_TAGS tags in one list", { have: oneWordTags(MAX_TAGS + 1) }],
    ["more than MAX_TAGS staple tags", { have: ["pomidor"], staple: oneWordTags(MAX_TAGS + 1) }],
    ["a tag longer than MAX_TAG_LENGTH", { have: ["a".repeat(MAX_TAG_LENGTH + 1)] }],
    ["an exclusion longer than MAX_TAG_LENGTH", { have: ["pomidor"], exclude: ["a".repeat(MAX_TAG_LENGTH + 1)] }],
    ["an empty tag (spaces only)", { have: ["   "] }],
    [
      "more than MAX_TOKENS words spread over two lists",
      { have: words(MAX_TOKENS / 2), exclude: words(MAX_TOKENS / 2 + 1) },
    ],
    ["no tags at all", {}],
  ])("rejects %s with 400 invalid_query", async (_name, query) => {
    const response = await call(query);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_query" });
    expect(matchRecipes).not.toHaveBeenCalled();
  });

  it.each<[string, Query]>([
    ["exactly MAX_TAGS tags", { have: oneWordTags(MAX_TAGS) }],
    ["a tag of exactly MAX_TAG_LENGTH", { have: ["a".repeat(MAX_TAG_LENGTH)] }],
    ["exactly MAX_TOKENS words over two lists", { have: words(MAX_TOKENS / 2), exclude: words(MAX_TOKENS / 2) }],
    ["owned and staple tags without exclusions", { have: ["pomidor"], staple: ["sól"] }],
  ])("accepts %s", async (_name, query) => {
    const response = await call(query);

    expect(response.status).toBe(200);
    expect(matchRecipes).toHaveBeenCalledTimes(1);
  });

  it("passes trimmed lists to matchRecipes", async () => {
    const response = await call({ have: ["  pomidor "], staple: ["sól"], exclude: [" mleko"] });

    expect(response.status).toBe(200);
    expect(matchRecipes).toHaveBeenCalledWith(
      expect.anything(),
      { have: ["pomidor"], staple: ["sól"], exclude: ["mleko"] },
      expect.anything(),
    );
  });
});

describe("GET /api/recipes/match errors", () => {
  it("answers a failed matchRecipes with 500 database_error", async () => {
    matchRecipes.mockRejectedValue(new Error("connection lost"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await call({ have: ["pomidor"] });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "database_error" });
    consoleError.mockRestore();
  });
});
