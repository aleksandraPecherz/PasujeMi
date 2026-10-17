import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { recipeCountLabel } from "@/lib/recipe-count";
import { cn } from "@/lib/utils";

/** Why the last tag was not added (request limits); the status region stays mounted so the message is announced. */
export function LimitNotice({ message, className }: { message: string | null; className?: string }) {
  return (
    <p role="status" className={cn("text-warning flex items-start gap-2 text-sm empty:hidden", className)}>
      {message !== null && (
        <>
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </>
      )}
    </p>
  );
}

/** "Znaleziono N przepisów" above the recipe list; `total` counts every page, not only the loaded ones. */
export function RecipeCount({ total, className }: { total: number; className?: string }) {
  return <p className={cn("text-muted-foreground text-sm", className)}>{recipeCountLabel(total)}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="border-border bg-card/50 text-muted-foreground rounded-2xl border p-4">{children}</p>;
}

/** Placeholder tiles in the recipe list's grid, shown while the first page loads. */
export function RecipeListSkeleton({ count }: { count: number }) {
  return (
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}
