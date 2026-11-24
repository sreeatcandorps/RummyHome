/**
 * Prove the share site serves the build that was just deployed: every page's body hashes to the value
 * in dist/worker/pages.json and carries the same x-ezscore-build header. Retries for about a minute while
 * the new version reaches every edge; exits 1 if any page is still different.
 *
 *   node scripts/verify-site.mjs [https://ezscore.mindweavetech.com]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './build-site-worker.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] ?? 'https://ezscore.mindweavetech.com').replace(/\/$/, '');
const { build, pages } = JSON.parse(readFileSync(join(root, 'dist', 'worker', 'pages.json'), 'utf8'));

async function check() {
  const wrong = [];
  for (const [path, want] of Object.entries(pages)) {
    const res = await fetch(`${base}${path}?v=${encodeURIComponent(build)}`, { headers: { 'cache-control': 'no-cache' } });
    const body = await res.text();
    const live = res.headers.get('x-ezscore-build');
    if (res.status !== 200 || live !== build || sha256(body) !== want) {
      wrong.push(`${path}: HTTP ${res.status}, build ${live ?? '(none)'}, body ${sha256(body) === want ? 'same' : 'different'}`);
    }
  }
  return wrong;
}

let wrong = [];
for (let attempt = 1; attempt <= 7; attempt++) {
  wrong = await check();
  if (wrong.length === 0) {
    console.log(`${base} serves build ${build} on all ${Object.keys(pages).length} pages.`);
    process.exit(0);
  }
  console.log(`attempt ${attempt}: ${wrong.length} page(s) not live yet`);
  await new Promise((r) => setTimeout(r, 10_000));
}
console.error(`${base} is not serving build ${build}:\n  ${wrong.join('\n  ')}`);
process.exit(1);
