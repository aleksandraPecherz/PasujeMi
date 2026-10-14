import { describe, expect, it } from "vitest";
import { findLiterals } from "./check-ui-literals.mjs";

describe("findLiterals", () => {
  it.each(["bg-purple-600", "text-white/60", "#0a0e1a", "p-[13px]"])("flags %s", (literal) => {
    expect(findLiterals(`<div className="flex ${literal}" />`)).toHaveLength(1);
  });

  it.each(["bg-primary", "bg-card/50", "text-muted-foreground", "border-border"])("accepts %s", (token) => {
    expect(findLiterals(`<div className="flex ${token}" />`)).toEqual([]);
  });

  it("reports the 1-based line of each hit", () => {
    expect(findLiterals('<a className="bg-primary" />\n<b className="text-red-500" />')).toEqual([
      { line: 2, content: '<b className="text-red-500" />' },
    ]);
  });
});
