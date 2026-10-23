import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

// Everything else requires a signed-in user. Keep the trailing slash so e.g. "/authors" stays protected.
const PUBLIC_PREFIXES = ["/auth/", "/api/auth/"];
const SIGNED_IN_REDIRECTS = ["/auth/signin", "/auth/signup"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  // Auth unreachable (network error or 5xx), as opposed to no session or an expired token.
  let authUnavailable = false;
  if (supabase) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
    if (isAuthRetryableFetchError(error)) {
      authUnavailable = true;
      // eslint-disable-next-line no-console -- server-side log, visible in Workers logs
      console.error("Supabase Auth unavailable", error);
    }
  } else {
    context.locals.user = null;
  }

  const { pathname } = context.url;
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (context.locals.user) {
    if (SIGNED_IN_REDIRECTS.includes(normalizedPath)) {
      return context.redirect("/");
    }
    return next();
  }

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return next();
  }

  if (pathname.startsWith("/api/")) {
    // A 401 would tell the island the session expired; the user is not signed out, the check failed.
    if (authUnavailable) {
      return Response.json({ error: "auth_unavailable" }, { status: 503 });
    }
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return context.redirect("/auth/signin");
});
