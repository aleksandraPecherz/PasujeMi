-- #61: key of the static illustration shown on a recipe tile (plan: context/changes/soft-modern-pantry-recipes/plan.md).
-- Additive and optional: NULL means "no assignment" and the app shows the placeholder illustration.
--
-- The database checks only the key format. The set of known keys lives in the app (src/lib/recipes/illustrations.ts),
-- so a new illustration is an SVG file plus one line there, without a migration; an unknown key renders the placeholder.
--
-- No grants or policies change: the column inherits the existing RLS on public.recipes. `authenticated` has column-level
-- insert and update grants that do not list it, so only the service role (the one-off assignment script) can write it,
-- and POST/PUT /api/recipes never touch it: editing a recipe keeps its assignment.

alter table public.recipes
  add column illustration text
  check (illustration ~ '^[a-z][a-z0-9-]*$' and char_length(illustration) <= 40);
