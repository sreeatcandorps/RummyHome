-- Rollback for 049 (D46 C: reopening a pool clears its awards). Drops the trigger and its function;
-- a reopened pool keeps whatever awards it had again (the 041–048 behaviour). Awards already cleared
-- by 049 stay cleared — the admin gives them again after Complete; the Log line that recorded the
-- clearing stays (event_log is append-only).
drop trigger if exists games_pool_reopen_clears_awards on public.games;
drop function if exists public.games_pool_reopen_clears_awards();

notify pgrst, 'reload schema';
