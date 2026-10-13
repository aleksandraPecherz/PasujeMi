-- S-03: derived pantry-matching keys, computed when a recipe is written (plan: context/changes/first-pantry-match/plan.md).
-- Additive and backward compatible: both columns are nullable and old code never reads them.
-- No write policies: only the service role (scripts/match-keys.ts, later recipe writes) fills the keys.
-- The existing "recipes_select_authenticated" policy already covers the new columns.

alter table public.recipes
  add column match_keys jsonb,
  add column match_keys_version integer;

comment on column public.recipes.match_keys is
  'Output of computeMatchKeys(ingredients) from src/lib/matching; null until computed.';
comment on column public.recipes.match_keys_version is
  'MATCH_KEYS_VERSION used for match_keys; rows with null or another version get keys computed per request.';
