# Agent Guidelines

This file provides guidance for AI agents working on the EZ Score codebase (app in `rummy-home3/`).

## Required reading

Before suggesting a design, writing a spec, or building any UI change:

- **[Design review checklist](rummy-home3/docs/design-review-checklist.md)** — mandatory, approved by Sree (Nov 17 2026). Its seven items are also the checkboxes in the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
- **[Decisions](rummy-home3/docs/decisions.md)** — one dated line per decision Sree made, with status (active / superseded / deferred). Read the section for your area first. Add a line in the same PR whenever a decision is made or overturned.
- The spec for the area: `rummy-home3/docs/pool-design.md` (§0 is the decision table), `help-design.md`, `seating-order-design.md`, `multiplier-design.md`, `design-audit.md`, and `architecture-and-timeline.md` for how the pieces fit.

## Branching and PRs

- `main` is the product. Every branch starts from `main`; a stack is at most two PRs deep and short-lived.
- **Procedures live in project skills** (`.cursor/skills/`); load the one that applies before you start:
  - `show-then-build`: anything a user will see. Mockup first, Sree's yes, then code; every picture opens on his phone without a Cursor login.
  - `screenshot-matrix`: a UI PR's matrix (0 / 1 / 5 rounds × 4 / 13 players × portrait / landscape, D45), the before / after and the CI video (D82).
  - `pr-write-up`: every PR. The five-line "For Sree" block (D82), Status, and Sree's words beside your reading.
  - `bug-proof`: every bug fix. A test that fails on the parent commit and passes on the PR; deployed things checked live (D83).
  - `small-fixes-batch`: small things are batched, never one PR each (Sree, Nov 21: "Don't make every little thing a PR").
- One PR per feature, opened with the PR template.
- **At most three open PRs at a time** (D81), plan and mockup PRs included. Before opening a fourth, get one merged or fold it into another. **Parked PRs do not count**: a PR Sree wants to keep discussing but not build yet has `Parked:` at the front of its title and a row under *Parked* in `docs/next-up.md`. Agents answer questions and update its spec or mockups when he asks; no app code is written on it until he says to un-park it. A PR made obsolete by a combined PR is closed the same day by the agent that opened it.
- Run `npm run typecheck` and `npm test` in `rummy-home3/` before pushing; update the Maestro flows in `rummy-home3/e2e/` that your change breaks.
- Update `rummy-home3/docs/architecture-and-timeline.md` when tooling, distribution or a major module changes (see `.cursor/rules/architecture-timeline.mdc`).

## Authority (what needs Sree's explicit yes)

| Action | Who may do it |
| --- | --- |
| Open or update a PR, push a branch, run CI | any agent |
| **Pre-approved (D79):** seed or wipe `ezscore-staging`; apply a migration to staging from a branch whose local-DB CI suite passed; rebase, combine, or close a superseded PR the agent opened | any agent, without asking; it is listed under *Shipped* in the next "For Sree" block |
| **Pre-approved merge (D80):** a PR to `main` with all of: CI green; no migration for the live project; nothing under `rummy-home3/public/` (that publishes itself, D83); and either docs / tests / CI only, or it builds a spec or mockup Sree approved, cited by its D-id, with the screenshot matrix filled. Never a PR that changes this table or the rules that grant it (`AGENTS.md`, `.cursor/rules/`): those always need Sree's yes | Build Bot merges, without asking; it is listed under *Shipped* |
| Merge any other PR to `main` | only after Sree says yes to **that** merge |
| Apply a migration to the live Supabase project | only after Sree says yes to **that** migration, and only from merged `main` after the local-DB CI suite passed |
| Build or publish an APK / store build (any EAS profile) | only after Sree says yes to **that** build |
| Close one of Sree's issues | only after Sree says yes |

"Finish it", "go ahead" on a different question, or silence is **not** a yes. When in doubt, ask one question with a default and wait. When a pre-approved action goes wrong (a seed fails, a merged PR turns `main` red), stop doing that kind of action, say so at the top of the "For Sree" block, and fix it first.

## Design principles (Sree, Nov 19 2026 — D50)

- **Keep it simple.** "We have to keep this app simple and not complicate it. A lot of times, people just play the game, do the results, and then they send it to each other, and it's done. No one cares about having a super accurate history … I don't want to over-engineer it."
- In practice: when options differ in bookkeeping, pick the one with the fewest states and dialogs. A warning beats a refusal. A saved result is a snapshot, not a ledger; it never changes, and a stale one is simply marked (D49). Add history or audit detail only when a real case from use asks for it.

## Agents and models (Sree, Nov 25 2026 — D92–D94)

- **Main agent**: the Claude Opus 5.5 agent Sree talks to through Build Bot. It keeps how we work, the docs and the board, runs the daily sweep, and starts a subagent (its own cloud machine, its own branch) for each piece of work, with the model below. It opens the subagent's PR and answers for it.
- **Models** (D92):

| Job | Model |
| --- | --- |
| Features and specs (the default) | Claude Opus 5.5 |
| Design (mockups, design reviews) and hard work: migrations, changes across many screens, a bug nobody has found | Claude Fable |
| Writing and fixing tests | Claude Sonnet 5.5 |
| Research and read-only checks | Grok 4.7 |

- **Daily sweep** (D93): once a day the Main agent reads every PR merged or opened since the last sweep, the open issues and the board, and brings `decisions.md`, `next-up.md`, `how-we-work.md` and `architecture-and-timeline.md` up to date in one docs PR. One owner, so nothing falls between two agents (D91).

## Talking to Sree

- Build Bot relays Sree word for word and adds nothing, and ends every message to Sree with the five *For Sree today* lines from the top of `docs/next-up.md` on `main` (D93). The builder asks its own questions, few, each with the default it will use if there is no answer.
- Quote Sree's words in the spec or PR body beside the interpretation, so a misread is visible.
- Show, then build (`show-then-build` skill): a picture before code for anything a user will see.
- **v1 is cut** (D84): Telugu, phone / WhatsApp sign-in and the extra step-by-step tutorials wait until the app is live in Play. Specs for them may sit as documents; nothing is built.
- Write the first five lines of anything Sree reads (a PR, `docs/next-up.md`) for Sree: plain sentences, no file paths, the question he must answer first.
