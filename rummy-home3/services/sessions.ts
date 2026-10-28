import { MIGRATION_006_HINT } from '@/services/games';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { Game } from '@/types/game';
import {
  balancesAfterEntries,
  isSettled,
  openingBalances,
  PrizeEntry,
  PrizeGame,
  PrizeLeg,
  validateLegs,
} from '@/utils/prizeSession';
import { storage } from '@/utils/storage';

const LOCAL_KEY = 'prizeSessions';

export type SessionGame = PrizeGame & {
  shareCode?: string;
  date?: string;
};

export type PrizeSession = {
  id: string;
  title: string;
  status: 'open' | 'settled';
  createdAt: string;
  games: SessionGame[];
  entries: PrizeEntry[];
};

type StoredSession = PrizeSession;

const missingRpc = (error: unknown) => {
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  const code = (error as { code?: string })?.code;
  return code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
};

async function readLocal(): Promise<StoredSession[]> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  return raw ? JSON.parse(raw) as StoredSession[] : [];
}

async function writeLocal(sessions: StoredSession[]) {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(sessions));
}

function gameToPrize(game: Game, names: Map<string, string>): SessionGame {
  return {
    id: game.id,
    gameType: game.gameType,
    prize: game.prize ?? null,
    prizeShares: game.prizeShares ?? null,
    shareCode: game.shareCode,
    date: game.date,
    players: game.players
      .filter((id) => id !== 'EX')
      .map((id) => ({
        id,
        name: names.get(id) ?? 'Player',
        points: (game.scores[id] ?? []).reduce((sum, value) => sum + (value || 0), 0),
      })),
  };
}

function withStatus(session: PrizeSession): PrizeSession {
  const opening = openingBalances(session.games);
  const balances = balancesAfterEntries(opening, session.entries);
  return { ...session, status: isSettled(balances) ? 'settled' : 'open' };
}

function fromServer(payload: any): PrizeSession {
  return {
    id: payload.id,
    title: payload.title ?? 'Prize distribution',
    status: payload.status === 'settled' ? 'settled' : 'open',
    createdAt: payload.createdAt,
    games: (payload.games ?? []).map((game: any) => ({
      id: game.id,
      gameType: game.gameType,
      prize: game.prize ?? null,
      prizeShares: game.prizeShares ?? null,
      shareCode: game.shareCode,
      date: game.date,
      players: (game.players ?? []).map((player: any) => ({
        id: player.id,
        name: player.name,
        points: player.points ?? 0,
      })),
    })),
    entries: (payload.entries ?? []).map((entry: any) => ({
      id: entry.id,
      note: entry.note,
      createdAt: entry.createdAt,
      legs: (entry.legs ?? []).map((leg: any) => ({
        profileId: leg.profileId,
        amount: leg.amount,
      })),
    })),
  };
}

export const sessionsService = {
  async create(gameIds: string[], names: Map<string, string> = new Map()): Promise<PrizeSession> {
    if (gameIds.length === 0) throw new Error('Pick at least one completed game.');

    if (!isSupabaseConfigured) {
      const games = await storage.getGames();
      const chosen = gameIds
        .map((id) => games.find((game) => game.id === id))
        .filter((game): game is Game => Boolean(game && game.isComplete));
      if (chosen.length !== gameIds.length) throw new Error('Only completed games can go into a session.');
      const session = withStatus({
        id: `session-${Date.now()}`,
        title: 'Prize distribution',
        status: 'open',
        createdAt: new Date().toISOString(),
        games: chosen.map((game) => gameToPrize(game, names)),
        entries: [],
      });
      const existing = await readLocal();
      await writeLocal([session, ...existing]);
      return session;
    }

    const { data, error } = await supabase.rpc('create_prize_session', { p_game_ids: gameIds });
    if (error) {
      if (missingRpc(error)) throw new Error(MIGRATION_006_HINT);
      throw error;
    }
    const session = await this.get(data as string);
    if (!session) throw new Error('The session was created but could not be opened.');
    return session;
  },

  async get(sessionId: string): Promise<PrizeSession | null> {
    if (!isSupabaseConfigured) {
      const sessions = await readLocal();
      return sessions.find((session) => session.id === sessionId) ?? null;
    }
    const { data, error } = await supabase.rpc('get_prize_session', { p_session_id: sessionId });
    if (error) {
      if (missingRpc(error)) throw new Error(MIGRATION_006_HINT);
      throw error;
    }
    if (!data) return null;
    return fromServer(data);
  },

  async addEntry(sessionId: string, legs: PrizeLeg[], note: string): Promise<PrizeSession> {
    const check = validateLegs(legs);
    if (!check.ok) throw new Error(check.error);

    if (!isSupabaseConfigured) {
      const sessions = await readLocal();
      const index = sessions.findIndex((session) => session.id === sessionId);
      if (index < 0) throw new Error('Session not found.');
      const entry: PrizeEntry = {
        id: `entry-${Date.now()}`,
        note,
        createdAt: new Date().toISOString(),
        legs,
      };
      const next = withStatus({
        ...sessions[index],
        entries: [...sessions[index].entries, entry],
      });
      sessions[index] = next;
      await writeLocal(sessions);
      return next;
    }

    const { data, error } = await supabase.rpc('add_prize_entry', {
      p_session_id: sessionId,
      p_legs: legs,
      p_note: note,
    });
    if (error) {
      if (missingRpc(error)) throw new Error(MIGRATION_006_HINT);
      throw error;
    }
    return fromServer(data);
  },
};
