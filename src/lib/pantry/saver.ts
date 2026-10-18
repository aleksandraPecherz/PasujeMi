import type { SavedPantry } from "@/lib/pantry/saved";

export const SAVE_ERROR_MESSAGE = "Nie udało się zapisać produktów stałych i wykluczeń.";
const SESSION_EXPIRED_MESSAGE = "Sesja wygasła. Zaloguj się ponownie.";
const OTHER_ACCOUNT_MESSAGE = "Zalogowano się na inne konto. Odśwież stronę.";

/** What the user sees for the status of a PUT /api/pantry; null means saved. Status 0 is a network error. */
export function saveMessage(status: number): string | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401) return SESSION_EXPIRED_MESSAGE;
  if (status === 409) return OTHER_ACCOUNT_MESSAGE;
  return SAVE_ERROR_MESSAGE;
}

async function sendPantry(ownerId: string, pantry: SavedPantry): Promise<number> {
  try {
    const res = await fetch("/api/pantry", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId, ...pantry }),
    });
    return res.status;
  } catch {
    return 0;
  }
}

export interface PantrySaverOptions {
  /** Id of the account the page was rendered for; the server answers 409 when the session belongs to another one. */
  ownerId: string;
  /** Sends one full state and resolves with the HTTP status (0 for a network error). */
  send?: (pantry: SavedPantry) => Promise<number>;
  /** Sign-out started: nothing more is sent, a waiting state is dropped. */
  isStopped: () => boolean;
  /** Called only when nothing newer is waiting, so an older response never overwrites the outcome of a newer one. */
  onResult: (message: string | null) => void;
}

/**
 * At most one request in flight; saves made meanwhile collapse into the newest one, sent when the current one ends.
 * The order of requests is the only thing that keeps the stored row equal to the last state shown. No retries.
 */
export function createPantrySaver({ ownerId, send, isStopped, onResult }: PantrySaverOptions) {
  const sendOne = send ?? ((pantry: SavedPantry) => sendPantry(ownerId, pantry));
  let busy = false;
  let pending: SavedPantry | null = null;

  async function run(first: SavedPantry): Promise<void> {
    busy = true;
    let next: SavedPantry | null = first;
    while (next !== null) {
      if (isStopped()) {
        pending = null;
        break;
      }
      let status: number;
      try {
        status = await sendOne(next);
      } catch {
        status = 0;
      }
      if (pending === null) {
        onResult(saveMessage(status));
        next = null;
      } else {
        next = pending;
        pending = null;
      }
    }
    busy = false;
  }

  return {
    save(pantry: SavedPantry): void {
      if (busy) {
        pending = pantry;
        return;
      }
      void run(pantry);
    },
  };
}
