// Validation and normalisation of a recipe written by a user (S-05 form, POST /api/recipes).
// Rules: docs/reference/recipe-data-contract.md; limits: @/lib/recipes/limits.
import type { IngredientOption, Recipe, RecipeIngredient, RecipeKind } from "@/types";
import {
  MAX_AMOUNT,
  MAX_INGREDIENTS,
  MAX_INGREDIENT_TEXT_LENGTH,
  MAX_KCAL,
  MAX_MACRO_G,
  MAX_PREP_TIME_MIN,
  MAX_RECIPE_NAME_LENGTH,
  MAX_SERVINGS,
  MAX_STEPS,
  MAX_STEP_LENGTH,
  MAX_SUBSTITUTES,
  MAX_UNIT_LENGTH,
} from "@/lib/recipes/limits";

export const RECIPE_KINDS = [
  "na słodko",
  "na wytrawnie",
  "na ciepło",
  "na zimno",
] as const satisfies readonly RecipeKind[];

export type NewRecipe = Omit<Recipe, "id">;

export interface RecipeIssue {
  /** Dotted path, e.g. `name`, `steps.2`, `ingredients.1.substitutes.0.amount`. */
  path: string;
  message: string;
}

export type ParseRecipeResult = { ok: true; value: NewRecipe } | { ok: false; issues: RecipeIssue[] };

/** Default `product` of an ingredient: its name, trimmed and lower-cased. */
export function defaultProduct(name: string): string {
  return name.trim().toLocaleLowerCase("pl");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isMissing = (value: unknown) => value === undefined || value === null;
const isBlank = (value: unknown) => isMissing(value) || (typeof value === "string" && value.trim() === "");

class Collector {
  readonly issues: RecipeIssue[] = [];

  add(path: string, message: string) {
    this.issues.push({ path, message });
  }

  /** Trimmed text; `null` (with an issue) when it is not a string, empty or too long. */
  requiredText(value: unknown, path: string, max: number, label: string): string | null {
    if (typeof value !== "string") {
      this.add(path, `${label}: wpisz tekst.`);
      return null;
    }
    const text = value.trim();
    if (text === "") {
      this.add(path, `${label}: pole jest wymagane.`);
      return null;
    }
    if (text.length > max) {
      this.add(path, `${label}: najwyżej ${max} znaków.`);
      return null;
    }
    return text;
  }

  /** A finite number in [min, max], or `null` when absent or invalid (the latter with an issue). */
  optionalNumber(
    value: unknown,
    path: string,
    label: string,
    min: number,
    max: number,
    integer: boolean,
  ): number | null {
    if (isMissing(value)) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.add(path, `${label}: wpisz liczbę.`);
      return null;
    }
    if (integer && !Number.isInteger(value)) {
      this.add(path, `${label}: wpisz liczbę całkowitą.`);
      return null;
    }
    if (value < min || value > max) {
      this.add(path, `${label}: wartość od ${min} do ${max}.`);
      return null;
    }
    return value;
  }

  array(value: unknown, path: string, label: string, min: number, max: number): unknown[] | null {
    if (!Array.isArray(value)) {
      this.add(path, `${label}: podaj listę.`);
      return null;
    }
    if (value.length < min) {
      this.add(path, `${label}: dodaj co najmniej ${min}.`);
      return null;
    }
    if (value.length > max) {
      this.add(path, `${label}: najwyżej ${max}.`);
      return null;
    }
    return value as unknown[];
  }
}

function parseOption(c: Collector, raw: unknown, path: string): IngredientOption | null {
  if (!isRecord(raw)) {
    c.add(path, "Składnik: niepoprawny format.");
    return null;
  }
  const name = c.requiredText(raw.name, `${path}.name`, MAX_INGREDIENT_TEXT_LENGTH, "Nazwa");

  let product: string | null;
  if (isBlank(raw.product)) product = name === null ? null : defaultProduct(name);
  else product = c.requiredText(raw.product, `${path}.product`, MAX_INGREDIENT_TEXT_LENGTH, "Produkt");

  // Amount and unit are both set or both absent.
  const hasAmount = !isMissing(raw.amount);
  const hasUnit = !isBlank(raw.unit);
  let amount: number | null = null;
  let unit: string | null = null;
  if (hasAmount) {
    amount = c.optionalNumber(raw.amount, `${path}.amount`, "Ilość", 0, MAX_AMOUNT, false);
    if (amount === 0) {
      c.add(`${path}.amount`, "Ilość: wartość większa od 0.");
      amount = null;
    }
    if (!hasUnit) c.add(`${path}.unit`, "Jednostka: podaj jednostkę razem z ilością.");
  }
  if (hasUnit) {
    unit = c.requiredText(raw.unit, `${path}.unit`, MAX_UNIT_LENGTH, "Jednostka");
    if (!hasAmount) c.add(`${path}.amount`, "Ilość: podaj ilość razem z jednostką.");
  }

  if (name === null || product === null) return null;
  return { name, product, amount, unit };
}

function parseIngredient(c: Collector, raw: unknown, path: string): RecipeIngredient | null {
  const option = parseOption(c, raw, path);
  let substitutes: IngredientOption[] = [];
  if (isRecord(raw) && !isMissing(raw.substitutes)) {
    const list = c.array(raw.substitutes, `${path}.substitutes`, "Zamienniki", 0, MAX_SUBSTITUTES);
    if (list) substitutes = list.flatMap((item, i) => parseOption(c, item, `${path}.substitutes.${i}`) ?? []);
  }
  return option === null ? null : { ...option, substitutes };
}

function parseKinds(c: Collector, raw: unknown): RecipeKind[] {
  if (isMissing(raw)) return [];
  if (!Array.isArray(raw)) {
    c.add("kinds", "Rodzaj: podaj listę.");
    return [];
  }
  const kinds = new Set<RecipeKind>();
  raw.forEach((item, i) => {
    const kind = RECIPE_KINDS.find((k) => k === item);
    if (kind) kinds.add(kind);
    else c.add(`kinds.${i}`, "Rodzaj: nieznana wartość.");
  });
  return [...kinds];
}

const roundTenth = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

/** Turns an unknown request body into a `NewRecipe`; copies known fields only (the author comes from the session). */
export function parseRecipeInput(body: unknown): ParseRecipeResult {
  if (!isRecord(body)) return { ok: false, issues: [{ path: "", message: "Przepis ma niepoprawny format." }] };

  const c = new Collector();
  const name = c.requiredText(body.name, "name", MAX_RECIPE_NAME_LENGTH, "Nazwa");

  const stepList = c.array(body.steps, "steps", "Kroki", 1, MAX_STEPS);
  const steps = (stepList ?? []).flatMap((s, i) => c.requiredText(s, `steps.${i}`, MAX_STEP_LENGTH, "Krok") ?? []);

  const ingredientList = c.array(body.ingredients, "ingredients", "Składniki", 1, MAX_INGREDIENTS);
  const ingredients = (ingredientList ?? []).flatMap((item, i) => parseIngredient(c, item, `ingredients.${i}`) ?? []);

  const kinds = parseKinds(c, body.kinds);
  const prepTimeMin = c.optionalNumber(body.prepTimeMin, "prepTimeMin", "Czas", 0, MAX_PREP_TIME_MIN, true);
  const servings = c.optionalNumber(body.servings, "servings", "Porcje", 1, MAX_SERVINGS, true);
  const kcal = c.optionalNumber(body.kcal, "kcal", "Kcal", 0, MAX_KCAL, true);
  const proteinG = roundTenth(c.optionalNumber(body.proteinG, "proteinG", "Białko", 0, MAX_MACRO_G, false));
  const carbsG = roundTenth(c.optionalNumber(body.carbsG, "carbsG", "Węglowodany", 0, MAX_MACRO_G, false));
  const fatG = roundTenth(c.optionalNumber(body.fatG, "fatG", "Tłuszcze", 0, MAX_MACRO_G, false));

  if (c.issues.length > 0 || name === null) return { ok: false, issues: c.issues };
  return { ok: true, value: { name, steps, ingredients, prepTimeMin, servings, kinds, kcal, proteinG, carbsG, fatG } };
}
