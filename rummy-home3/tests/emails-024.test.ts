import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CO_ADMIN_NUDGE_BODY, coAdminCandidates } from '../utils/coAdmin';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('co-admin nudge: registered seated players other than the organiser, in seat order', () => {
  const seated = [
    { id: 'me', name: 'Me', status: 'registered' },
    { id: 'a', name: 'Anita', status: 'registered' },
    { id: 'b', name: 'Bala', status: 'unregistered' },
    { id: 'c', name: 'Chitra', status: 'pending' },
    { id: 'd', name: 'Dev', status: 'registered' },
    { id: 'e', name: 'Eshan' },
  ];
  assert.deepEqual(coAdminCandidates(seated, 'me').map((p) => p.id), ['a', 'd']);
  assert.deepEqual(coAdminCandidates(seated.filter((p) => p.id !== 'a' && p.id !== 'd'), 'me'), [], 'no registered players: no nudge');
  assert.equal(CO_ADMIN_NUDGE_BODY, 'Add a co-admin so someone else can keep scoring if your phone dies.');
});

test('new game: the nudge sits between the initials check and createGame, is skippable, and emails go out after creation', () => {
  const s = src('app/(screens)/games/new.tsx');
  assert.match(s, /if \(coAdminPicks\.length\) \{ setNudge\(\{ labels \}\); return; \}/, 'Start game pauses on the nudge only when someone can be picked');
  assert.match(s, /onSkip=\{\(\) => \{ if \(nudge\) createGame\(nudge\.labels, null\); \}\}/, 'Skip starts the game without a co-admin');
  assert.match(s, /onPick=\{\(id\) => \{ if \(nudge\) createGame\(nudge\.labels, id\); \}\}/);
  assert.match(s, /setSeatRole\(created\.id, coAdminId, 'game_admin'\)/, 'the pick becomes a game admin right after creation');
  assert.match(s, /emailsService\.gameStarted\(created\.id\)\.catch/, 'game-started emails are best effort');
  const nudge = src('components/game/CoAdminNudge.tsx');
  assert.match(nudge, /<Button onPress=\{onSkip\} disabled=\{busy\}>Skip<\/Button>/);
  assert.match(nudge, /Add and start/);
});

test('results: saving flushes the result-saved outbox; no game-completed email exists anywhere', () => {
  assert.match(src('app/(screens)/results/view.tsx'), /emailsService\.resultSaved\(\)\.catch/);
  for (const rel of ['services/emails.ts', 'supabase/migrations/024_emails_and_public_results.sql', 'supabase/functions/send-email/index.ts']) {
    assert.doesNotMatch(src(rel), /['"]game_completed['"]/, `${rel} must not have a game_completed email kind`);
  }
});

test('profile: two email checkboxes, both on by default, saved through set_email_prefs', () => {
  const me = src('app/(tabs)/me.tsx');
  assert.match(me, /Game started \(live link\)/);
  assert.match(me, />Results<\/Text>/);
  assert.equal((me.match(/<Checkbox /g) ?? []).length, 2);
  const svc = src('services/emails.ts');
  assert.match(svc, /DEFAULT_EMAIL_PREFS: EmailPrefs = \{ gameStarted: true, results: true \}/);
  assert.match(svc, /rpc\('set_email_prefs', \{ p_game_started: prefs\.gameStarted, p_results: prefs\.results \}\)/);
  assert.match(svc, /row\.email_game_started !== false/, 'a null column (pre-024 row) reads as on');
});

test('migration 024: outbox is idempotent per event and recipient, defaults are on, unsubscribe is by token', () => {
  const sql = src('supabase/migrations/024_emails_and_public_results.sql');
  assert.match(sql, /email_game_started\s+boolean\s+not null\s+default\s+true/i);
  assert.match(sql, /email_results\s+boolean\s+not null\s+default\s+true/i);
  assert.match(sql, /event_key\s+text\s+not null\s+unique/i, 'one row per (event, recipient)');
  assert.match(sql, /on conflict \(event_key\) do nothing/i);
  assert.match(sql, /create or replace function public\.unsubscribe_email\(p_token text, p_kind text\)/);
  assert.match(sql, /create or replace function public\.public_result\(p_id uuid\)/);
  assert.match(sql, /perform public\.queue_result_saved_emails\(new_id\)/, 'declare_game_result queues the result-saved emails itself');
  assert.doesNotMatch(sql, /email_outbox[\s\S]*enable row level security[\s\S]*policy[\s\S]*select/i, 'no client policy reads the outbox');
});

test('send-email flush: Resend idempotency key is the event key; every email carries an unsubscribe link', () => {
  const fn = src('supabase/functions/send-email/index.ts');
  assert.match(fn, /headers\['Idempotency-Key'\] = idempotencyKey/);
  assert.match(fn, /\{ to: \[row\.to_email\], \.\.\.message \}, row\.event_key\)/, 'the outbox event_key is the Resend idempotency key');
  assert.match(fn, /unsubscribe\.html\?t=/);
  assert.match(src('public/unsubscribe.html'), /params\.get\('t'\)/, 'the page reads the same query parameter the email writes');
  assert.match(fn, /scores@mindweavetech\.com/);
});

test('public results page: read-only, handles deleted and missing results, no private data', () => {
  const page = src('public/r/index.html');
  assert.match(page, /public_result/);
  assert.match(page, /This result was deleted/);
  assert.match(page, /class="box/, 'the games wrap into bands of five (PR 8); nothing scrolls sideways');
  assert.doesNotMatch(page, /email|phone/i, 'nothing personal beyond the PDF');
  assert.match(src('public/404.html'), /\/r\//, 'GitHub Pages: /r/<id> rewrites to /r/?id=');
  const inject = src('scripts/inject-scorecard-config.mjs');
  assert.match(inject, /r\/index\.html/);
  assert.match(inject, /unsubscribe\.html/);
});
