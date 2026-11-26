-- Rollback for 053 (D113): search_players goes back to the 012 body (name, initials, #ID or a full
-- email; up to 20 rows) and short_player_name is dropped. Re-apply 053 to undo this.

-- Find player in database: registered only; a player ID is searched as #42 or 42.
create or replace function public.search_players(p_query text)
returns table (id uuid, display_name text, player_code text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  pattern text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if q ~ '^#?[0-9]{1,12}$' then
    return query
      select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p)
      from public.profiles p
      where p.public_player_no = ltrim(q, '#')::bigint
        and p.managed_by is null
        and coalesce(p.player_status, 'registered') = 'registered';
    return;
  end if;
  if length(q) < 2 then return; end if;
  if q !~ '[A-Za-z@]' and length(regexp_replace(q, '\D', '', 'g')) >= 6 then return; end if;

  if q ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return query
      select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p)
      from public.profiles p
      where lower(btrim(p.email)) = lower(q)
        and p.managed_by is null
        and coalesce(p.player_status, 'registered') = 'registered'
      limit 5;
    return;
  end if;
  if position('@' in q) > 0 then return; end if;

  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p)
    from public.profiles p
    where p.managed_by is null
      and coalesce(p.player_status, 'registered') = 'registered'
      and (
        p.display_name ilike pattern escape '\'
        or p.first_name ilike pattern escape '\'
        or p.last_name ilike pattern escape '\'
        or p.player_code ilike pattern escape '\'
        or public.player_label(p) ilike pattern escape '\'
      )
    order by p.display_name
    limit 20;
end;
$$;

drop function if exists public.short_player_name(text);
