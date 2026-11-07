-- ROLLBACK for 014_save_round_atomic.sql.
-- Dropping the function is the whole rollback: the app detects the missing RPC (PGRST202)
-- and falls back to its self-healing multi-request save. Rounds already written through
-- save_round are ordinary rounds/scores rows and stay valid. No table or row changes.
drop function if exists public.save_round(uuid, integer, jsonb, boolean);
