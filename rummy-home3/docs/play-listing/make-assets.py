# Builds the Play listing images from CI device frames (Pixel 6, 1080x2400).
# Usage: python3 docs/play-listing/make-assets.py [out-dir]  — edit S99/S100 to point at downloaded artifacts
# (`gh run download <id> -D dir -p "ui-*-smoke"`). Needs Pillow and the Public Sans fonts.
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import sys
OUT=sys.argv[1] if len(sys.argv)>1 else 'docs/play-listing/assets'
S99='/tmp/pr99b/ui-cursor-v12-quick-fixes-ca74-pixel6-smoke/smoke/screens/'
S100='/tmp/pr100/ui-cursor-v12-pool-awards-key-ca74-pixel6-smoke/smoke/screens/'
GREEN=(21,128,61); DARK=(14,74,38); CREAM=(246,246,241); GOLD=(240,184,52); INK=(27,33,30); MUTED=(92,100,95)
B=lambda s: ImageFont.truetype('/usr/share/fonts/truetype/macos/PublicSans-Bold.ttf', s)
R=lambda s: ImageFont.truetype('/usr/share/fonts/truetype/macos/PublicSans-Regular.ttf', s)

# ---- icon 512 ----
icon=Image.open('/agent/repos/RummyHome/rummy-home3/assets/icon.png').convert('RGB').resize((512,512), Image.LANCZOS)
icon.save(f'{OUT}/icon-512.png')

# ---- feature graphic 1024x500 ----
fg=Image.new('RGB',(1024,500),GREEN); d=ImageDraw.Draw(fg)
# soft darker band on the right for the phone
d.rounded_rectangle((760,70,1040,560),40,fill=DARK)
ic=Image.open('/agent/repos/RummyHome/rummy-home3/assets/icon.png').convert('RGBA').resize((150,150), Image.LANCZOS)
mask=Image.new('L',(150,150),0); ImageDraw.Draw(mask).rounded_rectangle((0,0,149,149),34,fill=255)
fg.paste(ic,(64,60),mask)
d.text((240,64),'EZ Score: Rummy',font=B(58),fill='white')
d.text((240,140),'The scorekeeper for your rummy table',font=R(28),fill=(222,240,228))
y=220
for line in ['Points and pool games, round by round','Everyone follows live on their own phone','Awards, results and PDFs to share']:
    d.ellipse((66,y+10,82,y+26),fill=GOLD); d.text((100,y),line,font=R(27),fill='white'); y+=52
# phone frame with the scorecard
shot=Image.open(S99+'04c-scorecard-after-round-3.png').convert('RGB')
pw=230; ph=int(pw*2400/1080); shot=shot.resize((pw,ph),Image.LANCZOS)
frame=Image.new('RGB',(pw+24,ph+24),(20,24,22)); frame.paste(shot,(12,12))
fm=Image.new('L',frame.size,0); ImageDraw.Draw(fm).rounded_rectangle((0,0,frame.size[0]-1,frame.size[1]-1),46,fill=255)
fg.paste(frame,(786,100),fm)
fg.save(f'{OUT}/feature-graphic-1024x500.png')

# ---- phone screenshots 1080x1920 (9:16) ----
shots=[
 ('01-home.png',S99,'Your games, one tap away','Start a game, pick up a live one, open a saved result.'),
 ('04c-scorecard-after-round-3.png',S99,'Every round on one card','Totals at the top, the dealer marked, columns in seat order.'),
 ('04b-add-round-balanced.png',S99,'Tap the points, save the round','Drop, middle drop, full count and rummy on the keypad; the round must balance.'),
 ('16i-pool-scorecard-out.png',S100,'Pool games too','Who is in, who is out, points left to the limit, re-entries.'),
 ('16r-pool-final-screen-awards.png',S100,'Awards at the end','Share the picture; the full round-by-round goes as a PDF.'),
 ('06b-results-one-game.png',S99,'Results across games','Save a night of games as one result and share it.'),
 ('19d-order-everyone-numbered.png',S99,'Seat the table','Tap players in seating order; seat 1 deals.'),
]
for i,(f,src,title,sub) in enumerate(shots,1):
    bg=Image.new('RGB',(1080,1920),CREAM); d=ImageDraw.Draw(bg)
    d.rectangle((0,0,1080,330),fill=GREEN)
    d.text((70,80),title,font=B(62),fill='white')
    # wrap subtitle
    words=sub.split(); lines=[]; cur=''
    for w in words:
        t=(cur+' '+w).strip()
        if d.textlength(t,font=R(36))>940: lines.append(cur); cur=w
        else: cur=t
    lines.append(cur)
    yy=170
    for l in lines: d.text((70,yy),l,font=R(36),fill=(222,240,228)); yy+=48
    sh=Image.open(src+f).convert('RGB'); w=640; h=int(w*2400/1080); sh=sh.resize((w,h),Image.LANCZOS)
    fr=Image.new('RGB',(w+28,h+28),(20,24,22)); fr.paste(sh,(14,14))
    m=Image.new('L',fr.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,fr.size[0]-1,fr.size[1]-1),70,fill=255)
    bg.paste(fr,((1080-fr.size[0])//2,390),m)
    bg.save(f'{OUT}/screenshot-{i}-{f.split("-")[0]}.png')
# ---- one 16:9 landscape frame (1920x1080) ----
bg=Image.new('RGB',(1920,1080),CREAM); d=ImageDraw.Draw(bg); d.rectangle((0,0,1920,170),fill=GREEN)
d.text((70,40),'Twenty players, sideways',font=B(56),fill='white'); d.text((70,110),'The header scrolls with the scores; the round column stays.',font=R(32),fill=(222,240,228))
sh=Image.open(S99+'11b-scorecard-20p-landscape-right.png').convert('RGB'); w=1760; h=int(w*1080/2400); sh=sh.resize((w,h),Image.LANCZOS)
fr=Image.new('RGB',(w+28,h+28),(20,24,22)); fr.paste(sh,(14,14)); m=Image.new('L',fr.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,fr.size[0]-1,fr.size[1]-1),70,fill=255)
bg.paste(fr,((1920-fr.size[0])//2,230),m); bg.save(f'{OUT}/screenshot-8-landscape-20p.png')
for f in sorted(os.listdir(OUT)): print(f, Image.open(f'{OUT}/{f}').size, os.path.getsize(f'{OUT}/{f}')//1024,'KB')
