-- S-06: the author edits and deletes their own recipes (plan: context/changes/author-edits-own-recipe/plan.md).
-- Additive and backward compatible: two grants, two policies, one function and one trigger; old code is unaffected.
--
-- Extends the S-05 model: writes by users (insert and update of ingredients) leave match_keys and
-- match_keys_version null. Insert never sets them (no column grant); the trigger below nulls them when an update
-- changes the ingredients, so stale keys never outlive the ingredients they were computed from.
-- `npm run match-keys` (service role) stores fresh keys; matchRecipes computes them per request until then.
--
-- The admin who may edit and delete any recipe arrives in S-07.

-- Column-level grant: update cannot touch id, created_at, author_id, match_keys or match_keys_version.
grant update (name, steps, ingredients, prep_time_min, servings, kinds, kcal, protein_g, carbs_g, fat_g)
  on public.recipes to authenticated;

grant delete on public.recipes to authenticated;

-- A signed-in user updates only their own rows, and the row stays theirs.
create policy "recipes_update_own"
  on public.recipes
  for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "recipes_delete_own"
  on public.recipes
  for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- Changed ingredients invalidate the derived keys. Column privileges are checked for the columns named in the
-- UPDATE statement, not for values a BEFORE trigger changes in NEW, so the trigger needs no security definer.
create function public.recipes_reset_match_keys()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.match_keys := null;
  new.match_keys_version := null;
  return new;
end;
$$;

-- jsonb compares semantically: an update with unchanged ingredients keeps the keys.
create trigger recipes_reset_match_keys_on_ingredients
  before update on public.recipes
  for each row
  when (old.ingredients is distinct from new.ingredients)
  execute function public.recipes_reset_match_keys();
