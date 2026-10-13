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

// Pantry matching (S-03). Rule: context/changes/first-pantry-match/plan.md, "Reguła dopasowania".

/** Match keys of one ingredient option (main product or a substitute). */
export interface MatchOptionKeys {
  /** Keys of the option's `product`; a separate product (e.g. "mleko kokosowe") is one key. */
  k: string[];
  /** Parent keys of separate products in `k` (e.g. "mleko"); only exclusions use them. */
  p?: string[];
}

/** Parallel to `Recipe.ingredients`: per ingredient, the main option first, then its substitutes. */
export type MatchKeys = MatchOptionKeys[][];

export interface IngredientMatch {
  status: "have" | "unknown";
  /** The main option is excluded; the ingredient stays visible only through a substitute. */
  mainExcluded: boolean;
  /** `product` of the substitute that gave "have", or (main excluded, nothing owned) the first allowed substitute. */
  via: string | null;
}

export interface RecipeMatch {
  /** Rounded percentage of available ingredients; null when no owned or staple tags were given. */
  percent: number | null;
  ingredients: IngredientMatch[];
}

export type MatchedRecipe = Recipe & { match: RecipeMatch };
