-- Demo data for an allowlisted admin.
--
-- Run this entire file in the Supabase SQL editor (or `supabase db push`).
-- The app uses the signed-in user's session only. No service-role key is involved.
--
-- Who is an admin: public.demo_admin_emails, compared to the JWT email.
-- The default row is koneru2k@gmail.com, the same default as EXPO_PUBLIC_ADMIN_EMAILS.
-- To add another admin later:
--   insert into public.demo_admin_emails (email) values ('other@example.com');
--
-- Demo opponents are profiles with is_demo = true and are not auth users.
-- Clear deletes only is_demo games created by the caller and is_demo profiles
-- owned by the caller. Real accounts and real games are left in place.

create table if not exists public.demo_admin_emails (
  email text primary key
);

insert into public.demo_admin_emails (email)
values ('koneru2k@gmail.com')
on conflict (email) do nothing;

alter table public.demo_admin_emails enable row level security;
revoke all on public.demo_admin_emails from anon, authenticated;

alter table public.profiles
  add column if not exists is_demo boolean not null default false;

alter table public.profiles
  add column if not exists demo_owner_id uuid;

alter table public.profiles
  drop constraint if exists profiles_demo_owner_id_fkey;

alter table public.profiles
  add constraint profiles_demo_owner_id_fkey
  foreign key (demo_owner_id) references public.profiles(id) on delete cascade;

-- Real profiles stay tied to auth.users. Demo profiles are not accounts, so
-- the foreign key cannot apply to every row. A trigger keeps that rule.
alter table public.profiles drop constraint if exists profiles_id_fkey;

create or replace function public.enforce_profile_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_demo then
    if new.demo_owner_id is null or new.demo_owner_id = new.id then
      raise exception 'Demo profiles require an owner';
    end if;
    if new.role is distinct from 'player' then
      raise exception 'Demo profiles cannot be admins';
    end if;
    return new;
  end if;

  if new.demo_owner_id is not null then
    raise exception 'Only demo profiles can have an owner';
  end if;

  if not exists (select 1 from auth.users where id = new.id) then
    raise exception 'Profile must belong to a signed-in account';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_require_auth_user on public.profiles;
create trigger profiles_require_auth_user
before insert or update on public.profiles
for each row execute function public.enforce_profile_auth_user();

-- Replacing the auth.users cascade that the foreign key used to provide.
create or replace function public.delete_profile_with_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = old.id and is_demo = false;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
before delete on auth.users
for each row execute function public.delete_profile_with_auth_user();

alter table public.games
  add column if not exists is_demo boolean not null default false;

create index if not exists profiles_demo_owner_idx
  on public.profiles (demo_owner_id)
  where is_demo;

create index if not exists games_demo_creator_idx
  on public.games (created_by)
  where is_demo;

create or replace function public.is_demo_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.demo_admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and is_demo = false);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid() and is_demo = false)
with check (id = auth.uid() and is_demo = false and demo_owner_id is null);

drop policy if exists "authenticated users create games" on public.games;
create policy "authenticated users create games"
on public.games for insert
to authenticated
with check (created_by = auth.uid() and is_demo = false);

drop policy if exists "game admins update games" on public.games;
create policy "game admins update games"
on public.games for update
to authenticated
using (public.is_app_admin() or public.is_game_admin(id) or created_by = auth.uid())
with check (
  (public.is_app_admin() or public.is_game_admin(id) or created_by = auth.uid())
  and (is_demo = false or public.is_demo_admin())
);

create or replace function public.clear_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_demo_admin() then
    raise exception 'Only an allowlisted admin can clear demo data';
  end if;

  delete from public.games
  where is_demo = true
    and created_by = auth.uid();

  -- Leave a demo profile that was later added to a real game so that game is kept.
  delete from public.profiles p
  where p.is_demo = true
    and p.demo_owner_id = auth.uid()
    and not exists (
      select 1 from public.game_players gp
      where gp.profile_id = p.id
    )
    and not exists (
      select 1 from public.scores s
      where s.profile_id = p.id
    );
end;
$$;

create or replace function public.apply_demo_seed(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  key_map jsonb := '{}'::jsonb;
  profile_row record;
  game_row record;
  round_row record;
  score_row record;
  player_row record;
  new_profile_id uuid;
  new_game_id uuid;
  new_round_id uuid;
  resolved uuid;
  player_key text;
  player_index integer;
  score_value integer;
begin
  if auth.uid() is null or not public.is_demo_admin() then
    raise exception 'Only an allowlisted admin can load demo data';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Demo payload must be an object';
  end if;

  if jsonb_array_length(coalesce(payload->'profiles', '[]'::jsonb)) > 30 then
    raise exception 'Too many demo players';
  end if;

  if jsonb_array_length(coalesce(payload->'games', '[]'::jsonb)) > 8 then
    raise exception 'Too many demo games';
  end if;

  perform public.clear_demo_data();

  for profile_row in
    select value as item
    from jsonb_array_elements(coalesce(payload->'profiles', '[]'::jsonb))
  loop
    if coalesce(profile_row.item->>'clientKey', '') !~ '^demo-[a-z0-9-]{1,40}$' then
      raise exception 'Demo profile key must be tagged';
    end if;

    if char_length(btrim(coalesce(profile_row.item->>'displayName', ''))) not between 1 and 80 then
      raise exception 'Demo profile name is missing';
    end if;

    if key_map ? (profile_row.item->>'clientKey') then
      raise exception 'Duplicate demo profile';
    end if;

    new_profile_id := gen_random_uuid();
    insert into public.profiles (id, display_name, is_demo, demo_owner_id, role)
    values (
      new_profile_id,
      btrim(profile_row.item->>'displayName'),
      true,
      auth.uid(),
      'player'
    );

    key_map := key_map || jsonb_build_object(profile_row.item->>'clientKey', new_profile_id);
  end loop;

  for game_row in
    select value as item
    from jsonb_array_elements(coalesce(payload->'games', '[]'::jsonb))
  loop
    if coalesce(game_row.item->>'gameType', '') not in ('stake', 'pool') then
      raise exception 'Invalid demo game type';
    end if;

    if coalesce(game_row.item->>'status', '') not in ('active', 'completed') then
      raise exception 'Invalid demo game status';
    end if;

    if coalesce(game_row.item->>'shareCode', '') !~ '^[A-Z0-9-]{4,16}$' then
      raise exception 'Invalid demo share code';
    end if;

    if jsonb_array_length(coalesce(game_row.item->'playerKeys', '[]'::jsonb)) not between 2 and 20 then
      raise exception 'A demo game must have between 2 and 20 players';
    end if;

    if jsonb_array_length(coalesce(game_row.item->'rounds', '[]'::jsonb)) > 40 then
      raise exception 'Too many demo rounds';
    end if;

    insert into public.games (
      created_by,
      status,
      game_type,
      settings,
      current_round,
      share_code,
      is_demo,
      created_at,
      completed_at
    )
    values (
      auth.uid(),
      (game_row.item->>'status')::public.game_status,
      (game_row.item->>'gameType')::public.game_type,
      coalesce(game_row.item->'settings', '{}'::jsonb),
      greatest(coalesce((game_row.item->>'currentRound')::integer, 1), 1),
      game_row.item->>'shareCode',
      true,
      coalesce((game_row.item->>'createdAt')::timestamptz, now()),
      case
        when game_row.item->>'status' = 'completed'
          then coalesce((game_row.item->>'createdAt')::timestamptz, now())
        else null
      end
    )
    returning id into new_game_id;

    player_index := 0;
    for player_row in
      select value as item
      from jsonb_array_elements(game_row.item->'playerKeys')
    loop
      player_key := player_row.item #>> '{}';
      resolved := null;

      if player_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        select id into resolved
        from public.profiles
        where id = player_key::uuid
          and is_demo = false;
        if resolved is null then
          raise exception 'Demo games can only reuse real accounts that already exist';
        end if;
      else
        resolved := nullif(key_map ->> player_key, '')::uuid;
        if resolved is null then
          raise exception 'Unknown demo player';
        end if;
      end if;

      insert into public.game_players (game_id, profile_id, player_order, display_number, role)
      values (
        new_game_id,
        resolved,
        player_index,
        player_index + 1,
        case when resolved = auth.uid() then 'game_admin'::public.game_member_role else 'player'::public.game_member_role end
      );

      player_index := player_index + 1;
    end loop;

    for round_row in
      select value as item
      from jsonb_array_elements(coalesce(game_row.item->'rounds', '[]'::jsonb))
    loop
      player_key := round_row.item->>'dealerKey';
      resolved := null;
      if player_key is not null and player_key <> '' then
        if player_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          select id into resolved
          from public.profiles
          where id = player_key::uuid
            and is_demo = false;
        else
          resolved := nullif(key_map ->> player_key, '')::uuid;
        end if;
      end if;

      insert into public.rounds (game_id, round_number, dealer_profile_id, created_by)
      values (
        new_game_id,
        (round_row.item->>'roundNumber')::integer,
        resolved,
        auth.uid()
      )
      returning id into new_round_id;

      for score_row in
        select value as item
        from jsonb_array_elements(coalesce(round_row.item->'scores', '[]'::jsonb))
      loop
        if coalesce(score_row.item->>'scoreType', '') not in ('drop', 'middle_drop', 'rummy', 'count', 'expense') then
          raise exception 'Invalid demo score type';
        end if;

        score_value := (score_row.item->>'value')::integer;
        player_key := score_row.item->>'playerKey';
        resolved := null;

        if score_row.item->>'scoreType' = 'expense' or player_key is null or player_key = '' or player_key = 'EX' then
          resolved := null;
        elsif player_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          select id into resolved
          from public.profiles
          where id = player_key::uuid
            and is_demo = false;
          if resolved is null then
            raise exception 'Demo score refers to an unknown account';
          end if;
        else
          resolved := nullif(key_map ->> player_key, '')::uuid;
          if resolved is null then
            raise exception 'Demo score refers to an unknown player';
          end if;
        end if;

        insert into public.scores (round_id, game_id, profile_id, score_type, value)
        values (
          new_round_id,
          new_game_id,
          resolved,
          (score_row.item->>'scoreType')::public.score_type,
          score_value
        );
      end loop;
    end loop;
  end loop;
end;
$$;

revoke all on function public.is_demo_admin() from public, anon;
grant execute on function public.is_demo_admin() to authenticated;

revoke all on function public.clear_demo_data() from public, anon;
grant execute on function public.clear_demo_data() to authenticated;

revoke all on function public.apply_demo_seed(jsonb) from public, anon;
grant execute on function public.apply_demo_seed(jsonb) to authenticated;

revoke all on function public.enforce_profile_auth_user() from public, anon, authenticated;
revoke all on function public.delete_profile_with_auth_user() from public, anon, authenticated;
