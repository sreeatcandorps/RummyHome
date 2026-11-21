#!/usr/bin/env python3
"""Size-S mockups (design-review-2 §5): Profile, Settings, Game type, Sign in as grouped lists.
Renders HTML with the app's theme tokens through headless Chrome at Pixel 6 width (412 dp @2x), light + dark."""
import os, subprocess, tempfile, shutil
from PIL import Image

OUT = '/tmp/mock/out'
os.makedirs(OUT, exist_ok=True)
CHROME = '/usr/local/bin/google-chrome'

LIGHT = dict(bg='#F6F6F1', onbg='#17201B', surface='#FFFFFF', onsurf='#17201B', muted='#4E5752', hair='#E8E8E1', outline='#8A918C',
             primary='#15803D', onprimary='#FFFFFF', primaryc='#D6F5DF', onprimaryc='#0B3B1F', sec='#8A5A00', secc='#FFE38A', onsecc='#3F2D00',
             error='#B4231B', felt='#0B3B1F', sunken='#EEEEE7', avatar='#15803D')
DARK = dict(bg='#0F1412', onbg='#EAEDE9', surface='#181E1B', onsurf='#EAEDE9', muted='#BAC2BC', hair='#343C38', outline='#8A938D',
            primary='#5FD68E', onprimary='#04301A', primaryc='#1A4A2E', onprimaryc='#CFF4DB', sec='#FFD45E', secc='#5C4300', onsecc='#FFE8AE',
            error='#FF978E', felt='#0B3B1F', sunken='#1F2622', avatar='#5FD68E')

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:412px;background:var(--bg);color:var(--onbg);font-family:Roboto,"Noto Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.status{height:36px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:14px;color:var(--muted)}
.bar{height:56px;display:flex;align-items:center;padding:0 16px;gap:16px}
.bar h1{font-size:22px;font-weight:700;flex:1}
.bar .back{width:24px;height:24px;color:var(--onbg)}
.help{width:28px;height:28px;border:2px solid var(--onbg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px}
.hdr{display:flex;align-items:center;gap:14px;padding:12px 16px 20px}
.avatar{width:56px;height:56px;border-radius:50%;background:var(--avatar);color:var(--onprimary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px}
.hdr .name{font-size:20px;font-weight:700}
.hdr .sub{font-size:14px;color:var(--muted);margin-top:2px}
.group{margin:6px 0 14px}
.gh{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--muted);padding:10px 16px 6px;display:flex;align-items:center;gap:8px}
.gh .i{width:16px;height:16px;border:1.5px solid var(--muted);border-radius:50%;font-size:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;letter-spacing:0}
.row{display:flex;align-items:center;min-height:52px;padding:0 16px;gap:12px;background:var(--surface);border-bottom:1px solid var(--hair)}
.group .row:first-of-type{border-top:1px solid var(--hair)}
.row .l{flex:1;font-size:16px}
.row .l small{display:block;font-size:13px;color:var(--muted);margin-top:2px}
.row .v{font-size:15px;color:var(--muted);text-align:right}
.row .v.mono{font-variant-numeric:tabular-nums}
.row .chev{color:var(--outline);font-size:22px;line-height:1;width:12px;text-align:right}
.row .pen{color:var(--primary);font-size:18px}
.row.red .l{color:var(--error)}
.row.stack{flex-direction:column;align-items:stretch;padding:12px 16px}
.seg{display:flex;border:1px solid var(--outline);border-radius:8px;overflow:hidden;height:40px;background:var(--surface)}
.seg div{flex:1;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:var(--onsurf);border-right:1px solid var(--outline)}
.seg div:last-child{border-right:0}
.seg .on{background:var(--secc);color:var(--onsecc)}
.row .seg{width:220px}
.row.stack .seg{width:100%;margin-top:8px}
.fields{display:flex;gap:12px;padding:10px 16px 14px;background:var(--surface);border-bottom:1px solid var(--hair)}
.fields.first{border-top:1px solid var(--hair)}
.field{flex:1}
.field label{display:block;font-size:12px;color:var(--muted);margin-bottom:5px}
.field .box{height:44px;border:1px solid var(--outline);border-radius:8px;padding:0 12px;display:flex;align-items:center;font-size:17px;font-variant-numeric:tabular-nums;background:var(--surface)}
.note{font-size:13px;color:var(--muted);padding:8px 16px 0}
.note.in{padding:6px 16px 10px;background:var(--surface);border-bottom:1px solid var(--hair);margin-top:-1px}
.caption{font-size:13px;color:var(--muted);padding:0 16px 10px}
.version{text-align:center;font-size:13px;color:var(--muted);padding:18px 0 22px}
.tabs{display:flex;gap:12px;padding:10px 16px 14px;background:var(--bg)}
.tabs .home{flex:1;height:52px;border-radius:999px;background:var(--sunken);display:flex;align-items:center;justify-content:center;color:var(--primary);font-size:22px}
.tabs .me{flex:1;height:52px;border-radius:999px;background:var(--primary);color:var(--onprimary);display:flex;align-items:center;justify-content:center;font-weight:700}
.tabbar{display:flex;border-top:1px solid var(--hair);background:var(--surface);padding:8px 0 12px}
.tabbar div{flex:1;text-align:center;font-size:12px;color:var(--muted)}
.tabbar div span{display:block;font-size:22px;margin-bottom:2px}
.tabbar .on{color:var(--primary);font-weight:700}
.tabbar .on .pill{display:inline-block;background:var(--primaryc);border-radius:999px;padding:1px 14px}
.btnbar{display:flex;gap:12px;padding:12px 16px 16px;background:var(--bg)}
.btn{height:52px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px}
.btn.fill{background:var(--primary);color:var(--onprimary);flex:1.6}
.btn.out{border:1px solid var(--outline);color:var(--primary);flex:1}
.felt{background:var(--felt);color:#fff;text-align:center;padding:26px 16px 70px}
.felt .logo{width:76px;height:76px;border-radius:18px;border:3px solid #F6F6F1;margin:0 auto 12px;background:#0E5A2A;display:flex;align-items:center;justify-content:center;font-size:34px}
.felt h1{font-size:28px;font-weight:700}
.felt p{font-size:15px;opacity:.85;margin-top:4px}
.card{background:var(--surface);border-radius:20px;margin:-50px 16px 0;padding:18px 18px 8px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
.card .field{margin-bottom:14px}
.boxes{display:flex;gap:8px;margin-bottom:16px}
.boxes div{flex:1;height:52px;border:1px solid var(--outline);border-radius:8px;background:var(--surface)}
.link{text-align:center;color:var(--primary);font-weight:700;font-size:15px;padding:14px 0 10px}
.newhere{text-align:center;font-size:15px;color:var(--muted);padding:26px 0 0}
.newhere b{color:var(--primary)}
"""

def status():
    return '<div class="status"><span>2:35</span><span>▾ ▲ ▮</span></div>'

def bar(title, back=False):
    b = '<div class="back">←</div>' if back else ''
    return f'<div class="bar">{b}<h1>{title}</h1><div class="help">?</div></div>'

def row(label, value='', chev=True, pen=False, red=False, sub=''):
    cls = 'row' + (' red' if red else '')
    v = f'<div class="v">{value}</div>' if value else ''
    s = f'<small>{sub}</small>' if sub else ''
    tail = '<div class="pen">✎</div>' if pen else ('<div class="chev">›</div>' if chev else '')
    return f'<div class="{cls}"><div class="l">{label}{s}</div>{v}{tail}</div>'

def seg(opts, on, cls=''):
    return '<div class="seg {}">'.format(cls) + ''.join(f'<div class="{"on" if i == on else ""}">{o}</div>' for i, o in enumerate(opts)) + '</div>'

def segrow(label, opts, on):
    return f'<div class="row"><div class="l">{label}</div>{seg(opts, on)}</div>'

def segstack(label, opts, on):
    return f'<div class="row stack"><div class="l">{label}</div>{seg(opts, on)}</div>'

def fields(pairs, first=False):
    inner = ''.join(f'<div class="field"><label>{l}</label><div class="box">{v}</div></div>' for l, v in pairs)
    return f'<div class="fields {"first" if first else ""}">{inner}</div>'

def group(title, body, info=False):
    i = '<span class="i">i</span>' if info else ''
    return f'<div class="group"><div class="gh">{title}{i}</div>{body}</div>'

def profile(tabbar=False):
    body = status() + bar('Profile')
    body += '<div class="hdr"><div class="avatar">ST</div><div><div class="name">Sree Test</div><div class="sub">sree@test.local · Player #1</div></div></div>'
    body += group('YOUR TABLE', row('Name', 'Sree Test') + row('Initials on scorecards', 'ST', pen=True) + row('Player ID', '#1 · Share'))
    body += group('NOTIFICATIONS', row('Phone', 'No number yet') + row('Email', 'Game started'))
    body += group('GAME DEFAULTS', row('Settings', 'Points · −10 · −30 · −80'))
    body += group('APPEARANCE', segrow('Theme', ['Phone', 'Light', 'Dark'], 1))
    body += group('HELP', row('Help &amp; guide', '', sub='How each screen works, tricky cases'))
    body += group('ACCOUNT', row('Change passcode') + row('Privacy policy') + row('Delete account', red=True) + row('Log out', chev=False, red=True))
    body += '<div class="version">EZ Score v1.1.0 (build 1)</div>'
    if tabbar:
        body += '<div class="tabbar"><div><span>⌂</span>Home</div><div><span>▤</span>Results</div><div><span>☺</span>Players</div><div class="on"><span class="pill">ST</span>Me</div></div>'
    else:
        body += '<div class="tabs"><div class="home">⌂</div><div class="me">ST</div></div>'
    return body

def pool_block(first_caption=None, defaults=False):
    b = ''
    if first_caption:
        b += f'<div class="caption">{first_caption}</div>'
    b += segstack('Pool limit', ['101', '201', '251', 'Other'], 0)
    b += '<div class="note in">100 is in, 101 is out.</div>'
    b += fields([('Drop', '25'), ('Middle drop', '50')])
    b += fields([('Full count', '130'), ('', '')]).replace('<div class="field"><label></label><div class="box"></div></div>', '<div class="field"></div>')
    b += segrow('Re-entries', ['Unlimited', 'Limited'], 0)
    b += segrow('Re-entry score', ['Highest', 'Highest + 1'], 1)
    b += segrow('Late entry score', ['Highest', 'Highest + 1'], 1)
    return b

def settings():
    body = status() + bar('Settings', back=True)
    body += group('NEW GAME STARTS AS', segstack('Game type', ['Points', 'Pool'], 0) + '<div class="note in">You can still switch on the Game type screen.</div>')
    body += group('POINTS DEFAULTS', fields([('Drop', '−10'), ('Middle drop', '−30')], first=True) + fields([('Full count', '−80'), ('Multiplier', '×1')]), info=True)
    body += group('POOL DEFAULTS', pool_block(), info=True)
    body += group('MORE', row('Which setting wins', '', sub='Game settings › Settings › app defaults') + row('Hidden &amp; deleted', '', sub='Games you hid, games or results you deleted'))
    body += '<div style="height:16px"></div>'
    return body

def gametype():
    body = status() + bar('Game type', back=True)
    body += group('GAME TYPE', segstack('This game is', ['Points', 'Pool'], 1))
    body += group('POOL SETTINGS', pool_block(first_caption='For this game only — prefilled from your defaults.'), info=True)
    body += group('PLAYERS', row('Picked players', '6 · Sree, Harish, Priya +3'))
    body += '<div class="btnbar"><div class="btn out">← Back</div><div class="btn fill">Next: order of players →</div></div>'
    return body

def signin():
    body = status()
    body += '<div class="felt"><div class="logo">🃏</div><h1>EZ Score: Rummy</h1><p>Sign in to keep score with your table</p></div>'
    body += '<div class="card">'
    body += '<div class="field"><label>Email</label><div class="box" style="font-variant-numeric:normal;color:var(--muted)">you@example.com</div></div>'
    body += '<div class="field"><label>6-digit passcode</label><div class="boxes"><div></div><div></div><div></div><div></div><div></div><div></div></div></div>'
    body += '<div class="btn fill">Sign in</div>'
    body += '<div class="link">Forgot passcode?</div>'
    body += '</div>'
    body += '<div class="newhere">New here? <b>Create account</b></div>'
    body += '<div style="height:120px"></div>'
    return body

SCREENS = {
    'profile': profile,
    'profile-tabbar': lambda: profile(tabbar=True),
    'settings': settings,
    'game-type': gametype,
    'sign-in': signin,
}

def render(name, theme, tokens):
    html = '<!doctype html><html><head><meta charset="utf-8"><style>:root{' + ';'.join(f'--{k}:{v}' for k, v in tokens.items()) + '}' + CSS + '</style></head><body>' + SCREENS[name]() + '</body></html>'
    d = tempfile.mkdtemp()
    p = os.path.join(d, 'm.html')
    open(p, 'w').write(html)
    png = os.path.join(OUT, f'{name}-{theme}.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                    f'--user-data-dir={d}/u', '--window-size=412,1700', '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        proc.kill()
    assert os.path.exists(png), name
    shutil.rmtree(d, ignore_errors=True)
    # crop to content: find last non-background row
    im = Image.open(png).convert('RGB')
    bg = Image.new('RGB', (1, 1), tokens['bg']).getpixel((0, 0))
    w, h = im.size
    last = h
    px = im.load()
    for y in range(h - 1, 0, -1):
        if any(px[x, y] != bg for x in range(0, w, 6)):
            last = y
            break
    im = im.crop((0, 0, w, min(h, last + 40)))
    im.save(png)
    return png

for name in SCREENS:
    for theme, tokens in (('light', LIGHT), ('dark', DARK)):
        print(render(name, theme, tokens))
