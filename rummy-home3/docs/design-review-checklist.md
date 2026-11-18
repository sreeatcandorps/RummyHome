# Design review checklist

Approved by Sree, Nov 17 2026. Every agent or bot must follow this before suggesting a design, writing a spec, or building a UI change for EZ Score.

1. **Read first.** Read the relevant specs and approved decisions (docs/, decisions file, pool-design.md §0, help-design.md, seating-order-design.md) before proposing anything.
2. **Trace both game types.** Trace the current flow in code for both Points and Pool. Any change to one must be checked against, and usually mirrored in, the other.
3. **Navigation.** Every flow has a clear exit; Done goes to Home; no screen leaves the user stuck or loops back into a finished game.
4. **Edge cases.** Check 0, 1 and many rounds; 13 to 20 players; portrait and landscape; non-admin viewer; reopened game; offline; game already in a Result.
5. **Question the instruction.** Give a recommendation, plus what you would change about Sree's idea and why. Do not pass an instruction straight into a spec without testing it.
6. **Flag conflicts.** Name any approved decision or spec the proposal would overturn.
7. **Show, then build.** Show designs as images or flowcharts before building; keep questions to the few that only Sree can answer.
