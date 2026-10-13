// Text normalization for pantry matching: tokens, Snowball stems, diacritics.
import PolishStemmer from "@/lib/matching/vendor/snowball/polish-stemmer.js";

// Tokenizing lives apart from the stemmer, so the client can count words without bundling it.
export { tokenize } from "@/lib/matching/tokenize";

const stemmer = new PolishStemmer();
// Stems are pure, so they are cached for the lifetime of the isolate.
const stemCache = new Map<string, string>();

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
