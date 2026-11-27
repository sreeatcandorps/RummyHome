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
             reentry='#2B5FBF', onreentry='#FFFFFF', shadow='rgba(0,0,0,.18)', brass='#8A6A1E', onbrass='#FFFFFF')
DARK = dict(bg='#0C120E', onbg='#ECEBE4', surface='#141B16', onsurf='#ECEBE4', sv='#1B231D', onsv='#B6BDB4', outline='#848C84',
            hair='#2A322C', primary='#7FD39F', onprimary='#063019', primaryc='#1A3F29', onprimaryc='#CDEFD8', secc='#4A3A10',
            onsecc='#F5E3B0', felt='#12241A', feltedge='#2C4A36', disabled='rgba(234,237,233,.12)', ondisabled='rgba(234,237,233,.38)',
            reentry='#9DBCFF', onreentry='#0F2B63', shadow='rgba(0,0,0,.5)', brass='#E3BE63', onbrass='#3E2E07')

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
.disc.dealer{box-shadow:0 0 0 3px var(--bg),0 0 0 7px var(--brass)}
.disc.dealer.sel{box-shadow:0 0 0 3px var(--bg),0 0 0 7px var(--primary)}
.disc.new{outline:3px dashed var(--primary);outline-offset:4px}
.dlabel{position:absolute;transform:translate(-50%,-100%);border-radius:10px;padding:2px 8px;font-weight:900;letter-spacing:.06em;
        background:var(--brass);color:var(--onbrass);white-space:nowrap}
.dlabel.dim{opacity:.4}
.firstcard{position:absolute;transform:translate(-50%,-50%);color:var(--primary);font-weight:700;white-space:nowrap}
.legend{position:absolute;left:0;right:0;text-align:center;color:var(--onsv)}
.centre{position:absolute;transform:translate(-50%,-50%);text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}
.centre .hint{font-weight:700;line-height:1.3}
.centre .muted{color:var(--onsv);line-height:1.3}
.centre .link{color:var(--primary);font-weight:700}
.flash{max-width:100%;background:var(--surface);border:1.5px solid var(--primary);border-radius:16px;padding:8px 10px;box-shadow:0 8px 20px var(--shadow);
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
    """From 12 o'clock, anticlockwise as seen on the screen (to the left, down, across the bottom, up the right)."""
    pts, ts, cum, last = [], [], [0.0], None
    for i in range(n + 1):
        t = math.pi + 2 * math.pi * i / n
        p = (a * math.sin(t), b * math.cos(t))
        if last is not None:
            cum.append(cum[-1] + math.dist(p, last))
        pts.append(p)
        ts.append(t)
        last = p
    return pts, ts, cum


def ring(widths, box_w, b_min, b_max, gap=6.0, margin=4.0, dh=48):
    """D138: the highest seat at 12 o'clock, the seats counting down anticlockwise on the screen, so seat 1 (the
    dealer) ends one step to the right of the top. `widths` are in seat order, seat 1 first. Each neighbour pair
    gets arc length in proportion to the room the two need; the oval grows taller until no two discs touch.
    Returns (positions, angles, a, b, fits), positions and angles in seat order."""
    a = (box_w - dh) / 2 - 4
    n = len(widths)
    w_ring = widths[::-1]  # seat N first: the order round the ring from the top
    ext = [(w + dh) / 2 for w in w_ring]
    need = [(ext[i] + ext[(i + 1) % n]) / 2 + gap for i in range(n)]
    b = b_min
    while True:
        pts, ts, cum = ellipse_points(a, b)
        scale = cum[-1] / sum(need)
        targets, acc = [], 0.0
        for i in range(n):
            targets.append(acc)
            acc += need[i] * scale
        pos, ang, j = [], [], 0
        for tgt in targets:
            while cum[j] < tgt:
                j += 1
            pos.append(pts[j])
            ang.append(ts[j])
        pos, ang = pos[::-1], ang[::-1]
        if any(abs(p[0]) + widths[i] / 2 > box_w / 2 - 2 for i, p in enumerate(pos)):
            a -= 2
            continue
        # A disc is a stadium: a horizontal segment (width - height long) with a half-height radius around it.
        def clear(i, k):
            dx = max(0.0, abs(pos[i][0] - pos[k][0]) - (widths[i] - dh + widths[k] - dh) / 2)
            return math.hypot(dx, pos[i][1] - pos[k][1]) >= dh + margin
        ok = scale >= 1 and all(clear(i, k) for i in range(n) for k in range(i + 1, n))
        if ok or b >= b_max:
            return pos, ang, a, b, ok
        b += 4


def layout(n, labels, w, h, fs, avail=None):
    """The same sums as the screen, for the 'where it fails' table: (fits, b, inner width of the middle)."""
    dh = disc_size(n)
    widths = [disc_w(lb, fs, dh) for lb in labels[:n]]
    box_w = w - 16
    avail = avail or (h - 24 - 56 - 76 - 48 - 12)
    top, below = 22 * fs, 22 * fs
    b_max = (avail - dh - 12 - top - below) / 2
    b_min = b_max if n >= 9 else min(b_max, max(1.2 * ((box_w - dh) / 2 - 4), 96 * fs))
    _, _, a, b, fits = ring(widths, box_w, b_min, b_max, dh=dh)
    return fits, b, min(2 * a - max(widths) - 2 * 22 * fs - 12, 1.15 * a)


# ---------- one Order of players screen ----------

def order_screen(t, players, w=412, h=915, fs=1.0, centre='', sel=None, glide=None, title='Order of players',
                 above='', buttons=('Back', 'Clear', 'Next'), go_on=True, deal_arrow=True, avail=None):
    """players: list in seat order (seat 1 first) of dicts: ini, seat (None = not numbered yet), deal (+ deal_label),
    out, reentered, new, tag. glide: (from_index, to_index) of the tapped player's dotted glide arrow."""
    n = len(players)
    dh = disc_size(n)
    widths = [disc_w(p['ini'], fs, dh) for p in players]
    box_w = w - 16
    avail = avail or (h - 24 - 56 - 76 - 48 - 12)
    top = 22 * fs
    below = 22 * fs + (18 * fs if any(p.get('tag') for p in players) else 0)
    b_max = (avail - dh - 12 - top - below) / 2
    # Up to 8 seats a gentle oval; from 9 the oval takes all the height there is, so the middle has room.
    b_min = b_max if n >= 9 else min(b_max, max(1.2 * ((box_w - dh) / 2 - 4), 96 * fs))
    pos, ang, a, b, fits = ring(widths, box_w, b_min, b_max, dh=dh)
    box_h = 2 * b + dh + 12 + top + below
    cx, cy = box_w / 2, top + b + dh / 2 + 8
    lift = max(4, (avail - box_h) / 2)
    bs = 22 * fs
    mk = f'ah{id(players)}'
    svg = (f'<svg width="{box_w}" height="{box_h}" style="position:absolute;left:0;top:0">'
           f'<defs><marker id="{mk}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">'
           f'<path d="M0,0 L8,4 L0,8 z" fill="var(--primary)"/></marker></defs>'
           f'<ellipse cx="{cx}" cy="{cy}" rx="{a + 2}" ry="{b + 2}" fill="var(--felt)" stroke="var(--feltedge)" stroke-width="2"/>')
    extra = ''
    dealer = next((i for i, p in enumerate(players) if p.get('deal')), None)
    if deal_arrow and dealer is not None:
        # The first card: from the dealer, anticlockwise, to the seat before him that is still in (seat N for seat 1).
        k = dealer
        for _ in range(n):
            k = (k - 1) % n
            if not players[k].get('out'):
                break
        t0, t1 = ang[dealer], ang[k]
        if t1 < t0:
            t1 += 2 * math.pi
        ra, rb = 1 - (max(widths) / 2 + bs + 10) / a, 1 - (dh / 2 + bs + 10) / b
        steps = [t0 + (t1 - t0) * (0.12 + 0.76 * i / 16) for i in range(17)]
        pts = [(cx + a * ra * math.sin(tt), cy + b * rb * math.cos(tt)) for tt in steps]
        d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
        svg += f'<path d="{d}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-dasharray="5 3" marker-end="url(#{mk})"/>'
        tm = (t0 + t1) / 2
        if abs(math.sin(tm)) > 0.8:
            # Arrow down one side: the label goes outside it, clear of the middle.
            sx = math.copysign(1, math.sin(tm))
            lx, ly = cx + a * ra * math.sin(tm) + sx * 6, cy + b * rb * math.cos(tm)
            tx, al = ('0%', 'left') if sx > 0 else ('-100%', 'right')
            extra += (f'<div class="firstcard" style="left:{lx:.1f}px;top:{ly:.1f}px;font-size:{11.5 * fs:.1f}px;'
                      f'transform:translate({tx},-50%);text-align:{al};white-space:normal;line-height:1.15">first open<br>card</div>')
        else:
            lx, ly = cx + a * (ra - 0.2) * math.sin(tm), cy + b * (rb - 0.2) * math.cos(tm)
            extra += f'<div class="firstcard" style="left:{lx:.1f}px;top:{ly:.1f}px;font-size:{11.5 * fs:.1f}px">first open card</div>'
    for f_i, t_i in [glide] if glide else []:
        (x0, y0), (x1, y1) = pos[f_i], pos[t_i]
        mx, my = (x0 + x1) / 2 * 0.55, (y0 + y1) / 2 * 0.55
        svg += (f'<path d="M{cx + x0:.1f},{cy + y0:.1f} Q{cx + mx:.1f},{cy + my:.1f} {cx + x1:.1f},{cy + y1:.1f}" fill="none" stroke="var(--primary)" '
                f'stroke-width="2.5" stroke-dasharray="3 4" marker-end="url(#{mk})"/>')
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
        if p.get('deal'):
            cls += ' dealer'
        if p.get('new'):
            cls += ' new'
        if sel is not None:
            cls += ' sel' if i == sel else ' dim'
        dim = ' dim' if sel is not None and i != sel else ''
        if p['seat'] is not None:
            # The seat number sits just inside the ring, in front of the player, so it never covers a letter (D95).
            d_ = math.hypot(*pos[i]) or 1
            ux, uy = -pos[i][0] / d_, -pos[i][1] / d_
            reach = widths[i] / 2 * abs(ux) + dh / 2 * abs(uy) + bs / 2 + 1
            bx, by = x + ux * reach, y + uy * reach
            badges += (f'<div class="badge{" deal" if p.get("deal") else ""}{dim}" style="left:{bx:.1f}px;top:{by:.1f}px;'
                       f'min-width:{bs:.0f}px;height:{bs:.0f}px;font-size:{11.5 * fs:.1f}px">{p["seat"]}</div>')
        if p.get('deal'):
            # The dealer's label sits above his disc: he is always near the top, so there is room there.
            badges += (f'<div class="dlabel{dim}" style="left:{x:.1f}px;top:{y - dh / 2 - 13 * fs:.1f}px;font-size:{11.5 * fs:.1f}px">'
                       f'{p.get("deal_label", "DEALER")}</div>')
        tag = f'<div class="tag{" out" if p.get("out") else ""}" style="font-size:{11 * fs:.1f}px">{p["tag"]}</div>' if p.get('tag') else ''
        discs += (f'<div class="disc {cls}" style="left:{x:.1f}px;top:{y:.1f}px;height:{dh}px;min-width:{dh}px;border-radius:{dh / 2}px;'
                  f'font-size:{dh / 3 * fs:.1f}px;{style}">{p["ini"]}{tag}</div>')
    discs += badges + extra
    inner_w = min(2 * a - max(widths) - 2 * bs - 12, 1.15 * a)
    discs += f'<div class="centre" style="left:{cx}px;top:{cy + 8 * fs:.0f}px;width:{inner_w:.0f}px">{centre}</div>'
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
    return (f'<div class="flash"><div class="nm" style="font-size:{min(20 * fs, 22):.1f}px">{name}</div>'
            f'<div class="id" style="font-size:{min(14 * fs, 16):.1f}px">{code} · Seat {seat}</div>{pill}</div>')


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


SREE = ('Sree, Nov 27 (D138): “What I want is the highest on the top … The second highest goes to the left … The dealer is always '
        'one step to the right … show him clearly that he’s the dealer … give him number 1. The highest gets the max number.” '
        '“The default for dealing is counterclockwise … whoever has the highest gets the first open card.” '
        'Earlier the same day: “just show initials … flash his name, his player ID … in the middle of the circle.” Mockup; the build follows it.')

DONE_FLASH = flash('Ravi Kumar', '#121', 1, 'lowest card · dealer', deal=True)


def picture_1():
    done = seats_after(CARDS)
    p_done, _, _ = order_screen(LIGHT, done, centre=DONE_FLASH)
    sel = 2  # Priya, seat 3
    p_sel, _, _ = order_screen(LIGHT, done, sel=sel, centre=(
        '<div class="flash"><div class="nm" style="font-size:20px">Priya Reddy</div><div class="id" style="font-size:14px">#57 · Seat 3</div>'
        '<div class="mv"><span style="font-size:15px">▲ Seat 4</span><span style="font-size:15px">▼ Seat 2</span></div>'
        '<div class="id" style="font-size:12.5px;margin-top:4px">Tap Priya again to let go</div></div>'))
    joined = [dict(ini='RK', seat=1, deal=True), dict(ini='AR', seat=2), dict(ini='PR', seat=3), dict(ini='SK', seat=4),
              dict(ini='KR', seat=5), dict(ini='MI', seat=6), dict(ini='TV', seat=7, new=True)]
    above = ('<div class="subl" style="font-size:13px">Round 1 · Ravi deals</div>'
             '<div class="note" style="font-size:13px"><b>Tara sits at seat 7, between Meena and Ravi — left of the dealer.</b> '
             'She is the new highest seat, so she sits at the top.</div>')
    p_new, _, _ = order_screen(LIGHT, joined, above=above, buttons=('Cancel', 'Clear', 'Done'),
                               centre=flash('Tara V', '#95', 7, 'just joined'), avail=915 - 24 - 56 - 76 - 48 - 12 - 92)
    body = '<div class="grid">' + col(frame_img('pixel6-24g-order-today.png', 412, 915),
        '<b>Today</b> (CI frame, Pixel 6, run 46035664063, smoke 24g; the flow seats 4).<br>A numbered list: seat, initials, name, '
        'initials again, Player ID, ▲ ▼ on every row. On the small phone the names are cut already at 4 players (third picture).', 412) \
        + col(p_done, '<b>Everyone numbered.</b> Meena, the highest card, sits at the top with 6; Kiran (5) to her left, and on round '
              'the table. Ravi, the lowest card, is seat 1, one step to the right of the top: gold ring, <b>DEALER</b>, green 1. '
              'The dashed arrow is the first open card: anticlockwise, to Meena, the highest. The last tap’s name, #ID and seat flash in the middle.', 412) \
        + col(p_sel, '<b>Fixing a wrong tap.</b> Tap a player: only he lights up, his name stays in the middle with ▲ one seat up and '
              '▼ one seat down (D74: only the selected player gets arrows). Tap him again to let go. The latest tap, tapped '
              'again, still takes its number back.', 412) \
        + col(p_new, '<b>A newcomer (D70).</b> Tara joins while Ravi deals round 1. She takes the seat before the dealer: '
              'seat 7, the new highest, so the top of the ring, between Meena and Ravi. On the screen that is the dealer’s left '
              '(for someone sitting in Ravi’s chair it is his right hand). With any other dealer, the newcomer sits one step '
              'anticlockwise from him, where the first open card goes.', 412) + '</div>'
    render(body, os.path.join(HERE, 'seating-circle-today-vs-proposed.png'), 4 * 412 + 3 * 22, 1200,
           'Order of players as a circle (D138) — today beside proposed (Pixel 6, 412 dp, Palette B)', SREE)


def picture_2():
    phones = []
    a, _, _ = order_screen(LIGHT, seats_after([]), centre=rest_hint(6), go_on=False)
    phones.append(col(a, '<b>1 · Before anyone is numbered.</b> Initials only, grey and dashed = not numbered yet, in the order '
                         'they were added, clockwise from just right of the top (Sree first, Ravi last, at the top). '
                         'The middle says what to do.', 412))
    s1 = seats_after(['MI'])
    b_, _, _ = order_screen(LIGHT, s1, centre=flash('Meena Iyer', '#124', 6, 'highest card'), glide=(4, 5), go_on=False)
    phones.append(col(b_, '<b>2 · First tap: Meena (highest card).</b> She gets 6, the highest number, and glides to the top; '
                          'Ravi slides over to make room. Her name, #124 and “Seat 6” flash in the middle for 2 seconds.', 412))
    s2 = seats_after(['MI', 'KR'])
    c, _, _ = order_screen(LIGHT, s2, centre=flash('Kiran Rao', '#123', 5), glide=(3, 4), go_on=False)
    phones.append(col(c, '<b>3 · Next tap: Kiran.</b> He gets 5 and glides to Meena’s left. After the flash the middle goes back '
                         'to “2 of 6 numbered”. Sree, Priya and Anil follow round the table the same way.', 412))
    d, _, _ = order_screen(LIGHT, seats_after(CARDS), centre=DONE_FLASH)
    phones.append(col(d, '<b>4 · Last tap: Ravi (lowest card).</b> Number 1, one step right of the top: he is the dealer (gold ring, '
                         'DEALER, green 1). The first open card goes anticlockwise to Meena. Next turns on. Clear starts again.', 412))
    body = '<div class="grid">' + ''.join(phones) + '</div>'
    render(body, os.path.join(HERE, 'seating-circle-taps.png'), 4 * 412 + 3 * 22, 1180,
           'Order of players as a circle (D138) — the taps (6 players, Pixel 6)',
           SREE + ' Tap order stays D56: highest card first, the last tap is number 1 and deals.', scale=1.5)


NAMES13 = [('LN', 'Lakshmi Naidu', '#88'), ('AS', 'Anil Sharma', '#61'), ('PR', 'Priya Reddy', '#57'), ('VR', 'Venkat Rao', '#64'),
           ('SK', 'Sree Koneru', '#1'), ('HG', 'Harish Gadupudi', '#2'), ('KB', 'Kiran B', '#70'), ('MI', 'Meena Iyer', '#124'),
           ('RT', 'Ravi Teja', '#71'), ('SD', 'Suma D', '#72'), ('GN', 'Gopal N', '#73'), ('DP', 'Divya P', '#74'), ('AM', 'Arun M', '#75')]
EXTRA7 = [('WWW', 'Wen Wei Wong', '#90'), ('MMM', 'Mary M. Mathew', '#91'), ('HG2', 'Hari Gopal', '#92'), ('BK', 'Bala K', '#93'),
          ('NS', 'Nikhil S', '#94'), ('TV', 'Tara V', '#95'), ('UJ', 'Uma J', '#96')]


def picture_3():
    fs, w, h = 1.3, 360, 780
    today = frame_img('small-19d-order-today.png', w, h)
    seats13 = [dict(ini=ini, seat=1 + i, deal=i == 0) for i, (ini, _, _) in enumerate(NAMES13)]
    p13, ok13, b13 = order_screen(LIGHT, seats13, w, h, fs, centre=flash('Lakshmi Naidu', '#88', 1, 'dealer', fs=fs, deal=True))
    names20 = NAMES13[:6] + [EXTRA7[0]] + NAMES13[6:10] + [EXTRA7[1], EXTRA7[2]] + NAMES13[10:] + EXTRA7[3:]
    seats20 = [dict(ini=ini, seat=i + 1, deal=i == 0) for i, (ini, _, _) in enumerate(names20)]
    p20, ok20, b20 = order_screen(LIGHT, seats20, w, h, fs, centre=flash('Lakshmi Naidu', '#88', 1, 'dealer', fs=fs, deal=True))
    print('13 fits', ok13, 'b', round(b13), '· 20 fits', ok20, 'b', round(b20))
    body = '<div class="grid">' + col(today, '<b>Today</b> at 360 dp × text 1.3 (CI small phone, run 46035664063, smoke 19d): '
                                             '4 players already cut the names (“Priya T…”, “Zed …”).', w) \
        + col(p13, '<b>13 players — designed to look right.</b> AM (13, highest) at the top, LN (1) the dealer one step to '
                   'its right. Every disc 48 dp, no initials cut, room to spare.', w) \
        + col(p20, '<b>20 players — still works.</b> The oval grows tall; WWW, MMM and HG2 become wider pills, never cut '
                   '(D95). Just fits on one screen; it is crowded, the middle is narrow and the name wraps.', w) \
        + '<div style="width:330px;font-size:13px;line-height:1.45;color:#333;padding-top:6px"><b style="color:#0E4D2A">How it adapts</b><br>'\
          '· Discs are 56 dp up to 10 players, 48 dp from 11 (never smaller, D52). A disc grows to fit its letters (D95).<br>'\
          '· Up to 8 players the ring is a gentle oval; from 9 it takes all the height between the title and the buttons.<br>'\
          '· When even that is not tall enough, the page scrolls and the buttons stay put. It never shrinks the discs or the letters.<br><br>'\
          '<b style="color:#0E4D2A">From how many players it scrolls</b> (all two-letter initials / all three-letter)<br>'\
          '· Pixel 6, text 1.0: 28 / 23<br>· 360 dp, text 1.0: 23 / 19<br>· 360 dp, text 1.3: 22 / 15<br>'\
          '· 360 dp × 1.3, mid-game page (note above the ring): 19 / 13<br>· 360 dp, text 2.0: 17 / 7<br>'\
          'Up to 13 players with normal initials it never scrolls on any phone up to text 1.5. See the spec, §11.7.</div></div>'
    render(body, os.path.join(HERE, 'seating-circle-small-13-20.png'), 3 * w + 330 + 3 * 22, 1060,
           'Order of players as a circle (D138) — small phone (360 dp × text size 1.3): 13 and 20 players', SREE)


def picture_4():
    p_done, _, _ = order_screen(DARK, seats_after(CARDS), centre=DONE_FLASH)
    pool = [dict(ini='RK', seat=1), dict(ini='AR', seat=2, out=True, tag='out'), dict(ini='PR', seat=3, reentered=True),
            dict(ini='SK', seat=4), dict(ini='KR', seat=5, deal=True, deal_label='DEALS NEXT'), dict(ini='MI', seat=6)]
    above = ('<div class="subl" style="font-size:13px">Pool 101 · 6 seats · 1 out</div>'
             '<div class="note" style="font-size:13px">5 rounds played. Saved rounds keep their dealers; the next deal follows the new order. '
             'Columns on the scorecard move with the seats.</div>')
    p_pool, _, _ = order_screen(DARK, pool, above=above, buttons=('Cancel', 'Clear', 'Done'), centre=(
        '<div class="hint" style="font-size:15px">Round 6 · Kiran deals next</div>'
        '<div class="muted" style="font-size:13px">Tap a player to move them</div><div class="link" style="font-size:13px">Show me</div>'),
        avail=915 - 24 - 56 - 76 - 48 - 12 - 96)
    body = '<div class="grid">' + col(p_done, '<b>Dark, New game step 3</b> (green-black, D71): the same picture as the light one.', 412) \
        + col(p_pool, '<b>Dark, mid-game from ⋮ (Pool)</b>: the same ring, prefilled, as a full page. The seats stay where they are, '
                      'so the dealer label moves round with the deal: Kiran (5) deals next and the first open card goes to Sree (4). '
                      'Anil is out (grey, struck, skipped), Priya re-entered (blue, as on the card).', 412) \
        + '</div>'
    render(body, os.path.join(HERE, 'seating-circle-dark.png'), 2 * 412 + 22, 1180,
           'Order of players as a circle (D138) — dark mode', SREE)


SCREENS = [('Pixel 6', 412, 915, 1.0, None), ('360 dp, text 1.0', 360, 780, 1.0, None), ('360 dp, text 1.3', 360, 780, 1.3, None),
           ('360 dp, text 1.5', 360, 780, 1.5, None), ('360 dp, text 2.0', 360, 780, 2.0, None), ('360 dp × 1.3, mid-game page', 360, 780, 1.3, 780 - 24 - 56 - 76 - 48 - 12 - 110),
           ('Tablet 800 × 1280', 800, 1280, 1.0, None)]


def fit_table():
    """When the ring stops fitting on one screen (it then scrolls; discs and letters never shrink), and how wide the middle is."""
    for name, w, h, fs, avail in SCREENS:
        row = []
        for label in ('HG', 'WWW'):
            first = next((n for n in range(4, 31) if not layout(n, [label] * n, w, h, fs, avail)[0]), None)
            row.append(f'{label}: scrolls from {first or ">30"}')
        mid = [round(layout(n, ['HG'] * n, w, h, fs, avail)[2]) for n in (6, 13, 20)]
        print(f'{name:30s} ' + ' | '.join(row) + f' | middle at 6/13/20: {mid} dp')


if __name__ == '__main__':
    import sys
    if '--fit' in sys.argv:
        fit_table()
    else:
        picture_1()
        picture_2()
        picture_3()
        picture_4()
