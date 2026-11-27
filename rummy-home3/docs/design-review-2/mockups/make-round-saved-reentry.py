#!/usr/bin/env python3
"""Round saved (pool) + the re-entry seat, Nov 27 (Sree: "the reentry should be done with the round save popup. I kind
of don't understand, but you can show me more."). Palette B (D65), Size S look (§10): grouped list, hairlines, text
actions on the rows, one filled button. Phones are drawn at their real dp size: Pixel 6 = 412 × 915, the small phone
= 360 × 780 with text × 1.3 (D95). Today's frames are CI's own (run 46035664063, flow 16, frame 16h), committed beside
this script as round-saved-today-ci-*.png. Renders three PNGs with headless Chrome:

  round-saved-reentry-1.png  today (CI) · today with 5 players / 2 out · proposed
  round-saved-reentry-2.png  tap Re-enter: the seat line · another seat · after Re-enter
  round-saved-reentry-3.png  today on the small phone (CI) · 12 players on the small phone · one left · dark
"""
import os, shutil, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = '/usr/local/bin/google-chrome'

# constants/theme.ts, palette B (D65 / D71)
LIGHT = dict(bg='#F5F2E8', surface='#FFFFFF', on='#1A1F1B', muted='#5A615B', hair='#E6E1D3', outline='#8E928A',
             primary='#0E4D2A', onprimary='#FFFFFF', primaryc='#D8ECDD', onprimaryc='#0B3B1F',
             secc='#F0DFAE', onsecc='#3E2E07', brass='#8A6A1E', loss='#A8201A', lossc='#FFE1DD',
             reentry='#2B5FBF', reentryc='#DCE8FF', sunken='#ECE7DA', tint='#F7F3E6', leader='#9A6700', leaderc='#FFF0BF',
             win='#0C6331', scrim='rgba(0,0,0,.42)', nav='#F5F2E8', navic='#5A615B', cell='#F3F3ED')
DARK = dict(bg='#0C120E', surface='#141B16', on='#ECEBE4', muted='#B6BDB4', hair='#2A322C', outline='#848C84',
            primary='#7FD39F', onprimary='#063019', primaryc='#1A3F29', onprimaryc='#CDEFD8',
            secc='#4A3A10', onsecc='#F5E3B0', brass='#E3BE63', loss='#FFA19A', lossc='#7A1F1A',
            reentry='#9DBCFF', reentryc='#22406E', sunken='#101712', tint='#1B231D', leader='#FFD45E', leaderc='#4D3900',
            win='#73DF9D', scrim='rgba(0,0,0,.6)', nav='#0C120E', navic='#B6BDB4', cell='#1B231D')

def tokens(t):
    return ';'.join(f'--{k}:{v}' for k, v in t.items())

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#EFECE3;font-family:'Noto Sans','DejaVu Sans',sans-serif;color:#1d1d1b;padding:20px 22px 24px}
h1{font-size:21px;margin-bottom:4px}
.lead{font-size:14px;color:#4a4a44;line-height:1.45;margin-bottom:14px;max-width:1400px}
.lead q{font-style:italic}
.row3{display:flex;gap:22px;align-items:flex-start}
.col{display:flex;flex-direction:column;align-items:center}
.cap{font-size:13.5px;color:#333;text-align:center;margin-top:9px;line-height:1.4}
.cap b{color:#0E4D2A}
.phone{--k:1;position:relative;width:412px;height:915px;background:var(--bg);color:var(--on);overflow:hidden;border-radius:20px;
       box-shadow:0 0 0 1px #cfcabc, 0 6px 18px rgba(0,0,0,.12);font-family:'Noto Sans',sans-serif}
.phone.small{--k:1.3;width:360px;height:780px}
.phone img.ci{width:100%;height:100%;display:block}
/* status + nav */
.st{height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font-size:13px;color:var(--muted)}
.nav{position:absolute;left:0;right:0;bottom:0;height:48px;background:var(--nav);display:flex;align-items:center;justify-content:space-around;padding:0 70px;color:var(--navic);font-size:18px;z-index:5}
/* Add round behind the sheet (only the shapes matter) */
.top{height:58px;display:flex;align-items:center;gap:12px;padding:0 14px}
.badge{background:var(--secc);color:var(--onsecc);font-weight:700;border-radius:8px;padding:3px 7px;font-size:17px}
.top .t{flex:1}
.top .t b{display:block;font-size:22px}
.top .t small{font-size:13px;color:var(--muted);font-weight:600}
.av0{width:38px;height:38px;border-radius:50%;background:#0F766E;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:6px 14px}
.cardx{border:1.5px solid var(--outline);border-radius:12px;padding:7px 12px;background:var(--cell);height:76px}
.cardx b{display:block;font-size:16px}
.cardx span{font-size:24px}
.cardx small{font-size:12px;color:var(--muted)}
.keys{position:absolute;left:14px;right:14px;top:520px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.keys div{height:54px;border-radius:12px;background:var(--cell);border:1px solid var(--hair);display:flex;align-items:center;justify-content:center;font-size:26px;color:var(--muted)}
.save{position:absolute;left:14px;right:14px;bottom:62px;height:76px;display:flex;gap:10px}
.save .a{width:118px;border-radius:16px;background:var(--primaryc);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;font-size:15px}
.save .b{flex:1;border-radius:38px;background:var(--primary);color:var(--onprimary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px}
.scrim{position:absolute;inset:0;background:var(--scrim);z-index:2}
/* today's dialog (Paper, measured on the CI frame: 21 dp margins, 28 dp corners, body 16 Roboto ≈ 15.3 Noto) */
.dlg{position:absolute;left:21px;right:21px;background:var(--surface);border-radius:28px;padding:24px;z-index:3}
.dlg .ic{width:26px;height:22px;margin:0 auto 14px;border:2px solid var(--brass);border-radius:6px 6px 12px 12px}
.dlg h2{font-size:22px;font-weight:600;text-align:center;margin-bottom:16px}
.dlg p{font-size:15.3px;line-height:1.42;margin:0 0 6px}
.dlg p.out{color:var(--loss);font-weight:700}
.dlg p.g{color:var(--muted);margin-top:8px}
.dlg .acts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:18px}
.pillb{height:44px;border-radius:22px;border:1.5px solid var(--outline);padding:0 14px;display:flex;align-items:center;gap:6px;font-size:15.3px;font-weight:700;color:var(--primary);white-space:nowrap}
.fillb{height:44px;border-radius:22px;background:var(--primary);color:var(--onprimary);padding:0 22px;display:flex;align-items:center;font-size:15.3px;font-weight:700}
/* the proposed sheet; every size is × --k (text scale) */
.sheet{position:absolute;left:0;right:0;bottom:48px;max-height:calc(100% - 48px - 64px);background:var(--surface);border-radius:28px 28px 0 0;
       box-shadow:0 -6px 22px rgba(0,0,0,.25);display:flex;flex-direction:column;z-index:3}
.grab{width:32px;height:4px;border-radius:2px;background:var(--outline);margin:10px auto 2px;flex:none;opacity:.7}
.hd{padding:10px 20px 10px;flex:none}
.hd h2{font-size:calc(22px*var(--k));line-height:1.25}
.hd .s{font-size:calc(14px*var(--k));color:var(--muted);margin-top:3px;line-height:1.35}
.hd .sum{font-size:calc(14px*var(--k));color:var(--on);margin-top:6px;line-height:1.35}
.hd .sum b.lo{color:var(--loss)}
.list{flex:1 1 auto;min-height:0;overflow:hidden;position:relative;border-top:1px solid var(--hair)}
.gh{font-size:calc(12px*var(--k));font-weight:700;letter-spacing:.08em;color:var(--muted);padding:calc(12px*var(--k)) 20px 6px;text-transform:uppercase}
.r{display:flex;align-items:center;gap:12px;min-height:calc(58px*var(--k));padding:7px 12px 7px 20px;border-bottom:1px solid var(--hair)}
.r .av{width:calc(36px*var(--k));height:calc(36px*var(--k));border-radius:50%;background:var(--sunken);color:var(--muted);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:calc(13px*var(--k));flex:none}
.r .av.in{background:var(--primaryc);color:var(--onprimaryc)}
.r .av.back{background:var(--reentry);color:var(--surface)}
.r .av.lead{background:var(--leaderc);color:var(--leader)}
.r .nm{flex:1;min-width:0}
.r .nm b{display:block;font-size:calc(16px*var(--k));font-weight:600;line-height:1.25}
.r .nm small{display:block;font-size:calc(13.5px*var(--k));color:var(--muted);margin-top:1px;line-height:1.3}
.r .nm small.red{color:var(--loss);font-weight:600}
.r .nm small.blue{color:var(--reentry);font-weight:600}
.r .nm small.lead{color:var(--leader);font-weight:600}
.r .go{color:var(--primary);font-weight:700;font-size:calc(15px*var(--k));padding:0 8px;min-height:48px;display:flex;align-items:center;white-space:nowrap}
.r.on{background:var(--tint);border-bottom:0}
.r.back{background:var(--reentryc)}
.xp{background:var(--tint);padding:2px 20px 12px;border-bottom:1px solid var(--hair)}
.xp .line{font-size:calc(15px*var(--k));font-weight:700;line-height:1.4}
.xp .line.warn{color:var(--leader)}
.xp .g{font-size:calc(13.5px*var(--k));color:var(--muted);line-height:1.4;margin-top:8px}
.xp .acts{display:flex;justify-content:flex-end;align-items:center;gap:6px;margin-top:10px}
.txt{color:var(--primary);font-weight:700;font-size:calc(15px*var(--k));padding:0 12px;height:44px;display:flex;align-items:center}
.tonal{height:44px;border-radius:22px;background:var(--primary);color:var(--onprimary);padding:0 20px;display:flex;align-items:center;font-weight:700;font-size:calc(15px*var(--k))}
.strip{display:flex;align-items:flex-start;margin-top:10px;padding:8px 6px 4px;background:var(--surface);border:1px solid var(--hair);border-radius:12px;justify-content:center}
.seat{display:flex;flex-direction:column;align-items:center;width:52px}
.seat .n{font-size:11px;color:var(--muted);font-weight:700;height:14px}
.seat .d{width:36px;height:36px;border-radius:50%;background:var(--primaryc);color:var(--onprimaryc);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid transparent}
.seat.out .d{background:var(--sunken);color:var(--muted)}
.seat.deal .d{border-color:var(--primary)}
.seat.new .d{background:var(--secc);color:var(--onsecc);border:2px dashed var(--primary)}
.seat .tg{font-size:10.5px;color:var(--muted);height:15px;margin-top:2px;white-space:nowrap}
.seat.deal .tg{color:var(--primary);font-weight:700}
.seat.new .tg{color:var(--onsecc);font-weight:700}
.gap{width:10px;align-self:stretch;display:flex;justify-content:center;padding-top:20px}
.gap i{display:block;width:2px;height:26px;border-left:2px dotted var(--outline);opacity:.7}
.ft{flex:none;display:flex;gap:10px;padding:12px 16px 14px;border-top:1px solid var(--hair);background:var(--surface)}
.ft .fill{flex:1;height:calc(48px*var(--k));border-radius:999px;background:var(--primary);color:var(--onprimary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:calc(16px*var(--k))}
.ft .outl{flex:.7;height:calc(48px*var(--k));border-radius:999px;border:1px solid var(--outline);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:calc(16px*var(--k))}
.fade{position:absolute;left:0;right:0;bottom:0;height:40px;background:linear-gradient(rgba(255,255,255,0),var(--surface))}
.sbar{position:absolute;right:3px;top:8px;width:4px;height:44%;border-radius:2px;background:var(--outline);opacity:.55}
.cols{margin-top:12px;font-size:12.5px;color:#333;background:#fff;border:1px solid #ddd8cb;border-radius:10px;padding:8px 12px;line-height:1.6;width:412px}
.cols code{font-family:'Noto Sans Mono','DejaVu Sans Mono',monospace;font-size:12.5px;background:#F5F2E8;padding:1px 5px;border-radius:4px}
.cols .h{background:#F0DFAE}
"""


def behind(game, rnd, cards):
    """The Add round screen the sheet sits on (score-entry.tsx), drawn as plain shapes. After a save it already reads
    the next round, as the CI frame shows."""
    cs = ''.join(f'<div class="cardx"><b>{n}</b><span>{v}</span> <small>→ {t}</small></div>' for n, v, t in cards)
    keys = ''.join(f'<div>{k}</div>' for k in '1234567890')
    return (f'<div class="st"><span>8:42</span><span>▾ ▴ ▮</span></div>'
            f'<div class="top"><span style="font-size:22px">←</span><span class="badge">{game}</span>'
            f'<div class="t"><b>Round {rnd}</b><small>Started Fri, Nov 27 · 7:58 PM</small></div><div class="av0">SK</div><span>⋮</span></div>'
            f'<div class="cards">{cs}</div><div class="keys">{keys}</div>'
            f'<div class="save"><div class="a">Scored<span style="font-size:22px">5/5</span></div><div class="b">✓ Save round</div></div>'
            '<div class="scrim"></div>')


NAV = '<div class="nav"><span>◀</span><span>●</span><span>■</span></div>'


def phone(body, t=LIGHT, small=False):
    return f'<div class="phone{" small" if small else ""}" style="{tokens(t)}">{body}{NAV}</div>'


def ci(path, small=False):
    return f'<div class="phone{" small" if small else ""}"><img class="ci" src="file://{os.path.join(HERE, path)}"></div>'


def row(ini, name, sub, go='Re-enter', av='', cls='', subcls='red'):
    action = f'<span class="go">{go}</span>' if go else ''
    return (f'<div class="r {cls}"><div class="av {av}">{ini}</div><div class="nm"><b>{name}</b>'
            f'<small class="{subcls}">{sub}</small></div>{action}</div>')


def strip(seats):
    """seats: (number, initials, kind, tag), in seat order. A tap on a seat puts him on that person's left."""
    parts = []
    for i, (n, ini, kind, tag) in enumerate(seats):
        if i:
            parts.append('<div class="gap"><i></i></div>')
        parts.append(f'<div class="seat {kind}"><div class="n">{n}</div><div class="d">{ini}</div><div class="tg">{tag}</div></div>')
    return f'<div class="strip">{"".join(parts)}</div>'


def sheet(title, sub, summary, body, foot, scroll=False):
    extra = '<div class="fade"></div><div class="sbar"></div>' if scroll else ''
    return (f'<div class="sheet"><div class="grab"></div><div class="hd"><h2>{title}</h2><div class="s">{sub}</div>'
            f'<div class="sum">{summary}</div></div><div class="list">{body}{extra}</div><div class="ft">{foot}</div></div>')


CLOSE = '<div class="fill">Close</div>'

# ---------- the 5-player pool ----------
# Seats 1 Sree · 2 Anil · 3 Priya · 4 Venkat · 5 Harish. Seven rounds dealt S A P V H S A; round 7 puts Venkat (104)
# and Harish (112) out. Still in: Sree 41, Anil 72, Priya 95 → a re-entry starts at 96 (Highest score + 1). Priya
# deals round 8.
CARDS5 = [('Sree Koneru', 0, 41), ('Anil Sharma', 25, 72), ('Priya Kumar', 30, 95), ('Venkat Rao', 35, '104 · OUT'), ('Harish Gadupudi', 50, '112 · OUT')]
BEHIND5 = behind('P5', 8, CARDS5)
SUB5 = 'Next: round 8 · Priya deals'
SUM5 = '<b class="lo">2 out</b> this round · <b>3</b> still in · re-entry at <b>96</b>'

today5 = BEHIND5 + (
    '<div class="dlg" style="top:250px"><div class="ic"></div><h2>Round saved</h2>'
    '<p class="out">Venkat Rao is out at 104 (limit 101).</p><p class="out">Harish Gadupudi is out at 112 (limit 101).</p>'
    '<p class="g">May re-enter at 96: Venkat Rao, Harish Gadupudi</p>'
    '<div class="acts"><span class="pillb">↺ Re-enter Venkat</span><span class="pillb">↺ Re-enter Harish</span><span class="fillb">Close</span></div></div>')

OUT5 = ('<div class="gh">Out this round</div>'
        + row('VR', 'Venkat Rao', 'Out at 104')
        + row('HG', 'Harish Gadupudi', 'Out at 112'))
proposed5 = BEHIND5 + sheet('Round 7 saved', SUB5, SUM5, OUT5, CLOSE)

# ---------- 2: tap Re-enter on Harish's row ----------
SEATS_DEFAULT = [(1, 'SK', '', ''), (2, 'AS', '', ''), (3, 'HG', 'new', 'was 5'), (4, 'PK', 'deal', 'deals'), (5, 'VR', 'out', 'out')]
SEATS_PICKED = [(1, 'SK', '', ''), (2, 'HG', 'new', 'was 5'), (3, 'AS', '', ''), (4, 'PK', 'deal', 'deals'), (5, 'VR', 'out', 'out')]

expanded = BEHIND5 + sheet('Round 7 saved', SUB5, SUM5,
    '<div class="gh">Out this round</div>'
    + row('VR', 'Venkat Rao', 'Out at 104')
    + row('HG', 'Harish Gadupudi', 'Out at 112', go='', cls='on')
    + '<div class="xp"><div class="line">Harish sits at seat 3, between Anil and Priya — left of the dealer.</div>'
    + strip(SEATS_DEFAULT)
    + '<div class="g">He comes back at 96, opens round 8 and deals last, after Anil. Tap a name to seat him on that person\'s left instead.</div>'
    + '<div class="acts"><span class="txt">Keep seat 5</span><span class="tonal">Re-enter at 96</span></div></div>',
    CLOSE)

picked = BEHIND5 + sheet('Round 7 saved', SUB5, SUM5,
    '<div class="gh">Out this round</div>'
    + row('VR', 'Venkat Rao', 'Out at 104')
    + row('HG', 'Harish Gadupudi', 'Out at 112', go='', cls='on')
    + '<div class="xp"><div class="line">Harish sits at seat 2, between Sree and Anil.</div>'
    + strip(SEATS_PICKED)
    + '<div class="line warn" style="font-size:calc(13.5px*var(--k));margin-top:8px">Not the dealer\'s left: Anil opens round 8, Harish deals round 10.</div>'
    + '<div class="acts"><span class="txt">Keep seat 5</span><span class="tonal">Re-enter at 96</span></div></div>',
    CLOSE)

after = BEHIND5 + sheet('Round 7 saved', SUB5, '<b class="lo">1 out</b> · <b>4</b> still in · re-entry at <b>96</b>',
    '<div class="gh">Out this round</div>'
    + row('VR', 'Venkat Rao', 'Out at 104')
    + row('HG', 'Harish Gadupudi', '↺ Back in at 96 · seat 3, left of Priya', go='', av='back', cls='back', subcls='blue'),
    CLOSE)

# ---------- 3: 12 players on the small phone (360 dp, text × 1.3) ----------
# Round 9 puts Harish, Lakshmi and Gopal out; Venkat, Padma and Suresh went out earlier (Padma used her one
# re-entry). Six still in; the highest is 87, so a re-entry starts at 88. Anil deals round 10.
CARDS12 = [('Sree K.', 0, 61), ('Anil S.', 20, 74), ('Priya K.', 25, 87), ('Harish G.', 40, '118')]
BEHIND12 = behind('P12', 10, CARDS12)
small12 = BEHIND12 + sheet('Round 9 saved', 'Next: round 10 · Anil deals',
    '<b class="lo">3 out</b> this round · <b>6</b> still in · re-entry at <b>88</b>',
    '<div class="gh">Out this round</div>'
    + row('HG', 'Harish Gadupudi', 'Out at 118')
    + row('LN', 'Lakshmi Naidu', 'Out at 104')
    + row('GK', 'Gopal Krishnan', 'Out at 109')
    + '<div class="gh">Out earlier</div>'
    + row('VR', 'Venkat Rao', 'Out in round 6', subcls='')
    + row('PI', 'Padma Iyer', 'Out in round 7 · no re-entries left', go='', subcls='')
    + row('SB', 'Suresh Babu', 'Out in round 8', subcls=''),
    CLOSE, scroll=True)

# ---------- 4: only one player left ----------
# Round 9: Sree (107) and Anil (119) go out; Venkat and Harish were out already; Priya (88) is the one left.
CARDS_LAST = [('Sree Koneru', 30, 107), ('Anil Sharma', 40, 119), ('Priya Kumar', 0, 88), ('Venkat Rao', '—', 'OUT'), ('Harish Gadupudi', '—', 'OUT')]
last = behind('P5', 10, CARDS_LAST) + sheet('Round 9 saved', 'Only Priya is left. Complete the pool, or re-enter someone to keep playing.',
    '<b class="lo">2 out</b> this round · <b>1</b> still in · re-entry at <b>89</b>',
    '<div class="gh">Still in</div>'
    + row('PK', 'Priya Kumar', '88 · wins if you complete now', go='', av='lead', subcls='lead')
    + '<div class="gh">Out this round</div>'
    + row('SK', 'Sree Koneru', 'Out at 107')
    + row('AS', 'Anil Sharma', 'Out at 119')
    + '<div class="gh">Out earlier</div>'
    + row('VR', 'Venkat Rao', 'Out in round 7', subcls='')
    + row('HG', 'Harish Gadupudi', 'Out in round 7', subcls=''),
    '<div class="outl">Close</div><div class="fill" style="flex:1.3">Complete the pool</div>')


def page(title, lead, cols, extra=''):
    return (f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body><h1>{title}</h1>'
            f'<div class="lead">{lead}</div><div class="row3">{"".join(cols)}</div>{extra}</body></html>')


def col(ph, cap, below=''):
    return f'<div class="col">{ph}<div class="cap">{cap}</div>{below}</div>'


SREE = ('Sree, Nov 27: <q>the reentry should be done with the round save popup. I kind of don\'t understand, but you can '
        'show me more.</q> Nov 21: <q>the buttons and the text are all over the place … what if there are more players, will it '
        'scroll?</q> and <q>they have to always sit to the left side of the person that is dealing. Even if someone re-enters … '
        'the admin can move the players around … implement this as a default</q>. Pictures only, nothing built.')

PAGES = {
    'round-saved-reentry-1.png': page(
        '1 · Round saved (pool): today and proposed — Pixel 6, 412 dp',
        SREE,
        [col(ci('round-saved-today-ci-pixel6.png'), '<b>Today, as CI sees it</b> (run 46035664063, flow 16, frame 16h):<br>4 players, Zed out. The red line is this round only;<br>the Re-enter buttons are everyone who may come back.'),
         col(phone(today5), '<b>Today with 5 players, 2 out</b> (drawn at the CI sizes):<br>two red sentences, the same names again in grey,<br>a pill per name. Re-enter closes the screen at once.'),
         col(phone(proposed5), '<b>Proposed</b>: a bottom sheet. Title, next dealer and one<br>summary line on top; one row per player who is out,<br>Re-enter on the row; one Close at the bottom.')]),
    'round-saved-reentry-2.png': page(
        '2 · Tap Re-enter: where he sits, before he sits there',
        'The row opens in place — no second dialog. One line says the seat (the same words Add players uses since 054), the '
        'strip shows it in seat order, which is the scorecard\'s column order. Default = left of the dealer: two taps. '
        'Another seat = tap a name (he sits on that person\'s left), then Re-enter. Keep seat 5 = today\'s behaviour.',
        [col(phone(expanded), '<b>2a · Tap Re-enter on Harish.</b> Seat 3, left of Priya, who<br>deals round 8. He opens round 8 and deals last.<br>Two taps: Re-enter, then Re-enter at 96.'),
         col(phone(picked), '<b>2b · Tap Anil:</b> Harish sits on Anil\'s left instead (Sree:<br>"the admin can move the players around"). A warning,<br>not a refusal (D50): it says what changes, then lets him.'),
         col(phone(after), '<b>2c · After Re-enter at 96.</b> The sheet stays open, so<br>Venkat can come back too; Close goes to the<br>scorecard. Undo undoes the re-entry; the seat stays.',
             '<div class="cols">Scorecard columns follow the seats (D56):<br>before <code>SK AS PK VR HG</code><br>after&nbsp;&nbsp;&nbsp;<code>SK AS <span class="h">HG</span> PK VR</code> — his old rounds move with him.<br>Today (Keep seat 5) Harish deals round 9, straight after Priya.</div>')]),
    'round-saved-reentry-3.png': page(
        '3–5 · Many players on the small phone, one player left, dark',
        'Small phone = 360 dp wide with text × 1.3, the worst case CI runs (D95: nothing is cut; long names wrap). '
        'The title, the summary and Close never move; only the list scrolls.',
        [col(ci('round-saved-today-ci-small.png', small=True), '<b>Today on the small phone</b> (same CI run):<br>one player out already wraps the red line.'),
         col(phone(small12, small=True), '<b>3 · 12 players, 6 out, small phone.</b> This round\'s<br>outs first, then earlier ones; Padma has no<br>re-entry left, so no button. The list scrolls.'),
         col(phone(last), '<b>4 · Only Priya is left.</b> Complete the pool is<br>the main button; Re-enter still works on<br>every row (the pool goes on).'),
         col(phone(proposed5, DARK), '<b>5 · Dark</b> (palette B, green-black, D71):<br>the same sheet as 1.')]),
}


def render(name, html, width):
    out = os.path.join(HERE, name)
    d = tempfile.mkdtemp()
    path = os.path.join(d, 'm.html')
    open(path, 'w').write(html)
    shot = os.path.join(d, 'shot.png')
    # Headless Chrome writes the screenshot and then may not exit; it is killed after the wait.
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                             '--force-device-scale-factor=2', f'--user-data-dir={d}/u', f'--window-size={width},1300',
                             '--allow-file-access-from-files', '--virtual-time-budget=2000', f'--screenshot={shot}', f'file://{path}'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        proc.wait(timeout=25)
    except subprocess.TimeoutExpired:
        proc.kill()
    im = Image.open(shot).convert('RGB')
    # trim the empty page below the content
    bg = im.getpixel((2, im.height - 2))
    bottom = im.height
    for y in range(im.height - 1, 0, -4):
        if any(im.getpixel((x, y)) != bg for x in range(0, im.width, 7)):
            bottom = min(im.height, y + 40)
            break
    im.crop((0, 0, im.width, bottom)).quantize(colors=256, method=Image.Quantize.MEDIANCUT).save(out, optimize=True)
    shutil.rmtree(d, ignore_errors=True)
    print(out, im.width, bottom)


if __name__ == '__main__':
    render('round-saved-reentry-1.png', PAGES['round-saved-reentry-1.png'], 22 * 2 + 412 * 3 + 22 * 2)
    render('round-saved-reentry-2.png', PAGES['round-saved-reentry-2.png'], 22 * 2 + 412 * 3 + 22 * 2)
    render('round-saved-reentry-3.png', PAGES['round-saved-reentry-3.png'], 22 * 2 + 360 * 2 + 412 * 2 + 22 * 3)
