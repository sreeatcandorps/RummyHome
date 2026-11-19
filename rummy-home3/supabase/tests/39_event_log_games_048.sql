-- 048 (live 047b_event_log_games_exact_fix): the committed file is the event_log_games body live runs.
-- Checks only the function state — 048 changes nothing a 047 database does not already have.
begin;
select plan(5);

select has_function('public', 'event_log_games', array[]::text[], '048 event_log_games exists');
select is((select prosecdef from pg_proc where proname = 'event_log_games' and pronamespace = 'public'::regnamespace), true, '048 event_log_games is security definer');
select ok((select prosrc like '%Re-entry score%' from pg_proc where proname = 'event_log_games' and pronamespace = 'public'::regnamespace), '048 the Log labels Re-entry score in words (047 D)');
select ok((select prosrc like '%Late entry score%' from pg_proc where proname = 'event_log_games' and pronamespace = 'public'::regnamespace), '048 … and Late entry score');
select ok((select prosrc like '%seatingPrompted%' from pg_proc where proname = 'event_log_games' and pronamespace = 'public'::regnamespace), '048 the 044 seatingPrompted exclusion is still in the body');

select * from finish();
rollback;
