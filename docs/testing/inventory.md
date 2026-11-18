# Testing inventory (as of Nov 11, 2026, branch `cursor/ezscore-apk-ready`, head `859ee1c`)

Every check that exists today, what it covers, how to run it, and where its result ends up. Links point at the branch under review ([PR #7](https://github.com/sreeatcandorps/RummyHome/pull/7)).

Verified on this build box on Nov 11: `node --import tsx --test tests/*.test.ts` → **231 pass, 0 fail, ~2 s**; `npx tsc --noEmit` → clean.

## 1. Layers at a glance

| Layer | Runner | Needs | Runs today | Result recorded in |
|---|---|---|---|---|
| Unit and logic (`tests/*.test.ts`) | Node `node:test` via `tsx` (not Jest; `package.json` has no Jest) | nothing (no network) | by every agent before a push | PR description text, `docs/CHECKLIST-NOV9.md`; **CI from this PR on** ([`ci.md`](ci.md)) |
| Type check | `tsc --noEmit` | nothing | by every agent | PR description text |
| Source-shape checks | same `node:test` files; regex over `.tsx` and `.sql` source | nothing | with `npm test` | same |
| Migration SQL checks on local Postgres | ad hoc `psql` against a scratch Postgres 16 loaded with 001–0NN | Docker or a local Postgres on the agent VM | per migration, by hand, by the agent that wrote it | prose in the PR description and `docs/migrations-to-apply.md`; **scripts not committed** |
| Live Supabase scripts (`test:smoke`, `test:game-flow`, `test:rls`, `test:nightly`) | Node scripts with `supabase-js` | `.env.local` with the project URL and anon key | not from cloud agents (no keys on the box); `docs/auth-and-testing.md` describes them as a PowerShell loop on the owner's PC; no record of a run in the current cycle | terminal output only |
| Web preview screenshots | Expo web (`npx expo start --web`) driven by Puppeteer, 390×844 | Chrome on the agent VM; fixture mode (no Supabase env) or a local GoTrue fake | per feedback batch, by the agent | `/opt/cursor/artifacts/...` (attached to the PR), indexed in `docs/CHECKLIST-NOV9.md` |
| Maestro flows (`e2e/*.yaml`) | Maestro CLI on an Android device/emulator | an APK and a device | **never run** (written Nov 4, stale) | — |
| Manual phone pass | Sree and testers on real Android phones | preview APK from EAS | per build (builds 2, 3, 4, 5 so far) | GitHub [issue #8](https://github.com/sreeatcandorps/RummyHome/issues/8), WhatsApp/notes, then PR description |
| CI / PR checks | **Before this PR:** none (`.github/workflows` did not exist). **This PR adds** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml): unit + tsc, local Supabase with pgTAP and a concurrency script, per-workflow report ([`ci.md`](ci.md)) | the DB job needs Docker (GitHub runner) | every push/PR, nightly on PR 7 and `main` | Job summary and `test-report-*` artifact per run; before this the only check on PR #7 was **Supabase Preview**, status *skipped* ([checks tab](https://github.com/sreeatcandorps/RummyHome/pull/7/checks)) |

The result record is therefore: the PR description on [#7](https://github.com/sreeatcandorps/RummyHome/pull/7) (test counts per batch), [`rummy-home3/docs/CHECKLIST-NOV9.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/CHECKLIST-NOV9.md) (screenshot index), and [`docs/migrations-to-apply.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/migrations-to-apply.md) (what was scratch-verified per migration). CI runs now live at https://github.com/sreeatcandorps/RummyHome/actions/workflows/ci.yml.

## 2. Commands

All from `rummy-home3/`:

```bash
npm ci                                   # once
npm test                                 # node --import tsx --test tests/*.test.ts  (231 tests, ~2 s)
npm run typecheck                        # tsc --noEmit
node --import tsx --test tests/passcode.test.ts   # one file

# Live project (need EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local)
npm run test:smoke                       # scripts/supabase-smoke.mjs  — signup/login API round trip
npm run test:game-flow                   # scripts/game-flow-smoke.mjs — two users, game, round, undo, complete, history
npm run test:rls                         # scripts/friday-rls.mjs      — five throwaway accounts, who sees / who scores / public token
npm run test:nightly                     # validate:env + typecheck + test + smoke + game-flow
npm run db:seed-test-users               # player1..player10@rummyhome.com / 123456 (needs confirm-email OFF)
npm run db:list-users                    # needs SUPABASE_SERVICE_ROLE_KEY

# Web preview (what agents screenshot)
npx expo start --web                     # fixture mode when the Supabase env vars are unset

# Maestro (never run yet; see staleness notes below)
maestro test e2e/
```

## 3. Unit and logic tests, file by file

30 files, 231 tests. "Source check" means the test reads a `.tsx`/`.sql`/`.html` file and asserts on its text (a cheap guard that a screen still wires a thing up; it does not render anything).

| File | Tests | Covers | Kind |
|---|---:|---|---|
| [`app-version.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/app-version.test.ts) | 7 | Version label on Home and Help; `app.config.js`/`eas.json` keep EAS Update off for preview APKs; version bumped; auto-increment | logic + config file read |
| [`auth-errors.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/auth-errors.test.ts) | 3 | `formatAuthError`: network, invalid credentials, unconfirmed email wording | logic |
| [`build3.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/build3.test.ts) | 9 | Home default chip, My players sort, status labels, initials rule, organiser not auto-seated, phone normalisation, Add round cell tones, help copy shape, settings ladder | logic |
| [`build4.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/build4.test.ts) | 10 | Home help chips, Results help, `BoldName` segments, My players filters, picker sort, shared new-game draft, Add round palette, Edit round ordering, Results default ticks, result warnings | logic |
| [`degrade.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/degrade.test.ts) | 3 | "Not available yet" message has no SQL; public scorecard HTML has placeholders not keys; 011/012 SQL are re-runnable (text checks) | logic + source check |
| [`demo-data.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/demo-data.test.ts) | 6 | Demo seed reuses a named player, seeded games validate, admin allowlist, seed payload tags, clear keeps signed-in player | logic |
| [`final-scores.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/final-scores.test.ts) | 6 | Final scores sheet heading/footer/times/5-per-row cells/sort; completion check; scorecard and final-scores screens never say Results | logic + source check |
| [`friday.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/friday.test.ts) | 9 | `gameVisibleToUser`, `canEnterScores` role matrix (client copy of the RLS rule), share token shape, reset URL not localhost, prize session maths | logic |
| [`game-players.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/game-players.test.ts) | 8 | Role/registration tags, per-player menu rules, link-target checks (incl. Nov 10 viewer/non-playing-admin), joiner zeros, Players page has no remove/view-only/non-player-admin, 015 and 017 SQL shape, rollback text, doc mentions 017 | logic + source check |
| [`home-and-players.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/home-and-players.test.ts) | 8 | Home split live/recent, Recent chips, numeric Player ID badge, My players sort/grid, database results ordering, queued players seated on return, help copy | logic |
| [`home-recent.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/home-recent.test.ts) | 5 | Recent ordering by completion time, fallbacks, deterministic ties, Last-10-days window, reopen rule | logic |
| [`nov10-menu.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/nov10-menu.test.ts) | 2 | `headerMenuReducer` remounts Paper `Menu` on every close (the dead ⋮ bug); scorecard/score-entry key the menu off the hook | logic + source check |
| [`nov10-midgame.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/nov10-midgame.test.ts) | 4 | `sortFinalScores`, Complete screen uses it, "Pending registration" label everywhere, mid-game add copy/counter/yellow-for-new | logic + source check |
| [`nov10-owner.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/nov10-owner.test.ts) | 6 | Root cause of "owner missing" (sort pushes organiser off the ten-row page), `pinOrganiser`, `withOwnerFirst`, "+ Add me"/"You", My players three tiles, red-loss styling | logic + source check |
| [`nov10-speed.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/nov10-speed.test.ts) | 2 | `gameCache` semantics (per game, refreshed by reads, cleared on sign out); scorecard does not double-fetch | logic + source check |
| [`passcode.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/passcode.test.ts) | 14 | 6-digit rule, OTP field attributes, PasscodeField first-tap fix (source), change-flow OTP guard, app-only recovery template, every server message mapped to passcode wording, full reset/change flows against a fake `PasscodeAuthClient` incl. wrong/expired/reused code, server failure after verify, reauthentication nonce | logic + fake client + source check |
| [`player-identity.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/player-identity.test.ts) | 23 | Picker ordering/recency/grid refill, stepper, email/zip normalisation, status transitions, Player ID parse/sequence/backfill, claim tokens (128-bit, hashed), share message, re-share revokes, 14-day expiry, Yes single-use, Not me, ID claim request/approve, rate limit, two creators merge, Unlink, remap, drop rules, two-name requirement | logic (pure functions mirroring the SQL) |
| [`player-initials.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/player-initials.test.ts) | 7 | Initials derivation and collision numbering; results label by first appearance | logic |
| [`redesign.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/redesign.test.ts) | 8 | Find vs My-list search modes, local day, admin settle rule, Settle hidden, prize balances/legs, invite is the get page | logic |
| [`results-layout.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/results-layout.test.ts) | 7 | Unique players, share image breakdown up to 5 and up to 20 games, card marks top three, PDF rounds per game, PDF single-column layout, legend wrap | logic |
| [`results-picker.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/results-picker.test.ts) | 5 | Status derivation, multi-select chips, heading, selection = ticked ∩ shown, empty text | logic |
| [`results-privacy.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/results-privacy.test.ts) | 4 | `canSeeResult` client rule; stranger sees nothing; public-link watcher is not a member; 013 SQL routes every reader through `can_see_game_result` | logic + source check |
| [`results.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/results.test.ts) | 14 | Totals across games, tied places, left/right split, dash vs 0, column sizing, 50/15 limits, share image text, full details, declare rule, h:mm headers, show-results save rule, Closed games selectable, past results shape, PDF filename | logic |
| [`round-entry.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/round-entry.test.ts) | 27 | The score-entry reducer: multi-select, presets, sign toggle, explicit 0, pending digits, auto-save on move, edit filled cell, X clear, Rummy split (even/uneven/follows changes), Save gate on balance, validation | logic |
| [`rummy-distribution.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/rummy-distribution.test.ts) | 7 | `distributeRummyWinnings` balances to zero in every case | logic |
| [`runtime-fixes.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/runtime-fixes.test.ts) | 5 | UUID helper, clock-skew and invalid-uuid error mapping, `withTimeout`, smoke-email filter | logic |
| [`scorecard-sheet.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/scorecard-sheet.test.ts) | 2 | Public link keeps token and game number; results image names places | logic |
| [`scoring-nov6.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/scoring-nov6.test.ts) | 7 | Typed 0 semantics, all-zero sheet blocked, Edit round loads 0, big-loss red threshold, 014 SQL shape (atomic, reuse empty round, ignore duplicate) | logic + source check |
| [`scoring.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/scoring.test.ts) | 5 | `validateRoundScores`, dealer rotation, stake/pool defaults, totals | logic |
| [`seat-removal.test.ts`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/tests/seat-removal.test.ts) | 8 | `canRemoveSeat` per-round zero rule and message; 016 SQL shape; degrade path when 016 missing; picker row/strip and add-mode source checks | logic + source check |

What this layer does **not** do: render a component, run a navigator, touch a database, or execute any SQL. Every `.sql` assertion is a regex over the file text.

## 4. Live-database scripts (`rummy-home3/scripts/`)

| Script | What it does | Caveats found while reading it |
|---|---|---|
| [`supabase-smoke.mjs`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/scripts/supabase-smoke.mjs) | Signs up and signs in one throwaway account over the auth API | Creates a real user on the **production** project each run |
| [`game-flow-smoke.mjs`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/scripts/game-flow-smoke.mjs) | Two throwaway users; create game, add round, undo, complete, read history | Same; writes `rounds` and `scores` with direct inserts (the pre-014 three-request path), so it never exercises `save_round` |
| [`friday-rls.mjs`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/scripts/friday-rls.mjs) | Five accounts (admin, co-admin, player, viewer, outsider): visibility via `list_visible_game_ids`, player cannot insert a round, promoted co-admin can, anon `public_scorecard` with right/wrong token | Needs **Confirm email OFF**, which contradicts the app's sign-up flow (register screen expects a confirmation link). Against production it will fail at "no session" or pollute `auth.users`. It predates 007–017 (no RPC coverage for `save_round`, `link_seat_to_player`, `remove_seat_if_no_scores`, results readers) |
| [`nightly-test.mjs`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/scripts/nightly-test.mjs) | validate:env → typecheck → unit → smoke → game-flow | No scheduler exists; "nightly" was a PowerShell loop on Sree's PC (see `docs/auth-and-testing.md`) |
| [`seed-test-users.mjs`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/scripts/seed-test-users.mjs) | `player1..10@rummyhome.com` / `123456` | Same confirm-email dependency |

Net: these are usable only against a project where confirm-email is off, i.e. a **local or branch database**, not `gngcrplcldfiubvhcdin` as configured. Nobody has run them in the current cycle.

## 5. Migration checks on local Postgres

For 013–017 the authoring agent spun up a scratch Postgres 16, applied 001–0NN in order, then ran hand-written `psql` scenarios (anon/stranger/non-admin refused, happy path, re-run, rollback). Evidence is prose only:

- [`docs/migrations-to-apply.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/migrations-to-apply.md) sections 014–017 ("Verified on a scratch Postgres 16 loaded with 001–015: …")
- [`docs/rollout/nov7-supabase-rollout-checklist.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/rollout/nov7-supabase-rollout-checklist.md) §2–3, which references a `scratch-validation/` folder that is **not in the repo**
- [`docs/rollout/verify_after_apply.sql`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/rollout/verify_after_apply.sql) — read-only checks Sree runs in the SQL editor after applying (function existence, grants, row counts)

So each migration was verified once, by one agent, with scripts that cannot be re-run. The repo keeps only the regex "shape" tests listed above.

## 6. Web preview screenshots (what cloud agents do)

- `npx expo start --web`, 390×844 viewport, Puppeteer drives taps and takes PNGs.
- Data: **fixture mode** — with no `EXPO_PUBLIC_SUPABASE_*` env the app seeds demo games into browser storage (`services/supabase.ts` → `isSupabaseConfigured=false`). Auth flows ran against a throwaway in-memory GoTrue fake on `localhost:9999` so the real `supabase-js` client executed.
- Output: ~120 PNGs plus the real generated 20-game share image and PDF, under `/opt/cursor/artifacts/` on the agent VM; uploaded as PR attachments when cited; indexed with status words in [`CHECKLIST-NOV9.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/CHECKLIST-NOV9.md) (35 Done / 3 Partial / 1 Not done).
- Not kept: the Puppeteer scripts themselves (ad hoc per agent run), so no screenshot can be regenerated or diffed.

## 7. Maestro flows (`rummy-home3/e2e/`, 9 files, never run)

Written Nov 4 for the redesign. Checked against today's source:

| Flow | Status |
|---|---|
| [`sign-in.yaml`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/e2e/sign-in.yaml), [`bad-passcode.yaml`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/e2e/bad-passcode.yaml) | Plausible, but assume a `host@example.com` account exists |
| [`home.yaml`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/e2e/home.yaml) | "No live game." still exists |
| [`new-game.yaml`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/e2e/new-game.yaml) | Stale: asserts "Add new player" (now "Add new players") |
| [`results.yaml`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/e2e/results.yaml) | Stale: "Declare results" no longer in source |
| [`scorecard-help.yaml`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/e2e/scorecard-help.yaml) | Stale: "Settling coins is not on this screen." gone |
| [`find.yaml`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/e2e/find.yaml), [`invite.yaml`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/e2e/invite.yaml), [`settle-empty.yaml`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/e2e/settle-empty.yaml) | Tab was renamed "My players"; "Players" tap will miss |
| **all** | `appId: com.rummyhome.app` but `app.json` ships `com.mindweavetech.rummyhome` — `launchApp` would fail on every flow until this is fixed |

They are a starting point, not a working suite.

## 8. Manual phone passes

Builds 2–5 were tested by Sree (and once with Harish as the second user). Findings came back as prose and as [issue #8](https://github.com/sreeatcandorps/RummyHome/issues/8), then turned into fixes and unit tests in the same PR. Bugs that only the phone pass found in this cycle:

| Found on phone | Why no automated layer caught it |
|---|---|
| Fresh account could see everyone's results (P1-A) | No test executed the results RPCs as a second user; client rule was correct, server was not |
| Blank round 6 | A three-request save interrupted mid-way; nothing tests a dropped connection or a retried submit |
| Owner missing from picker / My players / Find | Server RPCs exclude `auth.uid()`; the unit tests fed hand-built candidate lists that always included the organiser |
| View-only ⋮ menu went dead | Paper `Menu` internal ref + realtime re-render; no rendered-component test, no realtime in any test |
| Android keyboard needs two taps on passcode cells | Hidden opacity-0 input; web Puppeteer focus works differently from Android IME |
| Crash after returning from the native share sheet | Native Activity lifecycle; nothing runs native |
| Preview APK reverted to older JS on second launch | EAS Update channel behaviour; only visible on an installed APK |

## 9. GitHub links summary

- PR under test: https://github.com/sreeatcandorps/RummyHome/pull/7 (checks: https://github.com/sreeatcandorps/RummyHome/pull/7/checks — one skipped "Supabase Preview", no Actions)
- Tests: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/tests
- Scripts: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/scripts
- Maestro flows: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/e2e
- Migrations and rollbacks: https://github.com/sreeatcandorps/RummyHome/tree/cursor/ezscore-apk-ready/rummy-home3/supabase
- Existing test docs: [`testing-strategy.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/testing-strategy.md), [`auth-and-testing.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/auth-and-testing.md), [`rls-verification.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/rls-verification.md) (manual RLS checklist), [`CHECKLIST-NOV9.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/CHECKLIST-NOV9.md), [`release-checklist.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/release-checklist.md)
- Phone findings: https://github.com/sreeatcandorps/RummyHome/issues/8
