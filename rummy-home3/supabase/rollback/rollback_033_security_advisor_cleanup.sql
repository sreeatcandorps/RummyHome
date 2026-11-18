-- Rollback for 033_security_advisor_cleanup.sql: the 024 my_profile view (security_barrier
-- only, read straight from profiles as the view owner), no fixed search_path on the twelve
-- functions, and anon EXECUTE back on the 38 security definer functions 033 revoked it from
-- (the Supabase default-privilege state they had before 033).

create or replace view public.my_profile
with (security_barrier = true) as
  select p.* from public.profiles p where p.id = auth.uid();
alter view public.my_profile reset (security_invoker);

revoke all on public.my_profile from public, anon;
grant select on public.my_profile to authenticated, service_role;

drop function if exists public.my_profile_rows();

alter function public.initials_words(text) reset search_path;
alter function public.initials_push(text[], text) reset search_path;
alter function public.initials_candidates(text) reset search_path;
alter function public.player_label(public.profiles) reset search_path;
alter function public.site_base_url() reset search_path;
alter function public.link_request_days() reset search_path;
alter function public.lock_profile_email() reset search_path;
alter function public.lock_public_player_no() reset search_path;
alter function public.touch_updated_at() reset search_path;

do $$
begin
  if to_regprocedure('public.game_label_text(text, integer)') is not null then
    alter function public.game_label_text(text, integer) reset search_path;
  end if;
  if to_regprocedure('public.game_label_prefix(public.game_type)') is not null then
    alter function public.game_label_prefix(public.game_type) reset search_path;
  end if;
  if to_regprocedure('public.lock_game_label()') is not null then
    alter function public.lock_game_label() reset search_path;
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'add_my_player(uuid)',
    'add_prize_entry(uuid, jsonb, text)',
    'answer_claim_link(text, boolean)',
    'answer_claim_request(uuid, boolean)',
    'assign_game_number()',
    'create_claim_link(uuid, integer[])',
    'create_prize_session(uuid[])',
    'create_unregistered_player(text, text)',
    'delete_unregistered_player(uuid)',
    'game_coin_shares(uuid)',
    'generate_player_code()',
    'get_prize_session(uuid)',
    'guard_game_players()',
    'guard_games()',
    'guard_my_players()',
    'guard_player_links()',
    'guard_rounds()',
    'handle_new_user()',
    'list_claim_requests()',
    'list_my_player_links()',
    'list_my_unregistered_players(uuid)',
    'list_prize_sessions()',
    'lock_profile_role()',
    'my_players_restore_initials()',
    'my_verified_email()',
    'peek_claim_link(text)',
    'player_links_fill_labels()',
    'recompute_session_status(uuid)',
    'remove_my_player(uuid)',
    'request_claim_by_player_no(bigint)',
    'require_my_unregistered(uuid)',
    'revoke_claim_link(uuid)',
    'search_players(text)',
    'session_visible(uuid)',
    'touch_my_players(uuid[])',
    'unlink_player(uuid)',
    'update_prize_entry(uuid, jsonb, text)',
    'update_unregistered_player(uuid, text, text)'
  ]
  loop
    if to_regprocedure('public.' || f) is not null then
      execute format('grant execute on function public.%s to anon', f);
    end if;
  end loop;
  -- these eleven also carried Postgres's built-in PUBLIC execute before 033
  foreach f in array array[
    'assign_game_number()', 'generate_player_code()', 'guard_game_players()', 'guard_games()',
    'guard_my_players()', 'guard_player_links()', 'guard_rounds()', 'handle_new_user()',
    'lock_profile_role()', 'my_players_restore_initials()', 'player_links_fill_labels()'
  ]
  loop
    if to_regprocedure('public.' || f) is not null then
      execute format('grant execute on function public.%s to public', f);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
