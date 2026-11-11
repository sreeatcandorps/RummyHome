# EZ Score testing: inventory, gaps, plan, and the phone checklist

This folder documents how EZ Score (`rummy-home3/`, Expo SDK 54 / React Native 0.81, Supabase Pro project `gngcrplcldfiubvhcdin`, Android-first via EAS preview APKs) is tested today, what is not tested, what it would take to automate it, and what Sree and Harish should still do by hand on the next build. No app feature code and nothing on the hosted Supabase project is changed by this PR; the CI it adds runs against a throw-away local database.

Snapshot: branch `cursor/ezscore-apk-ready` at `859ee1c`, [PR #7](https://github.com/sreeatcandorps/RummyHome/pull/7), Nov 11, 2026. Unit suite re-run on this box: **231 pass / 0 fail**, `tsc` clean.

**Status:** steps 1 and 2 of the plan below are implemented in this PR — see [`ci.md`](ci.md) for the workflow, the report Sree reads, and the four server-side bugs the new database tests found (recorded as known failures, not fixed).

| Document | Answers |
|---|---|
| [`ci.md`](ci.md) | **What CI runs now**, how to read the per-workflow report, what the pgTAP and concurrency tests cover, the bugs they found, how to run it locally |
| [`inventory.md`](inventory.md) | Every test file and script, what it covers, how to run it, where results are recorded, GitHub links |
| [`gap-analysis.md`](gap-analysis.md) | What is not tested: E2E, real auth and OTP, RLS and multi-user, concurrency, realtime, offline, native-only, performance, upgrades |
| [`automation-plan.md`](automation-plan.md) | Options with effort and cost: Maestro/Detox on an emulator (GitHub Actions or EAS Workflows), local or branch Supabase with seeded users, pgTAP RLS tests, visual regression, the per-workflow report |
| [`ai-vs-phone.md`](ai-vs-phone.md) | What agents can verify on the web preview or an emulator vs what needs a real phone |
| [`phone-checklist.md`](phone-checklist.md) | The ~60-minute two-phone run for Sree and Harish: only the cases automation cannot cover |

## The short version

**What exists.** 231 `node:test` tests (not Jest) in 30 files under `rummy-home3/tests/`, all pure logic plus regex "source checks" over `.tsx`/`.sql`; `tsc`; four live-Supabase scripts that cannot run against production as configured (they need confirm-email off); nine Maestro flows that were never run and are stale (wrong `appId`); web-preview screenshots taken by agents with Puppeteer in fixture mode, indexed in `rummy-home3/docs/CHECKLIST-NOV9.md`; one-off scratch-Postgres verification of migrations 013–017 whose scripts are not in the repo. Before this PR there was **no CI**; the only PR check was a skipped "Supabase Preview".

**What this PR adds** ([`ci.md`](ci.md)): `.github/workflows/ci.yml` on every push/PR plus a nightly run of PR 7 and `main`; the 231 tests and `tsc`; a local Supabase (`supabase/config.toml`, `seed.sql` with eight users) where migrations 001→017 are applied from empty, the five rollbacks are replayed and re-applied, 163 pgTAP tests cover RLS/privacy/014/016/017/public scorecard, and a two-connection script races `save_round`; and one per-workflow report in the job summary and as an artifact.

**Top gaps** (ranked by game-night risk, with what changed):

1. ~~No repeatable multi-user **RLS / RPC** test.~~ Now covered server-side by pgTAP (02–09). The first run found a privilege-escalation hole (`profiles.role` is user-writable) and a profile-privacy gap; both are reported as known failures and still need a migration.
2. **Nothing native has ever run.** Every open item on PR #7 is Android-only: first-tap keyboard, share-sheet return, view-shot image, expo-print PDF, LayoutAnimation, APK not reverting. Unchanged.
3. ~~No **concurrency / dropped-connection** test for `save_round`.~~ Seven scenarios now run in CI; two known failures (raw `23505` to the losing admin; orphan zero row after a racing seat removal).
4. **Real auth** (confirmation email, recovery OTP via Resend, dashboard template) has only ever been exercised against a local fake. Unchanged.
5. Web screenshots are **not regenerable**, so UI drift is invisible until a phone pass. Unchanged.
6. ~~Migration chain 001→017 and the rollbacks cannot be **replayed**.~~ Replayed on every run.

**Next moves** (each its own small PR; costs are $0 on this public repo):

1. ~~GitHub Actions running `npm test` + `tsc` on every push.~~ Done.
2. ~~Local Supabase + pgTAP + concurrency script.~~ Done. Follow-up: a migration 018 that locks `profiles.role` and tightens `can_see_profile`, and a `save_round` change that treats a losing race as "already saved".
3. Fix the Maestro flows (`appId: com.mindweavetech.rummyhome`, renamed labels) and run them on an Android emulator in Actions against the local Supabase.
4. Publish the per-workflow report (already produced per run) to GitHub Pages so there is one URL per build.

Details, alternatives (Detox, EAS Workflows, Supabase Branching, device farms) and what each does **not** catch are in [`automation-plan.md`](automation-plan.md).

## Commands (from `rummy-home3/`)

```bash
npm ci
npm test              # 231 tests, ~2 s, no network
npm run typecheck
npm run test:rls      # needs .env.local keys and a DB with confirm-email OFF (not production)
npx expo start --web  # fixture mode when EXPO_PUBLIC_SUPABASE_* are unset
```

Database suite without Docker (this is what the cloud-agent VM runs; see [`ci.md`](ci.md)):

```bash
PSQL="sudo -u postgres psql" DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/ezscore_test ci/db/local-run.sh
node ci/report/build-report.mjs
```

## Links

- CI runs: https://github.com/sreeatcandorps/RummyHome/actions/workflows/ci.yml · workflow: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
- PR under test: https://github.com/sreeatcandorps/RummyHome/pull/7 · checks: https://github.com/sreeatcandorps/RummyHome/pull/7/checks
- Tests: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/tests
- Scripts: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/scripts
- Maestro flows: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/e2e
- Migrations: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/supabase/migrations
- Existing testing docs: [`testing-strategy.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/testing-strategy.md), [`auth-and-testing.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/auth-and-testing.md), [`rls-verification.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/rls-verification.md), [`CHECKLIST-NOV9.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/CHECKLIST-NOV9.md)
- Phone findings so far: https://github.com/sreeatcandorps/RummyHome/issues/8
