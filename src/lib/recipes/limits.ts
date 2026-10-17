// Limits of POST /api/recipes, shared by the endpoint, the validator and the recipe form.

export const MAX_RECIPE_NAME_LENGTH = 120;
export const MAX_INGREDIENTS = 40;
export const MAX_SUBSTITUTES = 5;
/** Applies to the `name` and the `product` of an ingredient or a substitute. */
export const MAX_INGREDIENT_TEXT_LENGTH = 80;
export const MAX_UNIT_LENGTH = 20;
export const MAX_STEPS = 30;
export const MAX_STEP_LENGTH = 1000;
export const MAX_AMOUNT = 100000;
export const MAX_PREP_TIME_MIN = 1440;
export const MAX_SERVINGS = 100;
export const MAX_KCAL = 10000;
export const MAX_MACRO_G = 1000;
/** Request body size checked before parsing; bounds the per-request work (10 ms CPU on Workers Free). */
export const MAX_RECIPE_BODY_BYTES = 100000;
/**
 * Recipes without current match keys that one /api/recipes/match request computes in memory (10 ms CPU on Workers
 * Free). Rows over the cap are left out of the ranking until `npm run match-keys` stores their keys. Provisional:
 * the value is to be checked with a CPU measurement (#19).
 */
export const MAX_RECOMPUTED_RECIPES = 200;
