import { createClient } from '@supabase/supabase-js';
import { loadEnv, requireEnv } from './load-env.mjs';

loadEnv();

const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
const anonKey = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Player 1 through Player 10: first name is the number, last name is "Player".
const TEST_USERS = Array.from({ length: 10 }, (_, index) => {
  const number = index + 1;
  return {
    email: `player${number}@rummyhome.com`,
    password: '123456',
    displayName: `Player ${number}`,
    firstName: String(number),
    lastName: 'Player',
  };
});

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function syncProfile(session, { email, displayName, firstName, lastName }) {
  if (!session?.user?.id) return;

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      first_name: firstName,
      last_name: lastName,
      email,
    })
    .eq('id', session.user.id);

  if (error) {
    console.log(`    profile sync failed for ${email}: ${error.message}`);
  }
}

async function ensureUser(user) {
  const { email, password, displayName } = user;

  const login = await supabase.auth.signInWithPassword({ email, password });
  if (login.data.session) {
    await syncProfile(login.data.session, user);
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
    await syncProfile(signup.data.session, user);
    console.log(`NEW ${email} created and signed in immediately`);
    return { email, password, status: 'created' };
  }

  const retryLogin = await supabase.auth.signInWithPassword({ email, password });
  if (retryLogin.data.session) {
    await syncProfile(retryLogin.data.session, user);
    console.log(`NEW ${email} created and can sign in`);
    return { email, password, status: 'created' };
  }

  console.log(`NEW ${email} created but cannot sign in yet`);
  console.log('    Email confirmation is probably enabled in Supabase.');
  console.log('    Disable it under Authentication -> Providers -> Email -> Confirm email.');
  return { email, password, status: 'needs_confirmation' };
}

async function main() {
  const health = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
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
