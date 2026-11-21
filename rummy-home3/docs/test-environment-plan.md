# Volume, a test environment, and breaking the app on purpose — the plan (Nov 21, 2026)

Sree: "simulate a lot of volume … how the app is going to behave when there are many, many users and many, many
games … do we have a test environment? Should we create one? … There's no reason to wait for people to break
the app! … fill up the database with so much data, see what it looks like, and try to uncover more and more bugs.
If we've already done most of it, let me know."

**Plan only. Nothing here has been run; nothing touches the live database.**

## 1. What already exists (more than half of it)

| Layer | What runs today | Where |
| --- | --- | --- |
| **Database volume** | A size ladder and latency budgets against a throw-away PostgreSQL with every migration and the real RPCs under RLS: My players 100 / 1,000 / 10,000; games of 2 / 10 / 20 players × 50–500 rounds; one person with 100 / 1,000 / 5,000 games; results over 30 games × 20 players; five admins saving the same round in the same instant; ten creators starting games at once; 30 games saving at once; the e-mail burst vs the daily cap; every guardrail (029) hit on purpose. 117 rows, all pass, 44 s. It found and fixed two slow RPCs (032) and a stale-statistics case. | `docs/volume-testing.md`, `docs/volume/`, `ci/volume/run-volume.mjs`, `run-stress.mjs`, `volume.sql`; CI **pre-release tier** job `volume` |
| **Break-the-app fixtures** | A 38-account roster and 47 deliberately awkward games (dead sessions, refused limits, 20-player standings, deleted / shared / restored results…) seeded into the local database for the device suites. | `supabase/seed-break.sql`, `docs/test-plan/break-the-app.md` |
| **Device suites** | Maestro on four emulator profiles × six suites: smoke (24 flows), full, **chaos** (offline, kill, rotate mid-save), **roles** (player / admin / creator / view-only), **two-device** (two phones on one game, races), **monkey** (`adb monkey`, 20,000 random events at pre-release). Screenshots, video and logcat crash detection per flow; a gh-pages dashboard; failures filed as issues. | `e2e/`, `ci/ui/`, nightly 09:00 UTC |
| **Client compute at volume** | Pure builders of the heavy screens (scorecard sheet, results details, PDF, share image, My players sections) timed at 2–20 players × 50–500 rounds and 10,000 players. | `tests/volume-client.test.ts` |

So: **the database and the pure logic have been load-tested; the app on a phone has not been looked at with a big
database behind it; and nothing has ever been load-tested against a *hosted* Supabase** (network, PostgREST,
Realtime, the connection pool, the free-tier limits). Those are the two gaps that matter.

Two more honest gaps:

- The volume ladder was written on Nov 12 against migrations 001–032. Pool (041/042), multiplier, seating (044/047),
  reopen (049/050), dealer (052) have **never been in a volume run** — the pre-release tier that runs it is dispatch-only and I found
  no pre-release run in the recent Actions history — the ladder has not run since Nov 12.
- There is **no test environment**: the app has exactly two backends — the throw-away local Supabase inside a CI
  job (gone when the job ends) and **live**. Sree cannot open the app against a big database; nobody can.

## 2. Do we need a test environment? Yes — one, hosted, small

**What**: a second Supabase project, **`ezscore-staging`**, same migrations, never any real person's data, seeded with
the volume set below, used by a **staging APK** (and later the TestFlight build) that points at it.

**Why hosted and not local**: everything that can go wrong at scale on a phone goes wrong *between* the phone and
the database — latency on a 4G connection, PostgREST payload sizes, Realtime fan-out, the pooler's connection cap,
the free tier's pauses and rate limits, auth e-mails. None of that exists in a local container. It is also the
only way Sree can "fill up the database and see what it looks like" with his own thumbs.

**Which tier**: start on the **free tier** ($0: 500 MB database, 50,000 monthly active users, 2 GB egress, 200
concurrent Realtime connections; the project **pauses after 7 days idle** and a script un-pauses it). Our 5,000-game
volume set is ~60 MB. Move to **Pro ($25 / month)** only if a load test hits the free caps or if we want Supabase
Branching (a database branch per PR — nice, not needed). Live stays exactly as it is.

**Who does what**: Sree creates the project in the Supabase dashboard (two minutes, his org); Build Bot gets the
staging URL and anon key as EAS environment variables for a new **`staging`** build profile and as GitHub
secrets for a staging job. The agent writes the migration + seed script, the APK profile, and the load tests.
Nothing in the repo ever holds a key.

## 3. "Fill it up" — the volume data set (realistic, not random)

One generator (`ci/volume/seed-staging.mjs`, built on `volume.sql`) that produces a believable population, so the
screens are judged on what a busy app would really show:

| Thing | How many | Shape |
| --- | --- | --- |
| Accounts | 2,000 | 200 "regulars" who play weekly, 1,800 who played once; real-looking Indian and US names; 5 % with no initials override, 10 % unregistered placeholders |
| Circles | 150 | tables of 4–20 who always play together; a person belongs to 1–3 circles |
| Games | 20,000 | 18 months of history; 70 % Points / 30 % Pool; 2–20 players (median 5); 3–60 rounds; multipliers on 15 %; re-entries, outs, mid-game joins, seating changes, dealer overrides on a realistic minority; 5 % deleted, 1 % archived, 0.5 % reopened |
| Results | 3,000 | over 1–30 games; 40 % shared; 3 % deleted then restored |
| Live right now | 60 | games in progress across circles, for the realtime tests |
| One power user ("Sree at scale") | 1 | 1,500 games, 400 players in My players, 120 results — the account Sree signs into to see the worst case |
| One huge table | 1 | 20 players × 500 rounds, pool ×100 multiplier, three re-entries, two dealer overrides |
| Link requests, e-mail outbox, logs | at the guardrail caps | so every "limit reached" message is on screen somewhere |

Seeded through the real RPCs where they exist (so triggers, game numbers and logs are real) and direct inserts where
volume demands it, with `ANALYZE` after. Re-runnable: wipe and reseed in under ten minutes.

## 4. The tests, in the order they pay back

| # | Test | What it answers | Tool | Where |
| --- | --- | --- | --- | --- |
| V1 | **Re-run the existing ladder on 052** | Did pool, multiplier, seating, dealer make any RPC slow? | existing `run-volume.mjs` / `run-stress.mjs` + new cases for `get_game_bundle` with pool + awards, `set_round_dealer`, `reorder_seats`, `add_seated_player` on a 500-round game | CI pre-release tier; dispatch it once now, then **make `volume` part of nightly** |
| V2 | **The app on the staging data** (the thing Sree asked for) | What does Home look like with 1,500 games? My players with 400? A 20p × 500r scorecard scrolling? Results picker with 120? Does anything take more than a second to open? | the staging APK on his phone, and the smoke suite run against staging on the Pixel 6 job with timings per screen | staging |
| V3 | **Many users at once** | 200 people saving rounds in 60 games while 50 watch live pages: p95 latency, errors, Realtime message lag, pooler connections | **k6** (open source) hitting PostgREST / RPC with real JWTs from 200 seeded accounts; a Node script holding 50 Realtime channels and timing each event | staging, from a GitHub Actions job (free runner is enough for 200 virtual users) |
| V4 | **Burst** | 1,000 sign-ins in a minute (a WhatsApp group opens the app together): auth rate limits, e-mail OTP cap, the free tier's limits | k6 against Auth; watch the Supabase dashboard | staging |
| V5 | **Soak** | 24 h of V3 at one tenth the rate: leaks, pooler exhaustion, the nightly archive job on a big table, pg_cron timing | k6 soak profile; the staging project's logs | staging, weekend run |
| V6 | **Phone under volume** | Memory and frame drops on the Pixel 4a with the huge table and the power user: scorecard scroll at 500 rounds, PDF of a 30-game result, share image of 20 columns | Maestro flows with `adb dumpsys meminfo` / `gfxinfo` captured per step | CI, local Supabase seeded with the staging set |
| V7 | **Break it with data** | Every input at its limit and past it: 20-character names, 3-letter initials clashes, emoji, RTL, a 10,000-point round, ×10,000, negative pool limits, a game with 500 rounds reopened, re-entry on round 1, dealer override on a completed game… | pgTAP for the refusals + Maestro flows for the screens | CI |
| V8 | **Monkey, longer** | 200,000 random events on the staging APK overnight | existing monkey job, bigger | CI |

Pass / fail is written down before each run (budgets like `docs/volume-testing.md` has); every failure becomes a
`found-by-tests` issue with the screenshot; every fix a PR.

## 5. What it costs

| Item | Cost |
| --- | --- |
| Supabase staging project | $0 on the free tier; $25 / month if we outgrow it |
| k6 | free, open source; runs on the GitHub runner |
| Extra CI minutes | the nightly `volume` job ~5 min; V3/V4 ~20 min each when dispatched; V6 is inside the existing device job |
| A staging APK | one EAS build per change of the staging profile (same credits as any preview APK) |

## 6. Order of work, and what Sree decides

1. **Now, nothing needed from Sree**: dispatch the pre-release tier once (V1 on 052); add the new 041–052 cases; make `volume` nightly. Write the staging seed generator and run it against the local database in CI so V6 and V7 can start without a hosted project.
2. **Sree: create `ezscore-staging`** (Supabase dashboard → New project, free tier, region the same as live) and give Build Bot the URL + anon key for the EAS `staging` profile and the GitHub secrets. Two minutes.
3. **Build Bot (on his yes)**: migrate + seed staging; cut a **staging APK**. Sree installs it beside the real one (a different app name "EZ Score · Staging" and a different package suffix so both fit on one phone).
4. **Agent**: V2 screenshots and timings; V3–V5 scripts and their first runs; the issues they raise, fixed in PRs.

| # | Question for Sree | Recommended |
| --- | --- | --- |
| 1 | Create the staging project (free tier)? | **yes** — it is the one thing missing |
| 2 | A second app on the phone ("EZ Score · Staging", own package id) rather than switching the real app between backends? | yes — switching inside one app is a way to put real games in the wrong database |
| 3 | Same region as live (so latency numbers mean something)? | yes |
| 4 | Make the volume job nightly (adds ~5 min to the 09:00 run)? | yes |
