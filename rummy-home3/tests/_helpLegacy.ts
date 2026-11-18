/**
 * The old help dialog (one flat text per screen) was replaced by help pages in PR 11. Tests written
 * against the old `HELP.<key>` strings read the same copy from the topic that absorbed it, flattened
 * back to "## heading" / "• bullet" lines with the **bold** markup removed.
 */
import { HELP_TOPICS, HelpTopicKey } from '../constants/helpTopics';

function flat(key: HelpTopicKey, only?: string[]): string {
  const t = HELP_TOPICS[key];
  const sections = only ? t.sections.filter((s) => only.includes(s.title)) : t.sections;
  const lines = only ? [] : t.needToKnow.map((b) => `• ${b}`);
  for (const s of sections) lines.push(`## ${s.title}`, ...s.bullets.map((b) => `• ${b}`));
  if (!only) lines.push(...t.tricky.map((x) => `• ${x.q} ${x.a}`));
  return lines.join('\n').replace(/\*\*/g, '');
}

export const HELP = {
  signIn: flat('sign-in'),
  createAccount: flat('sign-in'),
  reset: flat('sign-in'),
  home: flat('home', ['Statuses', 'Results', 'My players', 'Recent', 'Bottom bar']),
  addPlayersToGame: flat('new-game', ['Adding mid-game']),
  newGame: flat('new-game'),
  gameType: flat('game-type'),
  scorecard: flat('scorecard'),
  playersSheet: flat('players-admins'),
  scoreEntry: flat('add-round'),
  scoreEntryPool: flat('add-round', ['Pool']),
  awards: flat('awards'),
  complete: flat('complete'),
  players: flat('my-players'),
  initials: flat('new-game', ['Initials clash']),
  find: flat('add-players'),
  addToGame: flat('add-players'),
  addPlayers: flat('add-players'),
  me: flat('me'),
  userSettings: flat('settings'),
  hiddenDeleted: flat('hidden-deleted'),
  results: flat('results'),
  gameLog: flat('game-log'),
  resultHistory: flat('results', ['A saved result']),
} as const;
