// Renders EZ Score Home Round 2 theme mockups (identical D136 layout, real game cards & icons, strict >= 4.5:1 audit).
(() => {
  const q = new URLSearchParams(location.search);
  const D = q.get('d') || 'jaipur-sandstone';
  const MODE = q.get('mode') || 'light';
  const W = Number(q.get('w') || 412);
  const H = Number(q.get('h') || 915);
  const FS = Number(q.get('fs') || 1);
  const COMPACT = W <= 370 || FS >= 1.2;

  const ic = (name, size, cls = '') =>
    `<i class="mi ${cls}" aria-hidden="true" style="font-size:${size}px">${String.fromCodePoint(window.ICONS[name])}</i>`;

  const ME = { first: 'Sree', initials: 'SK', players: 18 };

  const LIVE = [
    {
      n: 'P2',
      type: 'Pool',
      day: 'Fri, Nov 27',
      time: '5:10 PM',
      status: 'Active',
      role: 'Creator',
      players: 6,
      lead: 'Rd 4',
      scores: ['Sree 35', 'Priya 48', 'Harish 62'],
    },
    {
      n: 'S3',
      type: 'Points',
      day: 'Fri, Nov 27',
      time: '3:18 PM',
      status: 'Active',
      role: 'Admin',
      players: 5,
      lead: 'Rd 6',
      scores: ['Harish +40', 'Sree −15', 'Vikram −25'],
    },
  ];

  const RECENT = [
    {
      n: 'P1',
      type: 'Pool',
      day: 'Thu, Nov 26',
      time: '8:45 PM',
      status: 'Completed',
      awarded: true,
      role: 'Creator',
      players: 7,
      lead: 'Priya won',
      scores: ['101 Pool', '5 rounds'],
    },
    {
      n: 'S2',
      type: 'Points',
      day: 'Sat, Nov 21',
      time: '7:30 PM',
      status: 'Closed',
      role: 'Creator',
      mult: '×2',
      players: 13,
      lead: 'Sree +240',
      scores: ['Vikram +80', '8 rounds'],
    },
  ];

  const STATUS = {
    Active: ['t-active', 'circle-medium'],
    Completed: ['t-done', 'flag-checkered'],
    Closed: ['t-closed', 'lock-outline'],
  };
  const ROLE = {
    Creator: ['t-creator', 'crown-outline'],
    Admin: ['t-admin', 'shield-account-outline'],
  };

  const tag = (cls, icon, label) =>
    `<span class="tag ${cls}">${icon === 'circle-medium' ? '<b class="dot"></b>' : ic(icon, 13)}${label}</span>`;

  const card = (g, kind) => `
    <div class="card ${kind}">
      <div class="badge"><span>${g.n}</span></div>
      <div class="cbody">
        <div class="ctop">
          <div class="ctitle"><span>${g.day}</span><span class="sep">·</span><span>${g.time}</span></div>
          <div class="cright-meta">
            <span>${g.type}</span>
            <span class="pc">${ic('account-multiple-outline', 14)}<span>${g.players}</span></span>
          </div>
        </div>
        <div class="cmeta">
          ${tag(...STATUS[g.status], g.status)}
          ${g.awarded ? tag('t-awarded', 'trophy-outline', 'Awarded') : ''}
          ${g.role ? tag(...ROLE[g.role], g.role) : ''}
          ${g.mult ? `<span class="mult">${g.mult}</span>` : ''}
        </div>
        <div class="cscores">
          <span class="rd">${g.lead}</span>${g.scores.map((s) => `<span class="ssep">·</span><span>${s}</span>`).join('')}
        </div>
      </div>
      ${ic('chevron-right', 20, 'chev')}
    </div>`;

  const sechead = (title, count) => `
    <div class="sechead">
      <h2><span>${title}</span>${count ? `<span class="mid">·</span><span class="count">${count}</span>` : ''}</h2>
      <span class="rule-wrap"><span class="rule-gem"></span><span class="rule"></span></span>
      <span class="info">${ic('information-outline', 18)}</span>
    </div>`;

  const html = `
    <div class="phone d-${D} ${MODE} ${COMPACT ? 'compact' : ''}">
      <div class="status">
        <span class="time">6:42</span>
        <span class="sicons">${ic('wifi-strength-4', 15)}${ic('signal-cellular-3', 15)}${ic('battery-80', 15, 'batt')}</span>
      </div>
      <div class="content">
        <section class="hero">
          <div class="hero-backdrop"></div>
          <div class="brandrow">
            <div class="brandleft">
              <span class="emblem"><span class="emblem-inner"><img src="../../../../assets/icon.png" alt=""></span></span>
              <span class="brand">EZ Score: Rummy</span>
            </div>
            <span class="help">${ic('help-circle-outline', 21)}</span>
          </div>
          <div class="greet-wrap">
            <h1 class="greet">Hi ${ME.first}</h1>
            <div class="greet-orn" aria-hidden="true">
              <span class="line-l"></span><span class="gem"></span><span class="line-r"></span>
            </div>
          </div>
          <div class="newgame">
            <span class="plus-ring">${ic('plus', 17)}</span>
            <span>New game</span>
          </div>
        </section>

        <section class="tiles">
          <div class="tile">
            <div class="ttop">
              <span class="ticon-wrap">${ic('podium', 20)}</span>
            </div>
            <div class="tbottom">
              <span class="tlabel">Results</span>
              ${ic('chevron-right', 17, 'tchev')}
            </div>
          </div>
          <div class="tile">
            <div class="ttop">
              <span class="ticon-wrap">${ic('account-group', 20)}</span>
              <span class="tcount">${ME.players}</span>
            </div>
            <div class="tbottom">
              <span class="tlabel">My players</span>
              ${ic('chevron-right', 17, 'tchev')}
            </div>
          </div>
        </section>

        <div class="body">
          <section class="sec live">
            ${sechead('Live', LIVE.length)}
            <div class="cards">${LIVE.map((g) => card(g, 'live')).join('')}</div>
          </section>
          <section class="sec recent">
            ${sechead('Recent')}
            <div class="cards">${RECENT.map((g) => card(g, 'recent')).join('')}</div>
          </section>
        </div>
        <div class="scroll-fade" aria-hidden="true"></div>
      </div>

      <nav class="tabbar">
        <div class="tab on">${ic('home-variant', 24)}</div>
        <div class="tab off"><span class="avatar">${ME.initials}</span></div>
        <span class="gesture"></span>
      </nav>
    </div>`;

  document.getElementById('root').innerHTML = html;
  const phone = document.querySelector('.phone');
  phone.style.setProperty('--w', `${W}px`);
  phone.style.setProperty('--h', `${H}px`);
  phone.style.setProperty('--fs', String(FS));

  // ---------- Strict contrast (>= 4.5:1) & overflow audit ----------
  const parseColor = (css) => {
    if (!css) return null;
    css = css.trim();
    if (css.startsWith('#')) {
      const h = css.slice(1);
      const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
        a: 1,
      };
    }
    const m = css.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };

  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const hex = ({ r, g, b }) =>
    `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

  const behind = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const declared = cs.getPropertyValue('--bg-audit').trim();
      if (declared) {
        const c = parseColor(declared);
        if (c) return c;
      }
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0.96) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  window.audit = () => {
    const contrast = [];
    const cut = [];
    let lowest = null;
    const frame = phone.getBoundingClientRect();

    for (const el of phone.querySelectorAll('*')) {
      if (el.classList.contains('mi') || el.closest('.status')) continue;
      const text = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .trim();
      if (!text) continue;

      const cs = getComputedStyle(el);
      const fg = parseColor(cs.color);
      const bg = behind(el);
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
      const row = { ratio, fg: hex(fg), bg: hex(bg), text: text.slice(0, 32) };
      if (!lowest || ratio < lowest.ratio) lowest = row;
      if (ratio < 4.5) contrast.push(row);

      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') {
        cut.push(`truncated: "${text.slice(0, 36)}"`);
      }
      const box = el.getBoundingClientRect();
      if (box.right > frame.right + 0.5 || box.left < frame.left - 0.5) {
        cut.push(`horizontal overflow: "${text.slice(0, 36)}"`);
      }
    }

    return { contrast, cut, lowest };
  };
})();
