import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// D73 (Sree, Nov 23: "Yes to the new email design and the EZ Score: Rummy sender name"): the HTML of every
// email carries one button and no raw URL; the plain-text part keeps the URL for text-only mail apps.
const fn = readFileSync(path.join(__dirname, '../supabase/functions/send-email/index.ts'), 'utf8');

test('D73: no "Or copy this link" line in any HTML template', () => {
  assert.doesNotMatch(fn, /copy this link/i);
});

test('D73: the queued game and result emails use the shared button and the link note', () => {
  assert.match(fn, /\$\{button\(p\.url, 'Open the live scorecard'\)\}/);
  assert.match(fn, /\$\{button\(p\.url, 'See the full result'\)\}/);
  assert.match(fn, /\$\{button\(body\.url, 'Open the live scorecard'\)\}/, 'the one-off scorecard email too');
  assert.equal((fn.match(/\$\{LINK_NOTE\}/g) ?? []).length, 3);
  assert.match(fn, /Anyone with this link can see the scores, so forward it only to people at the table\./);
});

test('D73: the plain-text parts still carry the URL', () => {
  assert.match(fn, /Live scores: \$\{p\.url\}/);
  assert.match(fn, /Full result: \$\{p\.url\}/);
});

test('D73: the button is Palette B green; the first line says "just now" with the game label in bold', () => {
  assert.match(fn, /'#0E4D2A'/);
  assert.doesNotMatch(fn, /#17402F/);
  assert.match(fn, /started <strong>\$\{escapeHtml\(g\)\}<\/strong> just now\. The scorecard updates as rounds are saved\./);
});

test('D73: the deploy note names the Play listing name as the sender', () => {
  assert.match(fn, /RESEND_FROM="EZ Score: Rummy <scores@mindweavetech\.com>"/);
});
