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

Check after running it: sign in as an account with no games and open Results. The past-results list must be empty.

## 014 — save a round in one transaction (fix for the blank round)

File: `supabase/migrations/014_save_round_atomic.sql`. Run after 001. Safe to re-run. Independent of 011–013.

Not applied by this change. The app works without it: when the function is missing the app falls back to the old three-request save, which is now self-healing (an empty round left by an interrupted save is reused on the next attempt; a duplicate submit of an already saved round is ignored; a failed Edit round puts the old scores back). Applying 014 makes the whole save one database transaction, so an interrupted save can no longer leave a round with no scores.

Likely cause of the blank round seen on Nov 6: the rounds row was written, the connection dropped before the scores rows went in (or the app's request timeout fired), and the next save of that round number then failed on the unique round key. The empty round shows as a blank row.

Repair for an existing blank round: open the scorecard, choose Edit round, pick that round, enter the scores and Save. The empty row is retired and the real scores take its number. No SQL needed.

## Public scorecard page

This is not a database change. `public/scorecard.html` (and the same file at `web/scorecard.html`) does not contain the project URL or the anon key. It contains the placeholders `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__`.

Before the page is published, fill those in from the environment and publish only the copy:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
node scripts/inject-scorecard-config.mjs
```

That writes `dist/scorecard.html`. Put that file at `https://ezscore.mindweavetech.com/scorecard.html`. Do not commit `dist/scorecard.html`, and do not put the key in the link. The anon key is the public client key already used by the app. It is not the service role key.
