const scorecardBase =
  'View only means you can watch and cannot change the scores. The ⋮ menu has Game settings (Drop, Middle drop, and Full count for this game, which you can change any time), Players (who can score), Register players (share each unregistered player their own sign-up link), Share live scorecard, and Share results once the game is complete. Totals sit in the header next to each name. Undo asks before it removes the last round.';

const homeHelp = `Results show the consolidated winners from one or more games. Pick the games on the Results page and tap Show results. Once results are announced, those games move from Completed to Closed.

Game statuses:
- Active: still being scored. Every active game is listed under Live; tap one to carry on.
- Completed: finished, with every score in. It can still be picked for Results.
- Closed: already included in announced results. It cannot be picked again.

Recent lists only Completed and Closed games. All shows every one; Last 10 days keeps the newest.

My players is your own list of the people you play with, not everyone in the database. Add more from the EZ Score database on the My players page or on the New game page.`;

export const HELP = {
  signIn:
    'Your passcode is 6 digits, not a regular password. The eye shows those digits. Forgot passcode emails you a link to set a new one.',
  createAccount:
    'Email is how you sign in. We email you a link to confirm it, and it cannot be changed for now. Phone and zip code are optional; we never text you and never ask for your address. Opened a link from a friend? After you confirm your email you will see "Is this you?" and Yes puts your past scores on your account. Have a player ID like #42 but no link? Type it in "Enter your player ID if you have one." and the friend who added you approves it. A player ID is never used to sign in. If this email already has an account, use Sign in.',
  reset:
    'We email a link. It opens a page where you choose a new 6-digit code. It is not a text message.',
  home: homeHelp,
  newGame: `Playing: you are always first. Everyone you pick moves up as a chip with their initials and full name. Tap a chip to take them out.

My players shows 10 at a time: people who played with you in the last 2 weeks first, then everyone else, most games first. Pick someone and the next player fills the spot. Search by name or player ID.

- Add players: opens 3 rows. Type a first initial and a last initial (more letters are fine) and tap Save on each. New players are seated in this game as they are saved and show as Unregistered.
- Add player from database: search registered players by name or player ID. + Add seats them here and adds them to My players at once.

Game settings are in the ⋮ menu: Drop, Middle drop, and Full count for this game (defaults -10, -30, -80). They start from your User settings and can change during the game.

After you start the game, its ⋮ menu has Register players: each new player gets their own link to sign up and see their games.

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
  players: `My players is your own list of the people you play with. New game picks from it.

A player must be registered in the database to see their games in the app. Anyone can still watch a game live, without the app or registering, when the admin shares the live link.

The three buttons:
- Add new players: opens 3 rows. Type a first initial and a last initial (more letters are fine) and tap Save on each. They get a player ID right away and show as Unregistered until they sign up.
- Find player in database: search people who already registered, by name or player ID. + My players adds them to your list only; it does not put them in a game. Someone already on your list shows "In your player list".
- Register players: send each unregistered player their own sign-up link. When they sign up with it and tap Yes on "Is this you?", their scores join their account. A link works once and lasts 14 days.

Sort by Name or Sort by Frequent (most games with you first) is next to the title. Tap a card to see games together, register, or remove the player. Removing keeps their account and past games.

Pending means a link was sent or someone asked to claim the player with their ID. "#42 wants to claim R K. Approve?" appears here and on Home; only Approve links the scores.`,
  find:
    'Registered players only. Type at least two letters of a first or last name, or a player ID such as 42. A full email address also works, but email is never shown. + My players adds the person to your list; it does not put them in a game. "In your player list" means they are already there. Someone not in the database? Go back and use Add new players.',
  addToGame:
    'Registered players only. Type at least two letters of a name, or a player ID such as 42. + Add seats the person in this game and adds them to My players at the same time; they appear under Playing when you go back. Someone not in the database? Go back and use Add players.',
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
- On a result, tap Share to send a picture of the Totals (crowns mark 1st, 2nd and 3rd, and a small G1, G2… grid shows how each game adds up when there are 5 games or fewer), or a PDF with everything: the games, both totals, the top 3, and every round of every game.

Results can include at most 50 players.`,
  publicScorecard:
    'This page updates on its own. It shows the game number, the start time, every round, and the totals. No login. Anyone with the link can watch.',
} as const;

export const EMPTY_SETTLE = 'Finished games stay on Home under Recent.';

export const FIND_HANDOFF =
  "Can't find them? Use Find player in database, or Add new players if they are not registered yet, then come back.";

export const PLAYERS_NOTE =
  'A player must be registered in the database to see their games in the app. Anyone can watch a game live, without the app or registering, when the admin shares the live link.';
