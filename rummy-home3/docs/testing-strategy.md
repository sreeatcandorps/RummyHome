# Testing strategy

Friday’s build is a scorekeeper shared by several accounts. Tests are layered so a scoring bug and a “wrong person can see this game” bug are caught in different places.

Flow view, roles, devices, automation tiers and the break-the-app programme: [`test-plan/README.md`](test-plan/README.md) (PR 16, review-first).

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
| `e2e/known-bugs/` | with both suites, quarantined | one flow per bug from the Nov 12 phone test, named after the PR that fixes it (PR 8's 0-players flow moved to `smoke/12`, PR 2's undo→add round flow to `smoke/13`, PR 3's positive-pot Rummy flow to `smoke/14` and PR 6's initials clash → HT2 into `smoke/09` when those PRs landed; the set is empty now and passes with zero flows) | expected until that PR lands; the PR moves the flow into `smoke/` and it turns blocking |

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
| Home | live + recent list, S/P labels, role tags; Recent plain title on grey, Show more paging (PR 10b) | U, S | **S** (light), N (dark) | `smoke/01`, `full/60` |
| | empty state, pull to refresh, cached/offline | U (degrade) | N (airplane mode) | — |
| | My Players button count, tab bar | S | **S** | `smoke/01`, `smoke/08` |
| New game | pick recent players, search, from database, new by initials; you first, no You / Registered tags (PR 7); Next → Game type (Points / Pool, this game's settings, players at the bottom, Back, Start) (PR 13) | U, S (screens open) | **S** | `smoke/09`, `smoke/16` |
| | Add players to this game: Total circle (seated only), Added now, Return to game, non-playing admin by Player ID | U, N | U + **N** | `full/32` |
| | I'm playing on/off, settings (type, drop, middle, full) | U | N | — |
| | co-admin add / skip | — | N | — |
| | guardrails: 20th seat, player limits (029) | U, D | D + N | — |
| Initials | 1+2 cells, auto-advance, clash → HT2, edit, 3 at a time | U, D, S | U + D + **S** | `smoke/09` (was `known-bugs/pr6`) |
| | edit initials mid-game (digit allowed, Save above the keyboard) | U, N | U + N | `full/31` |
| Scorecard | 4 / 20 players render, header not clipped, DEALS; header and score cells of one column on screen together (PR 10a); pool header number / initials / score, OUT, re-entered blue, Standings and Awards cards (PR 13); three-letter initials (WWW, MMM) never clipped on 20 columns, Standings, Awards (F13.22) | U (source grep, `initials-fit`), S | **S** | `smoke/02`, `smoke/10`, `smoke/11`, `smoke/16`, `smoke/17` |
| | 20 players: last column reachable by swiping, header in step | N | N | `full/20` (slow: 600-cell hierarchy) |
| | portrait ↔ landscape | S | **S** | `smoke/03`, `smoke/11` |
| | dealer rotation + divider after seat change (031) | U, D | D + N | — |
| | footer Creator / Admin / Unique ID | U, S | N | `smoke/02` |
| | view-only (player / spectator) | D (RLS), U | N | — |
| | 200 / 500 rounds (029 message) | volume script | N (monthly) | — |
| | realtime refresh when another admin saves | C | C + N | — |
| Add round | select, keypad, ±, drops, Save score, Balance pill; saved cells green, 3 columns ≥ 13 players, "N more ▾" cue (PR 10b); pool: plus only, "Are you sure?" over the Full count, "Round saved" sheet with outs and re-entry (PR 13) | U, S | **S** | `smoke/04`, `smoke/10`, `smoke/16` |
| | Rummy balance (positive others, two winners, negative share) | U + D + S | U + D + S | `tests/add-round-pr3.test.ts`, `supabase/tests/27_rummy_negative_037.sql`, `smoke/14-rummy-positive-pot.yaml` (PR 3 / 037) |
| | Count warnings (half / Full count line, over-max confirm once per cell) | U + N | U + N | `tests/add-round-pr3.test.ts`, `full/80-add-round-count-warnings.yaml` (PR 3) |
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
| Results | picker chips, tick rules, non-admin message; pool rows pick only once awarded, "Give awards first" (PR 13) | U, S (picker) | N | `smoke/06`, `smoke/16` |
| Pool awards | presets preview, Custom inline, Save anyway when unbalanced (PR 13); the lowest score gets the most: Entry per drop left greyed + pop-up when the winner would be level or behind, Custom warns (F13.23) | U (`pool-pr13` 13.5c), S | **S** | `smoke/16` |
| | show results 1 game / 5 games / 30 × 20 | U, volume, S (1 game) | **S** (1 game), N (30 × 20) | `smoke/06` |
| | PR 8 design: ranked split + medals, bands of five games with borders, legend, Games in this result | U (model, HTML, CSS parity), S | **S** | `smoke/06`, `smoke/12` |
| | save result (completed → closed), closed-reuse warning | U, D, N | N | `full/40` |
| | 0 players in a saved result when the game has no rounds (034) | U, D (pgTAP 24), S | U + D + **S** | `smoke/12` |
| | PR 9: Delete this result + Undo toast, confirm only when shared, Past results Delete / Deleted + Restore (30 days) | U, D (pgTAP 30), S, N | U + D + **S** + N | `smoke/12`, `smoke/15`, `full/40` |
| | result versions after a game is deleted; `/r/` page shows the edited notice and older versions (034) | D (pgTAP 24), U (page source) | D + N (web screenshot) | — |
| | share image (summary only, generator initials, cap 8 a side) / PDF (phone pages, 16 px) match screen | U | N (share sheet screenshot) | — |
| | single game: Final scores card (standings) + rounds in blocks of five, Rounds PDF, web scorecard blocks | U | **S** (button visible), N | `smoke/05` |
| | past results list, result detail, "Games in this result" | U, N (list) | N | `full/40` |
| | delete result (PR 9) | D (023) | U + D + N | — |
| | public `/r/` page, result emails (024) | D | D | — |
| Profile | name, player ID, passcode change, appearance, phone, email prefs, version; pencils, own initials, passcode fields above the keyboard (PR 10b); Settings: New game starts as, Points and Pool defaults, Re-entry (PR 13) | U, S | N | `smoke/07`, `full/60` |
| Security | RLS matrix, anon revocations (033), search_path | D | D | — |
| Offline / degraded | cached scorecard opens, save fails with a message, retry | U | N | — |
| Help | every ? opens and closes, text fits | N | N (PR 12 adds one flow per screen) | `full/50`, `smoke/02`, `smoke/06` |

**Smoke set on every PR (12 flows):** sign in → Home → Scorecard 4p (+ Help) → Scorecard landscape + Add round landscape → Add round (3 drops + rummy, save, Round 4, then Log shows "Round 3 added" first) → Complete game → Results (1 game) → Profile → My players (search) → New game (picker, Add new players: H + T → HT2 with PR 6) → Scorecard 20p → Scorecard 20p landscape → Results with no rounds (game G, 6 players, saved). Undo → Add round joins the smoke set with PR 2; Rummy with a positive pot (negative share, confirm, save) with PR 3; the Pool game end to end (`smoke/16`, deletes its game at the end) with PR 13.

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

## PR 3 test cases (Add round colours, count warnings, Rummy negative share, migration 037)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| A3-1 | U | `tests/add-round-pr3.test.ts` 3.1 | Four at -10 and a Rummy → +30/+40 share, Balance 0, Save round on, no confirm |
| A3-2 | U | same 3.2 | +100 / -20 / -30 and a Rummy → share -50, Save on, `rummyShareNeedsConfirm` true, validator accepts, confirm text names the winner and the others' total |
| A3-3 | U | same 3.3 / 3.4 | Two winners: -45 → +23/+22; +31 → -16/-15 (first tapped takes the larger piece, D3.3), confirm text lists both |
| A3-4 | U | same | D3.2: a share of exactly 0 asks, any positive share does not; `exceedsMaxCount` at 80 (no) / 81 / -120 / 120 (yes) / no Full count (never); `countWarning` none < half, half from 40 of 80, full from 80; warning and confirm wording |
| A3-5 | U | same, `tests/build4.test.ts`, `tests/design-nov12.test.ts` | Palette: selected cell and active sign `secondaryContainer` (yellow), saved plus `positiveContainer` with `win` text and ring, saved minus/0 white; the screen has no 00 / tick / Clear keys; digits go through the once-per-cell confirm; Save round asks about a non-winning Rummy once |
| A3-6 | D | `supabase/tests/27_rummy_negative_037.sql` | `scores_check` no longer requires rummy ≥ 0 (validated); a round with a -40 Rummy share saves and totals 0; two negative shares save; a positive drop is still refused (23514) and writes nothing |
| A3-7 | D | `ci/db/replay-rollbacks.sh` | Rollback 037 restores the ≥ 0 rule NOT VALID (saved rounds stay); forward replay validates the relaxed constraint; 037 is safe to run twice |
| A3-8 | S | `smoke/14-rummy-positive-pot.yaml` | Game H: +50 typed (yellow cell screenshot, light green saved cell), Drop, Rummy → "Priya Test, score -40", Balance 0, Save on → "Rummy share is not a win" confirm → Yes, save → Round 2 |
| A3-9 | N | `full/80-add-round-count-warnings.yaml` | Typing 1-2 shows no dialog, 1-2-0 shows "Over the Full count … Keep -120" once; Keep leaves -120 typed with the warning line; 40 shows "40 is half the Full count (80)." with no dialog |

## PR 6 test cases (initials rule, Add new players by initials, one editor; migration 039)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| I6-1 | U | `tests/initials-pr6.test.ts`, `supabase/tests/fixtures/initials-cases.csv` | One table of typed + taken → stored initials drives `pickFreeInitials` here and `public.pick_free_initials` in pgTAP (SK free → SK; SK taken → SK2; SK, SK2 → SK3; digits 2–9 used → S10; SKR taken → SK2; SK2 typed; S1 taken → S2) |
| I6-2 | U | same 6.2–6.4 | Exact sentence "Sree Koneru is already SK. This new player is SK2."; `splitInitials` separates the digits for the red colour |
| I6-3 | U | same 6.5, `tests/initials-022.test.ts` | Three letters typed directly are accepted; suggestions keep the Nov 11 letter-first order (no digits-first rule, Sree 13 Nov); a digit may be suggested later (HT2) but never first |
| I6-4 | U | same 6.6 | "S" → "Type at least 2 characters.", "SK45" → "Up to 3 characters.", "4K" → "The first character must be a letter, A to Z."; SK2 accepted |
| I6-5 | U | same 6.1, `tests/build3.test.ts` | Cell 1 one letter (a digit refused at once), cell 2 one or two letters or digits |
| I6-6 | U | same (row cap) | `NEW_PLAYER_ROWS_MAX = 3`, no fourth row appended, no delete on the screen, one `InitialsDialog`, title "Add new players", heading "…3 at a time" |
| I6-7 | U | same (one editor) | The dialog is digit-tolerant, shows "Change the letters to save." when unchanged, sits in a `KeyboardAvoidingView`; My players, Players/Admins, Add new players and Find player all use it; `services/players.ts` and `services/games.ts` use `INITIALS_PATTERN`; 039 defines both RPCs and widens both editors |
| I6-8 | D | `supabase/tests/29_initials_039.sql` | As sree: 'HT' → HT2 named HT2, `taken_by` Harish Test, My players row and `list_my_players` carry HT2; again → HT3; 'xy' → XY; 'SK2' typed; '4K', 'S', 'SK45', 'S-K', '' refused with the exact reason; signed out refused. Editors: XYZ and XY2 accepted and the initials-named player is renamed with them; Harish → HT9 keeps his name; '2SK' and 'SKOR' refused; a clash names the other player; `set_seat_label` H2 on game A, the creator's My players follows, '2H' refused |
| I6-9 | D | `ci/db/replay-rollbacks.sh`, `supabase/tests/12_player_initials_022.sql` | Rollback 039 removes the RPCs and restores the letters-only editors; forward replay restores 039; safe to run twice; a re-run of 022 followed by 039 keeps the wider rule |
| I6-10 | S | `smoke/09-new-game.yaml` | Add new players: three rows and no fourth; H then T (cell 1 jumps on) → "Saved HT2", "Harish Test is already HT. This new player is HT2.", no HTE, "Edit initials for HT2" (screenshot); Done |
| I6-11 | N | `full/31-edit-initials-mid-game.yaml` | Game E Players/Admins → Options for Zed Zero → Edit initials: hint "Change the letters to save."; ZZ2 typed → format hint, Save visible (screenshot) → the Players page and the scorecard read ZZ2; back to ZZ |

## PR 24 test cases (v11 pool and seating feedback: wording, pool scorecard like Points, footer inside the card, 70/30 portrait, stacked landscape, re-entry / late-entry score rules, re-entry display, four-step New game, Order of players; migration 047 written, not applied)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| X24-1 | U | `tests/pool-pr24.test.ts` | no "stake" in the strings of the rules form, Game type step, Settings, Help, New game, scorecard, Standings, Log labels |
| X24-3 | U | `tests/pool-pr24.test.ts`, `tests/scorecard-pr4.test.ts` | `headerHeight(…, pool)` is one small line taller than Points with the same type; `footerType()` is 70 %, italic, weight 400; the footer slot renders inside the card (`score-table-footer`); `PORTRAIT_TABLE_FLEX / total = 0.7`; landscape passes the standings as `below`; the re-entry cell shows `↺score`, cells above go grey |
| X24-7a | U | `tests/pool-pr24.test.ts` | `reentryPlusOf` / `lateEntryPlusOf` (absent → 0 for a game, 1 for a new pool and for user defaults), `entryScoreUnder`, `reentryScore` / `lateEntryScore`, labels "Highest score" / "Highest score + 1" |
| X24-7b | U | same, `tests/pool-pr13.test.ts` | the draft: Unlimited by default, Limited starts with an empty count; round trip of both rules through `rulesFromDraft` / `draftFromRules`; the form has `-reentries-block`, `-reentry-score-highest/-plus-one`, `-late-entry-block`, `-late-entry-score-*` |
| X24-7c | U | same | 047 text (both helpers, `reenter_player`, `add_seated_player`, Log labels, "Written, not applied to live"), touches no table; rollback restores 042 / 041 / 044 bodies and drops the helpers; replay hook `HAS_047`; pgTAP 38 present |
| X24-7d | D | `supabase/tests/38_reentry_plus_047.sql` (25 checks) | no key → re-entry at the highest (041); setting both rules logs "Changed game settings · Late entry score —→Highest score + 1 · Re-entry score —→Highest score + 1"; re-entry at 41 (40 + 1) with its Log line; late entry at 42; switching back is logged |
| X24-9 | U | `tests/pool-pr24.test.ts`, `tests/emails-024.test.ts`, `tests/pool-pr13.test.ts` 13.7b | steps `players → type → order → coadmin`; the order step starts with nobody numbered; co-admin follows the order and only when someone can be picked; `newGameSeats(displayOrder(order))`; the type step's button is `new-game-type-next` (never Start); `CoAdminStep` carries the one `start-game` |
| X24-10 | U | `tests/pool-pr24.test.ts`, `tests/seating-pr21.test.ts` | `OrderDraft`: tap numbers and lifts, tapping the last number undoes, other numbered taps only highlight, arrows on numbered rows only and bounded, Clear, `orderComplete`, `orderChanged` (Done off mid-game until something moves), `showsPlayerCode(≥ 360)`; the component has no chips / "Keep this order"; no `shouldPromptSeating`, `markSeatingPrompted`; new games write `seatingPrompted: true` |
| X24-S | S | `e2e/smoke/19-seating-order.yaml` | New game: Next → Next → Order of players (0 of 4, no arrows) → tap Zed (seat 1, top) → tap again (undo) → number everyone → Clear → again → Next → co-admin → Start game → no pop-up, ZZ is column 1 → ⋮ Order of players prefilled → ▼ swaps → Done → Log row → Clear + Cancel saves nothing |
| X24-S2 | S | `e2e/smoke/16-pool-game.yaml`, `smoke/07-profile.yaml`, `smoke/02`, `smoke/03`, `chaos/c03` | pool New game through the four steps; Settings: Limited leaves the count empty, Re-entry score and Late entry sections default + 1; footer inside the card portrait and landscape; c03's refused limits pin the message above the Next bar |
| X24-S3 | S | `e2e/smoke/20-pool-13p-reentry.yaml` on game V (`seed-e2e.sql`: 13 seats, 6 rounds, Alpha back at ↺20 = highest, Bravo at ↺41 = highest + 1) | portrait: big initials, standings pane, footer under round 6; re-entry cells read ↺20 / ↺41; round-number tap opens Edit round 3; landscape: column 8 on screen, no standings pane, Standings below the rounds |
| X24-N | N | `e2e/full/51-seating-20p.yaml` | 20 players prefilled with arrows; Clear → Test Uniform first → the rest in order → Done → TU column 1 and the Log row; restored the same way; pool BQ1: ▲ on an out player, Cancel saves nothing |

## PR 21 test cases (Seating order — spec only, `docs/seating-order-design.md`; codes reserved, tests written with the build)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| X21-1 | U | `tests/seating-pr21.test.ts` | `placeAt` shifts the rows between source and target by one; ▲ ▼ at the ends are no-ops; 200 moves on 20 players stay a permutation; row sizes 40 / 32 / 30 dp by count; the Players chips from 8 players, landscape or 600 dp |
| X21-2 | U | same | pop-up gating: once per game for an admin with ≥ 2 seated players, 0 rounds and `settings.seatingPrompted === false` (only games started with this build carry the key, so older games never pop); never for players / viewers / completed / deleted / one player; the ⋮ item only on Active games |
| X21-3 | U | same | `nextDealerFor`: seat 1 with no rounds, the seat after the last dealer in the new order otherwise, wrapping; a pool skips out players and, when the last dealer went out, picks the next seat still in (041 `save_round`) |
| X21-4 | D | `supabase/tests/35_seating_order_044.sql` (45 asserts) | `set_seating_order`: creator / admin OK and compacted 0..N-1; player / viewer / non-member refused; missing or duplicate player refused; Completed refused; spectators / unseated admins refused; 20 players reversed in one call, unique key intact |
| X21-5 | D | same + `ci/db/replay-rollbacks.sh` | Log row `seating_changed`: routine at 0 rounds, important after; text by stored label or the 022 default initials; details `from` / `to` / `rounds` / `nextDealer`; `seatingPrompted` never logs a settings change; rollback relabels to `settings_changed` and drops the function, the forward replay restores it |
| X21-6 | D | same | Pool: reorder with an out and a re-entered player keeps `out_round` / `reentry_score`; next `save_round` dealer = next seat still in, in the new order |
| X21-7 | S | `smoke/19-seating-order.yaml` | New game 4 players → Start → Skip → the sheet pops (pick order, seat 1 deals) → Zed to seat 1 by tap-to-place → Done → columns ZZ ST, routine Log row → ⋮ Seating order (menu subline, Done off until a move) → ▼ swaps → Done → columns back → Cancel changes nothing → two Log rows; deletes the game at the end. `smoke/16` closes the pop-up with Keep this order |
| X21-8 | N | `full/51-seating-20p.yaml` | Game F (20 × 30): Players chips, "30 rounds played" note, seat 11 deals next, Test Uniform to seat 1 → Done → column TU, important Log row naming all twenty seats; moved back at the end. Then BQ1 as c3: "Pool · 6 seats · 1 out", the out player moves like anyone else, Cancel saves nothing |
| X21-9 | R | `two-device/` (to write) | admin reorders on A; B sees the columns move within 3 s and gets no pop-up |
| X21-10 | M | emulator | every S-screen (S01–S08) |

## PR 20 test cases (Going rogue: player, admin, creator — spec only, `docs/going-rogue-design.md`; codes reserved, tests written with the build)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| X20-1 | D | `supabase/tests/36_going_rogue_045.sql` | a player with a saved score reads a deleted game and sees it in `get_home_bundle.deletedGames`; no score → no access; public `/s/` still says deleted |
| X20-2 | D | same | `request_restore`: one ask per person per game, Log row, notices to creator + admins, refused for non-members / non-deleted games |
| X20-3 | D | same | the 30-day step (rewritten by 046): 31-day-old deleted game with no live result is hidden for good (`archived_at`), every row kept, one `game_archived` Log line; 29-day-old and result-held games untouched |
| X20-4 | D | — (not built: §6 item 4 is out of PR 20) | `restore_round` only when contiguous; `revert_round_edit` swaps live and retired rows; Pool recompute; admin-only; logged |
| X20-5 | D | — (not built: §6 item 5 is out of PR 20) | last-reachable-admin guard refused / allowed cases; `last_seen_at` stamped by the Home bundle |
| X20-6 | U | `tests/going-rogue.test.ts` | Home bundle maps `deleted_games`; "hidden for good on" date math; Ask button states; "Anil and Priya asked" line; G02 confirm text; Help + support card; migration / rollback / replay hook present; scorecard read-only guards |
| X20-7 | R | `e2e/roles/r05-deleted-game-ask-restore.yaml` | a1 deletes BREAKP1 (confirm says 30 days) → p01's Home shows Deleted games → read-only scorecard, no Add round → Ask → "Asked · date" → c1 sees "Player One asked to restore it" → Restore game → card is back. Runs under `deleted-games` / `scorecard` areas (`ci/select-tests.mjs`) |
| X20-8 | C | — (not built: needs items 4 + 5) | rogue-admin script (demote others, undo two rounds, edit one, delete, revoke session) → second admin recovers from Log and Deleted games |

## PR 22 test cases (No permanent delete: migration 046 `games.archived_at`, nightly `archive_deleted_games()`, copy; written, not applied)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| X22-1 | D | `supabase/tests/37_no_permanent_delete_046.sql` | schema: `archived_at`, `archive_deleted_games` service-only (not app, not anon), `purge_deleted_games` kept by name and deletes nothing, `game_archived` kind, 30 days unchanged |
| X22-2 | D | same | the nightly step hides exactly the 31-day-old game; counts of games, seats, rounds, scores, asks and Log rows are unchanged except the one `game_archived` line (System, anchored on the game, nothing on `purged_game_id`); 29-day-old and result-held games untouched; runs twice → 0; the 045 name does the same |
| X22-3 | D | same | archived game: scored player, deleting admin and creator cannot read it, see no bundle, no Home / Settings row, no Log row, cannot ask; `restore_game` → PT410 "hidden for good … support@ezscore.app"; `/s/` says deleted |
| X22-4 | D | same | dashboard SQL finds it by `share_code` with all 3 scores; clearing `archived_at` / `deleted_at` / `deleted_by` makes it a live game the player reads again |
| X22-5 | U | `tests/no-permanent-delete-pr22.test.ts` | 046 text has the column, the step, the kind, the cron `archive-deleted-games` and unschedules `purge-deleted-games`, PT410, support address; no `delete from` games / rounds / scores / seats / results / Log (the one delete left is 045's cleared ask on restore); rollback exists, drops the column and function, leaves the purge job off; replay hook wired; pgTAP 36 updated |
| X22-6 | U | same | `DELETE_GAME_BODY`, Deleted games supporting text, support card, Help › Hidden & deleted, `hiddenForGoodLabel`, the Settings screen and the restore e-mail never say "gone for good" / "erased for good" / "no longer exists" / "permanently"; `game_archived` → "Hidden for good" (red); r05 asserts the new card line |

## PR 19 test cases (First fixes from the break-the-app suite: F1 log out with a dead session, F2 offline relaunch wording, F3 refused pool limit pinned on screen, F6 20-player Standings starving the grid; no migration)

| Code | Type | Where | What |
| --- | --- | --- | --- |
| T19-1 | U | `tests/test-findings-pr19.test.ts` | F1: `authService.signOut` catches a rejected global sign-out, falls back to `signOut({ scope: 'local' })`, clears the device and never throws; `me.tsx` Log out always ends in `router.replace('/(auth)/login')` |
| T19-2 | U | `tests/test-findings-pr19.test.ts` | F2: `isNetworkError` tells "Network request failed" / "Failed to fetch" from "Auth session missing"; Home sets `signedOut` only when the server said there is no session, otherwise shows "Couldn't reach the server · You're still signed in" with Try again; the signed-out screen no longer carries the network text |
| T19-3 | U | `tests/pool-pr13.test.ts` (F3) | the problem box of the Game type step sits between the scroller and the bottom bar (`testID new-game-problem`), the custom limit field turns red while the number is out of range |
| T19-4 | N | `e2e/chaos/c12--revoke-session` | Log out after the runner deleted `auth.sessions` lands on `login-email`, "Couldn't log out" never shown (was red in runs 4–5) |
| T19-5 | N | `e2e/chaos/c11--net-off` | relaunch offline with a cached session shows Home or "Couldn't reach the server"; "You're signed out" must not appear |
| T19-6 | N | `e2e/chaos/c03` | `abc`, `0`, `50` in the custom limit: `new-game-problem` with the 51–999 line is on screen with no scroll after Start |
| T19-7 | CI | `ci/select-tests.mjs`, `tests/test-selection-pr17.test.ts` | new areas: `auth` now also matches `(tabs)/index.tsx`, `(tabs)/me.tsx`, `utils/supabaseErrors` and adds c11 + c12; `new-game` (`games/new.tsx`, `GameTypeStep`, `RulesForm`, `rulesDraft`, `gameSettings`) adds c03 |
| T19-8 | U + S | `tests/test-findings-pr19.test.ts`, `e2e/smoke/17-pool-wide-initials-20p.yaml` | run 6 flow 17: on the 20-seat completed pool the Standings card filled the screen and the grid had no height (`score-header-initials-2` never found). `PoolStandings` is capped at 38 % of the window (45 % landscape) and its rows scroll inside; the smoke flow now reaches the header without scrolling. `ci/select-tests.mjs` scorecard area also matches `PoolStandings` |

## PR 17 test cases (Test infrastructure: roster seed, chaos / roles / two-device / monkey suites, device matrix, dashboard, bug filing; no migration)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| T17-1 | U | `tests/test-selection-pr17.test.ts` | `ci/select-tests.mjs`: docs-only → no device; push → no device; an app change → smoke + the area's flows by name; infra change → every suite; `[ui-all]` / `[file-bugs]` tags; nightly and pre-release matrices; every mapped flow exists; the workflow reads the planner's matrix; the runner knows every suite and hook; the seed has every game a flow opens (T16-8) |
| T17-2 | D | `supabase/seed-break.sql` (applied after `seed-e2e.sql` in every device job and the volume job) | roster of 38 accounts (4 creators, 3 admins incl. non-playing, 20 players, spectator, 2 outsiders) + 63 placeholders; BREAKP1 (3 rounds + undone 4th, spectator), BREAKP2 (20 × 60), BREAKP4 completed in a result, BREAKP5 (creator not seated), BREAKP6 / BREAKP7 (offline, kill targets), BREAKQ1 (pool 101 with an out and a re-entry), BREAKQ2 (pool 201, 19 out), BREAKQ3 (pool 400 awarded), 38 games for one creator, a pending link; the 029 guard is lifted only while seeding and re-enabled |
| T17-3 | N | `e2e/chaos/c01`, `c02` | C16-1 double submit: Save round mashed 6× → one round, Log has one row; Complete confirm 4× → completed once |
| T17-4 | N | `e2e/chaos/c03`, `c04` | C16-6 / C16-7 bad input and huge numbers: `abc`, `0`, `99999` refused in the pool Custom limit with the 51–999 line; `#`, emoji, digit in an initials cell add nobody; a fifth digit is ignored (cap 9999), four-digit counts save, totals render, Undo removes them |
| T17-5 | N | `e2e/chaos/c05--net-off`, `c06` | C16-4 offline: the round is filled in online, wifi + data go off after the flow's first screenshot (runner hook), Save → "Could not save round", still Round 1; network back → saves once, Round 2, never Round 3 |
| T17-6 | N | `e2e/chaos/c07--kill-after`, `c08` | C16-5 kill mid-save: the app is force-stopped ~0.7 s after the pre-save screenshot; on relaunch the game is Round 1 or Round 2 with a matching Log, never half-saved, no error on open |
| T17-7 | N | `e2e/chaos/c09`, `c10` | volume on a device: BREAKP2 (20 × 60) opens within 10 s, swipes, Add round draws; BREAKQ2 with 19 outs completes, Awards lists 20, Winner takes all saves |
| T17-8 | N | `e2e/roles/r01–r04` | T16-3 must-nots: player sees View only and no Add round / Undo / Complete; spectator read-only and not in the header, no card for a pool they are not in; outsider sees no BREAK card; non-playing admin scores but is not a column |
| T17-9 | N | `e2e/two-device/*`, `ci/ui/run-two-device.sh` | T16-5/6 two emulators: device B adds a round and A shows it unprompted (realtime); both prefill and Save in the same instant → exactly one new round on both, the loser sees the conflict notice, Log has one row |
| T17-10 | T3 | `ci/chaos/monkey.sh` | `adb monkey` on the signed-in app, fixed seed 17, no system keys: 1,500 events on an infra PR, 5,000 nightly, 20,000 pre-release; a CRASH / NOT RESPONDING line or a logcat crash for the package fails the run |
| T17-11 | T3 | `ci/volume/run-stress.mjs` (pre-release tier next to the existing `run-volume.mjs` size ladder; local Supabase only, refuses a hosted URL) | V1 40 × 25 sequential save_round p95 ≤ 250 ms; V2 8 clients × 50 at once p95 ≤ 600 ms, no errors; V3 home list for a user in 50+ games ≤ 400 ms; V4 round 500 saves and 501 is refused by the guard; V5 the 20 × 60 game reads back ≤ 300 ms |
| T17-12 | I | `ci/ui/run-flows.sh` | every flow: logcat cleared before, crash buffer + ANR check after (a crash fails a passing flow and lands in `crashes.csv`), `screenrecord` video kept for failures (always for chaos), `--net-off` / `--kill-after` / `FLOW_FILTER` / `DEVICE_ROTATION` / `DEVICE_FONT_SCALE` |
| T17-13 | I | `.github/workflows/ci.yml` jobs `select` → `apk` → `ui` (matrix) → `volume` → `dashboard` | the APK is built once per run and shared; each device job checks its local anon key hash against the APK's; devices Pixel 6 (reference), Pixel 4a API 30, Pixel 7 Pro font 1.3, Pixel Tablet landscape; on a PR only smoke / full block, the rest warn; nightly / pre-release everything blocks |
| T17-14 | I | `ci/ui/build-dashboard.mjs`, gh-pages | one orphan commit per run (branch never grows), last 15 runs with screenshots, failure / chaos videos, crash lines, a Live panel polling the public Actions API every 60 s with links to running job logs |
| T17-15 | I | `ci/report/file-bugs.mjs` | one issue per failing flow or crash outside `known-bugs`, labels `bug` + `found-by-tests` (label created if missing), de-duplicated by title (comment on repeat, reopen if closed), project-board add attempted and skipped with a note when the token cannot; dry run unless `FILE_BUGS=true` (nightly, pre-release, `[file-bugs]`) |
| T17-16 | I | `.github/workflows/nightly.yml` | the one file main needs: at 09:00 UTC it asks CI to run the nightly tier on the top of the stack via `workflow_dispatch` (GITHUB_TOKEN may start that event) |
| T17-17 | N | `e2e/chaos/c11--net-off`, `c12--revoke-session` | relaunch offline with a cached session: no crash, a screen that explains itself within 30 s (finding F2, fixed in PR 19); Log out after the server session was revoked (runner deletes `auth.sessions` via psql) must still land on the login screen (finding F1, fixed in PR 19) |
| T17-18 | I | `scripts/realtime-probe.mjs` (two-device job, before the emulators) | subscribes like the app (postgres_changes on `games`, one id) and nudges the row through psql; green probe + red T1 = the app, red probe = the local stack (Realtime container log attached) |

## PR 11 test cases (Help redesign, `docs/help-design.md`; built Nov 18, no migration)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| HL11-1 | U | `tests/help-pr11.test.ts` | every route in `app/` has a topic (`ROUTE_TOPIC`); every topic has a purpose, 3–5 Need to know, ≥ 1 Tricky case, Also see; every screenshot file exists and is in `HELP_SCREENSHOTS`; every `HELP_WHY` and every anchored `?` resolves to a real section or Tricky id |
| HL11-2 | U | same | the ⋮ tables (scorecard, Add round sheet, Players · Admins row, My players row, saved result) list the `Menu.Item` titles / `SEAT_MENU_LABEL` values the code renders, in order |
| HL11-3 | U | same | no money / stake / prize / settle words; `[Chip]`s are the real tags; bold labels match on-screen strings; legacy sentences kept; Q11.16 "User settings" gone; markup round-trips |
| HL11-4 | U | same | index lists every topic once in Home order; search by alias, phrase, hyphenated word, empty; family colours from theme tokens; index reachable from Me and every help page |
| HL11-5 | U | same | mini helps: Game type keeps only live feedback; `InfoTip` reads "About <title>", Got it / Full guide, tap outside closes; `RulesForm` has limit / values / multiplier / re-entries ⓘ with the lock note folded in; Game settings ⓘ → scorecard help |
| HL11-6 | U | same | Why? links in the five dialogs (Give awards first · Save awards anyway · The scorecard changed · counted again · Settings locked) |
| HL11-7 | U | same | mini helps on every screen (Home, Deleted games, Settings, Hidden & deleted, Me, Results, Awards, Complete, Final scores, Players · Admins, Add players, Fix initials, New game): each section keeps its title plus a ⓘ, the paragraph is gone from the screen but its constant stays, every ⓘ topic#anchor resolves; `SectionCard` `tip` slot |
| HL11-8 | U | same | help copy matches PR 24 (#82): four-step New game (Next / Start game), Order of players (tap to number, undo, arrows, Clear / Done), ↺ re-entry score with grey cells above, footer inside the scorecard, Re-entry score / Late entry; no "Seating order", "Skip" or "asks who sits where" |
| HL11-9 | S | `smoke/01`, `02`, `06`, `12`, `16` | `?` on the scorecard and Results opens "Help · Scorecard" / "Help · Results" (02b, 06c); the Live ⓘ (01d), the Re-entries ⓘ (16c2) and the Deleted-results ⓘ (12h) open and Got it closes |
| HL11-10 | N | `full/50-help-notes.yaml`, `full/40` | `?` on Home, New game, My players, Me, Results opens its page; the index and search (screenshots 50*); the Deleted-results ⓘ (40h) |
| HL11-11 | M | emulator | read-through of every page against the spec; dark theme |

Legacy help tests (`HELP.*` strings in build3/build4/pool-pr13/…) read the same copy through `tests/_helpLegacy.ts`, which flattens a topic back to the old bullet text.

## PR 16 test cases (Test plan — review-first, `docs/test-plan/`; codes reserved)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| T16-1 | U | `tests/test-plan-coverage.test.ts` (to write) | `coverage.md` lists every route and every dialog / notice / alert / snackbar string; zero gaps |
| T16-2 | U | same | every `Fxx` in `flows.md` has a PNG; every W code used exists |
| T16-3 | N | `e2e/roles/*.yaml` (PR 17) | must-not assertions per role (CR / AD / PL / SP / OU) on D1 |
| T16-4 | N | `ui` device matrix (PR 17: `ci/select-tests.mjs` DEVICES) | smoke set on D2–D4, screenshots vs approved set |
| T16-5 | T3 | `e2e/chaos/*.yaml`, `ci/chaos/monkey.sh` (PR 17) | C16-1..10, `adb monkey` 20,000 events pre-release: no crash, no duplicate round (Robo: not started, see PR 17 flags) |
| T16-6 | S | `web/tests/*.spec.ts` (Playwright, to write) | `/r/` scorecard and result pages on Chromium + WebKit; wrong token → not found |
| T16-7 | T3 | `ci/volume/run-volume.mjs` + `e2e/chaos/c09` (PR 17) | database budgets V1–V5; 20 × 60 scorecard opens < 10 s on D1 (20 × 500 and the 30 × 20 result stay to do) |
| T16-8 | U | `ci/select-tests.mjs` + `tests/test-selection-pr17.test.ts` (PR 17) | every source path maps to a flow set |

## PR 15 test cases (Design consistency, `docs/design-audit.md`; 15a and 15b built)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| DC15-1 | U | `tests/design-tokens.test.ts` | no `Alert.alert` (and no `Alert` import), no `contained-tonal` (and `AppButtonMode` excludes it), every `borderRadius` outside `theme.ts` a `radius.*` token, Paper `Chip` only with `onPress`, `Snackbar` only inside `Toast`, `Searchbar` only inside `SearchField` |
| DC15-2 | U | `tests/design-audit-pr15a.test.ts` | every game screen title is `screenTitle()` → "Screen · S1" / "Screen"; `headerTitleAlign` unset in every screen and the stack defaults |
| DC15-3 | U | same | `formatWhen` ("Sat, Nov 14 · 7:49 PM", year only when not this year) is the one date formatter — no `toLocaleDateString`/`toLocaleTimeString` in screens or utils outside it; `#` + id the only ID badge |
| DC15-4 | U | same | Results picker selected cards use `secondaryContainer`/`secondary` (game yellow); the "Results" tag and past-result edge the result green; the Add round badge the game yellow |
| DC15-5 | S | `smoke/08-my-players.yaml` | the My players action bar (`my-players-actions`) and its Unregistered tile are on screen with the tab bar |
| DC15-7 | U | same as DC15-2 | A05: no "Not yet" / "Got it" / bar "Back to scorecard" in any screen; "Deselect games?" confirms with Deselect; Complete pairs Cancel + Complete game; Add round has a header arrow. A08: `ActionBar` shape, `nextLabel`. A10: no uppercase section headings. Q11.12 / Q11.14 / Q11.18 source checks. Every flow matches the new titles |
| DC15-8 | U | same as DC15-1 | A13 durations (3 s / 4 s / 10 s exception); A04 share icon + sheet entries and no ⋮ share items; A20 share · help · menu order and one `headerRight` on the saved result; A07 SearchField on three screens; A21 labels in tiles, titles and Help; A16 Complete strip; A19 EmptyState |
| DC15-6 | N | nightly | screenshot diff of 12 key screens against the approved set (first visual-regression job) |

## PR 14 test cases (Multiplier — spec only, `docs/multiplier-design.md`; codes reserved, tests written with the build)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| X14-1 | U | `tests/multiplier-pr14.test.ts` | `shortNumber`: one rule — K from 10,000, M from 1,000,000; never more than 5 characters including the sign; half away from zero; 999,500 → 1M; no ".0"; sign kept; 0 → "0"; CSV cases |
| X14-2 | U | same | actual = entered × the game's one multiplier everywhere; exact sums add to 0; the red total rule ignores display rounding |
| X14-3 | U | same | parsing 1–10,000, digits only, empty/0 → 1, over the cap → red text; absent key → 1; precedence game › user default › 1; Pool ignores it |
| X14-4 | U | same | Final scores / share: two columns to 7 digits, one from 8, never short; PDF blocks 5 / 4 / 3 from the widest value |
| X14-5 | U | same | Results: per-game multiplied contributions, `×N` header only when > 1, Winners exact, table K/M (mixed fixture) |
| X14-6 | U | same | Toggle default ON, per phone, hidden at ×1, banner when OFF; saved / shared data unchanged |
| X14-7 | D | `supabase/tests/34_multiplier_043.sql` | 043: result sums as bigint (2,280,000,000 saves), multiplier applied in SQL from `settings` at declare time, a `settings.multiplier` change on a game with rounds accepted and logged as one `settings_changed` row "Multiplier ×10 → ×5", a saved result unchanged after the game's multiplier changes, out-of-range refused, absent key → 1, rollback replay |
| X14-8 | S | `smoke/18-multiplier-change.yaml` (same flow as X14-10: a ×10 game shows the chip, the toggle and the Exact sheet; Final scores / Results exact are unit-covered by X14-4 / X14-5) | ×10 game end to end: chip, toggle, banner, Exact sheet |
| X14-9 | N | `full/50-multiplier-20p.yaml` | 20 players at ×10,000 portrait + landscape (every cell ≤ 5 characters, no clipping, same layout as 4 players), share one column, PDF 4-column blocks |
| X14-10 | S | `smoke/18-multiplier-change.yaml` | On a game with 3 rounds: Game settings → ×10 → ×5 → Save → confirm names 3 rounds → Cancel keeps ×10; Save → Apply to whole game → every cell / total re-priced, chip ×5, Log line; Start a new game instead → New game prefilled with the players and ×5; no rounds → no confirm |
| X14-12 | U | `tests/multiplier-pr14.test.ts` | Confirm gating: 0 rounds → no dialog; N ≥ 1 → text with N; three actions; the Start-a-new-game payload (players, settings, new multiplier) |
| X14-11 | M | emulator | every M-screen of the spec (M01–M22) |

## PR 13 test cases (Pool: two-screen New game, pool scorecard, Add round, re-entry, Complete → Award → Result; migrations 041 applied Nov 14 and 042 re-entries setting + limit-only lock applied Nov 15)

Spec: `docs/pool-design.md` (Sree's 14 decisions of Nov 14), mockups in `docs/pool-mockups/`.

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| P13-1 | U | `tests/pool-pr13.test.ts` 13.1–13.2 | Pool totals (a re-entry restarts at the re-entry score, an out keeps the score they went out at); Standings order (in lowest first, outs by round); points left and drops left (`ceil`) |
| P13-2 | U | same 13.3 | Round validation: plus points only, at least one 0 (two are fine, D6), every player still in scored, nobody out scored, someone lost; `overFullCount` is the one confirm |
| P13-3 | U | same 13.4–13.4b | Re-entry once per player, only while out, Re-entry on, pool not completed; re-entry score = highest still in; `afterRound` names who went out, who may re-enter, last player standing |
| P13-4 | U | same 13.5–13.5b | Award presets on the P12 table (winner takes all / by points left / 50-50 / entry per drop left / custom), rounding remainders to the winner, given-out line and "X points weren't given out. Save awards anyway?", payload and reopen; no money / stake / prize words |
| P13-5 | U | same 13.6–13.7b | Limits 101 / 201 / 251 / Custom 51–999, defaults 25 / 50 / 130, Re-entry on; profile defaults hold both kinds and "New game starts as"; `RulesDraft` parsing; Settings blocks; New game is a step (`new-game-next`) then `GameTypeStep` |
| P13-6 | U | same 13.8–13.8c | Pool round entry: plus draft, no sign key, Rummy = 0, Save gate; Edit round reopens hands as counts; `poolScoreTone`; the Add round screen drops Plus / Minus, Balance and the Rummy-share confirm and keeps "Are you sure?" |
| P13-7 | U | same 13.9–13.9b | Scorecard header number / initials / score, OUT struck, re-entered blue (`reentry` colour), Standings and Awards cards, settings lock after a round, leader = lowest in; every game yellow (light and dark), results green |
| P13-8 | U | same 13.10–13.12 | Awards pending / Awarded, `poolNeedsAwards`, `resultScoresOf` (awards as the pool's one line), picker never ticks an unawarded pool, Save blocked "Give awards first", result note; log labels; help bullets; no "stake" / "prize" UI string (greps every string literal) |
| P13-9 | D | `supabase/tests/32_pool_041.sql` (75) | Game P: `save_round` pool branch (negatives / rummy ≠ 0 / no zero / out player / missing in player refused; dealer skips outs; `player_out` logged), `pool_recompute`, `reenter_player` (once, on/off, score), `undo_last_round` undoes a re-entry first, `set_pool_awards` (Active / Closed refused, unbalanced saved, `awards_set` → `awards_changed`), `declare_game_result` "Give awards first" and awards as the contribution, `public_scorecard` seat fields, settings lock PT423, `scores_pool_sign` trigger |
| P13-10 | D | `ci/db/replay-rollbacks.sh`, `supabase/tests/27_rummy_negative_037.sql` | Rollback 041 drops the trigger / functions / columns and restores 036 `save_round`, 035 undo, 034 declare, 031 `public_scorecard`, 022 `seat_rows_json` and the 037 `scores_check`; forward replay restores 041; 027 accepts the constraint or the 041 trigger |
| P13-11 | S | `smoke/16-pool-game.yaml` | New game: pick four → "Next · 4 players" → Game type (Points first, then Pool: Re-entry, Settings link, players at the bottom) → Start → Skip the co-admin nudge → pool scorecard (Pool tag, Standings "Limit 101 · 100 in, 101 out") → Add round (no Plus / Minus; Drop 25 / Middle drop 50 / Full count 130; Rummy; 135 → "Are you sure?" → Keep 135 → cell "then 135, out") → Save → "Round saved" sheet (Zed out at 135, Re-enter Zed) → scorecard OUT R1 → Re-enter from Standings (blue, 50) → Complete (pool line) → Confirm → "Give awards" / "Give awards first" → Awards (Winner takes all all given out, By points left, Entry per drop left, Custom 400 → "100 not given out") → Save → "Save awards anyway?" → Complete page "Change awards" + "Add to Results" → scorecard Awarded + Awards card → Delete game (screenshots 16–16s) |
| P13-12 | S | `smoke/07-profile.yaml` | Settings: "New game starts as", Points defaults, Pool defaults with the limit chips, Custom and Re-entry (screenshots 07d, 07e) |
| P13-13 | M | emulator | Every changed screen in the PR body gallery (CI artifact `ui-screenshots-<slug>-smoke`) |
| T13-29 | U | `tests/pool-pr13.test.ts` 13.4 / 13.6b / 13.7 | 042 Re-entries: `reentryLimitOf` null / N / 0 / negative / 041 boolean; `reentryBlock` Unlimited (second re-entry fine) vs Limited 1 (`used`) vs 0 (`off`); labels Unlimited / None / 1 re-entry / 3 re-entries; draft Unlimited / Limited with count 0–99 and the exact error; `validateRules` 100 refused; profile key `poolReentryLimit` and the old `poolReentry` read; RulesForm has the two radios, the count field only for Limited, and `lockValues` greys only the pool limit |
| T13-30 | D | `supabase/tests/33_pool_reentries_042.sql` (26) + `32_pool_041.sql` adjusted | `pool_reentry_limit` for every shape; the limit is PT423-locked and Drop / Middle drop / Full count change with the Log line "Changed game settings · Drop 20→25 · Full count 80→130 · Middle drop 40→50" (important once rounds exist); Unlimited allows a third entry; switching to Limited 2 mid-game refuses the third with "They have used all 2 re-entries."; Limited 0 refuses with "Re-entries are off…"; Limited 3 re-enters at the highest score in; a player still in is refused |
| T13-31 | R | `ci/db/replay-rollbacks.sh` | rollback 042 first (once-per-player and the four-value lock back), forward 042 restores `pool_reentry_limit`, the limit-only lock and the labelled log |
| T13-32 | S | `e2e/smoke/07-profile.yaml`, `16-pool-game.yaml` | Settings Pool block: Limited reveals `settings-pool-reentries-count`, Unlimited hides it; New game screen 2 shows "Re-entries" and "Unlimited" |

## PR 10b test cases (APK 9 fixes: Home, My players / own initials, Add players, Profile, Add round, Results, share image, PDFs; migration 040 written, not applied)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| B10-1 | U | `tests/pr10b-apk9-fixes.test.ts` 10.1 | `RECENT_PAGE = 20`; `recentPaging` reveals from the loaded bundle before it fetches (`.range()` on the existing games query); Recent title has no count and sits on `surfaceVariant`; `home-recent-show-more`; no `onEndReached` |
| B10-2 | U | same 10.6 | Every saved cell `positiveContainer` (minus and 0 too); selected stays marigold; `gridColumns` 3 from 13 players portrait, 2 landscape; `hiddenCells` counts the cells below the fold for the "N more ▾" pill; a tick on saved cells |
| B10-3 | U | same 10.4 | Add players heading "Add new players by initials", F / L placeholders, Done summary "2 of 3 players saved. 1 row has letters you have not saved.", Backspace walks back, `add-players-unsaved` dialog, Delete for rows saved this visit, no "· Unregistered"; create path: `rememberMyPlayer` only (no second RPC); `collapseSpaces` |
| B10-4 | U | same 10.3 / 10.5 | "You" tag on your own My players row with only "Change initials" in its menu; Profile pencils, `me-edit-initials`, `setMyInitials`; `PasscodeField` hidden by default; passcode dialog fields first inside `KeyboardAvoidingView` |
| B10-5 | U | same 10.7 / 10.8, `tests/results-delete-pr9.test.ts` 9.1 / 9.6 | "Game by game" everywhere (page, PDF, text PDF, `/r/`), "Unique result ID · X" at the foot with tap-to-copy, no raw URL, Copy link in ⋮, no "Player" header, names shrink then wrap; delete note "S14 goes back to Completed (from Closed). Everyone loses this result. You can restore it for 30 days from Settings › Hidden & deleted."; Past results rows carry no Delete; non-admins see a "Make a result" fold |
| B10-6 | U | `tests/results-design.test.ts`, `tests/results.test.ts`, same 10.9 | `SHARE_SPLIT_LIMIT = 10`: positives left / negatives right until a side would pass ten, then the one ranked order half and half; 30 players all on the card; no "and N more", no link, no code, no "Saved …" at the top; render 540 dp → capture 1080 px off-screen on both the dialog and Final scores; web canvas 1080 px |
| B10-7 | U | same 10.11 | Colour rule: `GAME_SHARE_COLORS` and `designCss('game')` contain no `#15803D`; results keep it; Final scores card `tone: 'game'`, title "Final scores · Game S10", never cut (14 players balanced); game PDF: captions "Players 1–5 of 14", `rb n4` width, IDs in the legend not the heads, Game ID once at the foot, no `.game { page-break-inside }`; `totalsLine` |
| B10-8 | U | same 10.10 / 10.12, `tests/results-design.test.ts` | Results PDF flows (no `.page` boxes, no code at the top, `page-break-inside: avoid` on tables / band rows), Unique result ID + link once at the end, "Players a–b of N" captions, legend IDs, short blocks at the five-player width; file names `EZScore-Results-<ID>-YYYY-MM-DD.pdf` / `EZScore-Game-S10-….pdf`; icon data URI beside the brand |
| B10-9 | D | `supabase/tests/31_own_initials_040.sql` (34 checks) | `profiles.initials` with its check, `my_profile` keeps the 033 shape, `set_my_initials` (normalises, clears on empty, refuses a label held by a My players row, 23514 on a bad form), `seat_default_label` prefers the creator's own initials and falls back on a clash, `repair_round_gaps` renumbers 1,2,4,5 → 1..4 and moves `current_round`, idempotent, untouched games unchanged; rollback replay restores the 022 `seat_default_label` |
| B10-10 | S | `smoke/01-home.yaml` | Recent titled plainly (no "· N"), grey card and pills in the screenshot |
| B10-11 | S | `smoke/07-profile.yaml` | Pencils, "Your initials on scorecards", Change passcode with the keyboard open: all three fields visible (screenshot) |
| B10-12 | S | `smoke/09-new-game.yaml` | Heading "Add new players by initials", F / L subline, no "Unregistered" after a save |
| B10-13 | S | `smoke/10-scorecard-20-players.yaml` | Add round for 20 players: three columns (screenshot); when the "N more ▾" pill shows, tapping it scrolls the rest into view (screenshot); Back saves nothing |
| B10-14 | S | `smoke/05-complete-game.yaml` | Final scores: title "Final scores · S…" (A02), Share full details + Share final scores, no Back button |
| B10-15 | S + N | `smoke/12-results-zero-players.yaml`, `full/40-results-save-and-past.yaml` | No Delete chip on the rows; the result foot shows "Unique result ID · …" (screenshot); Delete from the page → toast runs out → Deleted + Restore |
| B10-16 | N | `full/41-share-images.yaml` | Game G Final scores card (marigold) and the results share dialog (green) side by side; no "Full details · …" line and no "and N more" on the card. The 1080 px file size is pinned by B10-6, not by Maestro |

## PR 9 test cases (Delete result visible + Undo, confirm when shared, Deleted + Restore; no migration)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| R9-1 | U | `tests/results-delete-pr9.test.ts` 9.1 | Consequence line for 0 / 1 / 2 / 3 games (PR 10b words: "S14 and S15 go back to Completed (from Closed). Everyone loses this result. You can restore it for 30 days from Settings › Hidden & deleted."); game numbers win over short codes |
| R9-2 | U | same 9.2 | `UNDO_DELETE_MS = 10000`; toast "Result deleted · S14, S15 are Completed again" (1 game "is", none "its games"); restored toast; shared-confirm title and body; row chip spoken label |
| R9-3 | U | same 9.3 | 30-day window inclusive of the 30th day, bad dates out, newest deletion first; the section note |
| R9-4 | U | same 9.4 | Shared marker: id to the front, cap 200 |
| R9-5 | U | same 9.5 | Result page: Delete block for managers only, consequence line, confirm only when `wasShared`, Undo toast backed by `restore_result`, back to the list when the toast closes untouched, ⋮ item routes to the same, picture and PDF shares mark the result |
| R9-6 | U | same 9.6 | Past results (PR 10b): no Delete chip on the rows — Delete, the shared confirm and Undo live on the result page; Deleted section from `list_hidden_and_deleted` filtered to 30 days, Restore chip; "Make a result" fold for non-admins |
| R9-7 | U | same 9.7 | `docs/results-delete.md` names D9.1–D9.3, `sync_closed_at`, `can_manage_result`, 30 days, the marker and `/r/`; Results help names the button, Undo and 30 days |
| R9-8 | D | `supabase/tests/30_results_delete.sql` | 9.1 delete → `closed_at` cleared, status untouched, off `list_game_results_page` / `results_holding_game`, `get_game_result` deleted + canRestore, Deleted list row with counts, Logs `result_deleted` row and summary; 9.2 a game in two live results stays Closed; 9.3 player / outsider / signed-out refused, an admin of every game may delete and restore; 9.4 restore by a player refused, by the deleter reverses everything, Logs `result_restored`; 9.5 anon `public_result` deleted with the saved standings; a second delete is harmless |
| R9-9 | S | `smoke/12-results-zero-players.yaml` | The saved result shows "Delete this result" with the consequence line (screenshot) |
| R9-10 | S + N | `smoke/12-results-zero-players.yaml` (game G), `full/40-results-save-and-past.yaml` (game A) | Delete this result → toast with Undo (screenshot) → Undo → "Result restored…", Scores back; open the row again → Delete on the page → toast runs out → Deleted tag + Restore + 30-day note (screenshot) → Restore (PR 10b: the rows have no Delete) |
| R9-11 | S | `smoke/15-delete-shared-result-confirm.yaml` | Share the picture (Back closes the sheet) → Delete this result → "Delete a shared result?" (screenshot) → Cancel keeps it |

## PR 7 test cases (Add players to this game, New game picker labels, Players · Admins; no migration)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| P7-1 | U | `tests/add-players-pr7.test.ts` 7.1 | Total = saved seated + staged (D7.1: spectators and non-playing admins never count); "Added now: 0 · tap a player below to add them" / "Added now: 2 (yellow ring)"; the button reads "Return to game" with no count; title "Add players to this game"; Return to game and the two tiles sit under the strip |
| P7-2 | U | same 7.2 | Tiles "Add new players" and "From database" (spoken "Add players to this game from the EZ Score database"); the search box is pale yellow with "Search name, initials or #ID" on both the picker and Find player; "Registered players only." gone from the screen (help keeps it) |
| P7-3 | U | same 7.3 | Players · Admins: a big outlined "Add non-playing admin" button (same spoken label "Add admin by Player ID" the flows use) with the one-line note; the dialog title matches |
| P7-4 | U | same 7.4, `tests/nov10-owner.test.ts`, `tests/design-nov12.test.ts` | D7.2: no "You" tag on the picker, Players · Admins or My players; the organiser is still pinned first and spoken "(you)" |
| P7-5 | U | same 7.5 (table) | One rule for the registration tag over both label helpers: Registered / unknown / merged → no tag; unregistered → Unregistered; pending → Pending registration; link pending → Link pending |
| P7-6 | U | same 7.6, `tests/home-and-players.test.ts`, `tests/build3.test.ts` | The three tag sites call `visibleRegistration`; the four text sites (Players · Admins preview, Link dialog, Find player hint, help) print no "Registered"; help stays ≤ 7 short bullets per screen |
| P7-7 | S | `smoke/09-new-game.yaml` | New game: "Add new players" and the database tile, "Add Sree Test (you)" first, no "You" and no "Registered" text on the screen |
| P7-8 | N | `full/32-add-players-to-game.yaml` | Game H Players/Admins → Add new player: "Total, 3 players", "Added now: 0…"; add R K and C D → "Total, 5 players", "Added now: 2 (yellow ring)" (screenshots); Return to game → RK and CD columns; Add admin by Player ID 5 → Otto Outsider under "Admins not playing", no column; cleanup removes R K and C D so `full/80` sees 3 columns |
| P7-9 | N | `full/50-help-notes.yaml` | Help opens from New game by its new tile name; Home help says "Two buttons" (the flow pinned PR 4's "Three buttons" until now — fixed here) |

## PR 5 test cases (Home bottom buttons, My players badge, Light default, game numbers 038)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| H5-1 | U | `tests/home-pr5.test.ts` H5-1 | Badge text: count, `99+` past 99, nothing while unknown; spoken label "My players · N" |
| H5-2 | U | same H5-2 | Bottom bar items are Home and Profile only; the players route is `href: null` with a "Back to Home" arrow; a route with no item is not drawn |
| H5-3 | U | same H5-3 | Results and My players share one row where Results was; cached count then fresh; Live / Recent headers, the game cards and New game are unchanged (Sree: buttons only) |
| H5-4 | U | same H5-4, `tests/design-nov12.test.ts` | `DEFAULT_APPEARANCE = 'light'` read by the context (default + initial state) and the settings reader; a saved Phone / Dark choice wins; `app.json` keeps `automatic` so Phone still follows the OS |
| H5-5 | U | same H5-5, `tests/build4.test.ts` | Home help: "Two buttons…", badge sentence |
| H5-6 | U | `tests/game-labels-028.test.ts` | Local games: completed games free their number (038 rule), a live one holds it |
| H5-7 | D | `supabase/tests/28_game_numbers_038.sql` | Fresh circle S1, S2; Completed → next is S1 again; Closed and Deleted free; the lowest hole is filled; Pool is its own series; another circle holds P1 / S1 at the same time; a My players member's live seat counts and stops counting on completion; a Reopened game keeps its label (two live S1, flagged); labels never change; no backfill |
| H5-8 | D | `ci/db/replay-rollbacks.sh` | Rollback 038 restores the 028 rule (Completed blocks); forward replay restores 038; safe to run twice |
| H5-9 | S | `smoke/01-home.yaml`, `smoke/08-my-players.yaml` | Home: `home-my-players` button with `home-my-players-badge`, bottom bar "Home" + "Your profile"; My players opens from the button, "Back to Home" returns |
| H5-10 | N | `full/60-dark-mode.yaml`, `full/61-first-launch-light-night-phone.yaml` | Dark set and back to Light (the default); `ci/ui/run-flows.sh` turns night mode on for `*night-phone*`: a cleared first launch on a dark phone opens Light (screenshot) |

## PR 4 test cases (Scorecard header, one scroller, players chip, footer lines; no migration)

| # | Kind | Where | What it proves |
| --- | --- | --- | --- |
| A4-1 | U | `tests/scorecard-pr4.test.ts` A4-1 | Header height = initials + total + DEALS line heights + 4 dp bar + padding (about 68 at font scale 1 on 5 columns); font scale 1.3 is capped at 1.2 and grows the box instead of clipping; landscape loses 2 dp of padding, never a line |
| A4-2 | U | same A4-2 | 10 and 20 players on 390 dp: 38 dp columns, 12/12/8 pt type, the DEALS word gives way to the cards icon below 44 dp; landscape 844 dp with 10 players keeps full-size type with no sideways scroll |
| A4-3 | U | same A4-3 | Rows keep 48 / 42 / 34 at font scale 1 and grow (capped at 1.2) with the phone font |
| A4-4 | U | same A4-4 | Strip chip "10 players" / "1 player" from the seated players, not from who has scored |
| A4-5 | U | same A4-5 | Footer lines for 0 / 1 / 3 admins: `Creator:`, one `Admin:` per admin, `Unique game ID:` = share code upper-cased (D4.1); no "Game S16" (it is in the strip); landscape joins them with " · " |
| A4-6 | U | same A4-6 | **Rewritten in PR 10a**: the header row is pinned above one vertical scroller; inside it the frozen round column stands beside one sideways scroller whose rows carry `contentWidth`; the header follows the sideways offset on the native driver; no sticky-header trick, `createScrollSync` is gone (D4.2), no fixed header/row heights, `maxFontSizeMultiplier` on every table text, the footer sits under the card |
| A4-7 | S | `smoke/02-scorecard.yaml`, `smoke/03-scorecard-landscape.yaml` | Game A portrait and landscape: `HT` and `DEALS` visible, "4 players" chip, `Creator:` line and `Unique game ID: GAMEA1` (landscape: one line); PR 10a layout gate on the fitting case (`smoke/02`) |
| A4-8 | S | `smoke/10-…`, `smoke/11-…-landscape.yaml` | Game F (20 players): "20 players" chip, header renders at 38 dp columns portrait and landscape, two swipes right; **PR 10a layout gate**: `score-header-2` and a `score-cell-2-*` visible together (fails when the header collapses into a stack) |
| A4-9 | N | `full/20-scorecard-20-players-swipe.yaml` | Three swipes reach header `TU` (index 1) with its scores under it in the same scroller; the frozen `RND` column stays |
| A4-10 | N | `full/21-scorecard-font-scale.yaml` | `ci/ui/run-flows.sh` sets the phone font to 1.3 for any flow named `*font-scale*`: Game A header shows `HT`, `DEALS`, the chip and the footer whole; Game F renders at 20 columns |

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
