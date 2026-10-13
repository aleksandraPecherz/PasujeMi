// Matching dictionary, maintained by the author through PRs. Entries are plain words; they are stemmed on load.
// Every change here changes match keys: bump MATCH_KEYS_VERSION in keys.ts (the fingerprint test enforces it).
import { stem, stripDiacritics, tokenize } from "@/lib/matching/normalize";

/** Synonyms and diminutives: form → canonical form. List each inflected form whose stem differs. */
export const SYNONYMS: readonly (readonly [form: string, canonical: string])[] = [
  ["kartofel", "ziemniak"],
  ["kartofle", "ziemniak"],
  ["ziemniaczki", "ziemniak"],
  ["pomidorek", "pomidor"],
  ["pomidorki", "pomidor"],
];

/** Separate products: the phrase becomes one key; the parent and the phrase's words still count for exclusions, never for owning. */
export const SEPARATE_PRODUCTS: readonly { phrase: string; parent: string }[] = [
  { phrase: "mleko kokosowe", parent: "mleko" },
  { phrase: "mleko owsiane", parent: "mleko" },
  { phrase: "mleko sojowe", parent: "mleko" },
];

/** Words whose stem would merge with another product once diacritics are removed; they keep diacritics. */
export const EXCEPTIONS: readonly string[] = [
  "mąka", // mąk ≠ mak
];

const exceptionStems = new Set(EXCEPTIONS.map(stem));

/** Key of one token without synonyms: stem, then diacritics removed unless the stem is an exception. */
function baseKey(token: string): string {
  const stemmed = stem(token);
  return exceptionStems.has(stemmed) ? stemmed : stripDiacritics(stemmed);
}

const synonymKeys = new Map(SYNONYMS.map(([form, canonical]) => [stem(form), baseKey(canonical)]));

/** Key of one token: stem → dictionary → diacritics removed. */
export function wordKey(token: string): string {
  return synonymKeys.get(stem(token)) ?? baseKey(token);
}

/** Exception stem without diacritics → the exception stem ("mak" → "mąk"). */
const strippedExceptionStems = new Map([...exceptionStems].map((exception) => [stripDiacritics(exception), exception]));

/**
 * Keys a token may stand for. A word whose stem merges with an exception once diacritics are gone ("maka", "maki")
 * may be either product, so it has both keys. The bare stripped stem ("mak") is the other word and stays one key.
 */
export function wordKeyReadings(token: string): string[] {
  const key = wordKey(token);
  const exception = strippedExceptionStems.get(key);
  return exception !== undefined && token !== key ? [key, exception] : [key];
}

export interface SeparateProductKeys {
  /** Word keys of the phrase, matched as a consecutive run of tokens. */
  words: string[];
  /** The single key that replaces the run. */
  key: string;
  parents: string[];
}

export const SEPARATE_PRODUCT_KEYS: readonly SeparateProductKeys[] = SEPARATE_PRODUCTS.map(({ phrase, parent }) => {
  const words = tokenize(phrase).map(wordKey);
  return { words, key: words.join(" "), parents: tokenize(parent).map(wordKey) };
})
  // Longest phrases first, so a longer phrase wins over a shorter one it contains.
  .sort((a, b) => b.words.length - a.words.length);
