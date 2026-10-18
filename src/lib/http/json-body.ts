/** Reads the body as text; returns `null` and stops reading as soon as it exceeds `maxBytes`. */
async function readTextWithLimit(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) {
    return "";
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

/**
 * Reads a JSON request body with a size limit, shared by the write endpoints so they have identical limits and
 * error codes: 415 `unsupported_media_type`, 413 `payload_too_large`, 400 `invalid_json`.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  // The media type only, without parameters: `includes` would let "text/plain; x=application/json" through.
  const mediaType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, response: Response.json({ error: "unsupported_media_type" }, { status: 415 }) };
  }

  // Size is checked before the body is parsed.
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > maxBytes) {
    return { ok: false, response: Response.json({ error: "payload_too_large" }, { status: 413 }) };
  }
  // A chunked request has no Content-Length, so the body is also counted while it is read.
  const text = await readTextWithLimit(request, maxBytes);
  if (text === null) {
    return { ok: false, response: Response.json({ error: "payload_too_large" }, { status: 413 }) };
  }

  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: Response.json({ error: "invalid_json" }, { status: 400 }) };
  }
}
