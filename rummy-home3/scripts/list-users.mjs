import { createClient } from '@supabase/supabase-js';
import { loadEnv, requireEnv } from './load-env.mjs';

loadEnv();

const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('Get it from Supabase Dashboard -> Project Settings -> API -> service_role');
  console.error('This key is secret. Never commit it or ship it in the mobile app.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const health = await fetch(`${url}/auth/v1/health`);
  console.log('Auth health:', health.status);

  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (usersError) {
    console.error('Failed to list auth users:', usersError.message);
    process.exit(1);
  }

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id,email,display_name,role,created_at')
    .order('created_at', { ascending: true });

  if (profilesError) {
    console.error('Failed to list profiles:', profilesError.message);
    process.exit(1);
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  console.log(`\nAuth users: ${usersData.users.length}`);
  for (const user of usersData.users) {
    const profile = profileById.get(user.id);
    const confirmed = user.email_confirmed_at ? 'confirmed' : 'unconfirmed';
    console.log(
      `  - ${user.email ?? '(no email)'} | ${profile?.display_name ?? user.user_metadata?.display_name ?? 'no profile'} | ${profile?.role ?? 'no profile row'} | ${confirmed}`,
    );
  }

  console.log(`\nProfiles: ${profiles?.length ?? 0}`);
  for (const profile of profiles ?? []) {
    console.log(`  - ${profile.email ?? '(no email)'} | ${profile.display_name} | ${profile.role}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
