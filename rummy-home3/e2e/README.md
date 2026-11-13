# Device UI flows (Maestro)

These YAML flows drive the real Android app on an emulator. CI runs them (`.github/workflows/ci.yml`,
jobs `ui-smoke` and `ui-full`); the runner scripts are in `ci/ui/`. The testing matrix that says which
journey is covered where is in `docs/testing-strategy.md`.

## Layout

| Folder | Runs | Blocks |
| --- | --- | --- |
| `lib/` | shared pieces (`ensure-signed-in`, `sign-in`), never run on their own | — |
| `smoke/` | every pull request, and in the nightly | yes: a failed flow fails `ui-smoke` |
| `full/` | nightly (`schedule`) and `workflow_dispatch` | yes, in `ui-full` |
| `known-bugs/` | both suites, after the sets above | no (quarantined). One flow per bug from the Nov 12 phone test, named after the PR that fixes it. That PR moves the flow into `smoke/` or `full/`, where it becomes blocking. Empty since PR 6 (an empty set passes with zero flows) |

Flows run in file-name order inside a set (`01-`, `02-`, …). Files whose name contains `landscape`
rotate: `setOrientation: LANDSCAPE_LEFT` after sign-in and back to `PORTRAIT` at the end; `ci/ui/run-flows.sh` also
turns the emulator for them. Files whose name contains `font-scale` run with the phone font at 1.3×
(`adb shell settings put system font_scale 1.3`, set by `ci/ui/run-flows.sh`, back to 1.0 after); files whose
name contains `night-phone` run with the phone in dark mode (`adb shell cmd uimode night yes`, off after).

## Fixtures and state

The database is the local Supabase on the runner: `supabase db reset` (`seed.sql`) then
`supabase/seed-e2e.sql`. The account used is `sree@test.local` / passcode `123456` (local only).

| Game | Share code | State at the start | Used by |
| --- | --- | --- | --- |
| A | `GAMEA1` | active, 4 players, 2 rounds (from `seed.sql`) | `smoke/01–06`: 04 adds round 3, 05 completes it, 06 shows its result, `full/40` saves the result |
| E | `GAMEE1` | active, 4 players, 1 round, sree seated as game admin | `full/30`, `full/31` (Edit initials for Zed Zero → ZZ2 and back to ZZ; PR 6 / 039), `full/60`, `smoke/13` (undo then add round saves round 1 again; PR 2 / 035), `full/70` (add → edit → undo round 2, then the Log shows three rows; Logs PR / 036) |
| H | `GAMEH1` | active, 3 players, no rounds | `smoke/14` (Rummy with a positive pot: -40 share, confirm, saves round 1; PR 3 / 037), `full/32` (Add players to this game: R K and C D in, Total 3 → 5, Return to game, then Otto Outsider #5 as non-playing admin; R K and C D removed again at the end; PR 7), `full/80` (count warnings; saves nothing) |
| G | `GAMEG1` | completed, 6 seated, no rounds | `smoke/12` (seated players with no rounds make a 6-player result; saves and closes G) |
| F | `GAMEF1` | active, 20 players × 30 rounds | `smoke/10–11`, `full/20`, `full/21` (font scale 1.3, with A) |

Order matters inside the smoke set (A gains a round, then is completed). Everything else has its own
game so the sets stay independent of each other. `full/60` switches Appearance to Dark and back to
Phone; it runs last in the full set so the other screenshots are light.

## Writing a flow

- `appId: com.mindweavetech.rummyhome` (the package in `app.json`; `tests/e2e-flows.test.ts` checks it).
- Start with `- runFlow: ../lib/ensure-signed-in.yaml`. It launches the app and signs in only when the
  login screen is showing.
- Prefer visible text (`tapOn: "Add round"`), then accessibility labels (`"Harish Test, no score"`),
  then `id:` for a `testID` when text is ambiguous (`login-email`, `login-passcode`, `login-submit`,
  `game-card-<share code>`, `results-save-button`, `results-unsaved-banner`). Add a `testID` in the app
  rather than tapping by coordinates.
- Wait with `extendedWaitUntil` after navigation; the emulator is slower than a phone.
- End with `takeScreenshot: <nn>-<screen>[-dark|-landscape]`. The gallery groups variants of the same
  screen by that name.
- Dismiss dialogs with `back` rather than a button that may be below the fold.
- Give a known-bug flow a comment that says what is wrong today and which PR fixes it.

## Running locally

```bash
# emulator or phone connected, app installed and pointed at a database that has the fixtures
curl -Ls "https://get.maestro.mobile.dev" | bash
cd rummy-home3/e2e
maestro test smoke/01-home.yaml
maestro test smoke/            # whole set, in order
# landscape flows rotate themselves (setOrientation); nothing to do by hand
```

The screenshots land in the current directory. For the full CI behaviour (status files, gallery) run
`ci/ui/run-suite.sh smoke <apk>` from the repo root with an emulator attached.
