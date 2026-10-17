-- S-05: recipe authorship and insert by signed-in users (plan: context/changes/add-recipe/plan.md).
-- Additive and backward compatible: a new nullable column, one grant and one policy; old code never reads the column.
--
-- Rows written by a signed-in user keep match_keys and match_keys_version null: authenticated gets no grant
-- on those columns. matchRecipes computes the keys per request for such rows, and `npm run match-keys`
-- (service role) stores them. This supersedes the "later recipe writes" note in 20261013120000_add_recipe_match_keys.sql.
--
-- Update and delete policies arrive in S-06 and S-07.

alter table public.recipes
  add column author_id uuid null default auth.uid()
    references auth.users (id) on delete set null;

-- Serves the future "my recipes" queries (S-06) and the on delete set null scan.
create index recipes_author_id_idx on public.recipes (author_id);

comment on column public.recipes.author_id is
  'Author of the recipe. Set from the session (auth.uid()) on insert by a signed-in user. The F-02 import (service role) writes the UUID of the app author explicitly; seed rows have null. Null after the author account is deleted.';

-- Column-level grant: insert cannot set id, created_at, match_keys or match_keys_version.
grant insert (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g, author_id)
  on public.recipes to authenticated;

-- A signed-in user inserts only as themselves: neither null nor someone else's id passes.
create policy "recipes_insert_own"
  on public.recipes
  for insert
  to authenticated
  with check (author_id = (select auth.uid()));
