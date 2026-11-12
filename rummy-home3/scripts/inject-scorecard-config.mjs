/**
 * Fill the public scorecard before it is published.
 *
 * public/scorecard.html, public/r/index.html, public/unsubscribe.html and public/link.html keep the tokens
 * __SUPABASE_URL__ and __SUPABASE_ANON_KEY__. This script copies each page to
 * dist/ with those tokens replaced from the environment.
 * It does not print the key and it does not edit the files in git.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
 *   node scripts/inject-scorecard-config.mjs
 *
 * Publish dist/* to https://ezscore.mindweavetech.com/ (same paths), together with
 * public/404.html, which forwards /r/<result id> links. Never commit dist/.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Every public page that talks to Supabase with the anon key. Each is copied to dist/ with
// the same relative path (public/r/index.html -> dist/r/index.html).
const PAGES = ['scorecard.html', 'r/index.html', 'unsubscribe.html', 'link.html'];

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

for (const page of PAGES) {
  const html = readFileSync(join(root, 'public', page), 'utf8')
    .replaceAll('__SUPABASE_URL__', url.replace(/\/$/, ''))
    .replaceAll('__SUPABASE_ANON_KEY__', key);
  if (html.includes('__SUPABASE_')) fail(`A placeholder was left in ${page}.`);
  const out = join(root, 'dist', page);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}
// Pages with no key in them are published straight from public/: 404.html, get/, privacy/, delete-account/.
console.log(`Wrote dist/${PAGES.join(', dist/')}. Publish those files, plus public/404.html, public/get/, public/privacy/ and public/delete-account/ as they are. Do not commit dist/.`);
