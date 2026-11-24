# Agent Guidelines

This file provides guidance for AI agents working on the EZ Score codebase (app in `rummy-home3/`).

## Required reading

Before suggesting a design, writing a spec, or building any UI change:

- **[Design review checklist](rummy-home3/docs/design-review-checklist.md)** — mandatory, approved by Sree (Nov 17 2026). Its seven items are also the checkboxes in the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
- **[Decisions](rummy-home3/docs/decisions.md)** — one dated line per decision Sree made, with status (active / superseded / deferred). Read the section for your area first. Add a line in the same PR whenever a decision is made or overturned.
- The spec for the area: `rummy-home3/docs/pool-design.md` (§0 is the decision table), `help-design.md`, `seating-order-design.md`, `multiplier-design.md`, `design-audit.md`, and `architecture-and-timeline.md` for how the pieces fit.

## Branching and PRs

- `main` is the product. Every branch starts from `main`; a stack is at most two PRs deep and short-lived.
- One PR per feature, opened with the PR template. **A PR that changes what a user sees starts with two documents (D85): the spec (`docs/<area>/<name>-design.md`) and the flows (`docs/<area>/flows.md`: an architecture diagram and one flowchart per flow, Mermaid), linked with full URLs in the first lines of the body and rendered inline.** A UI PR is not done until its **screenshot matrix** (0 / 1 / 5 rounds × 4 / 13 players × portrait / landscape) is in the body.
- **Small things are batched, never one PR each** (Sree, Nov 21: "Don't make every little thing a PR. When I give you little things, combine all of them into one PR"). Every small fix, copy change or one-screen tweak goes on the **Small fixes batch** list in `rummy-home3/docs/next-up.md` with its diagnosis and, when it has a screen, a mockup; the batch is built as **one** PR when Sree says so. Open a PR of its own only for a feature, a migration, a plan / mockup document, or a live-user bug Sree asks to ship alone.
- Run `npm run typecheck` and `npm test` in `rummy-home3/` before pushing; update the Maestro flows in `rummy-home3/e2e/` that your change breaks.
- Update `rummy-home3/docs/architecture-and-timeline.md` when tooling, distribution or a major module changes (see `.cursor/rules/architecture-timeline.mdc`).

## Authority (what needs Sree's explicit yes)

| Action | Who may do it |
| --- | --- |
| Open or update a PR, push a branch, run CI | any agent |
| Merge to `main` | only after Sree says yes to **that** merge |
| Apply a migration to the live Supabase project | only after Sree says yes to **that** migration, and only from merged `main` after the local-DB CI suite passed |
| Build or publish an APK / store build | only after Sree says yes to **that** build |

"Finish it", "go ahead" on a different question, or silence is **not** a yes. When in doubt, ask one question with a default and wait.

## Design principles (Sree, Nov 19 2026 — D50)

- **Keep it simple.** "We have to keep this app simple and not complicate it. A lot of times, people just play the game, do the results, and then they send it to each other, and it's done. No one cares about having a super accurate history … I don't want to over-engineer it."
- In practice: when options differ in bookkeeping, pick the one with the fewest states and dialogs. A warning beats a refusal. A saved result is a snapshot, not a ledger; it never changes, and a stale one is simply marked (D49). Add history or audit detail only when a real case from use asks for it.

## Talking to Sree

- Build Bot relays Sree word for word and adds nothing. The builder asks its own questions, few, each with the default it will use if there is no answer.
- Quote Sree's words in the spec or PR body beside the interpretation, so a misread is visible.
- Show, then build: a mockup or flowchart before code for anything a user will see.
