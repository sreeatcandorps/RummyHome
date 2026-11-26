# Automation tiers and change-based selection (PR 16 test plan, part 4)

## 1. Tiers

| Tier | Runs | Time budget | Contents | Blocks merge? |
| --- | --- | --- | --- | --- |
| T0 Pre-commit (local) | every commit, agent or Sree | < 60 s | `npx tsc --noEmit`, `npm test` (483 unit tests), lint for `Alert.alert` / tokens (DC15-1) | yes (agent discipline) |
| T1 PR | every push to a PR | < 15 min wall | T0 + DB suite (33 pgTAP files, rollback replay, concurrency script) + **ui-smoke** on D1 (16 flows, portrait + landscape) + coverage test T16-1 + Playwright `/r/` pages (T16-6) | **yes** |
| T2 Nightly | 09:00 UTC on `cursor/ezscore-apk-ready` and `main` (today), plus the top of the stack (new) | < 90 min | T1 + `ui-full` (13 flows + known-bugs) on D1–D4, dark / font / offline axes, **role runs** (every R cell in the matrix), screenshot regression (12 key screens vs the approved set), volume script at the small sizes | no, but red nightly = no APK |
| T3 Pre-APK | before each milestone APK | half a day of machine time | T2 + volume at full sizes (`docs/volume-testing.md`), chaos set (C16-x), Robo / monkey on Firebase Test Lab real devices, **manual two-phone pass** (M cells) on D5 | yes for the APK |
| T4 Weekly / on demand | Sunday, or `workflow_dispatch` | hours | 10,000-player roster, 500-round games, 30 × 20 result, soak (one emulator adding a round every 20 s for 2 hours), fuzz with the big-number and bad-input corpus | report only |

Today (after PR 17): T0 and T1 exist (T1 adds the area's deeper flows by name; no Playwright / coverage test yet);
T2 is the `nightly` tier — full + chaos + roles + two-device + monkey 5k on D1 and smoke on D2–D4; T3 is the
`prerelease` tier (`workflow_dispatch`, tier = prerelease) — full on every device, chaos on D1 / D2 / D4, monkey 20k,
the volume job — plus the manual two-phone pass; T4 does not exist. Tiers are chosen by `ci/select-tests.mjs`
(job `select`), the plan is printed in the job summary.

## 2. Change-based selection (what runs when)

`ci/select-tests.mjs` (PR 17) reads the PR diff (`base...head`) and emits the device × suite matrix. The smoke set
always runs whole on a PR (it is the gate); the table below is the **intent**, the script's `AREA_FLOWS` map is the
implementation (areas: add-round, scorecard, save-round, players, results, complete-awards, help, theme, log, auth,
rls) and `tests/test-selection-pr17.test.ts` keeps the two honest. The full set still runs nightly, so selection
can only make a PR faster, never hide a failure for more than a night.

| Changed paths | Always | Added flows |
| --- | --- | --- |
| `supabase/migrations/**`, `supabase/tests/**`, `ci/db/**` | DB suite, unit | smoke 02, 04, 05, 06, 13, 16 (every flow that writes) |
| `utils/scoring.ts`, `utils/pool*.ts`, `utils/rummyDistribution.ts`, `utils/roundEntry.ts`, `utils/roundConfirms.ts` | unit | smoke 04, 13, 14, 16, full/80 |
| `app/(screens)/score-entry.tsx`, `components/game/**` (entry parts) | unit | smoke 03, 04, 14, 16, full/80, 21 (font) |
| `app/(screens)/games/[id].tsx`, `components/game/**`, `utils/scorecardLayout.ts`, `utils/dealerRotation.ts` | unit | smoke 02, 03, 10, 11, 13, 16, full/20, 21 |
| `app/(screens)/games/new.tsx`, `components/players/**`, `utils/initials.ts`, `utils/newGameDraft.ts`, `utils/gameSettings.ts` | unit | smoke 09, 16, full/31, 32 |
| `app/(screens)/results/**`, `components/results/**`, `utils/results*.ts`, `components/share/**`, `utils/share*.ts`, `web/**`, `public/**` | unit | smoke 06, 12, 15, full/40, 41, Playwright |
| `app/(screens)/games/complete.tsx`, `award.tsx`, `final-scores.tsx` | unit | smoke 05, 16, full/41 |
| `app/(tabs)/players.tsx`, `app/(screens)/players/**` | unit | smoke 08, full/33 |
| `app/(tabs)/me.tsx`, `profile.tsx`, `settings.tsx`, `components/account/**` | unit | smoke 07, full/10 |
| `constants/help.ts`, `utils/helpMarkup.ts`, `components/ui/HelpButton.tsx`, `app/(screens)/help/**` (PR 11) | unit | smoke 02, 06, full/50 |
| `constants/theme.ts`, `components/ui/**`, `components/SharedHeader.tsx` | unit | **whole smoke set** + screenshot regression |
| `services/**`, `utils/queryCache.ts`, `utils/gameCache.ts`, `app/_layout.tsx` | unit, DB | **whole smoke set** |
| `e2e/**` | — | the changed flow files + smoke 01 |
| `docs/**` only | unit (doc tests: testing-strategy codes, help tables, coverage) | none |
| `package.json`, `app.json`, `eas.json`, `.github/**` | everything | whole smoke set |

Rules as built (superseded in part by §2a below, Nov 26): (1) the whole smoke set always runs on an app change; (2) `[ui-all]` in the head commit message runs
every suite on the reference phone (labels cannot be set from the agent's read-only CLI, so the tag replaces the
`full-ui` label), `[tier:nightly]` / `[tier:prerelease]` run that tier on a PR, `[file-bugs]` lets a PR run open issues;
(3) a change under `ci/`, `.github/`, `e2e/` or the seeds runs every suite except full, plus the full flows that were edited, by name (the whole full set stays nightly); a docs-only change runs nothing on a device;
an app path outside the map runs smoke only; (4) the plan is printed in the `select` job summary.

## 2a. The PR plan since Nov 26 (Sree: "optimized for efficiency, speed, but then also thoroughness")

Before: an app PR ran the 25 smoke flows on one emulator (~40 min) **and** a second emulator re-ran the same 25 before
its few full flows, plus roles / chaos / two-device whenever a screen in their area changed. About an hour from push to green.

| What | Rule (all in `ci/select-tests.mjs`; `tests/test-selection-pr-shards.test.ts` pins it) |
| --- | --- |
| One smoke pass | The PR smoke gate is **two jobs, `smoke-a` and `smoke-b`**, on two emulators, each from the same seeded data. The selected full flows run **in the same job right after its smoke flows** (`run-suite.sh`: `SMOKE_FLOWS`, then `FLOW_FILTER`), so there is no separate PR `full` job. The nightly and pre-release `full` job is unchanged. |
| The shards | `SMOKE_SHARDS`: flows that build on an earlier flow share a shard and keep their order. **a** (13 flows, ~21 min): 01–06, 12, 15 (game A, then G's saved result), 07, 08, 09, 16, 19 (new games); full 10, 40, 41, 42, 61. **b** (12 flows, ~20 min): 13, 14, 18, 21, 23 (games E and H), 10, 11, 25 (F), 17, 20, 22, 24; full 20, 21, 30, 31, 32, 50 ×2, 51, 60, 70, 80. A test fails if a smoke or full flow is in no shard, in two, out of file order, or apart from the flow it needs. |
| Deep suites | chaos / roles / two-device run on a PR **only** when the diff touches `DEEP_AREAS`: sign-in (`(auth)`, `services/auth`, `me.tsx`), the database (`supabase/migrations|functions|rollback`: all three, whole sets), sync (`services/realtime`, `gameCache`: offline / kill / reconnect + two-device), a service that writes (`games`: rounds, completion, offline, kill + two-device; `players`; `archive`, `results`). Everything else is the nightly's. Infra changes (`ci/`, `.github/`, `e2e/`, seeds) still run every suite once. |
| Docs only | Nothing runs on a device when the diff vs base is docs only (as before) **or** when everything that changed since this PR's last green device run is `*.md` / `docs/` (`ci/since-green.mjs`: the newest earlier successful run of this branch whose `ui-…smoke…` jobs all passed, then `git diff` of its head against the new head). A rebase that pulls in only docs therefore costs nothing; if the old head cannot be found or fetched, or anything is odd, the plan runs as usual. `[ui-all]` always runs. |
| Cascade guard | `e2e/lib/ensure-signed-in.yaml` ends every flow's start on Home as `sree@test.local`: when Home greets somebody else ("Hi Ravi") or shows the login screen, `fix-account.yaml` logs out through Profile if needed and signs Sree in. The fast path is the one `when` check the file already had. |

Thoroughness is unchanged: every flow still runs in the nightly (full + chaos + roles + two-device + monkey on the
reference phone, smoke on three more devices) and in the pre-release tier; a PR can only be faster, never hide a
failure for more than a night.

| PR | Device jobs | Device wall clock after the APK (emulators in parallel) |
| --- | --- | --- |
| Docs only, or only docs since the last green run | none | 0 |
| Scorecard / screen change (no sign-in, database, sync or write service) | `smoke-a`, `smoke-b` (+ the area's full flows inside them) | ~30–32 min (was ~48 min) |
| Migration | `smoke-a`, `smoke-b`, chaos, roles, two-device | ~30–32 min (the others are shorter: roles ~8, two-device ~10, whole chaos ~20–25) |
| `ci/`, `.github/`, `e2e/` or seeds | smoke-a, smoke-b, chaos, roles, two-device, monkey | ~30–32 min |

Per job: ~8.5 min start-up (local Supabase, emulator, Maestro; measured on #143) + the shard's smoke (~20–21 min) +
its full flows (0–4 min). Push to green adds the ~8 min APK build before the emulators, so ~40 min instead of ~57.
A third shard would bring the device jobs to ~23 min; it is one more list in `SMOKE_SHARDS` (rebalance by the seconds in the test).

## 3. Flakiness policy

- A flow that fails twice in a week for a non-product reason moves to `e2e/known-bugs` (quarantined, still runs, does not block) with an issue; it leaves quarantine only with a fix, never by deletion.
- Retries: `ui-smoke` retries a failed flow once on the same emulator (Maestro `--retries 1`, to add); the second failure is real.
- Every smoke run uploads: screenshots, the hierarchy at the failing step, `adb logcat` from the last 500 lines, and (new) the `adb screenrecord` video of the flow.
