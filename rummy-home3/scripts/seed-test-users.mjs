import { createClient } from '@supabase/supabase-js';
import { loadEnv, requireEnv } from './load-env.mjs';

loadEnv();

const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
const anonKey = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const TEST_USERS = [
  { email: 'player1@rummyhome.test', password: '123456', displayName: 'Player One' },
  { email: 'player2@rummyhome.test', password: '123456', displayName: 'Player Two' },
  { email: 'player3@rummyhome.test', password: '123456', displayName: 'Player Three' },
];

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureUser({ email, password, displayName }) {
  const login = await supabase.auth.signInWithPassword({ email, password });
  if (login.data.session) {
    console.log(`OK  ${email} already exists and can sign in`);
    return { email, password, status: 'existing' };
  }

  const signup = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (signup.error) {
    console.log(`ERR ${email}: ${signup.error.message}`);
    return { email, password, status: 'error', error: signup.error.message };
  }

  if (signup.data.session) {
    console.log(`NEW ${email} created and signed in immediately`);
    return { email, password, status: 'created' };
  }

  const retryLogin = await supabase.auth.signInWithPassword({ email, password });
  if (retryLogin.data.session) {
    console.log(`NEW ${email} created and can sign in`);
    return { email, password, status: 'created' };
  }

  console.log(`NEW ${email} created but cannot sign in yet`);
  console.log('    Email confirmation is probably enabled in Supabase.');
  console.log('    Disable it under Authentication -> Providers -> Email -> Confirm email.');
  return { email, password, status: 'needs_confirmation' };
}

async function main() {
  const health = await fetch(`${url}/auth/v1/health`);
  console.log('Auth health:', health.status, await health.text());
  console.log('\nSeeding test users...\n');

  const results = [];
  for (const user of TEST_USERS) {
    results.push(await ensureUser(user));
  }

  console.log('\nTest login credentials:');
  for (const result of results) {
    if (result.status === 'error') continue;
    console.log(`  ${result.email} / ${result.password}`);
  }

  const blocked = results.some((result) => result.status === 'needs_confirmation');
  if (blocked) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
