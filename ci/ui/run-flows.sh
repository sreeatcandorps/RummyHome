#!/usr/bin/env bash
# Run every Maestro flow in one e2e set, in file-name order, against the app already installed on the
# connected emulator. One JUnit file and one debug folder per flow; the screenshots a flow takes land
# in <out>/screens. File-name hooks (PR 1/4/5 and PR 17):
#   *landscape*     emulator turned sideways            *font-scale*   phone font at 1.3x
#   *night-phone*   phone in dark mode                  *--net-off*    wifi + data off for the flow
#   *--kill-after*  the app is force-stopped right after the flow's last screenshot (kill mid-save)
#
#   ci/ui/run-flows.sh <set-dir> <out-dir> [--quarantine]
#
#   set-dir      e.g. rummy-home3/e2e/smoke
#   out-dir      e.g. ci/out/ui/smoke   (results.csv, crashes.csv, screens/, videos/, junit/, debug/)
#   --quarantine record failures but exit 0 (the known-bugs set: red until its PR lands)
#
# Environment:
#   ANDROID_SERIAL  which emulator (adb and maestro both honour it); default: the only one
#   FLOW_FILTER     comma list of flow names to run (change-based selection); default: all
#   VIDEO           off | fail | all — keep the per-flow screen recording never / on failure / always
#   APP_ID          package to watch for crashes and to kill; default com.mindweavetech.rummyhome
#   DEVICE_ROTATION / DEVICE_FONT_SCALE   the device's resting orientation (0/1) and font scale
#                   (the matrix's tablet runs landscape, the Pixel 7 Pro at 1.3) — hooks still override
#
# A flow fails when Maestro fails OR the app crashed / ANR'd during it (crashes.csv gets a row and the
# logcat crash buffer is saved under crashes/). results.csv: <flow>,<pass|fail>,<seconds>
set -uo pipefail
cd "$(dirname "$0")/../.."

SET_DIR="${1:?set dir}"
OUT="${2:?out dir}"
QUARANTINE=0
[ "${3:-}" = "--quarantine" ] && QUARANTINE=1
VIDEO="${VIDEO:-fail}"
BASE_ROTATION="${DEVICE_ROTATION:-0}"
BASE_FONT="${DEVICE_FONT_SCALE:-1.0}"
APP_ID="${APP_ID:-com.mindweavetech.rummyhome}"
MAESTRO_DEVICE=()
[ -n "${ANDROID_SERIAL:-}" ] && MAESTRO_DEVICE=(--device "$ANDROID_SERIAL")

mkdir -p "$OUT/screens" "$OUT/junit" "$OUT/debug" "$OUT/videos" "$OUT/crashes"
: > "$OUT/results.csv"
: > "$OUT/crashes.csv"
ABS_OUT="$(cd "$OUT" && pwd)"
ABS_SET="$(cd "$SET_DIR" && pwd)"

rotate() {
  # 0 = portrait, 1 = landscape (90°). Auto-rotate is off so the setting sticks; `wm` is the
  # explicit API 31+ way and the settings row is the fallback older images honour.
  adb shell settings put system accelerometer_rotation 0 >/dev/null 2>&1 || true
  adb shell settings put system user_rotation "$1" >/dev/null 2>&1 || true
  adb shell wm set-user-rotation lock "$1" >/dev/null 2>&1 || true
  sleep 3
  echo "rotation now: $(adb shell dumpsys window displays 2>/dev/null | grep -m1 -oE 'mCurrentRotation=[^ ,]+|rotation=[0-9]' || echo unknown)"
}

font_scale() {
  adb shell settings put system font_scale "$1" >/dev/null 2>&1 || true
  sleep 2
  echo "font scale now: $(adb shell settings get system font_scale 2>/dev/null || echo unknown)"
}

night_mode() {
  adb shell cmd uimode night "$1" >/dev/null 2>&1 || true
  sleep 2
}

network() {
  # on | off. The emulator's wifi and mobile data together; the app then sees a real "no network".
  if [ "$1" = off ]; then
    adb shell svc wifi disable >/dev/null 2>&1 || true
    adb shell svc data disable >/dev/null 2>&1 || true
  else
    adb shell svc wifi enable >/dev/null 2>&1 || true
    adb shell svc data enable >/dev/null 2>&1 || true
  fi
  sleep 3
  echo "network $1: $(adb shell dumpsys connectivity 2>/dev/null | grep -m1 -oE 'Active default network: [^ ]+' || echo unknown)"
}

record_start() {
  # Low bitrate, 180 s cap (screenrecord's own maximum); enough for every flow we have.
  adb shell rm -f "/sdcard/$1.mp4" >/dev/null 2>&1 || true
  adb shell screenrecord --bit-rate 1200000 --time-limit 180 "/sdcard/$1.mp4" >/dev/null 2>&1 &
  REC_PID=$!
}

record_stop() {
  # SIGINT lets screenrecord finalise the file; a hard kill leaves it unplayable.
  adb shell pkill -INT screenrecord >/dev/null 2>&1 || true
  wait "$REC_PID" 2>/dev/null || true
  sleep 1
  if [ "$2" = keep ]; then
    adb pull "/sdcard/$1.mp4" "$ABS_OUT/videos/$1.mp4" >/dev/null 2>&1 || true
  fi
  adb shell rm -f "/sdcard/$1.mp4" >/dev/null 2>&1 || true
}

crash_check() {
  # The crash ring buffer holds Java/native crashes; ANRs are in the main buffer. Both are cleared
  # before each flow, so anything here happened during it.
  local name="$1" hits=0
  adb logcat -d -b crash > "$ABS_OUT/crashes/$name.crash.txt" 2>/dev/null || true
  adb logcat -d -b main -s ActivityManager:E AndroidRuntime:E > "$ABS_OUT/crashes/$name.main.txt" 2>/dev/null || true
  if grep -qE "Process: $APP_ID|pid: [0-9]+, tid: [0-9]+.*>>> $APP_ID <<<" "$ABS_OUT/crashes/$name.crash.txt"; then hits=$((hits + 1)); fi
  if grep -qE "ANR in $APP_ID" "$ABS_OUT/crashes/$name.main.txt"; then hits=$((hits + 1)); fi
  if [ "$hits" -gt 0 ]; then
    local kind="crash"
    grep -qE "ANR in $APP_ID" "$ABS_OUT/crashes/$name.main.txt" && kind="anr"
    local first
    first="$(grep -m1 -oE '(java\.lang\.[A-Za-z]+(Exception|Error)[^\n]{0,160}|FATAL EXCEPTION[^\n]{0,160}|ANR in [^\n]{0,160})' "$ABS_OUT/crashes/$name.crash.txt" "$ABS_OUT/crashes/$name.main.txt" 2>/dev/null | head -1 | sed 's/^[^:]*://; s/,/;/g')"
    echo "$name,$kind,${first:-see crashes/$name.*.txt}" >> "$OUT/crashes.csv"
    return 1
  fi
  rm -f "$ABS_OUT/crashes/$name.crash.txt" "$ABS_OUT/crashes/$name.main.txt"
  return 0
}

kill_watcher() {
  # --kill-after: force-stop the app ~0.7 s after the flow's last screenshot lands (the flow takes it
  # right before the tap it wants interrupted), and again as soon as Maestro returns, whichever is first.
  local name="$1"
  (
    for _ in $(seq 1 1200); do
      if find "$ABS_OUT/debug/$name" -path '*/takeScreenshot/*.png' 2>/dev/null | grep -q .; then
        sleep 0.7
        adb shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
        echo "kill-after: app force-stopped after the flow's screenshot"
        exit 0
      fi
      sleep 0.1
    done
  ) &
  KILL_PID=$!
}

in_filter() {
  [ -z "${FLOW_FILTER:-}" ] && return 0
  case ",$FLOW_FILTER," in *",$1,"*) return 0 ;; esac
  return 1
}

failed=0
total=0
net_was_off=0
# An empty set (every known bug fixed) is a pass with zero flows.
for f in $(ls "$SET_DIR"/*.yaml 2>/dev/null | sort); do
  name="$(basename "$f" .yaml)"
  in_filter "$name" || { echo "skip  $name (not in FLOW_FILTER)"; continue; }
  total=$((total + 1))
  case "$name" in *landscape*) rotate 1 ;; *) rotate "$BASE_ROTATION" ;; esac
  case "$name" in *font-scale*) font_scale 1.3 ;; *) font_scale "$BASE_FONT" ;; esac
  case "$name" in *night-phone*) night_mode yes ;; *) night_mode no ;; esac
  case "$name" in
    *--net-off*) network off; net_was_off=1 ;;
    *) [ "$net_was_off" -eq 1 ] && { network on; net_was_off=0; } ;;
  esac
  KILL_PID=""
  case "$name" in *--kill-after*) kill_watcher "$name" ;; esac

  echo "::group::flow $name"
  start=$(date +%s)
  adb logcat -c -b all >/dev/null 2>&1 || adb logcat -c >/dev/null 2>&1 || true
  [ "$VIDEO" != off ] && record_start "$name"
  # Maestro 2.x writes takeScreenshot/ (the flow's screenshots), logs/ (per-command timings) and
  # its own failure capture into the test output dir; the flow's screenshots are copied to screens/.
  maestro "${MAESTRO_DEVICE[@]}" test \
      --format junit --output "$ABS_OUT/junit/$name.xml" \
      --test-output-dir "$ABS_OUT/debug/$name" \
      "$ABS_SET/$name.yaml"
  rc=$?
  if [ -n "$KILL_PID" ]; then
    adb shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
    kill "$KILL_PID" >/dev/null 2>&1 || true
    wait "$KILL_PID" 2>/dev/null || true
  fi
  secs=$(( $(date +%s) - start ))
  crashed=0
  crash_check "$name" || crashed=1
  # Layout seen with 2.12: <dir>/<timestamp>/<flow>/takeScreenshot/<name>.png
  find "$ABS_OUT/debug/$name" -path '*/takeScreenshot/*.png' -exec cp {} "$ABS_OUT/screens/" \; 2>/dev/null || true
  # Older layout (or no bundle): takeScreenshot writes next to the current directory.
  find . -maxdepth 1 -name '*.png' -newer "$ABS_OUT/results.csv" -exec mv {} "$ABS_OUT/screens/" \; 2>/dev/null || true
  echo "::endgroup::"

  if [ "$rc" -eq 0 ] && [ "$crashed" -eq 0 ]; then
    echo "PASS  $name  (${secs}s)"
    echo "$name,pass,$secs" >> "$OUT/results.csv"
    [ "$VIDEO" != off ] && record_stop "$name" "$([ "$VIDEO" = all ] && echo keep || echo drop)"
  else
    if [ "$crashed" -eq 1 ]; then
      echo "FAIL  $name  (${secs}s, exit $rc, APP CRASHED — see crashes/)"
    else
      echo "FAIL  $name  (${secs}s, exit $rc)"
    fi
    echo "$name,fail,$secs" >> "$OUT/results.csv"
    failed=$((failed + 1))
    # Where the app was when the step failed: Maestro's own failure screenshot sits in the debug
    # folder; also take one now so the gallery has it under a predictable name.
    adb exec-out screencap -p > "$OUT/screens/${name}--FAILED.png" 2>/dev/null || true
    [ "$VIDEO" != off ] && record_stop "$name" keep
  fi
done
rotate "$BASE_ROTATION"
font_scale "$BASE_FONT"
night_mode no
[ "$net_was_off" -eq 1 ] && network on

echo "$SET_DIR: $((total - failed))/$total flows passed"
if [ -s "$OUT/crashes.csv" ]; then
  echo "crashes during this set:"
  cat "$OUT/crashes.csv"
fi
if [ "$failed" -gt 0 ] && [ "$QUARANTINE" -eq 0 ]; then
  exit 1
fi
exit 0
