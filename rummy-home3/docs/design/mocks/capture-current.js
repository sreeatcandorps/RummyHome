/* Captures the CURRENT app (not the mocks) in web mode for the "before" set.
 *
 *   cd rummy-home3 && npx expo start --web --port 8085      # terminal 1, no Supabase env => local prototype mode
 *   cd docs/design/mocks && npm i --no-save playwright-core  # once
 *   CHROME=/usr/bin/google-chrome OUT=../mockups/before node capture-current.js
 *
 * It intercepts document requests (Expo serves public/index.html at every route) and injects
 * a minimal shell that loads the Metro bundle, seeds AsyncStorage with demo players/games,
 * and screenshots each screen in light and dark at 390x844 @2x.
 */
const { chromium } = require('playwright-core');
const fs = require('fs');

const BASE = 'http://localhost:8085';
const OUT = process.env.OUT || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<style>#root{display:flex;height:100%}html,body{height:100%;margin:0}body{overflow:hidden}</style>
</head><body><div id="root"></div>
<script src="/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&transform.routerRoot=app" defer></script>
</body></html>`;

// Seed: local prototype mode (no Supabase). Keys match utils/storage.ts and services/players.ts.
const ME = 'me-sree';
const P = [
  { id: ME, name: 'Sree Koneru', role: 'player', email: 'sree@example.com', playerCode: '#7', playerNo: 7 },
  { id: 'p-anita', name: 'Anita Rao', role: 'player', playerCode: '#12', playerNo: 12 },
  { id: 'p-ravi', name: 'Ravi Kumar', role: 'player', playerCode: '#19', playerNo: 19 },
  { id: 'p-meera', name: 'Meera Nair', role: 'player', playerCode: '#23', playerNo: 23, status: 'unregistered', managedBy: ME },
  { id: 'p-vijay', name: 'Vijay Menon', role: 'player', playerCode: '#31', playerNo: 31, status: 'pending', managedBy: ME },
  { id: 'p-lakshmi', name: 'Lakshmi Iyer', role: 'player', playerCode: '#44', playerNo: 44 },
];
const seats = [ME, 'p-anita', 'p-ravi', 'p-meera', 'p-vijay'];
const settings = { expense: false, expenseAmount: 0, dropAmount: -10, mdAmount: -30, maxCount: -80 };
const live = {
  id: 'g-live', date: new Date(Date.now() - 90 * 60000).toISOString(), isComplete: false,
  players: seats, currentRound: 7, gameType: 'stake', settings, createdBy: ME, adminIds: [ME], unseatedAdminIds: [], spectators: [],
  gameNumber: 14, closedAt: null, shareCode: 'ABC123', viewToken: 'tok',
  scores: {
    [ME]: [40, -10, 25, -30, 60, -10],
    'p-anita': [-10, 55, -30, 20, -10, 35],
    'p-ravi': [-80, -10, -10, 45, -30, -10],
    'p-meera': [30, -30, 25, -10, -20, 15],
    'p-vijay': [20, -5, -10, -25, 0, -30],
  },
};
const done1 = { ...live, id: 'g-done1', gameNumber: 13, isComplete: true, completedAt: new Date(Date.now() - 86400000).toISOString(), date: new Date(Date.now() - 86400000 * 1).toISOString(), currentRound: 9 };
const done2 = { ...live, id: 'g-done2', gameNumber: 12, isComplete: true, closedAt: new Date(Date.now() - 86400000 * 6).toISOString(), date: new Date(Date.now() - 86400000 * 7).toISOString(), currentRound: 11, players: seats.slice(0, 4) };
const games = [live, done1, done2];
const roster = P.filter((p) => p.id !== ME).map((p, i) => ({ ownerId: ME, playerId: p.id, gamesTogether: 9 - i, createdAt: new Date().toISOString(), name: p.name, playerCode: p.playerCode }));

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

async function shot(page, name, { wait = 1800, full = false } = {}) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log('shot', name);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/google-chrome', args: ['--no-sandbox'] });
  for (const dark of [false, true]) {
    const mode = dark ? 'dark' : 'light';
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
    const page = await ctx.newPage();
    await page.route((url) => url.origin === BASE && !url.pathname.includes('.') && !url.pathname.startsWith('/assets') && !url.pathname.startsWith('/node_modules') && !url.pathname.startsWith('/_expo') && !url.pathname.startsWith('/symbolicate'), (route) => route.fulfill({ status: 200, contentType: 'text/html', body: HTML }));
    page.on('pageerror', (e) => console.log('pageerror', e.message));

    await page.goto(BASE + '/');
    await page.waitForTimeout(2500);
    // Login screen (signed out)
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE + '/login');
    await shot(page, `login-${mode}`, { wait: 3500 });

    await seed(page, dark);
    await page.goto(BASE + '/');
    await shot(page, `home-${mode}`, { wait: 4000 });

    await page.goto(BASE + '/games/g-live');
    await shot(page, `scorecard-${mode}`, { wait: 3500 });

    await page.goto(BASE + '/score-entry?gameId=g-live');
    await page.waitForTimeout(2500);
    // Interact: tap first two players and type a score to show states.
    try {
      await page.getByRole('button', { name: /Anita Rao/ }).first().click();
      await page.getByRole('button', { name: /Minus/ }).first().click();
      await page.getByRole('button', { name: '1', exact: true }).first().click();
      await page.getByRole('button', { name: '0', exact: true }).first().click();
      await page.getByRole('button', { name: 'Save score' }).first().click();
      await page.getByRole('button', { name: /Ravi Kumar/ }).first().click();
      await page.getByRole('button', { name: /Full count/ }).first().click();
      await page.getByRole('button', { name: /Sree Koneru/ }).first().click();
    } catch (e) { console.log('entry interact failed', e.message); }
    await shot(page, `add-round-${mode}`, { wait: 1500 });

    await page.goto(BASE + '/results');
    await shot(page, `results-picker-${mode}`, { wait: 3500 });

    await page.goto(BASE + '/results/view?ids=g-done1,g-done2&at=' + encodeURIComponent(new Date().toISOString()));
    await shot(page, `results-view-${mode}`, { wait: 4000, full: true });

    await page.goto(BASE + '/players');
    await shot(page, `players-${mode}`, { wait: 3500 });

    await page.goto(BASE + '/games/players?id=g-live');
    await shot(page, `game-players-${mode}`, { wait: 3500 });

    await page.goto(BASE + '/me');
    await shot(page, `profile-${mode}`, { wait: 3000 });

    await page.goto(BASE + '/games/new');
    await shot(page, `new-game-${mode}`, { wait: 3500 });

    await page.goto(BASE + '/games/complete?id=g-live');
    await shot(page, `complete-${mode}`, { wait: 3500 });

    await page.goto(BASE + '/settings');
    await shot(page, `settings-${mode}`, { wait: 3000 });

    await ctx.close();
  }
  await browser.close();
})();
