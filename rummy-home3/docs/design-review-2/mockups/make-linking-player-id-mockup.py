"""Linking, one way (Sree, Nov 25, Q30 revisited): has the app → search their Player ID only; no app → initials now,
Link to Player ID later, and they say Yes. Renders linking-player-id.png with headless Chrome."""
import os, shutil, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'linking-player-id.png')

CSS = """
*{box-sizing:border-box;margin:0;padding:0;font-family:'Noto Sans','DejaVu Sans',sans-serif}
body{background:#f3f1ea;padding:18px;width:866px}
h1{font-size:19px;margin-bottom:4px;color:#1d1d1b}
.sub{font-size:13px;color:#555;margin-bottom:12px;line-height:1.4}
.flow{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.lane{background:#fff;border:1px solid #e3dfd3;border-radius:14px;padding:12px 14px}
.lane h2{font-size:15px;color:#0f6b3a;margin-bottom:8px}
.step{display:flex;gap:8px;font-size:13px;color:#333;line-height:1.35;margin-bottom:6px}
.n{min-width:22px;height:22px;border-radius:11px;background:#0f6b3a;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.grid{display:grid;grid-template-columns:404px 404px;gap:22px}
.cap{font-size:13px;color:#333;text-align:center;margin-top:8px;line-height:1.35}
.cap b{color:#0f6b3a}
.phone{width:404px;height:720px;background:#faf8f2;border:1px solid #d8d4c8;border-radius:22px;overflow:hidden;position:relative}
.status{height:26px;font-size:12px;color:#444;padding:6px 16px;display:flex;justify-content:space-between}
.bar{height:52px;display:flex;align-items:center;padding:0 14px;gap:12px;font-size:20px;font-weight:700;color:#1d1d1b}
.hint{font-size:13px;color:#555;padding:0 18px 10px;line-height:1.4}
.field{margin:4px 18px;display:flex;gap:10px;align-items:center}
.inp{flex:1;height:54px;border:2px solid #0f6b3a;border-radius:12px;background:#fff;display:flex;align-items:center;padding:0 14px;font-size:22px;font-weight:700;color:#222}
.inp span{color:#999;margin-right:4px}
.btn{background:#0f6b3a;color:#fff;border-radius:22px;padding:12px 20px;font-size:15px;font-weight:700;display:inline-block}
.btn.out{background:#fff;color:#0f6b3a;border:1.5px solid #0f6b3a}
.btn.sm{padding:9px 16px;font-size:14px}
.note{font-size:12.5px;color:#777;padding:8px 18px;line-height:1.4}
.pad{position:absolute;left:0;right:0;bottom:0;height:250px;background:#d9dad5;padding:12px 18px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.k{background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#222}
.k.g{background:#b9bbb4;font-size:15px}
.k.go{background:#0f6b3a;color:#fff;font-weight:700;font-size:15px}
.card{background:#fff;margin:8px 14px;border-radius:16px;border:1px solid #e6e2d6;padding:14px}
.who{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.av{width:44px;height:44px;border-radius:22px;background:#dff3e6;color:#0f6b3a;font-weight:800;display:flex;align-items:center;justify-content:center}
.nm{font-size:17px;font-weight:700;color:#222}
.nm small{display:block;font-size:12.5px;color:#777;font-weight:400}
.p{font-size:13.5px;color:#444;line-height:1.45;margin-bottom:12px}
.row{display:flex;align-items:center;gap:12px;padding:12px 18px;border-top:1px solid #eee;background:#fff}
.ini{font-size:17px;font-weight:800;width:44px}
.t{flex:1;font-size:13px;color:#333}
.t small{display:block;color:#888}
.menu{position:absolute;right:16px;top:200px;width:230px;background:#fff;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.18);padding:6px 0}
.mi{padding:12px 16px;font-size:14px;color:#222}
.mi.on{background:#e8f3ec;color:#0f6b3a;font-weight:700}
.home{background:#fff8e6;border:1.5px solid #e9c46a}
.tag{font-size:11px;font-weight:700;color:#9a5b00;letter-spacing:.04em;margin-bottom:6px}
.acts{display:flex;justify-content:flex-end;gap:12px;align-items:center}
"""

def head(title):
    return f'<div class="status"><span>8:56</span><span>▮▮▮ 100%</span></div><div class="bar">←&nbsp; {title}</div>'

def numpad():
    keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
    h = '<div class="pad">' + ''.join(f'<div class="k">{k}</div>' for k in keys)
    return h + '<div class="k g">⌫</div><div class="k">0</div><div class="k go">Search</div></div>'

find = head('Find on EZ Score') + \
    '<div class="hint">Ask them for their <b>Player ID</b>. It is on their Profile.<br>Nothing shows until you tap Search.</div>' \
    '<div class="field"><div class="inp"><span>#</span>57</div><span class="btn">Search</span></div>' \
    '<div class="note">Names are never searched, so nobody can look people up.</div>' + numpad()

found = head('Find on EZ Score') + \
    '<div class="field"><div class="inp"><span>#</span>57</div><span class="btn out">Search</span></div>' \
    '<div class="card"><div class="who"><div class="av">RK</div><div class="nm">Ravi K.<small>Player ID #57</small></div></div>' \
    '<div class="p">Is this the person in front of you? If not, check the number with them.</div>' \
    '<div class="acts"><span class="btn sm">Add to game</span></div></div>' \
    '<div class="note">Wrong number: it shows someone else, or <b>"No one has #58"</b>. Nothing is added until you tap Add.</div>'

later = head('My players') + \
    '<div class="hint">No app yet? Add them by initials now (D112). Later, when they have the app:</div>' \
    '<div class="row"><div class="ini">SK</div><div class="t">SK<small>not on EZ Score yet · 3 games</small></div><span>⋮</span></div>' \
    '<div class="row"><div class="ini">HG2</div><div class="t">HG2<small>not on EZ Score yet · 1 game</small></div><span>⋮</span></div>' \
    '<div class="menu"><div class="mi">Edit</div><div class="mi">Invite to EZ Score</div><div class="mi on">Link to Player ID</div><div class="mi">Remove</div></div>'

confirm = head('Link SK') + \
    '<div class="field"><div class="inp"><span>#</span>57</div></div>' \
    '<div class="card"><div class="who"><div class="av">RK</div><div class="nm">Ravi K.<small>Player ID #57</small></div></div>' \
    '<div class="p">Ravi gets an email and an in-app request. Nothing moves until Ravi says Yes. 3 games: G3, G5, G8.</div>' \
    '<div class="acts"><span class="btn sm">Send request</span></div></div>' \
    '<div class="hint" style="padding-top:10px">On Ravi\'s phone, his Home:</div>' \
    '<div class="card home"><div class="tag">REQUEST</div><div class="p">Sree wants to link “SK” to your Player ID #57. 3 games move to your account.</div>' \
    '<div class="acts"><span class="btn sm out">Not me</span><span class="btn sm">Yes</span></div></div>'

def phone(body):
    return f'<div class="phone">{body}</div>'

html = f"""<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<h1>Adding someone who is on EZ Score — one way: their Player ID</h1>
<div class="sub">Sree, Nov 25: "find people in the database only by their player number and nothing else … You have to type in the player number and then say 'search' … if someone's in a hurry, just do the initials … I don't want to offer three different options." Proposal (Q30), not built.</div>
<div class="flow">
<div class="lane"><h2>They have the app</h2>
<div class="step"><div class="n">1</div><div>"What's your Player ID?" (Profile shows it)</div></div>
<div class="step"><div class="n">2</div><div>Type it, tap <b>Search</b>, check the name</div></div>
<div class="step"><div class="n">3</div><div><b>Add to game</b>. Their scores go to their account from round 1.</div></div></div>
<div class="lane"><h2>No app, or in a hurry</h2>
<div class="step"><div class="n">1</div><div>Add by initials, start the game</div></div>
<div class="step"><div class="n">2</div><div>They get the app, tell you their Player ID</div></div>
<div class="step"><div class="n">3</div><div>⋮ › <b>Link to Player ID</b>; they tap <b>Yes</b>; old games move</div></div></div>
</div>
<div class="grid">
<div class="col">{phone(find)}<div class="cap"><b>1 · Has the app.</b> Number only, then Search.<br>No list of names while typing.</div></div>
<div class="col">{phone(found)}<div class="cap"><b>2 · Check the name, then Add.</b> A wrong number shows<br>the wrong name (or nobody) before anything happens.</div></div>
<div class="col">{phone(later)}<div class="cap"><b>3 · No app yet.</b> Initials now. When they join,<br>the player's ⋮ › Link to Player ID (built today).</div></div>
<div class="col">{phone(confirm)}<div class="cap"><b>4 · They say Yes.</b> The admin sees the name first; the person<br>confirms on their phone. "Not me" cancels. (Built today.)</div></div>
</div></body></html>"""

d = tempfile.mkdtemp()
path = os.path.join(d, 'm.html')
open(path, 'w').write(html)
# Headless Chrome writes the screenshot and then may not exit; it is killed after the wait.
proc = subprocess.Popen(['/usr/local/bin/google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                         '--force-device-scale-factor=2', f'--user-data-dir={d}/u', '--window-size=866,1990',
                         '--virtual-time-budget=1500', f'--screenshot={OUT}', f'file://{path}'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    proc.wait(timeout=20)
except subprocess.TimeoutExpired:
    proc.kill()
shutil.rmtree(d, ignore_errors=True)
assert os.path.exists(OUT)
print(OUT)
