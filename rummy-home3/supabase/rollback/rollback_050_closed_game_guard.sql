-- Rollback for 050 (Closed game guard). Drops the three triggers and their functions; the server is back
-- to trusting the app on Closed games (save_round / undo / reopen refused only client-side, as before 050).
drop trigger if exists scores_closed_guard on public.scores;
drop trigger if exists rounds_closed_guard on public.rounds;
drop trigger if exists games_closed_guard on public.games;
drop function if exists public.rounds_closed_guard();
drop function if exists public.games_closed_guard();
drop function if exists public.closed_game_message();

notify pgrst, 'reload schema';
