import { describe, expect, it } from "vitest";
import { filtersChanged, tagKey } from "@/lib/pantry/filters";
import type { PantryLists } from "@/types";

const lists = (have: string[] = [], staple: string[] = [], exclude: string[] = []): PantryLists => ({
  have,
  staple,
  exclude,
});

describe("tagKey", () => {
  it("trims and lower-cases with Polish rules", () => {
    expect(tagKey("  ŻÓŁTKO ")).toBe("żółtko");
  });
});

describe("filtersChanged", () => {
  it("is false for equal lists, including two empty ones", () => {
    expect(filtersChanged(lists(), lists())).toBe(false);
    expect(filtersChanged(lists(["jajka"], ["sól"], ["orzechy"]), lists(["jajka"], ["sól"], ["orzechy"]))).toBe(false);
  });

  it("ignores the order of tags", () => {
    expect(filtersChanged(lists(["jajka", "mleko", "ser"]), lists(["ser", "jajka", "mleko"]))).toBe(false);
  });

  it("ignores letter case and surrounding spaces, like the duplicate check", () => {
    expect(filtersChanged(lists(["Jajka "], [], ["ORZECHY"]), lists(["jajka"], [], ["orzechy"]))).toBe(false);
    expect(filtersChanged(lists(["Żółtko"]), lists(["żółtko"]))).toBe(false);
  });

  it("detects an added or removed tag in any section", () => {
    expect(filtersChanged(lists(["jajka", "ser"]), lists(["jajka"]))).toBe(true);
    expect(filtersChanged(lists(["jajka"]), lists(["jajka", "ser"]))).toBe(true);
    expect(filtersChanged(lists([], ["sól"]), lists())).toBe(true);
    expect(filtersChanged(lists(), lists([], [], ["orzechy"]))).toBe(true);
  });

  it("treats the same tag in another section as a change", () => {
    expect(filtersChanged(lists(["mleko"]), lists([], ["mleko"]))).toBe(true);
  });

  it("does not count a case-only duplicate as a different list", () => {
    expect(filtersChanged(lists(["jajka", "Jajka"]), lists(["jajka"]))).toBe(false);
  });
});
