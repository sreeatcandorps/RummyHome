/**
 * Build the share site (https://ezscore.mindweavetech.com) as one Cloudflare Worker.
 *
 * The live site is the Worker `ezscore-site`: every page is inlined in one module and served by path.
 * Until Nov 23 that module was uploaded by hand, so the live pages drifted from `public/` (the Nov 12
 * build served shared pool links without Standings for eleven days). This script makes the module
 * from `public/` so `.github/workflows/publish-site.yml` can deploy it on every merge to main.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
 *   SITE_BUILD=<commit sha> \
 *   node scripts/build-site-worker.mjs
 *
 * Writes dist/worker/worker.js (deployed with site/wrangler.toml) and dist/worker/pages.json
 * (path → sha256 of each page, read by scripts/verify-site.mjs). It does not print the key.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Served path → file under public/. Pages marked `keyed` carry the __SUPABASE_*__ placeholders. */
export const SITE_PAGES = [
  { path: '/get', file: 'get/index.html' },
  { path: '/scorecard.html', file: 'scorecard.html', keyed: true },
  { path: '/r', file: 'r/index.html', keyed: true },
  { path: '/unsubscribe.html', file: 'unsubscribe.html', keyed: true },
  { path: '/link.html', file: 'link.html', keyed: true },
  { path: '/privacy', file: 'privacy/index.html' },
  { path: '/delete-account', file: 'delete-account/index.html' },
  { path: '/404.html', file: '404.html' },
];

export function checkConfig({ url, key }) {
  if (!url || url.includes('__') || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
    throw new Error('Set EXPO_PUBLIC_SUPABASE_URL to the project URL (https://YOUR_PROJECT.supabase.co).');
  }
  if (!key || key.includes('__') || key.length < 20) {
    throw new Error('Set EXPO_PUBLIC_SUPABASE_ANON_KEY. The key stays in the environment and is not printed.');
  }
}

/** Every served page with its placeholders filled. */
export function buildSitePages(publicDir, { url, key }) {
  checkConfig({ url, key });
  const pages = {};
  for (const { path, file, keyed } of SITE_PAGES) {
    let html = readFileSync(join(publicDir, file), 'utf8');
    if (keyed) {
      html = html.replaceAll('__SUPABASE_URL__', url.replace(/\/$/, '')).replaceAll('__SUPABASE_ANON_KEY__', key);
    }
    if (html.includes('__SUPABASE_')) throw new Error(`A placeholder was left in ${file}.`);
    pages[path] = html;
  }
  return pages;
}

export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** The Worker module. Routing is the Nov 12 hand-uploaded module's, plus an x-ezscore-build header. */
export function renderWorker(pages, build) {
  return `const P=${JSON.stringify(pages)};
const BUILD=${JSON.stringify(build)};
const HTML={'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300','x-ezscore-build':BUILD};
export default { async fetch(req){
  const u=new URL(req.url);
  let p=u.pathname.replace(/\\/index\\.html$/,'').replace(/\\/$/,'')||'/';
  if(p==='/scorecard') p='/scorecard.html';
  if(p==='/unsubscribe') p='/unsubscribe.html';
  if(p==='/link') p='/link.html';
  if(/^\\/r\\/[0-9a-f-]{36}$/i.test(p)) p='/r';
  if(p==='/') return new Response("<!doctype html><meta charset=utf-8><title>EZ Score: Rummy</title><h1>EZ Score: Rummy</h1><p>by MindWeave (Candor PS LLC). <a href=\\"/get\\">Get the app</a></p>",{headers:HTML});
  const b=P[p];
  if(!b) return new Response(P['/404.html'],{status:404,headers:{'content-type':'text/html; charset=utf-8','x-ezscore-build':BUILD}});
  return new Response(b,{headers:HTML});
} };
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const pages = buildSitePages(join(root, 'public'), {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '',
      key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '',
    });
    const build = (process.env.SITE_BUILD ?? '').trim() || 'local';
    const out = join(root, 'dist', 'worker');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'worker.js'), renderWorker(pages, build));
    const hashes = Object.fromEntries(Object.entries(pages).map(([p, html]) => [p, sha256(html)]));
    writeFileSync(join(out, 'pages.json'), JSON.stringify({ build, pages: hashes }, null, 2) + '\n');
    console.log(`Wrote dist/worker/worker.js (${Object.keys(pages).length} pages, build ${build}). Do not commit dist/.`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
