const scorecardBase =
  'View only means you can watch and cannot change the scores. The ⋮ menu has Game settings (Drop, Middle drop, and Full count for this game, which you can change any time), Players (who can score), Register players (share each unregistered player their own sign-up link), Share live scorecard, and Share results once the game is complete. Totals sit in the header next to each name. Undo asks before it removes the last round.';

const homeHelp = `This is your Home screen.

What you see:
- Your name at the top with a greeting.
- New game button to start a fresh game.
- Live section shows your current active game (if any). Tap it or tap Resume to continue scoring.
- Results button adds up finished games you pick and shows the winners.
- Recent section lists all your games. Use the filter buttons (All, Live, Last 24 hours) to narrow them down.

Each game card shows:
- A G-number badge (G1, G2...) so you can tell your games apart quickly.
- The date and time when the game started.
- Status: Active (still going), Completed (finished), or Closed (included in a declared result).
- Game type: Points or Pool.
- How many players are in the game.

What you can do:
- Tap any game card to open its scorecard.
- Tap New game to create a game with players from your list.
- Tap Results to combine finished games and see who won overall.
- Tap your avatar (top right) to go to the Me tab.`;

export const HELP = {
  signIn:
    'Your passcode is 6 digits, not a regular password. The eye shows those digits. Forgot passcode emails you a link to set a new one.',
  createAccount:
    'Email is how you sign in. We email you a link to confirm it, and it cannot be changed for now. Phone and zip code are optional; we never text you and never ask for your address. Opened a link from a friend? After you confirm your email you will see "Is this you?" and Yes puts your past scores on your account. Have a player ID like #42 but no link? Type it in "Enter your player ID if you have one." and the friend who added you approves it. A player ID is never used to sign in. If this email already has an account, use Sign in.',
  reset:
    'We email a link. It opens a page where you choose a new 6-digit code. It is not a text message.',
  home: homeHelp,
  newGame: `This is the New game screen.

What you see, top to bottom:
- Playing: you are always first. Everyone you pick moves up here as a small chip with their initials and player ID (#42). Tap a chip to take them out.
- Search my players.
- My players: 10 at a time. People who played with you in the last 2 weeks come first, then everyone else, most games first. Only players from games you created or ran show here. When you pick someone, the next player fills the spot.
- Add new player: use − and + to pick how many (1 to 5). It opens with 3 rows at the top of the screen. First and Last are both required. You can type initials or a full name. The app shows the first letter of each, such as SK. Tap Save on each row. Saved turns green. Edit changes a name, Delete removes it. Done can be tapped any time.
- Find player in database: search registered players by name, player ID (#42) or full email.

Game settings are in the ⋮ menu (top right): Drop, Middle drop, and Full count for this game. They start from your User settings, and you can change them any time during the game too. Defaults are -10, -30, and -80.

After you start the game, open its ⋮ menu and tap Register players. Share sends each new player their own link so they can download the app, sign up and see their games.

A game can have at most 15 players.`,
  scorecard: scorecardBase,
  playersSheet:
    "Admin can change scores. View only can watch and is not a column. Add non-player admin lets someone run the game without sitting in it. They have to be in My players already. If they aren't, add them with Find player in database and come back. You can make someone an admin after the game is over, too.",
  share:
    'Share live scorecard opens the share sheet with the public page. Anyone with the link can watch the game number, the time, every round, and the totals. Share results is only on a completed game. It sends a picture of the full scorecard, with 1st, 2nd, and 3rd named at the bottom.',
  scoreEntry:
    'Tap one or more players, then type a number or tap Drop, Middle drop, or Full count. Everyone you tapped gets that score and turns green. Minus is on by default; tap + for a hand-entered win. Tap the winners and then Rummy: they split what the table lost so the round adds to 0. If a split is uneven, the players you tapped first get the extra point. Tap a green cell to change it, X to clear it. Moving to another player saves the number you were typing. Save round stays off until Balance is 0.',
  complete: 'This closes the game. The points stay as they are.',
  settle: 'Finished games stay on Home under Recent.',
  players: `This is My players: the people you play with, not everyone in the database.

- Every player has a player ID: a number like #42. It never changes and is never used to sign in.
- Add new player: pick how many with − and + (up to 5). It opens with 3 rows. Type a first and a last name, or just initials, and tap Save on each one. The list shows two initials, such as SK. Each gets the next player ID right away. They show as Unregistered.
- Find player in database: search people who already registered.
- Register players: tap Share next to a player to send their own sign-up link on WhatsApp, text, or anything. When they sign up with it and tap Yes on "Is this you?", their scores join their account. A link works once and lasts 14 days. Share again makes a new link and turns off the old one. Turn off link stops it.
- Pending means a link was sent, or someone asked to claim the player with their ID.
- "#42 wants to claim R K. Approve?" shows here and on Home when someone signs up and types a player ID. Only Approve links the scores. Decline keeps the player with you.
- Unlink player: if a player was linked to the wrong person, Unlink moves the player back to an unregistered player under you, same initials. No scores are lost.`,
  find:
    "This searches the database: registered players only. Search a first name, last name, or player ID (#42). An email works only if you type the whole address, and the address is never shown. + adds them to My players only. It does not put them in a game. Not in the database? Use Add new player.",
  me:
    'The email here is yours. It is how you sign in, and it cannot be changed for now. Your player ID (#42) is what you give someone so they can find you. It is never used to sign in. Phone is optional and is never texted. User settings holds your game defaults (Points, Drop, Middle drop, Full count). Dark mode is saved on this phone.',
  userSettings:
    'User settings are your defaults. Every new game starts with this game type and these Drop, Middle drop, and Full count points (-10, -30, and -80). Points is the only game type for now. To change one game, open it and tap ⋮ > Game settings.',
  results: `This is the Results page. It adds up the points from the games you pick.

What you see, top to bottom:
- "Select games and then show the results." tells you what to do.
- Your games, newest first. Each row has its G-number badge (G1, G2...), the date and time it started, its status, and Points or Pool.
- Active (green edge) means the game is still going. Completed (grey edge) means it is finished. Closed games are already in a result, so they are not listed.
- Show results adds up the games you selected.
- Past results lists earlier results, newest first: when, the number of games and players, and 1st, 2nd and 3rd place with their points. The highest points is the winner. Scroll down to load more.

What you can do:
- Tap a game to select it, and tap it again to unselect it.
- Tap Show results.
  - If every selected game is Completed, the result is saved and those games become Closed.
  - If any selected game is still Active, you see the running totals only. Nothing is saved and no game is closed.
- Tap a past result to open it again.
- On a result, tap Share to send a picture of the Totals with the top 3, or a PDF with everything.

Results can include at most 50 players.`,
  publicScorecard:
    'This page updates on its own. It shows the game number, the start time, every round, and the totals. No login. Anyone with the link can watch.',
} as const;

export const EMPTY_SETTLE = 'Finished games stay on Home under Recent.';

export const FIND_HANDOFF =
  "Can't find them? Use Find player in database, or Add new player if they are not registered yet, then come back.";
