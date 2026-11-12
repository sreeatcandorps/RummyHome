# Database updates to review

These two files are **not applied** by the app, by this change, or by any script. Nothing here has been run against Supabase. When you are ready, open the Supabase SQL editor and run each file once, in order, after `010_results_list_page.sql`. Each file is safe to run again: it adds only what is missing and replaces its own functions.

The app keeps working before you do this. Screens that need the new player sign-up say “This isn't available yet.” They do not show file names or editor steps. New game still lists and searches the people already in My players.

## 011 — player identity

File: `supabase/migrations/011_player_identity.sql`

What it does, in plain English:

- Gives every profile a status: registered (a real account), unregistered (you typed their name and they have not signed up), pending (a sign-up is in progress), or deleted / merged.
- Lets you create a player who does not have an account yet. You type a first name and a last name (initials are fine). The app shows the first letter of each, such as SK. That player is tied to you until they sign up. They are not a second login. A first name or a last name by itself is not saved.
- Stores an optional zip code and remembers when a player was deleted.
- One email address can belong to only one real account. The comparison ignores capital letters and extra spaces. If old rows already share an email, the file skips that rule and leaves a note instead of failing.
- Adds a private list of sign-up requests (who invited whom, which email, and whether it is still open) and a short notice list so you can see “they said yes” or “they said not me.”
- People who are signed in can no longer read every profile in the project. They see their own row, players they created, and players they have played with.

## 012 — player numbers and claim links

File: `supabase/migrations/012_player_numbers_and_claim_links.sql`

Run this only after 011. What it does:

- Gives every player a permanent number, shown as #1, #2, #3, and so on. Existing players get numbers from oldest to newest. A number is never reused and never changed. It is not a password and it is not how someone signs in.
- Replaces “type their email and we invite them” with a share link. You tap Share, the phone opens WhatsApp or text, and the link works once for 14 days. Sharing again turns the old link off. The database stores only a hash of the link, not the link itself.
- Lets someone who already has the app type a player number at sign-up. You then see “#42 wants to claim this player” and only you can approve it. They can ask a few times a day, not unlimited times.
- My players, New game, and Find player show the #number. A player with no number yet still shows their older short code, so the list does not go blank. Deleted and merged players stay out of the list. A missing status is treated as a normal registered player, so old rows are not hidden.
- Find player still matches a name, the older short code, or the #number (#42 or 42). A partial email matches nobody. A phone number matches nobody.

## 013 — results privacy (fix for "new account sees everyone's results")

File: `supabase/migrations/013_results_privacy.sql`. Run after 010 (011/012 can be before or after). Safe to re-run.

Not applied by this change. Until it runs, the server still hands every past result to any signed-in account; the app's own check only protects the result detail screen, because the list the server returns carries no player ids to filter on.

What it does:

- Adds `can_see_game_result(result_id)`: true for the person who declared the result, for anyone seated in one of its games, for the creator or an admin of one of its games (even if they did not play), and for app admins. Watching a game through its public live link does not count.
- `get_game_result`, `list_game_results` and `list_game_results_page` now return only those results. A result that is not yours comes back as nothing, exactly like one that does not exist.
- A combined result (several games) is visible to anyone connected to at least one of them. The declarer chose to publish those games together.
- The creator of a game (`games.created_by`) counts even without a `game_players` row, so an organiser who never sat down still opens their own result.
- `get_game_result` adds each game's own number (`label`: "G7") from the live `games` row to the stored sheet, so a game keeps its number in every result. Stored result rows are read, never rewritten.

Check after running it: sign in as an account with no games and open Results. The past-results list must be empty.

## 014 — save a round in one transaction (fix for the blank round)

File: `supabase/migrations/014_save_round_atomic.sql`. Run after 001. Safe to re-run. Independent of 011–013.

Not applied by this change. The app works without it: when the function is missing the app falls back to the old three-request save, which is now self-healing (an empty round left by an interrupted save is reused on the next attempt; a duplicate submit of an already saved round is ignored; a failed Edit round puts the old scores back). Applying 014 makes the whole save one database transaction, so an interrupted save can no longer leave a round with no scores.

Likely cause of the blank round seen on Nov 6: the rounds row was written, the connection dropped before the scores rows went in (or the app's request timeout fired), and the next save of that round number then failed on the unique round key. The empty round shows as a blank row.

Repair for an existing blank round: open the scorecard, choose Edit round, pick that round, enter the scores and Save. The empty row is retired and the real scores take its number. No SQL needed.

## 015 — link an unregistered seat to a Player ID

File: `supabase/migrations/015_link_seat_to_player.sql`. Run after 012. Safe to re-run.

Not applied by this change. Until it runs, Players in this game → ⋮ → Link to a Player ID shows "needs a database update (migration 015)"; everything else on that page works.

What it does: `link_seat_to_player(game, seat, target)` lets a game admin who manages an unregistered player hand that seat, with its scores and dealer turns in this game only, to a registered account found by its Player ID. It refuses when the caller is not a game admin, when the seat is not an unregistered/pending player the caller manages, when the target is not a registered unmanaged account, or when the target is already in the game. A placeholder left with no games is marked merged and its open claim links are revoked.

## 016 — remove a seat only while every round score is 0

File: `supabase/migrations/016_remove_seat_if_no_scores.sql`. Run after 015 (needs `is_game_admin`, `rounds.undone_at`, `game_players.seated`). Safe to re-run. Rollback: `supabase/rollback/rollback_016_remove_seat_if_no_scores.sql` (drops the function; removals already made stay).

Not applied by this change. Until it runs, Add players to game → × on a saved seat still works for a player with **no** rounds (a plain seat delete, which admins may do), but a player who has rounds — even all zeros — shows "Removing a player who has rounds isn't available yet"; nothing crashes. The app checks the rule first either way.

What it does: `remove_seat_if_no_scores(game, profile)` lets a game admin take a seated player out of an open game when that player has no score rows, or when every one of their live round scores is exactly 0 (checked per round, never the total). It deletes those zero rows and the `game_players` row, clears the player as dealer of any round, and refuses when: not signed in; not a game admin; the player is not in the game; the game is closed; any live round score is non-zero (same message as the app shows); or fewer than two seated players would remain. Verified on a scratch Postgres 16 loaded with 001–015: anon/stranger/non-admin refused, non-zero blocked, all-zero seat removed with its zero rows, no-row seat removed, two-player guard, closed guard, re-run and rollback.

## 017 — Link to a Player ID: a non-playing admin or viewer may take the seat

File: `supabase/migrations/017_link_seat_takeover.sql`. Run after 015 (replaces its function). Safe to re-run. Rollback: `supabase/rollback/rollback_017_link_seat_takeover.sql` (puts the 015 version back; links already made stay).

Not applied by this change. Until it runs, the app lets you pick a co-admin who is not playing, or a viewer, as the Player ID for an unregistered seat, but the server (015) still answers "They are already in this game." and nothing changes; everyone else links as before.

What it does: same checks as 015 (signed in, game admin, the seat is an unregistered/pending player you manage, the target is a registered unmanaged account), with two changes found in the Nov 10 test. A target who is already in the game as a **non-playing admin** or a **viewer** now takes the seat: their old membership row is removed, the seat row becomes theirs, an admin stays `game_admin` and is now seated. A target who is already **seated** is still refused ("They are already playing in this game."). And when you link a seat to your own Player ID, no self row is written to My players. Verified on a scratch Postgres 16 loaded with 001–016: seated target refused, non-playing admin takes seat (keeps admin, one row, scores and dealer moved, placeholder merged and dropped from My players), viewer takes seat as a player, outsider linked and added to My players, no self row, stranger refused, anon has no execute, rollback and re-run.

## 018 — results say which games were reused and carry Player IDs

File: `supabase/migrations/018_results_reuse_and_player_ids.sql`. Run after 017. Safe to re-run. Rollback: `supabase/rollback/rollback_018_results_reuse_and_player_ids.sql` (puts the 013 versions of `get_game_result` and `list_game_results_page` back and drops the helper; no data to undo).

Not applied by this change. Until it runs, the app still works: a saved result works out the reused games itself by comparing each game's Closed time with the result's save time, and Player IDs under the totals and in the by-game table come from the games' seats. Past results cards show the reuse flag only once 018 is in (the list has no games to compare).

What it does: no table or stored row changes. `reused_game_ids(result)` lists the games of a result that an earlier result already contained. `get_game_result` adds `reusedGameIds` and gives each `sheet.players[]` entry a `playerNo` (from `profiles.public_player_no`, null when none); `list_game_results_page` adds `reusedGameIds` to each row. Privacy rules from 013 are unchanged. Verified on a scratch Postgres 16 loaded with 001–017: declaring a result closes its game; a second result that re-uses that game reports it as reused while the new game is not; `get_game_result` returns the reused list, Player IDs, and G labels; the list page reports 1 reused on the new result and 0 on the old; an outsider still sees nothing; rollback removes both keys and the helper; re-apply restores them.

## 019 — security and concurrency fixes (found by the CI database tests)

File: `supabase/migrations/019_security_and_concurrency_fixes.sql`. Run after 017 and 018. Safe to re-run. Rollback: `supabase/rollback/rollback_019_security_and_concurrency_fixes.sql` (puts the 014 `save_round` and 016 `remove_seat_if_no_scores` back, drops the `my_profile` view, restores whole-table read access on profiles, drops the role lock; no data to undo).

Not applied by this change. Until it runs, the two security holes below are open on the live project, so apply it soon. The app from Nov 11 on works either way: it reads your own row from `my_profile` and falls back to `profiles` when the view is missing, and it shows the same friendly message for the old raw database error.

What it does, in plain English:

- **Nobody can make themself an app admin.** A signed-in account could run one update and set its own role to `app_admin`, which opens every game and every result. A trigger now refuses any role change unless the person is already an app admin, or the change comes from the SQL editor / service role (no signed-in user). Sending your own unchanged role back (a whole-profile save) is still fine.
- **Email, phone and zip code are yours alone.** Any signed-in account could read every registered profile's email, phone and zip straight from the table. Reading those three columns is now refused for other people; name, avatar, Player ID, status and initials stay readable (the 011 rule about *which* players you see is unchanged). You read your own full row through the new `my_profile` view. Signed-out visitors read nothing from profiles.
- **Two admins saving the same round.** Saves on one game now run one at a time. If someone else saved the same round first with the same scores, the second save is a harmless repeat. If their scores differ, the second admin sees "Round N was just saved by someone else. The scorecard has been refreshed; check it before you save again." instead of a database error, and the scorecard reloads. Two people editing the same round at once: the second edit waits and then wins, as if they had edited one after the other.
- **Removing a player while a round is being saved.** The removal waits for the save to finish, then removes the player and all of their zero rows, so no score is left behind for a player who is not in the game. In the other order the save waits, then says "The players in this game changed while you were scoring" so the admin can check the round; nothing is written.

Verified on a scratch Postgres 16 loaded with 001–018 and the CI seed: 192 pgTAP checks, 31 two-client race checks, and the rollback replay (apply rollback 019, then 018 → 013, re-apply 013 → 019, apply each a second time) all pass.

## 020 — performance: faster visibility queries, bundle RPCs, indexes

File: `supabase/migrations/020_performance_rpcs_and_indexes.sql`. Run after 017, 018 and 019. Safe to re-run. Rollback: `supabase/rollback/rollback_020_performance_rpcs_and_indexes.sql` (drops the bundle functions and the four indexes, puts the 006/012/018 versions of the three visibility functions, the 002 policies and the 018 `get_game_result` back; leaves 019 untouched; no data to undo).

Not applied by this change. Until it runs, the app works exactly as before: it tries each new function once, gets "function not found", and uses the old requests for the rest of the session. Nothing a user sees depends on it.

What it does, in plain English:

- **The three "which games can I see" functions no longer scan every game.** `list_visible_game_ids`, `list_new_game_candidates` and `list_game_results_page` were reading the whole games table on every Home open and every Results open (about half a second each at 30 000 games). They are rewritten as index lookups with the same answers (the email-match path for players seated by email is kept). Four small indexes are added.
- **Row-level security costs less.** The policies on `games`, `game_players`, `rounds` and `scores` ask "am I an admin / a member" once per query instead of once per row. Same rules, same answers.
- **One request per screen.** `get_game_bundle(game)` returns the game, its seats and its live scores in one call (the scorecard used four). `get_home_bundle(limit)` returns your profile, your visible games, your creator notices (and marks them read), your open claim requests and your My Players list in one call (Home used up to 17). `list_result_candidates(limit)` returns the games you can pick for a result with their seats and server-side totals (the picker used to download every score of every game). `get_game_result` now also carries each game's rounds, so a result sheet is one call.
- **Privacy is unchanged.** Every bundle checks visibility with the same helpers the table policies use, returns only names, Player IDs and status for other people (never email, phone or zip), and is refused for signed-out visitors. The 019 role lock and profile column grants are not touched.

Verified on a scratch Postgres 16 loaded with 001–019 and the CI seed: 253 pgTAP checks (61 new, all about who gets what from the bundles), 31 two-client race checks, and the rollback replay (apply rollback 020, check the bundles are gone and 019 is intact, re-apply 013 → 020, apply each a second time) all pass. Timings before/after are in `docs/performance/RESULTS.md`.

## 021 — one account per email (fix for "I could sign up twice with the same email")

File: `supabase/migrations/021_email_uniqueness.sql`. Run after 020. Safe to re-run. Rollback: `supabase/rollback/rollback_021_email_uniqueness.sql` (drops the trigger, the index and the report function; 001's `profiles_email_key` and 011's `profiles_email_normalized_key` stay; no data to undo).

Not applied by this change. Never deletes, merges or changes an existing row, and never touches the `auth` schema.

What happened: Supabase Auth never created a second account. With "Confirm email" on, a repeat sign-up for an existing address gets a *fake success* answer (a user object with no identities and no session) so that the sign-up form cannot be used to find out who has an account. The app read that as "account created" and showed "Check your email"; the first account and its passcode were untouched. The app now recognises that answer and says "An account with this email already exists. Sign in or reset your password." This migration adds the database side:

- **Emails are stored one way.** A trigger trims and lowercases `profiles.email` on insert and update (a blank email is stored as no email). `Sree@Example.com` and `sree@example.com ` are the same email.
- **One profile per email, any case.** A unique index on `lower(btrim(email))` over every profile that has an email (011's index skipped unregistered players; this one does not). It is only created when the table has no duplicates by case.
- **Duplicates are reported, not fixed.** If duplicates exist the migration prints each one as a NOTICE (profile id, stored email, name, status, whether it is an account or an unregistered player, whether the account's email is confirmed) and skips the index. The same list is available any time with `select * from public.duplicate_profile_emails();` (service role / SQL editor only). Decide what to do with each pair, then re-run 021 to get the index.

Supabase dashboard: **no setting change.** Keep Authentication → Providers → Email → "Confirm email" ON (the Player ID linking flow needs a verified email). If it is ever turned off, Supabase answers a repeat sign-up with "User already registered" instead, and the app shows the same message.

Verified on a scratch Postgres 16 loaded with 001–020 and the CI seed: 273 pgTAP checks (20 new), 31 two-client race checks, and the rollback replay (apply rollback 021, check 011 and 019 are intact, re-apply 013 → 021, apply each a second time) all pass.

## 022 — scorecard initials per owner (approved Nov 11, 6:10 PM PT; names live, no refresh, 6:30 PM)

File: `supabase/migrations/022_player_initials.sql`. Run after 021. Safe to re-run. Rollback: `supabase/rollback/rollback_022_player_initials.sql` (drops the two columns — stored initials and seat labels are lost and the app derives labels from names again, as before — the generator functions, triggers and the two RPCs; restores `list_my_players` (012) and `seat_rows_json` (020)).

Not applied by this change. Adds columns and fills them; never deletes or renames a row.

What it does:

- **`my_players.initials`** — the letters a player gets in the scorecard columns of games this owner creates. Unique within that owner's list (`my_players_owner_initials_key` on `(owner_id, initials)`); two owners may label one person differently. Default: first + last initial; when that is taken, three letters from the name (Suresh Kumar → SUK, then SKU, SRK…); a digit only when every letter form is used. The owner may type any 2–3 letters (`set_my_player_initials`). A before-insert trigger fills the default, so every existing add path (`add_my_player`, `touch_my_players`, `create_unregistered_player`, the claim/link merges) keeps working unchanged.
- **Backfill is deterministic.** Existing rows are filled oldest first (`created_at, owner_id, player_id`), so the person who joined a list first keeps the short form.
- **Names are never copied.** Lists always show the player's current profile name (`list_my_players` reads `profiles.display_name`). A rename changes nobody's initials; the app shows a small "Name changed" note on that player when the letters no longer fit.
- **`game_players.label`** — the column letters of one seat, fixed when the seat is created (the creator's `my_players.initials` for that player, else the first free form in the game). Existing seats are backfilled in seat order. `seat_rows_json` (so `get_game_bundle` / `get_home_bundle`) returns it; a later My players edit does not change a game already started. `set_seat_label` lets a game admin change one column (unique within the game); when the caller created the game their My players entry follows.
- **`public.initials_candidates(text)`** mirrors `utils/initials.ts`; both are checked against the same table of names.

Verified on a scratch Postgres 16 loaded with 001–021 and the CI seed: 328 pgTAP checks (55 new in `supabase/tests/12_player_initials_022.sql`: generator parity, trigger defaults, per-owner uniqueness, oldest-first backfill after a re-run, live names after a rename, the three RPCs, seat labels fixed at seat time, RLS), 31 two-client race checks, and the rollback replay (rollback 022 → 013, re-apply 013 → 022, apply each a second time) all pass.

Read-only checks after applying (nothing is changed):

```sql
select count(*) filter (where initials is null) as missing, count(*) as rows from public.my_players;
select owner_id, initials, count(*) from public.my_players group by 1, 2 having count(*) > 1;   -- must be empty
select count(*) filter (where label is null) as missing, count(*) as seats from public.game_players;
```

## Apply order for the Nov 10–11 batch

017–020 were applied on Nov 11 (~11:25 AM PT). 021 and 022 are unapplied. Paste each into the Supabase SQL editor as its own run, in this order, and read the NOTICE lines 021 prints:

1. `supabase/migrations/021_email_uniqueness.sql`
2. `supabase/migrations/022_player_initials.sql`

Read-only checks that go with 021 (nothing is changed):

```sql
select * from public.duplicate_profile_emails();
select lower(email), count(*) from auth.users group by 1 having count(*) > 1;
```

## Public scorecard page

This is not a database change. `public/scorecard.html` (and the same file at `web/scorecard.html`) does not contain the project URL or the anon key. It contains the placeholders `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__`.

Before the page is published, fill those in from the environment and publish only the copy:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
node scripts/inject-scorecard-config.mjs
```

That writes `dist/scorecard.html`. Put that file at `https://ezscore.mindweavetech.com/scorecard.html`. Do not commit `dist/scorecard.html`, and do not put the key in the link. The anon key is the public client key already used by the app. It is not the service role key.
