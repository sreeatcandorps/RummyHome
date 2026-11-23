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

# the card alone, big, so the drawing can be judged
card = light.crop((light.width // 2 - 150, 90, light.width // 2 + 150, 420))
card = card.resize((card.width * 2, card.height * 2), Image.LANCZOS)

PAD, GAP, TOP = 36, 40, 110
H = max(before.height, light.height, dark.height)
panels = [(before, 'Before (APK v17, CI frame)'), (light, 'After · light · Palette B'), (dark, 'After · dark · Palette B'),
          (card, 'The card, 2× — an original Joker in the classic\nengraving style; bridge proportions (2¼ × 3½)')]
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
