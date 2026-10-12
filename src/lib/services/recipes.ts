import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recipe, RecipeIngredient, RecipeKind } from "@/types";

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
