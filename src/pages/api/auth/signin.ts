import type { APIRoute } from "astro";
import { authErrorRedirect } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const rawEmail = form.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : null;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(authErrorRedirect("/auth/signin", "not_configured", email));
  }
  const { error } = await supabase.auth.signInWithPassword({ email: email ?? "", password });

  if (error) {
    return context.redirect(authErrorRedirect("/auth/signin", error.code ?? "unknown", email));
  }

  return context.redirect("/");
};
