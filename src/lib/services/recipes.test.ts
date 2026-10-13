import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { MATCH_KEYS_VERSION, computeMatchKeys } from "@/lib/matching";
import { matchRecipes } from "@/lib/services/recipes";
import type { MatchKeys, RecipeIngredient } from "@/types";

/** PostgREST `max_rows` (supabase/config.toml): a request never returns more rows than this. */
const MAX_ROWS = 1000;

type Row = Record<string, unknown> & { id: string };

interface Call {
  select: string;
  filters: string[];
  range: [number, number] | null;
}

/**
 * Minimal stand-in for the PostgREST query builder: `select`, `order("id")`, `range`, `or` (`col.is.null`,
 * `col.neq.value`), `in("id", …)` and `overrideTypes`. It caps every response at MAX_ROWS like the real server and
 * projects the selected columns, so a query that forgets a column or a page fails the test.
 */
function fakeClient(
  rows: Row[],
  { shuffleIn = false, afterKeyQuery }: { shuffleIn?: boolean; afterKeyQuery?: () => void } = {},
) {
  const calls: Call[] = [];

  class Query implements PromiseLike<{ data: Row[]; error: null }> {
    private readonly call: Call;
    private predicates: ((row: Row) => boolean)[] = [];
    private ordered = false;

    constructor(columns: string) {
      this.call = { select: columns, filters: [], range: null };
      calls.push(this.call);
    }

    order(column: string) {
      if (column !== "id") throw new Error(`unexpected order by ${column}`);
      this.ordered = true;
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

    in(column: string, values: string[]) {
      this.call.filters.push(`in:${column}`);
      this.predicates.push((row) => values.includes(String(row[column])));
      return this;
    }

    overrideTypes() {
      return this;
    }

    private run(): Row[] {
      let result = rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
      if (this.ordered) result = [...result].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      // `in` does not keep any particular order.
      else if (shuffleIn) result = [...result].reverse();
      const [from, to] = this.call.range ?? [0, Infinity];
      result = result.slice(from, Math.min(to + 1, from + MAX_ROWS));
      const columns = this.call.select.split(",").map((column) => column.trim());
      return result.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])) as Row);
    }

    then<T1 = { data: Row[]; error: null }, T2 = never>(
      onFulfilled?: ((value: { data: Row[]; error: null }) => T1 | PromiseLike<T1>) | null,
      onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): PromiseLike<T1 | T2> {
      const data = this.run();
      // Lets a test change the table between the key query and the queries after it.
      if (this.call.select.includes("match_keys")) afterKeyQuery?.();
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    }
  }

  const client = {
    from(table: string) {
      if (table !== "recipes") throw new Error(`unexpected table ${table}`);
      return { select: (columns: string) => new Query(columns) };
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
      range: [0, 999],
    });

    // An exclusion applies to a stale row as well.
    const excluded = await matchRecipes(supabase, { have: ["pomidor"], staple: [], exclude: ["jogurt"] }, page);
    expect(excluded.recipes.map((recipe) => recipe.id)).toEqual(["a", "c"]);
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
