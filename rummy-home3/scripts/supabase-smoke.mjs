import { createClient } from '@supabase/supabase-js';
import { loadEnv, requireEnv } from './load-env.mjs';

loadEnv();

const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
const key = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(url, key);

const formatError = (error) => {
  if (!error) return 'unknown';
  return [error.name, error.message, error.status, error.code].filter(Boolean).join(' | ');
};

async function main() {
  console.log('Supabase URL:', url);

  try {
    const health = await fetch(`${url}/auth/v1/health`);
    console.log('Auth health:', health.status, await health.text());
  } catch (error) {
    console.error('Auth health failed:', error.message);
    process.exit(1);
  }

  const testEmail = `smoke+${Date.now()}@rummyhome.test`;
  const password = '123456';

  const signUp = await supabase.auth.signUp({
    email: testEmail,
    password,
    options: { data: { display_name: 'Smoke Test' } },
  });

  console.log('Signup:', formatError(signUp.error));
  console.log('  user:', signUp.data.user?.id ?? 'none');
  console.log('  session:', Boolean(signUp.data.session));
  console.log('  email confirmed:', signUp.data.user?.email_confirmed_at ?? 'not yet');

  const signIn = await supabase.auth.signInWithPassword({ email: testEmail, password });
  console.log('Login after signup:', formatError(signIn.error));
  console.log('  session:', Boolean(signIn.data.session));

  if (!signIn.data.session) {
    console.log('\nLikely blocker: email confirmation is required before login works.');
    console.log('Fix in Supabase Dashboard -> Authentication -> Providers -> Email -> disable Confirm email.');
    process.exit(2);
  }

  const profiles = await supabase
    .from('profiles')
    .select('id,email,display_name,role,created_at')
    .order('created_at', { ascending: true });

  console.log('Profiles query:', formatError(profiles.error));
  console.log('Profiles in database:', profiles.data?.length ?? 0);
  for (const profile of profiles.data ?? []) {
    console.log(`  - ${profile.email ?? '(no email)'} | ${profile.display_name} | ${profile.role}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
