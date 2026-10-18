import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LIST_STATE_KEY,
  clearSnapshot,
  missesSavedExclusion,
  parseSnapshot,
  readSnapshot,
  restoreLists,
  writeSnapshot,
  type ListSnapshot,
} from "@/lib/list-state";
import { MAX_RESTORE_RECIPES, MAX_TAG_LENGTH, MAX_TAGS, MAX_TOKENS, countTokens } from "@/lib/matching/limits";

const EMPTY = { have: [], staple: [], exclude: [] };

const SNAPSHOT: ListSnapshot = {
  lists: { have: ["pomidor", "ser żółty"], staple: ["sól"], exclude: ["orzechy"] },
  applied: { have: ["pomidor"], staple: [], exclude: [] },
  loaded: 30,
  scrollY: 640,
};

function raw(overrides: Record<string, unknown>): string {
  return JSON.stringify({ ...SNAPSHOT, ...overrides });
}

describe("parseSnapshot", () => {
  it("round-trips a valid snapshot", () => {
    expect(parseSnapshot(JSON.stringify(SNAPSHOT))).toEqual(SNAPSHOT);
  });

  it.each([null, "", "{not json", "null", "[]", '"text"', "42", "{}"])("rejects %j", (input) => {
    expect(parseSnapshot(input)).toBeNull();
  });

  it("rejects a wrong shape", () => {
    expect(parseSnapshot(raw({ lists: "x" }))).toBeNull();
    expect(parseSnapshot(raw({ lists: { have: [], staple: [] } }))).toBeNull();
    expect(parseSnapshot(raw({ applied: null }))).toBeNull();
    expect(parseSnapshot(raw({ lists: { ...EMPTY, have: [1] } }))).toBeNull();
    expect(parseSnapshot(raw({ lists: { ...EMPTY, have: "pomidor" } }))).toBeNull();
    expect(parseSnapshot(raw({ loaded: "30" }))).toBeNull();
    expect(parseSnapshot(raw({ scrollY: null }))).toBeNull();
  });

  it("rejects empty tags", () => {
    expect(parseSnapshot(raw({ lists: { ...EMPTY, have: ["  "] } }))).toBeNull();
  });

  it("rejects a section above MAX_TAGS", () => {
    const tags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `tag${String(i)}`);
    expect(parseSnapshot(raw({ lists: { ...EMPTY, have: tags } }))).toBeNull();
    expect(parseSnapshot(raw({ applied: { ...EMPTY, exclude: tags } }))).toBeNull();
  });

  it("accepts a section of exactly MAX_TAGS", () => {
    const tags = Array.from({ length: MAX_TAGS }, (_, i) => `tag${String(i)}`);
    expect(parseSnapshot(raw({ lists: { ...EMPTY, have: tags } }))?.lists.have).toHaveLength(MAX_TAGS);
  });

  it("rejects a tag above MAX_TAG_LENGTH", () => {
    expect(parseSnapshot(raw({ lists: { ...EMPTY, have: ["a".repeat(MAX_TAG_LENGTH + 1)] } }))).toBeNull();
    expect(parseSnapshot(raw({ lists: { ...EMPTY, have: ["a".repeat(MAX_TAG_LENGTH)] } }))).not.toBeNull();
  });

  it("rejects more than MAX_TOKENS words across the lists", () => {
    const tag = "mleko kokosowe ser żółty";
    const perTag = countTokens([tag]);
    const needed = Math.floor(MAX_TOKENS / perTag) + 1;
    const lists = {
      have: Array.from({ length: Math.min(needed, MAX_TAGS) }, (_, i) => `${tag} ${String(i)}`),
      staple: Array.from({ length: Math.max(0, needed - MAX_TAGS) }, (_, i) => `${tag} ${String(i)}`),
      exclude: [],
    };
    expect(countTokens([...lists.have, ...lists.staple])).toBeGreaterThan(MAX_TOKENS);
    expect(parseSnapshot(raw({ lists }))).toBeNull();
  });

  it("clamps loaded to 0..MAX_RESTORE_RECIPES and whole numbers", () => {
    expect(parseSnapshot(raw({ loaded: 100000 }))?.loaded).toBe(MAX_RESTORE_RECIPES);
    expect(parseSnapshot(raw({ loaded: -5 }))?.loaded).toBe(0);
    expect(parseSnapshot(raw({ loaded: 12.9 }))?.loaded).toBe(12);
    expect(parseSnapshot(raw({ loaded: MAX_RESTORE_RECIPES }))?.loaded).toBe(MAX_RESTORE_RECIPES);
  });

  it("clamps scrollY to a finite number >= 0", () => {
    expect(parseSnapshot(raw({ scrollY: -300 }))?.scrollY).toBe(0);
    expect(
      parseSnapshot(
        '{"lists":{"have":[],"staple":[],"exclude":[]},"applied":{"have":[],"staple":[],"exclude":[]},"loaded":10,"scrollY":1e999}',
      )?.scrollY,
    ).toBe(0);
    expect(parseSnapshot(raw({ scrollY: 12.5 }))?.scrollY).toBe(12.5);
  });
});

function stubStorage(store: Record<string, string>, throws = false) {
  const fail = () => {
    if (throws) throw new Error("blocked");
  };
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => {
      fail();
      return store[key] ?? null;
    },
    setItem: (key: string, value: string) => {
      fail();
      store[key] = value;
    },
    removeItem: (key: string) => {
      fail();
      Reflect.deleteProperty(store, key);
    },
  });
}

describe("sessionStorage access", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes and reads a snapshot back", () => {
    const store: Record<string, string> = {};
    stubStorage(store);
    writeSnapshot(SNAPSHOT);
    expect(store[LIST_STATE_KEY]).toBeDefined();
    expect(readSnapshot()).toEqual(SNAPSHOT);
  });

  it("reads null when nothing or junk is stored", () => {
    const store: Record<string, string> = {};
    stubStorage(store);
    expect(readSnapshot()).toBeNull();
    store[LIST_STATE_KEY] = "{broken";
    expect(readSnapshot()).toBeNull();
  });

  it("clears the snapshot", () => {
    const store: Record<string, string> = {};
    stubStorage(store);
    writeSnapshot(SNAPSHOT);
    clearSnapshot();
    expect(readSnapshot()).toBeNull();
  });

  it("stops saving after sign-out starts", async () => {
    vi.resetModules();
    const store: Record<string, string> = {};
    stubStorage(store);
    const fresh = await import("@/lib/list-state");
    fresh.writeSnapshot(SNAPSHOT);
    fresh.endListState();
    expect(store[LIST_STATE_KEY]).toBeUndefined();
    // What pagehide / visibilitychange do while the page is left.
    fresh.writeSnapshot(SNAPSHOT);
    expect(store[LIST_STATE_KEY]).toBeUndefined();
    expect(fresh.readSnapshot()).toBeNull();
  });

  it("reports that sign-out has started", async () => {
    vi.resetModules();
    stubStorage({});
    const fresh = await import("@/lib/list-state");
    expect(fresh.listStateEnded()).toBe(false);
    fresh.endListState();
    expect(fresh.listStateEnded()).toBe(true);
  });

  it("does not throw when storage is blocked", () => {
    stubStorage({}, true);
    expect(() => {
      writeSnapshot(SNAPSHOT);
    }).not.toThrow();
    expect(readSnapshot()).toBeNull();
    expect(() => {
      clearSnapshot();
    }).not.toThrow();
  });
});

describe("restoreLists", () => {
  it("takes only have from the snapshot", () => {
    const current = { have: ["x"], staple: ["pieprz"], exclude: ["jogurt"] };
    expect(restoreLists(SNAPSHOT.lists, current)).toEqual({
      have: ["pomidor", "ser żółty"],
      staple: ["pieprz"],
      exclude: ["jogurt"],
    });
  });
});

describe("missesSavedExclusion", () => {
  const applied = { have: [], staple: [], exclude: ["Orzechy"] };

  it("is false without saved lists", () => {
    expect(missesSavedExclusion(applied, null)).toBe(false);
  });

  it("is false when the applied exclusions cover the saved ones", () => {
    expect(missesSavedExclusion(applied, { staple: [], exclude: ["Orzechy"] })).toBe(false);
    expect(missesSavedExclusion(applied, { staple: ["sól"], exclude: [] })).toBe(false);
  });

  it("ignores letter case", () => {
    expect(missesSavedExclusion(applied, { staple: [], exclude: ["orzechy"] })).toBe(false);
    expect(missesSavedExclusion({ ...applied, exclude: ["Żurek"] }, { staple: [], exclude: ["żurek"] })).toBe(false);
  });

  it("is true for a saved exclusion that is not applied", () => {
    expect(missesSavedExclusion(applied, { staple: [], exclude: ["orzechy", "jogurt"] })).toBe(true);
    expect(missesSavedExclusion(EMPTY, { staple: [], exclude: ["jogurt"] })).toBe(true);
  });
});
