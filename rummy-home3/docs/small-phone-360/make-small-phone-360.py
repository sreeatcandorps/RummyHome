#!/usr/bin/env python3
"""Small-phone findings (next-up row 12g), redrawn under Q64: one layout for every phone, no size switch.

Every picture is a 2 x 2 sheet: today beside proposed, on the CI small phone (360 x 780 dp, text size 1.3)
and on the Pixel 6 (412 x 915 dp, text size 1.0), because a change with no size switch changes both.

Today  = CI frames in ci/:
         awards  #175's run (four chips, main @ 2759b879 is that PR merged), frame 16m, Split evenly;
         order   #184's run (the circle, main @ dfaeebcc is that PR merged), frame 24e, the last tap;
         results / home  run 45878556049 (main @ 3c0ea575, Nov 26); neither screen has changed since.
         CI takes no frame of Home sideways, so that one is drawn from the code's sizes and the bounds in
         that run's Maestro log.
Proposed = the same screens drawn to the code's sizes (dp = CSS px, sp through Android 14's font-scale
         table, see sp()) in headless Chrome, with only the proposed change applied. Order of players is
         the CI frame with the bottom bar redrawn: the only part that changes.

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
SMALL = dict(w=360, h=780, fs=1.3, scale=3.0, sb=24, tag='small', name='Small phone · 360 dp · text 1.3')
PIXEL6 = dict(w=412, h=915, fs=1.0, scale=2.625, sb=49, tag='pixel6', name='Pixel 6 · 412 dp · text 1.0')

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
/* Paper's compact Button: a 20 sp label line, 10 above and below, 2 px border or the 4 px edge. Widths and
   heights checked against the CI frames of the top of Awards (small phone and Pixel 6): within 2 dp. */
.chip{height:calc(calc(20px*var(--fs)) + 24px);border-radius:999px;display:flex;align-items:center;padding:0 9px;font-size:calc(16px*var(--fs));font-weight:700;white-space:nowrap}
.chip.on{background:$primary;color:#fff;border-bottom:4px solid $edge;padding:0 11px} .chip.off{border:2px solid $outline;color:$primary} .chip.dim{opacity:.45}
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
/* A player row is 64 dp on both Pixel 6 frames (Nov 26 and #175) whether its text is two lines or three, so
   it is drawn with that floor; the numbers have no variant, so they are Paper's default 14 sp. */
.arow{display:flex;align-items:center;gap:4px;padding:4px 0;border-bottom:1px solid $hair;min-height:64px}
.arow.head{padding:2px 0;min-height:0}
.an{font-size:calc(14px*var(--fs));line-height:calc(20px*var(--fs))}
.ch{font-size:calc(11px*var(--fs));font-weight:700;text-transform:uppercase;letter-spacing:calc(.4px*var(--fs));color:$muted;white-space:nowrap;overflow:hidden}
.num{width:48px;text-align:right;flex:none} .numw{width:64px;text-align:right;flex:none}
.ncell{flex:1;min-width:0;display:flex;align-items:center;gap:4px}
.acheck{display:flex;align-items:center;gap:8px;padding:8px 0;color:$win} .acheck .mdi{font-size:18px}
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
let y=t.getBoundingClientRect().top-p.parentElement.getBoundingClientRect().top-parseFloat(p.dataset.at);
if(p.dataset.clamp!==undefined)y=Math.max(0,Math.min(y,p.scrollHeight-p.parentElement.clientHeight));p.style.transform='translateY('+(-y)+'px)'});
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


# ---------- 3. The date (utils/formatWhen.ts) -------------------------------------------------------
def when(day, time, proposed):
    """Today: "Thu, Nov 26 · 3:55 PM". Proposed, on every screen and every phone: "Nov 26 · 3:55 PM"."""
    return f'{day.split(", ", 1)[1] if proposed else day} · {time}'


# ---------- 1. Awards -------------------------------------------------------------------------------
# The game in both CI frames (#175, frame 16m): pool 101, drop 25, entry 100, five entries (Zed came back in
# once). The others' 4 + 3 + 2 drops are nine entries against a pool of five, so By drops left is off and
# Split evenly is picked (D128); the line under the chips is the app's own words.
AWARD_ROWS = [('Sree Test', 'ST', '101 left · 5 drops', 0, 100, 125), ('Harish Test', 'HT', '76 left · 4 drops', 25, 100, 125),
              ('Priya Test', 'PT', '51 left · 3 drops', 50, 100, 125), ('Zed Zero', 'ZZ', '50 left · 2 drops', 51, 200, 125)]
AWARD_CHIPS = [('By drops left', 'off dim'), ('Split evenly', 'on'), ('By score left', 'off'), ('Custom', 'off')]
AWARD_WHY = 'By drops left is off here: Harish Test would get 400, the winner Sree Test 0. Picked for you: Split evenly.'

def awards(dev, proposed):
    """Proposed: every player on two lines at every width — the name and what is left, then the four numbers."""
    w, fs = dev['w'], dev['fs']
    rows = ''
    for i, (name, ini, st, score, put, gets) in enumerate(AWARD_ROWS):
        award = gets - put
        tone = C['win'] if award > 0 else C['loss'] if award < 0 else C['ink']
        nums = (f'<span class="num an nums">{score}</span><span class="num an nums muted">{put}</span>'
                f'<span class="numw an nums b7">{gets}</span><span class="num an nums b8" style="color:{tone}">{award:+d}</span>')
        if proposed:
            rows += (f'<div class="arow">{avatar(ini, SEAT[i], 32, fs)}<div style="flex:1;min-width:0">'
                     f'<div class="row" style="gap:8px"><span class="bm b6 ell">{name}</span><span class="ls muted" style="white-space:nowrap;flex:none">{st}</span></div>'
                     f'<div class="row" style="gap:4px;justify-content:flex-end">{nums}</div></div></div>')
        else:
            rows += (f'<div class="arow"><div class="ncell">{avatar(ini, SEAT[i], 32, fs)}<div style="flex:1;min-width:0">'
                     f'<div class="bm b6 ell">{name}</div><div class="ls muted">{st}</div></div></div>{nums}</div>')
    chips = ''.join(f'<span class="chip {cls}">{t}</span>' for t, cls in AWARD_CHIPS)
    body = (f'<div class="bm muted">101 pool · drop 25 · 4 players · {when("Fri, Nov 27", "6:50 PM", proposed)}</div>'
            f'<div class="row" style="justify-content:space-between;gap:12px">{tag("Completed", "info", "flag")}'
            f'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px"><span class="lm muted">Entry per player</span>'
            f'<div style="width:96px;height:40px;border:1px solid {C["outline"]};border-radius:4px;display:flex;align-items:center;padding:0 14px;font-size:calc(16px*var(--fs))">100</div></div></div>'
            f'<div class="bs muted">5 entries (a re-entry counts twice) · pool 500 points</div>'
            f'<div class="row" style="gap:6px"><span class="ts b7">How to split the pool</span>{mdi("info", "font-size:18px;color:" + C["muted"])}</div>'
            f'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">{chips}</div><div class="bs muted">{AWARD_WHY}</div>'
            f'<div class="acard"><div class="arow head"><span class="ch" style="flex:1">Player</span><span class="ch num fit">Score</span>'
            f'<span class="ch num fit">Put in</span><span class="ch numw fit">Gets</span><span class="ch num fit">Award</span></div>{rows}'
            f'<div class="acheck">{mdi("okcircle")}<span class="bs">Pool 500 · all given out</span></div></div>')
    bar = (f'<div class="bbar short"><div class="btn out" style="flex:1 1 64px">{mdi("clock")}<span>Not now</span></div>'
           f'<div class="btn fill" style="flex:1.4 1 64px">{mdi("trophy")}<span>Save awards</span></div></div>')
    # As in the CI frames: the small phone scrolled to the end ("all given out" in view), the Pixel 6 at the top
    # (everything fits). On the Pixel 6 the page scrolls only if it is taller than the screen.
    page = f'<div class="page" style="top:calc(var(--sb) + 56px);bottom:124px"><div class="pad" data-scroll-end style="padding:16px 16px 26px;gap:8px">{body}</div></div>'
    return status('6:52') + header('Awards · P2') + page + bar + NAV


# ---------- 2. Order of players: the bottom bar -----------------------------------------------------
# components/game/OrderStep.tsx: Back (flex .8) · Clear (.8) · Start game (1.4). The circle above it is the CI frame.
def order_bar(dev, start):
    bar = (f'<div class="bbar"><div class="btn out" style="flex:.8 1 64px">{mdi("back")}<span>Back</span></div><div class="btn out" style="flex:.8 1 64px"><span>Clear</span></div>'
           f'<div class="btn fill" style="flex:1.4 1 64px">{mdi("play")}<span>{start}</span></div></div>')
    return bar + NAV

def bar_top(im):
    """Top of the white bottom bar, in pixels: the first row from 60 % down that is mostly #FFFFFF."""
    px = im.load()
    for y in range(int(im.height * 0.6), im.height):
        white = sum(1 for x in range(0, im.width, 6) if px[x, y] == (255, 255, 255))
        if white > 0.8 * (im.width / 6): return y
    raise SystemExit('no bottom bar found')

def order(dev, start):
    """The CI frame of the last tap with its bottom bar redrawn reading `start`."""
    frame = ci(f'{dev["tag"]}-order')
    drawn = render(f'{dev["tag"]}-bar-{start}', order_bar(dev, start), dev['w'], dev['h'], dev['fs'], dev['scale'], dev['sb'])
    drawn = drawn.resize(frame.size, Image.LANCZOS)
    top_ci, top_drawn = bar_top(frame), bar_top(drawn)
    assert abs(top_ci - top_drawn) <= 4 * dev['scale'], (dev['tag'], top_ci, top_drawn)
    lift = 2 * round(dev['scale'])                           # the hairline above the white
    out = frame.copy()
    part = drawn.crop((0, top_drawn - lift, drawn.width, drawn.height))
    out.paste(part, (0, top_ci - lift))
    return out


# ---------- 3. Game cards: Results picker and Home --------------------------------------------------
def game(label, day, time, status_tag, kind, count, proposed, end='chev', on=False, locked=False, gid=''):
    st = tag('Active', 'pos', 'dot') if status_tag == 'Active' else tag('Completed', 'info', 'flag')
    tail = (f'<div class="note">{mdi("trophy")}<span class="ls">Give awards first</span></div>' if locked else
            mdi('checked', cls='end cb') if end == 'cb' else mdi('right', cls='end'))
    return (f'<div class="game {"on" if on else ""} {"locked" if locked else ""}" id="{gid}"><div class="badge">{label}</div><div class="body">'
            f'<div class="tm title ell">{when(day, time, proposed)}</div><div class="meta">{st}{tag("Creator", "lead", "crown")}'
            f'<span class="bs muted">{kind}</span><span class="pc">{mdi("people")}<span class="bs muted">{count}</span></span></div></div>{tail}</div>')

def past_results():
    return (f'<div class="scard"><div class="sh"><div class="iw">{mdi("podium")}</div><span class="tm tt">Past results</span>{mdi("info", cls="tip")}</div>'
            f'<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 8px 8px;text-align:center">'
            f'<div style="width:64px;height:64px;border-radius:50%;background:{C["surfv"]};color:{C["muted"]};display:flex;align-items:center;justify-content:center">{mdi("podium", "font-size:32px")}</div>'
            f'<div class="tm">No results yet</div><div class="bm muted">Pick completed games above and make a result; it will be listed here.</div></div></div>')

# The two CI runs seeded S1 a minute apart.
S1_TIME = {'small': '6:54 PM', 'pixel6': '6:55 PM'}

def results(dev, proposed):
    chips = (f'<span class="pchip on">{mdi("check")}Completed</span><span class="pchip off">Closed</span><span class="pchip off">Active</span>')
    body = (f'<div class="row" style="gap:8px"><span class="tm b7">Select completed games</span>{mdi("info", "font-size:18px;color:" + C["muted"])}</div>'
            f'<div style="display:flex;flex-wrap:wrap;gap:6px 4px;margin-top:3px">{chips}</div>'
            f'<div class="bm muted" style="margin-top:-1px">2 games selected</div>'
            f'<div style="display:flex;flex-direction:column;gap:8px">'
            + game('P1', 'Thu, Nov 26', '3:55 PM', 'Completed', 'Pool', 20, proposed, locked=True)
            + game('S4', 'Wed, Nov 25', '6:55 PM', 'Completed', 'Points', 6, proposed, end='cb', on=True)
            + game('S1', 'Tue, Nov 24', S1_TIME[dev['tag']], 'Completed', 'Points', 4, proposed, end='cb', on=True)
            + f'</div><div class="btn fill">{mdi("list")}<span>Show results · 2 games</span></div>' + past_results())
    page = f'<div class="page" style="top:calc(var(--sb) + 56px);bottom:0"><div class="pad" style="padding:16px 16px 12px;gap:16px">{body}</div></div>'
    return status('7:02') + header('Results') + page + NAV_SCRIM

LIVE = [('P1', 'Thu, Nov 26', '5:25 PM', 'Pool', 13), ('S3', 'Thu, Nov 26', '4:55 PM', 'Points', 3), ('S2', 'Thu, Nov 26', '3:55 PM', 'Points', 4),
        ('S4', 'Thu, Nov 26', '1:55 PM', 'Points', 20), ('S1', 'Tue, Nov 24', '6:54 PM', 'Points', 4)]
RECENT = [('P2', 'Wed, Nov 25', '9:10 PM', 'Pool', 4), ('S5', 'Mon, Nov 23', '8:40 PM', 'Points', 6)]

def home_top():
    return (f'<div class="hl b7" style="margin-bottom:24px">Hi Sree</div>'
            f'<div class="btn fill" style="margin-bottom:28px">{mdi("plus")}<span>New game</span></div>')

def home_actions():
    return (f'<div class="row" style="gap:8px;margin-bottom:16px"><div class="btn accent" style="flex:1 1 64px">{mdi("podium")}<span>Results</span></div>'
            f'<div style="flex:1 1 0;position:relative;min-width:0"><div class="btn accent">{mdi("group")}<span>My players</span></div>'
            f'<div class="lm b8 nums" style="position:absolute;top:-8px;right:-4px;min-width:26px;height:26px;padding:0 6px;border-radius:999px;border:2px solid {C["bg"]};background:{C["leaderc"]};color:{C["onleaderc"]};display:flex;align-items:center;justify-content:center">43</div></div></div>')

def live_card(proposed):
    rows = ''.join(f'<div style="margin-bottom:8px">{game(l, d, t, "Active", k, c, proposed, gid="g" + l)}</div>' for l, d, t, k, c in LIVE)
    return f'<div class="scard"><div class="sh"><div class="iw">{mdi("cards")}</div><span class="tm tt">Live · {len(LIVE)}</span>{mdi("info", cls="tip")}</div>{rows}</div>'

def recent_card(proposed):
    rows = ''.join(f'<div style="margin-bottom:8px">{game(l, d, t, "Completed", k, c, proposed)}</div>' for l, d, t, k, c in RECENT)
    return f'<div class="scard" style="background:{C["surfv"]}"><div class="sh"><div class="iw">{mdi("history")}</div><span class="tm tt">Recent</span>{mdi("info", cls="tip")}</div>{rows}</div>'

def tabbar(compact, left=12, right=12, bottom=48):
    h = 42 if compact else 52
    pad = 4 if compact else 8
    icon = 22 if compact else 26
    return (f'<div class="tabbar" style="padding:{pad}px {right}px {pad + bottom}px {left}px"><div class="on" style="height:{h}px">{mdi("home", f"font-size:{icon}px")}</div>'
            f'<div class="off" style="height:{h}px">{avatar("ST", SEAT[0], icon + 6, 1)}</div></div>')

def home(dev, proposed):
    body = home_top() + home_actions() + live_card(proposed)
    page = f'<div class="page" style="top:calc(var(--sb) + 64px);bottom:117px"><div class="pad" style="padding:16px 16px 0">{body}</div></div>'
    return status('6:57') + tabs_header() + page + tabbar(False) + NAV


# ---------- 4. Home sideways ------------------------------------------------------------------------
def home_sideways(dev, proposed, scroll_to, at):
    """dev is the upright phone; sideways the window is h x w, the 3-button bar sits on the right (48 dp),
    the page gutters are 12 dp (`isShort`), the header is 64 dp and the compact tab bar 51 dp, and the page
    is never wider than 760 dp (MAX_CONTENT_WIDTH). Today: two columns whenever the window is 700 dp wide
    (`isWide`). Proposed: no `isWide`; the upright list, Recent under Live, at every width."""
    W = dev['h']
    hole = dev['sb'] - 24
    left, right = hole + 12, 48 + 12
    content = min(W - left - right, 760)
    x0 = left + (W - left - right - content) / 2
    if proposed:
        cols = home_actions() + live_card(proposed) + '<div style="height:12px"></div>' + recent_card(proposed)
    else:
        cols = (f'<div style="display:flex;gap:16px;align-items:flex-start"><div style="flex:1;min-width:0">{home_actions()}{live_card(proposed)}</div>'
                f'<div style="flex:1;min-width:0">{recent_card(proposed)}</div></div>')
    scroll = f'data-scroll-to="{scroll_to}" data-at="{at}"'
    page = (f'<div class="page" style="top:88px;bottom:51px;right:48px"><div class="pad" {scroll} style="padding:12px 0 32px;margin-left:{x0}px;width:{content}px;gap:16px">'
            f'<div>{home_top()}</div>{cols}</div></div>')
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

def portrait(fn, dev, proposed):
    return render(f'{dev["tag"]}-{fn.__name__}-{int(proposed)}', fn(dev, proposed), dev['w'], dev['h'], dev['fs'], dev['scale'], dev['sb'])
def sideways(dev, proposed, scroll_to, at):
    return render(f'{dev["tag"]}-side-{int(proposed)}-{at}', home_sideways(dev, proposed, scroll_to, at), dev['h'], dev['w'], dev['fs'], dev['scale'])
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
def today(dev): return f'Today · {dev["name"]}'
def prop(dev): return f'Proposed · {dev["name"]}'


def main():
    if '--check' in sys.argv:
        out = '/tmp/small-360-check'; os.makedirs(out, exist_ok=True)
        for dev in (SMALL, PIXEL6):
            for fn in (awards, results, home):
                sheet(os.path.join(out, f'{dev["tag"]}-{fn.__name__}.png'), f'{dev["tag"]} · {fn.__name__}', 'CI frame beside the drawing of the same screen (today, no change applied).',
                      [[(ci(f'{dev["tag"]}-{fn.__name__}'), 'CI', GREY, ''), (portrait(fn, dev, False), 'Drawn', GREEN, '')]], 540)
            sheet(os.path.join(out, f'{dev["tag"]}-order-bar.png'), f'{dev["tag"]} · order bar', 'CI frame beside the same frame with today\'s bar redrawn.',
                  [[(ci(f'{dev["tag"]}-order'), 'CI', GREY, ''), (order(dev, 'Start game'), 'Bar drawn', GREEN, '')]], 540)

    sheet(os.path.join(HERE, 'awards-360.png'), '1 · Awards: every player on two lines, on every phone',
          'Line 1: the coloured disc, the full name and what is left. Line 2: the four numbers under their headings. The same layout on the small phone and the Pixel 6. '
          'The date line at the top is fix 3 (the weekday left out).',
          [[(ci('small-awards'), today(SMALL), GREY, 'The name has room for three letters ("Sre…") and "101 left · 5 drops" breaks into four lines. Four players fill the screen.'),
            (portrait(awards, SMALL, True), prop(SMALL), GREEN, 'Full names, "101 left · 5 drops" on one line. Each player is about half as tall, so the chips and the reason show above the table.')],
           [(ci('pixel6-awards'), today(PIXEL6), GREY, 'Names fit; Sree\'s "101 left · 5 drops" takes two lines.'),
            (portrait(awards, PIXEL6, True), prop(PIXEL6), GREEN, 'The same two lines as on the small phone. About as tall as today; nothing wraps.')]], 540)

    sheet(os.path.join(HERE, 'order-360.png'), '2 · Order of players: the button says "Start", on every phone',
          'The circle (#184) has no names beside the discs any more, so the only thing cut on this screen is the green button. Proposed: it reads "Start", '
          'like its other form "Next"; a screen reader still says "Start game". Nothing else moves. The circles are CI frames; only the bar is redrawn.',
          [[(ci('small-order'), today(SMALL), GREY, '"Start g…".'),
            (order(SMALL, 'Start'), prop(SMALL), GREEN, '"Start" in full. Back and Clear unchanged.')],
           [(ci('pixel6-order'), today(PIXEL6), GREY, '"Start game" fits.'),
            (order(PIXEL6, 'Start'), prop(PIXEL6), GREEN, '"Start" here too: one word on every phone.')]], 540)

    sheet(os.path.join(HERE, 'results-360.png'), '3 · Dates: one shorter date, everywhere',
          'The weekday is left out of the app\'s one date format: "Nov 26 · 3:55 PM". It is the part nobody needs to tell games apart, and on the small phone it pushes the time off the card. '
          'One format still, so it changes every screen, share picture and PDF the same way.',
          [[(ci('small-results'), today(SMALL), GREY, '"Thu, Nov 26 · 3:…", "Wed, Nov 25 · 6:55 …": the time is cut.'),
            (portrait(results, SMALL, True), prop(SMALL), GREEN, '"Nov 26 · 3:55 PM": the time shows. The cards are the same height.')],
           [(ci('pixel6-results'), today(PIXEL6), GREY, 'The full date fits.'),
            (portrait(results, PIXEL6, True), prop(PIXEL6), GREEN, 'The same shorter date. Nothing else on the card changes.')]], 540)

    sheet(os.path.join(HERE, 'home-cards-360.png'), '3 · The same date on Home',
          'Home uses the same game card inside the Live box, so it has even less room on the small phone.',
          [[(ci('small-home'), today(SMALL), GREY, '"Thu, Nov 26 · 5:2…", "Thu, Nov 26 · 4:5…".'),
            (portrait(home, SMALL, True), prop(SMALL), GREEN, '"Nov 26 · 5:25 PM". ("My pla…" is a separate small item, not part of this.)')],
           [(ci('pixel6-home'), today(PIXEL6), GREY, 'The full date fits.'),
            (portrait(home, PIXEL6, True), prop(PIXEL6), GREEN, 'The same shorter date.')]], 540)

    # Two scroll positions. FIRST: the Results / My players row just under the header. LAST: the last live
    # game (S1) with its top 163 dp under the header, which is where CI's Maestro log found it today
    # (flow 03 on the small phone: bounds x=88 y=754 w=934 h=175 px in the 2340 x 1080 window).
    FIRST, LAST = ('.btn.accent', 8), ('#gS1', 163)
    sheet(os.path.join(HERE, 'home-sideways-360.png'), '4 · Home with the phone turned sideways: the upright list, on every phone',
          'CI takes no picture of Home sideways, so both sides are drawn from the app\'s own sizes. Today any window 700 dp wide gets two columns, Live on the left and Recent on the right. '
          'Proposed: the two columns go; Home is the same single list as upright, Recent under Live, never wider than 760 dp. The dates are fix 3.',
          [[(sideways(SMALL, False, *FIRST), f'Today · small phone sideways (780 × 360 dp, text 1.3)', GREY, 'Two columns, each about as narrow as the upright phone: "My play…", dates cut, four-line cards.'),
            (sideways(SMALL, True, *FIRST), f'Proposed · small phone sideways', GREEN, 'One list across the width: both buttons in full, the full date, two-line cards.')],
           [(sideways(SMALL, False, *LAST), 'Today · small phone, at the last live game', GREY, 'Recent has ended, so the right half is empty; one card and a bit fit.'),
            (sideways(SMALL, True, *LAST), 'Proposed · small phone, at the last live game', GREEN, 'Two cards and a bit fit, and the whole width is used.')],
           [(sideways(PIXEL6, False, *FIRST), f'Today · Pixel 6 sideways (915 × 412 dp, text 1.0)', GREY, 'Two columns of 372 dp; everything fits.'),
            (sideways(PIXEL6, True, *FIRST), f'Proposed · Pixel 6 sideways', GREEN, 'One list 760 dp wide in the middle. Recent now comes after the five live games instead of beside them, so it takes scrolling to reach.')]], 780)
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == '__main__':
    main()
