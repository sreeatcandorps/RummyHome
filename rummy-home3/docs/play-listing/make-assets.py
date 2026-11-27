# Builds the Play listing images from CI device frames (Pixel 6, 1080x2400).
#   python3 docs/play-listing/make-assets.py <frames-dir> [out-dir] [--tablet <tablet-frames-dir>] [--only-tablet]
# <frames-dir> holds the smoke gallery PNGs of one run (`gh run download <id> -p "ui-pixel6-smoke"`, then
# .../smoke/screens). Frames come from smoke/01, 04, 16, 19, 22 (22 = supabase/seed-listing.sql, Ravi's
# games). Needs Pillow and the Public Sans fonts. Sree's review of the first set (Nov 19) shaped this:
# whole phone inside the card (no cut edges), icon full-bleed, captions as he worded them.
# Tablet pictures (7" and 10" sections of the Console): --tablet takes one folder holding the screens of the
# `ui-tablet-smoke-a` and `ui-tablet-smoke-b` artifacts of one CI run (the emulator is 1600x2560, 10:16). The
# Android status bar and the launcher / navigation strip are cropped away and the tablet sits on a 1440x2560
# (9:16) card, because Play wants 16:9 or 9:16 for tablets and the raw frames are 10:16. --only-tablet skips
# the phone set, so the tablet pictures can be remade without the Pixel 6 frames.
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ARGS = sys.argv[1:]
TABLET_FRAMES = None
if '--tablet' in ARGS:
    i = ARGS.index('--tablet')
    TABLET_FRAMES = ARGS[i + 1]
    del ARGS[i:i + 2]
ONLY_TABLET = '--only-tablet' in ARGS
ARGS = [a for a in ARGS if a != '--only-tablet']
FRAMES = ARGS[0] if len(ARGS) > 0 else '/tmp/frames'
OUT = ARGS[1] if len(ARGS) > 1 else os.path.join(os.path.dirname(__file__), 'assets')
ICON_SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'icon.png')
GREEN, DARK, CREAM, GOLD, BEZEL = (21, 128, 61), (14, 74, 38), (246, 246, 241), (240, 184, 52), (20, 24, 22)
PALE = (222, 240, 228)
B = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/macos/PublicSans-Bold.ttf', s)
R = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/macos/PublicSans-Regular.ttf', s)
os.makedirs(OUT, exist_ok=True)


def frame(name):
    return Image.open(os.path.join(FRAMES, name)).convert('RGB')


def phone(shot, width, bezel=22, radius=None):
    """The screenshot inside a dark bezel with rounded corners; the screen's own corners are rounded
    under the bezel so no status-bar pixel is clipped."""
    w = width
    h = round(w * shot.size[1] / shot.size[0])
    shot = shot.resize((w, h), Image.LANCZOS)
    radius = radius or int(w * 0.11)
    body = Image.new('RGBA', (w + 2 * bezel, h + 2 * bezel), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle((0, 0, body.size[0] - 1, body.size[1] - 1), radius, fill=BEZEL + (255,))
    screen_mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(screen_mask).rounded_rectangle((0, 0, w - 1, h - 1), max(radius - bezel, 8), fill=255)
    body.paste(shot, (bezel, bezel), screen_mask)
    return body


def wrap(draw, text, font, width):
    lines, cur = [], ''
    for word in text.split():
        trial = (cur + ' ' + word).strip()
        if draw.textlength(trial, font=font) > width and cur:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    lines.append(cur)
    return lines


if not ONLY_TABLET:
    # ---- icon 512: assets/icon.png is already full bleed (docs/app-icon); Play rounds the corners itself ----
    Image.open(ICON_SRC).convert('RGB').resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-512.png'))

    # ---- feature graphic 1024x500 ----
    fg = Image.new('RGB', (1024, 500), GREEN)
    d = ImageDraw.Draw(fg)
    ic = Image.open(ICON_SRC).convert('RGBA').resize((150, 150), Image.LANCZOS)
    m = Image.new('L', (150, 150), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 149, 149), 34, fill=255)
    fg.paste(ic, (64, 60), m)
    d.text((240, 64), 'EZ Score: Rummy', font=B(58), fill='white')
    d.text((240, 140), 'The scorekeeper for your rummy table', font=R(28), fill=PALE)
    y = 220
    for line in ['Points and pool games, round by round', 'Everyone follows live on their phone, with or without the app', 'Awards, results and PDFs to share']:
        d.ellipse((66, y + 10, 82, y + 26), fill=GOLD)
        d.text((100, y), line, font=R(24), fill='white')
        y += 52
    ph = phone(frame('04c-scorecard-after-round-3.png'), 190, bezel=14)
    d.rounded_rectangle((790, 70, 1040, 560), 40, fill=DARK)
    fg.paste(ph, (812, 100), ph)
    fg.save(os.path.join(OUT, 'feature-graphic-1024x500.png'))

    # ---- phone screenshots 1080x1920 (9:16), captioned; the whole phone sits inside the card ----
    SHOTS = [
        ('01-home.png', 'Your games', 'Start a game, pick up a live one, open a saved result.'),
        ('04c-scorecard-after-round-3.png', 'Every round on one card', 'Totals at the top, the dealer marked, columns in seat order.'),
        ('22d-pool-9p-portrait.png', 'Points and pool games', 'Who is in, who is out, points left to the limit, re-entries.'),
        ('04b-add-round-balanced.png', 'Tap the points, save the round', 'Drop, middle drop, full count and rummy on the keypad; the round must balance.'),
        ('16n-awards-by-points-left.png', 'Split the pool your way', 'Winner takes all, by points left, or your own split: the app does the arithmetic.'),
        ('22e-result-saved-s1-s2.png', 'Consolidate points across games', 'Save a night of games as one result and share it.'),
        ('19d-order-everyone-numbered.png', 'Seat the table', 'Tap from the highest card to the lowest. The last tap is seat 1 and deals.'),
    ]
    for i, (name, title, sub) in enumerate(SHOTS, 1):
        card = Image.new('RGB', (1080, 1920), CREAM)
        d = ImageDraw.Draw(card)
        d.rectangle((0, 0, 1080, 330), fill=GREEN)
        d.text((70, 80), title, font=B(62), fill='white')
        yy = 170
        for line in wrap(d, sub, R(36), 940):
            d.text((70, yy), line, font=R(36), fill=PALE)
            yy += 48
        ph = phone(frame(name), 620)
        card.paste(ph, ((1080 - ph.size[0]) // 2, 390), ph)
        card.save(os.path.join(OUT, f'screenshot-{i}-{name.split("-")[0]}.png'))

    # ---- one 16:9 landscape card (1920x1080): ten players sideways ----
    card = Image.new('RGB', (1920, 1080), CREAM)
    d = ImageDraw.Draw(card)
    d.rectangle((0, 0, 1920, 170), fill=GREEN)
    d.text((70, 40), 'Ten players, sideways', font=B(56), fill='white')
    d.text((70, 110), 'Turn the phone and every column fits; the header scrolls with the scores.', font=R(32), fill=PALE)
    ph = phone(frame('22c-points-10p-landscape.png'), 1700, bezel=22, radius=90)
    card.paste(ph, ((1920 - ph.size[0]) // 2, 215), ph)
    card.save(os.path.join(OUT, 'screenshot-8-landscape-10p.png'))


# ---- tablet screenshots 1440x2560 (9:16), 7" and 10" sections take the same set ----
TABLET_SHOTS = [
    ('22-home-ravi.png', 'Your games', 'Live games on the left, recent ones on the right.', 'home'),
    ('22b-points-10p-portrait.png', 'Every round on one card', 'Ten players fit; totals at the top, one row per round.', 'scorecard'),
    ('22d-pool-9p-portrait.png', 'Points and pool games', 'Who is in, who is out, points left to the limit, re-entries.', 'pool'),
    ('04b-add-round-balanced.png', 'Tap the points, save the round', 'Drop, middle drop, full count and rummy on the keypad.', 'add-round'),
    ('16n-awards-by-points-left.png', 'Split the pool your way', 'Winner takes all, by points left, or your own split.', 'awards'),
    ('05c-final-screen.png', 'Share the final scores', 'A picture of the standings, or a round-by-round PDF.', 'final-scores'),
    ('22e-result-saved-s1-s2.png', 'Consolidate points across games', 'Save a night of games as one result.', 'result'),
]
STATUS_BAR, NAV_STRIP_TOP = 70, 2437


def tablet_frame(name):
    im = Image.open(os.path.join(TABLET_FRAMES, name)).convert('RGB')
    return im.crop((0, STATUS_BAR, im.size[0], NAV_STRIP_TOP))


if TABLET_FRAMES:
    for i, (name, title, sub, slug) in enumerate(TABLET_SHOTS, 1):
        card = Image.new('RGB', (1440, 2560), CREAM)
        d = ImageDraw.Draw(card)
        d.rectangle((0, 0, 1440, 300), fill=GREEN)
        d.text((70, 66), title, font=B(64), fill='white')
        yy = 160
        for line in wrap(d, sub, R(36), 1300):
            d.text((70, yy), line, font=R(36), fill=PALE)
            yy += 48
        tb = phone(tablet_frame(name), 1300, bezel=20, radius=60)
        card.paste(tb, ((1440 - tb.size[0]) // 2, 300 + (2560 - 300 - tb.size[1]) // 2), tb)
        card.save(os.path.join(OUT, f'tablet-{i}-{slug}.png'))

for f in sorted(os.listdir(OUT)):
    im = Image.open(os.path.join(OUT, f))
    print(f, im.size, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')
