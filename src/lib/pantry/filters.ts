import type { PantryLists, PantrySection } from "@/types";

const SECTIONS: PantrySection[] = ["have", "staple", "exclude"];

/** The identity of a tag in a list: trimmed and case-insensitive (Polish locale), the rule `addTag` uses for duplicates. */
export function tagKey(tag: string): string {
  return tag.trim().toLocaleLowerCase("pl");
}

function keys(tags: string[]): Set<string> {
  return new Set(tags.map(tagKey));
}

/** Whether the typed lists differ from the applied ones; order and letter case of tags do not count. */
export function filtersChanged(typed: PantryLists, applied: PantryLists): boolean {
  return SECTIONS.some((section) => {
    const left = keys(typed[section]);
    const right = keys(applied[section]);
    return left.size !== right.size || [...left].some((key) => !right.has(key));
  });
}
