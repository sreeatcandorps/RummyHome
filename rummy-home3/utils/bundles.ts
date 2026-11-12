/**
 * Shapes returned by the 020 bundle RPCs (get_game_bundle, get_home_bundle,
 * list_result_candidates) and the conversions back to the PostgREST row shapes
 * the services already parse, so one mapper (legacyGameFromServer) serves both
 * the bundle path and the pre-020 request sequence.
 */

export type BundleScoreRow = { profile_id: string | null; score_type: string; value: number; round_number: number };

export type BundleSeatRow = {
  profile_id: string;
  player_order: number;
  role: string;
  seated: boolean;
  is_active?: boolean;
  profiles?: Record<string, unknown> | null;
};

export type GameBundle = {
  game: Record<string, any>;
  game_players: BundleSeatRow[];
  scores: BundleScoreRow[];
};

export type ResultCandidate = {
  game: Record<string, any>;
  game_players: BundleSeatRow[];
  totals: Record<string, number>;
};

export type HomeBundle = {
  profile: Record<string, any> | null;
  games: (Record<string, any> & { game_players: BundleSeatRow[] })[];
  notices: { player_id: string; text: string }[];
  claim_requests: Record<string, any>[];
  my_players: { id: string; display_name: string; player_code: string | null; games_together: number }[];
};

/** A bundle's live score rows in the `scores … rounds(round_number, undone_at)` shape. */
export function legacyScoreRows(scores: BundleScoreRow[] | null | undefined) {
  return (scores ?? []).map((row) => ({
    profile_id: row.profile_id,
    score_type: row.score_type,
    value: row.value,
    rounds: { round_number: row.round_number, undone_at: null },
  }));
}

/**
 * Per-player totals as one legacy score row each, so a Game built from a result
 * candidate sums to the same points as one built from every round. The Results
 * picker only needs who played and that the scores exist; the sheet itself is
 * built from the full games on the next screen.
 */
export function totalsAsScoreRows(totals: Record<string, number> | null | undefined) {
  return Object.entries(totals ?? {}).map(([profileId, total]) => ({
    profile_id: profileId,
    score_type: 'count',
    value: Number(total) || 0,
    rounds: { round_number: 1, undone_at: null },
  }));
}

export function isGameBundle(value: unknown): value is GameBundle {
  return Boolean(value) && typeof value === 'object' && 'game' in (value as object) && 'game_players' in (value as object) && 'scores' in (value as object);
}

export function isHomeBundle(value: unknown): value is HomeBundle {
  return Boolean(value) && typeof value === 'object' && 'games' in (value as object) && Array.isArray((value as HomeBundle).games);
}
