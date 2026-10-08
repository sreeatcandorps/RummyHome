import { mergeDemoData, stripDemoData } from '@/utils/demoData';
import { storage } from '@/utils/storage';

function assertDevBuild() {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    throw new Error('Demo data is only available in development builds.');
  }
}

export async function loadDemoData() {
  assertDevBuild();
  const [players, games, currentPlayerId] = await Promise.all([
    storage.getPlayers(),
    storage.getGames(),
    storage.getCurrentPlayer(),
  ]);
  const next = mergeDemoData(players, games, currentPlayerId);
  await storage.savePlayers(next.players);
  await storage.saveGames(next.games);
  return {
    hostName: next.host.name,
    gameCount: next.games.filter((game) => game.id.startsWith('demo-')).length,
  };
}

export async function clearDemoData() {
  assertDevBuild();
  const [players, games, currentPlayerId] = await Promise.all([
    storage.getPlayers(),
    storage.getGames(),
    storage.getCurrentPlayer(),
  ]);
  const next = stripDemoData(players, games, currentPlayerId ? [currentPlayerId] : []);
  await storage.savePlayers(next.players);
  await storage.saveGames(next.games);
}
