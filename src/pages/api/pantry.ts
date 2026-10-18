import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { MAX_PANTRY_BODY_BYTES } from "@/lib/pantry/limits";
import { parseSavedPantry } from "@/lib/pantry/saved";
import { readTextWithLimit } from "@/lib/request-body";
import { saveSavedPantry } from "@/lib/services/pantry";

// Replaces the signed-in user's saved staples and exclusions. Signed-out requests are answered by the middleware too.
export const PUT: APIRoute = async (context) => {
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
  if (declaredLength > MAX_PANTRY_BODY_BYTES) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }
  // A chunked request has no Content-Length, so the body is also counted while it is read.
  const text = await readTextWithLimit(request, MAX_PANTRY_BODY_BYTES);
  if (text === null) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

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
