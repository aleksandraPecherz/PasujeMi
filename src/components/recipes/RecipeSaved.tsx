import { useEffect, useRef } from "react";
import { CircleCheck } from "lucide-react";
import { RecipeIllustration } from "@/components/recipes/RecipeIllustration";
import { ingredientCount } from "@/components/recipes/RecipeTile";
import { Button } from "@/components/ui/button";
import { formatPrepTime, formatServings } from "@/lib/recipes/format";
import type { Recipe } from "@/types";

interface RecipeSavedProps {
  recipe: Recipe;
  /** Clears the form for the next recipe. */
  onAddAnother: () => void;
  /** The heading takes the focus when it appears; the kitchen sink turns this off so the page does not scroll. */
  autoFocus?: boolean;
}

export function RecipeSaved({ recipe, onAddAnother, autoFocus = true }: RecipeSavedProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (autoFocus) headingRef.current?.focus();
  }, [autoFocus]);

  // Time and servings only when the recipe has them; the ingredient count is always there.
  const summary = [
    formatPrepTime(recipe.prepTimeMin),
    formatServings(recipe.servings),
    ingredientCount(recipe.ingredients.length),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-labelledby="recipe-saved-heading" className="mx-auto flex max-w-md flex-col gap-5 pt-4 sm:pt-8">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-hero text-primary grid size-18 place-items-center rounded-full">
          <CircleCheck className="size-8" aria-hidden="true" />
        </div>
        <h1
          id="recipe-saved-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-center text-3xl font-extrabold outline-none"
        >
          Przepis dodany
        </h1>
      </div>
      <div className="bg-card flex min-w-0 items-start gap-4 rounded-2xl p-3">
        <RecipeIllustration illustration={recipe.illustration} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
          <p className="text-card-foreground line-clamp-3 text-base leading-snug font-bold break-words">
            {recipe.name}
          </p>
          <p className="text-muted-foreground text-sm">{summary}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Button type="button" size="lg" className="w-full" onClick={onAddAnother}>
          Dodaj kolejny
        </Button>
        <Button asChild variant="secondary" size="lg" className="w-full">
          <a href="/">Przejdź do listy</a>
        </Button>
      </div>
    </section>
  );
}
