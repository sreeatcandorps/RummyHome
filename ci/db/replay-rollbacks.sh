#!/usr/bin/env bash
# Replay every rollback file in rummy-home3/supabase/rollback against a database that
# has every migration (001–022) applied, check the function state after each, then re-apply the forward
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

# second apply of every re-runnable migration must be a no-op
for m in $FORWARD; do
  if apply "$MIG/$m.sql"; then tap ok "$m is safe to run twice"; else tap fail "$m second run: $(head -c 300 "$OUTERR")"; fi
done

echo "1..$n"
rm -f "$OUTERR"
exit $fail
