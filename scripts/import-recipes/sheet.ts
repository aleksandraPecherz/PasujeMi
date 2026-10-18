// Pure helpers around the spreadsheet and the insert payload. No I/O, so they are testable without the xlsx file.
import { MATCH_KEYS_VERSION, computeMatchKeys } from "@/lib/matching";
import type { NewRecipe } from "@/lib/recipes/validate";
import type { NumericCell } from "./parse";

/** Header row of `data/recipes.xlsx`, in column order (docs/reference/recipe-data-contract.md). */
export const EXPECTED_HEADERS = [
  "Nazwa dania",
  "czas przygotowania (min)",
  "rodzaj",
  "Ilość porcji",
  "PRODUKTY",
  "waga (g)",
  "Kcal",
  "Białko (g)",
  "Węglowodany(g)",
  "Tłuszcze (g)",
  "Jak zrobić?",
] as const;

/** Returns a message for the first header that differs from the contract, or `null` when all match. */
export function checkHeaders(headers: string[]): string | null {
  for (const [i, expected] of EXPECTED_HEADERS.entries()) {
    const actual = (headers.at(i) ?? "").trim();
    if (actual !== expected) {
      return `Kolumna ${i + 1}: oczekiwano „${expected}”, jest „${actual}”.`;
    }
  }
  return null;
}

/**
 * Numeric cell -> number; formula with a numeric result -> the result; empty -> null. Anything else (text "406", a
 * formula error) keeps its text, so the parser reports it instead of silently reading it as empty.
 */
export function readNumericCell(value: unknown, text: string): NumericCell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "formula" in value && "result" in value && typeof value.result === "number") {
    return value.result;
  }
  return text;
}

/** A `recipes` row as PostgREST expects it: snake_case like `createRecipe`, plus author and ready match keys. */
export function toInsertRow(recipe: NewRecipe, authorId: string) {
  return {
    name: recipe.name,
    steps: recipe.steps,
    ingredients: recipe.ingredients,
    prep_time_min: recipe.prepTimeMin,
    servings: recipe.servings,
    kinds: recipe.kinds,
    kcal: recipe.kcal,
    protein_g: recipe.proteinG,
    carbs_g: recipe.carbsG,
    fat_g: recipe.fatG,
    author_id: authorId,
    match_keys: computeMatchKeys(recipe.ingredients),
    match_keys_version: MATCH_KEYS_VERSION,
  };
}
