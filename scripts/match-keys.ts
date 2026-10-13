// Fills recipes.match_keys for rows whose match_keys_version is null or differs from MATCH_KEYS_VERSION.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run match-keys
// The service role key bypasses RLS: it is read from the shell only and never goes to astro:env, .dev.vars or the
// Worker (AGENTS.md Hard Rules). Idempotent: a second run prints "updated 0".
import { createClient } from "@supabase/supabase-js";
import { MATCH_KEYS_VERSION, computeMatchKeys } from "@/lib/matching";
import type { RecipeIngredient } from "@/types";

const PAGE_SIZE = 1000;

interface IngredientsRow {
  id: string;
  ingredients: RecipeIngredient[];
}

async function main(): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let updated = 0;
  // Keyset paging by id: updated rows leave the filter, so offsets would skip rows.
  let lastId: string | null = null;
  for (;;) {
    let query = supabase
      .from("recipes")
      .select("id, ingredients")
      .or(`match_keys.is.null,match_keys_version.is.null,match_keys_version.neq.${MATCH_KEYS_VERSION}`)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (lastId !== null) {
      query = query.gt("id", lastId);
    }
    const { data, error } = await query.overrideTypes<IngredientsRow[], { merge: false }>();
    if (error) {
      throw error;
    }

    for (const row of data) {
      const { error: updateError } = await supabase
        .from("recipes")
        .update({ match_keys: computeMatchKeys(row.ingredients), match_keys_version: MATCH_KEYS_VERSION })
        .eq("id", row.id);
      if (updateError) {
        throw updateError;
      }
      updated++;
    }

    if (data.length < PAGE_SIZE) {
      return updated;
    }
    lastId = data[data.length - 1].id;
  }
}

try {
  console.log(`updated ${await main()}`);
} catch (error) {
  console.error("match-keys failed", error);
  process.exit(1);
}
