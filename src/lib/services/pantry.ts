import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_SAVED, parseSavedPantry, type SavedPantry } from "@/lib/pantry/saved";

interface SavedPantryRow {
  staples: unknown;
  exclusions: unknown;
}

/**
 * The saved lists of `userId` (RLS lets a user read only their own row).
 * No row yet gives empty lists; a row that fails validation gives `null`, like a failed read, so the island
 * disables saving instead of overwriting tags it could not show.
 */
export async function getSavedPantry(supabase: SupabaseClient, userId: string): Promise<SavedPantry | null> {
  const { data, error } = await supabase
    .from("saved_pantry")
    .select("staples, exclusions")
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<SavedPantryRow, { merge: false }>();

  if (error) {
    throw error;
  }
  if (data === null) {
    return EMPTY_SAVED;
  }

  const saved = parseSavedPantry({ staple: data.staples, exclude: data.exclusions });
  if (saved === null) {
    // eslint-disable-next-line no-console -- server-side log, visible in Workers logs
    console.error("Invalid saved pantry row, ignoring it");
  }
  return saved;
}

/** Replaces the saved lists of `userId` (RLS requires it to be the session user). `pantry` must already be validated. */
export async function saveSavedPantry(supabase: SupabaseClient, userId: string, pantry: SavedPantry): Promise<void> {
  const { error } = await supabase
    .from("saved_pantry")
    .upsert(
      { user_id: userId, staples: pantry.staple, exclusions: pantry.exclude, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) {
    throw error;
  }
}
