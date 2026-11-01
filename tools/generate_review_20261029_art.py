from PIL import Image,ImageDraw,ImageFilter,ImageEnhance,ImageOps
from pathlib import Path
import math,random
random.seed(20261029)
R=Path('.')
OUT=R/'assets/img/ui/upgrade/illustrations'
OUT.mkdir(parents=True,exist_ok=True)
SRC=R/'assets/img/ui/upgrade/illustrations'
def cover(img,size=(768,512),region=None):
    if region: img=img.crop(region)
    return ImageOps.fit(img.convert('RGB'),size,method=Image.Resampling.LANCZOS,centering=(.5,.48))
def art_base(skill):
    f=SRC/(skill+'.webp')
    if not f.exists(): f=R/'assets/img/ui/choice-art'/('katana.webp')
    return cover(Image.open(f))
mut={
 'mut_crosscut':('katana',(235,177,87),'X'),
 'mut_return':('needle',(88,222,224),'RETURN'),
 'mut_pulse':('barrier',(120,213,244),'RING'),
 'mut_fan':('needle',(224,192,105),'FAN'),
 'mut_frost':('needle',(157,224,255),'ICE'),
 'mut_pierce':('needle',(239,228,173),'PIERCE'),
 'mut_branch':('thunder',(170,114,251),'BRANCH'),
 'mut_orbit':('fire',(255,134,107),'ORBIT'),
 'mut_splitblast':('boom',(255,170,92),'BURST')
}
for name,(skill,color,kind) in mut.items():
    # Distinct painted main art, with overlaid calligraphic vectors (never a repeated flat medallion).
    base=art_base(skill)
    base=ImageEnhance.Contrast(base).enhance(1.18)
    img=Image.new('RGBA',base.size)
    img.alpha_composite(base.convert('RGBA'))
    ink=Image.new('RGBA',base.size);d=ImageDraw.Draw(ink,'RGBA')
    W,H=base.size;cx,cy=385,250
    # Gold/indigo dust streaks, vary placement by skill to keep cards independent.
    if kind=='X':
        for a in [-.67,.68]:
            d.line([(cx-math.cos(a)*340,cy-math.sin(a)*290),(cx+math.cos(a)*340,cy+math.sin(a)*290)],fill=(*color,235),width=17)
            d.line([(cx-math.cos(a)*340,cy-math.sin(a)*290),(cx+math.cos(a)*340,cy+math.sin(a)*290)],fill=(255,250,218,220),width=4)
    if kind in ['RETURN','ORBIT','RING']:
        for j in range(2 if kind=='RING' else 1):
            box=(90+j*58,85+j*42,670-j*58,434-j*42)
            d.arc(box,30,330,fill=(*color,210),width=11 if j==0 else 6)
        if kind=='RETURN':
            d.polygon([(118,108),(180,85),(162,152)],fill=(*color,230))
    if kind=='FAN':
        for a in [-.75,-.35,.05,.45,.85]:
            d.line([(105,460),(105+530*math.cos(a),460-520*math.sin(a+.9))],fill=(*color,230),width=8)
    if kind=='ICE':
        for x,y in [(140,410),(220,120),(600,340),(515,65),(400,440)]:
            d.polygon([(x,y-60),(x+28,y-10),(x+8,y+46),(x-32,y)],fill=(*color,140),outline=(240,253,255,230),width=5)
    if kind=='PIERCE':
        for i in range(4):
            x=115+i*160
            d.polygon([(x,380),(x+70,145),(x+90,370)],fill=(*color,110),outline=(255,255,220,190),width=5)
    if kind=='BRANCH':
        d.line([(380,20),(310,200),(410,225),(310,500)],fill=(*color,230),width=16)
        d.line([(310,200),(125,155),(170,400)],fill=(249,237,255,220),width=10)
        d.line([(410,225),(620,160),(660,440)],fill=(249,237,255,220),width=10)
    if kind=='BURST':
        for r in [110,225,310]:
            d.arc((cx-r,cy-r*.55,cx+r,cy+r*.55),14,348,fill=(*color,180),width=10)
        for i in range(24):
            a=i*math.tau/24;r=random.randrange(140,250)
            d.line([(cx+math.cos(a)*r,cy+math.sin(a)*r*.7),(cx+math.cos(a)*(r+random.randrange(32,120)),cy+math.sin(a)*(r+random.randrange(32,120))*.7)],fill=(*color,210),width=6)
    for j in range(22):
        x=random.randrange(W);y=random.randrange(H)
        rr=random.randrange(2,8)
        d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=(*color,random.randrange(80,200)))
    halo=ink.filter(ImageFilter.GaussianBlur(12))
    img=Image.alpha_composite(img,halo)
    img=Image.alpha_composite(img,ink)
    # Slight dark vignette for large readable scene artwork.
    img.convert('RGB').save(OUT/(name+'.webp'),'WEBP',quality=86,method=6)
# 心眼一閃：每次從唯一的原始素材重建，保留鷹眼並移除旁邊的大圓眼。
# 不能拿先前已裁過的輸出重複裁切。
source=Image.open(R/'art/ui/upgrade-production/source/yd_passive_ui_crit_00001_.png').convert('RGB')
left=source.crop((0,0,340,512)).resize((520,512),Image.Resampling.LANCZOS)
right=source.crop((530,0,768,512)).resize((400,512),Image.Resampling.LANCZOS)
e=Image.new('RGB',(768,512),(8,15,29))
e.paste(right,(368,0))
mask=Image.new('L',(520,512),255);maskDraw=ImageDraw.Draw(mask)
for xx in range(395,520):
    maskDraw.line((xx,0,xx,511),fill=int(255*(520-xx)/125))
e.paste(left,(0,0),mask)
slash=Image.new('RGBA',(768,512));slashDraw=ImageDraw.Draw(slash,'RGBA')
slashDraw.line([(330,498),(744,95)],fill=(250,201,113,110),width=17)
slashDraw.line([(330,498),(744,95)],fill=(255,247,210,195),width=4)
e=Image.alpha_composite(e.convert('RGBA'),slash.filter(ImageFilter.GaussianBlur(2))).convert('RGB')
e.save(OUT/'crit.webp','WEBP',quality=90,method=6)
print('saved mutation art',len(mut),'and corrected crit')
# Normalized passive icons: same 96px edge and matte with consistent aspect and unified frame.
passive=R/'assets/img/ui/passive'
dest=passive/'normalized';dest.mkdir(exist_ok=True)
for f in passive.glob('hud_passive_*.webp'):
    src=Image.open(f).convert('RGBA')
    src=ImageOps.fit(src,(112,112),method=Image.Resampling.LANCZOS)
    result=Image.new('RGBA',(128,128),(18,25,40,255));pix=src.load()
    # Remove exterior near-neutral light mattes before compositing against a shared dark ink base.
    for y in range(112):
      for x in range(112):
        r,g,b,a=pix[x,y]
        hi=min(r,g,b);lo=max(r,g,b)
        if hi>125 and lo-hi<35 and a>0:
          a=int(a*max(0.0,1.0-(hi-110)/115))
        pix[x,y]=(r,g,b,a)
    result.alpha_composite(src,(8,8))
    result.save(dest/f.name,'WEBP',quality=88)
print('normalized passive art',len(list(dest.glob('*.webp'))))
