#!/usr/bin/env python3
"""D72 (Sree, Nov 23: "Okay, that's fine. Make sure you build this after Google approves the current review."):
the three moments of Delete account with a 30-day grace, Palette B light, Pixel 6. Writes delete-grace-dialogs.png.
Mockup only — nothing built until Google approves the current review and Sree says go."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-small-mockups.py')).read()
src = src[:src.index('for name in SCREENS:')].replace("OUT = '/tmp/mock/out'", "OUT = '/tmp/mock/grace'")
ns = {'__file__': os.path.join(HERE, 'make-small-mockups.py')}
exec(compile(src, 'build.py', 'exec'), ns)
pal = open(os.path.join(HERE, 'make-palette-mockups.py')).read()
pns = {}
exec(compile(pal[pal.index('B_LIGHT = '):pal.index('C_LIGHT = ')], 'palette.py', 'exec'), pns)
TOK = pns['B_LIGHT']
os.makedirs('/tmp/mock/grace', exist_ok=True)

ns['CSS'] += """
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.42)}
.dlg{position:absolute;left:24px;right:24px;top:170px;background:var(--surface);border-radius:28px;padding:24px 24px 16px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.dlg .ic{font-size:26px;text-align:center;color:var(--error);margin-bottom:12px}
.dlg h2{font-size:24px;font-weight:500;text-align:center;margin-bottom:14px}
.dlg p{font-size:15px;line-height:1.45;color:var(--onsurf);margin-bottom:12px}
.dlg p.m{color:var(--muted);font-size:14px}
.dlg b.date{color:var(--onsurf)}
.dlg .acts{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
.dlg .acts div{padding:10px 14px;border-radius:999px;font-weight:700;font-size:15px;color:var(--primary)}
.dlg .acts .fill{background:var(--primary);color:var(--onprimary);padding:10px 20px}
.dlg .acts .red{background:var(--error);color:#fff;padding:10px 20px}
.dlg .acts .redtxt{color:var(--error)}
.toast{position:absolute;left:16px;right:16px;bottom:34px;background:#2B2F2C;color:#F3F4F0;border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.4;box-shadow:0 4px 12px rgba(0,0,0,.3)}
.toast b{color:#A9DFB9}
body{position:relative;min-height:860px}
.wrap{position:relative;min-height:860px}
"""

def profile_screen():
    r, group, status, bar = ns['row'], ns['group'], ns['status'], ns['bar']
    return (status() + bar('Profile') +
            '<div class="hdr"><div class="avatar">SR</div><div><div class="name">Sree R</div><div class="sub">Player ID #1042 · sree@…</div></div></div>' +
            group('HELP', r('Help', 'Quick tour, topics') + r('Send feedback') + r('Privacy policy')) +
            group('ACCOUNT', r('Sign out', chev=False) + r('Delete account', chev=False, red=True)) +
            '<div class="version">EZ Score: Rummy · v1.2 (18)</div>')

def signin_screen():
    status, bar = ns['status'], ns['bar']
    return (status() +
            '<div class="felt" style="padding-bottom:60px"><h1>EZ Score</h1><p>Rummy scores, kept for the table</p></div>'
            '<div class="card"><div class="field"><label>Email</label><div class="box">sree@mindweavetech.com</div></div>'
            '<div class="field"><div class="lbl"><label>Passcode</label><span class="eye">◉</span></div><div class="boxes"><div></div><div></div><div></div><div></div><div></div><div></div></div></div>'
            '<div class="btn fill" style="margin-bottom:6px">Sign in</div><div class="link">Forgot passcode?</div></div>')

def confirm():
    return ('<div class="wrap">' + profile_screen() + '<div class="scrim"></div>'
            '<div class="dlg"><div class="ic">⚠</div><h2>Delete your account?</h2>'
            '<p>Your account is <b>deactivated right now</b> and deleted for good on <b class="date">Dec 23</b>.</p>'
            '<p>Until then nobody can find you, you get no invites or emails, and you are signed out everywhere. '
            'Your name stays on scorecards you played with other people.</p>'
            '<p class="m">Change your mind? <b>Sign in before Dec 23</b> and everything is back — your passcode keeps working.</p>'
            '<div class="acts"><div>Cancel</div><div class="red">Delete account</div></div></div></div>')

def deactivated():
    return ('<div class="wrap">' + signin_screen() +
            '<div class="toast">Account deactivated. It is deleted for good on <b>Dec 23</b> unless you sign in before then.</div></div>')

def welcome_back():
    return ('<div class="wrap">' + signin_screen() + '<div class="scrim"></div>'
            '<div class="dlg"><div class="ic" style="color:var(--primary)">☺</div><h2>Welcome back, Sree</h2>'
            '<p>Your account was due to be deleted on <b class="date">Dec 23</b>. Keep it?</p>'
            '<p class="m">Keep: everything is back the way you left it. Delete now: it is erased today.</p>'
            '<div class="acts"><div class="redtxt">Delete now</div><div class="fill">Keep my account</div></div></div></div>')

ns['SCREENS'] = {'confirm': confirm, 'deactivated': deactivated, 'welcome-back': welcome_back}
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz, bold=False):
    return ImageFont.truetype(FB if bold else F, sz)

CAPS = [('1 · Profile › Account › Delete account', 'One dialog, no checkbox: the date does the work.'),
        ('2 · Right after: signed out, one toast', 'Status `deactivated`; not findable; no invites or emails.'),
        ('3 · Signs in within 30 days', 'Keep (default) or Delete now. After day 30: 026 tombstone, as today.')]
ims = [Image.open(ns['render'](n, 'b', TOK)).convert('RGB') for n in ns['SCREENS']]
H0 = 1720
ims = [im.crop((0, 0, im.width, min(im.height, H0))) for im in ims]
PAD, GAP, TOP = 36, 30, 130
W = PAD * 2 + sum(im.width for im in ims) + GAP * 2
H = TOP + max(im.height for im in ims) + 130
sheet = Image.new('RGB', (W, H), '#F6F6F1')
d = ImageDraw.Draw(sheet)
d.text((PAD, 28), 'D72 — Delete account with a 30-day grace: the three moments (Palette B, Pixel 6)', fill='#17201B', font=font(30, True))
d.text((PAD, 70), 'Sree: "delete is a scary thing … what if the user can lose all his data?" → deactivate now, erase on day 30, sign in to undo. Mockup only; built after Google approves the current review.', fill='#4E5752', font=font(20))
x = PAD
for im, (t, s) in zip(ims, CAPS):
    d.text((x, TOP - 10), t, fill='#17201B', font=font(24, True))
    sheet.paste(im, (x, TOP + 30))
    d.rectangle((x - 1, TOP + 29, x + im.width, TOP + 30 + im.height), outline='#C9CBC4')
    d.text((x, TOP + 30 + im.height + 14), s, fill='#4E5752', font=font(20))
    x += im.width + GAP
sheet.save(os.path.join(HERE, 'delete-grace-dialogs.png'), optimize=True)
print(sheet.size)
