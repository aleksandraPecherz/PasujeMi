import type { APIContext, MiddlewareNext } from "astro";
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, type AuthError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

// "@/lib/supabase" imports astro:env/server and "astro:middleware" is virtual; Vitest resolves neither.
vi.mock("@/lib/supabase", () => ({ createClient: () => ({ auth: { getUser } }) }));
vi.mock("astro:middleware", () => ({ defineMiddleware: (handler: unknown) => handler }));

import { onRequest } from "./middleware";

function signedOut(error: AuthError) {
  getUser.mockResolvedValue({ data: { user: null }, error });
}

async function call(path: string): Promise<Response> {
  const url = new URL(path, "http://localhost");
  const context = {
    url,
    request: new Request(url),
    cookies: {},
    locals: {},
    redirect: (to: string) => new Response(null, { status: 302, headers: { Location: to } }),
  } as unknown as APIContext;
  const next: MiddlewareNext = () => Promise.resolve(new Response("next"));
  return (await onRequest(context, next)) as Response;
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  getUser.mockReset();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("middleware when Supabase Auth cannot be reached", () => {
  it.each([
    ["a network error", new AuthRetryableFetchError("fetch failed", 0)],
    ["a 503 from Auth", new AuthRetryableFetchError("Service Unavailable", 503)],
  ])("answers /api/* with 503 and logs %s instead of a 401 'session expired'", async (_, error) => {
    signedOut(error);

    const res = await call("/api/recipes/match?have=jajko");

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "auth_unavailable" });
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error);
  });
});

describe("middleware for a signed-out request", () => {
  it.each([
    ["no session", new AuthSessionMissingError()],
    ["an expired or revoked token", new AuthApiError("invalid JWT", 403, "bad_jwt")],
  ])("answers /api/* with 401 and logs nothing for %s", async (_, error) => {
    signedOut(error);

    const res = await call("/api/recipes/match?have=jajko");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("redirects a page to sign-in", async () => {
    signedOut(new AuthSessionMissingError());

    const res = await call("/");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/auth/signin");
  });
});
