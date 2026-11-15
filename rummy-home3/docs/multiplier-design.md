# Multiplier — design spec (PR 14, review first; nothing built yet)

Status: **spec for Sree's review.** No app code, no migration applied. Mockups: [`multiplier-mockups/`](multiplier-mockups/)
(M01–M20, generated like the Pool set: 390 dp, light theme, caption strip on each). Questions for Sree are in section 6,
each with the recommended answer; the build follows the recommended answers unless he says otherwise.

## 0. Sree's requirements (Nov 14, 3:46 PM PT) and how this spec reads them

| # | Sree said | Read as |
| --- | --- | --- |
| 1 | Points games only, never Pool. 2×, 3×, 10×, 20×, maybe 100× are normal; build for 100× as the normal case; input max 10,000. | `settings.multiplier` on Points games, integer 1–10,000. Hidden for Pool. Everything from the 38 dp 20-player grid to the PDF has to stay readable at 100× without special handling; 1,000× and 10,000× must work (section 2) but may be less pretty. |
| 2 | Impact analysis at 1,000× and 10,000×: magnitudes, widths, grid, 5-player blocks, share image, Results, PDF, DB int types. Flag migrations; apply nothing. | Section 2 and mockup M20. One small migration (042) is needed for `::int` casts in result sums; **not** for `scores.value`. |
| 3 | Store the real number; short forms (1.3K, 2.4M) on screen; PDF full numbers; the exact number must always be reachable; recommend threshold and rounding; rounding must never fake a non-zero total; red total rule. | Section 3 and M19. Recommended: K from 10,000, M from 1,000,000, 3 significant digits (2 on the compact grid, from 1,000); exact in the Exact sheet, Final scores card, Winners list, share image, PDF. The red check compares exact integers only. |
| 4 | Users type raw points only, the app multiplies. No high-number warning. | Add round is unchanged except a small "= −3,000" line per cell (M12). The one confirm left ("more than Full count?") also says the actual points (M13). |
| 5 | Per-game Multiplier setting: tap, type digits, max 10,000. Leans to no presets. A user default in Settings prefilling every Points game (Game type screen). Show on the scorecard when > 1. | M01/M03/M04. Recommended: no presets (Q14.3). A black `×100` chip in the scorecard strip, on the Home card and in Results headers when > 1 (M05, M15, M18). |
| 6 | Scorecard view toggle Actual/Entered; the multiplier always applies; totals, Results, shares, PDFs, awards/standings use multiplied totals. | M05–M10. The toggle only changes what the grid and header totals *display*; a yellow banner says so when it is off. Everything that leaves the screen is multiplied. |
| 7 | Important before going live. | Sequenced right after PR 13 (section 9), before Help (11) and Tutorial (12) content is final, because those explain it. |

Scope change from the Pool spec: `docs/pool-design.md` §8 said PR 14 "adds `settings.multiplier` for both game types". Sree's
decision 1 overrides it: **Points only.**

## 1. The feature in one paragraph

A Points game can carry a multiplier (×1 default, up to ×10,000). Admins keep typing the hand as points — 30 is typed as
30 — and the app shows, sums, shares and saves to Results 30 × multiplier. The grid stores and remembers the entered
points (so undo, edit round, the Log and the balance check are unchanged), the game stores the multiplier once (locked
after the first saved round, like the Pool limit), and every reader multiplies. Large numbers are shortened on screen
(12.4K, 1.25M) so the 20-player grid still fits, and the exact number is one tap away and printed in full on the Final
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
| `scores.value integer` (int4, ±2,147,483,647) | one hand, entered points | still entered points under the recommended design (Q14.1) | **no change**. Even if multiplied values were stored, one hand is ≤ 800,000. |
| Per-game totals in SQL (`sum(s.value)`) | Postgres `sum(int4)` returns `bigint` | fine | the **`::int` casts** on those sums in `declare_game_result` (`034` → `041` lines 926, 951, 1062) would raise `integer out of range` once a result passes 2,147,483,647 — only the extreme row, but it must not be able to crash a Save. **Migration 042**: cast to `bigint`, multiply inside SQL by `(settings->>'multiplier')::int` (default 1) so results are correct whatever app build declared them. Written, not applied. |
| `results.places` jsonb, `games.settings` jsonb | numbers are `numeric` | fine | none |
| JavaScript | `Number` | safe to 9×10¹⁵ | none |
| `score_text(integer)` in the Log (036) | entered points | entered points | none; the Log shows entered points (Q14.15) |
| Pool functions (`pool_total`, `pool_recompute`) | int casts | untouched | Pool never multiplies |

### 2.3 Where numbers must fit

| Surface | Fits today | At ×100 | At ×1,000 | At ×10,000 | Design answer |
| --- | --- | --- | --- | --- | --- |
| Scorecard, ≤ 8 players (≥ 44 dp columns, 15–18 pt) | 7 characters (−99,999) | −8,000 fits; totals to ±99,999 fit | −80,000 fits; totals go K | −800K; totals ±M | K from 10,000, M from 1,000,000, 3 significant digits (M07) |
| Scorecard, 13–20 players (38 dp columns, 13 pt) | 5 characters (−8,000 is already tight) | −8,000 / −3,000: fits with 5 chars; totals (±200K) go K | −80K | −800K, ±12M | compact grid: K from 1,000, **2** significant digits (M09) |
| Header total under the initials | 15 pt bold | 12.4K | 124K | 1.3M | same rule as its grid |
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

## 3. Display rules (mockup M19)

1. **Source of truth**: entered points per score, multiplier per game. The *actual* value of anything is entered × multiplier,
   computed where it is shown. Nothing is ever rounded before it is summed.
2. **Short forms** (screen only): from 10,000 → K; from 1,000,000 → M; 3 significant digits (12.3K · 123K · 1.23M · 12.3M ·
   123M); half away from zero; no trailing ".0" (12K not 12.0K); sign kept (+12.3K / −6.17K); 0 is always "0". The compact
   grid (columns under 44 dp, i.e. 13+ players) shortens from 1,000 with 2 significant digits (1.3M).
3. **Never shortened**: the Exact points sheet, the Final scores card, the Results Winners list, the share image, the PDF,
   the Log, the Add round big number (which is entered points anyway).
4. **The red rule**: the scorecard footer "Totals add to 0" / red "Totals add to +10" (PR 4) and the Add round Balance pill
   compare exact integers. Short forms on screen may not visibly sum to 0 (+12.3K −6.17K −6.18K); the footer reads
   "Totals add to 0 (exact)" whenever any short form is on screen so nobody tries to add the K's.
5. **Exact reveal**: tapping any header total, any cell, or the `×N` chip opens the **Exact points** sheet (M11): one line per
   player, exact actual total, "entered 1,234 × 10,000" underneath, "Totals add to 0", and a Share full details (PDF) button.
   The sheet is the one place a player can read the real number mid-game; it also exists at ×1 (then it only shows the
   totals, which is harmless and keeps the gesture consistent).
6. **View toggle** (M05–M10): "Actual points" switch in the scorecard strip; ON by default; remembered per phone (not per
   game) in AsyncStorage; OFF shows a yellow banner "Showing entered points. ×100 still applies — totals, Results and shares
   use the actual points." The toggle is hidden at ×1. The toggle never changes what is saved or shared.

## 4. Screens (M01–M20)

| # | File | Shows |
| --- | --- | --- |
| M01 | `M01-game-type-points-multiplier.png` | New game › Game type, Points: Multiplier field under Drop / Middle drop / Full count, "× 10" typed, hint text, Settings link |
| M02 | `M02-game-type-pool-no-multiplier.png` | Same screen with Pool: no Multiplier row |
| M03 | `M03-multiplier-field-states.png` | Over the cap (red "1 to 10,000"), the live example line at ×100, the 🔒 locked state after round 1 |
| M04 | `M04-settings-default-multiplier.png` | Settings: Multiplier default inside Points defaults; Pool block unchanged |
| M05 / M06 | `M05-scorecard-2x-actual.png`, `M06-scorecard-2x-entered.png` | 4 players at ×2, toggle on / off (banner) |
| M07 / M08 | `M07-scorecard-100x-actual.png`, `M08-scorecard-100x-entered.png` | 7 players at ×100: cells −1,000 … totals 12.4K; off = a ×1-looking table |
| M09 / M10 | `M09-scorecard-10000x-20p-actual.png`, `M10-scorecard-10000x-20p-entered.png` | 20 players at ×10,000 on 38 dp columns: −800K cells, ±M totals; off = entered |
| M11 | `M11-exact-points-sheet.png` | Exact points sheet from a tap on a total |
| M12 | `M12-add-round-100x.png` | Add round at ×100: entered big, "= −3,000" small, Balance in entered points |
| M13 | `M13-add-round-10000x-confirm.png` | The one confirm left, now also stating the actual points |
| M14 | `M14-final-scores-10000x.png` | Final scores at ×10,000: exact card in one column, K/M round grid with the toggle |
| M15 | `M15-results-mixed-multipliers.png` | Results with ×1, ×100, ×10,000 games: exact Winners, K/M table, `×N` per game header |
| M16 | `M16-share-image-10000x.png` | Share image (yellow) at ×10,000: exact, one column |
| M17 | `M17-pdf-page-10000x.png` | PDF: exact everywhere; 5 → 4 columns driven by the widest value |
| M18 | `M18-home-card-live-link-log.png` | Home card chip, live web page, Log at a multiplied game |
| M19 | `M19-rounding-and-red-total-rule.png` | Threshold, rounding and the red non-zero-total rule worked through |
| M20 | `M20-impact-1000x-10000x.png` | Impact table (section 2) as one picture |

## 5. Data (to be written in the build PR, not here)

- `games.settings.multiplier` (jsonb key, integer 1–10,000, absent = 1). Profile defaults: `default_settings.multiplier`.
  No new columns.
- Migration **042** (small): `declare_game_result` / `result_places_json` / `public_result` sums as `bigint`, multiplied in
  SQL by the game's multiplier (so a result is right even when declared from an older app build); `public_scorecard` returns
  `multiplier` for the live page; `games_points_settings_lock` trigger (PT423, same wording as the Pool lock) refusing a
  multiplier change once a live round exists. Rollback restores the 041 bodies. pgTAP file 33. Written, tested locally,
  **not applied**.
- App: `utils/multiplier.ts` (`actual(value, m)`, `shortNumber(v, {compact})`, `exactLines(game)`), `pointsGameMultiplier(game)`;
  `GameSettings.multiplier?`; `RulesForm` field; `Settings` default; scorecard strip chip + toggle + Exact sheet; `ScoreCell`
  small line; `finalScoresSheet` one-column rule; `shareImage` one-column rule; `shareResultsPdf` block-width rule;
  `results` K/M in the table, `×N` headers; `public/scorecard.html` (+ `web/` mirror) K/M + title + Exact list; Help bullets.

## 6. Questions for Sree (numbered; recommended answer first)

- **Q14.1 Store entered or multiplied points?** Recommended: **entered**, multiplier on the game. Undo, Edit round, the
  Log, the balance check and the Pool code stay untouched; nothing in `scores` changes type; a wrong multiplier before
  round 1 is fixed by editing one number. Alternative (store multiplied) would need bigint everywhere and would make the
  Entered view a division.
- **Q14.2 Lock the multiplier after the first round?** Recommended: **yes**, same PT423 lock and wording as the Pool
  settings ("Undo every round to edit it"). Otherwise one tap would re-price every saved round behind everyone's back.
- **Q14.3 Presets?** Recommended: **no presets** (agreeing with Sree): a plain digits field with a leading "×", prefilled
  from Settings; the hint under it turns a typed value into words ("A 30 is 3,000 · a Full count is 8,000"). Chips would
  add a row for little gain and the common values differ by group.
- **Q14.4 Threshold for short forms?** Recommended: **10,000** on normal grids and everywhere else on screen; **1,000** on
  the compact 13–20 player grid (38 dp columns fit five characters). Not 999 everywhere — "9,999" is readable and common at
  ×100.
- **Q14.5 Rounding?** Recommended: **3 significant digits, half away from zero**, no trailing .0, sign kept; **2 significant
  digits** on the compact grid. The red rule compares exact integers only (section 3.4).
- **Q14.6 Where the exact number lives?** Recommended: a **tap** on any total / cell / the ×N chip opens the Exact points
  sheet (M11); exact numbers always on the Final scores card, Winners list, share image and PDF. Not long-press: it is
  undiscoverable on Android and the grid has no other tap action today. Note: this adds the first tap target to the grid
  cells — confirm you are fine with that (Q14.17).
- **Q14.7 Toggle default and memory?** Recommended: **Actual ON** by default, remembered **per phone**, hidden at ×1,
  banner when OFF. Per-game memory would surprise people moving between games.
- **Q14.8 Where does ×N show when > 1?** Recommended: scorecard strip chip (black, like a count badge), Home card chip,
  Final scores sub-line, Results game header (`S15 ×100`), share image sub-line, PDF sub-line, live page chip, Log header.
  Nowhere at ×1.
- **Q14.9 Entered points on the Add round cells, actual small — or the reverse?** Recommended: **entered big** (it is what
  the keypad types and what the Balance pill checks), actual small under it. At 13+ players (3 columns) the small line goes
  K/M.
- **Q14.10 Results with mixed multipliers?** Recommended: each game contributes its own multiplied totals; the table header
  shows `×N` per game; the Winners list and totals are exact; "Totals add to 0 (exact)". No per-result multiplier.
- **Q14.11 Share image at 8+ digits?** Recommended: **one column** (positives first, then negatives), exact numbers, never
  K/M, every player still on the picture (PR 10b rule). Two columns stay up to 7 digits.
- **Q14.12 PDF columns?** Recommended: **width-driven blocks**: 5 players per block while the widest value is ≤ 7
  characters, 4 to 9 characters, 3 beyond; font 11 pt, exact numbers.
- **Q14.13 Cap and validation?** Recommended: integer **1–10,000**, digits only, empty or 0 → 1, leading zeros stripped,
  the red hint "Multiplier is 1 to 10,000." Nothing above 10,000 even with a confirm.
- **Q14.14 Live web page?** Recommended: same K/M rules; hovering or tapping a number shows the exact value (`title`), and
  an "Exact points" list sits under the table.
- **Q14.15 Log?** Recommended: the Log keeps **entered points** (what the admin typed; it is an audit of taps), with the
  `×N` chip at the top of the Log screen. Alternative: both numbers per line — noisy.
- **Q14.16 Completed and Closed games created before PR 14?** No multiplier key → ×1. No backfill.
- **Q14.17 Tap targets in the grid.** Today a cell does nothing on tap. Giving every cell and total the Exact sheet is new
  behaviour; recommended yes (it also helps at ×1 for players who want the totals as a list). If you prefer, only the
  header totals and the chip open it.
- **Q14.18 Older app builds (APK 9/10) opening a ×100 game?** They show entered points with no chip. Recommended: accept
  until the next APK; 042 makes the server compute results right regardless of the app build. Flagging it because a result
  saved from an old build before 042 is applied would be at ×1 — order 042 before the APK that carries PR 14.
- **Q14.19 Help and Tutorial text.** PR 11 / PR 12 get three bullets: type points, the app multiplies; K/M and the Exact
  sheet; the toggle changes only the view.
- **Q14.20 The toggle wording.** "Actual points / Entered points" (recommended) vs "Multiplied / Raw" vs "×100 on / off".
  "Actual" says it is the real value; "Entered" says where the other number came from.
- **Q14.21 Pool games — truly never?** Recommended: never, including the awards screen (awards are already free numbers).
  If a group wants a bigger pool they set the entry per player on the Awards screen.

## 7. Expert suggestions (not required by Sree; cheap if taken now)

1. **Settings sentence** under the field: "A 30 is 3,000 · a Full count is 8,000" updates as the number is typed — stops
   ×100 vs ×1,000 slips before the first round.
2. **Confirm when the multiplier is ≥ 1,000 on Start** ("Start game at ×1,000? A Full count is 80,000 points.") — one
   dialog, once per game, because the multiplier is locked after round 1. Not a "high number warning" on scores.
3. **Share and PDF sub-line** always carry "×N · exact points" so a screenshot of the picture is never misread.
4. **Exact sheet at ×1** doubles as a plain "totals as a list" view — useful on the 20-player grid already.
5. **Unit test the formatter against a CSV** (value, compact, expected) the same way initials are tested, and a property
   test "shortNumber never changes sign, never shows .0, never exceeds 5 characters on compact".
6. **Accessibility labels** read the exact number ("Sree, total plus twelve million four hundred thousand") even when the
   cell shows 12.4M.

## 8. Tests (codes for `docs/testing-strategy.md`, PR 14 block; written with the build)

| # | Kind | What it proves |
| --- | --- | --- |
| X14-1 | U | `shortNumber`: threshold 10,000 / compact 1,000; 3 / 2 significant digits; half away from zero; no ".0"; sign; 0 → "0"; CSV-driven cases |
| X14-2 | U | `actual()` = entered × multiplier for every score and total; sums of exact values add to 0 when entered values do; the red rule ignores display rounding |
| X14-3 | U | Multiplier parsing: digits only, 1–10,000, empty/0 → 1, 25000 → error text; absent key → 1; Pool games ignore the key |
| X14-4 | U | Final scores sheet: two columns to 7 digits, one column from 8; exact text; share image never calls `shortNumber`; PDF block width 5/4/3 from the widest value |
| X14-5 | U | Results: per-game multiplied contributions, `×N` headers only when > 1, Winners exact, table K/M; mixed-multiplier fixture |
| X14-6 | U | Toggle: default ON, persisted per phone, hidden at ×1; banner text when OFF; nothing saved or shared changes |
| X14-7 | D | 042 pgTAP: `declare_game_result` on a ×10,000 game of 6 extreme nights saves 2,280,000,000 without error; multiplier applied in SQL; lock trigger PT423 after round 1; rollback replay |
| X14-8 | S | Smoke: New game Points ×100 → scorecard chip and toggle → Add round with "= −3,000" lines → Exact sheet → Complete → Final scores exact → Results `×100` header (screenshots) |
| X14-9 | N | Nightly: 20 players at ×10,000 portrait and landscape (compact K/M, no clipping), share image one column, PDF 4-column blocks |
| X14-10 | M | Emulator pass of every M-screen in this spec |

## 9. Place in the sequence

PR 14 (build) stacks on PR 13 (#32). Migration 042 after 041. Help (PR 11) and Tutorial (PR 12) text should land after
PR 14's wording is final (Q14.19 / Q14.20). Sree called this important before going live; nothing in it blocks PR 13.
