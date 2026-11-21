# Volume testing

Final launch batch, item 9 (Nov 12, 2026; pool / dealer / seating / reopen cases added Nov 21). Every case below ran against the full migration set
(001–052) on a local PostgreSQL 16 with the real RPCs, as the real users would call them
(`volume.login(uid)` sets the `authenticated` role and JWT claims inside each transaction, so
RLS and every guardrail apply). Nothing here touches the live Supabase project.

The full per-row table from the last run is in
[`volume/results-2026-11-21.md`](volume/results-2026-11-21.md) (137 rows, all pass, 40 s wall, on
migrations 001–052; machine-readable copy in `results-2026-11-21.json`; the Nov 12 run on 001–032 is
kept beside it). Since Nov 21 the ladder and the stress budgets run **every night** (`select-tests.mjs`
puts `volume` in the nightly tier), not only at pre-release. Representative screenshots are in
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
| 3 | same | 10,000 (guard bypassed to seed; the live cap is 1,000) | same | 101 pages, worst 13 ms; search 31 ms; broad search 23 ms; whole list 1.8 MB in 51 ms; picker 12 ms | pass | 4–51 ms | — |
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
| 16 | Every guardrail hit (029): My players 1,000 (2,000 at the time of the recorded run); 100 new players/day; 20 per game; 500 rounds; 10 live games; 50 games/day; 20 pending link requests | the limit | GRD01 with the documented message | GRD01 with the documented message, each | pass | — | — |
| 17 | Client: scorecard totals, rotation dividers, score tones, final-scores image, scorecard sheet | 2/10/20 p × 50–500 r | each < 200 ms | worst 1.5 ms | pass | ≤ 1.5 ms | — |
| 18 | Client: My players A–Z sections, name sort, search merge, 100-row paging | 100 / 1,000 / 10,000 | sections < 150 ms | 10,000: sections 1.8 ms, sort 0.8 ms, paging 33 ms | pass | ≤ 33 ms | — |
| 19 | Client: 500 rounds of dealer rotation with players joining mid-game | 500 r, 9→10→11 players | first rotation 10 rounds, none shorter than the table | as expected | pass | < 1 ms | — |
| 20 | **Pool at the cap** (041–052, added Nov 21): seed 19p × 499r pool at a limit nobody reaches; `pool_recompute` over the whole game; `get_game_bundle` (pool limit in the bundle); web `/r/` payload; late joiner (`add_seated_player`, starts at the highest score still in, sits after the dealer); round 500 with twenty in (`save_round` + recompute); dealer override for round 501 (`set_round_dealer`); seating reversed (`set_seating_order`); bundle again; awards for twenty (`set_pool_awards`); reopen clears the awards (049) | 19→20p × 500r pool | each < 300–500 ms | recompute 51 ms; bundle 1,000 KB in 37 ms; web 1,114 KB in 56 ms; join 31 ms at 19,015; save 28 ms; dealer 3 ms; seating 3 ms; awards 2 ms; reopen 1 ms | pass | 1–56 ms | `volume/scorecard-pool-19p-499r.png` |
| 21 | **A real pool**: 10p at 101 after three rounds of 5..75 (5 out, 5 in); `reenter_player` (047: back in at the highest score still in); the next round scored for those in only; scoring a player who is out is refused by name | 10p pool at 101 | re-entry < 300 ms; refusal names the player | re-entry 3 ms at 90; round 4 saved for 6 in 3 ms; "Guest 00005 … is out of the pool and cannot be scored. Re-enter them first." | pass | 3 ms | — |
| 22 | **Pool results**: 30 awarded pools × 20 players → `declare_game_result`, `get_game_result`, `public_result`; reopening one of the 30 marks the result stale (050) instead of refusing | 30 pools × 20 players | declare < 1 s; sheet, web < 300 ms | declare 145 ms; sheet 20 standings, kind pool, 75 KB in 124 ms; web 13 KB in 10 ms; reopen 8 ms, `result_stale_json` set | pass | 8–145 ms | `volume/result-pool-30x20.png` |

Database after the run (Nov 21): 6,299 games, 297,357 scores, 12,536 My players rows, 117 MB.

Case 7–9's "numbers dense, S5001" expectation was rewritten on Nov 21: since 038 (D5.1, Nov 13) a short
number is free again the moment a game leaves Active, so a user with 5,000 *completed* games gets S1 — the
ladder now asserts exactly that (and still times the trigger per insert and the next-number query, 46 ms at
5,000 games).

## What broke or was slow, and what changed

0. **(Nov 21) The repo's web scorecard page did not render at all.** Rendering the payloads with
   `ci/volume/screenshots.mjs` gave "Could not load the scorecard." for every card: PR 14 declared
   `const multiplier` in `render()` below its first use (a TDZ `ReferenceError`). Fixed in its own PR with a
   test that executes the page script in a stub DOM. Live was unaffected only because live still serves the
   older page (Q6).

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

- **No hosted environment has ever been under load.** Everything here is a local PostgreSQL; latency,
  PostgREST, Realtime fan-out, the pooler cap and the free-tier limits are untested. The plan for a
  staging project, a staging APK and k6 load runs is `docs/test-environment-plan.md` (Q12).

- Screenshots are of the web `/r/` pages (scorecard and results), rendered by headless Chrome
  from the real RPC payloads. The React Native screens were exercised through their pure
  builders (`tests/volume-client.test.ts`), not screenshotted — there is no device in CI. Light
  and dark screenshots of the app screens come with the design PR.
- 10,000 My players can only be seeded with the 029 guard trigger disabled (the live cap is
  1,000, 2,000 when the run in `docs/volume/` was recorded); the case shows the list, search and paging stay fast well past the cap.
- Email flushing is simulated against `email_sends_left_today()` and the outbox rows; the
  provider itself is not called.
