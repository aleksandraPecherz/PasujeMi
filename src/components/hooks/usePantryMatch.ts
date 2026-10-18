import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearSnapshot,
  listStateEnded,
  missesSavedExclusion,
  readSnapshot,
  restoreLists,
  writeSnapshot,
} from "@/lib/list-state";
import { MAX_TAG_LENGTH, MAX_TAGS, MAX_TOKENS, MAX_URL_LENGTH, countTokens } from "@/lib/matching/limits";
import { MAX_SAVED_TOKENS } from "@/lib/pantry/limits";
import { initialFilters, type SavedPantry } from "@/lib/pantry/saved";
import { createPantrySaver } from "@/lib/pantry/saver";
import type { PantryLists, PantrySection, Recipe, RecipeMatch } from "@/types";

export type { PantryLists, PantrySection };

const PAGE_SIZE = 10;
// The endpoints accept at most 50 per request; a restore of up to MAX_RESTORE_RECIPES takes one or two such requests.
const RESTORE_PAGE_SIZE = 50;
const LIMIT_MESSAGE = `Za dużo produktów naraz (limit ${MAX_TOKENS} słów we wszystkich listach). Usuń któryś produkt.`;
const SAVED_LIMIT_MESSAGE = `Za dużo produktów stałych i wykluczeń (limit ${MAX_SAVED_TOKENS} słów razem). Usuń któryś produkt.`;
const SAVE_DISABLED_MESSAGE = "Nie udało się wczytać produktów stałych i wykluczeń — zmiany nie zostaną zapisane.";

export interface ListedRecipe {
  recipe: Recipe;
  /** Present only for results of /api/recipes/match. */
  match?: RecipeMatch;
}

function hasFilters(lists: PantryLists): boolean {
  return lists.have.length + lists.staple.length + lists.exclude.length > 0;
}

function buildUrl(filters: PantryLists, offset: number, limit = PAGE_SIZE): string {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (!hasFilters(filters)) {
    return `/api/recipes?${params.toString()}`;
  }
  for (const section of ["have", "staple", "exclude"] as const) {
    for (const tag of filters[section]) {
      params.append(section, tag);
    }
  }
  return `/api/recipes/match?${params.toString()}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecipe(value: unknown): value is Recipe {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.ingredients)
  );
}

function isMatch(value: unknown, ingredientCount: number): value is RecipeMatch {
  return (
    isObject(value) &&
    (value.percent === null || typeof value.percent === "number") &&
    Array.isArray(value.ingredients) &&
    value.ingredients.length === ingredientCount
  );
}

// Status and body shape first, content second (context/foundation/lessons.md).
function parsePage(
  body: unknown,
  withMatch: boolean,
): { items: ListedRecipe[]; hasMore: boolean; total: number | null } | null {
  if (
    !isObject(body) ||
    !Array.isArray(body.recipes) ||
    typeof body.hasMore !== "boolean" ||
    !(typeof body.total === "number" || body.total === null)
  ) {
    return null;
  }
  const items: ListedRecipe[] = [];
  for (const entry of body.recipes) {
    if (!isRecipe(entry)) {
      return null;
    }
    if (withMatch) {
      const match = (entry as { match?: unknown }).match;
      if (!isMatch(match, entry.ingredients.length)) {
        return null;
      }
      items.push({ recipe: entry, match });
    } else {
      items.push({ recipe: entry });
    }
  }
  return { items, hasMore: body.hasMore, total: body.total };
}

type PageResult =
  { ok: true; items: ListedRecipe[]; hasMore: boolean; total: number | null } | { ok: false; message: string };

// The same check as addTag, so a request above the endpoint's limits never leaves the browser.
function exceedsLimits(filters: PantryLists): boolean {
  return (
    countTokens([...filters.have, ...filters.staple, ...filters.exclude]) > MAX_TOKENS ||
    buildUrl(filters, 0).length > MAX_URL_LENGTH
  );
}

async function requestPage(
  filters: PantryLists,
  offset: number,
  signal: AbortSignal,
  limit = PAGE_SIZE,
): Promise<PageResult> {
  if (exceedsLimits(filters)) {
    return { ok: false, message: LIMIT_MESSAGE };
  }
  try {
    const res = await fetch(buildUrl(filters, offset, limit), { headers: { Accept: "application/json" }, signal });
    if (!res.ok) {
      return {
        ok: false,
        message:
          res.status === 401
            ? "Sesja wygasła. Zaloguj się ponownie."
            : "Nie udało się pobrać przepisów. Spróbuj ponownie.",
      };
    }
    const page = parsePage(await res.json(), hasFilters(filters));
    if (page === null) {
      return { ok: false, message: "Serwer zwrócił nieoczekiwaną odpowiedź. Spróbuj ponownie." };
    }
    return { ok: true, ...page };
  } catch {
    // An aborted request lands here too; `commit` drops it, because a newer request has taken its id.
    return { ok: false, message: "Brak połączenia z serwerem. Spróbuj ponownie." };
  }
}

// Re-fetches the first `loaded` recipes in as few requests as the endpoint limit allows (each one walks the catalog).
async function requestRestore(filters: PantryLists, loaded: number, signal: AbortSignal): Promise<PageResult> {
  const items: ListedRecipe[] = [];
  let hasMore = false;
  let total: number | null = null;
  for (let offset = 0; offset < loaded; offset += RESTORE_PAGE_SIZE) {
    const result = await requestPage(filters, offset, signal, Math.min(RESTORE_PAGE_SIZE, loaded - offset));
    if (!result.ok) {
      return result;
    }
    items.push(...result.items);
    hasMore = result.hasMore;
    total = result.total;
  }
  return { ok: true, items, hasMore, total };
}

export function usePantryMatch({ userId, saved }: { userId: string; saved: SavedPantry | null }) {
  // Both start from the saved staples and exclusions (the server read them), so SSR and hydration agree and the first
  // list is already filtered.
  const [lists, setLists] = useState<PantryLists>(() => initialFilters(saved));
  // Filters of the shown list, snapshotted at "Zastosuj filtry"; "Pokaż więcej" pages with these, not the edited tags.
  const [applied, setApplied] = useState<PantryLists>(() => initialFilters(saved));
  const [recipes, setRecipes] = useState<ListedRecipe[]>([]);
  const [hasMore, setHasMore] = useState(false);
  // All recipes of the shown list, not only the loaded pages; null when the server could not count them.
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  // A request from offset 0 (new filters) is in flight: the old count is hidden, while "Pokaż więcej" keeps it.
  const [reloading, setReloading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Why the last tag was not added because of the request limits; cleared by the next successful edit.
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  // Outcome of the last saved-pantry write; a failed read of the saved lists is reported separately (saveNotice below).
  const [saveResult, setSaveResult] = useState<string | null>(null);
  // Created on the first save, once per mount, and only when the saved lists were read (saving is off otherwise).
  const saver = useRef<ReturnType<typeof createPantrySaver> | null>(null);
  // Only the latest request may update the list; an older response (e.g. "Pokaż więcej" before a new apply) is dropped.
  const requestId = useRef(0);
  // A superseded request is aborted, so the Worker does not finish a full-catalog match nobody will see.
  const inFlight = useRef<AbortController | null>(null);
  // Scroll position to return to once a restored list has rendered; the view clears it after scrolling.
  const [restoredScrollY, setRestoredScrollY] = useState<number | null>(null);
  // Saving is off until the startup read/restore is done, or the empty first render would overwrite the snapshot.
  const saveEnabled = useRef(false);
  const latest = useRef({ lists, applied, offset });

  const commit = useCallback(
    (id: number, filters: PantryLists, pageOffset: number, result: PageResult, count = PAGE_SIZE) => {
      if (id !== requestId.current) {
        return;
      }
      setLoading(false);
      setReloading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setApplied(filters);
      setRecipes((prev) => (pageOffset === 0 ? result.items : [...prev, ...result.items]));
      setHasMore(result.hasMore);
      setTotal(result.total);
      // Advance by the count requested (page size, or the restored amount), not by the rows received: the service may
      // drop a recipe deleted mid-request.
      setOffset(pageOffset + count);
    },
    [],
  );

  const load = useCallback(
    (filters: PantryLists, pageOffset: number) => {
      const id = ++requestId.current;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setLoading(true);
      setReloading(pageOffset === 0);
      void requestPage(filters, pageOffset, controller.signal).then((result) => {
        commit(id, filters, pageOffset, result);
      });
    },
    [commit],
  );

  // Initial view: a snapshot saved before leaving the list is restored; otherwise the list filtered by the saved staples
  // and exclusions (the plain FR-005 list when there are none) in a single request, never an unfiltered one first.
  // `loading` and `reloading` start as true. The snapshot is read here, not in a state initializer, so hydration matches
  // the server HTML; it is not removed on read, so the second run of this effect in StrictMode finds it again.
  useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();
    inFlight.current = controller;
    const startFilters = initialFilters(saved);
    let snapshot = readSnapshot();
    // An exclusion saved after the snapshot was written (another tab) would show a recipe the user excluded.
    if (snapshot !== null && (snapshot.loaded === 0 || missesSavedExclusion(snapshot.applied, saved))) {
      clearSnapshot();
      snapshot = null;
    }
    if (snapshot === null) {
      void requestPage(startFilters, 0, controller.signal).then((result) => {
        commit(id, startFilters, 0, result);
        if (id === requestId.current) {
          saveEnabled.current = true;
        }
      });
    } else {
      void requestRestore(snapshot.applied, snapshot.loaded, controller.signal).then((result) => {
        if (id !== requestId.current) {
          return;
        }
        if (result.ok) {
          // Only "have" comes from the snapshot; staples and exclusions stay as the database (and the user) have them.
          const merged = restoreLists(snapshot.lists, latest.current.lists);
          setLists((prev) => restoreLists(snapshot.lists, prev));
          if (exceedsLimits(merged)) {
            setLimitNotice(LIMIT_MESSAGE);
          }
          commit(id, snapshot.applied, 0, result, snapshot.loaded);
          setRestoredScrollY(snapshot.scrollY);
        } else {
          // Back to the saved filters with the usual error message.
          clearSnapshot();
          commit(id, startFilters, 0, result);
        }
        saveEnabled.current = true;
      });
    }
    return () => {
      controller.abort();
    };
  }, [commit, saved]);

  useEffect(() => {
    latest.current = { lists, applied, offset };
  }, [lists, applied, offset]);

  // Leaving the page (link to a recipe, tab switch, reload): remember where the list was.
  useEffect(() => {
    const save = () => {
      const { lists: l, applied: a, offset: loaded } = latest.current;
      if (!saveEnabled.current || loaded === 0) {
        return;
      }
      writeSnapshot({ lists: l, applied: a, loaded, scrollY: window.scrollY });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        save();
      }
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const consumeRestoredScroll = useCallback(() => {
    setRestoredScrollY(null);
  }, []);

  // Called from the handlers, never from a state updater: StrictMode runs updaters twice.
  const saveLists = useCallback(
    (next: PantryLists) => {
      if (saved === null) {
        return;
      }
      saver.current ??= createPantrySaver({ ownerId: userId, isStopped: listStateEnded, onResult: setSaveResult });
      saver.current.save({ staple: next.staple, exclude: next.exclude });
    },
    [saved, userId],
  );

  /**
   * Returns false when the tag was skipped: empty, too long, a case-insensitive duplicate, the section is full, or the
   * request would exceed the word or URL limit (then `limitNotice` says why). A staple or exclusion is saved at once.
   */
  const addTag = useCallback(
    (section: PantrySection, tag: string): boolean => {
      const value = tag.trim();
      const current = lists[section];
      const key = value.toLocaleLowerCase("pl");
      if (
        value === "" ||
        value.length > MAX_TAG_LENGTH ||
        current.length >= MAX_TAGS ||
        current.some((t) => t.toLocaleLowerCase("pl") === key)
      ) {
        return false;
      }
      const next = { ...lists, [section]: [...current, value] };
      if (exceedsLimits(next)) {
        setLimitNotice(LIMIT_MESSAGE);
        return false;
      }
      if (section !== "have" && countTokens([...next.staple, ...next.exclude]) > MAX_SAVED_TOKENS) {
        setLimitNotice(SAVED_LIMIT_MESSAGE);
        return false;
      }
      setLimitNotice(null);
      setLists(next);
      if (section !== "have") {
        saveLists(next);
      }
      return true;
    },
    [lists, saveLists],
  );

  const removeTag = useCallback(
    (section: PantrySection, tag: string) => {
      const next = { ...lists, [section]: lists[section].filter((t) => t !== tag) };
      setLimitNotice(null);
      setLists(next);
      if (section !== "have") {
        saveLists(next);
      }
    },
    [lists, saveLists],
  );

  const apply = useCallback(() => {
    load(lists, 0);
  }, [load, lists]);

  const loadMore = useCallback(() => {
    load(applied, offset);
  }, [load, applied, offset]);

  return {
    lists,
    limitNotice,
    /** Why the staples and exclusions are not (or could not be) saved; null when all is well. */
    saveNotice: saved === null ? SAVE_DISABLED_MESSAGE : saveResult,
    addTag,
    removeTag,
    apply,
    loadMore,
    recipes,
    hasMore,
    total,
    offset,
    loading,
    reloading,
    error,
    restoredScrollY,
    consumeRestoredScroll,
    /** Whether the shown list was requested with any tags. */
    filtered: hasFilters(applied),
  };
}
