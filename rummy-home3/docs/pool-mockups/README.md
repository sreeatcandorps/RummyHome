# Pool game — design mockups P01–P30 (PR 13). Nothing built.

Flat copy of the mockup set, embedded in [`../pool-design.md`](../pool-design.md) section 3. The folder names below
are the original grouping; here every file sits at the top level under its P-number.

30 mockups, 390 dp (landscape 844 dp), light theme, same style as the results brainstorm. Each PNG has a caption
strip naming the screen. Folders:

```
01-new-game/            P01 Pool selected · P02 Points for comparison · P03 custom limit
02-profile-defaults/    P04 Points and Pool defaults side by side
03-scorecard/           P05 portrait · P06 header states + formulas · P07 landscape
04-add-round/           P08 add round · P09 validation · P10 crossing the limit · P11 re-entry sheet
05-complete-and-award/  P12 last player standing · P13 complete early (split) · P14 award pending · P15 winner takes all ·
                        P16 top 3 · P17 custom unbalanced · P18 type points · P19 awarded · P30 awards locked when Closed
06-home-and-results/    P20 game cards P vs S · P21 results picker mixed · P22 results table with a P column
07-share-and-web/       P23 share live · P24 share final (awards) · P25 live link
08-settings-help-wording/ P26 settings locked mid-game · P27 help text · P28 store-safe wording · P29 log entries
_source/                generator (outside the repo)
```

---

## 1. What I understood (plain English)

A **Pool** is the same rummy, scored the opposite way round from a Points game.

- In a **Points** game every round balances to 0: the losers' drops and counts are negative and the winner takes the sum
  as plus points. Totals can go up or down; higher is better.
- In a **Pool** the winner of a round scores **0** and everyone else **adds** their hand to their score: Drop (20),
  Middle drop (40), Full count (80) or the counted hand (never more than Full count). Scores only go up; **lower is
  better**. The round does not balance.
- There is a **pool limit** — 101, 201, 250, 251 or any number. When your score **reaches** the limit you are **out**
  (101 is out, 100 is still in). The game ends when one player is left in (the winner), or earlier when the remaining
  players agree to stop and split.
- While the pool is on, each player wants to see three numbers: **score**, **points left** to the limit, and **drops
  left** (how many plain drops they can still afford). Those three go in the column header of the scorecard.
- The round-by-round pool scores are **not** what the pool is worth. Think of it as a tournament: everyone puts in the
  same entry (say 100 points); the pool total is entries × 100; at the end the admin decides how it is split — one
  winner takes all, or 2–3 winners in some split. Each player's **points for the game** = what they get − what they
  put in, so the awards always add up to 0, exactly like a Points game's totals do.
- Sree does **not** want to ask the entry up front and does not want money words anywhere. So: the pool is played with
  plain scores; when it is **Completed** the admin gets an **Award points** screen that shows the pool scores for
  reference and lets them give points to each player; the balance must be 0; Save. Those awarded points are what the
  pool game contributes to **Results**, where S and P games can be mixed.
- Settings: a pool has the same three values as Points (drop, middle drop, full count) **plus the limit**, and the
  profile keeps a separate set of Pool defaults from the Points defaults.
- Labels: pool games are already **P<n>** (migration 028); Points are S<n>. The `games.game_type` enum already has
  `'pool'`, the profile defaults already carry `poolDrop`/`poolMiddleDrop`, and `games.prize` / `prize_shares` exist from
  the old coins feature (hidden since the redesign). The New game form shows "Pool (later)" disabled today.

### Keep it as close to Points as possible (what stays identical)
New game form (one extra row), players picker, scorecard table shape (rounds × players, dealer in the round column,
winner cell green), Add round grid + keypad (keys relabelled), Complete flow, share image/link components, Results
components, game log (PR 13). What is new: the limit chips, the three-number header, OUT/re-entry states, the Award
points screen and the "award pending" state.

---

## 2. Things Sree may have forgotten (edge cases) — with my recommended answers

| # | Topic | What happens in real play | Recommendation |
|---|---|---|---|
| F1 | **Re-entry (rejoin)** | A player who goes out often buys back in, re-entering at the highest score still on the table (sometimes +1). Some groups only allow it while the highest score is low enough. | Allow **once per player** while the pool is open, at the **highest score still in** (no +1; configurable later if asked). Offered in the crossing-limit dialog (P10) and by tapping an OUT column (P11). A re-entry is a **second entry** in the award math. Logged. |
| F2 | **Split / compromise** | With 2–3 players left they often agree to split rather than play it out. | **Complete** works at any time (P13); the Award screen's presets + Custom cover any split. No special "split" button. |
| F3 | **Exactly reaching the limit** | 101 pool: is 101 out? Yes in every group I know. | **score ≥ limit = out**. Shown in the formulas card (P06). |
| F4 | **Drops left formula** | People count "how many drops can I still take". | `floor((limit − 1 − score) ÷ drop)`; points left = `limit − score`. Colour: green ≥ 2 drops, amber 1, red 0 (P06). |
| F5 | **Ties** | Two players out in the same round; or equal scores at a split. | Place order for presets = **who stayed in longest, then lower score**; equal → same place, the preset share is split equally. Awards are manual anyway. |
| F6 | **Last player standing** | Game is over automatically. | After the save that leaves one player, offer **Complete pool** (P12); admin may still Undo. Not forced — a typo should be fixable. |
| F7 | **Admin never awards** | Pool sits Completed forever. | Status **Award pending** (P14, P20); the game **cannot join a result** (P21 "Award points first"); Home card nags. An "All 0" preset lets the admin close it with no points. |
| F8 | **Editing awards later** | Mistyped split. | **Edit awards** until the game is Closed (in a result); then same rule as scores: delete the result first (P30). Every change logged old→new (P29). |
| F9 | **Awards in logs (PR 13)** | — | New kinds: `player_out`, `player_reentered`, `awards_set`, `awards_changed` (important); summary names everyone (P29). |
| F10 | **Player joins mid-pool** | Someone arrives late. | Joins at the **highest score still in** (same as re-entry), admin can type a different start. Counts as one entry. |
| F11 | **Player leaves mid-pool** (not out) | Someone has to go. | Mark as **Out (left)** from Players & Admins; stays an entry in the award math; the admin decides their award (usually −entry). |
| F12 | **Counted hand above Full count** | Typing 95. | Capped to Full count with a message (P09). |
| F13 | **No winner / two winners in a round** | Someone forgot to tap Rummy; or a wrong Rummy. | Exactly **one** player at 0 per round (P09). A wrong declaration is just Full count for that player. |
| F14 | **Settings change mid-game** | Changing the limit after rounds would change who is out. | Lock limit + the three values once round 1 is saved (P26), like Points today. |
| F15 | **Dealer rotation** | Dealer skips players who are out. | The 031 rotation uses "players still in" for a pool; a re-entered player rejoins the rotation. |
| F16 | **Undo** | Undo of a round that put someone out brings them back; undo of a re-entry. | Undo last round restores the out player; re-entry is its own undoable step (newest first). |
| F17 | **Expense setting** | Points has a hidden expense option. | Not offered for Pool. |
| F18 | **Multiplier (PR 11)** | — | Does not apply to a pool: awards are typed by hand. |
| F19 | **Minimum players** | — | 2 (same as Points). |
| F20 | **Which limit presets and defaults** | 101 pool usually 20/40/80, 201+ usually 25/50/80. | Chips 101 · 201 · 250 · 251 · Custom; default 101 with 20/40/80; picking 201/250/251 **suggests** 25/50/80 (user can change). Custom 51–999 and > Full count. |
| F21 | **Store-safe wording** | — | P28: use pool, pool limit, entry (points), pool total, points awarded; never prize, money, $, bet, stake, pot, payout, coins, winnings. |
| F22 | **Entry per player** | Sree: don't ask up front. | Not asked at creation. Award screen defaults the entry to **100 points** and lets the admin change it there (P15); "Type points" mode (P18) needs no entry at all. |
| F23 | **Where awards are stored** | — | Reuse `games.prize_shares` (net points per player) + new `awarded_at`, `awarded_by`, `award_note` (preset name / entry). `settings.poolLimit` for the limit. No new table. Results read `prize_shares` for P games instead of summing rounds. |
| F24 | **Scores sign in storage** | Points stores penalties negative. | Store pool round scores **positive** (`score_type` count/drop/middle_drop with value ≥ 0; rummy = 0) — the check constraint in `scores` needs a pool exception. Display never shows a sign. |

---

## 3. Screens (what each mockup shows and why)

- **P01–P03 New game**: segmented Points | Pool; Pool adds the limit chips above the same three fields; pool hint text;
  Custom shows a fourth field with validation. Button says "Start pool".
- **P04 Game defaults**: two blocks, Points and Pool, plus "New game starts as".
- **P05–P07 Scorecard**: same table as Points; header = initials, #no, big score, "49 left" (coloured), "2 drops";
  OUT column greyed and struck through with "OUT · R5"; ↺ for re-entered; red ✕ cell on the round that put someone
  out; a thin blue "re-entry ↺ 86" row; Standings card sorted lowest first with OUT at the bottom. Landscape identical.
- **P08–P11 Add round**: same grid + keypad; keys are Drop 20 / Middle 40 / Full 80 / Rummy · 0 / digits for the
  counted hand; each cell previews "81 → 101 · OUT"; amber summary of who goes out; validation (one Rummy, cap);
  crossing-limit dialog with the re-entry choice; re-entry sheet from the scorecard.
- **P12–P14 Complete**: last-player prompt; complete-early confirmation; Completed state with "Award pending".
- **P15–P18 Award points**: entry per player (editable), entries (incl. re-entries), pool total; presets Winner takes
  all / Top 2 70-30 / Top 3 50-30-20 / Custom; table Player · Pool score (grey, reference) · Put in · Gets (typed) ·
  Points (= Gets − Put in); green "adds up to 0 ✓" or red "−40 not given out" with Save disabled; second mode "Type
  points" for groups that settled differently.
- **P19, P30 After awards**: Points awarded (same player-line component as results, medal for the winner) above the
  final pool scores; Edit awards until Closed.
- **P20–P22 Home + Results**: P avatar marigold / S avatar green; pool cards show limit, out count, award state;
  results picker greys out "Award points first"; results table shows the P column with a marigold header and a legend
  line "pool: the awarded points count".
- **P23–P25 Share + web**: live share = standings with the three numbers; final share = awarded points headline, pool
  scores as one small line; live link = same table as the app.
- **P26–P29**: locked settings, help text in the PR 12 format, wording sheet, log entries.

---

## 4. Open questions for Sree (recommended answer in bold)

1. Re-entry: **allowed once, at the highest score still in**, no +1? Or never (simpler), or unlimited?
2. Should re-entry be restricted by score (e.g. only while the highest is below limit − full count)? **No rule; admin judgement.**
3. Default limit **101** with 20/40/80, and 25/50/80 suggested for 201/250/251 — right for your groups?
4. Award presets: **Winner takes all · Top 2 70/30 · Top 3 50/30/20 · Custom** — different splits?
5. Entry per player default **100 points**, editable on the Award screen only — or also in Pool defaults?
6. Keep the **"Type points"** second mode (P18)? It is the "manually award points" you described; the split mode is a helper on top.
7. Awards editable **until Closed** (P30), or only within the same day?
8. Late joiner starts at **highest score still in** (F10) — or at 0?
9. A player who leaves (F11): **Out (left)**, admin decides their award — OK?
10. Pool round scores stored **positive** (F24) — fine to change the `scores` check constraint in the migration?
11. Status word on Home: **"Award pending"** vs "Points pending" vs "Finish pool"?
12. Should the pool scorecard show the **Standings card** under the table (P05) or only the header numbers? **Show it** — it is what people read out loud.

---

## 5. Data / migration outline (for the spec, not built)

- `games.settings` gains `poolLimit` (int). `profiles.default_settings` gains `poolLimit` (default 101) and keeps
  `poolDrop`/`poolMiddleDrop` (+ `poolFullCount`, default −80 → stored as 80 for pools).
- `games.prize_shares` reused as **awards** (`{profile_id: net_points}`); new `games.awarded_at`, `awarded_by`,
  `award_note jsonb` (`{mode:'split'|'typed', entry:100, preset:'winner'|'top2'|'top3'|'custom'|'all0'}`).
- `game_players` gains `out_round int`, `reentered_round int`, `entries int default 1`, `left_at`.
- `scores` check constraint: for pool games values are ≥ 0 and `rummy` = 0.
- `save_round` (pool branch): exactly one rummy, cap at full count, computes `out_round` for players that reach the
  limit, skips out players in dealer rotation; new RPC `reenter_player(game_id, profile_id)`; new RPC
  `set_pool_awards(game_id, awards jsonb, note jsonb)` (sum must be 0, only when Completed and not Closed).
- `declare_game_result` / `get_game_result` / `public_result`: P games contribute `prize_shares`; refuse a pool without
  awards. `list_result_candidates` flags `awardsPending`.
- Log kinds (PR 13 table): `player_out`, `player_reentered`, `awards_set`, `awards_changed`.
- Rollback file, `docs/migrations-to-apply.md`, pgTAP.

---

## 6. Proposed test cases

Codes: D pgTAP · U unit · S Maestro smoke · N nightly · C concurrency · R rollback.

| # | Type | Steps | Expected |
|---|---|---|---|
| 10.1 | U | `dropsLeft(score, limit, drop)` for 52/101/20, 81, 94, 100, 101 | 2, 0, 0, 0, 0; `pointsLeft` 49, 20, 7, 1, 0; `isOut` false ×4, true |
| 10.2 | U | pool round validation: no rummy / two rummies / count 95 with full 80 / all good | refused, refused, capped to 80 with message, ok |
| 10.3 | D | `save_round` pool: round that takes HG to 101 | `game_players.out_round = 6`; next dealer skips HG |
| 10.4 | D | `reenter_player` for an out player | score set to highest in; `reentered_round`, `entries = 2`; refused if not out, if already re-entered, if game completed |
| 10.5 | D | `set_pool_awards` sum ≠ 0 / game Active / game Closed / sum = 0 Completed | refused ×3; saved with `awarded_by`, `awarded_at` |
| 10.6 | D | `declare_game_result` with a pool without awards | refused "Award points first"; with awards → result uses `prize_shares`, not round sums |
| 10.7 | D | result mixing S + P | totals = S round sums + P awards; `public_result` legend flag per game |
| 10.8 | D | undo last round after an out | `out_round` cleared; undo after re-entry removes the re-entry first |
| 10.9 | D | settings update after round 1 (pool) | refused for `poolLimit`, drop, md, full |
| 10.10 | R | 03x down/up | both succeed with pool rows present |
| 10.11 | C | two admins save round 6 with different winners | second refused with PT409 (existing rule) |
| 10.12 | U | `rulesFromProfileDefaults` with/without pool keys | Pool defaults 101/20/40/80 when missing; Points untouched |
| 10.13 | S | New game → Pool → 101 → 5 players → Start | scorecard header shows 0 · 101 left · 5 drops for everyone |
| 10.14 | S | Add round: 4 drops + 1 Rummy → Save | scores 20/0; header updates to 81 left · 4 drops |
| 10.15 | S | rounds until one player hits 101 | red ✕ cell, OUT header, crossing-limit dialog, standings puts them last |
| 10.16 | N | re-enter from the OUT column | blue re-entry row at highest score; entries 2 in Award screen |
| 10.17 | N | play to last player → Complete → Award: winner takes all → Save | balance 0, saved, card shows Awarded; Results picker accepts the game |
| 10.18 | N | Award custom −40 | Save disabled, red balance; fix → enabled |
| 10.19 | N | Type points mode, +450/+150/0/−100/−100/−300/−100 | saved; log shows awards_set with names |
| 10.20 | N | Edit awards → change two players | log awards_changed old→new; results preview updates |
| 10.21 | N | Results with S14 + P10 | P column marigold header; legend line; totals correct |
| 10.22 | N | Share live pool image, share final image, open live link | three numbers / awards headline / same table; no forbidden words (U test greps all pool strings against the P28 "never" list) |
| 10.23 | N | landscape scorecard with 9 players | header readable, OUT column greyed |
| 10.24 | N | Help ? on pool scorecard | P27 text, fits one screen |
| 10.25 | N | Game defaults: change Pool to 201 / 25 / 50 / 80, Points unchanged | New game Pool pre-fills 201 · 25/50/80; Points still −10/−30/−80 |

---

## 7. Fit in the PR sequence

Unchanged position: **PR 10**, after PR 9 (Delete a result) and before PR 11 (Multiplier) and PR 12 (Help), i.e.
after the Results screen (PR 8) and the logs PR (PR 13, built after PR 2) exist — Pool needs both: Results must know how
to take awards instead of round sums, and the log must have kinds for out / re-entry / awards. Multiplier (PR 11) does
not touch pools. PR 10 is its own migration (next free number when it starts) and ships in one PR with the spec in
section 5 written up first for Sree's sign-off.
