# EZ Score testing: inventory, gaps, plan, and the phone checklist

Research only. Nothing in this folder changes app code, CI, or the Supabase project. It documents how EZ Score (`rummy-home3/`, Expo SDK 54 / React Native 0.81, Supabase Pro project `gngcrplcldfiubvhcdin`, Android-first via EAS preview APKs) is tested today, what is not tested, what it would take to automate it, and what Sree and Harish should still do by hand on the next build.

Snapshot: branch `cursor/ezscore-apk-ready` at `859ee1c`, [PR #7](https://github.com/sreeatcandorps/RummyHome/pull/7), Nov 11, 2026. Unit suite re-run on this box: **231 pass / 0 fail**, `tsc` clean.

| Document | Answers |
|---|---|
| [`inventory.md`](inventory.md) | Every test file and script, what it covers, how to run it, where results are recorded, GitHub links |
| [`gap-analysis.md`](gap-analysis.md) | What is not tested: E2E, real auth and OTP, RLS and multi-user, concurrency, realtime, offline, native-only, performance, upgrades |
| [`automation-plan.md`](automation-plan.md) | Options with effort and cost: Maestro/Detox on an emulator (GitHub Actions or EAS Workflows), local or branch Supabase with seeded users, pgTAP RLS tests, visual regression, the per-workflow report |
| [`ai-vs-phone.md`](ai-vs-phone.md) | What agents can verify on the web preview or an emulator vs what needs a real phone |
| [`phone-checklist.md`](phone-checklist.md) | The ~60-minute two-phone run for Sree and Harish: only the cases automation cannot cover |

## The short version

**What exists.** 231 `node:test` tests (not Jest) in 30 files under `rummy-home3/tests/`, all pure logic plus regex "source checks" over `.tsx`/`.sql`; `tsc`; four live-Supabase scripts that cannot run against production as configured (they need confirm-email off); nine Maestro flows that were never run and are stale (wrong `appId`); web-preview screenshots taken by agents with Puppeteer in fixture mode, indexed in `rummy-home3/docs/CHECKLIST-NOV9.md`; one-off scratch-Postgres verification of migrations 013–017 whose scripts are not in the repo. **No CI**: `.github/workflows` does not exist; the only PR check is a skipped "Supabase Preview".

**Top gaps** (ranked by game-night risk):

1. No repeatable multi-user **RLS / RPC** test. The one P1 this cycle (fresh account saw everyone's results) was an RLS bug the client-side tests could not see. 016 and 017 are new security-definer functions awaiting the same one-off treatment.
2. **Nothing native has ever run.** Every open item on PR #7 is Android-only: first-tap keyboard, share-sheet return, view-shot image, expo-print PDF, LayoutAnimation, APK not reverting.
3. No **concurrency / dropped-connection** test for `save_round`, the cause of the blank round.
4. **Real auth** (confirmation email, recovery OTP via Resend, dashboard template) has only ever been exercised against a local fake.
5. Web screenshots are **not regenerable**, so UI drift is invisible until a phone pass.
6. Migration chain 001→017 and the rollbacks cannot be **replayed** by anyone.

**Recommended first moves** (each its own small PR; costs are $0 on this public repo):

1. GitHub Actions running `npm test` + `tsc` on every push.
2. `supabase/config.toml` + `seed.sql` + `supabase db reset` from empty + pgTAP RLS tests for results, game visibility, link-seat, remove-seat, candidates + a two-client concurrency script. This is what would have caught the P1.
3. Fix the Maestro flows (`appId: com.mindweavetech.rummyhome`, renamed labels) and run them on an Android emulator in Actions against the local Supabase.
4. A one-page per-workflow report on GitHub Pages, linked from each PR.

Details, alternatives (Detox, EAS Workflows, Supabase Branching, device farms) and what each does **not** catch are in [`automation-plan.md`](automation-plan.md).

## Commands (from `rummy-home3/`)

```bash
npm ci
npm test              # 231 tests, ~2 s, no network
npm run typecheck
npm run test:rls      # needs .env.local keys and a DB with confirm-email OFF (not production)
npx expo start --web  # fixture mode when EXPO_PUBLIC_SUPABASE_* are unset
```

## Links

- PR under test: https://github.com/sreeatcandorps/RummyHome/pull/7 · checks: https://github.com/sreeatcandorps/RummyHome/pull/7/checks
- Tests: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/tests
- Scripts: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/scripts
- Maestro flows: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/e2e
- Migrations: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/supabase/migrations
- Existing testing docs: [`testing-strategy.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/testing-strategy.md), [`auth-and-testing.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/auth-and-testing.md), [`rls-verification.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/rls-verification.md), [`CHECKLIST-NOV9.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/CHECKLIST-NOV9.md)
- Phone findings so far: https://github.com/sreeatcandorps/RummyHome/issues/8
