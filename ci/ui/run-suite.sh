#!/usr/bin/env bash
# Everything that happens on the booted emulator: install the test APK, settle the device, run the
# flow sets for the suite, keep the logcat tail. Called by the android-emulator-runner step in
# .github/workflows/ci.yml (that action runs each `script:` line in its own shell, hence one script).
#
#   ci/ui/run-suite.sh <suite> <apk>
#
#   smoke       e2e/smoke + known-bugs (quarantine)                 nightly (other devices); on a PR one SHARD of it
#               (SMOKE_FLOWS = that shard's flows, in run order), then the selected full flows (FLOW_FILTER) on the
#               same emulator: one smoke pass per PR, not two (Nov 26, ci/select-tests.mjs SMOKE_SHARDS)
#   full        smoke + e2e/full + known-bugs                       nightly, pre-release
#   chaos       e2e/chaos (break-the-app: double taps, offline, kill mid-save, huge numbers, 20×60)
#   roles       e2e/roles (player / spectator / outsider / non-playing admin)
#   two-device  e2e/two-device on two emulators (realtime + save race) — see run-two-device.sh
#   monkey      adb monkey fuzz run aimed at crashes — see ci/chaos/monkey.sh
#
# Writes ci/out/ui/<set>/... (see run-flows.sh) and ci/out/ui/<set>.status (0/1) for the blocking
# sets. Always exits 0: the workflow's last step reads the status files, so the artifact and gallery
# are produced even when a set fails. FLOW_FILTER / VIDEO pass through to run-flows.sh.
set -uo pipefail
cd "$(dirname "$0")/../.."

SUITE="${1:?suite}"
APK="${2:?apk path}"
OUT=ci/out/ui
mkdir -p "$OUT"

settle_device() {
  # Keep the screen on and the orientation ours for the whole run; dismiss the keyguard. System
  # "isn't responding" / "has stopped" dialogs are hidden: one launcher ANR after a snapshot restore
  # sat on top of every flow once. Our own app's crashes still fail the flow (logcat is checked).
  adb shell settings put system screen_off_timeout 1800000
  adb shell settings put system accelerometer_rotation 0
  adb shell settings put system user_rotation 0
  adb shell settings put global hide_error_dialogs 1
  # The "small" matrix row: the Pixel 4a image at density 480 is a 360 × 780 dp window — the narrowest phone
  # the app meets (staging build 2, Nov 23: five of eight bugs were width or font size).
  if [ -n "${DEVICE_DENSITY:-}" ]; then
    adb shell wm density "$DEVICE_DENSITY"
    sleep 2
    echo "density now: $(adb shell wm density 2>/dev/null | tr '\n' ' ')"
  fi
  # The AOSP keyboard on these images offers "Suggest contact names? Touch for info." in its suggestion strip, which
  # makes the keypad taller on the 360-dp phone. Granting it the contacts permission (the device has none) is the
  # documented way to make that offer go away; best effort, a failure here changes nothing else.
  adb shell pm grant com.android.inputmethod.latin android.permission.READ_CONTACTS >/dev/null 2>&1 \
    && echo "keyboard: contacts permission granted (no 'Suggest contact names' strip)" \
    || echo "keyboard: contacts permission not granted (flows tolerate the strip)"
  adb shell input keyevent 82
  adb shell input keyevent 3
  sleep 5
}

run_set() {
  # run_set <set> [--quarantine]
  echo 0 > "$OUT/$1.status"
  ci/ui/run-flows.sh "rummy-home3/e2e/$1" "$OUT/$1" "${2:-}" || echo 1 > "$OUT/$1.status"
}

adb devices
case "$SUITE" in
  two-device)
    ci/ui/run-two-device.sh "$APK"
    ;;
  monkey)
    adb install -r "$APK"
    settle_device
    ci/chaos/monkey.sh "${MONKEY_EVENTS:-5000}" "$OUT/monkey"
    ;;
  *)
    adb install -r "$APK"
    settle_device
    case "$SUITE" in
      # smoke: SMOKE_FLOWS names this shard's smoke flows (empty = the whole set, as on the nightly's other devices).
      # FLOW_FILTER, if any, names the full flows that follow on the same emulator; they build on the state this
      # shard's smoke flows leave (select-tests.mjs puts each full flow in the shard that holds its prerequisites).
      # VIDEO_FLOWS= keeps the videos of the smoke flows off (only the selected full flows are kept on a PR).
      smoke)
        VIDEO_FLOWS= FLOW_FILTER="${SMOKE_FLOWS:-}" run_set smoke
        if [ -n "${FLOW_FILTER:-}" ]; then run_set full; fi
        if [ -z "${SMOKE_FLOWS:-}" ] || [ "${SHARD:-a}" = a ]; then run_set known-bugs --quarantine; fi ;;
      # full, with a FLOW_FILTER (the nightly never sets one; a hand-run can): only the named full flows run. The full
      # flows build on what the smoke set leaves behind (a saved result for full/41, game E at round 1
      # for full/70, …), so a filtered full job still runs the whole smoke set first (Nov 19: without it
      # 41 found "No results yet"), exactly as the nightly full job does.
      full)  FLOW_FILTER= run_set smoke; run_set full; [ -n "${FLOW_FILTER:-}" ] || run_set known-bugs --quarantine ;;
      chaos) VIDEO="${VIDEO:-all}" run_set chaos ;;
      roles) run_set roles ;;
      *) echo "unknown suite: $SUITE"; echo 1 > "$OUT/$SUITE.status" ;;
    esac
    ;;
esac

adb logcat -d -t 2000 > "$OUT/logcat-tail.txt" || true
exit 0
