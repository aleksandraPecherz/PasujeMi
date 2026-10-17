import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTheme, saveTheme, type Theme } from "@/lib/theme";

// Stateless on purpose: the icon swap is pure CSS (`dark:` variant), so there is no hydration mismatch or icon flash.
export default function ThemeToggle() {
  function toggle() {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
  }

  return (
    <Button type="button" variant="outline" size="icon" aria-label="Przełącz motyw jasny/ciemny" onClick={toggle}>
      <Moon className="dark:hidden" aria-hidden="true" />
      <Sun className="hidden dark:block" aria-hidden="true" />
    </Button>
  );
}
