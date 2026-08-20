import assert from 'node:assert/strict';
import test from 'node:test';
import { createUuid, isUuid } from '../utils/uuid';
import { formatSupabaseError, isClockSkewError } from '../utils/supabaseErrors';
import { isEphemeralTestEmail } from '../utils/playerFilters';

test('createUuid always returns a valid UUID', () => {
  for (let i = 0; i < 20; i += 1) {
    const id = createUuid();
    assert.equal(isUuid(id), true, id);
    assert.equal(/^\d+-[0-9a-f]+$/i.test(id), false, id);
  }
});

test('maps JWT clock skew clearly', () => {
  const message = formatSupabaseError({ code: 'PGRST303', message: 'JWT issued at future' });
  assert.match(message, /sign/i);
  assert.equal(isClockSkewError({ code: 'PGRST303', message: 'JWT issued at future' }), true);
});

test('maps invalid uuid create errors clearly', () => {
  const message = formatSupabaseError({
    code: '22P02',
    message: 'invalid input syntax for type uuid: "1785180149586-d54dd2cbff85d"',
  });
  assert.match(message, /game ID/i);
});

test('filters ephemeral smoke emails from player lists', () => {
  assert.equal(isEphemeralTestEmail('smoke.a.123@rummyhome.com'), true);
  assert.equal(isEphemeralTestEmail('smoke+1@rummyhome.com'), true);
  assert.equal(isEphemeralTestEmail('rls2.123@rummyhome.com'), true);
  assert.equal(isEphemeralTestEmail('player1@rummyhome.com'), false);
  assert.equal(isEphemeralTestEmail('koneru2k@gmail.com'), false);
});
