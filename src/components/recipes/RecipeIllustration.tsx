import { Utensils } from "lucide-react";
import { resolveIllustration, type IllustrationTone } from "@/lib/recipes/illustrations";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<IllustrationTone, string> = {
  green: "bg-illus-green",
  yellow: "bg-illus-yellow",
  pink: "bg-illus-pink",
  lilac: "bg-illus-lilac",
};

interface RecipeIllustrationProps {
  /** Stored `recipes.illustration`; null or an unknown key shows the placeholder. */
  illustration?: string | null;
  /** Size and radius of the square tile (default: 88 px as on the recipe tile). */
  className?: string;
}

/** Decorative: the recipe name next to it carries the meaning, so the image has an empty alt. */
export function RecipeIllustration({ illustration, className }: RecipeIllustrationProps) {
  const resolved = resolveIllustration(illustration);
  const box = "grid shrink-0 place-items-center overflow-hidden rounded-xl size-22";

  if (resolved === null) {
    return (
      <div aria-hidden="true" className={cn(box, "bg-secondary", className)}>
        <span className="bg-card text-muted-foreground grid size-3/5 place-items-center rounded-full">
          <Utensils className="size-1/2" />
        </span>
      </div>
    );
  }

  return (
    <div className={cn(box, TONE_CLASS[resolved.tone], className)}>
      <img
        src={`/illustrations/${resolved.key}.svg`}
        alt=""
        width={88}
        height={88}
        loading="lazy"
        decoding="async"
        className="size-11/12"
      />
    </div>
  );
}
