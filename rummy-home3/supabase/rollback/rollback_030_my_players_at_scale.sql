-- Rollback 030 My players at scale: drops the paged list, the search, the count and the two
-- indexes. list_my_players (027) is untouched by 030, so nothing needs restoring; the app falls
-- back to the whole list when these functions are missing.
drop function if exists public.list_my_players_page(text, integer, text, uuid, integer);
drop function if exists public.search_my_players(text, integer);
drop function if exists public.count_my_players();
drop index if exists public.profiles_display_name_lower_idx;
drop index if exists public.my_players_owner_active_idx;
