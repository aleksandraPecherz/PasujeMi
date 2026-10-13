import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EXCEPTIONS, SEPARATE_PRODUCT_KEYS, SEPARATE_PRODUCTS, SYNONYMS } from "@/lib/matching/dictionary";
import { MATCH_KEYS_VERSION, computeMatchKeys, keysEqual, normalizeExclusion, normalizeTag } from "@/lib/matching/keys";

describe("normalizeTag", () => {
  it("drops numbers, percentages and conjunctions/prepositions", () => {
    expect(normalizeTag("mleko 1,5%")).toEqual(normalizeTag("mleko"));
    expect(normalizeTag("jogurt naturalny 2%")).toEqual(normalizeTag("jogurt naturalny"));
    expect(normalizeTag("syrop z agawy")).toEqual(normalizeTag("syrop agawy"));
    expect(normalizeTag("1,5%")).toEqual([]);
  });

  it("keeps the word after 'bez', so exclusions err on the safe side", () => {
    expect(normalizeTag("jogurt bez laktozy")).toEqual([...normalizeTag("jogurt"), ...normalizeTag("laktozy")]);
  });

  it("ignores case and Polish characters", () => {
    expect(normalizeTag("Sól")).toEqual(normalizeTag("sol"));
    expect(normalizeTag("RYŻ")).toEqual(normalizeTag("ryz"));
  });

  it("maps synonyms and diminutives to the canonical form", () => {
    expect(normalizeTag("kartofel")).toEqual(normalizeTag("ziemniak"));
    expect(normalizeTag("kartofle")).toEqual(normalizeTag("ziemniaki"));
    expect(normalizeTag("pomidorki")).toEqual(normalizeTag("pomidor"));
  });

  it("turns a separate product into one key", () => {
    expect(normalizeTag("mleko kokosowe")).toHaveLength(1);
    expect(normalizeTag("Mleka kokosowego")).toEqual(normalizeTag("mleko kokosowe"));
  });

  it("keeps mąka apart from mak", () => {
    const [flour] = normalizeTag("mąka");
    const [poppy] = normalizeTag("mak");
    expect(keysEqual(flour, poppy)).toBe(false);
  });

  it("reads an owned 'maka' as mąka", () => {
    expect(normalizeTag("maka")).toEqual(normalizeTag("mąka"));
    expect(normalizeTag("maka pszenna")).toEqual(normalizeTag("mąka pszenna"));
  });
});

describe("normalizeExclusion", () => {
  it("expands a word without Polish characters into every product it may mean", () => {
    expect(normalizeExclusion("maka")).toEqual([normalizeTag("mak"), normalizeTag("mąka")]);
    expect(normalizeExclusion("Maka pszenna")).toEqual([normalizeTag("mak pszenna"), normalizeTag("mąka pszenna")]);
  });

  it("keeps unambiguous words as one tag", () => {
    expect(normalizeExclusion("mąka")).toEqual([normalizeTag("mąka")]);
    expect(normalizeExclusion("mak")).toEqual([normalizeTag("mak")]);
    expect(normalizeExclusion("mleko kokosowe")).toEqual([normalizeTag("mleko kokosowe")]);
  });
});

describe("keysEqual", () => {
  it.each([
    ["jajko", "jajek"],
    ["sól", "sol"],
    ["soli", "sól"],
    ["czosnek", "czosnku"],
    ["pomidor", "pomidory"],
    ["mozzarella", "mozarella"],
    ["kartofle", "kartofel"],
  ])("%s = %s", (a, b) => {
    expect(keysEqual(normalizeTag(a)[0], normalizeTag(b)[0])).toBe(true);
  });

  it.each([
    ["sól", "sok"],
    ["ryż", "ryby"],
    ["mąka", "mak"],
  ])("%s ≠ %s", (a, b) => {
    expect(keysEqual(normalizeTag(a)[0], normalizeTag(b)[0])).toBe(false);
  });

  it("tolerates one edit only from 4 characters", () => {
    expect(keysEqual("abcd", "abce")).toBe(true);
    expect(keysEqual("abcd", "abdc")).toBe(true);
    expect(keysEqual("abcd", "abcde")).toBe(true);
    expect(keysEqual("abcd", "abef")).toBe(false);
    expect(keysEqual("abc", "abd")).toBe(false);
  });
});

describe("computeMatchKeys", () => {
  it("is parallel to ingredients, main option first, with parents of separate products", () => {
    const keys = computeMatchKeys([
      {
        name: "Mleko kokosowe",
        product: "mleko kokosowe",
        amount: 200,
        unit: "g",
        substitutes: [{ name: "Mleko 1,5%", product: "mleko 1,5%", amount: 200, unit: "g" }],
      },
      { name: "Sól", product: "sól", amount: 1, unit: "szczypta", substitutes: [] },
    ]);
    expect(keys).toEqual([
      [{ k: normalizeTag("mleko kokosowe"), p: normalizeTag("mleko") }, { k: normalizeTag("mleko") }],
      [{ k: normalizeTag("sól") }],
    ]);
  });
});

// Version guard: any change to normalization, the stemmer or the dictionary changes this fingerprint.
// When it fails on purpose: bump MATCH_KEYS_VERSION in keys.ts and ADD a new entry below (never edit old ones).
const FINGERPRINTS: Record<number, string> = {
  1: "641f0a0df3219183be8e10181b232fa0e2b1dcbe1ed8cec246ef286fbe6efa0a",
};

const FINGERPRINT_WORDS = [
  "pomidor",
  "pomidory",
  "pomidorki",
  "jajko",
  "jajek",
  "sól",
  "soli",
  "sol",
  "czosnek",
  "czosnku",
  "mozzarella",
  "mozarella",
  "kartofel",
  "ziemniaki",
  "mąka",
  "mak",
  "ryż",
  "ryby",
  "mleko 1,5%",
  "mleko kokosowe",
  "orzechy włoskie",
  "jogurt naturalny bez laktozy",
  "borówki amerykańskie, świeże lub mrożone",
  "ser z niebieską pleśnią",
];

describe("MATCH_KEYS_VERSION", () => {
  it("matches the fingerprint of keys and dictionary", () => {
    const snapshot = {
      words: FINGERPRINT_WORDS.map((word) => [word, normalizeTag(word)]),
      dictionary: {
        synonyms: SYNONYMS.map(([form, canonical]) => [form, normalizeTag(form), canonical]),
        separateProducts: [SEPARATE_PRODUCTS, SEPARATE_PRODUCT_KEYS],
        exceptions: EXCEPTIONS.map((word) => [word, normalizeTag(word)]),
      },
    };
    const fingerprint = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    expect(Math.max(...Object.keys(FINGERPRINTS).map(Number))).toBe(MATCH_KEYS_VERSION);
    expect(fingerprint, "match keys changed: bump MATCH_KEYS_VERSION and add a fingerprint").toBe(
      FINGERPRINTS[MATCH_KEYS_VERSION],
    );
  });
});
