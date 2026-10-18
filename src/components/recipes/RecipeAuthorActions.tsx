import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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

  return (
    <>
      <Button asChild variant="outline">
        <a href={`/recipes/${recipeId}/edit`}>
          <Pencil aria-hidden="true" />
          Edytuj
        </a>
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" />
        Usuń
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          // Escape and "Anuluj" do not close the dialog while the request is running.
          if (!next && deleting) return;
          setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć przepis?</AlertDialogTitle>
            <AlertDialogDescription>
              Przepis „<span className="break-words">{recipeName}</span>” zostanie usunięty. Tej operacji nie można
              cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ServerError message={error} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
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
