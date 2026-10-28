import { Check, ChevronDown, ChevronUp, CircleAlert, Plus, X } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { errorSummary, type Disclosure } from "@/components/hooks/recipeFormDisclosure";
import type {
  NumberField,
  RecipeFormActions,
  RecipeFormDisclosureActions,
  RecipeFormState,
  RecipeFormStatus,
} from "@/components/hooks/useRecipeForm";
import {
  FieldError,
  IngredientFields,
  UNIT_LIST_ID,
  UNIT_SUGGESTIONS,
  errorProps,
  fieldId,
} from "@/components/recipes/IngredientFields";
import { RecipeIllustrationPreview } from "@/components/recipes/RecipeIllustrationPreview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_INGREDIENTS, MAX_RECIPE_NAME_LENGTH, MAX_STEPS, MAX_STEP_LENGTH } from "@/lib/recipes/limits";
import { RECIPE_KINDS } from "@/lib/recipes/validate";
import { cn } from "@/lib/utils";

const GENERAL_FIELDS: { field: NumberField; label: string }[] = [
  { field: "prepTimeMin", label: "Czas przygotowania (min)" },
  { field: "servings", label: "Liczba porcji" },
];

const NUTRITION_FIELDS: { field: NumberField; label: string }[] = [
  { field: "kcal", label: "Kcal" },
  { field: "proteinG", label: "Białko (g)" },
  { field: "carbsG", label: "Węglowodany (g)" },
  { field: "fatG", label: "Tłuszcze (g)" },
];

const NUTRITION_PANEL_ID = "recipe-nutrition-panel";

/** Polish plural: 1 pole, 2-4 pola, 5+ pól (and 12-14, 22-24 …). */
function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const lastTwo = count % 100;
  const last = count % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many;
}

const CARD = "bg-card flex flex-col gap-4 rounded-xl p-4 sm:p-6";
const ADD_BUTTON = "w-full border-dashed text-primary";

interface RecipeFormViewProps {
  form: RecipeFormState;
  fieldErrors: Record<string, string>;
  status: RecipeFormStatus;
  serverError: string | null;
  actions: RecipeFormActions;
  disclosure: Disclosure;
  disclosureActions: RecipeFormDisclosureActions;
  onSubmit: () => void;
  /** Where the close button (phone) and "Anuluj" (desktop) lead: the list when adding, the details when editing. */
  cancelHref: string;
  /** `recipes.illustration` of the recipe being edited; the form only previews it and never sends it. */
  savedIllustration?: string | null;
  title?: string;
  submitLabel?: string;
}

export function RecipeFormView({
  form,
  fieldErrors,
  status,
  serverError,
  actions,
  disclosure,
  disclosureActions,
  onSubmit,
  cancelHref,
  savedIllustration,
  title = "Dodaj przepis",
  submitLabel = "Zapisz przepis",
}: RecipeFormViewProps) {
  const submitting = status === "submitting";
  const nameId = fieldId("name");
  const summary = errorSummary(fieldErrors);
  const ingredientCount = form.ingredients.length;
  const nutritionHasError = NUTRITION_FIELDS.some(({ field }) => fieldErrors[field]);

  return (
    <form
      noValidate
      aria-labelledby="recipe-form-heading"
      // A focused field must not end up under the sticky save bar (phone).
      className="flex flex-col gap-4 lg:grid lg:grid-cols-11 lg:items-start lg:gap-6 [&_*]:scroll-mb-28 lg:[&_*]:scroll-mb-0"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" className="-ml-2 lg:hidden">
              <a href={cancelHref} aria-label="Zamknij formularz">
                <X aria-hidden="true" />
              </a>
            </Button>
            <h1 id="recipe-form-heading" className="text-lg font-bold sm:text-2xl lg:text-3xl lg:font-extrabold">
              {title}
            </h1>
          </div>
          <p className="text-muted-foreground text-xs lg:text-sm">
            Pola z gwiazdką <span aria-hidden="true">*</span>
            <span className="sr-only">(wymagane)</span> są wymagane. Reszta jest opcjonalna.
          </p>
        </div>

        {summary.length > 0 && (
          <div role="alert" className="bg-exclude text-destructive flex flex-col gap-2 rounded-xl p-4 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
              Popraw {summary.length} {plural(summary.length, "pole", "pola", "pól")}, żeby zapisać
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-7">
              {summary.map((item) => (
                <li key={item.path}>
                  {/* Opens the section that holds the field, then moves the focus to it. */}
                  <a
                    href={`#${fieldId(item.path)}`}
                    className="underline underline-offset-2"
                    onClick={(e) => {
                      e.preventDefault();
                      disclosureActions.reveal(item.path);
                    }}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <section aria-labelledby="recipe-name-heading" className={CARD}>
          <h2 id="recipe-name-heading" className="text-lg font-bold">
            Nazwa przepisu
          </h2>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={nameId}>
              Nazwa <span aria-hidden="true">*</span>
            </Label>
            <Input
              id={nameId}
              value={form.name}
              maxLength={MAX_RECIPE_NAME_LENGTH}
              autoComplete="off"
              aria-required="true"
              onChange={(e) => {
                actions.setName(e.target.value);
              }}
              {...errorProps(nameId, fieldErrors.name)}
            />
            <FieldError id={nameId} message={fieldErrors.name} />
          </div>
          {/* Phone: under the field, so the field keeps its width. From `lg` the preview sits in the right column. */}
          <RecipeIllustrationPreview
            name={form.name}
            savedIllustration={savedIllustration}
            layout="row"
            className="lg:hidden"
          />
        </section>

        <section aria-labelledby="recipe-ingredients-heading" className={CARD}>
          <div>
            <h2 id="recipe-ingredients-heading" className="text-lg font-bold">
              Składniki <span aria-hidden="true">*</span>
            </h2>
            <p className="text-muted-foreground text-sm">
              {ingredientCount === 1
                ? "Min. 1 składnik"
                : `${ingredientCount} ${plural(ingredientCount, "składnik", "składniki", "składników")}`}
            </p>
          </div>
          <datalist id={UNIT_LIST_ID}>
            {UNIT_SUGGESTIONS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          <FieldError id={fieldId("ingredients")} message={fieldErrors.ingredients} />
          {form.ingredients.map((row, i) => (
            <IngredientFields
              key={row.key}
              index={i}
              row={row}
              errors={fieldErrors}
              actions={actions}
              canRemove={ingredientCount > 1}
              expanded={disclosure.openIngredient === row.key}
              substitutesOpen={disclosure.openSubstitutes.includes(row.key)}
              onToggle={() => {
                disclosureActions.toggleIngredient(row.key);
              }}
              onToggleSubstitutes={() => {
                disclosureActions.toggleSubstitutes(row.key);
              }}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={ADD_BUTTON}
            disabled={ingredientCount >= MAX_INGREDIENTS}
            onClick={actions.addIngredient}
          >
            <Plus aria-hidden="true" />
            Dodaj składnik
          </Button>
        </section>

        <section aria-labelledby="recipe-steps-heading" className={CARD}>
          <h2 id="recipe-steps-heading" className="text-lg font-bold">
            Kroki <span aria-hidden="true">*</span>
          </h2>
          <FieldError id={fieldId("steps")} message={fieldErrors.steps} />
          {form.steps.map((step, i) => {
            const id = fieldId(`steps.${i}`);
            return (
              <div key={step.key} className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={id}>
                    Krok {i + 1} <span aria-hidden="true">*</span>
                  </Label>
                  {form.steps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Usuń krok ${i + 1}`}
                      onClick={() => {
                        actions.removeStep(i);
                      }}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <Textarea
                  id={id}
                  value={step.text}
                  maxLength={MAX_STEP_LENGTH}
                  aria-required="true"
                  onChange={(e) => {
                    actions.setStep(i, e.target.value);
                  }}
                  {...errorProps(id, fieldErrors[`steps.${i}`])}
                />
                <FieldError id={id} message={fieldErrors[`steps.${i}`]} />
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className={ADD_BUTTON}
            disabled={form.steps.length >= MAX_STEPS}
            onClick={actions.addStep}
          >
            <Plus aria-hidden="true" />
            Dodaj krok
          </Button>
        </section>

        <section aria-labelledby="recipe-extra-heading" className={cn(CARD, "md:rounded-b-none md:pb-4")}>
          <h2 id="recipe-extra-heading" className="text-lg font-bold">
            Dodatkowe informacje
          </h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Rodzaj</legend>
            <div className="flex flex-wrap gap-2">
              {RECIPE_KINDS.map((kind) => {
                const id = fieldId(`kinds-${kind.replaceAll(" ", "-")}`);
                const checked = form.kinds.includes(kind);
                return (
                  // A chip: the checkbox covers it (invisible, so it stays the real control), the label draws it.
                  <div key={kind} className="relative">
                    <Checkbox
                      id={id}
                      checked={checked}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                      onCheckedChange={(value) => {
                        actions.toggleKind(kind, value === true);
                      }}
                    />
                    <Label
                      htmlFor={id}
                      className={cn(
                        "border-input bg-card peer-focus-visible:ring-ring pointer-events-none h-11 gap-2 rounded-full border px-4 text-sm font-normal peer-focus-visible:ring-2",
                        checked && "border-primary/40 bg-accent text-accent-foreground",
                      )}
                    >
                      {checked && <Check aria-hidden="true" className="size-4" />}
                      {kind}
                    </Label>
                  </div>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {GENERAL_FIELDS.map(({ field, label }) => {
              const id = fieldId(field);
              return (
                <div key={field} className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={id}>{label}</Label>
                  <Input
                    id={id}
                    value={form[field]}
                    inputMode="decimal"
                    autoComplete="off"
                    onChange={(e) => {
                      actions.setNumber(field, e.target.value);
                    }}
                    {...errorProps(id, fieldErrors[field])}
                  />
                  <FieldError id={id} message={fieldErrors[field]} />
                </div>
              );
            })}
          </div>
        </section>

        {/* From md the two cards read as one: the nutrition card is the lower part of "Dodatkowe informacje" (D04). */}
        <section aria-labelledby="recipe-nutrition-heading" className={cn(CARD, "md:-mt-4 md:rounded-t-none md:pt-0")}>
          {/* Phone: the header toggles the fields. From `md` up it is a plain heading and the fields are always shown. */}
          <Button
            type="button"
            variant="ghost"
            aria-expanded={disclosure.nutritionOpen}
            aria-controls={NUTRITION_PANEL_ID}
            className="-m-2 h-auto min-w-0 justify-between px-2 py-2 text-left whitespace-normal md:hidden"
            onClick={disclosureActions.toggleNutrition}
          >
            <span className="flex flex-col">
              <span className="text-lg font-bold">Wartości odżywcze</span>
              <span className="text-muted-foreground flex items-center gap-1 text-sm font-normal">
                Na 1 porcję · opcjonalne{!disclosure.nutritionOpen && " · zwinięte"}
                {!disclosure.nutritionOpen && nutritionHasError && (
                  <>
                    <CircleAlert aria-hidden="true" className="text-destructive" />
                    <span className="sr-only">(są błędy)</span>
                  </>
                )}
              </span>
            </span>
            {disclosure.nutritionOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </Button>
          <h2 id="recipe-nutrition-heading" className="hidden text-base font-bold md:block">
            Wartości odżywcze <span className="text-muted-foreground font-normal">na 1 porcję · opcjonalne</span>
          </h2>
          <div
            id={NUTRITION_PANEL_ID}
            className={cn("gap-4 sm:grid-cols-2 md:grid md:grid-cols-4", disclosure.nutritionOpen ? "grid" : "hidden")}
          >
            {NUTRITION_FIELDS.map(({ field, label }) => {
              const id = fieldId(field);
              return (
                <div key={field} className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={id}>{label}</Label>
                  <Input
                    id={id}
                    value={form[field]}
                    inputMode="decimal"
                    autoComplete="off"
                    onChange={(e) => {
                      actions.setNumber(field, e.target.value);
                    }}
                    {...errorProps(id, fieldErrors[field])}
                  />
                  <FieldError id={id} message={fieldErrors[field]} />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Phone: a save bar stuck to the bottom of the page (in flow, so it never hides the end of the form).
          From `lg` up: a column on the right with "Zapisz" and "Anuluj". */}
      <div className="bg-background border-border lg:bg-card sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t px-4 py-3 lg:top-6 lg:bottom-auto lg:col-span-3 lg:mx-0 lg:rounded-xl lg:border-0 lg:p-5">
        <RecipeIllustrationPreview
          name={form.name}
          savedIllustration={savedIllustration}
          layout="column"
          className="hidden lg:flex"
        />
        <ServerError message={serverError} />
        <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting} className="w-full">
          {submitting ? "Zapisywanie…" : submitLabel}
        </Button>
        <Button asChild variant="ghost" size="lg" className="hidden lg:inline-flex">
          <a href={cancelHref}>Anuluj</a>
        </Button>
      </div>
    </form>
  );
}
