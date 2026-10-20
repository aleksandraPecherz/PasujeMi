import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IngredientMatch, MatchedRecipe, Recipe, RecipeIngredient } from "@/types";

interface RecipeTileProps {
  recipe: Recipe;
  /** Pantry match; without it (list with no filters) the tile shows no % and no ingredient status. */
  match?: MatchedRecipe["match"];
}

const tagBase = "max-w-full justify-start gap-1 py-1 text-left text-xs whitespace-normal";

function IngredientTag({ ingredient, status }: { ingredient: RecipeIngredient; status?: IngredientMatch }) {
  if (!status) {
    return (
      <Badge variant="muted" className={tagBase}>
        {ingredient.name}
      </Badge>
    );
  }

  const have = status.status === "have";
  return (
    <Badge variant={have ? "have" : "muted"} className={tagBase}>
      {have && <Check className="size-3 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 break-words">
        {status.mainExcluded ? (
          <>
            <span className="decoration-muted-foreground line-through">{ingredient.name}</span>
            <span className="sr-only"> (wykluczony)</span>
            {status.via !== null && <> → użyj: {status.via}</>}
          </>
        ) : (
          <>
            {ingredient.name}
            {status.via !== null && <> (zamiennik: {status.via})</>}
          </>
        )}
        <span className="sr-only">{have ? " — mam" : " — brak informacji"}</span>
      </span>
    </Badge>
  );
}

export function RecipeTile({ recipe, match }: RecipeTileProps) {
  const percent = match?.percent ?? null;
  return (
    <article
      className={cn(
        cardVariants({ variant: "brutal" }),
        "hover:border-ring hover:bg-accent relative flex min-w-0 flex-col gap-3 p-4 transition-colors sm:p-5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Stretched link: the pseudo-element covers the whole tile, so the title is the only focusable element. */}
        <h3 className="text-card-foreground min-w-0 font-semibold break-words">
          <a
            href={`/recipes/${recipe.id}`}
            className="after:ring-ring after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2"
          >
            {recipe.name}
          </a>
        </h3>
        {percent !== null && (
          <Badge className="shrink-0 text-sm" aria-label={`Dopasowanie ${percent}%`}>
            {percent}%
          </Badge>
        )}
      </div>
      <ul aria-label="Składniki" className="flex flex-wrap gap-1.5">
        {recipe.ingredients.map((ingredient, i) => (
          // Ingredients have no id and may repeat (e.g. salt twice); their order is fixed, so the position is the key.
          <li key={i} className="max-w-full">
            <IngredientTag ingredient={ingredient} status={match?.ingredients[i]} />
          </li>
        ))}
      </ul>
    </article>
  );
}
