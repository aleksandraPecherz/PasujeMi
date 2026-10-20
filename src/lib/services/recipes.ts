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
import { isRecipeId } from "@/lib/recipes/id";
import { MAX_RECOMPUTED_RECIPES } from "@/lib/recipes/limits";
import type { NewRecipe } from "@/lib/recipes/validate";
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

interface RecipeWithAuthorRow extends RecipeRow {
  author_id: string | null;
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
): Promise<{ recipes: Recipe[]; hasMore: boolean; total: number | null }> {
  // Fetch one extra row to know whether another page exists.
  const { data, error, count } = await supabase
    .from("recipes")
    .select(RECIPE_COLUMNS, { count: "exact" })
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit)
    .overrideTypes<RecipeRow[], { merge: false }>();

  // With a count, PostgREST rejects a page that starts past the total (416) instead of returning no rows.
  if (error?.code === "PGRST103") {
    return { recipes: [], hasMore: false, total: null };
  }
  if (error) {
    throw error;
  }

  return {
    recipes: data.slice(0, limit).map(toRecipe),
    hasMore: data.length > limit,
    // `null` when PostgREST sends no count (no Content-Range total), so the client can hide the counter.
    total: count,
  };
}

/**
 * One recipe by id with its author; `null` when it does not exist or `id` is not a valid id (no query is made then).
 * `authorId` is `null` for recipes without an author (the seeded catalog).
 */
export async function getRecipe(
  supabase: SupabaseClient,
  id: string,
): Promise<{ recipe: Recipe; authorId: string | null } | null> {
  if (!isRecipeId(id)) {
    return null;
  }

  const { data, error } = await supabase
    .from("recipes")
    .select(`${RECIPE_COLUMNS}, author_id`)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<RecipeWithAuthorRow, { merge: false }>();

  if (error) {
    throw error;
  }
  return data === null ? null : { recipe: toRecipe(data), authorId: data.author_id };
}

/** The writable columns of a recipe; shared by insert and update. */
function toRecipeValues(recipe: NewRecipe) {
  return {
    name: recipe.name,
    steps: recipe.steps,
    ingredients: recipe.ingredients,
    prep_time_min: recipe.prepTimeMin,
    servings: recipe.servings,
    kinds: recipe.kinds,
    kcal: recipe.kcal,
    protein_g: recipe.proteinG,
    carbs_g: recipe.carbsG,
    fat_g: recipe.fatG,
  };
}

/**
 * Inserts a recipe as `authorId` (RLS requires it to be the session user).
 * `match_keys` stay null: `authenticated` has no grant on them, and `matchRecipes` computes them per request.
 */
export async function createRecipe(supabase: SupabaseClient, authorId: string, recipe: NewRecipe): Promise<Recipe> {
  const { data, error } = await supabase
    .from("recipes")
    .insert({ ...toRecipeValues(recipe), author_id: authorId })
    .select(RECIPE_COLUMNS)
    .single()
    .overrideTypes<RecipeRow, { merge: false }>();

  if (error) {
    throw error;
  }
  return toRecipe(data);
}

/**
 * Replaces the content of a recipe. `null` when `id` is not a valid id (no query is made) or when RLS leaves no row
 * to update (not the author nor an admin, or no such recipe: the two are not told apart). The author stays unchanged. The
 * match keys are cleared by the trigger from migration `20261018120000`, so this does not send them.
 */
export async function updateRecipe(supabase: SupabaseClient, id: string, recipe: NewRecipe): Promise<Recipe | null> {
  if (!isRecipeId(id)) {
    return null;
  }

  const { data, error } = await supabase
    .from("recipes")
    .update(toRecipeValues(recipe))
    .eq("id", id)
    .select(RECIPE_COLUMNS)
    .maybeSingle()
    .overrideTypes<RecipeRow, { merge: false }>();

  if (error) {
    throw error;
  }
  return data === null ? null : toRecipe(data);
}

/** Deletes a recipe; `false` when `id` is not a valid id (no query is made) or when RLS leaves no row to delete. */
export async function deleteRecipe(supabase: SupabaseClient, id: string): Promise<boolean> {
  if (!isRecipeId(id)) {
    return false;
  }

  const { data, error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id)
    .select("id")
    .overrideTypes<{ id: string }[], { merge: false }>();

  if (error) {
    throw error;
  }
  return data.length > 0;
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

// Keys are parallel to the ingredients: one entry per ingredient, the main option plus one per substitute.
function keysFitIngredients(keys: MatchKeys, ingredients: RecipeIngredient[]): boolean {
  return (
    keys.length === ingredients.length &&
    keys.every((options, index) => options.length === ingredients[index].substitutes.length + 1)
  );
}

export async function matchRecipes(
  supabase: SupabaseClient,
  pantry: { have: string[]; staple: string[]; exclude: string[] },
  { limit, offset }: { limit: number; offset: number },
): Promise<{ recipes: MatchedRecipe[]; hasMore: boolean; total: number }> {
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
  //    `in('id', …)` list of 1000 UUIDs would not fit in the URL. At most MAX_RECOMPUTED_RECIPES rows are computed
  //    per request to bound CPU; the rest are left out of the ranking until the script stores their keys.
  const freshKeys = new Map<string, MatchKeys>();
  if (keyRows.some((row) => row.match_keys === null || row.match_keys_version !== MATCH_KEYS_VERSION)) {
    const { data, error } = await supabase
      .from("recipes")
      .select("id, ingredients")
      .or(`match_keys.is.null,match_keys_version.is.null,match_keys_version.neq.${MATCH_KEYS_VERSION}`)
      .order("id", { ascending: true })
      .range(0, MAX_RECOMPUTED_RECIPES - 1)
      .overrideTypes<IngredientsRow[], { merge: false }>();
    if (error) {
      throw error;
    }
    const staleRows = data;
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
  const pantryKeys = {
    have: [...pantry.have, ...pantry.staple].map(normalizeTag),
    exclude: pantry.exclude.flatMap(normalizeExclusion),
  };
  const ranked = rankRecipes(candidates, pantryKeys);
  const page = ranked.slice(offset, offset + limit);
  const hasMore = ranked.length > offset + limit;
  // The ranked count; a recipe dropped in step 4 (deleted, or excluded after recomputing its keys) still counts here.
  const total = ranked.length;
  if (page.length === 0) {
    return { recipes: [], hasMore, total };
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
  const keysById = new Map(candidates.map((candidate) => [candidate.id, candidate.keys]));
  const recipes: MatchedRecipe[] = [];
  for (const { id, match } of page) {
    const row = rowsById.get(id);
    // A recipe deleted between the queries is simply left out.
    if (row === undefined) {
      continue;
    }
    // Stored keys that no longer fit the ingredients (edited without recomputing them) are recomputed for this
    // recipe; if it is now excluded, it is left out.
    const current = keysFitIngredients(keysById.get(id) ?? [], row.ingredients)
      ? match
      : rankRecipes([{ id, name: row.name, keys: computeMatchKeys(row.ingredients) }], pantryKeys).at(0)?.match;
    if (current !== undefined) {
      recipes.push({ ...toRecipe(row), match: resolveMatch(current, row.ingredients) });
    }
  }
  return { recipes, hasMore, total };
}
