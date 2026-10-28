import { settleEnabled } from '@/constants/features';

const recent =
  'Recent is every game you can see. Tap a row to open it. Live is the one still going.';

const resultsLine =
  'Results adds up the games you check. Positive totals are on the left, negative totals are on the right, and 1st, 2nd, and 3rd place are at the bottom.';

const scorecardBase =
  'View only means you can watch and cannot change the scores. The … menu is Players (who can score) and Share. Totals sit in the header next to each name. Undo asks before it removes the last round.';

export const HELP = {
  signIn:
    'Your passcode is 6 digits, not a regular password. The eye shows those digits. Forgot passcode emails you a link to set a new one.',
  createAccount:
    'Email is how you sign in. Phone is optional and is never texted. If this email already has an account, use Sign in.',
  reset:
    'We email a link. It opens a page where you choose a new 6-digit code. It is not a text message.',
  home: settleEnabled
    ? `Settle is where you combine finished games you run and record who paid whom. It stays here even if you don’t run any games yet. ${resultsLine} ${recent}`
    : `${recent} ${resultsLine}`,
  newGame:
    'Turn off I’m playing if you are only keeping score. You still run the game, and you are not a column. This list is people you already added. To add someone new, use Find players. That does not put them in this game until you check them. A game can have at most 15 players.',
  scorecard: settleEnabled
    ? `${scorecardBase} Settling coins is not on this screen.`
    : scorecardBase,
  playersSheet:
    'Admin can change scores. View only can watch and is not a column. Add non-player admin lets someone run the game without sitting in it. They have to be on your player list already. If they aren’t, add them in Find Players and come back. You can make someone an admin after the game is over, too.',
  share:
    'Share image makes a picture for WhatsApp or a text. It shows Rummy Home, the game, the date, and the totals. Copy link still opens the page. Email sends that link to the people you checked and does not show their addresses.',
  scoreEntry:
    'Submit stays off until this round adds to 0, including the expense column. The line under the list says Balanced or how far off it is.',
  complete: settleEnabled
    ? 'This closes the game. It does not move coins. When you are ready to record payments across games, use Settle on Home.'
    : 'This closes the game. The points stay as they are.',
  settle: settleEnabled
    ? 'Pick the finished games you run. Coins start as each player’s points. A payment is one person to another, and it has to add to 0. Tap a payment to change it until you mark this Settled. After that, it stays as it is. If you see no games, you are not the admin of a finished game yet.'
    : 'Finished games stay on Home under Recent.',
  players:
    'This is your list, not everyone with an account. Find adds someone who already signed up. Invite sends a link to get the app. You only see a name and a player ID.',
  find:
    'Search a first name, last name, or player ID. An email works only if you type the whole address, and the address is never shown. + adds them to your list only. It does not put them in a game. Invite opens your phone’s share sheet.',
  me:
    'The email here is yours. It is how you sign in. Your player ID is what you give someone so they can find you. Phone is optional and is never texted. Dark mode is saved on this phone.',
  results:
    'Check finished games, then show the results. Positive totals are on the left and negative totals are on the right. Each row is a player, in first-name order, and the columns are the games and a total. A dash means they did not play. Four games fit across a phone. 1st, 2nd, and 3rd place are at the bottom, and the highest score is the winner. Declare results saves that snapshot, and only an admin of every checked game can do it. Anyone can view a declared result. Results can include at most 50 players. Share results sends a picture of the places. Share full details (PDF) sends the whole table.',
  publicScorecard:
    'This page updates on its own. The start time and game ID say which game it is. No login. Anyone with the link can watch.',
} as const;

export const EMPTY_SETTLE = settleEnabled
  ? 'Settle is for finished games you run. You are not an admin of any completed game yet. When you are, they show up here and you can settle several together.'
  : 'Finished games stay on Home under Recent.';

export const FIND_HANDOFF =
  'Can’t find them? First add them to your player list in Find Players, then come back.';
