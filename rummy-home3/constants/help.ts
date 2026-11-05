/**
 * Help popups. Short bullets only, one idea each, covering what the screen
 * itself cannot say. Every line starts with a bullet so the dialog can render
 * them with a hanging indent.
 */

const bullets = (...lines: string[]) => lines.map((line) => `• ${line}`).join('\n');

export const HELP = {
  signIn: bullets(
    'Your passcode is 6 digits, not a password.',
    'Forgot passcode emails you a link to set a new one.',
  ),
  createAccount: bullets(
    'Email is how you sign in. It cannot be changed later.',
    'Phone and zip code are optional. We never text you.',
    'Came from a friend’s link? Confirm your email, then tap Yes on "Is this you?" to move your past scores here.',
    'Have a player ID like 42 but no link? Enter it and the friend who added you approves it.',
    'A player ID is never used to sign in.',
  ),
  reset: bullets(
    'We email a link, not a text.',
    'The link opens a page where you choose a new 6-digit passcode.',
  ),
  home: bullets(
    'Results show the consolidated winners from one or more games.',
    'Once results are announced, those games move from Completed to Closed.',
    'Completed: every score is in. It can be picked for Results.',
    'Closed = already counted in a result. You can still pick a closed game in a new result, but the app shows a warning.',
    'My players is your own list of people you play with, not everyone in the database. Add more from the EZ Score database on My players or New game.',
  ),
  newGame: bullets(
    'Tap yourself if you are playing. You can run a game without sitting in it.',
    'Tap a chip under Playing to take someone out. Up to 15 players.',
    'Recent partners come first, then everyone else by how often you play together.',
    'Add players: new people by initials. They are seated as you save them and show as Unregistered until they sign up.',
    'Add player from database: seats a registered player here and adds them to My players at once.',
    'Drop, Middle drop, and Full count for this game are in the ⋮ menu and can change mid-game.',
    'After you start, the ⋮ menu has Register players to send sign-up links.',
  ),
  scorecard: bullets(
    'View only means you can watch but not change scores.',
    'Totals sit in the header next to each name.',
    'Undo asks before removing the last round.',
    'Complete locks the scores. The game can then be picked for Results.',
    'The ⋮ menu changes this game’s Drop, Middle drop, and Full count, picks who can score, sends sign-up links, and shares the live link.',
  ),
  playersSheet: bullets(
    'Admin can change scores.',
    'View only can watch and does not get a column.',
    'A non-player admin runs the game without sitting in it.',
    'Everyone here must already be in My players.',
    'Admins can be set after the game is over too.',
  ),
  share: bullets(
    'Anyone with the live link can watch rounds and totals without the app or an account.',
    'Share results appears once the game is complete and sends a picture of the scorecard with 1st, 2nd, and 3rd named.',
  ),
  scoreEntry: bullets(
    'Tap one or more players, then type a number or tap Drop, Middle drop, or Full count. Everyone you tapped gets it.',
    'Green: selected now. Grey: score saved for this round. Beige: nothing yet.',
    'Scores are minus by default. Tap + for a hand-entered win.',
    'Rummy: tap the winners first. They split what the table lost so the round adds to 0; the extra point goes to the player tapped first.',
    'Moving to another player saves the number you were typing.',
    'Save round unlocks when Balance is 0.',
  ),
  complete: bullets(
    'Completing the game locks the scores.',
    'The game can then be picked for Results.',
  ),
  settle: bullets('Finished games stay on Home under Recent.'),
  players: bullets(
    'My players is your own list, not everyone in the EZ Score database. New game picks from it. Sorted by Frequent first.',
    'Find player in database: add more people from the EZ Score database.',
    'Add new players: new people by initials. They get a player ID at once and show as Unregistered until they sign up.',
    'Register players: sends each unregistered player a sign-up link, good once for 14 days. They show Pending registration until they tap Yes on "Is this you?".',
    'A player must be registered to see their games in the app. Anyone can watch a game live from the shared live link, no app needed.',
    'Tap a card to register or remove someone. Removing keeps their account and past games.',
  ),
  find: bullets(
    'Registered players only.',
    'Type at least two letters of a name, or a player ID such as 42.',
    '+ My players adds the person to your list. It does not seat them in a game.',
    '"In your player list" means they are already there.',
    'Not in the database? Go back and use Add new players.',
  ),
  addToGame: bullets(
    'Registered players only.',
    'Type at least two letters of a name, or a player ID such as 42.',
    '+ Add seats the person in this game and adds them to My players at the same time.',
    'Not in the database? Go back and use Add players.',
  ),
  addPlayers: bullets(
    'Type a first initial and a last initial for each person. More letters are fine.',
    'The last initial cannot be a number. Numbers are kept for duplicate initials like H2.',
    'Each row saves on its own. Saved players show as Unregistered until they sign up.',
    'Tap Done to go back. Nothing else closes this screen.',
  ),
  me: bullets(
    'Your email is how you sign in. It cannot be changed for now.',
    'Your player ID is what you give someone so they can find you. It is never used to sign in.',
    'Phone is optional and never texted.',
    'User settings are the defaults every new game starts with.',
    'Dark mode is saved on this phone only.',
  ),
  userSettings: bullets(
    'Which settings win, highest first: Game settings for one game, then User settings, then Game defaults.',
    'Game settings: change one game from its ⋮ menu. They override everything for that game.',
    'User settings: what every new game starts with for you.',
    'Game defaults: Rummy’s standard -10, -30, -80, used when you have set nothing else.',
  ),
  results: bullets(
    'Pick one or more games and tap Show results. The highest total is the winner; 1st, 2nd, and 3rd place are named.',
    'If every picked game is Completed, the result is saved and those games become Closed.',
    'If any picked game is still Active, you only see running totals. Nothing is saved.',
    'A Closed game can be picked again, but the app warns you: its points were already counted once.',
    'Share sends a picture of the totals, or a PDF with every round of every game.',
    'Results can include at most 50 players.',
  ),
  publicScorecard: bullets(
    'This page updates on its own and needs no login.',
    'Anyone with the link can watch.',
  ),
} as const;

export const EMPTY_SETTLE = 'Finished games stay on Home under Recent.';

export const FIND_HANDOFF =
  "Can't find them? Use Find player in database, or Add new players if they are not registered yet, then come back.";

export const PLAYERS_NOTE =
  'A player must be registered in the database to see their games in the app. Anyone can watch a game live, without the app or registering, when the admin shares the live link.';

/** Settings priority, highest first, for the ladder graphic on User settings. */
export const SETTINGS_PRIORITY = [
  { level: 'Highest', title: 'Game settings', detail: 'One game, from its ⋮ menu' },
  { level: 'Medium', title: 'User settings', detail: 'Your defaults for new games' },
  { level: 'Lowest', title: 'Game defaults', detail: 'Rummy standard: -10, -30, -80' },
] as const;
