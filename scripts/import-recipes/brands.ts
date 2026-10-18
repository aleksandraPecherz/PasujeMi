// Brands and product lines removed from an ingredient's `product` (docs/reference/recipe-data-contract.md,
// "Znane marki"), and a heuristic that flags brands missing from the list in future files.

export const KNOWN_BRANDS = ["Lazur", "Mlekovita", "Ryki", "Go Vege", "Vemondo", "active protein plus"] as const;

/** Capitalised words that are cheese varieties, not brands. */
export const KNOWN_PROPER_NAMES = ["Grana", "Padano", "Feta"] as const;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole words or phrases, any case; spaces in a phrase match any run of whitespace.
const BRANDS_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${KNOWN_BRANDS.map((brand) => escapeRegExp(brand).replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);
const MEASURE_PATTERN = /\d+\s*(?:g|kg|ml|l|szt)\b/iu;

const collapseSpaces = (text: string) => text.replace(/\s+/g, " ").trim();
const removeBrands = (name: string) => collapseSpaces(name.replace(BRANDS_PATTERN, " "));

/** Lower-case `name` without known brands: "ser żółty active protein plus Ryki" -> "ser żółty". */
export function toProduct(name: string): string {
  return removeBrands(name).toLocaleLowerCase("pl");
}

/** Possible unknown brands (a capitalised word after the first, a leftover measure); never blocks the import. */
export function brandWarnings(name: string): string[] {
  const stripped = removeBrands(name);
  const warnings: string[] = [];
  for (const word of stripped.split(" ").slice(1)) {
    const letters = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (/^\p{Lu}/u.test(letters) && !KNOWN_PROPER_NAMES.some((known) => known === letters)) {
      warnings.push(`słowo „${letters}” z wielkiej litery, możliwa marka`);
    }
  }
  const measure = MEASURE_PATTERN.exec(stripped);
  if (measure) warnings.push(`liczba z jednostką „${measure[0]}” w nazwie`);
  return warnings;
}
