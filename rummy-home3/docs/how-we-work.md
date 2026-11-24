# How we work

*Last updated Nov 23, 2026, 10:10 PM PT.* The plain-words version of the rules in `AGENTS.md` and
`decisions.md`. If this page and `AGENTS.md` ever disagree, `AGENTS.md` wins, and the builder fixes this page.
What is next, and what needs Sree today, is not on this page: it is the first five lines of
[`next-up.md`](next-up.md).

---

## Who is who, and where to talk

| Who | What they do |
| --- | --- |
| **Sree** | Decides. Says yes or no. |
| **Build Bot** (Grok, on the phone) | **The one place Sree talks.** Passes Sree's words to the builders exactly as said, adds nothing (D08). Does the merges, builds and live changes Sree said yes to, and the pre-approved merges (D80). Shows Sree the pictures and PRs. |
| **App builder** (Claude in Cursor) | The app's screens, the e-mails, the staging database. |
| **Process builder** (Claude in Cursor) | How we work, CI and tests, publishing the share site. |

**Cursor or Grok?** Talk in Build Bot; it works on the phone. Open Cursor only to look at something more
closely on a computer. If Sree does decide something in Cursor, the builder writes it into `decisions.md` and
`next-up.md` in the same turn, so Build Bot sees it there. Either way nothing is lost, but one decision should be
said in one place.

**Where things are written down** (the shared memory both bots read):

| File | What it says |
| --- | --- |
| this page | the rules, and who does what |
| [`next-up.md`](next-up.md) | its first five lines: what needs Sree today, what shipped, what is in progress; below that, the ordered list |
| [`decisions.md`](decisions.md) | everything Sree decided (D-numbers) and the open questions (Q-numbers) |
| a PR | one feature; it opens with five lines "For Sree": decide · a user will notice · try it · risk · after merge |

**How a message travels:** Sree → Build Bot (word for word) → builder → a PR or a commit, plus `next-up.md`
updated → Build Bot reads the top of `next-up.md` on `main` and tells Sree. Before answering "what's the status",
Build Bot reads this page and the first five lines of `next-up.md`.

---

## The rules

### Happens without asking Sree

- Builders open and update PRs, run CI, and write specs, mockups and tests.
- **Staging** (the test copy of the database, `ezscore-staging`): seed it, wipe it, and apply migrations to it
  after the local database tests pass (D79). It stays on Supabase's free plan, at half size (D86).
- Builders close or combine their own outdated PRs (D79).
- **Build Bot merges a PR without asking** (Sree, Nov 23: "Yes, merge qualifying green PRs without asking me") when **all** of these are true (D80):
  CI is green · no migration for the live database · nothing changes under `public/` (the share site) ·
  it is docs / tests / CI only, **or** it builds a design Sree approved (named by its D-number) with its screenshots.
- The share site publishes itself after each merge that changes it, once the two secrets are in (D83).

### Needs Sree's yes, every time

- Merging anything that changes the **share site pages** (`public/`): it goes live at once (D80, D83).
- Merging a PR that changes **these rules** (`AGENTS.md`, `.cursor/rules/`) (D80).
- Applying a migration to the **live** database (D44).
- Building **any APK** (staging or production) or uploading to Play (D44, D79).
- Changing a **live setting users see**, such as the e-mail sender name (D79: "anything users see").
- Closing Sree's issues.

A yes counts only for that exact action. "Go ahead" on a different question, or silence, is not a yes.

### How the work is done

- **At most three open PRs** (D81). A *parked* PR stays open for discussion, gets no code and does not count:
  #112 iPhone (until Apple enrolment), #124 WhatsApp sign-in (until the Android app is approved).
- **Small fixes are collected** into one batch PR, not one PR each.
- **Show, then build:** a mockup before code for anything on a screen.
- **Every UI PR** has screenshots (D45) and, on its CI run, a video of the flows it changed (D82).
- **A bug is fixed** only when a test proves it, and for the share site when the live page is checked (D83).
- **Keep it simple** (D50). **v1 is cut** (D84): Telugu, phone / WhatsApp sign-in and extra tutorials come
  after the app is live in Play.
- `main` is the product; every PR starts from it (D43). The full test suite runs on `main` every night (D07).
