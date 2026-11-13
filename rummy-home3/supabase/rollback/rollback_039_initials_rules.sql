-- Rollback for 039_initials_rules.sql: the 022 editors again (letters only, 2–3) and no
-- create_player_by_initials / pick_free_initials. Players already made by initials keep
-- their rows and labels (the 022 check constraints accept a trailing digit); only the
-- editors stop accepting a digit when typed.
drop function if exists public.create_player_by_initials(text);
drop function if exists public.pick_free_initials(text, text[]);

create or replace function public.set_my_player_initials(p_player_id uuid, p_initials text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := upper(btrim(coalesce(p_initials, '')));
  v_taken text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if v !~ '^[A-Z]{2,3}$' then raise exception 'Initials are 2 or 3 letters, A to Z.'; end if;
  select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_taken
  from public.my_players m join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid() and m.initials = v and m.player_id <> p_player_id;
  if found then raise exception '% is already used for % in your My players.', v, v_taken; end if;
  update public.my_players set initials = v where owner_id = auth.uid() and player_id = p_player_id;
  if not found then raise exception 'This player is not in your My players.'; end if;
  return v;
end;
$$;

create or replace function public.set_seat_label(p_game_id uuid, p_profile_id uuid, p_label text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := upper(btrim(coalesce(p_label, '')));
  v_creator uuid;
  v_taken text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select g.created_by into v_creator from public.games g where g.id = p_game_id;
  if v_creator is null then raise exception 'Game not found.'; end if;
  if not (v_creator = auth.uid() or public.is_game_admin(p_game_id) or public.is_app_admin()) then
    raise exception 'Only a game admin can change initials in this game.' using errcode = '42501';
  end if;
  if v !~ '^[A-Z]{2,3}$' then raise exception 'Initials are 2 or 3 letters, A to Z.'; end if;
  select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_taken
  from public.game_players gp join public.profiles p on p.id = gp.profile_id
  where gp.game_id = p_game_id and gp.label = v and gp.profile_id <> p_profile_id;
  if found then raise exception '% is already % in this game.', v, v_taken; end if;
  if v_creator = auth.uid() and exists (select 1 from public.my_players m where m.owner_id = auth.uid() and m.player_id = p_profile_id) then
    select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_taken
    from public.my_players m join public.profiles p on p.id = m.player_id
    where m.owner_id = auth.uid() and m.initials = v and m.player_id <> p_profile_id;
    if found then raise exception '% is already used for % in your My players.', v, v_taken; end if;
    update public.my_players set initials = v where owner_id = auth.uid() and player_id = p_profile_id;
  end if;
  update public.game_players set label = v where game_id = p_game_id and profile_id = p_profile_id;
  if not found then raise exception 'This player is not in this game.'; end if;
  return v;
end;
$$;
