// Imports data/recipes.xlsx into public.recipes. Preview by default (reads the database, writes nothing); --write inserts.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run import-recipes -- --author-email <e-mail> [--file <path>]
//        … npm run import-recipes:write -- --author-email <e-mail>
// The service role key bypasses RLS: it is read from the shell only and never goes to astro:env, .dev.vars or the
// Worker (AGENTS.md Hard Rules). Idempotent: recipes whose name already exists are skipped, a second write prints
// "inserted 0". All-or-nothing: any error blocks the write, and the new rows go in one insert.
// Rules: docs/reference/recipe-data-contract.md. Plan: context/changes/seed-recipe-import/plan.md.
//
// Produkcja:
// 1. `npx supabase db push --dry-run` on the linked prod project: expect "Remote database is up to date". If it lists
//    migrations (e.g. 20261017120000_add_recipe_author_and_insert.sql), the import waits; `db push` is a separate
//    decision approved by the author.
// 2. The author's account exists in prod.
// 3. Prod SUPABASE_URL and the service role key only in the shell.
// 4. Preview and confirm the list of 12 recalculated kcal. The skipped list must be empty: a skip means a recipe with
//    that name already exists (e.g. added by another user via S-05), so stop and explain each one before writing.
// 5. Write: expect "inserted 76, skipped 0".
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { normalizeRecipeName, parseRecipeRow, type RawRecipeRow, type RowResult } from "./import-recipes/parse";
import { EXPECTED_HEADERS, checkHeaders, readNumericCell, toInsertRow } from "./import-recipes/sheet";

const PAGE_SIZE = 1000;
const DEFAULT_FILE = "data/recipes.xlsx";

interface Args {
  authorEmail: string;
  file: string;
  write: boolean;
}

function parseArgs(argv: string[]): Args {
  let authorEmail = "";
  let file = DEFAULT_FILE;
  let write = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--write") write = true;
    else if (arg === "--author-email") authorEmail = argv[++i] ?? "";
    else if (arg === "--file") file = argv[++i] ?? "";
    else throw new Error(`Nieznany argument: ${arg}`);
  }
  if (authorEmail === "") throw new Error("Brak --author-email <e-mail>.");
  if (file === "") throw new Error("Brak ścieżki po --file.");
  return { authorEmail, file, write };
}

async function readRows(file: string): Promise<RawRecipeRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.worksheets.at(0);
  if (!sheet) throw new Error(`Plik ${file} nie ma arkusza.`);

  const header = sheet.getRow(1);
  const headerError = checkHeaders(EXPECTED_HEADERS.map((_, i) => header.getCell(i + 1).text));
  if (headerError) throw new Error(`Nagłówki pliku nie zgadzają się z kontraktem. ${headerError}`);

  const rows: RawRecipeRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const text = (col: number) => row.getCell(col).text;
    const numeric = (col: number) => readNumericCell(row.getCell(col).value, text(col));
    if (EXPECTED_HEADERS.every((_, i) => text(i + 1).trim() === "")) continue;
    rows.push({
      rowNumber,
      name: text(1),
      prepTimeMin: numeric(2),
      kinds: text(3),
      servings: numeric(4),
      products: text(5),
      kcal: numeric(7),
      proteinG: numeric(8),
      carbsG: numeric(9),
      fatG: numeric(10),
      steps: text(11),
    });
  }
  return rows;
}

async function findAuthorId(supabase: SupabaseClient, email: string): Promise<string> {
  const wanted = email.trim().toLocaleLowerCase("pl");
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLocaleLowerCase("pl") === wanted);
    if (user) return user.id;
    if (data.users.length < PAGE_SIZE) throw new Error(`Nie ma konta ${email}.`);
  }
}

async function fetchExistingNames(supabase: SupabaseClient): Promise<Set<string>> {
  const names = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("recipes")
      .select("name")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .overrideTypes<{ name: string }[], { merge: false }>();
    if (error) throw error;
    for (const row of data) names.add(normalizeRecipeName(row.name));
    if (data.length < PAGE_SIZE) return names;
  }
}

const label = (result: RowResult) => `wiersz ${result.rowNumber} „${result.name}”`;

const section = (title: string, lines: string[]) => {
  if (lines.length > 0) console.log(`\n${title}\n${lines.map((line) => `  ${line}`).join("\n")}`);
};

const macros = (n: { proteinG: number | null; carbsG: number | null; fatG: number | null }) =>
  `${n.proteinG ?? "-"}/${n.carbsG ?? "-"}/${n.fatG ?? "-"}`;

async function main(): Promise<number> {
  const { authorEmail, file, write } = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = (await readRows(file)).map(parseRecipeRow);
  const authorId = await findAuthorId(supabase, authorEmail);
  const existing = await fetchExistingNames(supabase);

  const errors: string[] = [];
  const skipped: RowResult[] = [];
  const toInsert: NonNullable<RowResult["recipe"]>[] = [];
  const firstRowByName = new Map<string, number>();
  for (const result of results) {
    for (const issue of result.issues) errors.push(`${label(result)}: ${issue.path} — ${issue.message}`);
    const key = normalizeRecipeName(result.name);
    const firstRow = firstRowByName.get(key);
    if (firstRow !== undefined) {
      errors.push(`${label(result)}: name — ta sama nazwa co w wierszu ${firstRow}`);
      continue;
    }
    firstRowByName.set(key, result.rowNumber);
    if (existing.has(key)) skipped.push(result);
    else if (result.recipe) toInsert.push(result.recipe);
  }
  const warnings = results.flatMap((r) => r.warnings.map((w) => `${label(r)}: ${w}`));
  const recalculated = results.flatMap((r) => (r.kcalRecalculation ? [{ r, calc: r.kcalRecalculation }] : []));

  section("Błędy:", errors);
  section("Ostrzeżenia o markach:", warnings);
  section(
    "Przeliczone kcal na porcję:",
    recalculated.map(
      ({ r, calc }) =>
        `${label(r)}: ${calc.before.kcal} kcal / ${calc.servings} porcje → ${calc.after.kcal} kcal ` +
        `(B/W/T ${macros(calc.before)} → ${macros(calc.after)})`,
    ),
  );
  section(
    "Pominięte (przepis o tej nazwie już istnieje):",
    skipped.map((r) => label(r)),
  );
  console.log(
    `\ndo zapisu ${toInsert.length}, pominięte ${skipped.length}, błędy ${errors.length}, ostrzeżenia ${warnings.length}`,
  );

  if (errors.length > 0) return 1;
  if (!write) return 0;
  if (toInsert.length === 0) {
    console.log(`inserted 0, skipped ${skipped.length}`);
    return 0;
  }
  const { error } = await supabase.from("recipes").insert(toInsert.map((recipe) => toInsertRow(recipe, authorId)));
  if (error) throw error;
  console.log(`inserted ${toInsert.length}, skipped ${skipped.length}`);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error("import-recipes failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
