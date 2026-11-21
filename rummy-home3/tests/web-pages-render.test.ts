import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/**
 * The shared web scorecard really renders. The Nov 21 volume screenshots found public/scorecard.html
 * reading `multiplier` eight lines above its `const` — a TDZ ReferenceError that load().catch turned
 * into "Could not load the scorecard." on every shared link. Static greps cannot see that; running the
 * page's script against a stub DOM can.
 */

type El = { textContent: string; innerHTML: string; className: string; style: Record<string, string>; setAttribute: () => void; appendChild: () => void; classList: { add: () => void; remove: () => void; toggle: () => void } };
const el = (): El => ({ textContent: '', innerHTML: '', className: '', style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } });

function pageSandbox(html: string, search: string) {
  const elements = new Map<string, El>();
  const document = {
    getElementById: (id: string) => { if (!elements.has(id)) elements.set(id, el()); return elements.get(id)!; },
    querySelector: () => el(),
    querySelectorAll: () => [],
    createElement: () => el(),
    title: '',
    body: el(),
  };
  const sandbox: Record<string, unknown> = {
    document,
    location: { search, pathname: '/scorecard.html', href: `http://127.0.0.1/scorecard.html${search}`, hostname: '127.0.0.1' },
    window: {},
    navigator: { language: 'en-US' },
    URLSearchParams,
    URL,
    Map, Set, Number, String, Math, Date, JSON, Array, Object, RegExp, Intl, Promise,
    setInterval: () => 0,
    setTimeout: () => 0,
    fetch: () => Promise.reject(new Error('no network in the test')),
    console,
  };
  (sandbox as { window: unknown }).window = sandbox;
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0, 'the page has an inline script');
  const context = vm.createContext(sandbox);
  for (const s of scripts) vm.runInContext(s, context, { filename: 'page.js' });
  return { context, elements, text: (id: string) => elements.get(id)?.textContent ?? '', html: (id: string) => elements.get(id)?.innerHTML ?? '' };
}

const page = readFileSync(path.join(process.cwd(), 'public/scorecard.html'), 'utf8');
const token = 'a'.repeat(48);

/** A public_scorecard payload shaped like the real RPC's (ci/out/volume/payloads/*.json). */
function card(seats: number, rounds: number, extra: Record<string, unknown> = {}) {
  const players = Array.from({ length: seats }, (_, i) => ({ profileId: `p${i}`, name: `Player ${i + 1}`, label: `P${i + 1}`, order: i, entries: 1, outRound: null, reentryScore: null, reenteredRound: null }));
  const scores: unknown[] = [];
  const dealers: Record<string, string> = {};
  for (let r = 1; r <= rounds; r += 1) {
    dealers[String(r)] = players[(r - 1) % seats].profileId;
    const win = (r * 7) % seats;
    players.forEach((p, i) => scores.push({ profileId: p.profileId, name: p.name, round: r, type: i === win ? 'rummy' : 'count', value: i === win ? 10 * (seats - 1) : -10 }));
  }
  return { gameId: 'g1', gameLabel: 'S7', gameType: 'stake', status: 'active', awarded: false, maxCount: -80, dropAmount: -10, poolLimit: null, multiplier: 1, currentRound: rounds + 1, startedAt: '2026-11-21T01:00:00+00:00', players, scores, dealers, ...extra };
}

test('web scorecard: a Points card renders (no "Could not load the scorecard")', () => {
  const p = pageSandbox(page, `?t=${token}`);
  const render = (p.context as unknown as { render: (c: unknown) => void }).render;
  render(card(4, 12));
  assert.doesNotMatch(p.text('meta'), /Could not load|not valid/);
  assert.match(p.text('meta'), /Game S7/);
  assert.match(p.text('meta'), /Live/);
  assert.match(p.html('board'), /Player 1/);
  assert.match(p.html('board'), /12 rounds/);
});

test('web scorecard: a ×1,000 Points card shows the multiplier in the header and exact points', () => {
  const p = pageSandbox(page, `?t=${token}`);
  (p.context as unknown as { render: (c: unknown) => void }).render(card(3, 5, { multiplier: 1000 }));
  assert.match(p.text('meta'), /×1,000/);
  assert.match(p.html('board'), /Exact points/);
});

test('web scorecard: a completed, awarded Pool card renders with its limit', () => {
  const p = pageSandbox(page, `?t=${token}`);
  const pool = card(6, 8, { gameType: 'pool', poolLimit: 201, status: 'completed', awarded: true });
  for (const s of pool.scores as { type: string; value: number }[]) s.value = s.type === 'rummy' ? 0 : Math.abs(s.value);
  (p.context as unknown as { render: (c: unknown) => void }).render(pool);
  assert.match(p.text('meta'), /Pool · limit 201/);
  assert.match(p.text('meta'), /Completed · Awarded/);
  assert.doesNotMatch(p.text('meta'), /Could not load/);
});

test('web scorecard: the 20 × 500 volume card renders', () => {
  const p = pageSandbox(page, `?t=${token}`);
  (p.context as unknown as { render: (c: unknown) => void }).render(card(20, 500));
  assert.match(p.html('board'), /500 rounds/);
});
