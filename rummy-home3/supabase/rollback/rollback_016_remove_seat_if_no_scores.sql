-- ROLLBACK for 016_remove_seat_if_no_scores.sql.
-- Dropping the function stops any further removals; the app shows "isn't available yet"
-- for players who have rounds and falls back to a plain seat delete for players with none.
-- Removals already performed are NOT undone: each deleted only zero-valued score rows and
-- one game_players row at an admin's request. To put a player back, use Add players on the game.
drop function if exists public.remove_seat_if_no_scores(uuid, uuid);
