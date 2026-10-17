import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_TAG_LENGTH, MAX_TAGS, MAX_TOKENS, MAX_URL_LENGTH, countTokens } from "@/lib/matching/limits";
import type { Recipe, RecipeMatch } from "@/types";

const PAGE_SIZE = 10;
const LIMIT_MESSAGE = `Za dużo produktów naraz (limit ${MAX_TOKENS} słów we wszystkich listach). Usuń któryś produkt.`;

export type PantrySection = "have" | "staple" | "exclude";
export type PantryLists = Record<PantrySection, string[]>;

export interface ListedRecipe {
  recipe: Recipe;
  /** Present only for results of /api/recipes/match. */
  match?: RecipeMatch;
}

const EMPTY_LISTS: PantryLists = { have: [], staple: [], exclude: [] };

function hasFilters(lists: PantryLists): boolean {
  return lists.have.length + lists.staple.length + lists.exclude.length > 0;
}

function buildUrl(filters: PantryLists, offset: number): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
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

async function requestPage(filters: PantryLists, offset: number, signal: AbortSignal): Promise<PageResult> {
  if (exceedsLimits(filters)) {
    return { ok: false, message: LIMIT_MESSAGE };
  }
  try {
    const res = await fetch(buildUrl(filters, offset), { headers: { Accept: "application/json" }, signal });
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

export function usePantryMatch() {
  const [lists, setLists] = useState<PantryLists>(EMPTY_LISTS);
  // Filters of the shown list, snapshotted at "Zastosuj filtry"; "Pokaż więcej" pages with these, not the edited tags.
  const [applied, setApplied] = useState<PantryLists>(EMPTY_LISTS);
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
  // Only the latest request may update the list; an older response (e.g. "Pokaż więcej" before a new apply) is dropped.
  const requestId = useRef(0);
  // A superseded request is aborted, so the Worker does not finish a full-catalog match nobody will see.
  const inFlight = useRef<AbortController | null>(null);

  const commit = useCallback((id: number, filters: PantryLists, pageOffset: number, result: PageResult) => {
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
    // Advance by the page size, not by the rows received: the service may drop a recipe deleted mid-request.
    setOffset(pageOffset + PAGE_SIZE);
  }, []);

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

  // Initial view: the plain FR-005 list (no filters); `loading` and `reloading` start as true, so no state is set here.
  useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();
    inFlight.current = controller;
    void requestPage(EMPTY_LISTS, 0, controller.signal).then((result) => {
      commit(id, EMPTY_LISTS, 0, result);
    });
    return () => {
      controller.abort();
    };
  }, [commit]);

  /**
   * Returns false when the tag was skipped: empty, too long, a case-insensitive duplicate, the section is full, or the
   * request would exceed the word or URL limit (then `limitNotice` says why).
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
      if (exceedsLimits({ ...lists, [section]: [...current, value] })) {
        setLimitNotice(LIMIT_MESSAGE);
        return false;
      }
      setLimitNotice(null);
      setLists((prev) => ({ ...prev, [section]: [...prev[section], value] }));
      return true;
    },
    [lists],
  );

  const removeTag = useCallback((section: PantrySection, tag: string) => {
    setLimitNotice(null);
    setLists((prev) => ({ ...prev, [section]: prev[section].filter((t) => t !== tag) }));
  }, []);

  const apply = useCallback(() => {
    load(lists, 0);
  }, [load, lists]);

  const loadMore = useCallback(() => {
    load(applied, offset);
  }, [load, applied, offset]);

  return {
    lists,
    limitNotice,
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
    /** Whether the shown list was requested with any tags. */
    filtered: hasFilters(applied),
  };
}
