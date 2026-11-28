#!/usr/bin/env python3
"""Renders every ```mermaid block in flows.md to flows-N.png with headless Chrome + mermaid (vendored at /tmp/mermaid.min.js
or fetched from jsdelivr). GitHub renders the Markdown itself; the PNGs are for PR bodies and chat."""
import os, re, shutil, subprocess, tempfile, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = '/usr/local/bin/google-chrome'
MERMAID = '/tmp/mermaid.min.js'
if not os.path.exists(MERMAID):
    urllib.request.urlretrieve('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js', MERMAID)
md = open(os.path.join(HERE, 'flows.md')).read()
blocks = re.findall(r'^## (\d+)\. (.+?)\n(?:.|\n)*?```mermaid\n((?:.|\n)*?)```', md, re.M)
for num, title, src in blocks:
    d = tempfile.mkdtemp()
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
body{{margin:0;background:#F6F6F1;font-family:"Noto Sans",Arial,sans-serif;padding:24px 28px}}
h1{{font-size:22px;color:#17201B;margin:0 0 14px}} .mermaid{{background:#fff;border:1px solid #E6E1D3;border-radius:12px;padding:16px;display:inline-block}}
</style></head><body><h1>{num}. {title}</h1><pre class="mermaid">{src}</pre>
<script src="file://{MERMAID}"></script>
<script>mermaid.initialize({{startOnLoad:true,theme:'base',themeVariables:{{primaryColor:'#D6F5DF',primaryBorderColor:'#0E4D2A',primaryTextColor:'#17201B',lineColor:'#4E5752',fontSize:'15px',fontFamily:'Noto Sans, Arial'}},flowchart:{{curve:'basis',padding:12,useMaxWidth:false,nodeSpacing:40,rankSpacing:50}}}});</script>
</body></html>"""
    p = os.path.join(d, 'f.html'); open(p, 'w').write(html)
    out = os.path.join(HERE, f'flows-{num}.png')
    width = 2400 if 'LR' in src.split('\n')[0] else 1400
    proc = subprocess.Popen([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--allow-file-access-from-files',
                             f'--user-data-dir={d}/u', f'--window-size={width},3000', '--virtual-time-budget=4000', '--timeout=8000', f'--screenshot={out}', 'file://' + p],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try: proc.wait(timeout=30)
    except subprocess.TimeoutExpired: proc.kill()
    shutil.rmtree(d, ignore_errors=True)
    from PIL import Image
    im = Image.open(out).convert('RGB'); px = im.load(); w, h = im.size; bg = px[0, 0]
    last_y = max((y for y in range(0, h, 4) if any(px[x, y] != bg for x in range(0, w, 8))), default=h - 1)
    last_x = max((x for x in range(0, w, 4) if any(px[x, y] != bg for y in range(0, h, 8))), default=w - 1)
    im.crop((0, 0, min(w, last_x + 60), min(h, last_y + 60))).save(out, optimize=True)
    print(out, Image.open(out).size)
