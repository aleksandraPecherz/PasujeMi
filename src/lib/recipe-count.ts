const RECIPE_FORMS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "przepis", few: "przepisy" };
const pluralRules = new Intl.PluralRules("pl");

/** "Znaleziono N przepisów" for the counter above the recipe list; CLDR `many`/`other` take "przepisów". */
export function recipeCountLabel(total: number): string {
  const noun = RECIPE_FORMS[pluralRules.select(total)] ?? "przepisów";
  return `Znaleziono ${String(total)} ${noun}`;
}
