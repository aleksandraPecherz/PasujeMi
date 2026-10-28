import { useEffect } from "react";
import { useRecipeForm } from "@/components/hooks/useRecipeForm";
import { RecipeFormView } from "@/components/recipes/RecipeFormView";
import { fieldId } from "@/components/recipes/IngredientFields";
import { RecipeSaved } from "@/components/recipes/RecipeSaved";
import type { Recipe } from "@/types";

export default function RecipeForm({ recipe }: { recipe?: Recipe } = {}) {
  const { form, actions, status, fieldErrors, serverError, saved, focus, submit, reset } = useRecipeForm({
    recipe,
  });

  // After a failed save the focus goes to the first invalid field in page order (or to the field a banner link asked for).
  useEffect(() => {
    if (focus.token > 0) {
      const target = focus.path === null ? null : document.getElementById(fieldId(focus.path));
      (target ?? document.querySelector<HTMLElement>('[aria-invalid="true"]'))?.focus();
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
      onSubmit={() => {
        void submit();
      }}
      {...(recipe && { title: "Edytuj przepis", submitLabel: "Zapisz zmiany", cancelHref: `/recipes/${recipe.id}` })}
    />
  );
}
