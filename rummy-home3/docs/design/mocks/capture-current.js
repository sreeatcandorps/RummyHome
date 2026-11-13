/* Captures the CURRENT app (not the mocks) in web mode: every screen, light and dark.
 *
 *   cd rummy-home3 && CI=1 npx expo start --web --port 8085   # terminal 1, no Supabase env => local prototype mode
 *   cd docs/design/mocks && npm i --no-save playwright-core    # once
 *   CHROME=/usr/bin/google-chrome OUT=../mockups/current node capture-current.js
 *
 * It intercepts document requests (Expo serves public/index.html at every route) and injects
 * a minimal shell that loads the Metro bundle, seeds AsyncStorage with demo players/games,
 * drives the UI with Playwright, and screenshots at 390x844 @2x. The Metro bundle is patched
 * in flight at one spot so the "Round already saved" (stale scorecard) dialog can be shown
 * without a second phone.
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8085';
const OUT = process.env.OUT || path.join(__dirname, '..', 'mockups', 'current');
const BUNDLE = '/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app';
fs.mkdirSync(OUT, { recursive: true });

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<style>#root{display:flex;height:100%}html,body{height:100%;margin:0}body{overflow:hidden}</style>
</head><body><div id="root"></div><script src="${BUNDLE}" defer></script></body></html>`;

// ---------- seed data (keys match utils/storage.ts and services/players.ts) ----------
const ME = 'me-sree';
const P = [
  { id: ME, name: 'Sree Koneru', role: 'player', email: 'sree@example.com', playerCode: '#7', playerNo: 7 },
  { id: 'p-anita', name: 'Anita Rao', role: 'player', playerCode: '#12', playerNo: 12 },
  { id: 'p-ravi', name: 'Ravi Kumar', role: 'player', playerCode: '#19', playerNo: 19 },
  { id: 'p-meera', name: 'Meera Nair', role: 'player', playerCode: '#23', playerNo: 23, status: 'unregistered', managedBy: ME },
  { id: 'p-vijay', name: 'Vijay Menon', role: 'player', playerCode: '#31', playerNo: 31, status: 'pending', managedBy: ME },
  { id: 'p-lakshmi', name: 'Lakshmi Iyer', role: 'player', playerCode: '#44', playerNo: 44 },
  { id: 'p-suresh', name: 'Suresh Kumar', role: 'player', playerCode: '#52', playerNo: 52 },
  { id: 'p-priya', name: 'Priya Sharma', role: 'player', playerCode: '#58', playerNo: 58 },
  { id: 'p-arjun', name: 'Arjun Reddy', role: 'player', playerCode: '#61', playerNo: 61 },
  { id: 'p-kavita', name: 'Kavita Pillai', role: 'player', playerCode: '#66', playerNo: 66, status: 'unregistered', managedBy: ME },
];
const seats = [ME, 'p-anita', 'p-ravi', 'p-meera', 'p-vijay'];
const bigSeats = [ME, 'p-anita', 'p-ravi', 'p-meera', 'p-vijay', 'p-lakshmi', 'p-suresh', 'p-priya', 'p-arjun'];
const settings = { expense: false, expenseAmount: 0, dropAmount: -10, mdAmount: -30, maxCount: -80 };
const day = 86400000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

const live = {
  id: 'g-live', date: ago(90 * 60000), isComplete: false,
  players: seats, currentRound: 7, gameType: 'stake', settings, createdBy: ME, adminIds: [ME, 'p-anita'], unseatedAdminIds: [], spectators: [],
  gameNumber: 14, closedAt: null, shareCode: 'ABC123', viewToken: 'tok',
  scores: {
    [ME]: [40, -10, 25, -30, 60, -10],
    'p-anita': [-10, 55, -30, 20, -10, 35],
    'p-ravi': [-80, -10, -10, 45, -30, -10],
    'p-meera': [30, -30, 25, -10, -20, 15],
    'p-vijay': [20, -5, -10, -25, 0, -30],
  },
};
// 9 players, 16 rounds: the "many columns, many rows" scorecard.
let seedN = 11;
const rnd = () => { seedN = (seedN * 9301 + 49297) % 233280; return seedN / 233280; };
const bigScores = {};
const ROUNDS = 16;
for (let r = 0; r < ROUNDS; r++) {
  const winner = Math.floor(rnd() * bigSeats.length);
  let pot = 0;
  bigSeats.forEach((id, i) => {
    if (!bigScores[id]) bigScores[id] = [];
    if (i === winner) return;
    const pick = rnd();
    const v = pick < 0.3 ? -10 : pick < 0.5 ? -30 : pick < 0.6 ? -80 : -(Math.floor(rnd() * 7) + 1) * 5;
    bigScores[id][r] = v; pot += -v;
  });
  bigScores[bigSeats[winner]][r] = pot;
}
const big = {
  id: 'g-big', date: ago(3 * 3600000), isComplete: false,
  players: bigSeats, currentRound: ROUNDS + 1, gameType: 'pool', settings, createdBy: 'p-anita', adminIds: ['p-anita', ME], unseatedAdminIds: [], spectators: [],
  gameNumber: 15, closedAt: null, shareCode: 'BIG999', viewToken: 'tok2', scores: bigScores,
};
const fresh = {
  id: 'g-fresh', date: ago(5 * 60000), isComplete: false,
  players: seats.slice(0, 4), currentRound: 3, gameType: 'stake', settings, createdBy: ME, adminIds: [ME], unseatedAdminIds: [], spectators: [],
  gameNumber: 16, closedAt: null, shareCode: 'NEW111', viewToken: 'tok3',
  scores: { [ME]: [20, -10], 'p-anita': [-10, 30], 'p-ravi': [-10, -10], 'p-meera': [0, -10] },
};
const done1 = { ...live, id: 'g-done1', gameNumber: 13, isComplete: true, completedAt: ago(day), date: ago(day), currentRound: 7 };
const done2 = { ...live, id: 'g-done2', gameNumber: 12, isComplete: true, closedAt: ago(6 * day), date: ago(7 * day), currentRound: 7, players: seats.slice(0, 4) };
const games = [fresh, big, live, done1, done2];
const roster = P.filter((p) => p.id !== ME).map((p, i) => ({ ownerId: ME, playerId: p.id, gamesTogether: 12 - i, createdAt: new Date().toISOString(), name: p.name, playerCode: p.playerCode }));

async function seed(page, dark) {
  await page.evaluate(({ P, games, roster, ME, dark }) => {
    localStorage.clear();
    localStorage.setItem('players', JSON.stringify(P));
    localStorage.setItem('games', JSON.stringify(games));
    localStorage.setItem('currentPlayer', ME);
    localStorage.setItem('myPlayersRoster', JSON.stringify(roster));
    localStorage.setItem('rummy_settings', JSON.stringify({ darkMode: dark }));
  }, { P, games, roster, ME, dark });
}

// ---------- helpers ----------
const CONFLICT_PATCH = {
  find: 'await _utilsStorage.storage.updateGame(updatedGame);\n        return updatedGame;',
  replace: "if (window.__forceConflict) { window.__forceConflict = false; throw { code: 'PT409', message: 'Round 7 was just saved by Anita Rao with different scores. The scorecard has been refreshed; check it before you save again.' }; }\n        await _utilsStorage.storage.updateGame(updatedGame);\n        return updatedGame;",
};

async function shot(page, name, { wait = 1800, full = false } = {}) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log('shot', name);
}
const go = async (page, route, wait = 3000) => { await page.goto(BASE + route); await page.waitForTimeout(wait); };
const click = async (page, name, { exact = false, nth = 0, wait = 600 } = {}) => {
  await page.getByRole('button', { name, exact }).nth(nth).click({ force: true, timeout: 8000 });
  await page.waitForTimeout(wait);
};
const tap = async (page, text, wait = 700) => {
  await page.getByText(text, { exact: true }).last().click({ force: true, timeout: 8000 });
  await page.waitForTimeout(wait);
};
const tryStep = async (label, fn) => { try { await fn(); } catch (e) { console.log(`skip ${label}:`, e.message.split('\n')[0]); } };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/google-chrome', args: ['--no-sandbox'] });
  let patchedBundle = null;

  for (const dark of [false, true]) {
    const m = dark ? 'dark' : 'light';
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: m });
    const page = await ctx.newPage();
    await page.route((url) => url.origin === BASE && !url.pathname.includes('.') && !url.pathname.startsWith('/assets') && !url.pathname.startsWith('/node_modules') && !url.pathname.startsWith('/_expo') && !url.pathname.startsWith('/symbolicate'),
      (route) => route.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
    await page.route((url) => url.pathname === '/node_modules/expo-router/entry.bundle', async (route) => {
      if (!patchedBundle) {
        const res = await route.fetch();
        const body = await res.text();
        if (!body.includes(CONFLICT_PATCH.find)) console.log('WARN: conflict patch point not found; stale-scorecard dialog will be skipped');
        patchedBundle = body.replace(CONFLICT_PATCH.find, CONFLICT_PATCH.replace);
      }
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: patchedBundle });
    });
    page.on('pageerror', (e) => console.log('pageerror', e.message.split('\n')[0]));

    await page.goto(BASE + '/');
    await page.waitForTimeout(2500);

    // 01 Auth
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('rummy_settings', JSON.stringify({ darkMode: false })); });
    await page.evaluate((dark) => localStorage.setItem('rummy_settings', JSON.stringify({ darkMode: dark })), dark);
    await go(page, '/login', 3500);
    await shot(page, `01-sign-in-${m}`);
    await go(page, '/register', 3000);
    await shot(page, `01-sign-up-${m}`);

    await seed(page, dark);

    // 02 Home
    await go(page, '/', 4000);
    await shot(page, `02-home-${m}`);
    await shot(page, `02-home-full-${m}`, { full: true, wait: 200 });
    await tryStep('help', async () => { await click(page, 'Help'); await shot(page, `02-home-help-${m}`, { wait: 800 }); });

    // 03 New game + pickers
    await go(page, '/games/new', 3500);
    await shot(page, `03-new-game-${m}`);
    await tryStep('pick seats', async () => {
      for (const n of ['Anita Rao', 'Ravi Kumar', 'Meera Nair']) await page.getByText(n, { exact: false }).first().click({ force: true, timeout: 8000 });
      await page.waitForTimeout(500);
      await shot(page, `03-new-game-selected-${m}`, { wait: 400 });
    });
    await go(page, '/players/add?from=new-game', 3500);
    await shot(page, `03-player-picker-my-players-${m}`);
    await go(page, '/players/new?from=new-game', 3500);
    await shot(page, `03-player-picker-database-${m}`);

    // 04 Scorecards
    await go(page, '/games/g-fresh', 3500);
    await shot(page, `04-scorecard-4p-2-rounds-${m}`);
    await go(page, '/games/g-live', 3500);
    await shot(page, `04-scorecard-5p-6-rounds-${m}`);
    await tryStep('scorecard menu', async () => { await click(page, 'Scorecard menu'); await shot(page, `04-scorecard-menu-${m}`, { wait: 800 }); await page.keyboard.press('Escape'); });
    await tryStep('edit round picker', async () => {
      await click(page, 'Scorecard menu');
      await tap(page, 'Edit round');
      await shot(page, `04-scorecard-edit-round-picker-${m}`, { wait: 900 });
      await page.keyboard.press('Escape');
    });
    await go(page, '/games/g-big', 4000);
    await shot(page, `04-scorecard-9p-16-rounds-${m}`);
    await tryStep('scroll right', async () => {
      await page.mouse.move(300, 400); await page.mouse.wheel(600, 0);
      await shot(page, `04-scorecard-9p-scrolled-${m}`, { wait: 900 });
    });

    // 05 Add round / Edit round
    await go(page, '/score-entry?gameId=g-live', 3000);
    await shot(page, `05-add-round-empty-${m}`, { wait: 500 });
    await tryStep('entry', async () => {
      await click(page, /Anita Rao/); await click(page, /Minus/); await click(page, '1', { exact: true }); await click(page, '0', { exact: true });
      await click(page, 'Save score'); await click(page, /Ravi Kumar/); await click(page, /Full count/); await click(page, /Sree Koneru/);
    });
    await shot(page, `05-add-round-in-progress-${m}`, { wait: 800 });
    await tryStep('balanced + stale', async () => {
      await click(page, /Plus/); await click(page, '9', { exact: true }); await click(page, '0', { exact: true }); await click(page, 'Save score');
      await click(page, /Meera Nair/); await click(page, '0', { exact: true }); await click(page, 'Save score');
      await click(page, /Vijay Menon/); await click(page, '0', { exact: true }); await click(page, 'Save score');
      await shot(page, `05-add-round-balanced-${m}`, { wait: 600 });
      await page.evaluate(() => { window.__forceConflict = true; });
      await click(page, 'Save round', { wait: 1200 });
      await shot(page, `09-dialog-stale-scorecard-${m}`, { wait: 600 });
      await page.keyboard.press('Escape');
    });
    await go(page, '/score-entry?gameId=g-live&round=3', 3000);
    await shot(page, `05-edit-round-${m}`, { wait: 500 });

    // 06 Players / Admins
    await go(page, '/games/players?id=g-live', 3500);
    await shot(page, `06-game-players-admins-${m}`);
    await tryStep('seat menu', async () => { await click(page, 'Options for Ravi Kumar'); await shot(page, `06-game-players-row-menu-${m}`, { wait: 800 }); });
    await tryStep('remove blocked', async () => {
      await tap(page, 'Remove player');
      await shot(page, `09-dialog-remove-blocked-${m}`, { wait: 900 });
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    });
    await tryStep('remove confirm', async () => {
      await go(page, '/games/players?id=g-big', 3500);
      await click(page, 'Options for Arjun Reddy');
      await tap(page, 'Remove player');
      await shot(page, `09-dialog-remove-confirm-${m}`, { wait: 900 });
      await page.keyboard.press('Escape');
    });

    // 07 Results
    await go(page, '/results', 3500);
    await shot(page, `07-results-pick-games-${m}`);
    await tryStep('pick two', async () => {
      await page.getByLabel('Closed games').last().click({ force: true, timeout: 8000 }); await page.waitForTimeout(800);
      await page.getByLabel(/G12/).last().click({ force: true, timeout: 8000 }); await page.waitForTimeout(600);
      await shot(page, `07-results-pick-games-selected-${m}`, { wait: 700 });
    });
    await go(page, '/results/view?ids=g-done1,g-done2&at=' + encodeURIComponent(new Date().toISOString()), 4000);
    await shot(page, `07-results-view-${m}`);
    await shot(page, `07-results-view-full-${m}`, { full: true, wait: 200 });
    await tryStep('save + saved view + share', async () => {
      await page.getByTestId('results-save-button').click({ force: true, timeout: 8000 });
      await shot(page, `09-dialog-result-saved-${m}`, { wait: 2500 });
      await tap(page, 'OK', 3500);
      await shot(page, `07-results-saved-${m}`, { wait: 800 });
      await shot(page, `07-results-saved-full-${m}`, { full: true, wait: 200 });
      await page.getByTestId('results-share-icon').click({ force: true, timeout: 8000 });
      await shot(page, `08-share-results-dialog-${m}`, { wait: 2500 });
      await page.keyboard.press('Escape');
    });

    // 08 Share image (final scores)
    await go(page, '/games/final-scores?id=g-done1', 4000);
    await shot(page, `08-share-final-scores-${m}`);

    // 10 My players + detail
    await go(page, '/players', 3500);
    await shot(page, `10-my-players-${m}`);
    await shot(page, `10-my-players-full-${m}`, { full: true, wait: 200 });
    await tryStep('player detail', async () => {
      await click(page, /Vijay Menon/);
      await shot(page, `10-my-players-detail-${m}`, { wait: 900 });
      await page.keyboard.press('Escape');
    });
    await tryStep('register dialog', async () => {
      await click(page, /Register unregistered/);
      await shot(page, `10-my-players-register-${m}`, { wait: 900 });
      await page.keyboard.press('Escape');
    });

    // 11 Profile, settings, complete, game settings
    await go(page, '/me', 3000);
    await shot(page, `11-profile-${m}`);
    await shot(page, `11-profile-full-${m}`, { full: true, wait: 200 });
    await go(page, '/settings', 3000);
    await shot(page, `11-settings-${m}`);
    await go(page, '/games/complete?id=g-live', 3500);
    await shot(page, `11-complete-game-${m}`);
    await tryStep('game settings', async () => {
      await go(page, '/games/g-live', 3000);
      await click(page, 'Scorecard menu');
      await tap(page, 'Game settings');
      await shot(page, `11-game-settings-${m}`, { wait: 900 });
    });

    await ctx.close();
  }
  await browser.close();
})();
