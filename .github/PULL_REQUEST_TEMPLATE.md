<!-- Keep every section. Delete the hints in parentheses, not the headings. -->

## For Sree

- **Decide:** (the one question for Sree, with the default taken if he does not answer — or "nothing, merge is pre-approved (D80)")
- **A user will notice:** (one sentence, or "nothing — docs / tests / CI")
- **Try it:** (link to the CI video of the changed screen from the dashboard comment, or why there is none)
- **Risk:** (what could break, and how it would show)
- **After merge:** (what happens next on its own — e.g. the share site republishes — and what still waits on Sree)

## Status

- Based on: `main` @ `<sha>` (or: stacked on #<nn>)
- Migration: none / `0NN_name.sql` written, **not applied** (migrations are applied only from merged `main`, after Sree's yes)
- Unit + tsc: pass / fail (paste the count)
- Device flows touched: (Maestro files changed, or "none")
- Bug fix proof: (the test that fails on the parent commit and passes here, or the CI video; "n/a" when no bug is fixed — D83)
- Decisions touched: (D-ids from `rummy-home3/docs/decisions.md` — every new or changed decision gets a line there in this PR)

## What Sree asked for → what changed

| Sree said (verbatim or as relayed, with date) | Built as | Where |
| --- | --- | --- |
|  |  |  |

## Design review (mandatory for any UI change — `rummy-home3/docs/design-review-checklist.md`)

- [ ] 1. Read first: specs, `decisions.md`, pool-design §0, help-design, seating-order-design for this area
- [ ] 2. Both game types traced (Points and Pool); the change is mirrored or the difference is explained below
- [ ] 3. Navigation: every flow has an exit, Done goes Home, nothing loops back into a finished game
- [ ] 4. Edge cases checked: 0 / 1 / many rounds · 13–20 players · portrait and landscape · non-admin viewer · reopened game · offline · game already in a Result
- [ ] 5. The instruction was questioned: recommendation + what I would change about Sree's idea and why (below, or "none")
- [ ] 6. Conflicts flagged: approved decisions or specs this overturns are listed (with their D-ids) and marked superseded in `decisions.md`
- [ ] 7. Show, then build: mockups or flowcharts were shown before building (link), and the screenshot matrix below is filled in

### Screenshot matrix (every UI PR, before it is called done)

| | 4 players · portrait | 4 players · landscape | 13 players · portrait | 13 players · landscape |
| --- | --- | --- | --- | --- |
| 0 rounds |  |  |  |  |
| 1 round |  |  |  |  |
| 5 rounds |  |  |  |  |

(Attach images or link the CI device-run gallery. Write "n/a — not a UI change" for docs / server-only PRs.)

## Defaults used where Sree did not answer

(One line each: the question, the default taken, why.)

## Not in this PR

(Known follow-ups, conflicts with other open PRs, anything deliberately left out.)
