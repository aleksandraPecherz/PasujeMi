import { useEffect, useRef } from "react";
import { CircleCheck } from "lucide-react";
import { RecipeTile } from "@/components/recipes/RecipeTile";
import { Button } from "@/components/ui/button";
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

  return (
    <section
      aria-labelledby="recipe-saved-heading"
      className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-4 sm:p-6"
    >
      <h1
        id="recipe-saved-heading"
        ref={headingRef}
        tabIndex={-1}
        className="flex items-center gap-2 text-xl font-semibold outline-none sm:text-2xl"
      >
        <CircleCheck className="text-primary size-6 shrink-0" aria-hidden="true" />
        Przepis dodany
      </h1>
      <div className="max-w-xl">
        <RecipeTile recipe={recipe} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={onAddAnother}>
          Dodaj kolejny
        </Button>
        <Button asChild variant="outline">
          <a href="/">Przejdź do listy</a>
        </Button>
      </div>
    </section>
  );
}
