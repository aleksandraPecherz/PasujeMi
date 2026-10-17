export const THEME_STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

/** A stored "light"/"dark" wins; anything else (including null) follows the system preference. */
export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return systemDark ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked or full: the choice just won't persist.
  }
}

/**
 * Body of the synchronous inline <head> script; mirrors resolveTheme + applyTheme without imports.
 * Storage and matchMedia are read in separate try blocks so a storage error still falls back to the system theme.
 */
export const THEME_INIT_SCRIPT = `(function () {
  var stored = null;
  var systemDark = false;
  try {
    stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  } catch (e) {}
  try {
    systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (e) {}
  var theme = stored === "light" || stored === "dark" ? stored : systemDark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", theme === "dark");
})();`;
