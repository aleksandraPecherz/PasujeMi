import { useRef, useState } from "react";

export type DeleteStatus = "idle" | "deleting" | "error";

const SESSION_EXPIRED = "Sesja wygasła. Zaloguj się ponownie.";
const NOT_FOUND = "Nie znaleziono przepisu. Mógł zostać już usunięty.";
const DELETE_FAILED = "Nie udało się usunąć przepisu. Spróbuj ponownie.";
const NO_CONNECTION = "Brak połączenia z serwerem. Spróbuj ponownie.";

/** Only the status is read, never the body. */
async function sendDelete(recipeId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE", headers: { Accept: "application/json" } });
    if (res.status === 204) return { ok: true };
    if (res.status === 401) return { ok: false, error: SESSION_EXPIRED };
    if (res.status === 404) return { ok: false, error: NOT_FOUND };
    return { ok: false, error: DELETE_FAILED };
  } catch {
    return { ok: false, error: NO_CONNECTION };
  }
}

export function useDeleteRecipe(recipeId: string) {
  const [status, setStatus] = useState<DeleteStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // A ref, not `status`: two clicks before the next render would both see the old status.
  const deletingRef = useRef(false);

  async function remove() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setError(null);
    setStatus("deleting");
    const result = await sendDelete(recipeId);
    if (result.ok) {
      // Stay locked ("deleting") until the browser navigates away.
      window.location.assign("/");
      return;
    }
    deletingRef.current = false;
    setError(result.error);
    setStatus("error");
  }

  return { status, error, remove };
}
