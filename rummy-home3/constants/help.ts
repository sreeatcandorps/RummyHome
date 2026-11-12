/**
 * Help popups. Short bullets only, one idea each, covering what the screen
 * itself cannot say. Every line starts with a bullet so the dialog can render
 * them with a hanging indent.
 */

const bullets = (...lines: string[]) => lines.map((line) => `• ${line}`).join('\n');

/** Lives in the My players help (it used to be a banner above the list). */
export const PLAYERS_NOTE =
  'A player must be registered in the database to see their games in the app. Anyone can watch a game live, without the app or registering, when the admin shares the live link.';

export const HELP = {
  signIn: bullets(
    'Your passcode is 6 digits. Numbers only.',
    'Forgot passcode emails you a 6-digit code (OTP) to type back here, then you choose a new passcode.',
  ),
  createAccount: bullets(
    'Email is how you sign in. It cannot be changed later.',
    'Phone and zip code are optional. We never text you.',
    'Came from a friend’s link? Confirm your email, then tap Yes on "Is this you?" to move your past scores here.',
    'Have a player ID like 42 but no link? Enter it and the friend who added you approves it.',
    'A player ID is never used to sign in.',
  ),
  reset: bullets(
    'We email a 6-digit code (OTP), never a text. Type it in the OTP box; no web page.',
    'The OTP works once and expires in 15 minutes. Tap Send a new OTP if it is refused.',
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
  addPlayersToGame: bullets(
    'The faces under Playing are already in the game. Tap a player below to add them; they get 0 for every round already played.',
    'Return to game seats everyone you added.',
    'The × on a face removes a player only while every one of their round scores is 0. Once they have a score, edit the round first.',
    'Add players: new people by initials. From database: registered players by name or Player ID.',
  ),
  newGame: bullets(
    'Tap yourself if you are playing. You can run a game without sitting in it.',
    'Tap a face or the × under Playing to send someone back to the list. Up to 15 players.',
    'Recent partners come first, then everyone else by how often you play together.',
    'Add players: new people by initials, seated as you save them. Add player from database: a registered player, seated here and added to My players at once.',
    'Drop, Middle drop, and Full count for this game are in the ⋮ menu and can change mid-game.',
    'After you start, the ⋮ menu has Register players to send sign-up links.',
    'Scorecard columns show each player’s initials from your My players. If two would match, a Fix initials step appears before the game starts.',
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
    'The ⋮ on a row: make or remove admin; for an unregistered player you added, edit the name, invite them to register, or link the seat to an existing Player ID; Remove player.',
    'Edit initials (in the ⋮) changes this game’s column letters. When you created the game, your My players entry follows so the next game agrees.',
    'Add new player picks from My players. Someone added mid-game gets 0 for every round already played.',
    'Remove player asks first and works only while the player has no scores or every round score they have is 0. Otherwise edit the rounds and clear their scores first.',
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
    'Find player in database adds people from the EZ Score database. Add new players takes initials; they get a player ID at once and show as Unregistered until they sign up.',
    'Register unregistered players: sends each unregistered player a sign-up link, good once for 14 days. They show Pending registration until they tap Yes on "Is this you?".',
    PLAYERS_NOTE,
    'Tap a card to see or edit a player’s initials, register them, or remove them. Removing keeps their account and past games.',
    'Initials: first and last letter. If two of your players share them, the one added first keeps the short form; the other gets three letters from their name (SUK). Or type any 2–3 letters.',
    'Initials must differ only within your My players and never change by themselves. After a rename you see the new name at once, plus a “Name changed” note if the letters no longer fit.',
  ),
  initials: bullets(
    'Two players here would get the same column letters. The one who joined your My players first keeps the short form.',
    'Tap a suggestion or Edit… to type any 2 or 3 letters (A to Z) for the other player.',
    'Apply and start saves the new letters to My players, so every game you create agrees. Not now uses them for this game only.',
    'Letters stay the same for a seat once the game starts; a game admin can change them from Players · Admins.',
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
    'The last initial cannot be a number. Scorecard initials are letters only.',
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
    'The Completed, Closed, and Active chips choose which games are listed; any mix can be on. Completed games you run start ticked. If a chip would hide a ticked game, the app asks first.',
    'Every game you are in is listed, but only games where you are the creator or an admin can be ticked. Ask the creator for admin privileges for the rest.',
    'Pick one or more games and tap Show results. The highest total is the winner; 1st, 2nd, and 3rd place are named. Nothing is saved by looking.',
    'Save result (the save icon, or the button at the top) moves the games to Closed and lists what changed. It is off while an Active game is selected: go back and deselect it.',
    'A Closed game can be picked again, but the app warns you: its points were already counted once, and the saved result carries a small warning icon. Best to first delete the old result that closed it.',
    'Share is available once the result is saved: a picture of the totals with Player IDs and every game (five per row), or a PDF with every round of every game.',
    'A game keeps its own number (G7 stays G7); the result id is at the bottom of both. Results can include at most 50 players.',
  ),
  publicScorecard: bullets(
    'This page updates on its own and needs no login.',
    'Anyone with the link can watch.',
  ),
} as const;

export const EMPTY_SETTLE = 'Finished games stay on Home under Recent.';

export const FIND_HANDOFF =
  "Can't find them? Use Find player in database, or Add new players if they are not registered yet, then come back.";


/** Settings priority, highest first, for the ladder graphic on User settings. */
export const SETTINGS_PRIORITY = [
  { level: 'Highest', title: 'Game settings', detail: 'One game, from its ⋮ menu' },
  { level: 'Medium', title: 'User settings', detail: 'Your defaults for new games' },
  { level: 'Lowest', title: 'Game defaults', detail: 'Rummy standard: -10, -30, -80' },
] as const;
