// Shared domain types. Recipe shape and conversion rules: docs/reference/recipe-data-contract.md

export interface IngredientOption {
  /** Text as written in the recipe. */
  name: string;
  /** Lower-case generic product used for matching (no brand or product line). */
  product: string;
  amount: number | null;
  unit: string | null;
}

export interface RecipeIngredient extends IngredientOption {
  substitutes: IngredientOption[];
}

export type RecipeKind = "na słodko" | "na wytrawnie" | "na ciepło" | "na zimno";

export interface Recipe {
  id: string;
  name: string;
  steps: string[];
  ingredients: RecipeIngredient[];
  prepTimeMin: number | null;
  servings: number | null;
  kinds: RecipeKind[];
  /** Nutrition values are per single serving. */
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}
