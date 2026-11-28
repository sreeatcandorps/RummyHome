# Small fixes batch 5 — pictures

One picture per item: before on the left, after on the right, the changed spot circled in red. "Before" is a real
CI frame except the live page (rendered from today's `public/scorecard.html` with sample data) and the help text
(today's words). "After" is drawn. Pictures only; nothing here is app code.

- `12l-undo.png` — Undo leaves the scorecard's bottom bar; after saving a round a note "Round 3 saved · Undo" shows for 5 seconds, then Undo is in the ⋮ menu.
- `12k-cut-labels.png` — Five labels that are cut off ("My pla…", "Give award…", "Scorecar…", "Ravi K…", "101 left · 5 / drops"), each next to the same spot shown in full.
- `12j-players-admins-title.png` — The Players · Admins title keeps the game name (S2) on a small phone, and its help names only the roles the screen shows (Creator, Admin, player).
- `8-live-page-footer.png` — The live score page people open from a shared link gets one line at the bottom, "Keep score like this — get EZ Score", which opens the Play Store.
- `176-players-admins.png` — Players · Admins becomes one plain list like Profile, and the arrows on every row become one "Order of players" row.
- `171-small-phone.png` — Four screens on a small phone with large text (Awards, Order of players, Home cards, Home sideways), each today next to the proposal (reused as drawn on that branch, so no red circles).
- `12o-keyboard.png` — New game: today the search result hides under the keyboard; after, the picked names fold into one row so the result sits under the search.

Sources: CI run 45878556049 (`main`, Nov 26: small phone and Pixel 6 frames), `docs/small-phone-360/` on
`cursor/small-phone-360-f877`, `players-admins-ci/` and `players-admins-s.png` on `cursor/players-admins-size-s-f877`,
`docs/small-fixes/12o/` on `cursor/docs-q60-redraw-f877`, and `docs/design-review-2/mockups/three-q2-undo.png`.
`make.py` redraws the sheets from those files (paths at the top of the script).
