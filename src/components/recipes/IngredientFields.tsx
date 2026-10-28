import { ArrowLeftRight, ChevronDown, ChevronUp, CircleAlert, Plus, Trash2, X } from "lucide-react";
import type { OptionField, OptionRow, IngredientRow, RecipeFormActions } from "@/components/hooks/useRecipeForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_AMOUNT, MAX_INGREDIENT_TEXT_LENGTH, MAX_SUBSTITUTES, MAX_UNIT_LENGTH } from "@/lib/recipes/limits";
import { cn } from "@/lib/utils";

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
    <p id={`${id}-error`} className="text-destructive flex items-start gap-1.5 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
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
  /** `false`: from `md` up the hint is read by screen readers only; the row shows it beside the substitutes button. */
  inlineHint?: boolean;
}

/** Name, product, amount and unit: stacked on the phone (amount and unit side by side), one row from `md` up. */
function OptionFields({ path, row, context, errors, onChange, inlineHint = true }: OptionFieldsProps) {
  const nameId = fieldId(`${path}.name`);
  const productId = fieldId(`${path}.product`);
  const amountId = fieldId(`${path}.amount`);
  const unitId = fieldId(`${path}.unit`);
  const nameError = errors[`${path}.name`];
  const productError = errors[`${path}.product`];
  const amountError = errors[`${path}.amount`];
  const unitError = errors[`${path}.unit`];

  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-12 md:items-start">
      <div className="flex min-w-0 flex-col gap-1.5 md:col-span-4">
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
      <div className="flex min-w-0 flex-col gap-1.5 md:col-span-4">
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
        <p id={`${productId}-hint`} className={cn("text-muted-foreground text-xs", !inlineHint && "md:sr-only")}>
          Puste = weźmiemy z nazwy. Po nim szukamy w spiżarce.
        </p>
        <FieldError id={productId} message={productError} />
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 md:col-span-4 md:items-start">
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
  /** Phone: the open ingredient shows its fields, the others a summary. From `md` up the fields are always shown. */
  expanded: boolean;
  substitutesOpen: boolean;
  onToggle: () => void;
  onToggleSubstitutes: () => void;
}

function summaryOf(row: IngredientRow): string {
  const amount = [row.amount.trim(), row.unit.trim()].filter(Boolean).join(" ");
  const product = row.product.trim();
  return [amount, product ? `szukamy: ${product}` : ""].filter(Boolean).join(" · ");
}

function NumberBadge({ number, className }: { number: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
        className,
      )}
    >
      {number}
    </span>
  );
}

export function IngredientFields({
  index,
  row,
  errors,
  actions,
  canRemove,
  expanded,
  substitutesOpen,
  onToggle,
  onToggleSubstitutes,
}: IngredientFieldsProps) {
  const path = `ingredients.${index}`;
  const number = index + 1;
  const substitutesError = errors[`${path}.substitutes`];
  const panelId = `${fieldId(path)}-panel`;
  const substitutesPanelId = `${fieldId(path)}-substitutes-panel`;
  const ownErrors = Object.keys(errors).filter((key) => key === path || key.startsWith(`${path}.`));
  const hasSubstituteErrors = ownErrors.some((key) => key.startsWith(`${path}.substitutes`));
  const hasErrors = ownErrors.length > 0;
  const name = row.name.trim();
  const summary = summaryOf(row);

  return (
    <div
      role="group"
      aria-label={`Składnik ${number}`}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border p-2 md:flex-row md:items-start md:gap-3 md:p-4",
        hasErrors ? "border-destructive" : expanded ? "border-primary/40 md:border-border" : "border-border",
      )}
    >
      {/* Phone: a header row with the toggle and the trash button. From `md` up the header dissolves (`contents`)
          and the badge, the fields and the trash button sit in one row (D04). */}
      <div className="flex items-center gap-2 md:contents">
        {/* The toggle is display:none from `md` up, so Tab cannot reach it there. */}
        <Button
          type="button"
          variant="ghost"
          aria-expanded={expanded}
          aria-controls={panelId}
          className="h-auto min-w-0 flex-1 justify-start gap-3 px-1 py-1 text-left whitespace-normal md:hidden"
          onClick={onToggle}
        >
          <NumberBadge number={number} />
          <span className="flex min-w-0 flex-1 flex-col">
            {expanded ? (
              <span className="text-muted-foreground text-sm font-medium">Składnik {number}</span>
            ) : (
              <>
                <span className={cn("truncate text-base font-semibold", !name && "text-muted-foreground")}>
                  {name || "Nowy składnik"}
                </span>
                {summary && <span className="text-muted-foreground truncate text-sm font-normal">{summary}</span>}
                {hasErrors && (
                  <span className="text-destructive flex items-center gap-1 text-sm font-normal">
                    <CircleAlert aria-hidden="true" className="size-4" />
                    Popraw pola w tym składniku
                  </span>
                )}
              </>
            )}
          </span>
          {expanded ? (
            <span className="bg-muted text-foreground flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm">
              Zwiń
              <ChevronUp aria-hidden="true" />
            </span>
          ) : (
            <ChevronDown aria-hidden="true" className="text-muted-foreground" />
          )}
        </Button>
        {/* Level with the inputs: a spacer made of the label classes, then a box as high as an input (h-12). */}
        <div className="hidden md:order-1 md:flex md:flex-col md:gap-1.5">
          <span aria-hidden="true" className="invisible text-sm leading-none">
            Nazwa
          </span>
          <span className="flex h-12 items-center">
            <NumberBadge number={number} />
          </span>
        </div>
        {canRemove && (
          <div className="shrink-0 md:order-3 md:flex md:flex-col md:gap-1.5">
            <span aria-hidden="true" className="invisible hidden text-sm leading-none md:block">
              Nazwa
            </span>
            <span className="flex items-center md:h-12">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Usuń składnik ${name || number}`}
                onClick={() => {
                  actions.removeIngredient(index);
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </span>
          </div>
        )}
      </div>

      {/* Collapsed on the phone = display:none (out of the tab order), but still mounted: typed values and ids stay. */}
      <div
        id={panelId}
        className={cn(
          "min-w-0 flex-col gap-4 px-1 pb-1 md:order-2 md:flex md:flex-1 md:gap-3 md:p-0",
          expanded ? "flex" : "hidden",
        )}
      >
        <OptionFields
          path={path}
          row={row}
          context={`składnika ${number}`}
          inlineHint={false}
          errors={errors}
          onChange={(field, value) => {
            actions.setIngredient(index, field, value);
          }}
        />

        <div className="flex flex-col md:grid md:grid-cols-12 md:items-center md:gap-3">
          <div className="md:col-span-4">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              aria-expanded={substitutesOpen}
              aria-controls={substitutesPanelId}
              className="w-full justify-between text-sm md:h-9 md:w-auto"
              onClick={onToggleSubstitutes}
            >
              <span className="flex items-center gap-2">
                <ArrowLeftRight aria-hidden="true" />
                Zamienniki{row.substitutes.length > 0 && ` · ${row.substitutes.length}`}
                {!substitutesOpen && hasSubstituteErrors && (
                  <>
                    <CircleAlert aria-hidden="true" className="text-destructive" />
                    <span className="sr-only">(są błędy)</span>
                  </>
                )}
              </span>
              {substitutesOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </Button>
          </div>
          {/* Desktop: the product hint, beside the button instead of a line of its own (the field keeps it for screen readers). */}
          <p aria-hidden="true" className="text-muted-foreground hidden text-xs md:col-span-4 md:block">
            Puste = weźmiemy z nazwy. Po nim szukamy w spiżarce.
          </p>
        </div>

        <div id={substitutesPanelId} className={cn("min-w-0 flex-col gap-3", substitutesOpen ? "flex" : "hidden")}>
          {row.substitutes.map((substitute, j) => (
            <div key={substitute.key} className="bg-muted/40 flex min-w-0 flex-col gap-3 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm font-medium">Zamiennik {j + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
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
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={row.substitutes.length >= MAX_SUBSTITUTES}
            onClick={() => {
              actions.addSubstitute(index);
            }}
          >
            <Plus aria-hidden="true" />
            Dodaj zamiennik
          </Button>
        </div>
      </div>
    </div>
  );
}
