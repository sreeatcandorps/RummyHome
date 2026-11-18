# Automation plan: options, effort, cost

Goal: Sree stops being the test harness. Each option below says what it would catch from [`gap-analysis.md`](gap-analysis.md), what has to be built, what it costs to run, and what it does not do. Effort is described by the pieces that must change, not by calendar time. Prices are list prices as of this writing; check the vendor pages before committing.

Facts that shape the choices:

- The repo is **public**, so GitHub Actions minutes on standard hosted runners (`ubuntu-latest`, 4 vCPU, KVM enabled) are free. macOS runners are also free for public repos but queue longer.
- Supabase project `gngcrplcldfiubvhcdin` is on **Pro**, which is the plan that includes Branching. The GitHub integration is already installed (the skipped "Supabase Preview" check on PR #7 is it).
- There is no `supabase/config.toml` in the repo (the `supabase/` folder is under `rummy-home3/`, not the root), so neither `supabase start` nor Branching can run yet.
- The 9 Maestro flows are stale and use the wrong `appId`.
- The unit runner is `node:test`, not Jest. Rendered-component tests would mean adding Jest (`jest-expo`) or keeping `node:test` and only testing pure logic.

## Recommended shape (summary)

| # | Piece | Catches | Cost to run | Build effort |
|---|---|---|---|---|
| A | **CI on every push**: `npm test` + `tsc` in GitHub Actions | Regressions nobody ran the tests for; gives PR checks | $0 (public repo) | One workflow file |
| B | **Local Supabase in CI** (`supabase start`) + full 001→017 apply + pgTAP RLS tests + a multi-user RPC script | The P1 results leak class; 016/017 before they reach prod; migration chain breaks | $0 (Docker on the runner) | `config.toml`, `seed.sql`, ~10 pgTAP files, port `friday-rls.mjs` to local + extend to 013–017 RPCs |
| C | **Concurrency script** against local Supabase | Two saves of the same round, double declare, add-seat during save | $0 | One Node script, ~6 scenarios |
| D | **Maestro on an Android emulator in GitHub Actions** | Keyboard, back button, LayoutAnimation, share-sheet open, picker/scoring/complete flows on real Android | $0 on hosted runners; ~15–25 min per run | Fix the 9 flows, write ~15 more, a `test` build profile or on-runner Gradle build, emulator workflow |
| D′ | Same flows via **EAS Workflows** (`maestro` job) | Same as D, on Expo's infrastructure, reuses the EAS build | Consumes EAS plan credits; Free plan is thin, Starter ≈ $19/mo, Production ≈ $99/mo (expo.dev/pricing) | One `.eas/workflows/*.yml`; no emulator plumbing |
| E | **Playwright on Expo web** with committed screenshot baselines | UI drift between screenshots; replaces ad hoc Puppeteer | $0 | Playwright config, ~20 specs, baseline PNGs |
| F | **Per-workflow report** on GitHub Pages + PR job summary | Sree sees one page per build: workflow × layer, with screenshots and videos | $0 | Enable Pages, a small HTML/Markdown generator step |
| G | **Supabase preview branch per PR** | Agents and Sree test against a throwaway DB with the PR's migrations already applied | ≈ $0.01344/hour per branch (≈ $0.32/day while open; branches are deleted on merge/close) | Move/duplicate `supabase/` to repo root or set the integration's directory path; `seed.sql`; Pages/EAS env pointing at the branch |
| H | **Real-device farm** (optional) | Vendor-specific keyboards, OEM share sheets, OTP autofill | Maestro Cloud / BrowserStack / Firebase Test Lab — paid per minute or per run; small free quotas | Only after D is green |

Order of value for this product: **B + C** (security and scoring correctness, cheap), then **A** (so B and C actually run), then **D** (native), **F** (so Sree can see it), **E**, **G**, **H**.

> **Status (Nov 11):** A, B and C are implemented in this PR, plus the job-summary half of F. See [`ci.md`](ci.md) for the files, the report and the bugs found. Differences from the plan below: pgTAP role switching is hand-rolled in `seed.sql` (`tests.login(uuid)`), not the dbdev helper extension; the concurrency script uses two raw Postgres connections (`pg`) instead of two `supabase-js` clients, so it does not need the API container or anon key and can also run without Docker; the `friday-rls.mjs` port (step B.5) is not done.

## A. CI for what already exists

- `.github/workflows/ci.yml`: checkout, `node 22`, `npm ci` in `rummy-home3`, `npm test`, `npm run typecheck`, `npx expo-doctor`. Upload the TAP output as an artifact. *(Implemented without `expo-doctor`, which needs network access to the Expo API and is a version-nag rather than a test.)*
- Adds PR status checks to [#7](https://github.com/sreeatcandorps/RummyHome/pull/7) and every future PR; ~2 minutes per run.
- Does not catch anything new; it makes the 231 tests a gate instead of a claim in a PR description.

## B. Local Supabase: schema, RLS, multi-user RPCs

**Build**

1. `supabase init` to get `config.toml`; set `[auth.email] enable_confirmations = false`, `[auth] minimum_password_length = 6`, `password_requirements = ""` so the 6-digit passcode and the smoke scripts work; `[db] major_version = 17` to match the hosted project (confirm in the dashboard; scratch verification so far used 16).
2. Keep `rummy-home3/supabase/migrations/001…017` as they are. The CLI accepts `^[0-9]+_name.sql`; zero-padded numbers sort correctly. `supabase db reset` applies the chain from empty and fails loudly if 011→012→… is broken.
3. `supabase/seed.sql`: four or five users created directly in `auth.users` with known UUIDs and the bcrypt of `123456` (or via `supabase.auth.admin.createUser` from a seed script), plus profiles, one game with each role (creator-not-playing, admin, player, viewer), an unregistered placeholder seat, a completed game with a declared result, a closed game.
4. **pgTAP** in `supabase/tests/*.sql`, run with `supabase test db`. Pattern per test: `select tests.authenticate_as('player')` (from the `basejump-supabase_test_helpers` extension via dbdev, or a hand-rolled `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`), then `results_eq` on the RPC. Suggested files:
   - `rls_games_visibility.sql` — every role × `list_visible_game_ids`, direct `select` on `games`
   - `rls_rounds_scores.sql` — player cannot insert; admin can; `save_round` duplicate, replace, empty-round reuse
   - `rls_results.sql` — 013 readers for stranger, seated, creator-only, declarer, spectator (= nothing)
   - `rls_profiles.sql` — 011 profile visibility (own, managed, played-with)
   - `rpc_link_seat.sql` — 015/017 matrix: non-admin, already seated, non-playing admin takes seat, viewer takes seat, outsider, self-link no `my_players` row
   - `rpc_remove_seat.sql` — 016 matrix: non-zero blocked, all-zero removed, two-player guard, closed guard
   - `rpc_candidates.sql` — `list_new_game_candidates` / `list_my_players` and the organiser (`auth.uid()`) rule, so the Nov 10 bug class has a server-side test
   - `public_scorecard.sql` — anon with right and wrong token
   - `rollbacks.sql` — apply `rollback_017`, assert the 015 body, re-apply 017
5. Port `scripts/friday-rls.mjs` to run against `http://127.0.0.1:54321` (URL and anon key from `supabase status -o env`) and extend it through the 013–017 RPCs with real `supabase-js` clients. This is the client's-eye view that pgTAP cannot give (PostgREST, JWT refresh, error codes like `PGRST202`).
6. Workflow job: `supabase start` (Docker is present on `ubuntu-latest`), `supabase db reset`, `supabase test db`, `node scripts/rls-local.mjs`. Roughly 4–6 minutes.

**Catches**: the results leak, a wrong grant on a security-definer function, a migration that no longer applies from empty, a broken rollback, an RPC that excludes the caller.

**Does not catch**: dashboard-only settings on the hosted project (SMTP, templates, Realtime publication membership, rate limits). Those need G or a manual check.

**Cost**: $0.

## C. Concurrency and dropped-connection script

Against the same local stack: two `supabase-js` admin clients, `Promise.all` on `save_round` for the same `round_number` with different payloads; assert exactly one live round and the loser gets a clean error. Same for Edit round vs Add round, Declare × 2, `remove_seat_if_no_scores` while a save is in flight, and a save whose HTTP request is aborted after send (use an `AbortController` on fetch) followed by a retry. Six scenarios, one file, runs in seconds. Attach to the B job.

## D. Maestro on an Android emulator (GitHub Actions)

**Why Maestro and not Detox here**: Maestro is black-box YAML that agents can write and read, needs no native test harness in the app, and can drive the same APK EAS already produces. Detox needs a dedicated build with its native runner (via `@config-plugins/detox`), a Gradle build on the runner every time, and Jest; it is better at flake-free synchronisation but costs far more setup for a Paper + Expo Router app.

**Build**

1. **The APK under test must point at a test database**, not production. Two ways:
   - *EAS `test` profile*: copy `preview`, set `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` to a Supabase preview branch (G) or a long-lived "test" project. Build once per PR with `eas build --profile test --platform android --non-interactive --json`, download `applicationArchiveUrl`. Uses EAS build credits (Free plan: a small monthly quota, long queues; Starter plan removes the queue).
   - *On-runner build*: `npx expo prebuild --platform android && ./gradlew assembleRelease` with the env pointing at `http://10.0.2.2:54321` (the emulator's alias for the runner's localhost, so the B stack is the backend). ~15–20 minutes of free runner time, no EAS credits, fully self-contained. Recommended first.
2. `reactivecircus/android-emulator-runner@v2`, API 34, `x86_64`, `google_apis`, cache the AVD snapshot. Boot ≈ 2–3 minutes cached.
3. `curl -Ls https://get.maestro.mobile.dev | bash`, then `maestro test --format junit --output report.xml e2e/`, with `--debug-output` so every failed step keeps a screenshot. Record video with `adb shell screenrecord` in the background and upload it as an artifact.
4. Fix the flows: `appId: com.mindweavetech.rummyhome`; "Add new players"; "My players"; drop the dead "Declare results" and "Settling coins" asserts; add `testID`s to the fast-moving screens so flows select by id, not copy (`tapOn: { id: "save-round" }`).
5. Write one flow per workflow in the phone checklist: sign in / wrong passcode / forgot (through the OTP step using the local mail catcher — local Supabase ships Inbucket/Mailpit at `:54324` and the OTP can be read from its REST API), new game with 4 players incl. "+ Add me", score 3 rounds with a Rummy, Edit round, mid-game add, remove a zero-score seat, invite share sheet opens (assert the Android chooser is visible), link seat by Player ID, complete game, results declare, share final scores image (assert the chooser), PDF (assert the chooser; the file itself is checked by `adb pull`). Use `pressKey: Back` in each flow at least once.
6. Two-user flows: start a second emulator or run the second user through `supabase-js` from a Node step while Maestro drives the first phone; assert the realtime update appears (`extendedWaitUntil` on the new round cell).

**Catches**: first-tap keyboard, autofocus, back button, LayoutAnimation crashes, share-sheet open and return (the Android chooser is a real Activity in the emulator), view-shot and expo-print producing files, deep link `rummy-home3://claim?t=` via `openLink`, realtime arrival with a second client.

**Does not catch**: OEM keyboards (Samsung), OTP autofill from the real notification, Resend email delivery, physical-device performance, Play Store install. Those stay on the phone list or move to H.

**Cost**: $0 on hosted runners for a public repo. Runtime ≈ 20–30 minutes per full run including the Gradle build; run on PRs touching `rummy-home3/` and nightly.

## D′. Same flows through EAS Workflows

`.eas/workflows/e2e.yml` with a `build` job (profile `test`) followed by a `maestro` job (`type: maestro`, `flow_path: rummy-home3/e2e`). Expo provisions the emulator and installs the APK. Less plumbing than D, results in the Expo dashboard, and the same flows. It spends EAS credits per minute, so it is the better choice if Sree already pays for Starter or Production; otherwise D is free. The backend question is the same: the `test` profile must point at a branch or test project, never production.

## E. Visual regression on Expo web

Replace the ad hoc Puppeteer runs with Playwright specs committed under `rummy-home3/e2e-web/`: `npx expo export --platform web` once, `npx serve dist`, then `page.goto` each route in fixture mode at 390×844 and `expect(page).toHaveScreenshot('home.png', { maxDiffPixelRatio: 0.01 })`. Baselines live in the repo; a diff fails the job and uploads the actual/expected/diff trio. Also drive the auth flows against the GoTrue fake the agents already used, now committed as `e2e-web/fake-gotrue.mjs`.

Catches layout drift, copy changes, colour regressions (the Add round palette is tested by regex today). Does not catch anything native. $0. Paid alternatives (Percy, Chromatic) add a review UI and ~5,000 free snapshots a month; not needed at this scale.

## F. The report Sree opens

**Where**: GitHub Pages for this repo (not enabled yet; enable it from the Actions deploy source), published by the nightly/PR workflow to `https://sreeatcandorps.github.io/RummyHome/testing/` with one folder per run (`/testing/2026-11-12-run-123/`) and `/testing/latest/`. The same summary is written to the PR with `$GITHUB_STEP_SUMMARY`, so the PR "Checks" tab shows it without leaving GitHub.

**What it looks like**: one page, one table.

| Workflow | Unit | DB / RLS | Concurrency | Emulator (Maestro) | Web visual | Phone (manual) | Evidence |
|---|---|---|---|---|---|---|---|
| Sign in and reset | ✅ 14 | ✅ 3 | — | ✅ 4 flows | ✅ 6 shots | ☐ Sree Nov 12 | video, shots |
| New game | ✅ 23 | ✅ 2 | — | ✅ 3 | ✅ 4 | ☐ | … |
| Scoring | ✅ 41 | ✅ 5 | ✅ 3 | ✅ 4 | ✅ 5 | ☐ | … |
| Mid-game add / remove | ✅ 12 | ✅ 6 | ✅ 1 | ✅ 2 | ✅ 3 | ☐ | … |
| Invites and registration | ✅ 10 | ✅ 2 | — | ✅ 2 | ✅ 2 | ☐ | … |
| Link a Player ID | ✅ 8 | ✅ 7 | — | ✅ 1 | ✅ 1 | ☐ | … |
| Results | ✅ 30 | ✅ 5 | ✅ 1 | ✅ 2 | ✅ 4 | ☐ | … |
| Share and PDF | ✅ 15 | — | — | ✅ 3 | ✅ 2 | ☐ | … |
| Two users at once | ✅ 9 | ✅ 8 | ✅ 6 | ✅ 2 | — | ☐ | … |

Each cell links to the JUnit/TAP detail; the Emulator cell links to the screen recording and the last-step screenshot; the Web cell to the baseline/actual/diff; the Phone cell is a checkbox list Sree ticks in the GitHub issue for that build (the report links to it). A red cell carries the first failing assertion text, so the question "is build 6 safe for Friday" is answered from one page. Counts above are illustrative of the mapping from today's test files to workflows; the generator would compute them from test names tagged `[workflow:scoring]` or from the file-to-workflow map in `docs/testing/workflow-map.json`.

**Build**: a Node step that reads the JUnit XML from Maestro, the TAP from `node:test`, the pgTAP output and the Playwright JSON, writes `index.html`, and `actions/upload-pages-artifact` + `actions/deploy-pages`. $0.

## G. Supabase preview branch per PR

The GitHub integration is installed but skips because it cannot find `supabase/config.toml` at the configured directory and the PR does not target the production git branch. To make it work: add `config.toml` (from B), set the integration's "Supabase directory path" to `rummy-home3/supabase`, set the production branch to `main`, and open PRs against `main` (today PR #7 targets `cursor/add-round-redesign-0a03`). Each PR then gets a branch database with the PR's migrations applied and `seed.sql` loaded, and the check turns green or red on migration errors. Point the EAS `test` profile or the web preview at the branch URL from the check's details.

Catches migration failures against the hosted Postgres version and gives agents a real, disposable Supabase to screenshot against instead of fixture mode. Branch databases do **not** contain production data; auth settings follow `config.toml`, so the confirm-email problem disappears for tests. ≈ $0.01344 per branch-hour while open; the integration deletes branches on PR close.

## H. Real devices (later)

- **Maestro Cloud**: upload the APK and the same flows; runs on hosted Android devices and emulators, with videos and a dashboard. Paid per flow run after a trial.
- **Firebase Test Lab**: Robo crawl and instrumentation on real Pixels/Samsungs; a small free daily quota on Spark, then about $5 per physical-device hour and $1 per virtual hour. Does not run Maestro directly; useful for a crash-on-launch matrix across Android versions.
- **BrowserStack App Automate / App Live**: real devices by the minute; App Live lets Sree hand-test on a Samsung without owning one.

None of these replace the phone checklist for OEM keyboards and the real Resend email; they shrink it.

## What to do first (one PR each, all reversible)

1. ~~`ci.yml` with unit + tsc (A).~~ Done in this PR.
2. ~~`config.toml` + `seed.sql` + `supabase db reset` + pgTAP files and the concurrency script (B, C).~~ Done in this PR (nine pgTAP files, 163 tests; seven concurrency scenarios), with the job-summary report from F. The file-to-workflow map lives at `ci/report/workflow-map.json`.
3. Fix the Maestro flows and run them on the emulator with the on-runner build (D). Keep the first run to sign-in, new game, three rounds, complete.
4. Pages report (F): the job-summary half exists; publishing `report.md` per run to Pages is what is left.
5. Playwright baselines (E), then Branching (G).
