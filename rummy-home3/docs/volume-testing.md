# Volume testing

Final launch batch, item 9 (Nov 12, 2026). Every case below ran against the full migration set
(001–032) on a local PostgreSQL 16 with the real RPCs, as the real users would call them
(`volume.login(uid)` sets the `authenticated` role and JWT claims inside each transaction, so
RLS and every guardrail apply). Nothing here touches the live Supabase project.

The full per-row table from the last run is in
[`volume/results-2026-11-12.md`](volume/results-2026-11-12.md) (117 rows, all pass, 44 s wall;
machine-readable copy in `results-2026-11-12.json`). Representative screenshots are in
[`volume/`](volume/); the complete set (13 PNGs) lands in `ci/out/volume/screenshots/`
(git-ignored) when you rerun.

## How to run

```sh
# 1. Fresh DB with all migrations, seed, pgTAP, rollback replay (also runs ANALYZE):
PSQL="sudo -u postgres psql" DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/ezscore_test ci/db/local-run.sh

# 2. Volume cases → ci/out/volume/results.{md,json} and RPC payloads for the web pages:
DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/ezscore_test node ci/volume/run-volume.mjs
QUICK=1 DB_URL=... node ci/volume/run-volume.mjs      # skips 10,000 players / 5,000 games

# 3. Screenshots of the web /r/ pages (scorecard + results) from those payloads, headless Chrome:
node ci/volume/screenshots.mjs

# 4. Client-side compute at volume (pure utils used by screens, PDF, share image):
cd rummy-home3 && node --import tsx --test tests/volume-client.test.ts
```

Files: `ci/volume/volume.sql` (schema `volume`: deterministic users, guests, My players, games
with seat-order dealers and one rummy winner per round), `ci/volume/run-volume.mjs` (cases,
timings, TAP + markdown output), `ci/volume/screenshots.mjs`, `rummy-home3/tests/volume-client.test.ts`.

## Summary table

Times are the measured RPC round-trip on the test VM after one warm-up call, DB in the same VM
(no network). Budgets are deliberately loose; on a phone over 4G add ~100–300 ms of network.

| # | Test case | Size | Expected | Actual | Pass | Time | Screenshot |
|---|-----------|------|----------|--------|------|------|------------|
| 1 | My players: page 1 (A–Z, Frequent), walk all pages, search by name, broad search (cap 50), whole list (older app), picker candidates | 100 | each < 150–500 ms | 2 pages, worst page 1 ms; search 1 ms | pass | 1–2 ms | — |
| 2 | same | 1,000 | same | 11 pages, worst 3 ms; search 4 ms; whole list 181 KB in 6 ms | pass | 2–6 ms | — |
| 3 | same | 10,000 (guard bypassed to seed; the live cap is 2,000) | same | 101 pages, worst 13 ms; search 31 ms; broad search 23 ms; whole list 1.8 MB in 51 ms; picker 12 ms | pass | 4–51 ms | — |
| 4 | Game: open scorecard (`get_game_bundle`), web `/r/` payload (`public_scorecard`), add a round | 2p × 50/100/200/500 r | < 500 ms, < 300 ms | 500 r: 1,000 scores, 126 KB bundle in 4 ms; round 501 refused GRD01 | pass | 2–6 ms | `volume/scorecard-2p-50r.png` |
| 5 | same | 10p × 50/100/200/500 r | same | 500 r: 5,000 scores, 601 KB web payload in 26 ms; round 501 refused GRD01 | pass | 3–26 ms | `volume/scorecard-10p-200r.png` |
| 6 | same | 20p × 50/100/200/500 r | same | 500 r: 10,000 scores, 1,062 KB bundle in 31 ms; web payload 1,181 KB in 61–141 ms; round 501 refused GRD01 | pass | 4–141 ms | `volume/scorecard-20p-500r.png` |
| 7 | User with many games: seed with the game-number trigger, numbers dense, Home (`get_home_bundle`), Results picker, Results list, visible ids, create one more game | 100 games | Home < 500 ms, next number S101 < 200 ms | seed 2.3 ms/game; Home 60 KB; S101 in 1 ms | pass | 1–19 ms | — |
| 8 | same | 1,000 games | S1001 | seed 4.0 ms/game; Home 12 ms; picker 19 ms; 1,000 ids 2 ms; S1001 in 3 ms | pass | 1–19 ms | — |
| 9 | same | 5,000 games | S5001 | seed 6.1 ms/game (30 s); Home 43 ms (46 ms before ANALYZE); picker 50 ms; 5,000 ids 9 ms; S5001 in 37 ms | pass | 2–50 ms | — |
| 10 | Results across 50 games × 20 players: declare | 50 games | refused — a result holds at most 30 games (024 rule, unchanged) | "Results can include at most 30 games" | pass | — | — |
| 11 | Results across 30 games × 20 players: declare, sheet (`get_game_result`), web `/r/` (`public_result`), picker shows all 50 games | 30 × 20 | declare < 1 s; sheet < 200 ms; web < 200 ms | declare 67 ms; sheet 20 standings + 30 round tables, 82 KB in 42 ms (was 250–280 ms before 032); web 10.6 KB in 10 ms (was 540–600 ms before 032) | pass | 10–67 ms | `volume/result-30x20.png` |
| 12 | Results compute in the app (standings, sheet, details, HTML, PDF, share image) | 50 × 20 (client only) | each < 300 ms, PDF < 1.5 s | details 5 ms, HTML 433 KB in 6 ms, PDF 153 KB in 4 ms, share image 1 ms | pass | ≤ 6 ms | — |
| 13 | Several admins scoring at once: five admins save the same round number in the same instant; then five rounds in turn | 5 admins, 5 seats | 1 saved, 4 PT409 (stale round); then 5 saved, dealer chain intact | 1 saved, 4 PT409 in 29 ms; 5 saved, 9 live rounds in 27 ms | pass | 27–29 ms | — |
| 14 | Many concurrent games: ten creators in one circle start a game at the same instant (number race); thirty games save a round at once | 10 games; 30 games | S1..S10 distinct; 30 saved < 2 s | S1 S2 … S10 in 331 ms; 30 saved in 79 ms | pass | 79–331 ms | — |
| 15 | Email burst vs daily cap: 150 outbox rows, flush with 90 sends left; provider down | 150 emails | 90 sent, 60 wait for tomorrow, none dropped; failed row kept with backoff | exactly that; failed row retries in 20 minutes | pass | 2 ms | — |
| 16 | Every guardrail hit (029): My players 2,000; 100 new players/day; 20 per game; 500 rounds; 10 live games; 50 games/day; 20 pending link requests | the limit | GRD01 with the documented message | GRD01 with the documented message, each | pass | — | — |
| 17 | Client: scorecard totals, rotation dividers, score tones, final-scores image, scorecard sheet | 2/10/20 p × 50–500 r | each < 200 ms | worst 1.5 ms | pass | ≤ 1.5 ms | — |
| 18 | Client: My players A–Z sections, name sort, search merge, 100-row paging | 100 / 1,000 / 10,000 | sections < 150 ms | 10,000: sections 1.8 ms, sort 0.8 ms, paging 33 ms | pass | ≤ 33 ms | — |
| 19 | Client: 500 rounds of dealer rotation with players joining mid-game | 500 r, 9→10→11 players | first rotation 10 rounds, none shorter than the table | as expected | pass | < 1 ms | — |

Database after the run: 6,269 games, 281,831 scores, 13,490 My players rows, ~100 MB.

## What broke or was slow, and what changed

1. **`public_result` took 540–600 ms for a 30-game result** regardless of size. Cause: PostgreSQL
   JIT compiling the big jsonb plan on every call (the 020 bundle RPCs already carry `set jit = off`;
   this one did not). Fix in **032**: `alter function public_result set jit = off` → 10–16 ms.
2. **`get_game_result` took 250–280 ms for 30 games × 20 players.** Cause: `game_rounds_json`
   looked each cell up separately and its CTE was inlined, so it re-ran once per player. Fix in
   **032**: `distinct on` of live scores `as materialized`, one `generate_series` over the round span,
   one lateral `jsonb_agg` per player → 1.5 ms per game, 42–50 ms for the sheet. Output is
   byte-identical to the 020 version (pgTAP 22 proves it on the seed games).
3. **Home took 7.5 s once, right after seeding 5,000 games.** Cause: stale planner statistics after
   a bulk load (autovacuum had not caught up), not the query. The runner records the pre-`ANALYZE`
   time and runs `ANALYZE` after each bulk seed.
   On Supabase autovacuum handles this; no app change.
4. Game-number assignment (028) costs ~2–6 ms per insert and grows slowly with the creator's
   history (lowest-free-integer scan over LIVE/COMPLETED games in the circle): 37 ms at 5,000 games.
   Acceptable for the 50 games/day guardrail; noted here in case a circle ever reaches tens of
   thousands of games.
5. The declare-50-games case is refused by design (024: at most 30 games per result); the table
   records the refusal and the 30-game case is the real volume test.

## Known gaps

- Screenshots are of the web `/r/` pages (scorecard and results), rendered by headless Chrome
  from the real RPC payloads. The React Native screens were exercised through their pure
  builders (`tests/volume-client.test.ts`), not screenshotted — there is no device in CI. Light
  and dark screenshots of the app screens come with the design PR.
- 10,000 My players can only be seeded with the 029 guard trigger disabled (the live cap is
  2,000); the case shows the list, search and paging stay fast well past the cap.
- Email flushing is simulated against `email_sends_left_today()` and the outbox rows; the
  provider itself is not called.
