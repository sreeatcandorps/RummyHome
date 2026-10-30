-- Round 3: My players, unregistered players, Register players, email linking.
--
-- Additive and safe to re-run. Not applied automatically: run this whole file in
-- the Supabase SQL editor after 010.
--
-- Model
--   profiles.player_status: registered | unregistered | pending |
--     deleted_before_registering | deleted_after_registering | merged
--   An unregistered player is a profile with no auth user, managed_by = its creator.
--   player_links: one row per creator + unregistered player + email (the "pending record").
--     kind 'signup'   = the email had no account; claimed after sign-up + "Is this you?".
--     kind 'existing' = the email already belongs to a registered player; the player is
--                       'pending' until that person answers Yes (never linked instantly).
--   Email is the identity key: always lower(btrim()), unique across accounts.
--   Yes moves seats and scores to the account and remembers moved_game_ids so
--   unlink_player can move exactly those back. Scores are never deleted.

-- ---------- profiles ----------
alter table public.profiles add column if not exists player_status text not null default 'registered';
alter table public.profiles add column if not exists managed_by uuid;
alter table public.profiles add column if not exists zip_code text;
alter table public.profiles add column if not exists deleted_at timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_player_status_check
    check (player_status in ('registered','unregistered','pending','deleted_before_registering','deleted_after_registering','merged'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_managed_by_fkey
    foreign key (managed_by) references public.profiles(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists profiles_managed_by_idx on public.profiles (managed_by) where managed_by is not null;

-- One account per email, compared lowercased and trimmed. Skipped (with a notice)
-- if existing rows already collide, so the migration never fails on old data.
do $$ begin
  if exists (
    select lower(btrim(email)) from public.profiles
    where email is not null and managed_by is null
    group by lower(btrim(email)) having count(*) > 1
  ) then
    raise notice 'profiles has duplicate emails by case; unique email index not created. Fix the duplicates and re-run.';
  else
    create unique index if not exists profiles_email_normalized_key
      on public.profiles (lower(btrim(email))) where email is not null and managed_by is null;
  end if;
end $$;

-- Unregistered profiles have no auth user, like demo profiles.
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

  if new.managed_by is not null then
    if new.player_status not in ('unregistered','pending','deleted_before_registering','merged') then
      raise exception 'A managed player must be unregistered';
    end if;
    if new.role is distinct from 'player' then
      raise exception 'Unregistered players cannot be admins';
    end if;
    return new;
  end if;

  if not exists (select 1 from auth.users where id = new.id) then
    raise exception 'Profile must belong to a signed-in account';
  end if;

  return new;
end;
$$;

-- New accounts: lowercase email, optional phone and zip from sign-up metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, phone, zip_code)
  values (
    new.id,
    lower(btrim(new.email)),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1), 'Rummy Player'),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'zip_code', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Unregistered players are visible only to their creator and to people in the same games.
create or replace function public.can_see_profile(target public.profiles)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target.managed_by is null
      or target.managed_by = auth.uid()
      or exists (
        select 1 from public.game_players gp
        where gp.profile_id = target.id and public.is_game_member(gp.game_id)
      );
$$;

drop policy if exists "profiles are readable by signed in users" on public.profiles;
create policy "profiles are readable by signed in users"
on public.profiles for select
to authenticated
using (public.can_see_profile(profiles));

-- ---------- pending records ----------
create table if not exists public.player_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  kind text not null default 'signup' check (kind in ('signup','existing')),
  status text not null default 'pending' check (status in ('pending','claimed','declined','expired','cancelled','unlinked')),
  invited_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  game_numbers integer[] not null default '{}',
  moved_game_ids uuid[] not null default '{}'
);

create unique index if not exists player_links_one_pending
  on public.player_links (owner_id, player_id) where status = 'pending';
create index if not exists player_links_email_pending
  on public.player_links (email) where status = 'pending';

alter table public.player_links enable row level security;
revoke insert, update, delete on public.player_links from anon, authenticated;

drop policy if exists player_links_read on public.player_links;
create policy player_links_read on public.player_links
for select to authenticated
using (
  owner_id = auth.uid()
  or (status = 'pending' and email = lower(btrim(coalesce(auth.jwt() ->> 'email', ''))))
);

create table if not exists public.creator_notices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid references public.profiles(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.creator_notices enable row level security;
revoke insert, update, delete on public.creator_notices from anon, authenticated;
drop policy if exists creator_notices_read on public.creator_notices;
create policy creator_notices_read on public.creator_notices
for select to authenticated using (owner_id = auth.uid());

-- ---------- helpers ----------
create or replace function public.my_verified_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(btrim(u.email)) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

create or replace function public.require_my_unregistered(p_player_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare r public.profiles;
begin
  select * into r from public.profiles where id = p_player_id and managed_by = auth.uid();
  if r.id is null then raise exception 'Only your own unregistered players can be changed.'; end if;
  return r;
end;
$$;

-- ---------- Add new players ----------
create or replace function public.create_unregistered_player(p_first text, p_last text)
returns table (id uuid, display_name text, player_code text, first_name text, last_name text, player_status text, managed_by uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  name text := btrim(concat_ws(' ', nullif(btrim(p_first), ''), nullif(btrim(p_last), '')));
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if name = '' then raise exception 'Type a name or initials.'; end if;
  insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
  values (new_id, left(name, 60), nullif(btrim(p_first), ''), nullif(btrim(p_last), ''), 'unregistered', auth.uid(), public.generate_player_code());
  insert into public.my_players (owner_id, player_id) values (auth.uid(), new_id) on conflict do nothing;
  return query select p.id, p.display_name, p.player_code, p.first_name, p.last_name, p.player_status, p.managed_by
    from public.profiles p where p.id = new_id;
end;
$$;

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
  if name = '' then raise exception 'Type a name or initials.'; end if;
  update public.profiles set display_name = left(name, 60), first_name = nullif(btrim(p_first), ''), last_name = nullif(btrim(p_last), '')
  where profiles.id = p_player_id;
  return query select p.id, p.display_name, p.player_code, p.first_name, p.last_name, p.player_status, p.managed_by
    from public.profiles p where p.id = p_player_id;
end;
$$;

-- Soft delete: scores stay, the player leaves My players.
create or replace function public.delete_unregistered_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.profiles := public.require_my_unregistered(p_player_id);
begin
  if r.player_status not in ('unregistered','pending') then raise exception 'Only unregistered players can be deleted here.'; end if;
  update public.profiles set player_status = 'deleted_before_registering', deleted_at = now() where id = p_player_id;
  update public.player_links set status = 'cancelled' where player_id = p_player_id and status = 'pending';
  delete from public.my_players where owner_id = auth.uid() and player_id = p_player_id;
end;
$$;

-- ---------- New game picker ----------
-- Players from games I created or ran. Recent (last 14 days) first, then total games.
create or replace function public.list_new_game_candidates(p_limit integer default 100)
returns table (id uuid, display_name text, player_code text, player_status text, total_games integer, last_played_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with my_games as (
    select g.id, g.created_at from public.games g
    where g.created_by = auth.uid()
       or exists (select 1 from public.game_players a where a.game_id = g.id and a.profile_id = auth.uid() and a.role = 'game_admin')
  ),
  stats as (
    select gp.profile_id, count(*)::int as total_games, max(mg.created_at) as last_played_at
    from my_games mg join public.game_players gp on gp.game_id = mg.id
    where gp.profile_id <> auth.uid() and gp.role <> 'spectator' and coalesce(gp.seated, true)
    group by gp.profile_id
  ),
  roster as (
    select m.player_id as profile_id from public.my_players m where m.owner_id = auth.uid()
  ),
  everyone as (
    select s.profile_id, s.total_games, s.last_played_at from stats s
    union all
    select r.profile_id, 0, null from roster r where not exists (select 1 from stats s where s.profile_id = r.profile_id)
  )
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), p.player_code, p.player_status, e.total_games, e.last_played_at
  from everyone e join public.profiles p on p.id = e.profile_id
  where p.player_status not in ('deleted_before_registering','deleted_after_registering','merged')
  order by (e.last_played_at >= now() - interval '14 days') desc nulls last, e.total_games desc, e.last_played_at desc nulls last, p.display_name
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

-- ---------- Register players ----------
create or replace function public.expire_player_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l record;
begin
  for l in
    select * from public.player_links
    where owner_id = auth.uid() and status = 'pending' and kind = 'existing' and last_sent_at < now() - interval '14 days'
  loop
    update public.player_links set status = 'expired' where id = l.id;
    update public.profiles set player_status = 'unregistered' where id = l.player_id and player_status = 'pending';
    insert into public.creator_notices (owner_id, player_id, text)
    values (l.owner_id, l.player_id, (select display_name from public.profiles where id = l.player_id)
      || ': nobody answered the request sent to ' || l.email || '. They are unregistered again.');
  end loop;
end;
$$;

create or replace function public.list_my_unregistered_players(p_game_id uuid default null)
returns table (id uuid, display_name text, player_code text, first_name text, last_name text, player_status text, managed_by uuid, invite_email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_player_requests();
  return query
    select p.id, p.display_name, p.player_code, p.first_name, p.last_name, p.player_status, p.managed_by,
           (select l.email from public.player_links l where l.player_id = p.id and l.owner_id = auth.uid() and l.status = 'pending' limit 1)
    from public.profiles p
    where p.managed_by = auth.uid()
      and p.player_status in ('unregistered','pending')
      and (p_game_id is null or exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p.id))
    order by p.display_name;
end;
$$;

create or replace function public.list_my_player_links()
returns setof public.player_links
language sql
stable
security definer
set search_path = public
as $$
  select * from public.player_links where owner_id = auth.uid() order by invited_at desc limit 200;
$$;

-- Never links instantly. If the email already has an account the player becomes pending
-- and that person gets an in-app request.
create or replace function public.invite_unregistered_player(p_player_id uuid, p_email text, p_game_numbers integer[] default '{}')
returns table (link_id uuid, existing_account boolean, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.profiles := public.require_my_unregistered(p_player_id);
  clean text := lower(btrim(coalesce(p_email, '')));
  account uuid;
  existing public.player_links;
  new_kind text;
begin
  if r.player_status not in ('unregistered','pending') then raise exception 'This player is already registered.'; end if;
  if clean !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then raise exception 'Enter a full email address.'; end if;
  select id into account from public.profiles where managed_by is null and lower(btrim(email)) = clean
    and player_status not in ('deleted_after_registering') limit 1;
  if account = auth.uid() then raise exception 'That''s your own email.'; end if;
  new_kind := case when account is null then 'signup' else 'existing' end;

  select * into existing from public.player_links l where l.owner_id = auth.uid() and l.player_id = p_player_id and l.status = 'pending';
  if existing.id is not null and existing.email = clean then
    update public.player_links set last_sent_at = now(), kind = new_kind,
      game_numbers = case when cardinality(p_game_numbers) > 0 then p_game_numbers else game_numbers end
    where id = existing.id;
  else
    if existing.id is not null then
      update public.player_links set status = 'cancelled' where id = existing.id;
    end if;
    insert into public.player_links (owner_id, player_id, email, kind, game_numbers)
    values (auth.uid(), p_player_id, clean, new_kind, coalesce(p_game_numbers, '{}'))
    returning * into existing;
  end if;

  update public.profiles set player_status = case when new_kind = 'existing' then 'pending' else 'unregistered' end
  where id = p_player_id;

  return query select existing.id, account is not null, case when account is null then 'unregistered' else 'pending' end;
end;
$$;

-- Requests for me: "<creator> added you to G3. Is this you?" Verified email required.
create or replace function public.list_my_pending_claims()
returns table (id uuid, owner_id uuid, owner_name text, player_id uuid, player_name text, email text, kind text, status text,
               invited_at timestamptz, last_sent_at timestamptz, game_numbers integer[])
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.owner_id, o.display_name, l.player_id, p.display_name, l.email, l.kind, l.status, l.invited_at, l.last_sent_at, l.game_numbers
  from public.player_links l
  join public.profiles o on o.id = l.owner_id
  join public.profiles p on p.id = l.player_id
  where l.status = 'pending'
    and l.email = public.my_verified_email()
    and l.owner_id <> auth.uid()
    and not (l.kind = 'existing' and l.last_sent_at < now() - interval '14 days')
  order by l.invited_at;
$$;

create or replace function public.answer_player_claim(p_link_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  l public.player_links;
  moved uuid[];
  pname text;
begin
  select * into l from public.player_links where id = p_link_id for update;
  if l.id is null or l.status <> 'pending' or l.email is distinct from public.my_verified_email() then
    raise exception 'This request is not for you, or it was already answered.';
  end if;
  select display_name into pname from public.profiles where id = l.player_id;

  if not p_accept then
    update public.player_links set status = 'declined' where id = l.id;
    update public.profiles set player_status = 'unregistered' where id = l.player_id and player_status = 'pending';
    insert into public.creator_notices (owner_id, player_id, text)
    values (l.owner_id, l.player_id, pname || ': the person at ' || l.email || ' said "Not me". ' || pname || ' is unregistered again. Check the email and register them again.');
    return;
  end if;

  -- Games where I am not already seated move over. (If I am already in a game, that seat stays with the creator.)
  select coalesce(array_agg(gp.game_id), '{}') into moved
  from public.game_players gp
  where gp.profile_id = l.player_id
    and not exists (select 1 from public.game_players mine where mine.game_id = gp.game_id and mine.profile_id = me);

  update public.game_players set profile_id = me where profile_id = l.player_id and game_id = any(moved);
  update public.scores set profile_id = me where profile_id = l.player_id and game_id = any(moved);
  update public.rounds set dealer_profile_id = me where dealer_profile_id = l.player_id and game_id = any(moved);

  update public.player_links set status = 'claimed', claimed_by = me, claimed_at = now(), moved_game_ids = moved where id = l.id;
  -- Same player pending under the same creator with another email: closed too.
  update public.player_links set status = 'cancelled' where player_id = l.player_id and status = 'pending';
  update public.profiles set player_status = 'merged' where id = l.player_id;

  insert into public.my_players (owner_id, player_id, games_together)
  values (l.owner_id, me, coalesce(array_length(moved, 1), 0))
  on conflict (owner_id, player_id) do update set games_together = public.my_players.games_together + excluded.games_together;
  delete from public.my_players where owner_id = l.owner_id and player_id = l.player_id;
end;
$$;

-- Wrong link: move exactly the moved games back to the original record. Scores are never deleted.
create or replace function public.unlink_player(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l public.player_links;
begin
  select * into l from public.player_links where id = p_link_id and owner_id = auth.uid() for update;
  if l.id is null or l.status <> 'claimed' or l.claimed_by is null then
    raise exception 'Only a linked player can be unlinked.';
  end if;

  update public.game_players set profile_id = l.player_id where profile_id = l.claimed_by and game_id = any(l.moved_game_ids);
  update public.scores set profile_id = l.player_id where profile_id = l.claimed_by and game_id = any(l.moved_game_ids);
  update public.rounds set dealer_profile_id = l.player_id where dealer_profile_id = l.claimed_by and game_id = any(l.moved_game_ids);

  update public.player_links set status = 'unlinked' where id = l.id;
  update public.profiles set player_status = 'unregistered' where id = l.player_id;
  insert into public.my_players (owner_id, player_id) values (l.owner_id, l.player_id) on conflict do nothing;
end;
$$;

create or replace function public.take_creator_notices()
returns table (player_id uuid, text text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.creator_notices n set read_at = now()
    where n.owner_id = auth.uid() and n.read_at is null
    returning n.player_id, n.text;
end;
$$;

-- Find player in database: registered players only.
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
  if length(q) < 2 then return; end if;
  if q !~ '[A-Za-z@]' and length(regexp_replace(q, '\D', '', 'g')) >= 6 then return; end if;

  if q ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return query
      select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), p.player_code
      from public.profiles p
      where lower(btrim(p.email)) = lower(q) and p.managed_by is null and p.player_status = 'registered'
      limit 5;
    return;
  end if;
  if position('@' in q) > 0 then return; end if;

  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), p.player_code
    from public.profiles p
    where p.managed_by is null and p.player_status = 'registered'
      and (p.display_name ilike pattern escape '\' or p.first_name ilike pattern escape '\'
        or p.last_name ilike pattern escape '\' or p.player_code ilike pattern escape '\')
    order by p.display_name
    limit 20;
end;
$$;

-- Email cannot be changed for now.
create or replace function public.lock_profile_email()
returns trigger
language plpgsql
as $$
begin
  if old.email is not null and new.email is distinct from old.email
     and lower(btrim(new.email)) is distinct from lower(btrim(old.email)) then
    raise exception 'Changing your email is not available yet.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_lock_email on public.profiles;
create trigger profiles_lock_email before update of email on public.profiles
for each row execute function public.lock_profile_email();

do $$
declare f text;
begin
  foreach f in array array[
    'create_unregistered_player(text,text)', 'update_unregistered_player(uuid,text,text)',
    'delete_unregistered_player(uuid)', 'list_new_game_candidates(integer)',
    'list_my_unregistered_players(uuid)', 'list_my_player_links()',
    'invite_unregistered_player(uuid,text,integer[])', 'list_my_pending_claims()',
    'answer_player_claim(uuid,boolean)', 'unlink_player(uuid)', 'take_creator_notices()',
    'search_players(text)', 'expire_player_requests()'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  revoke all on function public.require_my_unregistered(uuid) from public, authenticated;
  revoke all on function public.my_verified_email() from public;
  grant execute on function public.my_verified_email() to authenticated;
end $$;
