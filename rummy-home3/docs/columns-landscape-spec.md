# Scorecard columns and landscape: spec for one PR (Nov 24)

Revises `design-review-2.md` §8.8 and §8.9 with Sree's Nov 24 answers. It ships as **one PR of its own**, built by
a new agent after batch 2 (#131) merges. **Nothing is built until Sree OKs this page (Q37) and picks the model
(Q38).** Decisions: D89 (landscape), D90 (columns).

## 0. What Sree said

> "Landscape is view-only. Then you shouldn't even have the menu there, right? … You don't have to put 'view-only.'
> Just remove that. Keep it simple: landscape is landscape, no buttons, nothing, no three dots, just to see the
> scorecard. I think adding scores doesn't require landscape. A lot of the others don't require landscape. I want
> you to remember that."

> "Those can be reused for probably a tablet mode in the future, so don't delete all that code. Just park it …
> Definitely create a separate PR."

> "I like the whole pinch-to-zoom … How about 5, 7, and then max? … I think it shouldn't say 'all.' It should say
> 5, 7, max, and then whatever the minimum size is, you allow that. … Let's start with 5 as the default. Yes, the
> scroll is good. You can keep the scroll bar if you want, but usually people are going to touch. Make sure the
> functionality is in place. They'll probably touch the header to move because they want to see the next player."

## 1. Pictures

| Picture | Shows |
| --- | --- |
| [scorecard-columns-nov24.png](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/main/rummy-home3/docs/design-review-2/mockups/scorecard-columns-nov24.png) | 5 by default · ⋮ › Columns **5 · 7 · Max** · Max on a Pixel 6 (8 columns) |
| [scorecard-landscape-nov24.png](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/main/rummy-home3/docs/design-review-2/mockups/scorecard-landscape-nov24.png) | Landscape: the table alone, about 10 rows |

Made by `design-review-2/mockups/make-scorecard-nov24-mockups.py`. The Nov 23 pictures (`scorecard-density.png`,
`scorecard-landscape.png`) are the old proposal; keep them for history.

## 2. Landscape: the scorecard and nothing else (D89)

When the scorecard screen is wider than tall:

- **Shown:** the score table, full screen: the names and totals row, the round column, the rounds. Live updates keep
  arriving. Sideways swipe and vertical scroll work as in portrait.
- **Not shown:** the header (back, title, Share, Help, ⋮), the tags row (number, type, players, status, multiplier,
  View only), the Actual toggle, the completed line and Give awards, the pool-over hint, the Undo / Add round /
  Complete bar, the game-ID footer. No "View only" tag: landscape *is* viewing.
- **Row tap does nothing.** No dialogs open from landscape.
- **To leave:** turn the phone upright. Android back still leaves the screen.
- Pool games: the table with its re-entry marks, as today (D42); no Standings.
- Phones and tablets alike for now (D47 stays: "sideways" means wider than tall).

**Park, do not delete:** today's landscape chrome (the compact header, the tags strip, the strip's Give awards, the
bottom bar in landscape) moves behind one switch, e.g. `const LANDSCAPE_EDITING = false` in `hooks/useLayout.ts`
or a `tabletMode` helper, with a comment naming the future tablet mode. Turning it on brings today's behaviour back,
which a unit test checks.

**Other screens:** Add round, New game, Players and the rest do not need landscape (Sree). This PR leaves their
behaviour as it is. Locking them upright needs `expo-screen-orientation`, a native module, so a new APK; that
is a later item, not this PR.

## 3. Portrait columns: 5 · 7 · Max (D90)

- **Default 5** player columns (on a Pixel 6, 67 dp wide with 18-pt digits). The round column is always pinned.
- **Pinch** on the table snaps to 5, 7 or Max; no in-between sizes.
- **Max** = as many columns as fit at the smallest readable width, today's `MIN_COLUMN_WIDTH` (38 dp, 13-pt digits):
  computed, not a fixed number. About 8 on a Pixel 6, 7 on a 360-dp phone, 9 or more on big phones.
  When 7 and Max would come out the same, the choice shows **5 · Max**.
- Fewer players than the choice: the columns share the width, as today.
- **⋮ › Columns 5 · 7 · Max**, a three-segment row in the menu, remembered on this phone for every game
  (AsyncStorage, the same as other local preferences). Pinch changes the same setting.
- **Moving sideways:** a swipe on the **names row** or on the **scores** moves both together. This already works:
  `ScoreTable`'s `headerPan` drags the names row and the body shares its offset. Keep it, with momentum, and add the
  flow test that proves it. The thin scroll bar stays.
- Share stays in the header; nothing else on the portrait screen changes.

Code: `utils/scorecardLayout.ts` `columnLayout` takes a `visible` cap (5, 7 or `max`); `ScoreTable` gets the pinch
handler, built on React Native's `PanResponder` with two touches as `headerPan` is (no new native module, so no
new dependency); the scorecard menu gets the row.

## 4. Tests

- **Unit (`tests/`):** column widths for 5 / 7 / Max at 360, 412 and 600 dp, and with 4 and 13 players; Max
  never below 38 dp; "5 · Max" when 7 equals Max; the park switch: off hides the landscape chrome, on restores it.
- **Maestro (`e2e/`):** the landscape flows (`setOrientation: LANDSCAPE`) assert that no Add round, Share or ⋮ is
  visible; a portrait flow opens ⋮ › Columns › Max and back to 5; a flow swipes the names row and sees the 6th
  player. Update the flows that tap the bar or menu in landscape.
- **PR body:** the screenshot matrix (0 / 1 / 5 rounds × 4 / 13 players × portrait / landscape) with raw links
  (D87) and the 30-second video (D82).

## 5. Order

After #131 merges, a new agent, on the model Sree picks (Q38), cuts `cursor/scorecard-columns-landscape-…` from
`main`. It is one PR with no migration. It merges on Sree's yes (it builds an approved spec, so D80 applies once
Q37 is a yes and CI is green).
