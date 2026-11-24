---
name: bug-proof
description: Use when fixing a bug in EZ Score, before calling it fixed. The fix PR names a test that fails on the parent commit and passes on the PR; deployed things are fixed only when checked live (D83).
---

# Bug proof

Sree (Nov 23): "Make the agent prove a bug is fixed with a test that would have caught it before calling it
done." A bug is fixed when a test proves it, and for something deployed, when the live thing is checked.

1. **Write the test first** where the bug lives: a unit test in `rummy-home3/tests/`, a local-DB test for SQL
   and RLS, or a Maestro flow in `rummy-home3/e2e/` for a screen. It asserts what Sree expected, in his terms.
2. **Watch it fail on the parent commit:** `git stash` (or check out the parent), run the one test
   (`node --import tsx --test tests/<file>.test.ts` in `rummy-home3/`, or the flow through CI with `FLOW_FILTER`), see it
   fail for the right reason, then restore the fix and see it pass.
3. **When no automated test can see it** (a one-frame flicker, a device-only glitch), keep the CI video of the
   flow on the PR and link the frame where the bug would show.
4. **Write it down** in the PR's *Bug fix proof* line: the test name, "fails on `<parent sha>`, passes here",
   or the video link.
5. **Deployed things:** the share site is fixed when `scripts/verify-site.mjs` passes against the live site
   after the publish run; a migration when the live check query after Sree's yes returns what the test expects.
   Until then the item stays *In flight*, not *Done*.
