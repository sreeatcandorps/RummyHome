from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np, os, collections

"""Builds the app icon layers from the approved joker tile (docs/app-icon/README.md).

    python3 docs/app-icon/make-icons.py            # writes assets/*.png and the before/after pictures here

Source: the v17 foreground (source/adaptive-icon-v17.png) and option 1 (assets/icon-options/joker-1.png). Needs Pillow, numpy, scipy.
"""
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'source')
ASSETS = os.path.join(HERE, '..', '..', 'assets')
OUT = HERE
os.makedirs(OUT, exist_ok=True)
GREEN = (15, 69, 45, 255)
CREAM = (251, 241, 225, 255)

src = Image.open(f'{SRC}/adaptive-icon-v17.png').convert('RGBA')
a = np.array(src)

# The art relies on the tile: the hat's dark-green lobes have no outline against the tile green, so it cannot be
# lifted off cleanly. The foreground is therefore a disc of the tile interior (invisible against the matching
# background colour, and kept inside the safe zone); the themed-icon silhouette keys on a tight colour distance.
from scipy import ndimage
H, W = a.shape[:2]
rgb = a[..., :3].astype(int)
dist = np.abs(rgb - np.array(GREEN[:3])).max(-1)
yy, xx = np.mgrid[0:H, 0:W]
R = 280  # inside the inner cream border line (287 px from centre); the art reaches 247 px
disc = ((xx - 512) ** 2 + (yy - 512) ** 2) <= R ** 2
edge = np.clip(R + 1.5 - np.sqrt((xx - 512.0) ** 2 + (yy - 512.0) ** 2), 0, 1)
disc_rgba = a.copy(); disc_rgba[..., 3] = (edge * 255).astype(np.uint8)
# silhouette: everything in the disc that is not the flat tile green (hat lobes are ~10 away, tile noise ≤ 3)
sil = disc & (dist > 5)
sil = ndimage.binary_closing(sil, iterations=3)
sil = ndimage.binary_opening(sil, iterations=1)
sil = ndimage.binary_fill_holes(sil)
sil_alpha = ndimage.gaussian_filter(sil.astype(float), 1.0)
ys, xs = np.where(sil)
bbox = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
print('art bbox', bbox, 'centre', cx, cy)
art_img = Image.fromarray(disc_rgba)          # the disc, art centred by shifting the disc later
sil_rgba = np.zeros_like(a); sil_rgba[..., :3] = 255; sil_rgba[..., 3] = (np.clip(sil_alpha, 0, 1) * 255).astype(np.uint8)
sil_img = Image.fromarray(sil_rgba).crop(bbox)
art_w = bbox[2] - bbox[0]; art_h = bbox[3] - bbox[1]

def place(canvas_px, art, frac, bg=None):
    """Art scaled so its longest side = frac * canvas, centred."""
    c = Image.new('RGBA', (canvas_px, canvas_px), bg or (0, 0, 0, 0))
    s = frac * canvas_px / max(art.size)
    r = art.resize((round(art.size[0]*s), round(art.size[1]*s)), Image.LANCZOS)
    c.alpha_composite(r, ((canvas_px - r.size[0])//2, (canvas_px - r.size[1])//2))
    return c

# --- new assets ---
def place_disc(canvas_px, frac, bg=None):
    """Scale the disc so the ART's longest side = frac * canvas; centre the ART (not the disc)."""
    c = Image.new('RGBA', (canvas_px, canvas_px), bg or (0, 0, 0, 0))
    s = frac * canvas_px / max(art_w, art_h)
    r = art_img.resize((round(1024 * s), round(1024 * s)), Image.LANCZOS)
    c.alpha_composite(r, (round(canvas_px / 2 - cx * s), round(canvas_px / 2 - cy * s)))
    return c
def place(canvas_px, art, frac, bg=None):
    c = Image.new('RGBA', (canvas_px, canvas_px), bg or (0, 0, 0, 0))
    s = frac * canvas_px / max(art.size)
    r = art.resize((round(art.size[0]*s), round(art.size[1]*s)), Image.LANCZOS)
    c.alpha_composite(r, ((canvas_px - r.size[0])//2, (canvas_px - r.size[1])//2))
    return c
# Adaptive foreground: art at 50 % of the 108 dp canvas, inside the 66 dp (61 %) safe circle; the disc edge sits at
# ~62 % and is the same green as the background, so no launcher ever shows it.
fg = place_disc(1024, 0.50)
fg.save(f'{ASSETS}/adaptive-icon.png')
mono = place(1024, sil_img, 0.50); mono.save(f'{ASSETS}/adaptive-icon-mono.png')
# iOS / Play / Expo icon: full bleed green, art at 74 % (the stores round the corners).
icon = place_disc(1024, 0.74, GREEN); icon.convert('RGB').save(f'{ASSETS}/icon.png')
import shutil; shutil.copyfile(f'{ASSETS}/icon-options/joker-1.png', f'{ASSETS}/splash-icon.png')  # byte-for-byte option 1

# --- previews ---
def mask(kind, size):
    m = Image.new('L', (size, size), 0); d = ImageDraw.Draw(m)
    if kind == 'circle': d.ellipse((0, 0, size-1, size-1), fill=255)
    elif kind == 'rounded': d.rounded_rectangle((0, 0, size-1, size-1), radius=int(size*0.22), fill=255)
    elif kind == 'square': d.rounded_rectangle((0, 0, size-1, size-1), radius=int(size*0.06), fill=255)
    elif kind == 'squircle':
        n = 5.0; r = size/2; yy, xx = np.mgrid[0:size, 0:size]
        v = (np.abs((xx+0.5-r)/r)**n + np.abs((yy+0.5-r)/r)**n) <= 1
        m = Image.fromarray((v*255).astype(np.uint8))
    elif kind == 'teardrop':
        d.ellipse((0, 0, size-1, size-1), fill=255)
        d.rounded_rectangle((size//2, size//2, size-1, size-1), radius=int(size*0.08), fill=255)
    return m

def adaptive_render(fg_img, bg_rgba, kind, px=192):
    """Launcher: 108 dp layer, the mask shows the central 72 dp."""
    layer = Image.new('RGBA', (1024, 1024), bg_rgba); layer.alpha_composite(fg_img)
    vis = int(1024 * 72/108); off = (1024 - vis)//2
    crop = layer.crop((off, off, off+vis, off+vis)).resize((px, px), Image.LANCZOS)
    out = Image.new('RGBA', (px, px), (0, 0, 0, 0)); out.paste(crop, (0, 0), mask(kind, px))
    return out

font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
fontb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
fonts = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)

kinds = ['circle', 'squircle', 'rounded', 'square', 'teardrop']
labels = ['Circle (Pixel default)', 'Squircle (Samsung, OnePlus)', 'Rounded square', 'Square (Xiaomi)', 'Teardrop']
def row(fg_img, bg, title, y, sheet, d, px=192):
    d.text((24, y), title, fill=(23, 32, 27), font=fontb)
    for i, k in enumerate(kinds):
        x = 24 + i * (px + 44)
        tile = adaptive_render(fg_img, bg, k, px)
        sheet.alpha_composite(tile, (x, y + 44))
        d.text((x + px/2, y + 44 + px + 10), 'EZ Score', fill=(23, 32, 27), font=fonts, anchor='mt')
        d.text((x + px/2, y + 44 + px + 30), labels[i], fill=(78, 87, 82), font=fonts, anchor='mt')

old_fg = src
SW = 24 + 5 * (192 + 44); SH = 44 + 2 * (44 + 192 + 60) + 110
sheet = Image.new('RGBA', (SW, SH), (246, 246, 241, 255)); d = ImageDraw.Draw(sheet)
d.text((24, 12), 'Android launcher icon, the five masks launchers use', fill=(23, 32, 27), font=font)
row(old_fg, CREAM, 'Before (APK v17): the tile and its border are in the foreground; the mask cuts through them', 48, sheet, d)
row(fg, GREEN, 'After: joker = foreground (50 %), tile green = background; the launcher draws the shape', 48 + 44 + 192 + 70, sheet, d)
d.text((24, SH - 50), 'Each mask shows the central 72 of 108 dp; the art stays inside the 66 dp safe circle. Themed (Android 13+) icon comes from the new monochrome layer.', fill=(78, 87, 82), font=fonts)
sheet.convert('RGB').save(f'{OUT}/launcher-before-after.png')

# Safe-zone diagram: the two foregrounds with the 72 dp mask circle and 66 dp safe circle drawn on top
def zone(fg_img, bg, title):
    px = 320
    layer = Image.new('RGBA', (1024, 1024), bg); layer.alpha_composite(fg_img)
    im = layer.resize((px, px), Image.LANCZOS); d = ImageDraw.Draw(im)
    for frac, col, w in ((72/108, (180, 35, 27, 255), 3), (66/108, (255, 227, 138, 255), 2)):
        r = frac * px / 2; d.ellipse((px/2 - r, px/2 - r, px/2 + r, px/2 + r), outline=col, width=w)
    cw = 520
    c = Image.new('RGBA', (cw, px + 90), (246, 246, 241, 255)); c.alpha_composite(im, ((cw - px)//2, 0))
    dd = ImageDraw.Draw(c); dd.text((cw/2, px + 10), title, fill=(23, 32, 27), font=fonts, anchor='mt')
    dd.text((cw/2, px + 34), 'red: what the launcher shows (72 of 108 dp)', fill=(78, 87, 82), font=fonts, anchor='mt')
    dd.text((cw/2, px + 54), 'yellow: Android safe zone (66 dp) — art must stay inside', fill=(78, 87, 82), font=fonts, anchor='mt')
    return c
z1 = zone(old_fg, CREAM, 'Before: tile 70 % wide, its corners far outside the red line')
z2 = zone(fg, GREEN, 'After: art at 50 %, inside the yellow circle on every launcher')
zs = Image.new('RGBA', (z1.size[0]*2 + 72, z1.size[1] + 24), (246, 246, 241, 255)); zs.alpha_composite(z1, (24, 12)); zs.alpha_composite(z2, (z1.size[0] + 48, 12))
zs.convert('RGB').save(f'{OUT}/safe-zone.png')

# Stores: iOS squircle and Play rounded corners, before (icon.png tile-on-cream) and after (full-bleed)
def store(im, kind, px=200):
    out = Image.new('RGBA', (px, px), (0, 0, 0, 0)); out.paste(im.resize((px, px), Image.LANCZOS), (0, 0), mask(kind, px)); return out
old_icon = Image.open(f'{ASSETS}/icon-options/joker-1.png').convert('RGBA')
st = Image.new('RGBA', (24 + 4 * 244, 24 + 44 + 200 + 70), (246, 246, 241, 255)); d = ImageDraw.Draw(st)
d.text((24, 12), 'Store and iOS icons (the platform rounds the corners itself)', fill=(23, 32, 27), font=fontb)
for i, (im, k, lab) in enumerate([(old_icon, 'squircle', 'Before · iPhone'), (old_icon, 'rounded', 'Before · Play Store'), (icon, 'squircle', 'After · iPhone'), (icon, 'rounded', 'After · Play Store')]):
    x = 24 + i * 244; st.alpha_composite(store(im, k), (x, 68)); d.text((x + 100, 68 + 210), lab, fill=(23, 32, 27), font=fonts, anchor='mt')
d.text((24, 68 + 240), 'Before: a tile drawn inside the platform tile (double frame). After: full bleed, one frame.', fill=(78, 87, 82), font=fonts)
st.convert('RGB').save(f'{OUT}/store-before-after.png')
print('ok')
