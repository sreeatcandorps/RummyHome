"""Add by initials, Q44 (Sree, Nov 25): type fast, the keyboard's own key saves, then a clear "these 3 are saved"
step with one Done, so the admin is never moved on by surprise. Renders add-players-q44.png with headless Chrome."""
import os, shutil, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'add-players-q44.png')

CSS = """
*{box-sizing:border-box;margin:0;padding:0;font-family:'Noto Sans','DejaVu Sans',sans-serif}
body{background:#f3f1ea;padding:18px;width:1290px}
h1{font-size:19px;margin-bottom:4px;color:#1d1d1b}
.sub{font-size:13px;color:#555;margin-bottom:14px}
.row3{display:flex;gap:18px}
.col{width:404px}
.cap{font-size:13px;color:#333;text-align:center;margin-top:8px;line-height:1.35}
.cap b{color:#0f6b3a}
.phone{width:404px;height:800px;background:#faf8f2;border:1px solid #d8d4c8;border-radius:22px;overflow:hidden;position:relative}
.status{height:26px;font-size:12px;color:#444;padding:6px 16px;display:flex;justify-content:space-between}
.bar{height:52px;display:flex;align-items:center;padding:0 14px;gap:12px;font-size:20px;font-weight:700;color:#1d1d1b}
.hint{font-size:12.5px;color:#666;padding:0 18px 10px}
.r{display:flex;align-items:center;gap:10px;padding:6px 18px}
.box{width:56px;height:52px;border:1.5px solid #c9c4b6;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#222}
.box.on{border:2px solid #0f6b3a}
.box.e{color:#bbb;font-weight:400;font-size:15px}
.who{font-size:13px;color:#555}
.who.warn{color:#9a5b00}
.dock{position:absolute;left:0;right:0;bottom:250px;background:#faf8f2;border-top:1px solid #e3dfd3;padding:10px 14px;display:flex;justify-content:space-between;align-items:center}
.dock .count{font-size:13px;color:#444}
.btn{background:#0f6b3a;color:#fff;border-radius:22px;padding:11px 20px;font-size:15px;font-weight:700}
.btn.out{background:#fff;color:#0f6b3a;border:1.5px solid #0f6b3a}
.kb{position:absolute;left:0;right:0;bottom:0;height:250px;background:#d9dad5;padding:10px 6px}
.kr{display:flex;justify-content:center;gap:5px;margin-bottom:9px}
.k{width:33px;height:44px;background:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#222}
.k.w{width:72px;background:#0f6b3a;color:#fff;font-weight:700;font-size:14px}
.k.g{width:52px;background:#b9bbb4}
.res{background:#fff;margin:0 12px;border-radius:14px;overflow:hidden;border:1px solid #e6e2d6}
.it{display:flex;align-items:center;gap:12px;padding:12px 14px;border-top:1px solid #eee}
.it:first-child{border-top:none}
.ok{width:26px;height:26px;border-radius:13px;background:#dff3e6;color:#0f6b3a;display:flex;align-items:center;justify-content:center;font-weight:700}
.ok.w{background:#fde9c4;color:#9a5b00}
.ini{font-size:18px;font-weight:800;width:52px}
.t{flex:1;font-size:13px;color:#333;line-height:1.3}
.t small{color:#777}
.lnk{font-size:13px;color:#0f6b3a;font-weight:700;margin-left:6px}
.lnk.red{color:#a33}
.seat{padding:14px 18px 6px;font-size:13px;color:#555}
.chips{padding:0 14px;display:flex;flex-wrap:wrap;gap:6px}
.chip{background:#ece8dc;border-radius:12px;padding:5px 10px;font-size:12px;font-weight:700;color:#333}
.chip.new{background:#dff3e6;color:#0f6b3a}
.foot{position:absolute;left:0;right:0;bottom:0;padding:14px;border-top:1px solid #e3dfd3;background:#faf8f2;display:flex;justify-content:space-between;align-items:center}
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.35)}
.dlg{position:absolute;left:26px;right:26px;top:250px;background:#fff;border-radius:20px;padding:20px}
.dlg h3{font-size:17px;margin-bottom:8px}
.dlg p{font-size:13.5px;color:#444;line-height:1.4;margin-bottom:16px}
.acts{display:flex;justify-content:flex-end;gap:16px;align-items:center}
.tx{color:#0f6b3a;font-weight:700;font-size:14px}
"""

def keyboard(enter='Save'):
    rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
    h = '<div class="kb">'
    for i, r in enumerate(rows):
        keys = ''.join(f'<div class="k">{c}</div>' for c in r)
        if i == 2:
            keys = '<div class="k g">⇧</div>' + keys + '<div class="k g">⌫</div>'
        h += f'<div class="kr">{keys}</div>'
    h += f'<div class="kr"><div class="k g">123</div><div class="k" style="width:170px"> </div><div class="k w">{enter}</div></div></div>'
    return h

def head(title='Add by initials'):
    return '<div class="status"><span>8:10</span><span>▮▮▮ 100%</span></div>' \
           f'<div class="bar">←&nbsp; {title}</div>'

typing = head() + '<div class="hint">First-name letter · last-name letter. The cursor moves on by itself.</div>' \
    '<div class="r"><div class="box">S</div><div class="box">K</div><div class="who">Sree K · new</div></div>' \
    '<div class="r"><div class="box">H</div><div class="box">G</div><div class="who warn">HG is taken → saves as HG2</div></div>' \
    '<div class="r"><div class="box">V</div><div class="box on">|</div><div class="who">cursor here</div></div>' \
    '<div class="r"><div class="box e">F</div><div class="box e">L</div><div class="who">a new row appears</div></div>' \
    '<div class="dock"><span class="count">2 ready · 1 needs a 2nd letter</span><span class="btn">Save 2 players</span></div>' \
    + keyboard('Save')

saved = head() + '<div class="hint" style="font-size:15px;color:#0f6b3a;font-weight:700">✓ 3 players saved and seated</div>' \
    '<div class="res">' \
    '<div class="it"><div class="ok">✓</div><div class="ini">SK</div><div class="t">Sree K<br><small>new player</small></div><span class="lnk">Edit</span><span class="lnk red">Remove</span></div>' \
    '<div class="it"><div class="ok w">!</div><div class="ini">HG2</div><div class="t">Saved as HG2<br><small>Harish G already has HG</small></div><span class="lnk">Edit</span><span class="lnk red">Remove</span></div>' \
    '<div class="it"><div class="ok">✓</div><div class="ini">VR</div><div class="t">V R<br><small>new player</small></div><span class="lnk">Edit</span><span class="lnk red">Remove</span></div>' \
    '</div>' \
    '<div class="seat">Playing in this game · 17</div>' \
    '<div class="chips">' + ''.join(f'<span class="chip{" new" if c in ("SK","HG2","VR") else ""}">{c}</span>' for c in ['SK','HG2','VR','HG','P2','P3','P4','PR','LN','CC','PO','PT','PLT','PF','PLF','PS','PLS']) + '</div>' \
    '<div class="foot"><span class="tx">+ Add more</span><span class="btn">Done</span></div>'

back = head() + '<div class="hint">First-name letter · last-name letter.</div>' \
    '<div class="r"><div class="box">S</div><div class="box">K</div><div class="who">Sree K · new</div></div>' \
    '<div class="r"><div class="box">V</div><div class="box e">L</div><div class="who">one letter</div></div>' \
    '<div class="scrim"></div><div class="dlg"><h3>2 players not saved yet</h3>' \
    '<p>SK is ready. V has only one letter, so it is left out.</p>' \
    '<div class="acts"><span class="tx" style="color:#a33">Discard</span><span class="btn">Save SK</span></div></div>'

def phone(body):
    return f'<div class="phone">{body}</div>'

html = f"""<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<h1>Add players by initials — Q44 proposal (Sree, Nov 25)</h1>
<div class="sub">"just use the keyboard on the bottom, so I don't have to even go up and click on Save … he needs to see clearly that those 3 are getting saved … one extra confirmation before you take him away." Mockup only.</div>
<div class="row3">
<div class="col">{phone(typing)}<div class="cap"><b>1 · Type.</b> One letter per box, the cursor jumps on.<br>The keyboard's own key says <b>Save</b>; the same button sits just above it.</div></div>
<div class="col">{phone(saved)}<div class="cap"><b>2 · See what was saved.</b> Keyboard down, every new player listed.<br>Fix one with <b>Edit</b> or <b>Remove</b>. Only <b>Done</b> goes back to Players.</div></div>
<div class="col">{phone(back)}<div class="cap"><b>Back with unsaved letters</b> (← or Android back):<br>one question, the ready ones saved with one tap.</div></div>
</div></body></html>"""

d = tempfile.mkdtemp()
path = os.path.join(d, 'm.html')
open(path, 'w').write(html)
# Headless Chrome writes the screenshot and then may not exit; it is killed after the wait.
proc = subprocess.Popen(['/usr/local/bin/google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                         '--force-device-scale-factor=2', f'--user-data-dir={d}/u', '--window-size=1326,1000',
                         '--virtual-time-budget=1500', f'--screenshot={OUT}', f'file://{path}'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    proc.wait(timeout=20)
except subprocess.TimeoutExpired:
    proc.kill()
shutil.rmtree(d, ignore_errors=True)
assert os.path.exists(OUT)
print(OUT)
