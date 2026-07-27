import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAuthError } from '../utils/authErrors';

test('maps network failures to a clear message', () => {
  const message = formatAuthError(new Error('fetch failed'));
  assert.match(message, /Cannot reach the server/);
});

test('maps invalid credentials to passcode guidance', () => {
  const message = formatAuthError({ message: 'Invalid login credentials' });
  assert.match(message, /6-digit passcode/);
});

test('maps unconfirmed email clearly', () => {
  const message = formatAuthError({ message: 'Email not confirmed' });
  assert.match(message, /confirm/i);
});
