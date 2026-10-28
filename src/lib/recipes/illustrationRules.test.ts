import fs from "node:fs";
import { describe, expect, it } from "vitest";
import cases from "./illustrationCases.json";
import { FOLD_FROM, FOLD_TO, ILLUSTRATION_RULES, foldName, pickIllustration, ruleToSql } from "./illustrationRules";
import { ILLUSTRATION_KEYS } from "./illustrations";

const MIGRATION = fs.readFileSync("supabase/migrations/20261028120000_auto_recipe_illustration.sql", "utf8");
const MIGRATION_CODE = MIGRATION.split("\n")
  .filter((line) => !line.startsWith("--"))
  .join("\n");

describe("pickIllustration", () => {
  it.each(cases)("$name -> $key", ({ name, key }) => {
    expect(pickIllustration(name)).toBe(key);
  });

  it("gives no illustration for an empty or blank name", () => {
    expect(pickIllustration("")).toBeNull();
    expect(pickIllustration("   ")).toBeNull();
  });

  it("folds Polish letters of either case before matching", () => {
    expect(foldName("ŁÓDŹ Żółć")).toBe("lodz zolc");
  });

  it("matches a stem only at the start of a word", () => {
    expect(pickIllustration("Superkanapka")).toBeNull();
    expect(pickIllustration("Dalmatyńska zapiekanka")).toBeNull();
    expect(pickIllustration("Kremowe curry")).toBe("miska");
  });

  it("lets a container outrank the dish family (first match wins)", () => {
    expect(pickIllustration("Sałatka z kurczakiem")).toBe("salatka");
    expect(pickIllustration("Zupa z makaronem")).toBe("zupa");
  });
});

describe("the rules and the library", () => {
  it("only name illustrations that exist as a key and as an SVG file", () => {
    for (const { key } of ILLUSTRATION_RULES) {
      expect(ILLUSTRATION_KEYS).toContain(key);
      expect(fs.existsSync(`public/illustrations/${key}.svg`)).toBe(true);
    }
  });

  it("covers every expected key of the case file", () => {
    const keys = new Set(ILLUSTRATION_RULES.map((rule) => rule.key));
    for (const { key } of cases) {
      if (key !== null) expect(keys).toContain(key);
    }
  });
});

describe("the migration", () => {
  it("holds the same ordered rules and letter folding as the TS copy", () => {
    const lines = ILLUSTRATION_RULES.map(ruleToSql);
    let from = 0;
    for (const line of lines) {
      const at = MIGRATION.indexOf(line, from);
      expect(at, line).toBeGreaterThanOrEqual(from);
      from = at + line.length;
    }
    expect(MIGRATION).toContain(`translate(new.name, '${FOLD_FROM}', '${FOLD_TO}')`);
  });

  it("limits the trigger to rows without an illustration and adds no grant or security definer", () => {
    expect(MIGRATION_CODE).toContain("when (new.illustration is null)");
    expect(MIGRATION_CODE).toContain("before insert or update of name on public.recipes");
    expect(MIGRATION_CODE).not.toMatch(/security\s+definer/i);
    expect(MIGRATION_CODE).not.toMatch(/^\s*grant\s/im);
    expect(MIGRATION_CODE).toContain(
      "revoke execute on function private.recipes_pick_illustration() from public, anon, authenticated;",
    );
  });
});
