-- S-04: remembered staples and exclusions (plan: context/changes/remembered-staples-exclusions/plan.md).
-- Additive: a new private table, one row per user; no existing table changes.
--
-- Only the owner reads, inserts and updates their row. There is no delete policy or grant: clearing the lists
-- writes empty arrays into the existing row.
--
-- The database bounds only the number of tags per list (the same 30 as MAX_TAGS). The word limit (MAX_SAVED_TOKENS)
-- and the URL budget are application rules that depend on tokenize(), so they are not expressed in SQL: the endpoint
-- validates before writing and every read goes through parseSavedPantry, which treats the stored row as untrusted.

create table public.saved_pantry (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  staples text[] not null default '{}' check (cardinality(staples) <= 30),
  exclusions text[] not null default '{}' check (cardinality(exclusions) <= 30),
  updated_at timestamptz not null default now()
);

alter table public.saved_pantry enable row level security;

-- Explicit privileges, independent of the project's default grants.
revoke all on public.saved_pantry from anon, authenticated;
grant select on public.saved_pantry to authenticated;
-- An upsert makes PostgREST emit ON CONFLICT DO UPDATE SET for every column in the payload, user_id included,
-- so the update grant covers it; the update policy's with check keeps a row from being handed to someone else.
grant insert (user_id, staples, exclusions, updated_at) on public.saved_pantry to authenticated;
grant update (user_id, staples, exclusions, updated_at) on public.saved_pantry to authenticated;

create policy "saved_pantry_select_own"
  on public.saved_pantry
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "saved_pantry_insert_own"
  on public.saved_pantry
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "saved_pantry_update_own"
  on public.saved_pantry
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
