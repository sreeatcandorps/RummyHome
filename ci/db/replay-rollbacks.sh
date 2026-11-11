#!/usr/bin/env bash
# Replay every rollback file in rummy-home3/supabase/rollback against a database that
# has 001–017 applied, check the function state after each, then re-apply the forward
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

# second apply of every re-runnable migration must be a no-op
for m in $FORWARD; do
  if apply "$MIG/$m.sql"; then tap ok "$m is safe to run twice"; else tap fail "$m second run: $(head -c 300 "$OUTERR")"; fi
done

echo "1..$n"
rm -f "$OUTERR"
exit $fail
