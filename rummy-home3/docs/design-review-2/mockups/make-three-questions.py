#!/usr/bin/env python3
"""The three design questions Sree never answered, plus "a little bit fun" (Sree, Nov 27: "4-tab bar, what is that? …
you have to ask me those questions"; "Maybe some sounds … I just want recommendations"). Today = the real Pixel 6 CI
frames of run 46035664063 (PR #170, small batch 4, green, the commit that merged to main as 738df7d6). Proposed = the
same frames with only the changed part swapped for a drawing in palette B (D65), so everything else is pixel-real.
Writes three-q1-tab-bar.png, three-q2-undo.png, three-q3-home-title.png, three-q4-appearance.png, three-q5-fun.png.
Needs `gh` (to fetch the frames once), Pillow and headless Chrome."""
import os, glob, shutil, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RUN = '46035664063'
REPO = 'sreeatcandorps/RummyHome'
ARTIFACTS = ['ui-cursor-small-batch-4-f877-pixel6-smoke-a', 'ui-cursor-small-batch-4-f877-pixel6-smoke-b',
             'ui-cursor-small-batch-4-f877-pixel6-roles']
FRAMES = os.environ.get('CI_FRAMES', '/tmp/three-questions-frames')
CHROME = '/usr/local/bin/google-chrome'
W, H = 1080, 2400          # Pixel 6 frame
DPR = W / 412              # px per dp
BAR_TOP_HOME, BAR_TOP_CARD, NAV_TOP = 2094, 2073, 2274
# Palette B light (make-palette-mockups.py B_LIGHT) and the colours sampled from the frames.
T = dict(bg='#F5F2E8', ink='#1A1F1B', muted='#5A615B', hair='#EDE9DD', surface='#FFFFFF', primary='#0E4D2A', edge='#0B3B1F',
         primaryc='#D8ECDD', secc='#F0DFAE', onsecc='#3E2E07', brass='#E3BE63', felt='#0B3B1F', toast='#2C332F', mint='#7FD39F',
         outline='#8E928A', seat1='#0F766E', mark='#D9480F')
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
NB = '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf'
def font(sz, bold=False, path=None): return ImageFont.truetype(path or (FB if bold else F), sz)


def fetch_frames():
    for name in ARTIFACTS:
        if not os.path.isdir(os.path.join(FRAMES, name)):
            subprocess.run(['gh', 'run', 'download', RUN, '-R', REPO, '-n', name, '-D', os.path.join(FRAMES, name)], check=True)

def frame(name):
    hits = [h for a in ARTIFACTS for h in glob.glob(os.path.join(FRAMES, a, '*', 'screens', name + '.png'))]
    assert hits, f'{name} not in run {RUN}'
    return Image.open(hits[0]).convert('RGB')


def render(body, w_dp, h_dp, transparent=False):
    """One drawn piece at the phone's density, 1 dp = DPR px."""
    bg = 'transparent' if transparent else T['bg']
    html = ('<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0}'
            f'html,body{{width:{w_dp}px;height:{h_dp}px;background:{bg};overflow:hidden;'
            'font-family:Roboto,"Noto Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased}'
            f'</style></head><body>{body}</body></html>')
    d = tempfile.mkdtemp(); p = os.path.join(d, 'm.html'); open(p, 'w').write(html); png = os.path.join(d, 'o.png')
    args = [CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', f'--force-device-scale-factor={DPR}',
            f'--user-data-dir={d}/u', f'--window-size={w_dp},{h_dp}', '--virtual-time-budget=1000', f'--screenshot={png}']
    if transparent:
        args.append('--default-background-color=00000000')
    proc = subprocess.Popen(args + ['file://' + p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: proc.wait(timeout=10)
    except subprocess.TimeoutExpired: proc.kill()
    im = Image.open(png).convert('RGBA'); im.load()
    shutil.rmtree(d, ignore_errors=True)
    return im.crop((0, 0, min(im.width, round(w_dp * DPR)), min(im.height, round(h_dp * DPR))))

def stack(*parts, height=H):
    """Rows of real frames and drawn pieces, top to bottom: (image, y0, y1) or a drawn image."""
    out = Image.new('RGB', (W, height), T['bg']); y = 0
    for part in parts:
        im = part[0].crop((0, part[1], W, part[2])) if isinstance(part, tuple) else part
        out.paste(im.convert('RGB'), (0, y)); y += im.height
    return out

def paste(base, piece, y, x=0):
    out = base.copy(); out.paste(piece, (x, y), piece if piece.mode == 'RGBA' else None); return out

def mark(im, box, color=T['mark']):
    """The orange ring that says "this is the part that changes"."""
    out = im.copy(); ImageDraw.Draw(out).rounded_rectangle(box, radius=28, outline=color, width=9); return out


# ---------- Drawn pieces ----------
ICON = {
    'home': '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
    'results': '<rect x="4" y="11" width="4" height="9" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="8" width="4" height="12" rx="1"/>',
    'players': '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5z"/><circle cx="16.5" cy="9" r="2.6"/><path d="M15.6 13.7c3 .1 5.4 2 5.4 5.3h-4.3c0-2-.4-3.8-1.1-5.3z"/>',
}

def tab_bar(active='home'):
    def tab(key, label):
        on = key == active
        color = T['primary'] if on else T['muted']
        if key == 'me':
            icon = (f'<div style="width:28px;height:28px;border-radius:14px;background:{T["seat1"]};color:#fff;font-size:12px;font-weight:700;'
                    f'display:flex;align-items:center;justify-content:center;{"box-shadow:0 0 0 2px " + T["primary"] if on else ""}">ST</div>')
        else:
            icon = f'<svg width="26" height="26" viewBox="0 0 24 24" fill="{color}">{ICON[key]}</svg>'
        badge = (f'<div style="position:absolute;top:-6px;left:18px;min-width:22px;height:18px;border-radius:9px;background:{T["secc"]};'
                 f'color:{T["onsecc"]};font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px">43</div>'
                 if key == 'players' else '')
        return (f'<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;color:{color};'
                f'font-size:13px;font-weight:{700 if on else 500}"><div style="position:relative;height:28px;display:flex;align-items:center">{icon}{badge}</div>{label}</div>')
    tabs = tab('home', 'Home') + tab('results', 'Results') + tab('players', 'Players') + tab('me', 'Me')
    h_dp = (NAV_TOP - BAR_TOP_HOME) / DPR
    return render(f'<div style="height:{h_dp}px;background:{T["surface"]};border-top:1px solid {T["hair"]};display:flex;'
                  f'align-items:center;padding:0 8px">{tabs}</div>', 412, h_dp).convert('RGB')

def scorecard_bar():
    h_dp = (NAV_TOP - BAR_TOP_CARD) / DPR
    flag = f'<svg width="18" height="18" viewBox="0 0 24 24" fill="{T["primary"]}"><path d="M5 3h2v18H5zM8 4h11l-2.5 4 2.5 4H8z"/></svg>'
    btn = 'height:50px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:17px;font-weight:700'
    return render(f'<div style="height:{h_dp}px;background:{T["surface"]};border-top:1px solid {T["hair"]};display:flex;gap:12px;'
                  f'align-items:center;padding:0 18px">'
                  f'<div style="{btn};flex:1.6;background:{T["primary"]};color:#fff;box-shadow:0 4px 0 {T["edge"]}">＋&nbsp;Add round</div>'
                  f'<div style="{btn};flex:1;border:1.5px solid {T["primary"]};color:{T["primary"]}">{flag}Complete</div></div>',
                  412, h_dp).convert('RGB')

def toast(text, action):
    return render(f'<div style="margin:0 14px;height:56px;border-radius:8px;background:{T["toast"]};display:flex;align-items:center;'
                  f'padding:0 20px;justify-content:space-between;box-shadow:0 3px 10px rgba(0,0,0,.25)">'
                  f'<span style="color:#fff;font-size:17px">{text}</span><span style="color:{T["mint"]};font-size:17px;font-weight:700">{action}</span></div>',
                  412, 60, transparent=True)

def banner():
    return render(f'<div style="margin:0 12px;height:84px;border-radius:16px;background:{T["felt"]};display:flex;align-items:center;gap:14px;'
                  f'padding:0 16px;box-shadow:0 6px 18px rgba(0,0,0,.3)">'
                  f'<div style="width:50px;height:50px;border-radius:25px;background:{T["brass"]};color:{T["onsecc"]};font-size:18px;font-weight:800;'
                  f'display:flex;align-items:center;justify-content:center">MK</div>'
                  f'<div style="flex:1"><div style="color:#fff;font-size:19px;font-weight:700">MK wins round 3</div>'
                  f'<div style="color:#CFE3D5;font-size:14px;margin-top:2px">The table put in 80</div></div>'
                  f'<div style="color:{T["brass"]};font-size:30px;font-weight:800">+80</div></div>', 412, 90, transparent=True)

def sounds_row():
    return render(f'<div style="padding:10px 18px 14px"><div style="display:flex;align-items:center;justify-content:space-between">'
                  f'<span style="font-size:17px;color:{T["ink"]}">Sounds</span>'
                  f'<div style="width:52px;height:32px;border-radius:16px;border:2px solid {T["outline"]};background:#ECE7DA;position:relative">'
                  f'<div style="position:absolute;left:6px;top:6px;width:16px;height:16px;border-radius:8px;background:{T["outline"]}"></div></div></div>'
                  f'<div style="font-size:13.5px;color:{T["muted"]};margin-top:4px">A short sound when a round is saved. Off to start.</div></div>',
                  412, 84).convert('RGB')

def title_row(base, text):
    """Today's logo + "EZ Score: Rummy" swapped for a plain title in the Profile title's size (22 dp bold); the real ? stays."""
    out = base.copy(); d = ImageDraw.Draw(out)
    d.rectangle((0, 49, 930, 289), fill=T['bg'])
    d.text((round(18 * DPR), 147), text, fill=T['ink'], font=font(round(22 * DPR * 1.05), path=NB), anchor='lm')
    return out


# ---------- The ⋮ menu with one new row, cut from the real menu frame ----------
def menu_with_undo():
    m = frame('28b-scorecard-menu-columns'); bgc = m.getpixel((700, 600))
    # The menu has the screen's own background colour; its edges are where its shadow starts (measured on this frame).
    x0, x1, y0, y1 = 513, 1037, 84, 1369
    split = 733   # under "Edit round"
    w_dp = (x1 - x0 + 1) / DPR
    icon = (f'<svg width="24" height="24" viewBox="0 0 24 24" fill="{T["muted"]}"><path d="M13.5 7a6.5 6.5 0 0 1 0 13H10v-2h3.5a4.5 4.5 0 0 0 0-9H7.8'
            'l3.1 3.1-1.4 1.4L4 8l5.5-5.5 1.4 1.4L7.8 7z"/></svg>')
    row = render(f'<div style="height:48px;background:{T["primaryc"]};display:flex;align-items:center;gap:16px;padding-left:12px">'
                 f'{icon}<span style="font-size:17px;color:{T["ink"]}">Undo last round</span></div>', w_dp, 48).convert('RGB')
    menu = Image.new('RGB', (x1 - x0 + 1, (y1 - y0 + 1) + row.height), bgc)
    menu.paste(m.crop((x0, y0, x1 + 1, split)), (0, 0)); menu.paste(row, (0, split - y0))
    menu.paste(m.crop((x0, split, x1 + 1, y1 + 1)), (0, split - y0 + row.height))
    return menu, x0, y0, split - y0

def with_menu(base):
    menu, x0, y0, row_y = menu_with_undo()
    out = base.copy(); shadow = Image.new('RGBA', out.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(shadow)
    for i in range(14, 0, -2):
        sd.rounded_rectangle((x0 - i, y0 - i + 8, x0 + menu.width + i, y0 + menu.height + i + 8), radius=24, fill=(0, 0, 0, 7))
    out = Image.alpha_composite(out.convert('RGBA'), shadow).convert('RGB')
    corners = Image.new('L', menu.size, 0); ImageDraw.Draw(corners).rounded_rectangle((0, 0, menu.width - 1, menu.height - 1), radius=11, fill=255)
    out.paste(menu, (x0, y0), corners)
    return mark(out, (x0 - 6, y0 + row_y - 6, x0 + menu.width + 6, y0 + row_y + round(48 * DPR) + 6))


# ---------- Sheets ----------
def sheet(title, sub, panels, out, scale=0.5, side=None):
    """Phones side by side with a caption under each; `side` = lines written to the right of a single phone instead."""
    ims = [(lab, im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS), cap) for lab, im, cap in panels]
    PAD, GAP, TOP = 40, 40, 150
    cap_lines = max(len(c) for _, _, c in ims)
    Wd = PAD * 2 + sum(im.width for _, im, _ in ims) + GAP * (len(ims) - 1) + (GAP + 560 if side else 0)
    Hd = TOP + 44 + max(im.height for _, im, _ in ims) + 30 + cap_lines * 30 + 30
    S = Image.new('RGB', (Wd, Hd), '#F6F6F1'); d = ImageDraw.Draw(S)
    def fit(text, size, bold=False):
        while d.textlength(text, font=font(size, bold)) > Wd - 2 * PAD and size > 12:
            size -= 1
        return font(size, bold)
    d.text((PAD, 30), title, fill='#17201B', font=fit(title, 32, True))
    for i, line in enumerate(sub):
        d.text((PAD, 80 + i * 30), line, fill='#4E5752', font=fit(line, 21))
    x = PAD
    for lab, im, cap in ims:
        d.text((x, TOP), lab, fill=T['primary'] if lab.startswith('Proposed') or lab.startswith('Idea') else '#4E5752', font=font(23, True))
        S.paste(im, (x, TOP + 40)); d.rectangle((x - 1, TOP + 39, x + im.width, TOP + 40 + im.height), outline='#C9CBC4')
        for i, line in enumerate(cap):
            d.text((x, TOP + 40 + im.height + 20 + i * 30), line, fill='#333B36', font=font(20))
        x += im.width + GAP
    for i, line in enumerate(side or []):
        d.text((x, TOP + 60 + i * 36), line, fill='#333B36', font=font(23, i == 0))
    S.save(os.path.join(HERE, out), optimize=True); print(out, S.size)


def main():
    fetch_frames()
    home, home_scrolled = frame('01-home'), frame('01c-home-scrolled')
    card, viewer, profile = frame('04c-scorecard-after-round-3'), frame('r01-player-view-only'), frame('07-profile')

    # 1 · Four-tab bar. Results / My players row (625–829) goes; the list moves up and continues from the scrolled frame.
    probe = home.crop((0, 1700, W, 1760)).tobytes()
    offset = next(d for d in range(400, 1300) if home_scrolled.crop((0, 1700 - d, W, 1760 - d)).tobytes() == probe)
    body_end = BAR_TOP_HOME - (625 + (BAR_TOP_HOME - 830))
    tabs_home = stack((home, 0, 625), (home, 830, BAR_TOP_HOME), (home_scrolled, BAR_TOP_HOME - offset, BAR_TOP_HOME - offset + body_end),
                      tab_bar('home'), (home, NAV_TOP, H))
    today1 = mark(mark(home, (30, 612, 1050, 800)), (18, BAR_TOP_HOME + 4, 1062, NAV_TOP - 6))
    sheet('1 · The four-tab bar: the row of buttons at the very bottom of the main screens',
          ['Today it has two buttons (Home, your profile); Results and My players are big buttons on Home.',
           'Proposed: four buttons, Home · Results · Players · Me, at the bottom of all four main screens.'],
          [('Today (CI frame)', today1, ['Results and My players: only on Home.', 'Bottom: Home and your profile.']),
           ('Proposed', mark(tabs_home, (18, BAR_TOP_HOME + 4, 1062, NAV_TOP - 6)),
            ['The two big buttons go; the games move up.', 'Results and Players: one tap from anywhere.'])],
          'three-q1-tab-bar.png')

    # 2 · Undo out of the bar: Add round + Complete; Undo in the toast, then in ⋮.
    new_card = stack((card, 0, BAR_TOP_CARD), scorecard_bar(), (card, NAV_TOP, H))
    toast_y = BAR_TOP_CARD - round(70 * DPR)
    with_toast = mark(paste(new_card, toast('Round 3 saved', 'Undo'), toast_y), (14, toast_y - 10, 1066, toast_y + round(60 * DPR) + 4))
    sheet('2 · Undo leaves the bottom bar',
          ['Today: three buttons, Undo · Add round · Complete. Proposed: two, Add round and Complete.',
           'Undo is in the "Round 3 saved" note for 5 seconds after each save, and in the ⋮ menu after that.'],
          [('Today (CI frame)', mark(card, (18, BAR_TOP_CARD + 6, 1062, NAV_TOP - 6)), ['Undo sits where a thumb', 'reaches for Add round.']),
           ('Proposed: just saved', with_toast, ['"Round 3 saved · Undo" for', '5 seconds, then it goes.']),
           ('Proposed: later', with_menu(new_card), ['⋮ › Undo last round.', 'It still asks "Remove the', 'last round?" first.'])],
          'three-q2-undo.png', scale=0.42)

    # 3 · Home title. Only the top changes: the logo line and "Hi Sree" become one title.
    top = lambda im: im.crop((0, 0, W, 1250))
    no_hi = lambda text: stack((title_row(home, text), 0, 290), (home, 360, H))
    sheet('3 · The title at the top of Home',
          ['Today: the logo and "EZ Score: Rummy", then "Hi Sree" under it.',
           'Proposed: one title, like "Profile" on the Profile screen. New game moves up.'],
          [('Today (CI frame)', mark(top(home), (8, 70, 1072, 360)), ['Logo + app name, then a greeting.']),
           ('Proposed A: "Your games"', mark(top(no_hi('Your games')), (8, 70, 1072, 230)), ['Says what the screen is.', 'Recommended.']),
           ('Proposed B: "Hi Sree"', mark(top(no_hi('Hi Sree')), (8, 70, 1072, 230)), ['Friendlier; the first name', 'of whoever is signed in.'])],
          'three-q3-home-title.png', scale=0.42)

    # 4 · Light / dark: built, Profile › Appearance.
    sheet('4 · Light and dark: already in the app',
          ['Yes, it is done: Profile › Appearance. Nothing to build.'],
          [('Today (CI frame)', mark(mark(profile, (18, 1880, 1062, 2080)), (548, BAR_TOP_HOME + 4, 1062, NAV_TOP - 6)), [])],
          'three-q4-appearance.png',
          side=['How to get there',
                '1. Tap your initials at the bottom.',
                '   That opens Profile.',
                '2. Appearance: Phone · Light · Dark.',
                '',
                'Phone = follow the phone\'s own setting.',
                'Light and Dark stay as picked.',
                'A new install starts on Light.',
                '',
                'No CI test taps Dark yet, so there is',
                'no CI picture of the dark app. The dark',
                'look is the Nov 23 picture you saw',
                '(dark-q8.png, decided as D71).'])

    # 5 · A little bit fun: the winner banner on a viewer's phone, and the Sounds switch (off).
    banner_y = NAV_TOP - round(110 * DPR)
    fun = paste(viewer, banner(), banner_y)
    switch = stack((profile, 1870, 2075), sounds_row(), height=205 + round(84 * DPR))
    sheet('5 · A little bit fun: what it would look like',
          ['Left: someone watching (not the admin) sees who won the round for 2 seconds. Right: a Sounds switch, off.'],
          [('Idea 2: winner banner (viewers)', mark(fun, (14, banner_y - 8, 1066, banner_y + round(90 * DPR) + 4)),
            ['Slides up, stays 2 seconds, goes.', 'A tap closes it. No confetti.']),
           ('Idea 3: Sounds switch', switch, ['Profile › Appearance, under', 'Phone · Light · Dark. Off.'])],
          'three-q5-fun.png')


if __name__ == '__main__':
    main()
