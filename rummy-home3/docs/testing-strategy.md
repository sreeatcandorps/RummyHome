# Testing strategy

Friday’s build is a scorekeeper shared by several accounts. Tests are layered so a scoring bug and a “wrong person can see this game” bug are caught in different places.

## Unit

`npm test` runs `tests/*.test.ts` with no network.

| Area | File | What it locks |
| --- | --- | --- |
| Round math | `tests/scoring.test.ts`, `tests/rummy-distribution.test.ts` | Drops, counts, winners, round sums to 0 |
| Initials | `tests/player-initials.test.ts` | Player 1 / Player 10 stay distinct; colliding names grow a letter before a number |
| Who sees a game | `tests/friday.test.ts` | Creator, seated player, spectator, same email, outsider |
| Who can score | `tests/friday.test.ts` | Creator and game admin yes; player and spectator no |
| Share token | `tests/friday.test.ts` | 48-hex token, link is not localhost |
| Prize coins | `tests/friday.test.ts` | Stake uses points; pool prize splits to 0; entries must net to 0; session settles at all zeros |
| Auth copy | `tests/auth-errors.test.ts`, `tests/friday.test.ts` | Duplicate email tells the person to sign in; reset URL is not localhost |

## Integration (Supabase / RLS)

`npm run test:rls` (`scripts/friday-rls.mjs`).

It signs up five real throwaway accounts on the project in `.env.local`: admin, co-admin, player, viewer, outsider. Then:

- The creator, a seated player, and a view-only person can list the game. The outsider cannot.
- A normal player cannot insert a round. After they are promoted, a game admin can.
- The anon key can read the scorecard with the game’s token and cannot read it with a random token.

The script exits 1 when Supabase env vars are missing, so a build without keys is red rather than a quiet pass. It fails with a pointer at `006_friday_game_night.sql` if that migration is not applied. It also needs email confirmation turned off, or the new users never get a session. `007_redesign.sql` is not applied by this script.

`npm run test:smoke`, `test:game-flow`, and `test:nightly` are the older live checks (login, create game, add a round). Run those after `test:rls` when the keys are available.

## Role matrix

| Person | Sees the game | Enters / undoes scores | Makes someone an admin | Opens the public link |
| --- | --- | --- | --- | --- |
| Creator (even if not playing) | Yes | Yes | Yes | Yes |
| Game admin | Yes | Yes | Yes | Yes |
| Player | Yes | No | No | Yes, view only |
| View-only (spectator) | Yes | No | No | Yes, view only |
| Outsider | No | No | No | Only if someone sends them the unguessable link |
| Signed out | No | No | No | The public link only |

The public link is the exception on purpose: anyone who has the token can watch. The token is 48 hex characters. It is not the 6-character game ID.

## End to end / smoke (manual)

On two phones, or one phone and a second account:

1. Create two accounts. Confirm both can sign in with the 6-digit passcode (eye toggle shows the digits).
2. Account A starts a game, turns off “I’m playing”, and adds account B.
3. Account B signs in and sees the game under Home → Recent without creating it.
4. Account B cannot add a round. Account A can.
5. Account A opens Players and makes B a game admin. B can then add a round.
6. Account A adds a third person as view-only. That person sees the game and cannot score.
7. Share → Copy link. Open it in a browser. Start time and game ID are visible. Add a round on the phone and refresh; the page updates within about 8 seconds.
8. Complete the game from Done. The confirm shows points only. There is no Results button on that confirm.
9. Home → Results. Check the completed games and tap Show results. Positive totals are on the left, negative totals on the right, each row is a player in first-name order, the columns are the games and a total, and 1st, 2nd, and 3rd place are at the bottom. As many games as fit are on screen, and the name and the total stay put when the rest scroll. Turning the phone fits a different number. Share results shows Rummy Home and the places. Share full details (PDF) sends the whole table. Declare works for an admin of every checked game. Add a finished game they do not run and Declare stays off. A second account can open the declared result. Home has no Settle button. A 16th seated player is refused. More than 50 players in one results view is refused.

## Regression

After any scoring or schema change:

- `npm test`
- `npm run typecheck`
- One stake round and one pool round on a real account (expense on and off)
- Undo the last round and confirm the public page drops it
- Sign out and back in; the game is still listed for every person who was in it

## Friday checklist

- [ ] `006_friday_game_night.sql` has been run on `gngcrplcldfiubvhcdin`
- [ ] Site URL is `https://sreeatcandorps.github.io/Games/`, not localhost
- [ ] A fresh reset email opens that page
- [ ] `public/get/index.html` is published, and `dist/scorecard.html` (placeholders filled by `scripts/inject-scorecard-config.mjs`, never committed) is the live scorecard page
- [ ] New preview APK is the one installed (older APKs do not have Share or prize sessions)
- [ ] Two accounts: the second sees a game the first created
- [ ] Only a game admin can add a round
- [ ] Copy link works even if email is not configured
- [ ] Phones are charged, and the table has the game ID written down in case someone is late
- [ ] `007_redesign.sql` has been run after `006`
- [ ] `008_results.sql` has been run after `007` before Results can be declared on the live database

## Device UI tests (Maestro on an Android emulator, in CI)

`npm test` does not open a screen. The screens are tested on a real build of the app, on an Android emulator, by Maestro flows in `rummy-home3/e2e/`. The GitHub Actions workflow (`.github/workflows/ci.yml`, jobs `ui-smoke` and `ui-full`) builds a test APK from the commit with `expo prebuild` + Gradle, points it at the same throw-away local Supabase the database job uses (`supabase db reset` + `supabase/seed-e2e.sql`), boots a Pixel 6 / API 34 emulator and runs the flows. Nothing reaches the production project and no secrets are used. The APK is a CI-internal artifact, never a release.

| Set | When | What | Red means |
| --- | --- | --- | --- |
| `e2e/smoke/` | every pull request (`ui-smoke`) | sign in, Home, Scorecard (4 and 20 players, portrait and landscape), Add round (drops + rummy, save), Complete game, Results, Profile, My players, New game | the PR does not merge |
| `e2e/full/` | nightly and `workflow_dispatch` (`ui-full`) | sign out / wrong passcode, 20-player scorecard swiped to the last column, Players · Admins, Game settings, Save result and Past results, every Help note, dark appearance | fix before the next APK |
| `e2e/known-bugs/` | with both suites, quarantined | one flow per bug from the Nov 12 phone test, named after the PR that fixes it (PR 3 rummy with a positive pot, PR 6 initials clash → HT2; PR 8's 0-players flow moved to `smoke/12` and PR 2's undo→add round flow to `smoke/13` when those PRs landed) | expected until that PR lands; the PR moves the flow into `smoke/` and it turns blocking |

Every flow starts from `e2e/lib/ensure-signed-in.yaml` (sign in only when the login screen is showing), uses the seeded account `sree@test.local` / `123456` (local database only), and ends with `takeScreenshot`. Landscape flows (file name contains `landscape`) rotate with Maestro's `setOrientation` once the app is up; the runner also rotates the emulator for them (`adb shell wm set-user-rotation`). Fixtures the flows rely on are in `supabase/seed-e2e.sql`: game A `GAMEA1` (4 players, 2 rounds, from `seed.sql`), E `GAMEE1` (4 players, 1 round), H `GAMEH1` (3 players, no rounds), G `GAMEG1` (completed, 6 seated, no rounds), F `GAMEF1` (20 players × 30 rounds). Which flow changes what, and in which order they must run, is in `e2e/README.md`.

What you get from a run: the job summary has a pass/fail table per set, the `ui-screenshots-<branch>-<suite>` artifact has every screenshot plus Maestro's debug output per flow, and `ui/index.html` inside it is the gallery (one card per screen, light / dark / landscape variants side by side, a `--FAILED` capture for a failed flow). On a pull request the same table is posted as a comment. A pixel diff against a baseline is phase 2, once the design stops moving.

Before adding a flow: give the element a `testID` when text is ambiguous (Maestro `id:`), keep the flow independent of the ones before it (its own seeded game), and add the flow to the matrix below. `tests/e2e-flows.test.ts` checks every flow has the right `appId`, takes a screenshot and only references `testID`s that exist.

## Testing matrix

Legend: **U** unit (`npm test`) · **D** pgTAP / DB on the local Supabase · **C** two-client concurrency script · **S** emulator smoke (every PR) · **N** emulator nightly / before each APK · **M** manual phone pass before a milestone APK (only after S + N are green). "—" = not covered today. Bold = the layer that must be green before merge.

| Area | Journey / branch | Today | Target | Flow |
|---|---|---|---|---|
| Sign in | email + passcode happy path | U (copy), S | **S** | `lib/sign-in` |
| | wrong passcode, locked, no network | U, N | N | `full/10` |
| | register, duplicate email, forgot/reset passcode | U, D (021) | N | — |
| | claim / link a player (request, accept, pending) | U, D (025) | N | — |
| | sign out, delete account (026) | U, D, N (sign out) | N | `full/10` |
| Home | live + recent list, S/P labels, role tags | U, S | **S** (light), N (dark) | `smoke/01`, `full/60` |
| | empty state, pull to refresh, cached/offline | U (degrade) | N (airplane mode) | — |
| | My Players button count, tab bar | S | **S** | `smoke/01`, `smoke/08` |
| New game | pick recent players, search, from database, new by initials | U, S (screens open) | **S** | `smoke/09` |
| | I'm playing on/off, settings (type, drop, middle, full) | U | N | — |
| | co-admin add / skip | — | N | — |
| | guardrails: 20th seat, player limits (029) | U, D | D + N | — |
| Initials | 1+2 cells, auto-advance, clash → HT2, edit, 3 at a time | partly U, known-bug | U + **S** | `known-bugs/pr6` → PR 6 |
| | edit initials mid-game | — | U + N | — |
| Scorecard | 4 / 20 players render, header not clipped, DEALS | U (source grep), S | **S** | `smoke/02`, `smoke/10` |
| | 20 players: last column reachable by swiping, header in step | N | N | `full/20` (slow: 600-cell hierarchy) |
| | portrait ↔ landscape | S | **S** | `smoke/03`, `smoke/11` |
| | dealer rotation + divider after seat change (031) | U, D | D + N | — |
| | footer Creator / Admin / Unique ID | U, S | N | `smoke/02` |
| | view-only (player / spectator) | D (RLS), U | N | — |
| | 200 / 500 rounds (029 message) | volume script | N (monthly) | — |
| | realtime refresh when another admin saves | C | C + N | — |
| Add round | select, keypad, ±, drops, Save score, Balance pill | U, S | **S** | `smoke/04` |
| | Rummy balance (positive others, two winners, negative share) | U, known-bug | U + **S** | `known-bugs/pr3` → PR 3 |
| | over max count warning | — | U + N | — |
| | edit a saved round (replace) | D, C | D + N | — |
| | same round saved by two admins (true conflict) | D, C | C + N | — |
| Undo | undo last round, undo on empty, **undo then add round** | D + S | D + S | `supabase/tests/25_undo_035.sql`, `smoke/13-undo-then-add-round.yaml` (PR 2 / 035) |
| Game log | every change logged on the server, append-only, All/Important, edit rows expand, live rows; result History and "Changed after sharing" | D + U + S | D + U + N | `supabase/tests/26_event_log_036.sql`, `tests/event-log-036.test.ts`, `smoke/04` (last step), `full/70-game-log.yaml` (Logs PR / 036) |
| | undo by second admin while first is typing | — | C | — |
| Players / Admins | add new mid-game, from database, remove seat with no scores (016/017) | D, N (page opens) | D + N | `full/30` |
| | add non-playing admin by ID | — | N | — |
| | tags: Creator / Admin only; Unregistered / Pending only | U | N | — |
| My Players | A–Z sections, search, paging to 1,000, remove + undo toast | U, D (027/030), S (search) | N | `smoke/08` |
| Complete game | confirm, points only, status to Completed | U, S | **S** | `smoke/05` |
| Results | picker chips, tick rules, non-admin message | U, S (picker) | N | `smoke/06` |
| | show results 1 game / 5 games / 30 × 20 | U, volume, S (1 game) | **S** (1 game), N (30 × 20) | `smoke/06` |
| | PR 8 design: ranked split + medals, bands of five games with borders, legend, Games in this result | U (model, HTML, CSS parity), S | **S** | `smoke/06`, `smoke/12` |
| | save result (completed → closed), closed-reuse warning | U, D, N | N | `full/40` |
| | 0 players in a saved result when the game has no rounds (034) | U, D (pgTAP 24), S | U + D + **S** | `smoke/12` |
| | result versions after a game is deleted; `/r/` page shows the edited notice and older versions (034) | D (pgTAP 24), U (page source) | D + N (web screenshot) | — |
| | share image (summary only, generator initials, cap 8 a side) / PDF (phone pages, 16 px) match screen | U | N (share sheet screenshot) | — |
| | single game: Final scores card (standings) + rounds in blocks of five, Rounds PDF, web scorecard blocks | U | **S** (button visible), N | `smoke/05` |
| | past results list, result detail, "Games in this result" | U, N (list) | N | `full/40` |
| | delete result (PR 9) | D (023) | U + D + N | — |
| | public `/r/` page, result emails (024) | D | D | — |
| Profile | name, player ID, passcode change, appearance, phone, email prefs, version | U, S | N | `smoke/07`, `full/60` |
| Security | RLS matrix, anon revocations (033), search_path | D | D | — |
| Offline / degraded | cached scorecard opens, save fails with a message, retry | U | N | — |
| Help | every ? opens and closes, text fits | N | N (PR 12 adds one flow per screen) | `full/50`, `smoke/02`, `smoke/06` |

**Smoke set on every PR (12 flows):** sign in → Home → Scorecard 4p (+ Help) → Scorecard landscape + Add round landscape → Add round (3 drops + rummy, save, Round 4, then Log shows "Round 3 added" first) → Complete game → Results (1 game) → Profile → My players (search) → New game (picker, Add New Players by Initials) → Scorecard 20p → Scorecard 20p landscape → Results with no rounds (game G, 6 players, saved). Undo → Add round joins the smoke set with PR 2.

**Nightly / before each APK:** the smoke set, everything marked N, dark appearance, plus C and the volume scripts monthly.

**Stays unit / DB only:** pure math (`scoring`, `rummyDistribution`, `initials`), RLS and grants, migrations / rollbacks, guardrail counts, label numbering, result JSON shapes.

## PR 8 test cases (Results design, migration 034)

Each case names the layer, the steps and what must be true. U = `npm test`, D = `ci/db/local-run.sh`, S = `e2e/smoke`, M = by hand on the emulator or phone.

| # | Layer | Steps | Expected |
|---|---|---|---|
| R8-1 | U | `tests/results-design.test.ts` | Positive totals left with medals on the top three (competition rank: two +40s are both gold, the next is bronze), negatives right closest to zero first, "Even:" line for zeros; 7 games → 2 bands (5 + 2, the second stops at the seventh game — V4: filled strips, green-tinted header, gray rows, plain numbers, no borders); legend "RK #8 Ravi Kumar"; Games block lines: bold time then date, "N players · N rounds · *Game ID CODE*", "Creator … · Admins …" |
| R8-2 | U | `tests/results-design.test.ts` (CSS parity) | `RESULTS_DESIGN_CSS` in `utils/resultsDetails.ts` is byte-for-byte inside `public/r/index.html` (`.box`, `.box.head`, `.medal`, `.m1`, `.pl`, `.gid`); PDF HTML has four `.page` sections at 390 × 780 |
| R8-3 | U | `tests/final-scores.test.ts` | Single game: `sheet.card` is the standings card titled "Game S3 Final Scores", footer "Game S3", never the word Results; 7 players → blocks 5 + 2 with the game total in each head; `public/scorecard.html` has `BLOCK = 5` and equals `web/scorecard.html` |
| R8-4 | D | `supabase/tests/24_results_design_034.sql` | Game with 4 seated, a spectator and a non-playing admin and **no rounds** → 4 standings at 0; re-declare with one player unseated keeps their −25; `public_result(id)` carries version, creatorName, adminNames (creator excluded), roundCount, declarerName; `delete_game` on a game in a result → version 2 with note "… removed · game deleted", `public_result(id, 1)` still shows the game; `delete_result` → `deleted: true`, old versions still readable |
| R8-5 | D | `ci/db/replay-rollbacks.sh` | Rollback 034 restores the 024 `declare_game_result` and the one-argument `public_result`; forward replay restores the table, trigger and two-argument function |
| R8-6 | S | `smoke/06-results.yaml` | Game A: "Scores" heading, `results-band-table`, "Games in this result", Save button; Help opens |
| R8-7 | S | `smoke/12-results-zero-players.yaml` | Game G (6 seated, 0 rounds): preview says "1 game · 6 players" and "Even: …"; after Save the saved result says the same and shows the band table and the games list |
| R8-8 | S | `smoke/05-complete-game.yaml` | After Complete game, "Share final scores" opens the Final scores screen: "Round by round", the blocks (`final-scores-rounds`), the Rounds and Share buttons; Back returns to the completed screen |
| R8-9 | M | Results → Show results (7 games) → Share icon | Dialog shows the one-page card: counts line, two columns with medals, "Generated by SK" (initials), link; tapping Share full details (PDF) opens the share sheet with a 4-section PDF whose band borders match the header |
| R8-10 | M | Show results with 30 games | Six filled bands (alternating shade); the header strips and the row strips share one shape; legend wraps; no horizontal scroll |
| R8-11 | M | Scorecard › ⋮ › Share final scores | Standings card on top, "Round by round" blocks below, two buttons: Rounds (PDF) and Share final scores (image). The card has no "Results" wording |
| R8-12 | M (web) | `/r/<id>` after 034 | Same bands, medals and games list as the app; after a game in the result is deleted a blue "edited after it was saved" notice lists versions and `?v=1` opens the first; a deleted result shows the red notice |
| R8-13 | M (web) | `/scorecard?t=…` | Blocks of five players with totals in the head, green header, win cells tinted, divider where the first dealer deals again |

## Phone pass (manual, milestone APKs only)

Only after S + N are green, with the matrix above as the checklist. Someone who is not Sree, on a physical Android phone:

- Install the new APK over the old one. Cold start. Home in a few seconds on wifi, and an error with Retry on a dead network.
- Rotate the scorecard both ways, twice. The title Scorecard stays lined up with the back button.
- Open the copied link in Chrome. The table renders. The tab is not showing the page source.
- Second phone, second account: they see the game, and view-only cannot score.
- Players: +, remove, airplane mode during remove. No other person’s email on the list, the sheet, or Find.
- One points game completed from Done. Home → Results shows places. Home has no Settle button.
- A new account’s welcome email arrives from `scores@mindweavetech.com`.

Pass when Home has New game, Results, and Recent, and none of Settle, Active, History, or All players. Settle stays off. `EXPO_PUBLIC_SETTLE_ENABLED` stays unset.

## Logs PR test cases (Game and result logs, migration 036)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| L-1 | D | `supabase/tests/26_event_log_036.sql` | `event_log` exists with the kinds check, RLS on, realtime publication; UPDATE/DELETE on a row is refused; `log_event` is not executable by `authenticated` or `anon`; direct `insert` into `rounds`/`scores` is "permission denied" |
| L-2 | D | same | `create_game` writes exactly one `game_created` row naming players, admins and the Game ID; `add_seated_player` writes `player_added` with the join round and the zero backfill, refuses non-admins (42501), closed games and a repeat seat |
| L-3 | D | same | `save_round` logs `round_added` (dealer, non-zero scores) and `round_edited` (was→now per changed player, "N others unchanged"); `undo_last_round` logs `round_undone` with the removed scores; an edit's retired row is not logged as undone |
| L-4 | D | same | Status rows: completed (with the leader), reopened, closed/unclosed (with the result code), deleted/restored; settings diff ("Middle drop -30→-50", important only once rounds exist); initials/admin/view-only rows are routine; profile rename lands in every active game |
| L-5 | D | same | Saving a result writes `result_saved` ("Result saved with S1 · 1 game moved to Closed · 4 players"); deleting/restoring writes `result_deleted`/`result_restored`; editing or undoing a round of a closed game writes `result_changed` into the holding result (and "while this result was deleted" when it is); deleting a game in a result writes the "no longer counted" row |
| L-6 | D | same | `list_game_log` pages newest first with `hasMore` and honours the level filter; `list_result_history` returns `result_*` rows only plus `versions` and `changedNote`; `public_result_note` / `public_scorecard_changes` work for anon with a valid id/token and return null/[] otherwise; a non-member reads no rows |
| L-7 | D | `ci/db/replay-rollbacks.sh` | Rollback 036 drops the 10 `event_log_%` triggers, the table and type, re-grants insert/delete, restores the 035 `save_round`; forward replay rebuilds all of it; 036 is safe to run twice |
| L-8 | U | `tests/event-log-036.test.ts` | Migration/rollback text pins; names from `details.names` come out bold; `round_edited` expands to was→now rows; day grouping (Today / Yesterday / date) keeps arrival order; dot colours by kind; default filter All while active, Important when done; the one-line "Changed after sharing: … · who · when (+N earlier)" note; History keeps `result_*` rows only |
| L-9 | U | `tests/security-033.test.ts`, `tests/archive.test.ts` | The two new anon RPCs are granted explicitly by 036 (not by widening 033); the result ⋮ menu offers History to every viewer and Delete result to managers only |
| L-10 | S | `smoke/04-add-round.yaml` (last step) | After Save round: Scorecard menu → Log opens and the first row reads "Round 3 added …" |
| L-11 | N | `full/70-game-log.yaml` | Game E: add round 2 → edit it (Harish Drop→Middle drop, Priya's Rummy share follows) → undo → Log shows undone · edited · added newest first; tapping the edited row shows Was/Now; Important keeps all three |
| L-12 | M | Result page on the emulator | History section below Games in this result; ⋮ History scrolls to it; after an edit of a closed game the amber "Changed after sharing" line appears on the page and in the share image, PDF and `/r/` page; the live scorecard page shows a Changes card |

## PR 2 test cases (Undo then Add round, migration 035)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| U2-1 | D | `supabase/tests/25_undo_035.sql` | The full unique key on `rounds (game_id, round_number)` is gone and the partial `rounds_live_number_uidx` (`where undone_at is null`) exists; `undo_last_round` is executable by `authenticated` only and refuses seated players and outsiders with 42501 |
| U2-2 | D | same (2.1) | Save round 3 → undo (returns `{roundNumber: 3}`, `current_round` back to 3, the undone row keeps number 3) → save round 3 again succeeds: one live round 3 with the new scores, `current_round` 4, the old row kept in the 1000+ range |
| U2-3 | D | same (2.3) | Undo three times → `current_round` 1, a fourth undo returns null, round 1 saves again; every undone row is kept |
| U2-4 | D | same (2.5) | Saving round 5 when the last live round is 3 is refused with PT409 "A round was undone while you were scoring …" and writes nothing |
| U2-5 | D | `supabase/tests/05_save_round_014.sql`, `ci/db/concurrency-save-round.mjs` case 1 | A different payload for an already saved round answers "Round 3 was just saved by Sree Test. Check the scorecard before you save again." (named saver from `rounds.created_by`) |
| U2-6 | D | `ci/db/concurrency-save-round.mjs` case 10 | Admin B undoes round 7 in an open transaction while admin A saves round 8: A waits on the per-game lock, is refused with the refresh message, `current_round` is 7, and A then saves round 7 again at the same number |
| U2-7 | D | `ci/db/replay-rollbacks.sh` | Rollback 035 drops the RPC, parks colliding undone rows, restores the full key and the 031 "someone else" body; forward replay restores all of it and the D2.2 one-off leaves no undone row below 1000; 035 is safe to run twice |
| U2-8 | U | `tests/undo-round-035.test.ts`, `tests/security-concurrency-019.test.ts` | Migration and rollback text pins; a raw 23505 is still a conflict but reads "The scorecard changed. It has been refreshed; try again." (never "someone else"); the server's named message reaches the dialog untouched; `undoLastRound` calls the RPC and only falls back to direct writes on PGRST202 |
| U2-9 | S | `smoke/13-undo-then-add-round.yaml` | Game E: Undo round → Remove → header "Round 1" → Add round → four scores (balance 0) → Save round → "Round 2", no "Round already saved" dialog |
| U2-10 | M | Scorecard › Undo round, then Add round on the emulator | Same as U2-9 with screenshots in `/opt/cursor/artifacts/pr2-undo-round/` |
