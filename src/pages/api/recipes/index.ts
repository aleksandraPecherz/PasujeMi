import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { listRecipes } from "@/lib/services/recipes";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// Missing parameter -> fallback; anything but a plain non-negative integer -> null.
function parseIntParam(value: string | null, fallback: number): number | null {
  if (value === null) {
    return fallback;
  }
  return /^\d+$/.test(value) ? Number(value) : null;
}

// Signed-out requests never reach this handler: the middleware answers /api/* with 401.
export const GET: APIRoute = async (context) => {
  const params = context.url.searchParams;
  const limit = parseIntParam(params.get("limit"), DEFAULT_LIMIT);
  const offset = parseIntParam(params.get("offset"), 0);

  if (limit === null || limit < 1 || limit > MAX_LIMIT || offset === null) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const page = await listRecipes(supabase, { limit, offset });
    return Response.json(page);
  } catch {
    return Response.json({ error: "database_error" }, { status: 500 });
  }
};
