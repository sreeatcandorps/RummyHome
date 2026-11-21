// The generator's guardrail and population sizes, kept free of `pg` so the unit tests can import them.

const STAGING_REF = 'erurahfybkxemgtkfzkn';

/** Only loopback / the compose `db` host / the ezscore-staging project. Live is never a target. */
export function allowedTarget(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch { return false; }
  const local = host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === 'db';
  return local || url.includes(STAGING_REF);
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
