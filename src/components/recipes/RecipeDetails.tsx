import type { ReactNode } from "react";
import { ArrowLeft, Clock, Users } from "lucide-react";
import { RecipeIllustration, TONE_CLASS } from "@/components/recipes/RecipeIllustration";
import { Button } from "@/components/ui/button";
import { resolveIllustration } from "@/lib/recipes/illustrations";
import { formatNutrition, formatPrepTime, formatQuantity, formatServings } from "@/lib/recipes/format";
import { cn } from "@/lib/utils";
import type { IngredientOption, Recipe } from "@/types";

const CARD = "bg-card flex flex-col gap-4 rounded-2xl p-4 sm:p-6";
const PILL = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium";

function Quantity({ option, className }: { option: Pick<IngredientOption, "amount" | "unit">; className?: string }) {
  const quantity = formatQuantity(option);
  return quantity ? <span className={cn("whitespace-nowrap", className)}>{quantity}</span> : null;
}

export function RecipeDetails({ recipe, actions }: { recipe: Recipe; actions?: ReactNode }) {
  const prepTime = formatPrepTime(recipe.prepTimeMin);
  const servings = formatServings(recipe.servings);
  const nutrition = formatNutrition(recipe);
  const tone = resolveIllustration(recipe.illustration)?.tone;
  const stripTone = tone ? TONE_CLASS[tone] : "bg-secondary";

  return (
    <article className="relative flex flex-col gap-4">
      {/* Phone: a full-bleed strip in the illustration tone (M11); the back button and the actions sit in its corners. */}
      <div className={cn("-mx-4 -mt-6 flex justify-center pt-6 sm:hidden", stripTone)}>
        <RecipeIllustration illustration={recipe.illustration} className="size-56 rounded-none bg-transparent" />
      </div>

      <div className="absolute -top-6 -right-4 -left-4 z-10 flex items-center justify-between gap-3 p-4 sm:static sm:p-0">
        <Button asChild variant="outline" size="icon" className="rounded-full sm:hidden">
          <a href="/" aria-label="Wróć do listy przepisów">
            <ArrowLeft aria-hidden="true" />
          </a>
        </Button>
        <Button asChild variant="ghost" className="-ml-3 hidden sm:inline-flex">
          <a href="/">
            <ArrowLeft aria-hidden="true" />
            Przepisy
          </a>
        </Button>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <header className="bg-background sm:bg-card -mx-4 -mt-10 flex flex-col gap-3 rounded-t-3xl px-4 pt-6 sm:mx-0 sm:mt-0 sm:flex-row sm:items-center sm:gap-6 sm:rounded-2xl sm:p-6">
        <RecipeIllustration illustration={recipe.illustration} className="hidden size-48 rounded-2xl sm:grid" />
        <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto">
          <h1 className="text-foreground text-xl leading-snug font-extrabold break-words sm:text-4xl sm:leading-tight">
            {recipe.name}
          </h1>
          {(prepTime !== null || servings !== null || recipe.kinds.length > 0) && (
            <ul aria-label="Informacje o przepisie" className="flex flex-wrap gap-2">
              {prepTime !== null && (
                <li className={cn(PILL, "bg-secondary text-secondary-foreground")}>
                  <Clock className="size-4" aria-hidden="true" />
                  {prepTime}
                </li>
              )}
              {servings !== null && (
                <li className={cn(PILL, "bg-secondary text-secondary-foreground")}>
                  <Users className="size-4" aria-hidden="true" />
                  {servings}
                </li>
              )}
              {recipe.kinds.map((kind) => (
                <li key={kind} className={cn(PILL, "bg-hero text-hero-foreground")}>
                  {kind}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {nutrition.length > 0 && (
        <section aria-labelledby="recipe-nutrition-heading" className={CARD}>
          <h2 id="recipe-nutrition-heading" className="text-card-foreground font-bold">
            Wartości odżywcze <span className="text-muted-foreground font-normal">(na porcję)</span>
          </h2>
          <dl className="grid grid-cols-4 gap-2">
            {nutrition.map((item) => (
              <div
                key={item.label}
                className="bg-secondary flex flex-col items-center rounded-xl px-1 py-3 text-center"
              >
                {/* The full name is for screen readers; the tile has room only for the short one. */}
                <dt className="sr-only">{item.label}</dt>
                <dd className="text-secondary-foreground text-lg font-extrabold sm:text-xl">
                  {item.unit === "kcal" ? item.amount : item.value}
                </dd>
                <dd aria-hidden="true" className="text-muted-foreground text-xs">
                  {item.unit === "kcal" ? item.unit : item.shortLabel}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <section aria-labelledby="recipe-ingredients-heading" className={cn(CARD, "md:col-span-2 md:self-start")}>
          <h2 id="recipe-ingredients-heading" className="text-card-foreground text-xl font-extrabold">
            Składniki <span className="text-muted-foreground text-base font-normal">· {recipe.ingredients.length}</span>
          </h2>
          <ul className="flex flex-col">
            {recipe.ingredients.map((ingredient, i) => (
              // Ingredients have no id and may repeat (e.g. salt twice); their order is fixed, so the position is the key.
              <li key={i} className="border-border flex flex-col gap-0.5 border-t py-3 first:border-t-0 first:pt-0">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-card-foreground min-w-0 break-words">{ingredient.name}</span>
                  <Quantity option={ingredient} className="text-card-foreground font-bold" />
                </span>
                {ingredient.substitutes.length > 0 && (
                  <ul aria-label="Zamienniki" className="text-muted-foreground flex flex-col gap-0.5 text-sm">
                    {ingredient.substitutes.map((substitute, j) => (
                      <li key={j} className="break-words">
                        lub {substitute.name} <Quantity option={substitute} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="recipe-steps-heading" className={cn(CARD, "md:col-span-3 md:self-start")}>
          <h2 id="recipe-steps-heading" className="text-card-foreground text-xl font-extrabold">
            Kroki
          </h2>
          <ol className="flex flex-col gap-4">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="bg-hero text-hero-foreground grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold"
                >
                  {i + 1}
                </span>
                <span className="text-card-foreground min-w-0 pt-1 break-words">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}
