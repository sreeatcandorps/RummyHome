-- 016 remove_seat_if_no_scores: a game admin removes a seat only when every one of its
-- live round scores is exactly 0 (or it has none). Zero rows are deleted with the seat.
-- Game A: zero has 0 in rounds 1 and 2 (and a -50 in an UNDONE round that must not count);
--         priya has -20 / -40; rk has +30 / 0. Game C is closed.
begin;
select plan(17);

-- anon has no execute at all (grant check); a stranger is refused by the body
select tests.login('00000000-0000-4000-8000-000000000005');
select throws_ok(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000008') $$,
  '42501', 'Only a game admin can remove players.', 'outsider cannot remove a seat');

-- seated player (not admin) refused
select tests.login('00000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000008') $$,
  '42501', 'Only a game admin can remove players.', 'seated player cannot remove a seat');

-- admin: a seat with a non-zero score is blocked with the exact message
select tests.login('00000000-0000-4000-8000-000000000001');
select throws_like(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000003') $$,
  'You cannot delete this player.%', 'priya (-20/-40) is blocked');
select throws_like(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1') $$,
  'You cannot delete this player.%', 'rk (+30 then 0) is blocked: the rule is per round, not the total');

-- someone who is not in the game
select throws_ok(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000005') $$,
  'That player is not in this game.', 'a profile that is not seated cannot be removed');

-- the all-zero seat goes, with its zero rows; the undone -50 is ignored
select results_eq(
  $$ select removed, zero_scores_deleted from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000008') $$,
  $$ values (true, 3) $$,
  'zero is removed and 3 score rows deleted (2 live zeros + the undone -50)');
select is((select count(*) from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000008')::int, 0, 'zero''s seat row is gone');
select is((select count(*) from public.scores where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000008')::int, 0, 'zero''s score rows are gone');
select is((select count(*) from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a' and undone_at is null)::int, 2, 'the live rounds themselves are untouched');
select is((select count(*) from public.scores s join public.rounds r on r.id = s.round_id where r.game_id = '10000000-0000-4000-8000-00000000000a' and r.undone_at is null)::int, 6, 'the other players'' scores stay (8 live rows - 2 zeros)');

-- removing twice: second call says not in game
select throws_ok(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000008') $$,
  'That player is not in this game.', 'removing the same seat again is refused');

-- a seat with no score rows at all can go (the viewer has none, but is a spectator → allowed)
select results_eq(
  $$ select removed, zero_scores_deleted from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000004') $$,
  $$ values (true, 0) $$,
  'a spectator seat with no rows is removed');

-- unseated co-admin may also remove (is_game_admin)
select tests.login('00000000-0000-4000-8000-000000000006');
select lives_ok(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000006') $$,
  'the unseated co-admin can remove their own admin row (not a seated player, so no two-player guard)');

-- closed game: refused even for the creator
select tests.login('00000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-000000000008') $$,
  'This game is closed. Its players cannot change.', 'closed game C refuses removal');

-- two-player guard: fresh game with exactly two seated players and no scores
select tests.logout();
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-000000000001', 'active', 'stake', '{"gameType":"stake"}', 'GAMED1');
insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  ('10000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-000000000002', 0, 'player', true),
  ('10000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-000000000003', 1, 'player', true);
select tests.login('00000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-000000000002') $$,
  'A game needs at least two players. Add someone else before removing this player.', 'cannot drop to one player');
select tests.logout();
insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  ('10000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-000000000008', 2, 'player', true);
select tests.login('00000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-000000000002') $$,
  'with a third player seated, removing one is allowed');
select is((select count(*) from public.game_players where game_id = '10000000-0000-4000-8000-00000000000d' and seated)::int, 2, 'two seated players remain');

select * from finish();
rollback;
