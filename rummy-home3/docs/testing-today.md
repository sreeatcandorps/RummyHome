# How we test today, and what it costs (for Sree, Nov 25)

> Sree, Nov 25: "Are you sure that the testing part should also be counted and only three should run? … Can you make
> sure this testing is optimized for efficiency, speed, but then also thoroughness? … maybe it's becoming too costly
> for us."

## The short answer

- **Testing is not one of the three.** "Three build PRs" counts pull requests that change the app (D96). Tests run
  on their own on every PR and never take a slot. Docs-only PRs don't count either.
- **It costs no money.** The repository is public and the tests run on GitHub's standard machines, which are free
  for public repositories. The real costs are **time** (an app PR waits about an hour for its phone tests after every
  push) and **agent time** chasing a phone test that failed for a silly reason (#138's tap under the navigation bar).
- **It can be faster without testing less.** About a third of the phone-test time is the same 25 checks run twice.
  The plan below targets **about 25 minutes per app PR instead of about 60**, and keeps everything in the nightly run.

## What runs today

| When | What | How long | Blocks the merge? |
| --- | --- | --- | --- |
| Every push, every PR | 678 unit tests + typecheck, 43 database test files on a local copy of the database | 2–3 min | yes |
| Docs-only PR | nothing more | — | — |
| App PR | the **smoke** set (25 everyday screens, on an emulated Pixel 6), plus, when the change touches that area, the **full** set (deeper flows), **roles** (who can see / edit what), **chaos** (bad network, killed app), **two phones** at once and a **monkey** (random taps). Up to six emulators at once. | ~50–60 min | yes |
| Every night on `main` | everything above on the Pixel 6, smoke on three more devices (small phone, big phone, tablet) | ~90 min | a red night means no APK |
| Before an APK | every suite on every device, the 20,000-tap monkey, the volume test | a few hours | yes, for that APK |

Recent examples: #144 (docs) finished in 2 minutes; #143 (Settle removed) ran six phone jobs, the longest 47 minutes,
about an hour from push to green.

## What is wasteful, and the fix

| Today | Fix | Saves |
| --- | --- | --- |
| The **full** job first re-runs all 25 smoke checks (its deeper flows need what smoke leaves behind), on a second emulator, in parallel with the smoke job doing the same 25. | Run the deeper flows **in the smoke job, right after smoke**, on the same emulator. One run of the 25, not two. | ~45 emulator-minutes per app PR |
| The 25 smoke checks run one after another on one emulator (~40 min). | Split them across **two emulators**, each starting from the same seeded data (checks that depend on an earlier one stay together). | ~20 min of waiting per app PR |
| A check that signs in as another test person and then fails leaves that person signed in, so the next seven checks fail too (#138, Nov 25). | Every check starts by making sure the right person is signed in. | a red run shows 1 failure, not 8; less agent time |
| Roles, chaos and two-phone run on many app PRs. | Run them on a PR only when it touches sign-in, permissions, sync or the database; otherwise nightly. | ~3 emulators on most app PRs |
| A rebase that changes only docs re-runs every phone test. | Skip the phone tests when nothing outside `docs/` changed since the last green run. | a full hour on each such rebase |

**Thoroughness stays the same**: every check still runs every night and before every APK; a PR can only be faster,
never hide a failure for more than a night (that rule is already in `ci/select-tests.mjs`).

## Who does it

A Sonnet 5.5 test helper (D92), as one CI PR, started Nov 25 at 9:20 PM PT (Sree: build through the night, D115).
Batch 2 (#131) changes the same CI files, so whichever merges second rebases. Proof in the PR: two app-PR
runs, before and after, with their times.

Detail (tiers, devices, every flow): [`test-plan/automation.md`](test-plan/automation.md),
[`test-plan/devices.md`](test-plan/devices.md), [`test-plan/flows.md`](test-plan/flows.md).
