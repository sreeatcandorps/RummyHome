-- Round 3b: sequential player IDs (#1, #2...) and share-link / player-ID claims.
--
-- Run after 011. Additive and safe to re-run. Not applied automatically.
--
-- 1. profiles.public_player_no: a plain number from a sequence, assigned on first save,
--    unique, never changed and never reused (sequences don't go backwards). Shown as #42.
--    Existing players are backfilled oldest first (created_at, then id). The uuid stays
--    the primary key because games, scores and rounds point at it.
--    Player IDs are never used to sign in.
-- 2. Claim links replace creator-typed email invites. The creator taps Share; the server
--    makes a random 256-bit token, stores only its sha-256, and returns the token once.
--    Single use, 14-day expiry, revocable; sharing again revokes the older link.
-- 3. A player ID typed at sign-up (no link) creates an 'id_request' the creator must approve.
--    Rate limited to 5 per account per 24 hours.
-- Both claim kinds need a confirmed email (Supabase "Confirm email").

-- pgcrypto (digest, gen_random_bytes) lives in the extensions schema on Supabase; functions below
-- put both public and extensions on their search_path so either install location works.
create extension if not exists pgcrypto with schema extensions;

-- ---------- 1. player numbers ----------
create sequence if not exists public.player_no_seq as bigint start with 1;
alter table public.profiles add column if not exists public_player_no bigint;

do $$
declare r record;
begin
  for r in select id from public.profiles where public_player_no is null order by created_at, id loop
    update public.profiles set public_player_no = nextval('public.player_no_seq') where id = r.id;
  end loop;
  perform setval('public.player_no_seq', greatest((select coalesce(max(public_player_no), 0) from public.profiles), 1),
                 (select count(*) > 0 from public.profiles where public_player_no is not null));
end $$;

alter table public.profiles alter column public_player_no set default nextval('public.player_no_seq');
alter sequence public.player_no_seq owned by public.profiles.public_player_no;
create unique index if not exists profiles_public_player_no_key on public.profiles (public_player_no);

create or replace function public.lock_public_player_no()
returns trigger
language plpgsql
as $$
begin
  if old.public_player_no is not null and new.public_player_no is distinct from old.public_player_no then
    raise exception 'A player ID never changes.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_lock_player_no on public.profiles;
create trigger profiles_lock_player_no before update of public_player_no on public.profiles
for each row execute function public.lock_public_player_no();

create or replace function public.player_label(p public.profiles)
returns text language sql immutable as $$ select '#' || p.public_player_no::text $$;

-- ---------- 2. claim records ----------
alter table public.player_links alter column email drop not null;
alter table public.player_links add column if not exists token_hash text;
alter table public.player_links add column if not exists expires_at timestamptz;
alter table public.player_links add column if not exists requester_id uuid references public.profiles(id) on delete cascade;
update public.player_links set expires_at = invited_at + interval '14 days' where expires_at is null;
alter table public.player_links alter column expires_at set default now() + interval '14 days';
alter table public.player_links alter column expires_at set not null;

alter table public.player_links drop constraint if exists player_links_kind_check;
alter table public.player_links add constraint player_links_kind_check
  check (kind in ('signup','existing','link','id_request'));
alter table public.player_links drop constraint if exists player_links_status_check;
alter table public.player_links add constraint player_links_status_check
  check (status in ('pending','claimed','declined','expired','cancelled','unlinked','revoked'));

drop index if exists public.player_links_one_pending;
create unique index if not exists player_links_one_live_link
  on public.player_links (player_id) where status = 'pending' and kind = 'link';
create unique index if not exists player_links_token_hash_key
  on public.player_links (token_hash) where token_hash is not null;
create unique index if not exists player_links_one_request_per_requester
  on public.player_links (player_id, requester_id) where status = 'pending' and kind = 'id_request';
create index if not exists player_links_requester_recent on public.player_links (requester_id, invited_at) where kind = 'id_request';

-- Creators see their records; requesters see their own requests. Nobody reads token hashes
-- through the API: the column is revoked below and the RPCs never return it.
drop policy if exists player_links_read on public.player_links;
create policy player_links_read on public.player_links
for select to authenticated
using (owner_id = auth.uid() or requester_id = auth.uid());
revoke select on public.player_links from anon, authenticated;
grant select (id, owner_id, player_id, email, kind, status, invited_at, last_sent_at, claimed_by, claimed_at,
              game_numbers, moved_game_ids, expires_at, requester_id) on public.player_links to authenticated;

-- Email invites and the email-matched "existing account" flow from 011 are replaced by claim links.
drop function if exists public.invite_unregistered_player(uuid, text, integer[]);
drop function if exists public.list_my_pending_claims();
drop function if exists public.answer_player_claim(uuid, boolean);

-- ---------- shared merge ----------
create or replace function public.merge_claim(p_link_id uuid, p_account uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l public.player_links; moved uuid[];
begin
  select * into l from public.player_links where id = p_link_id for update;
  if l.id is null or l.status <> 'pending' or l.expires_at <= now() then
    raise exception 'This claim is no longer valid.';
  end if;

  select coalesce(array_agg(gp.game_id), '{}') into moved
  from public.game_players gp
  where gp.profile_id = l.player_id
    and not exists (select 1 from public.game_players mine where mine.game_id = gp.game_id and mine.profile_id = p_account);

  update public.game_players set profile_id = p_account where profile_id = l.player_id and game_id = any(moved);
  update public.scores set profile_id = p_account where profile_id = l.player_id and game_id = any(moved);
  update public.rounds set dealer_profile_id = p_account where dealer_profile_id = l.player_id and game_id = any(moved);

  update public.player_links set status = 'claimed', claimed_by = p_account, claimed_at = now(), moved_game_ids = moved where id = l.id;
  update public.player_links set status = 'revoked' where player_id = l.player_id and status = 'pending' and id <> l.id;
  update public.profiles set player_status = 'merged' where id = l.player_id;

  insert into public.my_players (owner_id, player_id, games_together)
  values (l.owner_id, p_account, coalesce(array_length(moved, 1), 0))
  on conflict (owner_id, player_id) do update set games_together = public.my_players.games_together + excluded.games_together;
  delete from public.my_players where owner_id = l.owner_id and player_id = l.player_id;
end;
$$;

create or replace function public.reset_if_no_live_claims(p_player_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set player_status = 'unregistered'
  where id = p_player_id and player_status = 'pending'
    and not exists (select 1 from public.player_links where player_id = p_player_id and status = 'pending');
$$;

create or replace function public.game_numbers_for(p_player_id uuid)
returns integer[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(g.game_number order by g.created_at desc) filter (where g.game_number is not null), '{}')
  from public.game_players gp join public.games g on g.id = gp.game_id
  where gp.profile_id = p_player_id;
$$;

-- ---------- creator: share links ----------
create or replace function public.create_claim_link(p_player_id uuid, p_game_numbers integer[] default '{}')
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.profiles := public.require_my_unregistered(p_player_id);
  raw text := rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  expiry timestamptz := now() + interval '14 days';
begin
  if r.player_status not in ('unregistered','pending') then raise exception 'This player is already registered.'; end if;
  update public.player_links set status = 'revoked' where player_id = p_player_id and kind = 'link' and status = 'pending';
  insert into public.player_links (owner_id, player_id, kind, token_hash, expires_at, game_numbers)
  values (auth.uid(), p_player_id, 'link', encode(digest(raw, 'sha256'), 'hex'), expiry,
          case when cardinality(coalesce(p_game_numbers, '{}')) > 0 then p_game_numbers else public.game_numbers_for(p_player_id) end);
  update public.profiles set player_status = 'pending' where id = p_player_id;
  return query select raw, expiry;
end;
$$;

create or replace function public.revoke_claim_link(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.profiles := public.require_my_unregistered(p_player_id);
begin
  update public.player_links set status = 'revoked' where player_id = r.id and kind = 'link' and status = 'pending';
  perform public.reset_if_no_live_claims(r.id);
end;
$$;

-- ---------- claimant: links ----------
create or replace function public.live_link_for_token(p_token text)
returns public.player_links
language sql
stable
security definer
set search_path = public, extensions
as $$
  select * from public.player_links
  where kind = 'link' and status = 'pending' and expires_at > now()
    and token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.peek_claim_link(p_token text)
returns table (id uuid, owner_id uuid, owner_name text, player_id uuid, player_name text, public_player_no bigint,
               kind text, status text, invited_at timestamptz, expires_at timestamptz, game_numbers integer[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare l public.player_links := public.live_link_for_token(p_token);
begin
  if public.my_verified_email() is null then raise exception 'Confirm your email first.'; end if;
  if l.id is null or l.owner_id = auth.uid() then return; end if;
  return query
    select l.id, l.owner_id, o.display_name, l.player_id, p.display_name, p.public_player_no, l.kind, l.status, l.invited_at, l.expires_at, l.game_numbers
    from public.profiles o, public.profiles p where o.id = l.owner_id and p.id = l.player_id;
end;
$$;

create or replace function public.answer_claim_link(p_token text, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l public.player_links := public.live_link_for_token(p_token); pname text;
begin
  if public.my_verified_email() is null then raise exception 'Confirm your email first.'; end if;
  if l.id is null then raise exception 'This link was already used or has expired.'; end if;
  if l.owner_id = auth.uid() then raise exception 'This is your own link.'; end if;
  if p_accept then
    perform public.merge_claim(l.id, auth.uid());
    return;
  end if;
  select display_name into pname from public.profiles where id = l.player_id;
  update public.player_links set status = 'declined' where id = l.id;
  perform public.reset_if_no_live_claims(l.player_id);
  insert into public.creator_notices (owner_id, player_id, text)
  values (l.owner_id, l.player_id, pname || ': the person who opened your link said "Not me". ' || pname || ' is still unregistered.');
end;
$$;

-- ---------- claimant: player ID typed at sign-up ----------
create or replace function public.request_claim_by_player_no(p_player_no bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare p public.profiles; new_id uuid;
begin
  if public.my_verified_email() is null then raise exception 'Confirm your email first.'; end if;
  if (select count(*) from public.player_links where kind = 'id_request' and requester_id = auth.uid() and invited_at > now() - interval '24 hours') >= 5 then
    raise exception 'Too many player ID requests today. Try again tomorrow.';
  end if;
  select * into p from public.profiles where public_player_no = p_player_no;
  if p.id is null or p.managed_by is null or p.player_status not in ('unregistered','pending') then
    raise exception 'No player #% is waiting to be claimed.', p_player_no;
  end if;
  if p.managed_by = auth.uid() then raise exception 'You can''t claim your own player.'; end if;
  insert into public.player_links (owner_id, player_id, kind, requester_id, game_numbers)
  values (p.managed_by, p.id, 'id_request', auth.uid(), public.game_numbers_for(p.id))
  returning id into new_id;
  update public.profiles set player_status = 'pending' where id = p.id;
  insert into public.creator_notices (owner_id, player_id, text)
  values (p.managed_by, p.id, '#' || p.public_player_no || ' wants to claim ' || p.display_name || '. Approve?');
  return new_id;
exception when unique_violation then
  raise exception 'You already asked to claim this player.';
end;
$$;

create or replace function public.list_claim_requests()
returns table (id uuid, owner_id uuid, player_id uuid, player_name text, public_player_no bigint, kind text, status text,
               invited_at timestamptz, expires_at timestamptz, requester_id uuid, requester_name text, game_numbers integer[])
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_player_requests();
  return query
    select l.id, l.owner_id, l.player_id, p.display_name, p.public_player_no, l.kind, l.status, l.invited_at, l.expires_at,
           l.requester_id, rq.display_name, l.game_numbers
    from public.player_links l
    join public.profiles p on p.id = l.player_id
    left join public.profiles rq on rq.id = l.requester_id
    where l.owner_id = auth.uid() and l.kind = 'id_request' and l.status = 'pending'
    order by l.invited_at;
end;
$$;

create or replace function public.answer_claim_request(p_link_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l public.player_links;
begin
  select * into l from public.player_links where id = p_link_id and owner_id = auth.uid() and kind = 'id_request';
  if l.id is null or l.status <> 'pending' then raise exception 'This request was already answered.'; end if;
  if p_approve then
    perform public.merge_claim(l.id, l.requester_id);
  else
    update public.player_links set status = 'declined' where id = l.id;
    perform public.reset_if_no_live_claims(l.player_id);
  end if;
end;
$$;

-- Expiry for both kinds (called from list_my_unregistered_players and list_claim_requests).
create or replace function public.expire_player_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l record;
begin
  for l in select * from public.player_links where owner_id = auth.uid() and status = 'pending' and expires_at <= now() loop
    update public.player_links set status = 'expired' where id = l.id;
    perform public.reset_if_no_live_claims(l.player_id);
    insert into public.creator_notices (owner_id, player_id, text)
    values (l.owner_id, l.player_id, (select display_name from public.profiles where id = l.player_id)
      || ': the ' || case when l.kind = 'link' then 'claim link' else 'claim request' end || ' expired. They are unregistered again.');
  end loop;
end;
$$;

drop function if exists public.list_my_player_links();
create or replace function public.list_my_player_links()
returns table (id uuid, owner_id uuid, player_id uuid, player_name text, public_player_no bigint, kind text, status text,
               invited_at timestamptz, expires_at timestamptz, requester_id uuid, claimed_by uuid, game_numbers integer[], moved_game_ids uuid[])
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.owner_id, l.player_id, p.display_name, p.public_player_no, l.kind, l.status, l.invited_at, l.expires_at,
         l.requester_id, l.claimed_by, l.game_numbers, l.moved_game_ids
  from public.player_links l join public.profiles p on p.id = l.player_id
  where l.owner_id = auth.uid()
  order by l.invited_at desc
  limit 200;
$$;

-- unlink_player (011) works on 'claimed' rows of either kind and is kept as is.

-- ---------- show #numbers wherever an ID was shown ----------
create or replace function public.list_my_players()
returns table (id uuid, display_name text, player_code text, games_together integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), '#' || p.public_player_no, m.games_together
  from public.my_players m
  join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid()
    and p.player_status not in ('deleted_before_registering','deleted_after_registering','merged')
  order by m.games_together desc, p.display_name;
$$;

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
  return query select p.id, p.display_name, '#' || p.public_player_no, p.first_name, p.last_name, p.player_status, p.managed_by
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
  return query select p.id, p.display_name, '#' || p.public_player_no, p.first_name, p.last_name, p.player_status, p.managed_by
    from public.profiles p where p.id = p_player_id;
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
    select p.id, p.display_name, '#' || p.public_player_no, p.first_name, p.last_name, p.player_status, p.managed_by, null::text
    from public.profiles p
    where p.managed_by = auth.uid()
      and p.player_status in ('unregistered','pending')
      and (p_game_id is null or exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p.id))
    order by p.display_name;
end;
$$;

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
  everyone as (
    select s.profile_id, s.total_games, s.last_played_at from stats s
    union all
    select m.player_id, 0, null from public.my_players m
    where m.owner_id = auth.uid() and not exists (select 1 from stats s where s.profile_id = m.player_id)
  )
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), '#' || p.public_player_no, p.player_status, e.total_games, e.last_played_at
  from everyone e join public.profiles p on p.id = e.profile_id
  where p.player_status not in ('deleted_before_registering','deleted_after_registering','merged')
  order by (e.last_played_at >= now() - interval '14 days') desc nulls last, e.total_games desc, e.last_played_at desc nulls last, p.display_name
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

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
      select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), '#' || p.public_player_no
      from public.profiles p
      where p.public_player_no = ltrim(q, '#')::bigint and p.managed_by is null and p.player_status = 'registered';
    return;
  end if;
  if length(q) < 2 then return; end if;
  if q !~ '[A-Za-z@]' and length(regexp_replace(q, '\D', '', 'g')) >= 6 then return; end if;

  if q ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return query
      select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), '#' || p.public_player_no
      from public.profiles p
      where lower(btrim(p.email)) = lower(q) and p.managed_by is null and p.player_status = 'registered'
      limit 5;
    return;
  end if;
  if position('@' in q) > 0 then return; end if;

  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), '#' || p.public_player_no
    from public.profiles p
    where p.managed_by is null and p.player_status = 'registered'
      and (p.display_name ilike pattern escape '\' or p.first_name ilike pattern escape '\' or p.last_name ilike pattern escape '\')
    order by p.display_name
    limit 20;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'create_claim_link(uuid,integer[])', 'revoke_claim_link(uuid)', 'peek_claim_link(text)',
    'answer_claim_link(text,boolean)', 'request_claim_by_player_no(bigint)', 'list_claim_requests()',
    'answer_claim_request(uuid,boolean)', 'list_my_player_links()', 'list_my_players()',
    'create_unregistered_player(text,text)', 'update_unregistered_player(uuid,text,text)',
    'list_my_unregistered_players(uuid)', 'list_new_game_candidates(integer)', 'search_players(text)',
    'expire_player_requests()'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['merge_claim(uuid,uuid)', 'reset_if_no_live_claims(uuid)', 'game_numbers_for(uuid)', 'live_link_for_token(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
