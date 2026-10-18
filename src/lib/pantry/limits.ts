// Limits of the saved pantry (staples and exclusions), shared by PUT /api/pantry, the database read and the island.

/** Words (countTokens) across saved staples and exclusions together; bounds the work of one saved-lists request. */
export const MAX_SAVED_TOKENS = 60;
/** Request body of PUT /api/pantry; checked before the JSON is parsed. */
export const MAX_PANTRY_BODY_BYTES = 32000;
