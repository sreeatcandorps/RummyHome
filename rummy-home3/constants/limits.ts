import { GUARDRAILS, GUARDRAIL_MESSAGES } from '@/utils/guardrails';

/** Seated score columns in one game. Admins who are not playing do not count. Same cap as the server's players_per_game guardrail (029). */
export const MAX_SEATED_PLAYERS: number = GUARDRAILS.playersPerGame;

/** Distinct seated players across one Results view. */
export const MAX_RESULTS_PLAYERS = 50;

export const SEATED_PLAYER_LIMIT = GUARDRAIL_MESSAGES.players_per_game;

export const GAME_SIZE_MESSAGE = `A game must have between 2 and ${MAX_SEATED_PLAYERS} players.`;

export const RESULTS_PLAYER_LIMIT = 'Results can include at most 50 players.';
