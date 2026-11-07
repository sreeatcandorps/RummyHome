import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canSeeResult, RESULT_NOT_AVAILABLE, userConnectedToGame } from '../utils/resultsAccess';

const facts = {
  declaredBy: 'admin-h',
  playerIds: ['admin-h', 'sree', 'venkat'],
  games: [
    { createdBy: 'creator-only', players: ['admin-h', 'sree', 'venkat'], adminIds: ['admin-h'] },
    { createdBy: 'admin-h', players: ['admin-h', 'sree'], adminIds: ['admin-h'], unseatedAdminIds: ['scorekeeper'] },
  ],
};

test('P1-A: participants, the declarer, creators and non-playing admins can open a result', () => {
  assert.equal(canSeeResult(facts, 'sree'), true, 'seated player');
  assert.equal(canSeeResult(facts, 'venkat'), true, 'player in only one of the games');
  assert.equal(canSeeResult(facts, 'admin-h'), true, 'declarer');
  assert.equal(canSeeResult(facts, 'creator-only'), true, 'creator who did not play');
  assert.equal(canSeeResult(facts, 'scorekeeper'), true, 'non-playing admin');
  assert.equal(canSeeResult(facts, 'anyone', { isAppAdmin: true }), true, 'app admin');
});

test('P1-A: a fresh unrelated account sees nothing, including when games are unreadable', () => {
  assert.equal(canSeeResult(facts, 'satya'), false);
  assert.equal(canSeeResult({ ...facts, games: [null, null] }, 'satya'), false, 'RLS hid every game');
  assert.equal(canSeeResult({ ...facts, games: undefined }, 'satya'), false);
  assert.equal(canSeeResult(facts, null), false, 'signed out');
  assert.equal(canSeeResult(facts, ''), false);
});

test('P1-A: watching through the public live link is not membership', () => {
  assert.equal(userConnectedToGame({ createdBy: 'x', players: ['a'], adminIds: [] }, 'viewer'), false);
  assert.equal(userConnectedToGame(null, 'viewer'), false);
  assert.match(RESULT_NOT_AVAILABLE, /players, the organizer and admins/);
  assert.doesNotMatch(RESULT_NOT_AVAILABLE, /password|SQL|migration/i);
});

test('P1-A: migration 013 gates every results reader through can_see_game_result', () => {
  const sql = readFileSync(new URL('../supabase/migrations/013_results_privacy.sql', import.meta.url), 'utf8');
  assert.match(sql, /create or replace function public\.can_see_game_result\(p_result_id uuid\)/);
  assert.match(sql, /public\.is_app_admin\(\)/);
  assert.match(sql, /r\.declared_by = auth\.uid\(\)/);
  assert.match(sql, /public\.is_game_member\(grg\.game_id\)/);
  assert.doesNotMatch(sql, /spectator_access\s*=\s*true/, 'spectators must not see results');
  for (const fn of ['get_game_result(p_id uuid)', 'list_game_results()', 'list_game_results_page(p_limit integer']) {
    const start = sql.indexOf(`create or replace function public.${fn}`);
    assert.ok(start > 0, `${fn} is redefined`);
    const body = sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
    assert.match(body, /can_see_game_result\(/, `${fn} filters by can_see_game_result`);
  }
  const page = sql.slice(sql.indexOf('list_game_results_page'));
  assert.ok(page.indexOf('can_see_game_result(gr.id)') < page.indexOf('limit greatest'), 'filter runs before limit/offset');
  assert.match(sql, /grant execute on function public\.get_game_result\(uuid\) to authenticated/);
  assert.doesNotMatch(sql, /to anon\b/);
});
