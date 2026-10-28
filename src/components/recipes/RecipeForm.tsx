import { useEffect } from "react";
import { useRecipeForm } from "@/components/hooks/useRecipeForm";
import { RecipeFormView } from "@/components/recipes/RecipeFormView";
import { fieldId } from "@/components/recipes/IngredientFields";
import { RecipeSaved } from "@/components/recipes/RecipeSaved";
import type { Recipe } from "@/types";

export default function RecipeForm({ recipe }: { recipe?: Recipe } = {}) {
  const {
    form,
    actions,
    disclosure,
    disclosureActions,
    status,
    fieldErrors,
    serverError,
    saved,
    focus,
    submit,
    reset,
  } = useRecipeForm({
    recipe,
  });

  // After a failed save the focus goes to the first invalid field in page order (or to the field a banner link
  // asked for). By now the section that holds it is open. An error without an input (a list-level one) is scrolled to.
  useEffect(() => {
    if (focus.token === 0) return;
    const input = focus.path === null ? null : document.getElementById(fieldId(focus.path));
    const target = input ?? document.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (target) {
      target.focus();
    } else if (focus.path !== null) {
      document.getElementById(`${fieldId(focus.path)}-error`)?.scrollIntoView({ block: "center" });
    }
  }, [focus]);

  if (status === "saved" && saved) {
    return <RecipeSaved recipe={saved} onAddAnother={reset} />;
  }

  return (
    <RecipeFormView
      form={form}
      fieldErrors={fieldErrors}
      status={status}
      serverError={serverError}
      actions={actions}
      disclosure={disclosure}
      disclosureActions={disclosureActions}
      onSubmit={() => {
        void submit();
      }}
      cancelHref={recipe ? `/recipes/${recipe.id}` : "/"}
      {...(recipe && { title: "Edytuj przepis", submitLabel: "Zapisz zmiany" })}
    />
  );
}
