import { isAdminEmail } from '@/utils/adminAccess';
import { buildDemoSeedPayload, DemoSeedPayload, mergeDemoData, stripDemoData } from '@/utils/demoData';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { storage } from '@/utils/storage';

type SeedError = { message?: string; code?: string };

function explainDemoError(error: SeedError): Error {
  const message = error.message ?? 'Demo data failed';
  if (
    error.code === 'PGRST202'
    || /could not find the function/i.test(message)
    || /apply_demo_seed|clear_demo_data|schema cache/i.test(message)
  ) {
    return new Error(
      'Demo data is not set up on the server yet. Run supabase/migrations/005_demo_data.sql in the Supabase SQL editor, then try again.',
    );
  }
  return new Error(message);
}

async function currentUserEmail(): Promise<string | null> {
  if (isSupabaseConfigured) {
    const session = await authService.getSession();
    return session?.user.email ?? null;
  }

  const playerId = await storage.getCurrentPlayer();
  if (!playerId) return null;
  const players = await storage.getPlayers();
  return players.find((player) => player.id === playerId)?.email ?? null;
}

async function requireAdmin(): Promise<void> {
  const email = await currentUserEmail();
  if (!isAdminEmail(email)) {
    throw new Error('Demo data is only available for an admin account.');
  }
}

async function loadLocalDemoData() {
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

async function clearLocalDemoData() {
  const [players, games, currentPlayerId] = await Promise.all([
    storage.getPlayers(),
    storage.getGames(),
    storage.getCurrentPlayer(),
  ]);
  const next = stripDemoData(players, games, currentPlayerId ? [currentPlayerId] : []);
  await storage.savePlayers(next.players);
  await storage.saveGames(next.games);
}

export async function loadDemoData() {
  await requireAdmin();

  if (!isSupabaseConfigured) {
    return loadLocalDemoData();
  }

  const userId = await authService.getCurrentUserId();
  if (!userId) throw new Error('You must be signed in to load demo data.');

  const players = await playersService.listPlayers({ includeEphemeral: true });
  const merged = mergeDemoData(players.filter((player) => !player.isDemo), [], userId);
  const payload: DemoSeedPayload = buildDemoSeedPayload(merged);
  const { error } = await supabase.rpc('apply_demo_seed', { payload });
  if (error) throw explainDemoError(error);

  return {
    hostName: merged.host.name,
    gameCount: payload.games.length,
  };
}

export async function clearDemoData() {
  await requireAdmin();

  if (!isSupabaseConfigured) {
    await clearLocalDemoData();
    return;
  }

  const { error } = await supabase.rpc('clear_demo_data');
  if (error) throw explainDemoError(error);
}
