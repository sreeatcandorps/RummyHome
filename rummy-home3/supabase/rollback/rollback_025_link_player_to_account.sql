-- Rollback 025: drops the four link functions. Links already made stay linked (the rows moved
-- and the player_links 'link' row remain, so 011 unlink_player still undoes them one by one).
-- Nothing from 012/015/017 was replaced, so there is nothing to restore. Safe to re-run.
drop function if exists public.link_player_to_account(uuid, bigint, text);
drop function if exists public.link_player_check(uuid, bigint, text);
drop function if exists public.link_conflicts(uuid, uuid);
drop function if exists public.link_target_for(bigint, text);
