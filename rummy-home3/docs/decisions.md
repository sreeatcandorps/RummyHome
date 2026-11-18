# Decisions

The one place that says what Sree decided, when, and whether it still holds. One line per decision, newest
first inside each section. The detail (mockups, reasons, edge cases) stays in the spec the line points to;
this file exists so nobody has to read five specs and a chat log to know the current rule.

**How to use it**

- Before proposing or building anything, read the section for the area (design-review checklist item 1).
- When Sree decides something new, add a line **in the same PR** that builds it: date (PT), the decision in
  his words or as close as the relay allows, where it lands, status.
- Never delete a line. When a decision is overturned, set its status to `superseded → D<nn>` and add the new
  line. A reverted build still has a history.
- Status words: **active** · **superseded → D<nn>** · **deferred** (agreed, not built) · **withdrawn** (Sree
  took it back before a build).
- IDs are `D` + a running number and never change. Specs may still carry their own numbering
  (pool-design §0 rows, help-design Q11.x, design-audit A<nn>); the "Where" column links them.

## End of a game (Complete · Awards · Final screen · Done)

| ID | Date | Decision | Where | Status |
| --- | --- | --- | --- | --- |
| D40 | 2026-11-18 | **Done always goes Home.** On the Final screen the bar is **Share + Done**; Done is `navigate('/(tabs)')`. The header arrow returns to the completed scorecard. | `utils/endFlow.ts`, `games/final-scores.tsx`, PR A | active |
| D39 | 2026-11-18 | **Complete is one dialog on the scorecard.** The Complete page (Nov 6) is deleted. Points → Final screen; Pool → Awards → Final screen. A Points round that does not add to 0 gets "Fix round N first" + Edit round. | `components/game/CompleteGameDialog.tsx`, PR A | active (supersedes D06) |
| D38 | 2026-11-18 | **No Results nudge in the end flow.** No "Go to Results" / "Add to Results" on the scorecard, Awards or Final screen. Results is its own errand from Home. When one game is picked the button reads "Show results · 1 game" with a one-line note. | PR A; overturns help-design Q11.14 | active |
| D37 | 2026-11-18 | **A completed pool without awards is just "Completed".** No "Awards pending", no "No awards" state, no mixing of unawarded pools into results. The Results picker says "Give awards first" when such a pool is picked; that is the only place that asks. | `utils/pool.ts` `poolStatusLabel`, PR A | active |
| D36 | 2026-11-18 | **Awards page ends with Not now / Save awards** the first time (Cancel / Save changes when editing). Both go on to the Final screen when the page was opened from Complete, back to the caller otherwise. | `games/award.tsx`, PR A | active |
| D35 | 2026-11-18 | **Share on the Final screen = picture + full PDF only.** No "details as text". The PDF carries everything: awards, entries, pool scores, limit, outs and re-entries, every round, who ran the game; Points gets totals and ×N. | `utils/finalScoresSheet.ts` `pdfSections`, PR A | active |
| D34 | 2026-11-18 | **Info sheets close with Close; Done is only for ending a game.** Round saved sheet and the Exact points sheet say Close. | `score-entry.tsx`, `MultiplierStrip.tsx`, PR A | active |
| D06 | 2026-11-06 | Complete became a page with a second confirmation (Nov 6 phone test). | `games/complete.tsx` (deleted) | superseded → D39 |

## Pool scorecard layout

| ID | Date | Decision | Where | Status |
| --- | --- | --- | --- | --- |
| D42 | 2026-11-18 | **Landscape pool is the full-width table alone**, like Points. No Standings in landscape ("they can always come back to portrait"). An admin reaches Give / Change awards from the strip. | `games/[id].tsx`, PR B | active (supersedes D31) |
| D41 | 2026-11-18 | **Five-line rule for the portrait pool card.** Content = round rows (a placeholder row at 0 rounds) + one empty row + Creator / Admin / Unique game ID; the card hugs that content and stops at five round-row heights; the newest round sits at the bottom of the card; the Standings take the rest. At 0 rounds that is five lines. Empty row sits between the last round and the Creator line (Sree's 10:35 PM wording; default A). | `ScoreTable` `hugRows`, `utils/scorecardLayout.ts`, PR B | active (supersedes D30) |
| D31 | 2026-11-17 | Landscape pool: standings below the rounds in the table's scroller, never side by side. | pool-design §0 row 22 (PR 24) | superseded → D42 |
| D30 | 2026-11-17 | Portrait pool split ~70 / 30, each pane scrolling on its own. | pool-design §0 row 21 (PR 24) | superseded → D41 |
| D29 | 2026-11-17 | Footer (Creator · Admin · Unique game ID) inside the card under the last round, 70 % italic, never bold. | pool-design §0 row 23 (PR 24) | active |
| D28 | 2026-11-17 | Re-entry display: the re-entry round shows the re-entry score with ↺; cells above go grey; a tap on a round number edits that round. | pool-design §0 row 25 (PR 24) | active |
| D27 | 2026-11-17 | The pool header reads like the Points header, exactly one small line taller (#number). Initials never cut off. | pool-design §0 rows 15, 20 (PR 24) | active |

## Pool rules

| ID | Date | Decision | Where | Status |
| --- | --- | --- | --- | --- |
| D26 | 2026-11-17 | Re-entry settings grouped: Unlimited by default, Limited leaves the count empty; Re-entry score and Late entry = Highest score / Highest score + 1, default + 1. Server rule in migration 047 (applied to live by Build Bot, Nov 18). | pool-design §0 row 24 | active |
| D25 | 2026-11-17 | No "stake" anywhere the user reads; the money-free type is **Points**. | pool-design §0 row 18 | active |
| D24 | 2026-11-15 | 50 / 50 is a deliberate exception to "the lowest score gets the most". | pool-design §0 row 17 | active |
| D23 | 2026-11-14 | "Entry per drop left" stays, with a viability rule (greyed when the winner would not get strictly more). | pool-design §0 row 16 | active |
| D22 | 2026-11-14 | Awards may be saved even if they do not add up ("X points weren't given out. Save awards anyway?"). Never money. | pool-design §0 rows 9, 12 | active |
| D21 | 2026-11-14 | Results mix Points and Pool; a pool joins only once awarded; Closed only after the result. | pool-design §0 row 10 (reworded Nov 18, see D37/D38) | active |
| D20 | 2026-11-14 | Round entry allows more than one zero; a count above the Full count asks "Are you sure?" and is then allowed. | pool-design §0 row 6 | active |
| D19 | 2026-11-14 | Pool limits 101 · 201 · 251 · Custom (100 in, 101 out). Default drops 25 / 50 / 130. | pool-design §0 rows 2, 3 | active |
| D18 | 2026-11-14 | Multiplier principle: users enter actual points; the multiplier computes the shown total. | pool-design §0 row 7, multiplier-design.md | active |

## New game · seating · players

| ID | Date | Decision | Where | Status |
| --- | --- | --- | --- | --- |
| D17 | 2026-11-17 | New game is four steps (Players → Game type → Order of players → Co-admin → Start game); no seating pop-up after Start. | pool-design §0 rows 26, 27 (PR 24) | active (supersedes D16) |
| D16 | 2026-11-15 | Seating order pops up once after Start; ⋮ → Seating order mid-game; the dealer follows the order. | seating-order-design.md §0 (PR 21) | superseded → D17 |
| D15 | 2026-11-14 | New game is two screens: Players (Next) → Game type (Start). | pool-design §0 row 1 (PR 13) | superseded → D17 |
| D14 | 2026-11-13 | Initials rule widened; Add new players by initials rebuilt; one pair of labels everywhere: "Add by initials" / "Find in database". | design-audit.md A21, PR 6, PR 15b | active |

## Design system · navigation · sharing

| ID | Date | Decision | Where | Status |
| --- | --- | --- | --- | --- |
| D13 | 2026-11-17 | **Design review checklist** (7 items) is mandatory before any design, spec or UI build. | `docs/design-review-checklist.md`, `AGENTS.md` (PR #83) | active |
| D12 | 2026-11-15 | One share sheet from the header share icon (A04); Cancel on every confirm, the verb repeats the title, info sheets Close (A05); ActionBar ≤ 2 actions (A08). | design-audit.md (PR 15a / 15b) | active |
| D11 | 2026-11-14 | Games are yellow (Points and Pool alike), results are green. | pool-design §0 row 11 | active |
| D10 | 2026-11-13 | Results design (PR 8): single-game share never says Results; one game's picture is the standings card in the marigold frame. | results-design, `final-scores.tsx` | active |
| D09 | 2026-11-12 | Clubhouse green design system. | design-audit.md, PR 11 | active |

## Process

| ID | Date | Decision | Where | Status |
| --- | --- | --- | --- | --- |
| D45 | 2026-11-18 | **Every UI PR carries a screenshot matrix** (0 / 1 / 5 rounds × 4 / 13 players × portrait / landscape) in its body before it is called done. | `.github/PULL_REQUEST_TEMPLATE.md` | active |
| D44 | 2026-11-18 | **Authority.** Merging to `main`, applying a migration to the live project and building an APK each need Sree's explicit yes to that action. "Finish the migration" is not a yes. Agents open PRs; they do not merge them. | `AGENTS.md` | active |
| D43 | 2026-11-18 | **Trunk-based from here.** The 30-PR stack (#7 → #82) was merged to `main` (`9dc62f8`). Every PR and migration starts from `main`; stacks are short-lived. | architecture-and-timeline.md 2026-11-18 | active |
| D08 | 2026-11-18 | **Build Bot relays Sree word for word**; it makes no suggestions of its own. The builder agent asks its questions directly, each with a default. | this file, PR C | active |
| D07 | 2026-11-15 | Nightly CI on `main` (was: on the stack top). | `.github/workflows/nightly.yml` | active |

## Open (asked, not yet decided)

| ID | Date | Question | Default in use | Status |
| --- | --- | --- | --- | --- |
| D46 | 2026-11-18 | Reopen a pool that already has awards: should the Awards page warn "saved before the pool was reopened"? | nothing shown | deferred |
| D47 | 2026-11-18 | Tablets in landscape are not "short" (`isShort` is height-based), so they keep the portrait pool layout. Intended? | keep | deferred |
