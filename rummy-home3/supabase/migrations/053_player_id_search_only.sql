-- 053 — Find someone on EZ Score by Player ID only (D113, Q30). Sree, Nov 25: "find people in the
-- database only by their player number and nothing else … It should be a server change. Name should
-- not be searchable. Within my players, it's okay to search."
--
-- A. short_player_name(name): first name + last initial ("Ravi Kumar" -> "Ravi K."); one word stays as
--    it is; empty -> "Rummy Player". The app applies the same rule (utils/playerSearch.ts).
-- B. search_players(query): same signature, so older app builds keep working, but it answers only an
--    exact Player ID ("57" or "#57"): that one registered account, short name, or nothing. Names,
--    initials, partial numbers and email addresses return nothing (012 listed up to 20 names from
--    two letters, and told anyone whether an email had an account).
-- search_my_players (030, the user's own players) is unchanged.
-- Re-runnable. Rollback: supabase/rollback/rollback_053_player_id_search_only.sql.

-- ---------- A. the short name ----------
create or replace function public.short_player_name(p_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when w is null or cardinality(w) = 0 then 'Rummy Player'
    when cardinality(w) = 1 then w[1]
    else w[1] || ' ' || upper(left(w[cardinality(w)], 1)) || '.'
  end
  from (select nullif(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+'), array['']) as w) s;
$$;

-- ---------- B. exact Player ID only ----------
create or replace function public.search_players(p_query text)
returns table (id uuid, display_name text, player_code text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  q text := btrim(coalesce(p_query, ''));
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if q !~ '^#?[0-9]{1,12}$' then return; end if;
  return query
    select p.id, public.short_player_name(p.display_name), public.player_label(p)
    from public.profiles p
    where p.public_player_no = ltrim(q, '#')::bigint
      and p.managed_by is null
      and coalesce(p.player_status, 'registered') = 'registered';
end;
$$;

revoke all on function public.search_players(text) from public, anon;
grant execute on function public.search_players(text) to authenticated;
