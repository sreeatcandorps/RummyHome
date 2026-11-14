-- 040 (PR 10b, APK 9 fixes — Q10.5 and Q10.18 as Sree decided)
--
-- A. Your own initials. My players rows carry initials for OTHER people; the account holder
--    had no stored place for their own, so their column letters were always derived from the
--    name. profiles.initials (nullable, same ^[A-Z][A-Z0-9]{1,2}$ rule) holds them;
--    set_my_initials(text) writes or clears them; seat_default_label prefers them for the
--    creator's own seat when free in that game. my_profile is re-created so the owner reads
--    the column (views freeze their column list) and the column is granted like the others.
--    Fallback stays the derived letters wherever the column is null.
--
-- B. Round-gap repair (one-off, idempotent). Before 035 an Undo marked a round undone but
--    left current_round alone, so the next save became N+1 and every reader shows round N as
--    a hole (dashes in the scorecard, "7 rounds" for six played, a blank row in the PDF and
--    on the web page). Live rounds of every game with a hole are renumbered 1..N in their
--    existing order; current_round follows. Undone rows (1000+N since 035) are untouched.
--    Dealer labels derived from the round number shift accordingly (accepted, Q10.18).
--
-- C. Doubled spaces in names ("Srikanth  Koneru") are collapsed once; the app trims on save
--    from PR 10b on.
--
-- Re-runnable. Rollback: supabase/rollback/rollback_040_own_initials_and_round_gaps.sql.

-- ---------- A. profiles.initials ----------
alter table public.profiles add column if not exists initials text;
alter table public.profiles drop constraint if exists profiles_initials_check;
alter table public.profiles add constraint profiles_initials_check
  check (initials is null or initials ~ '^[A-Z][A-Z0-9]{1,2}$');
comment on column public.profiles.initials is
  'The account holder''s own scorecard initials (040). Null = derive from the name. My players rows hold the initials they use for other people.';

grant select (initials) on public.profiles to authenticated;

-- The owner's own row again (033 shape: security-invoker view over the definer function), so
-- the new column is part of the view. my_profile_rows() returns setof profiles and follows the
-- table on its own; the view's column list is frozen and needs the replace.
create or replace view public.my_profile
with (security_invoker = true, security_barrier = true) as
  select p.* from public.my_profile_rows() p;
revoke all on public.my_profile from public, anon, authenticated;
grant select on public.my_profile to authenticated, service_role;

create or replace function public.set_my_initials(p_initials text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v text := upper(regexp_replace(coalesce(p_initials, ''), '\s+', '', 'g'));
  v_taken text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if v = '' then
    update public.profiles set initials = null where id = auth.uid();
    return null;
  end if;
  if v !~ '^[A-Z][A-Z0-9]{1,2}$' then
    raise exception 'Initials are 2 or 3 characters: a letter, then letters or digits.';
  end if;
  select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_taken
  from public.my_players m join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid() and m.removed_at is null and m.initials = v;
  if found then raise exception '% is already used for % in your My players.', v, v_taken; end if;
  update public.profiles set initials = v where id = auth.uid();
  return v;
end;
$$;
revoke all on function public.set_my_initials(text) from public, anon;
grant execute on function public.set_my_initials(text) to authenticated;
comment on function public.set_my_initials(text) is
  'Your own scorecard initials (040): 2–3 characters, first a letter; empty clears them. Refuses a label one of your My players already has.';

-- 022 body plus one step: the creator's own seat takes their profile initials when free.
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
  if p_profile_id = v_creator then
    select p.initials into v_label from public.profiles p where p.id = p_profile_id;
  else
    select m.initials into v_label from public.my_players m where m.owner_id = v_creator and m.player_id = p_profile_id;
  end if;
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

-- ---------- B. round-gap repair ----------
-- Callable again later (idempotent); the one-off below runs it once for every game.
create or replace function public.repair_round_gaps(p_game_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_games integer := 0;
  v_expected integer;
  v_max integer;
begin
  for r in
    select g.id
    from public.games g
    where (p_game_id is null or g.id = p_game_id)
      and exists (
        select 1 from public.rounds x
        where x.game_id = g.id and x.undone_at is null and x.round_number < 1000
        group by x.game_id
        having max(x.round_number) <> count(*))
  loop
    perform pg_advisory_xact_lock(hashtextextended('game:' || r.id::text, 0));
    v_expected := 0;
    -- Ascending, so every target number is free before the row moves onto it.
    for v_max in
      select x.round_number from public.rounds x
      where x.game_id = r.id and x.undone_at is null and x.round_number < 1000
      order by x.round_number
    loop
      v_expected := v_expected + 1;
      if v_max <> v_expected then
        update public.rounds set round_number = v_expected
        where game_id = r.id and round_number = v_max and undone_at is null;
      end if;
    end loop;
    update public.games set current_round = v_expected + 1
    where id = r.id and current_round > v_expected + 1;
    v_games := v_games + 1;
  end loop;
  return v_games;
end;
$$;
revoke all on function public.repair_round_gaps(uuid) from public, anon, authenticated;
comment on function public.repair_round_gaps(uuid) is
  'One-off for the pre-035 undo gap (040): renumbers live rounds 1..N for games with a hole and moves current_round back. Service role only; a second run finds nothing.';

select public.repair_round_gaps(null);

-- ---------- C. doubled spaces in names ----------
update public.profiles
   set display_name = btrim(regexp_replace(display_name, '\s+', ' ', 'g')),
       first_name = nullif(btrim(regexp_replace(coalesce(first_name, ''), '\s+', ' ', 'g')), ''),
       last_name = nullif(btrim(regexp_replace(coalesce(last_name, ''), '\s+', ' ', 'g')), '')
 where display_name ~ '\s\s' or first_name ~ '\s\s' or last_name ~ '\s\s'
    or display_name <> btrim(display_name);

notify pgrst, 'reload schema';
