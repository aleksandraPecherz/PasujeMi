// Local check of the illustration trigger (supabase/migrations/20261028120000_auto_recipe_illustration.sql): the real
// results of the database for the shared cases (src/lib/recipes/illustrationCases.json) against pickIllustration, plus how
// a signed-in user is treated: the trigger sets the key, a direct write of recipes.illustration is refused, an existing
// key survives a rename, RLS still keeps other users out. It refuses any database that is not local and removes every row
// and user it creates (marked rows are also swept at the start, in case an earlier run was interrupted).
// Usage, after `supabase start` and `supabase migration up --local`:
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_KEY=<anon key> SUPABASE_SERVICE_ROLE_KEY=<service role key> \
//     npm run check:illustration-rules
// (`supabase status -o env` prints API_URL, ANON_KEY and SERVICE_ROLE_KEY.) The keys are read from the shell and never printed.
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pickIllustration } from "@/lib/recipes/illustrationRules";

const CASES_FILE = "src/lib/recipes/illustrationCases.json";
const MARKER = "__check-illustration-rules__";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
// Postgres "insufficient_privilege": a refused column grant and a refused row-level security check both report it.
const DENIED = "42501";

interface Row {
  id: string;
  name: string;
  illustration: string | null;
}

const results: { ok: boolean; line: string }[] = [];
const check = (ok: boolean, name: string, detail = "") => {
  results.push({ ok, line: `${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` (${detail})` : ""}` });
};

const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };

function recipe(name: string, authorId?: string) {
  return {
    name,
    steps: [MARKER],
    ingredients: [{ name: "x", product: "x", amount: null, unit: null, substitutes: [] }],
    kinds: [],
    ...(authorId && { author_id: authorId }),
  };
}

async function sweep(admin: SupabaseClient) {
  const { error } = await admin.from("recipes").delete().contains("steps", [MARKER]);
  if (error) throw error;
}

async function signedIn(url: string, anonKey: string, admin: SupabaseClient, userIds: string[]) {
  const email = `illustration-check-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userIds.push(created.data.user.id);
  const client = createClient(url, anonKey, authOptions);
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error) throw session.error;
  return { client, id: created.data.user.id, token: session.data.session.access_token };
}

async function run(): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Ustaw SUPABASE_URL, SUPABASE_KEY i SUPABASE_SERVICE_ROLE_KEY lokalnej bazy.");
  }
  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`Odmowa: ${hostname} nie jest lokalną bazą (dozwolone: ${[...LOCAL_HOSTS].join(", ")}).`);
  }
  console.log(`Baza: ${hostname}`);

  const cases = JSON.parse(fs.readFileSync(CASES_FILE, "utf8")) as { name: string; key: string | null }[];
  const admin = createClient(url, serviceKey, authOptions);
  const userIds: string[] = [];

  try {
    await sweep(admin);

    // 1. The shared cases through the trigger (service role insert, illustration left empty).
    const inserted = await admin
      .from("recipes")
      .insert(cases.map(({ name }) => recipe(name)))
      .select("id, name, illustration")
      .overrideTypes<Row[], { merge: false }>();
    if (inserted.error) throw inserted.error;
    const byName = new Map(inserted.data.map((row) => [row.name, row.illustration]));
    const mismatches = cases
      .filter(({ name, key }) => byName.get(name) !== key || pickIllustration(name) !== key)
      .map(
        ({ name, key }) =>
          `„${name}”: oczekiwano ${String(key)}, baza ${String(byName.get(name))}, TS ${String(pickIllustration(name))}`,
      );
    check(mismatches.length === 0, `SQL i TS zgodne dla ${cases.length} przypadków`, mismatches.join("; "));

    // 2. A signed-in user: the trigger fills the key, the grants still refuse a direct write.
    const owner = await signedIn(url, anonKey, admin, userIds);
    const other = await signedIn(url, anonKey, admin, userIds);

    const own = await owner.client
      .from("recipes")
      .insert(recipe("Zupa dyniowa", owner.id))
      .select("id, name, illustration")
      .single()
      .overrideTypes<Row, { merge: false }>();
    check(
      own.error === null && own.data.illustration === "zupa",
      "użytkownik: trigger nadaje klucz przy dodaniu",
      own.error?.message ?? String(own.data?.illustration),
    );
    const ownId = own.data?.id ?? "";

    const direct = await owner.client
      .from("recipes")
      .insert({ ...recipe("Zupa z kluskami", owner.id), illustration: "kanapka" });
    check(
      direct.error?.code === DENIED,
      "użytkownik: bezpośredni zapis illustration przy dodaniu odrzucony",
      String(direct.error?.code),
    );

    const directUpdate = await owner.client.from("recipes").update({ illustration: "kanapka" }).eq("id", ownId);
    check(
      directUpdate.error?.code === DENIED,
      "użytkownik: bezpośredni zapis illustration przy edycji odrzucony",
      String(directUpdate.error?.code),
    );

    // 3. An existing key is kept on rename; an empty one is filled by the new name.
    const assigned = await admin.from("recipes").update({ illustration: "talerz" }).eq("id", ownId);
    if (assigned.error) throw assigned.error;
    const renamed = await owner.client
      .from("recipes")
      .update({ name: "Kanapka z serem" })
      .eq("id", ownId)
      .select("id, name, illustration")
      .single()
      .overrideTypes<Row, { merge: false }>();
    check(
      renamed.error === null && renamed.data.illustration === "talerz",
      "zmiana nazwy zachowuje istniejący klucz",
      renamed.error?.message ?? String(renamed.data?.illustration),
    );

    const empty = await owner.client
      .from("recipes")
      .insert(recipe("Zakwas", owner.id))
      .select("id, name, illustration")
      .single()
      .overrideTypes<Row, { merge: false }>();
    check(
      empty.error === null && empty.data.illustration === null,
      "nieznana nazwa zostaje bez klucza",
      empty.error?.message ?? String(empty.data?.illustration),
    );
    const filled = await owner.client
      .from("recipes")
      .update({ name: "Pizza z szynką" })
      .eq("id", empty.data?.id ?? "")
      .select("id, name, illustration")
      .single()
      .overrideTypes<Row, { merge: false }>();
    check(
      filled.error === null && filled.data.illustration === "placek",
      "zmiana nazwy nadaje klucz pustemu",
      filled.error?.message ?? String(filled.data?.illustration),
    );

    // 4. RLS is untouched: another user cannot edit or add as someone else; a signed-out client cannot write.
    const foreign = await other.client
      .from("recipes")
      .update({ name: "Zupa cudza" })
      .eq("id", ownId)
      .select("id")
      .overrideTypes<{ id: string }[], { merge: false }>();
    const after = await admin
      .from("recipes")
      .select("name")
      .eq("id", ownId)
      .single()
      .overrideTypes<{ name: string }, { merge: false }>();
    check(
      foreign.error === null && foreign.data.length === 0 && after.data?.name === "Kanapka z serem",
      "RLS: obcy użytkownik nie edytuje cudzego przepisu",
      String(foreign.error?.message),
    );

    const asOther = await other.client.from("recipes").insert(recipe("Zupa podszyta", owner.id));
    check(asOther.error?.code === DENIED, "RLS: nie można dodać przepisu jako ktoś inny", String(asOther.error?.code));

    const anon = createClient(url, anonKey, authOptions);
    const signedOut = await anon.from("recipes").insert(recipe("Zupa anonima"));
    check(signedOut.error !== null, "RLS: niezalogowany nie dodaje przepisu");

    // 5. The trigger function is in a schema the API does not expose.
    const rpc = await fetch(`${url}/rest/v1/rpc/recipes_pick_illustration`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${owner.token}`,
        "Content-Profile": "private",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    check(rpc.status >= 400 && rpc.status < 500, "funkcja triggera niedostępna przez API", `status ${rpc.status}`);
  } finally {
    await sweep(admin).catch((error: unknown) => {
      console.error("sprzątanie przepisów:", error);
    });
    for (const id of userIds) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) console.error("sprzątanie użytkownika:", error.message);
    }
    const left = await admin.from("recipes").select("id", { count: "exact", head: true }).contains("steps", [MARKER]);
    check(left.count === 0, "sprzątanie: po teście nie zostają przepisy testowe", String(left.count));
  }

  for (const { line } of results) console.log(line);
  return results.every(({ ok }) => ok) ? 0 : 1;
}

try {
  process.exitCode = await run();
} catch (error) {
  for (const { line } of results) console.log(line);
  console.error("check-illustration-rules failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
