import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether the user has a row in `public.admins`. RLS shows a user only their own row, so the lookup answers for the
 * signed-in user. The result only drives the UI (which buttons and forms to show); the boundary is the RLS policies
 * on `recipes`. A PostgREST error is thrown as is.
 */
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();

  if (error) {
    throw error;
  }
  return data !== null;
}
