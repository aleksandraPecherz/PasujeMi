// Pantry matching (S-03): pure rule module, no Supabase. Rule: context/changes/first-pantry-match/plan.md.
export {
  MATCH_KEYS_VERSION,
  computeMatchKeys,
  keysEqual,
  normalizeExclusion,
  normalizeTag,
  type TagKeys,
} from "@/lib/matching/keys";
export {
  rankRecipes,
  resolveMatch,
  type PantryKeys,
  type RankCandidate,
  type RankedIngredient,
  type RankedRecipe,
} from "@/lib/matching/rank";
