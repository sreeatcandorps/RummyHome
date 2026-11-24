---
name: screenshot-matrix
description: Use when an EZ Score PR changes the UI and needs its screenshot matrix, a before/after comparison, or the CI video of the changed flow, before it is called done (D45, D82).
---

# Screenshot matrix and before / after

A UI PR is not done until its body has the matrix (0 / 1 / 5 rounds × 4 / 13 players × portrait / landscape,
D45) and a *Try it* link Sree can open on his phone (D82).

1. **Flows first.** Add or update the Maestro flow in `rummy-home3/e2e/` for every screen you changed, with a
   `takeScreenshot` at each state the matrix needs. Re-pin any test id you renamed (search `e2e/` for it).
2. **Let CI take the pictures.** Push; the device job saves the frames, and on a PR it keeps the video of every
   selected flow (`VIDEO_SELECTED=1`). Fetch them with
   `gh run download <run-id> -n ui-<branch-with-slashes-as-dashes>-pixel6-smoke`; frames are under
   `smoke/screens/`.
3. **Before / after.** Download the same artifact from a recent run of `main`'s code (any PR run based on
   current `main` has one; `main` pushes of docs skip the device jobs) and run
   `python3 rummy-home3/scripts/compare-frames.py --before <dir> --after <dir> --out <dir> name:file.png:Title …`
   (needs `pip install pillow`). It writes one side-by-side PNG per screen, today on the left.
4. **Publish them so they last.** Commit the side-by-sides under `rummy-home3/docs/` (the PR's own folder) and
   link them by raw URL (`show-then-build` skill, step 4). Dashboard links are fine as extras; the CI
   dashboard prunes old runs.
5. **Fill the body.** The matrix table in the PR template, the *Try it* line pointing at the before / after or
   the video, and any cell you could not fill said plainly (with why), never left blank.
