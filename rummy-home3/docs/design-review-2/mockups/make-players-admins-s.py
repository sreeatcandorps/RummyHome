#!/usr/bin/env python3
"""Players · Admins in the Size S look (design-review-2 §10.5): today beside proposed.

Today    = the CI frames in players-admins-ci/:
           pixel6-4p.png, small-4p.png   run 46035664063 (the pull-request run of #170, green; the app code is
                                         the code on main @ 738df7d6), flow smoke/21, frame 21-players-admins.
                                         Pixel 6 = 412 x 915 dp, text 1.0; small = 360 x 780 dp, text 1.3.
           pixel6-5p-admin-not-playing.png  run 45878556049 (nightly, main @ 3c0ea575), flow full/32, frame 32f.
                                         The screen's layout has not changed since.
           CI has no frame of this screen with 13 players, so that "today" is drawn from the code's sizes.
Proposed = the same screen drawn to the sizes of the shared pieces it would be built from
           (components/ui/SettingsGroup.tsx, ListRow.tsx, SeatAvatar.tsx, BottomBar.tsx), dp = CSS px, text
           through Android 14's font-scale table (sp()), in headless Chrome.

Usage:
  pip install pillow
  (cd rummy-home3 && npm ci)                 # the icons are the app's own MaterialCommunityIcons.ttf
  python3 make-players-admins-s.py           # writes players-admins-s*.png beside this file
  python3 make-players-admins-s.py --check   # also draws TODAY's screen and writes it beside each CI frame
                                             # to /tmp/players-admins-check/, to see that the drawing matches
                                             # the app before trusting the proposed ones

Fonts: Roboto (variable) is read from $ROBOTO_VF (default /tmp/fonts/RobotoVF.ttf; the file is
"Roboto[wdth,wght].ttf" in github.com/google/fonts, ofl/roboto). Without it Chrome falls back to its own sans
and the widths, so what is cut and what fits, are no longer the phone's.
"""
import os, shutil, subprocess, sys, tempfile, time
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CI = os.path.join(HERE, 'players-admins-ci')
CHROME = os.environ.get('CHROME', '/usr/local/bin/google-chrome')
ROBOTO = os.environ.get('ROBOTO_VF', '/tmp/fonts/RobotoVF.ttf')
MDI = os.path.join(APP, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf')
TMP = tempfile.mkdtemp(prefix='players-admins-')

# constants/theme.ts (Palette B, D65; dark green-black, D71)
LIGHT = dict(bg='#F5F2E8', surface='#FFFFFF', ink='#1A1F1B', muted='#5A615B', hair='#E6E1D3', outline='#8E928A', outlinev='#E6E1D3',
             primary='#0E4D2A', onprimary='#FFFFFF', edge='#083820', surfv='#ECE7DA', leaderc='#FFF0BF', onleaderc='#3F2D00',
             infoc='#DCE8FF', oninfoc='#0F2B63', primaryc='#D8ECDD', onprimaryc='#0B3B1F', disabled='rgba(26,31,27,.32)',
             chrome='#3c4043', nav='#5f6368', scrim='rgba(0,0,0,.4)')
DARK = dict(bg='#0C120E', surface='#141B16', ink='#ECEBE4', muted='#B6BDB4', hair='#2A322C', outline='#848C84', outlinev='#2A322C',
            primary='#7FD39F', onprimary='#063019', edge='#3FAF6E', surfv='#1B231D', leaderc='#4D3900', onleaderc='#FFE8AE',
            infoc='#22406E', oninfoc='#DCE8FF', primaryc='#1A3F29', onprimaryc='#CDEFD8', disabled='rgba(234,237,233,.32)',
            chrome='#d0d4d0', nav='#aab0aa', scrim='rgba(0,0,0,.6)')
SEAT = ['#0F766E', '#C2410C', '#1D4ED8', '#A21CAF', '#6D28D9', '#0E7490', '#92400E', '#BE123C', '#3F6212', '#475569']
ICON = {'back': 0xF004D, 'help': 0xF0625, 'info': 0xF02FD, 'crown': 0xF11D0, 'up': 0xF0143, 'down': 0xF0140, 'dots': 0xF01D9,
        'plus': 0xF0415, 'addplayer': 0xF0801, 'shield': 0xF0A12, 'unreg': 0xF0B5A, 'link': 0xF0339, 'right': 0xF0142,
        'seat': 0xF0CC4, 'wifi': 0xF05A9, 'signal': 0xF04A2, 'battery': 0xF0079, 'invite': 0xF1165, 'case': 0xF0B34,
        'pencil': 0xF0CB6, 'makeadmin': 0xF0ADB, 'remove': 0xF0AED}

# The two CI phones. `fs` is Android's text size; `sb` is the status bar as the frames show it: 24 dp on both
# phones in run 46035664063, 49 dp on the Pixel 6 of the Nov 26 nightly (PIXEL6_NIGHTLY, for the frame of flow 32).
PIXEL6 = dict(w=412, h=915, fs=1.0, scale=2.625, sb=24)
PIXEL6_NIGHTLY = dict(PIXEL6, sb=49)
SMALL = dict(w=360, h=780, fs=1.3, scale=3.0, sb=24)

# Android 14 and later do not multiply text by the font scale: small text grows by the full 1.3, large text by
# less (AOSP FontScaleConverterFactory, the 1.3 table). The CI small phone is API 34 and its frames agree.
SP_130 = ([8, 10, 12, 14, 18, 20, 24, 30, 100], [10.4, 13, 15.6, 18.8, 21.6, 23.6, 26.4, 30, 100])

def sp(size, fs):
    if fs == 1 or size >= 100: return size
    src, dst = SP_130
    if size <= src[0]: return size * fs
    for i in range(1, len(src)):
        if size <= src[i]:
            return dst[i - 1] + (size - src[i - 1]) / (src[i] - src[i - 1]) * (dst[i] - dst[i - 1])


def css(c, fs, sb):
    f = lambda n: f'{sp(n, fs):.2f}px'                     # N sp at this text size
    t = lambda size, line, weight, track=0: f'font-size:{f(size)};line-height:{f(line)};font-weight:{weight};letter-spacing:{track * fs:.2f}px'
    return f"""
*{{box-sizing:border-box;margin:0;padding:0}}
@font-face{{font-family:Rb;src:url('file://{ROBOTO}');font-weight:100 900}}
@font-face{{font-family:MDI;src:url('file://{MDI}')}}
html,body{{background:{c['bg']};color:{c['ink']};font-family:Rb,Roboto,'Noto Sans',Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;position:relative}}
.mdi{{font-family:MDI;font-style:normal;font-weight:400;line-height:1;display:inline-block;flex:none}}
.ell{{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}}
.muted{{color:{c['muted']}}}
/* Paper's MD3 type with constants/theme.ts fontOverrides */
.body-l{{{t(16, 24, 400, .15)}}} .body-s{{{t(14, 20, 400, .4)}}} .title-s{{{t(14, 20, 700, .1)}}}
.label-m{{{t(14, 18, 700, .5)}}} .label-s{{{t(13, 16, 500, .8)}}} .title-m{{{t(14, 20, 500, .1)}}}
/* system and navigation chrome */
.status{{position:absolute;left:0;right:0;top:0;height:{sb}px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 14px 3px 12px;font-size:14px;font-weight:500;color:{c['chrome']};z-index:5}}
.status .r{{display:flex;gap:3px;font-size:15px}}
.hdr{{position:absolute;left:0;right:0;top:{sb}px;height:56px;display:flex;align-items:center;background:{c['bg']};z-index:4}}
.hdr .back{{font-size:24px;margin-left:16px;width:24px}}
.hdr h1{{font-size:{f(20)};font-weight:700;margin-left:32px;flex:1}}
.hdr .help{{font-size:22px;margin:0 29px 0 20px}}
.nav{{position:absolute;left:0;right:0;bottom:0;height:48px;z-index:6}}
.nav i{{position:absolute;top:50%;transform:translate(-50%,-50%);background:{c['nav']}}}
.nav .b{{left:25%;width:0;height:0;background:none;border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:12px solid {c['nav']}}}
.nav .h{{left:50%;width:14px;height:14px;border-radius:50%}} .nav .s{{left:75%;width:13px;height:13px;border-radius:2px}}
/* components/ui/BottomBar.tsx + AppButton.tsx */
.bbar{{position:absolute;left:0;right:0;bottom:0;background:{c['surface']};border-top:1px solid {c['outlinev']};padding:12px 16px 60px;display:flex;z-index:3}}
.btn{{flex:1;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:10px;{t(16, 20, 800)};white-space:nowrap;min-width:0}}
.btn .mdi{{font-size:18px}} .btn span{{overflow:hidden;text-overflow:ellipsis}}
.btn.fill{{background:{c['primary']};color:{c['onprimary']};border-bottom:4px solid {c['edge']};height:52px}}
.btn.out{{border:2px solid {c['outline']};color:{c['primary']};min-height:60px;{t(17, 20, 800)}}}
.btn.off{{border-color:{c['outlinev']};color:{c['disabled']}}}
.page{{position:absolute;left:0;right:0;top:{sb + 56}px;overflow:hidden}}
.av{{width:36px;height:36px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none;letter-spacing:.3px;font-size:{f(14.4)}}}
.av.mute{{background:{c['surfv']} !important;color:{c['muted']}}}
.ib{{display:flex;align-items:center;justify-content:center;flex:none;color:{c['muted']}}}
.ib.off{{color:{c['disabled']}}}
/* TODAY: app/(screens)/games/players.tsx */
.t-pad{{padding:12px 16px 24px;display:flex;flex-direction:column;gap:8px}}
.t-sec{{display:flex;align-items:center;gap:2px;margin-top:8px}}
.tip{{width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:18px;color:{c['muted']};flex:none}}
.t-card{{background:{c['surface']};border:.5px solid {c['outlinev']};border-radius:16px;padding:0 8px}}
.t-row{{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:.5px solid {c['hair']}}}
.t-text{{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}}
.t-text .name{{font-weight:500}}
.t-tags{{display:flex;flex-wrap:wrap;gap:4px}}
.tag{{display:inline-flex;align-items:center;gap:4px;padding:0 10px;min-height:32px;border-radius:999px;min-width:0;max-width:100%;background:{c['surfv']};color:{c['muted']}}}
.tag .mdi{{font-size:16px}} .tag b{{{t(14, 18, 700, .5)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.tag.lead{{background:{c['leaderc']};color:{c['onleaderc']}}} .tag.info{{background:{c['infoc']};color:{c['oninfoc']}}} .tag.res{{background:{c['primaryc']};color:{c['onprimaryc']}}}
.t-arrows{{display:flex;flex:none}} .t-arrows .ib{{width:46px;height:46px;font-size:18px}} .t-arrows .ib.off{{color:{c['disabled']}}}
.t-dots{{width:52px;height:52px;font-size:24px}}
.t-add{{margin-top:8px;display:flex;flex-direction:column;gap:4px}}
.t-add .note{{text-align:center}}
/* PROPOSED: SettingsGroup + ListRow */
.p-pad{{padding:8px 16px 24px}}
.grp{{margin-bottom:12px}}
.gh{{display:flex;align-items:center;gap:4px;padding:8px 0 4px;min-height:40px;color:{c['muted']}}}
.gh span{{text-transform:uppercase}}
.gnote{{padding-bottom:4px}}
.lr{{display:flex;align-items:center;gap:12px;min-height:60px;padding:4px 0}}
.lr+.lr{{border-top:.5px solid {c['hair']}}}
.lr .tx{{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}}
.lr .ti{{font-weight:500}}
.lr .de{{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
.lr .slot{{width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:22px;color:{c['muted']};flex:none}}
.lr .chev{{font-size:22px;color:{c['muted']}}}
.lr .dots{{width:22px;height:48px;font-size:24px}}
.lr .arrows{{display:flex;flex:none;margin-right:6px}} .lr .arrows .ib{{width:46px;height:46px;font-size:18px}} .lr .arrows .ib.off{{color:{c['disabled']}}}
/* Paper Menu (the row ⋮), unchanged */
.scrim{{position:absolute;inset:0;z-index:7}}
.menu{{position:absolute;right:16px;background:{c['surface']};border-radius:4px;padding:8px 0;box-shadow:0 3px 10px rgba(0,0,0,.28);z-index:8;min-width:232px}}
.menu div{{height:48px;display:flex;align-items:center;gap:12px;padding:0 16px 0 12px;{t(16, 24, 400, .15)}}}
.menu .mdi{{font-size:24px;color:{c['muted']}}}
"""

FIT_JS = """<script>document.fonts.ready.then(()=>{document.querySelectorAll('[data-scroll-end]').forEach(p=>{
const y=Math.max(0,p.scrollHeight-p.parentElement.clientHeight);p.style.transform='translateY('+(-y)+'px)'});
document.querySelectorAll('[data-menu-for]').forEach(m=>{const r=document.getElementById(m.dataset.menuFor).getBoundingClientRect();m.style.top=(r.top+6)+'px'})})</script>"""


def mdi(name, cls='', style=''):
    return f'<i class="mdi {cls}" style="{style}">{chr(ICON[name])}</i>'

def initials(name): return ''.join(w[0] for w in name.split())[:2].upper()

def avatar(p, index):
    mute = ' mute' if p.get('watching') else ''
    return f'<div class="av{mute}" style="background:{SEAT[index % 10]}">{p.get("ini") or initials(p["name"])}</div>'

def chrome_top(title, time_='4:58'):
    return (f'<div class="status"><span>{time_}</span><span class="r">{mdi("wifi")}{mdi("signal")}{mdi("battery")}</span></div>'
            f'<div class="hdr">{mdi("back", "back")}<h1 class="ell">{title}</h1>{mdi("help", "help")}</div>')

NAV = '<div class="nav"><i class="b"></i><i class="h"></i><i class="s"></i></div>'
ADD_BAR = f'<div class="bbar"><div class="btn fill">{mdi("addplayer")}<span>Add new player</span></div></div>'

# What a row says. Today these are three kinds of tag; proposed they are one grey line under the name.
# utils/gameAccess.ts visibleRoleTag: Creator to everyone, Admin only to people who run the game.
def role_of(p, manages): return 'Creator' if p.get('role') == 'Creator' else ('Admin' if p.get('role') == 'Admin' and manages else None)

def groups_of(table):
    return ([p for p in table if not p.get('unseated') and not p.get('watching')],
            [p for p in table if p.get('unseated')], [p for p in table if p.get('watching')])


# ---------- TODAY -----------------------------------------------------------------------------------------
def today(dev, table, viewer='admin', scroll_end=False, title='Players · Admins · S2', time_='4:58'):
    manages = viewer != 'player'
    playing, unseated, watching = groups_of(table)

    def row(p, index, pos, count, arrows):
        tags = f'<span class="tag"><b>#{p["no"]}</b></span>'
        role = role_of(p, manages)
        if role == 'Creator': tags += f'<span class="tag lead">{mdi("crown")}<b>Creator</b></span>'
        if role == 'Admin': tags += f'<span class="tag info">{mdi("shield")}<b>Admin</b></span>'
        if p.get('reg') == 'Unregistered': tags += f'<span class="tag">{mdi("unreg")}<b>Unregistered</b></span>'
        if p.get('reg') == 'Link pending': tags += f'<span class="tag res">{mdi("link")}<b>Link pending</b></span>'
        ar = ''
        if manages and arrows:
            ar = (f'<div class="t-arrows"><span class="ib {"off" if pos == 0 else ""}">{mdi("up")}</span>'
                  f'<span class="ib {"off" if pos == count - 1 else ""}">{mdi("down")}</span></div>')
        dots = f'<span class="ib t-dots">{mdi("dots")}</span>' if manages and not p.get('watching') else ''
        return (f'<div class="t-row">{avatar(p, index)}<div class="t-text"><div class="body-l name ell">{p["name"]}</div>'
                f'<div class="t-tags">{tags}</div></div>{ar}{dots}</div>')

    def card(rows): return f'<div class="t-card">{rows}</div>'
    tip = f'<span class="tip">{mdi("info")}</span>' if manages else ''
    body = f'<div class="t-sec"><span class="title-m">Playing · {len(playing)}</span>{tip}</div>'
    body += card(''.join(row(p, i, i, len(playing), True) for i, p in enumerate(playing)))
    if unseated:
        body += '<div class="title-s" style="margin-top:8px">Admins not playing</div>'
        body += card(''.join(row(p, len(playing) + i, i, len(unseated), False) for i, p in enumerate(unseated)))
    if watching:
        body += '<div class="title-s" style="margin-top:8px">Watching</div>'
        body += card(''.join(row(p, len(playing) + len(unseated) + i, i, len(watching), False) for i, p in enumerate(watching)))
    if manages:
        body += (f'<div class="t-add"><div class="btn out">{mdi("plus")}<span>Add non-playing admin</span></div>'
                 f'<div class="body-s muted note">Someone who keeps score but does not play. Enter their Player ID (#NN). They can add and edit rounds; they get no column.</div></div>')
    bottom = 124 if manages else 48
    end = ' data-scroll-end' if scroll_end else ''
    page = f'<div class="page" style="bottom:{bottom}px"><div class="t-pad"{end}>{body}</div></div>'
    return chrome_top(title, time_) + page + (ADD_BAR if manages else '') + NAV


# ---------- PROPOSED --------------------------------------------------------------------------------------
ORDER_ROW = ('seat', 'Order of players', 'Move a player to another seat')
ADMIN_ROW = ('plus', 'Add non-playing admin', 'Keeps score, does not play. By Player ID.')
CLOSED_NOTE = 'This game is Closed (it is part of a saved result). Admins can no longer be added.'

def proposed(dev, table, viewer='admin', arrows_stay=False, state='active', scroll_end=False, menu_for=None,
             title='Players · Admins · S2', time_='4:58'):
    """viewer: admin | player.  state: active | completed | closed.  arrows_stay: option B."""
    manages = viewer != 'player'
    can_order = manages and state == 'active'
    playing, unseated, watching = groups_of(table)

    def row(p, index, pos, count, seated):
        line = ' · '.join(x for x in [f'#{p["no"]}', role_of(p, manages), p.get('reg')] if x)
        right = ''
        if manages and arrows_stay and seated and can_order:
            right += (f'<div class="arrows"><span class="ib {"off" if pos == 0 else ""}">{mdi("up")}</span>'
                      f'<span class="ib {"off" if pos == count - 1 else ""}">{mdi("down")}</span></div>')
        if manages and not p.get('watching'):
            right += f'<span class="ib dots" id="dots-{p["no"]}">{mdi("dots")}</span>'
        return (f'<div class="lr">{avatar(p, index)}<div class="tx"><div class="body-l ti ell">{p["name"]}</div>'
                f'<div class="body-s muted de">{line}</div></div>{right}</div>')

    def action(icon, label, sub):
        return (f'<div class="lr"><div class="slot">{mdi(icon)}</div><div class="tx"><div class="body-l ti ell">{label}</div>'
                f'<div class="body-s muted de">{sub}</div></div>{mdi("right", "chev")}</div>')

    def group(heading, rows, tip=False, note=''):
        info = f'<span class="tip" style="margin:-6px 0">{mdi("info")}</span>' if tip else ''
        n = f'<div class="body-s muted gnote">{note}</div>' if note else ''
        return f'<div class="grp"><div class="gh"><span class="label-s">{heading}</span>{info}</div>{n}{rows}</div>'

    rows = ''.join(row(p, i, i, len(playing), True) for i, p in enumerate(playing))
    if can_order and not arrows_stay: rows += action(*ORDER_ROW)
    body = group(f'Playing · {len(playing)}', rows, tip=manages)
    admin_rows = ''.join(row(p, len(playing) + i, i, len(unseated), False) for i, p in enumerate(unseated))
    if manages and state != 'closed': admin_rows += action(*ADMIN_ROW)
    if admin_rows or manages:
        body += group('Admins not playing', admin_rows, tip=manages, note=CLOSED_NOTE if manages and state == 'closed' else '')
    if watching:
        body += group('Watching', ''.join(row(p, len(playing) + len(unseated) + i, i, len(watching), False) for i, p in enumerate(watching)))
    bottom = 124 if manages else 48
    end = ' data-scroll-end' if scroll_end else ''
    page = f'<div class="page" style="bottom:{bottom}px"><div class="p-pad"{end}>{body}</div></div>'
    menu = ''
    if menu_for:
        items = [('invite', 'Invite to EZ Score'), ('link', 'Link to Player ID'), ('case', 'Edit initials'), ('pencil', 'Edit name'),
                 ('makeadmin', 'Make admin'), ('remove', 'Remove from game')]
        menu = (f'<div class="scrim"></div><div class="menu" data-menu-for="dots-{menu_for}">'
                + ''.join(f'<div>{mdi(i)}{label}</div>' for i, label in items) + '</div>')
    return chrome_top(title, time_) + page + (ADD_BAR if manages else '') + NAV + menu


# ---------- tables ----------------------------------------------------------------------------------------
P = lambda name, no, **kw: dict(name=name, no=no, **kw)
# The seeded games the CI frames show (supabase/seed-e2e.sql): game E and the game of flow full/32.
FOUR = [P('Sree Test', 1, role='Creator'), P('Harish Test', 2), P('Priya Test', 3), P('Zed Zero', 8)]
FIVE = [P('Sree Test', 1, role='Creator'), P('Harish Test', 2), P('C D', 11, reg='Unregistered'), P('R K', 9, reg='Unregistered'),
        P('Priya Test', 3), P('Otto Outsider', 5, role='Admin', unseated=True)]
# Thirteen at one table, the usual mix: a few accounts, most added by initials (D113), one long name.
THIRTEEN = [P('Sree Test', 1, role='Creator'), P('Harish Test', 2, role='Admin'), P('Priya Test', 3), P('Meena Iyer', 124),
            P('Venkateswara Rao', 57), P('C D', 11, reg='Unregistered'), P('R K', 9, reg='Unregistered'), P('Kiran Rao', 123),
            P('S M', 14, reg='Unregistered'), P('A R', 15, reg='Link pending'), P('Lakshmi Narayanan', 88),
            P('B P', 16, reg='Unregistered'), P('Zed Zero', 8)]
# Every kind of row on one screen.
EVERY = FIVE[:5] + [P('A R', 15, reg='Link pending'), P('Otto Outsider', 5, role='Admin', unseated=True), P('Nina Watcher', 6, watching=True)]


# ---------- rendering -------------------------------------------------------------------------------------
def render(name, body, dev, theme=LIGHT):
    w, h = dev['w'], dev['h']
    html = (f'<!doctype html><html><head><meta charset="utf-8"><style>html,body{{width:{w}px;height:{h}px}}{css(theme, dev["fs"], dev["sb"])}</style></head>'
            f'<body>{body}{FIT_JS}</body></html>')
    p = os.path.join(TMP, name + '.html'); open(p, 'w').write(html)
    png = os.path.join(TMP, name + '.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
                             f'--force-device-scale-factor={dev["scale"]}', f'--user-data-dir={TMP}/u-{name}', f'--window-size={w},{h}',
                             '--virtual-time-budget=3000', f'--screenshot={png}', 'file://' + p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(400):                                     # this Chrome does not always exit after the screenshot
        if proc.poll() is not None: break
        if os.path.exists(png) and os.path.getsize(png) > 0: time.sleep(0.4); break
        time.sleep(0.1)
    if proc.poll() is None: proc.kill(); proc.wait()
    assert os.path.exists(png), name
    return Image.open(png).convert('RGB')

def ci(name): return Image.open(os.path.join(CI, name + '.png')).convert('RGB')

FONT = '/usr/share/fonts/truetype/dejavu/'
def font(size, bold=False):
    try: return ImageFont.truetype(FONT + ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'), size)
    except OSError: return ImageFont.load_default()

def wrap(d, text, f, width):
    lines = []
    for para in text.split('\n'):
        line = ''
        for word in para.split(' '):
            trial = (line + ' ' + word).strip()
            if d.textlength(trial, font=f) <= width or not line: line = trial
            else: lines.append(line); line = word
        lines.append(line)
    return lines

def sheet(path, title, sub, rows, panel_w, pad=28, gap=28):
    """rows: lists of (image, heading, heading colour, caption). Every panel is scaled to panel_w wide."""
    scaled = [[(im.resize((panel_w, round(im.height * panel_w / im.width)), Image.LANCZOS), h, col, cap) for im, h, col, cap in row] for row in rows]
    cols = max(len(row) for row in scaled)
    W = pad * 2 + cols * panel_w + gap * (cols - 1)
    probe = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    tf, sf, hf, cf = font(26, True), font(18), font(19, True), font(17)
    title_lines = wrap(probe, title, tf, W - pad * 2)
    sub_lines = wrap(probe, sub, sf, W - pad * 2)
    top = 22 + len(title_lines) * 34 + 6 + len(sub_lines) * 25 + 14
    blocks = []
    for row in scaled:
        heads = [wrap(probe, h, hf, panel_w) for _, h, _, _ in row]
        caps = [wrap(probe, cap, cf, panel_w) for _, _, _, cap in row]
        head_h = max(len(h) for h in heads) * 25 + 8
        blocks.append((row, heads, caps, head_h, head_h + max(im.height for im, *_ in row) + 10 + max(len(c) for c in caps) * 23 + 24))
    out = Image.new('RGB', (W, top + sum(b[4] for b in blocks) + 6), 'white'); d = ImageDraw.Draw(out)
    for i, line in enumerate(title_lines): d.text((pad, 20 + i * 34), line, fill='#17201B', font=tf)
    for i, line in enumerate(sub_lines): d.text((pad, 22 + len(title_lines) * 34 + 6 + i * 25), line, fill='#4E5752', font=sf)
    y = top
    for row, heads, caps, head_h, height in blocks:
        x = pad
        for (im, _, col, _), head, cap in zip(row, heads, caps):
            for i, line in enumerate(head): d.text((x, y + i * 25), line, fill=col, font=hf)
            out.paste(im, (x, y + head_h)); d.rectangle([x - 1, y + head_h - 1, x + panel_w, y + head_h + im.height], outline='#bbbbbb')
            for i, line in enumerate(cap): d.text((x, y + head_h + im.height + 10 + i * 23), line, fill='#4E5752', font=cf)
            x += panel_w + gap
        y += height
    out.save(path, optimize=True); print(os.path.relpath(path, HERE), out.size)

GREY, GREEN, AMBER = '#555555', '#0E4D2A', '#8A5A00'
TODAY_CI = 'Today (CI frame)'
A = 'Proposed A (drawn) · recommended'


def main():
    if '--check' in sys.argv:
        out = '/tmp/players-admins-check'; os.makedirs(out, exist_ok=True)
        for tag_, dev, frame, table, kw in (('pixel6-4p', PIXEL6, 'pixel6-4p', FOUR, {}), ('small-4p', SMALL, 'small-4p', FOUR, dict(time_='4:56')),
                                            ('pixel6-5p', PIXEL6_NIGHTLY, 'pixel6-5p-admin-not-playing', FIVE, dict(title='Players · Admins · S3', time_='7:45'))):
            drawn = render('check-' + tag_, today(dev, table, **kw), dev)
            sheet(os.path.join(out, tag_ + '.png'), tag_, 'CI frame beside the drawing of the same screen (today, no change applied).',
                  [[(ci(frame), 'CI', GREY, ''), (drawn, 'Drawn', GREEN, '')]], 540)

    r = lambda name, body, dev=PIXEL6, theme=LIGHT: render(name, body, dev, theme)

    sheet(os.path.join(HERE, 'players-admins-s.png'), 'Players · Admins in the Size S look (Pixel 6, 4 players)',
          'Today: a bordered card, tags inside it, three small buttons on every row, and a second big outlined button above the real one. '
          'Proposed: the same grouped list as Profile and Settings. Every action is still on the screen; two of them changed shape.',
          [[(ci('pixel6-4p'), TODAY_CI, GREY, 'Card, tags, ▲ ▼ ⋮ on every row; "Add non-playing admin" is a second pill with three lines under it.'),
            (r('a-p6-4', proposed(PIXEL6, FOUR)), A, GREEN,
             'One grey line under each name: "#1 · Creator". The row keeps its ⋮. The arrows became one row, "Order of players". "Add non-playing admin" became a row; the three lines that sat under it open from the (i) beside "Admins not playing".'),
            (r('a-p6-4-dark', proposed(PIXEL6, FOUR), theme=DARK), 'Proposed A · dark', GREEN, 'Same screen, dark.')]], 412)

    sheet(os.path.join(HERE, 'players-admins-s-360.png'), 'The same screen on a small phone (360 dp, text size 1.3)',
          'Today the tags and the arrows leave the name 106 dp: the Creator tag is cut and the note under the outlined button runs under the bar. '
          'A gives the name the whole row. B is A with the arrows left on every row, drawn so the difference can be seen.',
          [[(ci('small-4p'), TODAY_CI, GREY, '"Creat…" is cut. Three buttons per row. The last line of the note is under the bar.'),
            (r('a-sm-4', proposed(SMALL, FOUR, time_='4:56'), SMALL), A, GREEN, 'Nothing cut. All four players, both rows and the button fit on one screen.'),
            (r('b-sm-4', proposed(SMALL, FOUR, arrows_stay=True, time_='4:56'), SMALL), 'B (drawn) · the arrows stay on every row', AMBER,
             'Nothing cut with these short names; a long one is (the name has 136 dp, so "Venkateswara Rao" is cut). Each row keeps three buttons, and ▲ here still means the opposite of ▲ in Order of players.')]], 432)

    sheet(os.path.join(HERE, 'players-admins-s-13.png'), 'Thirteen players (the first screen, then the end of the list)',
          'CI has no frame of this screen with 13 players, so "today" here is drawn from the code\'s sizes (the 4- and 5-player drawings were checked against the CI frames first). '
          'Most of a real table is added by initials, so most rows carry the Unregistered tag.',
          [[(r('t-p6-13', today(PIXEL6, THIRTEEN, title='Players · Admins · P1')), 'Today (drawn) · Pixel 6', GREY, '7 of 13 players on the first screen. Unregistered rows are three lines tall.'),
            (r('a-p6-13', proposed(PIXEL6, THIRTEEN, title='Players · Admins · P1')), A + ' · Pixel 6', GREEN, '11 of 13 on the first screen. Every row is the same height.'),
            (r('a-p6-13-end', proposed(PIXEL6, THIRTEEN, scroll_end=True, title='Players · Admins · P1')), 'Proposed A · Pixel 6 · scrolled to the end', GREEN,
             'The two rows that replace the arrows and the outlined button sit after the last player.')],
           [(r('t-sm-13', today(SMALL, THIRTEEN, title='Players · Admins · P1'), SMALL), 'Today (drawn) · small phone', GREY, '5 of 13 on the first screen. Cut: Creator, Unregistered, Link pending, and the names Venkateswara Rao and Lakshmi Narayanan.'),
            (r('a-sm-13', proposed(SMALL, THIRTEEN, title='Players · Admins · P1'), SMALL), A + ' · small phone', GREEN, '8 of 13 on the first screen. Nothing is cut; the name has 246 dp.'),
            (r('a-sm-13-end', proposed(SMALL, THIRTEEN, scroll_end=True, title='Players · Admins · P1'), SMALL), 'Proposed A · small phone · scrolled to the end', GREEN,
             'Same two rows at the end.')]], 400)

    sheet(os.path.join(HERE, 'players-admins-s-states.png'), 'Every kind of row, and who sees what',
          'Top: the CI frame with unregistered players and an admin who is not playing, beside the same game proposed. '
          'Bottom: a table with every kind of row at once, as the creator or an admin sees it, with a row\'s ⋮ open, as a plain player sees it, and once the game is Closed.',
          [[(ci('pixel6-5p-admin-not-playing'), TODAY_CI + ' · nightly, flow 32', GREY, 'Unregistered wraps under the Player ID. The outlined button is half under the bar.'),
            (r('a-p6-5', proposed(PIXEL6_NIGHTLY, FIVE, title='Players · Admins · S3', time_='7:45'), PIXEL6_NIGHTLY), A, GREEN,
             '"#11 · Unregistered" on one line. Otto, who keeps score but does not play, and the row that adds another, are one group.')],
           [(r('a-p6-every', proposed(PIXEL6, EVERY, title='Players · Admins · S3')), 'Proposed A · creator or admin', GREEN,
             'Creator, Unregistered, Link pending, an admin not playing, someone watching (grey disc, no ⋮, as today).'),
            (r('a-p6-menu', proposed(PIXEL6, EVERY, menu_for=11, title='Players · Admins · S3')), 'Proposed A · the ⋮ of C D, unchanged', GREEN,
             'The same six actions in the same order as today. Every dialog behind them is unchanged.'),
            (r('a-p6-player', proposed(PIXEL6, EVERY, viewer='player', title='Players · Admins · S3')), 'Proposed A · a plain player', GREEN,
             'Names and Player IDs only, as today: no ⋮, no (i) tip, no action rows, no button; "Admin" is not shown to players.'),
            (r('a-p6-closed', proposed(PIXEL6, EVERY, state='closed', title='Players · Admins · S3')), 'Proposed A · the game is Closed', GREEN,
             'No Order of players row (today: no arrows). The reason admins cannot be added is the grey line; today it sits under a greyed button. The ⋮ and Add new player stay, as today.')]], 400)
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == '__main__':
    main()
