// Tokens of a tag or product; no stemmer here, so the island can import it (src/lib/matching/limits.ts).

/** Conjunctions and prepositions that never carry a product. The word after "bez" stays a token. */
const STOPWORDS = new Set(["z", "ze", "i", "lub", "oraz", "w", "na", "do", "bez"]);

/** Lower case + NFC, split on non-letters; numbers and percentages ("1,5%") vanish with the separators. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((token) => token !== "" && !STOPWORDS.has(token));
}
