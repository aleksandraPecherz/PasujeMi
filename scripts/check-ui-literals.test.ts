import { describe, expect, it } from "vitest";
import { findLiterals } from "./check-ui-literals.mjs";

describe("findLiterals", () => {
  it.each([
    "bg-purple-600",
    "text-white/60",
    "#0a0e1a",
    "p-[13px]",
    "border-t-white",
    "border-x-red-500",
    "ring-offset-white",
    "decoration-red-500",
    "caret-white",
    "accent-pink-500",
    "p-[13px_4px]",
    "w-[calc(100%-13px)]",
    "top-[-3px]",
    "h-[50vh]",
    "text-[0.8em]",
    "bg-[red]",
    "bg-[#fff]",
    "[color:red]",
  ])("flags %s", (literal) => {
    expect(findLiterals(`<div className="flex ${literal}" />`)).toHaveLength(1);
  });

  it.each([
    "bg-primary",
    "bg-card/50",
    "text-muted-foreground",
    "border-border",
    "text-accent-foreground",
    "data-[state=open]:bg-accent",
  ])("accepts %s", (token) => {
    expect(findLiterals(`<div className="flex ${token}" />`)).toEqual([]);
  });

  it.each(['<a href="#add">', "type Map = { [key: string]: number };"])("accepts non-class code %s", (code) => {
    expect(findLiterals(code)).toEqual([]);
  });

  it("reports the 1-based line of each hit", () => {
    expect(findLiterals('<a className="bg-primary" />\n<b className="text-red-500" />')).toEqual([
      { line: 2, content: '<b className="text-red-500" />' },
    ]);
  });
});
