# CI: what runs, how to read the report, what it found

Steps A, B and C of [`automation-plan.md`](automation-plan.md) are implemented. This page is the operator's guide. Nothing in CI touches the hosted Supabase project `gngcrplcldfiubvhcdin`; the database under test is a fresh `supabase start` on the GitHub runner, destroyed when the job ends. No secrets are configured or needed.

## Where

| Piece | File |
|---|---|
| Workflow | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
| Supabase CLI config (local only) | [`rummy-home3/supabase/config.toml`](../../rummy-home3/supabase/config.toml) |
| Multi-user seed | [`rummy-home3/supabase/seed.sql`](../../rummy-home3/supabase/seed.sql) |
| pgTAP tests | [`rummy-home3/supabase/tests/`](../../rummy-home3/supabase/tests/) (9 files, 163 tests) |
| Rollback replay | [`ci/db/replay-rollbacks.sh`](../../ci/db/replay-rollbacks.sh) |
| pgTAP runner | [`ci/db/run-pgtap.sh`](../../ci/db/run-pgtap.sh) |
| Two-client concurrency | [`ci/db/concurrency-save-round.mjs`](../../ci/db/concurrency-save-round.mjs) |
| Report builder | [`ci/report/build-report.mjs`](../../ci/report/build-report.mjs), [`ci/report/workflow-map.json`](../../ci/report/workflow-map.json), [`ci/report/node-test-json-reporter.mjs`](../../ci/report/node-test-json-reporter.mjs) |
| No-Docker local runner | [`ci/db/local-run.sh`](../../ci/db/local-run.sh) + [`ci/db/local-stub.sql`](../../ci/db/local-stub.sql) |

Runs: https://github.com/sreeatcandorps/RummyHome/actions/workflows/ci.yml

## When it runs

- Every push to any branch and every pull request. (A push to a PR branch produces two runs, one per trigger; both show the same result.)
- Nightly at 09:00 UTC, which is 1 AM Pacific standard time (2 AM in summer), against `cursor/ezscore-apk-ready` (PR 7) and `main`, as two rows of a matrix.
- On demand: Actions → CI → "Run workflow", optionally with a branch or commit in the `ref` box.

## Jobs

1. **Unit tests + tsc** (~1 min). `npm ci` in `rummy-home3`, the 231 `node:test` tests with a custom reporter that records which file each test came from, then `tsc --noEmit`.
2. **Database tests on local Supabase** (~4–6 min, mostly Docker image pulls).
   - `supabase start` (Postgres 17 image, Studio/mail/edge runtime disabled) and `supabase db reset`: migrations 001→017 from an empty database, then `seed.sql`.
   - `replay-rollbacks.sh`: apply `rollback_017` → `016` → `015` → `014` → `013`, check with `pg_proc` that each leaves the function state it promises, re-apply 013→017 in order, then apply each forward migration a second time to prove they are re-runnable. 25 checks.
   - `run-pgtap.sh`: each `supabase/tests/*.sql` through `psql`, raw TAP kept per file.
   - `concurrency-save-round.mjs`: two real Postgres connections acting as two signed-in admins (`set role authenticated` + `request.jwt.claims`, exactly what PostgREST does), racing each other.
3. **Test report**: downloads both result sets, builds one Markdown page, writes it to the job summary and uploads `test-report-<branch>`. Exit code is red if any non-TODO check failed or a suite did not run.

The unit and database jobs always upload their raw results even when they fail, so the report job can still explain what happened.

## How Sree reads the report

1. Open the PR → **Checks** tab (or the ✓/✗ next to the commit) → **CI** → click the **Test report** job → the **Summary** page shows the report at the top. Or: https://github.com/sreeatcandorps/RummyHome/actions/workflows/ci.yml → pick a run → the report is the first thing on the run's summary page.
2. The first line says **PASS / FAIL / INCOMPLETE**, the number of checks and the number of *known failures*.
3. **By product workflow** is the table that matters: one row per section of [`phone-checklist.md`](phone-checklist.md) (Sign in, New game, Scoring, Mid-game add/remove, Invites, Linking a Player ID, Results, Share and PDF, Two users at once). Each row shows unit tests, database tests and two-user checks as *passed / total*. A ✅ means every automated check behind that row passed; it says nothing about what only a phone can show (see [`ai-vs-phone.md`](ai-vs-phone.md)).
4. **Suites** is the same information grouped by tool (unit, tsc, migrations, rollbacks, pgTAP, concurrency).
5. **Known failures** lists real bugs that the tests detect on purpose and that have **not** been fixed. They are marked `TODO` in the test files, so they are reported every run but do not turn the run red. When one of them is fixed, its line flips to "unexpectedly passed" in the raw TAP and should then be un-TODO'd.
6. **Failures** (only when red) gives suite, file, test name and the first lines of the error.
7. For raw detail, download the `test-report-<branch>` artifact from the run page: `report.md`, `report.json`, `unit/tests.jsonl`, `unit/tsc.txt`, `db/migrations.txt`, `db/rollbacks.tap`, `db/pgtap/*.tap`, `db/concurrency.tap`.

## What is covered

The seed creates eight accounts and three placeholders with fixed UUIDs (see the header of `seed.sql`): sree (creates games A and C, not seated in A), harish (seated in A; creator, admin and declarer of B), priya (seated in A and B), a spectator, an outsider, a co-admin who is not playing, an app admin, and a player with only zero scores. Game A is live (two rounds plus one undone round), B is completed and in a declared result, C is completed and closed.

| pgTAP file | Tests | Rule under test |
|---|---|---|
| `01_schema_and_grants.sql` | 31 | Every table, column and function from 001–017 exists, RLS is on, `anon` cannot execute `save_round` / 016 / 017 / `get_game_result`, and can execute `public_scorecard` |
| `02_games_visibility.sql` | 24 | Outsider sees nothing and cannot insert rounds; seated player sees the game, cannot score, cannot promote themself; spectator sees but cannot score; non-playing creator and unseated co-admin are admins; app admin sees all; anon sees nothing |
| `03_results_privacy.sql` | 16 | 013: outsider, non-member creator and spectator get `[]`/`null`; seated player and declarer see the result; unknown id is `null`; the `game_results` tables are not directly readable |
| `04_profiles_privacy.sql` | 14 (3 known failures) | 011: placeholder visibility, no editing others, `search_players` partial-email returns nothing; plus the two findings below |
| `05_save_round_014.sql` | 18 | Player / spectator / outsider refused `42501`; admin saves with dealer rotation; duplicate submit ignored; empty round reused; edit retires the old row to the 1000+ range |
| `06_seat_removal_016.sql` | 17 | Refusals, "cannot delete" when any non-zero score, not-in-game, zero-score removal deletes exactly the zero rows, spectator removal, closed game refused, two-player guard |
| `07_seat_takeover_017.sql` | 25 | Co-admin takes a placeholder's seat (one row, admin kept, scores moved, placeholder merged and dropped from My players); spectator takes a seat; outsider linked; self-link; app admin links for someone else |
| `08_public_scorecard.sql` | 8 | Anon reads nothing from tables; the right token opens the card with only live rounds; wrong tokens, the share code and empty strings return `null` |
| `09_candidates_and_roster.sql` | 10 | `list_new_game_candidates` / `list_my_players`: organiser excluded server-side, spectators never candidates, `#` labels, merged placeholders dropped |

Concurrency scenarios (`ci/db/concurrency-save-round.mjs`, 21 checks, 3 known failures): two admins save the same new round at once; the same payload submitted twice; an edit and an add on different rounds; two edits of the same round; a seat removal while a save including that seat is in flight; a connection dropped before commit then retried; two declarations of the same completed game.

## Bugs found (recorded as known failures, app code unchanged)

These fail on PR 7 head `859ee1c` and are reported in every run. Each needs a migration or client change that is out of scope for this PR.

1. **Privilege escalation — any user can make themself `app_admin`.** `update public.profiles set role = 'app_admin' where id = auth.uid()` succeeds under the "users update own profile" policy (001), and `is_app_admin()` then returns true, which opens every game and every result. Fix: a `before update` trigger that keeps `role` unchanged unless the caller is already an app admin (the same pattern 011 and 012 use to lock `email` and `player_no`), or a column-level `revoke update (role) on profiles from authenticated`. `04_profiles_privacy.sql` tests 13–14.
2. **Privacy gap — registered profiles are readable by every signed-in account.** `can_see_profile()` (011) returns true for any profile with `managed_by is null`, so a stranger can `select email, phone, zip from profiles`. `search_players` correctly hides partial-email matches, but the table itself does not. `docs/migrations-to-apply.md` §011 describes the intended rule (own, managed, played-with). `04_profiles_privacy.sql` test 12.
3. **Second admin saving the same round gets a raw `23505`.** `save_round` (014) handles "same payload already saved" but not "another admin saved a different payload a moment ago": the loser gets `duplicate key value violates unique constraint "rounds_game_id_round_number_key"`, which `services/games.ts writeRound` rethrows unchanged, so the phone shows a database error instead of refreshing to the saved round. Same for two simultaneous edits of one round. Concurrency checks 6 and 14.
4. **Removing a zero-score seat while a save is in flight leaves an orphan score row.** `remove_seat_if_no_scores` (016) deletes the seat and the zero rows it can see; a `save_round` committed a moment later re-inserts a 0 for the player who no longer has a seat. Harmless for totals, but the scorecard then has a score with no player. Concurrency check 17.

Observations that are *not* bugs but are now pinned by tests: `remove_seat_if_no_scores` also deletes the player's rows in undone rounds (asserted as 3 rows for the seeded case); two admins declaring the same completed game both succeed and the game ends up in two results (the app warns before Declare; the server does not refuse, by the build-3 decision).

## Local run without Docker

The cloud-agent VM has no Docker, so the same suite runs on a plain Postgres 16 with `pgtap` installed and a 100-line stub of the `auth` schema (`ci/db/local-stub.sql` creates `auth.users`, `auth.uid()`, `auth.jwt()`, the `anon`/`authenticated`/`service_role` roles and the `supabase_realtime` publication).

```bash
sudo apt-get install -y postgresql-16 postgresql-16-pgtap
sudo -u postgres psql -c "alter user postgres password 'postgres'"
cd ci && npm ci && cd ..
PSQL="sudo -u postgres psql" DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/ezscore_test ci/db/local-run.sh
(cd rummy-home3 && npm test && npx tsc --noEmit)
node ci/report/build-report.mjs            # prints the same report CI shows
```

With Docker and the Supabase CLI installed, use the CI path instead: `cd rummy-home3 && supabase start && supabase db reset`, then the three `ci/db/*` scripts with `DB_PSQL="psql postgresql://postgres:postgres@127.0.0.1:54322/postgres"`.

## Things to know

- `supabase/config.toml` sets `[db] major_version = 17`. If the hosted project is on 15, change it; the migrations do not depend on the version.
- The Supabase GitHub integration is installed on this repo (the skipped "Supabase Preview" check). Adding `config.toml` may let it create a **preview branch** for pull requests if "automatic branching" is on in the dashboard (≈ $0.32/day per open branch on Pro). Check Dashboard → Branches after the first PR run; nothing in this PR enables it.
- `pull_request` runs use the workflow file from the PR branch, so changes to `ci.yml` are exercised by the PR that makes them.
- Adding a new pgTAP file: drop it in `rummy-home3/supabase/tests/`, keep the `begin; select plan(N); … select * from finish(); rollback;` shape, and list it under the right workflow in `ci/report/workflow-map.json` so it shows on the right row of the report.
