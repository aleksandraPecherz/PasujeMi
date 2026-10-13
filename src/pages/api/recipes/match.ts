import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { MAX_TAG_LENGTH, MAX_TAGS, MAX_TOKENS, countTokens } from "@/lib/matching/limits";
import { parseIntParam } from "@/lib/query-params";
import { matchRecipes } from "@/lib/services/recipes";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// Repeated parameter (`?have=a&have=b`) -> trimmed tags; an empty or too long tag, or too many tags -> null.
function parseTagList(params: URLSearchParams, name: string): string[] | null {
  const tags = params.getAll(name).map((tag) => tag.trim());
  if (tags.length > MAX_TAGS || tags.some((tag) => tag === "" || tag.length > MAX_TAG_LENGTH)) {
    return null;
  }
  return tags;
}

// Owned products live only in the session (PRD FR-003), so the island sends all three lists with each request.
// Signed-out requests never reach this handler: the middleware answers /api/* with 401.
export const GET: APIRoute = async (context) => {
  const params = context.url.searchParams;
  const limit = parseIntParam(params.get("limit"), DEFAULT_LIMIT);
  const offset = parseIntParam(params.get("offset"), 0);
  const have = parseTagList(params, "have");
  const staple = parseTagList(params, "staple");
  const exclude = parseTagList(params, "exclude");

  if (
    limit === null ||
    limit < 1 ||
    limit > MAX_LIMIT ||
    offset === null ||
    have === null ||
    staple === null ||
    exclude === null ||
    // With no tags at all the list is plain FR-005: /api/recipes.
    have.length + staple.length + exclude.length === 0 ||
    countTokens([...have, ...staple, ...exclude]) > MAX_TOKENS
  ) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const page = await matchRecipes(supabase, { have, staple, exclude }, { limit, offset });
    return Response.json(page);
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side log, visible in Workers logs
    console.error("matchRecipes failed", error);
    return Response.json({ error: "database_error" }, { status: 500 });
  }
};
