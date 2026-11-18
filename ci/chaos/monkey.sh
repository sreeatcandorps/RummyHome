#!/usr/bin/env bash
# Fuzz the installed app with Android's monkey (PR 17, B16-9): random taps, swipes and text, no system
# keys (so it stays inside the app), fixed seed so a crash is reproducible. The app must be signed in
# first so the monkey reaches real screens; the seed users exist on the local Supabase only.
#
#   ci/chaos/monkey.sh <events> <out-dir>          e.g. 5000 nightly, 20000 pre-release
#
# Writes <out-dir>/{monkey.log,results.csv,crashes.csv,screens/} and ci/out/ui/monkey.status.
# A crash or ANR reported by monkey, or found in logcat, fails the run.
set -uo pipefail
cd "$(dirname "$0")/../.."

EVENTS="${1:-5000}"
OUT="${2:-ci/out/ui/monkey}"
APP_ID="${APP_ID:-com.mindweavetech.rummyhome}"
SEED="${MONKEY_SEED:-17}"
mkdir -p "$OUT/screens" "$OUT/crashes"
: > "$OUT/results.csv"
: > "$OUT/crashes.csv"
echo 0 > ci/out/ui/monkey.status
ABS_OUT="$(cd "$OUT" && pwd)"

# Sign in once through the normal flow so the monkey starts on the home list, not the login form.
maestro test -e EMAIL=c1@test.local --test-output-dir "$ABS_OUT/sign-in" rummy-home3/e2e/lib/sign-in-as.yaml \
  || echo "sign-in before monkey failed; fuzzing from whatever screen is up"
adb exec-out screencap -p > "$OUT/screens/monkey-00-start.png" 2>/dev/null || true
adb logcat -c -b all >/dev/null 2>&1 || true

# A screenshot every ~1/5 of the run so the gallery shows where it wandered.
(
  for i in 1 2 3 4; do
    sleep $(( EVENTS * 60 / 1000 / 5 + 5 ))
    adb exec-out screencap -p > "$OUT/screens/monkey-0$i-progress.png" 2>/dev/null || true
  done
) &
SNAP=$!

start=$(date +%s)
adb shell monkey -p "$APP_ID" --pct-syskeys 0 --pct-anyevent 0 --pct-trackball 0 \
    --throttle 60 -s "$SEED" --ignore-security-exceptions --kill-process-after-error \
    --monitor-native-crashes -v -v "$EVENTS" > "$OUT/monkey.log" 2>&1
rc=$?
secs=$(( $(date +%s) - start ))
kill "$SNAP" >/dev/null 2>&1 || true
adb exec-out screencap -p > "$OUT/screens/monkey-05-end.png" 2>/dev/null || true

adb logcat -d -b crash > "$OUT/crashes/monkey.crash.txt" 2>/dev/null || true
adb logcat -d -b main -s ActivityManager:E AndroidRuntime:E > "$OUT/crashes/monkey.main.txt" 2>/dev/null || true

status=pass
if grep -qE '^// (CRASH|NOT RESPONDING)' "$OUT/monkey.log"; then
  status=fail
  kind=crash; grep -q '^// NOT RESPONDING' "$OUT/monkey.log" && kind=anr
  first="$(grep -m1 -oE '(// Short Msg: .{0,160}|// Long Msg: .{0,160})' "$OUT/monkey.log" | head -1 | sed 's|^// ||; s/,/;/g')"
  echo "monkey-$EVENTS,$kind,${first:-see monkey.log} (seed $SEED)" >> "$OUT/crashes.csv"
elif grep -qE "Process: $APP_ID" "$OUT/crashes/monkey.crash.txt" || grep -qE "ANR in $APP_ID" "$OUT/crashes/monkey.main.txt"; then
  status=fail
  echo "monkey-$EVENTS,crash,$(grep -m1 -oE 'java\.lang\.[A-Za-z]+(Exception|Error).{0,160}' "$OUT/crashes/monkey.crash.txt" | sed 's/,/;/g') (seed $SEED)" >> "$OUT/crashes.csv"
elif [ "$rc" -ne 0 ]; then
  status=fail
  echo "monkey-$EVENTS,monkey-exit-$rc,see monkey.log (seed $SEED)" >> "$OUT/crashes.csv"
fi
[ "$status" = pass ] && rm -f "$OUT/crashes/monkey.crash.txt" "$OUT/crashes/monkey.main.txt"

echo "monkey-$EVENTS-seed-$SEED,$status,$secs" >> "$OUT/results.csv"
[ "$status" = fail ] && echo 1 > ci/out/ui/monkey.status
echo "monkey: $EVENTS events, seed $SEED, ${secs}s → $status"
[ -s "$OUT/crashes.csv" ] && cat "$OUT/crashes.csv"
exit 0
