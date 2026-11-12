-- 022: initials per owner. Apply after 021. Safe to re-run.
-- Rollback: rollback_022_player_initials.sql (drops the columns, so stored labels are lost;
-- the app then recomputes them from names as it did before).
--
-- Decision (Sree, 11 Nov 2026): the label a player gets in scorecard columns belongs to the
-- owner of the My players list the game was built from, not to the player and not to one
-- game. It is unique within that owner's list only; two owners may label one person
-- differently. Two letters by default (first + last initial); on a clash within the list the
-- later player gets three letters from their own name (Suresh Kumar → SUK), never a digit
-- unless the letter forms run out. The owner may type any 2–3 letters instead.
--
-- A. my_players.initials (stored label) and my_players.name_snapshot (the owner's copy of the
--    name; a player renaming their profile changes nobody's list until the owner taps
--    "Refresh from database"). A before-insert trigger fills both, so every insert path
--    (add_my_player, touch_my_players, create_unregistered_player, the link/claim merges)
--    gets a unique default without changing those functions.
-- B. Unique index (owner_id, initials). Existing rows are backfilled deterministically,
--    oldest row first (created_at, owner_id, player_id), so the person who joined a list
--    first keeps the short form.
-- C. game_players.label: the label a seat carries in one game, set when the seat is created
--    (the creator's initials for that player; a free default otherwise) so the column stays
--    the same on every phone and after any later My players edit. Existing seats are
--    backfilled in seat order. seat_rows_json (020) returns it.
-- D. RPCs: set_my_player_initials, refresh_my_player_name, set_seat_label (a game admin
--    renames a column; when the caller is the game creator their My players row follows).
--    list_my_players returns initials, name_snapshot and added_at. update_unregistered_player
--    (012) also refreshes the owner's name_snapshot, since the owner typed the new name.
--
-- public.initials_candidates(text) is mirrored by utils/initials.ts in the app; the two must
-- produce the same list (tests/initials-022.test.ts and tests/12_player_initials_022.sql both
-- check the same table of names).

-- ---------- generator ----------

-- Upper-case A–Z words of a name. Accents are folded (both cases, so this works under any
-- server locale), digits and symbols split words. Mirrors nameWords() in utils/initials.ts.
create or replace function public.initials_words(p_name text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    nullif(
      array_remove(
        string_to_array(
          regexp_replace(
            upper(translate(replace(replace(replace(replace(replace(replace(replace(upper(coalesce(p_name, '')), 'æ', 'AE'), 'Æ', 'AE'), 'œ', 'OE'), 'Œ', 'OE'), 'ß', 'SS'), 'þ', 'TH'), 'Þ', 'TH'),
              'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿĀāĂăĄąĆćĈĉĊċČčĎďĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĨĩĪīĬĭĮįİĴĵĶķĹĺĻļĽľŃńŅņŇňŌōŎŏŐőŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžøØðÐłŁđĐ',
              'AAAAAACEEEEIIIINOOOOOUUUUYAAAAAACEEEEIIIINOOOOOUUUUYYAAAAAACCCCCCCCDDEEEEEEEEEEGGGGGGGGHHIIIIIIIIIJJKKLLLLLLNNNNNNOOOOOORRRRRRSSSSSSSSTTTTUUUUUUUUUUUUWWYYYZZZZZZOODDLLDD')),
            '[^A-Z]+', ' ', 'g'),
          ' '),
        ''),
      '{}'::text[]),
    array['PLAYER']);
$$;

create or replace function public.initials_push(p_list text[], p_label text)
returns text[]
language sql
immutable
as $$
  select case
    when length(p_label) between 2 and 3 and not (p_label = any(p_list)) then p_list || p_label
    else p_list
  end;
$$;

-- The ordered default forms for a name: two letters, the three-letter forms, then digit forms.
create or replace function public.initials_candidates(p_name text)
returns text[]
language plpgsql
immutable
as $$
declare
  w text[] := public.initials_words(p_name);
  n integer := coalesce(array_length(w, 1), 0);
  f text := w[1];
  l text := w[coalesce(array_length(w, 1), 1)];
  res text[] := '{}';
  base text;
  i integer;
begin
  if n >= 2 then
    res := public.initials_push(res, substr(f, 1, 1) || substr(l, 1, 1));
    res := public.initials_push(res, substr(f, 1, 2) || substr(l, 1, 1));
    res := public.initials_push(res, substr(f, 1, 1) || substr(l, 1, 2));
    if n >= 3 then res := public.initials_push(res, substr(f, 1, 1) || substr(w[2], 1, 1) || substr(l, 1, 1)); end if;
    for i in 3..length(f) loop res := public.initials_push(res, substr(f, 1, 1) || substr(f, i, 1) || substr(l, 1, 1)); end loop;
    for i in 3..length(l) loop res := public.initials_push(res, substr(f, 1, 1) || substr(l, 1, 1) || substr(l, i, 1)); end loop;
  else
    res := public.initials_push(res, case when length(f) >= 2 then substr(f, 1, 2) else substr(f, 1, 1) || 'X' end);
    res := public.initials_push(res, substr(f, 1, 3));
    for i in 4..length(f) loop res := public.initials_push(res, substr(f, 1, 2) || substr(f, i, 1)); end loop;
  end if;
  base := res[1];
  for i in 2..9 loop res := public.initials_push(res, base || i); end loop;
  for i in 10..99 loop res := public.initials_push(res, substr(f, 1, 1) || i); end loop;
  return res;
end;
$$;

-- ---------- A. columns ----------

alter table public.my_players
  add column if not exists initials text,
  add column if not exists name_snapshot text;

alter table public.my_players drop constraint if exists my_players_initials_check;
alter table public.my_players
  add constraint my_players_initials_check check (initials is null or initials ~ '^[A-Z][A-Z0-9]{1,2}$');

alter table public.game_players add column if not exists label text;
alter table public.game_players drop constraint if exists game_players_label_check;
alter table public.game_players
  add constraint game_players_label_check check (label is null or label ~ '^[A-Z][A-Z0-9]{1,2}$');

-- The first default form of p_name not used by another player in p_owner's My players.
create or replace function public.default_initials(p_owner uuid, p_name text, p_exclude_player uuid default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select t.c
     from unnest(public.initials_candidates(p_name)) with ordinality as t(c, ord)
     where not exists (
       select 1 from public.my_players m
       where m.owner_id = p_owner and m.initials = t.c
         and (p_exclude_player is null or m.player_id <> p_exclude_player))
     order by t.ord
     limit 1),
    (public.initials_candidates(p_name))[1]);
$$;

create or replace function public.my_players_fill_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name_snapshot is null or btrim(new.name_snapshot) = '' then
    select coalesce(nullif(p.display_name, ''), 'Rummy Player') into new.name_snapshot
    from public.profiles p where p.id = new.player_id;
    new.name_snapshot := coalesce(new.name_snapshot, 'Rummy Player');
  end if;
  if new.initials is null or btrim(new.initials) = '' then
    new.initials := public.default_initials(new.owner_id, new.name_snapshot, new.player_id);
  else
    new.initials := upper(btrim(new.initials));
  end if;
  return new;
end;
$$;

drop trigger if exists my_players_fill_defaults on public.my_players;
create trigger my_players_fill_defaults
before insert or update of initials on public.my_players
for each row execute function public.my_players_fill_defaults();

-- ---------- B. backfill, oldest first, then the unique index ----------

do $$
declare r record;
begin
  for r in
    select m.owner_id, m.player_id, coalesce(nullif(m.name_snapshot, ''), nullif(p.display_name, ''), 'Rummy Player') as name
    from public.my_players m
    join public.profiles p on p.id = m.player_id
    where m.initials is null or m.name_snapshot is null
    order by m.created_at, m.owner_id, m.player_id
  loop
    update public.my_players
    set name_snapshot = coalesce(name_snapshot, r.name),
        initials = coalesce(initials, public.default_initials(r.owner_id, r.name, r.player_id))
    where owner_id = r.owner_id and player_id = r.player_id;
  end loop;
end $$;

create unique index if not exists my_players_owner_initials_key
  on public.my_players (owner_id, initials);

-- ---------- C. seat labels ----------

-- The label a seat gets when it has none: the creator's initials for that player if they
-- are not already a column in this game, else the first default form of the name that is free.
create or replace function public.seat_default_label(p_game_id uuid, p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
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

create or replace function public.game_players_fill_label()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.label is null or btrim(new.label) = '' then
    new.label := public.seat_default_label(new.game_id, new.profile_id);
  else
    new.label := upper(btrim(new.label));
  end if;
  return new;
end;
$$;

drop trigger if exists game_players_fill_label on public.game_players;
create trigger game_players_fill_label
before insert or update of label on public.game_players
for each row execute function public.game_players_fill_label();

do $$
declare r record;
begin
  for r in
    select gp.id, gp.game_id, gp.profile_id
    from public.game_players gp
    where gp.label is null
    order by gp.game_id, gp.player_order
  loop
    update public.game_players set label = public.seat_default_label(r.game_id, r.profile_id) where id = r.id;
  end loop;
end $$;

-- seat_rows_json (020) carries the label.
create or replace function public.seat_rows_json(p_games uuid[], p_member uuid[], p_profiles boolean)
returns table (game_id uuid, seats jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select gp.game_id,
         jsonb_agg(
           jsonb_build_object(
             'profile_id', gp.profile_id,
             'player_order', gp.player_order,
             'role', gp.role,
             'seated', gp.seated,
             'is_active', gp.is_active,
             'label', gp.label
           )
           || case
                when not p_profiles then '{}'::jsonb
                when gp.game_id = any(p_member) then jsonb_build_object('profiles', public.profile_fields_json(p))
                else jsonb_build_object('profiles', public.public_profile_json(p))
              end
           order by gp.player_order)
  from public.game_players gp
  left join public.profiles p on p.id = gp.profile_id
  where gp.game_id = any(p_games)
  group by gp.game_id;
$$;

-- ---------- D. RPCs ----------

drop function if exists public.list_my_players();
create function public.list_my_players()
returns table (id uuid, display_name text, player_code text, games_together integer, initials text, name_snapshot text, added_at timestamptz, player_status text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p), m.games_together,
         m.initials, coalesce(m.name_snapshot, nullif(p.display_name, ''), 'Rummy Player'), m.created_at, p.player_status
  from public.my_players m
  join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid()
    and coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
  order by m.games_together desc, p.display_name;
$$;

-- The owner types the initials for one of their players. Letters only, 2–3, unique in the list.
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
  select coalesce(nullif(m.name_snapshot, ''), p.display_name) into v_taken
  from public.my_players m join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid() and m.initials = v and m.player_id <> p_player_id;
  if found then raise exception '% is already used for % in your My players.', v, v_taken; end if;
  update public.my_players set initials = v where owner_id = auth.uid() and player_id = p_player_id;
  if not found then raise exception 'This player is not in your My players.'; end if;
  return v;
end;
$$;

-- The owner pulls the player's current profile name into their list. Initials stay unless asked.
create or replace function public.refresh_my_player_name(p_player_id uuid, p_recompute_initials boolean default false)
returns table (name_snapshot text, initials text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_name from public.profiles p where p.id = p_player_id;
  if v_name is null then raise exception 'This player is not in the database.'; end if;
  update public.my_players m
  set name_snapshot = v_name,
      initials = case when p_recompute_initials then public.default_initials(auth.uid(), v_name, p_player_id) else m.initials end
  where m.owner_id = auth.uid() and m.player_id = p_player_id;
  if not found then raise exception 'This player is not in your My players.'; end if;
  return query select m.name_snapshot, m.initials from public.my_players m where m.owner_id = auth.uid() and m.player_id = p_player_id;
end;
$$;

-- A game admin changes the column label of one seat. Unique in the game. When the caller
-- created the game, their My players entry for that player follows (so the next game agrees).
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
    select coalesce(nullif(m.name_snapshot, ''), p.display_name) into v_taken
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

-- 012's update_unregistered_player, plus: the owner typed the new name, so their snapshot follows.
create or replace function public.update_unregistered_player(p_player_id uuid, p_first text, p_last text)
returns table (id uuid, display_name text, player_code text, first_name text, last_name text, player_status text, managed_by uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.profiles := public.require_my_unregistered(p_player_id);
  name text := btrim(concat_ws(' ', nullif(btrim(p_first), ''), nullif(btrim(p_last), '')));
begin
  if r.player_status not in ('unregistered','pending') then raise exception 'Only unregistered players can be edited.'; end if;
  if btrim(coalesce(p_first, '')) = '' or btrim(coalesce(p_last, '')) = '' then raise exception 'Type a first and last name.'; end if;
  update public.profiles set display_name = left(name, 60), first_name = nullif(btrim(p_first), ''), last_name = nullif(btrim(p_last), '')
  where profiles.id = p_player_id;
  update public.my_players set name_snapshot = left(name, 60) where owner_id = auth.uid() and player_id = p_player_id;
  return query select p.id, p.display_name, public.player_label(p), p.first_name, p.last_name, p.player_status, p.managed_by
    from public.profiles p where p.id = p_player_id;
end;
$$;

-- ---------- grants ----------

do $$
declare f text;
begin
  foreach f in array array[
    'list_my_players()', 'set_my_player_initials(uuid,text)', 'refresh_my_player_name(uuid,boolean)',
    'set_seat_label(uuid,uuid,text)', 'update_unregistered_player(uuid,text,text)',
    'initials_words(text)', 'initials_push(text[],text)', 'initials_candidates(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['default_initials(uuid,text,uuid)', 'seat_default_label(uuid,uuid)', 'my_players_fill_defaults()', 'game_players_fill_label()', 'seat_rows_json(uuid[],uuid[],boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

comment on column public.my_players.initials is
  '022: the label this player gets in scorecard columns of games this owner creates. Unique per owner. Default from the name; the owner may type 2–3 letters.';
comment on column public.my_players.name_snapshot is
  '022: the owner''s copy of the player''s name. A profile rename changes it only when the owner taps Refresh from database.';
comment on column public.game_players.label is
  '022: the column label of this seat in this game, fixed when the seat was created (creator''s initials for the player). set_seat_label changes it.';
