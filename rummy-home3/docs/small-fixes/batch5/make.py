"""Batch 5 pictures: one BEFORE | AFTER sheet per small fix. Pictures only, not app code."""
from PIL import Image, ImageDraw, ImageFont

SRC = '/tmp/b5/src/'
OUT = '/agent/wt-b5pics/rummy-home3/docs/small-fixes/batch5/'
W = 1600
RED = (220, 30, 30)
ROBOTO = '/tmp/fonts/RobotoVF.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
SANS_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def font(size, bold=False):
    return ImageFont.truetype(SANS_B if bold else SANS, size)


def roboto(size, weight=400):
    f = ImageFont.truetype(ROBOTO, size)
    try:
        f.set_variation_by_axes([weight, 100])
    except Exception:
        try:
            f.set_variation_by_axes([weight])
        except Exception:
            pass
    return f


def fit(text, width, weight, start, low=20):
    size = start
    while size > low and roboto(size, weight).getlength(text) > width:
        size -= 1
    return roboto(size, weight)


def ring(img, box, width=7, pad=10):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    d.ellipse((x0 - pad, y0 - pad, x1 + pad, y1 + pad), outline=RED, width=width)
    return img


def wrap(text, f, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if f.getlength(t) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def sheet(caption, rows, name, note=None):
    """rows: list of (label, [(sub-label, image), ...]); images are scaled to share each row's width."""
    margin, gap = 40, 30
    cf = font(34, True)
    cap_lines = wrap(caption, cf, W - 2 * margin)
    lf, nf = font(26, True), font(24)
    parts = []
    y = margin
    y += len(cap_lines) * 44 + 16
    blocks = []
    for label, cells in rows:
        n = len(cells)
        cw = (W - 2 * margin - gap * (n - 1)) // n
        scaled = []
        for sub, im in cells:
            s = cw / im.width
            scaled.append((sub, im.resize((cw, round(im.height * s)), Image.LANCZOS)))
        h = max(im.height for _, im in scaled)
        blocks.append((label, scaled, cw, h))
        y += (40 if label else 0) + 36 + h + gap
    if note:
        y += 40
    canvas = Image.new('RGB', (W, y + margin - gap), 'white')
    d = ImageDraw.Draw(canvas)
    yy = margin
    for line in cap_lines:
        d.text((margin, yy), line, font=cf, fill=(20, 20, 20))
        yy += 44
    yy += 16
    for label, scaled, cw, h in blocks:
        if label:
            d.text((margin, yy), label, font=font(28, True), fill=(40, 40, 40))
            yy += 40
        for i, (sub, im) in enumerate(scaled):
            x = margin + i * (cw + gap)
            color = (90, 90, 90) if sub.lower().startswith('before') else (14, 77, 42)
            d.text((x, yy), sub, font=lf, fill=color)
            canvas.paste(im, (x, yy + 36))
            d.rectangle((x - 1, yy + 35, x + im.width, yy + 36 + im.height), outline=(200, 200, 200))
        yy += 36 + h + gap
    if note:
        d.text((margin, yy), note, font=nf, fill=(90, 90, 90))
    canvas.save(OUT + name, optimize=True)
    print(name, canvas.size)


def crop(path, box):
    return Image.open(path).convert('RGB').crop(box)


# 1 · Undo
src = Image.open(SRC + 'three-q2-undo.png').convert('RGB')
k = src.width / 1024
body = src.crop((0, round(100 * k), src.width, src.height))
off = round(100 * k)
for x0, y0, x1, y1 in ((33, 716, 326, 768), (364, 660, 659, 707), (835, 334, 988, 371)):
    ring(body, (round(x0 * k), round(y0 * k) - off, round(x1 * k), round(y1 * k) - off), width=6, pad=14)
sheet('Undo leaves the bottom bar. After you save a round, a note "Round 3 saved · Undo" shows for 5 seconds; '
      'after that, Undo is in the ⋮ menu.', [('', [('Before (CI frame) · after (drawn): just saved, then later', body)])],
      '12l-undo.png')

# 2 · Cut-off labels
pairs = []

home = crop(SRC + 'sp-ci-small-home.png', (0, 700, 1080, 920))
after = home.copy()
d = ImageDraw.Draw(after)
d.rectangle((672, 82, 1008, 180), fill=(240, 223, 174))
f = fit('My players', 340, 700, 60)
d.text((840, 122), 'My players', font=f, fill=(60, 42, 0), anchor='mm')
after.paste(home.crop((870, 0, 1040, 82)), (870, 0))
pairs.append(('Home, small phone: "My pla…" → "My players" (the icon makes room)',
              ring(home.copy(), (740, 80, 1005, 165)), ring(after, (660, 80, 1015, 165))))

res = crop(SRC + 'sp-ci-small-results.png', (0, 950, 1080, 1320))
after = res.copy()
d = ImageDraw.Draw(after)
d.rectangle((790, 90, 1015, 205), fill=(251, 250, 246))
f = roboto(36, 500)
for i, t in enumerate(('Give', 'awards', 'first')):
    d.text((905, 110 + i * 42), t, font=f, fill=(140, 140, 135), anchor='mm')
pairs.append(('Results, locked card: "Give award…" → "Give awards first" on three lines',
              ring(res.copy(), (800, 85, 1010, 210)), ring(after, (800, 85, 1010, 245))))

sc = crop('/tmp/b5/small/smoke/screens/02-scorecard-4p.png', (0, 90, 1080, 240))
after = sc.copy()
d = ImageDraw.Draw(after)
d.rectangle((200, 20, 600, 120), fill=sc.getpixel((150, 20)))
f = fit('Scorecard · S1', 400, 700, 64)
d.text((216, 70), 'Scorecard · S1', font=f, fill=(25, 28, 26), anchor='lm')
pairs.append(('Scorecard title (also behind the dealer sheet): "Scorecar…" → "Scorecard · S1", a little smaller',
              ring(sc.copy(), (205, 30, 550, 110)), ring(after, (205, 30, 630, 110))))

ordr = crop(SRC + 'sp-ci-pixel6-order.png', (0, 1020, 1080, 1180))
after = ordr.copy()
d = ImageDraw.Draw(after)
d.rectangle((272, 20, 760, 105), fill=(255, 255, 255))
f = roboto(40, 400)
d.text((281, 50), 'Ravi Kumar', font=f, fill=(25, 28, 26), anchor='lm')
x = 281 + f.getlength('Ravi Kumar') + 30
d.text((x, 50), 'RK', font=roboto(36, 700), fill=(80, 84, 82), anchor='lm')
x += roboto(36, 700).getlength('RK') + 24
d.text((x, 50), '#121', font=roboto(34, 400), fill=(90, 94, 92), anchor='lm')
d.text((x, 22), '', font=f)
d.text((281, 94), 'deals', font=roboto(32, 600), fill=(14, 77, 42), anchor='lm')
pairs.append(('Pixel 6, Order of players: "Ravi K…" → "Ravi Kumar", with "deals" under the name',
              ring(ordr.copy(), (270, 35, 440, 95)), ring(after, (270, 35, 520, 120))))

aw = crop(SRC + 'sp-ci-pixel6-awards.png', (0, 1020, 1080, 1180))
after = aw.copy()
d = ImageDraw.Draw(after)
d.rectangle((150, 55, 470, 160), fill=(255, 255, 255))
d.text((159, 85), '101 left · 5 drops', font=roboto(32, 600), fill=(100, 104, 102), anchor='lm')
pairs.append(('Pixel 6, Awards: "101 left · 5 / drops" on two lines → "101 left · 5 drops" on one',
              ring(aw.copy(), (150, 55, 360, 155)), ring(after, (150, 55, 450, 115))))

rows = [(label, [('Before (CI frame)', b), ('After (drawn)', a)]) for label, b, a in pairs]
sheet('Five labels that are cut off on a small phone with large text (and two on the Pixel 6), each shown in full.',
      rows, '12k-cut-labels.png')

# 3 · Players · Admins title and help text
pa = crop(SRC + 'pa-players-admins-ci-small-4p.png', (0, 90, 1080, 230))
after = pa.copy()
d = ImageDraw.Draw(after)
d.rectangle((200, 20, 900, 125), fill=(245, 242, 232))
f = fit('Players · Admins · S2', 660, 700, 58)
d.text((217, 70), 'Players · Admins · S2', font=f, fill=(25, 28, 26), anchor='lm')


def help_card(text, mark):
    img = Image.new('RGB', (1080, 300), (245, 242, 232))
    dd = ImageDraw.Draw(img)
    dd.text((40, 26), 'Help · Players · Admins', font=roboto(40, 700), fill=(25, 28, 26))
    f = roboto(36, 400)
    y = 96
    boxes = []
    for line in wrap(text, f, 1000):
        dd.text((40, y), line, font=f, fill=(40, 44, 42))
        if mark in line:
            x = 40 + f.getlength(line[:line.index(mark)])
            boxes.append((x, y, x + f.getlength(mark), y + 44))
        y += 48
    for b in boxes:
        ring(img, (round(b[0]), round(b[1]), round(b[2]), round(b[3])), width=6, pad=8)
    return img


before_help = help_card('Each row shows the name, Player ID and role (Creator, Admin, Player, View only). '
                        'Only players who have not finished signing up carry a tag.', 'Player, View only')
after_help = help_card('Each row shows the name and Player ID; the creator and the admins carry a Creator or Admin tag, '
                       'everyone else is a player. Only players who have not finished signing up carry a tag.',
                       'Creator or Admin tag,')
sheet('Players · Admins on a small phone: the title keeps the game name, and the help names only the roles the screen shows.',
      [('The title', [('Before (CI frame)', ring(pa.copy(), (680, 30, 905, 110))), ('After (drawn)', ring(after, (720, 30, 910, 110)))]),
       ('The help text', [('Before (today\'s words)', before_help), ('After', after_help)])],
      '12j-players-admins-title.png')

# 4 · Live page footer
lb = Image.open('/tmp/b5/live-before.png').convert('RGB').crop((0, 0, 780, 1440))
la = Image.open('/tmp/b5/live-after.png').convert('RGB').crop((0, 0, 780, 1440))
ring(lb, (30, 1050, 750, 1165), width=6)
ring(la, (30, 1050, 750, 1165), width=6)
sheet('The live score page that people open from a shared link gets one line at the bottom: '
      '"Keep score like this — get EZ Score", which opens the Play Store.',
      [('', [('Before (rendered from today\'s page)', lb), ('After (same page, one footer added)', la)])],
      '8-live-page-footer.png')

# 5 · Players · Admins as one list
pb = Image.open(SRC + 'pa-players-admins-ci-pixel6-4p.png').convert('RGB')
s = Image.open(SRC + 'pa-players-admins-s.png').convert('RGB')
k = s.width / 1024
pp = s.crop((round(354 * k), round(120 * k), round(669 * k), round(817 * k)))
kb, kp = pb.width / 315 / k, pp.width / 315
ImageDraw.Draw(pb).rounded_rectangle((38, 345, 1042, 1165), radius=40, outline=RED, width=9)
ring(pb, (645, 400, 835, 1080), width=9, pad=6)
ring(pp, (0, round(280 * k), pp.width, round(325 * k)), width=6, pad=4)
sheet('Players · Admins becomes one plain list like Profile: no card boxes, and the ▲▼ arrows on every row '
      'become one "Order of players" row.', [('', [('Before (CI frame, Pixel 6)', pb), ('After (drawn)', pp)])],
      '176-players-admins.png')

# 6 · Small phone layouts
def body_of(path, top_dp, right=None):
    im = Image.open(SRC + path).convert('RGB')
    k = im.width / (1024 if 'awards' in path or 'sideways' in path else (832 if 'order' in path else 856))
    return im, k


rows = []
for path, top, caption in (
        ('sp-awards-360.png', 70, 'Awards: names and "101 left · 5 drops" fit on one line; the numbers go on a second line.'),
        ('sp-order-360.png', 103, 'Order of players: full names, "deals" under the name, the button says "Start".'),
        ('sp-home-cards-360.png', 70, 'Home cards: the date drops the weekday so the time is not cut.'),
        ('sp-home-sideways-360.png', 90, 'Home turned sideways: one list like upright, instead of two narrow columns.')):
    im = Image.open(SRC + path).convert('RGB')
    rows.append((caption, [('Before (left) · After (right)', im.crop((0, round(im.height * top / {
        'sp-awards-360.png': 841, 'sp-order-360.png': 1014, 'sp-home-cards-360.png': 1010, 'sp-home-sideways-360.png': 680}[path]),
        im.width, im.height)))]))
sheet('Four screens on a small phone with large text: today on the left, the proposal on the right.', rows,
      '171-small-phone.png')

# 7 · 12o keyboard
t = ring(Image.open(SRC + '12o-1-today-small.png').convert('RGB'), (40, 1250, 1040, 1420), width=10)
a = ring(Image.open(SRC + '12o-2-option-a-small.png').convert('RGB'), (40, 870, 1040, 1080), width=10)
sheet('New game, picking players: today the search result hides under the keyboard; after, the picked names '
      'fold into one row so the result sits right under the search.',
      [('', [('Before (CI frame)', t), ('After (drawn, option A)', a)])], '12o-keyboard.png')
