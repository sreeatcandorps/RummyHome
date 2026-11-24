// The generator's guardrail and population sizes, kept free of `pg` so the unit tests can import them.

export const STAGING_REF = 'erurahfybkxemgtkfzkn';

/** Only loopback / the compose `db` host / the ezscore-staging project. Live is never a target. */
export function allowedTarget(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch { return false; }
  const local = host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === 'db';
  return local || url.includes(STAGING_REF);
}

/** Supabase Free plan: past 500 MB the project is switched to read-only mode (run 45295537304 hit it at ~14,000 games). */
export const FREE_PLAN_MB = 500;
export const MB = 1024 * 1024;
/** Bytes each unit adds, indexes and log rows included. Calibrated on run 3 (Nov 24): ~500 MB after ~16,000 games
 *  (mean 20 rounds × 7 players), 2,000 people and ~115k My-players rows → ~31 KB a game; rounded up. The driver
 *  prints the measured bytes per game after the games step so these can be re-tuned from any run. */
export const BYTES_PER = { game: 33 * 1024, person: 4 * 1024, myPlayersRow: 200, result: 6 * 1024, hugeRound: 20 * 260 };

/** Rough My-players rows: everyone in a circle knows everyone (≈ 19 others), plus the power user's circle. */
export function myPlayersRows(S) {
  const power = Math.round(S.powerPlayers * 0.6) + 1;
  return S.people * 19 + power * (power - 1);
}

/** Bytes the population at these sizes adds to a database, by the constants above. */
export function estimateBytes(S) {
  return (S.games + S.live) * BYTES_PER.game + S.people * BYTES_PER.person + myPlayersRows(S) * BYTES_PER.myPlayersRow
    + (S.results + S.powerResults) * BYTES_PER.result + S.hugeRounds * BYTES_PER.hugeRound;
}

/**
 * Pre-run size check: the seed refuses before it starts when what it would add, on top of what is already in the
 * database, lands within 10 % of the plan's limit — hitting the limit mid-run leaves the project read-only (run 3).
 * limitMb 0 turns the check off (Pro, or a local database).
 */
export function sizeVerdict({ currentBytes, S, limitMb }) {
  const addBytes = estimateBytes(S);
  const finalBytes = currentBytes + addBytes;
  const ceiling = limitMb * MB * 0.9;
  const fits = limitMb <= 0 || finalBytes <= ceiling;
  const mb = (b) => Math.round(b / MB);
  return {
    fits, addMb: mb(addBytes), finalMb: mb(finalBytes), currentMb: mb(currentBytes), limitMb,
    message: limitMb <= 0
      ? `size check off: ${mb(currentBytes)} MB now, ≈ +${mb(addBytes)} MB`
      : `${mb(currentBytes)} MB now + ≈ ${mb(addBytes)} MB for this scale = ≈ ${mb(finalBytes)} MB; ${fits ? 'fits' : 'does NOT fit'} ${limitMb} MB (${Math.round(ceiling / MB)} MB ceiling)`,
  };
}

export const SCALE = Math.min(1, Math.max(0.005, Number(process.env.SCALE ?? '1')));
const scaled = (n, min = 1) => Math.max(min, Math.round(n * SCALE));
export const SIZES = {
  people: scaled(2000, 60),
  regulars: scaled(200, 12),
  circles: scaled(150, 6),
  games: scaled(20000, 200),
  results: scaled(3000, 30),
  live: scaled(60, 4),
  powerGames: scaled(1500, 40),
  powerPlayers: scaled(400, 30),
  powerResults: scaled(120, 6),
  hugeRounds: scaled(500, 60),
};
