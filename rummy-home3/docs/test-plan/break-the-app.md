# Break the app before go-live (PR 16 test plan, part 5)

Review-first. Nothing here is built; section 2 onwards is the proposal. Costs are list prices as of Nov 2026 and
should be checked before buying anything.

## 1. Current state (what we test with today)

### 1.1 Accounts and seed data

Two databases are ever touched by tests: the **throw-away local Supabase** in CI (`supabase db reset` → migrations →
`seed.sql` → `seed-e2e.sql`) and the **hosted dev project** used from Expo Go / the APK. Nothing automated touches
production.

Local / CI (`supabase/seed.sql`, fixed UUIDs, passcode `123456`, emails `@test.local`):

| Account | Id suffix | Role in the fixtures |
| --- | --- | --- |
| sree | …0001 | creator of games A, C, E, F, G, H; **not seated** in A (non-playing organiser); the only account the emulator signs in as |
| harish | …0002 | seated player in A; creator, seated admin and declarer of B |
| priya | …0003 | seated player in A and B |
| viewer | …0004 | spectator (view only) in A |
| outsider | …0005 | no games |
| coadmin | …0006 | game_admin in A, not seated (non-playing co-admin) |
| appadmin | …0007 | `profiles.role = app_admin`, in no game |
| zero | …0008 | seated in A with 0 every round; seated in C |
| rk, ab, cd | …00a1–a3 | unregistered placeholders (rk managed by sree, ab by harish, cd by sree) |
| Test Alpha … Test Uniform | E2EP01–E2EP19 | 19 placeholders managed by sree (`seed-e2e.sql`) |

Counts: **8 registered users** (1 app admin, 2 creators, 1 non-playing co-admin, 3 seated players, 1 spectator,
1 outsider), **22 unregistered placeholders**. Games: A active (2 live + 2 undone rounds), B completed and in result R1,
C completed + closed, E active 4 players 1 round, F active **20 players × 30 rounds**, G completed 6 seats 0 rounds,
H active 3 players 0 rounds. One result (R1). No Pool game in the seed yet (PR 13 adds one through the UI in `smoke/16`).

Hosted dev project: `npm run db:seed-test-users` creates `player1–3@rummyhome.com` / `123456`; `npm run db:list-users`
lists who exists; app admin is set by hand in SQL (`docs/auth-and-testing.md`).

### 1.2 CI jobs (`.github/workflows/ci.yml`)

| Job | When | What |
| --- | --- | --- |
| `unit` | every push / PR, nightly | `tsc --noEmit`, 483 unit tests (`node --test`), doc tests (testing-strategy codes, help tables, scorecard.html parity) |
| `db` | same | local Supabase, 33 pgTAP files, rollback replay (`ci/db/replay-rollbacks.sh`), 10-case two-client concurrency script (`ci/db/concurrency-save-round.mjs`: same round twice, double tap, edit vs add, same edit, dropped connection, double declare, number race, guardrail race, save vs undo) |
| `report` | after both | Markdown summary |
| `ui-smoke` | every pull request | Pixel 6 API 34 x86_64 emulator, debug APK built in the job, Maestro, **16 smoke flows** + `known-bugs` (quarantined); artifact: screenshots, `summary.md`, hierarchy dumps per step |
| `ui-full` | nightly 09:00 UTC (01:00 PT) on `cursor/ezscore-apk-ready` and `main`; `workflow_dispatch` with a ref | smoke + **13 full flows** (bad passcode / sign out, 20-player swipe, font scale, Players/Admins, edit initials, add players, results save, share images, help, dark mode, first launch, log, count warnings) + known-bugs |

Smoke flows in order: 01 Home · 02 Scorecard · 03 Scorecard landscape · 04 Add round · 05 Complete · 06 Results ·
07 Profile · 08 My players · 09 New game · 10 Scorecard 20 players · 11 same landscape · 12 Results 0 players ·
13 Undo then Add round · 14 Rummy positive pot · 15 Delete shared result · 16 Pool game.

### 1.3 Volume and manual

- `docs/volume-testing.md`: 19 cases run Nov 12 on the local DB and pure client code (10,000 players, 20 × 500 rounds, 5,000 games, 30 × 20 result, five admins same instant, 30 games saving at once, email burst, every guardrail). All pass, worst 331 ms. **No device in the loop.**
- `docs/testing/two-phone-nov11.md`: manual two-phone pass (same-round race, remove seat while saving, privacy, link takes over a seat, reused game warning, speed, realtime).
- Emulators: one profile (Pixel 6, API 34). Portrait and landscape inside flows; font scale and dark theme as nightly flows. No small / old / tablet device, no iOS, no real device in CI, no airplane mode, no crash reporter in the app.

### 1.4 Gaps, in one list

No Pool seed · one sign-in account on the device (no role runs) · no offline flow · no chaos / fuzz / monkey · no
multi-device UI concurrency (only DB-level) · no screenshot regression · no video of failures · no crash reporting ·
no public-page browser test · nightly does not run on the top of the PR stack · failures are read in the Actions
log, nothing is filed automatically.

## 2. Proposed comprehensive setup

### 2.1 Roster (`supabase/seed-break.sql`, applied after `seed-e2e.sql` in CI only)

| Group | Accounts | Purpose |
| --- | --- | --- |
| Creators | `c1`–`c4@test.local` | c1 seated creator, c2 non-playing creator, c3 creator of a Pool game, c4 creator with 50 games (Home paging) |
| Admins | `a1`–`a3` | a1 seated admin, a2 non-playing co-admin, a3 admin of two games at once |
| Players | `p01`–`p20` | fill a 20-seat game; p07 has a pending link request; p12 is also an admin elsewhere |
| Spectators / outsiders | `s1`, `o1`, `o2` | view only; signed-in strangers |
| App admin | `appadmin` (existing) | DB-only role |
| Unregistered | 40 placeholders across c1–c4, two with clashing initials, one with a digit | initials and link flows |
| Devices | every account can sign in from two emulators at once | concurrency |

### 2.2 Seed games

| Game | Shape |
| --- | --- |
| BP1 | Points, 4 players, 3 rounds, drops of every kind, one undone round |
| BP2 | Points, **20 players × 60 rounds**, 13+ players so Add round uses 3 columns |
| BP3 | Points, multiplier **×10,000** (after PR 14): totals to ±2,000,000,000 (bigint path) |
| BP4 | Points, completed, in a result with BP1 |
| BQ1 | Pool 101, 6 players, two OUT, one re-entered, re-entry on |
| BQ2 | Pool 201, 20 players, 40 rounds, one player left (Complete offered) |
| BQ3 | Pool custom 400, re-entry off, awarded, in a result |
| BR1 | Result over 30 games × 20 players (volume shape) |
| BX1 | Game with every guardrail one step from the limit (19 seats, 499 rounds) |

### 2.3 Volume / stress levels (device in the loop this time)

| Level | Games | Rounds | Results | Concurrent devices | Where |
| --- | --- | --- | --- | --- | --- |
| L1 PR | seed | ≤ 30 | 1 | 1 | ui-smoke |
| L2 nightly | 50 | 60 (20 players) | 5 | 2 emulators | ui-full |
| L3 pre-APK | 1,000 | 500 | 30 × 20 | 4 emulators + 2 phones | T3 |
| L4 weekly | 5,000 | 500 × 20 games live | 50 | 6 | T4 |

### 2.4 Chaos (C16-x), each a Maestro flow or a two-emulator script

| Code | Attack | Expected |
| --- | --- | --- |
| C16-1 | Rapid taps: Save score ×10 in 1 s; Complete ×5; Undo ×5 | one round, one completion, one undo; buttons disable after the first tap |
| C16-2 | Double submit across devices: same round from two emulators at once | one saved; the other gets W33 with the saver's name and refreshes |
| C16-3 | Edit on A while B undoes; B deletes a result A is viewing; A removes a seat while B types that seat's score | refreshed messages, never a crash, log shows both |
| C16-4 | Offline: airplane mode before Save, during Save (kill network at 50 ms), on open | W31 banner, retry works, no duplicate round when the first request did land |
| C16-5 | Kill the app mid-save (`adb shell am force-stop` 100 ms after Save) then reopen | round either saved once or not at all; scorecard consistent |
| C16-6 | Bad input: paste letters / emoji / 20 digits into score, initials, names, pool limit; negative in Pool; leading zeros | rejected inline, no crash, no NaN in the grid |
| C16-7 | Huge numbers: 9,999,999 per cell, ×10,000 multiplier, 500 rounds | layout rules from the Multiplier spec hold; DB bigint path (042) |
| C16-8 | Time: device clock a day behind / ahead; rotate during Save; font scale 2.0 mid-flow | dates still local-day correct; no clipped primary button |
| C16-9 | Session: passcode changed on device B while A is in Add round | A's next save fails cleanly, returns to Login, draft kept |
| C16-10 | Storage: 1,000 roster, 50 live-game cache entries, clear app data mid-session | cold start < 3 s, no stale scorecard |

### 2.5 Fuzz / monkey

- **Robo on Firebase Test Lab** (real devices, free tier): 15-minute crawl signed in as `c1`, with the login steps scripted as a Robo script; crash reports + video.
- **`adb monkey`** on the CI emulator: 20,000 events with `--pct-syskeys 0 --throttle 50`, seeded (`-s 16`) so it replays; any crash or ANR fails T3.
- **Property fuzz in unit tests** (fast-check, to add): `scoring`, `pool`, `rummyDistribution`, `shortNumber`, `initials` with random inputs; invariants: totals sum to 0, no NaN, OUT never un-outs without re-entry, short form round-trips magnitude.

### 2.6 Every flow per role

The R cells in [`devices.md`](devices.md) §3: each flow runs signed in as CR, AD, PL, SP, OU in turn on the nightly
emulator and asserts the **must-not** column of `flows.md` (button absent, route refused, RLS message). One Maestro
flow per role per screen family, ~25 flows, reusing the smoke steps with a `ROLE` env.

## 3. Live visibility from Sree's PC

| Option | What Sree sees | Delay | Cost | Effort | Pick |
| --- | --- | --- | --- | --- | --- |
| V1 GitHub Actions + artifacts, improved | job summary with the screenshot gallery inline, `adb screenrecord` **video per flow**, logcat tail; a GitHub Pages "test dashboard" page listing the last nightly per device with thumbnails | after the job (15–90 min) | $0 beyond minutes | low | **yes, first** |
| V2 Self-hosted runner on Sree's PC | the emulator window live on his monitor while the same workflow runs; `scrcpy` for a USB phone; he can take over the mouse | live | $0 | medium (SDK, Java, Maestro, runner service) | **yes, second** — the real "watch it break" view |
| V3 Maestro Cloud | web dashboard, per-step screenshots and video, shareable links | near-live | free tier small; paid from the low hundreds / month | low | later |
| V4 Firebase Test Lab console | Robo video + crash stacks + device logs per run on real devices | after run (10–20 min) | free tier (10 virtual + 5 physical runs a day) | low | **yes, for monkey** |
| V5 BrowserStack App Live | a real phone of any model in his browser, live, he taps it himself; App Automate adds Maestro + video | live | App Live ≈ $29–39 / month; App Automate from ≈ $199 / month | low | App Live when he wants a specific real model |
| V6 GitHub Actions `tmate` / VNC step | SSH or VNC into the CI emulator while a flow runs | live | $0 | low, but fiddly | no — V2 is better |

**Pick: V1 + V2 now, V4 for monkey, V5 App Live on demand.** V3 / App Automate only if the emulator matrix gets slow.

## 4. Bug reporting → GitHub issues and the project board

Board: https://github.com/users/sreeatcandorps/projects/1

- `.github/ISSUE_TEMPLATE/bug.yml`: title `[flow] what broke`, fields: flow code (F01–F19), warning code, device, role, build (APK number / commit), steps, expected, actual, screenshot / video, severity (S1 crash or data loss · S2 wrong result · S3 wrong UI · S4 polish).
- **Auto-filing** (`ci/file-bug.mjs`, runs in the `report` job when a nightly or pre-APK flow fails): one issue per failing flow, labelled `bug`, `auto`, `flow:F0x`, `device:D2`; body has the failing step, the screenshot and the video link; **de-duplicated** by searching open issues with the same title and commenting instead of opening a second one; closed automatically with "passed on <sha>" after two green nights.
- Adding to the user project board needs a token with the `project` scope (the default `GITHUB_TOKEN` cannot write to a user-level Projects v2 board) → a `PROJECTS_TOKEN` secret from Sree (Q16.8); until then the issue is labelled and Sree's board auto-add workflow (Projects → Workflows → "Auto-add to project" on the `bug` label) picks it up with no token at all — **recommended**.
- PR-level smoke failures do **not** file issues (they block the PR instead); chaos, monkey and volume failures do.
- Manual bugs from the two-phone pass use the same template; the agent triages each morning: reproduce on the emulator, attach a flow, link the fix PR.

## 5. Build order (after Sree approves)

1. `seed-break.sql` roster + games, Playwright `/r/` tests, coverage test T16-1 (one PR).
2. Device matrix D2–D4 in `ui-full`, video artifacts, dashboard page, role runs (one PR).
3. Chaos C16-1..10 as flows / scripts, monkey job, Firebase Robo (one PR).
4. Self-hosted runner on Sree's PC (doc + runner labels; Sree installs).
5. Bug template + auto-filing + board auto-add (one PR).
6. Weekly T4 soak and the 10,000-row volume on a device.
