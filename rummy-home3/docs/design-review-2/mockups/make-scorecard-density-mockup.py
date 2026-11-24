#!/usr/bin/env python3
"""Scorecard density + landscape (Sree, Nov 23: "I think it can fit 10. 10 is too much … it should show 5 …
landscape should only be for viewing"). Portrait: the CI frame (20 players, 60 rounds) beside the same table at
5 columns and the ⋮ Columns row; landscape: today, drawn to the code's sizes, beside view-only. Writes
scorecard-density.png and scorecard-landscape.png."""
import os, subprocess, tempfile, shutil, random
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = '/tmp/mock/score'
os.makedirs(OUT, exist_ok=True)
CHROME = '/usr/local/bin/google-chrome'
random.seed(7)
# Palette B light
T = dict(bg='#F5F2E8', surface='#FFFFFF', ink='#1A1F1B', muted='#5A615B', hair='#E6E1D3', primary='#0E4D2A', onprimary='#FFFFFF',
         primaryc='#D8ECDD', secc='#F0DFAE', onsecc='#3E2E07', neg='#A8201A', win='#D6F5DF', stripe='#F9F8F3', head='#F0ECE0', outline='#8E928A')
PLAYERS = ['CC', 'PO', 'PT', 'PLT', 'PF', 'PLF', 'PS', 'PLS', 'PE', 'PN', 'PTE', 'PLE', 'PTW', 'PTH', 'PFO', 'PFI', 'PSI', 'PSE', 'PEI', 'PLN']
TOTALS = ['-545', '+215', '+5', '+325', '-880', '+145', '-265', '+665', '-505', '+120', '-60', '+90', '-310', '+40', '-120', '+260', '-75', '+15', '-430', '+1310']
SEAT = ['#0F766E', '#C2410C', '#1D4ED8', '#A21CAF', '#6D28D9', '#0E7490', '#92400E', '#BE123C', '#3F6212', '#475569']

def cells(n, winner):
    out = []
    for i in range(n):
        if i == winner:
            out.append(('+%d' % random.choice([515, 540, 645, 690, 725]), 'win'))
        else:
            out.append(('-%d' % random.choice([5, 10, 15, 20, 25, 30, 35, 45, 50, 60, 65, 75, 80]), 'neg' if random.random() < .35 else 'ink'))
    return out

def table(cols, col_w, row_h, font, rows, compact, width, landscape=False, head_font=None):
    head_font = head_font or font - 1
    rnd_w = 48 if compact else 42
    h = f'<div class="tbl" style="width:{width}px">'
    h += f'<div class="hdr" style="height:{row_h + 14}px"><div class="rnd" style="width:{rnd_w}px">RND</div><div class="hcols" style="width:{width - rnd_w}px">'
    for i in range(cols):
        h += f'<div class="hc" style="width:{col_w}px;min-width:{col_w}px"><span style="color:{SEAT[i % 10]};font-size:{head_font}px">{PLAYERS[i]}</span><b style="font-size:{head_font + (2 if col_w >= 56 else -1)}px;color:{T["neg"] if TOTALS[i].startswith("-") else T["ink"]}">{TOTALS[i]}</b><i style="background:{SEAT[i % 10]};opacity:{1 if i == 0 else 0}"></i></div>'
    h += '</div></div><div class="body">'
    for r in range(rows):
        rn = 61 - rows + r
        cs = cells(cols, (r * 3) % cols)
        h += f'<div class="row {"latest" if r == rows - 1 else ("stripe" if r % 2 else "")}" style="height:{row_h}px"><div class="rnd" style="width:{rnd_w}px"><b>{rn}</b><span>{PLAYERS[(rn + 7) % 20]}</span></div><div class="bcols" style="width:{width - rnd_w}px">'
        for v, tone in cs:
            col = T['neg'] if tone == 'neg' else T['ink']
            bg = f'background:{T["win"]};' if tone == 'win' else ''
            h += f'<div class="c" style="width:{col_w}px;min-width:{col_w}px;font-size:{font}px;color:{col};{bg}">{v}</div>'
        h += '</div></div>'
    h += '</div></div>'
    return h

CSS = f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:{T['bg']};color:{T['ink']};font-family:Roboto,"Noto Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}}
.status{{height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:14px;color:{T['muted']}}}
.bar{{height:56px;display:flex;align-items:center;padding:0 10px;gap:8px}}
.bar h1{{font-size:22px;font-weight:700;flex:1}}
.ico{{width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;color:{T['ink']}}}
.tags{{display:flex;gap:8px;padding:4px 16px 10px;flex-wrap:wrap}}
.tag{{height:34px;border-radius:999px;padding:0 12px;display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700;background:{T['head']};color:{T['ink']}}}
.tag.y{{background:{T['secc']};color:{T['onsecc']}}} .tag.g{{background:{T['primaryc']};color:{T['primary']}}}
.tbl{{margin:0 16px;border:1px solid {T['hair']};border-radius:10px;overflow:hidden;background:{T['surface']}}}
.hdr{{display:flex;background:{T['head']};border-bottom:1px solid {T['hair']}}}
.hdr .rnd{{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:{T['muted']};border-right:1px solid {T['hair']}}}
.hcols{{display:flex;overflow:hidden}} .bcols{{display:flex;overflow:hidden}}
.hc{{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-right:1px solid {T['hair']};position:relative;font-weight:700}}
.hc i{{position:absolute;left:0;right:0;bottom:0;height:4px;display:block}}
.row{{display:flex;border-bottom:1px solid {T['hair']}}}
.row.stripe{{background:{T['stripe']}}} .row.latest{{background:{T['win']}}}
.row .rnd{{display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:1px solid {T['hair']}}}
.row .rnd b{{font-size:14px}} .row .rnd span{{font-size:10px;color:{T['muted']}}}
.c{{display:flex;align-items:center;justify-content:center;border-right:1px solid {T['hair']};font-variant-numeric:tabular-nums}}
.foot{{padding:8px 16px;font-size:12px;color:{T['muted']};font-style:italic;line-height:1.4}}
.btnbar{{position:absolute;left:0;right:0;bottom:0;display:flex;gap:12px;padding:12px 16px 14px;background:{T['bg']}}}
.btn{{height:56px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;gap:6px}}
.btn.fill{{background:{T['primary']};color:{T['onprimary']};flex:1.4}} .btn.out{{border:1px solid {T['outline']};color:{T['primary']};flex:1}}
.nav{{position:absolute;left:0;right:0;bottom:0;height:48px;display:flex;align-items:center;justify-content:center;gap:90px;color:#555;font-size:18px}}
.scrollbar{{height:4px;background:{T['hair']};margin:6px 16px 0;border-radius:2px;position:relative}}
.scrollbar i{{position:absolute;left:0;top:0;height:4px;border-radius:2px;background:{T['outline']}}}
.menu{{position:absolute;right:10px;top:76px;width:300px;background:{T['surface']};border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.22);padding:8px 0;font-size:16px}}
.mi{{display:flex;align-items:center;gap:14px;padding:0 18px;height:48px}} .mi span.i{{width:22px;color:{T['muted']}}}
.seg{{display:flex;margin:4px 18px 8px;border:1px solid {T['outline']};border-radius:999px;overflow:hidden;height:40px}}
.seg div{{flex:1;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;border-right:1px solid {T['outline']}}}
.seg div:last-child{{border-right:0}} .seg .on{{background:{T['secc']};color:{T['onsecc']}}}
.hint{{padding:0 18px 10px;font-size:13px;color:{T['muted']}}}
.scrim{{position:absolute;inset:0;background:rgba(0,0,0,.12)}}
"""

def status(): return '<div class="status"><span>8:10</span><span>▾ ▲ ▮</span></div>'
def header(title='Scorecard · S2', extra=''): return f'<div class="bar"><div class="ico">←</div><h1>{title}</h1>{extra}<div class="ico">⇪</div><div class="ico">?</div><div class="ico">⋮</div></div>'
def tags(): return '<div class="tags"><div class="tag y">S2</div><div class="tag y">123 Points</div><div class="tag">👥 20 players</div><div class="tag g">🂠 Round 61</div></div>'

def portrait_five(menu=False):
    # 412 wide: 16 margins, 42 round column → (412-32-42)/5 = 67.6 per column → 18 pt digits
    body = status() + header() + tags()
    body += table(20, 67, 48, 18, 11, False, 380, head_font=16)
    body += '<div class="scrollbar"><i style="width:25%"></i></div>'
    body += '<div class="foot">Creator: Chandra Creator<br>Admin: Asha Coadmin<br>Unique game ID: BREAKP2</div>'
    body += '<div class="btnbar"><div class="btn out">↶ Undo</div><div class="btn fill">＋ Add round</div><div class="btn out">⚑ Complete</div></div>'
    if menu:
        body += '<div class="scrim"></div><div class="menu">'
        for i, t in (('⚙', 'Game settings'), ('👥', 'Players & admins'), ('⌗', 'Seating'), ('🂠', 'Dealer'), ('✎', 'Edit round'), ('☰', 'Log')):
            body += f'<div class="mi"><span class="i">{i}</span>{t}</div>'
        body += '<div class="mi" style="height:40px"><span class="i">⤢</span>Columns</div><div class="seg"><div class="on">5</div><div>7</div><div>All</div></div><div class="hint">Or pinch the table. Remembered on this phone for every game.</div>'
        body += '</div>'
    return body

def landscape(today):
    # Pixel 6 landscape: 915 × 412 dp. Today: header 56 + two tag rows 88 + bar 70 → ~2.5 rows at 34 dp. View-only: one 48-dp line, no bar → 6 rows.
    if today:
        body = '<div class="status" style="height:24px"></div>' + header()
        body += '<div class="tags" style="padding:0 16px 6px"><div class="tag" style="height:30px">S2</div><div class="tag y" style="height:30px">123 Points</div><div class="tag" style="height:30px">👥 11 players</div><div class="tag g" style="height:30px">🂠 Round 61</div></div>'
        body += table(11, (915 - 32 - 48) // 11, 34, 15, 3, True, 915 - 32)
        body += '<div class="btnbar" style="padding:8px 16px 8px"><div class="btn out" style="height:44px">↶ Undo</div><div class="btn fill" style="height:44px">＋ Add round</div><div class="btn out" style="height:44px">⚑ Complete</div></div>'
    else:
        body = '<div class="status" style="height:24px"></div>'
        body += '<div class="bar" style="height:48px"><div class="ico">←</div><h1 style="font-size:20px">Scorecard · S2</h1><div class="tags" style="padding:0 8px 0 0"><div class="tag y" style="height:30px">123 Points</div><div class="tag" style="height:30px">👥 11 players</div><div class="tag g" style="height:30px">🂠 Round 61</div><div class="tag" style="height:30px">👁 View only</div></div><div class="ico">⇪</div><div class="ico">?</div><div class="ico">⋮</div></div>'
        body += table(11, (915 - 32 - 48) // 11, 36, 15, 7, True, 915 - 32)
    return body

def render(name, body, w, h, scale=2):
    html = f'<!doctype html><html><head><meta charset="utf-8"><style>html,body{{width:{w}px;height:{h}px;position:relative}}{CSS}</style></head><body>{body}</body></html>'
    d = tempfile.mkdtemp(); p = os.path.join(d, 'm.html'); open(p, 'w').write(html)
    png = os.path.join(OUT, name + '.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', f'--force-device-scale-factor={scale}',
                             f'--user-data-dir={d}/u', f'--window-size={w},{h}', '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: proc.wait(timeout=20)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(d, ignore_errors=True)
    assert os.path.exists(png), name
    return Image.open(png).convert('RGB')

F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz, bold=False): return ImageFont.truetype(FB if bold else F, sz)

def sheet(title, sub, panels, path, pad=36, gap=36, top=110):
    H = max(im.height for im, _ in panels)
    W = pad * 2 + sum(im.width for im, _ in panels) + gap * (len(panels) - 1)
    s = Image.new('RGB', (W, top + H + 110), '#F6F6F1'); d = ImageDraw.Draw(s)
    d.text((pad, 28), title, fill='#17201B', font=font(30, True)); d.text((pad, 70), sub, fill='#4E5752', font=font(22))
    x = pad
    for im, cap in panels:
        s.paste(im, (x, top)); d.rectangle((x - 1, top - 1, x + im.width, top + im.height), outline='#C9CBC4')
        for i, line in enumerate(cap.split('\n')):
            d.text((x + im.width // 2 - d.textlength(line, font=font(22)) // 2, top + H + 18 + i * 28), line, fill='#4E5752', font=font(22))
        x += im.width + gap
    s.save(path, optimize=True); print(path, s.size)

before = Image.open(os.path.join(HERE, 'scorecard-20p-before.png')).convert('RGB')
before = before.resize((824, round(before.height * 824 / before.width)), Image.LANCZOS)
five = render('p5', portrait_five(), 412, 915)
menu = render('p5menu', portrait_five(menu=True), 412, 915)
sheet('Scorecard columns — 10 across today, 5 by default (Sree, Nov 23): "10 is too much … it should show 5"',
      'Left: the CI frame, 20 players at the 38-dp minimum, 13-pt digits. Middle: the same game at 5 columns — 67 dp, 18-pt digits, the rest scrolls sideways (the sync from #117). Right: where the choice lives. Mockup only.',
      [(before, 'Today (CI frame, APK v17): 20 players,\n9½ columns visible, 13-pt digits'), (five, 'Proposed default: 5 columns, 18-pt digits,\nscroll bar under the table; Share stays'), (menu, '⋮ › Columns 5 · 7 · All — and pinch on the table;\nremembered on the phone')],
      os.path.join(HERE, 'scorecard-density.png'))
lt = render('l-today', landscape(True), 915, 412)
lv = render('l-view', landscape(False), 915, 412)
sheet('Landscape — viewing only (Sree, Nov 23): "I can barely see 2 rows … just a viewing thing"',
      'Top: today, at the code\'s sizes (56-dp header, two tag rows, 44-dp bar): 2–3 rows. Bottom: one 48-dp line, no bar, no footer: 6–7 rows. Editing stays in portrait. Mockup only.',
      [(lt, 'Today: header + two tag rows + Undo / Add round / Complete → 2–3 rows of scores'), ], os.path.join(HERE, 'scorecard-landscape-a.png'))
sheet('', '', [(lv, 'Proposed: one line (back · title · tags · share · help · ⋮), no bottom bar, row tap off → 6–7 rows')], os.path.join(HERE, 'scorecard-landscape-b.png'), top=20)
a = Image.open(os.path.join(HERE, 'scorecard-landscape-a.png')); b = Image.open(os.path.join(HERE, 'scorecard-landscape-b.png'))
s = Image.new('RGB', (max(a.width, b.width), a.height + b.height - 40), '#F6F6F1'); s.paste(a, (0, 0)); s.paste(b, (0, a.height - 40))
s.save(os.path.join(HERE, 'scorecard-landscape.png'), optimize=True)
os.remove(os.path.join(HERE, 'scorecard-landscape-a.png')); os.remove(os.path.join(HERE, 'scorecard-landscape-b.png'))
print('done')
