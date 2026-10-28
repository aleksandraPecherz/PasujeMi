import { Moon, Sun } from "lucide-react";
import { applyTheme, saveTheme, type Theme } from "@/lib/theme";

// Stateless like ThemeToggle: icon and label swap with the `dark:` variant, so there is no hydration mismatch or flash.
export default function ThemeLink() {
  function toggle() {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Moon className="size-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-5 dark:block" aria-hidden="true" />
      <span className="dark:hidden">Ciemny motyw</span>
      <span className="hidden dark:inline">Jasny motyw</span>
    </button>
  );
}
