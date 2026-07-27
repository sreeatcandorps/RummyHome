import { createClient } from '@supabase/supabase-js';
import { loadEnv, requireEnv } from './load-env.mjs';

loadEnv();

const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
const key = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const password = '123456';
const stamp = Date.now();

const userA = {
  email: `smoke.a.${stamp}@rummyhome.com`,
  password,
  displayName: 'Smoke A',
};

const userB = {
  email: `smoke.b.${stamp}@rummyhome.com`,
  password,
  displayName: 'Smoke B',
};

const makeClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const fail = (label, error) => {
  if (!error) return;
  throw new Error(`${label}: ${error.message || error}`);
};

async function ensureUser(client, { email, password, displayName }) {
  const signup = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (signup.error && !/already/i.test(signup.error.message)) {
    fail('signup', signup.error);
  }

  const login = await client.auth.signInWithPassword({ email, password });
  fail('login', login.error);
  if (!login.data.user?.id || !login.data.session) {
    throw new Error(`login produced no session for ${email}`);
  }

  const { error: profileError } = await client
    .from('profiles')
    .update({ display_name: displayName, email })
    .eq('id', login.data.user.id);
  // Profile may already be correct from trigger; ignore missing-row race lightly.
  if (profileError && !/0 rows/i.test(profileError.message)) {
    console.warn('profile update warning:', profileError.message);
  }

  return login.data.user.id;
}

async function main() {
  console.log('Game-flow smoke against', url);

  const adminClient = makeClient();
  const idA = await ensureUser(adminClient, userA);
  console.log('User A', idA, userA.email);

  const clientB = makeClient();
  const idB = await ensureUser(clientB, userB);
  console.log('User B', idB, userB.email);

  // Continue as user A for create/score/complete
  const asA = await adminClient.auth.signInWithPassword({
    email: userA.email,
    password: userA.password,
  });
  fail('relogin A', asA.error);

  const shareCode = `SM${String(stamp).slice(-4)}`;
  const settings = {
    gameType: 'stake',
    expenseEnabled: false,
    expenseAmount: -10,
    stakeDrop: -10,
    stakeMiddleDrop: -30,
    poolDrop: -25,
    poolMiddleDrop: -50,
    maxCount: -80,
    poolAmount: 100,
    poolDefaultDeposit: -100,
  };

  const gameId = crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gameId)) {
    throw new Error(`Generated invalid game id: ${gameId}`);
  }
  const { error: gameError } = await adminClient
    .from('games')
    .insert({
      id: gameId,
      created_by: idA,
      game_type: 'stake',
      settings,
      share_code: shareCode,
    });
  if (gameError) {
    if (gameError.code === '42501' || /row-level security/i.test(gameError.message)) {
      console.error('\nRLS is blocking game creation.');
      console.error('In Supabase SQL Editor, run:');
      console.error('  rummy-home3/supabase/migrations/002_fix_games_rls.sql');
      console.error('Then re-run: npm run test:game-flow\n');
    }
    fail('create game', gameError);
  }
  console.log('Created game', gameId, 'share_code', shareCode);

  const { error: membersError } = await adminClient.from('game_players').insert([
    {
      game_id: gameId,
      profile_id: idA,
      player_order: 0,
      display_number: 1,
      role: 'game_admin',
    },
    {
      game_id: gameId,
      profile_id: idB,
      player_order: 1,
      display_number: 2,
      role: 'player',
    },
  ]);
  fail('add players', membersError);
  console.log('Added players A + B');

  const { data: round, error: roundError } = await adminClient
    .from('rounds')
    .insert({
      game_id: gameId,
      round_number: 1,
      dealer_profile_id: idA,
      created_by: idA,
    })
    .select('*')
    .single();
  if (roundError) {
    if (/stack depth/i.test(roundError.message)) {
      console.error('\nRLS helper recursion detected.');
      console.error('In Supabase SQL Editor, run:');
      console.error('  rummy-home3/supabase/migrations/003_fix_rls_helpers.sql');
      console.error('Then re-run: npm run test:game-flow\n');
    }
    fail('add round', roundError);
  }

  const { error: scoresError } = await adminClient.from('scores').insert([
    {
      round_id: round.id,
      game_id: gameId,
      profile_id: idA,
      score_type: 'drop',
      value: -10,
    },
    {
      round_id: round.id,
      game_id: gameId,
      profile_id: idB,
      score_type: 'rummy',
      value: 10,
    },
  ]);
  fail('add scores', scoresError);
  console.log('Added balanced round 1');

  const unbalanced = await adminClient.from('scores').insert({
    round_id: round.id,
    game_id: gameId,
    profile_id: idA,
    score_type: 'count',
    value: -5,
  });
  // Extra score would unbalance app logic; DB may still accept. We assert app validation separately.
  if (!unbalanced.error) {
    console.log('Note: DB accepted an extra score row (app validateRoundScores still enforces balance).');
  }

  const { error: undoError } = await adminClient
    .from('rounds')
    .update({
      undone_at: new Date().toISOString(),
      undone_by: idA,
      undo_reason: 'smoke undo',
    })
    .eq('id', round.id);
  fail('undo round', undoError);
  console.log('Undid round 1');

  const { data: round2, error: round2Error } = await adminClient
    .from('rounds')
    .insert({
      game_id: gameId,
      round_number: 2,
      dealer_profile_id: idB,
      created_by: idA,
    })
    .select('*')
    .single();
  fail('add round 2', round2Error);

  const { error: scores2Error } = await adminClient.from('scores').insert([
    {
      round_id: round2.id,
      game_id: gameId,
      profile_id: idA,
      score_type: 'rummy',
      value: 20,
    },
    {
      round_id: round2.id,
      game_id: gameId,
      profile_id: idB,
      score_type: 'drop',
      value: -20,
    },
  ]);
  fail('add scores round 2', scores2Error);

  const { error: advanceError } = await adminClient
    .from('games')
    .update({ current_round: 3 })
    .eq('id', gameId);
  fail('advance round', advanceError);

  const { error: completeError } = await adminClient
    .from('games')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', gameId);
  fail('complete game', completeError);
  console.log('Completed game');

  const { data: memberships, error: listError } = await adminClient
    .from('game_players')
    .select('game_id, games(id, status, share_code, current_round)')
    .eq('profile_id', idA);
  fail('list games', listError);

  const found = (memberships ?? []).some((row) => row.game_id === gameId);
  if (!found) throw new Error('Created game not found in user A memberships');
  console.log('History membership OK');

  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, email, display_name')
    .in('id', [idA, idB]);
  fail('list profiles', profilesError);
  console.log(
    'Profiles visible:',
    (profiles ?? []).map((p) => p.email).join(', ') || '(none)',
  );

  console.log('\nGame-flow smoke passed.');
}

main().catch((error) => {
  console.error('\nGame-flow smoke failed:', error.message ?? error);
  process.exit(1);
});
