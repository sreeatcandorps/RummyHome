#!/usr/bin/env python3
"""Palette options on the four Size-S screens (Sree, Nov 21, 2:31 AM: "Are we also doing any color changes?").
Reuses make-small-mockups.py's screens (run with --render to redo the 24 phones; without it, only the sheets); renders A (current) / B (Felt & Brass) / C (Ink & Marigold), light + dark."""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-small-mockups.py')).read()
src = src[:src.index('for name in SCREENS:')]
src = src.replace("OUT = '/tmp/mock/out'", "OUT = '/tmp/mock/palette'")
ns = {}
exec(compile(src, 'build.py', 'exec'), ns)
render = ns['render']
A_LIGHT, A_DARK = ns['LIGHT'], ns['DARK']
OUT = ns['OUT']

B_LIGHT = dict(bg='#F5F2E8', onbg='#1A1F1B', surface='#FFFFFF', onsurf='#1A1F1B', muted='#5A615B', hair='#E6E1D3', outline='#8E928A',
               primary='#0E4D2A', onprimary='#FFFFFF', primaryc='#D8ECDD', onprimaryc='#0B3B1F', sec='#8A6A1E', secc='#F0DFAE', onsecc='#3E2E07',
               error='#B4231B', felt='#0B3B1F', sunken='#ECE7DA', avatar='#0E4D2A')
B_DARK = dict(bg='#0C120E', onbg='#ECEBE4', surface='#141B16', onsurf='#ECEBE4', muted='#B6BDB4', hair='#2A322C', outline='#848C84',
              primary='#7FD39F', onprimary='#063019', primaryc='#1A3F29', onprimaryc='#CDEFD8', sec='#E3BE63', secc='#4A3A10', onsecc='#F5E3B0',
              error='#FF9C92', felt='#0B3B1F', sunken='#1B231D', avatar='#7FD39F')
C_LIGHT = dict(bg='#F7F7F5', onbg='#15171A', surface='#FFFFFF', onsurf='#15171A', muted='#5B6066', hair='#E7E8E6', outline='#9A9EA3',
               primary='#1B1F24', onprimary='#FFFFFF', primaryc='#E6E8EB', onprimaryc='#15171A', sec='#8A5A00', secc='#FFE38A', onsecc='#3F2D00',
               error='#C2281D', felt='#1B1F24', sunken='#EFEFED', avatar='#1B1F24')
C_DARK = dict(bg='#0E0F11', onbg='#ECEDEE', surface='#17191C', onsurf='#ECEDEE', muted='#A9AEB4', hair='#2A2E33', outline='#7E848B',
              primary='#F2F3F4', onprimary='#15171A', primaryc='#2A2E33', onprimaryc='#ECEDEE', sec='#FFD45E', secc='#5C4300', onsecc='#FFE8AE',
              error='#FF9C92', felt='#17191C', sunken='#202327', avatar='#F2F3F4')

PALETTES = [
    ('A', 'Current · Clubhouse', 'green felt buttons, marigold selection, cream background', A_LIGHT, A_DARK),
    ('B', 'Felt & Brass (recommended)', 'a deeper felt green, brass instead of lemon yellow, warmer paper and hairlines', B_LIGHT, B_DARK),
    ('C', 'Ink & Marigold', 'near-black buttons (the Robinhood / Spotify shell), marigold kept for games and selection', C_LIGHT, C_DARK),
]
SCREENS = ['profile', 'settings', 'game-type', 'sign-in']

F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(sz, bold=False):
    return ImageFont.truetype(FB if bold else F, sz)

def phone(path, height):
    im = Image.open(path).convert('RGB')
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    if im.height < height:
        pad = Image.new('RGB', (im.width, height), im.getpixel((2, im.height - 2)))
        pad.paste(im, (0, 0))
        im = pad
    return im.crop((0, 0, im.width, height))

if '--render' in sys.argv:
    for key, name, _, light, dark in PALETTES:
        for mode, tokens in (('light', light), ('dark', dark)):
            for s in SCREENS:
                p = render(s, mode, tokens)
                os.rename(p, os.path.join(OUT, f'{s}-{key}-{mode}.png'))
                print(key, mode, s)

# one sheet per screen: columns A / B / C, rows light / dark
PW, GAP, TOP, LAB = 412, 28, 70, 34
HEIGHTS = {'profile': 760, 'settings': 760, 'game-type': 985, 'sign-in': 520}
for s in SCREENS:
    PH = HEIGHTS[s]
    W = GAP + 3 * (PW + GAP)
    H = TOP + 2 * (LAB + PH + GAP)
    sheet = Image.new('RGB', (W, H), '#FFFFFF')
    d = ImageDraw.Draw(sheet)
    title = {'profile': 'Profile', 'settings': 'Settings', 'game-type': 'Game type', 'sign-in': 'Sign in'}[s]
    d.text((GAP, 22), f'{title} — Size S layout in the three palettes (light above, dark below)', font=font(22, True), fill='#111')
    for col, (key, name, _, _, _) in enumerate(PALETTES):
        x = GAP + col * (PW + GAP)
        for row, mode in enumerate(('light', 'dark')):
            y = TOP + row * (LAB + PH + GAP)
            d.text((x, y + 6), f'{key} · {name} · {mode}', font=font(15, True), fill='#333')
            im = phone(os.path.join(OUT, f'{s}-{key}-{mode}.png'), PH)
            sheet.paste(im, (x, y + LAB))
            d.rectangle([x, y + LAB, x + PW - 1, y + LAB + PH - 1], outline='#C9C9C9')
    sheet.save(os.path.join(HERE, f'palette-{s}.png'))
    print('sheet', s)

# swatch overview
SW, SH = 150, 64
rows = []
W = 1300
H = 70 + len(PALETTES) * 230
ov = Image.new('RGB', (W, H), '#FFFFFF')
d = ImageDraw.Draw(ov)
d.text((28, 22), 'Three palettes — the same tokens, light and dark', font=font(22, True), fill='#111')
keys = [('bg', 'background'), ('surface', 'surface'), ('primary', 'button'), ('secc', 'selection'), ('primaryc', 'positive tint'), ('error', 'negative'), ('muted', 'secondary text')]
for i, (key, name, why, light, dark) in enumerate(PALETTES):
    y = 70 + i * 230
    d.text((28, y), f'{key} · {name}', font=font(19, True), fill='#111')
    d.text((28, y + 26), why, font=font(14), fill='#555')
    for row, (mode, tokens) in enumerate((('light', light), ('dark', dark))):
        yy = y + 56 + row * (SH + 22)
        d.text((28, yy + 22), mode, font=font(13, True), fill='#333')
        for j, (k, label) in enumerate(keys):
            x = 90 + j * (SW + 18)
            d.rectangle([x, yy, x + SW, yy + SH], fill=tokens[k], outline='#BBB')
            d.text((x, yy + SH + 3), f'{label} {tokens[k]}', font=font(11), fill='#444')
ov.save(os.path.join(HERE, 'palette-swatches.png'))
print('swatches')
