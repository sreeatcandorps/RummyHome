#!/usr/bin/env python3
"""Side-by-side "today | after" pictures from two sets of CI device frames.

Usage:
  pip install pillow
  python3 scripts/compare-frames.py --before <screens dir> --after <screens dir> --out <dir> \
      profile:07-profile.png:"Profile" sign-in:21c-sign-in.png:"Sign in"

Each positional argument is name:frame-file:title. The frame file must exist in both directories (the
`smoke/screens/` folder of a `ui-<branch>-pixel6-smoke` artifact). Writes <out>/<name>.png.
"""
import argparse
import os

from PIL import Image, ImageDraw, ImageFont

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"


def font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_DIR + ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"), size)
    except OSError:
        return ImageFont.load_default()


def compare(before, after, title, before_label, after_label, width=480):
    a = Image.open(before).convert("RGB")
    b = Image.open(after).convert("RGB")
    height = int(a.height * width / a.width)
    a = a.resize((width, height), Image.LANCZOS)
    b = b.resize((width, int(b.height * width / b.width)), Image.LANCZOS)
    pad, top = 24, 100
    img = Image.new("RGB", (width * 2 + pad * 3, max(height, b.height) + top + pad), "white")
    d = ImageDraw.Draw(img)
    d.text((pad, 14), title, fill="black", font=font(30, bold=True))
    d.text((pad, 58), before_label, fill="#555555", font=font(24))
    d.text((width + pad * 2, 58), after_label, fill="#0E4D2A", font=font(24))
    for x, im in ((pad, a), (width + pad * 2, b)):
        img.paste(im, (x, top))
        d.rectangle([x - 1, top - 1, x + width, top + im.height], outline="#bbbbbb")
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", required=True)
    ap.add_argument("--after", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--before-label", default="Today (the app on main)")
    ap.add_argument("--after-label", default="After this PR")
    ap.add_argument("screens", nargs="+", help="name:frame-file:title")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    for spec in args.screens:
        name, frame, title = spec.split(":", 2)
        img = compare(os.path.join(args.before, frame), os.path.join(args.after, frame), title,
                      args.before_label, args.after_label)
        path = os.path.join(args.out, name + ".png")
        img.save(path, optimize=True)
        print(path, img.size)


if __name__ == "__main__":
    main()
