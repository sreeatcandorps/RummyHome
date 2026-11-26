/**
 * Shared help strings that screens render directly. The help pages themselves live in
 * constants/helpTopics.ts (one topic per screen) and are opened by components/ui/HelpButton.
 */

/** Lives in the My players help (it used to be a banner above the list). */
export const PLAYERS_NOTE =
  'A player must be registered in the database to see their games in the app. Anyone can watch a game live, without the app or registering, when the admin shares the live link.';

export const FIND_HANDOFF =
  "Can't find them? Use Find in database, or Add by initials if they are not registered yet, then come back.";

/** The live web page's "About this page" fold (public/scorecard.html). */
export const PUBLIC_SCORECARD_ABOUT = ['This page updates on its own and needs no login.', 'Anyone with the link can watch.'] as const;

/** Settings priority, highest first, for the ladder graphic on Settings. */
export const SETTINGS_PRIORITY = [
  { level: 'Highest', title: 'Game settings', detail: 'One game, from its ⋮ menu' },
  { level: 'Medium', title: 'Settings', detail: 'Your defaults for new games' },
  { level: 'Lowest', title: 'Game defaults', detail: 'Rummy standard: -10, -30, -80' },
] as const;
