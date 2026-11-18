# Design review checklist

Approved by Sree, Nov 17 2026. Every agent or bot must follow this before suggesting a design, writing a spec, or building a UI change for EZ Score.

1. **Read first.** Read the relevant specs and approved decisions ([`decisions.md`](decisions.md) for the area, then pool-design.md §0, help-design.md, seating-order-design.md, multiplier-design.md, design-audit.md) before proposing anything.
2. **Trace both game types.** Trace the current flow in code for both Points and Pool. Any change to one must be checked against, and usually mirrored in, the other.
3. **Navigation.** Every flow has a clear exit; Done goes to Home; no screen leaves the user stuck or loops back into a finished game.
4. **Edge cases.** Check 0, 1 and many rounds; 13 to 20 players; portrait and landscape; non-admin viewer; reopened game; offline; game already in a Result.
5. **Question the instruction.** Give a recommendation, plus what you would change about Sree's idea and why. Do not pass an instruction straight into a spec without testing it.
6. **Flag conflicts.** Name any approved decision or spec the proposal would overturn.
7. **Show, then build.** Show designs as images or flowcharts before building; keep questions to the few that only Sree can answer.

## How it is enforced

- The seven items are checkboxes in the repository's [PR template](../../.github/PULL_REQUEST_TEMPLATE.md); a UI PR also carries the **screenshot matrix** (0 / 1 / 5 rounds × 4 / 13 players × portrait / landscape) before it is called done.
- A decision made or overturned while building gets a line in [`decisions.md`](decisions.md) in the same PR (item 6 is not done until the old line reads `superseded`).
- Who may merge, apply a migration or build an APK is in the root [`AGENTS.md`](../../AGENTS.md): each needs Sree's explicit yes to that action.
