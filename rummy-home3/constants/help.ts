import { settleEnabled } from '@/constants/features';

const scorecardBase =
  'View only means you can watch and cannot change the scores. The ⋮ menu has Game settings (Drop and Middle drop for this game, which you can change any time), Players (who can score), Register players (send each unregistered player an invite by email) and Share. Totals sit in the header next to each name. Undo asks before it removes the last round.';

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
    'Email is how you sign in, and it is the one thing that ties your games to you. Use the exact email a friend registered you with. We email you a link to confirm it. Phone and zip code are optional; we never text you and never ask for your address. Your email cannot be changed for now. If this email already has an account, use Sign in.',
  reset:
    'We email a link. It opens a page where you choose a new 6-digit code. It is not a text message.',
  home: homeHelp,
  newGame: `This is the New game screen.

What you see, top to bottom:
- Playing: you are always first. Everyone you pick moves up here as a small chip with their initials and player ID. Tap a chip to take them out.
- Search my players.
- My players: 10 at a time. People who played with you in the last 2 weeks come first, then everyone else, most games first. Only players from games you created or ran show here. When you pick someone, the next player fills the spot.
- Add new player: use − and + to pick how many (1 to 5), then tap it. Type a name or just initials and tap Save on each row. Saved turns green. Edit changes a name, Delete removes it.
- Find player in database: search registered players by name, player ID or full email.

Game settings are in the ⋮ menu (top right): Drop and Middle drop for this game. They start from your User settings, and you can change them any time during the game too.

After you start the game, open its ⋮ menu and tap Register players so new players can download the app and see their games.

A game can have at most 15 players.`,
  scorecard: settleEnabled
    ? `${scorecardBase} Settling coins is not on this screen.`
    : scorecardBase,
  playersSheet:
    "Admin can change scores. View only can watch and is not a column. Add non-player admin lets someone run the game without sitting in it. They have to be in My players already. If they aren't, add them with Find player in database and come back. You can make someone an admin after the game is over, too.",
  share:
    'Share image makes a picture for WhatsApp or a text. It shows EZ Score: Rummy, the game, the date, and the totals. Copy link still opens the page. Email sends that link to the people you checked and does not show their addresses.',
  scoreEntry:
    'Submit stays off until this round adds to 0, including the expense column. The line under the list says Balanced or how far off it is.',
  complete: settleEnabled
    ? 'This closes the game. It does not move coins. When you are ready to record payments across games, use Settle on Home.'
    : 'This closes the game. The points stay as they are.',
  settle: settleEnabled
    ? "Pick the finished games you run. Coins start as each player's points. A payment is one person to another, and it has to add to 0. Tap a payment to change it until you mark this Settled. After that, it stays as it is. If you see no games, you are not the admin of a finished game yet."
    : 'Finished games stay on Home under Recent.',
  players: `This is My players: the people you play with, not everyone in the database.

- Add new player: pick how many with − and + (up to 5), then type a name or just initials and tap Save on each one. Each gets a player ID right away. They show as Unregistered.
- Find player in database: search people who already registered.
- Register players: type an unregistered player's email and tap Share. They download the app and sign up with that exact email, then confirm "Is this you?" and their games join their account.
- Pending means that email already belongs to a registered player. They get a request in the app and their scores link only when they tap Yes. While it is pending you can Change email or Resend. If they tap Not me or don't answer in 14 days, the player goes back to Unregistered and you get a note.
- Unlink player: if a player was linked to the wrong person, Unlink moves the player back to an unregistered player under you, same initials, no email. No scores are lost.`,
  find:
    "This searches the database: registered players only. Search a first name, last name, or player ID. An email works only if you type the whole address, and the address is never shown. + adds them to My players only. It does not put them in a game. Not in the database? Use Add new player.",
  me:
    'The email here is yours. It is how you sign in and how friends link your games to you, and it cannot be changed for now. Your player ID is what you give someone so they can find you. Phone is optional and is never texted. User settings holds your game defaults (Points, Drop, Middle drop). Dark mode is saved on this phone.',
  userSettings:
    'User settings are your defaults. Every new game starts with this game type and these Drop and Middle drop points. Points is the only game type for now. To change one game, open it and tap ⋮ > Game settings.',
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
    'This page updates on its own. The start time and game ID say which game it is. No login. Anyone with the link can watch.',
} as const;

export const EMPTY_SETTLE = settleEnabled
  ? 'Settle is for finished games you run. You are not an admin of any completed game yet. When you are, they show up here and you can settle several together.'
  : 'Finished games stay on Home under Recent.';

export const FIND_HANDOFF =
  "Can't find them? Use Find player in database, or Add new player if they are not registered yet, then come back.";
