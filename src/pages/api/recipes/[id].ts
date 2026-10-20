import type { APIRoute } from "astro";
import { readJsonBody } from "@/lib/http/json-body";
import { isRecipeId } from "@/lib/recipes/id";
import { MAX_RECIPE_BODY_BYTES } from "@/lib/recipes/limits";
import { parseRecipeInput } from "@/lib/recipes/validate";
import { createClient } from "@/lib/supabase";
import { deleteRecipe, updateRecipe } from "@/lib/services/recipes";

// For anyone who is neither the author nor an admin, someone else's recipe and a missing one are indistinguishable: both answer 404.
export const PUT: APIRoute = async (context) => {
  const { request } = context;
  // Defence in depth: the middleware already answers signed-out /api/* with 401.
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = context.params.id ?? "";
  if (!isRecipeId(id)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const read = await readJsonBody(request, MAX_RECIPE_BODY_BYTES);
  if (!read.ok) {
    return read.response;
  }

  const parsed = parseRecipeInput(read.body);
  if (!parsed.ok) {
    return Response.json({ error: "invalid_recipe", issues: parsed.issues }, { status: 400 });
  }

  const supabase = createClient(request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const recipe = await updateRecipe(supabase, id, parsed.value);
    if (recipe === null) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({ recipe });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side log, visible in Workers logs
    console.error("updateRecipe failed", error);
    return Response.json({ error: "database_error" }, { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = context.params.id ?? "";
  if (!isRecipeId(id)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    if (!(await deleteRecipe(supabase, id))) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side log, visible in Workers logs
    console.error("deleteRecipe failed", error);
    return Response.json({ error: "database_error" }, { status: 500 });
  }
};
