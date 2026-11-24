#!/usr/bin/env python3
"""D74, Sree Nov 23: "the arrow button should show up first, but once a player is selected, only that player gets the
arrow buttons. I think seeing empty space on the top and bottom, and then this player moving up and down, is what makes
it more clear that he's moving up." Four frames, both places. Writes order-mockup-d74.png."""
import os, sys
sys.argv = ['x']
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'make-order-mockup.py')).read()
ns = {'__file__': os.path.join(HERE, 'make-order-mockup.py')}
exec(compile(src[:src.index("if __name__ == '__main__':")], 'order.py', 'exec'), ns)
phone, obar, ORDER, render, strip, OUT = ns['phone'], ns['obar'], ns['ORDER'], ns['render'], ns['strip'], ns['OUT']

ns['CSS'] += """
.orow{transition:none}
.orow .ar{width:92px}
.orow .ar span{width:40px;height:40px;font-size:20px;color:var(--onsurf);background:var(--sunken);border-radius:50%}
.orow .ar span.off{visibility:hidden}
.orow.lift{background:var(--primaryc);margin:10px 12px;height:68px;border-radius:14px;border-bottom:0;box-shadow:0 6px 16px rgba(0,0,0,.18);border:1px solid var(--primary)}
.orow.lift .ar{width:104px;gap:8px}
.orow.lift .ar span{width:48px;height:48px;font-size:24px;color:#fff;background:var(--primary);font-weight:900}
.orow.dim .ar{visibility:hidden}
.gap{height:10px}
.sheet2{position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:28px 28px 0 0;box-shadow:0 -8px 24px rgba(0,0,0,.25);padding-bottom:8px}
.sheet2 .grab{width:32px;height:4px;border-radius:2px;background:var(--outline);margin:12px auto 0}
.sheet2 .hd{padding:14px 20px 6px}.sheet2 .hd h2{font-size:22px}.sheet2 .hd .s{font-size:14px;color:var(--muted);margin-top:4px}
.sheet2 .orow{background:var(--surface)}.sheet2 .orow.lift{background:var(--primaryc)}
"""

def orows(order, selected=None, dealer_seat=1):
    n = len(order); out = ''
    for i, (nm, ini, col) in enumerate(order):
        seat = n - i; sel = selected == i
        cls = 'lift' if sel else ('dim' if selected is not None else '')
        up = '<span class="%s">▲</span>' % ('off' if i == 0 else '')
        dn = '<span class="%s">▼</span>' % ('off' if i == n - 1 else '')
        out += (f'<div class="orow {cls}"><div class="no {"deal" if seat == dealer_seat else ""}">{seat}</div><div class="av" style="background:{col}">{ini}</div>'
                f'<div class="nm">{nm}</div><div class="ini">{ini}</div>{"<div class=deals>deals</div>" if seat == dealer_seat else ""}<div class="ar">{up}{dn}</div></div>')
    return out

BTNS = '<div class="obtns"><div class="btn text">Clear</div><div class="btn">Done</div></div>'
MOVED = [ORDER[1], ORDER[0]] + ORDER[2:]
def rest(): return phone(obar() + '<div class="ohint">Tap a player to move them. Seat 1 deals round 5.</div>' + orows(ORDER) + BTNS, 760)
def sel(): return phone(obar() + '<div class="ohint">Sree Koneru selected · ▲ ▼ move one seat · tap again to deselect</div>' + orows(ORDER, 1) + BTNS, 760)
def moved(): return phone(obar() + '<div class="ohint">Sree Koneru moved up to seat 6 · tap again to deselect</div>' + orows(MOVED, 0) + BTNS, 760)
def midgame():
    bar = '<div class="bar"><div class="ic sq"></div><h1>P6 · Friday night</h1><div class="ic dots">⋮</div></div><div class="sub">Pool 101 · Round 5 · 4 rounds played</div>'
    sheet = ('<div class="sheet2"><div class="grab"></div><div class="hd"><h2>Order of players</h2><div class="s">From round 5 · seat 1 deals · <b style="color:var(--primary)">Show me</b></div></div>'
             + orows(ORDER, 2) + '<div class="ft" style="display:flex;justify-content:flex-end;gap:8px;padding:12px 20px 12px;border-top:1px solid var(--hair)"><div class="btn text">Cancel</div><div class="btn">Done</div></div></div>')
    return phone(bar + '<div class="scrim"></div>' + sheet, 820)

ns['SCREENS'].update({'d74-rest': rest, 'd74-sel': sel, 'd74-moved': moved, 'd74-mid': midgame})
for n in ['d74-rest', 'd74-sel', 'd74-moved', 'd74-mid']: render(n); print('rendered', n)
strip(['d74-rest', 'd74-sel', 'd74-moved', 'd74-mid'],
      'Order of players (D74): arrows on every row at rest · tap a player: only his arrows, bigger, the row lifts with space above and below · it travels with him · same in the mid-game sheet',
      ['At rest: every row has arrows (top has no ▲, last has no ▼)', 'Sree tapped: only his arrows, 48 dp, row lifted with a gap above and below', 'After one ▲: he is seat 6, the gap moved with him', 'Mid-game sheet: same component, Venkat selected; Show me is a link, never auto-opens'],
      os.path.join(HERE, 'order-mockup-d74.png'))
print('ok')
