#!/usr/bin/env python3
"""Sign in S with the Joker card (Sree, Nov 23: "the redesign is good, but can you pick a better image? … just get the
Joker card … the regular ones that are smaller in looking size" + "keep [the password hiding] functionality").
Reuses make-small-mockups.py's sign-in screen, rendered in Palette B (D65), light + dark; the Before column is the
APK v17 CI frame kept from the first sheet. Writes small-sign-in.png and sign-in-joker-card.png."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-small-mockups.py')).read()
src = src[:src.index('for name in SCREENS:')].replace("OUT = '/tmp/mock/out'", "OUT = '/tmp/mock/joker'")
ns = {'__file__': os.path.join(HERE, 'make-small-mockups.py')}
exec(compile(src, 'build.py', 'exec'), ns)
pal = open(os.path.join(HERE, 'make-palette-mockups.py')).read()
pns = {}
exec(compile(pal[pal.index('B_LIGHT = '):pal.index('C_LIGHT = ')], 'palette.py', 'exec'), pns)

F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz, bold=False):
    return ImageFont.truetype(FB if bold else F, sz)

before = Image.open(os.path.join(HERE, 'small-sign-in-before.png')).convert('RGB')
light = Image.open(ns['render']('sign-in', 'light', pns['B_LIGHT'])).convert('RGB')
dark = Image.open(ns['render']('sign-in', 'dark', pns['B_DARK'])).convert('RGB')

# the card alone, rendered at full size (not an upscale of the phone — Sree, Nov 23: "the word Joker on the left side
# is also not clear"): same CSS, the card 3× larger, Chrome at 2× → every stroke crisp
import subprocess, tempfile, shutil
def render_card():
    css = ns['CSS'].replace('width:90px;height:140px', 'width:270px;height:420px').replace('height:112px', 'height:336px') \
        .replace('font:700 9px/1.05', 'font:700 27px/1.05').replace('width:9px', 'width:27px') \
        .replace('.ix.tl{left:6px;top:7px}', '.ix.tl{left:18px;top:21px}').replace('.ix.br{right:6px;bottom:7px', '.ix.br{right:18px;bottom:21px') \
        .replace('border-radius:7px;box-shadow:0 6px 16px', 'border-radius:21px;box-shadow:0 18px 48px')
    tokens = pns['B_LIGHT']
    html = ('<!doctype html><html><head><meta charset="utf-8"><style>:root{' + ';'.join(f'--{k}:{v}' for k, v in tokens.items()) + '}' + css
            + 'html,body{width:412px;height:560px;background:var(--felt)}.felt{padding:0;height:560px;display:flex;align-items:center;justify-content:center}.felt .cardwrap{height:auto;margin:0}'
            + '</style></head><body>' + f'<div class="felt"><div class="cardwrap"><div class="pcard"><span class="ix tl">J\nO\nK\nE\nR</span><img src="file://{HERE}/joker-figure.png"><span class="ix br">J\nO\nK\nE\nR</span></div></div></div>' + '</body></html>')
    d = tempfile.mkdtemp()
    p = os.path.join(d, 'c.html'); open(p, 'w').write(html)
    png = os.path.join(ns['OUT'], 'card.png')
    proc = subprocess.Popen([ns['CHROME'], '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                             f'--user-data-dir={d}/u', '--window-size=412,560', '--virtual-time-budget=1500', f'--screenshot={png}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        proc.kill()
    assert os.path.exists(png), 'card'
    shutil.rmtree(d, ignore_errors=True)
    return Image.open(png).convert('RGB')
card = render_card()

PAD, GAP, TOP = 36, 40, 110
H = max(before.height, light.height, dark.height)
panels = [(before, 'Before (APK v17, CI frame)'), (light, 'After · light · Palette B'), (dark, 'After · dark · Palette B'),
          (card, 'The card, rendered at 3× — an original Joker in the classic\nengraving style; bridge proportions (2¼ × 3½); no inner line')]
W = PAD * 2 + sum(p.width for p, _ in panels) + GAP * (len(panels) - 1)
sheet = Image.new('RGB', (W, TOP + H + 120), '#F6F6F1')
d = ImageDraw.Draw(sheet)
d.text((PAD, 28), 'Sign in — Small, with the Joker card (Sree, Nov 23): grouped list, one input style, the eye stays, an original Joker on a bridge-size card', fill='#17201B', font=font(30, True))
d.text((PAD, 70), 'Not Bicycle\'s artwork (copyright; Sree: "ok") — drawn for EZ Score in the same classic style. Mockup only, nothing built.', fill='#4E5752', font=font(24))
x = PAD
for im, cap in panels:
    sheet.paste(im, (x, TOP))
    d.rectangle((x - 1, TOP - 1, x + im.width, TOP + im.height), outline='#C9CBC4')
    for i, line in enumerate(cap.split('\n')):
        d.text((x + im.width // 2 - d.textlength(line, font=font(22)) // 2, TOP + H + 20 + i * 30), line, fill='#4E5752', font=font(22))
    x += im.width + GAP
sheet.save(os.path.join(HERE, 'small-sign-in.png'), optimize=True)
card.save(os.path.join(HERE, 'sign-in-joker-card.png'), optimize=True)
print(sheet.size)
