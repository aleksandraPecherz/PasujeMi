import { useEffect } from "react";
import { useRecipeForm } from "@/components/hooks/useRecipeForm";
import { RecipeFormView } from "@/components/recipes/RecipeFormView";
import { RecipeSaved } from "@/components/recipes/RecipeSaved";
import type { Recipe } from "@/types";

export default function RecipeForm({ recipe }: { recipe?: Recipe } = {}) {
  const { form, actions, status, fieldErrors, serverError, saved, focusToken, submit, reset } = useRecipeForm({
    recipe,
  });

  // After a failed validation the focus goes to the first invalid field in page order.
  useEffect(() => {
    if (focusToken > 0) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [focusToken]);

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
