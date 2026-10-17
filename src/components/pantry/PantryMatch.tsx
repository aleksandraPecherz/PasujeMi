import { Lightbulb, SlidersHorizontal } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { EmptyState, LimitNotice, RecipeListSkeleton } from "@/components/pantry/PantryStates";
import { TagInput, type TagVariant } from "@/components/pantry/TagInput";
import { RecipeTile } from "@/components/recipes/RecipeTile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePantryMatch, type PantrySection } from "@/components/hooks/usePantryMatch";

const SECTIONS: { section: PantrySection; label: string; placeholder: string; badgeVariant: TagVariant }[] = [
  {
    section: "have",
    label: "Mam w domu",
    placeholder: "np. pomidor",
    badgeVariant: "have",
  },
  {
    section: "staple",
    label: "Produkty stałe",
    placeholder: "np. sól",
    badgeVariant: "staple",
  },
  {
    section: "exclude",
    label: "Wykluczam",
    placeholder: "np. orzechy",
    badgeVariant: "exclude",
  },
];

export default function PantryMatch() {
  const { lists, limitNotice, addTag, removeTag, apply, loadMore, recipes, hasMore, loading, error, filtered } =
    usePantryMatch();
  const showEmptyFiltered = filtered && !loading && error === null && recipes.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="pantry-heading" className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <h1 id="pantry-heading" className="mb-2 text-xl font-semibold sm:text-2xl">
          Twoja spiżarka
        </h1>
        <p className="text-muted-foreground mb-5 flex items-start gap-2 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Przyprawy i dodatki, które zawsze masz pod ręką (np. sól, pieprz, olej), dodaj do produktów stałych — liczą
            się tak samo jak posiadane.
          </span>
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          {SECTIONS.map(({ section, label, placeholder, badgeVariant }) => (
            <TagInput
              key={section}
              id={`pantry-${section}`}
              label={label}
              placeholder={placeholder}
              tags={lists[section]}
              onAdd={(tag) => addTag(section, tag)}
              onRemove={(tag) => {
                removeTag(section, tag);
              }}
              tagVariant={badgeVariant}
            />
          ))}
        </div>
        <LimitNotice message={limitNotice} className="mt-3" />
        <Button type="button" onClick={apply} disabled={loading} className="mt-5 w-full sm:w-auto">
          <SlidersHorizontal aria-hidden="true" />
          Zastosuj filtry
        </Button>
      </section>

      <section aria-labelledby="recipes-heading" aria-busy={loading} className="flex flex-col gap-4">
        <h2 id="recipes-heading" className="text-lg font-semibold">
          {filtered ? "Przepisy dopasowane do spiżarki" : "Wypełnij spiżarkę, żeby zobaczyć dopasowanie"}
        </h2>

        <ServerError message={error} />

        {showEmptyFiltered && (
          <EmptyState>
            Brak przepisów: wszystkie zawierają wykluczony składnik. Usuń któreś wykluczenie i zastosuj filtry ponownie.
          </EmptyState>
        )}
        {!filtered && !loading && error === null && recipes.length === 0 && (
          <EmptyState>Nie ma jeszcze żadnych przepisów.</EmptyState>
        )}

        {loading && recipes.length === 0 && <RecipeListSkeleton count={4} />}

        {recipes.length > 0 && (
          <ul className={cn("grid gap-4 sm:grid-cols-2", loading && "opacity-60")}>
            {recipes.map(({ recipe, match }) => (
              <li key={recipe.id} className="min-w-0">
                <RecipeTile recipe={recipe} match={match} />
              </li>
            ))}
          </ul>
        )}

        <p role="status" className="sr-only">
          {loading ? "Wczytywanie przepisów…" : ""}
        </p>

        {hasMore && (
          <Button type="button" variant="outline" onClick={loadMore} disabled={loading} className="self-center">
            Pokaż więcej
          </Button>
        )}
      </section>
    </div>
  );
}
