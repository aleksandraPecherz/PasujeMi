import { useState } from "react";
import { MAX_INGREDIENTS, MAX_STEPS, MAX_SUBSTITUTES } from "@/lib/recipes/limits";
import { defaultProduct, parseRecipeInput, type RecipeIssue } from "@/lib/recipes/validate";
import type { Recipe, RecipeKind } from "@/types";

/** One ingredient or substitute as typed in the form; numbers stay text until the form is sent. */
export interface OptionRow {
  /** Stable React key; rows are added and removed in the middle of the list. */
  key: string;
  name: string;
  product: string;
  /** Set once the user edits `product`; until then it follows the name (`defaultProduct`). */
  productEdited: boolean;
  amount: string;
  unit: string;
}

export interface IngredientRow extends OptionRow {
  substitutes: OptionRow[];
}

export interface StepRow {
  key: string;
  text: string;
}

export type NumberField = "prepTimeMin" | "servings" | "kcal" | "proteinG" | "carbsG" | "fatG";
export type OptionField = "name" | "product" | "amount" | "unit";

export interface RecipeFormState extends Record<NumberField, string> {
  name: string;
  ingredients: IngredientRow[];
  steps: StepRow[];
  kinds: RecipeKind[];
}

export type RecipeFormStatus = "idle" | "submitting" | "saved" | "error";

export interface RecipeFormActions {
  setName: (value: string) => void;
  setNumber: (field: NumberField, value: string) => void;
  toggleKind: (kind: RecipeKind, checked: boolean) => void;
  addIngredient: () => void;
  removeIngredient: (index: number) => void;
  setIngredient: (index: number, field: OptionField, value: string) => void;
  addSubstitute: (index: number) => void;
  removeSubstitute: (index: number, substituteIndex: number) => void;
  setSubstitute: (index: number, substituteIndex: number, field: OptionField, value: string) => void;
  addStep: () => void;
  removeStep: (index: number) => void;
  setStep: (index: number, text: string) => void;
}

const SESSION_EXPIRED = "Sesja wygasła. Zaloguj się ponownie.";
const SAVE_FAILED = "Nie udało się zapisać przepisu. Spróbuj ponownie.";
const NO_CONNECTION = "Brak połączenia z serwerem. Spróbuj ponownie.";

let keyCounter = 0;
const nextKey = () => String(++keyCounter);

function emptyOption(): OptionRow {
  return { key: nextKey(), name: "", product: "", productEdited: false, amount: "", unit: "" };
}

function emptyIngredient(): IngredientRow {
  return { ...emptyOption(), substitutes: [] };
}

export function emptyRecipeForm(): RecipeFormState {
  return {
    name: "",
    ingredients: [emptyIngredient()],
    steps: [{ key: nextKey(), text: "" }],
    kinds: [],
    prepTimeMin: "",
    servings: "",
    kcal: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
  };
}

/** Empty text is `null`; a comma is a decimal separator; text that is not a number stays text for the validator to reject. */
function toNumberOrText(value: string): number | string | null {
  const text = value.trim();
  if (text === "") return null;
  const number = Number(text.replace(",", "."));
  return Number.isNaN(number) ? text : number;
}

function optionBody(row: OptionRow) {
  return {
    name: row.name,
    product: row.product,
    amount: toNumberOrText(row.amount),
    unit: row.unit.trim() === "" ? null : row.unit,
  };
}

/** The request body; its paths match the rows one to one, so validator issues map back to fields. */
function toBody(form: RecipeFormState) {
  return {
    name: form.name,
    steps: form.steps.map((step) => step.text),
    ingredients: form.ingredients.map((row) => ({ ...optionBody(row), substitutes: row.substitutes.map(optionBody) })),
    kinds: form.kinds,
    prepTimeMin: toNumberOrText(form.prepTimeMin),
    servings: toNumberOrText(form.servings),
    kcal: toNumberOrText(form.kcal),
    proteinG: toNumberOrText(form.proteinG),
    carbsG: toNumberOrText(form.carbsG),
    fatG: toNumberOrText(form.fatG),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecipe(value: unknown): value is Recipe {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.steps) &&
    Array.isArray(value.ingredients)
  );
}

function isIssue(value: unknown): value is RecipeIssue {
  return isObject(value) && typeof value.path === "string" && typeof value.message === "string";
}

/** The first message per path. */
function toFieldErrors(issues: RecipeIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { path, message } of issues) {
    errors[path] ??= message;
  }
  return errors;
}

type SendResult =
  { ok: true; recipe: Recipe } | { ok: false; serverError: string | null; fieldErrors: Record<string, string> };

// Status first, then body shape (context/foundation/lessons.md).
async function sendRecipe(body: unknown): Promise<SendResult> {
  const failed = (serverError: string): SendResult => ({ ok: false, serverError, fieldErrors: {} });
  try {
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return failed(SESSION_EXPIRED);
    const data: unknown = await res.json().catch(() => null);
    if (res.status === 400 && isObject(data) && data.error === "invalid_recipe" && Array.isArray(data.issues)) {
      const fieldErrors = toFieldErrors(data.issues.filter(isIssue));
      return Object.keys(fieldErrors).length > 0 ? { ok: false, serverError: null, fieldErrors } : failed(SAVE_FAILED);
    }
    if (res.status === 201 && isObject(data) && isRecipe(data.recipe)) {
      return { ok: true, recipe: data.recipe };
    }
    return failed(SAVE_FAILED);
  } catch {
    return failed(NO_CONNECTION);
  }
}

function replaceAt<T>(list: T[], index: number, update: (item: T) => T): T[] {
  return list.map((item, i) => (i === index ? update(item) : item));
}

function withOptionField(row: OptionRow, field: OptionField, value: string): OptionRow {
  if (field === "name") {
    return { ...row, name: value, product: row.productEdited ? row.product : defaultProduct(value) };
  }
  if (field === "product") {
    return { ...row, product: value, productEdited: value !== "" };
  }
  return { ...row, [field]: value };
}

export function useRecipeForm() {
  const [form, setForm] = useState<RecipeFormState>(emptyRecipeForm);
  const [status, setStatus] = useState<RecipeFormStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Recipe | null>(null);
  // Bumped after each failed validation, so the view can move the focus to the first invalid field.
  const [focusToken, setFocusToken] = useState(0);

  /** Applies an edit and drops the error of the field it touched. */
  function edit(path: string | null, update: (prev: RecipeFormState) => RecipeFormState) {
    setForm(update);
    if (path !== null) {
      setFieldErrors((prev) => {
        if (!(path in prev)) return prev;
        const { [path]: _removed, ...rest } = prev;
        return rest;
      });
    }
  }

  const actions: RecipeFormActions = {
    setName: (value) => {
      edit("name", (prev) => ({ ...prev, name: value }));
    },
    setNumber: (field, value) => {
      edit(field, (prev) => ({ ...prev, [field]: value }));
    },
    toggleKind: (kind, checked) => {
      edit(null, (prev) => ({
        ...prev,
        kinds: checked ? [...prev.kinds.filter((k) => k !== kind), kind] : prev.kinds.filter((k) => k !== kind),
      }));
    },
    addIngredient: () => {
      edit(null, (prev) =>
        prev.ingredients.length >= MAX_INGREDIENTS
          ? prev
          : { ...prev, ingredients: [...prev.ingredients, emptyIngredient()] },
      );
    },
    removeIngredient: (index) => {
      // Error paths refer to positions, so the old ones would point at other rows.
      setFieldErrors({});
      edit(null, (prev) =>
        prev.ingredients.length <= 1 ? prev : { ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) },
      );
    },
    setIngredient: (index, field, value) => {
      edit(`ingredients.${index}.${field}`, (prev) => ({
        ...prev,
        ingredients: replaceAt(prev.ingredients, index, (row) => ({ ...row, ...withOptionField(row, field, value) })),
      }));
    },
    addSubstitute: (index) => {
      edit(null, (prev) => ({
        ...prev,
        ingredients: replaceAt(prev.ingredients, index, (row) =>
          row.substitutes.length >= MAX_SUBSTITUTES
            ? row
            : { ...row, substitutes: [...row.substitutes, emptyOption()] },
        ),
      }));
    },
    removeSubstitute: (index, substituteIndex) => {
      setFieldErrors({});
      edit(null, (prev) => ({
        ...prev,
        ingredients: replaceAt(prev.ingredients, index, (row) => ({
          ...row,
          substitutes: row.substitutes.filter((_, i) => i !== substituteIndex),
        })),
      }));
    },
    setSubstitute: (index, substituteIndex, field, value) => {
      edit(`ingredients.${index}.substitutes.${substituteIndex}.${field}`, (prev) => ({
        ...prev,
        ingredients: replaceAt(prev.ingredients, index, (row) => ({
          ...row,
          substitutes: replaceAt(row.substitutes, substituteIndex, (sub) => withOptionField(sub, field, value)),
        })),
      }));
    },
    addStep: () => {
      edit(null, (prev) =>
        prev.steps.length >= MAX_STEPS ? prev : { ...prev, steps: [...prev.steps, { key: nextKey(), text: "" }] },
      );
    },
    removeStep: (index) => {
      setFieldErrors({});
      edit(null, (prev) =>
        prev.steps.length <= 1 ? prev : { ...prev, steps: prev.steps.filter((_, i) => i !== index) },
      );
    },
    setStep: (index, text) => {
      edit(`steps.${index}`, (prev) => ({
        ...prev,
        steps: replaceAt(prev.steps, index, (step) => ({ ...step, text })),
      }));
    },
  };

  function fail(errors: Record<string, string>, message: string | null) {
    setFieldErrors(errors);
    setServerError(message);
    setStatus("error");
    setFocusToken((token) => token + 1);
  }

  async function submit() {
    if (status === "submitting") return;
    setServerError(null);

    const body = toBody(form);
    const parsed = parseRecipeInput(body);
    if (!parsed.ok) {
      fail(toFieldErrors(parsed.issues), null);
      return;
    }

    setFieldErrors({});
    setStatus("submitting");
    const result = await sendRecipe(parsed.value);
    if (result.ok) {
      setSaved(result.recipe);
      setStatus("saved");
      return;
    }
    fail(result.fieldErrors, result.serverError);
  }

  function reset() {
    setForm(emptyRecipeForm());
    setFieldErrors({});
    setServerError(null);
    setSaved(null);
    setStatus("idle");
  }

  return { form, actions, status, fieldErrors, serverError, saved, focusToken, submit, reset };
}
