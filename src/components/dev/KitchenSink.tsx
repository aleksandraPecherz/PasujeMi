import { useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import SignInForm from "@/components/auth/SignInForm";
import SignUpForm from "@/components/auth/SignUpForm";
import { EmptyState, LimitNotice, RecipeCount, RecipeListSkeleton, SaveNotice } from "@/components/pantry/PantryStates";
import { TagInput, type TagVariant } from "@/components/pantry/TagInput";
import { emptyRecipeForm, type RecipeFormActions, type RecipeFormState } from "@/components/hooks/useRecipeForm";
import { RecipeAuthorActionsView } from "@/components/recipes/RecipeAuthorActions";
import { RecipeFormView } from "@/components/recipes/RecipeFormView";
import { RecipeDetails } from "@/components/recipes/RecipeDetails";
import { RecipeSaved } from "@/components/recipes/RecipeSaved";
import { RecipeTile } from "@/components/recipes/RecipeTile";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { authErrorMessage } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";
import { MAX_TAGS, MAX_TOKENS } from "@/lib/matching/limits";
import { MAX_SAVED_TOKENS } from "@/lib/pantry/limits";
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
  id: "6f1d2a4e-3b8c-4c57-9a0e-1d2f3a4b5c6d",
  name: "Owsianka z jabłkiem i cynamonem",
  steps: ["Podgrzej mleko.", "Wsyp płatki i gotuj 5 minut.", "Dodaj pokrojone jabłko i cynamon."],
  ingredients: [
    ingredient("Płatki owsiane", "płatki owsiane"),
    ingredient("Jabłko", "jabłko"),
    ingredient("Mleko krowie", "mleko", ["mleko owsiane"]),
    ingredient("Cynamon", "cynamon"),
  ],
  prepTimeMin: 10,
  servings: 1,
  kinds: ["na słodko", "na ciepło"],
  kcal: 320,
  proteinG: 9,
  carbsG: 52,
  fatG: 7,
};

// A recipe with missing data: no time, servings, kinds or nutrition.
const SPARSE_RECIPE: Recipe = {
  id: "0b7e9c1a-5d42-4f86-8a3b-7c6d5e4f3a2b",
  name: "Jajecznica",
  steps: ["Wbij jajka na patelnię i smaż, mieszając."],
  ingredients: [ingredient("Jajka", "jajka"), ingredient("Masło", "masło", ["olej"])],
  prepTimeMin: null,
  servings: null,
  kinds: [],
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

const SAVED_LIMIT_MESSAGE = `Za dużo produktów stałych i wykluczeń (limit ${MAX_SAVED_TOKENS} słów razem). Usuń któryś produkt.`;

function AuthorActions(props: Partial<Parameters<typeof RecipeAuthorActionsView>[0]>) {
  return (
    <RecipeAuthorActionsView
      recipeId={RECIPE.id}
      recipeName={RECIPE.name}
      status="idle"
      error={null}
      onConfirm={NOOP}
      {...props}
    />
  );
}

const DIALOG_STATES = [
  { id: "idle", label: "Bezczynny", props: { status: "idle", error: null } },
  { id: "deleting", label: "W trakcie", props: { status: "deleting", error: null } },
  { id: "error", label: "Błąd", props: { status: "error", error: "Nie udało się usunąć przepisu. Spróbuj ponownie." } },
] as const;

// Radix dialogs are modal, so one state is open at a time; the buttons switch which one.
function DeleteDialogStates() {
  const [current, setCurrent] = useState<(typeof DIALOG_STATES)[number]["id"] | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {DIALOG_STATES.map((state) => (
        <Button
          key={state.id}
          type="button"
          variant="outline"
          onClick={() => {
            setCurrent(state.id);
          }}
        >
          {state.label}
        </Button>
      ))}
      {DIALOG_STATES.map(
        (state) => current === state.id && <AuthorActions key={state.id} {...state.props} defaultOpen />,
      )}
    </div>
  );
}

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
        note="Stany interaktywne: najedź kursorem na kontrolkę / przejdź po nich klawiszem Tab. Kafelek przepisu jest linkiem do szczegółów: najechanie podświetla cały kafelek, a fokus (Tab) trafia na tytuł i pokazuje pierścień wokół kafelka."
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
        title="Komunikaty o zapisie spiżarki"
        note="SaveNotice: błąd zapisu i błąd odczytu (zapis wyłączony); LimitNotice: limit zapisanych list. Osobne regiony, mogą pojawić się naraz."
      >
        <SaveNotice message="Nie udało się zapisać produktów stałych i wykluczeń." />
        <SaveNotice message="Nie udało się wczytać produktów stałych i wykluczeń — zmiany nie zostaną zapisane." />
        <LimitNotice message={SAVED_LIMIT_MESSAGE} />
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

      <StateSection
        title="Formularz przepisu: edycja"
        note="Tryb edycji (/recipes/[id]/edit): tytuł „Edytuj przepis”, przycisk „Zapisz zmiany” i link „Anuluj” do szczegółów."
      >
        <SampleRecipeForm title="Edytuj przepis" submitLabel="Zapisz zmiany" cancelHref={`/recipes/${RECIPE.id}`} />
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
        title="Kafelek przepisu: link"
        note="Cały kafelek prowadzi do szczegółów (link na tytule rozciągnięty na kafelek); bez dopasowania i z dopasowaniem. Kafelek ma ramkę i cień (wariant brutal karty) i nie wciska się przy kliknięciu. Najedź kursorem i przejdź klawiszem Tab, żeby zobaczyć hover i focus-visible."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <RecipeTile recipe={RECIPE} />
          <RecipeTile recipe={RECIPE} match={MATCH} />
        </div>
      </StateSection>

      <StateSection
        title="Szczegóły przepisu"
        note="Pełny przepis: czas, porcje, rodzaje, wartości odżywcze, składniki z zamiennikami i kroki. Linki nie prowadzą do istniejących przepisów."
      >
        <RecipeDetails recipe={RECIPE} />
      </StateSection>

      <StateSection
        title="Szczegóły przepisu: akcje autora"
        note="Autor widzi „Edytuj” i „Usuń” obok „Wróć do listy” (zawijanie na telefonie)."
      >
        <RecipeDetails recipe={RECIPE} actions={<AuthorActions />} />
      </StateSection>

      <StateSection
        title="Okno usuwania przepisu"
        note="Okno jest modalne, więc przyciski otwierają po jednym stanie: bezczynny, w trakcie usuwania (oba przyciski wyłączone, okno nie zamyka się — odśwież stronę) i błąd (komunikat w oknie)."
      >
        <DeleteDialogStates />
      </StateSection>

      <StateSection
        title="Szczegóły przepisu: braki danych"
        note="Bez czasu, porcji, rodzajów i wartości odżywczych — te fragmenty się nie wyświetlają."
      >
        <RecipeDetails recipe={SPARSE_RECIPE} />
      </StateSection>

      <StateSection
        title="Przełącznik motywu"
        note="Stany: default, hover i focus-visible (najedź kursorem / przejdź klawiszem Tab). Ikona zależy od trybu: księżyc w jasnym, słońce w ciemnym; kliknięcie przełącza motyw i pokazuje drugi stan."
      >
        <div>
          <ThemeToggle />
        </div>
      </StateSection>

      <StateSection
        title="Formularze logowania"
        note="Pusty formularz logowania; logowanie po złym haśle i rejestracja po błędzie — e-mail zostaje, hasła są puste. Na stronie fokus trafia na pole hasła; tutaj jest wyłączony, żeby strona nie przewijała się sama."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="bg-cosmic rounded-2xl p-6">
            <div className={cn(cardVariants({ variant: "brutal" }), "p-8")}>
              <SignInForm idPrefix="ks-signin-empty-" />
            </div>
          </div>
          <div className="bg-cosmic rounded-2xl p-6">
            <div className={cn(cardVariants({ variant: "brutal" }), "p-8")}>
              <SignInForm
                idPrefix="ks-signin-error-"
                initialEmail={SAMPLE_EMAIL}
                serverError={authErrorMessage("invalid_credentials")}
              />
            </div>
          </div>
          <div className="bg-cosmic rounded-2xl p-6">
            <div className={cn(cardVariants({ variant: "brutal" }), "p-8")}>
              <SignUpForm
                idPrefix="ks-signup-error-"
                initialEmail={SAMPLE_EMAIL}
                serverError={authErrorMessage("user_already_exists")}
              />
            </div>
          </div>
        </div>
      </StateSection>

      <StateSection
        title="Przycisk wciskany"
        note="Wariant pressable: default i disabled. Najedź kursorem (hover), przytrzymaj (active), przejdź klawiszem Tab (focus-visible). Stan pending widać w formularzach logowania (SubmitButton)."
      >
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="pressable">
            Zaloguj się
          </Button>
          <Button type="button" variant="pressable" disabled>
            Zaloguj się
          </Button>
        </div>
      </StateSection>
    </div>
  );
}
