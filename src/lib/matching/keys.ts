// Match keys: the normalized form of tags and recipe products that the ranking compares.
import { SEPARATE_PRODUCT_KEYS, wordKey, wordKeyReadings } from "@/lib/matching/dictionary";
import { tokenize } from "@/lib/matching/normalize";
import type { MatchKeys, MatchOptionKeys, RecipeIngredient } from "@/types";

/**
 * Version of the keys stored with recipes. Bump it on every change to normalization, the stemmer or the
 * dictionary; rows with another version get their keys recomputed per request.
 */
export const MATCH_KEYS_VERSION = 1;

/** Keys of a pantry tag (owned, staple or excluded). */
export type TagKeys = string[];

/** Typos are tolerated only when both keys have at least this many characters. */
const MIN_FUZZY_LENGTH = 4;

/** Keys are equal when identical, or both ≥ 4 characters and at Damerau–Levenshtein distance ≤ 1. */
export function keysEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < MIN_FUZZY_LENGTH || b.length < MIN_FUZZY_LENGTH) return false;
  return withinOneEdit(a, b);
}

/** Damerau–Levenshtein (optimal string alignment) distance ≤ 1 for two different strings. */
function withinOneEdit(a: string, b: string): boolean {
  const lengthDiff = a.length - b.length;
  if (lengthDiff > 1 || lengthDiff < -1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (lengthDiff === 0) {
    // One substitution, or one transposition of adjacent characters.
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  // One insertion or deletion.
  return lengthDiff > 0 ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

function textToOptionKeys(text: string): MatchOptionKeys {
  return wordsToOptionKeys(tokenize(text).map(wordKey));
}

function wordsToOptionKeys(words: string[]): MatchOptionKeys {
  const keys: string[] = [];
  const parents: string[] = [];
  let i = 0;
  while (i < words.length) {
    const product = SEPARATE_PRODUCT_KEYS.find(
      (entry) =>
        entry.words.length > 0 &&
        i + entry.words.length <= words.length &&
        entry.words.every((word, offset) => keysEqual(word, words[i + offset])),
    );
    if (product) {
      keys.push(product.key);
      parents.push(...product.parents);
      i += product.words.length;
    } else {
      keys.push(words[i]);
      i++;
    }
  }
  const option: MatchOptionKeys = { k: unique(keys) };
  if (parents.length > 0) option.p = unique(parents);
  return option;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Keys of an owned or staple tag; an ambiguous word ("maka") keeps a single reading, the exception (mąka). */
export function normalizeTag(text: string): TagKeys {
  return wordsToOptionKeys(tokenize(text).map((token) => wordKeyReadings(token).at(-1) ?? wordKey(token))).k;
}

/**
 * Keys of an excluded tag: one tag per reading of its ambiguous words ("maka" → mak and mąka), so an exclusion
 * hides too much rather than too little.
 */
export function normalizeExclusion(text: string): TagKeys[] {
  let readings: string[][] = [[]];
  for (const token of tokenize(text)) {
    const keys = wordKeyReadings(token);
    readings = readings.flatMap((words) => keys.map((key) => [...words, key]));
  }
  return readings.map((words) => wordsToOptionKeys(words).k);
}

/** The only way to compute a recipe's keys (sync script, service fallback, future recipe writes). */
export function computeMatchKeys(ingredients: RecipeIngredient[]): MatchKeys {
  return ingredients.map((ingredient) => [
    textToOptionKeys(ingredient.product),
    ...ingredient.substitutes.map((substitute) => textToOptionKeys(substitute.product)),
  ]);
}
