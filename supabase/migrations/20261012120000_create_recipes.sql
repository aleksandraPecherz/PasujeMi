-- F-01: recipe catalog contract.
-- First domain table. Signed-in users can read every recipe; anonymous users see nothing;
-- nobody writes through the API yet (writes, authorship and admin arrive in S-05..S-07 as additive migrations).

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  steps text[] not null check (cardinality(steps) >= 1),
  -- Each element: { name, product, amount, unit, substitutes: [{ name, product, amount, unit }] }
  -- as described in docs/reference/recipe-data-contract.md. The database checks only that this is
  -- a non-empty array; element shape is validated by writers (S-05 form, F-02 import).
  ingredients jsonb not null check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) >= 1),
  prep_time_min integer null check (prep_time_min >= 0),
  servings integer null check (servings > 0),
  kinds text[] not null default '{}'
    check (kinds <@ array['na słodko', 'na wytrawnie', 'na ciepło', 'na zimno']::text[]),
  -- Nutrition values are per single serving.
  kcal integer null check (kcal >= 0),
  protein_g numeric(6, 1) null check (protein_g >= 0),
  carbs_g numeric(6, 1) null check (carbs_g >= 0),
  fat_g numeric(6, 1) null check (fat_g >= 0),
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

-- Explicit privileges, independent of the project's default grants.
revoke all on public.recipes from anon, authenticated;
grant select on public.recipes to authenticated;

-- Read access for signed-in users only. No policies for anon and no write policies.
create policy "recipes_select_authenticated"
  on public.recipes
  for select
  to authenticated
  using (true);
