#!/usr/bin/env python3
"""Q8 (Sree, Nov 23: "I don't know what that dark mode thing is. Maybe I should see what it looks like first"):
three S screens in dark, Palette B, green-black background (today's family) beside a neutral near-black. Writes dark-q8.png."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-small-mockups.py')).read()
src = src[:src.index('for name in SCREENS:')].replace("OUT = '/tmp/mock/out'", "OUT = '/tmp/mock/q8'")
ns = {'__file__': os.path.join(HERE, 'make-small-mockups.py')}
exec(compile(src, 'build.py', 'exec'), ns)
pal = open(os.path.join(HERE, 'make-palette-mockups.py')).read()
pns = {}
exec(compile(pal[pal.index('B_LIGHT = '):pal.index('C_LIGHT = ')], 'palette.py', 'exec'), pns)
GREEN_BLACK = pns['B_DARK']
# the same brass and mint on a neutral near-black: no green in the background, surfaces or hairlines
NEUTRAL_BLACK = dict(GREEN_BLACK, bg='#0E0E0F', surface='#171819', onbg='#ECEBE6', onsurf='#ECEBE6', muted='#B3B6B2', hair='#2A2B2D', outline='#828480', sunken='#1C1D1F')

F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz, bold=False):
    return ImageFont.truetype(FB if bold else F, sz)

SCREENS = ['profile', 'settings', 'sign-in']
ROWS = [('Green-black (today\'s family, Palette B dark as drawn): background #0C120E, surfaces #141B16', GREEN_BLACK),
        ('Neutral black (the Robinhood / Spotify / Google shell): background #0E0E0F, surfaces #171819 — same mint and brass', NEUTRAL_BLACK)]
rendered = [[Image.open(ns['render'](s, 'dark' + ('' if i == 0 else '-neutral'), tok)).convert('RGB') for s in SCREENS] for i, (_, tok) in enumerate(ROWS)]
PAD, GAP, TOP, CAP = 36, 30, 120, 70
W = PAD * 2 + sum(im.width for im in rendered[0]) + GAP * (len(SCREENS) - 1)
H = TOP + sum(max(im.height for im in row) + CAP for row in rendered) + 40
sheet = Image.new('RGB', (W, H), '#F6F6F1')
d = ImageDraw.Draw(sheet)
d.text((PAD, 28), 'Q8 — dark mode: green-black or neutral black? Three S screens, Palette B, Pixel 6', fill='#17201B', font=font(30, True))
d.text((PAD, 70), 'Buttons, selection and text are identical in both rows; only the background, surfaces and hairlines differ. Mockup only, nothing built.', fill='#4E5752', font=font(22))
y = TOP
for (cap, _), row in zip(ROWS, rendered):
    d.text((PAD, y), cap, fill='#17201B', font=font(24, True))
    y += 40
    x = PAD
    for im in row:
        sheet.paste(im, (x, y))
        d.rectangle((x - 1, y - 1, x + im.width, y + im.height), outline='#C9CBC4')
        x += im.width + GAP
    y += max(im.height for im in row) + CAP - 40
sheet.save(os.path.join(HERE, 'dark-q8.png'), optimize=True)
print(sheet.size)
