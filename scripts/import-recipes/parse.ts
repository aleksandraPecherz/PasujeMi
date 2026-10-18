// Converts one raw Excel row into a `NewRecipe` plus report data (warnings, kcal recalculation). Pure: no I/O.
// Rules: docs/reference/recipe-data-contract.md, "Reguły konwersji z Excela".
import { parseRecipeInput, type NewRecipe, type RecipeIssue } from "@/lib/recipes/validate";
import { brandWarnings, toProduct } from "./brands";

/** A numeric cell: `string` is non-numeric cell content (e.g. text "406"), `null` an empty cell. */
export type NumericCell = number | string | null;

export interface RawRecipeRow {
  /** Row number in the sheet, for the report. */
  rowNumber: number;
  name: string;
  prepTimeMin: NumericCell;
  kinds: string;
  servings: NumericCell;
  products: string;
  kcal: NumericCell;
  proteinG: NumericCell;
  carbsG: NumericCell;
  fatG: NumericCell;
  steps: string;
}

export interface Nutrition {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface KcalRecalculation {
  servings: number;
  before: Nutrition;
  after: Nutrition;
}

export interface RowResult {
  rowNumber: number;
  name: string;
  recipe: NewRecipe | null;
  issues: RecipeIssue[];
  warnings: string[];
  kcalRecalculation: KcalRecalculation | null;
}

export interface ParsedOption {
  name: string;
  product: string;
  amount: number | null;
  unit: string | null;
}

export interface ParsedIngredient extends ParsedOption {
  substitutes: ParsedOption[];
}

// Private-use characters mark a substitutes block cut out of the text before splitting.
const BLOCK_START = "";
const BLOCK_END = "";
const MARKER = new RegExp(`${BLOCK_START}(\\d+)${BLOCK_END}`, "gu");
const SUBSTITUTE_BLOCK = /\[\s*zamienniki?\s*:([^\]]*)\]/giu;
const UNFINISHED_BLOCK = /\[\s*zamienni/iu;

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const PAREN_QUANTITY = new RegExp(String.raw`\(\s*(${NUMBER})\s*(\p{L}+)\s*\)\s*$`, "u");
const DASH_QUANTITY = new RegExp(String.raw`\s[-–—]\s*(${NUMBER})\s*(\p{L}+)\s*$`, "u");
const QUANTITY_END = new RegExp(
  String.raw`(?:\(\s*${NUMBER}\s*\p{L}+\s*\)|\s[-–—]\s*${NUMBER}\s*\p{L}+|${BLOCK_END})$`,
  "u",
);

const collapseSpaces = (text: string) => text.replace(/\s+/g, " ").trim();

/** Trimmed, lower-cased name with collapsed whitespace; the key for duplicate and existing-recipe checks. */
export function normalizeRecipeName(name: string): string {
  return collapseSpaces(name).toLocaleLowerCase("pl");
}

/** Splits off the quantity: last `(number unit)` or a trailing `- N unit` / `– N unit`; other brackets stay in the name. */
export function parseQuantity(text: string): { name: string; amount: number | null; unit: string | null } {
  const trimmed = text.trim();
  const match = PAREN_QUANTITY.exec(trimmed) ?? DASH_QUANTITY.exec(trimmed);
  if (!match) return { name: collapseSpaces(trimmed), amount: null, unit: null };
  return {
    name: collapseSpaces(trimmed.slice(0, match.index)),
    amount: Number(match[1].replace(",", ".")),
    unit: match[2],
  };
}

/**
 * Splits a list of ingredients or substitutes. With a `;` outside brackets it splits on `;` only; otherwise on a `,`
 * that follows a quantity or a cut-out block. A decimal comma ("1,5%") or a comma inside a name never splits.
 */
function splitPieces(text: string): string[] {
  let depth = 0;
  let hasSemicolon = false;
  for (const char of text) {
    if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === ";" && depth === 0) hasSemicolon = true;
  }

  const pieces: string[] = [];
  let current = "";
  depth = 0;
  for (const char of text) {
    if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    const splits = hasSemicolon ? char === ";" : char === "," && QUANTITY_END.test(current.trimEnd());
    if (depth === 0 && splits) {
      pieces.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  pieces.push(current.trim());
  return pieces;
}

function buildOption(text: string, path: string, issues: RecipeIssue[]): ParsedOption | null {
  const { name, amount, unit } = parseQuantity(text);
  if (name === "") {
    issues.push({ path: `${path}.name`, message: "brak nazwy przed ilością" });
    return null;
  }
  const product = toProduct(name);
  if (product === "") {
    // The validator would silently fall back to the branded name.
    issues.push({ path: `${path}.product`, message: "produkt pusty po usunięciu marki" });
    return null;
  }
  return { name, product, amount, unit };
}

/** Parses the text of one `[zamiennik(i): …]` block. Issue paths use `basePath` and the piece index plus `offset`. */
export function splitSubstitutes(
  text: string,
  basePath = "substitutes",
  offset = 0,
): { options: ParsedOption[]; issues: RecipeIssue[] } {
  const options: ParsedOption[] = [];
  const issues: RecipeIssue[] = [];
  splitPieces(text).forEach((piece, i) => {
    const path = `${basePath}.${offset + i}`;
    if (piece === "") {
      issues.push({ path, message: "pusty zamiennik po podziale" });
      return;
    }
    const option = buildOption(piece, path, issues);
    if (option) options.push(option);
  });
  return { options, issues };
}

/** Splits the PRODUKTY cell into ingredients, each with the substitutes of the block that follows it. */
export function splitIngredients(text: string): { ingredients: ParsedIngredient[]; issues: RecipeIssue[] } {
  const ingredients: ParsedIngredient[] = [];
  const issues: RecipeIssue[] = [];
  if (text.trim() === "") return { ingredients, issues };

  // Cut the blocks out first: a `;` inside one must not split the ingredients.
  const blocks: string[] = [];
  const masked = text.replace(SUBSTITUTE_BLOCK, (_match, body: string) => {
    blocks.push(body);
    return `${BLOCK_START}${blocks.length - 1}${BLOCK_END}`;
  });
  if (UNFINISHED_BLOCK.test(masked)) issues.push({ path: "ingredients", message: "niedomknięty blok zamienników" });

  splitPieces(masked).forEach((piece, i) => {
    const path = `ingredients.${i}`;
    const main = collapseSpaces(piece.replace(MARKER, " "));
    const blockBodies = [...piece.matchAll(MARKER)].map((m) => blocks[Number(m[1])]);
    if (main === "") {
      issues.push({ path, message: "pusty składnik po podziale" });
      return;
    }
    const option = buildOption(main, path, issues);
    const substitutes: ParsedOption[] = [];
    let offset = 0;
    for (const body of blockBodies) {
      const result = splitSubstitutes(body, `${path}.substitutes`, offset);
      substitutes.push(...result.options);
      issues.push(...result.issues);
      offset += splitPieces(body).length;
    }
    if (option) ingredients.push({ ...option, substitutes });
  });
  return { ingredients, issues };
}

/** Steps: numbering (`1.`/`1)`) > new line > `;`. Numbering removed, trimmed, capitalised, empty ones skipped. */
export function splitSteps(text: string): string[] {
  const source = text.replace(/\r\n?/g, "\n").trim();
  let parts: string[];
  if (/^\d{1,2}[.)](?!\d)/.test(source)) parts = source.split(/(?:^|\s)\d{1,2}[.)](?!\d)\s*/);
  else if (source.includes("\n")) parts = source.split("\n");
  else parts = source.split(";");
  return parts
    .map((part) => part.replace(/^\d{1,2}[.)](?!\d)\s*/, "").trim())
    .filter((part) => part !== "")
    .map((part) => part.charAt(0).toLocaleUpperCase("pl") + part.slice(1));
}

/** `na słodko ; na zimno` -> ["na słodko", "na zimno"]; unknown values are left to the validator. */
export function parseKinds(text: string): string[] {
  return text
    .split(";")
    .map((kind) => kind.trim().toLocaleLowerCase("pl"))
    .filter((kind) => kind !== "");
}

/** `value / servings` rounded to a whole number (`decimals` 0, kcal) or to 0.1 (`decimals` 1, macros). */
export function perServing(value: number, servings: number, decimals: 0 | 1): number {
  const factor = 10 ** decimals;
  return Math.round((value / servings) * factor) / factor;
}

function numericCell(value: NumericCell, path: string, issues: RecipeIssue[]): number | null {
  if (typeof value === "number") return value;
  if (value === null || value.trim() === "") return null;
  issues.push({ path, message: `nieoczekiwana wartość „${value.trim()}”` });
  return null;
}

// kcal per serving is about 400; a total for several servings lands near 400 x servings.
const TOTAL_RATIO_MIN = 0.75;
const TOTAL_RATIO_MAX = 1.25;
const TYPICAL_KCAL_PER_SERVING = 400;

export function parseRecipeRow(row: RawRecipeRow): RowResult {
  const name = row.name.trim();
  const issues: RecipeIssue[] = [];
  const warnings: string[] = [];

  const prepTimeMin = numericCell(row.prepTimeMin, "prepTimeMin", issues);
  const servings = numericCell(row.servings, "servings", issues);
  const nutrition: Nutrition = {
    kcal: numericCell(row.kcal, "kcal", issues),
    proteinG: numericCell(row.proteinG, "proteinG", issues),
    carbsG: numericCell(row.carbsG, "carbsG", issues),
    fatG: numericCell(row.fatG, "fatG", issues),
  };
  const cellsOk = issues.length === 0;

  const { ingredients, issues: ingredientIssues } = splitIngredients(row.products);
  issues.push(...ingredientIssues);
  ingredients.forEach((ingredient, i) => {
    const labelled = [
      { path: `ingredients.${i}`, text: ingredient.name },
      ...ingredient.substitutes.map((s, j) => ({ path: `ingredients.${i}.substitutes.${j}`, text: s.name })),
    ];
    for (const { path, text } of labelled) {
      for (const warning of brandWarnings(text)) warnings.push(`${path} „${text}”: ${warning}`);
    }
  });

  let kcalRecalculation: KcalRecalculation | null = null;
  let after = nutrition;
  if (cellsOk && servings !== null && servings > 1 && nutrition.kcal !== null) {
    const typical = TYPICAL_KCAL_PER_SERVING * servings;
    if (nutrition.kcal >= TOTAL_RATIO_MIN * typical && nutrition.kcal <= TOTAL_RATIO_MAX * typical) {
      const divide = (value: number | null, decimals: 0 | 1) =>
        value === null ? null : perServing(value, servings, decimals);
      after = {
        kcal: divide(nutrition.kcal, 0),
        proteinG: divide(nutrition.proteinG, 1),
        carbsG: divide(nutrition.carbsG, 1),
        fatG: divide(nutrition.fatG, 1),
      };
      kcalRecalculation = { servings, before: nutrition, after };
    }
  }

  const parsed = parseRecipeInput({
    name,
    steps: splitSteps(row.steps),
    ingredients,
    prepTimeMin,
    servings,
    kinds: parseKinds(row.kinds),
    ...after,
  });
  if (!parsed.ok) issues.push(...parsed.issues);

  return {
    rowNumber: row.rowNumber,
    name,
    recipe: parsed.ok && issues.length === 0 ? parsed.value : null,
    issues,
    warnings,
    kcalRecalculation,
  };
}
