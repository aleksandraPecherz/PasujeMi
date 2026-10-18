import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { parseIntParam } from "@/lib/query-params";
import { readTextWithLimit } from "@/lib/request-body";
import { MAX_RECIPE_BODY_BYTES } from "@/lib/recipes/limits";
import { parseRecipeInput } from "@/lib/recipes/validate";
import { createRecipe, listRecipes } from "@/lib/services/recipes";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

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
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side log, visible in Workers logs
    console.error("listRecipes failed", error);
    return Response.json({ error: "database_error" }, { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const { request } = context;
  const user = context.locals.user;
  // Defence in depth: the middleware already answers signed-out /api/* with 401.
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // The media type only, without parameters: `includes` would let "text/plain; x=application/json" through.
  const mediaType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  // Size is checked before the body is parsed.
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_RECIPE_BODY_BYTES) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }
  // A chunked request has no Content-Length, so the body is also counted while it is read.
  const text = await readTextWithLimit(request, MAX_RECIPE_BODY_BYTES);
  if (text === null) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseRecipeInput(body);
  if (!parsed.ok) {
    return Response.json({ error: "invalid_recipe", issues: parsed.issues }, { status: 400 });
  }

  const supabase = createClient(request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const recipe = await createRecipe(supabase, user.id, parsed.value);
    return Response.json({ recipe }, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side log, visible in Workers logs
    console.error("createRecipe failed", error);
    return Response.json({ error: "database_error" }, { status: 500 });
  }
};
