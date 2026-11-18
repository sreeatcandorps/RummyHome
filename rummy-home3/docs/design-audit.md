# Design consistency audit (PR 15)

Status: **15a and 15b built** (Nov 15, two stacked PRs on the Seating order build; no migration). 15a: A01, A08, A11,
A03, A05, A02, A06, A10 and the three Help-spec items Q11.12 / Q11.14 / Q11.18. 15b: A04, A07, A09, A12, A13, A15, A16,
A17, A19, A20, A21 and the token test (DC15-1), plus the Q13.25 Pool note. All as recommended (Sree approved
Q15.1–Q15.11; nothing under Q15.12). A14 and A18 stay as deliberate differences (§2). Before/after
mockups in [`design-audit/`](design-audit/) — "before" is a crop of a real emulator screenshot (CI smoke run of PR 13's
branch, Nov 14), "after" the proposed version. Items are ranked by impact. Section 4 explains the 15a / 15b split.

## 0a. What 15a built (where to look)

| Item | Built as |
| --- | --- |
| A01 selected games green | `GameListItem`: a picked card fills `secondaryContainer` with a `secondary` ring (the game yellow); the check mark keeps the brand green; `game-card-checked-<code>` testID |
| A11 number square changes colour | the number square and type icon keep the game-type tint whatever the status or selection; the Add round badge is `secondaryContainer` too |
| A08 bottom bars | `components/ui/ActionBar.tsx` (≤ 2 actions, primary filled right, secondary outlined left, a disabled primary says why — "Next · pick 2+ players"); Complete, Final scores and Awards use it; `BottomBar` gained `insetBottom` and the My players tiles sit in their own bar above the tab bar (`my-players-actions`) |
| A03 ID formats | `#42` everywhere a player is listed (`playerIdBadge` in both helpers); "Player ID" only where it is explained |
| A05 dismiss wording | Cancel on every confirm; the verb repeats the title ("Deselect games?" → Deselect); notices say OK (no more "Got it"); info sheets Close; "Not now" only on Give awards first (the other button leaves); the "Back to scorecard" bar buttons on Complete, Players · Admins and the Add round ⋮ are gone — the header arrow (Add round now has one) is the way back |
| A02 titles | `screenTitle('Scorecard', game)` → "Scorecard · S1", centred (no `headerTitleAlign` anywhere); Complete · S1, Final scores · S1, Awards · P1, Log · S1, Players · Admins · S1 |
| A06 dates | `utils/formatWhen.ts` — "Sat, Nov 14 · 7:49 PM", the year only when not this year; `formatGameDateTime`, `finalScoresSheet.formatWhen`, `formatLogWhen`, `startParts` and the link-request expiry all resolve to it; Games in this result reads date · time |
| A10 headings | the saved result page's SCORES / GAME BY GAME / GAMES IN THIS RESULT are sentence case `titleSmall` |
| Q11.12 | ⋮ "Game settings · locked" (lock icon) once a pool has a saved round, on the scorecard and Add round |
| Q11.14 | Awards: saved and unchanged → Cancel + **Add to Results** (opens the Results picker); otherwise Cancel + Save |
| Q11.18 | Add new players: a header Back arrow that behaves like Done; swipe / hardware back route through Done too |

Tests: `tests/design-audit-pr15a.test.ts` (DC15-2, DC15-3, DC15-4 and source checks for the rest); `smoke/08` asserts the
My players bar is on screen (DC15-5). Flows now match `"Scorecard( · .*)?"`, `"Final scores · .*"`, and use `- back`
where they tapped "Back to scorecard".

## 0b. What 15b built (where to look)

| Item | Built as |
| --- | --- |
| A04 share in three places | `components/share/ShareSheet.tsx`: the scorecard header share icon (`scorecard-share-icon`, before Help) opens one sheet — Live scorecard link · Share final scores (when complete; the picture and PDF live on that page). The two ⋮ share items are gone. The saved result keeps its header icon → `ShareImageDialog` (picture + PDF) |
| A07 search fields | `components/ui/SearchField.tsx`: white, standard border, `radius.sm`, the one placeholder; used by My players, New game and Find in database. Sort / filter controls sit in the row below |
| A09 dialogs | `components/ui/ConfirmDialog.tsx` (Cancel + verb, red when destructive) joins `NoticeDialog`; the 10 `Alert.alert` calls (Me, My players Remove, Register) are gone. Account deleted shows its notice, then OK goes to sign-in |
| A12 Tag / Chip | Paper `Chip` only where it is tappable (filters, choices); a status is a `Tag`. The Past results Restore chip is an outlined button; the chosen custom initials are a `Tag` |
| A13 toasts | `components/ui/Toast.tsx`: 3 s, 4 s with Undo, `aboveBar` lifts it over a bottom bar. Remove from My players Undo is 4 s (it asks first now). The one exception: Delete result keeps its 10 s Undo (D9.1, it stands in for a confirm) |
| A15 radii | every `borderRadius` outside `theme.ts` is a `radius.*` token; circles and pills are `radius.full` |
| A16 status tag placement | Complete page: type · players · status tags left to right, the date as the caption under them |
| A17 `contained-tonal` | gone; `AppButton` accepts `contained` / `outlined` / `text` only (tsc enforces). Former tonal buttons are outlined, or contained where they were the one action (Look up, the current round in Edit round) |
| A19 empty states | `EmptyState` for "No results yet" and "No entries yet" |
| A20 header order | share · help · menu everywhere; `ResultsShare` now renders the saved result's ⋮ too, so one `headerRight` source (the old second one raced it) |
| A21 labels | `ADD_NEW_PLAYERS = 'Add by initials'`, `FIND_IN_DATABASE = 'Find in database'` on the tiles, the New game buttons, the two screen titles and in Help (`constants/help.ts`) |
| Q13.25 | `docs/pool-design.md` §0 row 17 + F13.23: the 50 / 50 even split is a deliberate exception to "the winner gets the most", never greyed; pinned in `tests/pool-pr13.test.ts` 13.5c |

Tests: `tests/design-tokens.test.ts` (DC15-1 and source checks for A04 A07 A12 A13 A16 A19 A20 A21). Flows: `smoke/08`,
`09`, `16`, `19`, `full/32`, `50`, `chaos/c03` use the new labels; `full/41` goes through the share sheet.

## 0. Method

- Every smoke screenshot (≈ 60, portrait and landscape, 4 and 20 players, Points and Pool) read side by side.
- Code counts for the element families: 72 `contained` / 63 `outlined` / 17 `text` / 9 `contained-tonal` button modes;
  Paper `Chip` in 8 files and our `Tag` in 8 files; Paper `Dialog` in 23 files, `NoticeDialog` in 2, native `Alert.alert`
  in 3; `Snackbar` durations 2.5 / 3 / 4 s; `borderRadius` 1, 2, 5, 6, 8, 9, 12, 13, 46, 999; `headerTitleAlign: 'left'`
  on 3 routes; share icons `share-variant` ×9, `link-variant`, `image`, `file-pdf-box`; dismiss labels Cancel ×13, OK ×6,
  Close ×5, Not now ×1, plus "Not yet" and "Back to scorecard" as buttons.
- "Good reason to differ" is recorded where it exists (section 2, last column), so the list is what to change, not
  everything that differs.

## 1. Ranked findings

Impact: **P1** a user reads the wrong meaning or hits a layout bug · **P2** the same element looks different and slows
recognition · **P3** polish / tokens.

| # | Impact | Finding (where) | Recommendation | Mockup |
| --- | --- | --- | --- | --- |
| A01 | **P1** | **Results page colours are inverted**: selected game cards are green, the "Results" tag in Past results is yellow. The rule everywhere else (Home, shares, PDFs, PR 13) is games yellow / results green. | Selected cards pale yellow with a yellow rule; "Results" tag and Past results card green; only the ON filter chip green (control state). | `A01-results-colours.png` |
| A08 | **P1** | **My players action tiles sit under the tab bar** (Add new / Find / Unregistered cut off by Home / initials). Bottom bars have three shapes: Home pills, Complete "Not yet / Complete game", New game disabled grey pill. | One `ActionBar` component: ≤ 2 actions, primary filled on the right, disabled primary says why in its label, always above the tab bar with its own inset. | `A08-bottom-bars.png` |
| A11 | **P1** | Game-number square is **blue on Home for Active games**, yellow in the Results picker and elsewhere. | Yellow on every list; status lives in the tag, never in the square. | `A11-game-label-colour.png` |
| A03 | **P1** | **Player IDs in three formats**: "Player ID 1" chips (My players), "#1" (Complete, Results legend), "#ID" in placeholders. | "#1" everywhere a player is listed; the words "Player ID" only where the concept is explained (Me, Find player, Link to Player ID). | `A03-player-id-format.png` |
| A05 | **P1** | **Dismiss / confirm wording**: Not yet · Cancel · Not now · Close · OK · Done · Back to scorecard. | Cancel on every confirm; Not now only when the other button leaves the screen; the confirming verb repeats the title; destructive verbs red; page returns are the header arrow only. | `A05-dismiss-wording.png` |
| A02 | **P2** | **Screen titles in four patterns**: "Complete S1", "Final scores · Game S16", "Awards · P1", "Scorecard" (left-aligned, the only one). | "Screen · S1" for every game screen, centred; the content keeps its own heading ("S1 · Round 7"). | `A02-screen-titles.png` |
| A04 | **P2** | **Share lives in three places**: header icon (saved result), two ⋮ items (scorecard: live link, final scores), two bottom buttons (Final scores page). | Header share icon on every shareable screen → one sheet: Live link · Final scores picture · Full details PDF (what applies). Bottom buttons stay only on Final scores (its purpose). | (text; H/F11.3) |
| A06 | **P2** | **Dates in three formats**: "Sat, Nov 14 · 7:49 PM", "Saved Sat, Nov 14 · 11:47 PM", "11:32 PM Friday, November 13" (Games in this result). | One `formatWhen`; prefix word allowed ("Saved"); year only when not this year. | `A06-date-formats.png` |
| A07 | **P2** | **Search fields**: grey pill "Search name or player ID" (My players), pale-yellow pill "Search name, initials or #ID" with two icon buttons inside (New game), outlined field (Find player). | One `SearchField`, one placeholder, white with the standard border; filter icons in the row below. | `A07-search-fields.png` |
| A09 | **P2** | **Dialogs of three kinds**: Paper `Dialog` (23), `NoticeDialog` (2), native `Alert.alert` (3 — different font, colours and button order on Android). | Paper only, through `NoticeDialog` / `ConfirmDialog`; delete the `Alert.alert` calls. | (text) |
| A10 | **P2** | **Section headings**: UPPERCASE letter-spaced on the saved result page (SCORES, GAME BY GAME); sentence case cards everywhere else. | Sentence case card titles everywhere. | `A10-section-headings.png` |
| A12 | **P2** | **Status chips**: Paper `Chip` for status in some lists, our `Tag` in others (different height, radius, font). | `Tag` for status / roles; Paper `Chip` only for filters (Completed / Closed / Active, Frequent / Alphabetical). | (text) |
| A13 | **P2** | **Toast durations** 2.5 / 3 / 4 s; some toasts have Undo, some do not, placement varies with the bottom bar. | 3 s; 4 s with an Undo; one `Toast` helper that knows the bar height. | (text) |
| A14 | **P2** | **Avatars**: coloured initials circles in My players, New game, Complete, Awards — none on the scorecard header or the Results table. | Keep: density. The header and table are about numbers; initials text is the avatar there. Record as a deliberate difference. | — |
| A15 | **P3** | **Radii** 1, 2, 5, 6, 8, 9, 12, 13, 46, 999. | Tokens: card 14 · pill 22 · tag 7 · input 8 · cell 6. | `A00-tokens.png` |
| A16 | **P3** | **Status tag placement**: Complete page puts "● Active" top-left and the date top-right; the scorecard puts it in the strip; Home in the card row. | Strip pattern (tags left to right, date in the title) on every game screen. | (text) |
| A17 | **P3** | **Button mode `contained-tonal`** (9 uses: "Share final scores" on Complete, some sheet buttons) is a third weight nobody can name. | Two weights only: filled primary, outlined secondary, plus text in dialogs. | (text) |
| A18 | **P3** | **Share icons** differ by target (link, image, PDF, generic). | Keep: they mean different things. Same placement (A04). | — |
| A19 | **P3** | **Empty states**: "None yet." plain text in Past results; `EmptyState` component with icon elsewhere. | `EmptyState` everywhere. | (text) |
| A20 | **P3** | **Header icon order**: share · help · menu on the scorecard; help only on most; share · help on the saved result. | Right side always: share (if any) · help · menu (if any). | `A02-screen-titles.png` |
| A21 | **P3** | **Search placeholder "Player ID" vs "#ID"** and "Add new players" / "From database" / "Find player in database" (also flagged as F11.2 in the Help spec). | "Add by initials" / "Find in database" everywhere; "#ID" in placeholders once A03 lands. | (text) |

## 2. Deliberate differences (kept)

| Element | Where it differs | Reason |
| --- | --- | --- |
| Scorecard title left-aligned → centred | A02 proposes centred | the Scorecard's left title was for the long "S1 · Round 7"; that string moves into the content strip, so the header can be centred like every other screen |
| No avatars in header / results table | A14 | density; initials are the avatar |
| Share icons by target | A18 | meaning |
| Green ON filter chip on Results | A01 | control state, not a "result" colour |
| Final scores keeps two bottom share buttons | A04 | the screen exists to share |
| Game type Back button (not header arrow only) | A05 | it keeps the picked players; the header arrow would too, but a visible Back pairs with Start |

## 3. Tokens and components to pin (A00)

`theme.ts`: radii (card 14, pill 22, tag 7, input 8, cell 6); colour roles (game yellow, result/success green, info/re-entry
blue, danger red, count/multiplier black); `Tag` vs `Chip` rule; `AppButton` with two weights + text; `NoticeDialog` /
`ConfirmDialog`; `Toast`; `formatWhen`; `#ID`; `SearchField`; `ActionBar`; header icon order. A unit test greps for raw
`Alert.alert`, `contained-tonal`, ad-hoc `borderRadius` numbers and `Chip` used for status.

## 4. Timing recommendation (answers the earlier "separate design PR?" question)

Yes, a separate PR — in two halves, not one:

- **PR 15a (before go-live, right after PR 13, no migration, screen-only edits):** the P1 items
  A01, A08, A11, A03, A05 and the cheap P2 A02, A06, A10. These change meaning or hide buttons; the Help screenshots
  (PR 11) should be taken after them so they do not go stale at once.
- **PR 15b (after PR 11 and PR 14 build):** A04 share sheet, A07 `SearchField`, A09 dialogs, A12 `Tag`/`Chip`, A13 `Toast`,
  A16, A17, A19, A20, A21 and the token test (A15). Mechanical, low risk, best done when no other PR is touching the same
  screens.
- Not in PR 15: anything that changes a flow (those are questions in the Help spec, F11.x) and the Pool / Multiplier work.

Order of the whole stack as recommended: PR 13 (built, CI) → PR 15a → PR 14 build → PR 11 build → PR 15b → PR 12
Tutorial → PR 16 test plan execution.

## 5. Questions for Sree (recommended answer first)

- **Q15.1** Agree A01 is a bug, not a style choice (green selected games)? Recommended: yes, fix in 15a.
- **Q15.2** Yellow game square on Home for Active games too (A11)? Recommended: yes; status is the tag.
- **Q15.3** "#1" as the one ID format (A03), with "Player ID" only where explained? Recommended: yes.
- **Q15.4** Dismiss wording rule (A05): Cancel everywhere; "Not now" only for suggestions? Recommended: yes.
- **Q15.5** Titles "Screen · S1", centred, including Scorecard (A02)? Recommended: yes.
- **Q15.6** One share sheet from a header icon (A04) — or keep ⋮ items? Recommended: the sheet (15b).
- **Q15.7** Two button weights only, drop `contained-tonal` (A17)? Recommended: yes.
- **Q15.8** Split 15a / 15b as in section 4? Recommended: yes; 15a before go-live.
- **Q15.9** Should 15a also take the three tiny Help-spec items (Q11.12 "Game settings · locked", Q11.14 Awards primary
  "Add to Results", Q11.18 Back on Add new players)? Recommended: yes, same screens, same day.
- **Q15.10** Keep the avatars off the scorecard header and results table (A14)? Recommended: yes.
- **Q15.11** Pin tokens with a grep test (section 3) so drift is caught in CI? Recommended: yes.
- **Q15.12** Anything on this list you consider a deliberate difference that should stay? (Section 2 is my list.)

## 6. Tests (codes for `docs/testing-strategy.md`, PR 15 block)

| # | Kind | What it proves |
| --- | --- | --- |
| DC15-1 | U | No `Alert.alert`, no `contained-tonal`, no raw `borderRadius` numbers outside `theme.ts`, no Paper `Chip` for status |
| DC15-2 | U | Every stack route title matches `^[A-Z][a-z ·]+( · [SP]\d+)?$`; `headerTitleAlign` unset everywhere |
| DC15-3 | U | `formatWhen` is the only date formatter imported by screens; "#" + id is the only ID rendering helper |
| DC15-4 | U | Results picker selected-card colours come from the game tokens; "Results" tag from the result tokens (hex apart, like the share test) |
| DC15-5 | S | My players: the three tiles and the tab bar both fully visible (layout gate: tile and bar on screen together); Results picker screenshot |
| DC15-6 | N | Screenshot diff of 12 key screens against the approved set (first visual-regression job; see PR 16) |
