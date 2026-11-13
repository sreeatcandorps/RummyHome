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

## 023 — hide and soft delete (approved Nov 11, 10:59 PM PT, item 1)

File: `supabase/migrations/023_hide_and_soft_delete.sql`. Run after 022. Safe to re-run. Rollback: `supabase/rollback/rollback_023_hide_and_soft_delete.sql` (drops `hidden_games`, the delete/restore RPCs and the `deleted_at` / `deleted_by` / `removed_at` columns — every hidden or deleted mark is lost and everything shows again; a game removed from a result is back in it — and restores the previous bodies of each reader 023 rewrote: 020, 018, 013, 009, 006).

Not applied by this change. Adds columns and a table; never deletes a row. "Delete" here is a timestamp.

What it does:

- **Hide** (`hide_game` / `unhide_game`, `hidden_games(owner_id, game_id)`): per person, Home only. `get_home_bundle` leaves hidden games out and returns `hidden_count`; `visible_games(p_limit, p_include_hidden)` keeps them for everything else (Results picker, stats, open by link).
- **Delete game** (`delete_game`, creator or game admin): sets `games.deleted_at/deleted_by`. Gone for everyone: the `members read games` policy, `list_visible_game_ids`, `can_read_game`, Home, `list_new_game_candidates` (Frequent sort and play counts), the Results picker, `public_scorecard` (answers `{deleted: true}`; the share page says "This game was deleted."), `get_game_bundle` (answers `{deleted: true, game: {id, game_number, deleted_at, can_restore}}`). `my_players.games_together` goes down by one for the creator's rows and back up on restore. If saved results hold the game, each `game_result_games` row gets `removed_at`; the result is totalled again without it (`result_places_json`), its `reusedGameIds` are recomputed, and the game's `closed_at` follows the live results that still hold it (`sync_closed_at`). `results_holding_game(game_id)` gives the app the "This game is in result R3…" warning before the call.
- **Restore game** (`restore_game`, the deleter or a creator/admin): clears the stamp. Results it was removed from are **not** changed; the answer lists them so the app can say so.
- **Delete result** (`delete_result`, the declarer, an app admin, or an admin of every game in it): sets `game_results.deleted_at/deleted_by`; its games are no longer Closed (unless another live result holds them) and can go into a new result. `restore_result` reverses it. `get_game_result` answers `{deleted: true, canRestore}` for a deleted result; `list_game_results_page`, `can_see_game_result` and `reused_game_ids` skip deleted results; `declare_game_result` refuses a deleted game.
- **`list_hidden_and_deleted()`** feeds Settings > Hidden & deleted: games I hid, deleted games I may restore, deleted results I may restore.
- `get_game_result` now also returns `removedGameIds` and `canManage` (whether the viewer may delete it).

Verified on a scratch Postgres 16 loaded with 001–022 and the CI seed: 399 pgTAP checks (71 new in `supabase/tests/13_hide_delete_023.sql`: hide is per user and Home only, delete permissions, removal from two results with recomputed standings, closed_at sync, games_together ±1, exclusion from visible ids / Home / picker / stats / public scorecard, restore rules, a restored game stays out of its old results and can be declared again, delete/restore result, a deleted game cannot be declared), 31 two-client race checks, and the rollback replay (rollback 023 → 013, re-apply 013 → 023, apply each a second time; 70 checks) all pass.

Read-only checks after applying (nothing is changed):

```sql
select count(*) from public.games where deleted_at is not null;            -- 0 right after applying
select count(*) from public.game_results where deleted_at is not null;     -- 0 right after applying
select count(*) from public.hidden_games;                                  -- 0 right after applying
```

## 024 — game-started and result emails, public results page (approved Nov 11, 10:59 PM PT, item 3; amended 11:03 PM)

File: `supabase/migrations/024_emails_and_public_results.sql`. Run after 023. Safe to re-run. Rollback: `supabase/rollback/rollback_024_emails_and_public_results.sql` (drops `email_outbox` and the six functions, the three `profiles` columns — every preference and unsubscribe token is lost; everyone is back to "on" when 024 is applied again — and restores the 023 `declare_game_result` and `my_profile`).

Not applied by this change. Adds three columns, one table and six functions; `declare_game_result` is replaced so it queues the result email itself. Nothing in the database sends mail or calls out.

What it does:

- **Preferences** `profiles.email_game_started` and `profiles.email_results` (both default **on**), plus a per-person `email_token` for one-click unsubscribe. Only the owner reads them (`my_profile`); `set_email_prefs(p_game_started, p_results)` writes them. `unsubscribe_email(p_token, p_kind)` is callable by `anon` from the share site and never says whether the token matched.
- **Outbox** `public.email_outbox`: one row per `(event, recipient)`, `event_key` unique (`game_started:<game>:<profile>`, `result_saved:<result>:<profile>`), so a second Start, a retry or a second admin never queues a duplicate. No client policy reads it; only the service role (the edge function) does.
- `queue_game_started_emails(p_game_id)` (creator or game admin): one row for every **registered** seated player with an email and the preference on, with the live scorecard link (`/scorecard.html?t=<view_token>`). The app calls it once after Start game.
- `queue_result_saved_emails(p_result_id)` runs inside `declare_game_result`: one row per registered player in the standings with the preference on, linking to the public page `/r/<result id>`. **No game-completed email** (dropped 11:03 PM PT).
- `public_result(p_id)` (`anon`): what the result PDF shows and nothing more — names, Player IDs, places, points, games, the by-game table, the reused-game warning — or `{deleted: true}` for a soft-deleted result, `null` when it does not exist. No emails, phones, user ids or view tokens.

Outside the database, two deploys go with it (also not done by this change): `supabase functions deploy send-email` (the `flush` action; needs `RESEND_API_KEY` and `RESEND_FROM="EZ Score <scores@mindweavetech.com>"` already set for the OTP mail), and the GitHub Pages site picks up `public/r/index.html`, `public/unsubscribe.html` and `public/404.html` on the next Pages deploy. Before the function is deployed, rows simply wait in the outbox and go out on the first flush.

Verified on a scratch Postgres 16 loaded with 001–023 and the CI seed: 448 pgTAP checks (49 new in `supabase/tests/14_emails_024.sql`: defaults on, prefs are owner-only, queue once per recipient, no row for unregistered / no-email / opted-out players, non-admin refused, result save queues and a second declare does not, unsubscribe by token and by kind, `public_result` shape, deleted and missing results), 31 two-client race checks, and the rollback replay (rollback 024 → 013, re-apply 013 → 024, apply each a second time; 77 checks) all pass.

Read-only checks after applying (nothing is changed):

```sql
select count(*) filter (where email_game_started), count(*) filter (where email_results), count(*) from public.profiles;  -- all three equal right after applying
select count(*), count(sent_at) from public.email_outbox;  -- 0, 0 right after applying
```

## 025 — Link to Player ID as a request the owner accepts (approved Nov 11, 10:59 PM PT, item 5; amended Nov 12)

File: `supabase/migrations/025_link_player_to_account.sql`. Run after 024. Safe to re-run. Rollback: `supabase/rollback/rollback_025_link_player_to_account.sql` (cancels open requests, drops the new functions, puts back the 012 `expire_player_requests`, 011 `take_creator_notices` and 023 `get_home_bundle`, drops the two new columns; links already accepted stay linked and can still be undone one by one with 011 `unlink_player`).

Not applied by this change. Two new columns (`player_links.target_id`, `creator_notices.kind`), one new `player_links` kind (`link_request`) and one new outbox kind (`link_request`); three functions replaced in place (`expire_player_requests`, `take_creator_notices`, `get_home_bundle`).

What it does (Nov 12 amendments: **no immediate merge; the admin types the Player ID only, never someone else's email; the conflict sentence names each blocking game**):

- **`link_player_check(p_player_id, p_player_no)`** — the preview behind Check. The caller must own the unregistered player. Answers `{target: {id, name, playerNo}, gameCount, gameNumbers, conflicts: [{gameId, gameNumber, creatorName}], conflictMessage, pending}`. A conflict is any game where the unregistered player sits and the account already **plays** (seated; a viewer or non-playing admin is not a conflict). The sentence, built by `link_conflict_message`, lists every such game with its G-number, full game ID and creator: *"Can't link yet. G12 (game ID 3f2a…, creator Sree Koneru) has both R K and #11. In that game, clear one of their scores to zero and remove them from the game first."* There is no Remove button; the admin clears the game first.
- **`request_player_link(p_player_id, p_player_no)`** — Send request. Refuses with the sentence above when anything conflicts. Otherwise **nothing moves**: it writes a pending `player_links` row (`kind = 'link_request'`, `target_id` = the account, `expires_at` = now + `link_request_days()` = 7), sets the player to `pending` (so the row reads **Link pending**), and, when the account has an email, queues one `email_outbox` row (`kind = 'link_request'`, sent by the 024 `send-email` flush) with a **Yes** and a **No** link to `https://ezscore.mindweavetech.com/link.html?t=<token>&a=yes|no`. Sending again for the same player replaces the earlier request (and drops its unsent email).
- **`cancel_player_link_request(p_link_id)`** — the owner takes the request back; the player is unregistered again.
- **`list_my_link_requests(p_game_id)`** — the admin's open requests (or, with a game, the requests for players seated in it) so every admin's roster shows Link pending.
- **`list_link_requests_for_me()`** — the account's open requests, with the conflict re-checked now, for the Yes / No card on Home. Also in `get_home_bundle` as `link_requests`.
- **`answer_player_link_request(p_link_id, p_accept)`** (signed in) and **`answer_link_request_by_token(p_token, p_accept)`** / **`peek_link_request(p_token)`** (the email buttons; work signed out, the target is fixed on the row, single use). Yes runs `perform_player_link`: the conflict check again (refuses with the same sentence), then under the same per-game lock as `save_round` (019) every seat, score and dealer mark moves to the account in every game (deleted games included); a viewer or non-playing admin takes the seat and keeps the admin role; the player becomes `merged`, other pending claims are revoked, the owner's My players row folds into the account, and the row becomes `status = 'claimed'` with `moved_game_ids` so `unlink_player` (011) can undo it. The admin gets a one-time `creator_notices` row with `kind = 'linked'` — *"Harish (HG) is now linked to #40."* — shown once as a pop-up on Home. No leaves the player unregistered and tells the admin.
- **`expire_link_requests()`** (inside `expire_player_requests`) — after 7 days the request is `expired`, the player unregistered again, the admin told.
- `link_target_for`, `link_seat_for`, `link_conflicts`, `link_conflict_message`, `perform_player_link`, `decline_player_link` are internal (no grants).

The app's one-game "Link to a Player ID" (015/017 `link_seat_to_player`) is no longer called; the function stays in place.

Verified on a scratch Postgres 16 loaded with 001–024 and the CI seed: 588 pgTAP checks (95 in `supabase/tests/15_link_player_025.sql`: objects and grants, who may ask, lookups, the exact conflict sentence, a request that moves nothing and queues the Yes / No email, lists for the owner / a co-admin / the target / an outsider, only the owner cancels and only the target answers, re-send replaces, cancel, the conflict re-checked at Yes, Yes by token signed out with the full move and the 'linked' notice, single-use token, 011 unlink restoring the seat, No in app, 7-day expiry), 31 two-client race checks, and the rollback replay (rollback 026 → 013, re-apply 013 → 026, apply each a second time; 91 checks) all pass.

Outside the database (also not done by this change): the GitHub Pages site needs `dist/link.html` (`node scripts/inject-scorecard-config.mjs` now also fills `public/link.html`), and `supabase functions deploy send-email` again so the `link_request` email renders (rows wait in the outbox until then).

Read-only checks after applying (nothing is changed):

```sql
select status, count(*) from public.player_links where kind = 'link_request' group by 1;        -- empty right after applying
select count(*) from public.email_outbox where kind = 'link_request' and sent_at is null;        -- unsent Yes / No emails
```

## 026 — Delete account (Google Play), approved Nov 11, 10:59 PM PT, item 6

File: `supabase/migrations/026_delete_account.sql`. Run after 025. Safe to re-run. Rollback: `supabase/rollback/rollback_026_delete_account.sql` (drops `delete_my_account` and `tombstone_profile`, puts back the 005/011/012 trigger bodies; accounts already deleted stay anonymised).

Not applied by this change. No table or column changes; two new functions and four trigger bodies replaced in place (`enforce_profile_auth_user`, `lock_profile_email`, `lock_public_player_no`, `delete_profile_with_auth_user`).

What it does:

- **`delete_my_account()`** — Profile › Account › Delete account. Runs `tombstone_profile(auth.uid())`, then `delete from auth.users where id = auth.uid()` (sessions and identities go with it). Returns `{seatsKept, gamesDeleted, gamesKept, adminsPromoted}`.
- **`tombstone_profile(uuid)`** (internal, no grants) — deleted: email, phone, first/last name, avatar, zip, Player ID number (`public_player_no` → null; `player_code` is replaced by a fresh random code because the column is not null), email token and both email preferences (off), default settings (reset), role (back to `player`); My players rows both ways; hidden games; every outbox row addressed to the person; creator notices; the person's pending invites (cancelled); viewer and non-playing-admin memberships (rows removed); seated admin rows become plain players. Games the person created where **nobody else with an account** was ever a member are soft-deleted exactly like Delete game (023): removed from saved results, `deleted_at`/`deleted_by` set, `closed_at` re-synced, `games_together` adjusted. Kept: every seat, score, round and result with other people (**`display_name` stays** so the scorecards read right; the row becomes `player_status = 'deleted_after_registering'`, already excluded from every roster and lookup since 011/012); games the person created that other accounts were in, and if no other admin is left the first other registered seated player (by seat order) is promoted to `game_admin` so the game is not orphaned (`created_by` cannot change: foreign key). Nothing in `scores` or `rounds` is ever deleted.
- **Dashboard path** — the 005 `before delete on auth.users` trigger now calls `tombstone_profile` when the profile has any history (seats, games, scores, rounds, results) and deletes the profile outright only when it has none. So "email support and we delete it" is: Authentication → Users → delete the user; the database does the same cleanup as the in-app button, and it no longer fails on the `game_players` foreign key.
- Trigger changes needed for the tombstone to exist without an auth user: `enforce_profile_auth_user` accepts a `deleted_after_registering` row (role must stay `player`); `lock_profile_email` and `lock_public_player_no` let such a row give up its email and number. Everything else about those triggers is unchanged.

Decisions to confirm (implemented as written, easy to change): display name kept on scorecards (spec: "games others own keep the seat as an unregistered name"); games with nobody else registered are soft-deleted rather than kept; the orphaned-game admin hand-over goes to the first other registered seat.

Verified on a scratch Postgres 16 loaded with 001–025 and the CI seed: 529 pgTAP checks (45 new in `supabase/tests/16_delete_account_026.sql`: grants, anon refused, the summary for a creator with one lone game, one shared game with another admin and one without, auth user gone, every personal column cleared, Player ID given up, settings reset, tombstone still writable but never an admin, lists and outbox gone, invite cancelled, placeholder kept, viewer row removed, seat kept as plain player with its score, lone game soft-deleted, shared games kept, promotion only where needed, others still open the games and manage them, deleted account hidden from My players even with a stale row, dashboard delete anonymises a seated user and removes a user with no history), 31 two-client race checks, and the rollback replay (rollback 026 → 013, re-apply 013 → 026, apply each a second time; 89 checks) all pass.

Outside the database (also not done by this change): publish `public/privacy/index.html` and `public/delete-account/index.html` with the next Pages deploy (static, no keys), and paste `https://ezscore.mindweavetech.com/privacy` and `https://ezscore.mindweavetech.com/delete-account` into Play Console → App content (Privacy policy; Data safety → Account deletion).

Read-only checks after applying (nothing is changed):

```sql
select count(*) from public.profiles where player_status = 'deleted_after_registering';           -- 0 right after applying; +1 per deleted account
select count(*) from public.profiles p where p.player_status = 'deleted_after_registering' and exists (select 1 from auth.users u where u.id = p.id);  -- always 0
```

## 027 — Remove from My players (soft remove, Undo)

File: `supabase/migrations/027_remove_from_my_players.sql`. Run after 026. Safe to re-run. Rollback: `supabase/rollback/rollback_027_remove_from_my_players.sql` (puts the 007/022/023 bodies back and **deletes** the rows that were soft-removed, which is what the old remove would have done).

Backward compatible with the APK on phones: `remove_my_player`, `add_my_player`, `touch_my_players`, `list_my_players` and `list_new_game_candidates` keep their signatures and column lists. The old app's "Remove from My players" becomes a soft remove and gets the live-game refusal as an error message; it has no Undo toast (that is in the new build).

What it does:

- `my_players.removed_at`: the row stays with a timestamp instead of being deleted, so every past game, score and result keeps the name and totals, and `games_together` and the initials come back on restore. Hidden from `list_my_players` and from the New game picker while set.
- `remove_my_player` refuses with "In a live game. Remove them after the game ends." while the player is seated and active in a game that is active, not deleted/completed/closed, and that the caller can see (`list_visible_game_ids`). Removing yourself is refused. Nothing else changes: not their account, not their own My players, not other people's games; no notice, no email.
- The per-owner unique initials index now covers active rows only, so the removed player's letters are free in your list. `default_initials` ignores removed rows.
- `restore_my_player` (Undo), `add_my_player` (Add player by ID or by name) and `touch_my_players` (playing together again) clear `removed_at`. A trigger keeps the old initials when still free, otherwise the normal rule (SK, then SUK, ...) relabels the row.

Verified on a scratch Postgres 16 loaded with 001–027 and the CI seed: 633 pgTAP checks (45 new in `supabase/tests/17_remove_my_players_027.sql`), the rollback replay (rollback 027 → 013, re-apply, second apply; 97 checks) and the 31 race checks all pass.

## 028 — Game numbers S/P (replaces the UUID in the app)

File: `supabase/migrations/028_game_labels.sql`. Run after 027. Safe to re-run (the backfill only touches games with no label). Rollback: `supabase/rollback/rollback_028_game_labels.sql` (drops the label columns, the trigger and the new functions, puts the 023/024/025 bodies back; `game_number` keeps the backfilled values, which are still unique per creator).

Backward compatible with the APK on phones: no existing function changes its signature or column list. The old app keeps reading `game_number` and shows `G<n>`; it sees the same number the new app shows after the letter (S/P). The old app's local creation sets no label; the trigger fills `game_number` and `game_label` on insert the same way, so a game created from the old app gets a correct S/P number. `list_my_link_requests`, `list_link_requests_for_me` and `link_conflicts` are untouched (025 stays re-runnable); the new app reads `list_my_link_requests_v2`, `list_link_requests_for_me_v2` and `link_conflicts_detail`, and falls back to the 025 names on an older server.

What it does:

- `games.game_label` (text, e.g. `S3`, `P1`) and `player_links.game_labels` (text[]). `S` is a Points (stake) game, `P` a Pool game. A trigger refuses any later change to the label or number ("A game's number never changes.").
- `next_game_number(creator, prefix)`: the lowest positive integer not used by any game of the same prefix that is active or completed, not closed, not deleted, and that involves the creator or anyone in the creator's active My players (027 removed rows do not count), as creator or active seat. Closing or deleting a game frees its number. Assigned by the `games_assign_number` trigger at insert, under `pg_advisory_xact_lock(hashtext('games.game_label'))`, so two people creating at the same moment get different numbers (checked by the CI race script, section 8).
- Backfill: every existing game without a label gets one in creation order (`created_at, id`) by the same rule. This also **renumbers `game_number`** for games whose old per-creator number clashes under the new rule; the label and the number always agree afterwards. Reads the game type to pick S or P.
- Everything that showed the number now shows the label: `get_game_bundle`, `get_game_result`, `list_hidden_and_deleted`, `public_scorecard`, `public_result`, the game-started and result emails ("Game S1"), and the link request rows. Pending link requests get `game_labels` filled by a trigger and a one-off backfill.
- Link conflict sentence (`link_conflict_message`): "Can't link yet. Game S3 (creator Sree Koneru, started Nov 12) has both R K and #11. In that game, clear one of their scores to zero and remove them from the game first." (plural form for several games). Used by `request_player_link`, the link preview and `get_home_bundle`.

Verified on a scratch Postgres 16 loaded with 001–028 and the CI seed: 687 pgTAP checks (54 new in `supabase/tests/18_game_labels_028.sql`), the rollback replay (rollback 028 → 013, re-apply, second apply; 103 checks) and the 34 race checks (3 new: concurrent creates get distinct labels) all pass.

## 029 — Guardrails (server-enforced limits)

File: `supabase/migrations/029_guardrails.sql`. Run after 028. Safe to re-run (tuned values are kept; only the message and description texts are refreshed). Rollback: `supabase/rollback/rollback_029_guardrails.sql` (drops the table, the five triggers and the helper functions, removes `email_outbox.next_attempt_at`, restores the 024 unsent index).

Backward compatible with the APK on phones: no function changes its signature or column list; the old app meets a refusal as an ordinary error message in the place it shows any error. Its own seat cap (15) is below the server's 20. Full list of limits, messages and failure modes: `docs/guardrails.md`.

What it does:

- `public.guardrails` (key, value, message, description): one row per limit. Signed-in users may read it; nobody but the service role may change it. Tune with `update public.guardrails set value = … where key = …`; the triggers read it on every check.
- Limits: My players **1,000** per owner (Sree, Nov 12: was 2,000; the message is "You've reached your limit of 1,000 players." and the 500-round message is "This game has reached 500 rounds. Create a new game to keep playing."; a database that ran the earlier 2,000 version is brought to 1,000 by re-running the file); 100 players added per day per owner; 20 players per game; 500 rounds per game; 10 live games per creator; 50 games created per day; 20 pending link requests per owner; and two email numbers for the flush (90 sends per day, 50 per run). "Per day" is a rolling 24 hours.
- Enforcement is in `BEFORE` triggers on `my_players`, `game_players`, `rounds`, `games`, `player_links` (named `<table>_0_guard`), so the app's inserts, the RPCs and scripts all meet the same check. Each takes an advisory lock on its scope first so two inserts at once count one after the other. A refusal raises SQLSTATE `GRD01` with the message and hint `guardrail:<key>`.
- `email_outbox.next_attempt_at`: the `send-email` flush now sends only due rows, backs a failed row off (5 min doubling to 24 h; a Resend 429 waits a minute, a daily-quota answer a day), stops at the daily cap and never drops a row. `email_sends_left_today()` and `email_outbox_backlog()` (service role) report the state.

Outside the database (also not done by this change): `supabase functions deploy send-email` again so the flush reads `next_attempt_at` and the caps. Until then the 024 flush keeps working against the new column (it ignores it).

Verified on a scratch Postgres 16 loaded with 001–029 and the CI seed: 743 pgTAP checks (56 new in `supabase/tests/19_guardrails_029.sql`, 60 after the Nov 12 limit change), the rollback replay (rollback 029 → 013, re-apply, second apply; 109 checks) and the 38 race checks (4 new: two admins adding the last seat at once) all pass.

## 030 — My players at scale (paged list, server search, count)

File: `supabase/migrations/030_my_players_at_scale.sql`. Run after 029. Safe to re-run. Rollback: `supabase/rollback/rollback_030_my_players_at_scale.sql` (drops the three new functions and two indexes; nothing else changed).

Backward compatible with the APK on phones: `list_my_players` and `list_new_game_candidates` are untouched; everything here is new. The new app falls back to the whole list when these functions are missing (older server).

What it does:

- `list_my_players_page(p_sort, p_limit, p_after_name, p_after_id, p_after_games)`: one page (default 100, max 200) of the caller's active My players in A–Z (`lower(display_name), id`) or Frequent (`games_together desc, name, id`) order, with a keyset cursor, so page 20 costs the same as page 1. Returns `player_status` and the sort key too.
- `search_my_players(p_query, p_limit)`: name part, first/last-name prefix, scorecard-initials prefix, or Player ID with or without `#`; exact ID first, then name-starts-with, then most games together. An email matches nobody.
- `count_my_players()`: the header number.
- Indexes `profiles_display_name_lower_idx` and `my_players_owner_active_idx` (partial, active rows).
- App: the My players screen loads a page, loads the next when scrolled near the end, shows A–Z sticky sections in Alphabetical order, searches the server after a 250 ms pause (local matches show at once), and keeps the offline copy. The New game picker keeps its recent-first page and asks `search_my_players` for anyone beyond it when the organiser types.

Verified on a scratch Postgres 16 loaded with 001–030 and the CI seed: 779 pgTAP checks (36 new in `supabase/tests/20_my_players_scale_030.sql`, including a 2,000-row roster walked page by page with no repeat or gap), the rollback replay (114 checks) and the 38 race checks all pass.

## 031 — Round-robin rotation (the deal follows the actual rotation)

File: `supabase/migrations/031_round_robin.sql`. Run after 030. Safe to re-run. Rollback: `supabase/rollback/rollback_031_round_robin.sql` (restores the 019 `save_round` body and the 028 `get_game_bundle` / `public_scorecard` bodies; rounds keep whatever dealer was stored).

Backward compatible with the APK on phones: the three functions keep their signatures and return types; the bundle and the public scorecard gain keys (`dealers`, `maxCount`) that older apps ignore. The dealer the old app shows for a round is still the stored `rounds.dealer_profile_id`, which is what this migration writes.

What it does:

- `save_round`: the dealer of a new round is the seat after the previous live round's dealer in the current seat order (so a player added mid-game makes the next rotation one round longer). An edited round keeps its dealer. The first round, or a previous dealer who has left the game, uses the old seat-order rule.
- `get_game_bundle`: adds `dealers` (round number → dealer profile id, live rounds only) so the scorecard draws a divider above each round where the first dealer deals again.
- `public_scorecard`: adds `dealers` (same divider on the web /r/ page) and `maxCount` (the score colour rule: a penalty of more than half the Full count is red text).
- App: the scorecard and the DEALS badge follow the stored dealers; games saved before 031 and local games use the seat-order rule as before.

Verified on a scratch Postgres 16 loaded with 001–031 and the CI seed: 799 pgTAP checks (20 new in `supabase/tests/21_round_robin_031.sql`: rotation after a mid-game join, edited round keeps its dealer, fallback when the dealer left, bundle and public payload), the rollback replay (119 checks) and the 38 race checks all pass.

## 032 — Results at volume (two speed fixes found by the volume tests)

File: `supabase/migrations/032_results_volume_fixes.sql`. Run after 031. Safe to re-run. Rollback: `supabase/rollback/rollback_032_results_volume_fixes.sql` (resets JIT on `public_result` and restores the 020 `game_rounds_json` body).

Backward compatible with the APK on phones: no signature, return type or output change. `game_rounds_json` returns byte-identical JSON (pgTAP 22 compares the two bodies on every seed game and viewer); `public_result` only gains `set jit = off`.

What it does:

- `public_result`: `set jit = off`. The web /r/ results page's RPC took 540–600 ms for a 30-game result because PostgreSQL JIT-compiled the big jsonb plan on every call (the 020 bundle RPCs already carry this setting). Now 10–16 ms.
- `game_rounds_json` (used by `get_game_result`, so the Results sheet in the app and its PDF/share image): one `distinct on` pass over the live scores, materialised, then one `jsonb_agg` per player over the round span, instead of a per-cell lookup whose CTE re-ran once per player. 30 games × 20 players: 250–280 ms → 42–50 ms. Also `set jit = off`.

Verified on a scratch Postgres 16 loaded with 001–032 and the CI seed: 812 pgTAP checks (13 new in `supabase/tests/22_results_volume_032.sql`), the rollback replay (124 checks) and the 38 race checks all pass. Full volume results: `docs/volume-testing.md`.

## 033 — Security advisor cleanup (final launch batch add-on)

File: `supabase/migrations/033_security_advisor_cleanup.sql`. Run after 032 (it also works right after 026: the three 028 functions are covered only when 028 is present). Safe to re-run; prints one NOTICE with the number of functions anon lost EXECUTE on (38 on a database at 032). Rollback: `supabase/rollback/rollback_033_security_advisor_cleanup.sql` (the 024 view, no pinned search_path, anon EXECUTE back on the 38).

Backward compatible with the APK on phones: the app always calls RPCs signed in, reads `my_profile` with `select` only (`services/auth.ts`, `services/emails.ts`), and the view keeps the same columns, order and types. The four public web pages (`/scorecard.html`, `/r/`, `/unsubscribe.html`, `/link.html`) keep working signed out.

What it does, finding by finding:

- **security_definer_view on `public.my_profile`** — recreated `WITH (security_invoker = true, security_barrier = true)`. The owner's private columns (`email`, `phone`, `zip_code`, `email_game_started`, `email_results`, `email_token`) are deliberately not granted to `authenticated` on `profiles` (019/024), so a security-invoker view straight over the table would refuse `select *` for everyone; the view therefore reads its row from a new `my_profile_rows()` (security definer, `search_path = public, pg_temp`, EXECUTE for `authenticated` and `service_role` only) whose body is exactly the old view body. A user still sees only their own row with every column; another account's `email` on the table is still "permission denied"; anon is refused on the view. The view is now select-only.
- **function_search_path_mutable** — `alter function … set search_path = public, pg_temp` on `initials_words`, `initials_push`, `initials_candidates`, `player_label`, `site_base_url`, `link_request_days`, `lock_profile_email`, `lock_public_player_no`, `touch_updated_at`, and the 028 trio `game_label_text`, `game_label_prefix`, `lock_game_label`. Bodies unchanged. After this no function of ours is without a search_path.
- **SECURITY DEFINER functions callable with the anon key** — Supabase's default privileges grant EXECUTE on every new function to `anon`, so every RPC that did not revoke it was callable signed out (38 of them, including 11 trigger functions that also carried Postgres's built-in PUBLIC grant). EXECUTE is revoked from `anon` (and PUBLIC) on all of them. Kept for anon: the five public-page RPCs `public_scorecard`, `public_result`, `unsubscribe_email`, `peek_link_request`, `answer_link_request_by_token`, plus the four helpers referenced by row policies (`is_app_admin`, `is_game_admin`, `is_game_member`, `can_see_profile`) so an anon read of a table keeps returning zero rows rather than an error.

Revoked from anon (signed-in users keep them): `add_my_player`, `add_prize_entry`, `answer_claim_link`, `answer_claim_request`, `assign_game_number`, `create_claim_link`, `create_prize_session`, `create_unregistered_player`, `delete_unregistered_player`, `game_coin_shares`, `generate_player_code`, `get_prize_session`, `guard_game_players`, `guard_games`, `guard_my_players`, `guard_player_links`, `guard_rounds`, `handle_new_user`, `list_claim_requests`, `list_my_player_links`, `list_my_unregistered_players`, `list_prize_sessions`, `lock_profile_role`, `my_players_restore_initials`, `my_verified_email`, `peek_claim_link`, `player_links_fill_labels`, `recompute_session_status`, `remove_my_player`, `request_claim_by_player_no`, `require_my_unregistered`, `revoke_claim_link`, `search_players`, `session_visible`, `touch_my_players`, `unlink_player`, `update_prize_entry`, `update_unregistered_player`. (`peek_claim_link` / `answer_claim_link` are only called by the app after sign-in; there is no public claim page.)

Verified on a scratch Postgres 16 loaded with 001–033 and the CI seed: 877 pgTAP checks (65 new in `supabase/tests/23_security_033.sql`: view semantics per user and for anon, all twelve search_paths, the exact anon allow-list, the four web pages signed out, and the signed-in flows — add to My players, search, links, claim requests, prize sessions, unregistered player, new game with its label and guard triggers, sign-up creating a profile, profile edits with the email/player-number locks), the rollback replay (129 checks) and the 38 race checks all pass. `tests/security-033.test.ts` (4 unit tests) ties every RPC the `public/*.html` pages call to the migration's allow-list and checks the app only reads through `my_profile`.

After applying, re-run the Supabase security advisor: the `security_definer_view` and `function_search_path_mutable` findings for these objects should be gone.

## 034 — Results design (PR 8)

File: `supabase/migrations/034_results_design.sql`. Run after 033. Safe to re-run (prints one NOTICE about a trigger that does not exist yet on the first run). Rollback: `supabase/rollback/rollback_034_results_design.sql` (drops `result_versions` and every saved version, the 024 `declare_game_result`, the 028 one-argument `public_result` with 032's jit setting).

Backward compatible with the APK on phones: `declare_game_result` keeps its signature and result shape (the standings simply include seated players who never scored, at 0); `get_game_result` / `list_game_results_page` are untouched. The `/r/` page posts `{p_id}` as before and gets the latest version; the new page also sends `p_version` when a version link is opened. **Status: ready for live** once CI is green on PR 8 (Build Bot applies; nothing applied by the agent).

What it does:

- **0-players fix.** `declare_game_result` builds each game's totals from the seated players (`game_players`, role not spectator, `seated`) LEFT JOIN their live scores, so a finished game with no rounds saves with every seated player at 0 instead of "1 game · 0 players". A player who scored and then left the seat keeps their points. The 50-player cap now counts over this set.
- **Result versions.** New table `result_versions(result_id, version, places, note, saved_by, saved_at)`, no direct grants (read through `public_result` only). An insert trigger on `game_results` writes version 1 ("Saved"); an update trigger on `game_result_games.removed_at` writes the next version ("S14 removed · game deleted") whenever `delete_game` or account deletion takes a game out of a result. Backfill: version 1 for every existing result and a version 2 where games were already removed.
- **`public_result(p_id uuid, p_version integer default null)`** replaces the one-argument function (dropped, so PostgREST has no ambiguity). Returns the chosen version's players/standings/games (latest by default; a version past the end falls back to the latest), `version`, `currentVersion`, `versions[]` (number, when, note, by), `deleted`/`deletedAt` with the summary kept read-only, `declarerName`, and per game `label`, `code` (share code), `creatorName`, `adminNames` (admins other than the creator), `roundCount`, `reused`, `removed`, `scores`. Still no account ids or contact fields. `jit = off` kept from 032.

Verified on a scratch Postgres 16 loaded with 001–034 and the CI seed: 928 pgTAP checks (48 new in `supabase/tests/24_results_design_034.sql`; two expectations in `13_hide_delete_023.sql` updated for the seated-players rule), the rollback replay (134 checks) and the 38 race checks all pass.

## 035 — Undo then Add round (PR 2)

File: `supabase/migrations/035_undo_round.sql`. Run after 034. Safe to re-run. Rollback: `supabase/rollback/rollback_035_undo_round.sql` (drops `undo_last_round`, moves any undone row that collides with a live number to the 1000+ range, puts the full unique key back and restores the 031 `save_round` body with its "someone else" message).

Backward compatible with the APK on phones: `save_round` keeps its signature; the current app's Undo (two direct table writes) keeps working because the admin update policy on `rounds` is unchanged — it simply benefits from the relaxed key. The new app calls `undo_last_round` and falls back to the direct writes when the RPC is missing (PGRST202). **Status: ready for live** once CI is green on PR 2 (Build Bot applies; nothing applied by the agent).

What it does:

- **The bug.** Undo set `undone_at` and left the row on its round number N. The unique key on `rounds (game_id, round_number)` covered undone rows too, so the next Add round (which reuses N since Nov 11) failed with a 23505 that the app read as "Round N already saved … by someone else", and the game was stuck.
- **Live rounds only in the key.** The constraint `rounds_game_id_round_number_key` is dropped and replaced by the partial unique index `rounds_live_number_uidx (game_id, round_number) where undone_at is null`. Undone rows can sit at any number. One-off (D2.2, idempotent): undone rows still below 1000 move to 1000+N (2000+N, … on collision) so they read the same as Edit round's retired rows.
- **`undo_last_round(p_game_id uuid) returns jsonb`.** Game admins (or app admins) only, 42501 otherwise. Takes the same per-game advisory lock as `save_round`, marks the last live round undone (`undone_by`, `undo_reason 'admin undo'`), moves `games.current_round` back to that number, returns `{roundId, roundNumber}` or null when there is nothing to undo. Security invoker; `authenticated` may execute.
- **`save_round` (031 body) with two message changes.** A different payload for a round that is already saved now names the admin who saved it from `rounds.created_by`: "Round 3 was just saved by Harish Gadupudi. Check the scorecard before you save again." (PT409). A new round whose number is more than one past the last live round (the other admin undid a round while this one was typing) is refused with PT409 "A round was undone while you were scoring. The scorecard has been refreshed; check the round number and save again." — nothing is written.

Verified on a scratch Postgres 16 loaded with 001–035 and the CI seed: pgTAP (959 checks; 30 new in `supabase/tests/25_undo_035.sql`, the conflict expectation in `05_save_round_014.sql` updated to the named message, two counts in `02_games_visibility.sql` for the new seeded undone row), the rollback replay (139 checks) and the race checks (44, six new in case 10: undo in flight vs save) all pass.

## Apply order for the Nov 10–12 batches

017–020 were applied on Nov 11 (~11:25 AM PT); 021–026 were applied on Nov 12 from PR 7 head `d62d9c6`. Steps 1–6 are kept for the record (all re-runnable):

1. `supabase/migrations/021_email_uniqueness.sql` — applied
2. `supabase/migrations/022_player_initials.sql` — applied
3. `supabase/migrations/023_hide_and_soft_delete.sql` — applied
4. `supabase/migrations/024_emails_and_public_results.sql` — applied
5. `supabase/migrations/025_link_player_to_account.sql` — applied
6. `supabase/migrations/026_delete_account.sql` — applied

Final launch batch (Nov 12), unapplied. Paste each into the Supabase SQL editor as its own run, in this order:

7. `supabase/migrations/027_remove_from_my_players.sql`
8. `supabase/migrations/028_game_labels.sql`
9. `supabase/migrations/029_guardrails.sql`
10. `supabase/migrations/030_my_players_at_scale.sql`
11. `supabase/migrations/031_round_robin.sql`
12. `supabase/migrations/032_results_volume_fixes.sql`
13. `supabase/migrations/033_security_advisor_cleanup.sql` — then re-run the security advisor

PR 8 (Nov 13), unapplied, ready for live once CI is green:

14. `supabase/migrations/034_results_design.sql`

PR 2 (Nov 13), unapplied, ready for live once CI is green:

15. `supabase/migrations/035_undo_round.sql`

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

That writes `dist/scorecard.html` (and `dist/r/index.html`, `dist/unsubscribe.html`, `dist/link.html`). Put those files at the same paths under `https://ezscore.mindweavetech.com/`. Do not commit `dist/scorecard.html`, and do not put the key in the link. The anon key is the public client key already used by the app. It is not the service role key.
