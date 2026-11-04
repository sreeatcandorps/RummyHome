import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { NOT_READY_MESSAGE, withoutDeveloperInstructions } from '../utils/notReady';
import { formatSupabaseError } from '../utils/supabaseErrors';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('a missing database update is a short message with no SQL', () => {
  const raw = 'This needs the latest database update. Run supabase/migrations/011_player_identity.sql and 012_player_numbers_and_claim_links.sql in the Supabase SQL editor, then try again.';
  assert.equal(formatSupabaseError(new Error(raw)), NOT_READY_MESSAGE);
  assert.equal(withoutDeveloperInstructions('Paste the Supabase anon key into ANON_KEY'), NOT_READY_MESSAGE);
  assert.doesNotMatch(NOT_READY_MESSAGE, /sql|migration|supabase|editor/i);
  for (const file of ['services/playerIdentity.ts', 'services/players.ts', 'services/games.ts', 'services/results.ts', 'services/demoSeed.ts']) {
    assert.doesNotMatch(read(file), /supabase\/migrations\/\d+/);
  }
});

test('the public scorecard reads placeholders and never a real key', () => {
  for (const file of ['public/scorecard.html', 'web/scorecard.html']) {
    const html = read(file);
    assert.match(html, /__SUPABASE_URL__/);
    assert.match(html, /__SUPABASE_ANON_KEY__/);
    assert.match(html, /This scorecard isn't available right now/);
    assert.doesNotMatch(html, /Paste the Supabase/);
    assert.doesNotMatch(html, /gngcrplcldfiubvhcdin/);
    assert.doesNotMatch(html, /eyJ[A-Za-z0-9_-]{10,}/);
    assert.doesNotMatch(html, /params\.get\('k'\)/);
  }
  const script = read('scripts/inject-scorecard-config.mjs');
  assert.match(script, /__SUPABASE_ANON_KEY__/);
  assert.match(script, /dist\/scorecard\.html/);
  assert.doesNotMatch(script, /console\.log\(.*(key|anon)/i);
});

test('011 and 012 are safe to re-run and keep old players on the list', () => {
  const sql11 = read('supabase/migrations/011_player_identity.sql');
  const sql12 = read('supabase/migrations/012_player_numbers_and_claim_links.sql');
  assert.match(sql11, /add column if not exists player_status/);
  assert.match(sql11, /drop trigger if exists profiles_lock_email/);
  assert.match(sql11, /create table if not exists public\.player_links/);
  assert.match(sql12, /drop trigger if exists profiles_lock_player_no/);
  assert.match(sql12, /add column if not exists public_player_no/);
  assert.match(sql12, /coalesce\(p\.player_status, 'registered'\)/);
  assert.match(sql12, /or p\.player_code ilike pattern/);
  assert.match(sql12, /select coalesce\('#' \|\| p\.public_player_no::text, nullif\(p\.player_code, ''\)\)/);
  assert.doesNotMatch(sql12, /coalesce\(public\.player_label/);
});
