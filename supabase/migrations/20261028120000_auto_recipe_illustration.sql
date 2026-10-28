-- #63: a recipe saved without an illustration gets one from its name (plan: context/changes/soft-modern-recipe-form/plan.md, phase 4).
-- Additive: one trigger function and one trigger. No existing row changes (no backfill: scripts/assign-illustrations.ts stays
-- the way to fill existing rows), no grant or policy changes, and `authenticated` still cannot write recipes.illustration:
-- column privileges are checked for the columns named in the statement, not for values a BEFORE trigger sets in NEW, so the
-- function needs no security definer (same reasoning as recipes_reset_match_keys in 20261018120000).
--
-- The rules are the ordered list in src/lib/recipes/illustrationRules.ts (the form previews them): first match wins, Polish
-- letters are folded to ASCII and lower-cased first, a stem matches at the start of a word. A name with no match stays null
-- (placeholder). The condition below limits the trigger to rows without an illustration, so an existing assignment is never
-- overwritten, also not when the recipe is renamed. `npm run check:illustration-rules` compares SQL and TS on shared cases.
--
-- The function lives in schema private (not exposed by the API) and keeps the rules inline, so no role needs execute on it:
-- the creator is the only one checked, when the trigger is created. Execute is revoked from everyone, as for private.is_admin().

create function private.recipes_pick_illustration()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  n text := lower(translate(new.name, 'ĄĆĘŁŃÓŚŹŻąćęłńóśźż', 'ACELNOSZZacelnoszz'));
begin
  new.illustration := case
      when n ~ '(?:^|[^a-z0-9])(?:kanap|grzank|tost)[a-z0-9]*.*[^a-z0-9]jaj' then 'kanapka-jajko'
      when n ~ '(?:^|[^a-z0-9])(?:kanap|grzank|tost|bruschett|sandwich|bagiet)' then 'kanapka'
      when n ~ '(?:^|[^a-z0-9])(?:wrap|tortill|burrit|quesadill|tacos)' then 'wrap'
      when n ~ '(?:^|[^a-z0-9])salatk' then 'salatka'
      when n ~ '(?:^|[^a-z0-9])(?:koktajl|smoothie|shake|lemoniad)' then 'szklanka'
      when n ~ '(?:^|[^a-z0-9])(?:pizz|focacc|flatbread)' then 'placek'
      when n ~ '(?:^|[^a-z0-9])(?:zup|rosol|barszcz|zurek|chlodnik|gazpacho|bulion|flaki|krem(?:$|[^a-z0-9]))' then 'zupa'
      when n ~ '(?:^|[^a-z0-9])(?:makaron|spaghetti|lasagn|penne|tagliatell|fusilli|carbonara|ravioli|gnocchi)' then 'makaron'
      when n ~ '(?:^|[^a-z0-9])(?:ciast|tart[aey]?(?:$|[^a-z0-9])|tartaletk|babeczk|muffin|gofr|placusz|pancake|nalesn|batonik|brownie|sernik|deser|tiramisu|torcik|tort[ay]?(?:$|[^a-z0-9]))' then 'deser'
      when n ~ '(?:^|[^a-z0-9])(?:owsiank|pudding|granol|komosank|porridge|jaglank|musli)' then 'slodka-miska'
      when n ~ '(?:^|[^a-z0-9])(?:curry|chilli|chili|dal(?:$|[^a-z0-9])|gulasz|jednogarnk|leczo|bowl|risotto|pilaw|shakshuk)' then 'miska'
      when n ~ '(?:^|[^a-z0-9])(?:kurczak|indyk|wolowin|wieprzow|schab|poledwic|kotlet|golabk|pieczen|losos|dorsz|ryb[aey]?(?:$|[^a-z0-9])|sledz|makrel|pstrag|tunczyk|krewetk|pierog|jajecznic|omlet|sniadanie|ziemniak|stek|burger|zeberk|pulpet|klops|szynk|boczek)' then 'talerz'
    end;
  return new;
end;
$$;

revoke execute on function private.recipes_pick_illustration() from public, anon, authenticated;

create trigger recipes_pick_illustration
  before insert or update of name on public.recipes
  for each row
  when (new.illustration is null)
  execute function private.recipes_pick_illustration();
