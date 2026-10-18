import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNutrition, formatPrepTime, formatQuantity, formatServings } from "@/lib/recipes/format";
import type { IngredientOption, Recipe } from "@/types";

function Quantity({ option }: { option: Pick<IngredientOption, "amount" | "unit"> }) {
  const quantity = formatQuantity(option);
  return quantity ? <span className="text-muted-foreground whitespace-nowrap">{quantity}</span> : null;
}

function BackLink() {
  return (
    <div>
      <Button asChild variant="outline">
        <a href="/">
          <ArrowLeft aria-hidden="true" />
          Wróć do listy
        </a>
      </Button>
    </div>
  );
}

export function RecipeDetails({ recipe }: { recipe: Recipe }) {
  const meta = [formatPrepTime(recipe.prepTimeMin), formatServings(recipe.servings)].filter(
    (item): item is string => item !== null,
  );
  const nutrition = formatNutrition(recipe);

  return (
    <article className="border-border bg-card flex flex-col gap-6 rounded-2xl border p-4 sm:p-6">
      <BackLink />
      <div className="flex flex-col gap-3">
        <h1 className="text-card-foreground text-xl font-semibold break-words sm:text-2xl">{recipe.name}</h1>
        {(meta.length > 0 || recipe.kinds.length > 0) && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
            {recipe.kinds.length > 0 && (
              <ul aria-label="Rodzaje" className="flex flex-wrap gap-1.5">
                {recipe.kinds.map((kind) => (
                  <li key={kind}>
                    <Badge variant="muted">{kind}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {nutrition.length > 0 && (
        <section aria-labelledby="recipe-nutrition-heading" className="flex flex-col gap-2">
          <h2 id="recipe-nutrition-heading" className="text-card-foreground font-semibold">
            Wartości odżywcze <span className="text-muted-foreground text-sm font-normal">(na porcję)</span>
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {nutrition.map((item) => (
              <div key={item.label} className="border-border rounded-xl border p-3">
                <dt className="text-muted-foreground text-xs">{item.label}</dt>
                <dd className="text-card-foreground font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-labelledby="recipe-ingredients-heading" className="flex flex-col gap-2">
        <h2 id="recipe-ingredients-heading" className="text-card-foreground font-semibold">
          Składniki
        </h2>
        <ul className="flex flex-col gap-2">
          {recipe.ingredients.map((ingredient, i) => (
            // Ingredients have no id and may repeat (e.g. salt twice); their order is fixed, so the position is the key.
            <li key={i} className="border-border flex flex-col gap-1 border-b pb-2 last:border-b-0 last:pb-0">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-card-foreground min-w-0 break-words">{ingredient.name}</span>
                <Quantity option={ingredient} />
              </span>
              {ingredient.substitutes.length > 0 && (
                <ul aria-label="Zamienniki" className="text-muted-foreground flex flex-col gap-0.5 text-sm">
                  {ingredient.substitutes.map((substitute, j) => (
                    <li key={j}>
                      lub {substitute.name} <Quantity option={substitute} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recipe-steps-heading" className="flex flex-col gap-2">
        <h2 id="recipe-steps-heading" className="text-card-foreground font-semibold">
          Kroki
        </h2>
        <ol className="marker:text-muted-foreground flex list-decimal flex-col gap-3 pl-5">
          {recipe.steps.map((step, i) => (
            <li key={i} className="text-card-foreground pl-1 break-words">
              {step}
            </li>
          ))}
        </ol>
      </section>

      <BackLink />
    </article>
  );
}
