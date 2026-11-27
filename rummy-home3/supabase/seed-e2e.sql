-- Extra fixtures for the device UI flows (rummy-home3/e2e). Applied by the CI "ui-smoke" and
-- "ui-full" jobs on the throw-away local Supabase AFTER `supabase db reset` (migrations + seed.sql).
-- Never run this on the hosted project. Kept out of seed.sql so the pgTAP counts there stay as they are.
--
-- Every flow gets its own game so flows never share state:
--   E  10000000-0000-4000-8000-00000000000e  GAMEE1  active, sree creator and seated, 4 players, round 1 saved
--                                                     -> full/30, full/60, smoke/13-undo-then-add-round
--   F  10000000-0000-4000-8000-00000000000f  GAMEF1  active, 20 players x 30 rounds, sree creator and seated
--                                                     -> smoke/10 and 11 scorecard-20-players (header, swipe, rotate)
--   G  10000000-0000-4000-8000-000000000010  GAMEG1  completed, 6 seated, no rounds, sree creator
--                                                     -> known-bugs/pr8-results-zero-players
--   H  10000000-0000-4000-8000-000000000011  GAMEH1  active, sree creator and seated, 3 players, no rounds
--                                                     -> known-bugs/pr3-rummy-positive-pot
--   W  10000000-0000-4000-8000-000000000012  GAMEW1  pool 101, completed, awards pending, 20 players x 3 rounds,
--                                                     every placeholder's initials three WIDE letters (WWW, MMM, WMW …)
--                                                     -> smoke/17-pool-wide-initials-20p (F13.22: nothing is clipped)
--   V  10000000-0000-4000-8000-000000000013  GAMEV1  pool 101, active, 13 players x 6 rounds, sree creator and seated;
--                                                     Test Alpha out in round 2 and back for round 3 at the highest (20,
--                                                     rule "Highest score" at the time), Test Bravo out in round 4 and back
--                                                     for round 5 at the highest + 1 (41, rule "Highest score + 1")
--                                                     -> smoke/20-pool-13p-reentry (PR 24: layout, grey-above rule, ↺ score)
--   U  10000000-0000-4000-8000-000000000014  GAMEU1  pool 101, active, 12 seats x 3 rounds, sree creator and seated; Test Golf..Test
--                                                     Kilo out in round 1, Test Alpha..Test Charlie at 80 (the next round of drops
--                                                     puts them out), round 4 dealt by Test Charlie; the oldest live game (last on Home)
--                                                     -> smoke/16b-pool-round-saved-12p (D139: Round saved sheet, two re-entries)
-- Placeholders Test Alpha..Test Uniform (E2EP01..E2EP19) are unregistered players managed by sree, in his My players.

-- ---------------------------------------------------------------------------
-- Make the seeded accounts usable through GoTrue (the app signs in for real on the emulator; the DB
-- suite only impersonates). seed.sql leaves the token columns NULL, which GoTrue scans into Go
-- strings and answers with "Database error querying schema". Identities are what the dashboard
-- "create user" would have added.
-- ---------------------------------------------------------------------------
update auth.users
   set confirmation_token = coalesce(confirmation_token, ''),
       recovery_token = coalesce(recovery_token, ''),
       email_change = coalesce(email_change, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change_token_current = coalesce(email_change_token_current, ''),
       phone_change = coalesce(phone_change, ''),
       phone_change_token = coalesce(phone_change_token, ''),
       reauthentication_token = coalesce(reauthentication_token, ''),
       is_sso_user = coalesce(is_sso_user, false),
       is_anonymous = coalesce(is_anonymous, false)
 where email like '%@test.local';

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       now(), u.created_at, now()
  from auth.users u
 where u.email like '%@test.local'
   and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

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
    values (v_game, v_players[v_i], v_i - 1, case when v_i = 1 then 'game_admin' else 'player' end::public.game_member_role, true);
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

-- ---------------------------------------------------------------------------
-- Game W: the F13.22 check. A 20-seat pool whose 19 placeholders carry the widest three-letter
-- initials there are (W and M, then O / Q / G / D), completed and waiting for awards, so one flow
-- can look at the header columns, the Standings card and the Awards screen with every label in full.
-- ---------------------------------------------------------------------------
do $$
declare
  v_game uuid := '10000000-0000-4000-8000-000000000012';
  v_sree uuid := '00000000-0000-4000-8000-000000000001';
  v_players uuid[] := array[v_sree];
  v_pid uuid;
  v_round uuid;
  v_n integer;
  v_i integer;
  v_labels text[] := array['WWW','MMM','WMW','MWM','WWM','MMW','MWW','WMM','WOW','MOM',
                           'WQW','MQM','OWO','OMO','QWQ','QMQ','GWG','GMG','DWD'];
begin
  for v_i in 1..19 loop
    v_pid := ('00000000-0000-4000-8000-000000000' || lpad(to_hex(2304 + v_i), 3, '0'))::uuid;
    insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
    values (v_pid, 'Wide ' || v_labels[v_i], 'Wide', v_labels[v_i], 'unregistered', v_sree, 'E2EW' || lpad(v_i::text, 2, '0'));
    insert into public.my_players (owner_id, player_id, games_together, initials) values (v_sree, v_pid, 1, v_labels[v_i]);
    v_players := v_players || v_pid;
  end loop;

  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, completed_at, current_round)
  values (v_game, v_sree, 'completed', 'pool',
          '{"gameType":"pool","expenseEnabled":false,"stakeDrop":25,"stakeMiddleDrop":50,"dropAmount":25,"mdAmount":50,"maxCount":130,"poolLimit":101,"reentry":true}',
          'GAMEW1', now() - interval '3 hours', now() - interval '2 hours', 4);

  for v_i in 1..20 loop
    insert into public.game_players (game_id, profile_id, player_order, role, seated)
    values (v_game, v_players[v_i], v_i - 1, case when v_i = 1 then 'game_admin' else 'player' end::public.game_member_role, true);
  end loop;

  -- Three rounds: the winner (seat n) scores 0, everyone else 20; nobody reaches 101.
  for v_n in 1..3 loop
    insert into public.rounds (game_id, round_number, dealer_profile_id, created_by)
    values (v_game, v_n, v_players[v_n], v_sree)
    returning id into v_round;
    for v_i in 1..20 loop
      insert into public.scores (round_id, game_id, profile_id, score_type, value)
      values (v_round, v_game, v_players[v_i],
              case when v_i = v_n then 'rummy'::public.score_type else 'count'::public.score_type end,
              case when v_i = v_n then 0 else 20 end);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Game V (PR 24): a live 13-seat pool with two re-entries. Sree plus Test Alpha..Test Lima (game F's
-- placeholders). Rounds: everyone 10 except the winner (seat n) at 0. Test Alpha takes a full count
-- (130) in round 2 and is out at 140; the highest total still in is 20, so he comes back for round 3 at
-- 20 (the "Highest score" rule, before the game switched to + 1). Test Bravo takes 130 in round 4 (out
-- at 150); the highest still in is 40, so she comes back for round 5 at 41 ("Highest score + 1", the
-- game's setting now). The round-5 "typed" scores for Alpha and Bravo are ordinary counts.
-- ---------------------------------------------------------------------------
do $$
declare
  v_game uuid := '10000000-0000-4000-8000-000000000013';
  v_sree uuid := '00000000-0000-4000-8000-000000000001';
  v_players uuid[] := array[v_sree];
  v_round uuid;
  v_n integer;
  v_i integer;
  v_value integer;
begin
  for v_i in 1..12 loop
    v_players := v_players || ('00000000-0000-4000-8000-0000000000' || lpad(to_hex(224 + v_i), 2, '0'))::uuid;
  end loop;

  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, current_round)
  values (v_game, v_sree, 'active', 'pool',
          '{"gameType":"pool","expenseEnabled":false,"stakeDrop":25,"stakeMiddleDrop":50,"dropAmount":25,"mdAmount":50,"maxCount":130,"poolLimit":101,"reentry":true,"reentryPlus":1,"lateEntryPlus":1,"seatingPrompted":true}',
          'GAMEV1', now() - interval '90 minutes', 7);

  for v_i in 1..13 loop
    insert into public.game_players (game_id, profile_id, player_order, role, seated)
    values (v_game, v_players[v_i], v_i - 1, case when v_i = 1 then 'game_admin' else 'player' end::public.game_member_role, true);
  end loop;

  for v_n in 1..6 loop
    insert into public.rounds (game_id, round_number, dealer_profile_id, created_by)
    values (v_game, v_n, v_players[v_n], v_sree)
    returning id into v_round;
    for v_i in 1..13 loop
      -- Out players score nothing in the rounds they sit out: Alpha (seat 2) is in every round
      -- (out at the end of 2, back for 3); Bravo (seat 3) likewise (out at the end of 4, back for 5).
      v_value := case
        when v_i = v_n then 0
        when v_i = 2 and v_n = 2 then 130
        when v_i = 3 and v_n = 4 then 130
        else 10 end;
      insert into public.scores (round_id, game_id, profile_id, score_type, value)
      values (v_round, v_game, v_players[v_i],
              case when v_i = v_n then 'rummy'::public.score_type else 'count'::public.score_type end,
              v_value);
    end loop;
  end loop;

  -- Alpha: out in round 2, re-entered for round 3 at the highest (20). Bravo: out in round 4, back for round 5 at 40 + 1.
  update public.game_players set out_round = null, reentered_round = 3, reentry_score = 20, entries = 2
   where game_id = v_game and profile_id = v_players[2];
  update public.game_players set out_round = null, reentered_round = 5, reentry_score = 41, entries = 2
   where game_id = v_game and profile_id = v_players[3];
end $$;

-- ---------------------------------------------------------------------------
-- Game U (D139, design-review-2 §10.6): a live 12-seat pool for the Round saved sheet. Sree plus Test Alpha..
-- Test Kilo (seats 2-12). Sree wins every round (Rummy 0). Round 1: Golf..Kilo (seats 8-12) take 130 and are
-- out; Alpha, Bravo, Charlie 30; Delta, Echo, Foxtrot 5. Rounds 2 and 3: Alpha..Charlie 30 then 20, Delta..
-- Foxtrot 5. After 3 rounds Alpha..Charlie are at 80 and Delta..Foxtrot at 15, so a round of drops (25) puts
-- three out at 105 with 40 the highest still in (re-entry at 41). Dealers Sree, Alpha, Bravo; Charlie deals
-- round 4, Delta round 5. Started three days ago, older than game A, so it is the last Live card on Home and
-- every card the other flows open from Home stays where it was.
-- ---------------------------------------------------------------------------
do $$
declare
  v_game uuid := '10000000-0000-4000-8000-000000000014';
  v_sree uuid := '00000000-0000-4000-8000-000000000001';
  v_players uuid[] := array[v_sree];
  v_round uuid;
  v_n integer;
  v_i integer;
begin
  for v_i in 1..11 loop
    v_players := v_players || ('00000000-0000-4000-8000-0000000000' || lpad(to_hex(224 + v_i), 2, '0'))::uuid;
  end loop;

  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, current_round)
  values (v_game, v_sree, 'active', 'pool',
          '{"gameType":"pool","expenseEnabled":false,"stakeDrop":25,"stakeMiddleDrop":50,"dropAmount":25,"mdAmount":50,"maxCount":130,"poolLimit":101,"reentry":true,"reentryPlus":1,"lateEntryPlus":1,"seatingPrompted":true}',
          'GAMEU1', now() - interval '3 days', 4);

  for v_i in 1..12 loop
    insert into public.game_players (game_id, profile_id, player_order, role, seated)
    values (v_game, v_players[v_i], v_i - 1, case when v_i = 1 then 'game_admin' else 'player' end::public.game_member_role, true);
  end loop;

  for v_n in 1..3 loop
    insert into public.rounds (game_id, round_number, dealer_profile_id, created_by)
    values (v_game, v_n, v_players[v_n], v_sree)
    returning id into v_round;
    for v_i in 1..12 loop
      -- Seats 8-12 are out after round 1 and score nothing after it.
      continue when v_i >= 8 and v_n > 1;
      insert into public.scores (round_id, game_id, profile_id, score_type, value)
      values (v_round, v_game, v_players[v_i],
              case when v_i = 1 then 'rummy'::public.score_type else 'count'::public.score_type end,
              case
                when v_i = 1 then 0
                when v_i >= 8 then 130
                when v_i <= 4 then case when v_n = 3 then 20 else 30 end
                else 5 end);
    end loop;
  end loop;

  perform public.pool_recompute(v_game);
end $$;
