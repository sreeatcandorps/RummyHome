// Home as it is today (app/(tabs)/index.tsx, _layout.tsx, GameListItem, DeletedGamesCard, the request cards),
// drawn in three looks. The content is the same in all three: only colour, type and arrangement change.
(() => {
  const q = new URLSearchParams(location.search);
  const D = q.get('d') || 'a';
  const MODE = q.get('mode') || 'light';
  const STATE = q.get('state') || 'games';
  const W = Number(q.get('w') || 412);
  const H = Number(q.get('h') || 915);
  const FS = Number(q.get('fs') || 1);
  const TALL = q.get('tall') === '1';
  const dark = MODE === 'dark';

  const ic = (name, size, cls = '') => `<i class="mi ${cls}" aria-hidden="true" style="font-size:${size}px">${String.fromCodePoint(window.ICONS[name])}</i>`;

  // ---------- the table: Friday, Nov 27 2026, early evening ----------
  const ME = { first: 'Sree', initials: 'SK', players: STATE === 'empty' ? 0 : 18 };
  const LIVE = [
    { n: 'P2', type: 'Pool', day: 'Fri, Nov 27', time: '5:10 PM', status: 'Active', role: 'Creator', players: 6 },
    { n: 'S3', type: 'Points', day: 'Fri, Nov 27', time: '3:18 PM', status: 'Active', role: 'Admin', players: 5 },
  ];
  const RECENT = [
    { n: 'P1', type: 'Pool', day: 'Thu, Nov 26', time: '8:45 PM', status: 'Completed', awarded: true, role: 'Creator', players: 7 },
    { n: 'S2', type: 'Points', day: 'Sat, Nov 21', time: '7:30 PM', status: 'Closed', role: 'Creator', mult: '×2', players: 13 },
    { n: 'S1', type: 'Points', day: 'Sat, Nov 14', time: '6:05 PM', status: 'Closed', players: 4 },
  ];
  const REQUESTS = [
    { icon: 'link-variant', title: 'Harish Gadupudi wants to link “Sree (SK)” to your Player ID #1.', text: 'Yes moves Sree\'s seats and scores in 2 games (S7, P3) to your account. Expires Fri, Dec 4.', no: 'No', yes: 'Yes' },
    { icon: 'card-account-details-outline', title: '#57 wants to claim Priya Reddy. Approve?', text: 'Priya Reddy signed up and typed this player ID. Approve puts Priya Reddy’s scores on their account.', no: 'Decline', yes: 'Approve' },
  ];
  const NOTICE = { title: 'Player update', text: 'Lakshmi Rao (#52) said No to linking Lakshmi. Lakshmi is still unregistered.' };
  const DELETED = [{ title: 'Game S4 · 5 players', line: 'Deleted by Harish Gadupudi · today · hidden for good on Sun, Dec 27', action: 'Ask an admin to restore' }];

  // ---------- pieces ----------
  const STATUS = { Active: ['t-active', 'circle-medium'], Completed: ['t-done', 'flag-checkered'], Closed: ['t-closed', 'lock-outline'] };
  const ROLE = { Creator: ['t-creator', 'crown-outline'], Admin: ['t-admin', 'shield-account-outline'] };
  const tag = (cls, icon, label) => `<span class="tag ${cls}">${icon === 'circle-medium' ? '<b class="dot"></b>' : ic(icon, 15)}${label}</span>`;

  const card = (g, kind) => `
    <div class="card ${kind}">
      <div class="badge"><span>${g.n}</span></div>
      <div class="cbody">
        <div class="ctitle"><span>${g.day}</span><span class="sep"> · </span><span>${g.time}</span></div>
        <div class="cmeta">
          ${tag(...STATUS[g.status], g.status)}
          ${g.awarded ? tag('t-awarded', 'trophy-outline', 'Awarded') : ''}
          ${g.role ? tag(...ROLE[g.role], g.role) : ''}
          ${g.mult ? `<span class="mult">${g.mult}</span>` : ''}
          <span class="type">${g.type}</span>
          <span class="pc">${ic('account-multiple-outline', 16)}${g.players}</span>
        </div>
      </div>
      ${ic('chevron-right', 22, 'chev')}
    </div>`;

  const sechead = (title, count) => `
    <div class="sechead">
      <h2>${title}${count ? `<span class="mid"> · </span><span class="count">${count}</span>` : ''}</h2>
      <span class="rule"></span>
      <span class="info">${ic('information-outline', 19)}</span>
    </div>`;

  const fan = () => `
    <div class="art">
      <div class="halo"></div>
      <div class="pcard l"><em>7</em>${ic('cards-heart', 26)}</div>
      <div class="pcard r"><em>A</em>${ic('cards-spade', 26)}</div>
      <div class="pcard m"><img src="../../assets/joker-figure.png" alt=""></div>
    </div>`;

  const live = () => STATE === 'empty'
    ? `<section class="sec live">${sechead('Live')}
        <div class="empty">${fan()}<div class="etitle">No live game.</div><div class="etext">Tap New game to start one.</div></div>
      </section>`
    : `<section class="sec live">${sechead('Live', LIVE.length)}<div class="cards">${LIVE.map((g) => card(g, 'live')).join('')}</div></section>`;

  const recent = () => STATE === 'empty'
    ? `<section class="sec recent">${sechead('Recent')}<div class="quiet">No finished games yet.</div></section>`
    : `<section class="sec recent">${sechead('Recent')}<div class="cards">${RECENT.map((g) => card(g, 'recent')).join('')}</div>
        ${STATE === 'all' ? `<div class="more">${ic('chevron-down', 20)}Show more</div>` : ''}
      </section>`;

  const deleted = () => STATE !== 'all' ? '' : `
    <section class="sec deleted">${sechead('Deleted games', DELETED.length)}
      <div class="cards">${DELETED.map((g) => `
        <div class="dcard">
          <div class="drow"><div class="dtitle">${g.title}</div>${tag('t-deleted', 'delete-outline', 'Deleted')}</div>
          <div class="dline">${g.line}</div>
          <div class="dact"><span class="btn ghost">${ic('hand-wave-outline', 18)}${g.action}</span></div>
        </div>`).join('')}</div>
    </section>`;

  const banners = () => STATE !== 'all' ? '' : `
    <div class="banners">
      ${REQUESTS.map((r) => `
        <div class="banner">
          <div class="bhead">${ic(r.icon, 20, 'bicon')}<div class="btitle">${r.title}</div></div>
          <div class="btext">${r.text}</div>
          <div class="bact"><span class="btn ghost">${r.no}</span><span class="btn solid">${r.yes}</span></div>
        </div>`).join('')}
      <div class="banner notice">
        <div class="bhead">${ic('account-alert-outline', 20, 'bicon')}<div class="btitle">${NOTICE.title}</div></div>
        <div class="btext">${NOTICE.text}</div>
        <div class="bact"><span class="btn text">OK</span></div>
      </div>
    </div>`;

  const newGame = () => `<div class="newgame">${ic('plus', 22, 'plus')}<span>New game</span></div>`;
  const tiles = () => `
    <div class="tiles">
      <div class="tile"><div class="ttop">${ic('podium', 26, 'ticon')}</div><div class="tlabel">Results</div></div>
      <div class="tile"><div class="ttop">${ic('account-group', 26, 'ticon')}<span class="tcount">${ME.players}</span></div><div class="tlabel">My players</div></div>
    </div>`;
  const help = () => `<span class="help">${ic('help-circle-outline', 24)}</span>`;
  const greet = () => `<h1 class="greet"><span data-fg>Hi ${ME.first}</span></h1>`;

  // ---------- the three arrangements ----------
  const layouts = {
    // A: the felt band holds the name, the greeting and New game; Results and My players sit across its lower edge.
    a: () => `
      <section class="hero">
        <div class="brandrow"><span class="emblem"><img src="../../assets/icon.png" alt=""></span><span class="brand">EZ Score: Rummy</span>${help()}</div>
        ${greet()}
        ${newGame()}
      </section>
      ${tiles()}
      <div class="body">${banners()}${live()}${recent()}${deleted()}</div>`,
    // B: a film poster. The presenter line on top, the title in gold, the three actions on the stage.
    b: () => `
      <section class="hero">
        <div class="rays"></div><div class="frame"></div>
        <div class="brandrow"><span class="emblem mono"></span><span class="brand">EZ Score: Rummy</span></div>${help()}
        ${greet()}
        <div class="orn"><span></span>${ic('rhombus', 9)}${ic('rhombus', 12)}${ic('rhombus', 9)}<span></span></div>
        ${newGame()}
        ${tiles()}
      </section>
      <div class="body">${banners()}${live()}${recent()}${deleted()}</div>`,
    // C: paper, one colour of ink, one accent. The pattern appears twice and nowhere else.
    c: () => `
      <section class="hero">
        <div class="kolam"></div>
        <div class="brandrow"><span class="emblem mono"></span><span class="brand">EZ Score: Rummy</span>${help()}</div>
        ${greet()}
        <div class="tilak"></div>
        ${newGame()}
        ${tiles()}
        <div class="blockprint"></div>
      </section>
      <div class="body">${banners()}${live()}${recent()}${deleted()}</div>`,
  };

  const art = window.ART;
  const vars = {
    a: { '--jaali': art.jaali('rgba(240,221,166,0.075)') },
    b: {},
    c: dark
      ? { '--strip': art.blockPrint('#8F9AE8', '#F2A33A'), '--rangoli': art.rangoli('#AAB4FF', '#F2A33A'), '--rangoli-art': art.rangoli('#8F9AE8', '#F2A33A', 1.3) }
      : { '--strip': art.blockPrint('#1F2F6B', '#E8871E'), '--rangoli': art.rangoli('#1F2F6B', '#E8871E'), '--rangoli-art': art.rangoli('#1F2F6B', '#E8871E', 1.3) },
  }[D];

  document.getElementById('root').innerHTML = `
    <div class="phone d-${D} ${MODE} s-${STATE} ${TALL ? 'tall' : ''}">
      <div class="status"><span class="time">6:42</span><span class="sicons">${ic('wifi-strength-4', 16)}${ic('signal-cellular-3', 16)}${ic('battery-80', 16, 'batt')}</span></div>
      <div class="content">${layouts[D]()}</div>
      <nav class="tabbar">
        <div class="tab on">${ic('home-variant', 26)}</div>
        <div class="tab off"><span class="avatar">${ME.initials}</span></div>
        <span class="gesture"></span>
      </nav>
    </div>`;
  const phone = document.querySelector('.phone');
  phone.style.setProperty('--w', `${W}px`);
  phone.style.setProperty('--h', `${H}px`);
  phone.style.setProperty('--fs', String(FS));
  for (const [k, v] of Object.entries(vars)) phone.style.setProperty(k, v);

  // ---------- the checks make.mjs runs on every frame ----------
  const rgb = (css) => { const m = css.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  /**
   * The colour behind an element: the nearest ancestor with a solid background-color. Every gradient in the
   * style sheets also sets background-color to its worst stop for the text on it, so this is the hard case.
   */
  const behind = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a > 0.98) return c; } return { r: 255, g: 255, b: 255 }; };

  window.audit = () => {
    const contrast = []; const cut = []; let lowest = null;
    for (const el of phone.querySelectorAll('*')) {
      if (el.classList.contains('mi') || el.closest('.status')) continue;
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      if (!text) continue;
      const cs = getComputedStyle(el);
      // Gradient lettering declares its darkest stop in --fg-audit.
      const declared = cs.getPropertyValue('--fg-audit').trim();
      const fg = el.hasAttribute('data-fg') && declared ? rgb(declared) : rgb(cs.color);
      const bg = behind(el);
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      const ratio = Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
      const row = { ratio, fg: hex(fg), bg: hex(bg), text: text.slice(0, 28) };
      if (!lowest || ratio < lowest.ratio) lowest = row;
      if (ratio < 4.5) contrast.push(row);
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') cut.push(text.slice(0, 40));
      const box = el.getBoundingClientRect(); const frame = phone.getBoundingClientRect();
      if (box.right > frame.right + 0.5 || box.left < frame.left - 0.5) cut.push(`outside the screen: ${text.slice(0, 40)}`);
    }
    return { contrast, cut, lowest };
  };
})();
