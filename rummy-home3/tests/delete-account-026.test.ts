import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DELETE_ACCOUNT_CONFIRM_LABEL,
  DELETE_ACCOUNT_PAGE_URL,
  DELETED_ITEMS,
  KEPT_ITEMS,
  PRIVACY_PAGE_URL,
  SUPPORT_EMAIL,
} from '../utils/accountDeletion';
import { seatMenu } from '../utils/gamePlayers';
import { HELP } from '../constants/help';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('item 6: the public pages exist at /privacy and /delete-account and say the same thing as the app', () => {
  const privacy = src('public/privacy/index.html');
  const del = src('public/delete-account/index.html');
  for (const page of [privacy, del]) {
    assert.match(page, new RegExp(SUPPORT_EMAIL.replace('.', '\\.')), 'contact is support@mindweavetech.com');
    assert.doesNotMatch(page, /__SUPABASE_|supabase\.co|RESEND_/, 'no keys, no project URL');
    assert.doesNotMatch(page, /Rummy ?Home/i, 'the product is EZ Score');
  }
  assert.match(privacy, /ca-central-1/, 'the Supabase region is named');
  assert.match(privacy, /no ads and no analytics/i);
  assert.match(privacy, /encrypted in transit/i);
  assert.match(privacy, /Resend/);
  assert.match(privacy, /href="\/delete-account"/);
  assert.match(del, /href="\/privacy"/);
  for (const line of [...DELETED_ITEMS, ...KEPT_ITEMS]) {
    assert.ok(del.includes(line), `delete-account page carries: ${line}`);
  }
  assert.match(del, /Profile<\/strong>.*\n?.*Account<\/strong>, tap <strong>Delete account<\/strong>/s, 'the in-app steps are spelled out');
  assert.ok(del.includes(DELETE_ACCOUNT_CONFIRM_LABEL), 'the tick-box wording matches the app');
  assert.equal(PRIVACY_PAGE_URL, 'https://ezscore.mindweavetech.com/privacy');
  assert.equal(DELETE_ACCOUNT_PAGE_URL, 'https://ezscore.mindweavetech.com/delete-account');
});

test('item 6: Profile has Delete account behind a confirmation, and Help explains it', () => {
  const me = src('app/(tabs)/me.tsx');
  assert.match(me, /<DeleteAccountDialog/);
  assert.match(me, /testID="delete-account"/);
  assert.match(me, /Linking\.openURL\(PRIVACY_PAGE_URL\)/, 'the privacy policy is one tap away');
  const dialog = src('components/account/DeleteAccountDialog.tsx');
  assert.match(dialog, /disabled=\{!agreed \|\| busy\}/, 'the red button needs the tick first');
  assert.match(dialog, /DELETED_ITEMS\.map/);
  assert.match(dialog, /KEPT_ITEMS\.map/);
  assert.match(dialog, /authService\.deleteAccount\(\)/);
  const auth = src('services/auth.ts');
  assert.match(auth, /rpc as any\)\('delete_my_account'\)/);
  assert.match(auth, /signOut\(\{ scope: 'local' \}\)\.catch/, 'the auth user is already gone: the local wipe must not depend on the server');
  assert.match(HELP.me, /Delete account/);
});

test('item 6: a deleted account can be a seat but never an admin', () => {
  const game = { createdBy: 'me', adminIds: ['me'], unseatedAdminIds: [] };
  const items = seatMenu({ id: 'gone', name: 'Gone', status: 'deleted_after_registering', seatRole: 'player', seated: true }, game as any, 'me', true);
  const make = items.find((entry) => entry.item === 'make_admin');
  assert.ok(make, 'the row still has the item');
  assert.equal(make?.enabled, false);
  assert.match(make?.reason ?? '', /deleted/);
  assert.ok(items.some((entry) => entry.item === 'remove_player'), 'removing the seat still follows the zero-score rule');
});

test('migration 026: anonymise, keep seats, hand over orphaned games, and the dashboard delete follows suit', () => {
  const sql = src('supabase/migrations/026_delete_account.sql');
  assert.match(sql, /create or replace function public\.delete_my_account\(\)/);
  assert.match(sql, /grant execute on function public\.delete_my_account\(\) to authenticated;/);
  assert.match(sql, /revoke all on function public\.tombstone_profile\(uuid\) from public, anon, authenticated;/);
  assert.match(sql, /player_status = 'deleted_after_registering'/);
  assert.match(sql, /public_player_no = null/);
  assert.match(sql, /player_code = public\.generate_player_code\(\)/, 'the old code is freed, the column stays not null');
  assert.match(sql, /delete from public\.my_players where owner_id = p_profile_id or player_id = p_profile_id;/);
  assert.match(sql, /delete from public\.email_outbox where to_profile_id = p_profile_id;/);
  assert.match(sql, /update public\.game_players set role = 'player'/, 'seated admin rows become plain seats');
  assert.match(sql, /gp\.role = 'spectator' or coalesce\(gp\.seated, true\) = false/, 'viewer and non-playing admin rows are removed');
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('game:' \|\| g\.id::text, 0\)\)/, 'the per-game lock of 019');
  assert.match(sql, /perform public\.tombstone_profile\(old\.id\);/, 'deleting from auth.users anonymises a profile with history');
  assert.match(sql, /delete from auth\.users where id = me;/);
  assert.doesNotMatch(sql, /delete from public\.scores|delete from public\.rounds/, 'scores and rounds are never deleted');
  const rollback = src('supabase/rollback/rollback_026_delete_account.sql');
  assert.match(rollback, /drop function if exists public\.delete_my_account\(\);/);
  assert.match(rollback, /drop function if exists public\.tombstone_profile\(uuid\);/);
  for (const fn of ['enforce_profile_auth_user', 'lock_profile_email', 'lock_public_player_no', 'delete_profile_with_auth_user']) {
    assert.match(rollback, new RegExp(`create or replace function public\\.${fn}\\(\\)`), `${fn} goes back to its earlier body`);
  }
});

test('item 6: no "dev" label anywhere a store build can show one', () => {
  for (const rel of ['app/(tabs)/_layout.tsx', 'utils/appVersion.ts', 'constants/help.ts']) {
    assert.doesNotMatch(src(rel), /dev build|\(dev\)|'dev'/, `${rel} has no dev label`);
  }
});
