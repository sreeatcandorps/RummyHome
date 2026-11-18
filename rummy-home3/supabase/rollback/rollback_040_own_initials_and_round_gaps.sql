-- Rollback for 040_own_initials_and_round_gaps.sql: no set_my_initials / repair_round_gaps,
-- and seat_default_label back to its 022 body (the creator's own seat derives from the name
-- again). The profiles.initials column and its check stay so nothing typed is lost (the view
-- keeps reading it; the shipped app ignores a column it does not know). The round
-- renumbering and the name whitespace clean-up are data repairs and are not undone.
drop function if exists public.set_my_initials(text);
drop function if exists public.repair_round_gaps(uuid);

create or replace function public.seat_default_label(p_game_id uuid, p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_creator uuid;
  v_name text;
  v_label text;
begin
  select g.created_by into v_creator from public.games g where g.id = p_game_id;
  select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_name from public.profiles p where p.id = p_profile_id;
  v_name := coalesce(v_name, 'Rummy Player');
  select m.initials into v_label from public.my_players m where m.owner_id = v_creator and m.player_id = p_profile_id;
  if v_label is null or exists (
    select 1 from public.game_players gp
    where gp.game_id = p_game_id and gp.label = v_label and gp.profile_id <> p_profile_id
  ) then
    select t.c into v_label
    from unnest(public.initials_candidates(v_name)) with ordinality as t(c, ord)
    where not exists (
      select 1 from public.game_players gp
      where gp.game_id = p_game_id and gp.label = t.c and gp.profile_id <> p_profile_id)
    order by t.ord
    limit 1;
  end if;
  return coalesce(v_label, (public.initials_candidates(v_name))[1]);
end;
$$;
