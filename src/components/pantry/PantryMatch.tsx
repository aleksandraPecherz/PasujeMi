import { Lightbulb, SlidersHorizontal } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { TagInput } from "@/components/pantry/TagInput";
import { RecipeTile } from "@/components/recipes/RecipeTile";
import { Button } from "@/components/ui/button";
import { usePantryMatch, type PantrySection } from "@/components/hooks/usePantryMatch";

const SECTIONS: { section: PantrySection; label: string; placeholder: string; tagClassName: string }[] = [
  {
    section: "have",
    label: "Mam w domu",
    placeholder: "np. pomidor",
    tagClassName: "border-emerald-400/40 bg-emerald-500/15",
  },
  {
    section: "staple",
    label: "Produkty stałe",
    placeholder: "np. sól",
    tagClassName: "border-blue-400/40 bg-blue-500/15",
  },
  {
    section: "exclude",
    label: "Wykluczam",
    placeholder: "np. orzechy",
    tagClassName: "border-red-400/40 bg-red-500/15",
  },
];

export default function PantryMatch() {
  const { lists, addTag, removeTag, apply, loadMore, recipes, hasMore, loading, error, filtered } = usePantryMatch();
  const showEmptyFiltered = filtered && !loading && error === null && recipes.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="pantry-heading"
        className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl sm:p-6"
      >
        <h1 id="pantry-heading" className="mb-2 text-xl font-semibold sm:text-2xl">
          Twoja spiżarka
        </h1>
        <p className="mb-5 flex items-start gap-2 text-sm text-blue-100/70">
          <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Przyprawy i dodatki, które zawsze masz pod ręką (np. sól, pieprz, olej), dodaj do produktów stałych — liczą
            się tak samo jak posiadane.
          </span>
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          {SECTIONS.map(({ section, label, placeholder, tagClassName }) => (
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
              tagClassName={tagClassName}
            />
          ))}
        </div>
        <Button
          type="button"
          onClick={apply}
          className="mt-5 w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500 sm:w-auto"
        >
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
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-blue-100/80">
            Brak przepisów: wszystkie zawierają wykluczony składnik. Usuń któreś wykluczenie i zastosuj filtry ponownie.
          </p>
        )}
        {!filtered && !loading && error === null && recipes.length === 0 && (
          <p className="text-blue-100/70">Nie ma jeszcze żadnych przepisów.</p>
        )}

        {recipes.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {recipes.map(({ recipe, match }) => (
              <li key={recipe.id} className="min-w-0">
                <RecipeTile recipe={recipe} match={match} />
              </li>
            ))}
          </ul>
        )}

        <p role="status" className="text-center text-sm text-blue-100/70">
          {loading ? "Wczytywanie przepisów…" : ""}
        </p>

        {hasMore && (
          <Button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="self-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
          >
            Pokaż więcej
          </Button>
        )}
      </section>
    </div>
  );
}
