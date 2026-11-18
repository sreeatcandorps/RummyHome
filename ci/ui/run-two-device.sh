#!/usr/bin/env bash
# Two emulators, one game (PR 17, T16-5/T16-6). Device A is the emulator the workflow booted; device B is
# a second AVD this script creates and boots on port 5556 from the same system image.
#
#   ci/ui/run-two-device.sh <apk>
#
#   T1 realtime   A sits on the BREAKP1 scorecard, B (a1) adds a round; A must show the new round unprompted.
#   T2 race       both fill the next round, both tap Save in the same instant; exactly one round may land
#                 and the loser must see the conflict notice, not a second round.
#
# Writes ci/out/ui/two-device/{results.csv,screens,junit,debug,crashes.csv} and two-device.status.
# Environment: EMULATOR_SYSTEM_IMAGE (default system-images;android-34;default;x86_64),
#              EMULATOR_PROFILE (default pixel_6), APP_ID.
set -uo pipefail
cd "$(dirname "$0")/../.."

APK="${1:?apk path}"
OUT=ci/out/ui/two-device
APP_ID="${APP_ID:-com.mindweavetech.rummyhome}"
SYSIMG="${EMULATOR_SYSTEM_IMAGE:-system-images;android-34;default;x86_64}"
PROFILE="${EMULATOR_PROFILE:-pixel_6}"
mkdir -p "$OUT/screens" "$OUT/junit" "$OUT/debug" "$OUT/crashes"
: > "$OUT/results.csv"
: > "$OUT/crashes.csv"
echo 0 > ci/out/ui/two-device.status
ABS_OUT="$(cd "$OUT" && pwd)"
FLOWS="$(cd rummy-home3/e2e/two-device && pwd)"

A="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
[ -z "$A" ] && { echo "no booted emulator for device A"; echo 1 > ci/out/ui/two-device.status; exit 0; }
B=emulator-5556

boot_b() {
  local sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Android/Sdk}}"
  local avdmanager="$sdk/cmdline-tools/latest/bin/avdmanager"
  [ -x "$avdmanager" ] || avdmanager="$(ls -d "$sdk"/cmdline-tools/*/bin/avdmanager 2>/dev/null | head -1)"
  echo no | "$avdmanager" create avd -n ezscore-b --package "$SYSIMG" --device "$PROFILE" --force >/dev/null
  # Same memory budget as the runner's own AVD; two of these fit a 16 GB runner.
  printf 'hw.ramSize=2048\ndisk.dataPartition.size=2G\nhw.keyboard=yes\n' >> "$HOME/.android/avd/ezscore-b.avd/config.ini"
  nohup "$sdk/emulator/emulator" -avd ezscore-b -port 5556 -no-window -gpu swiftshader_indirect \
      -no-snapshot -noaudio -no-boot-anim -no-metrics -camera-back none -camera-front none \
      > "$ABS_OUT/emulator-b.log" 2>&1 &
  adb -s "$B" wait-for-device
  local i
  for i in $(seq 1 180); do
    [ "$(adb -s "$B" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 2
  done
  echo "device B boot_completed=$(adb -s "$B" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r') after ~$((i * 2))s"
  adb -s "$B" shell input keyevent 82 >/dev/null 2>&1 || true
}

settle() {
  adb -s "$1" shell settings put system screen_off_timeout 1800000
  adb -s "$1" shell settings put system accelerometer_rotation 0
  adb -s "$1" shell settings put system user_rotation 0
  adb -s "$1" shell settings put global hide_error_dialogs 1
  adb -s "$1" shell input keyevent 82
  adb -s "$1" shell input keyevent 3
}

# flow <serial> <tag> <flow-file> [KEY=VAL ...] — one Maestro run, one results row, screenshots copied.
flow() {
  local serial="$1" tag="$2" file="$3"; shift 3
  local envs=() kv
  for kv in "$@"; do envs+=(-e "$kv"); done
  local start rc secs
  start=$(date +%s)
  maestro --device "$serial" test "${envs[@]}" \
      --format junit --output "$ABS_OUT/junit/$tag.xml" \
      --test-output-dir "$ABS_OUT/debug/$tag" \
      "$FLOWS/$file"
  rc=$?
  secs=$(( $(date +%s) - start ))
  find "$ABS_OUT/debug/$tag" -path '*/takeScreenshot/*.png' -exec cp {} "$ABS_OUT/screens/" \; 2>/dev/null || true
  if [ "$rc" -eq 0 ]; then
    echo "PASS  $tag  (${secs}s)"; echo "$tag,pass,$secs" >> "$ABS_OUT/results.csv"
  else
    echo "FAIL  $tag  (${secs}s, exit $rc)"; echo "$tag,fail,$secs" >> "$ABS_OUT/results.csv"
    adb -s "$serial" exec-out screencap -p > "$ABS_OUT/screens/${tag}--FAILED.png" 2>/dev/null || true
    echo 1 > ci/out/ui/two-device.status
  fi
  return $rc
}

crash_check() {
  local serial="$1" tag="$2"
  adb -s "$serial" logcat -d -b crash > "$ABS_OUT/crashes/$tag.crash.txt" 2>/dev/null || true
  if grep -qE "Process: $APP_ID" "$ABS_OUT/crashes/$tag.crash.txt"; then
    echo "$tag,crash,$(grep -m1 -oE 'java\.lang\.[A-Za-z]+(Exception|Error)[^\n]{0,160}' "$ABS_OUT/crashes/$tag.crash.txt" | sed 's/,/;/g')" >> "$ABS_OUT/crashes.csv"
    echo 1 > ci/out/ui/two-device.status
  else
    rm -f "$ABS_OUT/crashes/$tag.crash.txt"
  fi
}

echo "::group::boot device B"
boot_b
adb devices
echo "::endgroup::"

for d in "$A" "$B"; do
  adb -s "$d" install -r "$APK"
  settle "$d"
  adb -s "$d" logcat -c -b all >/dev/null 2>&1 || true
done
sleep 5

# ---- T1 realtime: A opens the scorecard and stays there; B adds a round; A must show it unprompted.
# BREAKP1 is at Round 4 fresh → Round 5. Three flows in sequence so the timing cannot race itself.
echo "::group::T1 realtime"
flow "$A" t1-a-open t1-a-open.yaml
flow "$B" t1-b-add t1-realtime-add.yaml
flow "$A" t1-a-expect t1-a-expect.yaml EXPECT_ROUND=5
# What device A's Realtime channel said (the scorecard logs "[realtime] game <id>: SUBSCRIBED | CHANNEL_ERROR …"
# to ReactNativeJS). Maestro clears logcat for every flow and keeps each flow's slice under debug/, so read
# those. No line at all = the channel never reported; CHANNEL_ERROR / TIMED_OUT = the socket or RLS.
cat "$ABS_OUT"/debug/t1-a-open/*/*/logs/device-logcat.txt "$ABS_OUT"/debug/t1-a-expect/*/*/logs/device-logcat.txt 2>/dev/null \
  | grep -F '[realtime]' > "$ABS_OUT/realtime-device-a.txt" || true
echo "device A realtime channel: $(grep -c . "$ABS_OUT/realtime-device-a.txt") line(s)"; cat "$ABS_OUT/realtime-device-a.txt" || true
echo "::endgroup::"

# ---- T2 race: both prefill round 5, then both Save within the same ~100 ms. Expected: Round 6 on
# both, Log shows "Round 5 added" once, no "Round 6 added".
echo "::group::T2 race setup"
flow "$A" t2-a-setup a-setup-fill-round.yaml EMAIL=c1@test.local WHO=c1 &
SA=$!
flow "$B" t2-b-setup a-setup-fill-round.yaml EMAIL=a1@test.local WHO=a1 &
SB=$!
wait "$SA"; wait "$SB"
echo "::endgroup::"

echo "::group::T2 race save"
flow "$A" t2-a-save b-save-now.yaml WHO=c1 &
RA=$!
flow "$B" t2-b-save b-save-now.yaml WHO=a1 &
RB=$!
wait "$RA"; wait "$RB"
echo "::endgroup::"

echo "::group::T2 verify"
flow "$A" t2-a-verify c-verify-one-round.yaml WHO=c1 SAVED_ROUND=5 EXPECT_ROUND=6 OVER_ROUND=7
flow "$B" t2-b-verify c-verify-one-round.yaml WHO=a1 SAVED_ROUND=5 EXPECT_ROUND=6 OVER_ROUND=7
echo "::endgroup::"

crash_check "$A" device-a
crash_check "$B" device-b
adb -s "$A" logcat -d -t 1500 > "$ABS_OUT/logcat-a.txt" 2>/dev/null || true
adb -s "$B" logcat -d -t 1500 > "$ABS_OUT/logcat-b.txt" 2>/dev/null || true
adb -s "$B" emu kill >/dev/null 2>&1 || true

echo "two-device: $(grep -c ',pass,' "$ABS_OUT/results.csv")/$(wc -l < "$ABS_OUT/results.csv") flows passed (status $(cat ci/out/ui/two-device.status))"
if [ -s "$ABS_OUT/crashes.csv" ]; then echo "crashes:"; cat "$ABS_OUT/crashes.csv"; fi
exit 0
