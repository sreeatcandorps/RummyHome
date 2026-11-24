# Volume, a test environment, and breaking the app on purpose — the plan (Nov 21, 2026)

Sree: "simulate a lot of volume … how the app is going to behave when there are many, many users and many, many
games … do we have a test environment? Should we create one? … There's no reason to wait for people to break
the app! … fill up the database with so much data, see what it looks like, and try to uncover more and more bugs.
If we've already done most of it, let me know."

**Status (Nov 21):** Sree said yes to Q12 (1–3) and, at 1:21 AM, to all testing on staging: "From now on all testing
happens on the staging database … with staging APKs, not live." `ezscore-staging` exists (ref `erurahfybkxemgtkfzkn`,
ca-central-1, same org, $10 / month approved), migrations 001–052 applied by Build Bot, empty. The EAS **`staging`**
profile and the population generator are in the combined PR (#117); V1 is #114. **Sree runs the seed and the staging
build himself — §8 has the exact commands.** Nothing touches the live database.

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

## 7. What was built (Nov 21) and how to use it

**The staging app** — `APP_VARIANT=staging` in `app.config.js` turns the same code into a second app that installs
beside the real one: name **EZ Score · Staging**, package `com.candorps.rummyhome3.staging`, its own URL scheme,
"Staging" after the version on Profile. `eas.json` has a `staging` profile (extends `preview`, channel `staging`)
that sets `EXPO_PUBLIC_APP_VARIANT=staging` and `EXPO_PUBLIC_STAGING_SUPABASE_URL`; the anon key is the EAS secret
`EXPO_PUBLIC_STAGING_SUPABASE_ANON_KEY`, never in the repo. `services/supabase.ts` reads the `EXPO_PUBLIC_STAGING_*`
pair only for that variant, so the live names are never overridden by accident. Build: `eas build -p android
--profile staging` — **only when Sree says build.**

Known gaps of the staging app, on purpose for now: passcode-reset and shared scorecard / result links still point at
the live GitHub Pages (`EXPO_PUBLIC_AUTH_REDIRECT_URL`, `EXPO_PUBLIC_SCORECARD_URL`); the pages take the project URL
from the link, so a staging link opens a page that queries staging, but the reset page's redirect goes to the live
app's scheme. Fix when the first staging APK is in hand. **pg_cron is not enabled on staging**, so the 045/046 nightly
jobs do not exist there; enable the extension on the dashboard before the V5 soak.

**The population** — `ci/volume/seed-staging.mjs` + `seed-staging.sql` (schema `staging`). Deterministic (seeded
PRNG + id prefixes `c0000000-…` for people, `d<owner>-…` for guests), so the same `SCALE` gives the same data every
time; `WIPE=1` removes exactly what it made and reseeds. It refuses any `DB_URL` that is neither loopback nor the
staging ref. The 029 guardrail triggers and, during a wipe, the event-log triggers are switched off, because an
18-month history breaks every per-day cap by design; everything else (initials, game numbers, pool out/in, logs,
multiplier check) runs through the app's own triggers, and results go through `set_pool_awards` /
`declare_game_result` / `delete_result` / `restore_result` as the signed-in creator.

| What §3 asked for | What the generator makes at `SCALE=1` |
| --- | --- |
| 2,000 accounts, 200 regulars | 2,000 `auth.users` + profiles, passcode **123456**, e-mail `<first>.<last>.<n>@staging.test`; #1 is **Sree Koneru** (`sree.koneru.1@staging.test`) |
| 150 circles of 4–20 | regulars sit in 1–3 circles, one-timers in one; everyone in a circle has everyone in My players |
| 10 % unregistered | ~200 guests spread over the regulars, with real-looking names |
| 20,000 games | 18,500 across circles + 1,500 by Sree; 70 / 30 Points / Pool; 2–20 players (median ~5); 3–60 rounds; multiplier on 15 % of Points games (×2 ×5 ×10 ×100); pool limits 101–501, some with a re-entry limit; 8 % with a mid-game joiner; 5 % deleted, 1 % archived, 0.5 % reopened, 3 % hidden by a player |
| 3,000 results | 1–30 games each, through the real RPCs; pools get awards first; 3 % deleted then restored |
| 60 live | active games across circles plus Sree's, at the `live_games_per_user` cap for him |
| Sree at scale | 400 My players (60 % people, 40 % guests), 1,500 games, 120 results, 20 pending link requests (the cap) |
| One huge table | 20 × 500 pool, limit 1,000,000, three re-entries, two dealer overrides via `set_round_dealer` |

Local check: `ci/db/local-run.sh && DB_URL=… SCALE=0.02 node ci/volume/seed-staging.mjs` makes 417 games / 8,005 rounds /
49,012 scores / 67 results in ~10 s; the full set was *estimated* at ~8 min from that — the first real run (Nov 23, GitHub Actions → transaction pooler) went silent in the power-user step and hit the 45-min timeout; see the note under §8 step 1. The nightly `volume` job runs the 2 % build, then wipe +
reseed, so the generator cannot rot.

## 8. Run it (Sree said yes, Nov 21 1:21 AM: "all testing happens on the staging database … with staging APKs")

Everything below is run by a person, once, from `rummy-home3/` on a machine with `eas-cli` logged in. Nothing here
touches the live project: the generator refuses any URL without the staging ref, and the staging profile is the only
one that reads the `EXPO_PUBLIC_STAGING_*` pair.

**1. Seed the staging database** (timing unmeasured at full scale — run `scale=0.1` first and multiply; needs Node 22 and `npm ci` in `ci/`):

```bash
cd ci && npm ci && cd ..
# Dashboard → ezscore-staging → Connect → "Transaction pooler" URI, with the database password filled in.
export DB_URL='postgresql://postgres.erurahfybkxemgtkfzkn:<DB PASSWORD>@aws-0-ca-central-1.pooler.supabase.com:5432/postgres'   # session pooler (5432), not transaction (6543): one long session, statement_timeout honoured
node ci/volume/seed-staging.mjs              # full population (SCALE=1); prints a summary line per step

> **Nov 23, run 45246986120 (Actions, `STAGING_DB_URL` = transaction pooler, scale 1, no wipe)**: people / circles /
> placeholders done in 55 s, then "power user: 400 My players" (one 58k-row insert through the per-row initials
> trigger) printed nothing for 44 min and the job was cancelled at its 45-min limit. `statement_timeout` never fired,
> so the socket had died (no keepalive; the transaction pooler does not carry startup parameters). Fixed in the
> generator: TCP keepalive, a client-side `query_timeout` that fails instead of hanging, the big insert chunked by
> owner with progress lines, progress every 2,000 games. **Use the session pooler URL (port 5432) for the secret.**
> **Second run, scale 0.1, session pooler (run 45278894409)**: all steps ran and reported — people 0.2 s, circles 4.6 s,
> placeholders 1.4 s, power My players 0.8 s, 1,850 games 58.6 s, 150 power games 3.4 s, live 0.1 s, 300 results 260.9 s —
> then "power user: 120 results" failed on the app's own guardrail, `Results can include at most 50 players`: the power
> user's games draw from a 60-person pool and a result of up to 30 of them had more than 50 distinct players. Fixed in the
> generator (games are kept while the union of seats fits 50, like a creator would). Timing from this run: results cost
> ~0.9 s each through the pooler, so scale 1 (3,000 + 120 results, 20,000 games) is **about an hour**; the job timeout is
> now 150 min. The three finished steps are idempotent (`on conflict do nothing`, deterministic ids): re-run without wipe is safe.
> **Third run, scale 1, no wipe (run 45295537304, Nov 24 00:14–00:23 UTC, 9 min)**: people 0.4 s (already there),
> circles 51.8 s, power My players 77.0 s (chunked, 241 owners), then games at ~2,000 per 48 s; at **14,000+ of 18,500**
> Postgres answered `cannot execute INSERT in a read-only transaction` (SQLSTATE 25006, `PreventCommandIfReadOnly`)
> inside `staging.make_game`. The generator did nothing wrong: Supabase switches a **Free-plan project to read-only mode
> when its database passes the 500 MB disk limit**, and ~14,000 games with their rounds/scores on top of run 2's rows
> is about that size. The dashboard shows it as a "Database is in read-only mode" banner (Settings › Database / Reports).
> Consequences: every write fails, including `staging.wipe()`. Way out (Supabase docs): in one session
> `set default_transaction_read_only = 'off'`, then delete / `vacuum`, or upgrade the project to Pro (8 GB). Choice for
> Sree (Q28 → D86): *"Clear the read-only lock, wipe staging and rerun the seed at half size on the free plan."* So:
> the generator now (1) runs `set default_transaction_read_only = 'off'` on its session at connect, (2) after
> `staging.wipe()` does `vacuum (full, analyze)` on the populated tables so the disk is really given back, (3) measures
> `pg_database_size` and **refuses before seeding** (exit 3) when what this SCALE adds, by `BYTES_PER` in
> `seed-staging-config.mjs` (≈ 35 KB a game, measured on CI), would land within 10 % of `SIZE_LIMIT_MB` (default 500 = Free; 0 = off),
> (4) checks the size after every step and every 2,000 games and **stops at 95 %** with a plain message instead of
> letting Supabase lock the project, (5) prints the measured KB per game so the constants can be re-tuned. Estimates:
> scale 1 ≈ +730 MB (Pro only), **scale 0.5 ≈ +365 MB (fits Free, the workflow default)**, 0.1 ≈ +75 MB.
> **Fourth run — the one that stands (run 45308977125, Nov 24 01:58–02:25 UTC, 26.8 min, wipe on, scale 0.5)**: the
> read-only clear worked — `wipe previous population → 2,359` people in 475 s on the locked project, `vacuum full` 4.6 s,
> then `# size: 18 MB now + ≈ 344 MB … fits`. Steps: people 7 s, circles 19 s, placeholders 4 s, power My players 18 s,
> 9,250 games 242 s (**measured 33.6 KB a game**, db 25 → 328 MB), 750 power games 24 s, live 0.5 s, 1,500 results
> 767 s (~0.5 s each), 60 power results 41 s, huge table 4 s, caps 1 s, analyze 3 s. **Final size 390 MB** of 500.
> Counts: 1,000 people, 179 guests, 10,041 games (40 live, 488 deleted, 104 archived, 3,029 pools), 198,529 rounds,
> 1,332,626 scores, 1,560 results, 99,784 log rows; power user 793 games / 234 My players / 60 results.
> Sign in as **sree.koneru.1@staging.test / 123456**. Staging is at 78 % of the Free limit: do not re-seed without wipe.
# Later, to start over with the same population:  WIPE=1 node ci/volume/seed-staging.mjs
```

**Or from GitHub (Nov 23, the way it is actually run — Build Bot's box cannot open Postgres connections):** add the repo
secret `STAGING_DB_URL` (the ezscore-staging transaction-pooler URI, Settings › Secrets and variables › Actions), then
Actions › **Seed staging** › *Run workflow*: `wipe` on to start over, `scale` 0.5 (default) for what fits the Free plan — 1 only on Pro — and `size_limit_mb` 500 (Free) / 8000 (Pro) / 0 (no check). The summary is the
`staging-seed-summary` artifact and the job summary; the URL is a masked secret and is never printed.

The URL carries the password: type it in the terminal, do not paste it into a file, a chat or an issue. The summary
is written to `ci/out/staging-seed/summary.json` (counts only, no keys). Sign in to the staging app afterwards as
**sree.koneru.1@staging.test / 123456** — the account with 1,500 games, 400 My players and 60 live games.

**2. Give the build the staging anon key** (once; the key is the *publishable / anon* key of ezscore-staging, never
the service role key):

```bash
eas env:create --environment preview --name EXPO_PUBLIC_STAGING_SUPABASE_ANON_KEY --value '<STAGING ANON KEY>' --visibility sensitive --type string
```

**3. Build the staging APK** (installs beside the real app as "EZ Score · Staging"):

```bash
eas build -p android --profile staging
```

The `staging` profile extends `preview` (APK, no OTA updates), sets `APP_VARIANT=staging` and the staging URL, and
reads the anon key from the `preview` environment created in step 2. The real app keeps using `preview` /
`production` with the live names; nothing in it changes.
