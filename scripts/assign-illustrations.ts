// One-off assignment of illustrations to existing recipes: scripts/illustration-map.json (recipe name -> illustration key).
// Preview by default (reads the database, writes nothing); --write sets illustration, and only where it is still empty.
// Usage: npm run assign-illustrations -- --check                       offline: the map against data/recipes.xlsx
//        SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run assign-illustrations      preview against the database
//        … npm run assign-illustrations:write                          write
// The service role key bypasses RLS and the column grants (authenticated cannot write recipes.illustration): it is read
// from the shell only and never printed. Needs the 20261027120000 migration. Names are matched like the importer does
// (normalizeRecipeName). Missing or ambiguous names block the write (--allow-missing proceeds without the missing ones,
// e.g. on a local database that holds only the seed recipes); an existing assignment is never overwritten.
// Plan: context/changes/soft-modern-pantry-recipes/plan.md; runbook: context/changes/soft-modern-pantry-recipes/runbook.md.
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { ILLUSTRATION_KEYS } from "@/lib/recipes/illustrations";
import { normalizeRecipeName } from "./import-recipes/parse";

const PAGE_SIZE = 1000;
const DEFAULT_FILE = "data/recipes.xlsx";
const MAP_FILE = "scripts/illustration-map.json";

interface Args {
  check: boolean;
  write: boolean;
  allowMissing: boolean;
  file: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { check: false, write: false, allowMissing: false, file: DEFAULT_FILE };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") args.check = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--allow-missing") args.allowMissing = true;
    else if (arg === "--file") args.file = argv[++i] ?? "";
    else throw new Error(`Nieznany argument: ${arg}`);
  }
  if (args.file === "") throw new Error("Brak ścieżki po --file.");
  if (args.check && args.write) throw new Error("--check nie łączy się z --write.");
  return args;
}

const section = (title: string, lines: string[]) => {
  if (lines.length > 0) console.log(`\n${title}\n${lines.map((line) => `  ${line}`).join("\n")}`);
};

/** The map keyed by normalized name; problems (empty key, unknown key, two names that normalize alike) go to `errors`. */
function loadMap(errors: string[]): Map<string, { name: string; key: string }> {
  const raw = JSON.parse(fs.readFileSync(MAP_FILE, "utf8")) as Record<string, string>;
  const entries = new Map<string, { name: string; key: string }>();
  for (const [name, key] of Object.entries(raw)) {
    if (!ILLUSTRATION_KEYS.includes(key)) errors.push(`mapa: „${name}” ma nieznaną ilustrację „${key}”`);
    const normalized = normalizeRecipeName(name);
    const duplicate = entries.get(normalized);
    if (duplicate) errors.push(`mapa: „${name}” i „${duplicate.name}” to ta sama nazwa po normalizacji`);
    else entries.set(normalized, { name, key });
  }
  return entries;
}

async function readSheetNames(file: string): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.worksheets.at(0);
  if (!sheet) throw new Error(`Plik ${file} nie ma arkusza.`);
  const names: string[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const name = sheet.getRow(rowNumber).getCell(1).text.trim();
    if (name !== "") names.push(name);
  }
  return names;
}

/** Offline check: every recipe of the sheet has exactly one map entry and the map holds nothing else. */
async function check(file: string): Promise<number> {
  const errors: string[] = [];
  const entries = loadMap(errors);
  const sheetNames = await readSheetNames(file);
  const seen = new Map<string, string>();
  for (const name of sheetNames) {
    const normalized = normalizeRecipeName(name);
    const earlier = seen.get(normalized);
    if (earlier) errors.push(`arkusz: „${name}” powtarza „${earlier}”`);
    else seen.set(normalized, name);
    if (!entries.has(normalized)) errors.push(`arkusz: „${name}” nie ma wpisu w mapie`);
  }
  for (const [normalized, { name }] of entries) {
    if (!seen.has(normalized)) errors.push(`mapa: „${name}” nie ma przepisu w arkuszu`);
  }
  const perKey = new Map<string, number>();
  for (const { key } of entries.values()) perKey.set(key, (perKey.get(key) ?? 0) + 1);
  section("Błędy:", errors);
  console.log(
    `\narkusz ${sheetNames.length}, mapa ${entries.size}, błędy ${errors.length}\n` +
      [...perKey].map(([key, count]) => `${key} ${count}`).join(", "),
  );
  return errors.length > 0 ? 1 : 0;
}

interface Row {
  id: string;
  name: string;
  illustration: string | null;
}

async function fetchRecipes(supabase: SupabaseClient): Promise<Row[]> {
  const rows: Row[] = [];
  // Keyset paging by id, ending on an empty page: the server may cap rows below PAGE_SIZE.
  let lastId: string | null = null;
  for (;;) {
    let query = supabase
      .from("recipes")
      .select("id, name, illustration")
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (lastId !== null) query = query.gt("id", lastId);
    const { data, error } = await query.overrideTypes<Row[], { merge: false }>();
    if (error) {
      if (error.code === "42703" || error.message.includes("illustration")) {
        throw new Error("Brak kolumny recipes.illustration: najpierw zastosuj migrację 20261027120000.");
      }
      throw error;
    }
    if (data.length === 0) return rows;
    rows.push(...data);
    lastId = data[data.length - 1].id;
  }
}

async function run(args: Args): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Ustaw zmienne SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY.");
  }
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(`Baza: ${new URL(url).host}\nTryb: ${args.write ? "zapis" : "podgląd"}`);

  const errors: string[] = [];
  const entries = loadMap(errors);
  const rows = await fetchRecipes(supabase);
  const byName = new Map<string, Row[]>();
  for (const row of rows) {
    const normalized = normalizeRecipeName(row.name);
    byName.set(normalized, [...(byName.get(normalized) ?? []), row]);
  }

  const toAssign: { row: Row; key: string }[] = [];
  const missing: string[] = [];
  const ambiguous: string[] = [];
  const alreadySet: string[] = [];
  const different: string[] = [];
  for (const [normalized, { name, key }] of entries) {
    const matches = byName.get(normalized) ?? [];
    if (matches.length === 0) missing.push(`„${name}” (${key})`);
    else if (matches.length > 1) ambiguous.push(`„${name}”: ${matches.length} przepisy o tej nazwie`);
    else if (matches[0].illustration === null) toAssign.push({ row: matches[0], key });
    else if (matches[0].illustration === key) alreadySet.push(name);
    else different.push(`„${name}”: w bazie ${matches[0].illustration}, mapa ${key} (zostaje bez zmian)`);
  }
  const outsideMap = rows.filter((row) => !entries.has(normalizeRecipeName(row.name))).map((row) => `„${row.name}”`);

  section("Błędy:", errors);
  section("Niejednoznaczne nazwy w bazie (pominięte):", ambiguous);
  section("Brak w bazie:", missing);
  section("Już przypisane inaczej niż w mapie (nie nadpisuję):", different);
  section("Przepisy w bazie bez wpisu w mapie (obraz zastępczy):", outsideMap);
  console.log(
    `\ndo przypisania ${toAssign.length}, już ustawione ${alreadySet.length}, inne przypisanie ${different.length}, ` +
      `brak w bazie ${missing.length}, niejednoznaczne ${ambiguous.length}, błędy ${errors.length}`,
  );

  if (errors.length > 0 || ambiguous.length > 0) return 1;
  if (missing.length > 0 && !args.allowMissing) {
    if (args.write) console.log("Zapis wstrzymany: brakuje przepisów z mapy (--allow-missing pomija brakujące).");
    return args.write ? 1 : 0;
  }
  if (!args.write) return 0;
  if (toAssign.length === 0) {
    console.log("assigned 0");
    return 0;
  }

  // One update per illustration; the empty-value guard keeps the write from overwriting an assignment made meanwhile.
  const perKey = new Map<string, string[]>();
  for (const { row, key } of toAssign) perKey.set(key, [...(perKey.get(key) ?? []), row.id]);
  let assigned = 0;
  for (const [key, ids] of perKey) {
    const { data, error } = await supabase
      .from("recipes")
      .update({ illustration: key })
      .in("id", ids)
      .is("illustration", null)
      .select("id");
    if (error) throw error;
    assigned += data.length;
  }
  console.log(`assigned ${assigned} of ${toAssign.length}`);
  return assigned === toAssign.length ? 0 : 1;
}

try {
  const args = parseArgs(process.argv.slice(2));
  process.exitCode = args.check ? await check(args.file) : await run(args);
} catch (error) {
  console.error("assign-illustrations failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
