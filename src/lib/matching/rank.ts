// Ranking: owned/staple tags and exclusions against recipe keys (plan.md, "Reguła dopasowania", points 5–10).
import { keysEqual, type TagKeys } from "@/lib/matching/keys";
import type { IngredientMatch, MatchKeys, MatchOptionKeys, RecipeIngredient, RecipeMatch } from "@/types";

export interface RankCandidate {
  id: string;
  name: string;
  keys: MatchKeys;
}

/** Owned and staple tags go together in `have`: staples count exactly like owned products. */
export interface PantryKeys {
  have: TagKeys[];
  exclude: TagKeys[];
}

/** Ingredient status before product names are known; see `resolveMatch`. */
export interface RankedIngredient {
  status: IngredientMatch["status"];
  mainExcluded: boolean;
  /** Index into the ingredient's `substitutes` behind `IngredientMatch.via`, or null. */
  viaSubstitute: number | null;
}

export interface RankedRecipe {
  id: string;
  name: string;
  match: { percent: number | null; ingredients: RankedIngredient[] };
}

/**
 * One list of tags (owned + staple, or exclusions). Each distinct catalog key is compared with the tag keys once
 * (edit distance) and the result is cached; recipes are then scored with map and set lookups only. Edit distance
 * per (recipe × tag) pair would not fit the Worker CPU budget.
 */
class TagIndex {
  /** Per tag: indices of its distinct keys. */
  readonly tags: Set<number>[];
  private readonly tagKeys: string[] = [];
  /** Catalog key → indices of the tag keys equal to it (possibly empty). */
  private readonly hitCache = new Map<string, number[]>();

  constructor(tags: TagKeys[]) {
    const keyIndex = new Map<string, number>();
    this.tags = tags.map((tag) => {
      const indices = new Set<number>();
      for (const key of tag) {
        let index = keyIndex.get(key);
        if (index === undefined) {
          index = this.tagKeys.length;
          this.tagKeys.push(key);
          keyIndex.set(key, index);
        }
        indices.add(index);
      }
      return indices;
    });
  }

  hits(key: string): number[] {
    let hits = this.hitCache.get(key);
    if (hits === undefined) {
      hits = [];
      for (const [index, tagKey] of this.tagKeys.entries()) {
        if (keysEqual(tagKey, key)) hits.push(index);
      }
      this.hitCache.set(key, hits);
    }
    return hits;
  }

  /** Indices of tag keys equal to any of `keys`. */
  matched(keys: string[]): Set<number> {
    const matched = new Set<number>();
    for (const key of keys) {
      for (const hit of this.hits(key)) matched.add(hit);
    }
    return matched;
  }

  /** Some tag has all its keys among `keys`. */
  someTagWithin(keys: string[]): boolean {
    const matched = this.matched(keys);
    if (matched.size === 0) return false;
    return this.tags.some((tag) => [...tag].every((index) => matched.has(index)));
  }

  /** Some tag contains all of `keys`. */
  someTagContaining(keys: string[]): boolean {
    const hits = keys.map((key) => this.hits(key));
    if (hits.some((list) => list.length === 0)) return false;
    return this.tags.some((tag) => hits.every((list) => list.some((index) => tag.has(index))));
  }
}

interface OptionVerdict {
  excluded: boolean;
  owned: boolean;
}

function evaluateOption(option: MatchOptionKeys, have: TagIndex, exclude: TagIndex): OptionVerdict {
  // Empty keys (e.g. a product made only of numbers) are neither owned nor excluded.
  if (option.k.length === 0) return { excluded: false, owned: false };
  // Exclusion: tag keys ⊆ option keys ∪ parent keys, so a general exclusion hides specific products.
  const excluded = exclude.someTagWithin(option.p ? [...option.k, ...option.p] : option.k);
  // Owning: tag keys ⊆ option keys, or option keys ⊆ tag keys. Parents never count.
  const owned = have.someTagWithin(option.k) || have.someTagContaining(option.k);
  return { excluded, owned };
}

// Same order as `localeCompare(…, "pl")`, without building a collator per comparison.
const nameCollator = new Intl.Collator("pl");

export function rankRecipes(candidates: RankCandidate[], pantry: PantryKeys): RankedRecipe[] {
  const haveTags = pantry.have.filter((tag) => tag.length > 0);
  const have = new TagIndex(haveTags);
  const exclude = new TagIndex(pantry.exclude.filter((tag) => tag.length > 0));
  // The same product appears in many recipes, so verdicts are cached per distinct option.
  const verdicts = new Map<string, OptionVerdict>();
  const verdict = (option: MatchOptionKeys) => {
    const signature = option.p
      ? `${option.k.join("\n")}\t${option.p.join("\n")}`
      : option.k.length === 1
        ? option.k[0]
        : option.k.join("\n");
    let result = verdicts.get(signature);
    if (result === undefined) {
      result = evaluateOption(option, have, exclude);
      verdicts.set(signature, result);
    }
    return result;
  };

  const scored: { recipe: RankedRecipe; available: number; total: number }[] = [];
  for (const candidate of candidates) {
    const ingredients: RankedIngredient[] = [];
    let available = 0;
    let blocked = false;
    for (const options of candidate.keys) {
      // Plain loop: this runs for every option of the catalog on each request.
      let owned = -1;
      let firstAllowed = -1;
      for (let index = 0; index < options.length; index++) {
        const result = verdict(options[index]);
        if (result.excluded) continue;
        if (firstAllowed < 0) firstAllowed = index;
        // An excluded option never gives "have", even when owned.
        if (result.owned) {
          owned = index;
          break;
        }
      }
      // Blocked: every option (main and substitutes) is excluded. A blocked ingredient hides the recipe.
      if (firstAllowed < 0) {
        blocked = true;
        break;
      }
      const mainExcluded = firstAllowed > 0;
      let via: number | null = null;
      if (owned > 0) via = owned;
      else if (owned < 0 && mainExcluded) via = firstAllowed;
      if (owned >= 0) available++;
      ingredients.push({
        status: owned >= 0 ? "have" : "unknown",
        mainExcluded,
        viaSubstitute: via === null ? null : via - 1,
      });
    }
    if (blocked) continue;
    const total = ingredients.length;
    const percent = haveTags.length === 0 ? null : total === 0 ? 0 : Math.round((available / total) * 100);
    scored.push({
      recipe: { id: candidate.id, name: candidate.name, match: { percent, ingredients } },
      available,
      total,
    });
  }

  scored.sort((a, b) => {
    if (haveTags.length > 0) {
      // Exact fractions compared by cross-multiplication; an empty recipe counts as 0.
      const fraction = b.available * Math.max(a.total, 1) - a.available * Math.max(b.total, 1);
      if (fraction !== 0) return fraction;
      if (a.available !== b.available) return b.available - a.available;
    }
    const byName = nameCollator.compare(a.recipe.name, b.recipe.name);
    if (byName !== 0) return byName;
    return a.recipe.id < b.recipe.id ? -1 : a.recipe.id > b.recipe.id ? 1 : 0;
  });
  return scored.map(({ recipe }) => recipe);
}

/** Attaches product names: `via` becomes the substitute's `product`. */
export function resolveMatch(match: RankedRecipe["match"], ingredients: RecipeIngredient[]): RecipeMatch {
  return {
    percent: match.percent,
    ingredients: match.ingredients.map(({ status, mainExcluded, viaSubstitute }, index) => ({
      status,
      mainExcluded,
      via: viaSubstitute === null ? null : ingredients[index].substitutes[viaSubstitute].product,
    })),
  };
}
