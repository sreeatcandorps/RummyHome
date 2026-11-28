#!/usr/bin/env python3
"""WhatsApp sign-in, refreshed Nov 25 (D116). Pictures only, 360-dp phone frames (Sree's phone width).
Reuses the Size-S toolkit in ../design-review-2/mockups. Writes wa-create-account.png, wa-code-step.png,
wa-sign-in.png, wa-profile.png, wa-backup.png."""
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
OUT = '/tmp/mock/wa'
os.makedirs(OUT, exist_ok=True)
CHROME = '/usr/local/bin/google-chrome'
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = lambda sz, bold=False: ImageFont.truetype(FB if bold else F, sz)
status, row = ns['status'], ns['row']
W = 360

JOKER = (f'<div class="cardwrap"><div class="pcard"><span class="ix tl">J\nO\nK\nE\nR</span><img src="file://{TK}/joker-figure.png">'
         '<span class="ix br">J\nO\nK\nE\nR</span></div></div>')
EYE = ('<svg class="eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
       '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>')
WA = ('<svg class="wa" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>')
MAIL = ('<svg class="wa" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>')
EXTRA = """
.felt{padding:22px 16px 64px}
.felt .cardwrap{height:132px}
.felt .pcard{width:80px;height:124px}.felt .pcard img{height:98px}
.felt h1{font-size:26px}
.felt .badge{width:56px;height:56px;border-radius:50%;background:#F6F6F1;color:var(--felt);display:flex;align-items:center;justify-content:center;margin:0 auto 10px}
.felt .badge .wa{width:30px;height:30px}
.card{margin:-46px 14px 0;padding:16px 16px 8px}
.seg.method{margin-bottom:14px;height:44px}
.seg.method div{gap:8px;font-size:15px}.wa{width:18px;height:18px;flex:none}
.gl{font-size:14px;font-weight:700;color:var(--onsurf);margin:2px 0 8px}
.namerow{display:flex;gap:10px;margin-bottom:14px}.namerow .field{margin:0}
.field .box{font-size:16px}
.field .box.ph{color:var(--muted);font-variant-numeric:normal}
.box.phone{display:flex;gap:10px;align-items:center}
.box.phone .cc{color:var(--onsurf);font-weight:700;padding-right:10px;border-right:1px solid var(--outline);white-space:nowrap}
.hint{font-size:13px;color:var(--muted);line-height:1.4;margin:-8px 2px 14px}
.boxes{gap:7px}.boxes div{height:48px}
.boxes .d{display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:700}
.boxes .dot{display:flex;align-items:center;justify-content:center;font-size:26px;line-height:0}
.btn.fill{flex:none;margin-top:2px}
.btn.fill.dim{opacity:.5}
.link{padding:12px 0 8px}
.link.grey{color:var(--muted);font-weight:500}
.newhere{padding:20px 0 0}
.foot{padding:14px 0 4px;font-size:15px;color:var(--muted);text-align:center}.foot b{color:var(--primary)}
.extras{color:var(--primary);font-weight:700;font-size:14px;padding:4px 0 12px;display:flex;gap:6px;align-items:center}
.row .v{max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row .v.ok{color:var(--onsurf)}
.row .v.add{color:var(--primary);font-weight:700}
.group{margin:4px 14px 16px}.gh{padding:8px 4px 8px}
.group .rows{background:var(--surface);border-radius:14px;overflow:hidden;border:1px solid var(--hair)}
.group .row:first-of-type{border-top:0}.group .row:last-of-type{border-bottom:0}
.gnote{font-size:13px;color:var(--muted);line-height:1.4;padding:6px 6px 0}
.sheet{position:relative;background:var(--surface);border-radius:24px 24px 0 0;padding:18px 18px 20px;box-shadow:0 -4px 16px rgba(0,0,0,.18)}
.sheet h2{font-size:20px;font-weight:700;margin-bottom:6px}
.sheet p{font-size:14px;color:var(--muted);line-height:1.4;margin-bottom:14px}
.scrim{background:rgba(0,0,0,.38);height:150px}
.remind{margin:4px 14px 14px;background:var(--secc);border-radius:14px;padding:14px 16px;color:var(--onsecc)}
.remind b{display:block;font-size:15px}.remind div{font-size:13px;margin-top:4px;line-height:1.4}
.remind .acts{display:flex;gap:18px;margin-top:10px;font-weight:700;font-size:14px}
"""
ns['CSS_EXTRA'] = EXTRA


def render(name, body, width=W, height=1500):
    body = body() if callable(body) else body
    html = ('<!doctype html><html><head><meta charset="utf-8"><style>:root{' + ';'.join(f'--{k}:{v}' for k, v in TOK.items()) + '}'
            + ns['CSS'] + EXTRA + f'html,body{{width:{width}px}}</style></head><body>' + body + '</body></html>')
    d = tempfile.mkdtemp(); p = os.path.join(d, 'm.html'); open(p, 'w').write(html)
    png = os.path.join(OUT, name + '.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                             '--allow-file-access-from-files', f'--user-data-dir={d}/u', f'--window-size={width},{height}',
                             '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: proc.wait(timeout=25)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(d, ignore_errors=True)
    im = Image.open(png).convert('RGB')
    bg = Image.new('RGB', (1, 1), TOK['bg']).getpixel((0, 0)); px = im.load(); w, h = im.size; last = h
    for y in range(h - 1, 0, -1):
        if any(px[x, y] != bg for x in range(0, w, 6)): last = y; break
    return im.crop((0, 0, w, min(h, last + 36)))


def render_plain(name, body, css, width=W, height=640):
    html = f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>'
    d = tempfile.mkdtemp(); p = os.path.join(d, 'm.html'); open(p, 'w').write(html)
    png = os.path.join(OUT, name + '.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                             f'--user-data-dir={d}/u', f'--window-size={width},{height}', '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: proc.wait(timeout=25)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(d, ignore_errors=True)
    return Image.open(png).convert('RGB')


def phone(im, min_h=1240):
    """A 360-dp screen (720 px at 2x) inside a plain dark bezel, so the picture reads as a phone."""
    BZ, R = 18, 46
    h = max(im.height, min_h)
    screen = Image.new('RGB', (im.width, h), TOK['bg']); screen.paste(im, (0, 0))
    out = Image.new('RGB', (im.width + BZ * 2, h + BZ * 2), '#F6F6F1')
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((0, 0, out.width - 1, out.height - 1), R, fill='#1C1F1D')
    mask = Image.new('L', screen.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, screen.width - 1, screen.height - 1), R - BZ, fill=255)
    out.paste(screen, (BZ, BZ), mask)
    return out


def wrap(d, text, width, f):
    lines, line = [], ''
    for w_ in text.split():
        if d.textlength((line + ' ' + w_).strip(), font=f) > width:
            lines.append(line); line = w_
        else:
            line = (line + ' ' + w_).strip()
    return lines + [line]


def sheet(title, sub, panels, out):
    PAD, GAP = 40, 44
    ims = [(t, phone(im), c) for t, im, c in panels]
    probe = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    Wd = PAD * 2 + sum(im.width for _, im, _ in ims) + GAP * (len(ims) - 1)
    sub_lines = wrap(probe, sub, Wd - PAD * 2, font(21))
    TOP = 78 + 30 * len(sub_lines) + 30
    caps = [wrap(probe, c, im.width, font(20)) for _, im, c in ims]
    H = TOP + 44 + max(im.height for _, im, _ in ims) + 24 + 28 * max(len(c) for c in caps) + 30
    S = Image.new('RGB', (Wd, H), '#F6F6F1'); d = ImageDraw.Draw(S)
    d.text((PAD, 26), title, fill='#17201B', font=font(32, True))
    for i, ln in enumerate(sub_lines):
        d.text((PAD, 78 + 30 * i), ln, fill='#4E5752', font=font(21))
    x = PAD
    for (t, im, _), cap in zip(ims, caps):
        d.text((x, TOP), t, fill='#17201B', font=font(24, True)); S.paste(im, (x, TOP + 44))
        y = TOP + 44 + im.height + 18
        for ln in cap:
            d.text((x, y), ln, fill='#4E5752', font=font(20)); y += 28
        x += im.width + GAP
    S.save(os.path.join(HERE, out), optimize=True); print(out, S.size)


def method(on):
    """WhatsApp first: most of the tables Sree means are in India (D116)."""
    return (f'<div class="seg method"><div class="{"on" if on == "wa" else ""}">{WA} WhatsApp</div>'
            f'<div class="{"on" if on == "email" else ""}">{MAIL} Email</div></div>')


def phone_field(label='WhatsApp number', val='98765 43210', ph=False):
    return (f'<div class="field"><label>{label}</label><div class="box phone"><span class="cc">🇮🇳 +91 ▾</span>'
            f'<span style="{"color:var(--muted)" if ph else ""}">{val}</span></div></div>')


def text_field(label, val, ph=False):
    return f'<div class="field"><label>{label}</label><div class="box {"ph" if ph else ""}">{val}</div></div>'


def boxes(filled='', dots=False):
    cell = (lambda c: '<div class="dot">•</div>') if dots else (lambda c: f'<div class="d">{c}</div>')
    return '<div class="boxes">' + ''.join(cell(c) for c in filled) + ''.join('<div></div>' for _ in range(6 - len(filled))) + '</div>'


def passcode(filled='', label='6-digit passcode'):
    return f'<div class="field"><div class="lbl"><label>{label}</label>{EYE}</div>{boxes(filled, dots=True)}</div>'


def felt(title, sub, hero=''):
    return f'<div class="felt">{hero}<h1>{title}</h1><p>{sub}</p></div>'


# ---------- (a) Create account: WhatsApp / Email at the top, no Player ID box (D105) ----------
def create_wa():
    return (status() + felt('Create account', 'Your name, then a way to sign in') + '<div class="card">' + method('wa')
            + '<div class="gl">Your name</div><div class="namerow">' + text_field('First name', 'Priya') + text_field('Last name', 'K') + '</div>'
            + '<div class="gl">Sign-in details</div>' + phone_field()
            + '<p class="hint">We send a 6-digit code to this number on WhatsApp to confirm it.</p>'
            + passcode('••••••') + '<p class="hint">Numbers only. You sign in with your number and this passcode.</p>'
            + '<div class="btn fill">Create account</div><div class="link grey">Clear form</div></div>'
            + '<div class="foot">Already have an account? <b>Sign in</b></div><div style="height:30px"></div>')


def create_email():
    return (status() + felt('Create account', 'Your name, then a way to sign in') + '<div class="card">' + method('email')
            + '<div class="gl">Your name</div><div class="namerow">' + text_field('First name', 'Sree') + text_field('Last name', 'K') + '</div>'
            + '<div class="gl">Sign-in details</div>' + text_field('Email', 'koneru2k@gmail.com')
            + '<p class="hint" style="margin-top:6px">We email you a 6-digit code to confirm it. It is how you sign in.</p>'
            + passcode('••••••') + '<p class="hint">Numbers only. This is what you sign in with.</p>'
            + '<div class="extras">▾ Optional: country, phone and ZIP code</div>'
            + '<div class="btn fill">Create account</div><div class="link grey">Clear form</div></div>'
            + '<div class="foot">Already have an account? <b>Sign in</b></div><div style="height:30px"></div>')


sheet('(a) Create account — WhatsApp or Email at the top',
      'Sree, Nov 25: "once the app is live, I want people in India to be able to use it immediately." One form, one switch at the top. '
      'No Player ID box (D105). Both ways set the same 6-digit passcode (D76).',
      [('WhatsApp (new)', render('ca-wa', create_wa),
        'The number box has the country picker (+91 first when the phone is set to India). The six countries of D116 only. '
        'Create account sends one WhatsApp code; the next screen is the code step in (b).'),
       ('Email (as built in the sign-up code PR)', render('ca-email', create_email),
        'Unchanged apart from the switch at the top. The optional phone stays a contact detail only: it is never searched '
        'and never shown to anyone else (D113).')],
      'wa-create-account.png')


# ---------- (b) The shared 6-digit code step: one screen, one component, two senders (D101) ----------
def code_step(kind):
    wa = kind == 'wa'
    badge = f'<div class="badge">{WA if wa else MAIL}</div>'
    title = 'Check WhatsApp' if wa else 'Check your email'
    sub = ('We sent a 6-digit code to <span style="white-space:nowrap">WhatsApp +91 98xxx xx210</span>' if wa
           else 'We sent a 6-digit code to <span style="white-space:nowrap">koneru2k@gmail.com</span>')
    label = 'Code from WhatsApp' if wa else 'Code from the email'
    wrong = 'Wrong number?' if wa else 'Wrong address?'
    return (status() + felt(title, sub, badge) + '<div class="card">'
            + f'<div class="field"><label>{label}</label>{boxes("482")}</div>'
            + '<div class="btn fill dim">Confirm and sign in</div><div class="link grey">Send a new code (42s)</div>'
            + f'<div class="foot" style="padding-top:8px">{wrong} <b>Go back</b></div></div><div style="height:30px"></div>')


WA_CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:360px;background:#EFEAE2;color:#111;font-family:Roboto,"Noto Sans",Arial,sans-serif}
.status{height:36px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:14px;color:#fff;background:#075E54}
.top{background:#075E54;color:#fff;height:60px;display:flex;align-items:center;padding:0 12px;gap:12px}
.top .av{width:40px;height:40px;border-radius:50%;background:#0B3B1F;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:700}
.top .n{font-size:17px;font-weight:600}.top .s{font-size:12px;opacity:.85;margin-top:2px}
.day{text-align:center;margin:16px 0}.day span{background:#fff;border-radius:8px;padding:5px 12px;font-size:12px;color:#555}
.msg{background:#fff;border-radius:0 10px 0 0;margin:0 46px 0 12px;padding:10px 12px;font-size:15px;line-height:1.45}
.msg .t{font-size:11px;color:#777;text-align:right;margin-top:4px}
.cta{background:#fff;border-radius:0 0 10px 10px;margin:0 46px 0 12px;padding:12px;text-align:center;color:#027EB5;font-weight:600;font-size:15px;border-top:1px solid #eee}
.bar{position:absolute;bottom:10px;left:10px;right:10px;height:46px;background:#fff;border-radius:23px}
body{position:relative;min-height:620px}
"""


def wa_message():
    return ('<div class="status"><span>2:35</span><span>▾ ▲ ▮</span></div>'
            '<div class="top"><div class="av">E</div><div><div class="n">EZ Score</div><div class="s">Business account</div></div></div>'
            '<div class="day"><span>Today</span></div>'
            '<div class="msg"><b>482913</b> is your verification code. For your security, do not share this code.'
            '<div class="t">2:34 PM</div></div><div class="cta">⧉ Copy code</div><div class="bar"></div>')


sheet('(b) The 6-digit code step — the same screen for email and WhatsApp',
      'D101: one code box, Confirm and sign in, Send a new code after 60 s, Go back. The WhatsApp step is the email step with three words changed, '
      'so it is one screen in the app, not two.',
      [('Email (as built in the sign-up code PR)', render('code-email', lambda: code_step('email')),
        'Today\'s step from the sign-up code PR. The "Is this you?" note under it goes: since D113 nobody is matched by email or number.'),
       ('WhatsApp (same component)', render('code-wa', lambda: code_step('wa')),
        'Only the icon, the title, the label and "Wrong number?" change. The number is shown with the middle hidden. '
        'Confirm and sign in signs you in (a tap, as in #151); the same step is used for Forgot passcode and for adding or changing a number.'),
       ('The message in WhatsApp', render_plain('wa-msg', wa_message(), WA_CSS),
        'Meta\'s fixed authentication message (Twilio sends it; the wording is not ours). The sender is our approved name, '
        'EZ Score (D119). Copy code fills the box when pasted.')],
      'wa-code-step.png')


# ---------- (c) Sign in: number + passcode, no message sent (D76) ----------
def signin(kind):
    wa = kind == 'wa'
    who = phone_field() if wa else text_field('Email', 'koneru2k@gmail.com')
    return (status() + felt('EZ Score: Rummy', 'Sign in to keep score with your table', JOKER) + '<div class="card">' + method(kind) + who
            + passcode('••••••') + '<div class="btn fill">Sign in</div><div class="link">Forgot passcode?</div></div>'
            + '<div class="foot" style="padding-top:18px">New here? <b>Create account</b></div><div style="height:30px"></div>')


def forgot_wa():
    return (status() + felt('Forgot passcode', 'We send a code to your WhatsApp or your email', '<div class="badge" style="font-size:26px">🔒</div>')
            + '<div class="card">' + method('wa') + phone_field()
            + '<p class="hint">The number you signed up with. If it no longer works, switch to Email and use your backup email.</p>'
            + '<div class="btn fill">Send code</div></div>'
            + '<div class="foot" style="padding-top:18px">Remembered it? <b>Sign in</b></div><div style="height:30px"></div>')


sheet('(c) Sign in — WhatsApp number and passcode, no message sent',
      'D76: the number is a username, like an email. Signing in sends nothing and costs nothing; a dead or changed number still signs in. '
      'A WhatsApp code is sent only for sign-up, Forgot passcode, and adding or changing a number.',
      [('WhatsApp', render('si-wa', lambda: signin('wa')),
        'The switch remembers the way you last signed in on this phone. Wrong passcode: "That number and passcode do not match", the same words as email.'),
       ('Email (today, plus the switch)', render('si-email', lambda: signin('email')),
        'Nothing else changes for email accounts.'),
       ('Forgot passcode by WhatsApp', render('fp-wa', forgot_wa),
        'Send code → the code step in (b) → set a new passcode → Home. Recovery when the number is gone is in the spec, §5.')],
      'wa-sign-in.png')


# ---------- (d) Profile › Sign-in methods ----------
def profile(name, ini, pid, methods, note):
    g = lambda title, body, n='': f'<div class="group"><div class="gh">{title}</div><div class="rows">{body}</div>{n}</div>'
    return (status() + ns['bar']('Profile')
            + f'<div class="hdr"><div class="avatar">{ini}</div><div><div class="name">{name}</div><div class="sub">Player ID #{pid}</div></div></div>'
            + g('SIGN-IN METHODS', methods, f'<div class="gnote">{note}</div>' if note else '')
            + g('YOUR TABLE', row('Name', name, pen=True) + row('Initials on scorecards', ini, pen=True)
                + f'<div class="row"><div class="l">Player ID</div><div class="v mono">#{pid}</div><div class="pen">⧉</div></div>')
            + g('ACCOUNT', row('Privacy policy') + row('Delete account', red=True) + row('Log out', chev=False, red=True))
            + '<div style="height:24px"></div>')


def m_row(label, value, cls='ok', tail='›'):
    return f'<div class="row"><div class="l">{label}</div><div class="v {cls}">{value}</div><div class="chev">{tail}</div></div>'


def profile_both():
    return profile('Sree K', 'SK', '1',
                   m_row('Email', 'koneru2k@gmail.com') + m_row('WhatsApp', '+91 98765 43210') + m_row('Passcode', 'Change'),
                   'Either one signs you in with the same passcode. Only you see these.')


def profile_wa_only():
    return profile('Priya K', 'PK', '57',
                   m_row('WhatsApp', '+91 98765 43210') + m_row('Email', 'Add a backup', 'add') + m_row('Passcode', 'Change'),
                   'If you lose this number, a backup email is the way back in.')


def change_number():
    dim = profile_both()
    return ('<div style="position:relative">' + dim + '<div style="position:absolute;inset:0;background:rgba(0,0,0,.38)"></div>'
            '<div class="sheet" style="position:absolute;left:0;right:0;bottom:0">'
            '<h2>Change WhatsApp number</h2><p>We send a code on WhatsApp to the new number. Your account, Player ID, passcode and games stay the same.</p>'
            + phone_field('New WhatsApp number', '91234 56789')
            + '<div class="btn fill">Send code</div><div class="link grey">Cancel</div></div></div>')


sheet('(d) Profile — Sign-in methods',
      'One person is one account with up to two ways in: a WhatsApp number and an email, one passcode. A new group at the top of Profile. '
      'Nobody else ever sees your number (D113).',
      [('Email account that added WhatsApp', render('pr-both', profile_both),
        'Tap a row to add or change it; each sends one code to the new number or address. There is no Remove, so nobody can lock themselves out. '
        'Change passcode moves here from Account.'),
       ('WhatsApp account, no email yet', render('pr-wa', profile_wa_only),
        '"Add a backup" is the same step as at sign-up (D75). The Notifications group is unchanged and not shown here.'),
       ('Change number', render('pr-change', change_number),
        'Sheet over Profile → Send code → the code step in (b) → back to Profile with the new number. The old number stops working at once.')],
      'wa-profile.png')


# ---------- D75: backup asked at sign-up with Skip, reminded once ----------
def backup_after_wa():
    return (status() + felt('Add a backup', 'If you ever lose this WhatsApp number') + '<div class="card">'
            + text_field('Backup email', 'you@example.com', ph=True)
            + '<p class="hint" style="margin-top:6px">We email a code to confirm it. It becomes a second way in. We never email you anything else unless you turn it on.</p>'
            + '<div class="btn fill">Send code</div><div class="link">Skip for now</div></div><div style="height:30px"></div>')


def backup_after_email():
    return (status() + felt('Add a backup', 'If you ever lose access to this email') + '<div class="card">'
            + phone_field('Backup WhatsApp number', '98xxx xxxxx', ph=True)
            + '<p class="hint">We send a code on WhatsApp to confirm it. It becomes a second way in. We never message it otherwise.</p>'
            + '<div class="btn fill">Send code</div><div class="link">Skip for now</div></div><div style="height:30px"></div>')


def reminder_home():
    return (status() + ns['bar']('Home')
            + '<div class="remind"><b>Add a backup way in</b><div>You sign in with WhatsApp only. If you lose that number, '
              'an email is the way back to your games.</div><div class="acts"><span>Add email</span><span style="opacity:.7">Not now</span></div></div>'
            + '<div class="gh" style="padding:8px 18px">RECENT</div><div class="group"><div class="rows">'
            + row('FRI4 · Friday night', 'Completed') + row('SUN2 · Sunday', 'Live · round 3') + '</div></div><div style="height:30px"></div>')


sheet('Backup contact — asked once at sign-up with Skip, reminded once (D75)',
      'Sree, Nov 23: "we should have a second way to connect with anyone so that if something goes wrong with that email or with WhatsApp …" '
      'Right after the code step; Skip for now is always there.',
      [('After a WhatsApp sign-up', render('bk-wa', backup_after_wa),
        'Send code → the code step in (b) with "Check your email" → Home.'),
       ('After an email sign-up', render('bk-email', backup_after_email),
        'The same step the other way round. Most email users will skip it; that is fine.'),
       ('Reminder, once', render('bk-remind', reminder_home),
        'After the first saved game, only for someone who skipped. Not now hides it for good; Profile keeps "Add a backup".')],
      'wa-backup.png')
