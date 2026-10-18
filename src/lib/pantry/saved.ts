import { MAX_TAG_LENGTH, MAX_TAGS, countTokens, exceedsMatchUrl } from "@/lib/matching/limits";
import { MAX_SAVED_TOKENS } from "@/lib/pantry/limits";
import type { PantryLists } from "@/types";

/** The lists kept between sessions; "have" stays per session. */
export type SavedPantry = Pick<PantryLists, "staple" | "exclude">;

export const EMPTY_SAVED: SavedPantry = { staple: [], exclude: [] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The length bound is checked before any per-tag work, so a huge array costs one comparison.
function parseTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_TAGS) return null;
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const tag of value) {
    if (typeof tag !== "string") return null;
    const trimmed = tag.trim();
    if (trimmed === "" || trimmed.length > MAX_TAG_LENGTH) return null;
    // Same key as the island's addTag, so a list the user could build is never rejected as a duplicate.
    const key = trimmed.toLocaleLowerCase("pl");
    if (seen.has(key)) return null;
    seen.add(key);
    tags.push(trimmed);
  }
  return tags;
}

/**
 * Untrusted input (request body or database row): anything but valid, bounded lists gives null.
 * Over-limit lists are rejected, not trimmed, so a stricter limit never silently drops saved tags.
 */
export function parseSavedPantry(value: unknown): SavedPantry | null {
  if (!isObject(value)) return null;
  const staple = parseTags(value.staple);
  const exclude = parseTags(value.exclude);
  if (staple === null || exclude === null) return null;
  if (countTokens([...staple, ...exclude]) > MAX_SAVED_TOKENS) return null;
  if (exceedsMatchUrl({ staple, exclude })) return null;
  return { staple, exclude };
}

/** Filters the island starts with: saved staples and exclusions, nothing owned. `null` (failed read) starts empty. */
export function initialFilters(saved: SavedPantry | null): PantryLists {
  return { have: [], staple: saved?.staple ?? [], exclude: saved?.exclude ?? [] };
}
