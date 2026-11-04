/**
 * Fill the public scorecard before it is published.
 *
 * public/scorecard.html and web/scorecard.html keep the tokens
 * __SUPABASE_URL__ and __SUPABASE_ANON_KEY__. This script copies the page to
 * dist/scorecard.html with those tokens replaced from the environment.
 * It does not print the key and it does not edit the files in git.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
 *   node scripts/inject-scorecard-config.mjs
 *
 * Publish dist/scorecard.html to https://ezscore.mindweavetech.com/scorecard.html.
 * Never commit dist/scorecard.html.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'scorecard.html');
const out = join(root, 'dist', 'scorecard.html');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!url || url.includes('__') || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  fail('Set EXPO_PUBLIC_SUPABASE_URL to the project URL (https://YOUR_PROJECT.supabase.co).');
}
if (!key || key.includes('__') || key.length < 20) {
  fail('Set EXPO_PUBLIC_SUPABASE_ANON_KEY. The key stays in the environment and is not printed.');
}

const html = readFileSync(source, 'utf8')
  .replaceAll('__SUPABASE_URL__', url.replace(/\/$/, ''))
  .replaceAll('__SUPABASE_ANON_KEY__', key);

if (html.includes('__SUPABASE_')) fail('A placeholder was left in the page.');

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log('Wrote dist/scorecard.html. Publish that file. Do not commit it.');
