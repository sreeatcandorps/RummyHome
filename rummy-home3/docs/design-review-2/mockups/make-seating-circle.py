#!/usr/bin/env python3
"""Order of players as a circle (Sree, Nov 27 2026): "The number 1 seating shown as a circle or oval … just show
initials … As you tap them, they get numbers, and they move to the right position automatically … flash his name,
his player ID … in the middle of the circle, and his player number."

Draws, in Palette B (D65) and the Size-S look (no cards, D66), with the D56 count-down (first tap = highest card =
the highest seat; the last tap is seat 1 and deals) and D113 Player IDs (#NN):
  seating-circle-today-vs-proposed.png  today's CI frame (Pixel 6) · proposed, everyone numbered · fixing a wrong tap
  seating-circle-taps.png               the tapping sequence, four phones
  seating-circle-small-13-20.png        360 dp × text 1.3: today's CI frame · 13 players · 20 players (WWW / MMM)
  seating-circle-dark.png               dark (D71): the main screen · the mid-game Pool page with one out
Needs headless Chrome (/usr/local/bin/google-chrome) and Pillow (to trim the page). The 'today' frames are the
CI's own, kept beside this script in ci-frames/ (run 46035664063, smoke 24g and 19d)."""
import base64, math, os, shutil, subprocess, tempfile, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(HERE, 'ci-frames')
CHROME = '/usr/local/bin/google-chrome'

SEATS = ['#0F766E', '#C2410C', '#1D4ED8', '#A21CAF', '#6D28D9', '#0E7490', '#92400E', '#BE123C', '#3F6212', '#475569']
seat_color = lambda i: SEATS[i % len(SEATS)]

LIGHT = dict(bg='#F5F2E8', onbg='#1A1F1B', surface='#FFFFFF', onsurf='#1A1F1B', sv='#ECE7DA', onsv='#5A615B', outline='#8E928A',
             hair='#E6E1D3', primary='#0E4D2A', onprimary='#FFFFFF', primaryc='#D8ECDD', onprimaryc='#0B3B1F', secc='#F0DFAE',
             onsecc='#3E2E07', felt='#E4EDE3', feltedge='#B9CDBB', disabled='rgba(23,32,27,.12)', ondisabled='rgba(23,32,27,.38)',
             reentry='#2B5FBF', onreentry='#FFFFFF', shadow='rgba(0,0,0,.18)')
DARK = dict(bg='#0C120E', onbg='#ECEBE4', surface='#141B16', onsurf='#ECEBE4', sv='#1B231D', onsv='#B6BDB4', outline='#848C84',
            hair='#2A322C', primary='#7FD39F', onprimary='#063019', primaryc='#1A3F29', onprimaryc='#CDEFD8', secc='#4A3A10',
            onsecc='#F5E3B0', felt='#12241A', feltedge='#2C4A36', disabled='rgba(234,237,233,.12)', ondisabled='rgba(234,237,233,.38)',
            reentry='#9DBCFF', onreentry='#0F2B63', shadow='rgba(0,0,0,.5)')

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#ece9df;padding:18px;font-family:Roboto,'Noto Sans','DejaVu Sans',sans-serif;color:#1d1d1b;-webkit-font-smoothing:antialiased}
h1{font-size:19px;margin-bottom:4px}
.sub{font-size:13px;color:#555;margin-bottom:14px;max-width:1300px;line-height:1.4}
.grid{display:flex;gap:22px;align-items:flex-start}
.cap{font-size:13px;color:#333;margin-top:8px;line-height:1.38}
.cap b{color:#0E4D2A}
.cap.x{color:#7a2b1f}
.phone{position:relative;overflow:hidden;border:1px solid #cfcabc;border-radius:22px;background:var(--bg);color:var(--onbg)}
.phone img{display:block}
.st{height:24px;display:flex;justify-content:space-between;align-items:center;padding:0 16px;font-size:12px;color:var(--onsv)}
.bar{height:56px;display:flex;align-items:center;gap:18px;padding:0 16px}
.bar .t{flex:1;font-weight:700}
.bar .q{border:2px solid var(--onbg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700}
.subl{padding:0 16px 6px;color:var(--onsv)}
.note{margin:4px 12px 6px;padding:8px 10px;border-radius:10px;background:var(--secc);color:var(--onsecc);line-height:1.35}
.ringbox{position:relative;margin:0 auto}
.disc{position:absolute;transform:translate(-50%,-50%);height:48px;min-width:48px;padding:0 7px;border-radius:24px;display:flex;
      align-items:center;justify-content:center;font-weight:800;letter-spacing:.01em;white-space:nowrap}
.disc.wait{background:var(--sv);color:var(--onsurf);border:2px dashed var(--outline)}
.disc.num{color:#fff}
.disc.sel{box-shadow:0 0 0 3px var(--bg),0 0 0 6px var(--primary),0 6px 14px var(--shadow)}
.disc.dim{opacity:.4}
.disc.out{background:var(--sv);color:var(--onsv);text-decoration:line-through;border:1.5px solid var(--hair)}
.badge{position:absolute;transform:translate(-50%,-50%);border-radius:14px;display:flex;align-items:center;justify-content:center;
       font-weight:800;padding:0 5px;background:var(--surface);color:var(--onsurf);border:1.5px solid var(--outline);font-variant-numeric:tabular-nums}
.badge.deal{background:var(--primary);color:var(--onprimary);border-color:var(--primary)}
.badge.dim{opacity:.4}
.disc .tag{position:absolute;top:calc(100% + 3px);left:50%;transform:translateX(-50%);font-weight:700;color:var(--primary);white-space:nowrap;text-decoration:none}
.disc .tag.out{color:var(--onsv)}
.legend{position:absolute;left:0;right:0;text-align:center;color:var(--onsv)}
.centre{position:absolute;transform:translate(-50%,-50%);text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}
.centre .hint{font-weight:700;line-height:1.3}
.centre .muted{color:var(--onsv);line-height:1.3}
.centre .link{color:var(--primary);font-weight:700}
.flash{background:var(--surface);border:1.5px solid var(--primary);border-radius:16px;padding:10px 14px;box-shadow:0 8px 20px var(--shadow);
       display:flex;flex-direction:column;align-items:center;gap:3px}
.flash .nm{font-weight:800;line-height:1.2}
.flash .id{color:var(--onsv);font-variant-numeric:tabular-nums}
.pill{display:inline-block;border-radius:10px;padding:2px 9px;font-weight:700;background:var(--secc);color:var(--onsecc)}
.pill.deal{background:var(--primaryc);color:var(--onprimaryc)}
.mv{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.mv span{height:48px;min-width:132px;border-radius:24px;background:var(--primary);color:var(--onprimary);display:flex;align-items:center;justify-content:center;font-weight:800;padding:0 12px}
.bot{position:absolute;left:0;right:0;bottom:48px;height:76px;display:flex;gap:8px;align-items:center;padding:0 12px;border-top:1px solid var(--hair);background:var(--bg)}
.bot span{flex:1;height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;font-weight:800;border:1.5px solid var(--outline);color:var(--primary)}
.bot span.go{flex:1.4;background:var(--primary);color:var(--onprimary);border-color:var(--primary)}
.bot span.off{background:var(--disabled);color:var(--ondisabled);border-color:transparent}
.nav{position:absolute;left:0;right:0;bottom:0;height:48px;display:flex;justify-content:space-around;align-items:center;color:var(--onsv);font-size:18px}
"""


def theme_vars(t):
    return ';'.join(f'--{k}:{v}' for k, v in t.items())


# ---------- ring geometry ----------

def text_w(label, px):
    """Bold initials width, a little generous so the drawn pill is never narrower than the estimate."""
    f = {'W': 0.95, 'M': 0.9}
    return sum(f.get(c, 0.6 if c.isdigit() else 0.72) * px for c in label)


def disc_size(n):
    """56 dp discs up to 10 seats, 48 dp (the touch-target floor, D52) from 11."""
    return 56 if n <= 10 else 48


def disc_w(label, fs, dh=48):
    return max(float(dh), text_w(label, (dh / 3) * fs) + 14)


def ellipse_points(a, b, n=4000):
    """Seat 1 at six o'clock, then anticlockwise as seen on the screen (to the right, up, round)."""
    pts, cum, last = [], [0.0], None
    for i in range(n + 1):
        t = 2 * math.pi * i / n
        p = (a * math.sin(t), b * math.cos(t))
        if last is not None:
            cum.append(cum[-1] + math.dist(p, last))
        pts.append(p)
        last = p
    return pts, cum


def ring(widths, box_w, b_min, b_max, gap=6.0, margin=4.0, dh=48):
    """Place discs of the given widths (seat order, seat 1 first) on the smallest oval that holds them without
    touching. Each neighbour pair gets arc length in proportion to the room the two need; the oval grows
    taller until no two discs overlap. Returns (positions, a, b, fits)."""
    a = (box_w - dh) / 2 - 4
    n = len(widths)
    ext = [(w + dh) / 2 for w in widths]
    need = [(ext[i] + ext[(i + 1) % n]) / 2 + gap for i in range(n)]
    b = b_min
    while True:
        pts, cum = ellipse_points(a, b)
        per = cum[-1]
        scale = per / sum(need)
        targets, s = [], 0.0
        for i in range(n):
            targets.append(s)
            s += need[i] * scale
        pos, j = [], 0
        for tgt in targets:
            while cum[j] < tgt:
                j += 1
            pos.append(pts[j])
        if any(abs(p[0]) + widths[i] / 2 > box_w / 2 - 2 for i, p in enumerate(pos)):
            a -= 2
            continue
        # A disc is a stadium: a horizontal segment (width - height long) with a half-height radius around it.
        def clear(i, k):
            dx = max(0.0, abs(pos[i][0] - pos[k][0]) - (widths[i] - dh + widths[k] - dh) / 2)
            return math.hypot(dx, pos[i][1] - pos[k][1]) >= dh + margin
        ok = scale >= 1 and all(clear(i, k) for i in range(n) for k in range(i + 1, n))
        if ok or b >= b_max:
            return pos, a, b, ok
        b += 4


# ---------- one Order of players screen ----------

def order_screen(t, players, w=412, h=915, fs=1.0, centre='', sel=None, glide=None, title='Order of players',
                 above='', buttons=('Back', 'Clear', 'Next'), go_on=True, deal_arrow=True, avail=None):
    """players: list in seat order (seat 1 first) of dicts: ini, seat (None = not numbered yet), color index,
    deal, out, reentered, tag. glide: (from_index, to_index) of the tapped player's dotted glide arrow."""
    dh = disc_size(len(players))
    widths = [disc_w(p['ini'], fs, dh) for p in players]
    box_w = w - 16
    avail = avail or (h - 24 - 56 - 76 - 48 - 12)
    below = 22 * fs + (18 * fs if any(p.get('tag') for p in players) else 0)
    b_max = (avail - dh - 12 - below) / 2
    b_min = min(b_max, max(1.2 * ((box_w - dh) / 2 - 4), 96 * fs))
    pos, a, b, fits = ring(widths, box_w, b_min, b_max, dh=dh)
    box_h = 2 * b + dh + 12 + below
    cx, cy = box_w / 2, b + dh / 2 + 12
    lift = max(4, (avail - box_h) / 2)
    bs = 22 * fs
    felt_rx, felt_ry = a + 2, b + 2
    svg = (f'<svg width="{box_w}" height="{box_h}" style="position:absolute;left:0;top:0">'
           f'<defs><marker id="ah{id(players)}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">'
           f'<path d="M0,0 L8,4 L0,8 z" fill="var(--primary)"/></marker></defs>'
           f'<ellipse cx="{cx}" cy="{cy}" rx="{felt_rx}" ry="{felt_ry}" fill="var(--felt)" stroke="var(--feltedge)" stroke-width="2"/>')
    if deal_arrow:
        ka = 1 - (max(widths) / 2 + bs + 12) / a
        kb = 1 - (dh / 2 + bs + 12 + 8 * fs) / b
        pts = [(cx + a * ka * math.sin(tt), cy + b * kb * math.cos(tt)) for tt in [0.3 + i * 0.05 for i in range(20)]]
        d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
        svg += f'<path d="{d}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#ah{id(players)})" opacity=".8"/>'
    for f_i, t_i in [glide] if glide else []:
        (x0, y0), (x1, y1) = pos[f_i], pos[t_i]
        mx, my = (x0 + x1) / 2 * 0.55, (y0 + y1) / 2 * 0.55
        svg += (f'<path d="M{cx + x0:.1f},{cy + y0:.1f} Q{cx + mx:.1f},{cy + my:.1f} {cx + x1:.1f},{cy + y1:.1f}" fill="none" stroke="var(--primary)" '
                f'stroke-width="2.5" stroke-dasharray="3 4" marker-end="url(#ah{id(players)})"/>')
    svg += '</svg>'
    discs, badges = '', ''
    for i, p in enumerate(players):
        x, y = cx + pos[i][0], cy + pos[i][1]
        if p.get('out'):
            cls, style = 'out', ''
        elif p['seat'] is None:
            cls, style = 'wait', ''
        else:
            fill = t['reentry'] if p.get('reentered') else seat_color(p['seat'] - 1)
            color = t['onreentry'] if p.get('reentered') else '#fff'
            cls, style = 'num', f'background:{fill};color:{color}'
        if sel is not None:
            cls += ' sel' if i == sel else ' dim'
        badge = ''
        if p['seat'] is not None:
            # The seat number sits just inside the ring, in front of the player, so it never covers a letter (D95).
            d_ = math.hypot(*pos[i]) or 1
            ux, uy = -pos[i][0] / d_, -pos[i][1] / d_
            reach = widths[i] / 2 * abs(ux) + dh / 2 * abs(uy) + bs / 2 + 1
            bx, by = x + ux * reach, y + uy * reach
            dim = ' dim' if sel is not None and i != sel else ''
            badges += (f'<div class="badge{" deal" if p.get("deal") else ""}{dim}" style="left:{bx:.1f}px;top:{by:.1f}px;'
                       f'min-width:{bs:.0f}px;height:{bs:.0f}px;font-size:{11.5 * fs:.1f}px">{p["seat"]}</div>')
        tag = f'<div class="tag{" out" if p.get("out") else ""}" style="font-size:{11 * fs:.1f}px">{p["tag"]}</div>' if p.get('tag') else ''
        discs += (f'<div class="disc {cls}" style="left:{x:.1f}px;top:{y:.1f}px;height:{dh}px;min-width:{dh}px;border-radius:{dh / 2}px;'
                  f'font-size:{dh / 3 * fs:.1f}px;{style}">'f'{p["ini"]}{tag}</div>')
    discs += badges
    inner_w = min(2 * a - max(widths) - 2 * bs - 12, 1.15 * a)
    discs += f'<div class="centre" style="left:{cx}px;top:{cy - 10}px;width:{inner_w:.0f}px">{centre}</div>'
    if deal_arrow:
        discs += (f'<div class="legend" style="top:{box_h - 21 * fs:.0f}px;font-size:{12.5 * fs:.1f}px">'
                  f'The deal goes anticlockwise ⟲</div>')
    q = 26 * fs
    btns = ''.join(f'<span class="{("go" if go_on else "go off") if i == len(buttons) - 1 else ""}" style="font-size:{16 * fs:.1f}px">{b_}</span>'
                   for i, b_ in enumerate(buttons))
    body = (f'<div class="st"><span>5:05</span><span>▾ ◢ ▮</span></div>'
            f'<div class="bar"><span style="font-size:{22 * fs:.0f}px">←</span><span class="t" style="font-size:{21 * fs:.1f}px">{title}</span>'
            f'<span class="q" style="width:{q:.0f}px;height:{q:.0f}px;font-size:{15 * fs:.0f}px">?</span></div>'
            f'{above}<div class="ringbox" style="width:{box_w}px;height:{box_h:.0f}px;margin-top:{lift:.0f}px">{svg}{discs}</div>'
            f'<div class="bot">{btns}</div><div class="nav"><span>◀</span><span>●</span><span>■</span></div>')
    return f'<div class="phone" style="width:{w}px;height:{h}px;{theme_vars(t)}">{body}</div>', fits, b


def frame_img(name, w, h):
    data = base64.b64encode(open(os.path.join(FRAMES, name), 'rb').read()).decode()
    return f'<div class="phone" style="width:{w}px;height:{h}px"><img src="data:image/png;base64,{data}" width="{w}" height="{h}"></div>'


def flash(name, code, seat, tag='', fs=1.0, deal=False):
    pill = f'<span class="pill{" deal" if deal else ""}" style="font-size:{12 * fs:.1f}px">{tag}</span>' if tag else ''
    return (f'<div class="flash"><div class="nm" style="font-size:{20 * fs:.1f}px">{name}</div>'
            f'<div class="id" style="font-size:{14 * fs:.1f}px">{code} · Seat {seat}</div>{pill}</div>')


def rest_hint(n, numbered=0, fs=1.0):
    return (f'<div class="hint" style="font-size:{15 * fs:.1f}px">Tap players from the highest card to the lowest</div>'
            f'<div class="muted" style="font-size:{13 * fs:.1f}px">{numbered} of {n} numbered · <span class="link">Show me</span></div>')


# ---------- the six players of the main pictures ----------
# Added in this order (the base order); the cards: Meena highest, then Kiran, Sree, Priya, Anil; Ravi lowest deals.
P6 = {
    'SK': ('Sree Koneru', '#1'), 'PR': ('Priya Reddy', '#57'), 'AR': ('Anil Reddy', '#122'),
    'KR': ('Kiran Rao', '#123'), 'MI': ('Meena Iyer', '#124'), 'RK': ('Ravi Kumar', '#121'),
}
BASE = ['SK', 'PR', 'AR', 'KR', 'MI', 'RK']
CARDS = ['MI', 'KR', 'SK', 'PR', 'AR', 'RK']  # highest first (D56)


def seats_after(taps, n=6):
    """D56: the k-th tap takes seat n-k+1. Unnumbered players fill the low seats in their base order."""
    seat_of = {ini: n - i for i, ini in enumerate(taps)}
    waiting = [b for b in BASE if b not in seat_of]
    by_seat = {s: ini for ini, s in seat_of.items()}
    order = []
    for s in range(1, n + 1):
        order.append(by_seat[s] if s in by_seat else waiting.pop(0))
    return [dict(ini=ini, seat=seat_of.get(ini), deal=(seat_of.get(ini) == 1 and len(taps) == n)) for ini in order]


def render(html_body, out, width, height, title, sub, scale=2):
    html = (f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body style="width:{width}px">'
            f'<h1>{title}</h1><div class="sub">{sub}</div>{html_body}</body></html>')
    d = tempfile.mkdtemp()
    path = os.path.join(d, 'm.html')
    open(path, 'w').write(html)
    raw = os.path.join(d, 'raw.png')
    # Headless Chrome writes the screenshot and then may not exit; it is killed after the wait.
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                             f'--force-device-scale-factor={scale}', f'--user-data-dir={d}/u', f'--window-size={width + 36},{height}',
                             '--virtual-time-budget=1500', f'--screenshot={raw}', f'file://{path}'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(300):
        if proc.poll() is not None or (os.path.exists(raw) and os.path.getsize(raw) > 0):
            break
        time.sleep(0.1)
    time.sleep(1)
    proc.kill()
    img = Image.open(raw).convert('RGB')
    px = img.load()
    bg = px[img.width - 2, img.height - 2]
    bottom = img.height - 1
    while bottom > 0 and all(px[x, bottom] == bg for x in range(0, img.width, 7)):
        bottom -= 1
    img.crop((0, 0, img.width, min(img.height, bottom + 18 * scale))).save(out, optimize=True)
    shutil.rmtree(d, ignore_errors=True)
    print(out)


def col(phone, cap, w, cls=''):
    return f'<div style="width:{w}px">{phone}<div class="cap {cls}">{cap}</div></div>'


SREE = ('Sree, Nov 27: “The number 1 seating shown as a circle or oval … so much easier to visualize … just show initials … '
        'As you tap them, they get numbers, and they move to the right position automatically … flash his name, his player ID … '
        'in the middle of the circle, and his player number.” Nov 21: “dealing always happens counterclockwise.” Mockup only — nothing built.')


def picture_1():
    done = seats_after(CARDS)
    p_done, _, _ = order_screen(LIGHT, done, centre=(
        flash('Ravi Kumar', '#121', 1, 'deals round 1', deal=True)
),
        buttons=('Back', 'Clear', 'Next'))
    sel = 2  # Priya, seat 3
    p_sel, _, _ = order_screen(LIGHT, done, sel=sel, centre=(
        '<div class="flash"><div class="nm" style="font-size:20px">Priya Reddy</div><div class="id" style="font-size:14px">#57 · Seat 3</div>'
        '<div class="mv"><span style="font-size:15px">▲ Seat 4</span><span style="font-size:15px">▼ Seat 2</span></div>'
        '<div class="id" style="font-size:12.5px;margin-top:4px">Tap Priya again to let go</div></div>'))
    body = '<div class="grid">' + col(frame_img('pixel6-24g-order-today.png', 412, 915),
        '<b>Today</b> (CI frame, Pixel 6, run 46035664063, smoke 24g; the flow seats 4).<br>A numbered list: seat, initials, name, initials again, '
        'Player ID, ▲ ▼ on every row. On the small phone the names are cut already at 4 players (third picture).', 412) \
        + col(p_done, '<b>Proposed · everyone numbered.</b> Six players on an oval, initials only; seat 1 at the bottom deals, '
              'the deal goes anticlockwise (dashed arrow). The last tap’s name, Player ID and seat flash in the middle '
              '(it replaces today’s toast at the bottom). No list under the ring.', 412) \
        + col(p_sel, '<b>Proposed · fixing a wrong tap.</b> Tap a player: only he lights up, his name stays in the middle with '
              'two buttons: ▲ one seat up, ▼ one seat down (D74: only the selected player gets arrows). '
              'Tap him again to let go. The latest tap, tapped again, still takes its number back.', 412) + '</div>'
    render(body, os.path.join(HERE, 'seating-circle-today-vs-proposed.png'), 3 * 412 + 2 * 22, 1180,
           'Order of players as a circle — today beside proposed (Pixel 6, 412 dp, Palette B)', SREE)


def picture_2():
    phones = []
    a, _, _ = order_screen(LIGHT, seats_after([]), centre=rest_hint(6), go_on=False)
    phones.append(col(a, '<b>1 · Before anyone is numbered.</b> Initials only, in the order they were added, grey and dashed = '
                         'not numbered yet. The middle says what to do. Ravi was added last, so he waits next to Meena.', 412))
    s1 = seats_after(['MI'])
    # Meena was 5th in the ring (index 4); she goes to seat 6 (index 5) and Ravi slides back to index 4.
    b_, _, _ = order_screen(LIGHT, s1, centre=flash('Meena Iyer', '#124', 6, 'highest card'), glide=(4, 5), go_on=False)
    phones.append(col(b_, '<b>2 · First tap: Meena (highest card).</b> She gets 6, the highest seat (D56), and glides to it; '
                          'Ravi slides over to make room. Her name, #124 and “Seat 6” flash in the middle for 2 seconds.', 412))
    s2 = seats_after(['MI', 'KR'])
    c, _, _ = order_screen(LIGHT, s2, centre=flash('Kiran Rao', '#123', 5), glide=(3, 4), go_on=False)
    phones.append(col(c, '<b>3 · Next tap: Kiran.</b> He gets 5 and glides next to Meena. After the flash the middle goes back '
                         'to “2 of 6 numbered”. Sree, Priya and Anil are tapped the same way.', 412))
    s6 = seats_after(CARDS)
    d, _, _ = order_screen(LIGHT, s6, centre=flash('Ravi Kumar', '#121', 1, 'deals round 1', deal=True))
    phones.append(col(d, '<b>4 · Last tap: Ravi (lowest card).</b> Seat 1, green: he deals round 1, and the deal goes '
                         'anticlockwise to seat 2. He was already at seat 1, so he does not move. Next turns on. Clear starts again.', 412))
    body = '<div class="grid">' + ''.join(phones) + '</div>'
    render(body, os.path.join(HERE, 'seating-circle-taps.png'), 4 * 412 + 3 * 22, 1180,
           'Order of players as a circle — the taps (6 players, Pixel 6)',
           SREE + ' Tap order follows D56: highest card first, the last tap is seat 1 and deals.', scale=1.5)


NAMES13 = [('LN', 'Lakshmi Naidu', '#88'), ('AS', 'Anil Sharma', '#61'), ('PR', 'Priya Reddy', '#57'), ('VR', 'Venkat Rao', '#64'),
           ('SK', 'Sree Koneru', '#1'), ('HG', 'Harish Gadupudi', '#2'), ('KB', 'Kiran B', '#70'), ('MI', 'Meena Iyer', '#124'),
           ('RT', 'Ravi Teja', '#71'), ('SD', 'Suma D', '#72'), ('GN', 'Gopal N', '#73'), ('DP', 'Divya P', '#74'), ('AM', 'Arun M', '#75')]
EXTRA7 = [('WWW', 'Wen Wei Wong', '#90'), ('MMM', 'Mary M. Mathew', '#91'), ('HG2', 'Hari Gopal', '#92'), ('BK', 'Bala K', '#93'),
          ('NS', 'Nikhil S', '#94'), ('TV', 'Tara V', '#95'), ('UJ', 'Uma J', '#96')]


def picture_3():
    fs, w, h = 1.3, 360, 780
    today = frame_img('small-19d-order-today.png', w, h)
    # 13 players, five numbered so far (seats 13 … 9 at the top-left), the fifth tap flashing.
    seats13 = []
    for i, (ini, _, _) in enumerate(NAMES13):
        seat = i + 1
        seats13.append(dict(ini=ini, seat=seat if seat >= 9 else None))
    p13, ok13, b13 = order_screen(LIGHT, seats13, w, h, fs, centre=flash('Ravi Teja', '#71', 9, fs=fs), go_on=False)
    seats20 = []
    names20 = NAMES13[:6] + [EXTRA7[0]] + NAMES13[6:10] + [EXTRA7[1], EXTRA7[2]] + NAMES13[10:] + EXTRA7[3:]
    for i, (ini, _, _) in enumerate(names20):
        seats20.append(dict(ini=ini, seat=i + 1, deal=i == 0))
    p20, ok20, b20 = order_screen(LIGHT, seats20, w, h, fs, centre=(
        flash('Lakshmi Naidu', '#88', 1, 'deals round 1', fs=fs, deal=True)
))
    print('13 fits', ok13, 'b', b13, '· 20 fits', ok20, 'b', b20)
    body = '<div class="grid">' + col(today, '<b>Today</b> at 360 dp × text 1.3 (CI small phone, run 46035664063, smoke 19d): '
                                             '4 players already cut the names (“Priya T…”, “Zed …”).', w) \
        + col(p13, '<b>13 players.</b> The oval fits with room; every disc 48 dp, no initials cut. Seats 13 → 9 are numbered '
                   '(top left); Ravi Teja just got 9.', w) \
        + col(p20, '<b>20 players, the worst case.</b> The oval grows taller; WWW, MMM and HG2 become wider pills, '
                   'never cut (D95). Still one screen, no scroll. The hint moved into the middle to make the room.', w) \
        + '<div style="width:330px;font-size:13px;line-height:1.45;color:#333;padding-top:6px"><b style="color:#0E4D2A">How it adapts (recommended: a taller oval)</b><br>'\
          '· 2–8 players: nearly round.<br>· 9–20: the oval gets taller, up to the space between the title and the buttons. '\
          'Discs never shrink below 48 dp (D52) and grow to fit their letters (D95).<br>'\
          '· Only if that still does not fit (text 1.5+ on a short phone) does the page scroll; the buttons stay put.<br><br>'\
          '<b style="color:#7a2b1f">Not chosen</b><br>· <b>Two rows of seats</b> (an inner ring): who sits next to whom is no '\
          'longer visible, which is the whole point of the circle.<br>· <b>Smaller discs</b>: under 48 dp is too small to tap '\
          '(Sree, v12).<br>· <b>Scrolling the ring</b>: you cannot see the whole table.</div></div>'
    render(body, os.path.join(HERE, 'seating-circle-small-13-20.png'), 3 * w + 330 + 3 * 22, 1060,
           'Order of players as a circle — small phone (360 dp × text size 1.3): 13 and 20 players', SREE)


def picture_4():
    done = seats_after(CARDS)
    p_done, _, _ = order_screen(DARK, done, centre=(
        flash('Ravi Kumar', '#121', 1, 'deals round 1', deal=True)
))
    pool = [dict(ini='RK', seat=1), dict(ini='AR', seat=2, out=True, tag='out'), dict(ini='PR', seat=3, reentered=True),
            dict(ini='SK', seat=4), dict(ini='KR', seat=5, deal=True), dict(ini='MI', seat=6)]
    above = ('<div class="subl" style="font-size:13px">Pool 101 · 6 seats · 1 out</div>'
             '<div class="note" style="font-size:13px">5 rounds played. Saved rounds keep their dealers; the next deal follows the new order. '
             'Columns on the scorecard move with the seats.</div>')
    p_pool, _, _ = order_screen(DARK, pool, above=above, buttons=('Cancel', 'Clear', 'Done'), centre=(
        '<div class="hint" style="font-size:15px">Round 6 · Kiran deals next</div>'
        '<div class="muted" style="font-size:13px">Tap a player to move them</div><div class="link" style="font-size:13px">Show me</div>'),
        avail=915 - 24 - 56 - 76 - 48 - 16 - 96)
    body = '<div class="grid">' + col(p_done, '<b>Dark, New game step 3</b> (green-black, D71): same picture as the light one.', 412) \
        + col(p_pool, '<b>Dark, mid-game from ⋮ (Pool)</b>: the same ring opens prefilled as a full page instead of today’s dialog. '
                      'Anil is out (grey, struck, skipped by the deal), Priya re-entered (blue, as on the card), Kiran deals next.', 412) \
        + '</div>'
    render(body, os.path.join(HERE, 'seating-circle-dark.png'), 2 * 412 + 22, 1180,
           'Order of players as a circle — dark mode', SREE)


if __name__ == '__main__':
    picture_1()
    picture_2()
    picture_3()
    picture_4()
