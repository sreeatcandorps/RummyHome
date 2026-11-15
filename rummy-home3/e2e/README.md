# Device UI flows (Maestro)

These YAML flows drive the real Android app on an emulator. CI runs them (`.github/workflows/ci.yml`,
job `ui-<device>-<suite>` from the plan the `select` job picks); the runner scripts are in `ci/ui/`. The
testing matrix that says which journey is covered where is in `docs/testing-strategy.md`; the tiers and
the change-based selection are in `docs/test-plan/automation.md`. Results, screenshots and videos of
every run are on the dashboard (gh-pages branch; `https://sreeatcandorps.github.io/RummyHome/` once
GitHub Pages is switched on).

## Layout

| Folder | Runs | Blocks |
| --- | --- | --- |
| `lib/` | shared pieces (`ensure-signed-in`, `sign-in`, `sign-in-as` with an EMAIL, `open-break-game` with a CODE, `fill-round-*`), never run on their own | — |
| `smoke/` | every pull request that touches app code, and in the nightly | yes: a failed flow fails the job |
| `full/` | nightly and pre-release whole; on a PR only the flows for the touched area (`FLOW_FILTER`) | yes |
| `chaos/` | break-the-app (PR 17): double taps, bad input, huge numbers, offline + reconnect, kill mid-save, 20 × 60 scorecard, pool with 19 outs. Every suite on an infra PR, the area's flows on an app PR, whole set nightly. Videos are kept for every flow | nightly / pre-release yes; on a PR a red chaos flow warns and lands on the dashboard |
| `roles/` | must-nots per role (player, spectator, outsider, non-playing admin) | same as chaos |
| `two-device/` | two emulators on one game: realtime (B adds, A sees) and the Save race (both save at once, one round). Driven by `ci/ui/run-two-device.sh`, not by file order | same as chaos |
| `known-bugs/` | both suites, after the sets above | no (quarantined). One flow per bug from the Nov 12 phone test, named after the PR that fixes it. That PR moves the flow into `smoke/` or `full/`, where it becomes blocking. Empty since PR 6 (an empty set passes with zero flows) |

Flows run in file-name order inside a set (`01-`, `02-`, …). File-name hooks, all applied by `ci/ui/run-flows.sh`:
`landscape` turns the emulator (the flow also does `setOrientation`), `font-scale` sets the phone font to 1.3×,
`night-phone` puts the phone in dark mode, `--net-off` switches wifi and mobile data off for the flow (back on for
the next one), `--kill-after` force-stops the app ~0.7 s after the flow's last screenshot (so the tap right after
it is interrupted) and again when Maestro returns. Every flow gets `adb logcat` cleared first and the crash buffer
checked after: a crash or ANR of the app fails the flow even when Maestro passed (`crashes.csv`). A screen
recording runs during every flow; it is kept for failures (and for every chaos flow) under `videos/`.

## Fixtures and state

The database is the local Supabase on the runner: `supabase db reset` (`seed.sql`), then
`supabase/seed-e2e.sql`, then `supabase/seed-break.sql` (PR 17). The smoke / full account is
`sree@test.local` / passcode `123456` (local only). The break-the-app roster (same passcode, all
`@test.local`): creators `c1` Chandra Creator, `c2` Chitra Nonplaying, `c3` Charan Poolmaster, `c4` Chaya
Manygames (38 games); admins `a1` Arun Admin, `a2` Asha Coadmin (non-playing), `a3` Amit Twoboards; players
`p01`–`p20` Player One … Twenty; `s1` Sita Spectator; outsiders `o1`, `o2`. Flows sign in with
`lib/sign-in-as.yaml` (`EMAIL`) and open a game with `lib/open-break-game.yaml` (`CODE`).

| Break game | Share code | State at the start | Used by |
| --- | --- | --- | --- |
| BP1 | `BREAKP1` | Points, c1 + a1 admins, p01, p02, Mo Khan; s1 spectator; 3 rounds + an undone 4th (Round 4) | `chaos/c01` (saves round 4), `chaos/c04` (saves and undoes round 5), `roles/r01`, `roles/r02`, `two-device/*` (realtime saves one round, the race one more) |
| BP2 | `BREAKP2` | Points, 20 seats × 60 rounds, a2 non-playing admin | `chaos/c09`, `roles/r04`, volume V5 |
| BP4 | `BREAKP4` | Points, completed, in a result | (reserved: Recent / result views) |
| BP5 | `BREAKP5` | Points, created by c2 who is not seated; a1, p05–p07; no rounds | `chaos/c02` (completes it) |
| BP6 / BP7 | `BREAKP6` / `BREAKP7` | Points, c1 + p11–p13, no rounds | `chaos/c05`+`c06` (offline then reconnect), `chaos/c07`+`c08` (kill mid-save) |
| BQ1 | `BREAKQ1` | Pool 101, c3 + a1 + p03–p06; p05 out, p06 re-entered | `roles/r02` (s1 must not see it) |
| BQ2 | `BREAKQ2` | Pool 201, 20 seats, 19 out, c3 the last one in | `chaos/c10` (completes, awards) |
| BQ3 | `BREAKQ3` | Pool 400, re-entry off, completed and awarded | (reserved: awards block on a completed pool) |
| BRKC01–38 | `BRKC01`… | c4's 38 games (30 completed, 8 active) | (reserved: Home paging, the live-games guard) |

Order matters inside the chaos set (c05 before c06, c07 before c08; c01 before c04 on BP1).

| Game | Share code | State at the start | Used by |
| --- | --- | --- | --- |
| A | `GAMEA1` | active, 4 players, 2 rounds (from `seed.sql`) | `smoke/01–06`: 04 adds round 3, 05 completes it, 06 shows its result, `full/40` saves the result, deletes it with Undo, deletes it again from the result page and restores it from Deleted (PR 9, PR 10b) |
| E | `GAMEE1` | active, 4 players, 1 round, sree seated as game admin | `full/30`, `full/31` (Edit initials for Zed Zero → ZZ2 and back to ZZ; PR 6 / 039), `full/60`, `smoke/13` (undo then add round saves round 1 again; PR 2 / 035), `full/70` (add → edit → undo round 2, then the Log shows three rows; Logs PR / 036) |
| H | `GAMEH1` | active, 3 players, no rounds | `smoke/14` (Rummy with a positive pot: -40 share, confirm, saves round 1; PR 3 / 037), `full/32` (Add players to this game: R K and C D in, Total 3 → 5, Return to game, then Otto Outsider #5 as non-playing admin; R K and C D removed again at the end; PR 7), `full/80` (count warnings; saves nothing) |
| G | `GAMEG1` | completed, 6 seated, no rounds | `smoke/12` (seated players with no rounds make a 6-player result; saves and closes G; PR 9 / PR 10b: Delete this result → Undo, then Delete again from the result page → Deleted + Restore, so G ends Closed), `smoke/15` (shares G's result, then Delete asks first; nothing deleted), `full/41` (Final scores card in marigold and the results share dialog in green; nothing sent) |
| F | `GAMEF1` | active, 20 players × 30 rounds | `smoke/10–11`, `full/20`, `full/21` (font scale 1.3, with A) |

Order matters inside the smoke set (A gains a round, then is completed). Everything else has its own
game so the sets stay independent of each other. `full/60` switches Appearance to Dark and back to
Phone; it runs last in the full set so the other screenshots are light.

## Writing a flow

- `appId: com.mindweavetech.rummyhome` (the package in `app.json`; `tests/e2e-flows.test.ts` checks it).
- Start with `- runFlow: ../lib/ensure-signed-in.yaml`. It launches the app and signs in only when the
  login screen is showing. Chaos / roles flows start with `../lib/sign-in-as.yaml` and an `EMAIL` instead
  (it signs out whoever is in first).
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

The screenshots land in the current directory. For the full CI behaviour (status files, gallery, videos, crash
check) run `ci/ui/run-suite.sh <smoke|full|chaos|roles|two-device|monkey> <apk>` from the repo root with an
emulator attached (`two-device` boots a second one; `monkey` runs `ci/chaos/monkey.sh`, `MONKEY_EVENTS`).
`FLOW_FILTER=c01-rapid-save-taps,c04-huge-numbers` runs only those; `VIDEO=all|fail|off`.
