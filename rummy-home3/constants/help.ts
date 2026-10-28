export const HELP = {
  signIn:
    'Your passcode is 6 digits, not a regular password. The eye shows those digits. Forgot passcode emails you a link to set a new one.',
  createAccount:
    'Email is how you sign in. Phone is optional and is never texted. If this email already has an account, use Sign in.',
  reset:
    'We email a link. It opens a page where you choose a new 6-digit code. It is not a text message.',
  home:
    'Settle is where you combine finished games you run and record who paid whom. It stays here even if you don’t run any games yet. Recent is every game you can see. Tap a row to open it. Live is the one still going.',
  newGame:
    'Turn off I’m playing if you are only keeping score. You still run the game, and you are not a column. This list is people you already added. To add someone new, use Find players. That does not put them in this game until you check them.',
  scorecard:
    'View only means you can watch and cannot change the scores. The … menu is Players (who can score) and Share. Totals sit in the header next to each name. Undo asks before it removes the last round. Settling coins is not on this screen.',
  playersSheet:
    'Admin can change scores. View only can watch and is not a column. Add non-player admin lets someone run the game without sitting in it. They have to be on your player list already. If they aren’t, add them in Find Players and come back. You can make someone an admin after the game is over, too.',
  share:
    'Anyone with the link can watch, with no account. Copy link is what you paste into WhatsApp. Email sends it to the people you checked and does not show their addresses.',
  scoreEntry:
    'Submit stays off until this round adds to 0, including the expense column. The line under the list says Balanced or how far off it is.',
  complete:
    'This closes the game. It does not move coins. When you are ready to record payments across games, use Settle on Home.',
  settle:
    'Pick the finished games you run. Coins start as each player’s points. A payment is one person to another, and it has to add to 0. Tap a payment to change it until you mark this Settled. After that, it stays as it is. If you see no games, you are not the admin of a finished game yet.',
  players:
    'This is your list, not everyone with an account. Find adds someone who already signed up. Invite sends a link to get the app. You only see a name and a player ID.',
  find:
    'Search a first name, last name, or player ID. An email works only if you type the whole address, and the address is never shown. + adds them to your list only. It does not put them in a game. Invite opens your phone’s share sheet.',
  me:
    'The email here is yours. It is how you sign in. Your player ID is what you give someone so they can find you. Phone is optional and is never texted. Dark mode is saved on this phone.',
  publicScorecard:
    'This page updates on its own. The start time and game ID say which game it is. No login. Anyone with the link can watch.',
} as const;

export const EMPTY_SETTLE =
  'Settle is for finished games you run. You are not an admin of any completed game yet. When you are, they show up here and you can settle several together.';

export const FIND_HANDOFF =
  'Can’t find them? First add them to your player list in Find Players, then come back.';
