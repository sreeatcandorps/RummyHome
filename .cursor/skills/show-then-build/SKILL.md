---
name: show-then-build
description: Use before designing, specifying or building anything a user of EZ Score will see (a screen, a dialog, an e-mail, a share page, a help topic). Mockup first, Sree's yes, then code; pictures he can open on his phone.
---

# Show, then build

Sree (Nov 23): "What is this Size S redesign? I can't even see it! How do I give you any information unless I
see it?" Nothing a user will see is built before Sree has seen a picture of it and said yes.

1. **Read first** (design-review checklist item 1): the area's section of `rummy-home3/docs/decisions.md`, then
   its spec (`pool-design.md` §0, `help-design.md`, `seating-order-design.md`, `multiplier-design.md`,
   `design-review-2.md`). An approved decision you would overturn is named, with its D-id, in the question.
2. **Small or not?** A copy change, one-screen tweak or bug under an hour goes on the batch list instead
   (`small-fixes-batch` skill). Anything else gets a mockup or spec PR of its own.
3. **Make the picture.** A mockup (the `make-*.py` scripts beside the design-review-2 mockups are the examples) or,
   for a change to an existing screen, today's screen beside the proposal. Trace both game types (Points and
   Pool) and the edge cases of checklist item 4; show the worst one (13–20 players, landscape) rather than the
   easy one.
4. **Put the picture where Sree can open it on his phone without a Cursor login:** commit the PNG under
   `rummy-home3/docs/` and link it as
   `https://raw.githubusercontent.com/sreeatcandorps/RummyHome/<branch>/rummy-home3/docs/<path>.png`
   (the repo is public, so Build Bot can show it too). A `cursor.com/agents/…/artifacts` link needs a login
   and the CI dashboard prunes old runs; neither may be the only link.
5. **Ask once**, in the PR's *Decide* line: the question in one sentence, your recommendation, and the default
   you will take if there is no answer. Quote Sree's words beside your reading of them.
6. **Build only on his yes to that picture.** Record the yes as a D-line in `decisions.md` in the build PR, and
   cite it; the D-id is what lets Build Bot merge the build without asking (D80).
7. **After the build**, show the real screen next to the approved mockup (`screenshot-matrix` skill). Any
   difference from the mockup is called out, not left for him to spot.
