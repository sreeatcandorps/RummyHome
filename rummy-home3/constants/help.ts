/**
 * Help popups. Each one is short and only says what the screen itself cannot:
 * what a word means, what happens after a tap, and the limits. Nothing in here
 * describes buttons that are already visible.
 */

export const HELP = {
  signIn:
    'Your passcode is 6 digits, not a password. Forgot passcode emails you a link to set a new one.',
  createAccount:
    'Email is how you sign in and cannot be changed later. Phone and zip code are optional; we never text you. Came from a friend’s link? After you confirm your email, tap Yes on "Is this you?" and your past scores move to this account. Have a player ID like 42 but no link? Enter it here and the friend who added you approves it. A player ID is never used to sign in.',
  reset:
    'We email a link, not a text. It opens a page where you choose a new 6-digit passcode.',
  home: `Results show the consolidated winners from one or more games. Once results are announced, those games move from Completed to Closed.

Completed: every score is in, and the game can still be picked for Results. Closed: already counted in a result, so it cannot be picked again. Recent lists both; Last 10 days hides the older ones.

My players is your own list of the people you play with, not everyone in the database. Add more from the EZ Score database on the My players page or on the New game page.`,
  newGame: `You are always seated first. Tap a chip to take someone out.

The list shows people who played with you in the last 2 weeks first, then everyone else by how often you play together, 10 at a time.

Add players opens 3 rows for new people by initials; each row seats them as you save it, and they show as Unregistered until they sign up. Add player from database seats a registered player here and adds them to My players at once.

Drop, Middle drop, and Full count for this game are in the ⋮ menu (defaults -10, -30, -80) and can change mid-game. After you start, the ⋮ menu also has Register players, which sends each new player their own sign-up link. A game can have at most 15 players.`,
  scorecard:
    'View only means you can watch but not change scores. Totals sit in the header next to each name. Undo asks before removing the last round. The ⋮ menu is where you change this game’s Drop, Middle drop, and Full count, choose who can score, send sign-up links to unregistered players, and share the live link or, once the game is complete, the results.',
  playersSheet:
    'Admin can change scores. View only can watch and does not get a column. A non-player admin runs the game without sitting in it. Everyone here must already be in My players; add them there first and come back. Admins can also be set after the game is over.',
  share:
    'Anyone with the live link can watch the rounds and totals without the app or an account. Share results only appears once the game is complete and sends a picture of the full scorecard with 1st, 2nd, and 3rd named.',
  scoreEntry:
    'Tap one or more players, then type a number or tap Drop, Middle drop, or Full count; everyone you tapped gets it. Scores are minus by default; tap + for a hand-entered win. Tap the winners and then Rummy to split what the table lost so the round adds to 0; an uneven split gives the extra point to the players you tapped first. Moving to another player saves the number you were typing. Save round unlocks when Balance is 0.',
  complete: 'Completing the game locks the scores. It can then be picked for Results.',
  settle: 'Finished games stay on Home under Recent.',
  players: `My players is your own list of the people you play with; New game picks from it. A player must be registered in the database to see their games in the app. Anyone can still watch a game live, without the app or registering, when the admin shares the live link.

Add new players creates people by initials. They get a player ID right away and show as Unregistered until they sign up. Find player in database adds someone already registered to your list only; it does not seat them in a game. Register players sends each unregistered player their own sign-up link, good once and for 14 days; when they tap Yes on "Is this you?", their scores join their account.

Sort by Frequent puts the people you play with most first. Tap a card to register or remove someone. Removing keeps their account and past games. Pending means a link was sent or someone asked to claim that player with their ID; only Approve links the scores.`,
  find:
    'Registered players only. Type at least two letters of a name, or a player ID such as 42. + My players adds the person to your list; it does not seat them in a game. "In your player list" means they are already there. Someone not in the database? Go back and use Add new players.',
  addToGame:
    'Registered players only. Type at least two letters of a name, or a player ID such as 42. + Add seats the person in this game and adds them to My players at the same time. Someone not in the database? Go back and use Add players.',
  me:
    'Your email is how you sign in and cannot be changed for now. Your player ID is what you give someone so they can find you; it is never used to sign in. Phone is optional and never texted. User settings are the defaults every new game starts with. Dark mode is saved on this phone only.',
  userSettings:
    'These are defaults. Every new game starts with these Drop, Middle drop, and Full count points (-10, -30, -80). To change one game only, open it and tap ⋮ > Game settings.',
  results: `Pick one or more games and tap Show results to add up their points; the highest total is the winner and 1st, 2nd, and 3rd place are named.

If every picked game is Completed, the result is saved and those games become Closed, so they cannot be counted twice. If any picked game is still Active, you only see running totals and nothing is saved. Closed games are not listed here.

Share on a result sends a picture of the totals (with a small per-game grid when there are 5 games or fewer) or a PDF with every round of every game. Results can include at most 50 players.`,
  publicScorecard:
    'This page updates on its own and needs no login. Anyone with the link can watch.',
} as const;

export const EMPTY_SETTLE = 'Finished games stay on Home under Recent.';

export const FIND_HANDOFF =
  "Can't find them? Use Find player in database, or Add new players if they are not registered yet, then come back.";

export const PLAYERS_NOTE =
  'A player must be registered in the database to see their games in the app. Anyone can watch a game live, without the app or registering, when the admin shares the live link.';
