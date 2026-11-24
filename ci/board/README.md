# Board sync

The project board ([users/sreeatcandorps/projects/1](https://github.com/users/sreeatcandorps/projects/1)) updates itself from the PRs and issues. Workflow: `.github/workflows/board-sync.yml` · rules: `rules.mjs` (tested by `rules.test.mjs`) · code: `sync.mjs`.

## Columns (Status field, in this order)

Sree, Nov 24: "I want another category in the Kanban board that says something like 'we're still brainstorming' …
Once it's brainstormed, then it moves to: To Do · In Progress · Waiting on Me · Live … If you postpone something,
if you park something, then maybe that should be a different one."

**Brainstorming · To do · In progress · Waiting on Sree · Done · Live · Parked.** The sync writes these columns
itself (`BOARD_OPTIONS` in `rules.mjs`): it renames *Spec* → *To do* and *Building* → *In progress* in place, so
their cards stay, removes *Ready to test*, and re-files every card in the same run.

| Event | PR | Issue |
| --- | --- | --- |
| Label `brainstorm` | Brainstorming | Brainstorming |
| Label `parked`, or title starting "Parked:" | Parked | Parked |
| Label `waiting-on-sree` | Waiting on Sree | Waiting on Sree |
| Open, CI running / red, or a draft | In progress | — |
| CI green and the PR's *For Sree* **Decide:** line asks him something (no Decide line: spec / docs PRs do) | Waiting on Sree | — |
| CI green and the Decide line says "nothing …" (a pre-approved merge, D80) | In progress (Build Bot merges it) | — |
| Spec PR approved (label `approved`, or Status row `\| Approved \| yes … \|`) | Done (the build is its own PR) | — |
| Label `in-progress` (work outside a PR, e.g. the Play review) | — | In progress |
| Open, none of the above | — | To do |
| Merged or closed | Done (closed unmerged: Note "Closed without merge") | Done |
| … and label `live` | Live | Live |

**Live** means in users' hands. Build Bot adds the label `live` when that happens: app PRs when a Play release
carrying them goes out, server or e-mail PRs when they are deployed, share-site PRs when *Publish share site*
has checked the live pages. The precedence is the order of the rows: closed first, then brainstorm, parked,
waiting.

\* a PR is "spec" when it has label `spec` or `docs`, or its title starts "Spec" / "PR N spec", or says "docs only". The board-sync check itself is ignored when judging "green". Not on the board yet → added. Every 2 hours (and on Actions › Board sync › Run workflow) every open PR / issue and every card is reconciled, so anything missed heals itself.

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
