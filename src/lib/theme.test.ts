import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, resolveTheme } from "@/lib/theme";

describe("resolveTheme", () => {
  it.each([true, false])("a stored 'dark' beats the system (systemDark=%s)", (systemDark) => {
    expect(resolveTheme("dark", systemDark)).toBe("dark");
  });

  it.each([true, false])("a stored 'light' beats the system (systemDark=%s)", (systemDark) => {
    expect(resolveTheme("light", systemDark)).toBe("light");
  });

  it("follows the system when nothing is stored", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("treats a junk value like no value", () => {
    expect(resolveTheme("purple", true)).toBe("dark");
    expect(resolveTheme("purple", false)).toBe("light");
    expect(resolveTheme("", true)).toBe("dark");
  });
});

/** Runs the inline script against fakes and reports whether <html> ended up with the `dark` class. */
function runInitScript(opts: { stored?: string | null; systemDark: boolean; storageThrows?: boolean }): boolean {
  const classes = new Set<string>();
  const localStorage = {
    getItem: () => {
      if (opts.storageThrows) throw new Error("blocked");
      return opts.stored ?? null;
    },
  };
  const matchMedia = () => ({ matches: opts.systemDark });
  const document = {
    documentElement: {
      classList: {
        toggle: (name: string, force: boolean) => {
          if (force) classes.add(name);
          else classes.delete(name);
        },
      },
    },
  };
  runInNewContext(THEME_INIT_SCRIPT, { localStorage, matchMedia, document });
  return classes.has("dark");
}

describe("THEME_INIT_SCRIPT", () => {
  it("stored dark + light system -> dark", () => {
    expect(runInitScript({ stored: "dark", systemDark: false })).toBe(true);
  });

  it("stored light + dark system -> no dark class", () => {
    expect(runInitScript({ stored: "light", systemDark: true })).toBe(false);
  });

  it("nothing stored + dark system -> dark", () => {
    expect(runInitScript({ systemDark: true })).toBe(true);
  });

  it("storage throws + dark system -> dark", () => {
    expect(runInitScript({ systemDark: true, storageThrows: true })).toBe(true);
  });

  it("nothing stored + light system -> no dark class", () => {
    expect(runInitScript({ systemDark: false })).toBe(false);
  });
});
