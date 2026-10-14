// UI literal scan: files already moved onto design tokens (src/styles/global.css) must not get literal colors
// or arbitrary px/rem values back. Zero dependencies on purpose.
// No arguments: scans every file in CLEAN_FILES. With arguments (lint-staged): scans only those that are listed.
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Add a file here once it uses tokens only.
export const CLEAN_FILES = [
  "src/pages/index.astro",
  "src/layouts/AppLayout.astro",
  "src/components/AppHeader.astro",
  "src/components/pantry/PantryMatch.tsx",
  "src/components/pantry/TagInput.tsx",
  "src/components/recipes/RecipeTile.tsx",
  "src/components/pantry/PantryStates.tsx",
  "src/components/dev/KitchenSink.tsx",
  "src/pages/dev/kitchen-sink.astro",
  "src/components/auth/ServerError.tsx",
];

const LITERAL =
  /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b/;

/**
 * Finds literal colors and arbitrary px/rem values, one hit per offending line.
 * @param {string} text
 * @returns {{ line: number; content: string }[]}
 */
export function findLiterals(text) {
  return text
    .split(/\r?\n/)
    .map((content, i) => ({ line: i + 1, content }))
    .filter(({ content }) => LITERAL.test(content));
}

/** @param {string} file */
function toRepoPath(file) {
  return path.relative(process.cwd(), path.resolve(file)).replaceAll("\\", "/");
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length ? args.map(toRepoPath).filter((file) => CLEAN_FILES.includes(file)) : CLEAN_FILES;

  let hits = 0;
  for (const file of files) {
    for (const { line, content } of findLiterals(readFileSync(file, "utf8"))) {
      console.log(`${file}:${line}: ${content.trim()}`);
      hits++;
    }
  }

  if (hits) console.log(`\n${hits} literal(s) found; use tokens from src/styles/global.css instead.`);
  process.exit(hits ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
