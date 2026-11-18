# Pool game — approved spec (PR 13, migration `041_pool.sql`)

**Mockups:** all 31 PNGs are in [`docs/pool-mockups/`](pool-mockups/) (P01–P30, plus P03b) and embedded below in section 3.

Spec #23 (Nov 13) was reviewed by Sree screen by screen on Nov 14 and approved for building with the changes in
section 0. This file is the build contract for PR 13; the earlier open questions (old section 7) are answered here.

## 0. Sree's decisions (Nov 14) and what changed

| # | Decision | Where it lands |
|---|---|---|
| 1 | **New game is two screens.** Screen 1 Players, button **Next** (not Start game). Screen 2 Game type: Points or Pool and its settings, picked players listed at the bottom, **Back to players**, **Start**. Settings prefill from the user's saved defaults (Points or Pool), editable for this game only, with the link "You can also set these defaults in Settings". The Pool limit picker is here and in Settings. | P01–P03b, `games/new.tsx` + new `games/new-type.tsx` |
| 2 | **Pool limits 101 · 201 · 251 · Custom.** 100 is in, 101 is out (200 in / 201 out, 250 in / 251 out). 250 dropped. | P02, P04, `utils/pool.ts` |
| 3 | **Pool default drops: 25 / 50 / 130** (drop / middle drop / full count). | P02, P04, `utils/gameSettings.ts` |
| 4 | **Re-entries is a setting: Unlimited / Limited N** (Nov 14 10:27 PM PT, replacing the on/off switch and F13.1 "once per player"). Default **Unlimited**; Limited shows a number field (0 = none). It cascades like every other pool setting: app default (Unlimited) → the user's default in Settings → this game on the Pool New game screen; editable mid-game. No "not allowed after N points" rule. After every round the app shows who is eligible for re-entry. | P02, P04, P10, P11, `reenter_player`, `settings.reentryLimit` (042) |
| 5 | **Scorecard** keeps round order (latest at the bottom, focus on it) and the **Standings** section below. Points-left and drops-left leave the main grid (they live in Standings). Column header: **initials**, then **score** (the player-number line was dropped on Nov 18 — Sree: Points and Pool should match; the Player ID stays on My players and Players · Admins). A re-entered player is coloured **blue** instead of carrying a tag. | P05–P07, `ScoreTable`, `PoolStandings` |
| 6 | **Round entry allows more than one zero** (no "exactly one winner" rule). A count above the Full count asks "Are you sure?" and is then **allowed** (no cap). | P08, P09, `utils/pool.ts` validation |
| 7 | **Multiplier principle (PR 14):** users always enter actual points; the multiplier computes the saved total shown on the scorecard. PR 13 removes the high-number warning and keeps only the "more than Full count?" confirm. PR 13 stores points ×1. | P06 formulas, `score-entry.tsx` |
| 8 | **Awards:** categories the admin taps to preview each player's award, table sorted by pool points left: (a) **Winner takes all**, (b) **By points left** (proportional to points left over everyone's points left), (c) **50/50** even split (replaces 70/30), (d) **One entry per drop left, winner gets the rest**, (e) **Custom**, edited inline on the same screen. The separate "type points / split the pool" screen (old P18) is gone. | P15–P18, `games/award.tsx`, `utils/poolAwards.ts` |
| 9 | **Awards may be saved even if they don't add up.** Warning: "X points weren't given out. Save awards anyway?" Never mention expenses or money. | P18, `set_pool_awards` (no sum check) |
| 10 | **Results** mix Points and Pool games. A pool game is selectable only once awarded; a Completed-but-not-awarded pool is greyed out with "Give awards first". Only admins create results (as today). No separate New result screen (the existing picker). **Nov 18 (Sree):** the end of a game is **Complete → Awards → Final screen → Done (Home)**; Results is a separate errand from Home, never nudged in the end flow. A completed pool without awards just reads **Completed** (no "Awards pending"); the picker says "Give awards first" only when it is picked. Closed only after the result. | P21, `results/index.tsx`, `declare_game_result`, `utils/endFlow.ts` |
| 11 | **Colours:** games (all types) use **yellow**, including the Pool column header in results; results are always **green**. | P20, P22, `constants/theme.ts` `gameTypes.stake` → yellow |
| 12 | **Wording:** "stake" and "prize" removed everywhere in the app; only **awards**, **results**, **winners**. A unit test greps the UI strings. | P28, `tests/pool-wording.test.ts` |
| 13 | **Kept as designed:** header states and formulas, landscape, P19 (completed + awarded keeps showing out players' scores), P20 home cards (leader and creator tags), live link, game settings, help, log. | — |
| 14 | **Tutorial (PR 12, later)** must explain Complete, Award, Result. | PR 12 backlog |
| 15 | **(Nov 14, 8:40 PM) Initials are never cut off.** All three characters show in the pool header and everywhere else initials appear (scorecard columns, standings, awards); widths, font or layout give way, never the label. A CI/visual check runs with three-letter initials (WWW, MMM) and 20 players. | F13.22: `utils/scorecardLayout.ts` `fitInitialsFontSize`, `ScoreTable` header, `SeatAvatar`, `PoolStandings`, `PoolAwardsCard`; Game W + `smoke/17`; `tests/initials-fit.test.ts` |
| 16 | **(Nov 14, 8:40 PM) "Entry per drop left" stays, with a viability rule.** The option is viable only when the winner's share (what is left after the drop entries) is strictly more than every other player's; level, behind or negative is not viable. Then it is not suggested or preselected, it is greyed, and a tap shows "This is not ideal for this situation because the winner gets less than the others. Please pick another option." and does not apply. The lowest score always gets the most: the same check runs on the other presets (always true for Winner takes all and By points left; 50 / 50 levels second place by design, flagged) and Custom warns instead of blocking. | F13.23: `utils/poolAwards.ts` `winnerGetsMost` / `presetViability` / `viablePresets`, `games/award.tsx`; `tests/pool-pr13.test.ts` 13.5c; `smoke/16` |
| 17 | **(Nov 15) Q13.25 — 50 / 50 is a deliberate exception.** "The lowest score gets the most" (row 16) greys a preset when the winner would not get strictly more than everyone else. The 50 / 50 even split levels second place with the winner by design; Sree confirmed it is a deliberate exception: it is always offered, never greyed, and its hint stays "split the pool evenly". No code change; the rule is written down and pinned by a test. | `utils/poolAwards.ts` `presetViability`, `tests/pool-pr13.test.ts` 13.5c |

| 18 | **(Nov 17, v11 feedback → PR 24) Wording:** no "stake" anywhere the user reads; the money-free game type is **Points**. | `tests/pool-pr24.test.ts` X24-1 |
| 19 | **(PR 24) Colours stay.** No new scheme; only tags that repeat the avatar's type colour may be simplified. | — |
| 20 | **(PR 24) The pool scorecard reads like the Points scorecard.** Same header type, same initials size, same spacing; the pool header is exactly one small line taller (the #number line) and nothing else differs. Initials never cut off (2–3 characters, up to 20 players). | `utils/scorecardLayout.ts` `headerHeight(…, pool)`, `ScoreTable` |
| 21 | ~~(PR 24) Portrait pool split ~70 / 30~~ **Replaced Nov 18 (Sree's 5-line rule):** the card **hugs** its content — the round rows (one placeholder row at 0 rounds), **one empty row**, then the Creator / Admin / Unique game ID lines — and stops growing at **five round-row heights**; from there the rounds scroll with the **newest round at the bottom of the card** and the empty row + footer below it. At 0 rounds that is five lines (row · empty · Creator · Admin · ID). The Standings take the rest of the screen in their own scroller. No tabs, no collapsible standings. | `ScoreTable` `hugRows`, `POOL_CARD_MAX_ROWS`, `newestRoundOffset`, `poolCardBodyHeight` |
| 22 | ~~(PR 24) Landscape pool: Standings below the rows~~ **Replaced Nov 18 (Sree):** landscape pool is the **full-width table alone**, like Points — no Standings in landscape ("they can always come back to portrait"). A completed pool keeps **Give awards / Change awards** for an admin in the strip, since the awards card lives in the portrait standings pane. | `games/[id].tsx` `strip-give-awards` |
| 23 | **(PR 24) Footer (Creator · Admin · Unique game ID)** lives **inside** the scorecard card right under the last round row, scrolls with the rounds, at 70 % of its old size, italic, never bold — pool and Points, both orientations. No pull-down footer. | `GameIdFooter`, `footerType()`, `ScoreTable` `footer` slot |
| 24 | **(PR 24) Re-entry settings grouped.** New pools default to **Unlimited** re-entries; switching to Limited leaves the count **empty** (no guessed number). **Re-entry score** = "Highest score" or "Highest score + 1", default **+ 1**, in Settings and per game. **Late entry** is its own section with the same two choices, default **+ 1**. Server rule in 047 (written, **not applied** to live); until it runs, the server re-enters at the highest (041) and the +1 rules take effect only once 047 is applied. | `RulesForm`, `settings.reentryPlus` / `lateEntryPlus`, `047_reentry_and_late_entry_score.sql` |
| 25 | **(PR 24) Re-entry display.** The re-entry round shows the **re-entry score** (105 with +1 → 106) with the ↺ mark beside it; the typed score is saved, not shown. That player's cells in rounds **above** the re-entry row go grey; the re-entry row and after keep normal colours. A tap on a round number edits that round; Undo re-entry stays. | `ScoreTable` `REENTRY_MARK`, `beforeReentry`, `onRoundPress` |
| 26 | **(PR 24) New game is four steps;** every button says **Next** and only the last says **Start game**: Players → Game type → **Order of players** → Co-admin (skipped when nobody can be picked, then the order step starts the game). No scorecard pop-up after Start. | `games/new.tsx`, `GameTypeStep`, `OrderStep`, `CoAdminStep` |
| 27 | **(PR 24) Order of players** (one component at game start and mid-game): rows = avatar, name, initials, player ID when it fits. At start nobody is numbered and there are no arrows; tapping an unnumbered player gives the next number and moves them up (numbered on top in order, the rest below in pick order); tapping the most recently numbered player takes the number back; tapping any other numbered player only highlights. Numbered rows show subtle ▲ n ▼ that work at once. One highlighted row at a time. Buttons **Clear** and **Done** (Done once everyone is numbered). Mid-game the sheet opens prefilled so one move is one tap. The chips panel ("Picked up · Seated") and "Keep this order" are gone for good. | `components/game/OrderOfPlayers.tsx`, `utils/seating.ts` `OrderDraft`, `SeatingSheet`, `OrderStep` |

Small decisions taken while building (flagged in the PR body as F13.1–F13.12) are listed in section 7.

## 1. The rules in one paragraph

A Pool is rummy scored upside down. The round's winner scores **0** (more than one player may); everyone else **adds**
their hand — Drop (25), Middle drop (50), Full count (130) or the counted hand (a count above Full count is confirmed,
then allowed). Scores only go up, lower is better, the round does not balance. A **pool limit** (101, 201, 251 or a
custom 51–999) puts a player **out** when their score **reaches** it (101 is out, 100 is in). With **Re-entry** on
(default) a player who is out may come back **once**, at the highest score still in; after every round the app lists
who is eligible. The pool ends when one player is left, or earlier when the rest agree to stop. The pool scores are not
what the game is worth: when the pool is **Completed** the admin gives **awards** (points per player, usually adding up
to 0 like a Points game's totals), and those awards are what the pool contributes to **Results**, where S and P games
mix. Complete → Award → Result; the game is Closed only after the result.

## 2. What already exists (no work)

| Piece | Where | State |
|---|---|---|
| `game_type` enum has `'pool'`; `games.prize`, `prize_shares` | 006/007 | `prize_shares` is reused for awards (never shown as "prize") |
| P-numbers | 038 `game_label_prefix` → `'P'`; numbers reused among active games in the circle | done — P1, P2 again on a new day, same as S |
| Points defaults | `profiles.default_settings` (`stakeDrop`, `stakeMiddleDrop`, `maxCount`), `utils/gameSettings.ts` `GameKind = 'points' \| 'pool'` | pool keys added: `poolDrop`, `poolMiddleDrop`, `poolFullCount`, `poolLimit`, `poolReentry` |
| Logs | 036 `event_log.kind` check list, `log_event`, triggers | kinds added (section 4) |
| Results | 034 `result_places_json`, 024 `public_result`, 023 delete/restore, PR 9 Delete + Undo | P games contribute `prize_shares` instead of round sums |
| Initials | 039 rule (letter first, 2–3 chars) | unchanged; pool column headers use the same labels |
| Dealer rotation | 031 round robin in `save_round` | skips players who are out |
| Undo | 035 `undo_last_round` | clears `out_round`; a re-entry made after the last round is undone first |
| Own initials | 040 (PR 10b, written not applied) | 041 follows it in the apply order |

## 3. Screens (P01–P30)

- **New game, screen 1 (P01).** The players picker exactly as today; the bottom button reads **Next · N players**
  (disabled under two players). The co-admin nudge and the initials fix happen after Start on screen 2.
  ![P01-new-game-players-next](pool-mockups/P01-new-game-players-next.png)
- **New game, screen 2 — Game type (P02, P03, P03b).** Segmented **Points | Pool**, opening on the user's default
  type. Pool: limit chips **101 · 201 · 251 · Custom…** (Custom shows a fourth field, 51–999), Drop / Middle drop /
  Full count (positive, default 25 / 50 / 130), **Re-entries** radio Unlimited / Limited (Limited reveals "Re-entries per
  player (0–99)"; default Unlimited). Points: the three negative fields as
  today. Both: "Prefilled from your saved defaults. Changes here apply to this game only." and the link **You can also
  set these defaults in Settings**. Below: the picked players as chips. Bottom bar: **‹ Back to players** · **Start
  pool** / **Start game**.
  ![P02-new-game-type-pool](pool-mockups/P02-new-game-type-pool.png)
  ![P03-new-game-type-points](pool-mockups/P03-new-game-type-points.png)
  ![P03b-new-game-pool-custom-limit](pool-mockups/P03b-new-game-pool-custom-limit.png)
- **Settings (P04).** Two blocks, Points and Pool (limit chips, 25 / 50 / 130, Re-entries Unlimited / Limited N), plus "New game starts as".
  ![P04-settings-defaults-points-and-pool](pool-mockups/P04-settings-defaults-points-and-pool.png)
- **Scorecard (P05–P07).** Same table. Header per player: **#number · initials · score** (the dealer's column keeps the
  green tint). A re-entered player's header is **blue**; the cell of the round they came back in reads "↺109+14".
  OUT column greyed, struck through, red "OUT R5"; red ✕ on the round that put someone out; later cells "—". Rounds
  stay in order, latest at the bottom and highlighted. **Standings** card under the table sorted lowest first, OUT
  last: name, #no · initials (· re-entered R5 at 109), **points left · drops left**, score. Landscape identical.
  Formulas: points left = `limit − score`; drops left = `floor((limit − 1 − score) ÷ drop)`; out = `score ≥ limit`.
  ![P05-pool-scorecard-portrait](pool-mockups/P05-pool-scorecard-portrait.png)
  ![P06-header-states-and-formulas](pool-mockups/P06-header-states-and-formulas.png)
  ![P07-pool-scorecard-landscape](pool-mockups/P07-pool-scorecard-landscape.png)
- **Add round (P08–P11).** Same grid + keypad (PR 3 colours). Keys: **Drop 25 · Middle 50 · Full 130 · Rummy (0)
  · digits** — no plus/minus. Each cell previews "81 → 106 · 95 left" or "· OUT". Save needs every player still in to
  have a score and at least one 0; two or more zeros are fine. A typed count above Full count asks once "Are you
  sure?" (Change / Keep) and is then allowed; the old half-count and high-number warnings are gone. After every save a
  sheet names who went out this round and lists who is **eligible for re-entry** (out, Re-entry on, not re-entered
  before) with a **Re-enter** button each and "Not now". Re-entry is also offered by tapping an OUT column (P11): the
  player comes back at the highest score still in, counts as a second entry, is logged.
  ![P08-add-round-pool](pool-mockups/P08-add-round-pool.png)
  ![P09-add-round-two-winners-and-over-full](pool-mockups/P09-add-round-two-winners-and-over-full.png)
  ![P10-after-save-out-and-reentry-eligible](pool-mockups/P10-after-save-out-and-reentry-eligible.png)
  ![P11-re-entry-sheet](pool-mockups/P11-re-entry-sheet.png)
- **Complete (P12–P14).** After the save that leaves one player: "Only X is still in — Complete pool?" (Undo still
  possible). Complete early at any time (split). **Nov 18:** Complete is one dialog on the scorecard (the Complete
  page is gone) and goes straight on to Awards (Not now / Save awards), then the Final screen (Share + Done). The
  completed scorecard shows the **Awards** card with a **Give awards** button for an admin and the final pool scores;
  the status reads **Completed** until awards are given, then **Awarded**.
  ![P12-last-player-standing](pool-mockups/P12-last-player-standing.png)
  ![P13-complete-early-split](pool-mockups/P13-complete-early-split.png)
  ![P14-completed-awards-pending](pool-mockups/P14-completed-awards-pending.png)
- **Awards (P15–P18).** Header: entry per player (default 100, tap to change), entries (re-entries count twice), pool
  total. Category chips **Winner takes all · By points left · 50/50 · Entry per drop left · Custom**; tapping one
  previews every player's award in the table (sorted by points left, most first; out players last): Player · Pool
  score (· left · drops, or · out Rn) · Entries put in · **Gets** · **Award** (= Gets − put in). Custom edits "Gets"
  inline. A line under the table reads "All 800 points given out ✓" or "40 points not given out · 760 / 800"; Save
  stays enabled either way and asks "X points weren't given out. Save awards anyway?" when it does not add up.
  ![P15-awards-winner-takes-all](pool-mockups/P15-awards-winner-takes-all.png)
  ![P16-awards-by-points-left](pool-mockups/P16-awards-by-points-left.png)
  ![P17-awards-fifty-fifty-and-entry-per-drop](pool-mockups/P17-awards-fifty-fifty-and-entry-per-drop.png)
  ![P18-awards-custom-save-anyway](pool-mockups/P18-awards-custom-save-anyway.png)
- **After awards (P19, P30).** "Awards" block (same player lines as results, medal for the winner) above the final pool
  scores including the out players. **Edit awards** until the game is Closed; then delete the result first.
  ![P19-completed-awarded](pool-mockups/P19-completed-awarded.png)
  ![P30-awards-locked-when-closed](pool-mockups/P30-awards-locked-when-closed.png)
- **Home + Results (P20–P22).** Every game badge is yellow (S and P); results stay green. Pool cards add the limit,
  out count and **Awarded** once the awards are given (Nov 18: no "Awards pending"). The existing Results picker mixes S and P; an
  unawarded pool is greyed with **Give awards first** and cannot be ticked. Results table: every game column header
  yellow, legend "pool: the awards count, not the pool scores".
  ![P20-home-game-cards](pool-mockups/P20-home-game-cards.png)
  ![P21-results-pick-mixed](pool-mockups/P21-results-pick-mixed.png)
  ![P22-results-table-mixed-S-and-P](pool-mockups/P22-results-table-mixed-S-and-P.png)
- **Share + web (P23–P25).** Live image = Standings (score · left · drops), yellow game frame; final image = awards
  headline, pool scores one small line; `/g/` live page = same table and Standings.
  ![P23-share-image-live-pool](pool-mockups/P23-share-image-live-pool.png)
  ![P24-share-image-final-pool-awards](pool-mockups/P24-share-image-final-pool-awards.png)
  ![P25-live-link-pool](pool-mockups/P25-live-link-pool.png)
- **Settings / help / wording / log (P26–P29).** For a pool the limit and the three values lock once round 1 is saved
  (Re-entry stays switchable). Help in the PR 12 format, including Complete → Award → Result. Store-safe words only;
  "stake" and "prize" never appear.
  ![P26-game-settings-locked-mid-game](pool-mockups/P26-game-settings-locked-mid-game.png)
  ![P27-help-pool-scorecard](pool-mockups/P27-help-pool-scorecard.png)
  ![P28-wording-store-safe](pool-mockups/P28-wording-store-safe.png)
  ![P29-game-log-pool-events](pool-mockups/P29-game-log-pool-events.png)

## 4. Data and RPCs — migration `041_pool.sql` (applied to live Nov 14) + `042_pool_reentries_and_limit_lock.sql` (applied to live by Sree, Nov 15)

**Columns**
- `games.settings` (jsonb) gains `poolLimit int`, `reentry bool` (pool games only; the three values stay in
  `dropAmount` / `mdAmount` / `maxCount`, positive for a pool). `profiles.default_settings` gains `poolLimit` (101),
  `poolDrop` (25), `poolMiddleDrop` (50), `poolFullCount` (130), `poolReentry` (true), `gameKind` (`'points'|'pool'`).
- `games.awarded_at timestamptz`, `awarded_by uuid`, `award_note jsonb` (`{preset, entry, poolTotal, givenOut}`).
  Awards themselves go in the existing `games.prize_shares` as `{profile_id: award}`.
- `game_players.out_round int`, `reentered_round int`, `reentry_score int`, `entries int not null default 1`.
  `out_round` is derived (recomputed by `pool_recompute` after every save / undo / re-entry); "in" means
  `out_round is null`.
- `scores`: the 037 check constraint stays for Points. A trigger `scores_pool_sign` enforces, for a pool game,
  `value >= 0` and `rummy = 0`. A trigger `games_pool_settings_lock` refuses changes to `poolLimit` once a live round
  exists; since **042** (Q14.23) Drop / Middle drop / Full count and Re-entries may change mid-game and the 036
  `settings_changed` Log line records them ("Changed game settings · Drop 25→30").

**Functions (new or pool branch)**
- `pool_total(game, profile)` = `reentry_score + Σ scores in rounds ≥ reentered_round` (or Σ all when never
  re-entered); `pool_recompute(game)` sets `out_round` per seat from the running totals.
- `save_round` pool branch: every value ≥ 0, rummy rows = 0, at least one 0; every player who is in must be scored;
  refuses a round when ≤ 1 player is in; dealer rotation (031) uses only players who are in; after insert
  `pool_recompute`, log `player_out` for each newly out player.
- `reenter_player(p_game_id, p_profile_id)`: admin only, game active, player out, re-entries used so far
  (`entries − 1`) below the game's limit (`pool_reentry_limit(settings)`: `reentryLimit` null = Unlimited, N = Limited,
  0 = none; the 041 boolean `reentry` is still read: false → 0, true → Unlimited), ≥ 1 other player in; sets `reentered_round = next round`, `reentry_score = max total among players in`,
  `entries += 1`, `out_round = null`. Logged `player_reentered`.
- `undo_last_round` pool branch: if a seat has `reentered_round = last round + 1` (re-entered after the last save) the
  re-entry is undone instead (its own step, logged `reentry_undone`); otherwise the round is undone and
  `pool_recompute` runs (`round_undone` as today).
- `add_seated_player` pool branch: a late joiner starts at the highest score still in (`reentered_round = next round`,
  `reentry_score`, `entries = 1`).
- `set_pool_awards(p_game_id, p_awards jsonb, p_note jsonb)`: admin only, game Completed and not Closed, keys ⊆ the
  seated players, integers; **no sum check** (D9); writes `prize_shares`, `awarded_at/by`, `award_note`. Second call =
  edit (`awards_changed`, old → new); first call `awards_set`.
- `declare_game_result`: a pool without `awarded_at` → "Give awards first"; with awards each player's contribution is
  `prize_shares[profile]` (0 for a seated player without a key). `result_places_json`, `public_result`,
  `list_result_candidates` (`awards_pending: true`), and the results sheet `games[].kind = 'points'|'pool'` follow.
- `public_scorecard` / `get_game_bundle` carry the pool seat fields so the app and the live page compute totals.
- Logs: widen the 036 kind check with `player_out`, `player_reentered`, `reentry_undone`, `awards_set`,
  `awards_changed` (all `important`).
- Grants as 023 does; rollback drops the columns, functions and triggers and restores the 036 kind list and the
  036 `save_round` / 035 `undo_last_round` / 036 `add_seated_player` / 034 `declare_game_result` bodies.

## 5. App surfaces touched

`app/(screens)/games/new.tsx` (screen 1, Next), new `app/(screens)/games/new-type.tsx` (screen 2),
`utils/gameSettings.ts` + `utils/pool.ts` (pool rules, defaults, limits, validation), `app/(screens)/settings.tsx`
(Pool block), `components/game/RulesForm.tsx` / `GameSettingsDialog.tsx` (pool form, lock), `components/game/ScoreTable.tsx`
(number · initials · score, blue, OUT), new `components/game/PoolStandings.tsx`, `app/(screens)/games/[id].tsx`
(Standings, after-save sheet, re-entry, Complete offer, awards block), `app/(screens)/score-entry.tsx` (pool keys,
validation, confirm), `app/(screens)/games/complete.tsx` (pool wording, Give awards), new `app/(screens)/games/award.tsx`
+ `utils/poolAwards.ts`, Results picker + `utils/results.ts` (awards as the pool's points, `kind`), Home card chips,
`constants/theme.ts` (all games yellow), share image/PDF/web, `constants/help.ts`, `utils/eventLog.ts` labels.

## 6. Tests (codes as in `docs/testing-strategy.md`, PR 13 block)

| # | Kind | What |
|---|---|---|
| 13.1 | U | `pointsLeft`, `dropsLeft`, `isOut` for 52/81/94/100/101 at limit 101, drop 25 → left 49/20/7/1/0, drops 1/0/0/0/0, out only at 101 |
| 13.2 | U | pool round validation: no zero / two zeros / missing in-player / count 150 with full 130 → refused, ok, refused, confirm-then-ok |
| 13.3 | U | store-safe wording: UI strings vs the P28 "never" list, incl. "stake" and "prize" |
| 13.4 | U | `rulesFromProfileDefaults` without pool keys → 101 · 25/50/130 · Re-entries Unlimited; old `poolReentry` false/true → 0 / Unlimited; Points untouched; limits 101/201/251/custom 51–999 |
| 13.5 | U | award presets on the P12 data: winner takes all / by points left / 50/50 / entry per drop left / custom; remainders to the winner; given-out line |
| 13.6 | D | `save_round` pool: round that takes HG to 201 sets `out_round = 6`; next dealer skips HG; ≤ 1 player in → refused; two zeros accepted; negative refused by the trigger |
| 13.7 | D | `reenter_player`: score = highest in, `entries = 2`; refused when not out, past the limit (Limited 1: twice), none (Limited 0 or 041 `reentry:false`), or Completed; Unlimited lets a third entry through (`supabase/tests/32`, `33`) |
| 13.8 | D | `set_pool_awards`: Active / Closed → refused; unbalanced Completed → saved with who/when; second call logs `awards_changed` |
| 13.9 | D | `declare_game_result` with an unawarded pool → "Give awards first"; awarded → result uses `prize_shares`; mixed S + P totals = S sums + P awards; `public_result` marks the P game |
| 13.10 | D | `undo_last_round` after an out clears `out_round`; after a re-entry removes the re-entry first |
| 13.11 | D | pool limit locked after round 1 (trigger, 042); Drop / Middle drop / Full count and Re-entries change mid-game with a `settings_changed` Log line that names them |
| 13.12 | R | 041 down/up with pool rows present; 036 kind list restored and widened again |
| 13.13 | C | two admins save round 6 with different winners → second refused (035 rule) |
| 13.14 | S | New game → Next → Pool → 101 → Start pool → header #1 · SK · 0; Standings 101 left · 4 drops |
| 13.15 | S | Add round 25 ×4 + Rummy → cells 25/0; Standings 76 left · 3 drops |
| 13.16 | N | rounds until one player hits 101 → red ✕, OUT header, after-save sheet lists them as eligible, Standings last |
| 13.17 | N | re-enter from the sheet → blue header at highest in; Awards shows 2 entries |
| 13.18 | N | last player → Complete → Give awards → Winner takes all → Save → Awarded; Results picker accepts it |
| 13.19 | N | Custom 760/800 → "40 points weren't given out. Save awards anyway?" → saved |
| 13.20 | N | Edit awards → Log `awards_changed` old → new; results preview updates |
| 13.21 | N | Results S14 + P10 → yellow headers, legend, totals |
| 13.22 | N | share live, share final, live link → Standings / awards headline / same table |
| 13.23 | N | landscape 9 players; help ? on the pool scorecard |
| 13.24 | N | Settings Pool 201 · 25/50/130 · Re-entries Limited 1 → New game screen 2 prefills; Points unchanged |
| 13.25 | U | F13.22 width math: every three-letter label (WWW, MMM, W88 …) fits every column width 38–140 dp at font scales 1–2 (capped 1.2), never under 8 pt; WWW on a 38 dp column ≥ 9 pt; avatars 26–40 fit; two plain letters keep the full size (`tests/initials-fit.test.ts`) |
| 13.26 | S | F13.22 Game W (20 seats, WWW / MMM / WMW …, completed, awards pending): header labels WWW and MMM on screen, Standings labels, Awards screen avatars; screenshots are the visual check (`smoke/17`) |
| 13.27 | U | F13.23 Entry per drop left: viable on the P12 pool (winner 500 vs 100); not viable early in a pool (drop entries eat the pool, winner 0) or when the winner is level (100 = 100); viable again once outs have put in; Winner takes all / By points left always viable, co-winners compared as a group; 50 / 50 levels second place only; Custom warns (`winnerGetsMost`), negative winner share refused; exact pop-up text (`tests/pool-pr13.test.ts` 13.5c) |
| 13.28 | S | F13.23 on the smoke pool (500, drops would overshoot): tapping Entry per drop left shows the pop-up, "Pick another" closes it, the selection stays on By points left (`smoke/16`) |
| 13.29 | U | 042 Re-entries: `reentryLimitOf` (null / N / 0 / negative / 041 boolean), `reentryBlock` Unlimited vs Limited 1 / 2 vs none, labels, draft Unlimited / Limited count 0–99 and the error line, `validateRules` 0–99, profile key `poolReentryLimit` with old `poolReentry` read (`tests/pool-pr13.test.ts` 13.4 / 13.6b / 13.7) |
| 13.30 | D | 042 pgTAP `33_pool_reentries_042.sql`: `pool_reentry_limit` table, limit locked / values free with the labelled Log line, Unlimited third entry, Limited 2 refuses the third, Limited 0 refuses all, Limited 3 allows at the highest in |
| 13.31 | R | rollback 042 → 041 `reenter_player` (once) and the four-value lock; forward 042 again (`ci/db/replay-rollbacks.sh`) |
| 13.32 | S | Settings Pool block: Limited reveals the count field, Unlimited hides it (`smoke/07`); New game screen 2 shows Re-entries · Unlimited (`smoke/16`) |

## 7. Small decisions taken while building (flagged in the PR body)

- **F13.1** ~~Re-entry is once per player~~ — replaced on Nov 14 (10:27 PM PT) by the Re-entries setting (decision 4): Unlimited by default, or Limited N per player, cascading app → Settings → this game. Migration `042_pool_reentries_and_limit_lock.sql` (**applied to live by Sree on Nov 15**) carries it with the limit-only lock.
- **F13.2** A late joiner (Add players mid-pool) starts at the highest score still in and counts one entry.
- **F13.3** "Player leaves mid-pool" is not built: the admin uses Custom awards (and Undo / remove-seat as today).
- **F13.4** Entry per player defaults to 100 points and is edited on the Awards screen only (not in Settings).
- **F13.5** Save round (pool) needs every player still in to have a score and at least one 0.
- **F13.6** Award presets: the "winner" is the lowest score among players still in at completion (ties share, in seat
  order); rounding remainders go to the winner; "Entry per drop left" can exceed the pool total — the line then reads
  "X points more than the pool" and the same Save-anyway confirm applies.
- **F13.7** Settings keeps "New game starts as" (Points by default) so screen 2 opens on the right type.
- **F13.8** Custom limit 51–999; a Full count above the limit is allowed (one full hand puts you out).
- **F13.9** Pool round scores are stored positive with a pool-only trigger; Points storage is untouched.
- **F13.10** The scorecard corner's running sum and the round-row "off by" markers are hidden for a pool (no balance).
- **F13.11** Home / Results status words: "Awarded", "Give awards first" (Nov 18: "Awards pending" dropped — a pool without awards is "Completed").
- **F13.12** The Points header stays initials · total (no player number) until the later PR Sree noted.
- **F13.22** (decided by Sree, Nov 14, 8:40 PM — see §0 row 15) Initials never clip: the header label and the avatar
  label step their font down to fit the width they have (estimated per glyph, W and M widest; `adjustsFontSizeToFit`
  as the native safety net), the Standings label never shrinks (`flexShrink: 0`), the Awards screen and the awards
  card show the seat label. The "#n" line and the DEALS band were never the clipper; the three-letter label on a 38 dp
  column was.
- **F13.23** (decided by Sree, Nov 14, 8:40 PM — see §0 row 16) "Entry per drop left" keeps its place but is viable
  only when the winner gets strictly more than everyone else; otherwise it is greyed and refused with the pop-up. The
  check is one function (`winnerGetsMost`), so it also runs on the other presets: Winner takes all and By points left
  cannot fail it (the lowest score has the most points left; rounding remainders go to the winner); 50 / 50 puts the
  second place level with the winner by design and is passed with that one exception — **Q13.25, decided by Sree Nov 15:
  the 50 / 50 even split is a deliberate exception to "the winner gets the most"; it stays offered and is never greyed**;
  Custom is the admin's own numbers, so the screen shows a red line ("The winner gets 100, X gets 200…") and never
  blocks. The overshoot case of F13.6 ("more than the pool") can no longer be selected, because when the drop entries
  exceed the pool the winner is left with nothing.

## 8. Place in the sequence

**PR 13**, stacked on PR 10b (#25). Its own migration 041 (after 040, PR 10b's own initials), rollback, pgTAP,
unit tests, smoke 13.14–13.15 and nightly 13.16–13.24, one PR. Migrations are written and tested locally only; Build
Bot applies them when Sree says so. Multiplier (PR 14) adds `settings.multiplier` for both game types on top of this.
