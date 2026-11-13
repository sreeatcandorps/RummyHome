#!/usr/bin/env bash
# Replay every rollback file in rummy-home3/supabase/rollback against a database that
# has every migration (001–034) applied, check the function state after each, then re-apply the forward
# migration and check again. Prints TAP so the report can pick it up.
#
# Env: DB_PSQL  — a psql command with connection args, e.g. "psql postgresql://..." or "sudo -u postgres psql -d ezscore_test"
set -uo pipefail

cd "$(dirname "$0")/../.."
MIG=rummy-home3/supabase/migrations
RB=rummy-home3/supabase/rollback
: "${DB_PSQL:?set DB_PSQL to a psql command}"

n=0
fail=0
tap() { n=$((n+1)); if [ "$1" = ok ]; then echo "ok $n - $2"; else echo "not ok $n - $2"; fail=1; fi; }

q() { $DB_PSQL -v ON_ERROR_STOP=1 -tA -q -c "$1" 2>&1 | tr -d '[:space:]'; }
apply() { $DB_PSQL -v ON_ERROR_STOP=1 -q -f "$1" >/dev/null 2>"$OUTERR"; }
OUTERR=$(mktemp)

fn_exists() { q "select exists(select 1 from pg_proc where proname='$1' and pronamespace='public'::regnamespace)"; }
fn_has() { q "select exists(select 1 from pg_proc where proname='$1' and pronamespace='public'::regnamespace and prosrc like '%$2%')"; }

echo "TAP version 13"

# 034 (results design; rolled back first)
HAS_034=f
if [ -f "$RB/rollback_034_results_design.sql" ]; then
  HAS_034=t
  if apply "$RB/rollback_034_results_design.sql"; then tap ok "rollback_034 applies"; else tap fail "rollback_034 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(q "select to_regclass('public.result_versions') is null")" = t ] && [ "$(fn_exists snapshot_result_version)" = f ] \
    && [ "$(q "select exists(select 1 from pg_proc where proname='public_result' and pronamespace='public'::regnamespace and pronargs=1)")" = t ] \
    && [ "$(fn_has declare_game_result 'left join scored')" = f ] \
    && tap ok "after rollback_034 result_versions is gone, public_result takes one argument and declare_game_result is the 024 body" \
    || tap fail "after rollback_034 result_versions / public_result / declare_game_result should be the 033 state"
fi

# 033 (security advisor cleanup; rolled back before 032)
HAS_033=f
if [ -f "$RB/rollback_033_security_advisor_cleanup.sql" ]; then
  HAS_033=t
  if apply "$RB/rollback_033_security_advisor_cleanup.sql"; then tap ok "rollback_033 applies"; else tap fail "rollback_033 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists my_profile_rows)" = f ] \
    && [ "$(q "select coalesce(reloptions @> array['security_invoker=true'], false) from pg_class where oid='public.my_profile'::regclass")" = f ] \
    && [ "$(q "select exists(select 1 from pg_proc where proname='touch_updated_at' and pronamespace='public'::regnamespace and proconfig is not null)")" = f ] \
    && [ "$(q "select has_function_privilege('anon', 'public.add_my_player(uuid)', 'execute')")" = t ] \
    && tap ok "after rollback_033 my_profile is the 024 view, touch_updated_at has no search_path and anon executes add_my_player again" \
    || tap fail "after rollback_033 my_profile / touch_updated_at / add_my_player should be the pre-033 state"
fi

# 032 (results volume fixes; rolled back before 031)
HAS_032=f
if [ -f "$RB/rollback_032_results_volume_fixes.sql" ]; then
  HAS_032=t
  if apply "$RB/rollback_032_results_volume_fixes.sql"; then tap ok "rollback_032 applies"; else tap fail "rollback_032 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_has game_rounds_json 'distinct on')" = f ] && [ "$(q "select coalesce(proconfig @> array['jit=off'], false) from pg_proc where proname='public_result' and pronamespace='public'::regnamespace")" = f ] \
    && tap ok "after rollback_032 game_rounds_json is the 020 body and public_result has no jit setting" \
    || tap fail "after rollback_032 game_rounds_json / public_result should be the 020/028 state"
fi

# 031 (round-robin rotation; rolled back before 030)
HAS_031=f
if [ -f "$RB/rollback_031_round_robin.sql" ]; then
  HAS_031=t
  if apply "$RB/rollback_031_round_robin.sql"; then tap ok "rollback_031 applies"; else tap fail "rollback_031 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_has save_round v_prev_dealer)" = f ] && [ "$(fn_has get_game_bundle v_dealers)" = f ] && [ "$(fn_has public_scorecard maxCount)" = f ] \
    && tap ok "after rollback_031 save_round, get_game_bundle and public_scorecard are the 019/028 bodies" \
    || tap fail "after rollback_031 save_round / get_game_bundle / public_scorecard should be the earlier bodies"
fi

# 030 (My players at scale; rolled back before 029)
HAS_030=f
if [ -f "$RB/rollback_030_my_players_at_scale.sql" ]; then
  HAS_030=t
  if apply "$RB/rollback_030_my_players_at_scale.sql"; then tap ok "rollback_030 applies"; else tap fail "rollback_030 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists list_my_players_page)" = f ] && [ "$(fn_exists search_my_players)" = f ] && [ "$(fn_exists count_my_players)" = f ] && [ "$(fn_exists list_my_players)" = t ] \
    && tap ok "after rollback_030 the page, search and count functions are gone and list_my_players stays" \
    || tap fail "after rollback_030 list_my_players_page / search_my_players / count_my_players should be gone"
fi

# 029 (guardrails; rolled back before 028)
HAS_029=f
if [ -f "$RB/rollback_029_guardrails.sql" ]; then
  HAS_029=t
  if apply "$RB/rollback_029_guardrails.sql"; then tap ok "rollback_029 applies"; else tap fail "rollback_029 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists guardrail_refuse)" = f ] && [ "$(fn_exists guard_games)" = f ] \
    && [ "$(q "select exists(select 1 from information_schema.tables where table_schema='public' and table_name='guardrails')")" = f ] \
    && [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='email_outbox' and column_name='next_attempt_at')")" = f ] \
    && tap ok "after rollback_029 the guardrails table, the guard functions and email_outbox.next_attempt_at are gone" \
    || tap fail "after rollback_029 guardrails / guard_games / guardrail_refuse / next_attempt_at should be gone"
  [ "$(q "select count(*) from pg_trigger where tgname like '%\_0\_guard'")" = 0 ] \
    && tap ok "after rollback_029 no guard trigger remains" || tap fail "after rollback_029 guard triggers remain"
fi

# 028 (game labels S/P; rolled back before 027)
HAS_028=f
if [ -f "$RB/rollback_028_game_labels.sql" ]; then
  HAS_028=t
  if apply "$RB/rollback_028_game_labels.sql"; then tap ok "rollback_028 applies"; else tap fail "rollback_028 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists next_game_number)" = f ] && [ "$(fn_exists game_labels_for)" = f ] \
    && [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='games' and column_name='game_label')")" = f ] \
    && tap ok "after rollback_028 next_game_number, game_labels_for and games.game_label are gone" \
    || tap fail "after rollback_028 next_game_number / game_labels_for / game_label should be gone"
  [ "$(fn_has assign_game_number 'max(game_number)')" = t ] && [ "$(fn_has link_conflict_message 'game ID')" = t ] && [ "$(fn_has get_game_result game_label_text)" = f ] \
    && tap ok "after rollback_028 the 009 trigger body and the 023/024/025 reader bodies are back" \
    || tap fail "after rollback_028 assign_game_number / link_conflict_message / get_game_result should be the earlier bodies"
fi

# 027 (remove from My Players; rolled back before 026)
HAS_027=f
if [ -f "$RB/rollback_027_remove_from_my_players.sql" ]; then
  HAS_027=t
  if apply "$RB/rollback_027_remove_from_my_players.sql"; then tap ok "rollback_027 applies"; else tap fail "rollback_027 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists restore_my_player)" = f ] && [ "$(fn_exists in_live_game_with_me)" = f ] \
    && [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='my_players' and column_name='removed_at')")" = f ] \
    && tap ok "after rollback_027 restore_my_player, in_live_game_with_me and my_players.removed_at are gone" \
    || tap fail "after rollback_027 restore_my_player / in_live_game_with_me / removed_at should be gone"
  [ "$(fn_has remove_my_player 'delete from public.my_players')" = t ] && [ "$(fn_has list_my_players removed_at)" = f ] \
    && [ "$(q "select indpred is null from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname = 'my_players_owner_initials_key'")" = t ] \
    && tap ok "after rollback_027 remove_my_player deletes again, lists are the 022/023 bodies, the initials index is whole" \
    || tap fail "after rollback_027 remove_my_player / list_my_players / my_players_owner_initials_key should be the earlier shape"
fi

# 026 (account deletion; same PR, rolled back before 025)
HAS_026=f
if [ -f "$RB/rollback_026_delete_account.sql" ]; then
  HAS_026=t
  if apply "$RB/rollback_026_delete_account.sql"; then tap ok "rollback_026 applies"; else tap fail "rollback_026 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists delete_my_account)" = f ] && [ "$(fn_exists tombstone_profile)" = f ] \
    && tap ok "after rollback_026 delete_my_account and tombstone_profile are gone" \
    || tap fail "after rollback_026 delete_my_account / tombstone_profile should be gone"
  [ "$(fn_has enforce_profile_auth_user deleted_after_registering)" = f ] && [ "$(fn_has delete_profile_with_auth_user tombstone_profile)" = f ] \
    && [ "$(fn_has lock_public_player_no deleted_after_registering)" = f ] && [ "$(fn_has lock_profile_email deleted_after_registering)" = f ] \
    && tap ok "after rollback_026 the 005/011/012 trigger bodies are back" \
    || tap fail "after rollback_026 enforce_profile_auth_user / delete_profile_with_auth_user / lock_public_player_no should be the earlier bodies"
fi

# 025 (link requests; same PR, rolled back before 024)
HAS_025=f
if [ -f "$RB/rollback_025_link_player_to_account.sql" ]; then
  HAS_025=t
  if apply "$RB/rollback_025_link_player_to_account.sql"; then tap ok "rollback_025 applies"; else tap fail "rollback_025 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists request_player_link)" = f ] && [ "$(fn_exists link_player_check)" = f ] && [ "$(fn_exists perform_player_link)" = f ] && [ "$(fn_exists answer_link_request_by_token)" = f ] \
    && tap ok "after rollback_025 the link-request functions are gone" \
    || tap fail "after rollback_025 request_player_link / link_player_check / perform_player_link / answer_link_request_by_token should be gone"
  [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='player_links' and column_name='target_id')")" = f ] \
    && [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='creator_notices' and column_name='kind')")" = f ] \
    && tap ok "after rollback_025 player_links.target_id and creator_notices.kind are gone" \
    || tap fail "after rollback_025 player_links.target_id / creator_notices.kind should be gone"
  [ "$(fn_has get_home_bundle link_requests)" = f ] && [ "$(fn_has expire_player_requests expire_link_requests)" = f ] && [ "$(fn_has take_creator_notices n.kind)" = f ] \
    && tap ok "after rollback_025 get_home_bundle, expire_player_requests and take_creator_notices are the 023/012/011 bodies" \
    || tap fail "after rollback_025 get_home_bundle / expire_player_requests / take_creator_notices should be the earlier bodies"
  [ "$(fn_exists link_seat_to_player)" = t ] && [ "$(fn_exists unlink_player)" = t ] \
    && tap ok "after rollback_025 the 015/017 seat link and 011 unlink are untouched" \
    || tap fail "after rollback_025 link_seat_to_player / unlink_player should remain"
fi

# 024 (emails + public results page; same PR, rolled back before 023)
HAS_024=f
if [ -f "$RB/rollback_024_emails_and_public_results.sql" ]; then
  HAS_024=t
  if apply "$RB/rollback_024_emails_and_public_results.sql"; then tap ok "rollback_024 applies"; else tap fail "rollback_024 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists queue_game_started_emails)" = f ] && [ "$(fn_exists public_result)" = f ] && [ "$(fn_exists unsubscribe_email)" = f ] \
    && tap ok "after rollback_024 the email RPCs and the public results reader are gone" \
    || tap fail "after rollback_024 queue_game_started_emails / public_result / unsubscribe_email should be gone"
  [ "$(q "select exists(select 1 from information_schema.tables where table_schema='public' and table_name='email_outbox')")" = f ] \
    && [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='email_token')")" = f ] \
    && tap ok "after rollback_024 the outbox and the preference columns are gone" \
    || tap fail "after rollback_024 email_outbox / profiles.email_token should be gone"
  [ "$(fn_has declare_game_result queue_result_saved_emails)" = f ] && [ "$(fn_exists delete_game)" = t ] \
    && tap ok "after rollback_024 declare_game_result is the 023 body and 023 is in place" \
    || tap fail "after rollback_024 declare_game_result should be the 023 body"
fi

# 023 (hide / soft delete; same PR, rolled back before 022)
HAS_023=f
if [ -f "$RB/rollback_023_hide_and_soft_delete.sql" ]; then
  HAS_023=t
  if apply "$RB/rollback_023_hide_and_soft_delete.sql"; then tap ok "rollback_023 applies"; else tap fail "rollback_023 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists delete_game)" = f ] && [ "$(fn_exists restore_result)" = f ] && [ "$(fn_exists list_hidden_and_deleted)" = f ] \
    && tap ok "after rollback_023 the delete/restore RPCs are gone" \
    || tap fail "after rollback_023 delete_game / restore_result / list_hidden_and_deleted should be gone"
  [ "$(q "select exists(select 1 from information_schema.tables where table_schema='public' and table_name='hidden_games')")" = f ] \
    && [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='games' and column_name='deleted_at')")" = f ] \
    && [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='game_result_games' and column_name='removed_at')")" = f ] \
    && tap ok "after rollback_023 hidden_games and the soft-delete columns are gone" \
    || tap fail "after rollback_023 hidden_games / deleted_at / removed_at should be gone"
  [ "$(fn_has get_home_bundle hidden_count)" = f ] && [ "$(fn_has get_game_result removedGameIds)" = f ] && [ "$(fn_exists visible_games)" = t ] \
    && tap ok "after rollback_023 the bundles and results readers are the 020 bodies" \
    || tap fail "after rollback_023 get_home_bundle / get_game_result should be the 020 bodies"
  [ "$(fn_exists set_my_player_initials)" = t ] && tap ok "rollback_023 leaves 022 in place" || tap fail "rollback_023 must not touch 022"
fi

# 022 (present from PR 7's Nov 11 initials batch on; skipped on refs that do not have it yet)
HAS_022=f
if [ -f "$RB/rollback_022_player_initials.sql" ]; then
  HAS_022=t
  if apply "$RB/rollback_022_player_initials.sql"; then tap ok "rollback_022 applies"; else tap fail "rollback_022 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists initials_candidates)" = f ] && [ "$(fn_exists set_my_player_initials)" = f ] && [ "$(fn_exists set_seat_label)" = f ] \
    && tap ok "after rollback_022 the generator and the initials RPCs are gone" \
    || tap fail "after rollback_022 initials_candidates / set_my_player_initials / set_seat_label should be gone"
  [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='my_players' and column_name='initials')")" = f ] \
    && [ "$(q "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='game_players' and column_name='label')")" = f ] \
    && tap ok "after rollback_022 my_players.initials and game_players.label are gone" \
    || tap fail "after rollback_022 the 022 columns should be gone"
  [ "$(fn_has seat_rows_json label)" = f ] && [ "$(fn_has list_my_players initials)" = f ] \
    && tap ok "after rollback_022 seat_rows_json and list_my_players are the 020/012 bodies" \
    || tap fail "after rollback_022 seat_rows_json / list_my_players should be the 020/012 bodies"
  [ "$(fn_exists normalize_profile_email)" = t ] && tap ok "rollback_022 leaves 021 in place" || tap fail "rollback_022 must not touch 021"
fi

# 021 (present from PR 7's Nov 11 email-uniqueness batch on; skipped on refs that do not have it yet)
HAS_021=f
if [ -f "$RB/rollback_021_email_uniqueness.sql" ]; then
  HAS_021=t
  if apply "$RB/rollback_021_email_uniqueness.sql"; then tap ok "rollback_021 applies"; else tap fail "rollback_021 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists normalize_profile_email)" = f ] && [ "$(fn_exists duplicate_profile_emails)" = f ] \
    && tap ok "after rollback_021 the normalising trigger function and the duplicate report are gone" \
    || tap fail "after rollback_021 normalize_profile_email / duplicate_profile_emails should be gone"
  [ "$(q "select exists(select 1 from pg_indexes where schemaname='public' and indexname='profiles_email_ci_key')")" = f ] \
    && tap ok "after rollback_021 profiles_email_ci_key is gone" || tap fail "after rollback_021 profiles_email_ci_key should be gone"
  [ "$(q "select exists(select 1 from pg_indexes where schemaname='public' and indexname='profiles_email_normalized_key')")" = t ] \
    && [ "$(fn_exists lock_profile_role)" = t ] \
    && tap ok "rollback_021 leaves 011's accounts-only email index and 019 in place" \
    || tap fail "rollback_021 must not touch 011's index or 019"
fi

# 020 (present from PR 7's Nov 11 performance batch on; skipped on refs that do not have it yet)
HAS_020=f
if [ -f "$RB/rollback_020_performance_rpcs_and_indexes.sql" ]; then
  HAS_020=t
  if apply "$RB/rollback_020_performance_rpcs_and_indexes.sql"; then tap ok "rollback_020 applies"; else tap fail "rollback_020 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists get_game_bundle)" = f ] && [ "$(fn_exists get_home_bundle)" = f ] && [ "$(fn_exists list_result_candidates)" = f ] \
    && tap ok "after rollback_020 the bundle RPCs are gone" || tap fail "after rollback_020 the bundle RPCs should be gone"
  [ "$(fn_has list_visible_game_ids 'union')" = f ] && [ "$(fn_has get_game_result game_rounds_json)" = f ] \
    && tap ok "after rollback_020 list_visible_game_ids and get_game_result are the 006/018 bodies" \
    || tap fail "after rollback_020 list_visible_game_ids / get_game_result should be the 006/018 bodies"
  [ "$(q "select exists(select 1 from pg_indexes where schemaname='public' and indexname='game_results_declared_by_idx')")" = f ] \
    && tap ok "after rollback_020 the 020 indexes are gone" || tap fail "after rollback_020 the 020 indexes should be gone"
  [ "$(fn_exists lock_profile_role)" = t ] && [ "$(q "select has_column_privilege('authenticated','public.profiles','email','select')")" = f ] \
    && tap ok "rollback_020 leaves 019 in place (role lock, contact columns private)" \
    || tap fail "rollback_020 must not touch 019"
fi

# 019 (present from PR 7's Nov 11 security/concurrency batch on; skipped on refs that do not have it yet)
HAS_019=f
if [ -f "$RB/rollback_019_security_and_concurrency_fixes.sql" ]; then
  HAS_019=t
  if apply "$RB/rollback_019_security_and_concurrency_fixes.sql"; then tap ok "rollback_019 applies"; else tap fail "rollback_019 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists lock_profile_role)" = f ] && tap ok "after rollback_019 lock_profile_role is gone" || tap fail "after rollback_019 lock_profile_role should be gone"
  [ "$(q "select exists(select 1 from pg_views where schemaname='public' and viewname='my_profile')")" = f ] \
    && tap ok "after rollback_019 my_profile view is gone" || tap fail "after rollback_019 my_profile view should be gone"
  [ "$(fn_has save_round pg_advisory_xact_lock)" = f ] && [ "$(fn_has remove_seat_if_no_scores pg_advisory_xact_lock)" = f ] \
    && tap ok "after rollback_019 save_round and remove_seat_if_no_scores are the 014/016 bodies (no per-game lock)" \
    || tap fail "after rollback_019 save_round / remove_seat_if_no_scores should be the 014/016 bodies"
  [ "$(q "select has_column_privilege('authenticated','public.profiles','email','select')")" = t ] \
    && tap ok "after rollback_019 authenticated can read profiles.email again (pre-019 state)" \
    || tap fail "after rollback_019 authenticated should have whole-table select on profiles"
fi

# 018 (present from PR 7's Nov 10 batch on; skipped on refs that do not have it yet)
HAS_018=f
if [ -f "$RB/rollback_018_results_reuse_and_player_ids.sql" ]; then
  HAS_018=t
  if apply "$RB/rollback_018_results_reuse_and_player_ids.sql"; then tap ok "rollback_018 applies"; else tap fail "rollback_018 applies: $(head -c 300 "$OUTERR")"; fi
  [ "$(fn_exists reused_game_ids)" = f ] && tap ok "after rollback_018 reused_game_ids is gone" || tap fail "after rollback_018 reused_game_ids should be gone"
  [ "$(fn_exists get_game_result)" = t ] && [ "$(fn_has get_game_result can_see_game_result)" = t ] \
    && tap ok "after rollback_018 get_game_result is the 013 reader (still private)" \
    || tap fail "after rollback_018 get_game_result should be the 013 reader"
fi

# 017 → 015 body
if apply "$RB/rollback_017_link_seat_takeover.sql"; then tap ok "rollback_017 applies"; else tap fail "rollback_017 applies: $(head -c 300 "$OUTERR")"; fi
[ "$(fn_exists link_seat_to_player)" = t ] && [ "$(fn_has link_seat_to_player 'already playing in this game')" = f ] \
  && tap ok "after rollback_017 link_seat_to_player is the 015 body (no takeover branch)" \
  || tap fail "after rollback_017 link_seat_to_player should be the 015 body"

# 016
if apply "$RB/rollback_016_remove_seat_if_no_scores.sql"; then tap ok "rollback_016 applies"; else tap fail "rollback_016 applies: $(head -c 300 "$OUTERR")"; fi
[ "$(fn_exists remove_seat_if_no_scores)" = f ] && tap ok "after rollback_016 remove_seat_if_no_scores is gone" || tap fail "after rollback_016 remove_seat_if_no_scores should be gone"

# 015
if apply "$RB/rollback_015_link_seat_to_player.sql"; then tap ok "rollback_015 applies"; else tap fail "rollback_015 applies: $(head -c 300 "$OUTERR")"; fi
[ "$(fn_exists link_seat_to_player)" = f ] && tap ok "after rollback_015 link_seat_to_player is gone" || tap fail "after rollback_015 link_seat_to_player should be gone"

# 014
if apply "$RB/rollback_014_save_round_atomic.sql"; then tap ok "rollback_014 applies"; else tap fail "rollback_014 applies: $(head -c 300 "$OUTERR")"; fi
[ "$(fn_exists save_round)" = f ] && tap ok "after rollback_014 save_round is gone" || tap fail "after rollback_014 save_round should be gone"

# 013
if apply "$RB/rollback_013_results_privacy.sql"; then tap ok "rollback_013 applies"; else tap fail "rollback_013 applies: $(head -c 300 "$OUTERR")"; fi
[ "$(fn_exists can_see_game_result)" = f ] && tap ok "after rollback_013 can_see_game_result is gone" || tap fail "after rollback_013 can_see_game_result should be gone"
[ "$(fn_exists get_game_result)" = t ] && [ "$(fn_has get_game_result can_see_game_result)" = f ] \
  && tap ok "after rollback_013 get_game_result is the 008/010 reader (the leak returns, by design)" \
  || tap fail "after rollback_013 get_game_result should be the pre-013 reader"

# forward again, in order
FORWARD="013_results_privacy 014_save_round_atomic 015_link_seat_to_player 016_remove_seat_if_no_scores 017_link_seat_takeover"
[ "$HAS_018" = t ] && FORWARD="$FORWARD 018_results_reuse_and_player_ids"
[ "$HAS_019" = t ] && FORWARD="$FORWARD 019_security_and_concurrency_fixes"
[ "$HAS_020" = t ] && FORWARD="$FORWARD 020_performance_rpcs_and_indexes"
[ "$HAS_021" = t ] && FORWARD="$FORWARD 021_email_uniqueness"
[ "$HAS_022" = t ] && FORWARD="$FORWARD 022_player_initials"
[ "$HAS_023" = t ] && FORWARD="$FORWARD 023_hide_and_soft_delete"
[ "$HAS_024" = t ] && FORWARD="$FORWARD 024_emails_and_public_results"
[ "$HAS_025" = t ] && FORWARD="$FORWARD 025_link_player_to_account"
[ "$HAS_026" = t ] && FORWARD="$FORWARD 026_delete_account"
[ "$HAS_027" = t ] && FORWARD="$FORWARD 027_remove_from_my_players"
[ "$HAS_028" = t ] && FORWARD="$FORWARD 028_game_labels"
[ "$HAS_029" = t ] && FORWARD="$FORWARD 029_guardrails"
[ "$HAS_030" = t ] && FORWARD="$FORWARD 030_my_players_at_scale"
[ "$HAS_031" = t ] && FORWARD="$FORWARD 031_round_robin"
[ "$HAS_032" = t ] && FORWARD="$FORWARD 032_results_volume_fixes"
[ "$HAS_033" = t ] && FORWARD="$FORWARD 033_security_advisor_cleanup"
[ "$HAS_034" = t ] && FORWARD="$FORWARD 034_results_design"
for m in $FORWARD; do
  if apply "$MIG/$m.sql"; then tap ok "re-apply $m"; else tap fail "re-apply $m: $(head -c 300 "$OUTERR")"; fi
done
[ "$(fn_exists can_see_game_result)" = t ] && tap ok "013 restored" || tap fail "013 restored"
[ "$(fn_exists save_round)" = t ] && tap ok "014 restored" || tap fail "014 restored"
[ "$(fn_exists remove_seat_if_no_scores)" = t ] && tap ok "016 restored" || tap fail "016 restored"
[ "$(fn_has link_seat_to_player 'already playing in this game')" = t ] && tap ok "017 restored (takeover body)" || tap fail "017 restored (takeover body)"
if [ "$HAS_018" = t ]; then
  [ "$(fn_exists reused_game_ids)" = t ] && [ "$(fn_has get_game_result reused_game_ids)" = t ] && tap ok "018 restored (reused_game_ids and the 018 reader)" || tap fail "018 restored"
fi
if [ "$HAS_019" = t ]; then
  [ "$(fn_exists lock_profile_role)" = t ] && [ "$(fn_has save_round pg_advisory_xact_lock)" = t ] && [ "$(fn_has remove_seat_if_no_scores pg_advisory_xact_lock)" = t ] \
    && [ "$(q "select exists(select 1 from pg_views where schemaname='public' and viewname='my_profile')")" = t ] \
    && [ "$(q "select has_column_privilege('authenticated','public.profiles','email','select')")" = f ] \
    && tap ok "019 restored (role lock, per-game lock in save_round and remove_seat_if_no_scores, my_profile, contact columns private)" \
    || tap fail "019 restored"
fi
if [ "$HAS_020" = t ]; then
  [ "$(fn_exists get_game_bundle)" = t ] && [ "$(fn_exists get_home_bundle)" = t ] && [ "$(fn_exists list_result_candidates)" = t ] \
    && [ "$(fn_has list_visible_game_ids 'union')" = t ] && [ "$(fn_has get_game_result game_rounds_json)" = t ] \
    && [ "$(q "select exists(select 1 from pg_indexes where schemaname='public' and indexname='game_results_declared_by_idx')")" = t ] \
    && tap ok "020 restored (bundle RPCs, union bodies, indexes)" || tap fail "020 restored"
fi
if [ "$HAS_021" = t ]; then
  [ "$(fn_exists normalize_profile_email)" = t ] && [ "$(fn_exists duplicate_profile_emails)" = t ] \
    && [ "$(q "select exists(select 1 from pg_indexes where schemaname='public' and indexname='profiles_email_ci_key')")" = t ] \
    && tap ok "021 restored (normalising trigger, duplicate report, case-insensitive unique email)" || tap fail "021 restored"
fi
if [ "$HAS_022" = t ]; then
  [ "$(fn_exists initials_candidates)" = t ] && [ "$(fn_exists set_my_player_initials)" = t ] && [ "$(fn_has seat_rows_json label)" = t ] \
    && [ "$(q "select exists(select 1 from pg_indexes where schemaname='public' and indexname='my_players_owner_initials_key')")" = t ] \
    && [ "$(q "select count(*) from public.my_players where initials is null")" = 0 ] \
    && [ "$(q "select count(*) from public.game_players where label is null")" = 0 ] \
    && tap ok "022 restored (generator, RPCs, seat labels, per-owner unique index, every row backfilled)" || tap fail "022 restored"
fi
if [ "$HAS_023" = t ]; then
  [ "$(fn_exists delete_game)" = t ] && [ "$(fn_exists list_hidden_and_deleted)" = t ] && [ "$(fn_has get_home_bundle hidden_count)" = t ] \
    && [ "$(q "select exists(select 1 from information_schema.tables where table_schema='public' and table_name='hidden_games')")" = t ] \
    && tap ok "023 restored (hide list, delete/restore RPCs, soft-delete aware bundles)" || tap fail "023 restored"
fi
if [ "$HAS_024" = t ]; then
  [ "$(fn_exists queue_game_started_emails)" = t ] && [ "$(fn_exists public_result)" = t ] && [ "$(fn_has declare_game_result queue_result_saved_emails)" = t ] \
    && [ "$(q "select count(*) from public.profiles where email_token is null")" = 0 ] \
    && tap ok "024 restored (outbox RPCs, public results reader, declare queues emails, every profile has a token)" || tap fail "024 restored"
fi
if [ "$HAS_025" = t ]; then
  [ "$(fn_exists request_player_link)" = t ] && [ "$(fn_exists link_player_check)" = t ] && [ "$(fn_has get_home_bundle link_requests)" = t ] \
    && tap ok "025 restored (link_player_check / request_player_link / home bundle link_requests)" || tap fail "025 restored"
fi
if [ "$HAS_026" = t ]; then
  [ "$(fn_exists delete_my_account)" = t ] && [ "$(fn_exists tombstone_profile)" = t ] && [ "$(fn_has delete_profile_with_auth_user tombstone_profile)" = t ] \
    && tap ok "026 restored (delete_my_account, tombstone_profile, dashboard delete anonymises)" || tap fail "026 restored"
fi
if [ "$HAS_027" = t ]; then
  [ "$(fn_exists restore_my_player)" = t ] && [ "$(fn_has remove_my_player 'In a live game')" = t ] \
    && [ "$(q "select indpred is not null from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname = 'my_players_owner_initials_key'")" = t ] \
    && tap ok "027 restored (restore_my_player, live-game block, active-only initials index)" || tap fail "027 restored"
fi
if [ "$HAS_028" = t ]; then
  [ "$(fn_exists next_game_number)" = t ] && [ "$(fn_has assign_game_number pg_advisory_xact_lock)" = t ] \
    && [ "$(q "select count(*) from public.games where game_label is null")" = 0 ] \
    && tap ok "028 restored (next_game_number, locked trigger, every game labelled)" || tap fail "028 restored"
fi
if [ "$HAS_029" = t ]; then
  [ "$(fn_exists guardrail_refuse)" = t ] && [ "$(q "select count(*) from public.guardrails")" = 9 ] \
    && [ "$(q "select count(*) from pg_trigger where tgname like '%\_0\_guard'")" = 5 ] \
    && tap ok "029 restored (guardrails table with 9 limits, 5 guard triggers)" || tap fail "029 restored"
fi
if [ "$HAS_030" = t ]; then
  [ "$(fn_exists list_my_players_page)" = t ] && [ "$(fn_exists search_my_players)" = t ] && [ "$(fn_exists count_my_players)" = t ] \
    && tap ok "030 restored (list_my_players_page, search_my_players, count_my_players)" || tap fail "030 restored"
fi
if [ "$HAS_031" = t ]; then
  [ "$(fn_has save_round v_prev_dealer)" = t ] && [ "$(fn_has get_game_bundle v_dealers)" = t ] && [ "$(fn_has public_scorecard maxCount)" = t ] \
    && tap ok "031 restored (rotation rule in save_round, dealers in the bundle and the public scorecard)" || tap fail "031 restored"
fi
if [ "$HAS_032" = t ]; then
  [ "$(fn_has game_rounds_json 'distinct on')" = t ] && [ "$(q "select coalesce(proconfig @> array['jit=off'], false) from pg_proc where proname='public_result' and pronamespace='public'::regnamespace")" = t ] \
    && tap ok "032 restored (one-pass game_rounds_json, jit off on public_result)" || tap fail "032 restored"
fi

if [ "$HAS_033" = t ]; then
  [ "$(fn_exists my_profile_rows)" = t ] \
    && [ "$(q "select coalesce(reloptions @> array['security_invoker=true'], false) from pg_class where oid='public.my_profile'::regclass")" = t ] \
    && [ "$(q "select count(*) from pg_proc p where p.pronamespace='public'::regnamespace and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')")" = 0 ] \
    && [ "$(q "select has_function_privilege('anon', 'public.add_my_player(uuid)', 'execute')")" = f ] \
    && [ "$(q "select has_function_privilege('anon', 'public.public_scorecard(text)', 'execute')")" = t ] \
    && tap ok "033 restored (security-invoker my_profile, every function has a search_path, anon only on the public RPCs)" || tap fail "033 restored"
fi
if [ "$HAS_034" = t ]; then
  [ "$(q "select to_regclass('public.result_versions') is not null")" = t ] && [ "$(fn_exists snapshot_result_version)" = t ] \
    && [ "$(q "select exists(select 1 from pg_proc where proname='public_result' and pronamespace='public'::regnamespace and pronargs=2)")" = t ] \
    && [ "$(q "select exists(select 1 from pg_proc where proname='public_result' and pronamespace='public'::regnamespace and pronargs=1)")" = f ] \
    && [ "$(fn_has declare_game_result 'left join scored')" = t ] \
    && [ "$(q "select count(*) from public.result_versions")" != 0 ] \
    && tap ok "034 restored (result_versions with backfilled rows, two-argument public_result, seated-first declare_game_result)" || tap fail "034 restored"
fi

# second apply of every re-runnable migration must be a no-op
for m in $FORWARD; do
  if apply "$MIG/$m.sql"; then tap ok "$m is safe to run twice"; else tap fail "$m second run: $(head -c 300 "$OUTERR")"; fi
done

echo "1..$n"
rm -f "$OUTERR"
exit $fail
