# Automation tiers and change-based selection (PR 16 test plan, part 4)

## 1. Tiers

| Tier | Runs | Time budget | Contents | Blocks merge? |
| --- | --- | --- | --- | --- |
| T0 Pre-commit (local) | every commit, agent or Sree | < 60 s | `npx tsc --noEmit`, `npm test` (483 unit tests), lint for `Alert.alert` / tokens (DC15-1) | yes (agent discipline) |
| T1 PR | every push to a PR | < 15 min wall | T0 + DB suite (33 pgTAP files, rollback replay, concurrency script) + **ui-smoke** on D1 (16 flows, portrait + landscape) + coverage test T16-1 + Playwright `/r/` pages (T16-6) | **yes** |
| T2 Nightly | 09:00 UTC on `cursor/ezscore-apk-ready` and `main` (today), plus the top of the stack (new) | < 90 min | T1 + `ui-full` (13 flows + known-bugs) on D1–D4, dark / font / offline axes, **role runs** (every R cell in the matrix), screenshot regression (12 key screens vs the approved set), volume script at the small sizes | no, but red nightly = no APK |
| T3 Pre-APK | before each milestone APK | half a day of machine time | T2 + volume at full sizes (`docs/volume-testing.md`), chaos set (C16-x), Robo / monkey on Firebase Test Lab real devices, **manual two-phone pass** (M cells) on D5 | yes for the APK |
| T4 Weekly / on demand | Sunday, or `workflow_dispatch` | hours | 10,000-player roster, 500-round games, 30 × 20 result, soak (one emulator adding a round every 20 s for 2 hours), fuzz with the big-number and bad-input corpus | report only |

Today: T0 and T1 exist (without Playwright, coverage test, role runs); T2 exists for D1 only; T3 is the manual
`two-phone-nov11.md` pass plus the volume script run by hand; T4 does not exist.

## 2. Change-based selection (what runs when)

A small script (`ci/select-tests.mjs`, to write) reads the PR diff and emits the flow list for `ui-smoke`. The full set
still runs nightly, so selection can only make a PR faster, never hide a failure for more than a night.

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

Rules: (1) `smoke/01` (sign in + Home) always runs because every flow depends on it; (2) a PR label `full-ui` forces the
full set; (3) if the selector cannot classify a path it falls back to the whole smoke set; (4) selection is logged in the
job summary so a skipped flow is visible.

## 3. Flakiness policy

- A flow that fails twice in a week for a non-product reason moves to `e2e/known-bugs` (quarantined, still runs, does not block) with an issue; it leaves quarantine only with a fix, never by deletion.
- Retries: `ui-smoke` retries a failed flow once on the same emulator (Maestro `--retries 1`, to add); the second failure is real.
- Every smoke run uploads: screenshots, the hierarchy at the failing step, `adb logcat` from the last 500 lines, and (new) the `adb screenrecord` video of the flow.
