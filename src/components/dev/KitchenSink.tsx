import { useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import SignInForm from "@/components/auth/SignInForm";
import SignUpForm from "@/components/auth/SignUpForm";
import { EmptyState, LimitNotice, RecipeCount, RecipeListSkeleton } from "@/components/pantry/PantryStates";
import { TagInput, type TagVariant } from "@/components/pantry/TagInput";
import { emptyRecipeForm, type RecipeFormActions, type RecipeFormState } from "@/components/hooks/useRecipeForm";
import { RecipeFormView } from "@/components/recipes/RecipeFormView";
import { RecipeSaved } from "@/components/recipes/RecipeSaved";
import { RecipeTile } from "@/components/recipes/RecipeTile";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/auth-errors";
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

const NOOP = () => undefined;
const NOOP_ACTIONS: RecipeFormActions = {
  setName: NOOP,
  setNumber: NOOP,
  toggleKind: NOOP,
  addIngredient: NOOP,
  removeIngredient: NOOP,
  setIngredient: NOOP,
  addSubstitute: NOOP,
  removeSubstitute: NOOP,
  setSubstitute: NOOP,
  addStep: NOOP,
  removeStep: NOOP,
  setStep: NOOP,
};

// A form with an ingredient that has a substitute, one step, a kind and the amount without a unit (the field errors below).
function filledForm(): RecipeFormState {
  const form = emptyRecipeForm();
  return {
    ...form,
    name: "Owsianka z jabłkiem",
    ingredients: [
      {
        ...form.ingredients[0],
        name: "Mleko 1,5%",
        product: "mleko 1,5%",
        amount: "200",
        unit: "",
        substitutes: [
          {
            key: "ks-sub",
            name: "Napój owsiany",
            product: "napój owsiany",
            productEdited: false,
            amount: "",
            unit: "",
          },
        ],
      },
    ],
    steps: [{ ...form.steps[0], text: "Podgrzej mleko i dodaj płatki." }],
    kinds: ["na słodko"],
    prepTimeMin: "10",
  };
}

const FORM_ERRORS: Record<string, string> = {
  "ingredients.0.unit": "Jednostka: podaj jednostkę razem z ilością.",
  kcal: "Kcal: wartość od 0 do 10000.",
};

function SampleRecipeForm(props: Partial<Parameters<typeof RecipeFormView>[0]>) {
  return (
    <RecipeFormView
      form={filledForm()}
      fieldErrors={{}}
      status="idle"
      serverError={null}
      actions={NOOP_ACTIONS}
      onSubmit={NOOP}
      {...props}
    />
  );
}

const SAMPLE_EMAIL = "ola@przyklad.pl";

const LIMIT_MESSAGE = `Za dużo produktów naraz (limit ${MAX_TOKENS} słów we wszystkich listach). Usuń któryś produkt.`;

function StateSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-4 sm:p-6">
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
          Widok spiżarki w każdym z 7 stanów: default, hover, focus-visible, disabled, error, empty, loading; dalej
          formularze logowania i rejestracji.
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

      <StateSection title="count" note="Licznik nad listą przepisów; odmiana: 1 przepis, 2–4 przepisy, 5+ przepisów.">
        <RecipeCount total={1} />
        <RecipeCount total={3} />
        <RecipeCount total={12} />
        <RecipeCount total={22} />
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

      <StateSection
        title="Formularz przepisu: pusty"
        note="Pusty formularz /recipes/new (jedno puste pole składnika i kroku). Przycisk w nagłówku w wariancie nav-current (bieżąca strona) obok ghost."
      >
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" size="sm">
            Dodaj przepis
          </Button>
          <Button type="button" variant="nav-current" size="sm" aria-current="page">
            Dodaj przepis
          </Button>
        </div>
        <RecipeFormView
          form={emptyRecipeForm()}
          fieldErrors={{}}
          status="idle"
          serverError={null}
          actions={NOOP_ACTIONS}
          onSubmit={NOOP}
        />
      </StateSection>

      <StateSection
        title="Formularz przepisu: błędy pól"
        note="Ilość bez jednostki i kcal poza zakresem (aria-invalid, tekst pod polem)."
      >
        <SampleRecipeForm fieldErrors={FORM_ERRORS} status="error" />
      </StateSection>

      <StateSection title="Formularz przepisu: wysyłka" note="Przycisk wyłączony z aria-busy.">
        <SampleRecipeForm status="submitting" />
      </StateSection>

      <StateSection title="Formularz przepisu: błąd serwera" note="ServerError nad przyciskiem zapisu.">
        <SampleRecipeForm status="error" serverError="Nie udało się zapisać przepisu. Spróbuj ponownie." />
      </StateSection>

      <StateSection
        title="Przepis dodany"
        note="Stan po zapisie: komunikat, kafelek, Dodaj kolejny i Przejdź do listy."
      >
        <RecipeSaved recipe={RECIPE} onAddAnother={NOOP} autoFocus={false} />
      </StateSection>

      <StateSection
        title="Formularze logowania"
        note="Pusty formularz logowania; logowanie po złym haśle i rejestracja po błędzie — e-mail zostaje, hasła są puste. Na stronie fokus trafia na pole hasła; tutaj jest wyłączony, żeby strona nie przewijała się sama."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-cosmic rounded-2xl p-6">
            <SignInForm idPrefix="ks-signin-empty-" />
          </div>
          <div className="bg-cosmic rounded-2xl p-6">
            <SignInForm
              idPrefix="ks-signin-error-"
              initialEmail={SAMPLE_EMAIL}
              serverError={authErrorMessage("invalid_credentials")}
            />
          </div>
          <div className="bg-cosmic rounded-2xl p-6">
            <SignUpForm
              idPrefix="ks-signup-error-"
              initialEmail={SAMPLE_EMAIL}
              serverError={authErrorMessage("user_already_exists")}
            />
          </div>
        </div>
      </StateSection>
    </div>
  );
}
