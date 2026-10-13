import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  MATCH_KEYS_VERSION,
  computeMatchKeys,
  normalizeExclusion,
  normalizeTag,
  rankRecipes,
  resolveMatch,
  type RankCandidate,
} from "@/lib/matching";
import type { MatchKeys, MatchedRecipe, Recipe, RecipeIngredient, RecipeKind } from "@/types";

const RECIPE_COLUMNS = "id, name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g";

interface RecipeRow {
  id: string;
  name: string;
  steps: string[];
  ingredients: RecipeIngredient[];
  prep_time_min: number | null;
  servings: number | null;
  kinds: RecipeKind[];
  kcal: number | null;
  // Postgres `numeric` arrives from PostgREST as a string.
  protein_g: string | number | null;
  carbs_g: string | number | null;
  fat_g: string | number | null;
}

function toNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    steps: row.steps,
    ingredients: row.ingredients,
    prepTimeMin: row.prep_time_min,
    servings: row.servings,
    kinds: row.kinds,
    kcal: row.kcal,
    proteinG: toNumber(row.protein_g),
    carbsG: toNumber(row.carbs_g),
    fatG: toNumber(row.fat_g),
  };
}

export async function listRecipes(
  supabase: SupabaseClient,
  { limit, offset }: { limit: number; offset: number },
): Promise<{ recipes: Recipe[]; hasMore: boolean }> {
  // Fetch one extra row to know whether another page exists.
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit)
    .overrideTypes<RecipeRow[], { merge: false }>();

  if (error) {
    throw error;
  }

  return {
    recipes: data.slice(0, limit).map(toRecipe),
    hasMore: data.length > limit,
  };
}

/** PostgREST returns at most `max_rows` rows per request (supabase/config.toml), so the catalog is read in pages. */
const PAGE_SIZE = 1000;

interface MatchKeysRow {
  id: string;
  name: string;
  match_keys: MatchKeys | null;
  match_keys_version: number | null;
}

interface IngredientsRow {
  id: string;
  ingredients: RecipeIngredient[];
}

/** Reads every page of an `id`-ordered query until a page comes back shorter than PAGE_SIZE. */
async function fetchAllPages<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: PostgrestError | null }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

export async function matchRecipes(
  supabase: SupabaseClient,
  pantry: { have: string[]; staple: string[]; exclude: string[] },
  { limit, offset }: { limit: number; offset: number },
): Promise<{ recipes: MatchedRecipe[]; hasMore: boolean }> {
  // 1. Stored keys of the whole catalog: ranking by % cannot be paged in SQL.
  const keyRows = await fetchAllPages((from, to) =>
    supabase
      .from("recipes")
      .select("id, name, match_keys, match_keys_version")
      .order("id", { ascending: true })
      .range(from, to)
      .overrideTypes<MatchKeysRow[], { merge: false }>(),
  );

  // 2. Rows without keys or with keys of another version: compute them in memory for this request only
  //    (`authenticated` cannot write; scripts/match-keys.ts persists them). Filtered on the server, because an
  //    `in('id', …)` list of 1000 UUIDs would not fit in the URL.
  const freshKeys = new Map<string, MatchKeys>();
  if (keyRows.some((row) => row.match_keys === null || row.match_keys_version !== MATCH_KEYS_VERSION)) {
    const staleRows = await fetchAllPages((from, to) =>
      supabase
        .from("recipes")
        .select("id, ingredients")
        .or(`match_keys_version.is.null,match_keys_version.neq.${MATCH_KEYS_VERSION}`)
        .order("id", { ascending: true })
        .range(from, to)
        .overrideTypes<IngredientsRow[], { merge: false }>(),
    );
    for (const row of staleRows) {
      freshKeys.set(row.id, computeMatchKeys(row.ingredients));
    }
  }

  const candidates: RankCandidate[] = [];
  for (const row of keyRows) {
    const keys =
      row.match_keys !== null && row.match_keys_version === MATCH_KEYS_VERSION ? row.match_keys : freshKeys.get(row.id);
    // A row that turned current between the two queries (the sync script ran) is skipped for this request rather
    // than ranked with outdated keys, which could miss an exclusion.
    if (keys !== undefined) {
      candidates.push({ id: row.id, name: row.name, keys });
    }
  }

  // 3. Staples count exactly like owned products; one exclusion may expand to several tags ("maka" → mak, mąka).
  const ranked = rankRecipes(candidates, {
    have: [...pantry.have, ...pantry.staple].map(normalizeTag),
    exclude: pantry.exclude.flatMap(normalizeExclusion),
  });
  const page = ranked.slice(offset, offset + limit);
  const hasMore = ranked.length > offset + limit;
  if (page.length === 0) {
    return { recipes: [], hasMore };
  }

  // 4. Full rows of the page only, put back in ranking order (`in` does not keep it).
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .in(
      "id",
      page.map((recipe) => recipe.id),
    )
    .overrideTypes<RecipeRow[], { merge: false }>();

  if (error) {
    throw error;
  }

  const rowsById = new Map(data.map((row) => [row.id, row]));
  const recipes: MatchedRecipe[] = [];
  for (const { id, match } of page) {
    const row = rowsById.get(id);
    // A recipe deleted between the queries is simply left out.
    if (row !== undefined) {
      recipes.push({ ...toRecipe(row), match: resolveMatch(match, row.ingredients) });
    }
  }
  return { recipes, hasMore };
}
