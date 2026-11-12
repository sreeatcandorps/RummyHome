-- 029 Guardrails: server-enforced limits with friendly messages.
--
-- Every limit lives in one table (public.guardrails) so it can be tuned later with a one-line
-- update and no new build. The limits are enforced by BEFORE triggers on the tables themselves,
-- so every path (the app's inserts under RLS, the RPCs, a script with a user's token) meets the
-- same check; the UI only repeats the message. Each refusal raises SQLSTATE 'GRD01' with the
-- message from the table, so the app can tell a guardrail from any other error. Each trigger
-- takes a transaction advisory lock on the counted scope (owner, game, creator) so two inserts
-- at once count one after the other and the cap holds exactly.
--
-- Limits (key → value, message):
--   my_players_max           2000  My players is full (2,000). Remove someone first.
--   players_added_per_day     100  You added 100 players today. Try again tomorrow.
--   players_per_game           20  A game holds at most 20 players.
--   rounds_per_game           500  This game has 500 rounds, the most a game can hold. Start a new game.
--   live_games_per_user        10  You have 10 live games. Finish or close one first.
--   games_per_day              50  You created 50 games today. Try again tomorrow.
--   link_requests_pending      20  You have 20 link requests waiting. Wait for an answer or cancel one first.
--   email_per_day              90  (send-email flush) rows past this wait for tomorrow; nothing is dropped
--   email_per_flush            50  (send-email flush) rows per run
--
-- "Per day" is a rolling 24 hours, counted on created_at, so no timezone is involved.
-- The email outbox gets next_attempt_at so failed sends back off and the daily cap is honoured
-- without ever deleting a row (the 024 flush gave up after 5 attempts; it no longer does).
--
-- Safe to re-run: tuned values are kept (insert ... on conflict updates only the texts).
-- Backward compatible with the APK on phones: no function changes its signature; the old app
-- sees the refusal as an error message where it would have shown any other error.

-- ---------- A. the table ----------
create table if not exists public.guardrails (
  key text primary key,
  value integer not null check (value > 0),
  message text not null,
  description text not null,
  updated_at timestamptz not null default now()
);
alter table public.guardrails enable row level security;
drop policy if exists guardrails_read on public.guardrails;
create policy guardrails_read on public.guardrails for select to authenticated using (true);
revoke all on public.guardrails from public, anon, authenticated;
grant select on public.guardrails to authenticated;

comment on table public.guardrails is
  'One row per limit. value is the cap; message is what the app shows when the cap is hit. Tune with update … set value = …; the triggers read it on every check.';

insert into public.guardrails (key, value, message, description) values
  ('my_players_max', 2000, 'My players is full (2,000). Remove someone first.',
   'Active (not removed) rows in my_players per owner.'),
  ('players_added_per_day', 100, 'You added 100 players today. Try again tomorrow.',
   'New my_players rows per owner in the last 24 hours (by Player ID, by name, or by playing together). Restoring a removed player does not count.'),
  ('players_per_game', 20, 'A game holds at most 20 players.',
   'Active seated non-spectator rows in game_players per game.'),
  ('rounds_per_game', 500, 'This game has 500 rounds, the most a game can hold. Start a new game.',
   'Rounds per game that are not undone.'),
  ('live_games_per_user', 10, 'You have 10 live games. Finish or close one first.',
   'Games per creator that are active, not deleted and not closed.'),
  ('games_per_day', 50, 'You created 50 games today. Try again tomorrow.',
   'Games per creator in the last 24 hours, deleted ones included.'),
  ('link_requests_pending', 20, 'You have 20 link requests waiting. Wait for an answer or cancel one first.',
   'Pending player_links rows per owner (link requests and invites).'),
  ('email_per_day', 90, 'Email is queued and goes out tomorrow.',
   'Outbox rows the send-email flush sends per rolling 24 hours (Resend free tier allows 100). Rows past the cap wait; none is dropped.'),
  ('email_per_flush', 50, 'Email is queued.',
   'Outbox rows one send-email flush run delivers.')
on conflict (key) do update set message = excluded.message, description = excluded.description;

-- ---------- B. readers ----------
create or replace function public.guardrail(p_key text)
returns integer
language sql
stable
security definer
set search_path = public
as $$ select value from public.guardrails where key = p_key $$;

create or replace function public.guardrail_message(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$ select message from public.guardrails where key = p_key $$;

revoke all on function public.guardrail(text) from public, anon;
revoke all on function public.guardrail_message(text) from public, anon;
grant execute on function public.guardrail(text) to authenticated;
grant execute on function public.guardrail_message(text) to authenticated;

-- Raises the limit's message with SQLSTATE GRD01. A missing key is a configuration bug and raises too.
create or replace function public.guardrail_refuse(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
begin
  select message into v_message from public.guardrails where key = p_key;
  if v_message is null then
    raise exception 'Guardrail % is not configured.', p_key using errcode = 'GRD01';
  end if;
  raise exception '%', v_message using errcode = 'GRD01', hint = 'guardrail:' || p_key;
end;
$$;
revoke all on function public.guardrail_refuse(text) from public, anon, authenticated;

-- ---------- C. My players: size and additions per day ----------
create or replace function public.guard_my_players()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active integer;
  v_today integer;
  v_becomes_active boolean := new.removed_at is null and (tg_op = 'INSERT' or old.removed_at is not null);
begin
  if not v_becomes_active then return new; end if;
  -- Two adds at once for the same owner count one after the other, so the cap holds exactly.
  perform pg_advisory_xact_lock(hashtextextended('guard:my_players:' || new.owner_id::text, 0));

  select count(*) into v_active from public.my_players m
   where m.owner_id = new.owner_id and m.removed_at is null and m.player_id <> new.player_id;
  if v_active >= public.guardrail('my_players_max') then perform public.guardrail_refuse('my_players_max'); end if;

  if tg_op = 'INSERT' then
    select count(*) into v_today from public.my_players m
     where m.owner_id = new.owner_id and m.created_at > now() - interval '24 hours';
    if v_today >= public.guardrail('players_added_per_day') then perform public.guardrail_refuse('players_added_per_day'); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists my_players_0_guard on public.my_players;
create trigger my_players_0_guard
before insert or update of removed_at on public.my_players
for each row execute function public.guard_my_players();

-- ---------- D. players per game ----------
create or replace function public.guard_game_players()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seats integer;
  v_counts boolean := new.is_active and new.role <> 'spectator' and coalesce(new.seated, true);
  v_counted_before boolean := tg_op = 'UPDATE' and old.is_active and old.role <> 'spectator' and coalesce(old.seated, true);
begin
  if not v_counts or v_counted_before then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('guard:game_players:' || new.game_id::text, 0));
  select count(*) into v_seats from public.game_players gp
   where gp.game_id = new.game_id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)
     and gp.profile_id <> new.profile_id;
  if v_seats >= public.guardrail('players_per_game') then perform public.guardrail_refuse('players_per_game'); end if;
  return new;
end;
$$;
drop trigger if exists game_players_0_guard on public.game_players;
create trigger game_players_0_guard
before insert or update of is_active, role, seated on public.game_players
for each row execute function public.guard_game_players();

-- ---------- E. rounds per game ----------
create or replace function public.guard_rounds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rounds integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('guard:rounds:' || new.game_id::text, 0));
  select count(*) into v_rounds from public.rounds r where r.game_id = new.game_id and r.undone_at is null;
  if v_rounds >= public.guardrail('rounds_per_game') then perform public.guardrail_refuse('rounds_per_game'); end if;
  return new;
end;
$$;
drop trigger if exists rounds_0_guard on public.rounds;
create trigger rounds_0_guard
before insert on public.rounds
for each row execute function public.guard_rounds();

-- ---------- F. games: live at once and created per day ----------
-- Named to fire before games_assign_number (alphabetical), so a refused game never takes the label lock.
create or replace function public.guard_games()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live integer;
  v_today integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('guard:games:' || new.created_by::text, 0));
  select count(*) into v_live from public.games g
   where g.created_by = new.created_by and g.status = 'active' and g.deleted_at is null and g.closed_at is null;
  if v_live >= public.guardrail('live_games_per_user') then perform public.guardrail_refuse('live_games_per_user'); end if;

  select count(*) into v_today from public.games g
   where g.created_by = new.created_by and g.created_at > now() - interval '24 hours';
  if v_today >= public.guardrail('games_per_day') then perform public.guardrail_refuse('games_per_day'); end if;
  return new;
end;
$$;
drop trigger if exists games_0_guard on public.games;
create trigger games_0_guard
before insert on public.games
for each row execute function public.guard_games();

-- ---------- G. pending link requests per owner ----------
create or replace function public.guard_player_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending integer;
begin
  if new.status <> 'pending' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('guard:player_links:' || new.owner_id::text, 0));
  select count(*) into v_pending from public.player_links l
   where l.owner_id = new.owner_id and l.status = 'pending' and l.id <> new.id;
  if v_pending >= public.guardrail('link_requests_pending') then perform public.guardrail_refuse('link_requests_pending'); end if;
  return new;
end;
$$;
drop trigger if exists player_links_0_guard on public.player_links;
create trigger player_links_0_guard
before insert on public.player_links
for each row execute function public.guard_player_links();

-- ---------- H. email outbox: back off, never drop ----------
alter table public.email_outbox add column if not exists next_attempt_at timestamptz not null default now();
drop index if exists public.email_outbox_unsent_idx;
create index if not exists email_outbox_unsent_idx on public.email_outbox (next_attempt_at, created_at) where sent_at is null;
create index if not exists email_outbox_sent_idx on public.email_outbox (sent_at) where sent_at is not null;

comment on column public.email_outbox.next_attempt_at is
  'The flush skips the row until this time. Set by the flush after a failed send (backoff) or when the daily cap is reached (tomorrow). Rows are never deleted for failing.';

-- How many rows the flush may still send in the rolling day, for the function and for tests.
create or replace function public.email_sends_left_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, public.guardrail('email_per_day')
                   - (select count(*) from public.email_outbox where sent_at > now() - interval '24 hours'))::integer
$$;
revoke all on function public.email_sends_left_today() from public, anon, authenticated;

-- A read-only view of the backlog for the dashboard (service role only).
create or replace function public.email_outbox_backlog()
returns table (waiting bigint, due bigint, failing bigint, oldest timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select count(*) filter (where sent_at is null),
         count(*) filter (where sent_at is null and next_attempt_at <= now()),
         count(*) filter (where sent_at is null and attempts >= 3),
         min(created_at) filter (where sent_at is null)
    from public.email_outbox
$$;
revoke all on function public.email_outbox_backlog() from public, anon, authenticated;
