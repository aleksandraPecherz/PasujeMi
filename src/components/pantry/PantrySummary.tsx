import { CircleAlert, Pencil, Plus } from "lucide-react";
import { PANTRY_SECTIONS, SectionDot } from "@/components/pantry/sections";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PantryLists } from "@/types";

interface PantrySummaryProps {
  lists: PantryLists;
  /** The typed lists differ from the ones the shown results were requested with. */
  stale: boolean;
  loading: boolean;
  onEdit: () => void;
  onApply: () => void;
  /** Opens the editor on the first list with the field focused (the empty-pantry card). */
  onStart: () => void;
}

function PantryCounts({ lists }: { lists: PantryLists }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {PANTRY_SECTIONS.map(({ section, summaryLabel }) => (
        <li key={section} className="flex items-center gap-1.5">
          <SectionDot section={section} />
          {lists[section].length} {summaryLabel}
        </li>
      ))}
    </ul>
  );
}

/** The phone's pantry bar: counts and "Edytuj"; from `lg` the editor itself is on the page, so this is hidden. */
export function PantrySummary({ lists, stale, loading, onEdit, onApply, onStart }: PantrySummaryProps) {
  const empty = PANTRY_SECTIONS.every(({ section }) => lists[section].length === 0);

  if (empty) {
    return (
      <section data-pantry-bar className="bg-hero text-hero-foreground flex flex-col gap-3 rounded-2xl p-5 lg:hidden">
        <h2 className="text-foreground text-2xl leading-tight font-extrabold">Co masz dziś w domu?</h2>
        <p>Wpisz kilka produktów, a pokażemy przepisy, które z nich ugotujesz.</p>
        <button
          type="button"
          onClick={onStart}
          className="bg-card text-muted-foreground focus-visible:outline-ring flex min-h-12 items-center gap-2 rounded-lg px-4 py-2 text-left tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Plus className="size-5 shrink-0" aria-hidden="true" />
          Dodaj produkty, np. jajka, pomidor
        </button>
        <p className="text-sm">Sól, pieprz i inne rzeczy, które masz zawsze, dodasz raz w „Stałe”. Zapamiętamy je.</p>
      </section>
    );
  }

  if (stale) {
    return (
      <section
        data-pantry-bar
        className={cn(
          cardVariants(),
          "bg-warning-surface border-warning/40 flex flex-col gap-3 border-2 p-4 lg:hidden",
        )}
      >
        <p className="text-warning flex items-start gap-2 font-bold">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          Spiżarka zmieniona · wyniki jeszcze nie odświeżone
        </p>
        <PantryCounts lists={lists} />
        <div className="flex gap-2">
          <Button type="button" size="lg" onClick={onApply} disabled={loading} className="flex-1">
            Zastosuj filtry
          </Button>
          <Button type="button" size="lg" variant="secondary" onClick={onEdit}>
            Edytuj
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section data-pantry-bar className={cn(cardVariants(), "flex items-center justify-between gap-3 p-4 lg:hidden")}>
      <div className="flex flex-col gap-1">
        <h2 className="font-bold">Twoja spiżarka</h2>
        <PantryCounts lists={lists} />
      </div>
      <Button type="button" size="lg" variant="secondary" onClick={onEdit}>
        <Pencil aria-hidden="true" />
        Edytuj
      </Button>
    </section>
  );
}
