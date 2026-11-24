#!/usr/bin/env python3
"""Mockups, Nov 21 (suggestions only): Round saved dialog, Awards header, theme toggle, winner toast."""
import os, subprocess, tempfile, shutil, sys
sys.argv = ['x']
from PIL import Image, ImageDraw, ImageFont

OUT = '/tmp/mock/out2'
os.makedirs(OUT, exist_ok=True)
CHROME = '/usr/local/bin/google-chrome'
LIGHT = dict(bg='#F6F6F1', onbg='#17201B', surface='#FFFFFF', onsurf='#17201B', muted='#4E5752', hair='#E8E8E1', outline='#8A918C',
             primary='#15803D', onprimary='#FFFFFF', primaryc='#D6F5DF', onprimaryc='#0B3B1F', sec='#8A5A00', secc='#FFE38A', onsecc='#3F2D00',
             error='#B4231B', errorc='#FBE3E0', felt='#0B3B1F', sunken='#EEEEE7', avatar='#15803D', scrim='rgba(0,0,0,.42)')

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:412px;background:var(--bg);color:var(--onbg);font-family:Roboto,"Noto Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.phone{position:relative;width:412px;min-height:820px;background:var(--bg);overflow:hidden}
.status{height:36px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:14px;color:var(--muted)}
.bar{height:56px;display:flex;align-items:center;padding:0 16px;gap:16px}
.bar h1{font-size:22px;font-weight:700;flex:1}
.bar .ic{width:24px;height:24px;border-radius:50%;border:2px solid var(--onbg)}
.bar .ic.sq{border-radius:4px}
.bar .ic.dots{border:0;font-weight:900;font-size:22px;line-height:18px;text-align:center}
.sub{font-size:13px;color:var(--muted);padding:0 16px 10px}
.scrim{position:absolute;inset:0;background:var(--scrim)}
.dialog{position:absolute;left:24px;right:24px;top:140px;background:var(--surface);border-radius:28px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.dialog .icon{width:28px;height:28px;border-radius:50%;border:2px solid var(--muted);margin:0 auto 14px}
.dialog h2{font-size:22px;text-align:center;margin-bottom:14px}
.dialog p{font-size:15px;margin:3px 0}
.dialog p.out{color:var(--error);font-weight:700}
.dialog p.grey{color:var(--muted);margin-top:10px}
.acts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:18px}
.pill{height:40px;border-radius:20px;border:1px solid var(--outline);padding:0 14px 0 12px;display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:var(--primary);white-space:nowrap}
.pill .r{width:16px;height:16px;border:2px solid var(--primary);border-radius:50%;border-top-color:transparent}
.btn{height:40px;border-radius:20px;background:var(--primary);color:var(--onprimary);padding:0 24px;display:flex;align-items:center;font-size:14px;font-weight:600}
.btn.text{background:transparent;color:var(--primary);padding:0 12px}
/* proposed sheet */
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:28px 28px 0 0;box-shadow:0 -8px 24px rgba(0,0,0,.25);display:flex;flex-direction:column}
.sheet .grab{width:32px;height:4px;border-radius:2px;background:var(--outline);margin:12px auto 0}
.sheet .hd{padding:14px 20px 8px}
.sheet .hd h2{font-size:22px}
.sheet .hd .s{font-size:14px;color:var(--muted);margin-top:4px}
.list{overflow:hidden;position:relative}
.list.scroll{max-height:372px}
.prow{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 20px;border-top:1px solid var(--hair)}
.prow .av{width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex:none}
.prow .av.out{background:var(--sunken);color:var(--muted)}
.prow .nm{flex:1;min-width:0}
.prow .nm b{display:block;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prow .nm small{display:block;font-size:13px;color:var(--muted);margin-top:1px}
.prow .nm small.out{color:var(--error);font-weight:600}
.prow .score{font-variant-numeric:tabular-nums;font-size:16px;font-weight:700;width:44px;text-align:right}
.prow .score.out{color:var(--error)}
.prow .act{color:var(--primary);font-weight:700;font-size:14px;width:76px;text-align:right}
.prow .act.in{color:var(--muted);font-weight:500}
.fade{position:absolute;left:0;right:0;bottom:0;height:36px;background:linear-gradient(rgba(255,255,255,0),var(--surface))}
.sheet .ft{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px 20px;border-top:1px solid var(--hair)}
.chipline{display:flex;gap:8px;padding:0 20px 12px;flex-wrap:wrap}
.chip{height:28px;border-radius:14px;padding:0 10px;display:flex;align-items:center;font-size:13px;font-weight:600;background:var(--sunken);color:var(--onsurf)}
.chip.red{background:var(--errorc);color:var(--error)}
.chip.green{background:var(--primaryc);color:var(--onprimaryc)}
/* awards */
.tag{display:inline-flex;align-items:center;gap:6px;height:28px;border-radius:14px;padding:0 10px;background:var(--primaryc);color:var(--onprimaryc);font-size:13px;font-weight:600}
.gameline{padding:4px 16px 0;display:flex;align-items:center;gap:10px}
.gameline .g{font-size:16px;font-weight:700}
.gameline .m{font-size:14px;color:var(--muted)}
.hrow{display:flex;align-items:flex-end;justify-content:space-between;padding:10px 16px 4px}
.entry label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
.entry .box{height:40px;width:96px;border:1px solid var(--outline);border-radius:8px;padding:0 12px;display:flex;align-items:center;font-size:17px;font-variant-numeric:tabular-nums}
.h3{font-size:16px;font-weight:700;padding:16px 16px 8px}
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px}
.chips .c{height:34px;border-radius:17px;border:1px solid var(--outline);padding:0 12px;display:flex;align-items:center;font-size:13px;font-weight:600;color:var(--primary)}
.chips .c.on{background:var(--primary);color:#fff;border-color:var(--primary)}
table{width:100%;border-collapse:collapse;margin-top:12px}
th{font-size:11px;letter-spacing:.06em;color:var(--muted);text-align:right;padding:8px 6px;border-bottom:1px solid var(--hair);white-space:nowrap}
th:first-child,td:first-child{text-align:left;padding-left:16px}
th:last-child,td:last-child{padding-right:16px}
td{padding:8px 6px;font-size:14px;text-align:right;font-variant-numeric:tabular-nums;border-bottom:1px solid var(--hair);vertical-align:top}
td .n{font-weight:600;display:block}
td .st{font-size:12px;color:var(--muted)}
td .st.red{color:var(--error)}
td.aw{font-weight:700}
.foot{display:flex;justify-content:flex-end;gap:8px;padding:16px}
.callout{position:absolute;background:#FFE38A;color:#3F2D00;font-size:12px;font-weight:700;padding:4px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.2)}
/* home */
.home h1{font-size:22px;font-weight:700}
.card{margin:8px 16px;background:var(--surface);border-radius:16px;padding:14px 16px;border:1px solid var(--hair)}
.card .t{display:flex;justify-content:space-between;font-weight:700;font-size:16px}
.card .d{font-size:13px;color:var(--muted);margin-top:4px}
.fab{position:absolute;right:16px;bottom:96px;height:56px;border-radius:16px;background:var(--primary);color:#fff;display:flex;align-items:center;padding:0 20px;font-weight:700;gap:8px}
.tabs{position:absolute;left:0;right:0;bottom:0;display:flex;gap:12px;padding:10px 16px 14px;background:var(--bg)}
.tabs div{flex:1;height:52px;border-radius:999px;background:var(--sunken);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary)}
.tabs .on{background:var(--primary);color:#fff}
.toggle{width:52px;height:30px;border-radius:15px;border:2px solid var(--outline);position:relative}
.toggle::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--outline)}
/* scorecard + toast */
.sc{margin:0 12px;background:var(--surface);border-radius:12px;border:1px solid var(--hair);overflow:hidden}
.sc table{margin:0}
.sc th{text-align:center;padding:10px 4px 6px}
.sc th b{display:block;font-size:14px;color:var(--onsurf)}
.sc th i{display:block;font-style:normal;font-size:12px;color:var(--muted)}
.sc td{text-align:center;padding:9px 4px;font-size:14px}
.sc td.rn{color:var(--muted);font-size:12px;width:36px}
.sc td.win{background:var(--primaryc);font-weight:700}
.toast{position:absolute;left:16px;right:16px;bottom:88px;background:var(--felt);color:#fff;border-radius:16px;padding:12px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 6px 20px rgba(0,0,0,.3)}
.toast .av{width:40px;height:40px;border-radius:50%;background:#FFE38A;color:#3F2D00;font-weight:800;display:flex;align-items:center;justify-content:center}
.toast .tx b{display:block;font-size:16px}
.toast .tx small{display:block;font-size:13px;opacity:.85;margin-top:2px}
.toast .pts{margin-left:auto;font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.toast .pts span{display:inline-block;transform:translateY(-2px);opacity:.6}

/* add by initials */
.irow{display:flex;align-items:center;gap:10px;padding:8px 16px}
.ibox{height:52px;border:1px solid var(--outline);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;background:var(--surface);position:relative}
.ibox.f{width:64px}.ibox.l{width:64px}.ibox.wide{width:96px}
.ibox.focus{border:2px solid var(--primary)}
.ibox.focus::after{content:'';position:absolute;left:50%;top:12px;width:2px;height:28px;background:var(--primary)}
.ibox.focus.has::after{left:calc(50% + 10px)}
.ibox .ph{color:var(--outline);font-weight:400;font-size:16px}
.irow .arrow{color:var(--outline);font-size:18px}
.irow .who{flex:1;font-size:14px;color:var(--muted)}
.irow .pill{height:36px}
.sticky{position:absolute;left:0;right:0;bottom:300px;padding:10px 16px;background:var(--bg);display:flex;justify-content:flex-end;gap:8px;border-top:1px solid var(--hair)}
.kbd{position:absolute;left:0;right:0;bottom:0;height:290px;background:#D9DCD6;display:grid;grid-template-columns:repeat(10,1fr);gap:6px;padding:12px 6px}
.kbd div{background:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:17px;height:44px}
.count{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 4px;font-size:14px;color:var(--muted)}
.seated{display:flex;flex-wrap:wrap;gap:8px;padding:6px 16px}
.seated div{height:30px;border-radius:15px;background:var(--sunken);padding:0 10px;display:flex;align-items:center;font-size:13px;font-weight:600}
.res{display:flex;align-items:center;gap:12px;min-height:60px;padding:0 16px;border-top:1px solid var(--hair);background:var(--surface)}
.res:last-of-type{border-bottom:1px solid var(--hair)}
.res .tick{width:28px;height:28px;border-radius:50%;background:var(--primaryc);color:var(--onprimaryc);display:flex;align-items:center;justify-content:center;font-weight:800}
.res .tick.warn{background:var(--secc);color:var(--onsecc)}
.res .ini{font-size:20px;font-weight:800;width:56px;font-variant-numeric:tabular-nums}
.res .ini s{color:var(--muted);font-weight:500;font-size:14px;text-decoration:line-through;margin-right:4px}
.res .ini em{font-style:normal;color:var(--error)}
.res .tx{flex:1;font-size:14px}
.res .tx small{display:block;color:var(--muted);font-size:13px;margin-top:2px}
.res .edit{color:var(--primary);font-weight:700;font-size:14px}

.chips .c.off{color:var(--muted);border-style:dashed;opacity:.7}
.why{font-size:13px;color:var(--muted);padding:6px 16px 4px;line-height:1.4}
.why b{color:var(--onbg)}

.eyebrow{font-size:12px;color:var(--muted);text-align:center;padding:6px 16px 0}
"""

def phone(inner, h=820):
    return f'<div class="phone" style="min-height:{h}px"><div class="status"><span>9:41</span><span>▮▮▮ 100%</span></div>{inner}</div>'

OUTS = [('Harish Gadupudi', 'HG', 112), ('Sree Koneru', 'SK', 104), ('Player 2', 'P2', 101), ('Player 3', 'P3', 107), ('Player 4', 'P4', 118), ('P R', 'PR', 103)]
INS = [('Venkat Rao', 'VR', 96)]

def round_saved_before():
    body = ''.join(f'<p class="out">{n} is out at {s} (limit 101).</p>' for n, _, s in OUTS)
    body += '<p class="grey">May re-enter at 96: ' + ', '.join(n for n, _, _ in OUTS) + '</p>'
    pills = ''.join(f'<div class="pill"><span class="r"></span>Re-enter {n.split()[0]}</div>' for n, _, _ in OUTS)
    bar = '<div class="bar"><div class="ic sq"></div><h1>Add round · P5</h1><div class="ic"></div></div>'
    return phone(bar + '<div class="scrim"></div>' + f'<div class="dialog"><div class="icon"></div><h2>Round saved</h2>{body}<div class="acts">{pills}<div class="btn">Close</div></div></div>', 900)

def sheet(rows, title, subtitle, scroll=False, chips='', footer='<div class="btn text">Complete</div><div class="btn">Close</div>', top=170):
    lst = ''.join(rows)
    return (f'<div class="sheet"><div class="grab"></div><div class="hd"><h2>{title}</h2><div class="s">{subtitle}</div></div>'
            + (f'<div class="chipline">{chips}</div>' if chips else '')
            + f'<div class="list {"scroll" if scroll else ""}">{lst}{"<div class=fade></div>" if scroll else ""}</div>'
            + f'<div class="ft">{footer}</div></div>')

def prow(name, ini, score, state, act):
    out = state.startswith('out')
    return (f'<div class="prow"><div class="av {"out" if out else ""}">{ini}</div><div class="nm"><b>{name}</b><small class="{"out" if out else ""}">{state}</small></div>'
            f'<div class="score {"out" if out else ""}">{score}</div><div class="act {"" if act == "Re-enter" else "in"}">{act}</div></div>')

def round_saved_after():
    rows = [prow(n, i, s, f'Out this round · over 101', 'Re-enter') for n, i, s in OUTS] + [prow(n, i, s, 'Still in · 5 left · 1 drop', '') for n, i, s in INS]
    bar = '<div class="bar"><div class="ic sq"></div><h1>Add round · P5</h1><div class="ic"></div></div>'
    chips = '<div class="chip red">6 out this round</div><div class="chip green">1 in</div><div class="chip">Re-entry starts at 96</div>'
    return phone(bar + '<div class="scrim"></div>' + sheet(rows, 'Round 4 saved', 'Only one player is left in the pool. Re-enter someone to keep playing, or complete the pool.', chips=chips, top=150), 900)

def round_saved_after_12():
    names = [('Harish Gadupudi', 'HG', 112), ('Sree Koneru', 'SK', 104), ('Lakshmi Naidu', 'LN', 101), ('Anil Sharma', 'AS', 107), ('Padma Iyer', 'PI', 118), ('Ravi Menon', 'RM', 103),
             ('Kiran Patel', 'KP', 109), ('Deepa Nair', 'DN', 102), ('Suresh Varma', 'SV', 115), ('Meena Pillai', 'MP', 106), ('Venkat Rao', 'VR', 96), ('Swathi Bhat', 'SB', 88)]
    rows = [prow(n, i, s, 'Out this round · over 101', 'Re-enter') for n, i, s in names[:10]] + [prow(n, i, s, f'Still in · {101 - s} left', '') for n, i, s in names[10:]]
    bar = '<div class="bar"><div class="ic sq"></div><h1>Add round · P12</h1><div class="ic"></div></div>'
    chips = '<div class="chip red">10 out this round</div><div class="chip green">2 in</div><div class="chip">Re-entry starts at 96</div>'
    return phone(bar + '<div class="scrim"></div>' + sheet(rows, 'Round 7 saved', 'The list scrolls; the title and the buttons stay put.', scroll=True, chips=chips, footer='<div class="btn">Close</div>', top=150), 900)

def awards_after():
    bar = '<div class="bar"><div class="ic sq"></div><h1>Awards · P5</h1><div class="help" style="width:28px;height:28px;border:2px solid var(--onbg);border-radius:50%;text-align:center;font-weight:700;line-height:24px">?</div></div>'
    head = ('<div class="gameline"><span class="g">Friday night</span><span class="m">·</span><span class="m">Pool 101 · drop 25 · 7 players</span></div>'
            '<div class="hrow"><div><span class="tag">⚑ Completed</span><div class="sub" style="padding:8px 0 0">10 entries (a re-entry counts twice) · pool <b>1,000</b> points</div></div>'
            '<div class="entry"><label>Entry per player</label><div class="box">100</div></div></div>')
    chips = '<div class="h3">How to split the pool</div><div class="chips"><div class="c">Winner takes all</div><div class="c on">By points left</div><div class="c">50 / 50</div><div class="c">Entry per drop left</div><div class="c">Custom</div></div>'
    rows = [('Venkat Rao', '21 left · 1 drop', 80, 100, 420, '+320', False), ('Swathi Bhat', '6 left · 1 drop', 95, 200, 580, '+380', False),
            ('Harish Gadupudi', 'out R4', 112, 100, 0, '−100', True), ('Sree Koneru', 'out R4', 104, 200, 0, '−200', True), ('Player 2', 'out R3', 101, 100, 0, '−100', True),
            ('Player 3', 'out R4', 107, 100, 0, '−100', True), ('Player 4', 'out R4', 118, 100, 0, '−100', True), ('P R', 'out R2', 103, 100, 0, '−100', True)]
    trs = ''.join(f'<tr><td><span class="n">{n}</span><span class="st {"red" if o else ""}">{st}</span></td><td>{sc}</td><td>{p}</td><td>{g}</td><td class="aw">{a}</td></tr>' for n, st, sc, p, g, a, o in rows)
    table = f'<table><tr><th>Player</th><th>Score</th><th>Put in</th><th>Gets</th><th>Award</th></tr>{trs}</table>'
    foot = '<div class="foot"><div class="btn text">Not now</div><div class="btn">Save awards</div></div>'
    callouts = ('<div class="callout" style="left:230px;top:100px">game name + pool limit, one line</div>'
                '<div class="callout" style="left:300px;top:343px">"Award", never "AWAR D"</div>'
                '<div class="callout" style="left:120px;top:395px">"1 drop", not "1 drops"</div>')
    return phone(bar + head + chips + table + foot + callouts, 900)

def home(toggle):
    bar = ('<div class="bar home"><h1>Your games</h1>' + ('<div class="toggle"></div>' if toggle else '') + '<div class="ic"></div></div>')
    cards = ''.join(f'<div class="card"><div class="t"><span>{t}</span><span>{r}</span></div><div class="d">{d}</div></div>' for t, r, d in
                    [('P5 · Friday night', 'Live', 'Pool 101 · round 4 · 7 players'), ('S3', 'Completed', 'Points · 12 rounds · 4 players'), ('P4', 'Awarded', 'Pool 201 · 9 rounds · 5 players')])
    return phone(bar + cards + '<div class="fab">＋ New game</div><div class="tabs"><div class="on">Home</div><div>Me</div></div>', 720)

def winner_toast():
    bar = '<div class="bar"><div class="ic sq"></div><h1>P5 · Friday night</h1><div class="ic dots">⋮</div></div><div class="sub">Pool 101 · Round 4 · you are watching</div>'
    seats = [('HG', 112), ('SK', 104), ('VR', 96), ('SB', 88), ('P3', 107)]
    ths = ''.join(f'<th><b>{i}</b><i>{s}</i></th>' for i, s in seats)
    body = ''
    grid = [[0, 25, 30, 25, 40], [40, 0, 26, 18, 32], [37, 44, 0, 22, 35], [35, 35, 40, 23, 0]]
    for r, row in enumerate(grid):
        body += f'<tr><td class="rn">{r + 1}</td>' + ''.join(f'<td class="{"win" if v == 0 else ""}">{v}</td>' for v in row) + '</tr>'
    table = f'<div class="sc"><table><tr><th style="text-align:left"></th>{ths}</tr>{body}</table></div>'
    toast = '<div class="toast"><div class="av">P3</div><div class="tx"><b>Player 3 wins round 4</b><small>Rummy · the table put in 133</small></div><div class="pts"><span>1</span>33</div></div>'
    return phone(bar + table + toast + '<div class="eyebrow" style="position:absolute;bottom:40px;left:0;right:0">slides up for 2 s, numbers roll like a counter, then gone · viewers and the web link only · never for the admin typing scores</div>', 760)


def ini_bar(): return '<div class="bar"><div class="ic sq"></div><h1>Add by initials</h1><div class="ic"></div></div><div class="sub">Add new players by initials<br>First-name initial · Last-name initial</div>'
def kbd():
    keys = list('QWERTYUIOP') + list('ASDFGHJKL') + list('ZXCVBNM')
    return '<div class="kbd">' + ''.join(f'<div>{k}</div>' for k in keys) + '</div>'
def initials_before():
    rows = ('<div class="irow"><div class="ibox f">S</div><div class="ibox wide">K</div><div class="pill" style="height:36px">Save</div></div>'
            '<div class="irow"><div class="ibox f focus has">H</div><div class="ibox wide"><span class="ph">L</span></div><div class="pill" style="height:36px">Save</div></div>'
            '<div class="irow"><div class="ibox f"><span class="ph">F</span></div><div class="ibox wide"><span class="ph">L</span></div><div class="pill" style="height:36px">Save</div></div>')
    return phone(ini_bar() + rows + '<div class="count"><span>Playing in this game · 14</span><div class="pill" style="height:36px">Done</div></div>'
                 '<div class="seated"><div>SK</div><div>HG</div><div>VR</div><div>P2</div><div>P3</div><div>P4</div><div>PR</div><div>LN</div></div>' + kbd(), 900)
def initials_typing():
    rows = ('<div class="irow"><div class="ibox f">S</div><div class="ibox l">K</div><span class="who">Sree K · new</span></div>'
            '<div class="irow"><div class="ibox f">H</div><div class="ibox l focus"><span class="ph">L</span></div><span class="who">cursor moved here by itself</span></div>'
            '<div class="irow"><div class="ibox f"><span class="ph">F</span></div><div class="ibox l"><span class="ph">L</span></div><span class="who"></span></div>')
    return phone(ini_bar() + rows + '<div class="count"><span>Two letters make a player · 2 of 3 rows filled</span></div>'
                 '<div class="sticky"><div class="btn text">Cancel</div><div class="btn">Save 2 players</div></div>' + kbd(), 900)
def initials_saved():
    res = ('<div class="res"><div class="tick">✓</div><div class="ini">SK</div><div class="tx">Saved<small>Sree K · new player</small></div><div class="edit">Edit</div></div>'
           '<div class="res"><div class="tick warn">!</div><div class="ini"><s>HG</s>HG<em>2</em></div><div class="tx">Harish Gadupudi already has HG<small>This new player is HG2 · Edit to pick other letters (up to 3)</small></div><div class="edit">Edit</div></div>'
           '<div class="res"><div class="tick">✓</div><div class="ini">VR</div><div class="tx">Saved<small>V R · new player</small></div><div class="edit">Edit</div></div>')
    return phone(ini_bar().replace('Add new players by initials<br>First-name initial · Last-name initial', '3 players saved and seated') + res
                 + '<div class="count"><span>Playing in this game · 17</span></div>'
                 '<div class="seated"><div>SK</div><div>HG2</div><div>VR</div><div>HG</div><div>P2</div><div>P3</div><div>P4</div><div>PR</div><div>LN</div></div>'
                 '<div class="foot"><div class="btn text">Add 3 more</div><div class="btn">Done</div></div>', 760)


def awards_chips(variant):
    bar = '<div class="bar"><div class="ic sq"></div><h1>Awards · P6</h1><div class="help" style="width:28px;height:28px;border:2px solid var(--onbg);border-radius:50%;text-align:center;font-weight:700;line-height:24px">?</div></div>'
    head = ('<div class="gameline"><span class="g">Saturday pool</span><span class="m">·</span><span class="m">Pool 101 · drop 25 · 6 players</span></div>'
            '<div class="hrow"><div><span class="tag">⚑ Completed</span><div class="sub" style="padding:8px 0 0">7 entries (a re-entry counts twice) · pool <b>700</b> points</div></div>'
            '<div class="entry"><label>Entry per player</label><div class="box">100</div></div></div>')
    if variant == 'today':
        chips = '<div class="h3">How to split the pool</div><div class="chips"><div class="c on">Winner takes all</div><div class="c">By points left</div><div class="c">50 / 50</div><div class="c off">Entry per drop left</div><div class="c">Custom</div></div>'
        rows = [('Priya Reddy', '32 left · 1 drop', 69, 100, 700, '+600', False), ('Venkat Rao', '12 left · 0 drops', 89, 200, 0, '−200', False), ('Sree Koneru', '4 left · 0 drops', 97, 100, 0, '−100', False)]
        why = ''
    elif variant == 'drops':
        chips = '<div class="h3">How to split the pool</div><div class="chips"><div class="c on">By drops left</div><div class="c">Split evenly</div><div class="c">By points left</div><div class="c">Custom</div></div>'
        why = '<div class="why">Each player still in gets one entry per drop they have left; <b>Priya</b>, lowest score, gets the rest. One player left → they take it all.</div>'
        rows = [('Priya Reddy', '32 left · 1 drop', 69, 100, 500, '+400', False), ('Venkat Rao', '12 left · 1 drop', 89, 200, 100, '−100', False), ('Sree Koneru', '4 left · 1 drop', 97, 100, 100, '0', False)]
    else:
        chips = '<div class="h3">How to split the pool</div><div class="chips"><div class="c off">By drops left</div><div class="c on">Split evenly</div><div class="c">By points left</div><div class="c">Custom</div></div>'
        why = '<div class="why"><b>By drops left is off here</b>: Venkat\'s 3 drops (300) and Sree\'s 3 drops (300) would leave Priya, the winner, 100 — less than the others. Picked for you: <b>Split evenly</b> — the 3 players still in share 700.</div>'
        rows = [('Priya Reddy', '76 left · 3 drops', 25, 100, 234, '+134', False), ('Venkat Rao', '70 left · 3 drops', 31, 200, 233, '+33', False), ('Sree Koneru', '62 left · 3 drops', 39, 100, 233, '+133', False)]
    rows += [('Harish Gadupudi', 'out R6', 112, 100, 0, '−100', True), ('Anil Sharma', 'out R5', 104, 100, 0, '−100', True), ('Lakshmi Naidu', 'out R6', 107, 100, 0, '−100', True)]
    trs = ''.join(f'<tr><td><span class="n">{n}</span><span class="st {"red" if o else ""}">{st}</span></td><td>{sc}</td><td>{p}</td><td>{g}</td><td class="aw">{a}</td></tr>' for n, st, sc, p, g, a, o in rows)
    table = f'<table><tr><th>Player</th><th>Score</th><th>Put in</th><th>Gets</th><th>Award</th></tr>{trs}</table>'
    foot = '<div class="foot"><div class="btn text">Not now</div><div class="btn">Save awards</div></div>'
    return phone(bar + head + chips + why + table + foot, 860)
def awards_today(): return awards_chips('today')
def awards_drops(): return awards_chips('drops')
def awards_even(): return awards_chips('even')

SCREENS = {
    'round-saved-before': round_saved_before, 'round-saved-after': round_saved_after, 'round-saved-after-12': round_saved_after_12,
    'awards-after': awards_after, 'awards-today': awards_today, 'awards-drops': awards_drops, 'awards-even': awards_even, 'initials-before': initials_before, 'initials-typing': initials_typing, 'initials-saved': initials_saved, 'home-plain': lambda: home(False), 'home-toggle': lambda: home(True), 'winner-toast': winner_toast,
}

def render(name, tokens=LIGHT):
    html = '<!doctype html><html><head><meta charset="utf-8"><style>:root{' + ';'.join(f'--{k}:{v}' for k, v in tokens.items()) + '}' + CSS + '</style></head><body>' + SCREENS[name]() + '</body></html>'
    d = tempfile.mkdtemp(); p = os.path.join(d, 'm.html'); open(p, 'w').write(html)
    png = os.path.join(OUT, f'{name}.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                             f'--user-data-dir={d}/u', '--window-size=412,1000', '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: proc.wait(timeout=20)
    except subprocess.TimeoutExpired: proc.kill()
    assert os.path.exists(png), name
    shutil.rmtree(d, ignore_errors=True)
    return png

def strip(names, title, captions, out, w=412 * 2):
    ims = [Image.open(os.path.join(OUT, f'{n}.png')).convert('RGB') for n in names]
    h = max(im.size[1] for im in ims)
    pad = 40; capH = 70; titleH = 70
    sheet = Image.new('RGB', (pad + len(ims) * (w + pad), titleH + h + capH), (246, 246, 241))
    d = ImageDraw.Draw(sheet)
    fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30); f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
    d.text((pad, 20), title, fill=(23, 32, 27), font=fb)
    for i, (im, cap) in enumerate(zip(ims, captions)):
        x = pad + i * (w + pad); sheet.paste(im, (x, titleH))
        d.rectangle((x, titleH, x + w - 1, titleH + im.size[1] - 1), outline=(200, 200, 195))
        d.text((x + w / 2, titleH + h + 16), cap, fill=(23, 32, 27), font=f, anchor='mt')
    sheet.save(out)

if __name__ == '__main__':
    pass
    strip(['awards-today','awards-drops','awards-even'], 'Awards split chips: five today · proposed four, By drops left first · when drops is off, Split evenly is picked and the screen says why',
          ['Today: five chips, one greyed with no reason', 'Proposed: four chips, By drops left first', 'Drops not viable: reason shown, Split evenly picked'], f'{OUT}/awards-chips-mockup.png')
    print('ok')
