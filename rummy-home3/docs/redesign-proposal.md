# Rummy Home redesign proposal

Status: approved and built on `cursor/visual-redesign-3550`. The current look (felt green, cream, seat colors) stays. This redesign is about fewer screens, fewer taps, and the bugs from the latest APK (`a933e6b`). Apply `supabase/migrations/007_redesign.sql` after `006` before the new roster and unseated-admin rows work on the live project.

**Results replaces Settle.** Home has a Results button. You check finished games, then show the results. The results page is exactly four parts, top to bottom: the title Results with the date and time it was created, totals with positive scores on the left and negative scores on the right, a table with one row per player and a column per game plus a total, and 1st, 2nd, and 3rd place at the bottom. Declare results is only for an admin of every selected game. Anyone signed in can view a declared result. Wording is place and winner. There is no payment, coin, or prize language on that screen.

Settle (payments, the ledger, coins, prize money) stays in the repo behind `EXPO_PUBLIC_SETTLE_ENABLED`, which is off. It is not on Home and it is not coming back as the product. Apply `supabase/migrations/008_results.sql` after `007` before Declare works on the live database. This change does not run that file.

Product rules that stay, from `docs/product-contract.md`, `docs/friday-setup.md`, and `docs/testing-strategy.md`:

- Sign in with email and a 6-digit passcode. Phone is optional profile data. No SMS.
- A game has 2–15 seated players. The creator is a game admin even when they only keep score. A Results view can include at most 50 distinct players.
- Any game admin can enter and undo scores, and can promote a seated player during the game or after it is completed. A non-player admin can do the same and is not a score column. A seated player who is not an admin, and a view-only person, see the live scorecard and cannot change it.
- Someone sees a game when they created it, are seated, were added as view-only, are a non-player admin, or their account email matches a seat. An outsider does not see it in the app. Anyone with the unguessable link can watch the public page. The app never shows that email.
- Games on screen are points. The stored game type is still the points game (the old stake type). Pool stays out of scope.
- Completed games stay scored. Results adds those points up across the games you pick. The Settle ledger stays hidden behind its flag.

## Decisions (Oct 28)

Sree answered the open questions. These override any older line in this doc. The screens and flows below already follow them.

1. **Email stays private.** The app never shows another person’s email. Search results, my players, the player sheet, and Share show name and player ID only. Find can search by email, and that match is the full address or nothing. After +, the email is still hidden. Your own email appears only on Sign in, Create account, and Me, because it is the login.
2. **Results, and only on Home.** The button is labeled Results. It lists finished games this person can see, and several can be checked together. Show results opens the four-part page. Declare results is enabled only when they are an admin of every checked game and the selection has at most 50 players. Anyone signed in can open a result after it is declared. The old Settle button stays hidden behind `EXPO_PUBLIC_SETTLE_ENABLED`.
3. **Promote after the game ends.** A game admin can make a seated player an admin during a live game and after it is completed.
4. **Non-player admin.** Add non-player admin gives someone admin rights with no seat and no score column. The picker is my players only. If they are not on that list, the sheet says “Can’t find them? First add them to your player list in Find Players, then come back.” with a button to Find Players. Find is not a search box on the game screen.
5. **Welcome email.** Creating an account sends a welcome email from `scores@mindweavetech.com` through Resend. Sign-up does not wait on that send.
6. **Recent works.** Home’s Recent section lists the games this account can see. Tapping a row opens that scorecard. It uses the empty, loading, and error states in section 3.4. It does not open a second History screen and it does not spin forever.
7. **A declared result is a snapshot.** Declare saves the places, the totals, and each game’s scores. It does not edit a previous result. Declaring again saves another one. The old ledger-edit rule left with Settle.
8. **Points, places, and a winner.** New games show as Points. Pool is out of scope. Results says place and winner. The words prize, stake, coins, ledger, and Settle are not on screen while the flag is off.
9. **Help.** Every screen has a small ? at the top. It opens a short note about the parts that are easy to misunderstand. It skips the obvious, including how to enter a score. First-draft text is under each screen in section 3. Sree will rewrite it.

## 1. Problems found

### What Sree hit on the APK

1. Home has two rows that go to the same places. Active opens Games filtered to live. Players opens the same list as All players. Today opens History filtered to today. History is also a button, and Recent games has See all, which is History again.
2. Prize distribution is buried on History, and the screen is hard to use: balances, a ledger at the bottom, a menu to pick each person, and a free-typed plus or minus on every leg.
3. Find Players does not search first or last name. The service comment says names are excluded on purpose. Results show a name and a player ID, and there is no + button, so a match cannot be saved onto the searcher’s own list. Under the search are Email, Phone, WhatsApp, and Text fields. The redesign still searches by email, but only on an exact match, and it never shows the address.
4. The Players count on Home is every profile in the database (`playersService.listPlayers` selects all of `profiles`), not “people I play with.”
5. On the Players list, the pencil goes to Edit profile. That screen is a full-page spinner until a profile query returns, with no timeout. Tapping the row opens Player detail, which is the same kind of spinner.
6. Remove says the person “will be removed from this device's local list,” then writes only to AsyncStorage. The list on screen is the Supabase profile directory, so the row comes back. The trash icon also sits inside the row’s tap target, so the press is easy to lose.
7. Tapping Active (including 0) opens History, which replaces the screen with “Loading your games…” and waits on the network with no timeout. If that request never returns, the app looks stuck. Home does the same thing on first paint: a spinner and no Retry until every request finishes.
8. The public scorecard link showed the page source. Supabase served the function body as plain text, so the browser did not render it. The app copies `https://gngcrplcldfiubvhcdin.supabase.co/functions/v1/scorecard?t=…`.
9. After rotating the scorecard to landscape and back to portrait, the top-left title sits in the wrong place.

### Other duplicates, dead ends, and bugs (audit)

10. Find Players (`players/new`) and a second screen `players/search` both exist. Search is registered in the navigator as “Search players” and nothing in the app navigates to it. It is an old form: name, email, phone, saved only on the phone.
11. The Players screen still has a hidden “add player” dialog (name, email, phone) and unused email/SMS invite helpers. Those create a local fake person, not an account.
12. `app/(screens)/game.tsx` is a stub (“Game Details” / “Add Round 1 Score”) still registered as a screen. Nothing links to it. The real scorecard is `games/[id]`.
13. Account is in three places: the avatar on Home, Settings → View profile, and the Profile screen. Settings also has Game rules (“Lowest score wins”, max score, round limit) stored only on the phone. Live scoring ignores them. Highest total leads, which is the opposite of that switch.
14. The scorecard menu has both Share and View. View opens the same link Share copies.
15. Find Players ends with “Go to new game,” a third way to start a game, on a screen that is about people.
16. New game picks from every profile, not from a personal list, so a host scrolls a directory that includes people they have never played.
17. Home waits on that full directory and on the games query before it draws anything. History then fetches games again from scratch, even when Home already has them. There is no request timeout. `list_visible_game_ids` (migration 006) plus the games read under `is_game_member` is the call that can sit there. If 006 is missing, the client falls back to two more queries. None of this is covered by a tap on a phone; `npm test` never opens these screens, and `npm run test:rls` skips when keys are absent.

## 2. How the app should be organized

Three tabs. Games live on Home, so there is no separate History tab and no stat tiles.

| Tab | What it is |
| --- | --- |
| Home | New game, the live game, Results, and Recent. Settle is hidden |
| Players | My players, with Find and Invite |
| Me | My name, email, passcode, optional phone, appearance, log out |

A pushed screen is only for a task: New game, Find players, Scorecard, Enter scores, Results, and the public page (browser). Player detail, edit-someone-else, Search players, the local add form, the stub Game screen, and the stat-tile routes go away. Settle’s screens stay registered and redirect home while the flag is off.

```
Home ── New game ── Scorecard ── Enter scores
  │         │            │
  │         │            ├── Players in this game (sheet)
  │         │            ├── Share (sheet)
  │         │            └── Complete (confirm the points)
  │         └── needs someone? ── Find players ── back, already on my list
  └── Results ── check games ── show results ── declare if you run every game
Players ── Find players
        └── Invite (phone share sheet, no form)
Me
```

Bar under every tab: Home, Players, Me. One back arrow on pushed screens. No “See all.”

My players is a new list per account, not the whole `profiles` table. A row is added when:

- I tap + on a Find result, or
- I play a game with them (seated or view-only), or
- I create the game and include myself.

Removing a row removes them from my list only. It does not delete their account or take them out of a past game.

Default sort is games played with me, most first. A sort control can switch to name. That is the only sort.

## 3. Screens

Shared rules for every screen:

- Loading: if there is something to show, keep it and show a thin bar at the top. If there is nothing yet, show three gray rows, not a spinner that covers the screen. After 12 seconds with no answer, show the error state.
- Empty: one sentence and one button.
- Error: what failed, in plain language, and Retry. Keep the last list on screen underneath.
- A control that does nothing is not on the screen.
- A ? sits at the top of every screen. Tap it for the help text under that screen. Close it with the same icon or by tapping outside. The note is a few lines, not a manual.

### 3.1 Sign in

```
+----------------------------------+
|            [ RH logo ]        ?  |
|           Rummy Home             |
|                                  |
|  Email                           |
|  [ koneru2k@gmail.com         ]  |
|                                  |
|  Passcode                        |
|  [ ● ][ ● ][ ● ][ ● ][ ● ][ ● ]  |
|                          ( eye ) |
|                                  |
|  [ Sign in ]                     |
|                                  |
|  Forgot passcode                 |
|  Create account                  |
+----------------------------------+
```

- Six large cells. Eye shows the digits. Numbers only.
- Sign in goes to Home.
- Wrong email or passcode: one line under the button, the fields stay filled.
- Network failure: “Couldn’t reach Rummy Home.” Retry. No endless spinner.
- Forgot passcode opens 3.3. Create account opens 3.2.

Help: “Your passcode is 6 digits, not a regular password. The eye shows those digits. Forgot passcode emails you a link to set a new one.”

### 3.2 Create account

```
+----------------------------------+
|  <         Create account     ?  |
|                                  |
|  First name        Last name     |
|  [ Srikanth ]      [ Koneru ]    |
|                                  |
|  Email                           |
|  [ koneru2k@gmail.com         ]  |
|                                  |
|  Passcode                        |
|  [ ● ][ ● ][ ● ][ ● ][ ● ][ ● ]  |
|                          ( eye ) |
|  This is your 6-digit code.      |
|                                  |
|  Phone (optional)            v   |
|                                  |
|  [ Create account ]              |
|  Already have an account? Sign in|
+----------------------------------+
```

- Phone is collapsed. Opening it shows one optional field. It is saved on the profile. Nothing texts it.
- If the email already exists, the error is “This email already has an account.” and a Sign in button that opens 3.1 with the email filled in.
- Success goes straight to Home. Confirm-email stays off so sign-in is immediate.
- A welcome email goes out from `scores@mindweavetech.com` through Resend. Account creation does not wait for it. If the send fails, the account still exists.

Help: “Email is how you sign in. Phone is optional and is never texted. If this email already has an account, use Sign in.”

### 3.3 Forgot passcode

```
+----------------------------------+
|  <         Reset passcode     ?  |
|                                  |
|  Email                           |
|  [                            ]  |
|                                  |
|  [ Send reset email ]            |
|                                  |
|  We sent a link to that email.   |
|  It opens a page where you set   |
|  a new 6-digit code.             |
+----------------------------------+
```

- The link target is `https://sreeatcandorps.github.io/Games/` (the page that already sets a new code). Supabase only honors that when Site URL and Redirect URLs include it, and `http://localhost:3000` is not the Site URL. Also allow `rummy-home3://**`. This is a dashboard setting, documented in `docs/friday-setup.md`. The screen copy should say “Check your email” only after Supabase accepts the send.

Help: “We email a link. It opens a page where you choose a new 6-digit code. It is not a text message.”

### 3.4 Home

Portrait. This replaces the hero stat tiles, the shortcut row, and the separate History screen. Recent stays, and it has to work.

```
+----------------------------------+
| [logo] Rummy Home         ? (SK)|
|                                  |
|  Hi Sree                         |
|  [ + New game                 ]  |
|                                  |
|  Live                            |
|  +------------------------------+|
|  | Points · ID F28KCA           ||
|  | Started Tue, Oct 27 · 4:05   ||
|  | Sree, Player 1, Player 2 +9  ||
|  | [ Resume ]                   ||
|  +------------------------------+|
|                                  |
|  [ Results ]                     |
|                                  |
|  Recent                          |
|  chips:  All    Live    Today    |
|  +------------------------------+|
|  | Live   F28KCA   Tue 4:05     ||
|  | Done   DP5MXW   Tue 4:40     ||
|  +------------------------------+|
|                                  |
|  Home      Players        Me     |
+----------------------------------+
```

- New game is the primary button. One tap.
- Live is the newest in-progress game, or the empty line “No live game.” Resume opens the scorecard. Tapping the card does the same. There is no Active tile. A count of 0 does not navigate anywhere.
- Results is on Home, under the live card, for everyone. It is the only place Results appears. It opens 3.12. It stays visible when this person admins no games. Settle is not on this screen.
- Recent is the games list. Chips filter it in place: All, Live, Today. Today is this chip, not a screen. There is no History screen and no See all.
- Tapping a Recent row opens that scorecard. That is the bug to close: the section has to show the games this account can see, and the tap has to land on the game. A live count of 0 stays here as “No live game.” It does not push a screen that spins.
- The chips use the games Home already loaded. Changing a chip does not fetch again.
- Pull to refresh fetches in the background and keeps the list on screen.
- Empty list: “No games yet.” The only action is the New game button already at the top. The empty card does not add a second New game button.
- Landscape: New game and the live card on the left, Recent on the right. Same chips. No third column.
- The avatar opens Me.

Help: “Recent is every game you can see. Tap a row to open it. Live is the one still going. Results adds up the games you check. Positive totals are on the left, negative totals are on the right, and 1st, 2nd, and 3rd place are at the bottom.”
- Demo load/clear moves to Me, and only for the allowlisted admin email. It is not on Home.

### 3.5 New game

```
+----------------------------------+
|  <            New game        ? |
|                                  |
|  Points                           |
|  Drop -10 · Middle -30 · Max -80 |
|  Expense  [ -10 ]           (on) |
|                                  |
|  (on) I'm playing                |
|                                  |
|  Who's in                        |
|  [ search my players          ]  |
|  (x) Sree Koneru            SK   |
|  ( ) Player 1               P1   |
|  ( ) Player 2               P2   |
|                                  |
|  [ Find players ]                |
|                                  |
|  2 selected                      |
|  [ Start game ]                  |
+----------------------------------+
```

- The screen says Points. Drop, middle drop, max count, and expense are the defaults, copied onto the game. An admin can change them here until the first round is saved. Pool is out of scope (see Later). The stored type is still the points game.
- I'm playing is on by default. Off means the creator keeps score and is not a column. They are still the game admin. Someone else can be given that same kind of role later with Add non-player admin (section 3.8).
- The checklist is my players, not every account. Search on this screen filters that list by name or player ID. It does not show emails.
- Find players opens 3.14. On return, a person just added is already checked. Find is not a directory search inside the game.
- Start needs 2 seated people. If I'm playing is on, one other person is enough. The button says why it is disabled: “Pick at least one more player.”
- Start opens the scorecard. The new game is the Live card on Home immediately. Completing it does not open Results. Places for these points are handled later from Home → Results.

Help: “Turn off I’m playing if you are only keeping score. You still run the game, and you are not a column. This list is people you already added. To add someone new, use Find players. That does not put them in this game until you check them.”

### 3.6 Scorecard, portrait

The table itself stays: initials and totals in the sticky header, rounds underneath, horizontal scroll when there are many players, dealer column marked, a round that does not add to 0 in red. No standings rail.

```
+----------------------------------+
| <  Scorecard         ?  ( ... )  |
|    Started Tue Oct 27 · 4:05 PM  |
|    ID F28KCA                     |
|                                  |
| Stake   Live                     |
|                                  |
| RND | SK  | P1  | P10 | P2 | ... |
|     | 12  | -4  |  0  | -8 |     |
|  3  | +22 | -10 | -2  | -10|     |
|  2  | -10 | +18 | -8  |  0 |     |
|  1  |  0  | -12 | +10 | +2 |     |
|                                  |
| [ Undo ] [ + Add round ] [ Done ]|
+----------------------------------+
```

- One header for portrait and landscape. The title is the single word Scorecard (the screen is called Scoreboard today; the share page already says scorecard). Subtitle is one line: start time and game ID, so a photo of the screen answers “which game?”
- The header does not unmount when the phone rotates. See the fix in section 6, item 13.
- (...) opens a menu with two items: Players, Share. View is inside Share as Preview.
- Admin (creator or a promoted game admin), game still live: bottom bar is Undo, Add round, Done.
- Seated non-admin, or view-only: no bottom bar. A line under the tags says “View only.” The table still updates when someone else scores.
- Completed game: no bottom bar. A line says “Completed.” There is no Results button and no coin or prize fields. Combining games is Home → Results.
- Undo asks “Remove the last round?” so a mis-tap does not wipe a hand. Confirm, then the round is gone on this phone and on the public page.

Help: “View only means you can watch and cannot change the scores. The … menu is Players (who can score) and Share. Totals sit in the header next to each name. Undo asks before it removes the last round.” Landscape uses the same note. Do not explain Drop, Middle drop, Rummy, or Add round.
- Many players: the header and the rows scroll sideways together. Totals stay in the header cells, not in a bottom total row and not in a standings panel.

### 3.7 Scorecard, landscape

Same header, shorter. The table gets the rest of the width. The bottom bar stays. There is no side standings panel.

```
+------------------------------------------------------------------+
| < Scorecard ?  Tue Oct 27 · 4:05 PM · ID F28KCA        ( ... )  |
| Stake  Live                                                      |
| RND | SK 12 | P1 -4 | P10 0 | P2 -8 | P3 ... | P4 | P5 | EXP     |
|  3  | +22   | -10   | -2    | -10   |        |    |    | -10     |
|  2  | -10   | +18   | -8    |  0    |        |    |    |         |
|------------------------------------------------------------------|
| [ Undo ]              [ + Add round ]              [ Done ]      |
+------------------------------------------------------------------+
```

- Rotating back to portrait uses this same header component. It only changes height and whether the subtitle wraps. It does not swap in a different native header.

### 3.8 Players in this game (sheet)

Opened from the scorecard menu. Not a new page.

```
+----------------------------------+
|  Players in this game     ? (x) |
|                                  |
|  Sree Koneru          Admin      |
|  Player 1             [ Admin ]  |
|  Player 2             Player     |
|                                  |
|  Watching                        |
|  Player 9             View only  |
|                                  |
|  Admins not playing              |
|  Player 4             Admin      |
|                                  |
|  [ Add a player ]                |
|  [ Add view only ]               |
|  [ Add non-player admin ]        |
+----------------------------------+
```

- An admin can switch a seated player to Admin while the game is live and after it is completed. That person can then enter and undo scores. Once they admin the finished games, they can declare Results that include those games.
- An admin can add someone from my players as View only. They see the game at Home and cannot score. They are not a column.
- Add non-player admin picks from my players only. The person becomes a game admin, is not seated, and does not get a score column. They show under “Admins not playing.” They can enter scores, undo, promote, and settle under the same rules as the creator.
- The picker is a list of my players, name and player ID only. It does not search every account. If the person is not on the list, the sheet says “Can’t find them? First add them to your player list in Find Players, then come back.” and offers a Find Players button. That button leaves the game and opens 3.14. There is no Find field on the game screen.
- A non-admin sees the same names with the switches and the add buttons hidden.
- Add a player, while the game is still live, seats someone from my players. Earlier rounds count as 0 for them until an admin enters an adjustment. Order in the seated list is the deal order; drag the handle to reorder before the first round is saved.

Help: “Admin can change scores. View only can watch and is not a column. Add non-player admin lets someone run the game without sitting in it. They have to be on your player list already. If they aren’t, add them in Find Players and come back. You can make someone an admin after the game is over, too.”

### 3.9 Share (sheet)

```
+----------------------------------+
|  Share scorecard          ? (x) |
|  Rummy Home                      |
|  F28KCA                          |
|  Tue, Oct 28 · 4:05 PM           |
|  Sree              +40           |
|  Player 1          -20           |
|  1st  Sree  +40                  |
|                                  |
|  [ Share image ]                 |
|  Anyone with the link can watch. |
|  [x] Sree Koneru     SK82        |
|  [ Copy link ]                   |
|  [ Email selected ]              |
|  [ Preview ]                     |
+----------------------------------+
```

- Share image is the picture for WhatsApp or a text. It shows Rummy Home, the game, the date, and the totals. A long list keeps the top names and says “and N more.” The same picture is available on a live game and on a completed game. Results, from the header, has its own two choices: Share results is a short picture of the podium and the top totals, and Share full details (PDF) is the whole table. Neither is another block on the page.
- The link is the GitHub Pages URL in section 5, not the Supabase function URL. Copy link and Email stay as the secondary way to share the page.
- Rows show name and player ID. They do not show an email address.
- Copy link puts that URL on the clipboard and confirms “Copied.” The host can still paste it. The app does not collect a phone number.
- Email selected sends the link through Resend to the checked people, using the address on the account. The address is not shown before or after the send. From-address for this mail can be the same verified sender as the welcome email, `scores@mindweavetech.com`. If someone has no email, they are skipped and the sheet says how many were skipped, without listing addresses. If Resend is not configured, the button explains that and Copy link still works.
- Preview opens the public page.

Help: “Share image makes a picture for WhatsApp or a text. It shows Rummy Home, the game, the date, and the totals. Copy link still opens the page. Email sends that link to the people you checked and does not show their addresses.”

### 3.10 Enter scores

Only a game admin can open this. Anyone else who deep-links here sees “View only” and a Back button.

```
+----------------------------------+
|  <           Round 4          ? |
|                                  |
| [ Drop -10 ] [ Middle -30 ] [Rummy]
|                                  |
|  SK  Sree          not scored    |
|  P1  Player 1      -10        x  |
|  P10 Player 10     tap to enter  |
|                                  |
|  Off by 10                       |
|  [ Submit round ]                |
+----------------------------------+
```

- Drop, Middle drop, and Rummy apply to the player that is tapped next, or the big tiles set a mode and each row applies it. Tap a row to type an exact score (count). The keypad allows a minus.
- The round must add to 0, including the expense column when expense is on. Submit stays disabled until it does, and the line says “Off by N” or “Balanced.”
- Rummy winners split the positive side. The existing scoring rules do not change.
- Submit returns to the scorecard with the new round at the top of the table.
- Landscape: the three tiles and the tally stay in a left column; player rows are two columns on the right.

Help: “Submit stays off until this round adds to 0, including the expense column. The line under the list says Balanced or how far off it is.” Do not explain what Drop, Middle drop, or Rummy mean.

### 3.11 Complete game

Done on the scorecard opens this confirm. It is not a separate tab. It closes the game and leaves the points as they are.

```
+----------------------------------+
|  Complete this game?          ?  |
|  ID F28KCA                       |
|                                  |
|  Sree            +40             |
|  Player 1        -20             |
|  Player 2        -20             |
|                                  |
|  The scores stay as they are.    |
|                                  |
|  [ Not yet ]     [ Confirm ]     |
+----------------------------------+
```

- The list is the points, read-only, so the host can see them before closing the game. There is no amount field.
- Confirm marks the game completed and returns to the scorecard. It does not open Results. Places for these points are Home → Results.

Help: “This closes the game. The points stay as they are.”

### 3.12 Results

Opened only from the Results button on Home. Not from a scorecard, and not after Complete. The first screen only picks games. Show results, and a declared result, both open the same page. That page is exactly these four parts, top to bottom, and nothing else:

```
+------------------------------------------+
|  <          Results           Share   ?  |
|                                          |
|  Results                                 |
|  Wed, Oct 28 · 6:40 PM                   |
|                                          |
|  Totals                                  |
|  Sree            +50    Player 2   -40   |
|  Player 1        +10    Player 4   -10   |
|  Bea               0                     |
|                                          |
|  Player   DP5MXW   K91Q    Total       |
|  Bea          0     —       0          |
|  Player 1   +10     —     +10          |
|  Player 2   -40   +0     -40          |
|  Player 4     —   -10     -10          |
|  Sree      +30   +20     +50          |
|                                          |
|  1st   Sree                         +50  |
|  2nd   Player 1                     +10  |
|  3rd   Player 2                     -40  |
+------------------------------------------+
```

- The picker lists every finished game this person can see, not only games they run. Show results opens the page above. The created time is the moment Show results was tapped. A declared result uses the time it was declared.
- Totals: everyone with a positive total, and anyone on exactly 0, is in the left column. Everyone with a negative total is in the right column. Each column is sorted by magnitude, largest first.
- The table has one row per player. Names are sorted by first name, A to Z. The columns are each selected game, then a Total column. A cell is that player’s points in that game. A dash means they did not play. A zero means they played and scored 0. The expense column is not a person and is not a column here. The name column and the header row stay put, and the Total column stays on screen. Each score column is at least 56 wide, the same kind of floor the scorecard uses so a signed total stays readable. As many games as fit are shown: about three on a small phone, four or five on a typical phone, and more on a tablet or in landscape. Extra games scroll sideways. Turning the phone measures the width again. The rows scroll up and down, through as many as 50 players.
- 1st, 2nd, and 3rd place are the last thing on the page. Highest points are 1st. A tie shares the place, and the next place skips.
- A game can seat at most 15 players. The new-game screen and Add player say “A game can have at most 15 players.” A Results view can include at most 50 distinct players. Show results and Declare results stay off, and the screen says “Results can include at most 50 players.”
- Declare results saves that snapshot, including each game’s scores, so the page can be opened later. The button stays off unless the signed-in person is an admin of every checked game. The screen says so. Anyone can view a declared result. Declaring again writes another result. It does not change the previous one.
- Share in the header is not a fifth section on the page. It offers two choices. Share results sends a short picture: Rummy Home, the title, the date, 1st, 2nd, and 3rd, and the top totals. Share full details (PDF) sends a PDF with the title, the created date and time, the list of games, the full players-by-games table with totals, the positive and negative totals, and the places. A long list can run onto another page.
- Empty list: “No finished games yet. Complete a game, then its points can be added up here.”
- Nothing on this screen talks about payments, coins, or prizes. The words are place and winner.
- The old Settle screens and `prize_sessions` tables remain in the repo. `EXPO_PUBLIC_SETTLE_ENABLED` is off, so those screens redirect home. They are not the feature.

Help: “Check finished games, then show the results. Positive totals are on the left and negative totals are on the right. Each row is a player, in first-name order, and the columns are the games and a total. A dash means they did not play. The name and the total stay on screen, and as many games as fit are shown. 1st, 2nd, and 3rd place are at the bottom, and the highest score is the winner. Declare results saves that snapshot, and only an admin of every checked game can do it. Anyone can view a declared result. Results can include at most 50 players. Share results sends a picture of the places. Share full details (PDF) sends the whole table.”

### 3.13 Players (my list)

```
+----------------------------------+
|  Players · 12                 ?  |
|                                  |
|  [ search name or player ID    ]  |
|                                  |
|  [ Find players ]    [ Invite ]  |
|                                  |
|  +------------------------------+|
|  | SK  Sree Koneru              ||
|  |     SK82                     ||
|  +------------------------------+|
|  | P1  Player 1                 ||
|  |     QTGFJH                   ||
|  +------------------------------+|
|                                  |
|  Home      Players        Me     |
+----------------------------------+
```

- The count is my list, not every account.
- Each row is name and player ID. Email is never on this list, including after someone was found by email.
- The search box filters this list by name or player ID. Email search of accounts you have not added yet is on Find, not here. Phone is not searched.
- Find players opens 3.14. Invite opens the phone share sheet (3.15) and does not open a form.
- Sort control, top right: “Most games” (default) or “Name.”
- Tap a row: a short sheet, not a new page.

```
|  Player 1                        |
|  ID QTGFJH                       |
|  6 games with you                |
|                                  |
|  [ Remove from my players ]      |
```

- Remove asks “Remove Player 1 from your list?” Confirm removes the row immediately. If the save fails, the row returns and a line says “Couldn’t remove them. Try again.” Their account stays. Past games stay.
- There is no pencil on someone else’s row. I cannot edit their name, email, or phone.
- My own row, if I added myself, says “This is you” and opens Me.

Empty: “No players yet.” Two buttons, Find players and Invite.

Help: “This is your list, not everyone with an account. Find adds someone who already signed up. Invite sends a link to get the app. You only see a name and a player ID.”

### 3.14 Find players

```
+----------------------------------+
|  <          Find players      ? |
|                                  |
|  [ first, last, email, or ID  ]  |
|                                  |
|  +------------------------------+|
|  | Player 1                     ||
|  | QTGFJH                  [ + ]||
|  +------------------------------+|
|  | Player 10                    ||
|  | RJJNRG                  [ + ]|
|  +------------------------------+|
|                                  |
|  [ Invite someone new ]          |
+----------------------------------+
```

- Search matches first name, last name, and player ID as you type (two characters, then a short pause). An email match is different: the whole address, exactly, or that person does not appear. A partial email shows nobody. Phone is not searched.
- Each result shows name, player ID, and +. It does not show an email, even when the search text was an email.
- + adds that account to my players and nowhere else. The button becomes “Added” immediately, before the network returns. On failure it reverts to + and says why. Back on my list, the new row is name and player ID only.
- Back to Players shows the new row without a refresh. If Find was opened from New game, that person is checked on the way back.
- No email field, no phone field, no WhatsApp button, no Text button, no “Go to new game.”
- Invite someone new is the same share sheet as 3.15.
- No matches: “No account matches that. Invite them and they can join after they sign up.”

Help: “Search a first name, last name, or player ID. An email works only if you type the whole address, and the address is never shown. + adds them to your list only. It does not put them in a game. Invite opens your phone’s share sheet.”

Invite (3.15) is the phone’s own share sheet, so it has no Rummy Home ? icon. The Players and Find help cover what Invite does.

### 3.15 Invite

No screen of its own. The button calls the phone share sheet with:

- message: `Play Rummy Home with me: https://sreeatcandorps.github.io/Games/get`
- url: that same link, so iOS can share it as a link

The host picks WhatsApp, Messages, Mail, or anything else the phone already has. The app does not ask for a destination.

The link is a small page on the existing GitHub Pages site:

- iPhone: the iOS app link when one exists. Until TestFlight or the App Store listing exists, the page says the iPhone app is not up yet and shows the same instructions.
- Android: the current preview APK (or Play Store once the app is listed).
- Desktop: one sentence and the same two links.

That page is static HTML next to the password-reset page. It does not collect an email or a phone number.

### 3.16 Me

Replaces Settings and Profile as two different places. The avatar and the Me tab open this.

```
+----------------------------------+
|  Me                           ?  |
|                                  |
|  SK   Sree Koneru                |
|       koneru2k@gmail.com         |
|       Player ID SK82    [ Share ]|
|                                  |
|  Name              [ Edit ]      |
|  Phone             Optional      |
|  Passcode          [ Change ]    |
|                                  |
|  Dark mode                 ( )   |
|                                  |
|  [ Log out ]                     |
|                                  |
|  Home      Players        Me     |
+----------------------------------+
```

- Share on the player ID uses the phone share sheet with the ID text only (“Add me on Rummy Home. My player ID is SK82.”).
- Edit name saves to my profile. My own email is shown here and is not edited (it is the login). Nobody else’s email is shown on this screen or anywhere else. Changing email can be a later flow.
- Phone is one optional field. Saving it does not send an SMS.
- Change passcode sends the same reset email as 3.3.
- Dark mode stays, stored on the phone.
- Game rules (lowest score wins, max score, round limit) are removed. Stake defaults live on New game, where they actually apply.
- Log out returns to Sign in.
- Allowlisted admin only: a collapsed “Demo data” group with Load and Clear, same behavior as today.

Help: “The email here is yours. It is how you sign in. Your player ID is what you give someone so they can find you. Phone is optional and is never texted. Dark mode is saved on this phone.”

### 3.17 Public scorecard (browser)

No login. Looks like the phone scorecard: cream page, felt header, totals in the column headers, start time and game ID in the header, sideways scroll, refreshes about every 8 seconds.

```
+----------------------------------+
|  Rummy scorecard              ?  |
|  Started Tue, Oct 27, 4:05 PM    |
|  ID F28KCA · Live                |
|                                  |
| RND | SK 12 | P1 -4 | P10 0 | .. |
|  3  | +22   | -10   |  -2   |    |
+----------------------------------+
```

- A bad or missing token says “This scorecard link is not valid.” It does not show another game.

Help: “This page updates on its own. The start time and game ID say which game it is. No login. Anyone with the link can watch.”
- Hosting is section 5.

## 4. Flows

### New user

1. Create account (name, email, passcode; phone skipped). A welcome email is sent from `scores@mindweavetech.com`. The app does not wait for it.
2. Home, empty. Recent says there are no games yet. One obvious New game.
3. They need another person: Players → Find, or Invite.
4. If their email was taken: Sign in, with the email kept.

### Start a game

1. Home → New game. The screen says Points. When it is finished, Home → Results can add those points into places.
2. Leave I'm playing on, or turn it off to keep score only.
3. Check people on my list. Missing someone: Find, tap +, return, they are checked. The list shows name and player ID, not email.
4. Not registered: Invite, they install and create an account, then Find → +.
5. Start game → scorecard. Home’s Live card and the Recent row are this game. Tapping Recent opens it.
6. A person who was added, when they sign in, sees this game under Recent. They do not need a separate History.

### Add players and invite

1. Players tab. Find players.
2. Type a first name, last name, or player ID. Or type a full email. A partial email matches nobody.
3. The result is name and player ID. Tap +. The row says Added. Back. The Players count includes them, still with no email on screen.
4. Or Invite. The share sheet opens. No fields to fill in.

### Live scoring

1. Admin: Home → Resume, or the games row.
2. Add round → mark drop, middle drop, rummy, or a typed count → Submit when the round adds to 0.
3. Undo asks, then removes the last round.
4. (...) → Players to promote a seated player, add a watcher, or Add non-player admin from my players. If the scorekeeper is not on the list, the sheet sends them to Find Players and they come back. The new admin is not a column.
5. The same Players sheet still promotes after the game is completed.
6. A normal player or a watcher opens the same scorecard from Recent. They see View only. Add round is not there.

### Results

1. An admin taps Done on the scorecard, confirms the points, and returns to the scorecard. Nothing there mentions Results.
2. Later, from Home, they tap Results. The list is finished games they can see. They check the ones from the night and tap Show results. The page is the title and time, the two total columns, players down the side with a column per game and a total, and 1st, 2nd, and 3rd place.
3. If they run every checked game, and the selection has at most 50 players, Declare results saves the snapshot and opens the same page. Someone who does not run one of the checked games can still show the results, and Declare stays off.
4. Anyone signed in can open that result again from Declared. Declaring again writes a new result.

### Share

1. Scorecard → (...) → Share. This works while the game is live and after it is completed. Results → Share works once the results page is open.
2. On a scorecard, Share image makes the Rummy Home picture for WhatsApp or a text. On Results, Share results is the short podium picture, and Share full details (PDF) is the full table for WhatsApp or a text.
3. Copy link is still there. Paste it into WhatsApp when a link is wanted. Or leave people checked and Email selected. The send uses the account address and does not show it. The sender is `scores@mindweavetech.com` when that Resend setup is in place.
4. The recipient opens the link in a browser. No account. They see the start time, the game ID, and the live totals. Results does not have a public link.

### History

There is no History screen. Recent, with All / Live / Today, is that list, and each row opens the scorecard. Results is the button above it, and it is not repeated on the scorecard.

## 5. Public scorecard hosting

Stop sending people to the Supabase function URL. The function in the repo sets `Content-Type: text/html`, and the gateway still showed the source as plain text. GitHub Pages serves real HTML.

- Page: `https://sreeatcandorps.github.io/Games/scorecard.html?t=TOKEN`
- The site is already the password-reset host (`public/index.html` on the Games Pages site). Add the scorecard file beside it. Start from `rummy-home3/web/scorecard.html`.
- The page calls the existing `public_scorecard` RPC with the anon key. The anon key is public by design. The RPC returns a game only when the token is 48 hex characters, so the key does not expose other games.
- The function can stay deployed as a JSON backup. The app must not copy its URL.
- App config: `EXPO_PUBLIC_SCORECARD_URL` base becomes `https://sreeatcandorps.github.io/Games/scorecard.html`.
- The invite link is a different file on the same site: `https://sreeatcandorps.github.io/Games/get`, with a small script or meta refresh by user agent, as in 3.15.

What has to be true before a copied link works: migration `006_friday_game_night.sql` is applied (the RPC and `view_token`), and the HTML file is published on Pages. No Resend key is required for Copy link. The welcome email does need Resend, with the from-address `scores@mindweavetech.com`.

## 6. Bug-fix list

These are part of the redesign build, in this order. They are listed so none of them are left as “polish.”

1. Delete the Home tiles Active, Players, and Today, and the shortcut row Find players / History / All players. Home is section 3.4.
2. Recent is the one games list, with All / Live / Today chips. Tapping a row opens that scorecard. Remove the History screen and the `filter` query params. Recent must not spin with no way out.
3. Put Results on Home only, labeled Results. The picker lists finished games this person can see. Show results opens the four-part page: title and time, positive and negative totals, one row per player with a column per game and a total, then 1st, 2nd, and 3rd place. Declare is only for an admin of every checked game. Anyone can view a declared result. A game seats at most 15 players. A results view holds at most 50. Settle stays hidden behind its flag. Remove prize controls from the scorecard and from Complete.
4. Add `my_players` (owner, player, created_at, games_together). Find + inserts a row. Playing a game inserts rows for the other people. Home and New game read this list, not `select * from profiles`. Rows store no email for display.
5. Find searches first name, last name, player ID, and email. An email hit requires the full address. Each result shows name, player ID, and +. The email is never shown, before or after +. + updates my list on screen immediately.
6. Invite is only the native share sheet and `…/Games/get`. Remove the email, phone, WhatsApp, and Text fields from Find Players. Remove the unused SMS and mailto helpers on the Players screen.
7. Phone remains an optional field on Me and on Create account. No screen searches or texts it.
8. Players list: tapping a row opens the small sheet. Remove the pencil for anyone but me. Remove writes `my_players` and drops the row immediately, putting it back if the write fails. Delete the “this device's local list” dialog. Delete the local-only add dialog.
9. Edit profile for another person goes away, which removes the spinner page. Me loads my own profile. If that request fails, show Retry, not an infinite spinner.
10. Active / History must not take over the screen. Show the last games, refresh behind them, and give up after 12 seconds with Retry. A live count of 0 stays on Home as “No live game.”
11. Do not call `listPlayers()` (all profiles) from Home. The games query is one RPC, `list_visible_game_ids`, then one games read. Cache it for the Home list so opening a chip does not refetch. Add a statement timeout on that RPC so a bad plan returns an error instead of hanging. Confirm 006 is applied; the fallback path should show “Database update needed” rather than spin.
12. Publish the scorecard on GitHub Pages and point Copy link at it. Check the response is `text/html` and that the browser renders the table, the start time, and the game ID.
13. Scorecard header: stop toggling `headerShown` with orientation. Portrait currently mounts the native stack header, and landscape replaces it with a custom bar that pads for the notch (`headerShown: !isShort` in `games/[id].tsx`). Coming back to portrait, the native header keeps the old title frame, so “Scoreboard” sits away from the back button. Use one header component in both orientations, `headerTitleAlign: 'left'`, a single-line title with a fixed gap after the back button, and only change the header height when `isShort` changes. Do not render a second top bar in landscape.
14. Rename the in-app title from Scoreboard to Scorecard so it matches the header, the menu, and the public page.
15. Remove dead screens: `players/search`, `app/(screens)/game.tsx`, and the Settings game-rules block. Fold Profile into Me.
16. Scorecard menu: Players and Share. Preview lives inside Share.
17. Undo asks before it removes the round.
18. New game reads my players. I'm playing stays optional. The screen says Points. Results totals those points. The expense column is not a place.
19. Add non-player admin on the game sheet, picked only from my players, with the Find Players hand-off when they are missing. They get no score column. Promote stays available after the game is completed.
20. Welcome email on account creation, from `scores@mindweavetech.com` via Resend. Sign-up still finishes if the send fails.
21. Add a ? on every screen, using the first-draft help under section 3. Skip obvious scoring instructions.

## 7. Testing plan

Unit tests did not catch any of this. They check scoring math, initials, token shape, and who-may-score as pure functions. They never tap a tile, rotate the phone, or open a link. `npm run test:rls` does not run in CI without keys, and it does not open the APK. The manual checklist in `docs/testing-strategy.md` was not executed on the build Sree installed. That is why he was the first person to see dead tiles, the spinner, the local-only delete, and the raw HTML.

The bar for the next build: a person who is not Sree installs the APK and walks every flow below. The same flows are automated with Maestro against that APK. Detox is the fallback only if Maestro cannot drive a release build; Maestro is the one to use because it runs on the installed APK without a special test binary.

### What stays automated without a phone

- `npm test` and `npm run typecheck` on every change: scoring, places across games (ties share a place, expense is not a person), who may declare, share-token shape, admin vs view-only vs non-player admin. Pool splits are not part of this redesign. The hidden Settle helpers stay covered so that code does not rot, and they are not on screen.
- `npm run test:rls` against the real project once 006 is applied and keys exist: admin, co-admin, player, viewer, outsider. This must fail the job when it skips, so a missing key is a red build rather than a quiet pass.

### Maestro, on the APK, every screen

Run on a device or emulator with two accounts already created (A is the admin, B is a player). Seed a third account C who is in nobody’s list, and account D who is never added.

| Flow | Taps | Pass when |
| --- | --- | --- |
| Sign in | Open app, enter A’s email and passcode, eye toggle, Sign in | Home shows “Hi” and New game. No spinner over 12 seconds. |
| Bad passcode | Wrong code | Error text, fields kept, no navigation. |
| Create account | New email, passcode, skip phone | Lands on empty Home. Welcome mail is not required for the screen to finish. |
| Duplicate email | Register A’s email | “Sign in” opens login with that email. |
| Home is not a maze | Look at Home | There are no Active, Players, Today, History, or All players tiles. |
| Empty live | Account with no live game | “No live game.” Tapping it does not open a spinner. |
| New game | New game, turn I'm playing off, pick two people from my list, Start | Scorecard opens. A is not a column. A can Add round. |
| Find + | Players, Find, search C’s first name, tap + | Result is name and player ID, no email. Button says Added. Back. C is on the list, still with no email, without leaving and reopening. |
| Exact email | Find, type C’s full email, then a partial email | Full address returns C’s name and ID only. The partial returns nobody. |
| Find does not use phone | Search C’s phone | No result. |
| Recent | Home, tap the new game’s row | Scorecard opens. Empty Recent does not spin. |
| Invite | Invite | The OS share sheet opens. No email or phone field in the app. |
| Row and remove | Tap C, Remove, confirm | C is gone immediately. Kill and reopen the app. C is still gone. |
| Cannot edit C | Tap a remaining player | Sheet only. No spinner page. No pencil. |
| Visibility | B signs in | B sees A’s game on Home. D does not. |
| View only | B opens the game | No Add round, Undo, or Done. “View only.” |
| Promote | A → Players in this game → B admin. B reopens | B can Add round. After the game is completed, A can still promote someone. |
| Non-player admin | A adds E from my players as a non-player admin. Then tries a person who is not on the list | E can score and is not a column. The missing person shows the Find Players message and button, and Find is not a search field on the game. |
| Watcher | A adds D as view only. D signs in | D sees the game and cannot score. |
| Score | A adds a round that sums to 0, then one that does not | The bad round cannot submit. The good round appears. |
| Undo | Undo, cancel, Undo, confirm | Round remains after cancel, and is gone after confirm. |
| Rotate | Scorecard portrait → landscape → portrait | The title “Scorecard” lines up with the back button both times. Totals stay in the header. |
| Share | Copy link, open the URL in Chrome | Rendered page, not source. Start time and game ID visible. Add a round, wait, the page shows it. |
| Complete | Done, Confirm | Points are shown and cannot be edited. No Results button on the confirm. Scorecard says Completed. |
| Results | A → Home → Results, check two finished games, Show results | The page is the title and time, positive totals on the left, negative totals on the right, one row per player with a column per game and a total, then 1st, 2nd, and 3rd. Declare works because A runs both games. The scorecard has no Results control. Home has no Settle button. |
| Results blocked | Check a finished game A does not run | Show results still opens. Declare stays off and the screen says only an admin of every selected game can declare. |
| View | B opens the declared result | The same four parts, including each game’s scores. B cannot have declared a set that includes a game B does not run. |
| Help | Tap ? on Home, the scorecard, and Results | A short note opens and closes. The scorecard note does not teach scoring. Results talks about place and winner. |
| Today chip | Home, chip Today | Only today’s games. All brings the rest back without a full-screen spinner. |
| Offline | Airplane mode, open Home | Last list stays, or an error with Retry. Not an endless spinner. |
| Me | Avatar, edit name, toggle dark mode, log out, sign in | Name saved. Dark mode still on. |

Each Maestro flow is one YAML file under `rummy-home3/e2e/`. They run on the preview APK before that APK is sent to Sree. A red flow blocks the send.

### Manual pass on a real phone

Maestro will not catch a misaligned header as reliably as eyes will, and it will not show whether Pages returned `text/html`. Before Sree is asked to retest, someone else does this on a physical Android phone and writes pass or fail next to each line:

- Install the new APK over the old one. Cold start. Home in under a few seconds on wifi, and an error with Retry on a dead network.
- Rotate the scorecard both ways, twice. Photograph the header.
- Open the copied link in Chrome. The table renders. View source is not what the tab shows.
- Second phone, second account, the visibility and view-only rows above.
- Players: +, remove, airplane mode during remove. Confirm no other person’s email is on the list, the sheet, or Find results.
- One points game completed from Done. Home → Results shows its places. Declare works for the admin and stays off when a checked game is one they do not run. A second account can open the declared result. Home has no Settle button.
- A new account’s welcome email arrives from `scores@mindweavetech.com`.

`docs/testing-strategy.md` should gain this Maestro table and this phone pass when the redesign is built. Unit tests stay. They are not the sign-off.

## 8. Defaults chosen at build

These were still open when the build started. They are the behavior in the app until Sree says otherwise.

1. **Get page.** `https://sreeatcandorps.github.io/Games/get` tells an iPhone that the app is not up yet. Android says the preview APK is shared separately until Play exists. There is no store URL and no download link on that page.
2. **Today.** The Today chip uses the phone’s local timezone, the same way the old Today tile did.
3. **Expense.** The points game still has an expense column, and a round still has to add to 0. Results does not give that column a place. Complete has no amount editor. The old ledger rule left with Settle.
4. **Demo data.** Load and Clear stay on Me, and only for the allowlisted admin email (`EXPO_PUBLIC_ADMIN_EMAILS`, default `koneru2k@gmail.com`). They are not on Home.

## Later

- Pool games. This redesign shows Points. Results ranks the points already on the scorecard.
- Settle stays behind `EXPO_PUBLIC_SETTLE_ENABLED`. Turning that flag on is not part of Results.

## 9. Build order

No calendar estimate. This is the sequence, smallest confusing piece first, so a review can cut the later slices.

1. **Home and navigation.** Remove the duplicate tiles and the History screen. Recent is the list, with three chips, and a row opens the scorecard. Results entry point, loading/error/empty. Fixes the spinner and the “0 Active” dead end. Touches Home, the tab bar, and the games query cache.
2. **My players, Find, Invite.** New `my_players` data, + button, immediate list update, name and player ID only, exact email search, share sheet, delete the extra player screens and the invite form fields. Welcome email from `scores@mindweavetech.com`. Fixes the pencil, the spinner page, and Remove.
3. **Scorecard header, admins, and the public page.** One header across rotation. Promote during and after the game. Add non-player admin from my players only. Publish `scorecard.html` and `get/index.html` on `sreeatcandorps.github.io/Games`. Point Copy link at Pages. Share does not show emails.
4. **Results.** One entry on Home, labeled Results. Check finished games, show the four-part page, and declare only when the person runs every checked game. Anyone can view. The scorecard shares an image. Results shares a podium image and a full-details PDF. Settle stays hidden.
5. **Me.** Fold Profile and Settings together. Drop unused game rules. Phone stays optional. My own email stays on this screen.
6. **Help.** The ? and the first-draft copy in section 3, on every screen.
7. **Maestro pack and a phone pass** on the APK that contains 1–6, before that APK is handed to Sree.

Slices 1–3 are the Friday-night confusion. Slice 4 is Results. Slice 5 is cleanup. Slice 6 is the help icon and its copy. Slice 7 is the gate.
