import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialDisclosure } from "@/components/hooks/recipeFormDisclosure";
import {
  emptyRecipeForm,
  recipeToFormState,
  type RecipeFormActions,
  type RecipeFormDisclosureActions,
} from "@/components/hooks/useRecipeForm";
import { RecipeFormView } from "@/components/recipes/RecipeFormView";
import type { Recipe } from "@/types";

// Markup only: what is mounted, labelled and linked. That the focus really moves is checked in a browser.
const NOOP = () => undefined;
const ACTIONS: RecipeFormActions = {
  setName: NOOP,
  setNumber: NOOP,
  toggleKind: NOOP,
  addIngredient: NOOP,
  removeIngredient: NOOP,
  setIngredient: NOOP,
  addSubstitute: NOOP,
  removeSubstitute: NOOP,
  setSubstitute: NOOP,
  addStep: NOOP,
  removeStep: NOOP,
  setStep: NOOP,
};
const DISCLOSURE_ACTIONS: RecipeFormDisclosureActions = {
  toggleIngredient: NOOP,
  toggleSubstitutes: NOOP,
  toggleNutrition: NOOP,
  reveal: NOOP,
};

const RECIPE: Recipe = {
  id: "6f1d2a4e-3b8c-4c57-9a0e-1d2f3a4b5c6d",
  name: "Zupa",
  steps: ["Gotuj."],
  ingredients: [
    { name: "Woda", product: "woda", amount: 1, unit: "l", substitutes: [] },
    { name: "Sól", product: "sól", amount: null, unit: null, substitutes: [] },
  ],
  prepTimeMin: null,
  servings: null,
  kinds: ["na ciepło"],
  kcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

function render(
  options: {
    editing?: boolean;
    fieldErrors?: Record<string, string>;
    cancelHref?: string;
    name?: string;
    savedIllustration?: string | null;
  } = {},
) {
  const base = options.editing ? recipeToFormState(RECIPE) : emptyRecipeForm();
  const form = options.name === undefined ? base : { ...base, name: options.name };
  return renderToStaticMarkup(
    createElement(RecipeFormView, {
      form,
      fieldErrors: options.fieldErrors ?? {},
      status: "idle",
      serverError: null,
      actions: ACTIONS,
      disclosure: initialDisclosure(form, options.editing ?? false),
      disclosureActions: DISCLOSURE_ACTIONS,
      onSubmit: NOOP,
      cancelHref: options.cancelHref ?? "/",
      savedIllustration: options.savedIllustration,
    }),
  );
}

describe("RecipeFormView markup", () => {
  it("keeps collapsed ingredients mounted, so their values and ids stay", () => {
    const html = render({ editing: true });
    expect(html).toContain('id="recipe-ingredients-0-name"');
    expect(html).toContain('id="recipe-ingredients-1-name"');
    expect(html).toContain('value="Sól"');
  });

  it("marks required fields and keeps the kinds as checkboxes", () => {
    const html = render();
    expect(html).toContain('aria-required="true"');
    expect(html).toContain("(wymagane)");
    expect(html.match(/role="checkbox"/g)).toHaveLength(4);
    expect(html).toContain('aria-checked="false"');
  });

  it("leads the close link and Anuluj to the given path", () => {
    const html = render({ cancelHref: `/recipes/${RECIPE.id}` });
    expect(html.match(new RegExp(`href="/recipes/${RECIPE.id}"`, "g"))).toHaveLength(2);
  });

  it("lists the errors in the banner with links to existing field ids", () => {
    const html = render({
      editing: true,
      fieldErrors: { "ingredients.1.name": "Nazwa: pole jest wymagane.", kcal: "Kcal: wpisz liczbę." },
    });
    expect(html).toContain("Popraw 2 pola, żeby zapisać");
    for (const id of ["recipe-ingredients-1-name", "recipe-kcal"]) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
  });

  describe("illustration preview", () => {
    const tiles = (html: string, key: string) => html.split(`src="/illustrations/${key}.svg"`).length - 1;

    it("previews the picked illustration for a new recipe, on phone and in the desktop column", () => {
      const html = render({ name: "Kanapka z serem" });
      expect(tiles(html, "kanapka")).toBe(2);
      expect(html).toContain("Dobrana automatycznie po nazwie.");
    });

    it("previews the pick for an edited recipe whose stored illustration is empty", () => {
      const html = render({ editing: true, name: "Zupa dyniowa", savedIllustration: null });
      expect(tiles(html, "zupa")).toBe(2);
    });

    it("keeps a stored illustration whatever the name says", () => {
      const html = render({ editing: true, name: "Zupa dyniowa", savedIllustration: "talerz" });
      expect(tiles(html, "talerz")).toBe(2);
      expect(tiles(html, "zupa")).toBe(0);
      expect(html).toContain("Ilustracja przepisu zostaje bez zmian.");
    });

    it("shows the placeholder and an explanation when no rule matches", () => {
      const html = render({ name: "Zakwas" });
      expect(html).not.toContain("/illustrations/");
      expect(html).toContain("Brak dopasowania do nazwy, pokażemy ogólną ilustrację.");
      expect(render()).toContain("Wpisz nazwę, a dobierzemy ilustrację.");
    });
  });

  it("shows no banner without errors", () => {
    expect(render()).not.toContain("Popraw");
  });
});
