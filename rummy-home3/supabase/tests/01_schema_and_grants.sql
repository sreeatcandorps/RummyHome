-- Migrations 001–019 applied from empty: the objects each one promises exist,
-- RLS is on, and anon cannot call anything that writes or reads private data.
begin;
select plan(44);

-- tables
select has_table('public', 'profiles', 'profiles (001)');
select has_table('public', 'games', 'games (001)');
select has_table('public', 'game_players', 'game_players (001)');
select has_table('public', 'rounds', 'rounds (001)');
select has_table('public', 'scores', 'scores (001)');
select has_table('public', 'my_players', 'my_players (007)');
select has_table('public', 'game_results', 'game_results (008)');
select has_table('public', 'game_result_games', 'game_result_games (008)');
select has_table('public', 'player_links', 'player_links (011)');

-- columns added along the way
select has_column('public', 'games', 'view_token', 'games.view_token (006)');
select has_column('public', 'game_players', 'seated', 'game_players.seated (007)');
select has_column('public', 'games', 'game_number', 'games.game_number (009)');
select has_column('public', 'games', 'closed_at', 'games.closed_at (009)');
select has_column('public', 'profiles', 'player_status', 'profiles.player_status (011)');
select has_column('public', 'profiles', 'managed_by', 'profiles.managed_by (011)');
select has_column('public', 'profiles', 'public_player_no', 'profiles.public_player_no (012)');

-- functions
select has_function('public', 'list_visible_game_ids', 'list_visible_game_ids (006)');
select has_function('public', 'public_scorecard', array['text'], 'public_scorecard (006)');
select has_function('public', 'can_see_game_result', array['uuid'], 'can_see_game_result (013)');
select has_function('public', 'save_round', array['uuid', 'integer', 'jsonb', 'boolean'], 'save_round (014)');
select has_function('public', 'link_seat_to_player', array['uuid', 'uuid', 'uuid'], 'link_seat_to_player (015/017)');
select has_function('public', 'remove_seat_if_no_scores', array['uuid', 'uuid'], 'remove_seat_if_no_scores (016)');

-- 017 replaced the 015 body: the takeover branch is present
select matches(
  (select prosrc from pg_proc where proname = 'link_seat_to_player' and pronamespace = 'public'::regnamespace),
  'already playing in this game',
  'link_seat_to_player carries the 017 body (seated target refused, admin/viewer takes the seat)'
);

-- RLS on
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS on profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.games'::regclass), 'RLS on games');
select ok((select relrowsecurity from pg_class where oid = 'public.game_results'::regclass), 'RLS on game_results');

-- 019: role lock trigger, per-game lock in both writers, my_profile view, contact columns private
select has_function('public', 'lock_profile_role', 'lock_profile_role (019)');
select has_trigger('public', 'profiles', 'profiles_lock_role', 'profiles_lock_role trigger (019)');
select has_view('public', 'my_profile', 'my_profile view (019)');
select matches(
  (select prosrc from pg_proc where proname = 'save_round' and pronamespace = 'public'::regnamespace),
  'pg_advisory_xact_lock', 'save_round carries the 019 body (per-game advisory lock)');
select matches(
  (select prosrc from pg_proc where proname = 'remove_seat_if_no_scores' and pronamespace = 'public'::regnamespace),
  'pg_advisory_xact_lock', 'remove_seat_if_no_scores carries the 019 body (same per-game lock)');
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon has no select on profiles');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'email', 'select'), 'authenticated cannot select profiles.email');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'phone', 'select'), 'authenticated cannot select profiles.phone');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'zip_code', 'select'), 'authenticated cannot select profiles.zip_code');
select ok(has_column_privilege('authenticated', 'public.profiles', 'display_name', 'select'), 'authenticated can select profiles.display_name');
select ok(has_column_privilege('authenticated', 'public.profiles', 'public_player_no', 'select'), 'authenticated can select profiles.public_player_no');
select ok(has_table_privilege('authenticated', 'public.my_profile', 'select'), 'authenticated can read my_profile');
select ok(not has_table_privilege('anon', 'public.my_profile', 'select'), 'anon cannot read my_profile');

-- anon cannot execute the sensitive RPCs; authenticated can
select ok(not has_function_privilege('anon', 'public.save_round(uuid,integer,jsonb,boolean)', 'execute'), 'anon cannot save_round');
select ok(not has_function_privilege('anon', 'public.remove_seat_if_no_scores(uuid,uuid)', 'execute'), 'anon cannot remove_seat_if_no_scores');
select ok(not has_function_privilege('anon', 'public.link_seat_to_player(uuid,uuid,uuid)', 'execute'), 'anon cannot link_seat_to_player');
select ok(not has_function_privilege('anon', 'public.get_game_result(uuid)', 'execute'), 'anon cannot get_game_result');
select ok(has_function_privilege('anon', 'public.public_scorecard(text)', 'execute'), 'anon CAN read the public scorecard by token');

select * from finish();
rollback;
