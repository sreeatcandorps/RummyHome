-- 039 — Initials: any free 2–3 characters, the first a letter (PR 6, D6 as Sree decided)
--
-- Rule (13 Nov 2026): scorecard initials are 2 or 3 characters; the ONLY forced rule is that
-- the first character is a letter A–Z. The rest may be letters or digits, so SK2 may be typed
-- as well as suggested. The 022 default generator is unchanged (two letters, then letter forms
-- from the name, digits last); nothing stored changes.
--
-- 1. pick_free_initials(typed, taken[]): the typed form when free, else the first free digit
--    form built on it (SK → SK2 … SK9, then S10 … S99). Mirrors utils/initials.ts
--    pickFreeInitials; supabase/tests/fixtures/initials-cases.csv is asserted on both sides.
-- 2. create_player_by_initials(typed): Add new players by initials. A new unregistered player
--    whose name IS the stored initials (D6.2), a My players row carrying them, and the name of
--    whoever already had the typed form (for "Sree Koneru is already SK. This new player is SK2.").
-- 3. set_my_player_initials / set_seat_label accept ^[A-Z][A-Z0-9]{1,2}$ (the 022 check
--    constraints already did). set_my_player_initials also renames the player when their name
--    was the initials (a player made by 2, not yet given a real name), so Results agree.
--
-- Re-runnable. Rollback: supabase/rollback/rollback_039_initials_rules.sql.

-- ---------- 1. the shared picker ----------

create or replace function public.pick_free_initials(p_typed text, p_taken text[])
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := upper(regexp_replace(coalesce(p_typed, ''), '\s+', '', 'g'));
  v_taken text[] := coalesce(p_taken, '{}');
  v_head text;
  v_form text;
  d int;
begin
  if not (v = any (v_taken)) then return v; end if;
  v_head := left(regexp_replace(v, '[0-9]+$', ''), 2);
  if v_head = '' then v_head := left(v, 1); end if;
  for d in 2..9 loop
    v_form := v_head || d::text;
    if v_form <> v and length(v_form) >= length(v) and not (v_form = any (v_taken)) then return v_form; end if;
  end loop;
  for d in 10..99 loop
    v_form := left(v_head, 1) || d::text;
    if v_form <> v and length(v_form) >= length(v) and not (v_form = any (v_taken)) then return v_form; end if;
  end loop;
  return v;
end;
$$;

-- ---------- 2. add a new player by initials ----------

create or replace function public.create_player_by_initials(p_initials text)
returns table (
  id uuid, display_name text, player_code text, first_name text, last_name text,
  player_status text, managed_by uuid, initials text, taken_by text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_typed text := upper(regexp_replace(coalesce(p_initials, ''), '\s+', '', 'g'));
  v_taken text[];
  v_initials text;
  v_holder text;
  new_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if v_typed = '' then raise exception 'Type 2 or 3 characters.'; end if;
  if v_typed !~ '^[A-Z]' then raise exception 'The first character must be a letter, A to Z.'; end if;
  if v_typed !~ '^[A-Z0-9]+$' then raise exception 'Letters and digits only.'; end if;
  if length(v_typed) < 2 then raise exception 'Type at least 2 characters.'; end if;
  if length(v_typed) > 3 then raise exception 'Up to 3 characters.'; end if;

  select coalesce(array_agg(m.initials), '{}') into v_taken
  from public.my_players m where m.owner_id = auth.uid() and m.removed_at is null and m.initials is not null;
  v_initials := public.pick_free_initials(v_typed, v_taken);
  if v_initials <> v_typed then
    select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_holder
    from public.my_players m join public.profiles p on p.id = m.player_id
    where m.owner_id = auth.uid() and m.removed_at is null and m.initials = v_typed
    limit 1;
  end if;

  insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
  values (new_id, v_initials, v_initials, null, 'unregistered', auth.uid(), public.generate_player_code());
  insert into public.my_players (owner_id, player_id, initials) values (auth.uid(), new_id, v_initials)
  on conflict (owner_id, player_id) do update set initials = excluded.initials, removed_at = null;

  return query
    select p.id, p.display_name, public.player_label(p), p.first_name, p.last_name, p.player_status, p.managed_by,
           v_initials, v_holder
    from public.profiles p where p.id = new_id;
end;
$$;

-- ---------- 3. the two editors accept the wider rule ----------

create or replace function public.set_my_player_initials(p_player_id uuid, p_initials text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v text := upper(regexp_replace(coalesce(p_initials, ''), '\s+', '', 'g'));
  v_old text;
  v_taken text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if v !~ '^[A-Z][A-Z0-9]{1,2}$' then raise exception 'Initials are 2 or 3 characters: a letter, then letters or digits.'; end if;
  select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_taken
  from public.my_players m join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid() and m.removed_at is null and m.initials = v and m.player_id <> p_player_id;
  if found then raise exception '% is already used for % in your My players.', v, v_taken; end if;
  select m.initials into v_old from public.my_players m where m.owner_id = auth.uid() and m.player_id = p_player_id and m.removed_at is null;
  if not found then raise exception 'This player is not in your My players.'; end if;
  update public.my_players set initials = v where owner_id = auth.uid() and player_id = p_player_id and removed_at is null;
  -- A player added by initials (D6.2) is named by them; the name follows until a real name is given.
  update public.profiles p set display_name = v, first_name = v
  where p.id = p_player_id and p.managed_by = auth.uid()
    and p.player_status in ('unregistered', 'pending') and v_old is not null and p.display_name = v_old;
  return v;
end;
$$;

create or replace function public.set_seat_label(p_game_id uuid, p_profile_id uuid, p_label text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v text := upper(regexp_replace(coalesce(p_label, ''), '\s+', '', 'g'));
  v_creator uuid;
  v_taken text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select g.created_by into v_creator from public.games g where g.id = p_game_id;
  if v_creator is null then raise exception 'Game not found.'; end if;
  if not (v_creator = auth.uid() or public.is_game_admin(p_game_id) or public.is_app_admin()) then
    raise exception 'Only a game admin can change initials in this game.' using errcode = '42501';
  end if;
  if v !~ '^[A-Z][A-Z0-9]{1,2}$' then raise exception 'Initials are 2 or 3 characters: a letter, then letters or digits.'; end if;
  select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_taken
  from public.game_players gp join public.profiles p on p.id = gp.profile_id
  where gp.game_id = p_game_id and gp.label = v and gp.profile_id <> p_profile_id;
  if found then raise exception '% is already % in this game.', v, v_taken; end if;
  if v_creator = auth.uid() and exists (select 1 from public.my_players m where m.owner_id = auth.uid() and m.player_id = p_profile_id and m.removed_at is null) then
    select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_taken
    from public.my_players m join public.profiles p on p.id = m.player_id
    where m.owner_id = auth.uid() and m.removed_at is null and m.initials = v and m.player_id <> p_profile_id;
    if found then raise exception '% is already used for % in your My players.', v, v_taken; end if;
    update public.my_players set initials = v where owner_id = auth.uid() and player_id = p_profile_id and removed_at is null;
  end if;
  update public.game_players set label = v where game_id = p_game_id and profile_id = p_profile_id;
  if not found then raise exception 'This player is not in this game.'; end if;
  return v;
end;
$$;

-- ---------- grants ----------

revoke all on function public.pick_free_initials(text, text[]) from public, anon;
grant execute on function public.pick_free_initials(text, text[]) to authenticated;
revoke all on function public.create_player_by_initials(text) from public, anon;
grant execute on function public.create_player_by_initials(text) to authenticated;
revoke all on function public.set_my_player_initials(uuid, text) from public, anon;
grant execute on function public.set_my_player_initials(uuid, text) to authenticated;
revoke all on function public.set_seat_label(uuid, uuid, text) from public, anon;
grant execute on function public.set_seat_label(uuid, uuid, text) to authenticated;

comment on function public.create_player_by_initials(text) is
  '039 (PR 6): Add new players by initials. Name = stored initials (D6.2); on a clash the first free digit form (SK2) and taken_by names who holds the typed one.';
comment on function public.pick_free_initials(text, text[]) is
  '039 (PR 6): the typed initials when free, else SK2 … SK9, then S10 … S99. Same as utils/initials.ts pickFreeInitials.';
