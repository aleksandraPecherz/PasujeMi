import { Plus, X } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import type {
  NumberField,
  RecipeFormActions,
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_INGREDIENTS, MAX_RECIPE_NAME_LENGTH, MAX_STEPS, MAX_STEP_LENGTH } from "@/lib/recipes/limits";
import { RECIPE_KINDS } from "@/lib/recipes/validate";

const NUMBER_FIELDS: { field: NumberField; label: string }[] = [
  { field: "prepTimeMin", label: "Czas przygotowania (min)" },
  { field: "servings", label: "Liczba porcji" },
  { field: "kcal", label: "Kcal na 1 porcję" },
  { field: "proteinG", label: "Białko (g) na 1 porcję" },
  { field: "carbsG", label: "Węglowodany (g) na 1 porcję" },
  { field: "fatG", label: "Tłuszcze (g) na 1 porcję" },
];

interface RecipeFormViewProps {
  form: RecipeFormState;
  fieldErrors: Record<string, string>;
  status: RecipeFormStatus;
  serverError: string | null;
  actions: RecipeFormActions;
  onSubmit: () => void;
}

export function RecipeFormView({ form, fieldErrors, status, serverError, actions, onSubmit }: RecipeFormViewProps) {
  const submitting = status === "submitting";
  const nameId = fieldId("name");

  return (
    <form
      noValidate
      aria-labelledby="recipe-form-heading"
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <section className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-4 sm:p-6">
        <div>
          <h1 id="recipe-form-heading" className="text-xl font-semibold sm:text-2xl">
            Dodaj przepis
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Pola z gwiazdką <span aria-hidden="true">*</span>
            <span className="sr-only">(wymagane)</span> są wymagane. Reszta jest opcjonalna.
          </p>
        </div>
        <div className="flex max-w-xl min-w-0 flex-col gap-1.5">
          <Label htmlFor={nameId}>
            Nazwa przepisu <span aria-hidden="true">*</span>
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
      </section>

      <section
        aria-labelledby="recipe-ingredients-heading"
        className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-4 sm:p-6"
      >
        <h2 id="recipe-ingredients-heading" className="text-lg font-semibold">
          Składniki <span aria-hidden="true">*</span>
        </h2>
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
            canRemove={form.ingredients.length > 1}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={form.ingredients.length >= MAX_INGREDIENTS}
          onClick={actions.addIngredient}
        >
          <Plus aria-hidden="true" />
          Dodaj składnik
        </Button>
      </section>

      <section
        aria-labelledby="recipe-steps-heading"
        className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-4 sm:p-6"
      >
        <h2 id="recipe-steps-heading" className="text-lg font-semibold">
          Kroki <span aria-hidden="true">*</span>
        </h2>
        <FieldError id={fieldId("steps")} message={fieldErrors.steps} />
        {form.steps.map((step, i) => {
          const id = fieldId(`steps.${i}`);
          return (
            <div key={step.key} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id}>Krok {i + 1}</Label>
                {form.steps.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
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
          className="self-start"
          disabled={form.steps.length >= MAX_STEPS}
          onClick={actions.addStep}
        >
          <Plus aria-hidden="true" />
          Dodaj krok
        </Button>
      </section>

      <section
        aria-labelledby="recipe-extra-heading"
        className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-4 sm:p-6"
      >
        <h2 id="recipe-extra-heading" className="text-lg font-semibold">
          Dodatkowe informacje
        </h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Rodzaj</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {RECIPE_KINDS.map((kind) => {
              const id = fieldId(`kinds-${kind.replaceAll(" ", "-")}`);
              return (
                <div key={kind} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={form.kinds.includes(kind)}
                    onCheckedChange={(checked) => {
                      actions.toggleKind(kind, checked === true);
                    }}
                  />
                  <Label htmlFor={id} className="font-normal">
                    {kind}
                  </Label>
                </div>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUMBER_FIELDS.map(({ field, label }) => {
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

      <div className="flex flex-col gap-3">
        <ServerError message={serverError} />
        <Button type="submit" disabled={submitting} aria-busy={submitting} className="w-full sm:w-auto sm:self-start">
          {submitting ? "Zapisywanie…" : "Zapisz przepis"}
        </Button>
      </div>
    </form>
  );
}
