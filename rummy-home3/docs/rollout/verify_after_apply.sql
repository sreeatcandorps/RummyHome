-- READ-ONLY verification after applying 013, 014, 015. Nothing here writes.
-- Run in the Supabase SQL editor (runs as postgres) unless a block says otherwise.

-- 1. The six functions exist, security mode is as intended, search_path is pinned,
--    and only `authenticated` may execute them (anon / public must NOT appear).
select p.proname,
       p.prosecdef                      as security_definer,
       p.proconfig                      as config,
       pg_get_function_identity_arguments(p.oid) as args,
       (select string_agg(r.rolname, ',' order by r.rolname)
          from pg_roles r
         where r.rolname in ('anon','authenticated')
           and has_function_privilege(r.oid, p.oid, 'execute')) as roles_that_can_execute,
       has_function_privilege('public', p.oid, 'execute') as public_can_execute
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('can_see_game_result','get_game_result','list_game_results',
                     'list_game_results_page','save_round','link_seat_to_player')
 order by p.proname;
-- Expected: 6 rows; security_definer = t for all except save_round (f);
-- config = {search_path=public}; roles_that_can_execute = authenticated; public_can_execute = f.

-- 2. Helpers 013–015 depend on (from 003 / 011 / 012). All four must exist.
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname in ('is_app_admin','is_game_member','is_game_admin','declare_game_result')
 order by 1;

-- 3. Columns 014 and 015 write to. Every row below must come back (14 columns).
select table_name, column_name from information_schema.columns
 where table_schema = 'public' and (
   (table_name = 'rounds'       and column_name in ('undone_at','undone_by','undo_reason','dealer_profile_id','created_by'))
   or (table_name = 'game_players' and column_name in ('seated','role','player_order'))
   or (table_name = 'games'     and column_name in ('current_round','game_number','closed_at'))
   or (table_name = 'profiles'  and column_name in ('player_status','managed_by'))
   or (table_name = 'player_links' and column_name in ('status')))
 order by 1, 2;

-- 4. Unregistered players (used by 015) need the profiles -> auth.users FK to be gone (005 did that;
--    011's trigger enforces the rule instead). Expect 0 rows.
select conname from pg_constraint where conname = 'profiles_id_fkey';

-- 5. player_links.status must accept 'revoked' (012). Expect the check text to contain 'revoked'.
select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.player_links'::regclass and contype = 'c';

-- 6. Row counts BEFORE and AFTER applying must be identical: these migrations create functions only.
select 'game_results' t, count(*) from public.game_results
union all select 'game_result_games', count(*) from public.game_result_games
union all select 'rounds', count(*) from public.rounds
union all select 'scores', count(*) from public.scores
union all select 'game_players', count(*) from public.game_players
union all select 'profiles', count(*) from public.profiles;

-- 7. Privacy spot check as a specific user (SQL editor, impersonation off). Replace the uuid with an
--    account that has NO games and declared nothing (a fresh test account). Expect 0 and 0.
--    (Postgres role 'postgres' bypasses nothing here: the functions test auth.uid(), which this sets.)
-- select set_config('request.jwt.claim.sub', '<fresh-account-uuid>', true);
-- select jsonb_array_length(public.list_game_results()), jsonb_array_length(public.list_game_results_page(5,0));
--    Then repeat with a uuid that is seated in a game inside a result: counts must be > 0.

-- 8. Label enrichment: a saved result's games now carry "label" when the game has a number.
-- select r->'sheet'->'games' from public.get_game_result('<a-result-uuid>') r;   -- run with step-7 set_config as a member
