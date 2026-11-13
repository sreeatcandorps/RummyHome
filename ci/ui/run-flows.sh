#!/usr/bin/env bash
# Run every Maestro flow in one e2e set, in file-name order, against the app already installed on the
# connected emulator. One JUnit file and one debug folder per flow; the screenshots a flow takes land
# in <out>/screens. Flows whose file name contains "landscape" run with the emulator turned sideways.
#
#   ci/ui/run-flows.sh <set-dir> <out-dir> [--quarantine]
#
#   set-dir      e.g. rummy-home3/e2e/smoke
#   out-dir      e.g. ci/out/ui/smoke   (results.csv, screens/, junit/, debug/)
#   --quarantine record failures but exit 0 (the known-bugs set: red until its PR lands)
#
# results.csv: <flow>,<pass|fail>,<seconds>
set -uo pipefail
cd "$(dirname "$0")/../.."

SET_DIR="${1:?set dir}"
OUT="${2:?out dir}"
QUARANTINE=0
[ "${3:-}" = "--quarantine" ] && QUARANTINE=1

mkdir -p "$OUT/screens" "$OUT/junit" "$OUT/debug"
: > "$OUT/results.csv"
ABS_OUT="$(cd "$OUT" && pwd)"
ABS_SET="$(cd "$SET_DIR" && pwd)"

rotate() {
  # 0 = portrait, 1 = landscape (90°). Auto-rotate is off so the setting sticks.
  adb shell settings put system accelerometer_rotation 0 >/dev/null 2>&1 || true
  adb shell settings put system user_rotation "$1" >/dev/null 2>&1 || true
  sleep 2
}

failed=0
total=0
for f in $(ls "$SET_DIR"/*.yaml | sort); do
  name="$(basename "$f" .yaml)"
  total=$((total + 1))
  case "$name" in *landscape*) rotate 1 ;; *) rotate 0 ;; esac

  echo "::group::flow $name"
  start=$(date +%s)
  # Maestro 2.x writes takeScreenshot/ (the flow's screenshots), logs/ (per-command timings) and
  # its own failure capture into the test output dir; the flow's screenshots are copied to screens/.
  maestro test \
      --format junit --output "$ABS_OUT/junit/$name.xml" \
      --test-output-dir "$ABS_OUT/debug/$name" \
      "$ABS_SET/$name.yaml"
  rc=$?
  secs=$(( $(date +%s) - start ))
  if [ -d "$ABS_OUT/debug/$name/takeScreenshot" ]; then
    cp "$ABS_OUT/debug/$name/takeScreenshot/"*.png "$ABS_OUT/screens/" 2>/dev/null || true
  fi
  # Older layout (or no bundle): takeScreenshot writes next to the current directory.
  find . -maxdepth 1 -name '*.png' -newer "$ABS_OUT/results.csv" -exec mv {} "$ABS_OUT/screens/" \; 2>/dev/null || true
  echo "::endgroup::"

  if [ "$rc" -eq 0 ]; then
    echo "PASS  $name  (${secs}s)"
    echo "$name,pass,$secs" >> "$OUT/results.csv"
  else
    echo "FAIL  $name  (${secs}s, exit $rc)"
    echo "$name,fail,$secs" >> "$OUT/results.csv"
    failed=$((failed + 1))
    # Where the app was when the step failed: Maestro's own failure screenshot sits in the debug
    # folder; also take one now so the gallery has it under a predictable name.
    adb exec-out screencap -p > "$OUT/screens/${name}--FAILED.png" 2>/dev/null || true
  fi
done
rotate 0

echo "$SET_DIR: $((total - failed))/$total flows passed"
if [ "$failed" -gt 0 ] && [ "$QUARANTINE" -eq 0 ]; then
  exit 1
fi
exit 0
