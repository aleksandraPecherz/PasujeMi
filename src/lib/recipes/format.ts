import type { IngredientOption, Recipe } from "@/types";

/** Polish decimal comma, at most two decimals ("0,5", "1,25", "2"). */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(2))).replace(".", ",");
}

/** Amount and unit of an ingredient option, e.g. "100 g"; `null` parts are left out, nothing at all gives "". */
export function formatQuantity({ amount, unit }: Pick<IngredientOption, "amount" | "unit">): string {
  const parts: string[] = [];
  if (amount !== null) parts.push(formatNumber(amount));
  const trimmedUnit = unit?.trim();
  if (trimmedUnit) parts.push(trimmedUnit);
  return parts.join(" ");
}

/** "45 min", "1 godz.", "1 godz. 30 min"; `null` when there is no time. */
export function formatPrepTime(minutes: Recipe["prepTimeMin"]): string | null {
  if (minutes === null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours > 0 ? `${hours} godz.` : null, rest > 0 ? `${rest} min` : null].filter(Boolean).join(" ");
}

/** "1 porcja", "2 porcje", "5 porcji"; `null` when there are no servings. */
export function formatServings(servings: Recipe["servings"]): string | null {
  if (servings === null || servings <= 0) return null;
  const lastDigit = servings % 10;
  const lastTwo = servings % 100;
  if (servings === 1) return "1 porcja";
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${servings} porcje`;
  return `${servings} porcji`;
}

export interface NutritionItem {
  label: string;
  value: string;
}

/** Nutrition per single serving; values the recipe does not have are left out. */
export function formatNutrition(recipe: Pick<Recipe, "kcal" | "proteinG" | "carbsG" | "fatG">): NutritionItem[] {
  const items: NutritionItem[] = [];
  if (recipe.kcal !== null) items.push({ label: "Kalorie", value: `${formatNumber(recipe.kcal)} kcal` });
  if (recipe.proteinG !== null) items.push({ label: "Białko", value: `${formatNumber(recipe.proteinG)} g` });
  if (recipe.carbsG !== null) items.push({ label: "Węglowodany", value: `${formatNumber(recipe.carbsG)} g` });
  if (recipe.fatG !== null) items.push({ label: "Tłuszcz", value: `${formatNumber(recipe.fatG)} g` });
  return items;
}
