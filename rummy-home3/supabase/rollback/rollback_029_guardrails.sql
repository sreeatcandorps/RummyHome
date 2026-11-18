-- Rollback 029 Guardrails: drops the limit triggers, their functions, the guardrails table and
-- the outbox backoff column; puts the 024 unsent index back. The outbox rows themselves stay.
-- After this the send-email function that reads next_attempt_at must be rolled back too
-- (the 028-era function works without the column only through its fallback query).

drop trigger if exists my_players_0_guard on public.my_players;
drop trigger if exists game_players_0_guard on public.game_players;
drop trigger if exists rounds_0_guard on public.rounds;
drop trigger if exists games_0_guard on public.games;
drop trigger if exists player_links_0_guard on public.player_links;

drop function if exists public.guard_my_players();
drop function if exists public.guard_game_players();
drop function if exists public.guard_rounds();
drop function if exists public.guard_games();
drop function if exists public.guard_player_links();

drop function if exists public.email_outbox_backlog();
drop function if exists public.email_sends_left_today();
drop function if exists public.guardrail_refuse(text);
drop function if exists public.guardrail_message(text);
drop function if exists public.guardrail(text);

drop index if exists public.email_outbox_sent_idx;
drop index if exists public.email_outbox_unsent_idx;
alter table public.email_outbox drop column if exists next_attempt_at;
create index if not exists email_outbox_unsent_idx on public.email_outbox (created_at) where sent_at is null;

drop table if exists public.guardrails;
