#!/usr/bin/env python3
"""Q15 (Sree, Nov 23: "I don't think it should say Rummy Home … 'Open the live score card.' I think that's a URL …
Can we ignore that long link? That doesn't look good."): today's Game-started email beside the recommended one,
as a phone mail client shows it. Writes email-q15.png. Mockup only — nothing sent or deployed."""
import os, shutil, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = '/usr/local/bin/google-chrome'
OUT = '/tmp/mock/email'
os.makedirs(OUT, exist_ok=True)
URL = 'https://ezscore.mindweavetech.com/scorecard.html?t=9f3c1b7e4a2d8c6f0b5e7a1d3c9f2b8e4a6d0c7f1e3b5a9d'

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:412px;background:#FFFFFF;color:#1F1F1F;font-family:Roboto,"Noto Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.status{height:36px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:14px;color:#5F6368}
.bar{height:52px;display:flex;align-items:center;padding:0 16px;gap:18px;color:#444;font-size:22px}
.bar span{flex:1}
.subj{font-size:21px;font-weight:400;padding:4px 16px 12px;line-height:1.3}
.from{display:flex;gap:12px;padding:0 16px 14px;align-items:center}
.from .av{width:40px;height:40px;border-radius:50%;background:#0E4D2A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px}
.from .av.old{background:#7B5C3F}
.from .n{font-size:15px;font-weight:600}
.from .n small{font-weight:400;color:#5F6368;margin-left:6px;font-size:13px}
.from .to{font-size:13px;color:#5F6368;margin-top:2px}
.body{padding:4px 16px 20px;font-size:15px;line-height:1.5}
.body p{margin-bottom:14px}
.body .btn{display:inline-block;background:#17402F;color:#FBF1E1;padding:11px 18px;border-radius:8px;font-weight:600}
.body .btn.b{background:#0E4D2A}
.body .rawlink{font-size:13px;color:#444;word-break:break-all}
.body .rawlink a{color:#1A4FBF}
.body .foot{color:#666;font-size:12px;margin-top:24px}
.body .foot a{color:#1A4FBF}
.body .foot.b a{color:#0E4D2A}
.body .ps{font-size:13px;color:#5F6368}
"""

def shell(subject, sender, avatar, old, body):
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>'
            '<div class="status"><span>2:35</span><span>▾ ▲ ▮</span></div>'
            '<div class="bar">←<span></span>▢ ✉ ⋮</div>'
            f'<div class="subj">{subject}</div>'
            f'<div class="from"><div class="av {"old" if old else ""}">{avatar}</div><div><div class="n">{sender}<small>2:34 PM</small></div><div class="to">to me ▾</div></div></div>'
            f'<div class="body">{body}</div></body></html>')

TODAY = shell('Game A has started · live scores', 'Rummy Home', 'R', True,
              '<p>Hi Priya,</p>'
              '<p>Sree started Game A on Sun, Nov 23, 2:34 PM.</p>'
              '<p><span class="btn">Open the live scorecard</span></p>'
              f'<p class="rawlink">Or copy this link: <a>{URL}</a></p>'
              '<p class="foot">You get this because you are a registered EZ Score player in this game. <a>Unsubscribe from these emails</a> · <a>Privacy</a></p>')

NEW = shell('Game A has started · live scores', 'EZ Score: Rummy', 'E', False,
            '<p>Hi Priya,</p>'
            '<p>Sree started <b>Game A</b> just now. The scorecard updates as rounds are saved.</p>'
            '<p><span class="btn b">Open the live scorecard</span></p>'
            '<p class="ps">Anyone with this link can see the scores, so forward it only to people at the table.</p>'
            '<p class="foot b">You get this because you are a registered EZ Score player in this game. <a>Unsubscribe from these emails</a> · <a>Privacy</a></p>')

def render(name, html):
    d = tempfile.mkdtemp()
    p = os.path.join(d, 'm.html'); open(p, 'w').write(html)
    png = os.path.join(OUT, name + '.png')
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                             f'--user-data-dir={d}/u', '--window-size=412,640', '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        proc.kill()
    shutil.rmtree(d, ignore_errors=True)
    return Image.open(png).convert('RGB')

F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz, bold=False):
    return ImageFont.truetype(FB if bold else F, sz)

ims = [render('today', TODAY), render('new', NEW)]
CAPS = [('Today', 'Sender name "Rummy Home" (the RESEND_FROM secret on the live project, not code). Button + the raw link underneath.'),
        ('Recommended', 'Sender "EZ Score: Rummy" (the Play listing name). One button, no raw link; the plain-text part keeps the URL for text-only mail apps.')]
PAD, GAP, TOP = 36, 40, 130
W = PAD * 2 + sum(im.width for im in ims) + GAP
H = TOP + max(im.height for im in ims) + 150
sheet = Image.new('RGB', (W, H), '#F6F6F1')
d = ImageDraw.Draw(sheet)
d.text((PAD, 28), 'Q15 — the Game-started email, as Gmail on a Pixel 6 shows it', fill='#17201B', font=font(30, True))
d.text((PAD, 70), 'Sree: "I don\'t think it should say Rummy Home … Can we ignore that long link? That doesn\'t look good." Mockup only; nothing sent or deployed.', fill='#4E5752', font=font(20))
x = PAD
for im, (t, s) in zip(ims, CAPS):
    d.text((x, TOP - 10), t, fill='#17201B', font=font(24, True))
    sheet.paste(im, (x, TOP + 30))
    d.rectangle((x - 1, TOP + 29, x + im.width, TOP + 30 + im.height), outline='#C9CBC4')
    # caption wrapped to the image width
    words, line, y = s.split(), '', TOP + 30 + im.height + 14
    for w_ in words:
        if d.textlength(line + ' ' + w_, font=font(19)) > im.width:
            d.text((x, y), line, fill='#4E5752', font=font(19)); y += 26; line = w_
        else:
            line = (line + ' ' + w_).strip()
    d.text((x, y), line, fill='#4E5752', font=font(19))
    x += im.width + GAP
sheet.save(os.path.join(HERE, 'email-q15.png'), optimize=True)
print(sheet.size)
