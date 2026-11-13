#!/usr/bin/env bash
# Everything that happens on the booted emulator: install the test APK, settle the device, run the
# flow sets for the suite, keep the logcat tail. Called by the android-emulator-runner step in
# .github/workflows/ci.yml (that action runs each `script:` line in its own shell, hence one script).
#
#   ci/ui/run-suite.sh <smoke|full> <apk>
#
# Writes ci/out/ui/<set>/... (see run-flows.sh) and ci/out/ui/<set>.status (0/1) for the blocking
# sets. Always exits 0: the workflow's last step reads the status files, so the artifact and gallery
# are produced even when a set fails.
set -uo pipefail
cd "$(dirname "$0")/../.."

SUITE="${1:?smoke|full}"
APK="${2:?apk path}"
OUT=ci/out/ui
mkdir -p "$OUT"

adb devices
adb install -r "$APK"

# Keep the screen on and the orientation ours for the whole run; dismiss the keyguard. System
# "isn't responding" / "has stopped" dialogs are hidden: one launcher ANR after a snapshot restore
# sat on top of every flow once. Our own app's crashes still fail the flow (the screen is gone).
adb shell settings put system screen_off_timeout 1800000
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 0
adb shell settings put global hide_error_dialogs 1
adb shell input keyevent 82
adb shell input keyevent 3
sleep 5

echo 0 > "$OUT/smoke.status"
ci/ui/run-flows.sh rummy-home3/e2e/smoke "$OUT/smoke" || echo 1 > "$OUT/smoke.status"

if [ "$SUITE" = full ]; then
  echo 0 > "$OUT/full.status"
  ci/ui/run-flows.sh rummy-home3/e2e/full "$OUT/full" || echo 1 > "$OUT/full.status"
fi

ci/ui/run-flows.sh rummy-home3/e2e/known-bugs "$OUT/known-bugs" --quarantine

adb logcat -d -t 2000 > "$OUT/logcat-tail.txt" || true
exit 0
