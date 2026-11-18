-- 025: Link to Player ID as a request the account owner accepts (approved Nov 11, 10:59 PM PT,
-- item 5; amended Nov 12: no immediate merge, no email field, full conflict sentence).
--
-- An organiser types only the target's Player ID. Nothing moves: the server records a pending
-- 'link_request' in player_links, emails the account owner (through the 024 outbox) a Yes / No
-- link, and shows the same request in the app (Home). The player row reads "Link pending" until
-- the owner answers; the request can be cancelled and expires after 7 days. On Yes the conflict
-- check runs again and, if clear, every seat, score and dealer mark in every game moves to the
-- account (the same merge 012 merge_claim does, under the 019 per-game lock), recorded as a
-- 'claimed' row so 011 unlink_player can undo it; the organiser gets a one-time pop-up
-- "Harish (HG) is now linked to #40." On No, or after 7 days, the player is unregistered again.
--
-- A conflict is any game where the unregistered player sits and the account already plays too.
-- The sentence names every such game with its G-number, full game ID and creator name:
--   Can't link yet. G12 (game ID 3f2a…, creator Sree Koneru) has both R K and #11. In that game,
--   clear one of their scores to zero and remove them from the game first.
-- Safe to re-run. Rollback: supabase/rollback/rollback_025_link_player_to_account.sql.

-- ---------- A. schema ----------
alter table public.player_links add column if not exists target_id uuid references public.profiles(id) on delete cascade;
alter table public.player_links drop constraint if exists player_links_kind_check;
alter table public.player_links add constraint player_links_kind_check
  check (kind in ('signup','existing','link','id_request','link_request'));
create unique index if not exists player_links_one_pending_link_request
  on public.player_links (player_id) where status = 'pending' and kind = 'link_request';
create index if not exists player_links_target_pending
  on public.player_links (target_id) where status = 'pending' and kind = 'link_request';

-- The account being asked reads its own requests too (012 policy + target).
drop policy if exists player_links_read on public.player_links;
create policy player_links_read on public.player_links
for select to authenticated
using (owner_id = auth.uid() or requester_id = auth.uid() or target_id = auth.uid());
grant select (target_id) on public.player_links to authenticated;

-- Notices carry a kind so the app can show the link-complete one as a pop-up.
alter table public.creator_notices add column if not exists kind text not null default 'notice';
alter table public.creator_notices drop constraint if exists creator_notices_kind_check;
alter table public.creator_notices add constraint creator_notices_kind_check check (kind in ('notice', 'linked'));

-- The outbox (024) carries the Yes / No email.
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check
  check (kind in ('game_started', 'result_saved', 'link_request'));

-- Earlier shapes of this migration (never applied live) had the email parameter.
drop function if exists public.link_player_to_account(uuid, bigint, text);
drop function if exists public.link_player_check(uuid, bigint, text);
drop function if exists public.link_target_for(bigint, text);
drop function if exists public.link_conflicts(uuid, uuid);

-- How long a request stays open.
create or replace function public.link_request_days()
returns integer
language sql
immutable
as $$ select 7 $$;

-- ---------- B. lookups ----------
-- The registered account a Player ID names, or a plain sentence.
create or replace function public.link_target_for(p_player_no bigint)
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare t public.profiles;
begin
  if p_player_no is null then raise exception 'Type the Player ID number, like #42.'; end if;
  select * into t from public.profiles p
  where p.public_player_no = p_player_no and p.managed_by is null
    and coalesce(p.player_status, 'registered') = 'registered' and p.deleted_at is null;
  if t.id is null then raise exception 'No registered player has that Player ID.'; end if;
  return t;
end;
$$;

-- The unregistered player the caller manages, in a linkable state.
create or replace function public.link_seat_for(p_player_id uuid)
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare seat public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into seat from public.profiles where id = p_player_id;
  if seat.id is null or (seat.managed_by is distinct from auth.uid() and not public.is_app_admin()) then
    raise exception 'Only your own unregistered players can be linked.';
  end if;
  if coalesce(seat.player_status, 'registered') not in ('unregistered', 'pending') then
    raise exception 'Only an unregistered player can be linked to a Player ID.';
  end if;
  return seat;
end;
$$;

-- Games where the unregistered player sits (any status, deleted included) and the account already
-- plays too: a seated, non-spectator membership. A non-playing admin or a viewer is not a conflict.
create or replace function public.link_conflicts(p_player_id uuid, p_target uuid)
returns table (game_id uuid, game_number integer, creator_name text)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.game_number, coalesce(nullif(c.display_name, ''), 'Player')
  from public.game_players mine
  join public.games g on g.id = mine.game_id
  join public.game_players theirs on theirs.game_id = mine.game_id and theirs.profile_id = p_target
  left join public.profiles c on c.id = g.created_by
  where mine.profile_id = p_player_id
    and mine.role <> 'spectator' and coalesce(mine.seated, true)
    and theirs.role <> 'spectator' and coalesce(theirs.seated, true)
  order by g.game_number nulls last, g.created_at;
$$;

-- The one sentence the app, the email page and the RPC errors all use; null when nothing blocks.
create or replace function public.link_conflict_message(p_player_id uuid, p_target uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  n integer;
  pname text;
  tno bigint;
  listed text;
begin
  select coalesce(array_agg(
           coalesce('G' || c.game_number::text, 'a game') || ' (game ID ' || c.game_id::text || ', creator ' || c.creator_name || ')'
           order by c.game_number nulls last), '{}')
    into parts
  from public.link_conflicts(p_player_id, p_target) c;
  n := coalesce(array_length(parts, 1), 0);
  if n = 0 then return null; end if;
  select coalesce(nullif(display_name, ''), 'This player') into pname from public.profiles where id = p_player_id;
  select public_player_no into tno from public.profiles where id = p_target;
  listed := case when n = 1 then parts[1]
                 else array_to_string(parts[1:n-1], ', ') || ' and ' || parts[n] end;
  return format('Can''t link yet. %s %s both %s and #%s. In %s, clear one of their scores to zero and remove them from the game first.',
                listed, case when n = 1 then 'has' else 'have' end, pname, coalesce(tno::text, '?'),
                case when n = 1 then 'that game' else 'those games' end);
end;
$$;

-- ---------- C. organiser side ----------
-- The preview behind Check: who the number names, how many games would move, what blocks, and
-- any request already open for this player.
create or replace function public.link_player_check(p_player_id uuid, p_player_no bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seat public.profiles := public.link_seat_for(p_player_id);
  t public.profiles := public.link_target_for(p_player_no);
  n_games integer;
  open_req public.player_links;
begin
  if t.id = seat.id then raise exception 'That is this same player.'; end if;
  select count(*)::int into n_games from public.game_players gp
  where gp.profile_id = seat.id and gp.role <> 'spectator' and coalesce(gp.seated, true);
  select * into open_req from public.player_links l
  where l.player_id = seat.id and l.kind = 'link_request' and l.status = 'pending' and l.expires_at > now();
  return jsonb_build_object(
    'target', jsonb_build_object('id', t.id, 'name', coalesce(nullif(t.display_name, ''), 'Rummy Player'), 'playerNo', t.public_player_no),
    'gameCount', n_games,
    'gameNumbers', public.game_numbers_for(seat.id),
    'conflicts', coalesce((select jsonb_agg(jsonb_build_object('gameId', c.game_id, 'gameNumber', c.game_number, 'creatorName', c.creator_name)) from public.link_conflicts(seat.id, t.id) c), '[]'::jsonb),
    'conflictMessage', public.link_conflict_message(seat.id, t.id),
    'pending', case when open_req.id is null then null else jsonb_build_object(
      'id', open_req.id, 'expiresAt', open_req.expires_at, 'targetId', open_req.target_id,
      'targetNo', (select public_player_no from public.profiles where id = open_req.target_id),
      'targetName', (select coalesce(nullif(display_name, ''), 'Rummy Player') from public.profiles where id = open_req.target_id)) end
  );
end;
$$;

-- Send request: a pending 'link_request' (7 days, single-use token for the email), the player
-- shows Link pending, and one outbox row for the account owner. Refused while a conflict exists.
create or replace function public.request_player_link(p_player_id uuid, p_player_no bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  seat public.profiles := public.link_seat_for(p_player_id);
  t public.profiles := public.link_target_for(p_player_no);
  clash text;
  raw text := rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  expiry timestamptz := now() + make_interval(days => public.link_request_days());
  link_id uuid;
  numbers integer[];
  n_games integer;
  requester text;
  queued boolean := false;
begin
  if t.id = seat.id then raise exception 'That is this same player.'; end if;
  clash := public.link_conflict_message(seat.id, t.id);
  if clash is not null then raise exception '%', clash; end if;

  -- One open request per player: a new one replaces the older (its email link stops working).
  update public.player_links set status = 'cancelled' where player_id = seat.id and kind = 'link_request' and status = 'pending';
  delete from public.email_outbox o where o.kind = 'link_request' and o.sent_at is null
    and o.event_key in (select 'link_request:' || l.id::text from public.player_links l where l.player_id = seat.id and l.kind = 'link_request' and l.status = 'cancelled');

  numbers := public.game_numbers_for(seat.id);
  select count(*)::int into n_games from public.game_players gp
  where gp.profile_id = seat.id and gp.role <> 'spectator' and coalesce(gp.seated, true);
  select coalesce(nullif(display_name, ''), 'A player') into requester from public.profiles where id = auth.uid();

  insert into public.player_links (owner_id, player_id, kind, status, target_id, token_hash, expires_at, game_numbers)
  values (auth.uid(), seat.id, 'link_request', 'pending', t.id, encode(digest(raw, 'sha256'), 'hex'), expiry, numbers)
  returning id into link_id;
  update public.profiles set player_status = 'pending' where id = seat.id;

  if t.email is not null and t.email <> '' then
    insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload)
    values ('link_request:' || link_id::text, 'link_request', t.id, t.email, jsonb_build_object(
      'linkId', link_id, 'requesterName', requester,
      'playerName', coalesce(nullif(seat.display_name, ''), 'Player'),
      'playerInitials', (select m.initials from public.my_players m where m.owner_id = auth.uid() and m.player_id = seat.id),
      'targetName', coalesce(nullif(t.display_name, ''), 'there'), 'playerNo', t.public_player_no,
      'gameCount', n_games, 'gameNumbers', to_jsonb(numbers), 'expiresAt', expiry,
      'yesUrl', public.site_base_url() || '/link.html?t=' || raw || '&a=yes',
      'noUrl', public.site_base_url() || '/link.html?t=' || raw || '&a=no'))
    on conflict (event_key) do nothing;
    queued := true;
  end if;

  return jsonb_build_object(
    'linkId', link_id, 'expiresAt', expiry, 'emailQueued', queued,
    'playerName', coalesce(nullif(seat.display_name, ''), 'Player'),
    'target', jsonb_build_object('id', t.id, 'name', coalesce(nullif(t.display_name, ''), 'Rummy Player'), 'playerNo', t.public_player_no),
    'gameCount', n_games, 'gameNumbers', to_jsonb(numbers)
  );
end;
$$;

-- The organiser takes a request back. The email link stops working; nothing was moved.
create or replace function public.cancel_player_link_request(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l public.player_links;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into l from public.player_links where id = p_link_id and kind = 'link_request' for update;
  if l.id is null or (l.owner_id <> auth.uid() and not public.is_app_admin()) then raise exception 'This request is not yours to cancel.'; end if;
  if l.status <> 'pending' then raise exception 'This request was already answered.'; end if;
  update public.player_links set status = 'cancelled' where id = l.id;
  delete from public.email_outbox where event_key = 'link_request:' || l.id::text and sent_at is null;
  perform public.reset_if_no_live_claims(l.player_id);
end;
$$;

-- Requests that ran out: the player is unregistered again, the organiser is told once.
create or replace function public.expire_link_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l record;
begin
  for l in
    select pl.*, p.display_name as player_name, t.public_player_no as target_no
    from public.player_links pl
    join public.profiles p on p.id = pl.player_id
    left join public.profiles t on t.id = pl.target_id
    where pl.kind = 'link_request' and pl.status = 'pending' and pl.expires_at <= now()
      and (pl.owner_id = auth.uid() or pl.target_id = auth.uid())
  loop
    update public.player_links set status = 'expired' where id = l.id;
    perform public.reset_if_no_live_claims(l.player_id);
    insert into public.creator_notices (owner_id, player_id, text)
    values (l.owner_id, l.player_id, coalesce(l.player_name, 'Player') || ': the link request to #' || coalesce(l.target_no::text, '?')
      || ' was not answered in ' || public.link_request_days()::text || ' days. ' || coalesce(l.player_name, 'Player') || ' is unregistered again.');
  end loop;
end;
$$;

-- 012 body, minus link requests (they expire above with their own wording).
create or replace function public.expire_player_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare l record;
begin
  perform public.expire_link_requests();
  for l in select * from public.player_links where owner_id = auth.uid() and status = 'pending' and expires_at <= now() and kind <> 'link_request' loop
    update public.player_links set status = 'expired' where id = l.id;
    perform public.reset_if_no_live_claims(l.player_id);
    insert into public.creator_notices (owner_id, player_id, text)
    values (l.owner_id, l.player_id, (select display_name from public.profiles where id = l.player_id)
      || ': the ' || case when l.kind = 'link' then 'claim link' else 'claim request' end || ' expired. They are unregistered again.');
  end loop;
end;
$$;

-- Open requests the caller can see: their own (p_game_id null), or those for players seated in a
-- game they belong to, so every admin of the game sees "Link pending" on the row.
create or replace function public.list_my_link_requests(p_game_id uuid default null)
returns table (id uuid, owner_id uuid, owner_name text, player_id uuid, player_name text, target_id uuid, target_no bigint, target_name text,
               invited_at timestamptz, expires_at timestamptz, game_numbers integer[])
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  perform public.expire_link_requests();
  if p_game_id is not null and not (public.is_game_member(p_game_id) or public.can_manage_game(p_game_id) or public.is_app_admin()) then return; end if;
  return query
    select l.id, l.owner_id, coalesce(nullif(o.display_name, ''), 'Player'), l.player_id, coalesce(nullif(p.display_name, ''), 'Player'),
           l.target_id, t.public_player_no, coalesce(nullif(t.display_name, ''), 'Rummy Player'), l.invited_at, l.expires_at, l.game_numbers
    from public.player_links l
    join public.profiles p on p.id = l.player_id
    join public.profiles o on o.id = l.owner_id
    left join public.profiles t on t.id = l.target_id
    where l.kind = 'link_request' and l.status = 'pending' and l.expires_at > now()
      and case when p_game_id is null then l.owner_id = auth.uid()
               else exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = l.player_id) end
    order by l.invited_at;
end;
$$;

-- ---------- D. the move ----------
-- Shared by the in-app Yes and the email Yes. Re-runs the conflict check, then moves every seat,
-- score and dealer mark under the 019 per-game lock, records the claimed row and tells the organiser.
create or replace function public.perform_player_link(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.player_links;
  seat public.profiles;
  t public.profiles;
  clash text;
  moved uuid[] := '{}';
  moved_numbers integer[];
  gid uuid;
  theirs public.game_players;
  ini text;
begin
  select * into l from public.player_links where id = p_link_id and kind = 'link_request' for update;
  if l.id is null or l.status <> 'pending' or l.expires_at <= now() then raise exception 'This request is no longer valid.'; end if;
  select * into seat from public.profiles where id = l.player_id for update;
  select * into t from public.profiles where id = l.target_id;
  if coalesce(seat.player_status, 'registered') not in ('unregistered', 'pending') then raise exception 'This player was already linked.'; end if;
  if t.id is null or t.managed_by is not null or coalesce(t.player_status, 'registered') <> 'registered' or t.deleted_at is not null then
    raise exception 'That account is no longer available.';
  end if;

  clash := public.link_conflict_message(seat.id, t.id);
  if clash is not null then raise exception '%', clash; end if;

  for gid in
    select gp.game_id from public.game_players gp
    where gp.profile_id = seat.id and gp.role <> 'spectator' and coalesce(gp.seated, true)
    order by gp.game_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('game:' || gid::text, 0));
    -- The account may already be here as a non-playing admin or a viewer: one membership, admin role kept (017).
    select * into theirs from public.game_players gp where gp.game_id = gid and gp.profile_id = t.id;
    if theirs.id is not null then delete from public.game_players gp where gp.id = theirs.id; end if;
    update public.game_players
       set profile_id = t.id,
           seated = true,
           role = case when theirs.role = 'game_admin' then 'game_admin' else role end
     where game_id = gid and profile_id = seat.id;
    update public.scores set profile_id = t.id where game_id = gid and profile_id = seat.id;
    update public.rounds set dealer_profile_id = t.id where game_id = gid and dealer_profile_id = seat.id;
    moved := array_append(moved, gid);
    theirs := null;
  end loop;
  select coalesce(array_agg(g.game_number order by g.game_number) filter (where g.game_number is not null), '{}') into moved_numbers
  from public.games g where g.id = any(moved);

  update public.player_links set status = 'claimed', claimed_by = t.id, claimed_at = now(), moved_game_ids = moved, game_numbers = moved_numbers where id = l.id;
  update public.player_links set status = 'revoked' where player_id = seat.id and status = 'pending' and id <> l.id;
  update public.profiles set player_status = 'merged' where id = seat.id;

  select m.initials into ini from public.my_players m where m.owner_id = l.owner_id and m.player_id = seat.id;
  if t.id <> l.owner_id then
    insert into public.my_players (owner_id, player_id, games_together)
    values (l.owner_id, t.id, coalesce(array_length(moved, 1), 0))
    on conflict (owner_id, player_id) do update set games_together = public.my_players.games_together + excluded.games_together;
  end if;
  delete from public.my_players where owner_id = l.owner_id and player_id = seat.id;

  -- The one-time pop-up for the organiser: "Harish (HG) is now linked to #40."
  insert into public.creator_notices (owner_id, player_id, text, kind)
  values (l.owner_id, seat.id, coalesce(nullif(seat.display_name, ''), 'Player') || case when ini is not null and ini <> '' then ' (' || ini || ')' else '' end
          || ' is now linked to #' || coalesce(t.public_player_no::text, '?') || '.', 'linked');

  return jsonb_build_object(
    'linkId', l.id,
    'playerName', coalesce(nullif(seat.display_name, ''), 'Player'),
    'playerInitials', ini,
    'target', jsonb_build_object('id', t.id, 'name', coalesce(nullif(t.display_name, ''), 'Rummy Player'), 'playerNo', t.public_player_no),
    'movedGameIds', to_jsonb(moved),
    'movedGameNumbers', to_jsonb(moved_numbers)
  );
end;
$$;

create or replace function public.decline_player_link(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare l public.player_links; pname text; tlabel text;
begin
  select * into l from public.player_links where id = p_link_id and kind = 'link_request' for update;
  if l.id is null or l.status <> 'pending' or l.expires_at <= now() then raise exception 'This request is no longer valid.'; end if;
  update public.player_links set status = 'declined' where id = l.id;
  perform public.reset_if_no_live_claims(l.player_id);
  select coalesce(nullif(display_name, ''), 'Player') into pname from public.profiles where id = l.player_id;
  select coalesce(nullif(display_name, ''), 'The account') || coalesce(' (#' || public_player_no::text || ')', '') into tlabel from public.profiles where id = l.target_id;
  insert into public.creator_notices (owner_id, player_id, text)
  values (l.owner_id, l.player_id, tlabel || ' said No to linking ' || pname || '. ' || pname || ' is still unregistered.');
  return jsonb_build_object('linkId', l.id, 'playerName', pname, 'accepted', false);
end;
$$;

-- ---------- E. account owner side ----------
-- The requests waiting for me (Home card). conflict_message is re-checked now so the card can say
-- why Yes would fail before the person taps it.
create or replace function public.list_link_requests_for_me()
returns table (id uuid, owner_id uuid, owner_name text, player_id uuid, player_name text, player_initials text, target_id uuid, target_no bigint,
               invited_at timestamptz, expires_at timestamptz, game_numbers integer[], game_count integer, conflict_message text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  perform public.expire_link_requests();
  return query
    select l.id, l.owner_id, coalesce(nullif(o.display_name, ''), 'Player'), l.player_id, coalesce(nullif(p.display_name, ''), 'Player'),
           (select m.initials from public.my_players m where m.owner_id = l.owner_id and m.player_id = l.player_id),
           l.target_id, (select t.public_player_no from public.profiles t where t.id = l.target_id),
           l.invited_at, l.expires_at, l.game_numbers,
           (select count(*)::int from public.game_players gp where gp.profile_id = l.player_id and gp.role <> 'spectator' and coalesce(gp.seated, true)),
           public.link_conflict_message(l.player_id, l.target_id)
    from public.player_links l
    join public.profiles p on p.id = l.player_id
    join public.profiles o on o.id = l.owner_id
    where l.kind = 'link_request' and l.status = 'pending' and l.expires_at > now() and l.target_id = auth.uid()
    order by l.invited_at;
end;
$$;

-- Yes / No in the app.
create or replace function public.answer_player_link_request(p_link_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare l public.player_links;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into l from public.player_links where id = p_link_id and kind = 'link_request';
  if l.id is null or l.target_id <> auth.uid() then raise exception 'This request is for another account.'; end if;
  if p_accept then return public.perform_player_link(l.id); end if;
  return public.decline_player_link(l.id);
end;
$$;

-- Yes / No from the email (the page on the share site). The link went only to the account's own
-- address, so holding it stands for the owner, as a password-reset link does; the target is fixed
-- on the row, so the token can never land the player on anyone else. Answers {ok, …} instead of
-- raising, so the page can show the sentence.
create or replace function public.peek_link_request(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case when l.id is null then null else jsonb_build_object(
    'requesterName', coalesce(nullif(o.display_name, ''), 'A player'),
    'playerName', coalesce(nullif(p.display_name, ''), 'Player'),
    'playerInitials', (select m.initials from public.my_players m where m.owner_id = l.owner_id and m.player_id = l.player_id),
    'playerNo', t.public_player_no,
    'gameNumbers', to_jsonb(l.game_numbers),
    'expiresAt', l.expires_at,
    'conflictMessage', public.link_conflict_message(l.player_id, l.target_id)) end
  from (select 1) anchor
  left join public.player_links l on l.kind = 'link_request' and l.status = 'pending' and l.expires_at > now()
    and l.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
  left join public.profiles o on o.id = l.owner_id
  left join public.profiles p on p.id = l.player_id
  left join public.profiles t on t.id = l.target_id;
$$;

create or replace function public.answer_link_request_by_token(p_token text, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare l public.player_links;
begin
  if p_token is null or length(p_token) < 20 then return jsonb_build_object('ok', false, 'message', 'This link is not valid any more.'); end if;
  select * into l from public.player_links
  where kind = 'link_request' and status = 'pending' and expires_at > now()
    and token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if l.id is null then return jsonb_build_object('ok', false, 'message', 'This link was already used, cancelled or has expired.'); end if;
  if p_accept then
    return public.perform_player_link(l.id) || jsonb_build_object('ok', true, 'accepted', true);
  end if;
  return public.decline_player_link(l.id) || jsonb_build_object('ok', true, 'accepted', false);
exception when others then
  return jsonb_build_object('ok', false, 'message', sqlerrm);
end;
$$;

-- ---------- F. notices with a kind; Home bundle carries the requests for me ----------
drop function if exists public.take_creator_notices();
create function public.take_creator_notices()
returns table (player_id uuid, text text, kind text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.creator_notices n set read_at = now()
    where n.owner_id = auth.uid() and n.read_at is null
    returning n.player_id, n.text, n.kind;
end;
$$;

-- 023 body + notice kinds + link_requests (the requests waiting for this account).
create or replace function public.get_home_bundle(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
set jit = off
as $$
declare
  v_admin boolean;
  v_games jsonb;
  v_notices jsonb;
  v_claims jsonb;
  v_link_requests jsonb;
  v_roster jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_admin := public.is_app_admin();

  with vg as (
    select (v.game).*, v.member from public.visible_games(p_limit, false) v
  ),
  detail as (
    select vg.id from vg where v_admin or vg.member
  ),
  seats as (
    select * from public.seat_rows_json((select coalesce(array_agg(id), '{}'::uuid[]) from detail), '{}'::uuid[], false)
  )
  select coalesce(jsonb_agg(
           to_jsonb(vg) - 'member' || jsonb_build_object('game_players', coalesce(s.seats, '[]'::jsonb))
           order by vg.created_at desc, vg.id desc), '[]'::jsonb)
    into v_games
  from vg
  left join seats s on s.game_id = vg.id;

  select coalesce(jsonb_agg(jsonb_build_object('player_id', n.player_id, 'text', n.text, 'kind', n.kind)), '[]'::jsonb)
    into v_notices
  from public.take_creator_notices() n;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.invited_at), '[]'::jsonb)
    into v_claims
  from public.list_claim_requests() c;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.invited_at), '[]'::jsonb)
    into v_link_requests
  from public.list_link_requests_for_me() r;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
    into v_roster
  from public.list_my_players() m;

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'games', v_games,
    'notices', v_notices,
    'claim_requests', v_claims,
    'link_requests', v_link_requests,
    'my_players', v_roster,
    'hidden_count', (select count(*) from public.hidden_games h join public.games g on g.id = h.game_id where h.owner_id = auth.uid() and g.deleted_at is null)
  );
end;
$$;

-- ---------- grants ----------
revoke all on function public.link_request_days() from public;
grant execute on function public.link_request_days() to anon, authenticated;
revoke all on function public.link_target_for(bigint) from public, anon, authenticated;
revoke all on function public.link_seat_for(uuid) from public, anon, authenticated;
revoke all on function public.link_conflicts(uuid, uuid) from public, anon, authenticated;
revoke all on function public.link_conflict_message(uuid, uuid) from public, anon, authenticated;
revoke all on function public.perform_player_link(uuid) from public, anon, authenticated;
revoke all on function public.decline_player_link(uuid) from public, anon, authenticated;
revoke all on function public.expire_link_requests() from public, anon, authenticated;
revoke all on function public.link_player_check(uuid, bigint) from public, anon;
grant execute on function public.link_player_check(uuid, bigint) to authenticated;
revoke all on function public.request_player_link(uuid, bigint) from public, anon;
grant execute on function public.request_player_link(uuid, bigint) to authenticated;
revoke all on function public.cancel_player_link_request(uuid) from public, anon;
grant execute on function public.cancel_player_link_request(uuid) to authenticated;
revoke all on function public.list_my_link_requests(uuid) from public, anon;
grant execute on function public.list_my_link_requests(uuid) to authenticated;
revoke all on function public.list_link_requests_for_me() from public, anon;
grant execute on function public.list_link_requests_for_me() to authenticated;
revoke all on function public.answer_player_link_request(uuid, boolean) from public, anon;
grant execute on function public.answer_player_link_request(uuid, boolean) to authenticated;
revoke all on function public.peek_link_request(text) from public;
grant execute on function public.peek_link_request(text) to anon, authenticated;
revoke all on function public.answer_link_request_by_token(text, boolean) from public;
grant execute on function public.answer_link_request_by_token(text, boolean) to anon, authenticated;
revoke all on function public.expire_player_requests() from public, anon, authenticated;
revoke all on function public.take_creator_notices() from public, anon;
grant execute on function public.take_creator_notices() to authenticated;
revoke all on function public.get_home_bundle(integer) from public, anon;
grant execute on function public.get_home_bundle(integer) to authenticated;

notify pgrst, 'reload schema';
