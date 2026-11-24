---
name: small-fixes-batch
description: Use when Sree reports a small thing in EZ Score (a bug under an hour, copy, a one-screen layout, an icon, a plural). It goes on the batch list in next-up.md, not into its own PR.
---

# Small fixes batch

Sree (Nov 21): "Don't make every little thing a PR. When I give you little things, combine all of them into one
PR." Small items are collected, diagnosed and mocked up at once, and built together when he says build.

1. **Is it small?** Under an hour, one screen, no migration, no new decision beyond the fix itself. A feature, a
   migration, a plan or mockup document, or a live-user bug Sree asks to ship alone gets its own PR instead.
2. **Add a row** to the *Small fixes batch* table in `rummy-home3/docs/next-up.md`: priority, the item, what Sree
   said (his words), the diagnosis (file and cause, not a guess), the fix, and a picture when it has a screen
   (`show-then-build` skill, step 4, for where the picture lives).
3. **Diagnose now, code later.** Reproduce it (a failing test or a CI frame) and write the diagnosis the same
   turn; write no app code until the batch is approved.
4. **When Sree says build**, one PR holds every approved row, one commit per row, each with its proof
   (`bug-proof` skill). Rows still waiting on his pick stay in the table for the next batch.
5. **After merge**, move the built rows to *Done recently*.
