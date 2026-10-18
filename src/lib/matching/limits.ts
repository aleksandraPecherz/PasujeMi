// Limits of GET /api/recipes/match, shared by the endpoint and the pantry island.
import { tokenize } from "@/lib/matching/tokenize";

export const MAX_TAG_LENGTH = 60;
export const MAX_TAGS = 30;
/** Words across all three lists; bounds the per-request matching work (10 ms CPU on Workers Free). */
export const MAX_TOKENS = 100;
/** Request URL length checked by the island, well under Cloudflare's 16 KB URL limit. */
export const MAX_URL_LENGTH = 8000;

export function countTokens(tags: string[]): number {
  return tags.reduce((count, tag) => count + tokenize(tag).length, 0);
}

/** Recipes restored from a list snapshot after returning from a recipe page; bounds the restore work per page view. */
export const MAX_RESTORE_RECIPES = 100;
