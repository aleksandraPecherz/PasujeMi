import { Check } from "lucide-react";
import { RecipeIllustration } from "@/components/recipes/RecipeIllustration";
import { Badge } from "@/components/ui/badge";
import { cardVariants } from "@/components/ui/card";
import { formatPrepTime, formatServings } from "@/lib/recipes/format";
import { cn } from "@/lib/utils";
import type { MatchedRecipe, Recipe } from "@/types";

interface RecipeTileProps {
  recipe: Recipe;
  /** Pantry match; without it (list with no filters) the tile shows no % and no ingredient status. */
  match?: MatchedRecipe["match"];
}

interface Substitute {
  name: string;
  via: string;
}

/** One entry of "Brakuje:"; an excluded main product that is still missing is replaced by its allowed substitute. */
type Missing =
  | { kind: "plain"; name: string }
  | { kind: "excluded"; name: string }
  | { kind: "replaced"; name: string; via: string };

/** "1 składnik", "2 składniki", "5 składników". */
function ingredientCount(count: number): string {
  if (count === 1) return "1 składnik";
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)
    ? `${count} składniki`
    : `${count} składników`;
}

/** What the tile says about the match. Statuses are the matcher's: this only groups them, it never re-decides one. */
function summarize(recipe: Recipe, match: NonNullable<RecipeTileProps["match"]>) {
  let have = 0;
  const substitutes: Substitute[] = [];
  const missing: Missing[] = [];
  recipe.ingredients.forEach((ingredient, i) => {
    const status = match.ingredients[i];
    if (status.status === "have") {
      have += 1;
      // Owned through a substitute: it counts as "mam", and the tile says which substitute to use.
      if (status.via !== null) substitutes.push({ name: ingredient.name, via: status.via });
    } else if (status.mainExcluded) {
      missing.push(
        status.via !== null
          ? { kind: "replaced", name: ingredient.name, via: status.via }
          : { kind: "excluded", name: ingredient.name },
      );
    } else {
      missing.push({ kind: "plain", name: ingredient.name });
    }
  });
  return { have, substitutes, missing };
}

function MissingEntry({ item }: { item: Missing }) {
  if (item.kind === "replaced") {
    return (
      <>
        użyj: {item.via} <span className="text-muted-foreground font-normal">(zamiast {item.name})</span>
      </>
    );
  }
  if (item.kind === "excluded") {
    return (
      <>
        <span className="decoration-muted-foreground line-through">{item.name}</span>
        <span className="sr-only"> (wykluczony)</span>
      </>
    );
  }
  return <>{item.name}</>;
}

/** Up to 3 missing entries (2 below 360 px) and "+N" for the rest; the full list is on the recipe page. */
function MissingLine({ items }: { items: Missing[] }) {
  const shown = items.slice(0, 3);
  const extraWide = items.length - 3;
  const extraNarrow = items.length - 2;
  return (
    <p className="text-muted-foreground text-sm">
      Brakuje:{" "}
      <span className="text-foreground font-bold">
        {shown.map((item, i) => (
          <span key={i} className={i === 2 ? "xs:inline hidden" : undefined}>
            {i > 0 && ", "}
            <MissingEntry item={item} />
          </span>
        ))}
      </span>
      {/* A no-break space ties "+N" to the last word, so it never sits alone on the next row. */}
      {extraWide > 0 && <span className="max-xs:hidden">&nbsp;+{extraWide}</span>}
      {extraNarrow > 0 && <span className="xs:hidden">&nbsp;+{extraNarrow}</span>}
    </p>
  );
}

function SubstituteLine({ items }: { items: Substitute[] }) {
  const shown = items.slice(0, 2);
  return (
    <p className="text-muted-foreground text-sm">
      Zamiennik:{" "}
      <span className="text-foreground font-bold">{shown.map((s) => `${s.via} (zamiast ${s.name})`).join(", ")}</span>
      {items.length > shown.length && <>&nbsp;+{items.length - shown.length}</>}
    </p>
  );
}

export function RecipeTile({ recipe, match }: RecipeTileProps) {
  const percent = match?.percent ?? null;
  const total = recipe.ingredients.length;
  // Without owned or staple tags there is no percentage, and the statuses mean nothing yet.
  const summary = match && percent !== null ? summarize(recipe, match) : null;
  const meta = [formatPrepTime(recipe.prepTimeMin), formatServings(recipe.servings)].filter(Boolean).join(" · ");

  return (
    <article
      className={cn(
        cardVariants(),
        "hover:bg-accent relative flex h-full min-w-0 items-start gap-4 p-4 transition-colors",
      )}
    >
      <RecipeIllustration illustration={recipe.illustration} className="xl:size-26" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Stretched link: the pseudo-element covers the whole tile, so the title is the only focusable element. */}
        <h3 className="text-card-foreground line-clamp-3 text-base leading-snug font-bold break-words">
          <a
            href={`/recipes/${recipe.id}`}
            className="after:ring-ring after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2"
          >
            {recipe.name}
          </a>
        </h3>
        {(percent !== null || meta !== "") && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {percent !== null && (
              <Badge
                variant={percent === 100 ? "default" : "have"}
                className="shrink-0 border-transparent px-3 py-1 text-sm font-bold"
                aria-label={`Dopasowanie ${percent}%`}
              >
                {percent}%
              </Badge>
            )}
            {meta !== "" && <span className="text-muted-foreground text-sm">{meta}</span>}
          </div>
        )}
        {summary === null ? (
          <p className="text-muted-foreground text-sm">{ingredientCount(total)}</p>
        ) : (
          <>
            <p className="text-foreground flex items-center gap-1 text-sm font-bold">
              {summary.have === total ? (
                <>
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                  Masz wszystkie składniki
                </>
              ) : (
                `Masz ${summary.have} z ${total} ${total === 1 ? "składnika" : "składników"}`
              )}
            </p>
            {summary.substitutes.length > 0 && <SubstituteLine items={summary.substitutes} />}
            {summary.missing.length > 0 && <MissingLine items={summary.missing} />}
          </>
        )}
      </div>
    </article>
  );
}
