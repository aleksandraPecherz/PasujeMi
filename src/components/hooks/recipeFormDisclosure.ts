import type { RecipeFormState } from "@/components/hooks/useRecipeForm";

/**
 * What is open in the form. Keyed by row `key`, never by index: removing a row shifts the indices
 * (and the positional error paths), so an index would end up pointing at another ingredient.
 * The phone shows one open ingredient; the desktop ignores this and shows all of them.
 */
export interface Disclosure {
  openIngredient: string | null;
  /** Ingredient keys whose substitutes section is open. */
  openSubstitutes: string[];
  nutritionOpen: boolean;
}

type Rows = Pick<RecipeFormState, "ingredients">;
type NutritionValues = Partial<Pick<RecipeFormState, "kcal" | "proteinG" | "carbsG" | "fatG">>;

/**
 * A new recipe opens its first ingredient; an edit starts with all of them collapsed.
 * Nutrition starts open only when it already has values (an edit of a recipe that has them).
 */
export function initialDisclosure(form: Rows & NutritionValues, editing: boolean): Disclosure {
  return {
    openIngredient: editing ? null : (form.ingredients[0]?.key ?? null),
    openSubstitutes: [],
    nutritionOpen: [form.kcal, form.proteinG, form.carbsG, form.fatG].some((value) => (value ?? "").trim() !== ""),
  };
}

/** The added ingredient opens and the previously open one collapses. */
export function openNewIngredient(disclosure: Disclosure, key: string): Disclosure {
  return { ...disclosure, openIngredient: key };
}

export function toggleIngredient(disclosure: Disclosure, key: string): Disclosure {
  return { ...disclosure, openIngredient: disclosure.openIngredient === key ? null : key };
}

export function toggleSubstitutes(disclosure: Disclosure, key: string): Disclosure {
  const open = disclosure.openSubstitutes.includes(key);
  return {
    ...disclosure,
    openSubstitutes: open ? disclosure.openSubstitutes.filter((k) => k !== key) : [...disclosure.openSubstitutes, key],
  };
}

export function toggleNutrition(disclosure: Disclosure): Disclosure {
  return { ...disclosure, nutritionOpen: !disclosure.nutritionOpen };
}

/** Removing the open ingredient leaves none open; removing another one changes nothing (state is by key). */
export function afterIngredientRemoved(disclosure: Disclosure, key: string): Disclosure {
  return {
    ...disclosure,
    openIngredient: disclosure.openIngredient === key ? null : disclosure.openIngredient,
    openSubstitutes: disclosure.openSubstitutes.filter((k) => k !== key),
  };
}

const NUMBER_FIELD_RANK: Record<string, number> = {
  prepTimeMin: 5,
  servings: 6,
  kcal: 7,
  proteinG: 8,
  carbsG: 9,
  fatG: 10,
};
const NUTRITION_FIELDS = ["kcal", "proteinG", "carbsG", "fatG"];
const OPTION_FIELD_RANK: Record<string, number> = { name: 0, product: 1, amount: 2, unit: 3 };
const UNKNOWN_RANK = 99;

const rankOf = (table: Record<string, number>, key: string | undefined) =>
  key !== undefined && key in table ? table[key] : UNKNOWN_RANK;

interface ParsedPath {
  /** Sort key in page order: name, ingredients (each: own fields, substitutes list, substitutes), steps, numbers. */
  order: number[];
  ingredient?: number;
  substitutes?: boolean;
  nutrition?: boolean;
  label: string;
}

/** Validator paths: `name`, `ingredients`, `ingredients.1.name`, `ingredients.1.substitutes.0.unit`, `steps.2`, `kcal`. */
function parsePath(path: string): ParsedPath {
  const parts = path.split(".");
  const index = (value: string | undefined) => (value !== undefined && /^\d+$/.test(value) ? Number(value) : null);
  const [head, second, third, fourth, fifth] = parts;

  if (path === "name") return { order: [0], label: "" };
  if (path === "ingredients") return { order: [1], label: "Składniki" };
  if (path === "steps") return { order: [3], label: "Kroki" };
  if (head === "steps" && parts.length === 2 && index(second) !== null) {
    return { order: [4, index(second) ?? 0], label: `Krok ${(index(second) ?? 0) + 1}` };
  }
  if (path in NUMBER_FIELD_RANK) {
    return { order: [rankOf(NUMBER_FIELD_RANK, path)], nutrition: NUTRITION_FIELDS.includes(path), label: "" };
  }
  if (head === "ingredients" && index(second) !== null) {
    const i = index(second) ?? 0;
    const label = `Składnik ${i + 1}`;
    if (parts.length === 2) return { order: [2, i, 0, -1], ingredient: i, label };
    if (parts.length === 3 && third === "substitutes") {
      return { order: [2, i, 1], ingredient: i, substitutes: true, label: `${label} · Zamienniki` };
    }
    if (parts.length === 3) {
      return { order: [2, i, 0, rankOf(OPTION_FIELD_RANK, third)], ingredient: i, label };
    }
    if (third === "substitutes" && index(fourth) !== null) {
      const m = index(fourth) ?? 0;
      return {
        order: [2, i, 2, m, parts.length === 4 ? -1 : rankOf(OPTION_FIELD_RANK, fifth)],
        ingredient: i,
        substitutes: true,
        label: `${label} · Zamiennik ${m + 1}`,
      };
    }
  }
  return { order: [UNKNOWN_RANK], label: "" };
}

function compareOrder(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? -2) - (b[i] ?? -2);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** The paths of `errors` in the order the fields appear in the form. */
export function orderedErrorPaths(errors: Record<string, string>): string[] {
  return Object.keys(errors).sort((a, b) => compareOrder(parsePath(a).order, parsePath(b).order));
}

export interface ErrorSummaryItem {
  path: string;
  /** Where the error is, e.g. "Składnik 2 · Zamiennik 1"; empty when the message says it all. */
  label: string;
  message: string;
  /** The line for the banner: "Składnik 2 · Nazwa: pole jest wymagane." / "Krok 2: pole jest wymagane." */
  text: string;
}

function summaryText(label: string, message: string): string {
  if (label === "") return message;
  // The step messages start with "Krok:"; the label already says which step.
  if (label.startsWith("Krok ") && message.startsWith("Krok:")) return `${label}${message.slice("Krok".length)}`;
  return `${label} · ${message}`;
}

/** The error list for the banner, in form order. */
export function errorSummary(errors: Record<string, string>): ErrorSummaryItem[] {
  return orderedErrorPaths(errors).map((path) => {
    const { label } = parsePath(path);
    const message = errors[path] ?? "";
    return { path, label, message, text: summaryText(label, message) };
  });
}

/**
 * Opens what the errors need so every invalid field can be seen and focused: the first ingredient with an error
 * (the phone keeps one open), the substitutes section of every ingredient with a substitute error, and the nutrition
 * section when one of its fields is invalid. Errors for rows that do not exist (a stale server answer) are ignored.
 */
export function revealErrors(disclosure: Disclosure, form: Rows, errors: Record<string, string>): Disclosure {
  let openIngredient = disclosure.openIngredient;
  let firstIngredientSeen = false;
  const openSubstitutes = new Set(disclosure.openSubstitutes);
  let nutritionOpen = disclosure.nutritionOpen;

  for (const path of orderedErrorPaths(errors)) {
    const parsed = parsePath(path);
    if (parsed.nutrition) nutritionOpen = true;
    if (parsed.ingredient === undefined) continue;
    const row = form.ingredients.at(parsed.ingredient);
    if (!row) continue;
    if (!firstIngredientSeen) {
      openIngredient = row.key;
      firstIngredientSeen = true;
    }
    if (parsed.substitutes) openSubstitutes.add(row.key);
  }

  return { openIngredient, openSubstitutes: [...openSubstitutes], nutritionOpen };
}
