const RECIPE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Recipe ids are UUIDs; Postgres rejects any other text with an error (22P02) instead of finding no row. */
export function isRecipeId(value: string): boolean {
  return RECIPE_ID.test(value);
}
