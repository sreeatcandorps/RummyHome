-- Extra fixtures for the device UI flows (rummy-home3/e2e). Applied by the CI "ui-smoke" and
-- "ui-full" jobs on the throw-away local Supabase AFTER `supabase db reset` (migrations + seed.sql).
-- Never run this on the hosted project. Kept out of seed.sql so the pgTAP counts there stay as they are.
--
-- Every flow gets its own game so flows never share state:
--   E  10000000-0000-4000-8000-00000000000e  GAMEE1  active, sree creator and seated, 4 players, round 1 saved
--                                                     -> full/30, full/60, known-bugs/pr2-undo-then-add-round
--   F  10000000-0000-4000-8000-00000000000f  GAMEF1  active, 20 players x 30 rounds, sree creator and seated
--                                                     -> smoke/10 and 11 scorecard-20-players (header, swipe, rotate)
--   G  10000000-0000-4000-8000-000000000010  GAMEG1  completed, 6 seated, no rounds, sree creator
--                                                     -> known-bugs/pr8-results-zero-players
--   H  10000000-0000-4000-8000-000000000011  GAMEH1  active, sree creator and seated, 3 players, no rounds
--                                                     -> known-bugs/pr3-rummy-positive-pot
-- Placeholders Test Alpha..Test Uniform (E2EP01..E2EP19) are unregistered players managed by sree, in his My players.

-- ---------------------------------------------------------------------------
-- Game E: undo fixture
-- ---------------------------------------------------------------------------
insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
values ('10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000001', 'active', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
        'GAMEE1', now() - interval '3 hours');

insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  ('10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000001', 0, 'game_admin', true), -- sree
  ('10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000002', 1, 'player', true),     -- harish
  ('10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000003', 2, 'player', true),     -- priya
  ('10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000008', 3, 'player', true);     -- zero

insert into public.rounds (id, game_id, round_number, dealer_profile_id, created_by)
values ('30000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-00000000000e', 1,
        '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
insert into public.scores (round_id, game_id, profile_id, score_type, value) values
  ('30000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000001', 'drop', -10),
  ('30000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000002', 'count', -30),
  ('30000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000003', 'rummy', 40),
  ('30000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-000000000008', 'count', 0);
update public.games set current_round = 2 where id = '10000000-0000-4000-8000-00000000000e';

-- ---------------------------------------------------------------------------
-- Game H: empty active game for Add round flows (rummy with a positive pot)
-- ---------------------------------------------------------------------------
insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
values ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'active', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
        'GAMEH1', now() - interval '2 hours');

insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 0, 'game_admin', true), -- sree
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', 1, 'player', true),     -- harish
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000003', 2, 'player', true);     -- priya

-- ---------------------------------------------------------------------------
-- Game G: completed with seats but no rounds (results must still show 6 players)
-- ---------------------------------------------------------------------------
insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, completed_at)
values ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'completed', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
        'GAMEG1', now() - interval '1 day', now() - interval '23 hours');

insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 0, 'game_admin', true), -- sree
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000002', 1, 'player', true),     -- harish
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000003', 2, 'player', true),     -- priya
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000008', 3, 'player', true),     -- zero
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000a1', 4, 'player', true),     -- rk
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000a3', 5, 'player', true);     -- cd

-- ---------------------------------------------------------------------------
-- Game F: 20 players x 30 rounds. Sree plus 19 placeholders he manages.
-- ---------------------------------------------------------------------------
do $$
declare
  v_game uuid := '10000000-0000-4000-8000-00000000000f';
  v_sree uuid := '00000000-0000-4000-8000-000000000001';
  v_players uuid[] := array[v_sree];
  v_pid uuid;
  v_round uuid;
  v_n integer;
  v_i integer;
  v_winner integer;
  -- Distinct last initials so the 20 columns read TA, TB, TC ... on the scorecard.
  v_surnames text[] := array['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet',
                             'Kilo','Lima','Mike','November','Oscar','Papa','Quebec','Romeo','Uniform'];
begin
  for v_i in 1..19 loop
    v_pid := ('00000000-0000-4000-8000-0000000000' || lpad(to_hex(224 + v_i), 2, '0'))::uuid;
    insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
    values (v_pid, 'Test ' || v_surnames[v_i], 'Test', v_surnames[v_i], 'unregistered', v_sree, 'E2EP' || lpad(v_i::text, 2, '0'));
    insert into public.my_players (owner_id, player_id, games_together) values (v_sree, v_pid, 1);
    v_players := v_players || v_pid;
  end loop;

  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
  values (v_game, v_sree, 'active', 'stake',
          '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
          'GAMEF1', now() - interval '5 hours');

  for v_i in 1..20 loop
    insert into public.game_players (game_id, profile_id, player_order, role, seated)
    values (v_game, v_players[v_i], v_i - 1, case when v_i = 1 then 'game_admin' else 'player' end, true);
  end loop;

  -- Round n: everyone -10 except the winner (seat n mod 20), who takes the pot as rummy. Dealer rotates by seat.
  for v_n in 1..30 loop
    v_winner := ((v_n - 1) % 20) + 1;
    insert into public.rounds (game_id, round_number, dealer_profile_id, created_by)
    values (v_game, v_n, v_players[((v_n - 1) % 20) + 1], v_sree)
    returning id into v_round;
    for v_i in 1..20 loop
      insert into public.scores (round_id, game_id, profile_id, score_type, value)
      values (v_round, v_game, v_players[v_i],
              case when v_i = v_winner then 'rummy'::public.score_type else 'count'::public.score_type end,
              case when v_i = v_winner then 190 else -10 end);
    end loop;
  end loop;
  update public.games set current_round = 31 where id = v_game;
end $$;
