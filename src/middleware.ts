import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

// Everything else requires a signed-in user. Keep the trailing slash so e.g. "/authors" stays protected.
const PUBLIC_PREFIXES = ["/auth/", "/api/auth/"];
const SIGNED_IN_REDIRECTS = ["/auth/signin", "/auth/signup"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
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
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return context.redirect("/auth/signin");
});
