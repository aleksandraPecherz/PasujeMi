import {
  MAX_RESTORE_RECIPES,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TOKENS,
  countTokens,
  exceedsMatchUrl,
} from "@/lib/matching/limits";
import type { PantryLists, PantrySection } from "@/types";

export const LIST_STATE_KEY = "pasujemi:list-state";

/** Tags, load depth and scroll of the recipe list; never the recipes themselves. */
export interface ListSnapshot {
  lists: PantryLists;
  applied: PantryLists;
  loaded: number;
  scrollY: number;
}

const SECTIONS: PantrySection[] = ["have", "staple", "exclude"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Over-limit or malformed lists reject the whole snapshot (null) instead of being trimmed: a snapshot the user could not
// have produced was tampered with, and half of it is not worth restoring.
function parseLists(value: unknown): PantryLists | null {
  if (!isObject(value)) return null;
  const lists: PantryLists = { have: [], staple: [], exclude: [] };
  for (const section of SECTIONS) {
    const tags = value[section];
    if (!Array.isArray(tags) || tags.length > MAX_TAGS) return null;
    for (const tag of tags) {
      if (typeof tag !== "string") return null;
      const trimmed = tag.trim();
      if (trimmed === "" || trimmed.length > MAX_TAG_LENGTH) return null;
      lists[section].push(trimmed);
    }
  }
  const all = [...lists.have, ...lists.staple, ...lists.exclude];
  if (countTokens(all) > MAX_TOKENS) return null;
  if (exceedsMatchUrl(lists)) return null;
  return lists;
}

/** Untrusted input (sessionStorage can be corrupted or replaced): anything but a valid, bounded snapshot gives null. */
export function parseSnapshot(raw: string | null): ListSnapshot | null {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data) || typeof data.loaded !== "number" || typeof data.scrollY !== "number") return null;
  const lists = parseLists(data.lists);
  const applied = parseLists(data.applied);
  if (lists === null || applied === null) return null;
  const loaded = Number.isFinite(data.loaded) ? Math.min(MAX_RESTORE_RECIPES, Math.max(0, Math.floor(data.loaded))) : 0;
  const scrollY = Number.isFinite(data.scrollY) ? Math.max(0, data.scrollY) : 0;
  return { lists, applied, loaded, scrollY };
}

export function readSnapshot(): ListSnapshot | null {
  try {
    return parseSnapshot(sessionStorage.getItem(LIST_STATE_KEY));
  } catch {
    // Storage blocked: the list simply starts fresh.
    return null;
  }
}

// Set once sign-out starts: the page is about to be left, and pagehide/visibilitychange must not save the tags again.
let savingStopped = false;

export function writeSnapshot(snapshot: ListSnapshot): void {
  if (savingStopped) return;
  try {
    sessionStorage.setItem(LIST_STATE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage blocked or full: the list just won't be restored.
  }
}

export function clearSnapshot(): void {
  try {
    sessionStorage.removeItem(LIST_STATE_KEY);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}

/** Sign-out: removes the snapshot and blocks every later write from this page. */
export function endListState(): void {
  savingStopped = true;
  clearSnapshot();
}
