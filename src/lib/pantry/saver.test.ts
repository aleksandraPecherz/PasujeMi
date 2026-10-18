import { describe, expect, it, vi } from "vitest";
import type { SavedPantry } from "@/lib/pantry/saved";
import { createPantrySaver, saveMessage } from "@/lib/pantry/saver";

const A: SavedPantry = { staple: ["sól"], exclude: [] };
const B: SavedPantry = { staple: ["sól", "pieprz"], exclude: [] };
const C: SavedPantry = { staple: ["sól", "pieprz"], exclude: ["orzechy"] };

// A fake `send` whose requests are resolved by hand, in any order.
function setup(isStopped: () => boolean = () => false) {
  const sent: SavedPantry[] = [];
  const resolvers: ((status: number) => void)[] = [];
  const results: (string | null)[] = [];
  const send = vi.fn((pantry: SavedPantry) => {
    sent.push(pantry);
    return new Promise<number>((resolve) => {
      resolvers.push(resolve);
    });
  });
  const saver = createPantrySaver({
    ownerId: "owner",
    send,
    isStopped,
    onResult: (message) => results.push(message),
  });
  return { saver, sent, resolvers, results, send };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createPantrySaver", () => {
  it("sends the first save at once and reports success", async () => {
    const { saver, sent, resolvers, results } = setup();
    saver.save(A);
    expect(sent).toEqual([A]);
    resolvers[0](204);
    await flush();
    expect(results).toEqual([null]);
  });

  it("keeps one request in flight and sends the saves made meanwhile in order", async () => {
    const { saver, sent, resolvers } = setup();
    saver.save(A);
    saver.save(B);
    expect(sent).toEqual([A]);
    resolvers[0](204);
    await flush();
    expect(sent).toEqual([A, B]);
    resolvers[1](204);
    await flush();
    expect(sent).toEqual([A, B]);
  });

  it("collapses three saves into the newest waiting one", async () => {
    const { saver, sent, resolvers } = setup();
    saver.save(A);
    saver.save(B);
    saver.save(C);
    resolvers[0](204);
    await flush();
    expect(sent).toEqual([A, C]);
  });

  it("reports only the result of the last request", async () => {
    const { saver, resolvers, results } = setup();
    saver.save(A);
    saver.save(B);
    resolvers[0](500);
    await flush();
    expect(results).toEqual([]);
    resolvers[1](204);
    await flush();
    expect(results).toEqual([null]);
  });

  it("does not keep the error of an older request after a newer success", async () => {
    const { saver, resolvers, results } = setup();
    saver.save(A);
    saver.save(B);
    resolvers[0](0);
    await flush();
    resolvers[1](200);
    await flush();
    expect(results).toEqual([null]);
  });

  it("does not retry after a failure", async () => {
    const { saver, send, resolvers, results } = setup();
    saver.save(A);
    resolvers[0](500);
    await flush();
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(results).toEqual(["Nie udało się zapisać produktów stałych i wykluczeń."]);
  });

  it("sends the next save after a finished one", async () => {
    const { saver, sent, resolvers } = setup();
    saver.save(A);
    resolvers[0](204);
    await flush();
    saver.save(B);
    expect(sent).toEqual([A, B]);
  });

  it("drops the waiting state when stopped", async () => {
    let stopped = false;
    const { saver, sent, resolvers, results } = setup(() => stopped);
    saver.save(A);
    saver.save(B);
    stopped = true;
    resolvers[0](204);
    await flush();
    expect(sent).toEqual([A]);
    expect(results).toEqual([]);
  });

  it("sends nothing when already stopped", () => {
    const { saver, send } = setup(() => true);
    saver.save(A);
    expect(send).not.toHaveBeenCalled();
  });

  it("treats a rejected send as a network error", async () => {
    const results: (string | null)[] = [];
    const saver = createPantrySaver({
      ownerId: "owner",
      send: () => Promise.reject(new Error("boom")),
      isStopped: () => false,
      onResult: (message) => results.push(message),
    });
    saver.save(A);
    await flush();
    expect(results).toEqual(["Nie udało się zapisać produktów stałych i wykluczeń."]);
  });
});

describe("saveMessage", () => {
  it("maps statuses to messages", () => {
    expect(saveMessage(200)).toBeNull();
    expect(saveMessage(204)).toBeNull();
    expect(saveMessage(401)).toBe("Sesja wygasła. Zaloguj się ponownie.");
    expect(saveMessage(409)).toBe("Zalogowano się na inne konto. Odśwież stronę.");
    expect(saveMessage(400)).toBe("Nie udało się zapisać produktów stałych i wykluczeń.");
    expect(saveMessage(500)).toBe("Nie udało się zapisać produktów stałych i wykluczeń.");
    expect(saveMessage(0)).toBe("Nie udało się zapisać produktów stałych i wykluczeń.");
  });
});
