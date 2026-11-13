# Pool game — spec for sign-off (PR 10, migration 040). Nothing built.

Resumed Nov 13 after PRs 2–9 landed in the stack. This turns the mockup README (`/opt/cursor/artifacts/design-pool/`,
30 PNGs P01–P30) into a buildable spec against the schema as it stands after 039. Sree's open questions are at the
end with the recommended answers; the build starts only after those are answered.

## 1. The rules in one paragraph

A Pool is rummy scored upside down. The round's winner scores **0**; everyone else **adds** their hand — Drop (20),
Middle drop (40), Full count (80) or the counted hand, never above Full count. Scores only go up, lower is better,
the round does not balance. A **pool limit** (101, 201, 250, 251 or any number) puts a player **out** when their score
**reaches** it (101 is out, 100 is in). The pool ends when one player is left, or earlier when the rest agree to
stop. The pool scores are not what the game is worth: when it is Completed the admin **awards points** (a split that
adds up to 0, exactly like a Points game's totals), and those awarded points are what the pool contributes to
Results, where S and P games mix.

## 2. What already exists (no work)

| Piece | Where | State |
|---|---|---|
| `game_type` enum has `'pool'`; `games.prize`, `prize_shares` | 006/007 | unused since the redesign; `prize_shares` is reused for awards |
| P-numbers | 038 `game_label_prefix` → `'P'`; numbers reused among active games in the circle (Sree's D5.1 override) | done — P1, P2 again on a new day, same as S |
| Points defaults | `profiles.default_settings` (`stakeDrop`, `stakeMiddleDrop`, `maxCount`), `utils/gameSettings.ts` `GameKind = 'points' \| 'pool'` | pool keys to add: `poolDrop`, `poolMiddleDrop`, `poolFullCount`, `poolLimit` |
| Logs | 036 `event_log.kind` check list, `log_event`, triggers | kinds to add (section 4) |
| Results | 034 `result_places_json`, 024 `public_result`, 023 delete/restore, PR 9 Delete + Undo | P games must contribute `prize_shares` instead of round sums |
| Initials | 039 rule (letter first, 2–3 chars) | unchanged; pool column headers use the same labels |
| Dealer rotation | 031 round robin in `save_round` | needs "skip players who are out" for pools |
| Undo | 035 `undo_last_round` | needs "clear `out_round` / unwind a re-entry" for pools |

## 3. Screens (P01–P30)

- **New game (P01–P03).** Segmented Points | Pool above the existing form. Pool adds a row of limit chips
  101 · 201 · 250 · 251 · Custom above the same three fields (Drop / Middle drop / Full count, shown positive for a
  pool). Default 101 with 20/40/80; choosing 201/250/251 suggests 25/50/80 (editable). Custom: 51–999 and > Full
  count. Button reads **Start pool**. Everything else (picker, admins, initials fix) is the Points form.
- **Game defaults (P04).** Profile › Game defaults shows two blocks, Points and Pool, plus "New game starts as".
- **Scorecard (P05–P07).** Same table. Header per player: initials · #no · big score · "49 left" (green ≥ 2 drops,
  amber 1, red 0) · "2 drops". OUT column greyed, struck through, "OUT · R5"; ↺ badge when re-entered; red ✕ on the
  round that put someone out; thin blue "re-entry ↺ 86" row; Standings card under the table sorted lowest first, OUT
  last. Landscape identical. Formulas: points left = `limit − score`; drops left = `floor((limit − 1 − score) ÷ drop)`.
- **Add round (P08–P11).** Same grid + keypad (PR 3 colours: yellow selected, green saved). Keys: Drop 20 · Middle 40 ·
  Full 80 · Rummy · 0 · digits. Each cell previews "81 → 101 · OUT". Validation: exactly one Rummy (0); a counted hand
  above Full count is capped with a message. Save shows an amber line naming who goes out. Crossing-limit dialog offers
  **Re-enter at <highest score still in>** or **Out**. Re-entry sheet also from tapping an OUT column.
- **Complete (P12–P14).** After the save that leaves one player: "Last player standing — Complete pool?" (Undo still
  possible). Complete early at any time (split). Completed state shows **Award pending** until awards are saved.
- **Award points (P15–P18).** Entry per player (default 100 points, editable here only), entries (re-entries count
  twice), pool total. Presets Winner takes all · Top 2 70/30 · Top 3 50/30/20 · Custom · All 0. Table: Player · Pool
  score (grey) · Put in · Gets · Points (= Gets − Put in). Green "adds up to 0 ✓" enables Save; red "−40 not given
  out" disables it. Second mode **Type points** (no entry; type each player's points, must sum to 0).
- **After awards (P19, P30).** "Points awarded" block (same player lines as results, medal for the winner) above the
  final pool scores. **Edit awards** until the game is Closed (in a result); then delete the result first (PR 9 makes
  that one tap + Undo).
- **Home + Results (P20–P22).** P avatar marigold, S green. Pool cards show limit, out count, Award pending. Results
  picker greys out an unawarded pool: "Award points first". Results table: P column header marigold, legend line "pool:
  the awarded points count".
- **Share + web (P23–P25).** Live image = standings with the three numbers; final image = awarded points headline,
  pool scores one small line; `/g/` live page = same table.
- **Settings / help / wording / log (P26–P29).** Limit and the three values lock once round 1 is saved (same as
  Points). Help in the PR 12 format. Store-safe words only: pool, pool limit, entry (points), pool total, points
  awarded — never prize, money, $, bet, stake, pot, payout, coins, winnings (a unit test greps every pool string).

## 4. Data and RPCs — migration `040_pool.sql` (+ rollback)

**Columns**
- `games.settings` gains `poolLimit int` (pool games only). `profiles.default_settings` gains `poolLimit` (101),
  `poolDrop` (20), `poolMiddleDrop` (40), `poolFullCount` (80) and `startsAs` (`'points'|'pool'`).
- `games.awarded_at timestamptz`, `awarded_by uuid`, `award_note jsonb`
  (`{mode:'split'|'typed', entry:100, preset:'winner'|'top2'|'top3'|'custom'|'all0'}`). Awards themselves go in the
  existing `games.prize_shares` as `{profile_id: net_points}` (sum 0).
- `game_players.out_round int`, `reentered_round int`, `entries int not null default 1`, `left_at timestamptz`.
- `scores` check: today `value <= 0` for drop/middle_drop/count/expense, any sign for rummy (037). Add: for a pool game
  `value >= 0` and rummy `= 0`. Done as a trigger-checked rule (`scores_pool_sign`) rather than a cross-table check
  constraint.

**Functions (new or pool branch)**
- `save_round` pool branch: exactly one rummy row at 0; cap at `poolFullCount`; after insert, set `out_round` for
  players whose running total ≥ `poolLimit`; dealer rotation (031) skips players with `out_round` set and no
  `reentered_round` after it; refuses a round when ≤ 1 player is in.
- `reenter_player(p_game_id, p_profile_id)`: admin only, player must be out, not re-entered before, game active;
  inserts a `reentry` score row on the current round worth `highest score still in − player's score` (so round sums
  stay the truth), sets `reentered_round`, `entries = 2`, clears `out_round`. Logged.
- `undo_last_round` pool branch: clears `out_round` set by that round; a re-entry made after that round is undone
  first (its own undoable step, newest first).
- `set_pool_awards(p_game_id, p_awards jsonb, p_note jsonb)`: admin only, game Completed and not Closed, keys = the
  seated players (incl. left), sum must be 0; writes `prize_shares`, `awarded_at/by`, `award_note`. Second call = edit
  (logged old → new).
- `mark_player_left(p_game_id, p_profile_id)`: sets `left_at`, treated as out for rotation and standings.
- `update_game_settings`: refuses `poolLimit` / drop / middle / full after round 1 for a pool (already so for Points).
- `declare_game_result`: a pool without `awarded_at` → "Award points first"; with awards each player's contribution is
  `prize_shares[profile]`. `result_places_json`, `get_game_result`, `public_result`, `list_result_candidates`
  (`awardsPending: true`) follow. Results' `sheet.games[]` gains `kind: 'points'|'pool'` so the P column is marked.
- Logs: widen the 036 kind check with `player_out`, `player_reentered`, `player_left`, `awards_set`, `awards_changed`
  (all `important`); summaries name the players ("HG is out at 104 · R6", "Points awarded · SK +450 · HG −150 …").
- Grants as 023 does; rollback drops the columns, functions, trigger and restores the 036 kind list and the 035/036
  `save_round` / `undo_last_round` bodies.

## 5. App surfaces touched

`app/(screens)/games/new.tsx` (segmented control + limit chips), `utils/gameSettings.ts` (pool defaults, limit
suggestions), Profile › Game defaults, `components/game/*Header*` (three numbers, OUT state), Add round
(`utils/scoring.ts` pool validator, keypad labels, preview, crossing-limit dialog), new `games/[id]/award.tsx`,
`utils/completeGame.ts`, Home card chips, Results picker + `utils/resultsDesign.ts` (P column, legend), share
image/PDF/`public/scorecard.html` + `public/r/index.html`, `constants/help.ts`, event-log labels.

## 6. Tests (codes as in `docs/testing-strategy.md`)

| # | Kind | What |
|---|---|---|
| 10.1 | U | `pointsLeft`, `dropsLeft`, `isOut` for 52/81/94/100/101 at limit 101, drop 20 → left 49/20/7/1/0, drops 2/0/0/0/0, out only at 101 |
| 10.2 | U | pool round validation: no rummy / two rummies / count 95 with full 80 / good → refused, refused, capped with message, ok |
| 10.3 | U | store-safe wording: every pool string vs the P28 "never" list |
| 10.4 | U | `rulesFromProfileDefaults` without pool keys → 101 · 20/40/80; Points untouched; 201 suggests 25/50/80 |
| 10.5 | D | `save_round` pool: round that takes HG to 101 sets `out_round = 6`; next dealer skips HG; ≤ 1 player in → refused |
| 10.6 | D | `reenter_player`: score = highest in, `entries = 2`; refused when not out, twice, or Completed |
| 10.7 | D | `set_pool_awards`: sum ≠ 0 / Active / Closed → refused; sum 0 Completed → saved with who/when; second call logs `awards_changed` |
| 10.8 | D | `declare_game_result` with an unawarded pool → "Award points first"; awarded → result uses `prize_shares`; mixed S + P totals = S sums + P awards; `public_result` marks the P game |
| 10.9 | D | `undo_last_round` after an out clears `out_round`; after a re-entry removes the re-entry first |
| 10.10 | D | pool settings locked after round 1; `scores_pool_sign` refuses a negative pool score and a non-zero rummy |
| 10.11 | R | 040 down/up with pool rows present; 036 kind list restored and widened again |
| 10.12 | C | two admins save round 6 with different winners → second refused (035 rule) |
| 10.13 | S | New game → Pool → 101 → 5 players → Start pool → header 0 · 101 left · 5 drops |
| 10.14 | S | Add round 4 drops + Rummy → 20/0; header 81 left · 4 drops |
| 10.15 | N | rounds until one player hits 101 → red ✕, OUT header, crossing-limit dialog, standings last |
| 10.16 | N | re-enter from the OUT column → blue row at highest in; Award screen shows entries 2 |
| 10.17 | N | last player → Complete → Award winner takes all → Save → Awarded; Results picker accepts it |
| 10.18 | N | Custom −40 → Save off, red balance; fix → on |
| 10.19 | N | Type points mode → saved; Log `awards_set` names everyone |
| 10.20 | N | Edit awards → Log `awards_changed` old → new; results preview updates |
| 10.21 | N | Results S14 + P10 → marigold P header, legend, totals |
| 10.22 | N | share live, share final, live link → three numbers / awards headline / same table |
| 10.23 | N | landscape 9 players; help ? on the pool scorecard |
| 10.24 | N | Game defaults Pool 201 · 25/50/80 → New game pre-fills; Points unchanged |

## 7. Open questions for Sree (recommended in bold)

1. Re-entry: **once per player, at the highest score still in, no +1** — or never / unlimited?
2. Any score rule for re-entry (e.g. only while the highest is below limit − full count)? **No rule; admin judgement.**
3. Default **101 with 20/40/80**; 25/50/80 suggested for 201/250/251 — right for your groups?
4. Presets **Winner takes all · Top 2 70/30 · Top 3 50/30/20 · Custom · All 0** — other splits?
5. Entry default **100 points, editable on the Award screen only** — or also in Pool defaults?
6. Keep the **Type points** mode (P18) next to the split helper?
7. Awards editable **until Closed** (P30) — or same day only?
8. Late joiner starts at **highest score still in** — or 0?
9. A player who leaves: **Out (left)**, admin decides their award — OK?
10. Pool round scores stored **positive** with a pool-only sign rule — fine?
11. Home status word: **Award pending** vs "Points pending" vs "Finish pool"?
12. Standings card under the pool table (P05): **show it**?

## 8. Place in the sequence

PR 10, after PR 9. Its own migration **040** (next free after 039), rollback, pgTAP `31_pool_040.sql`, unit tests,
smoke 10.13–10.14 and nightly 10.15–10.24, one PR. Multiplier (PR 11) does not touch pools. Build starts after the
answers above; the spec is then copied into the PR body as the contract.
