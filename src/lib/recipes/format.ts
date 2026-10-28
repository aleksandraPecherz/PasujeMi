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
  /** Lower-case label short enough for a narrow tile ("węglow."). */
  shortLabel: string;
  /** Number as written in Polish ("12,5"), without the unit. */
  amount: string;
  unit: "kcal" | "g";
  /** Number with its unit ("12,5 g"). */
  value: string;
}

function nutritionItem(label: string, shortLabel: string, number: number, unit: NutritionItem["unit"]): NutritionItem {
  const amount = formatNumber(number);
  return { label, shortLabel, amount, unit, value: `${amount} ${unit}` };
}

/** Nutrition per single serving; values the recipe does not have are left out. */
export function formatNutrition(recipe: Pick<Recipe, "kcal" | "proteinG" | "carbsG" | "fatG">): NutritionItem[] {
  const items: NutritionItem[] = [];
  if (recipe.kcal !== null) items.push(nutritionItem("Kalorie", "kcal", recipe.kcal, "kcal"));
  if (recipe.proteinG !== null) items.push(nutritionItem("Białko", "białko", recipe.proteinG, "g"));
  if (recipe.carbsG !== null) items.push(nutritionItem("Węglowodany", "węglow.", recipe.carbsG, "g"));
  if (recipe.fatG !== null) items.push(nutritionItem("Tłuszcz", "tłuszcze", recipe.fatG, "g"));
  return items;
}
