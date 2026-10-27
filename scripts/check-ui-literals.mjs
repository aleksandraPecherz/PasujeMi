// UI literal scan: files already moved onto design tokens (src/styles/global.css) must not get literal colors
// or arbitrary values back. Zero dependencies on purpose.
// No arguments: scans every file in CLEAN_FILES. With arguments (lint-staged): scans only those that are listed.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  "src/pages/recipes/new.astro",
  "src/components/recipes/RecipeForm.tsx",
  "src/components/recipes/RecipeFormView.tsx",
  "src/components/recipes/IngredientFields.tsx",
  "src/components/recipes/RecipeSaved.tsx",
  "src/pages/auth/signin.astro",
  "src/pages/auth/signup.astro",
  "src/pages/auth/confirm-email.astro",
  "src/components/auth/FormField.tsx",
  "src/components/auth/PasswordToggle.tsx",
  "src/components/auth/SignUpForm.tsx",
  "src/components/auth/SubmitButton.tsx",
  "src/components/auth/SignInForm.tsx",
  "src/layouts/Layout.astro",
  "src/components/ThemeToggle.tsx",
  "src/components/recipes/RecipeDetails.tsx",
  "src/pages/recipes/[id].astro",
  "src/pages/recipes/[id]/edit.astro",
  "src/components/recipes/RecipeAuthorActions.tsx",
  "src/components/NotFoundView.astro",
  "src/pages/404.astro",
  "src/components/Banner.astro",
  "src/components/Logo.astro",
  "src/components/ThemeLink.tsx",
  "src/components/auth/AuthShell.astro",
];

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";

const LITERAL = new RegExp(
  [
    String.raw`(?<!href=["'])#[0-9a-fA-F]{3,8}\b`, // hex color, not an in-page anchor
    String.raw`rgba?\(|hsla?\(|oklch\(`,
    String.raw`-\[(?:[^\]]*\d(?:px|rem|em|vh|vw|svh|dvh|ch|%)|[^\]]*(?:#|rgb|hsl|oklch)|[a-z]+\])`, // arbitrary length or color
    String.raw`\[[a-z-]+:[^\s\]]+\]`, // arbitrary property, e.g. [color:red]
    String.raw`\b(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|decoration|caret|accent|from|via|to|fill|stroke|shadow|divide)-(?:${PALETTE})\b`,
  ].join("|"),
);

/**
 * Finds literal colors and arbitrary values, one hit per offending line.
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
  return path.relative(ROOT, path.resolve(file)).replaceAll("\\", "/");
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length ? args.map(toRepoPath).filter((file) => CLEAN_FILES.includes(file)) : CLEAN_FILES;

  let hits = 0;
  for (const file of files) {
    const absolute = path.join(ROOT, file);
    if (!existsSync(absolute)) {
      console.log(`${file}: missing file in CLEAN_FILES`);
      hits++;
      continue;
    }
    for (const { line, content } of findLiterals(readFileSync(absolute, "utf8"))) {
      console.log(`${file}:${line}: ${content.trim()}`);
      hits++;
    }
  }

  if (hits) console.log(`\n${hits} literal(s) found; use tokens from src/styles/global.css instead.`);
  process.exit(hits ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
