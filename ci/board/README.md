# Board sync

The project board ([users/sreeatcandorps/projects/1](https://github.com/users/sreeatcandorps/projects/1)) updates itself from the PRs and issues. Workflow: `.github/workflows/board-sync.yml` · rules: `rules.mjs` (tested by `rules.test.mjs`) · code: `sync.mjs`.

## Rules (Status field: Spec · Waiting on Sree · Building · Ready to test · Done)

| Event | Build PR | Spec / docs-only PR* | Issue |
| --- | --- | --- | --- |
| Opened / reopened / ready for review / new push | Building | Spec | opened: `found-by-tests` or `bug` → Building, else Spec |
| Every check green on the head commit | Ready to test | Waiting on Sree | — |
| A check red, or still running | Building | Spec | — |
| Label `waiting-on-sree` added | Waiting on Sree | Waiting on Sree | Waiting on Sree |
| Label removed | recomputed from the rows above | | |
| Spec approved by Sree (label `approved`, or Status row `\| Approved \| yes … \|`) | — | **Done** (the build is its own PR) | — |
| Merged or closed | Done (closed unmerged: Note "Closed without merge") | Done | closed → Done |
| Draft | Building | Spec | — |

\* a PR is "spec" when it has label `spec` or `docs`, or its title starts "Spec" / "PR N spec", or says "docs only". The board-sync check itself is ignored when judging "green". A spec PR lands in Waiting on Sree only while he still has questions to answer; once approved (label `approved` or the `| Approved | yes |` row) it is Done. Not on the board yet → added. Every 2 hours (and on Actions › Board sync › Run workflow) every open PR / issue and every card is reconciled, so anything missed heals itself.

Optional **Note** text field (create it on the board if wanted): "In APK v11" / "Not in APK v11", read from the PR body's Status block row `| In [APK vN] … | yes / no |`.

## Token — 2 minutes on a PC (Sree)

1. GitHub → click your photo (top right) → **Settings** → **Developer settings** (bottom of the left list) → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
2. Note: `RummyHome board sync`. Expiration: **No expiration** (or 1 year; put a reminder).
3. Tick exactly two scopes: **`project`** (read and write projects) and **`repo`** (the board needs to read PRs and issues; the repo is public, so `public_repo` alone also works).
4. **Generate token** → copy it once (it is shown once).
5. Go to the repo: **RummyHome → Settings → Secrets and variables → Actions → New repository secret**. Name: `PROJECT_TOKEN`. Secret: paste. **Add secret**.
6. Then **Actions → Board sync → Run workflow** once (leave dry_run = false). The run's summary lists every card it moved.

Fine-grained token alternative: Resource owner = your account; Repository access = RummyHome (Read: Contents, Issues, Pull requests, Metadata); Account permissions → **Projects: Read and write**. Classic is simpler.

The token is only ever read from the secret; nothing prints it. If it is missing or lacks the scopes the run fails with a one-line message saying so.

## By hand

```bash
PROJECT_TOKEN=… node ci/board/sync.mjs --reconcile --dry-run   # show what would move
PROJECT_TOKEN=… node ci/board/sync.mjs --reconcile             # move it
PROJECT_TOKEN=… node ci/board/sync.mjs --pr 68                 # one PR
node --test ci/board/rules.test.mjs                            # the rules, no token needed
```
