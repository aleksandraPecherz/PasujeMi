import type { APIRoute } from "astro";
import { readJsonBody } from "@/lib/http/json-body";
import { createClient } from "@/lib/supabase";
import { MAX_PANTRY_BODY_BYTES } from "@/lib/pantry/limits";
import { parseSavedPantry } from "@/lib/pantry/saved";
import { saveSavedPantry } from "@/lib/services/pantry";

// Replaces the signed-in user's saved staples and exclusions. Signed-out requests are answered by the middleware too.
export const PUT: APIRoute = async (context) => {
  const { request } = context;
  const user = context.locals.user;
  // Defence in depth: the middleware already answers signed-out /api/* with 401.
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const read = await readJsonBody(request, MAX_PANTRY_BODY_BYTES);
  if (!read.ok) {
    return read.response;
  }
  const body = read.body;

  const ownerId = typeof body === "object" && body !== null ? (body as Record<string, unknown>).ownerId : undefined;
  if (typeof ownerId !== "string") {
    return Response.json({ error: "invalid_pantry" }, { status: 400 });
  }
  // The session cookie is shared by all tabs: after signing in as someone else in another tab, an open tab still
  // holds the previous owner's lists. Saving them would overwrite the new account's lists, so refuse.
  if (ownerId !== user.id) {
    return Response.json({ error: "owner_mismatch" }, { status: 409 });
  }

  const pantry = parseSavedPantry(body);
  if (pantry === null) {
    return Response.json({ error: "invalid_pantry" }, { status: 400 });
  }

  const supabase = createClient(request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    await saveSavedPantry(supabase, user.id, pantry);
    return new Response(null, { status: 204 });
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side log, visible in Workers logs
    console.error("saveSavedPantry failed", error);
    return Response.json({ error: "database_error" }, { status: 500 });
  }
};
