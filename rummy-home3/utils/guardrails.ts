/**
 * Guardrails (migration 029): the server-enforced limits. The database table
 * public.guardrails is the source of truth and the BEFORE triggers refuse with SQLSTATE GRD01
 * and the message below; this file mirrors the shipped defaults so the app can say the same
 * thing before a round trip, and so the local (no Supabase) prototype enforces the same caps.
 * Tuning the table later changes the server at once; these numbers are only the defaults.
 */
export const GUARDRAILS = {
  myPlayersMax: 2000,
  playersAddedPerDay: 100,
  playersPerGame: 20,
  roundsPerGame: 500,
  liveGamesPerUser: 10,
  gamesPerDay: 50,
  linkRequestsPending: 20,
  emailPerDay: 90,
  emailPerFlush: 50,
} as const;

export type GuardrailKey =
  | 'my_players_max'
  | 'players_added_per_day'
  | 'players_per_game'
  | 'rounds_per_game'
  | 'live_games_per_user'
  | 'games_per_day'
  | 'link_requests_pending';

/** Same wording as the rows migration 029 inserts. */
export const GUARDRAIL_MESSAGES: Record<GuardrailKey, string> = {
  my_players_max: 'My players is full (2,000). Remove someone first.',
  players_added_per_day: 'You added 100 players today. Try again tomorrow.',
  players_per_game: 'A game holds at most 20 players.',
  rounds_per_game: 'This game has 500 rounds, the most a game can hold. Start a new game.',
  live_games_per_user: 'You have 10 live games. Finish or close one first.',
  games_per_day: 'You created 50 games today. Try again tomorrow.',
  link_requests_pending: 'You have 20 link requests waiting. Wait for an answer or cancel one first.',
};

/** The SQLSTATE every guardrail refusal carries. */
export const GUARDRAIL_SQLSTATE = 'GRD01';

/** True when a Supabase/PostgREST error came from a guardrail trigger; the message is already friendly. */
export function isGuardrailError(error: unknown): boolean {
  const err = error as { code?: string; hint?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === GUARDRAIL_SQLSTATE) return true;
  if (typeof err.hint === 'string' && err.hint.startsWith('guardrail:')) return true;
  const message = err.message ?? '';
  return Object.values(GUARDRAIL_MESSAGES).some((text) => message.includes(text));
}

/** Which limit a guardrail error hit, when it can be told. */
export function guardrailKeyOf(error: unknown): GuardrailKey | null {
  const err = error as { hint?: string; message?: string } | null;
  if (!err) return null;
  const hinted = typeof err.hint === 'string' && err.hint.startsWith('guardrail:') ? err.hint.slice('guardrail:'.length) : null;
  if (hinted && hinted in GUARDRAIL_MESSAGES) return hinted as GuardrailKey;
  const message = err.message ?? '';
  const match = (Object.keys(GUARDRAIL_MESSAGES) as GuardrailKey[]).find((key) => message.includes(GUARDRAIL_MESSAGES[key]));
  return match ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows created in the last rolling 24 hours (the server counts the same way, on created_at). */
export function countInLastDay(stamps: readonly (string | null | undefined)[], now: number = Date.now()): number {
  return stamps.filter((iso) => iso && now - Date.parse(iso) < DAY_MS).length;
}

/**
 * The local prototype's version of guard_games: refuses a new game the way the server would.
 * Returns the message to show, or null when the game may be created.
 */
export function localGameGuard(
  games: readonly { createdBy?: string | null; status?: string | null; closedAt?: string | null; deletedAt?: string | null; createdAt?: string | null }[],
  creatorId: string,
  now: number = Date.now(),
): string | null {
  const mine = games.filter((g) => g.createdBy === creatorId);
  const live = mine.filter((g) => g.status === 'active' && !g.closedAt && !g.deletedAt).length;
  if (live >= GUARDRAILS.liveGamesPerUser) return GUARDRAIL_MESSAGES.live_games_per_user;
  if (countInLastDay(mine.map((g) => g.createdAt), now) >= GUARDRAILS.gamesPerDay) return GUARDRAIL_MESSAGES.games_per_day;
  return null;
}

/** The local prototype's version of guard_my_players for a brand-new row. */
export function localMyPlayersGuard(
  rows: readonly { ownerId: string; removedAt?: string | null; createdAt?: string | null }[],
  ownerId: string,
  now: number = Date.now(),
): string | null {
  const mine = rows.filter((r) => r.ownerId === ownerId);
  if (mine.filter((r) => !r.removedAt).length >= GUARDRAILS.myPlayersMax) return GUARDRAIL_MESSAGES.my_players_max;
  if (countInLastDay(mine.map((r) => r.createdAt), now) >= GUARDRAILS.playersAddedPerDay) return GUARDRAIL_MESSAGES.players_added_per_day;
  return null;
}

/** The local prototype's version of guard_rounds. */
export function localRoundsGuard(liveRounds: number): string | null {
  return liveRounds >= GUARDRAILS.roundsPerGame ? GUARDRAIL_MESSAGES.rounds_per_game : null;
}

const MINUTE_MS = 60 * 1000;

/**
 * Email backlog rule, mirrored by send-email's nextAttemptAfter: how long a failed outbox row
 * waits before the flush tries it again. A Resend 429 that names the daily quota waits a day,
 * any other 429 a minute; other failures back off from 5 minutes, doubling, capped at a day.
 * Rows are never dropped.
 */
export function emailRetryDelayMs(attempts: number, status: number, detail: string): number {
  if (status === 429) return /daily|quota|per day/i.test(detail) ? DAY_MS : MINUTE_MS;
  return Math.min(DAY_MS, 5 * MINUTE_MS * 2 ** Math.max(0, attempts - 1));
}
