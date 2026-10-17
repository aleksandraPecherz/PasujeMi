import { Plus, X } from "lucide-react";
import type { OptionField, OptionRow, IngredientRow, RecipeFormActions } from "@/components/hooks/useRecipeForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_AMOUNT, MAX_INGREDIENT_TEXT_LENGTH, MAX_SUBSTITUTES, MAX_UNIT_LENGTH } from "@/lib/recipes/limits";

/** Id of the input for a validator path, e.g. `ingredients.0.name` → `recipe-ingredients-0-name`. */
export function fieldId(path: string): string {
  return `recipe-${path.replaceAll(".", "-")}`;
}

/** Props that tie an input to its error message; `hintId` adds a permanent hint to the description. */
export function errorProps(id: string, error: string | undefined, hintId?: string) {
  const describedBy = [error ? `${id}-error` : null, hintId ?? null].filter(Boolean).join(" ");
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy === "" ? undefined : describedBy,
  };
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} className="text-destructive text-sm">
      {message}
    </p>
  );
}

export const UNIT_LIST_ID = "recipe-units";
export const UNIT_SUGGESTIONS = ["g", "sztuka", "łyżka", "łyżeczka", "szczypta", "szklanka"];

interface OptionFieldsProps {
  /** Validator path of the option, e.g. `ingredients.0` or `ingredients.0.substitutes.1`. */
  path: string;
  row: OptionRow;
  /** Screen-reader context appended to the labels, e.g. "składnika 1". */
  context: string;
  errors: Record<string, string>;
  onChange: (field: OptionField, value: string) => void;
}

function OptionFields({ path, row, context, errors, onChange }: OptionFieldsProps) {
  const nameId = fieldId(`${path}.name`);
  const productId = fieldId(`${path}.product`);
  const amountId = fieldId(`${path}.amount`);
  const unitId = fieldId(`${path}.unit`);
  const nameError = errors[`${path}.name`];
  const productError = errors[`${path}.product`];
  const amountError = errors[`${path}.amount`];
  const unitError = errors[`${path}.unit`];

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={nameId}>
          Nazwa<span className="sr-only"> {context}</span> <span aria-hidden="true">*</span>
        </Label>
        <Input
          id={nameId}
          value={row.name}
          maxLength={MAX_INGREDIENT_TEXT_LENGTH}
          autoComplete="off"
          aria-required="true"
          placeholder="np. Mleko 1,5%"
          onChange={(e) => {
            onChange("name", e.target.value);
          }}
          {...errorProps(nameId, nameError)}
        />
        <FieldError id={nameId} message={nameError} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={productId}>
          Produkt do dopasowania<span className="sr-only"> {context}</span>
        </Label>
        <Input
          id={productId}
          value={row.product}
          maxLength={MAX_INGREDIENT_TEXT_LENGTH}
          autoComplete="off"
          placeholder="np. mleko"
          onChange={(e) => {
            onChange("product", e.target.value);
          }}
          {...errorProps(productId, productError, `${productId}-hint`)}
        />
        <p id={`${productId}-hint`} className="text-muted-foreground text-xs">
          Ogólna nazwa bez marki; z niej liczymy dopasowanie do spiżarki.
        </p>
        <FieldError id={productId} message={productError} />
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:col-span-2 sm:max-w-sm">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={amountId}>
            Ilość<span className="sr-only"> {context}</span>
          </Label>
          <Input
            id={amountId}
            value={row.amount}
            inputMode="decimal"
            autoComplete="off"
            placeholder={`do ${MAX_AMOUNT}`}
            onChange={(e) => {
              onChange("amount", e.target.value);
            }}
            {...errorProps(amountId, amountError)}
          />
          <FieldError id={amountId} message={amountError} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={unitId}>
            Jednostka<span className="sr-only"> {context}</span>
          </Label>
          <Input
            id={unitId}
            value={row.unit}
            list={UNIT_LIST_ID}
            maxLength={MAX_UNIT_LENGTH}
            autoComplete="off"
            placeholder="np. g"
            onChange={(e) => {
              onChange("unit", e.target.value);
            }}
            {...errorProps(unitId, unitError)}
          />
          <FieldError id={unitId} message={unitError} />
        </div>
      </div>
    </div>
  );
}

interface IngredientFieldsProps {
  index: number;
  row: IngredientRow;
  errors: Record<string, string>;
  actions: RecipeFormActions;
  /** The last ingredient cannot be removed. */
  canRemove: boolean;
}

export function IngredientFields({ index, row, errors, actions, canRemove }: IngredientFieldsProps) {
  const path = `ingredients.${index}`;
  const number = index + 1;
  const substitutesError = errors[`${path}.substitutes`];

  return (
    <fieldset className="border-border flex min-w-0 flex-col gap-4 rounded-xl border p-3 sm:p-4">
      <legend className="px-1 text-sm font-medium">Składnik {number}</legend>
      <OptionFields
        path={path}
        row={row}
        context={`składnika ${number}`}
        errors={errors}
        onChange={(field, value) => {
          actions.setIngredient(index, field, value);
        }}
      />

      {row.substitutes.map((substitute, j) => (
        <div key={substitute.key} className="bg-muted/40 flex min-w-0 flex-col gap-3 rounded-lg p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm font-medium">Zamiennik {j + 1}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Usuń zamiennik ${substitute.name.trim() || j + 1} składnika ${number}`}
              onClick={() => {
                actions.removeSubstitute(index, j);
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <OptionFields
            path={`${path}.substitutes.${j}`}
            row={substitute}
            context={`zamiennika ${j + 1} składnika ${number}`}
            errors={errors}
            onChange={(field, value) => {
              actions.setSubstitute(index, j, field, value);
            }}
          />
        </div>
      ))}
      <FieldError id={fieldId(`${path}.substitutes`)} message={substitutesError} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={row.substitutes.length >= MAX_SUBSTITUTES}
          onClick={() => {
            actions.addSubstitute(index);
          }}
        >
          <Plus aria-hidden="true" />
          Dodaj zamiennik
        </Button>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Usuń składnik ${row.name.trim() || number}`}
            onClick={() => {
              actions.removeIngredient(index);
            }}
          >
            <X aria-hidden="true" />
            Usuń składnik
          </Button>
        )}
      </div>
    </fieldset>
  );
}
