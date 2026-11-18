-- ROLLBACK for 015_link_seat_to_player.sql.
-- Dropping the function stops any further linking; the app shows "needs a database update".
-- Links already performed are NOT undone by this (the function moved rows for one game at a
-- time at an admin's request). To reverse one specific link by hand, see verify/undo_one_link.sql.
drop function if exists public.link_seat_to_player(uuid, uuid, uuid);
