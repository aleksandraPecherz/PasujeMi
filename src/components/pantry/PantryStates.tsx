import type { ReactNode } from "react";
import { SearchX, SlidersHorizontal, TriangleAlert, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { recipeCountLabel } from "@/lib/recipe-count";
import { cn } from "@/lib/utils";

const noticeClass =
  "bg-warning-surface text-warning flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium empty:hidden";

/** Why the last tag was not added (request limits); the status region stays mounted so the message is announced. */
export function LimitNotice({ message, className }: { message: string | null; className?: string }) {
  return (
    <p role="status" className={cn(noticeClass, className)}>
      {message !== null && (
        <>
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </>
      )}
    </p>
  );
}

/** Why the staples and exclusions are not saved; its own region, so it and LimitNotice can show at once. */
export function SaveNotice({ message, className }: { message: string | null; className?: string }) {
  return (
    <p role="status" className={cn(noticeClass, className)}>
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
  return <p className={cn("text-muted-foreground", className)}>{recipeCountLabel(total)}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className={cn(cardVariants(), "text-muted-foreground p-5")}>{children}</p>;
}

/** Every recipe contains an excluded ingredient: names the exclusions so the cause is visible, and offers to change them. */
export function NoResults({ excluded, onEdit }: { excluded: string[]; onEdit: () => void }) {
  return (
    <div className={cn(cardVariants(), "flex flex-col items-center gap-4 p-6 text-center")}>
      <div className="bg-exclude text-destructive grid size-16 place-items-center rounded-full">
        <SearchX className="size-8" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-extrabold">Brak przepisów</h3>
      <p className="text-muted-foreground">
        Wszystkie zawierają wykluczony składnik. Usuń któreś wykluczenie i zastosuj filtry ponownie.
      </p>
      {excluded.length > 0 && (
        <ul aria-label="Wykluczone produkty" className="flex flex-wrap justify-center gap-2">
          {excluded.map((tag) => (
            <li key={tag}>
              <Badge variant="exclude" className="px-3 py-1 text-base">
                {tag}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" size="lg" onClick={onEdit}>
        <SlidersHorizontal aria-hidden="true" />
        Zmień wykluczenia
      </Button>
    </div>
  );
}

/** The list could not be loaded; retrying repeats the same request as "Zastosuj filtry". */
export function LoadError({ message, onRetry, busy }: { message: string; onRetry: () => void; busy: boolean }) {
  return (
    <div role="alert" className={cn(cardVariants(), "flex flex-col items-center gap-4 p-6 text-center")}>
      <div className="bg-exclude text-destructive grid size-16 place-items-center rounded-full">
        <WifiOff className="size-8" aria-hidden="true" />
      </div>
      <p className="text-lg font-bold">{message}</p>
      <Button type="button" size="lg" onClick={onRetry} disabled={busy}>
        Spróbuj ponownie
      </Button>
    </div>
  );
}

/** Shown while the first page loads; the status region in the view announces it. */
export function LoadingLine() {
  return (
    <p aria-hidden="true" className="text-muted-foreground flex items-center gap-3">
      <span className="border-border border-t-primary size-5 animate-spin rounded-full border-2 motion-reduce:animate-none" />
      Wczytywanie przepisów…
    </p>
  );
}

/** Placeholder tiles shaped like a recipe tile, so the list does not jump when the first page arrives. */
export function RecipeListSkeleton({ count }: { count: number }) {
  return (
    <div aria-hidden="true" className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(cardVariants(), "flex items-start gap-4 p-4")}>
          <Skeleton className="size-22 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
