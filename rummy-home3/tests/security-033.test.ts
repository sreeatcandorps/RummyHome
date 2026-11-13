import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');
const migration = src('supabase/migrations/033_security_advisor_cleanup.sql');

/** Anon RPCs added after 033, each by a later migration's own explicit grant (036: the two log readers). */
const laterAnonGrants = (): Map<string, string> => {
  const out = new Map<string, string>();
  const dir = path.join(process.cwd(), 'supabase/migrations');
  for (const file of readdirSync(dir).filter((f) => f.slice(0, 3) > '033' && f.endsWith('.sql'))) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    for (const m of text.matchAll(/grant execute on function public\.([a-z_]+)\([^)]*\) to anon/g)) out.set(m[1], file);
  }
  return out;
};

/** Every RPC the signed-out web pages call (fetch .../rest/v1/rpc/<name> or rpc('<name>')). */
const publicPageRpcs = (): Map<string, string[]> => {
  const out = new Map<string, string[]>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.html')) {
        const text = readFileSync(full, 'utf8');
        const names = new Set<string>();
        for (const m of text.matchAll(/\/rest\/v1\/rpc\/([a-z_]+)/g)) names.add(m[1]);
        for (const m of text.matchAll(/\brpc\('([a-z_]+)'/g)) names.add(m[1]);
        if (names.size) out.set(path.relative(process.cwd(), full), [...names].sort());
      }
    }
  };
  walk(path.join(process.cwd(), 'public'));
  return out;
};

/** The anon allow-list inside the migration's DO block. */
const keepList = (): string[] => {
  const m = migration.match(/v_keep text\[\] := array\[([\s\S]*?)\];/);
  assert.ok(m, '033 declares v_keep');
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
};

test('033: every RPC a signed-out web page calls stays executable by anon', () => {
  const keep = keepList();
  const pages = publicPageRpcs();
  assert.deepEqual(
    [...pages.keys()].sort(),
    ['public/link.html', 'public/r/index.html', 'public/scorecard.html', 'public/unsubscribe.html'],
    'the public pages that call the database',
  );
  const later = laterAnonGrants();
  for (const [page, names] of pages) {
    for (const name of names) {
      if (later.has(name)) continue;
      assert.ok(keep.includes(name), `${page} calls ${name}, which 033 must keep for anon`);
      assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to anon`), `${name} is granted to anon explicitly`);
    }
  }
  assert.deepEqual([...later.keys()].sort(), ['public_result', 'public_result_note', 'public_scorecard_changes'], 'anon RPCs after 033: public_result re-created by 034 and the two 036 log readers');
  assert.deepEqual(pages.get('public/link.html'), ['answer_link_request_by_token', 'peek_link_request']);
  assert.deepEqual(pages.get('public/r/index.html'), ['public_result', 'public_result_note']);
  assert.deepEqual(pages.get('public/scorecard.html'), ['public_scorecard', 'public_scorecard_changes']);
  assert.deepEqual(pages.get('public/unsubscribe.html'), ['unsubscribe_email']);
});

test('033: the allow-list is only the five public RPCs and the four row-policy helpers', () => {
  assert.deepEqual(keepList().sort(), [
    'answer_link_request_by_token',
    'can_see_profile',
    'is_app_admin',
    'is_game_admin',
    'is_game_member',
    'peek_link_request',
    'public_result',
    'public_scorecard',
    'unsubscribe_email',
  ]);
});

test('033: the app only reads my_profile (the view is read-only now) and always as a signed-in user', () => {
  const files = ['services/auth.ts', 'services/emails.ts', 'services/players.ts'];
  for (const rel of files) {
    const text = src(rel);
    assert.doesNotMatch(text, /from\('my_profile'\)\s*\.\s*(update|insert|upsert|delete)/, `${rel} never writes through my_profile`);
  }
  assert.match(src('services/auth.ts'), /from\('my_profile'\)\.select\('\*'\)\.eq\('id', userId\)/, 'auth reads the whole own row through the view');
  assert.match(src('services/emails.ts'), /from\('my_profile'\)\.select\('email_game_started, email_results'\)/, 'emails read the two preferences through the view');
});

test('033: my_profile keeps the same columns and runs as the caller; the twelve functions get a search_path', () => {
  assert.match(migration, /create or replace view public\.my_profile\s+with \(security_invoker = true, security_barrier = true\)/);
  assert.match(migration, /select p\.\* from public\.my_profile_rows\(\) p/);
  assert.match(migration, /revoke all on function public\.my_profile_rows\(\) from public, anon/);
  for (const fn of [
    'initials_words(text)', 'initials_push(text[], text)', 'initials_candidates(text)', 'player_label(public.profiles)',
    'site_base_url()', 'link_request_days()', 'lock_profile_email()', 'lock_public_player_no()', 'touch_updated_at()',
    'game_label_text(text, integer)', 'game_label_prefix(public.game_type)', 'lock_game_label()',
  ]) {
    const escaped = fn.replace(/[().\[\]]/g, (c) => `\\${c}`);
    assert.match(migration, new RegExp(`alter function public\\.${escaped} set search_path = public, pg_temp`), `${fn} gets a fixed search_path`);
  }
});
