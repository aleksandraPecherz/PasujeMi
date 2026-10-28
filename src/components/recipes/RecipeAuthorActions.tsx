import { useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { useDeleteRecipe, type DeleteStatus } from "@/components/hooks/useDeleteRecipe";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface RecipeAuthorActionsViewProps {
  recipeId: string;
  recipeName: string;
  status: DeleteStatus;
  error: string | null;
  onConfirm: () => void;
  /** Opens the dialog at once; the kitchen sink uses it to show the "deleting" and "error" states. */
  defaultOpen?: boolean;
}

const MENU_ITEM =
  "hover:bg-accent flex min-h-12 w-full items-center gap-3 px-4 text-left font-medium focus-visible:outline-ring outline-none focus-visible:outline-2 focus-visible:-outline-offset-2";

export function RecipeAuthorActionsView({
  recipeId,
  recipeName,
  status,
  error,
  onConfirm,
  defaultOpen = false,
}: RecipeAuthorActionsViewProps) {
  const [open, setOpen] = useState(defaultOpen);
  const deleting = status === "deleting";
  const menuId = `recipe-actions-${recipeId}`;
  const desktopDelete = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // The popover is a top-layer element without an anchor, so it is placed under its trigger each time it opens.
  const placeMenu = (event: React.ToggleEvent<HTMLDivElement>) => {
    const trigger = menuTrigger.current;
    if (event.newState !== "open" || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    event.currentTarget.style.top = `${rect.bottom + 8}px`;
    event.currentTarget.style.right = `${document.documentElement.clientWidth - rect.right}px`;
  };

  const openConfirmation = () => {
    // The popover has to be gone before the dialog takes over focus.
    menu.current?.hidePopover();
    setOpen(true);
  };

  return (
    <>
      {/* Desktop: both actions as buttons. */}
      <div className="hidden items-center gap-2 sm:flex">
        <Button asChild variant="outline">
          <a href={`/recipes/${recipeId}/edit`}>
            <Pencil aria-hidden="true" />
            Edytuj
          </a>
        </Button>
        <Button
          ref={desktopDelete}
          type="button"
          variant="outline"
          className="text-destructive border-destructive/40"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Trash2 aria-hidden="true" />
          Usuń
        </Button>
      </div>

      {/* Phone: a native popover; Esc, a click outside and Tab need no extra code, and focus returns to the trigger. */}
      <div className="sm:hidden">
        <Button
          ref={menuTrigger}
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          popoverTarget={menuId}
          aria-label="Więcej akcji"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
        <div
          ref={menu}
          id={menuId}
          popover="auto"
          onToggle={placeMenu}
          className="bg-card text-card-foreground border-border fixed inset-auto m-0 w-56 overflow-hidden rounded-2xl border p-0 shadow-lg"
        >
          <a href={`/recipes/${recipeId}/edit`} className={MENU_ITEM}>
            <Pencil className="size-5" aria-hidden="true" />
            Edytuj przepis
          </a>
          <button
            type="button"
            className={`${MENU_ITEM} border-border text-destructive border-t`}
            onClick={openConfirmation}
          >
            <Trash2 className="size-5" aria-hidden="true" />
            Usuń przepis
          </button>
        </div>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          // Escape and "Anuluj" do not close the dialog while the request is running.
          if (!next && deleting) return;
          setOpen(next);
        }}
      >
        <AlertDialogContent
          className="rounded-2xl border-0 p-6"
          onCloseAutoFocus={(event) => {
            // The control that opened the dialog may be hidden (the popover item), so focus the visible one.
            event.preventDefault();
            [desktopDelete.current, menuTrigger.current].find((el) => el?.offsetParent)?.focus();
          }}
        >
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogMedia className="bg-destructive/10 text-destructive rounded-full">
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-xl font-extrabold">Usunąć przepis?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Przepis „<span className="break-words">{recipeName}</span>” zostanie usunięty. Tej operacji nie można
              cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ServerError message={error} />
          {/* On a phone the destructive button is on top, so a thumb aiming at "Anuluj" at the bottom does not hit it. */}
          <AlertDialogFooter>
            <AlertDialogCancel variant="secondary" size="lg" disabled={deleting}>
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="lg"
              disabled={deleting}
              aria-busy={deleting}
              onClick={(event) => {
                // Radix closes the dialog on every Action click; it has to stay open for the error.
                event.preventDefault();
                onConfirm();
              }}
            >
              {deleting ? "Usuwanie…" : "Usuń przepis"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Edit and Delete for a recipe; shown to its author or an admin. The name dates from S-06 (author only). */
export default function RecipeAuthorActions({ recipeId, recipeName }: { recipeId: string; recipeName: string }) {
  const { status, error, remove } = useDeleteRecipe(recipeId);
  return (
    <RecipeAuthorActionsView
      recipeId={recipeId}
      recipeName={recipeName}
      status={status}
      error={error}
      onConfirm={() => {
        void remove();
      }}
    />
  );
}
