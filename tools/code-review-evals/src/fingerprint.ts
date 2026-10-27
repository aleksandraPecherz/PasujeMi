// Fingerprint of everything that can change an eval result, so "configuration unchanged" is checkable.
// The reviewer's files are not listed by hand: they are the static import closure of the provider and of
// every file the promptfoo config references via file://, so a new import in run.ts enters the hash on its own.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type Component = { path: string; sha256: string };
export type Fingerprint = { hash: string; components: Component[] };

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_DIR = resolve(here, "..");

// Relative specifiers in static imports, re-exports and dynamic import("./x.ts").
const RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;
const FILE_REF = /file:\/\/([^\s'"`,)\]}]+)/g;

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");
// LF-normalised so the hash is the same on a CRLF checkout.
const textHash = (path: string): string => sha256(readFileSync(path, "utf8").replace(/\r\n/g, "\n"));

function resolveImport(from: string, specifier: string): string {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.js`, join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`fingerprint: cannot resolve "${specifier}" imported from ${from}`);
}

function importClosure(entry: string, seen: Set<string>): void {
  if (seen.has(entry)) return;
  seen.add(entry);
  if (!/\.(ts|js|mjs)$/.test(entry)) return;
  const source = readFileSync(entry, "utf8");
  for (const match of source.matchAll(RELATIVE_IMPORT)) {
    importClosure(resolveImport(entry, match[1] as string), seen);
  }
}

function walkFiles(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path)
    .sort()
    .flatMap((name) => walkFiles(join(path, name)));
}

export type FingerprintOptions = {
  packageDir?: string;
  // The reviewer package, whose package.json and lockfile (SDK and zod versions) are part of the hash.
  reviewerDir?: string;
};

export function computeFingerprint(options: FingerprintOptions = {}): Fingerprint {
  const packageDir = options.packageDir ?? DEFAULT_PACKAGE_DIR;
  const reviewerDir = options.reviewerDir ?? resolve(packageDir, "..", "code-reviewer");
  const files = new Set<string>();

  const mustExist = (path: string): string => {
    if (!existsSync(path)) throw new Error(`fingerprint: missing file ${path}`);
    return path;
  };
  const add = (path: string): void => void files.add(mustExist(path));

  // Always part of the hash when present: config (assertions, models, flags), expectations, diffs, lockfile.
  const configPath = join(packageDir, "promptfooconfig.yaml");
  for (const name of ["promptfooconfig.yaml", "expectations.md"]) {
    if (existsSync(join(packageDir, name))) add(join(packageDir, name));
  }
  if (existsSync(join(packageDir, "diffs"))) walkFiles(join(packageDir, "diffs")).forEach(add);
  for (const dir of [packageDir, reviewerDir]) {
    add(join(dir, "package.json"));
    add(join(dir, "package-lock.json"));
  }

  // Roots of the import closure: the provider plus every file:// target of the config.
  const roots = [join(packageDir, "src", "provider.ts")];
  if (existsSync(configPath)) {
    for (const match of readFileSync(configPath, "utf8").matchAll(FILE_REF)) {
      // `file://src/assertions.ts:correctCase` names a function inside the file; only the path is hashed.
      const target = resolve(packageDir, (match[1] as string).replace(/^\.\//, "").replace(/:[A-Za-z_$][\w$]*$/, ""));
      // Glob references are hashed through the directory part; a missing literal target is an error.
      const concrete = target.includes("*") ? dirname(target) : target;
      walkFiles(mustExist(concrete)).forEach((file) => roots.push(file));
    }
  }
  const closure = new Set<string>();
  for (const root of roots) importClosure(mustExist(root), closure);
  closure.forEach(add);

  const components = [...files]
    .map((file): Component => ({ path: relative(packageDir, file).split(sep).join("/"), sha256: textHash(file) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const hash = sha256(components.map((c) => `${c.path}:${c.sha256}`).join("\n"));
  return { hash, components };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { hash, components } = computeFingerprint();
  for (const component of components) console.log(`${component.sha256}  ${component.path}`);
  console.log(`fingerprint: ${hash}`);
}
