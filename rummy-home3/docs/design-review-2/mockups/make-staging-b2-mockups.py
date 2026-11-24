#!/usr/bin/env python3
"""Sree's staging build-2 feedback (Nov 23): proposed fixes as pictures, nothing built.
Writes b2-profile-groups.png, b2-signup-code.png, b2-delete-dialog.png, b2-game-pdf.png."""
import os, shutil, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-small-mockups.py')).read()
src = src[:src.index('for name in SCREENS:')].replace("OUT = '/tmp/mock/out'", "OUT = '/tmp/mock/b2'")
ns = {'__file__': os.path.join(HERE, 'make-small-mockups.py')}
exec(compile(src, 'build.py', 'exec'), ns)
pal = open(os.path.join(HERE, 'make-palette-mockups.py')).read()
pns = {}
exec(compile(pal[pal.index('B_LIGHT = '):pal.index('C_LIGHT = ')], 'palette.py', 'exec'), pns)
TOK = pns['B_LIGHT']
os.makedirs('/tmp/mock/b2', exist_ok=True)
CHROME = '/usr/local/bin/google-chrome'
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = lambda sz, bold=False: ImageFont.truetype(FB if bold else F, sz)
row, group, status, bar = ns['row'], ns['group'], ns['status'], ns['bar']

# ---------- A. Profile: built (flat, hairlines only) vs proposed (inset grouped cards) ----------
FLAT_CSS = ".row{background:transparent}.group .row:first-of-type{border-top:1px solid var(--hair)}"
CARD_CSS = """
.group{margin:4px 16px 18px}
.gh{padding:8px 4px 8px}
.group .rows{background:var(--surface);border-radius:14px;overflow:hidden;border:1px solid var(--hair)}
.group .row:first-of-type{border-top:0}
.group .row:last-of-type{border-bottom:0}
.row .v{max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row .copy{color:var(--primary);font-size:18px}
"""
def cardgroup(title, body, info=False):
    i = '<span class="i">i</span>' if info else ''
    return f'<div class="group"><div class="gh">{title}{i}</div><div class="rows">{body}</div></div>'

def profile_body(g, initials_value, pid_tail):
    return (status() + bar('Profile') +
            '<div class="hdr"><div class="avatar">SS</div><div><div class="name">Sree Staging</div><div class="sub">koneru2k@gmail.com · #1</div></div></div>' +
            g('YOUR TABLE', row('Name', 'Sree Staging', pen=True) + row('Initials on scorecards', initials_value, pen=True) + pid_tail) +
            g('NOTIFICATIONS', row('Phone', 'No number yet', pen=True) + row('Email', 'Game started · Results')) +
            g('GAME DEFAULTS', row('Settings', 'Points · −10 · −30 · −80')) +
            g('APPEARANCE', '<div class="row stack"><div class="l">Appearance</div>' + ns['seg'](['Phone', 'Light', 'Dark'], 1) + '</div>') +
            g('HELP', row('Help & guide', sub='How each screen works, tricky cases, scoring rules') + row('Privacy policy')) +
            g('ACCOUNT', row('Change passcode') + row('Log out', chev=False) + row('Delete account', chev=False, red=True)) +
            '<div class="version">EZ Score v1.1.0 (build 2) · Staging</div>')

def built():
    ns['CSS_EXTRA'] = FLAT_CSS
    return profile_body(group, 'SS · from your name', row('Player ID', '#1', chev=False).replace('</div></div>', '</div><div class="pen">⇪</div></div>', 1))
def proposed():
    ns['CSS_EXTRA'] = CARD_CSS
    return profile_body(cardgroup, 'SS', '<div class="row"><div class="l">Player ID</div><div class="v mono">#1</div><div class="copy">⧉</div></div>')

def render(name, body_fn, width=412, height=1800, extra_css=''):
    body = body_fn()
    html = ('<!doctype html><html><head><meta charset="utf-8"><style>:root{' + ';'.join(f'--{k}:{v}' for k, v in TOK.items()) + '}'
            + ns['CSS'] + ns.get('CSS_EXTRA', '') + extra_css + f'html,body{{width:{width}px}}</style></head><body>' + body + '</body></html>')
    d = tempfile.mkdtemp(); p = os.path.join(d, 'm.html'); open(p, 'w').write(html)
    png = os.path.join('/tmp/mock/b2', name + '.png')
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

def sheet(title, sub, panels, out, cap_w=None):
    ims = [(t, im, c) for t, im, c in panels]
    PAD, GAP, TOP = 36, 36, 130
    W = PAD * 2 + sum(im.width for _, im, _ in ims) + GAP * (len(ims) - 1)
    H = TOP + max(im.height for _, im, _ in ims) + 160
    S = Image.new('RGB', (W, H), '#F6F6F1'); d = ImageDraw.Draw(S)
    d.text((PAD, 26), title, fill='#17201B', font=font(30, True)); d.text((PAD, 68), sub, fill='#4E5752', font=font(20))
    x = PAD
    for t, im, c in ims:
        d.text((x, TOP - 10), t, fill='#17201B', font=font(24, True)); S.paste(im, (x, TOP + 30))
        d.rectangle((x - 1, TOP + 29, x + im.width, TOP + 30 + im.height), outline='#C9CBC4')
        words, line, y = c.split(), '', TOP + 30 + im.height + 14
        for w_ in words:
            if d.textlength(line + ' ' + w_, font=font(19)) > (cap_w or im.width):
                d.text((x, y), line, fill='#4E5752', font=font(19)); y += 26; line = w_
            else: line = (line + ' ' + w_).strip()
        d.text((x, y), line, fill='#4E5752', font=font(19)); x += im.width + GAP
    S.save(os.path.join(HERE, out), optimize=True); print(out, S.size)

a = render('profile-built', built, width=360)      # Sree's phone is narrower than a Pixel 6: 360 dp shows the cut-off
b = render('profile-proposed', proposed, width=360)
sheet('Profile — built (as on the staging APK) vs proposed', 'Sree: "I don\'t like how it\'s cut off … \'from your name\' is useless … remove the share, a small copy thing is fine … some kind of lines, or a different background for the different settings?"',
      [('Built: flat rows, hairlines only (360-dp phone)', a, 'The approved mockup had white rows on the paper background; the build dropped the surface tone. "SS · from your name" and the title fight for one line.'),
       ('Proposed: inset grouped cards', b, 'White cards, 14-dp corners, one hairline between rows (iOS Settings / Pixel Settings pattern). Initials value is just "SS", the value column is capped so the title never truncates. Player ID: ⧉ copy, no share.')],
      'b2-profile-groups.png')

# ---------- B. Sign-up with a code, not a link ----------
EMAIL_CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:412px;background:#fff;color:#1F1F1F;font-family:Roboto,"Noto Sans",Arial,sans-serif}
.status{height:36px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:14px;color:#5F6368}
.bar{height:52px;display:flex;align-items:center;padding:0 16px;gap:18px;color:#444;font-size:22px}.bar span{flex:1}
.subj{font-size:21px;padding:4px 16px 12px;line-height:1.3}
.from{display:flex;gap:12px;padding:0 16px 14px;align-items:center}
.from .av{width:40px;height:40px;border-radius:50%;background:#0E4D2A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px}
.from .av.old{background:#3ECF8E}
.from .n{font-size:15px;font-weight:600}.from .n small{font-weight:400;color:#5F6368;margin-left:6px;font-size:13px}.from .to{font-size:13px;color:#5F6368;margin-top:2px}
.body{padding:4px 16px 20px;font-size:15px;line-height:1.5}.body p{margin-bottom:14px}
.code{font-size:34px;letter-spacing:.18em;font-weight:700;color:#0E4D2A;font-variant-numeric:tabular-nums;padding:10px 0}
.btn{display:inline-block;background:#3ECF8E;color:#fff;padding:10px 16px;border-radius:6px;font-weight:600}
.foot{color:#666;font-size:12px;margin-top:20px}
"""
def email(subject, sender, av, old, body):
    return ('<div class="status"><span>2:35</span><span>▾ ▲ ▮</span></div><div class="bar">←<span></span>▢ ✉ ⋮</div>'
            f'<div class="subj">{subject}</div><div class="from"><div class="av {"old" if old else ""}">{av}</div><div><div class="n">{sender}<small>2:34 PM</small></div><div class="to">to me ▾</div></div></div>'
            f'<div class="body">{body}</div>')
def render_plain(name, body, css, width=412, height=760):
    html = f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>'
    d = tempfile.mkdtemp(); p = os.path.join(d, 'm.html'); open(p, 'w').write(html)
    png = os.path.join('/tmp/mock/b2', name + '.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                             f'--user-data-dir={d}/u', f'--window-size={width},{height}', '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: proc.wait(timeout=25)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(d, ignore_errors=True)
    return Image.open(png).convert('RGB')

today = render_plain('mail-today', email('Confirm your email address', 'Supabase Auth', 'S', True,
    '<p>Confirm your signup</p><p>Follow this link to confirm your user:</p><p><span class="btn">Confirm your mail</span></p>'), EMAIL_CSS)
new = render_plain('mail-new', email('Your EZ Score: Rummy code is 482 913', 'EZ Score: Rummy', 'E', False,
    '<p>Hi Sree,</p><p>Type this code in the app to finish creating your account:</p><p class="code">482 913</p>'
    '<p>It works for 10 minutes. If you did not create an EZ Score account, ignore this email — nothing happens.</p>'
    '<p class="foot">EZ Score: Rummy · MindWeave Tech · <u>Privacy</u></p>'), EMAIL_CSS)

def code_screen():
    return (status() +
            '<div class="felt" style="padding-bottom:60px"><h1>Check your email</h1><p>We sent a 6-digit code to koneru2k@gmail.com</p></div>'
            '<div class="card"><div class="field"><label>Code from the email</label><div class="boxes"><div style="display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700">4</div><div style="display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700">8</div><div style="display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700">2</div><div></div><div></div><div></div></div></div>'
            '<div class="btn fill" style="margin-bottom:6px;opacity:.5">Confirm and sign in</div><div class="link">Send a new code</div>'
            '<div class="newhere">Wrong address? <b>Go back</b></div></div>'
            '<div style="height:16px"></div>')
code = render('signup-code', code_screen)
sheet('Create account — a code in the app instead of a link to a web page',
      'Sree: "I don\'t like how the name comes out as Supabase Auth … it says \'site not reached\' and goes to a localhost … make it very clear: confirm the email, then sign in."',
      [('Today (staging)', today, 'Supabase\'s default sender and template; the link needs a web page to land on (Site URL) — on staging that was never set, so it fell back to localhost:3000.'),
       ('Proposed email', new, 'Sent by "EZ Score: Rummy" through the same Resend SMTP live uses. A code, not a link: nothing to land on, nothing for a mail scanner to burn.'),
       ('Proposed in-app step', code, 'Create account → this screen → typed code → signed in at once (verifyOtp type signup returns a session). "Confirm, then come back and sign in" becomes one step. Same OTP box as Forgot passcode.')],
      'b2-signup-code.png')

# ---------- C. Delete dialog: body scrolls, actions always below ----------
DLG_CSS = """
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.42)}
.dlg{position:absolute;left:16px;right:16px;top:60px;bottom:60px;background:var(--surface);border-radius:28px;display:flex;flex-direction:column;box-shadow:0 8px 24px rgba(0,0,0,.25);overflow:hidden}
.dlg .ic{font-size:26px;text-align:center;color:var(--error);padding:22px 0 8px}
.dlg h2{font-size:22px;font-weight:500;text-align:center;padding:0 20px 10px}
.dlg .scroll{flex:1;overflow:hidden;padding:0 24px;border-top:1px solid var(--hair);border-bottom:1px solid var(--hair);position:relative}
.dlg .scroll p,.dlg .scroll li{font-size:14px;line-height:1.45;color:var(--onsurf);margin:6px 0}
.dlg .scroll h4{font-size:13px;font-weight:700;margin-top:12px}
.dlg .scroll .fade{position:absolute;left:0;right:0;bottom:0;height:34px;background:linear-gradient(rgba(255,255,255,0),#fff)}
.dlg .acts{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px 14px}
.dlg .acts div{padding:10px 14px;border-radius:999px;font-weight:700;font-size:15px;color:var(--primary);border:1px solid var(--outline)}
.dlg .acts .red{background:#E6DED9;color:#9A9A9A;border:0;padding:10px 20px}
.sb{position:absolute;right:4px;top:10px;width:4px;height:60px;border-radius:2px;background:#C9CBC4}
body{position:relative;min-height:800px}.wrap{position:relative;min-height:800px}
"""
def delete_fixed():
    return ('<div class="wrap">' + status() + bar('Profile') + '<div class="scrim"></div>'
            '<div class="dlg"><div class="ic">⚠</div><h2>Delete your account?</h2><div class="scroll"><div class="sb"></div>'
            '<h4>Deleted now</h4><p>• Your sign-in: email, passcode and every signed-in device.</p><p>• Your phone number, Player ID, email settings and game defaults.</p>'
            '<p>• Your My players list, hidden-games list, queued emails and open invites.</p><p>• Games you created that nobody else with an account was in.</p>'
            '<h4>Kept</h4><p>• Scorecards and results of games you played with other people keep your name and scores, like an unregistered player.</p>'
            '<p>• Games you created that other players with accounts were in stay with them…</p><div class="fade"></div></div>'
            '<div class="acts"><div>Keep my account</div><div class="red">Delete my account</div></div></div></div>')
dlg = render('delete-fixed', delete_fixed, width=360, height=800)
sheet('Delete account dialog — the body scrolls, the buttons never cover it',
      'Sree: "you\'re overlaying the text … it\'s not very clear." On a shorter phone the list is taller than the dialog; the fix is one style (the scroll area shrinks, the actions sit below it). D72 later replaces this dialog with the 30-day version.',
      [('Fixed layout (360-dp phone)', dlg, 'Title fixed at the top, actions fixed at the bottom, the list scrolls between hairlines with a fade; the checkbox and support line are the last items of the scroll. Delete stays grey until the checkbox is ticked.')],
      'b2-delete-dialog.png')

# ---------- D. The game PDF: standings first, headers aligned with their numbers ----------
PDF_CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:720px;background:#fff;color:#17201B;font-family:"Noto Sans",Arial,sans-serif;padding:28px 32px}
h1{font-size:24px;margin-bottom:4px}.meta{color:#4E5752;font-size:13px;margin-bottom:14px}
h2{font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#4E5752;margin:18px 0 8px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #E6E1D3;padding:5px 8px;font-size:13px;font-variant-numeric:tabular-nums}
th{background:#EEEEE7;font-weight:800}
.num{text-align:right}.txt{text-align:left}.ctr{text-align:center}
.pos{color:#0E4D2A;font-weight:700}.neg{color:#A8201A;font-weight:700}
.st td.place{width:40px;color:#4E5752}.st tr.win td{background:#D6F5DF}
.tot td,.tot th{font-weight:800;border-top:2px solid #B57F00}
.rb th .tot{display:block;font-size:14px}.rb th .ini{display:block}
.cap{font-size:12px;color:#4E5752;margin:10px 0 4px}
.foot{margin-top:16px;font-size:12px;color:#4E5752}
.old th.ctr{text-align:center}
"""
PLAYERS = [('Sree Staging', 'SS', 120), ('Priya K', 'PK', 40), ('Harish T', 'HT', 10), ('Anil R', 'AR', -20), ('Meena S', 'MS', -30), ('Ravi B', 'RB', -50), ('Kiran D', 'KD', -70)]
ROUNDS = [[40, -10, -10, 0, -10, 0, -10], [20, 0, -10, -10, 0, -10, 10], [30, 20, 0, -10, -10, -20, -10], [30, 30, 30, 0, -10, -20, -60]]
def fmt(n): return f'<span class="{"pos" if n > 0 else "neg" if n < 0 else ""}">{"+" if n > 0 else ""}{n}</span>'
def rb(block, aligned):
    heads = ''.join(f'<th class="{"num" if aligned else "ctr"}"><span class="ini">{i}</span><span class="tot">{fmt(t)}</span></th>' for _, i, t in block)
    idx = [PLAYERS.index(p) for p in block]
    rows = ''.join(f'<tr><td class="txt">{r + 1}</td>' + ''.join(f'<td class="num">{fmt(ROUNDS[r][k])}</td>' for k in idx) + '</tr>' for r in range(4))
    return f'<table class="rb"><thead><tr><th class="txt">Rnd</th>{heads}</tr></thead><tbody>{rows}</tbody></table>'
def pdf(aligned, standings):
    st = ''
    if standings:
        st = ('<h2>Final scores</h2><table class="st"><thead><tr><th class="txt">Place</th><th class="txt">Player</th><th class="num">Total</th></tr></thead><tbody>'
              + ''.join(f'<tr class="{"win" if i == 0 else ""}"><td class="place">{i + 1}</td><td class="txt">{n} <span style="color:#4E5752">· {ini}</span></td><td class="num">{fmt(t)}</td></tr>' for i, (n, ini, t) in enumerate(PLAYERS))
              + '<tr class="tot"><td></td><td class="txt">Totals add to</td><td class="num">0</td></tr></tbody></table>')
    else:
        st = '<h2>Totals</h2><p class="meta">Totals add to 0</p>'
    return (f'<h1>Final scores · S1</h1><p class="meta">Sun, Nov 23 · 7 players · 4 rounds</p>{st}<h2>Round by round</h2>'
            f'<p class="cap">Players 1–5 of 7</p>{rb(PLAYERS[:5], aligned)}<p class="cap">Players 6–7 of 7</p>{rb(PLAYERS[5:], aligned)}'
            '<p class="foot">EZ Score: Rummy · Creator: Sree Staging · Unique game ID · GAMES1</p>')
p_old = render_plain('pdf-old', pdf(False, False), PDF_CSS, width=720, height=700)
p_new = render_plain('pdf-new', pdf(True, True), PDF_CSS, width=720, height=900)
sheet('The game PDF — final scores as a table, headers aligned with their numbers',
      'Sree: "It\'s missing the actual final scores … What about the heading? Should the total below the person be to the right?"',
      [('Today', p_old, 'Totals only as one line; each player\'s total hides in the round-table header; headers centred over right-aligned numbers.'),
       ('Proposed', p_new, 'A Final scores table first (place, name · initials, total; winner row tinted; "Totals add to 0" as its last row), then Round by round with every numeric header right-aligned like its column — the table convention (Excel, Google Sheets, APA).')],
      'b2-game-pdf.png', cap_w=700)
