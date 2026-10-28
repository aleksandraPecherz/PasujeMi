/**
 * Name rules that pick an illustration for a recipe that has none. The database applies the same ordered list in a trigger
 * (`supabase/migrations/20261028120000_auto_recipe_illustration.sql`); this copy only previews it in the form. Both sides
 * fold Polish letters to ASCII and lower-case the name first, so a pattern is plain `a-z0-9` and means the same in
 * JavaScript and in Postgres. A stem matches at the start of a word (`WORD_START`), never inside one.
 */
const FROM = "ĄĆĘŁŃÓŚŹŻąćęłńóśźż";
const TO = "ACELNOSZZacelnoszz";
const FOLDED_LETTERS = /[ĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g;

const WORD_START = "(?:^|[^a-z0-9])";
const WORD_END = "(?:$|[^a-z0-9])";

/** First match wins: a container or format (sandwich, soup, salad) outranks the dish family, ingredient words come last. */
export const ILLUSTRATION_RULES = [
  { key: "kanapka-jajko", pattern: `${WORD_START}(?:kanap|grzank|tost)[a-z0-9]*.*[^a-z0-9]jaj` },
  { key: "kanapka", pattern: `${WORD_START}(?:kanap|grzank|tost|bruschett|sandwich|bagiet)` },
  { key: "wrap", pattern: `${WORD_START}(?:wrap|tortill|burrit|quesadill|tacos)` },
  { key: "salatka", pattern: `${WORD_START}salatk` },
  { key: "szklanka", pattern: `${WORD_START}(?:koktajl|smoothie|shake|lemoniad)` },
  { key: "placek", pattern: `${WORD_START}(?:pizz|focacc|flatbread)` },
  { key: "zupa", pattern: `${WORD_START}(?:zup|rosol|barszcz|zurek|chlodnik|gazpacho|bulion|flaki|krem${WORD_END})` },
  {
    key: "makaron",
    pattern: `${WORD_START}(?:makaron|spaghetti|lasagn|penne|tagliatell|fusilli|carbonara|ravioli|gnocchi)`,
  },
  {
    key: "deser",
    pattern: `${WORD_START}(?:ciast|tart[aey]?${WORD_END}|tartaletk|babeczk|muffin|gofr|placusz|pancake|nalesn|batonik|brownie|sernik|deser|tiramisu|torcik|tort[ay]?${WORD_END})`,
  },
  { key: "slodka-miska", pattern: `${WORD_START}(?:owsiank|pudding|granol|komosank|porridge|jaglank|musli)` },
  {
    key: "miska",
    pattern: `${WORD_START}(?:curry|chilli|chili|dal${WORD_END}|gulasz|jednogarnk|leczo|bowl|risotto|pilaw|shakshuk)`,
  },
  {
    key: "talerz",
    pattern: `${WORD_START}(?:kurczak|indyk|wolowin|wieprzow|schab|poledwic|kotlet|golabk|pieczen|losos|dorsz|ryb[aey]?${WORD_END}|sledz|makrel|pstrag|tunczyk|krewetk|pierog|jajecznic|omlet|sniadanie|ziemniak|stek|burger|zeberk|pulpet|klops|szynk|boczek)`,
  },
] as const;

/** The name as the rules see it: Polish letters folded to ASCII, then lower-cased. */
export function foldName(name: string): string {
  return name.replace(FOLDED_LETTERS, (letter) => TO.charAt(FROM.indexOf(letter))).toLowerCase();
}

/** The illustration key for a recipe name; `null` when no rule matches, so the caller shows the placeholder. */
export function pickIllustration(name: string): string | null {
  const folded = foldName(name);
  return ILLUSTRATION_RULES.find((rule) => new RegExp(rule.pattern, "s").test(folded))?.key ?? null;
}

/** The Postgres side: the characters to translate, and the SQL `case` the migration must contain, line by line. */
export const FOLD_FROM = FROM;
export const FOLD_TO = TO;
export function ruleToSql(rule: { key: string; pattern: string }): string {
  return `when n ~ '${rule.pattern}' then '${rule.key}'`;
}
