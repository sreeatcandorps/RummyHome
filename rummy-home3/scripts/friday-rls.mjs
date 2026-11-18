/**
 * Multi-account check against the live Supabase project.
 * Creates throwaway users (admin, co-admin, player, viewer, outsider),
 * then checks who can see a game, who can score, and that the public
 * scorecard token works without a login.
 *
 * Skips cleanly when rummy-home3/.env.local has no Supabase keys.
 * Requires migration 006_friday_game_night.sql on the project first.
 */
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env.mjs';

loadEnv();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('FAIL friday RLS: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const stamp = Date.now();
const password = '123456';
const accounts = ['admin', 'coadmin', 'player', 'viewer', 'outsider'].map((role) => ({
  role,
  email: `friday-${role}-${stamp}@rummyhome.test`,
  password,
}));

function client() {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signUp(account) {
  const supabase = client();
  const created = await supabase.auth.signUp({
    email: account.email,
    password: account.password,
    options: { data: { display_name: account.role } },
  });
  if (created.error) throw new Error(`${account.role} signup: ${created.error.message}`);
  if (!created.data.session) {
    throw new Error(`${account.role} has no session. Turn off Confirm email in Supabase, or confirm ${account.email}.`);
  }
  await supabase.from('profiles').update({
    display_name: account.role,
    email: account.email,
    first_name: account.role,
    last_name: 'Friday',
  }).eq('id', created.data.session.user.id);
  return { ...account, id: created.data.session.user.id, supabase };
}

function assertOk(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`OK  ${message}`);
}

try {
  const signedIn = [];
  for (const account of accounts) {
    signedIn.push(await signUp(account));
  }
  const [admin, coadmin, player, viewer, outsider] = signedIn;

  const shareCode = `F${String(stamp).slice(-5)}`;
  const created = await admin.supabase.from('games').insert({
    created_by: admin.id,
    game_type: 'stake',
    settings: { gameType: 'stake', expenseEnabled: false, expenseAmount: 0 },
    share_code: shareCode,
  }).select('id, view_token').single();

  if (created.error) {
    throw new Error(`Create game failed (${created.error.message}). Apply supabase/migrations/006_friday_game_night.sql first.`);
  }

  const gameId = created.data.id;
  const memberships = await admin.supabase.from('game_players').insert([
    { game_id: gameId, profile_id: coadmin.id, player_order: 0, role: 'player' },
    { game_id: gameId, profile_id: player.id, player_order: 1, role: 'player' },
    { game_id: gameId, profile_id: viewer.id, player_order: 2, role: 'spectator' },
  ]);
  if (memberships.error) throw new Error(`Seats: ${memberships.error.message}`);

  async function seesGame(person) {
    const { data, error } = await person.supabase.rpc('list_visible_game_ids');
    if (error) throw new Error(`${person.role} list: ${error.message}`);
    return (data ?? []).includes(gameId);
  }

  assertOk(await seesGame(admin), 'creator sees the game without sitting in it');
  assertOk(await seesGame(coadmin), 'co-admin seat sees the game');
  assertOk(await seesGame(player), 'player seat sees the game');
  assertOk(await seesGame(viewer), 'view-only seat sees the game');
  assertOk(!(await seesGame(outsider)), 'outsider does not see the game');

  const promoted = await admin.supabase
    .from('game_players')
    .update({ role: 'game_admin' })
    .eq('game_id', gameId)
    .eq('profile_id', coadmin.id);
  if (promoted.error) throw new Error(`Promote: ${promoted.error.message}`);

  const roundByPlayer = await player.supabase.from('rounds').insert({
    game_id: gameId,
    round_number: 1,
    created_by: player.id,
  });
  assertOk(Boolean(roundByPlayer.error), 'a normal player cannot insert a round');

  const roundByCoadmin = await coadmin.supabase.from('rounds').insert({
    game_id: gameId,
    round_number: 1,
    dealer_profile_id: coadmin.id,
    created_by: coadmin.id,
  }).select('id').single();
  assertOk(!roundByCoadmin.error, 'a game admin can insert a round');

  const anon = client();
  const card = await anon.rpc('public_scorecard', { p_token: created.data.view_token });
  assertOk(!card.error && card.data?.gameId === shareCode, 'public token opens the scorecard with no login');
  const missing = await anon.rpc('public_scorecard', { p_token: 'a'.repeat(48) });
  assertOk(missing.data == null, 'a wrong token does not open a scorecard');

  console.log('Friday RLS checks passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
