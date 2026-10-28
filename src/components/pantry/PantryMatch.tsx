import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { EmptyState, LoadError, LoadingLine, NoResults, RecipeListSkeleton } from "@/components/pantry/PantryStates";
import { PantryEditor } from "@/components/pantry/PantryEditor";
import { PantrySummary } from "@/components/pantry/PantrySummary";
import { RecipeTile } from "@/components/recipes/RecipeTile";
import { Button } from "@/components/ui/button";
import { filtersChanged } from "@/lib/pantry/filters";
import type { SavedPantry } from "@/lib/pantry/saved";
import { recipeCountLabel } from "@/lib/recipe-count";
import { cn } from "@/lib/utils";
import { usePantryMatch, type PantrySection } from "@/components/hooks/usePantryMatch";

/** From this width the editor is the side panel; below it, a bottom sheet. Matches Tailwind's `lg`. */
const PANEL_QUERY = "(min-width: 64rem)";

export interface PantryMatchProps {
  userId: string;
  /** Saved staples and exclusions; `null` when the server could not read them. */
  saved: SavedPantry | null;
}

export default function PantryMatch({ userId, saved }: PantryMatchProps) {
  const {
    lists,
    applied,
    limitNotice,
    saveNotice,
    addTag,
    removeTag,
    apply,
    loadMore,
    recipes,
    hasMore,
    total,
    loading,
    reloading,
    error,
    filtered,
    restoredScrollY,
    consumeRestoredScroll,
  } = usePantryMatch({ userId, saved });
  const hasRecipes = recipes.length > 0;
  const stale = filtersChanged(lists, applied);
  const editorRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<PantrySection>("have");

  // After a restore, scroll once to the saved position. Manual restoration keeps the browser's own attempt (made before
  // the list exists) from fighting this; the frame delay lets the restored tiles lay out first.
  useEffect(() => {
    if (restoredScrollY === null || loading || !hasRecipes) {
      return;
    }
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, restoredScrollY);
      consumeRestoredScroll();
    });
    return () => {
      cancelAnimationFrame(frame);
      history.scrollRestoration = previousRestoration;
    };
  }, [restoredScrollY, loading, hasRecipes, consumeRestoredScroll]);

  const closeSheet = useCallback(() => {
    const editor = editorRef.current;
    if (editor?.matches(":popover-open")) {
      editor.hidePopover();
    }
  }, []);

  // Below `lg` the editor is a popover. While it is open the rest of the page is inert (so nothing under the backdrop
  // can be tabbed to or activated) and does not scroll; both are undone when it closes or the window grows to a panel.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const background = () => [
      document.querySelector("header"),
      ...document.querySelectorAll("[data-pantry-bar], [data-pantry-results]"),
    ];
    const setBackground = (open: boolean) => {
      for (const node of background()) {
        if (node instanceof HTMLElement) node.inert = open;
      }
      document.body.style.overflow = open ? "hidden" : "";
    };
    const onToggle = (event: Event) => {
      setBackground((event as ToggleEvent).newState === "open");
    };
    const media = window.matchMedia(PANEL_QUERY);
    const onMedia = () => {
      if (media.matches) closeSheet();
    };
    editor.addEventListener("toggle", onToggle);
    media.addEventListener("change", onMedia);
    return () => {
      editor.removeEventListener("toggle", onToggle);
      media.removeEventListener("change", onMedia);
      setBackground(false);
    };
  }, [closeSheet]);

  /** Opens the sheet on a list (phone) or focuses that list's field (panel). */
  const openEditor = useCallback((section: PantrySection, focusField: boolean) => {
    setTab(section);
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const field = () => document.getElementById(`pantry-${section}`);
    if (window.matchMedia(PANEL_QUERY).matches) {
      field()?.focus();
      return;
    }
    if (!editor.matches(":popover-open")) {
      editor.showPopover();
    }
    // The chosen list is shown after the state update; the field of a hidden list cannot take focus before that.
    requestAnimationFrame(() => {
      (focusField ? field() : editor.querySelector<HTMLElement>("button[aria-pressed='true']"))?.focus();
    });
  }, []);

  const applyAndClose = useCallback(() => {
    apply();
    closeSheet();
  }, [apply, closeSheet]);

  const showEmptyFiltered = filtered && !loading && error === null && recipes.length === 0;
  const countLine =
    total === null
      ? null
      : filtered
        ? `${recipeCountLabel(total)} · najlepiej dopasowane na górze`
        : `${recipeCountLabel(total)} · procent dopasowania pojawi się po dodaniu produktów`;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-8">
      <div className="flex flex-col gap-4 lg:col-span-1">
        <PantrySummary
          lists={lists}
          stale={stale}
          loading={loading}
          onEdit={() => {
            openEditor(tab, false);
          }}
          onApply={apply}
          onStart={() => {
            openEditor("have", true);
          }}
        />
        <PantryEditor
          ref={editorRef}
          lists={lists}
          tab={tab}
          onTabChange={setTab}
          onAdd={addTag}
          onRemove={removeTag}
          onApply={applyAndClose}
          onClose={closeSheet}
          loading={loading}
          limitNotice={limitNotice}
          saveNotice={saveNotice}
        />
      </div>

      <section
        aria-labelledby="recipes-heading"
        aria-busy={loading}
        data-pantry-results
        className="flex flex-col gap-4 lg:col-span-2"
      >
        <div className="flex flex-col gap-1">
          <h1 id="recipes-heading" className="text-3xl font-extrabold lg:text-4xl">
            {filtered ? "Pasujące przepisy" : "Przepisy z bazy"}
          </h1>
          {reloading ? (
            <LoadingLine />
          ) : (
            hasRecipes &&
            countLine !== null && (
              <p className="text-muted-foreground">{stale ? "Wyniki dla poprzedniej spiżarki" : countLine}</p>
            )
          )}
        </div>

        {stale && (
          <p className="bg-warning-surface text-warning hidden items-start gap-2 rounded-xl px-4 py-3 font-medium lg:flex">
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            Spiżarka zmieniona · wyniki jeszcze nie odświeżone. Kliknij „Zastosuj filtry”.
          </p>
        )}

        {error !== null && <LoadError message={error} onRetry={apply} busy={loading} />}

        {showEmptyFiltered && (
          <NoResults
            excluded={applied.exclude}
            onEdit={() => {
              openEditor("exclude", true);
            }}
          />
        )}
        {!filtered && !loading && error === null && recipes.length === 0 && (
          <EmptyState>Nie ma jeszcze żadnych przepisów.</EmptyState>
        )}

        {loading && recipes.length === 0 && <RecipeListSkeleton count={4} />}

        {hasRecipes && (
          <ul className={cn("grid gap-4 lg:grid-cols-2", loading && "opacity-60")}>
            {recipes.map(({ recipe, match }) => (
              <li key={recipe.id} className="min-w-0">
                <RecipeTile recipe={recipe} match={match} />
              </li>
            ))}
          </ul>
        )}

        <p role="status" className="sr-only">
          {loading
            ? "Wczytywanie przepisów…"
            : stale
              ? "Spiżarka zmieniona. Wyniki są nieaktualne, zastosuj filtry."
              : hasRecipes && total !== null
                ? recipeCountLabel(total)
                : ""}
        </p>

        {hasMore && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={loadMore}
            disabled={loading}
            className="w-full lg:w-auto lg:self-center lg:px-10"
          >
            Pokaż więcej
          </Button>
        )}
      </section>
    </div>
  );
}
