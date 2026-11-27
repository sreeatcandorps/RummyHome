#!/usr/bin/env python3
"""Small-phone layout findings (next-up row 12g): today beside proposed at 360 dp, font scale 1.3.

Today  = the CI frames in ci/ (run 45878556049, main @ 3c0ea575: the `small` row is the Pixel 4a profile
         at 360 x 780 dp, font 1.3; the Pixel 6 row is 412 x 915 dp, font 1.0). CI takes no frame of Home
         sideways, so that one is drawn from the code's sizes and the bounds in the run's Maestro log.
Proposed = the same screens drawn to the code's sizes (dp = CSS px, sp through Android 14's font-scale
         table, see sp()) in headless Chrome, with only the proposed change applied. Every proposal is the
         same switch, roomy(): the one Order of players already uses to hide the Player ID.

Usage:
  pip install pillow
  python3 make-small-phone-360.py            # writes the pictures beside this file
  python3 make-small-phone-360.py --check    # also draws TODAY's screens and writes them beside the CI
                                             # frames to /tmp/small-360-check/, to see that the drawing
                                             # matches the app before trusting the proposed ones

Fonts: Roboto (variable) is read from $ROBOTO_VF (default /tmp/fonts/RobotoVF.ttf; the file is
"Roboto[wdth,wght].ttf" in github.com/google/fonts, ofl/roboto). Without it Chrome falls back to its own
sans and the widths, so what is cut and what fits, are no longer the phone's. Icons are the app's own
MaterialCommunityIcons.ttf from node_modules (run `npm ci` in rummy-home3 first).
"""
import os, re, shutil, subprocess, sys, tempfile, time
from string import Template
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..', '..'))
CI = os.path.join(HERE, 'ci')
CHROME = os.environ.get('CHROME', '/usr/local/bin/google-chrome')
ROBOTO = os.environ.get('ROBOTO_VF', '/tmp/fonts/RobotoVF.ttf')
MDI = os.path.join(APP, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf')
LOGO = os.path.join(APP, 'assets/icon-small.png')
TMP = tempfile.mkdtemp(prefix='small360-')

# constants/theme.ts, light (Palette B, D65)
C = dict(bg='#F5F2E8', surface='#FFFFFF', ink='#1A1F1B', muted='#5A615B', hair='#E6E1D3', outline='#8E928A',
         primary='#0E4D2A', edge='#083820', primaryc='#D8ECDD', onprimaryc='#0B3B1F', secc='#F0DFAE', onsecc='#3E2E07',
         sec='#8A6A1E', surfv='#ECE7DA', infoc='#DCE8FF', oninfoc='#0F2B63', posc='#D6F5DF', leaderc='#FFF0BF', onleaderc='#3F2D00',
         win='#0C6331', loss='#A8201A')
SEAT = ['#0F766E', '#C2410C', '#1D4ED8', '#A21CAF', '#6D28D9', '#0E7490', '#92400E', '#BE123C', '#3F6212', '#475569']
ICON = {'back': 0xF004D, 'help': 0xF0625, 'flag': 0xF023C, 'trophy': 0xF053A, 'clock': 0xF0150, 'okcircle': 0xF05E1,
        'info': 0xF02FD, 'crown': 0xF11D0, 'dot': 0xF09DE, 'people': 0xF000F, 'right': 0xF0142, 'up': 0xF0143, 'down': 0xF0140,
        'play': 0xF040A, 'seat': 0xF0CC4, 'playcircle': 0xF040D, 'podium': 0xF0D25, 'group': 0xF0849, 'plus': 0xF0415,
        'cards': 0xF063A, 'history': 0xF02DA, 'home': 0xF02DE, 'checked': 0xF0132, 'check': 0xF012C, 'list': 0xF0572,
        'wifi': 0xF05A9, 'signal': 0xF04A2, 'battery': 0xF0079}

# The two CI phones. `fs` is the font scale set in Android's settings; `sb` is the status bar upright
# (the Pixel 6's is tall because of its camera hole, which sits on the left edge when the phone is sideways).
SMALL = dict(w=360, h=780, fs=1.3, scale=3.0, sb=24)
PIXEL6 = dict(w=412, h=915, fs=1.0, scale=2.625, sb=49)

# Android 14 and later (the CI small phone is API 34) do not multiply text by the font scale: small text
# grows by the full 1.3 and large text by less (AOSP FontScaleConverterFactory, the 1.3 table). The CI
# frames agree: an 18 sp title measures 21.6 dp, the 24 sp "Hi Sree" 26.4 dp, a 16 / 24 body line 26.4 dp tall.
SP_130 = ([8, 10, 12, 14, 18, 20, 24, 30, 100], [10.4, 13, 15.6, 18.8, 21.6, 23.6, 26.4, 30, 100])

def sp(size, fs):
    if fs == 1 or size >= 100: return size
    src, dst = SP_130
    if size <= src[0]: return size * fs
    for i in range(1, len(src)):
        if size <= src[i]:
            return dst[i - 1] + (size - src[i - 1]) / (src[i] - src[i - 1]) * (dst[i] - dst[i - 1])

# The one switch every proposal uses: the Order of players list already hides the Player ID with it
# (utils/seating.ts showsPlayerCode: rowWidth / fontScale >= 330).
def roomy(width, fs): return width / max(fs, 1) >= 330

CSS = Template("""
*{box-sizing:border-box;margin:0;padding:0}
@font-face{font-family:Rb;src:url('file://$roboto');font-weight:100 900}
@font-face{font-family:MDI;src:url('file://$mdi')}
html,body{background:$bg;color:$ink;font-family:Rb,Roboto,'Noto Sans',Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;position:relative}
.mdi{font-family:MDI;font-style:normal;font-weight:400;line-height:1;display:inline-block;flex:none}
/* constants/theme.ts fontOverrides on Paper's MD3 scale: body 16, nothing under 13. calc(Npx*var(--fs)) is N sp: render() resolves it with sp(). */
.hl{font-size:calc(24px*var(--fs));line-height:calc(32px*var(--fs));font-weight:700}
.tl{font-size:calc(22px*var(--fs));line-height:calc(28px*var(--fs));font-weight:700}
.tm{font-size:calc(18px*var(--fs));line-height:calc(24px*var(--fs));font-weight:700;}
.ts{font-size:calc(14px*var(--fs));line-height:calc(20px*var(--fs));font-weight:500;letter-spacing:calc(.1px*var(--fs))}
.bm{font-size:calc(16px*var(--fs));line-height:calc(24px*var(--fs));letter-spacing:calc(.1px*var(--fs))}
.bs{font-size:calc(14px*var(--fs));line-height:calc(20px*var(--fs));letter-spacing:calc(.4px*var(--fs))}
.ll{font-size:calc(16px*var(--fs));line-height:calc(20px*var(--fs));font-weight:700;letter-spacing:calc(.1px*var(--fs))}
.lm{font-size:calc(14px*var(--fs));line-height:calc(18px*var(--fs));font-weight:700;letter-spacing:calc(.5px*var(--fs))}
.ls{font-size:calc(13px*var(--fs));line-height:calc(16px*var(--fs));font-weight:500;letter-spacing:calc(.5px*var(--fs))}
.muted{color:$muted} .b6{font-weight:400} .b7{font-weight:700} .b8{font-weight:700}
.ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.nums{font-variant-numeric:tabular-nums}
.row{display:flex;align-items:center}
/* system + navigation chrome */
.status{position:absolute;left:0;right:0;top:0;height:var(--sb);display:flex;align-items:flex-end;padding-bottom:3px;justify-content:space-between;padding:0 14px 0 12px;font-size:14px;font-weight:500;color:#3c4043;z-index:5}
.status .r{display:flex;gap:3px;font-size:15px}
.hdr{position:absolute;left:0;right:0;top:var(--sb);height:56px;display:flex;align-items:center;background:$bg;z-index:4}
.hdr .back{font-size:24px;margin-left:16px;width:24px}
.hdr h1{font-size:calc(20px*var(--fs));font-weight:700;margin-left:32px;flex:1}
.hdr .help{font-size:24px;margin-right:29px}
.hdr.tabs{height:64px}
.hdr.tabs .disc{width:40px;height:40px;border-radius:50%;background:$secc;margin-left:16px;display:flex;align-items:center;justify-content:center}
.hdr.tabs .disc img{width:28px;height:28px;border-radius:50%}
.hdr.tabs h1{margin-left:8px;font-weight:700;font-size:calc(22px*var(--fs))}
.nav{position:absolute;left:0;right:0;bottom:0;height:48px;z-index:6}
.nav i{position:absolute;top:50%;transform:translate(-50%,-50%);background:#5f6368}
.nav .b{left:25%;width:0;height:0;background:none;border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:12px solid #5f6368}
.nav .h{left:50%;width:14px;height:14px;border-radius:50%} .nav .s{left:75%;width:13px;height:13px;border-radius:2px}
.nav.side{left:auto;right:0;top:0;bottom:0;width:48px;height:auto;background:$bg}
.nav.side i{left:50%} .nav.side .b{top:75%} .nav.side .h{top:50%} .nav.side .s{top:25%}
.nav.scrim{background:rgba(255,255,255,.82)}
.bbar{position:absolute;left:0;right:0;bottom:0;background:$surface;border-top:1px solid $hair;padding:12px 16px 60px;display:flex;gap:8px;z-index:3}
.btn{height:52px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:calc(16px*var(--fs));line-height:calc(20px*var(--fs));font-weight:700;min-width:0;white-space:nowrap}
.btn .mdi{font-size:18px;margin-right:8px}
.btn span{overflow:hidden;text-overflow:ellipsis}
.btn.fill{background:$primary;color:#fff;border-bottom:4px solid $edge;height:56px;padding:0 7px 0 8px}
.btn.out{border:2px solid $outline;color:$primary;padding:0 5px 0 6px;height:56px}
.bbar.short{padding:10px 16px 58px}
.btn.accent{background:$secc;color:$onsecc;height:56px;font-size:calc(17px*var(--fs));letter-spacing:.2px;padding:0 7px 0 8px}
.chip{height:42px;border-radius:999px;display:flex;align-items:center;padding:0 10px;font-size:calc(16px*var(--fs));font-weight:700;white-space:nowrap}
.chip.on{background:$primary;color:#fff;border-bottom:4px solid $edge;height:44px} .chip.off{border:2px solid $outline;color:$primary} .chip.dim{opacity:.45}
.chip .mdi{font-size:18px;margin-right:6px}
/* Paper Chip, the Results filter */
.pchip{height:36px;display:flex;align-items:center;padding:0 16px;font-size:calc(16px*var(--fs));font-weight:700;white-space:nowrap;border-radius:999px}
.pchip.on{background:$primary;color:#fff;padding-left:8px} .pchip.off{background:$surface;border:1px solid $outline;color:$muted}
.pchip .mdi{font-size:18px;margin-right:8px}
.tag{display:inline-flex;align-items:center;gap:4px;padding:0 10px;min-height:32px;border-radius:999px;flex-shrink:1;min-width:0}
.tag .mdi{font-size:16px} .tag b{font-size:calc(14px*var(--fs));line-height:calc(18px*var(--fs));font-weight:700;letter-spacing:calc(.5px*var(--fs));white-space:nowrap}
.tag.info{background:$infoc;color:$oninfoc} .tag.pos{background:$posc;color:#17201B} .tag.lead{background:$leaderc;color:$onleaderc}
.av{border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none;letter-spacing:.3px}
.scard{background:$surface;border:1px solid $hair;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px}
.scard .sh{display:flex;align-items:center;gap:12px}
.scard .sh .iw{width:32px;height:32px;border-radius:8px;background:$primaryc;color:$onprimaryc;display:flex;align-items:center;justify-content:center;font-size:18px}
.scard .sh .tt{flex:1;font-weight:700}
.scard .sh .tip{font-size:20px;color:$muted}
/* game card (components/ui/GameListItem.tsx) */
.game{background:$surface;border:1px solid $hair;border-radius:16px;display:flex;align-items:center;gap:12px;padding:12px 8px 12px 12px;min-height:76px}
.game.on{background:$secc;border-color:$sec} .game.locked{opacity:.6}
.game .badge{width:44px;height:44px;border-radius:12px;background:$secc;color:$onsecc;display:flex;align-items:center;justify-content:center;font-size:calc(16px*var(--fs));font-weight:700;letter-spacing:-.5px;flex:none}
.game .body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.game .title{font-weight:700}
.game .meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.game .meta .pc{display:flex;align-items:center;gap:2px} .game .meta .pc .mdi{font-size:14px;color:$muted}
.game .end{font-size:22px;color:$muted} .game .end.cb{font-size:24px;color:$primary}
.game .note{width:64px;display:flex;flex-direction:column;align-items:center;gap:2px;color:$muted;text-align:center;flex:none}
.game .note .mdi{font-size:18px} .game .note span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* awards (app/(screens)/games/award.tsx) */
.acard{background:$surface;border:1px solid $hair;border-radius:16px;padding:4px 8px 0;margin-top:4px}
.arow{display:flex;align-items:center;gap:4px;padding:4px 0;border-bottom:1px solid $hair}
.arow.head{padding:2px 0}
.ch{font-size:calc(11px*var(--fs));font-weight:700;text-transform:uppercase;letter-spacing:calc(.4px*var(--fs));color:$muted;white-space:nowrap;overflow:hidden}
.num{width:48px;text-align:right;flex:none} .numw{width:64px;text-align:right;flex:none}
.ncell{flex:1;min-width:0;display:flex;align-items:center;gap:4px}
.acheck{display:flex;align-items:center;gap:8px;padding:8px 0;color:$win} .acheck .mdi{font-size:18px}
/* order of players (components/game/OrderOfPlayers.tsx) */
.orow{height:48px;display:flex;align-items:center;gap:8px;padding:0 4px;border-bottom:1px solid $hair}
.orow .no{width:24px;height:24px;border-radius:50%;background:$surfv;color:$muted;display:flex;align-items:center;justify-content:center;font-size:calc(14px*var(--fs));font-weight:700;flex:none}
.orow .no.deal{background:$primary;color:#fff}
.orow .name{flex:1;min-width:56px}
.orow .ar{width:96px;display:flex;justify-content:flex-end;flex:none}
.orow .ar span{width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:22px;color:$muted}
/* tab bar (components/ui/TabBarButtons.tsx) */
.tabbar{position:absolute;left:0;right:0;bottom:0;background:$surface;border-top:1px solid $hair;display:flex;gap:8px;z-index:3}
.tabbar>div{flex:1;border-radius:999px;display:flex;align-items:center;justify-content:center;border:2px solid $hair}
.tabbar .on{background:$primary;border-color:$primary;border-bottom:4px solid $edge;color:#fff} .tabbar .off{background:$surfv}
.page{position:absolute;left:0;right:0;overflow:hidden}
.pad{display:flex;flex-direction:column}
""").substitute(C, roboto=ROBOTO, mdi=MDI)

# adjustsFontSizeToFit for the Awards column heads, and the two ways a page is scrolled: to an element, or to its end
FIT_JS = """<script>document.fonts.ready.then(()=>{document.querySelectorAll('.fit').forEach(e=>{let s=parseFloat(getComputedStyle(e).fontSize);
while(e.scrollWidth>e.clientWidth+0.5&&s>6){s-=0.25;e.style.fontSize=s+'px'}});
document.querySelectorAll('[data-scroll-to]').forEach(p=>{const t=p.querySelector(p.dataset.scrollTo);if(!t)return;
const y=t.getBoundingClientRect().top-p.parentElement.getBoundingClientRect().top-parseFloat(p.dataset.at);p.style.transform='translateY('+(-y)+'px)'});
document.querySelectorAll('[data-scroll-end]').forEach(p=>{const y=Math.max(0,p.scrollHeight-p.parentElement.clientHeight);p.style.transform='translateY('+(-y)+'px)'})})</script>"""


def mdi(name, style='', cls=''):
    return f'<i class="mdi {cls}" style="{style}">{chr(ICON[name])}</i>'

def avatar(label, color, size, fs):
    font = sp(size * (0.34 if len(label) > 2 else 0.4), fs)
    return f'<div class="av" style="width:{size}px;height:{size}px;background:{color};font-size:{font:.1f}px">{label}</div>'

def tag(label, tone, icon): return f'<span class="tag {tone}">{mdi(icon)}<b>{label}</b></span>'

def status(time='7:16'): return f'<div class="status"><span>{time}</span><span class="r">{mdi("wifi")}{mdi("signal")}{mdi("battery")}</span></div>'
def header(title): return f'<div class="hdr">{mdi("back", cls="back")}<h1>{title}</h1>{mdi("help", cls="help")}</div>'
def tabs_header(right=0): return f'<div class="hdr tabs" style="right:{right}px"><div class="disc"><img src="file://{LOGO}"></div><h1 class="ell">EZ Score: Rummy</h1>{mdi("help", "font-size:24px;margin-right:29px")}</div>'
NAV = '<div class="nav"><i class="b"></i><i class="h"></i><i class="s"></i></div>'
NAV_SCRIM = NAV.replace('class="nav"', 'class="nav scrim"')
NAV_SIDE = NAV.replace('class="nav"', 'class="nav side"')


# ---------- 1. Awards -------------------------------------------------------------------------------
AWARD_ROWS = [('Sree Test', 'ST', '101 left · 5 drops', '0', '100', '500', '+400'),
              ('Harish Test', 'HT', '76 left · 4 drops', '25', '100', '0', '-100'),
              ('Priya Test', 'PT', '51 left · 3 drops', '50', '100', '0', '-100'),
              ('Zed Zero', 'ZZ', '50 left · 2 drops', '51', '200', '0', '-200')]

def awards(dev, proposed):
    w, fs = dev['w'], dev['fs']
    stacked = proposed and not roomy(w - 32, fs)
    rows = ''
    for i, (name, ini, st, score, put, gets, award) in enumerate(AWARD_ROWS):
        nums = (f'<span class="num bm nums">{score}</span><span class="num bm nums muted">{put}</span>'
                f'<span class="numw bm nums b7">{gets}</span><span class="num bm nums b8" style="color:{C["win"] if award.startswith("+") else C["loss"]}">{award}</span>')
        if stacked:
            rows += (f'<div class="arow">{avatar(ini, SEAT[i], 32, fs)}<div style="flex:1;min-width:0">'
                     f'<div class="row" style="gap:8px"><span class="bm b6 ell">{name}</span><span class="ls muted" style="white-space:nowrap;flex:none">{st}</span></div>'
                     f'<div class="row" style="gap:4px;justify-content:flex-end">{nums}</div></div></div>')
        else:
            rows += (f'<div class="arow"><div class="ncell">{avatar(ini, SEAT[i], 32, fs)}<div style="flex:1;min-width:0">'
                     f'<div class="bm b6 ell">{name}</div><div class="ls muted">{st}</div></div></div>{nums}</div>')
    chips = ''.join(f'<span class="chip {cls}">{t}</span>' for t, cls in
                    [('Winner takes all', 'on'), ('By points left', 'off'), ('50 / 50', 'off'), ('Entry per drop left', 'off dim'), ('Custom', 'off')])
    body = (f'<div class="row" style="justify-content:space-between;gap:12px">{tag("Completed", "info", "flag")}'
            f'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px"><span class="lm muted">Entry per player</span>'
            f'<div style="width:96px;height:40px;border:1px solid {C["outline"]};border-radius:4px;display:flex;align-items:center;padding:0 14px;font-size:calc(16px*var(--fs))">100</div></div></div>'
            f'<div class="bs muted">5 entries (a re-entry counts twice) · pool 500 points</div>'
            f'<div class="row" style="gap:6px"><span class="ts b7">How to split the pool</span>{mdi("info", "font-size:18px;color:" + C["muted"])}</div>'
            f'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">{chips}</div>'
            f'<div class="acard"><div class="arow head"><span class="ch" style="flex:1">Player</span><span class="ch num fit">Score</span>'
            f'<span class="ch num fit">Put in</span><span class="ch numw fit">Gets</span><span class="ch num fit">Award</span></div>{rows}'
            f'<div class="acheck">{mdi("okcircle")}<span class="bs">Pool 500 · all given out</span></div></div>')
    bar = (f'<div class="bbar short"><div class="btn out" style="flex:1 1 64px">{mdi("clock")}<span>Not now</span></div>'
           f'<div class="btn fill" style="flex:1.4 1 64px">{mdi("trophy")}<span>Save awards</span></div></div>')
    # The CI frame is scrolled to the end ("all given out" in view).
    page = f'<div class="page" style="top:calc(var(--sb) + 56px);bottom:124px"><div class="pad" data-scroll-end style="padding:16px 16px 26px;gap:8px">{body}</div></div>'
    return status('7:16') + header('Awards · P2') + page + bar + NAV


# ---------- 2. Order of players ---------------------------------------------------------------------
ORDER = [('Meena Iyer', 'MI', '#124', 3), ('Kiran Rao', 'KR', '#123', 2), ('Anil Reddy', 'AR', '#122', 1), ('Ravi Kumar', 'RK', '#121', 0)]

def order(dev, proposed):
    w, fs = dev['w'], dev['fs']
    row_w = w - 32 - 34
    wide = roomy(row_w, fs)
    narrow_fix = proposed and not wide
    rows = ''
    n = len(ORDER)
    for i, (name, ini, code, seat_color) in enumerate(ORDER):
        seat = n - i
        deals = seat == 1
        up = mdi('up') if i > 0 else ''
        down = mdi('down') if i < n - 1 else ''
        arrows = f'<div class="ar"><span>{up}</span><span>{down}</span></div>'
        head = f'<div class="no {"deal" if deals else ""}">{seat}</div>{avatar(ini, SEAT[seat_color], 30, fs)}'
        if narrow_fix:
            under = f'<div class="ls" style="color:{C["primary"]};margin-top:-2px">deals</div>' if deals else ''
            rows += f'<div class="orow">{head}<div class="name"><div class="bm ell">{name}</div>{under}</div>{arrows}</div>'
        else:
            extra = f'<span class="ls muted nums">{code}</span>' if wide else ''
            extra += f'<span class="ls" style="color:{C["primary"]}">deals</span>' if deals else ''
            rows += f'<div class="orow">{head}<span class="bm ell name">{name}</span><span class="lm muted b7">{ini}</span>{extra}{arrows}</div>'
    card = (f'<div class="scard"><div class="sh"><div class="iw">{mdi("seat")}</div><span class="tm tt">Order of players</span></div>'
            f'<div class="row" style="gap:8px;padding-bottom:4px"><span class="bm" style="flex:1">Tap players from the highest card to the lowest.</span>'
            f'<span class="row ll" style="gap:2px;color:{C["primary"]};min-height:32px;flex:none">{mdi("playcircle", "font-size:18px")}Show me</span></div>'
            f'<div>{rows}<div class="ls muted" style="padding:4px 4px 0">Everyone numbered</div></div></div>')
    start = 'Start' if narrow_fix else 'Start game'
    bar = (f'<div class="bbar"><div class="btn out" style="flex:.8 1 64px">{mdi("back")}<span>Back</span></div><div class="btn out" style="flex:.8 1 64px"><span>Clear</span></div>'
           f'<div class="btn fill" style="flex:1.4 1 64px">{mdi("play")}<span>{start}</span></div></div>')
    page = f'<div class="page" style="top:calc(var(--sb) + 56px);bottom:128px"><div class="pad" style="padding:16px 16px 12px;gap:12px">{card}</div></div>'
    return status('7:31') + header('Order of players') + page + bar + NAV


# ---------- 3. Game cards: Results picker and Home --------------------------------------------------
def when(day, time, card_w, fs, proposed):
    """The full date on a roomy card; on a narrow one the weekday is left out (proposed only)."""
    if not proposed or roomy(card_w, fs): return f'{day} · {time}'
    return f'{day.split(", ", 1)[1]} · {time}'

def game(label, day, time, status_tag, kind, count, card_w, fs, proposed, end='chev', on=False, locked=False, gid=''):
    title = when(day, time, card_w, fs, proposed)
    st = tag('Active', 'pos', 'dot') if status_tag == 'Active' else tag('Completed', 'info', 'flag')
    tail = (f'<div class="note">{mdi("trophy")}<span class="ls">Give awards first</span></div>' if locked else
            mdi('checked', cls='end cb') if end == 'cb' else mdi('right', cls='end'))
    return (f'<div class="game {"on" if on else ""} {"locked" if locked else ""}" id="{gid}"><div class="badge">{label}</div><div class="body">'
            f'<div class="tm title ell">{title}</div><div class="meta">{st}{tag("Creator", "lead", "crown")}'
            f'<span class="bs muted">{kind}</span><span class="pc">{mdi("people")}<span class="bs muted">{count}</span></span></div></div>{tail}</div>')

def results(dev, proposed):
    w, fs = dev['w'], dev['fs']
    cw = w - 32
    chips = (f'<span class="pchip on">{mdi("check")}Completed</span><span class="pchip off">Closed</span><span class="pchip off">Active</span>')
    body = (f'<div class="row" style="gap:8px"><span class="tm b7">Select completed games</span>{mdi("info", "font-size:18px;color:" + C["muted"])}</div>'
            f'<div style="display:flex;flex-wrap:wrap;gap:6px 4px;margin-top:3px">{chips}</div>'
            f'<div class="bm muted" style="margin-top:-1px">2 games selected</div>'
            f'<div style="display:flex;flex-direction:column;gap:8px">'
            + game('P1', 'Thu, Nov 26', '3:55 PM', 'Completed', 'Pool', 20, cw, fs, proposed, locked=True)
            + game('S4', 'Wed, Nov 25', '6:55 PM', 'Completed', 'Points', 6, cw, fs, proposed, end='cb', on=True)
            + game('S1', 'Tue, Nov 24', '6:54 PM', 'Completed', 'Points', 4, cw, fs, proposed, end='cb', on=True)
            + f'</div><div class="btn fill">{mdi("list")}<span>Show results · 2 games</span></div>')
    page = f'<div class="page" style="top:calc(var(--sb) + 56px);bottom:0"><div class="pad" style="padding:16px 16px 12px;gap:16px">{body}</div></div>'
    return status('7:02') + header('Results') + page + NAV_SCRIM

LIVE = [('P1', 'Thu, Nov 26', '5:25 PM', 'Pool', 13), ('S3', 'Thu, Nov 26', '4:55 PM', 'Points', 3), ('S2', 'Thu, Nov 26', '3:55 PM', 'Points', 4),
        ('S4', 'Thu, Nov 26', '1:55 PM', 'Points', 20), ('S1', 'Tue, Nov 24', '6:54 PM', 'Points', 4)]
RECENT = [('P2', 'Wed, Nov 25', '9:10 PM', 'Pool', 4), ('S5', 'Mon, Nov 23', '8:40 PM', 'Points', 6)]

def home_top(fs):
    return (f'<div class="hl b7" style="margin-bottom:24px">Hi Sree</div>'
            f'<div class="btn fill" style="margin-bottom:28px">{mdi("plus")}<span>New game</span></div>')

def home_actions():
    return (f'<div class="row" style="gap:8px;margin-bottom:16px"><div class="btn accent" style="flex:1 1 64px">{mdi("podium")}<span>Results</span></div>'
            f'<div style="flex:1 1 0;position:relative;min-width:0"><div class="btn accent">{mdi("group")}<span>My players</span></div>'
            f'<div class="lm b8 nums" style="position:absolute;top:-8px;right:-4px;min-width:26px;height:26px;padding:0 6px;border-radius:999px;border:2px solid {C["bg"]};background:{C["leaderc"]};color:{C["onleaderc"]};display:flex;align-items:center;justify-content:center">43</div></div></div>')

def live_card(card_w, fs, proposed, games=LIVE):
    rows = ''.join(f'<div style="margin-bottom:8px">{game(l, d, t, "Active", k, c, card_w, fs, proposed, gid="g" + l)}</div>' for l, d, t, k, c in games)
    return f'<div class="scard"><div class="sh"><div class="iw">{mdi("cards")}</div><span class="tm tt">Live · {len(games)}</span>{mdi("info", cls="tip")}</div>{rows}</div>'

def recent_card(card_w, fs, proposed):
    rows = ''.join(f'<div style="margin-bottom:8px">{game(l, d, t, "Completed", k, c, card_w, fs, proposed)}</div>' for l, d, t, k, c in RECENT)
    return f'<div class="scard" style="background:{C["surfv"]}"><div class="sh"><div class="iw">{mdi("history")}</div><span class="tm tt">Recent</span>{mdi("info", cls="tip")}</div>{rows}</div>'

def tabbar(compact, left=12, right=12, bottom=48):
    h = 42 if compact else 52
    pad = 4 if compact else 8
    icon = 22 if compact else 26
    return (f'<div class="tabbar" style="padding:{pad}px {right}px {pad + bottom}px {left}px"><div class="on" style="height:{h}px">{mdi("home", f"font-size:{icon}px")}</div>'
            f'<div class="off" style="height:{h}px">{avatar("ST", SEAT[0], icon + 6, 1)}</div></div>')

def home(dev, proposed):
    w, fs = dev['w'], dev['fs']
    inner = w - 32 - 34
    body = home_top(fs) + home_actions() + live_card(inner, fs, proposed)
    page = f'<div class="page" style="top:calc(var(--sb) + 64px);bottom:117px"><div class="pad" style="padding:16px 16px 0">{body}</div></div>'
    return status('6:57') + tabs_header() + page + tabbar(False) + NAV


# ---------- 4. Home sideways ------------------------------------------------------------------------
def home_sideways(dev, proposed, scroll_to, at):
    """dev is the upright phone; sideways the window is h x w, the 3-button bar sits on the right (48 dp),
    the page gutters are 12 dp (`isShort`), the header is 64 dp and the compact tab bar 51 dp.
    Today: two columns whenever the window is 700 dp wide. Proposed: only when each column is roomy."""
    W, fs = dev['h'], dev['fs']
    hole = dev['sb'] - 24
    left, right = hole + 12, 48 + 12
    content = min(W - left - right, 760)
    x0 = left + (W - left - right - content) / 2
    cw = (content - 16) / 2
    if proposed and not roomy(cw, fs):
        cols = home_actions() + live_card(content - 34, fs, proposed) + '<div style="height:12px"></div>' + recent_card(content - 34, fs, proposed)
    else:
        cols = (f'<div style="display:flex;gap:16px;align-items:flex-start"><div style="flex:1;min-width:0">{home_actions()}{live_card(cw - 34, fs, proposed)}</div>'
                f'<div style="flex:1;min-width:0">{recent_card(cw - 34, fs, proposed)}</div></div>')
    scroll = f'data-scroll-to="{scroll_to}" data-at="{at}"'
    page = (f'<div class="page" style="top:88px;bottom:51px;right:48px"><div class="pad" {scroll} style="padding:12px 0 32px;margin-left:{x0}px;width:{content}px;gap:16px">'
            f'<div>{home_top(fs)}</div>{cols}</div></div>')
    return status('6:58').replace('class="status"', 'class="status" style="right:48px"') + tabs_header(right=48) + page + tabbar(True, left=left, right=60, bottom=0) + NAV_SIDE


# ---------- rendering -------------------------------------------------------------------------------
def render(name, body, w, h, fs, scale, sb=24):
    css = re.sub(r'calc\(([\d.]+)px\*var\(--fs\)\)', lambda m: f'{sp(float(m.group(1)), fs):.2f}px', CSS)
    body = re.sub(r'calc\(([\d.]+)px\*var\(--fs\)\)', lambda m: f'{sp(float(m.group(1)), fs):.2f}px', body)
    html = (f'<!doctype html><html><head><meta charset="utf-8"><style>html,body{{width:{w}px;height:{h}px;--sb:{sb}px}}{css}</style></head>'
            f'<body>{body}{FIT_JS}</body></html>')
    p = os.path.join(TMP, name + '.html'); open(p, 'w').write(html)
    png = os.path.join(TMP, name + '.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
                             f'--force-device-scale-factor={scale}', f'--user-data-dir={TMP}/u-{name}', f'--window-size={w},{h}',
                             '--virtual-time-budget=3000', f'--screenshot={png}', 'file://' + p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(400):                                     # this Chrome does not always exit after the screenshot
        if proc.poll() is not None: break
        if os.path.exists(png) and os.path.getsize(png) > 0: time.sleep(0.4); break
        time.sleep(0.1)
    if proc.poll() is None: proc.kill(); proc.wait()
    assert os.path.exists(png), name
    return Image.open(png).convert('RGB')

def portrait(name, fn, dev, proposed): return render(name, fn(dev, proposed), dev['w'], dev['h'], dev['fs'], dev['scale'], dev['sb'])
def sideways(name, dev, proposed, scroll_to, at): return render(name, home_sideways(dev, proposed, scroll_to, at), dev['h'], dev['w'], dev['fs'], dev['scale'])
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
    W = pad * 2 + max(len(row) for row in scaled) * panel_w + gap * (max(len(row) for row in scaled) - 1)
    probe = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    tf, sf, hf, cf = font(26, True), font(18), font(20, True), font(17)
    sub_lines = wrap(probe, sub, sf, W - pad * 2)
    top = 22 + 36 + len(sub_lines) * 25 + 14
    blocks = []
    for row in scaled:
        caps = [wrap(probe, cap, cf, panel_w) for _, _, _, cap in row]
        blocks.append((row, caps, 34 + max(im.height for im, *_ in row) + 10 + max(len(c) for c in caps) * 23 + 22))
    out = Image.new('RGB', (W, top + sum(b[2] for b in blocks) + 6), 'white'); d = ImageDraw.Draw(out)
    d.text((pad, 20), title, fill='#17201B', font=tf)
    for i, line in enumerate(sub_lines): d.text((pad, 60 + i * 25), line, fill='#4E5752', font=sf)
    y = top
    for row, caps, height in blocks:
        x = pad
        for (im, h, col, _), cap in zip(row, caps):
            d.text((x, y), h, fill=col, font=hf)
            out.paste(im, (x, y + 34)); d.rectangle([x - 1, y + 33, x + panel_w, y + 34 + im.height], outline='#bbbbbb')
            for i, line in enumerate(cap): d.text((x, y + 34 + im.height + 10 + i * 23), line, fill='#4E5752', font=cf)
            x += panel_w + gap
        y += height
    out.save(path, optimize=True); print(os.path.relpath(path, HERE), out.size)

GREY, GREEN = '#555555', '#0E4D2A'
TODAY = 'Today (CI frame)'
PROP = 'Proposed (drawn)'


def main():
    check = '--check' in sys.argv
    if check:
        out = '/tmp/small-360-check'; os.makedirs(out, exist_ok=True)
        for dev, tag_ in ((SMALL, 'small'), (PIXEL6, 'pixel6')):
            for name, fn in (('awards', awards), ('order', order), ('results', results), ('home', home)):
                drawn = portrait(f'check-{tag_}-{name}', fn, dev, False)
                sheet(os.path.join(out, f'{tag_}-{name}.png'), f'{tag_} · {name}', 'CI frame beside the drawing of the same screen (today, no change applied).',
                      [[(ci(f'{tag_}-{name}'), 'CI', GREY, ''), (drawn, 'Drawn', GREEN, '')]], 540)

    s = lambda name, fn: portrait('small-' + name, fn, SMALL, True)
    sheet(os.path.join(HERE, 'awards-360.png'), '1 · Awards table on a small phone (360 dp, text size 1.3)',
          'Today the name has 52 dp, so it reads "Sre…" and "101 left · 5 drops" breaks into four short lines. Proposed: on a narrow table each player takes two lines.',
          [[(ci('small-awards'), TODAY, GREY, 'Four players fill the screen. Names cut to three letters.'),
            (s('awards', awards), PROP, GREEN, 'Name and what is left on one line, the four numbers under their headings. Same four players in about half the height.')]], 540)
    sheet(os.path.join(HERE, 'order-360.png'), '2 · Order of players on a small phone (360 dp, text size 1.3)',
          'Today the name shares the row with the initials a second time, "deals" and the arrows, and the button has no room for "Start game". Proposed: on a narrow row the initials stay in the coloured disc only, "deals" sits under the name, and the button reads "Start".',
          [[(ci('small-order'), TODAY, GREY, '"Meena …", "Kiran R…", "Ravi …", and "Start g…".'),
            (s('order', order), PROP, GREEN, 'Full names. The arrows, the row height (48 dp) and the three buttons do not move.')]], 540)
    sheet(os.path.join(HERE, 'results-360.png'), '3 · Game cards in Results on a small phone (360 dp, text size 1.3)',
          'Today the date is cut before the time, which is the part that tells two games of one evening apart. Proposed: on a narrow card the weekday is left out.',
          [[(ci('small-results'), TODAY, GREY, '"Thu, Nov 26 · 3:…", "Wed, Nov 25 · 6:55 …", "Tue, Nov 24 · 6:54 P…".'),
            (s('results', results), PROP, GREEN, '"Nov 26 · 3:55 PM". Nothing else on the card changes; the card is the same height.')]], 540)
    sheet(os.path.join(HERE, 'home-cards-360.png'), '3 · The same cards on Home (360 dp, text size 1.3)',
          'Home uses the same card, inside the Live box, so it has even less room. The same rule applies.',
          [[(ci('small-home'), TODAY, GREY, '"Thu, Nov 26 · 5:2…", "Thu, Nov 26 · 4:5…".'),
            (s('home', home), PROP, GREEN, '"Nov 26 · 5:25 PM", "Nov 26 · 4:55 PM". ("My pla…" is a separate small item, not part of this.)')]], 540)
    # Two scroll positions. FIRST: the Results / My players row just under the header. LAST: the last live
    # game (S1) with its top 163 dp under the header, which is where CI's Maestro log found it today
    # (flow 03 on the small phone: bounds x=88 y=754 w=934 h=175 px in the 2340 x 1080 window).
    FIRST, LAST = ('.btn.accent', 8), ('#gS1', 163)
    sw = lambda p, pos: sideways(f'small-side-{p}-{pos[1]}', SMALL, p, *pos)
    sheet(os.path.join(HERE, 'home-sideways-360.png'), '4 · Home with the phone turned sideways (780 × 360 dp, text size 1.3)',
          'CI takes no picture of Home sideways, so "today" is drawn from the app\'s own sizes; the place of the last live game (S1) is the one in the CI log. '
          'Today a sideways phone gets the tablet layout: two half-width columns, Live on the left and Recent on the right. '
          'Proposed: when the columns would be narrow, Home shows the same single list as upright, across the full width.',
          [[(sw(False, FIRST), 'Today (drawn) · the first games', GREY, 'Two columns, each about as wide as the upright phone: "My play…", dates cut, four-line cards.'),
            (sw(True, FIRST), 'Proposed (drawn) · the first games', GREEN, 'One list, as upright: both buttons in full, the full date, two-line cards. Recent follows Live.')],
           [(sw(False, LAST), 'Today (drawn) · the last live game', GREY, 'Recent has ended, so the right half is empty. One card and a bit fit; Live is five tall cards long.'),
            (sw(True, LAST), 'Proposed (drawn) · the last live game', GREEN, 'Two cards and a bit fit, and both halves are used.')]], 780)
    sheet(os.path.join(HERE, 'pixel6-check.png'), 'Pixel 6 check (412 dp, text size 1.0): nothing changes',
          'All four proposals use the switch Order of players already has (width ÷ text size ≥ 330 = roomy). On the Pixel 6 every one of these is roomy, so the screens stay exactly as CI shows them today.',
          [[(ci('pixel6-awards'), 'Awards · unchanged', GREY, 'Table 380 ÷ 1.0 = 380: one line per player, as today.'),
            (ci('pixel6-order'), 'Order of players · unchanged', GREY, 'Row 346: initials, Player ID and "deals" beside the name, "Start game", as today.'),
            (ci('pixel6-results'), 'Results · unchanged', GREY, 'Card 380: the weekday stays.'),
            (ci('pixel6-home'), 'Home · unchanged', GREY, 'Card 346: the weekday stays.')]], 412)
    side6 = sideways('pixel6-side', PIXEL6, True, *FIRST)
    assert side6.tobytes() == sideways('pixel6-side-today', PIXEL6, False, *FIRST).tobytes(), 'Pixel 6 sideways must not change'
    sheet(os.path.join(HERE, 'pixel6-sideways.png'), 'Pixel 6, finding 4: Home sideways (915 × 412 dp, text 1.0)',
          'Drawn from the app\'s sizes (CI takes no frame of Home sideways). Each column is 372 dp wide (the page is never wider than 760), which is roomy, so the Pixel 6 keeps its two columns: today and proposed are the same picture.',
          [[(side6, 'Today and proposed (drawn) · unchanged', GREY, 'Full dates and both buttons fit in each column, so there is nothing to fix here.')]], 915)
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == '__main__':
    main()
