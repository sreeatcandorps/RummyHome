import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The share site Worker built from public/ (scripts/build-site-worker.mjs). The live site served the
 * Nov 12 hand upload until Nov 23, so shared pool links had no Standings although public/ did; this test
 * runs the generated module the way Cloudflare does and checks each path serves today's page.
 */

type Builder = {
  SITE_PAGES: { path: string; file: string; keyed?: boolean }[];
  buildSitePages: (dir: string, cfg: { url: string; key: string }) => Record<string, string>;
  renderWorker: (pages: Record<string, string>, build: string) => string;
};
type Worker = { default: { fetch: (req: Request) => Promise<Response> } };

const publicDir = path.join(process.cwd(), 'public');
const cfg = { url: 'https://example-project.supabase.co', key: 'k'.repeat(40) };

async function load() {
  const builder = (await import(pathToFileURL(path.join(process.cwd(), 'scripts/build-site-worker.mjs')).href)) as Builder;
  const pages = builder.buildSitePages(publicDir, cfg);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'site-')), 'worker.mjs');
  writeFileSync(file, builder.renderWorker(pages, 'abc1234'));
  const worker = (await import(pathToFileURL(file).href)) as Worker;
  const get = (p: string) => worker.default.fetch(new Request(`https://ezscore.mindweavetech.com${p}`));
  return { builder, pages, get };
}

test('every public page is served, filled in, with the build header', async () => {
  const { builder, pages, get } = await load();
  for (const { path: p, keyed } of builder.SITE_PAGES) {
    const res = await get(p);
    assert.equal(res.status, 200, p);
    assert.equal(res.headers.get('x-ezscore-build'), 'abc1234', p);
    const body = await res.text();
    assert.equal(body, pages[p], p);
    assert.ok(!body.includes('__SUPABASE_'), `${p} has no placeholder left`);
    if (keyed) assert.ok(body.includes(cfg.url), `${p} carries the project URL`);
  }
});

test('the scorecard served is the repo page, Standings included', async () => {
  const { get } = await load();
  const body = await (await get('/scorecard.html')).text();
  assert.match(body, /Standings/);
});

test('pretty paths and result links route like the Nov 12 module', async () => {
  const { pages, get } = await load();
  const same = async (p: string, key: string) => assert.equal(await (await get(p)).text(), pages[key], p);
  await same('/scorecard', '/scorecard.html');
  await same('/unsubscribe', '/unsubscribe.html');
  await same('/link', '/link.html');
  await same('/get/', '/get');
  await same('/privacy/index.html', '/privacy');
  await same('/r/0b9f3c1e-6d2a-4e8b-9c1d-2f3a4b5c6d7e', '/r');
  await same('/r/?id=0b9f3c1e-6d2a-4e8b-9c1d-2f3a4b5c6d7e', '/r');
  const home = await get('/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Get the app/);
  const missing = await get('/nope');
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), pages['/404.html']);
});

test('a missing key or URL stops the build', async () => {
  const { builder } = await load();
  assert.throws(() => builder.buildSitePages(publicDir, { url: '', key: cfg.key }), /SUPABASE_URL/);
  assert.throws(() => builder.buildSitePages(publicDir, { url: cfg.url, key: '__SUPABASE_ANON_KEY__' }), /ANON_KEY/);
});
