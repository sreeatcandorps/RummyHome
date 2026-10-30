import { settleEnabled } from '@/constants/features';

const scorecardBase =
  'View only means you can watch and cannot change the scores. The ... menu is Players (who can score) and Share. Totals sit in the header next to each name. Undo asks before it removes the last round.';

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
    'Email is how you sign in. Phone is optional and is never texted. If this email already has an account, use Sign in.',
  reset:
    'We email a link. It opens a page where you choose a new 6-digit code. It is not a text message.',
  home: homeHelp,
  newGame:
    "Turn off I'm playing if you are only keeping score. You still run the game, and you are not a column. This list is people you already added. To add someone new, use Find players. That does not put them in this game until you check them. A game can have at most 15 players.",
  scorecard: settleEnabled
    ? `${scorecardBase} Settling coins is not on this screen.`
    : scorecardBase,
  playersSheet:
    "Admin can change scores. View only can watch and is not a column. Add non-player admin lets someone run the game without sitting in it. They have to be on your player list already. If they aren't, add them in Find Players and come back. You can make someone an admin after the game is over, too.",
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
  players:
    'This is your list, not everyone with an account. Find adds someone who already signed up. Invite sends a link to get the app. You only see a name and a player ID.',
  find:
    "Search a first name, last name, or player ID. An email works only if you type the whole address, and the address is never shown. + adds them to your list only. It does not put them in a game. Invite opens your phone's share sheet.",
  me:
    'The email here is yours. It is how you sign in. Your player ID is what you give someone so they can find you. Phone is optional and is never texted. Dark mode is saved on this phone.',
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
  "Can't find them? First add them to your player list in Find Players, then come back.";
