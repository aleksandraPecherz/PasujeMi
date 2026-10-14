import { useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { EmptyState, LimitNotice, RecipeListSkeleton } from "@/components/pantry/PantryStates";
import { TagInput, type TagVariant } from "@/components/pantry/TagInput";
import { RecipeTile } from "@/components/recipes/RecipeTile";
import { Button } from "@/components/ui/button";
import { MAX_TAGS, MAX_TOKENS } from "@/lib/matching/limits";
import type { Recipe, RecipeIngredient, RecipeMatch } from "@/types";

// Sample data only; the page is served in dev mode (src/pages/dev/kitchen-sink.astro).

function ingredient(name: string, product: string, substitutes: string[] = []): RecipeIngredient {
  return {
    name,
    product,
    amount: null,
    unit: null,
    substitutes: substitutes.map((s) => ({ name: s, product: s, amount: null, unit: null })),
  };
}

const RECIPE: Recipe = {
  id: "kitchen-sink-recipe",
  name: "Owsianka z jabłkiem i cynamonem",
  steps: [],
  ingredients: [
    ingredient("Płatki owsiane", "płatki owsiane"),
    ingredient("Jabłko", "jabłko"),
    ingredient("Mleko krowie", "mleko", ["mleko owsiane"]),
    ingredient("Cynamon", "cynamon"),
  ],
  prepTimeMin: 10,
  servings: 1,
  kinds: ["na słodko", "na ciepło"],
  kcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

// Have / no information / excluded main product shown through its substitute.
const MATCH: RecipeMatch = {
  percent: 75,
  ingredients: [
    { status: "have", mainExcluded: false, via: null },
    { status: "unknown", mainExcluded: false, via: null },
    { status: "have", mainExcluded: true, via: "mleko owsiane" },
    { status: "have", mainExcluded: false, via: null },
  ],
};

const SAMPLE_TAGS: { id: string; label: string; placeholder: string; variant: TagVariant; tags: string[] }[] = [
  {
    id: "ks-have",
    label: "Mam w domu",
    placeholder: "np. pomidor",
    variant: "have",
    tags: ["jabłko", "płatki owsiane"],
  },
  { id: "ks-staple", label: "Produkty stałe", placeholder: "np. sól", variant: "staple", tags: ["sól", "cynamon"] },
  { id: "ks-exclude", label: "Wykluczam", placeholder: "np. orzechy", variant: "exclude", tags: ["mleko"] },
];

const FULL_TAGS = Array.from({ length: MAX_TAGS }, (_, i) => `produkt ${i + 1}`);

const LIMIT_MESSAGE = `Za dużo produktów naraz (limit ${MAX_TOKENS} słów we wszystkich listach). Usuń któryś produkt.`;

function StateSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-4 backdrop-blur-xl sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {note && <p className="text-muted-foreground text-sm">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function SampleTagInput({ id, label, placeholder, variant, tags }: (typeof SAMPLE_TAGS)[number]) {
  const [list, setList] = useState(tags);
  return (
    <TagInput
      id={id}
      label={label}
      placeholder={placeholder}
      tags={list}
      onAdd={(tag) => {
        const value = tag.trim();
        if (list.some((t) => t.toLocaleLowerCase("pl") === value.toLocaleLowerCase("pl"))) {
          return false;
        }
        setList((prev) => [...prev, value]);
        return true;
      }}
      onRemove={(tag) => {
        setList((prev) => prev.filter((t) => t !== tag));
      }}
      tagVariant={variant}
    />
  );
}

function Controls({ suffix }: { suffix: string }) {
  return (
    <>
      <div className="grid gap-5 md:grid-cols-3">
        {SAMPLE_TAGS.map((sample) => (
          <SampleTagInput key={sample.id} {...sample} id={`${sample.id}-${suffix}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button">
          <SlidersHorizontal aria-hidden="true" />
          Zastosuj filtry
        </Button>
        <Button type="button" variant="outline">
          Pokaż więcej
        </Button>
        <Button type="button" variant="ghost">
          Ghost
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RecipeTile recipe={RECIPE} />
        <RecipeTile recipe={RECIPE} match={MATCH} />
      </div>
    </>
  );
}

export default function KitchenSink() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Kitchen sink</h1>
        <p className="text-muted-foreground text-sm">
          Widok spiżarki w każdym z 7 stanów: default, hover, focus-visible, disabled, error, empty, loading.
        </p>
      </div>

      <StateSection
        title="default"
        note="3 × TagInput z tagami; przyciski default / outline / ghost; kafelek bez dopasowania i z dopasowaniem (mam / brak / wykluczony z zamiennikiem)."
      >
        <Controls suffix="default" />
      </StateSection>

      <StateSection
        title="hover i focus-visible"
        note="Stany interaktywne: najedź kursorem na kontrolkę / przejdź po nich klawiszem Tab. Kafelki przepisów nie są interaktywne — N/A: brak hover i fokusu na kafelku."
      >
        <Controls suffix="interactive" />
      </StateSection>

      <StateSection
        title="disabled"
        note={`Button disabled (default / outline / ghost ×) — bez hoveru. TagInput pełny (${MAX_TAGS} tagów → pole wyłączone, bez hoveru); jego × zostaje aktywny celowo: usunięcie tagu zwalnia limit.`}
      >
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled>
            <SlidersHorizontal aria-hidden="true" />
            Zastosuj filtry
          </Button>
          <Button type="button" variant="outline" disabled>
            Pokaż więcej
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled
            aria-label="Usuń (wyłączony)"
            className="size-5 self-center rounded-full"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
        <TagInput
          id="ks-full"
          label="Mam w domu"
          placeholder="np. pomidor"
          tags={FULL_TAGS}
          onAdd={() => false}
          onRemove={() => undefined}
          tagVariant="have"
        />
      </StateSection>

      <StateSection title="error" note="ServerError z komunikatem (role=alert).">
        <ServerError message="Nie udało się pobrać przepisów. Spróbuj ponownie." />
      </StateSection>

      <StateSection title="empty" note="Oba puste stany listy przepisów.">
        <EmptyState>
          Brak przepisów: wszystkie zawierają wykluczony składnik. Usuń któreś wykluczenie i zastosuj filtry ponownie.
        </EmptyState>
        <EmptyState>Nie ma jeszcze żadnych przepisów.</EmptyState>
      </StateSection>

      <StateSection title="loading" note="Szkielet listy przy pierwszym wczytaniu; komunikat limitu słów.">
        <RecipeListSkeleton count={4} />
        <LimitNotice message={LIMIT_MESSAGE} />
      </StateSection>
    </div>
  );
}
