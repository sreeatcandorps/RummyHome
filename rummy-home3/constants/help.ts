/**
 * Help popups. Short bullets only, one idea each, covering what the screen
 * itself cannot say. Every line starts with a bullet so the dialog can render
 * them with a hanging indent.
 */

const bullets = (...lines: string[]) => lines.map((line) => `• ${line}`).join('\n');

export const HELP = {
  signIn: bullets(
    'Your passcode is 6 digits. Numbers only.',
    'Forgot passcode emails you a 6-digit code to type back here, then you choose a new passcode.',
  ),
  createAccount: bullets(
    'Email is how you sign in. It cannot be changed later.',
    'Phone and zip code are optional. We never text you.',
    'Came from a friend’s link? Confirm your email, then tap Yes on "Is this you?" to move your past scores here.',
    'Have a player ID like 42 but no link? Enter it and the friend who added you approves it.',
    'A player ID is never used to sign in.',
  ),
  reset: bullets(
    'We email a 6-digit code, never a text. Type it here; no web page.',
    'The code works once and expires. Ask for a new one if it is refused.',
    'Your old passcode keeps working until the new one is saved.',
  ),
  home: [
    '## Statuses',
    '• [Active] An active game. Scores are still going in.',
    '• [Completed] A game that is complete. Every score is in.',
    '• [Closed] Once a game is part of a consolidated result, it is marked Closed.',
    '## Results',
    '• [Results] show the consolidated winners from one or more games. Once results are announced, the games that were part of the results move from [Completed] to [Closed].',
    '## My players',
    '• My players is a list of players you regularly play with.',
  ].join('\n'),
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
    'Complete opens a page with the final totals and asks once more before locking the scores. The game can then be picked for Results.',
    'A Completed game can be reopened from the ⋮ menu until it is added to Results.',
    'The ⋮ menu changes this game’s Drop, Middle drop, and Full count, picks who can score, sends sign-up links, and shares the live link.',
  ),
  playersSheet: bullets(
    'Each row shows the name, Player ID, role (Creator, Admin, Player, View only) and whether they are Registered, Pending or Unregistered.',
    'Admins can change scores. The creator is always an admin. Admins can be set after the game is over too.',
    'The ⋮ on a row: make or remove admin; for an unregistered player you added, edit the name, invite them to register, or link the seat to an existing Player ID.',
    'Add a player picks from My players. Someone added mid-game gets 0 for every round already played.',
    'Nobody can be removed from a game.',
  ),
  share: bullets(
    'Anyone with the live link can watch rounds and totals without the app or an account.',
    'Share final scores appears once the game is complete: a yellow picture of this game’s totals and every round, shown to you before the share sheet opens.',
  ),
  scoreEntry: bullets(
    'Tap one or more players, then type a number or tap Drop, Middle drop, or Full count. Everyone you tapped gets it.',
    'Yellow: selected now. Green: score saved for this round. Beige: nothing yet.',
    'Scores are minus by default. Tap + for a hand-entered win.',
    'Rummy: tap the winners first. They split what the table lost so the round adds to 0; the extra point goes to the player tapped first.',
    'Moving to another player saves the number you were typing.',
    'Save round unlocks when Balance is 0.',
  ),
  complete: bullets(
    'Completing the game locks the scores. Every round must add to 0 first.',
    'The game can then be picked for Results.',
    'Pressed too early? Reopen it from the scorecard ⋮ menu until it is added to Results.',
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
    'A Closed game can be picked again, but the app warns you: its points were already counted once. Best to first delete the old result that closed it. Deleting past results is coming soon.',
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
