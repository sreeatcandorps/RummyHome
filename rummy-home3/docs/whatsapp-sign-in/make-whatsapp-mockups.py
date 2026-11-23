#!/usr/bin/env python3
"""WhatsApp sign-in spec (Sree, Nov 23: "We give a choice of using email or WhatsApp"). Pictures only.
Reuses the Size-S mockup toolkit in ../design-review-2/mockups. Writes wa-sign-in.png, wa-sign-up.png, wa-profile.png."""
import os, shutil, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TK = os.path.join(HERE, '..', 'design-review-2', 'mockups')
src = open(os.path.join(TK, 'make-small-mockups.py')).read()
src = src[:src.index('for name in SCREENS:')].replace("OUT = '/tmp/mock/out'", "OUT = '/tmp/mock/wa'")
ns = {'__file__': os.path.join(TK, 'make-small-mockups.py')}
exec(compile(src, 'build.py', 'exec'), ns)
pal = open(os.path.join(TK, 'make-palette-mockups.py')).read()
pns = {}
exec(compile(pal[pal.index('B_LIGHT = '):pal.index('C_LIGHT = ')], 'palette.py', 'exec'), pns)
TOK = pns['B_LIGHT']
os.makedirs('/tmp/mock/wa', exist_ok=True)
CHROME = '/usr/local/bin/google-chrome'
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = lambda sz, bold=False: ImageFont.truetype(FB if bold else F, sz)
status, row = ns['status'], ns['row']
JOKER = f'<div class="cardwrap"><div class="pcard"><span class="ix tl">J\nO\nK\nE\nR</span><img src="file://{TK}/joker-figure.png"><span class="ix br">J\nO\nK\nE\nR</span></div></div>'
EYE = '<svg class="eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>'
WA = '<svg class="wa" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>'
EXTRA = """
.seg.method{margin-bottom:16px;height:44px}
.seg.method div{gap:8px}.wa{width:18px;height:18px}
.box.phone{display:flex;gap:10px;align-items:center}.box.phone .cc{color:var(--onsurf);font-weight:700;padding-right:10px;border-right:1px solid var(--outline)}
.note{font-size:13px;color:var(--muted);line-height:1.4;margin:-6px 0 14px}
.btn.fill.whats{background:#128C7E;gap:10px;color:#fff}.btn.fill.whats .wa{width:22px;height:22px}
.boxes .d{display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}
.row .v.ok{color:var(--primary);font-weight:700}
.group .gh{display:flex;justify-content:space-between}
"""
ns['CSS_EXTRA'] = EXTRA

def render(name, body, width=412, height=1700):
    body = body() if callable(body) else body
    html = ('<!doctype html><html><head><meta charset="utf-8"><style>:root{' + ';'.join(f'--{k}:{v}' for k, v in TOK.items()) + '}'
            + ns['CSS'] + EXTRA + f'html,body{{width:{width}px}}</style></head><body>' + body + '</body></html>')
    d = tempfile.mkdtemp(); p = os.path.join(d, 'm.html'); open(p, 'w').write(html)
    png = os.path.join('/tmp/mock/wa', name + '.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                             f'--user-data-dir={d}/u', f'--window-size={width},{height}', '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: proc.wait(timeout=25)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(d, ignore_errors=True)
    im = Image.open(png).convert('RGB')
    bg = Image.new('RGB', (1, 1), TOK['bg']).getpixel((0, 0)); px = im.load(); w, h = im.size; last = h
    for y in range(h - 1, 0, -1):
        if any(px[x, y] != bg for x in range(0, w, 6)): last = y; break
    return im.crop((0, 0, w, min(h, last + 40)))

def sheet(title, sub, panels, out):
    PAD, GAP, TOP = 36, 36, 130
    W = PAD * 2 + sum(im.width for _, im, _ in panels) + GAP * (len(panels) - 1)
    H = TOP + max(im.height for _, im, _ in panels) + 170
    S = Image.new('RGB', (W, H), '#F6F6F1'); d = ImageDraw.Draw(S)
    d.text((PAD, 26), title, fill='#17201B', font=font(30, True)); d.text((PAD, 68), sub, fill='#4E5752', font=font(20))
    x = PAD
    for t, im, c in panels:
        d.text((x, TOP - 10), t, fill='#17201B', font=font(24, True)); S.paste(im, (x, TOP + 30))
        d.rectangle((x - 1, TOP + 29, x + im.width, TOP + 30 + im.height), outline='#C9CBC4')
        words, line, y = c.split(), '', TOP + 30 + im.height + 14
        for w_ in words:
            if d.textlength(line + ' ' + w_, font=font(19)) > im.width:
                d.text((x, y), line, fill='#4E5752', font=font(19)); y += 26; line = w_
            else: line = (line + ' ' + w_).strip()
        d.text((x, y), line, fill='#4E5752', font=font(19)); x += im.width + GAP
    S.save(os.path.join(HERE, out), optimize=True); print(out, S.size)

def method(on):
    return f'<div class="seg method"><div class="{"on" if on == 0 else ""}">✉ Email</div><div class="{"on" if on == 1 else ""}">{WA} WhatsApp</div></div>'
def phone_field(label='WhatsApp number', val='98765 43210'):
    return f'<div class="field"><label>{label}</label><div class="box phone"><span class="cc">🇮🇳 +91</span><span>{val}</span></div></div>'
def boxes(filled=''):
    cells = ''.join(f'<div class="d">{c}</div>' for c in filled) + ''.join('<div></div>' for _ in range(6 - len(filled)))
    return f'<div class="boxes">{cells}</div>'

# ---------- Sign in ----------
def signin_email():
    return (status() + f'<div class="felt">{JOKER}<h1>EZ Score: Rummy</h1><p>Sign in to keep score with your table</p></div><div class="card">' + method(0)
            + '<div class="field"><label>Email</label><div class="box" style="font-variant-numeric:normal;color:var(--muted)">you@example.com</div></div>'
            + f'<div class="field"><div class="lbl"><label>6-digit passcode</label>{EYE}</div>{boxes()}</div><div class="btn fill">Sign in</div><div class="link">Forgot passcode?</div></div>'
            + '<div class="newhere">New here? <b>Create account</b></div><div style="height:40px"></div>')
def signin_wa():
    return (status() + f'<div class="felt">{JOKER}<h1>EZ Score: Rummy</h1><p>Sign in to keep score with your table</p></div><div class="card">' + method(1)
            + phone_field() + '<p class="note">We send a 6-digit code to this number on WhatsApp. No passcode to remember.</p>'
            + f'<div class="btn fill whats">{WA} Send code on WhatsApp</div><div class="link">Use SMS instead</div></div>'
            + '<div class="newhere">New here? <b>Create account</b></div><div style="height:40px"></div>')
def code_wa():
    return (status() + '<div class="felt" style="padding-bottom:60px"><h1>Check WhatsApp</h1><p>We sent a code to +91 98765 43210</p></div><div class="card">'
            + '<div class="field"><label>Code from WhatsApp</label>' + boxes('48') + '</div>'
            + '<div class="btn fill" style="opacity:.5">Sign in</div><div class="link">Send again (0:42)</div>'
            + '<div class="newhere">Wrong number? <b>Go back</b></div></div><div style="height:16px"></div>')
sheet('Sign in — one screen, two methods', 'Sree: "We give a choice of using email or WhatsApp." The segmented control remembers the last method used on this phone.',
      [('Email (today, unchanged)', render('si-email', signin_email), 'Default for anyone who has signed in by email on this phone before.'),
       ('WhatsApp', render('si-wa', signin_wa), 'Country picker defaults to the SIM country (+91 in India, +1 in the US). The green button is WhatsApp\'s own green — the one place the palette bends, so the button says what it does.'),
       ('Code step', render('si-code', code_wa), 'Same OTP box as Forgot passcode and the new email sign-up. Correct code → signed in; no passcode for WhatsApp accounts (Q24).')],
      'wa-sign-in.png')

# ---------- Create account + the WhatsApp message ----------
def signup_wa():
    return (status() + '<div class="felt" style="padding-bottom:60px"><h1>Create account</h1><p>Your name and a way to sign in</p></div><div class="card">' + method(1)
            + '<div class="field"><label>Your name</label><div class="box" style="font-variant-numeric:normal">Sree</div></div>' + phone_field()
            + '<p class="note">Email, if you want results sent to you — optional. You can add it later in Profile.</p>'
            + f'<div class="btn fill whats">{WA} Send code on WhatsApp</div></div>'
            + '<div class="newhere">Have an account? <b>Sign in</b></div><div style="height:40px"></div>')
WA_CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:412px;background:#EFEAE2;color:#111;font-family:Roboto,"Noto Sans",Arial,sans-serif}
.top{background:#075E54;color:#fff;height:88px;display:flex;align-items:flex-end;padding:0 14px 10px;gap:12px}
.top .av{width:40px;height:40px;border-radius:50%;background:#0E4D2A;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:700}
.top .n{font-size:17px;font-weight:600}.top .s{font-size:12px;opacity:.85}
.day{text-align:center;margin:14px 0}.day span{background:#fff;border-radius:8px;padding:5px 12px;font-size:12px;color:#555}
.msg{background:#fff;border-radius:0 10px 10px 10px;margin:0 60px 0 12px;padding:10px 12px;font-size:15px;line-height:1.45;box-shadow:0 1px 1px rgba(0,0,0,.1)}
.msg b{font-size:20px;letter-spacing:.14em;display:block;margin:6px 0;font-variant-numeric:tabular-nums}
.msg .t{font-size:11px;color:#777;text-align:right;margin-top:4px}
.cta{background:#fff;border-radius:10px;margin:4px 60px 0 12px;padding:12px;text-align:center;color:#027EB5;font-weight:600;font-size:15px;border-top:1px solid #eee}
.bar{position:absolute;bottom:0;left:0;right:0;height:60px;display:flex;align-items:center;padding:0 12px;gap:10px}
.bar div{flex:1;height:44px;background:#fff;border-radius:22px}
body{position:relative;min-height:720px}
"""
def wa_message():
    return ('<div class="top"><div class="av">E</div><div><div class="n">EZ Score: Rummy ✓</div><div class="s">Official business account</div></div></div>'
            '<div class="day"><span>Today</span></div>'
            '<div class="msg"><b>482 913</b> is your EZ Score: Rummy verification code. For your security, do not share this code.<div class="t">2:34 PM</div></div>'
            '<div class="cta">⧉ Copy code</div><div class="bar"><div></div></div>')
def render_plain(name, body, css, width=412, height=720):
    html = f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>'
    d = tempfile.mkdtemp(); p = os.path.join(d, 'm.html'); open(p, 'w').write(html)
    png = os.path.join('/tmp/mock/wa', name + '.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                             f'--user-data-dir={d}/u', f'--window-size={width},{height}', '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: proc.wait(timeout=25)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(d, ignore_errors=True)
    return Image.open(png).convert('RGB')
def claim():
    return (status() + '<div class="felt" style="padding-bottom:60px"><h1>Is this you?</h1><p>+91 98765 43210 is on a player at Sree\'s table</p></div><div class="card">'
            '<div class="hdr" style="padding:4px 0 14px"><div class="avatar">PK</div><div><div class="name">Priya K</div><div class="sub">Played FRI4 · SAT6 with Sree</div></div></div>'
            '<p class="note">Say yes and those games are yours: same Player ID, same history. Say Not me and we start you fresh.</p>'
            '<div class="btn fill">Yes, that\'s me</div><div class="link">Not me</div></div><div style="height:16px"></div>')
sheet('Create account by WhatsApp', 'Sree: "A lot of people in India will use WhatsApp." Name + number, the code arrives in WhatsApp, and the existing "Is this you?" claim step picks up games a creator already typed them into by phone.',
      [('Create account', render('su-wa', signup_wa), 'Email becomes optional for WhatsApp accounts: it is only needed for result emails and as a backup way in (Q22).'),
       ('The WhatsApp message', render_plain('wa-msg', wa_message(), WA_CSS), 'Meta\'s fixed authentication template (Twilio Verify supplies it; wording is not ours to change) with a Copy code button. Sender shows the approved display name.'),
       ('After the code: claim', render('claim', claim), 'Today\'s claim step keyed on phone instead of email: a creator who typed +91 98765 43210 on a seat gets matched (D-players). Same screen, new key.')],
      'wa-sign-up.png')

# ---------- Profile: sign-in methods ----------
def profile_methods():
    g = ns['group']
    return (status() + ns['bar']('Profile') +
            '<div class="hdr"><div class="avatar">SS</div><div><div class="name">Sree</div><div class="sub">#1</div></div></div>' +
            g('SIGN-IN METHODS', row('Email', 'koneru2k@gmail.com', pen=True) + '<div class="row"><div class="l">WhatsApp</div><div class="v ok">+91 98765 43210 ✓</div><div class="pen">✎</div></div>' + row('Passcode', 'Set · for email sign-in')) +
            g('YOUR TABLE', row('Name', 'Sree', pen=True) + row('Initials on scorecards', 'SS', pen=True) + row('Player ID', '#1', chev=False)) +
            g('NOTIFICATIONS', row('Email', 'Game started · Results') + row('WhatsApp', 'Off — codes only')) +
            '<div style="height:30px"></div>')
def profile_add():
    g = ns['group']
    return (status() + ns['bar']('Profile') +
            '<div class="hdr"><div class="avatar">PK</div><div><div class="name">Priya K</div><div class="sub">#14</div></div></div>' +
            g('SIGN-IN METHODS', '<div class="row"><div class="l">WhatsApp</div><div class="v ok">+91 98765 43210 ✓</div><div class="pen">✎</div></div>' + row('Email', 'Add a backup way in', pen=True)) +
            '<div class="fields first" style="flex-direction:column;gap:4px;border-top:0"><div style="font-size:13px;color:var(--muted);line-height:1.4">If you lose this number, an email is the only way back into this account. Results can be emailed too.</div></div>' +
            g('YOUR TABLE', row('Name', 'Priya K', pen=True) + row('Initials on scorecards', 'PK', pen=True) + row('Player ID', '#14', chev=False)) +
            '<div style="height:30px"></div>')
sheet('Profile — one account, both methods', 'A person is one account. Either method can be added later from Profile; adding one sends a code to it. Removing the last method is not allowed.',
      [('Email account that added WhatsApp', render('pr-both', profile_methods), 'Existing email accounts lose nothing: Player ID, passcode, history stay; WhatsApp is a second key to the same door.'),
       ('WhatsApp account, no email yet', render('pr-add', profile_add), 'The nudge for the recovery problem (Q23): a WhatsApp-only account that loses its number has no way back except support.')],
      'wa-profile.png')
