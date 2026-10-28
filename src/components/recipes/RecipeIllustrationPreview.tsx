import { RecipeIllustration } from "@/components/recipes/RecipeIllustration";
import { pickIllustration } from "@/lib/recipes/illustrationRules";
import { cn } from "@/lib/utils";

interface RecipeIllustrationPreviewProps {
  /** The name as typed now: the rules run on it while the recipe has no illustration. */
  name: string;
  /** `recipes.illustration` of the recipe being edited; a stored value is kept on save whatever the name says. */
  savedIllustration?: string | null;
  /** Phone: a tile with the caption beside it. Desktop column: the tile above, the caption below. */
  layout: "row" | "column";
  className?: string;
}

/** What the form shows for a recipe: the stored illustration, else the one the rules pick from the name (read-only). */
export function RecipeIllustrationPreview({
  name,
  savedIllustration,
  layout,
  className,
}: RecipeIllustrationPreviewProps) {
  const kept = typeof savedIllustration === "string";
  const key = kept ? savedIllustration : pickIllustration(name);
  const caption = kept
    ? "Ilustracja przepisu zostaje bez zmian."
    : key !== null
      ? "Dobrana automatycznie po nazwie."
      : name.trim() === ""
        ? "Wpisz nazwę, a dobierzemy ilustrację."
        : "Brak dopasowania do nazwy, pokażemy ogólną ilustrację.";

  return (
    <div className={cn(layout === "row" ? "flex items-center gap-3" : "flex flex-col items-stretch gap-3", className)}>
      <RecipeIllustration
        illustration={key}
        className={layout === "row" ? "size-16" : "aspect-square size-auto w-full"}
      />
      <p className="text-muted-foreground text-sm">{caption}</p>
    </div>
  );
}
