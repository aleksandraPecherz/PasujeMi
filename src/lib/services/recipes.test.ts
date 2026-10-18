import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { MATCH_KEYS_VERSION, computeMatchKeys } from "@/lib/matching";
import { MAX_RECOMPUTED_RECIPES } from "@/lib/recipes/limits";
import type { NewRecipe } from "@/lib/recipes/validate";
import { deleteRecipe, getRecipe, listRecipes, matchRecipes, updateRecipe } from "@/lib/services/recipes";
import type { MatchKeys, RecipeIngredient } from "@/types";

/** PostgREST `max_rows` (supabase/config.toml): a request never returns more rows than this. */
const MAX_ROWS = 1000;

type Row = Record<string, unknown> & { id: string };

interface Call {
  op: "select" | "update" | "delete";
  /** The values sent by `update`. */
  payload: Record<string, unknown> | null;
  select: string;
  count: string | null;
  filters: string[];
  range: [number, number] | null;
}

type Result =
  | { data: Row[]; error: null; count: number | null }
  | { data: null; error: { code: string; message: string }; count: null };

/**
 * Minimal stand-in for the PostgREST query builder: `select` (with `{ count }`), `order("name" | "id")` applied in
 * call order, `range`, `or` (`col.is.null`, `col.neq.value`), `eq`, `maybeSingle`, `in("id", …)`, `update(values)` /
 * `delete()` followed by `select` (they return the rows matching the filters, as when RLS lets them through) and
 * `overrideTypes`. It caps every
 * response at MAX_ROWS like the real server and projects the selected columns, so a query that forgets a column or a
 * page fails the test. `count` is the number of filtered rows before `range`, sent only when the query asks for it
 * and `omitCount` is off (a server that sends no total). With a count, a range that starts past it fails with
 * PGRST103 (416), as on the real server.
 */
function fakeClient(
  rows: Row[],
  {
    shuffleIn = false,
    omitCount = false,
    afterKeyQuery,
  }: { shuffleIn?: boolean; omitCount?: boolean; afterKeyQuery?: () => void } = {},
) {
  const calls: Call[] = [];

  class Query implements PromiseLike<Result> {
    private readonly call: Call;
    private predicates: ((row: Row) => boolean)[] = [];
    private orderBy: string[] = [];
    private single = false;

    constructor(
      columns: string,
      options?: { count?: string },
      op: Call["op"] = "select",
      payload: Record<string, unknown> | null = null,
    ) {
      this.call = { op, payload, select: columns, count: options?.count ?? null, filters: [], range: null };
      calls.push(this.call);
    }

    /** Chosen after `update` / `delete`: the columns to return. */
    select(columns: string) {
      this.call.select = columns;
      return this;
    }

    order(column: string) {
      if (column !== "name" && column !== "id") throw new Error(`unexpected order by ${column}`);
      this.orderBy.push(column);
      return this;
    }

    range(from: number, to: number) {
      this.call.range = [from, to];
      return this;
    }

    or(filter: string) {
      this.call.filters.push(`or:${filter}`);
      const conditions = filter.split(",").map((condition) => {
        const [column, operator, value] = condition.split(".");
        if (operator === "is" && value === "null") return (row: Row) => row[column] === null;
        if (operator === "neq") return (row: Row) => row[column] !== null && JSON.stringify(row[column]) !== value;
        throw new Error(`unexpected filter ${condition}`);
      });
      this.predicates.push((row) => conditions.some((condition) => condition(row)));
      return this;
    }

    eq(column: string, value: string) {
      this.call.filters.push(`eq:${column}`);
      this.predicates.push((row) => row[column] === value);
      return this;
    }

    maybeSingle() {
      this.single = true;
      return this;
    }

    in(column: string, values: string[]) {
      this.call.filters.push(`in:${column}`);
      this.predicates.push((row) => values.includes(String(row[column])));
      return this;
    }

    overrideTypes() {
      return this;
    }

    private run(): Result {
      let result = rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
      const count = this.call.count !== null && !omitCount ? result.length : null;
      // Earlier `order` calls win; later ones break ties.
      if (this.orderBy.length > 0) {
        result = [...result].sort((a, b) => {
          for (const column of this.orderBy) {
            const [x, y] = [String(a[column]), String(b[column])];
            if (x !== y) return x < y ? -1 : 1;
          }
          return 0;
        });
      }
      // `in` does not keep any particular order.
      else if (shuffleIn) result = [...result].reverse();
      const [from, to] = this.call.range ?? [0, Infinity];
      if (this.call.count !== null && from > result.length) {
        return { data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, count: null };
      }
      result = result.slice(from, Math.min(to + 1, from + MAX_ROWS));
      const columns = this.call.select.split(",").map((column) => column.trim());
      const data = result.map((row) => {
        const written = this.call.op === "update" ? { ...row, ...this.call.payload } : row;
        return Object.fromEntries(columns.map((column) => [column, written[column]])) as Row;
      });
      // `maybeSingle`: one row or null.
      if (this.single) return { data: (data[0] ?? null) as unknown as Row[], error: null, count };
      return { data, error: null, count };
    }

    then<T1 = Result, T2 = never>(
      onFulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
      onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): PromiseLike<T1 | T2> {
      const result = this.run();
      // Lets a test change the table between the key query and the queries after it.
      if (this.call.select.includes("match_keys")) afterKeyQuery?.();
      return Promise.resolve(result).then(onFulfilled, onRejected);
    }
  }

  const client = {
    from(table: string) {
      if (table !== "recipes") throw new Error(`unexpected table ${table}`);
      return {
        select: (columns: string, options?: { count?: string }) => new Query(columns, options),
        update: (values: Record<string, unknown>) => new Query("", undefined, "update", values),
        delete: () => new Query("", undefined, "delete"),
      };
    },
  };
  return { supabase: client as unknown as SupabaseClient, calls };
}

function ingredients(products: string[]): RecipeIngredient[] {
  return products.map((product) => ({ name: product, product, amount: null, unit: null, substitutes: [] }));
}

function recipeRow(
  id: string,
  products: string[],
  {
    name = id,
    keys,
    version = MATCH_KEYS_VERSION,
  }: { name?: string; keys?: MatchKeys | null; version?: number | null } = {},
): Row {
  const items = ingredients(products);
  return {
    id,
    name,
    steps: ["Krok"],
    ingredients: items,
    prep_time_min: null,
    servings: null,
    kinds: [],
    kcal: null,
    protein_g: "1.5",
    carbs_g: null,
    fat_g: null,
    match_keys: keys === undefined ? computeMatchKeys(items) : keys,
    match_keys_version: version,
  };
}

const page = { limit: 10, offset: 0 };

describe("listRecipes", () => {
  // Ids out of name order, and a shared name that only the id breaks.
  const rows = [
    recipeRow("e", ["sól"], { name: "Babka" }),
    recipeRow("d", ["sól"], { name: "Awokado" }),
    recipeRow("c", ["sól"], { name: "Ciasto" }),
    recipeRow("b", ["sól"], { name: "Babka" }),
    recipeRow("a", ["sól"], { name: "Dal" }),
  ];

  it("returns a middle page in name order with the whole catalog count", async () => {
    const { supabase, calls } = fakeClient(rows);

    const result = await listRecipes(supabase, { limit: 2, offset: 1 });

    expect(result.recipes.map((recipe) => recipe.id)).toEqual(["b", "e"]);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(rows.length);
    // One extra row tells whether another page exists.
    expect(calls).toMatchObject([{ count: "exact", range: [1, 3] }]);
  });

  it("reports no further page on the last one and keeps the total", async () => {
    const { supabase } = fakeClient(rows);

    const result = await listRecipes(supabase, { limit: 2, offset: 4 });

    expect(result.recipes.map((recipe) => recipe.id)).toEqual(["a"]);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(rows.length);
  });

  it("returns a null total, not 0, when the server sends no count", async () => {
    const { supabase } = fakeClient(rows, { omitCount: true });

    const result = await listRecipes(supabase, { limit: 2, offset: 0 });

    expect(result.recipes.map((recipe) => recipe.id)).toEqual(["d", "b"]);
    expect(result.total).toBeNull();
  });

  it("returns an empty last page, not an error, past the end of the catalog", async () => {
    const { supabase } = fakeClient(rows);

    const result = await listRecipes(supabase, { limit: 2, offset: 10 });

    expect(result).toEqual({ recipes: [], hasMore: false, total: null });
  });
});

describe("getRecipe", () => {
  const id = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
  const author = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";
  const rows = [
    { ...recipeRow(id, ["sól"], { name: "Zupa" }), author_id: author },
    { ...recipeRow("9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", ["pieprz"], { name: "Sałatka" }), author_id: null },
  ];

  it("returns the recipe with the given id", async () => {
    const { supabase, calls } = fakeClient(rows);

    const found = await getRecipe(supabase, id);

    expect(found?.recipe).toMatchObject({ id, name: "Zupa", steps: ["Krok"], proteinG: 1.5, kcal: null });
    expect(found?.authorId).toBe(author);
    expect(calls).toHaveLength(1);
    expect(calls[0].filters).toEqual(["eq:id"]);
    expect(calls[0].select).toContain("steps");
    expect(calls[0].select).toContain("author_id");
  });

  it("returns a null authorId for a recipe without an author", async () => {
    const { supabase } = fakeClient(rows);

    const found = await getRecipe(supabase, "9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d");

    expect(found?.recipe.name).toBe("Sałatka");
    expect(found?.authorId).toBeNull();
  });

  it("returns null when no recipe has the id", async () => {
    const { supabase } = fakeClient(rows);

    expect(await getRecipe(supabase, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("returns null without querying when the id is not a UUID", async () => {
    const { supabase, calls } = fakeClient(rows);

    expect(await getRecipe(supabase, "nie-uuid")).toBeNull();
    expect(await getRecipe(supabase, "")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("rethrows Supabase errors unchanged", async () => {
    const failure = { message: "boom", code: "XX000" };
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({
              overrideTypes: () => Promise.resolve({ data: null, error: failure }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(getRecipe(supabase, id)).rejects.toBe(failure);
  });
});

const draft: NewRecipe = {
  name: "Nowa zupa",
  steps: ["Gotuj"],
  ingredients: ingredients(["marchew"]),
  prepTimeMin: 20,
  servings: 2,
  kinds: ["na ciepło"],
  kcal: 150,
  proteinG: 4,
  carbsG: 20,
  fatG: 3,
};

describe("updateRecipe", () => {
  const id = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
  const rows = [recipeRow(id, ["sól"], { name: "Zupa" })];

  it("returns the updated recipe and sends only the content columns", async () => {
    const { supabase, calls } = fakeClient(rows);

    const recipe = await updateRecipe(supabase, id, draft);

    expect(recipe).toMatchObject({ id, name: "Nowa zupa", prepTimeMin: 20, proteinG: 4 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ op: "update", filters: ["eq:id"] });
    expect(calls[0].select).toContain("steps");
    expect(calls[0].payload).toMatchObject({ name: "Nowa zupa", prep_time_min: 20, protein_g: 4 });
    for (const column of ["author_id", "match_keys", "match_keys_version", "id"]) {
      expect(calls[0].payload).not.toHaveProperty(column);
    }
  });

  it("returns null when no row is left to update", async () => {
    const { supabase } = fakeClient(rows);

    expect(await updateRecipe(supabase, "00000000-0000-4000-8000-000000000000", draft)).toBeNull();
  });

  it("returns null without querying when the id is not a UUID", async () => {
    const { supabase, calls } = fakeClient(rows);

    expect(await updateRecipe(supabase, "nie-uuid", draft)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("rethrows Supabase errors unchanged", async () => {
    const failure = { message: "boom", code: "XX000" };
    const supabase = {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: () => ({
                overrideTypes: () => Promise.resolve({ data: null, error: failure }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(updateRecipe(supabase, id, draft)).rejects.toBe(failure);
  });
});

describe("deleteRecipe", () => {
  const id = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
  const rows = [recipeRow(id, ["sól"], { name: "Zupa" })];

  it("returns true when a row was deleted", async () => {
    const { supabase, calls } = fakeClient(rows);

    expect(await deleteRecipe(supabase, id)).toBe(true);
    expect(calls).toMatchObject([{ op: "delete", filters: ["eq:id"], select: "id" }]);
  });

  it("returns false when no row is left to delete", async () => {
    const { supabase } = fakeClient(rows);

    expect(await deleteRecipe(supabase, "00000000-0000-4000-8000-000000000000")).toBe(false);
  });

  it("returns false without querying when the id is not a UUID", async () => {
    const { supabase, calls } = fakeClient(rows);

    expect(await deleteRecipe(supabase, "nie-uuid")).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("rethrows Supabase errors unchanged", async () => {
    const failure = { message: "boom", code: "XX000" };
    const supabase = {
      from: () => ({
        delete: () => ({
          eq: () => ({
            select: () => ({
              overrideTypes: () => Promise.resolve({ data: null, error: failure }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(deleteRecipe(supabase, id)).rejects.toBe(failure);
  });
});

describe("matchRecipes", () => {
  it("ranks the whole catalog when it is longer than one PostgREST page", async () => {
    const rows = Array.from({ length: 2 * MAX_ROWS + 1 }, (_, i) =>
      recipeRow(`r${String(i).padStart(5, "0")}`, ["sól"]),
    );
    // Sorted last by id: only reachable through the third page.
    rows.push(recipeRow("r99999", ["pomidor"], { name: "Ostatni" }));
    const { supabase, calls } = fakeClient(rows);

    const result = await matchRecipes(supabase, { have: ["pomidor"], staple: [], exclude: [] }, page);

    expect(result.recipes[0]).toMatchObject({ id: "r99999", name: "Ostatni", match: { percent: 100 } });
    expect(result.hasMore).toBe(true);
    // The whole ranked catalog, not the page.
    expect(result.total).toBe(rows.length);
    const keyCalls = calls.filter((call) => call.select.includes("match_keys"));
    expect(keyCalls.map((call) => call.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    // Every key row is current: no ingredients are fetched for the fallback.
    expect(calls.some((call) => call.filters.some((filter) => filter.startsWith("or:")))).toBe(false);

    const last = await matchRecipes(
      supabase,
      { have: ["pomidor"], staple: [], exclude: [] },
      { limit: 10, offset: rows.length - 1 },
    );
    expect(last.recipes).toHaveLength(1);
    expect(last.hasMore).toBe(false);
  });

  it("computes keys from ingredients for rows with missing or outdated keys", async () => {
    const rows = [
      recipeRow("a", ["pomidor", "chleb"], { keys: null, version: null }),
      // Stored keys say "sól", but they come from an older version: the ingredients decide.
      recipeRow("b", ["pomidor", "jogurt naturalny"], {
        keys: computeMatchKeys(ingredients(["sól"])),
        version: MATCH_KEYS_VERSION - 1,
      }),
      recipeRow("c", ["sól", "pieprz"]),
    ];
    const { supabase, calls } = fakeClient(rows);

    const result = await matchRecipes(supabase, { have: ["pomidor"], staple: ["chleb"], exclude: [] }, page);

    expect(result.recipes.map((recipe) => [recipe.id, recipe.match.percent])).toEqual([
      ["a", 100],
      ["b", 50],
      ["c", 0],
    ]);
    const fallback = calls.find((call) => call.filters.some((filter) => filter.startsWith("or:")));
    expect(fallback).toMatchObject({
      select: "id, ingredients",
      filters: [`or:match_keys.is.null,match_keys_version.is.null,match_keys_version.neq.${MATCH_KEYS_VERSION}`],
      range: [0, MAX_RECOMPUTED_RECIPES - 1],
    });

    // An exclusion applies to a stale row as well.
    const excluded = await matchRecipes(supabase, { have: ["pomidor"], staple: [], exclude: ["jogurt"] }, page);
    expect(excluded.recipes.map((recipe) => recipe.id)).toEqual(["a", "c"]);
    // Excluded recipes are not ranked, so they do not count either.
    expect(excluded.total).toBe(2);

    // A page past the ranked recipes is empty but still reports their count.
    const beyond = await matchRecipes(
      supabase,
      { have: ["pomidor"], staple: [], exclude: ["jogurt"] },
      { limit: 10, offset: 2 },
    );
    expect(beyond).toEqual({ recipes: [], hasMore: false, total: 2 });
  });

  it("computes keys for at most MAX_RECOMPUTED_RECIPES stale rows and leaves the rest out of the ranking", async () => {
    const rows = Array.from({ length: MAX_RECOMPUTED_RECIPES + 5 }, (_, i) =>
      recipeRow(`r${String(i).padStart(4, "0")}`, ["sól"], { keys: null, version: null }),
    );
    rows.push(recipeRow("z-current", ["sól"]));
    const { supabase } = fakeClient(rows);

    const result = await matchRecipes(supabase, { have: ["sól"], staple: [], exclude: [] }, { limit: 500, offset: 0 });

    // The cap first-come by id, plus the row that already has current keys.
    expect(result.total).toBe(MAX_RECOMPUTED_RECIPES + 1);
    expect(result.recipes.map((recipe) => recipe.id)).not.toContain(
      `r${String(MAX_RECOMPUTED_RECIPES).padStart(4, "0")}`,
    );
    expect(result.recipes.map((recipe) => recipe.id)).toContain("z-current");
  });

  it("leaves out a stale row that the fallback no longer returns instead of ranking its old keys", async () => {
    // Old-version keys say "sól", so ranking them would miss the "jogurt" exclusion.
    const stale = recipeRow("a", ["sól", "jogurt naturalny"], {
      keys: computeMatchKeys(ingredients(["sól"])),
      version: MATCH_KEYS_VERSION - 1,
    });
    const rows = [stale, recipeRow("b", ["sól", "pieprz"])];
    // scripts/match-keys.ts updates the row between the key query and the fallback query.
    const { supabase } = fakeClient(rows, {
      afterKeyQuery: () => {
        stale.match_keys = computeMatchKeys(stale.ingredients as RecipeIngredient[]);
        stale.match_keys_version = MATCH_KEYS_VERSION;
      },
    });

    const result = await matchRecipes(supabase, { have: ["sól"], staple: [], exclude: ["jogurt"] }, page);

    expect(result.recipes.map((recipe) => recipe.id)).toEqual(["b"]);
    expect(result.hasMore).toBe(false);
  });

  it("recomputes current-version keys that no longer fit the ingredients", async () => {
    // Ingredients edited without recomputing the keys: the stored keys still describe one ingredient.
    const rows = [
      recipeRow("a", ["sól", "jogurt naturalny"], { keys: computeMatchKeys(ingredients(["sól"])) }),
      recipeRow("b", ["sól", "pieprz"]),
      recipeRow("c", ["sól"], { keys: null }),
    ];
    const { supabase } = fakeClient(rows);

    const result = await matchRecipes(supabase, { have: ["sól"], staple: [], exclude: [] }, page);
    expect(result.recipes.find((recipe) => recipe.id === "a")?.match.ingredients).toHaveLength(2);
    // Missing keys with the current version are computed, not skipped.
    expect(result.recipes.map((recipe) => recipe.id)).toContain("c");

    const excluded = await matchRecipes(supabase, { have: ["sól"], staple: [], exclude: ["jogurt"] }, page);
    expect(excluded.recipes.map((recipe) => recipe.id)).not.toContain("a");
  });

  it("returns the page in ranking order with full recipes and resolved matches", async () => {
    const honey = {
      name: "Miód",
      product: "miód",
      amount: null,
      unit: null,
      substitutes: [{ name: "syrop klonowy", product: "syrop klonowy", amount: null, unit: null }],
    };
    const withSubstitute = recipeRow("a", [], { name: "Owsianka" });
    withSubstitute.ingredients = [honey, ...ingredients(["banan"])];
    withSubstitute.match_keys = computeMatchKeys(withSubstitute.ingredients as RecipeIngredient[]);
    const rows = [
      withSubstitute,
      recipeRow("b", ["banan", "sól", "pieprz"], { name: "Babka" }),
      recipeRow("c", ["banan"], { name: "Banan" }),
      recipeRow("d", ["cebula"], { name: "Cebulowa" }),
    ];
    const { supabase, calls } = fakeClient(rows, { shuffleIn: true });

    const result = await matchRecipes(
      supabase,
      { have: ["banan", "syrop klonowy"], staple: [], exclude: [] },
      { limit: 3, offset: 0 },
    );

    expect(result.recipes.map((recipe) => recipe.id)).toEqual(["a", "c", "b"]);
    expect(result.hasMore).toBe(true);
    expect(result.recipes[0]).toMatchObject({
      name: "Owsianka",
      steps: ["Krok"],
      proteinG: 1.5,
      match: {
        percent: 100,
        ingredients: [
          { status: "have", mainExcluded: false, via: "syrop klonowy" },
          { status: "have", mainExcluded: false, via: null },
        ],
      },
    });
    const pageCall = calls.find((call) => call.filters.includes("in:id"));
    expect(pageCall?.select).toContain("steps");

    const next = await matchRecipes(
      supabase,
      { have: ["banan", "syrop klonowy"], staple: [], exclude: [] },
      { limit: 3, offset: 3 },
    );
    expect(next.recipes.map((recipe) => recipe.id)).toEqual(["d"]);
    expect(next.hasMore).toBe(false);
  });

  it("rethrows Supabase errors unchanged", async () => {
    const failure = { message: "boom", code: "XX000" };
    const supabase = {
      from: () => ({
        select: () => ({
          order: () => ({
            range: () => ({
              overrideTypes: () => Promise.resolve({ data: null, error: failure }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(matchRecipes(supabase, { have: ["sól"], staple: [], exclude: [] }, page)).rejects.toBe(failure);
  });
});
