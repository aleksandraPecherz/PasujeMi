// Text normalization for pantry matching: tokens, Snowball stems, diacritics.
import PolishStemmer from "@/lib/matching/vendor/snowball/polish-stemmer.js";

/** Conjunctions and prepositions that never carry a product. The word after "bez" stays a token. */
const STOPWORDS = new Set(["z", "ze", "i", "lub", "oraz", "w", "na", "do", "bez"]);

const stemmer = new PolishStemmer();
// Stems are pure, so they are cached for the lifetime of the isolate.
const stemCache = new Map<string, string>();

/** Lower case + NFC, split on non-letters; numbers and percentages ("1,5%") vanish with the separators. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((token) => token !== "" && !STOPWORDS.has(token));
}

export function stem(word: string): string {
  let result = stemCache.get(word);
  if (result === undefined) {
    result = stemmer.stemWord(word);
    stemCache.set(word, result);
  }
  return result;
}

/** ą→a, ł→l, ó→o, … ("ł" has no Unicode decomposition, so it is mapped by hand). */
export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").normalize("NFC");
}
