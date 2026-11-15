# Multiplier — design spec (PR 14, review first; nothing built yet)

Status: **spec revised to Sree's answers of Nov 14, 8:58 PM PT.** No app code, no migration applied. Mockups:
[`multiplier-mockups/`](multiplier-mockups/) (M01–M22, generated like the Pool set: 390 dp, light theme, caption strip on
each). Section 6 records every question with the answer that now stands; three items are still flagged for Sree
(Q14.22 how past rounds behave after a mid-game change, Q14.23 the Pool lock, Q14.24 the 13+ player compromise) and the
build follows the recommended answer on each unless he says otherwise. Section 9 says where the build sits in the queue.

## 0. Sree's requirements (Nov 14, 3:46 PM PT) and how this spec reads them

| # | Sree said | Read as |
| --- | --- | --- |
| 1 | Points games only, never Pool. 2×, 3×, 10×, 20×, maybe 100× are normal; build for 100× as the normal case; input max 10,000. | `settings.multiplier` on Points games, integer 1–10,000. Hidden for Pool. Everything from the grid to the PDF stays readable at 100× without special handling; 1,000× and 10,000× must work (section 2) but may be less pretty. |
| 2 | Impact analysis at 1,000× and 10,000×: magnitudes, widths, grid, 5-player blocks, share image, Results, PDF, DB int types. Flag migrations; apply nothing. | Section 2 and mockup M20. One migration (042) is needed for `::int` casts in result sums and for the per-round multiplier (section 5); **not** for `scores.value`. |
| 3 | Store the real number; short forms (1.3K, 2.4M) on screen; PDF full numbers; the exact number must always be reachable; recommend threshold and rounding; rounding must never fake a non-zero total; red total rule. | Section 3, M19 and M21. One rule: K from 10,000, M from 1,000,000, 3 significant digits; exact in the Exact sheet, Final scores card, Winners list, share image, PDF. The red check compares exact integers only. |
| 4 | Users type raw points only, the app multiplies. No high-number warning. | Add round is unchanged except a small "= −3,000" line per cell (M12). The one confirm left ("more than Full count?") also says the actual points (M13). |
| 5 | Per-game Multiplier setting: tap, type digits, max 10,000. Leans to no presets. A user default in Settings prefilling every Points game. Show on the scorecard when > 1. | M01/M03/M04. No presets (D14.3). A black `×100 ⓘ` chip in the scorecard strip, on the Home card and in Results headers when > 1 (M05, M15, M18). |
| 6 | Scorecard view toggle Actual/Entered; the multiplier always applies; totals, Results, shares, PDFs, awards/standings use multiplied totals. | M05–M10. The toggle only changes what the grid and header totals *display*; a yellow banner says so when it is off. Everything that leaves the screen is multiplied (D14.9). |
| 7 | Important before going live. | Section 9. |

Scope change from the Pool spec: `docs/pool-design.md` §8 said PR 14 "adds `settings.multiplier` for both game types". Sree's
decision 1 overrides it: **Points only.**

### 0b. Sree's decisions (Nov 14, 8:58 PM PT) and what changed in this revision

| # | Sree decided | Spec change |
| --- | --- | --- |
| D14.1 | Store entered (raw) points plus the multiplier. | As recommended (Q14.1). Unchanged. |
| D14.2 | **No lock after round 1.** Admins change the multiplier mid-game ("you're believing the admin no matter what"). Recommend how past rounds behave; he suggests each round keeps the multiplier it was saved with, with a Log entry. | Lock removed everywhere (M01, M03, M04, §5). **Multiplier stored per round** (`rounds.multiplier`), a *Change multiplier* item in the scorecard menu, a Log line, a small `×10` mark on rounds at a different rate, both rates on the Exact sheet (M22, §3.7). The change dialog offers *From round N* (recommended, default) and *All rounds*; flagged as **Q14.22**. |
| D14.2b | Why does Pool lock its limit / drops? Explain; recommend whether to drop it on the same principle; flag. | §3.8 and **Q14.23**: keep the lock on the pool *limit* only, free Drop / Middle drop / Full count with a Log line. |
| D14.3 | No presets; a digits-only field with "×"; keep the live example sentence, but make it obvious. | The example is a yellow box under the field ("A 30 is 3,000 · a Full count is 8,000"), not grey hint text (M01, M03, M22). |
| D14.4 | Everything starts at 1. Precedence: game setting › user default › app default 1. | §3.9 and M04 wording. |
| D14.5 | Threshold / player count: design for up to 12 players as normal (10–11 typical); 13+ is unusual and may carry layout compromises; keep 13–20 working, not optimised. Simplify the threshold and explain it plainly. | **One rule everywhere** (§3.2): whole numbers to 9,999, K from 10,000, M from 1,000,000, three figures. No separate "compact" threshold. On 13+ grids the same text shrinks to fit (M09–M11, M19, M20). Flagged as **Q14.24** only to confirm the compromise. |
| D14.6 | Rounding: 3 significant digits, half away from zero — fine. | Unchanged. |
| D14.7 | Exact-number viewing is confusing in words; show it. | **M21** walks through it: tap the `×N ⓘ` chip or any header total → the Exact points sheet; a table of the places that always print the exact number. The chip now carries an ⓘ so the tap is discoverable (§3.5). |
| D14.8 | Toggle: use the recommendation. | Actual ON by default, remembered per phone, hidden at ×1, banner when OFF (Q14.7). Unchanged. |
| D14.9 | Results: when a game is completed and winners announced, ALWAYS save and show multiplied points, never raw. A combined result may mix ×1, ×2, ×5 games; each contributes its multiplied totals. | Already the design (Q14.10, M15); now stated as a rule in §3.1 and enforced in SQL by 042 so no app build can save a raw result. |
| D14.10 | "I trust you for the rest. Just go ahead with your recommendations." | Every other Q in section 6 stands at its recommended answer. |

## 1. The feature in one paragraph

A Points game can carry a multiplier (×1 default, up to ×10,000). Admins keep typing the hand as points — 30 is typed as
30 — and the app shows, sums, shares and saves to Results 30 × multiplier. The grid stores the entered points (so undo,
edit round, the Log and the balance check are unchanged); every saved round also remembers the multiplier it was played
at, so an admin can change the multiplier mid-game from the scorecard menu and only the rounds from then on use the new
value (or, if they ask for it, all rounds). Every reader multiplies. Large numbers are shortened on screen (12.4K, 1.25M)
so the grid fits, and the exact number is one tap away (the `×N ⓘ` chip or any total) and printed in full on the Final
scores card, the Winners list, the share image and the PDF.

## 2. Impact analysis: ×1,000 and ×10,000 (mockup M20)

Base case: Full count 80, Drop 10, Middle drop 30; a 20-player night of 25 rounds.

### 2.1 Magnitudes

| Case | ×1 | ×100 | ×1,000 | ×10,000 |
| --- | ---: | ---: | ---: | ---: |
| One hand at Full count | 80 | 8,000 | 80,000 | 800,000 |
| One round, winner, 20 players all at Full count | 1,520 | 152,000 | 1,520,000 | 15,200,000 |
| One night, 25 rounds, a loser at Full count every round | −2,000 | −200,000 | −2,000,000 | −20,000,000 |
| One night, 25 rounds, a winner collecting everything (extreme) | 38,000 | 3,800,000 | 38,000,000 | 380,000,000 |
| A result of 6 such extreme games | 228,000 | 22,800,000 | 228,000,000 | **2,280,000,000** |

Realistic nights are far smaller (a typical 4–7 player night ends within ±300 points, so ±3,000,000 at ×10,000), but the
design must not break on the extreme row.

### 2.2 Storage and arithmetic

| Layer | Today | At ×10,000 | Verdict |
| --- | --- | --- | --- |
| `scores.value integer` (int4, ±2,147,483,647) | one hand, entered points | still entered points (D14.1) | **no change**. Even if multiplied values were stored, one hand is ≤ 800,000. |
| `rounds` | round number, dealer, timestamps | **+ `multiplier integer not null default 1`**, copied from the game by `save_round` at save time (D14.2) | migration 042, backfill 1 for every existing round (a ×1 game's rounds are correct by definition). |
| Per-game totals in SQL (`sum(s.value)`) | Postgres `sum(int4)` returns `bigint` | `sum(s.value * r.multiplier)` as `bigint` | the **`::int` casts** on those sums in `declare_game_result` (`034` → `041` lines 926, 951, 1062) would raise `integer out of range` once a result passes 2,147,483,647 — only the extreme row, but it must not be able to crash a Save. **Migration 042**: cast to `bigint`, multiply inside SQL by the round's multiplier so results are correct whatever app build declared them (D14.9). Written, not applied. |
| `results.places` jsonb, `games.settings` jsonb | numbers are `numeric` | fine | none |
| JavaScript | `Number` | safe to 9×10¹⁵ | none |
| `score_text(integer)` in the Log (036) | entered points | entered points | none; the Log shows entered points (Q14.15) and gets a `multiplier_changed` line |
| Pool functions (`pool_total`, `pool_recompute`) | int casts | untouched | Pool never multiplies |

### 2.3 Where numbers must fit

Design target (D14.5): **up to 12 players** is normal; 13–20 must work but may compromise.

| Surface | Fits today | At ×100 | At ×1,000 | At ×10,000 | Design answer |
| --- | --- | --- | --- | --- | --- |
| Scorecard, ≤ 12 players (≥ 44 dp columns, 15–18 pt) | 7 characters (−99,999) | −8,000 fits; totals to ±99,999 fit | −80,000 fits; totals go K | −800K; totals ±M | one rule: K from 10,000, M from 1,000,000, 3 figures (M07) |
| Scorecard, 13–20 players (38 dp columns, 13 pt) — compromise zone | 5 characters (−8,000 is already tight) | −8,000 shrinks to fit; totals (±200K) go K | −80K | −800K, ±12M | **same rule**; the text shrinks to fit the column (as initials do since PR 13) (M09) |
| Header total under the initials | 15 pt bold | 12.4K | 124K | 1.3M | same rule |
| Add round cells | big entered number | add "= −3,000" (11 pt) | "= −80,000" | "= −800,000"; at 3 columns the small line goes K/M | entered big, actual small (M12) |
| Final scores card / share image (fixed 1080 px, two columns) | name + 7 digits | exact | exact | 8+ digits: **one column** so names and exact numbers never collide (M14, M16) | always exact |
| Results page Winners list | 19 pt | exact | exact | exact (one per row) | always exact (M15) |
| Results page game table (5 games per band) | 13 pt | 12K | 1.24M | 12.4M | K/M in cells; `×N` under each game header (M15) |
| PDF, 390 pt page, 5 columns per block | 7 characters at 11 pt | 5 columns | 5 columns (−80,000) | **4 columns** past 7 characters, 3 past 9 (M17) | always exact; block width driven by the widest value, not a fixed 5 |
| Live web page | same grid as the app | K/M + exact on tap/hover (`title`) and an "Exact points" list under the table (M18) | | | |
| Home card | chips | `×100` chip | | | chip only when > 1 (M18) |

**Sree's PDF concern (5 columns tight):** right. At 10 pt a 390 pt page gives about 58 pt per column with five players;
−800,000 is 8 characters ≈ 52 pt — it fits but only just, and +10,750,000 (11 characters) does not. The block-of-five
layout therefore becomes block-of-N where N = 5, 4 or 3 is chosen from the widest value in the game. Pages flow as today.

## 3. Display rules (mockups M19, M21, M22)

1. **Source of truth**: entered points per score, a multiplier per round (copied from the game when the round is saved).
   The *actual* value of a score is entered × that round's multiplier; a total is the sum of actual values, computed
   where it is shown. Nothing is ever rounded before it is summed. **Everything that leaves the screen — Final scores,
   Results (including a combined result that mixes ×1, ×2 and ×5 games), shares, PDFs, the live page — is actual points,
   never raw** (D14.9).
2. **Short forms, one rule everywhere on screen** (D14.5, M19): up to 9,999 the whole number is shown; from 10,000
   thousands with a K (12.3K); from 1,000,000 millions with an M (1.23M); never more than three figures (12.3K · 123K ·
   1.23M · 12.3M · 123M); half away from zero; no trailing ".0" (12K not 12.0K); sign kept (+12.3K / −6.17K); 0 is
   always "0". In plain words: *the app writes a number the long way until it has five digits, then it says "K" or "M"
   and keeps three figures.* There is no second threshold for big tables any more: on a 13+ player grid the same text
   simply shrinks to fit the narrow column, which is the accepted compromise for a game size that is not the design
   target.
3. **Never shortened**: the Exact points sheet, the Final scores card, the Results Winners list, the share image, the PDF,
   the Log, the Add round big number (which is entered points anyway).
4. **The red rule**: the scorecard footer "Totals add to 0" / red "Totals add to +10" (PR 4) and the Add round Balance pill
   compare exact integers. Short forms on screen may not visibly sum to 0 (+12.3K −6.17K −6.18K); the footer reads
   "Totals add to 0 (exact)" whenever any short form is on screen so nobody tries to add the K's.
5. **Exact reveal** (D14.7, M21): the strip chip reads `×100 ⓘ`; tapping it, or tapping any header total, opens the
   **Exact points** sheet (M11): one line per player, exact actual total, "entered 1,234 × 100" underneath (or both rates
   after a mid-game change, M22-C), "Totals add to 0", and a Share full details (PDF) button. The sheet also exists at ×1
   (then it is simply the totals as a list). Cells in the grid stay tap-free; the two visible targets (chip, totals) are
   enough and keep the grid as it is today (this settles Q14.17 at the smaller option).
6. **View toggle** (M05–M10): "Actual points" switch in the scorecard strip; ON by default; remembered per phone (not per
   game) in AsyncStorage; OFF shows a yellow banner "Showing entered points. ×100 still applies — totals, Results and shares
   use the actual points." The toggle is hidden at ×1. The toggle never changes what is saved or shared.
7. **Changing the multiplier mid-game** (D14.2, M22): any admin, from the scorecard menu (*Change multiplier*). The
   dialog shows the field with the example box, says "6 rounds are saved at ×10", and offers **From round 7** (default,
   recommended: rounds 1–6 keep ×10) or **All rounds** (re-prices rounds 1–6 too; the way to fix a wrong number). On
   Change: the game's `settings.multiplier` becomes the new value, `rounds.multiplier` is updated for the chosen rounds,
   and the Log gets "Multiplier changed ×10 → ×5 · from round 7 · rounds 1–6 keep ×10" (or "· all rounds"). Afterwards the
   strip shows the current chip `×5 ⓘ` plus a blue `×10 until round 6` tag, rounds at a different rate carry a small
   `×10` mark in the round-number column, the footer says "rounds 1–6 at ×10, 7–9 at ×5", and the Exact sheet shows
   "−180 × 10 + 105 × 5" under each total. Undo of a round never touches multipliers; a round re-saved after Undo takes
   the game's current multiplier. Completed / Closed games: the menu item is gone (edit nothing after Complete, same as
   the other settings).
8. **Why the Pool lock exists, and what to do with it** (D14.2b). In one sentence: *the pool limit decides who is out and
   what score a re-entering player starts at, so changing it after rounds are saved would contradict eliminations and
   re-entries already on the card — the lock (041, PT423) stops that.* The multiplier is different in kind: it is a price
   tag on the numbers, and changing it never changes who is in, who is out, who won a round or what anyone typed — so it
   needs no lock. Recommendation (**Q14.23**): keep the lock on the pool **limit** only; free **Drop, Middle drop and Full
   count** on Pool games (they only drive the keypad shortcuts, the "more than Full count?" confirm and the drops-left
   reading), with a Log line "Pool values changed" like the multiplier's. Changing the limit stays "Undo every round",
   because the alternative (the app silently re-deciding who is out) is the one place where trusting the admin would
   produce a scorecard that contradicts itself.
9. **Defaults** (D14.4): everything starts at ×1. The value used by a game is the game's own `settings.multiplier`; the
   New game screen prefills it from the user's default (`profiles.default_settings.multiplier`); with no default it is 1.
   The game's value always wins once the game exists; changing the user default never touches existing games.

## 4. Screens (M01–M22)

| # | File | Shows |
| --- | --- | --- |
| M01 | `M01-game-type-points-multiplier.png` | New game › Game type, Points: Multiplier field under Drop / Middle drop / Full count, "× 10" typed, the yellow example box, no lock |
| M02 | `M02-game-type-pool-no-multiplier.png` | Same screen with Pool: no Multiplier row |
| M03 | `M03-multiplier-field-states.png` | Over the cap (red "1 to 10,000"), the example box at ×100, the field opened mid-game after 6 rounds (no lock) |
| M04 | `M04-settings-default-multiplier.png` | Settings: Multiplier default inside Points defaults; precedence wording; Pool block unchanged |
| M05 / M06 | `M05-scorecard-2x-actual.png`, `M06-scorecard-2x-entered.png` | 4 players at ×2, toggle on / off (banner); chip `×2 ⓘ` |
| M07 / M08 | `M07-scorecard-100x-actual.png`, `M08-scorecard-100x-entered.png` | 7 players at ×100: cells −1,000 … totals 12.4K; off = a ×1-looking table |
| M09 / M10 | `M09-scorecard-10000x-20p-actual.png`, `M10-scorecard-10000x-20p-entered.png` | 20 players at ×10,000 on 38 dp columns (compromise zone): −800K cells, ±M totals, same rule, text shrinks; off = entered |
| M11 | `M11-exact-points-sheet.png` | The Exact points sheet |
| M12 | `M12-add-round-100x.png` | Add round at ×100: entered big, "= −3,000" small, Balance in entered points |
| M13 | `M13-add-round-10000x-confirm.png` | The one confirm left, now also stating the actual points |
| M14 | `M14-final-scores-10000x.png` | Final scores at ×10,000: exact card in one column, K/M round grid with the toggle |
| M15 | `M15-results-mixed-multipliers.png` | Results with ×1, ×100, ×10,000 games: exact Winners, K/M table, `×N` per game header (D14.9) |
| M16 | `M16-share-image-10000x.png` | Share image (yellow) at ×10,000: exact, one column |
| M17 | `M17-pdf-page-10000x.png` | PDF: exact everywhere; 5 → 4 columns driven by the widest value |
| M18 | `M18-home-card-live-link-log.png` | Home card chip, live web page, Log at a multiplied game |
| M19 | `M19-rounding-and-red-total-rule.png` | The one threshold rule, rounding and the red non-zero-total rule worked through |
| M20 | `M20-impact-1000x-10000x.png` | Impact table (section 2) as one picture |
| **M21** | `M21-exact-numbers-how-to-see-them.png` | **New.** A: the two taps (chip ⓘ, any total, highlighted) · B: the sheet that opens · C: the places that always print the exact number |
| **M22** | `M22-change-multiplier-mid-game.png` | **New.** A: scorecard menu → Change multiplier dialog (From round 7 / All rounds) · B: the grid after, `×10` marks, Log line · C: the Exact sheet with both rates |

## 5. Data (to be written in the build PR, not here)

- `games.settings.multiplier` (jsonb key, integer 1–10,000, absent = 1) — the *current* multiplier, copied onto each
  round as it is saved. Profile defaults: `default_settings.multiplier`. No lock trigger.
- `rounds.multiplier integer not null default 1` (new column, 042; backfilled 1). `save_round` writes the game's current
  value; Undo leaves it alone.
- New RPC `set_game_multiplier(p_game_id, p_value, p_from_round int default null)` (admin only; `p_from_round` null =
  all rounds; validates 1–10,000; refuses on Completed / Closed games; writes the Log line). Log kind
  `multiplier_changed` (036 kinds list extended in 042).
- Migration **042** also: `declare_game_result` / `result_places_json` / `public_result` sums as `bigint` of
  `value × rounds.multiplier` (so a result is right even when declared from an older app build — D14.9);
  `public_scorecard` returns the current multiplier and the per-round list for the live page. Rollback restores the 041
  bodies and drops the column. pgTAP file 33. Written, tested locally, **not applied**.
- App: `utils/multiplier.ts` (`actual(value, m)`, `shortNumber(v)`, `exactLines(game)`, `rateSpans(rounds)`),
  `pointsGameMultiplier(game)`; `GameSettings.multiplier?`; `RulesForm` field + example box; `Settings` default; scorecard
  strip chip + toggle + Exact sheet; *Change multiplier* menu item + dialog; `ScoreCell` small line; round-number `×N` mark;
  `finalScoresSheet` one-column rule; `shareImage` one-column rule; `shareResultsPdf` block-width rule; `results` K/M in
  the table, `×N` headers; `public/scorecard.html` (+ `web/` mirror) K/M + title + Exact list; Help bullets.

## 6. Questions and where each one stands

Decided by Sree (D) or by his "go ahead with your recommendations" (R). Still flagged: **Q14.22, Q14.23, Q14.24.**

- **Q14.1 Store entered or multiplied points?** **D: entered**, multiplier on the game (and, since D14.2, on each round).
- **Q14.2 Lock the multiplier after the first round?** **D: no lock.** Admins change it mid-game; see §3.7 and Q14.22.
- **Q14.3 Presets?** **D: no presets**: a plain digits field with a leading "×", prefilled from Settings; the example
  under it is a visible yellow box ("A 30 is 3,000 · a Full count is 8,000") that updates as the number is typed.
- **Q14.4 Threshold for short forms?** **D: one rule** — K from 10,000, M from 1,000,000, everywhere on screen. The
  separate 1,000 threshold for 13–20 player grids is dropped; those grids shrink the text instead (Q14.24).
- **Q14.5 Rounding?** **D: 3 significant digits, half away from zero**, no trailing .0, sign kept. The red rule compares
  exact integers only (§3.4).
- **Q14.6 Where the exact number lives?** **R (shown in M21)**: tap the `×N ⓘ` chip or any header total → Exact points
  sheet; exact numbers always on the Final scores card, Winners list, share image and PDF.
- **Q14.7 Toggle default and memory?** **R**: Actual ON by default, remembered per phone, hidden at ×1, banner when OFF.
- **Q14.8 Where does ×N show when > 1?** **R**: scorecard strip chip (black, with ⓘ), Home card chip, Final scores
  sub-line, Results game header (`S15 ×100`), share image sub-line, PDF sub-line, live page chip, Log header. Nowhere at ×1.
- **Q14.9 Entered points big on the Add round cells, actual small?** **R**: entered big, actual small under it.
- **Q14.10 Results with mixed multipliers?** **D**: each game contributes its own multiplied totals; `×N` per game header;
  Winners and totals exact; always multiplied, never raw.
- **Q14.11 Share image at 8+ digits?** **R**: one column, exact numbers, never K/M.
- **Q14.12 PDF columns?** **R**: width-driven blocks 5 / 4 / 3; font 11 pt; exact numbers.
- **Q14.13 Cap and validation?** **R**: integer 1–10,000, digits only, empty or 0 → 1, leading zeros stripped, red hint
  "Multiplier is 1 to 10,000." Nothing above 10,000 even with a confirm.
- **Q14.14 Live web page?** **R**: same K/M rule; exact on hover/tap (`title`); "Exact points" list under the table.
- **Q14.15 Log?** **R**: the Log keeps entered points, with the `×N` chip at the top, plus the new "Multiplier changed"
  line (§3.7).
- **Q14.16 Games created before PR 14?** **R**: no multiplier key → ×1; 042 backfills `rounds.multiplier = 1`.
- **Q14.17 Tap targets in the grid.** **R, smaller option**: only the chip and the header totals open the sheet; cells
  stay tap-free (M21).
- **Q14.18 Older app builds (APK 9/10) opening a ×100 game?** **R**: they show entered points with no chip; 042 makes the
  server compute results right regardless of the build. Order 042 before the APK that carries PR 14.
- **Q14.19 Help and Tutorial text.** **R**: PR 11 / PR 12 get four bullets: type points, the app multiplies; K/M and the
  Exact sheet; the toggle changes only the view; admins can change the multiplier mid-game and the Log shows it.
- **Q14.20 The toggle wording.** **R**: "Actual points / Entered points".
- **Q14.21 Pool games — truly never?** **R**: never, including the awards screen.
- **Q14.22 (flagged) After a mid-game change, what happens to the rounds already saved?** Recommended and shown in M22:
  **each round keeps the multiplier it was saved with** (Sree's own suggestion), the change applies **from the next
  round**, and the dialog offers **All rounds** as the explicit second choice for the "typed 100, meant 10" case so a
  wrong number can be fixed without undoing every round. Both choices are logged with who / when / from which round.
  Alternative rejected: always re-price every round (silently changes agreed scores). Alternative not offered: a
  "From round N" picker for an arbitrary past round — adds a control for a case nobody has asked for; Undo covers it.
- **Q14.23 (flagged) The Pool lock (041).** Recommended (§3.8): keep it on the pool **limit** only; free Drop, Middle drop
  and Full count with a Log line, as a small addition to the 042 migration (the lock trigger drops three of its four
  comparisons; the app's Pool settings sheet un-greys those three fields after round 1). Alternative: remove the lock
  entirely and let `pool_recompute` re-decide who is out when the limit changes — technically possible, but a player
  already marked OUT (and maybe already re-entered) would silently come back or go out, which is why I do not recommend it.
- **Q14.24 (flagged, confirm only) 13–20 players.** Recommended: the same K/M rule with the text shrinking to fit the
  38 dp column, the way initials do since PR 13; no separate threshold, no extra layout work for 13+. Nightly test
  X14-9 keeps the 20-player grid from clipping; it does not have to look as good as 12.

## 7. Expert suggestions (not required by Sree; cheap if taken now)

1. **The example box** under the field ("A 30 is 3,000 · a Full count is 8,000") — now part of the spec (D14.3).
2. **Confirm when the multiplier is ≥ 1,000 on Start or on Change** ("Start game at ×1,000? A Full count is 80,000
   points.") — one dialog, because the digits field accepts 1000 and 10000 as easily as 10. Not a "high number warning"
   on scores.
3. **Share and PDF sub-line** always carry "×N · exact points" (and "×10 rounds 1–6 · ×5 rounds 7–9" after a change) so a
   screenshot of the picture is never misread.
4. **Exact sheet at ×1** doubles as a plain "totals as a list" view — useful on the 20-player grid already.
5. **Unit test the formatter against a CSV** (value, expected) the same way initials are tested, and a property test
   "shortNumber never changes sign, never shows .0, never exceeds 6 characters".
6. **Accessibility labels** read the exact number ("Sree, total plus twelve million four hundred thousand") even when the
   cell shows 12.4M.
7. **Realtime**: a multiplier change is a `games.settings` update plus `rounds` updates, both already in the realtime
   publication, so other phones redraw without extra plumbing; the Log line arrives through the existing event feed.

## 8. Tests (codes for `docs/testing-strategy.md`, PR 14 block; written with the build)

| # | Kind | What it proves |
| --- | --- | --- |
| X14-1 | U | `shortNumber`: one threshold 10,000 / 1,000,000; 3 significant digits; half away from zero; no ".0"; sign; 0 → "0"; CSV-driven cases |
| X14-2 | U | `actual()` = entered × that round's multiplier for every score and total; sums of exact values add to 0 when entered values do; the red rule ignores display rounding; mixed-rate games (×10 rounds 1–6, ×5 from 7) sum correctly |
| X14-3 | U | Multiplier parsing: digits only, 1–10,000, empty/0 → 1, 25000 → error text; absent key → 1; precedence game › user default › 1; Pool games ignore the key |
| X14-4 | U | Final scores sheet: two columns to 7 digits, one column from 8; exact text; share image never calls `shortNumber`; PDF block width 5/4/3 from the widest value; sub-lines carry the rate spans |
| X14-5 | U | Results: per-game multiplied contributions, `×N` headers only when > 1, Winners exact, table K/M; mixed-multiplier fixture (×1, ×2, ×5 games in one result) |
| X14-6 | U | Toggle: default ON, persisted per phone, hidden at ×1; banner text when OFF; nothing saved or shared changes |
| X14-7 | D | 042 pgTAP: `declare_game_result` on a ×10,000 game of 6 extreme nights saves 2,280,000,000 without error; multiplier applied in SQL per round; `set_game_multiplier` from-round vs all-rounds; admin-only; refused on Completed; Log line; `rounds.multiplier` backfill = 1; Pool lock keeps the limit and frees the three values (Q14.23); rollback replay |
| X14-8 | S | Smoke: New game Points ×100 → scorecard chip and toggle → Add round with "= −3,000" lines → tap chip → Exact sheet → Complete → Final scores exact → Results `×100` header (screenshots) |
| X14-9 | N | Nightly: 20 players at ×10,000 portrait and landscape (K/M text shrinks, no clipping — the Q14.24 gate), share image one column, PDF 4-column blocks |
| X14-10 | N | Nightly: Change multiplier ×10 → ×5 from round 7 (marks on rounds 1–6, footer spans, Exact sheet both rates, Log line); All rounds variant; a second phone sees the change within 10 s |
| X14-11 | M | Emulator pass of every M-screen in this spec |

## 9. Place in the sequence, and how big the build is

PR 14 (build) stacks on PR 13 (#32). Migration 042 after 041. Help (PR 11) and Tutorial (PR 12) text land after PR 14's
wording is final (Q14.19 / Q14.20). Sree called this important before going live; nothing in it blocks PR 13.

**Size, honestly:** this is not a small build. It is about the size of PR 10b — one migration that rewrites three large
result functions, adds a column, an RPC and a log kind; a formatter module with CSV tests; and edits across twelve app
surfaces (Game type form, Settings, scorecard strip / header / cells / menu / dialog / Exact sheet, Add round cell line and
confirm text, Final scores sheet, share image, PDF, Results page, live web page, Help). Per Q16.16 it **waits behind PR 17
test infra**. If Sree wants part of it sooner, the clean cut is **slice A — the in-game part**: migration 042, the Game type
field and Settings default, the scorecard chip / toggle / Exact sheet / Change multiplier, the Add round line, and Results
*saved* multiplied in SQL (so nothing is ever saved raw) — leaving **slice B** (K/M in the Results table, `×N` headers,
share image and PDF column rules, live page, Help text) for right after. Slice A is coherent on its own and is roughly half
the work; the recommendation is still to queue the whole PR 14 build after PR 17 unless Sree says otherwise.
