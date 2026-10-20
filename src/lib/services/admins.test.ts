import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isAdmin } from "@/lib/services/admins";

const USER = "11111111-1111-4111-8111-111111111111";

interface Outcome {
  data: unknown;
  error: { code: string; message: string } | null;
}

interface Call {
  table: string;
  select?: string;
  eq?: [string, string];
}

/** Minimal stand-in for the PostgREST builder: `select().eq().maybeSingle()`. */
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
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("isAdmin", () => {
  it("is true when the user has a row", async () => {
    const { client, calls } = fakeClient({ data: { user_id: USER }, error: null });
    await expect(isAdmin(client, USER)).resolves.toBe(true);
    expect(calls).toEqual([{ table: "admins", select: "user_id", eq: ["user_id", USER] }]);
  });

  it("is false when there is no row", async () => {
    const { client } = fakeClient({ data: null, error: null });
    await expect(isAdmin(client, USER)).resolves.toBe(false);
  });

  it("throws the database error", async () => {
    const failure = { code: "42P01", message: "relation does not exist" };
    const { client } = fakeClient({ data: null, error: failure });
    await expect(isAdmin(client, USER)).rejects.toBe(failure);
  });
});
