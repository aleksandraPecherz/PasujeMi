// Limits of GET /api/recipes/match, shared by the endpoint and the pantry island.
import { tokenize } from "@/lib/matching/tokenize";
import type { PantryLists, PantrySection } from "@/types";

export const MAX_TAG_LENGTH = 60;
export const MAX_TAGS = 30;
/** Words across all three lists; bounds the per-request matching work (10 ms CPU on Workers Free). */
export const MAX_TOKENS = 100;
/** Request URL length checked by the island, well under Cloudflare's 16 KB URL limit. */
export const MAX_URL_LENGTH = 8000;

export function countTokens(tags: string[]): number {
  return tags.reduce((count, tag) => count + tokenize(tag).length, 0);
}

const URL_SECTIONS: PantrySection[] = ["have", "staple", "exclude"];
// Worst-case prefix of the match request (path plus two numeric params), so the URL check stays in step with the island.
const URL_PREFIX = "/api/recipes/match?limit=50&offset=100&";

/** True when a match request carrying these lists would pass MAX_URL_LENGTH; sections that are missing count as empty. */
export function exceedsMatchUrl(lists: Partial<PantryLists>): boolean {
  const params = new URLSearchParams();
  for (const section of URL_SECTIONS) {
    for (const tag of lists[section] ?? []) params.append(section, tag);
  }
  return URL_PREFIX.length + params.toString().length > MAX_URL_LENGTH;
}

/** Recipes restored from a list snapshot after returning from a recipe page; bounds the restore work per page view. */
export const MAX_RESTORE_RECIPES = 100;
