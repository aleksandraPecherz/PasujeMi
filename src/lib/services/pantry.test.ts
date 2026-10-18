import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_SAVED } from "@/lib/pantry/saved";
import { getSavedPantry, saveSavedPantry } from "@/lib/services/pantry";

const USER = "11111111-1111-4111-8111-111111111111";

interface Outcome {
  data: unknown;
  error: { code: string; message: string } | null;
}

interface Call {
  table: string;
  select?: string;
  eq?: [string, string];
  upsert?: { row: unknown; options: unknown };
}

/** Minimal stand-in for the PostgREST builder: `select().eq().maybeSingle().overrideTypes()` and `upsert()`. */
function fakeClient(outcome: Outcome) {
  const calls: Call[] = [];

  class Query implements PromiseLike<Outcome> {
    constructor(private readonly call: Call) {}

    eq(column: string, value: string) {
      this.call.eq = [column, value];
      return this;
    }

    maybeSingle() {
      return this;
    }

    overrideTypes() {
      return this;
    }

    then<T1 = Outcome, T2 = never>(
      onFulfilled?: ((value: Outcome) => T1 | PromiseLike<T1>) | null,
      onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): PromiseLike<T1 | T2> {
      return Promise.resolve(outcome).then(onFulfilled, onRejected);
    }
  }

  const client = {
    from(table: string) {
      return {
        select: (columns: string) => {
          const call: Call = { table, select: columns };
          calls.push(call);
          return new Query(call);
        },
        upsert: (row: unknown, options: unknown) => {
          const call: Call = { table, upsert: { row, options } };
          calls.push(call);
          return new Query(call);
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSavedPantry", () => {
  it("gives empty lists when the user has no row", async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await expect(getSavedPantry(client, USER)).resolves.toEqual(EMPTY_SAVED);
    expect(calls).toEqual([{ table: "saved_pantry", select: "staples, exclusions", eq: ["user_id", USER] }]);
  });

  it("maps a valid row to staple and exclude", async () => {
    const { client } = fakeClient({ data: { staples: ["sól", "pieprz"], exclusions: ["orzechy"] }, error: null });
    await expect(getSavedPantry(client, USER)).resolves.toEqual({ staple: ["sól", "pieprz"], exclude: ["orzechy"] });
  });

  it("gives null for a row over the limits and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tags = Array.from({ length: 31 }, (_, i) => `tag${String(i)}`);
    const { client } = fakeClient({ data: { staples: tags, exclusions: [] }, error: null });
    await expect(getSavedPantry(client, USER)).resolves.toBeNull();
    expect(error).toHaveBeenCalledOnce();
  });

  it("gives null for a row of the wrong shape", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ data: { staples: "sól", exclusions: null }, error: null });
    await expect(getSavedPantry(client, USER)).resolves.toBeNull();
  });

  it("throws the database error", async () => {
    const failure = { code: "42P01", message: "relation does not exist" };
    const { client } = fakeClient({ data: null, error: failure });
    await expect(getSavedPantry(client, USER)).rejects.toBe(failure);
  });
});

describe("saveSavedPantry", () => {
  it("upserts the row of the user on user_id", async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await saveSavedPantry(client, USER, { staple: ["sól"], exclude: ["orzechy"] });
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("saved_pantry");
    expect(calls[0].upsert?.options).toEqual({ onConflict: "user_id" });
    expect(calls[0].upsert?.row).toEqual({
      user_id: USER,
      staples: ["sól"],
      exclusions: ["orzechy"],
      updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/) as string,
    });
  });

  it("throws the database error", async () => {
    const failure = { code: "42501", message: "permission denied" };
    const { client } = fakeClient({ data: null, error: failure });
    await expect(saveSavedPantry(client, USER, EMPTY_SAVED)).rejects.toBe(failure);
  });
});
