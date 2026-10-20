-- S-07: an admin edits and deletes any recipe (plan: context/changes/admin-manages-any-recipe/plan.md).
-- Additive and backward compatible: one table, one schema, one function and two policies; the S-06 author policies stay.
--
-- Permissive policies combine with OR, so an author keeps their own rows and an admin reaches every row, including
-- those with author_id null (seed). The column grants from S-06 still apply: an admin cannot touch id, author_id,
-- match_keys or match_keys_version, and changed ingredients still reset the keys through the existing trigger.
--
-- There is no endpoint or screen for roles. The row in public.admins is added by hand with the SQL command in
-- docs/reference/recipe-data-contract.md (Supabase SQL Editor).

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Explicit privileges, independent of the project's default grants. Users only read their own row; the service role
-- (CI, SQL Editor) writes. anon and authenticated have no insert, update or delete grant.
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
grant select, insert, delete on public.admins to service_role;

create policy "admins_select_own"
  on public.admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- The helper lives in a schema PostgREST does not expose (config.toml `schemas` lists only public and graphql_public),
-- so it cannot be called through /rest/v1/rpc. It is security definer so it reads public.admins without RLS, which
-- avoids policy recursion; search_path is empty, so every name is schema-qualified.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

-- Postgres grants execute to PUBLIC by default.
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- with check only needs the role: authenticated has no update grant on author_id, so the row cannot change hands.
create policy "recipes_update_admin"
  on public.recipes
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "recipes_delete_admin"
  on public.recipes
  for delete
  to authenticated
  using ((select private.is_admin()));
