# Multiplier — design spec (PR 14, review first; nothing built yet)

Status: **spec revised to Sree's answers of Nov 14, 10:27 PM PT** (which reverse the 8:58 PM answer on mid-game
changes). No app code, no migration applied. Mockups: [`multiplier-mockups/`](multiplier-mockups/) (M01–M21, generated
like the Pool set: 390 dp, light theme, caption strip on each). Section 6 records every question with the answer that now
stands; one item is flagged for Sree (**Q14.25**, the exact moment the multiplier locks — this spec picks "at creation"
and says why) and the build follows that unless he says otherwise. Section 9 says where the build sits in the queue.

## 0. Sree's requirements (Nov 14, 3:46 PM PT) and how this spec reads them

| # | Sree said | Read as |
| --- | --- | --- |
| 1 | Points games only, never Pool. 2×, 3×, 10×, 20×, maybe 100× are normal; build for 100× as the normal case; input max 10,000. | `settings.multiplier` on Points games, integer 1–10,000. Hidden for Pool. Everything from the grid to the PDF stays readable at 100× without special handling; 1,000× and 10,000× must work (section 2) but may be less pretty. |
| 2 | Impact analysis at 1,000× and 10,000×: magnitudes, widths, grid, 5-player blocks, share image, Results, PDF, DB int types. Flag migrations; apply nothing. | Section 2 and mockup M20. One small migration (043) is needed for the `::int` casts in result sums and to multiply inside SQL (section 5); **not** for `scores.value`, and no new column. |
| 3 | Store the real number; short forms (1.3K, 2.4M) on screen; PDF full numbers; the exact number must always be reachable; recommend threshold and rounding; rounding must never fake a non-zero total; red total rule. | Section 3, M19 and M21. One rule: K from 10,000, M from 1,000,000, never more than 5 characters including the sign; exact in the Exact sheet, Final scores card, Winners list, share image, PDF. The red check compares exact integers only. |
| 4 | Users type raw points only, the app multiplies. No high-number warning. | Add round is unchanged except a small "= −3,000" line per cell (M12). The one confirm left ("more than Full count?") also says the actual points (M13). |
| 5 | Per-game Multiplier setting: tap, type digits, max 10,000. Leans to no presets. A user default in Settings prefilling every Points game. Show on the scorecard when > 1. | M01/M03/M04. No presets (D14.3). A black `×100 ⓘ` chip in the scorecard strip, on the Home card and in Results headers when > 1 (M05, M15, M18). |
| 6 | Scorecard view toggle Actual/Entered; the multiplier always applies; totals, Results, shares, PDFs, awards/standings use multiplied totals. | M05–M10. The toggle only changes what the grid and header totals *display*; a yellow banner says so when it is off. Everything that leaves the screen is multiplied (D14.9). |
| 7 | Important before going live. | Section 9. |

Scope change from the Pool spec: `docs/pool-design.md` §8 said PR 14 "adds `settings.multiplier` for both game types". Sree's
decision 1 overrides it: **Points only.**

### 0b. Sree's decisions (Nov 14, 8:58 PM PT, revised 10:27 PM PT) and what changed

| # | Sree decided | Spec change |
| --- | --- | --- |
| D14.1 | Store entered (raw) points plus the multiplier. | As recommended (Q14.1). Unchanged. |
| D14.2 | **Reversed at 10:27 PM: no mid-game changes.** "Once a game starts, it's done." The multiplier is set when the game is created and locked once it starts. | The 8:58 PM design (per-round multiplier, *Change multiplier* menu, *All rounds*, M22) is **dropped**. One value per game in `settings.multiplier`, read-only once the game has started; wherever the multiplier shows mid-game the hint reads **"To change the multiplier, end this game and start a new one."** (M01, M03, M11, M21, §3.7). The lock moment is "at creation" — flagged as **Q14.25**. |
| D14.2b | Why does Pool lock its limit / drops? Explain; recommend whether to drop it on the same principle. | **Decided (Q14.23 OK, 10:27 PM):** lock the pool *limit* only; Drop / Middle drop / Full count stay editable with a Log line. Built as migration **042** on PR 13, not here (§3.8). |
| D14.3 | No presets; a digits-only field with "×"; keep the live example sentence, but make it obvious. | The example is a yellow box under the field ("A 30 is 3,000 · a Full count is 8,000"), not grey hint text (M01, M03). |
| D14.4 | Everything starts at 1. Precedence: game setting › user default › app default 1. | §3.9 and M04 wording. |
| D14.5 | Threshold / player count. 10:27 PM: "why does 13+ need anything different? With K/M a value is never more than about 5 characters including the sign, and 5 fit the standard layout." | He is right — **one rule everywhere, no 13+ special case** (§2.3, §3.2, M19): K from 10,000, M from 1,000,000, and never more than **5 characters including the sign**, which is exactly what the 38 dp column floor was sized for. Q14.24 dropped. |
| D14.6 | Rounding: 3 significant digits, half away from zero — fine. | Unchanged. |
| D14.7 | Exact-number viewing is confusing in words; show it. | **M21** walks through it: tap the `×N ⓘ` chip or any header total → the Exact points sheet; a table of the places that always print the exact number. The chip now carries an ⓘ so the tap is discoverable (§3.5). |
| D14.8 | Toggle: use the recommendation. | Actual ON by default, remembered per phone, hidden at ×1, banner when OFF (Q14.7). Unchanged. |
| D14.9 | Results: when a game is completed and winners announced, ALWAYS save and show multiplied points, never raw. A combined result may mix ×1, ×2, ×5 games; each contributes its multiplied totals. | Already the design (Q14.10, M15); now stated as a rule in §3.1 and enforced in SQL by 042 so no app build can save a raw result. |
| D14.10 | "I trust you for the rest. Just go ahead with your recommendations." | Every other Q in section 6 stands at its recommended answer. |

## 1. The feature in one paragraph

A Points game can carry a multiplier (×1 default, up to ×10,000). It is chosen on the New game screen (prefilled from the
user's default) and **locked once the game starts** — to play at a different rate you end the game and start a new one.
Admins keep typing the hand as points — 30 is typed as 30 — and the app shows, sums, shares and saves to Results
30 × multiplier. The grid stores the entered points (so undo, edit round, the Log and the balance check are unchanged) and
every reader multiplies by the game's one value. Large numbers are shortened on screen (−12K, 1.2M; never more than five
characters including the sign, so they fit the same columns as today) and the exact number is one tap away (the `×N ⓘ`
chip or any total) and printed in full on the Final scores card, the Winners list, the share image and the PDF.

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
| `rounds` | round number, dealer, timestamps | unchanged | **no new column** — the multiplier is one value per game (D14.2 as revised), read from `games.settings`. |
| Per-game totals in SQL (`sum(s.value)`) | Postgres `sum(int4)` returns `bigint` | `sum(s.value) * multiplier` as `bigint` | the **`::int` casts** on those sums in `declare_game_result` (`034` → `041` lines 926, 951, 1062) would raise `integer out of range` once a result passes 2,147,483,647 — only the extreme row, but it must not be able to crash a Save. **Migration 043**: cast to `bigint`, multiply inside SQL by the game's multiplier so results are correct whatever app build declared them (D14.9). Written, not applied. |
| `results.places` jsonb, `games.settings` jsonb | numbers are `numeric` | fine | none |
| JavaScript | `Number` | safe to 9×10¹⁵ | none |
| `score_text(integer)` in the Log (036) | entered points | entered points | none; the Log shows entered points (Q14.15); no new log kind |
| Pool functions (`pool_total`, `pool_recompute`) | int casts | untouched | Pool never multiplies |

### 2.3 Where numbers must fit

The scorecard today (`utils/scorecardLayout.ts`): player columns share the width left of the round column; the font
steps 18 → 16 → 15 → 13 pt as columns narrow; a column never goes under **38 dp**, which was sized so "−1234" (five
characters at 13 pt) stays legible — below that the table scrolls sideways instead (on a 360 dp phone that happens from
about 9 players). Cells have no thousands separators and positives carry a "+", so the widest value today is five
characters. With the short-form rule in §3.2 **every value stays at five characters or fewer** (−9999 · −12K · −123K ·
−1.2M · −12M · −123M), so the existing layout fits at every player count and nothing is special about 13+.

| Surface | Fits today | At ×100 | At ×1,000 | At ×10,000 | Design answer |
| --- | --- | --- | --- | --- | --- |
| Scorecard grid, any player count (38 dp floor, 13 pt at the narrowest) | 5 characters (−1234) | −8000 fits; totals ±99,999 go K (−12K) | −80K | −800K; totals ±1.2M / −12M | one rule: K from 10,000, M from 1,000,000, ≤ 5 characters (M07, M09) |
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

## 3. Display rules (mockups M19, M21)

1. **Source of truth**: entered points per score, **one multiplier per game** (`settings.multiplier`, fixed once the game
   starts). The *actual* value of a score is entered × the game's multiplier; a total is the sum of actual values,
   computed where it is shown. Nothing is ever rounded before it is summed. **Everything that leaves the screen — Final
   scores, Results (including a combined result that mixes ×1, ×2 and ×5 games), shares, PDFs, the live page — is actual
   points, never raw** (D14.9).
2. **Short forms, one rule everywhere on screen** (D14.5, M19): up to 9,999 the whole number is shown, as today (no
   thousands separators in grid cells); from 10,000 thousands with a K; from 1,000,000 millions with an M; **never more
   than five characters including the sign** — so as many figures as fit: 12.3K but −12K, 123K, 1.23M but −1.2M, 12.3M
   but −12M, 123M; half away from zero; no trailing ".0" (12K not 12.0K); a value that rounds up to 1000K becomes 1M; 0 is
   always "0". In plain words: *the app writes a number the long way until it has five digits, then it says "K" or "M"
   and never uses more than five characters.* The same rule, the same font steps and the same 38 dp column floor apply
   at every player count; there is no 13+ special case (M09, M10).
3. **Never shortened**: the Exact points sheet, the Final scores card, the Results Winners list, the share image, the PDF,
   the Log, the Add round big number (which is entered points anyway).
4. **The red rule**: the scorecard footer "Totals add to 0" / red "Totals add to +10" (PR 4) and the Add round Balance pill
   compare exact integers. Short forms on screen may not visibly sum to 0 (+12.3K −6.17K −6.18K); the footer reads
   "Totals add to 0 (exact)" whenever any short form is on screen so nobody tries to add the K's.
5. **Exact reveal** (D14.7, M21): the strip chip reads `×100 ⓘ`; tapping it, or tapping any header total, opens the
   **Exact points** sheet (M11): one line per player, exact actual total, "entered 1,234 × 100" underneath, the hint "To
   change the multiplier, end this game and start a new one.", "Totals add to 0", and a Share full details (PDF) button.
   The sheet also exists at ×1
   (then it is simply the totals as a list). Cells in the grid stay tap-free; the two visible targets (chip, totals) are
   enough and keep the grid as it is today (this settles Q14.17 at the smaller option).
6. **View toggle** (M05–M10): "Actual points" switch in the scorecard strip; ON by default; remembered per phone (not per
   game) in AsyncStorage; OFF shows a yellow banner "Showing entered points. ×100 still applies — totals, Results and shares
   use the actual points." The toggle is hidden at ×1. The toggle never changes what is saved or shared.
7. **Locked once the game starts** (D14.2 as revised, M01, M03): the multiplier is typed on the New game › Game type
   screen and that is the only place it can be set. From the moment the game exists it is read-only: the Game settings
   sheet shows it greyed with a lock and the hint **"To change the multiplier, end this game and start a new one."**; the
   same hint sits in the Exact points sheet (M11, M21), which is where the `×N ⓘ` chip leads. There is no *Change
   multiplier* menu item, no per-round rate, no "from round N", no Log line for a change, and the server refuses a
   `settings.multiplier` change on an existing game (trigger in 043, like the Pool limit lock) so an older app build
   cannot slip one through. **Why "at creation" rather than "at round 1"** (Q14.25): a game with no rounds yet has
   nothing to re-price, so an edit window between Start and round 1 buys almost nothing — the New game screen is one
   Back tap away — and it would need an edit field, a server check on `rounds` count and a Log line. Locking at creation
   is simpler to build, simpler to explain ("set it when you start the game") and matches "once a game starts, it's
   done". If Sree prefers the round-1 window, the trigger condition becomes "no rounds exist" and the Game settings
   field un-greys until the first Save; everything else in this spec stays.
8. **The Pool lock, decided** (D14.2b, Q14.23 OK). In one sentence: *the pool limit decides who is out and what score a
   re-entering player starts at, so changing it after rounds are saved would contradict eliminations and re-entries
   already on the card — the lock stops that.* Drop, Middle drop and Full count only drive the keypad shortcuts, the
   "more than Full count?" confirm and the drops-left reading, so they stay editable with a Log line. This is built as
   migration **042** on PR 13 (`games_pool_settings_lock` locks only `poolLimit`; pgTAP 32/33), not in PR 14. The
   multiplier is locked for the opposite reason — not because a change would break the card, but because Sree wants one
   rate per game, full stop.
9. **Defaults** (D14.4): everything starts at ×1. The value used by a game is the game's own `settings.multiplier`; the
   New game screen prefills it from the user's default (`profiles.default_settings.multiplier`); with no default it is 1.
   The game's value always wins once the game exists; changing the user default never touches existing games.

## 4. Screens (M01–M21)

| # | File | Shows |
| --- | --- | --- |
| M01 | `M01-game-type-points-multiplier.png` | New game › Game type, Points: Multiplier field under Drop / Middle drop / Full count, "× 10" typed, the yellow example box, "Set it now — once the game starts the multiplier is locked" |
| M02 | `M02-game-type-pool-no-multiplier.png` | Same screen with Pool: no Multiplier row |
| M03 | `M03-multiplier-field-states.png` | Over the cap (red "1 to 10,000"), the example box at ×100, and Game settings once the game has started: Drop / Middle drop / Full count editable, Multiplier greyed with a lock and the hint "To change the multiplier, end this game and start a new one." |
| M04 | `M04-settings-default-multiplier.png` | Settings: Multiplier default inside Points defaults; precedence wording; Pool block unchanged |
| M05 / M06 | `M05-scorecard-2x-actual.png`, `M06-scorecard-2x-entered.png` | 4 players at ×2, toggle on / off (banner); chip `×2 ⓘ` |
| M07 / M08 | `M07-scorecard-100x-actual.png`, `M08-scorecard-100x-entered.png` | 7 players at ×100: cells −1,000 … totals 12.4K; off = a ×1-looking table |
| M09 / M10 | `M09-scorecard-10000x-20p-actual.png`, `M10-scorecard-10000x-20p-entered.png` | 20 players at ×10,000 on 38 dp columns: −800K cells, ±M totals — the same ≤ 5-character rule as 4 players, nothing special for 13+; off = entered |
| M11 | `M11-exact-points-sheet.png` | The Exact points sheet, with the "end this game and start a new one" hint |
| M12 | `M12-add-round-100x.png` | Add round at ×100: entered big, "= −3,000" small, Balance in entered points |
| M13 | `M13-add-round-10000x-confirm.png` | The one confirm left, now also stating the actual points |
| M14 | `M14-final-scores-10000x.png` | Final scores at ×10,000: exact card in one column, K/M round grid with the toggle |
| M15 | `M15-results-mixed-multipliers.png` | Results with ×1, ×100, ×10,000 games: exact Winners, K/M table, `×N` per game header (D14.9) |
| M16 | `M16-share-image-10000x.png` | Share image (yellow) at ×10,000: exact, one column |
| M17 | `M17-pdf-page-10000x.png` | PDF: exact everywhere; 5 → 4 columns driven by the widest value |
| M18 | `M18-home-card-live-link-log.png` | Home card chip, live web page, Log at a multiplied game |
| M19 | `M19-rounding-and-red-total-rule.png` | The one rule (K from 10,000, M from a million, ≤ 5 characters), rounding and the red non-zero-total rule worked through |
| M20 | `M20-impact-1000x-10000x.png` | Impact table (section 2) as one picture |
| M21 | `M21-exact-numbers-how-to-see-them.png` | A: the two taps (chip ⓘ, any total, highlighted) · B: the sheet that opens (with the hint) · C: the places that always print the exact number |

M22 (changing the multiplier mid-game) was removed on Nov 15 after the 10:27 PM answer; `git log` on
`docs/multiplier-mockups/` has it if the idea ever comes back.

## 5. Data (to be written in the build PR, not here)

- `games.settings.multiplier` (jsonb key, integer 1–10,000, absent = 1) — the game's one multiplier, written by
  `create_game` only. Profile defaults: `default_settings.multiplier`.
- No `rounds` column, no RPC, no new log kind.
- Migration **043** (numbered after PR 13's 042): `declare_game_result` / `result_places_json` / `public_result` sums as
  `bigint` of `sum(value) × multiplier` (so a result is right even when declared from an older app build — D14.9);
  `public_scorecard` returns the multiplier for the live page; a `games` trigger refuses a change to
  `settings.multiplier` once the game exists (message: "The multiplier is set when a game starts. To change it, end this
  game and start a new one."). Rollback restores the 042 bodies. pgTAP file 34. Written, tested locally, **not applied**.
- App: `utils/multiplier.ts` (`actual(value, m)`, `shortNumber(v)`, `exactLines(game)`), `pointsGameMultiplier(game)`;
  `GameSettings.multiplier?`; `RulesForm` field + example box (editable on New game only; greyed with the lock hint in Game
  settings); `Settings` default; scorecard strip chip + toggle + Exact sheet; `ScoreCell` small line; `finalScoresSheet`
  one-column rule; `shareImage` one-column rule; `shareResultsPdf` block-width rule; `results` K/M in the table, `×N`
  headers; `public/scorecard.html` (+ `web/` mirror) K/M + title + Exact list; Help bullets.

## 6. Questions and where each one stands

Decided by Sree (D) or by his "go ahead with your recommendations" (R). Still flagged: **Q14.25** only.

- **Q14.1 Store entered or multiplied points?** **D: entered**, one multiplier on the game.
- **Q14.2 Lock the multiplier after the first round?** **D (10:27 PM, reversing 8:58 PM): locked — no mid-game changes.**
  Set at creation; see §3.7 and Q14.25 for the exact moment.
- **Q14.3 Presets?** **D: no presets**: a plain digits field with a leading "×", prefilled from Settings; the example
  under it is a visible yellow box ("A 30 is 3,000 · a Full count is 8,000") that updates as the number is typed.
- **Q14.4 Threshold for short forms?** **D: one rule** — K from 10,000, M from 1,000,000, never more than 5 characters
  including the sign, everywhere on screen and at every player count. No 13+ special case (§2.3, §3.2).
- **Q14.5 Rounding?** **D: half away from zero**, as many figures as fit in 5 characters, no trailing .0, sign kept. The
  red rule compares exact integers only (§3.4).
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
- **Q14.15 Log?** **R**: the Log keeps entered points, with the `×N` chip at the top. No "Multiplier changed" line —
  there is no change.
- **Q14.16 Games created before PR 14?** **R**: no multiplier key → ×1; nothing to backfill.
- **Q14.17 Tap targets in the grid.** **R, smaller option**: only the chip and the header totals open the sheet; cells
  stay tap-free (M21).
- **Q14.18 Older app builds (APK 9/10) opening a ×100 game?** **R**: they show entered points with no chip; 043 makes the
  server compute results right regardless of the build. Order 043 before the APK that carries PR 14.
- **Q14.19 Help and Tutorial text.** **R**: PR 11 / PR 12 get four bullets: type points, the app multiplies; K/M and the
  Exact sheet; the toggle changes only the view; the multiplier is set when the game starts — to change it, end this game
  and start a new one.
- **Q14.20 The toggle wording.** **R**: "Actual points / Entered points".
- **Q14.21 Pool games — truly never?** **R**: never, including the awards screen.
- **Q14.22 Withdrawn.** It asked how past rounds behave after a mid-game change; there are no mid-game changes (D14.2 as
  revised).
- **Q14.23 Decided (OK, 10:27 PM).** Pool lock on the **limit** only; Drop, Middle drop and Full count editable with a Log
  line. Built as migration 042 on PR 13 (§3.8).
- **Q14.24 Dropped.** 13–20 players need nothing different: with K/M no value is longer than five characters including
  the sign, which is what the 38 dp column floor already holds. Nightly X14-9 still runs the 20-player grid as a plain
  regression check.
- **Q14.25 (flagged, confirm only) When exactly does the multiplier lock?** This spec says **at creation**: it is typed on
  the New game screen and read-only from the moment the game exists (§3.7). The alternative, "editable until the first
  round is saved", needs an edit field in Game settings, a server check on the rounds count and a Log line for a window
  that is one Back tap wide. Say the word and the window is added; nothing else changes.

## 7. Expert suggestions (not required by Sree; cheap if taken now)

1. **The example box** under the field ("A 30 is 3,000 · a Full count is 8,000") — now part of the spec (D14.3).
2. **Confirm when the multiplier is ≥ 1,000 on Start** ("Start game at ×1,000? A Full count is 80,000 points. The
   multiplier can't be changed once the game starts.") — one dialog, because the digits field accepts 1000 and 10000 as
   easily as 10, and because the value is final. Not a "high number warning" on scores.
3. **Share and PDF sub-line** always carry "×N · exact points" so a screenshot of the picture is never misread.
4. **Exact sheet at ×1** doubles as a plain "totals as a list" view — useful on the 20-player grid already.
5. **Unit test the formatter against a CSV** (value, expected) the same way initials are tested, and a property test
   "shortNumber never changes sign, never shows .0, never exceeds 5 characters including the sign".
6. **Accessibility labels** read the exact number ("Sree, total plus twelve million four hundred thousand") even when the
   cell shows 12.4M.
7. **Realtime**: nothing new — the multiplier arrives with the game row every phone already subscribes to.

## 8. Tests (codes for `docs/testing-strategy.md`, PR 14 block; written with the build)

| # | Kind | What it proves |
| --- | --- | --- |
| X14-1 | U | `shortNumber`: one threshold 10,000 / 1,000,000; never more than 5 characters including the sign; half away from zero; 999,500 → 1M; no ".0"; sign; 0 → "0"; CSV-driven cases |
| X14-2 | U | `actual()` = entered × the game's multiplier for every score and total; sums of exact values add to 0 when entered values do; the red rule ignores display rounding |
| X14-3 | U | Multiplier parsing: digits only, 1–10,000, empty/0 → 1, 25000 → error text; absent key → 1; precedence game › user default › 1; Pool games ignore the key |
| X14-4 | U | Final scores sheet: two columns to 7 digits, one column from 8; exact text; share image never calls `shortNumber`; PDF block width 5/4/3 from the widest value; sub-lines carry "×N · exact points" |
| X14-5 | U | Results: per-game multiplied contributions, `×N` headers only when > 1, Winners exact, table K/M; mixed-multiplier fixture (×1, ×2, ×5 games in one result) |
| X14-6 | U | Toggle: default ON, persisted per phone, hidden at ×1; banner text when OFF; nothing saved or shared changes |
| X14-7 | D | 043 pgTAP: `declare_game_result` on a ×10,000 game of 6 extreme nights saves 2,280,000,000 without error; multiplier applied in SQL from `settings`; a `settings.multiplier` change on an existing game is refused with the lock message while Drop / Middle drop / Full count still change; absent key reads as 1; rollback replay |
| X14-8 | S | Smoke: New game Points ×100 → scorecard chip and toggle → Add round with "= −3,000" lines → tap chip → Exact sheet → Complete → Final scores exact → Results `×100` header (screenshots) |
| X14-9 | N | Nightly: 20 players at ×10,000 portrait and landscape (every cell ≤ 5 characters, no clipping, same layout as 4 players), share image one column, PDF 4-column blocks |
| X14-10 | S | Smoke: on a started game, Game settings shows the multiplier greyed with the hint; Drop / Middle drop / Full count still save; a direct `settings.multiplier` update is refused by the server |
| X14-11 | M | Emulator pass of every M-screen in this spec (M01–M21) |

## 9. Place in the sequence, and how big the build is

PR 14 (build) stacks on PR 13 (#32). Migration 043 after 042 (PR 13's pool re-entries and limit lock). Help (PR 11) and
Tutorial (PR 12) text land after PR 14's wording is final (Q14.19 / Q14.20). Sree called this important before going
live; nothing in it blocks PR 13.

**Size, honestly:** smaller than the 8:58 PM version, because the reversal removes the per-round column, the RPC, the
menu item, the dialog, the rate marks and the Log kind. What is left: one migration that rewrites three result functions'
sums and adds a lock trigger; a formatter module with CSV tests; and edits across eleven app surfaces (Game type form,
Game settings read-only field + hint, Settings default, scorecard strip / header / cells / Exact sheet, Add round cell line
and confirm text, Final scores sheet, share image, PDF, Results page, live web page, Help). Roughly PR 10a-sized. Per Q16.16
it **waits behind PR 17 test infra**. If Sree wants part of it sooner, the clean cut is **slice A — the in-game part**:
migration 043, the Game type field and Settings default, the scorecard chip / toggle / Exact sheet, the Add round line,
and Results *saved* multiplied in SQL (so nothing is ever saved raw) — leaving **slice B** (K/M in the Results table, `×N`
headers, share image and PDF column rules, live page, Help text) for right after. Slice A is coherent on its own and is
roughly half the work; the recommendation is still to queue the whole PR 14 build after PR 17 unless Sree says otherwise.
