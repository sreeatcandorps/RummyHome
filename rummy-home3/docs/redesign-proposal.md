# Rummy Home redesign proposal

Status: proposal for review. No app code in this change. The current look (felt green, cream, seat colors) stays. This redesign is about fewer screens, fewer taps, and the bugs from the latest APK (`a933e6b`).

Product rules that stay, from `docs/product-contract.md`, `docs/friday-setup.md`, and `docs/testing-strategy.md`:

- Sign in with email and a 6-digit passcode. Phone is optional profile data. No SMS.
- A game has 2–20 seated players. The creator is a game admin even when they only keep score.
- Any game admin can enter and undo scores and can promote another seated player. A seated player who is not an admin, and a view-only person, see the live scorecard and cannot change it.
- Someone sees a game when they created it, are seated, were added as view-only, or their account email matches a seat. An outsider does not see it in the app. Anyone with the unguessable link can watch the public page.
- Stake prize starts as each player’s points. Pool prize is one number (for example 800) given to the leader, with the cost split. Coins, not money. A ledger entry can have several legs and must add to 0. The session is settled when every balance is 0.
- Completed games stay scored. Prize edits are the coin ledger, not a rewrite of the rounds.

## 1. Problems found

### What Sree hit on the APK

1. Home has two rows that go to the same places. Active opens Games filtered to live. Players opens the same list as All players. Today opens History filtered to today. History is also a button, and Recent games has See all, which is History again.
2. Prize distribution is buried on History, and the screen is hard to use: balances, a ledger at the bottom, a menu to pick each person, and a free-typed plus or minus on every leg.
3. Find Players does not search first or last name. The service comment says names are excluded on purpose. Results show a name and a player ID, and no email. There is no + button, so a match cannot be saved onto the searcher’s own list. Under the search are Email, Phone, WhatsApp, and Text fields.
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
| Home | New game, the live game, Settle prizes, and the one games list |
| Players | My players, with Find and Invite |
| Me | My name, email, passcode, optional phone, appearance, log out |

A pushed screen is only for a task: New game, Find players, Scorecard, Enter scores, Settle, and the public page (browser). Player detail, edit-someone-else, Search players, the local add form, the stub Game screen, and the stat-tile routes go away.

```
Home ── New game ── Scorecard ── Enter scores
  │         │            │
  │         │            ├── Players in this game (sheet)
  │         │            ├── Share (sheet)
  │         │            └── Complete (confirm, then coins)
  │         └── needs someone? ── Find players ── back, already on my list
  └── Settle prizes ── pick games ── ledger
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

### 3.1 Sign in

```
+----------------------------------+
|            [ RH logo ]           |
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

### 3.2 Create account

```
+----------------------------------+
|  <         Create account        |
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
- Success goes straight to Home. Confirm-email stays off so Friday sign-in is immediate.
- A welcome email is sent only when Resend is configured. Account creation does not wait for it.

### 3.3 Forgot passcode

```
+----------------------------------+
|  <         Reset passcode        |
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

### 3.4 Home

Portrait. This replaces the hero stat tiles, the shortcut row, Recent games, and History.

```
+----------------------------------+
| [logo] Rummy Home            (SK)|
|                                  |
|  Hi Sree                         |
|  [ + New game                 ]  |
|                                  |
|  Live                            |
|  +------------------------------+|
|  | Stake · ID F28KCA            ||
|  | Started Tue, Oct 27 · 4:05   ||
|  | Sree, Player 1, Player 2 +9  ||
|  | [ Resume ]                   ||
|  +------------------------------+|
|                                  |
|  [ Settle prizes ]               |
|                                  |
|  Games                    All v  |
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
- Settle prizes is always on Home, under the live card. It opens 3.12. It is disabled with the caption “Finish a game first” when the viewer has no completed game they admin. A player who only watches does not see it.
- Games is one list. Chips filter it in place: All, Live, Today. Today is this chip, not a screen. The list is the old History. A row opens the scorecard.
- The chip and the list use the games Home already loaded. Changing a chip does not fetch again.
- Pull to refresh fetches in the background and keeps the list on screen.
- Empty list: “No games yet.” The only action is the New game button already at the top. The empty card does not add a second New game button.
- Landscape: New game and the live card on the left, the games list on the right. Same chips. No third column.
- The avatar opens Me.
- Demo load/clear moves to Me, and only for the allowlisted admin email. It is not on Home.

### 3.5 New game

```
+----------------------------------+
|  <            New game           |
|                                  |
|  [ Stake ]          [ Pool ]     |
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

- Stake and Pool only change the defaults shown under them (pool shows the pool amount, default 100). Those defaults are copied onto the game. They can be changed here until the first round is saved, then only from the scorecard Players sheet by an admin, until the game is completed.
- I'm playing is on by default. Off means the creator keeps score and is not a column. They are still the game admin.
- The checklist is my players, not every account. Search filters that list.
- Find players opens 3.7. On return, a person just added is already checked.
- Start needs 2 seated people. If I'm playing is on, one other person is enough. The button says why it is disabled: “Pick at least one more player.”
- Start opens the scorecard. The new game is the Live card on Home immediately.

### 3.6 Scorecard, portrait

The table itself stays: initials and totals in the sticky header, rounds underneath, horizontal scroll when there are many players, dealer column marked, a round that does not add to 0 in red. No standings rail.

```
+----------------------------------+
| <  Scorecard            ( ... )  |
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
- The header does not unmount when the phone rotates. See the fix in section 6, item 9.
- (...) opens a menu with two items: Players, Share. View is inside Share as Preview.
- Admin (creator or a promoted game admin), game still live: bottom bar is Undo, Add round, Done.
- Seated non-admin, or view-only: no bottom bar. A line under the tags says “View only.” The table still updates when someone else scores.
- Completed game: no bottom bar. A line says “Completed.” An admin sees “Settle this game” which opens Settle with this game already selected.
- Undo asks “Remove the last round?” so a mis-tap does not wipe a hand. Confirm, then the round is gone on this phone and on the public page.
- Many players: the header and the rows scroll sideways together. Totals stay in the header cells, not in a bottom total row and not in a standings panel.

### 3.7 Scorecard, landscape

Same header, shorter. The table gets the rest of the width. The bottom bar stays. There is no side standings panel.

```
+------------------------------------------------------------------+
| < Scorecard   Tue Oct 27 · 4:05 PM · ID F28KCA          ( ... )  |
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
|  Players in this game        (x) |
|                                  |
|  Sree Koneru          Admin      |
|  Player 1             [ Admin ]  |
|  Player 2             Player     |
|                                  |
|  Watching                        |
|  Player 9             View only  |
|                                  |
|  [ Add someone from my players ] |
+----------------------------------+
```

- An admin can switch a seated player to Admin. That person can then enter and undo scores.
- An admin can add someone from my players as View only. They see the game at Home and cannot score. They are not a column.
- A non-admin sees the same list with the switches hidden.
- Adding a seated player mid-game is a separate row at the bottom, “Add a player,” only before the game is completed. Earlier rounds count as 0 for them until an admin enters an adjustment. Order in this list is the deal order; drag the handle to reorder before the first round is saved.

### 3.9 Share (sheet)

```
+----------------------------------+
|  Share scorecard             (x) |
|  Anyone with the link can watch. |
|  Started Tue Oct 27 · 4:05 PM    |
|  ID F28KCA                       |
|                                  |
|  [x] Sree        sree@…          |
|  [x] Player 1    p1@…            |
|  [ ] Player 2    (no email)      |
|                                  |
|  [ Copy link ]                   |
|  [ Email selected ]              |
|  [ Preview ]                     |
+----------------------------------+
```

- The link is the GitHub Pages URL in section 5, not the Supabase function URL.
- Copy link puts that URL on the clipboard and confirms “Copied.” That is the WhatsApp path: the host pastes it. The app does not collect a phone number.
- Email selected calls the existing send-email function for checked people who have an email. If Resend is not configured, the button explains that and Copy link still works.
- Preview opens the public page.
- People with no email stay unchecked and cannot be checked for email. They can still be sent the copied link.

### 3.10 Enter scores

Only a game admin can open this. Anyone else who deep-links here sees “View only” and a Back button.

```
+----------------------------------+
|  <           Round 4             |
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

### 3.11 Complete game

Done on the scorecard opens this confirm. It is not a separate tab.

```
+----------------------------------+
|  Complete this game?             |
|  ID F28KCA                       |
|                                  |
|  Points          Prize coins     |
|  Sree      +40   [  40 ]         |
|  Player 1  -20   [ -20 ]         |
|  Player 2  -20   [ -20 ]         |
|                                  |
|  These coins add to 0.           |
|                                  |
|  [ Not yet ]     [ Confirm ]     |
+----------------------------------+
```

- Stake: each coin field starts as that player’s points. The host can edit them. Show the sum. Confirm is allowed when the host is done; if the sum is not 0 (an expense column often causes this), say so and still allow confirm. Settlement later has to bring balances to 0.
- Pool: one field, “Prize coins,” default the game’s pool amount (800 if they set that). The app fills each player’s coins: the leader gets the prize, the others split the cost, ties split, a full tie moves 0. The host can still edit each line. The filled coins add to 0.
- Confirm marks the game completed and returns to the scorecard. The next prompt is “Settle now?” which opens Settle with this game selected. Not yet returns Home.

### 3.12 Settle prizes

Opened from Home, or from a completed scorecard. Two steps on one stack, not a mode hidden inside History.

Step 1, pick games:

```
+----------------------------------+
|  <          Settle prizes        |
|                                  |
|  chips:  Today          All      |
|                                  |
|  [x] Tue 4:40   DP5MXW   Stake   |
|  [x] Tue 6:10   K91Q    Pool     |
|  [ ] Mon 8:02   AA12    Stake    |
|                                  |
|  [ Continue · 2 games ]          |
+----------------------------------+
```

- Today is the default chip, because a Friday night is one session. All shows older completed games.
- Only games where I am a game admin can be selected. Other completed games are visible and not selectable, with the caption “You’re not an admin of this game.”
- Continue creates the session and opens the ledger. Opening balances are the sum of the coin lines from each game.

Step 2, the ledger. Balances first. The entry form is the next thing, not a block buried under a log.

```
+----------------------------------+
|  <          Tonight              |
|  2 games · not settled           |
|                                  |
|  Name            Start     Now   |
|  Sree             +40     +40    |
|  Player 1         -20     -20    |
|  Player 2         -10     -10    |
|  Player 3         -10     -10    |
|                                  |
|  Record a payment                |
|  From   [ Player 1        v ]    |
|  To     [ Sree            v ]    |
|  Coins  [ 20 ]                   |
|  Adds to 0.                      |
|  [ Save payment ]                |
|                                  |
|  More than two people?           |
|                                  |
|  Payments                        |
|  (none yet)                      |
+----------------------------------+
```

- A payment is the normal case: one person gives coins to one person. That is two legs, and they add to 0 by construction (From −20, To +20). No plus/minus toggle and no per-leg menu.
- “More than two people?” opens extra rows only when a split needs them:

```
|  Sree        [ +40 ]             |
|  Player 1    [ -20 ]             |
|  Player 2    [ -20 ]             |
|  These add to 0.                 |
|  [ Save ]                        |
```

- Save stays disabled until the legs add to 0 and at least two people are filled. The line under the fields says the sum.
- After save, the payment appears at the top of Payments, and the Now column updates immediately:

```
|  Player 1 paid Sree 20           |
|  Player 1  -20    Sree  +20      |
|                                  |
|  Sree            +40      +20    |
|  Player 1        -20       0     |
```

- When every Now value is 0, the title becomes “Settled,” the form hides, and Home shows this session as settled. A settled session can be reopened from Home → Settle prizes → Past sessions, read-only.
- Wording on this screen is coins and prize. It does not say money, dollars, or cash.

### 3.13 Players (my list)

```
+----------------------------------+
|  Players · 12                    |
|                                  |
|  [ search name, ID, or email  ]  |
|                                  |
|  [ Find players ]    [ Invite ]  |
|                                  |
|  +------------------------------+|
|  | SK  Sree Koneru              ||
|  |     SK82 · sree@…            ||
|  +------------------------------+|
|  | P1  Player 1                 ||
|  |     QTGFJH · p1@…            ||
|  +------------------------------+|
|                                  |
|  Home      Players        Me     |
+----------------------------------+
```

- The count is my list, not every account.
- Search filters this list by first name, last name, player ID, or email. It does not search phone.
- Find players opens 3.14. Invite opens the phone share sheet (3.15) and does not open a form.
- Sort control, top right: “Most games” (default) or “Name.”
- Tap a row: a short sheet, not a new page.

```
|  Player 1                        |
|  ID QTGFJH                       |
|  p1@example.com                  |
|  6 games with you                |
|                                  |
|  [ Remove from my players ]      |
```

- Remove asks “Remove Player 1 from your list?” Confirm removes the row immediately. If the save fails, the row returns and a line says “Couldn’t remove them. Try again.” Their account stays. Past games stay.
- There is no pencil on someone else’s row. I cannot edit their name, email, or phone.
- My own row, if I added myself, says “This is you” and opens Me.

Empty: “No players yet.” Two buttons, Find players and Invite.

### 3.14 Find players

```
+----------------------------------+
|  <          Find players         |
|                                  |
|  [ first, last, email, or ID  ]  |
|                                  |
|  +------------------------------+|
|  | Player 1                     ||
|  | QTGFJH                       ||
|  | player1@rummyhome.com        ||
|  |                         [ + ]||
|  +------------------------------+|
|  | Player 10                    ||
|  | RJJNRG                       ||
|  | player10@rummyhome.com   [ + ]|
|  +------------------------------+|
|                                  |
|  [ Invite someone new ]          |
+----------------------------------+
```

- Search matches first name, last name, email, and player ID. It does not match phone. Two characters is enough to search; the query is debounced.
- Each result shows name, player ID, and email, plus +.
- + adds that account to my players and nowhere else. The button becomes “Added” immediately, before the network returns. On failure it reverts to + and says why.
- Back to Players shows the new row without a refresh. If Find was opened from New game, that person is checked on the way back.
- No email field, no phone field, no WhatsApp button, no Text button, no “Go to new game.”
- Invite someone new is the same share sheet as 3.15.
- No matches: “No account matches that. Invite them and they can join after they sign up.”

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
|  Me                              |
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
- Edit name saves to my profile. Email is shown and is not edited here (it is the login). Changing email can be a later flow.
- Phone is one optional field. Saving it does not send an SMS.
- Change passcode sends the same reset email as 3.3.
- Dark mode stays, stored on the phone.
- Game rules (lowest score wins, max score, round limit) are removed. Stake and pool defaults live on New game, where they actually apply.
- Log out returns to Sign in.
- Allowlisted admin only: a collapsed “Demo data” group with Load and Clear, same behavior as today.

### 3.17 Public scorecard (browser)

No login. Looks like the phone scorecard: cream page, felt header, totals in the column headers, start time and game ID in the header, sideways scroll, refreshes about every 8 seconds.

```
+----------------------------------+
|  Rummy scorecard                 |
|  Started Tue, Oct 27, 4:05 PM    |
|  ID F28KCA · Live                |
|                                  |
| RND | SK 12 | P1 -4 | P10 0 | .. |
|  3  | +22   | -10   |  -2   |    |
+----------------------------------+
```

- A bad or missing token says “This scorecard link is not valid.” It does not show another game.
- Hosting is section 5.

## 4. Flows

### New user

1. Create account (name, email, passcode; phone skipped).
2. Home, empty. One obvious New game.
3. They need another person: Players → Find, or Invite.
4. If their email was taken: Sign in, with the email kept.

### Start a game

1. Home → New game.
2. Stake or Pool. Leave I'm playing on, or turn it off to keep score only.
3. Check people on my list. Missing someone: Find, tap +, return, they are checked.
4. Not registered: Invite, they install and create an account, then Find → +.
5. Start game → scorecard. Home’s Live card is this game.
6. A person who was added, when they sign in, sees this game on their Home. They do not need a separate History.

### Add players and invite

1. Players tab. Find players.
2. Type a first name, last name, email, or player ID.
3. Tap +. The row says Added. Back. The Players count includes them.
4. Or Invite. The share sheet opens. No fields to fill in.

### Live scoring

1. Admin: Home → Resume, or the games row.
2. Add round → mark drop, middle drop, rummy, or a typed count → Submit when the round adds to 0.
3. Undo asks, then removes the last round.
4. (...) → Players to promote an admin or add a watcher.
5. A normal player or a watcher opens the same scorecard from Home. They see View only. Add round is not there.

### Prizes and the ledger

1. Admin taps Done. Checks coins. Confirms.
2. Settle now, or later from Home → Settle prizes.
3. Today’s finished games are checked. Continue.
4. Record a payment: From, To, coins. Save. The Now column moves. The payment line appears above the form.
5. Repeat until every Now is 0. The screen says Settled.

### Share

1. Scorecard → (...) → Share.
2. Copy link. Paste into WhatsApp.
3. Or leave everyone checked and Email selected, when Resend is set up.
4. The recipient opens the link in a browser. No account. They see the start time, the game ID, and the live totals.

### History

There is no History screen. Home’s games list, with All / Live / Today, is history. A completed row opens the read-only scorecard. Settle prizes is the button above that list.

## 5. Public scorecard hosting

Stop sending people to the Supabase function URL. The function in the repo sets `Content-Type: text/html`, and the gateway still showed the source as plain text. GitHub Pages serves real HTML.

- Page: `https://sreeatcandorps.github.io/Games/scorecard.html?t=TOKEN`
- The site is already the password-reset host (`public/index.html` on the Games Pages site). Add the scorecard file beside it. Start from `rummy-home3/web/scorecard.html`.
- The page calls the existing `public_scorecard` RPC with the anon key. The anon key is public by design. The RPC returns a game only when the token is 48 hex characters, so the key does not expose other games.
- The function can stay deployed as a JSON backup. The app must not copy its URL.
- App config: `EXPO_PUBLIC_SCORECARD_URL` base becomes `https://sreeatcandorps.github.io/Games/scorecard.html`.
- The invite link is a different file on the same site: `https://sreeatcandorps.github.io/Games/get`, with a small script or meta refresh by user agent, as in 3.15.

What has to be true before a copied link works: migration `006_friday_game_night.sql` is applied (the RPC and `view_token`), and the HTML file is published on Pages. No Resend key is required for Copy link.

## 6. Bug-fix list

These are part of the redesign build, in this order. They are listed so none of them are left as “polish.”

1. Delete the Home tiles Active, Players, and Today, and the shortcut row Find players / History / All players. Home is section 3.4.
2. One games list with All / Live / Today chips. Remove the History screen and the `filter` query params.
3. Put Settle prizes on Home. Rebuild the ledger as From → To → coins, with an optional multi-person entry that must add to 0. Remove the player menu and the +/- control.
4. Add `my_players` (owner, player, created_at, games_together). Find + inserts a row. Playing a game inserts rows for the other people. Home and New game read this list, not `select * from profiles`.
5. Find searches first name, last name, email, and player ID. Each result shows name, player ID, email, and +. + updates my list on screen immediately.
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
18. New game reads my players. I'm playing stays optional.

## 7. Testing plan

Unit tests did not catch any of this. They check scoring math, initials, token shape, and who-may-score as pure functions. They never tap a tile, rotate the phone, or open a link. `npm run test:rls` does not run in CI without keys, and it does not open the APK. The manual checklist in `docs/testing-strategy.md` was not executed on the build Sree installed. That is why he was the first person to see dead tiles, the spinner, the local-only delete, and the raw HTML.

The bar for the next build: a person who is not Sree installs the APK and walks every flow below. The same flows are automated with Maestro against that APK. Detox is the fallback only if Maestro cannot drive a release build; Maestro is the one to use because it runs on the installed APK without a special test binary.

### What stays automated without a phone

- `npm test` and `npm run typecheck` on every change: scoring, prize math (including an 800 split), share-token shape, admin vs view-only rules.
- `npm run test:rls` against the real project once 006 is applied and keys exist: admin, co-admin, player, viewer, outsider. This must fail the job when it skips, so a missing key is a red build rather than a quiet pass.

### Maestro, on the APK, every screen

Run on a device or emulator with two accounts already created (A is the admin, B is a player). Seed a third account C who is in nobody’s list, and account D who is never added.

| Flow | Taps | Pass when |
| --- | --- | --- |
| Sign in | Open app, enter A’s email and passcode, eye toggle, Sign in | Home shows “Hi” and New game. No spinner over 12 seconds. |
| Bad passcode | Wrong code | Error text, fields kept, no navigation. |
| Create account | New email, passcode, skip phone | Lands on empty Home. |
| Duplicate email | Register A’s email | “Sign in” opens login with that email. |
| Home is not a maze | Look at Home | There are no Active, Players, Today, History, or All players tiles. |
| Empty live | Account with no live game | “No live game.” Tapping it does not open a spinner. |
| New game | New game, turn I'm playing off, pick two people from my list, Start | Scorecard opens. A is not a column. A can Add round. |
| Find + | Players, Find, search C’s first name, tap + | Button says Added. Back. C is on the list without leaving and reopening. |
| Find does not use phone | Search C’s phone | No result. |
| Invite | Invite | The OS share sheet opens. No email or phone field in the app. |
| Row and remove | Tap C, Remove, confirm | C is gone immediately. Kill and reopen the app. C is still gone. |
| Cannot edit C | Tap a remaining player | Sheet only. No spinner page. No pencil. |
| Visibility | B signs in | B sees A’s game on Home. D does not. |
| View only | B opens the game | No Add round, Undo, or Done. “View only.” |
| Promote | A → Players in this game → B admin. B reopens | B can Add round. |
| Watcher | A adds D as view only. D signs in | D sees the game and cannot score. |
| Score | A adds a round that sums to 0, then one that does not | The bad round cannot submit. The good round appears. |
| Undo | Undo, cancel, Undo, confirm | Round remains after cancel, and is gone after confirm. |
| Rotate | Scorecard portrait → landscape → portrait | The title “Scorecard” lines up with the back button both times. Totals stay in the header. |
| Share | Copy link, open the URL in Chrome | Rendered page, not source. Start time and game ID visible. Add a round, wait, the page shows it. |
| Complete | Done, edit a coin, Confirm | Game shows Completed. Coins match the edit. |
| Settle | Home → Settle prizes, Today, pick the game, pay From B To A, Save | Now column updates. A second payment that zeroes everyone shows Settled. A payment that does not add to 0 cannot save. |
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
- Players: +, remove, airplane mode during remove.
- One stake complete and one pool complete, then one session settled to all zeros.

`docs/testing-strategy.md` should gain this Maestro table and this phone pass when the redesign is built. Unit tests stay. They are not the sign-off.

## 8. Open questions

1. Name search shows another person’s email, which Find does today only if you already know the email. This proposal follows the request to show email on results. Confirm that any signed-in user may search by first name and see the matching email.
2. The iPhone app is not in the App Store. Until there is a TestFlight or store URL, `…/Games/get` will tell iPhone users the app is not available yet. Confirm that is acceptable, and send the APK URL that Android should download in the meantime.
3. Who may record payments: this proposal says a game admin of every selected game. If two hosts should settle one combined night, say so.
4. A session defaults to today’s games. Should “Today” follow the phone’s timezone, which is what the current Today tile does?
5. Stake coins often do not add to 0 when the expense column took points. Complete still allows that. Settle then cannot reach all zeros unless those coins are edited. Is editing at Complete the right place, or should expense be its own ledger line?
6. Welcome email still needs a Resend API key and a verified from-address. Copy link and Invite do not. Should the welcome email stay in scope?
7. Demo data (Load / Clear) moves under Me for `koneru2k@gmail.com`. Say if it should stay on Home instead.

## 9. Build order

No calendar estimate. This is the sequence, smallest confusing piece first, so a review can cut the later slices.

1. **Home and navigation.** Remove the duplicate tiles and the History screen. One list, three chips, Settle entry point, loading/error/empty. Fixes the spinner and the “0 Active” dead end. Touches Home, the tab bar, and the games query cache.
2. **My players, Find, Invite.** New `my_players` data, + button, immediate list update, share sheet, delete the extra player screens and the invite form fields. Fixes the pencil, the spinner page, and Remove.
3. **Scorecard header and the public page.** One header across rotation. Publish `scorecard.html` and `get/index.html` on `sreeatcandorps.github.io/Games`. Point Copy link at Pages.
4. **Settle prizes.** New ledger screen moved to Home. From / To / coins, then optional multi-leg. Session rules stay.
5. **Me.** Fold Profile and Settings together. Drop unused game rules. Phone stays optional.
6. **Maestro pack and a phone pass** on the APK that contains 1–5, before that APK is handed to Sree.

Slices 1–3 are the Friday-night confusion. Slice 4 is the prize redesign. Slice 5 is cleanup. Slice 6 is the gate.
