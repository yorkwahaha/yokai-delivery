"""Pre-bake irregular sumi-washi panels. At runtime these are static WebP.
python tools/generate-ui-washi.py  (Pillow + NumPy, build time only)
"""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "img" / "ui"
OUT.mkdir(parents=True, exist_ok=True)

def noise_field(w,h,rng):
    val=np.zeros((h,w),dtype=np.float32)
    for div,weight in [(8,.48),(21,.27),(55,.13),(130,.075)]:
        small=rng.integers(0,256,(max(2,h//div),max(2,w//div)),dtype=np.uint8)
        up=Image.fromarray(small).resize((w,h),Image.Resampling.BICUBIC)
        val+=(np.asarray(up,dtype=np.float32)-127)*(weight/128)
    return val+rng.normal(0,.035,(h,w)).astype(np.float32)

def ragged_mask(w,h,rng,strength):
    def waveline(length):
        rr=np.random.default_rng(int(rng.integers(2**30)))
        pts=rr.uniform(-1,1,max(3,length//31)).astype(np.float32)
        return np.asarray(Image.fromarray(pts.reshape(1,-1),"F").resize((length,1),Image.Resampling.BICUBIC))[0]
    top=strength+waveline(w)*strength*.45
    bottom=strength+waveline(w)*strength*.51
    left=strength+waveline(h)*strength*.53
    right=strength+waveline(h)*strength*.42
    yy,xx=np.ogrid[:h,:w]
    dist=np.minimum.reduce(np.broadcast_arrays(yy-top[None,:],h-1-yy-bottom[None,:],
                                                xx-left[:,None],w-1-xx-right[:,None]))
    alpha=np.uint8(np.clip((dist+1.1)/4.5,0,1)*255)
    return alpha,np.maximum(dist,0)

def paper(w,h,seed,palette,strength,spine=False,button=False):
    rng=np.random.default_rng(seed)
    yy,xx=np.ogrid[:h,:w]
    x=xx/w;y=yy/h
    n=noise_field(w,h,rng)
    alpha,edge=ragged_mask(w,h,rng,strength)
    radial=.21+.27*np.sin(x*4.8-y*2.2)+.15*np.cos(x*3.3+y*6.1)
    pools=np.zeros((h,w),dtype=np.float32)
    for cx,cy,sx,sy,amp in [(.08,.28,.23,.43,-.27),(.84,.18,.28,.24,.20),
                             (.92,.80,.20,.34,-.24),(.42,.58,.47,.35,.11)]:
        pools+=amp*np.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2)*1.5)
    stain=np.clip(radial*.25+n*.50+pools,-.7,.7)
    base=np.array(palette,dtype=np.float32)
    rgb=np.empty((h,w,3),dtype=np.float32)
    for c,amp in enumerate([23,21,20]):
        rgb[:,:,c]=base[c]+stain*amp+n*12
    rgb-=np.exp(-edge/(strength*1.05+1))[:,:,None]*11
    if spine:rgb[:,:,0]+=np.exp(-((x-.07)/.05)**2)*4
    raw=Image.fromarray(np.dstack((np.uint8(np.clip(rgb,0,255)),alpha)),"RGBA")
    grain=Image.new("RGBA",(w,h),(0,0,0,0))
    drawer=ImageDraw.Draw(grain,"RGBA")
    for _ in range(int(w*h/(170 if button else 220))):
        a=int(rng.integers(strength+5,w-strength-6))
        b=int(rng.integers(strength+4,h-strength-5))
        if alpha[b,a]<200:continue
        width=int(rng.integers(2,9 if button else 19))
        drawer.line([(a,b),(a+width,b+int(rng.integers(-1,2)))],fill=(219,196,151,int(rng.integers(7,22))),width=1)
    raw=Image.alpha_composite(raw,grain)
    # Reuse the exact hand-illustrated sakura art already present in the town.
    # The imprint is translucent and noninteractive: the same painted language
    # as the game world, without introducing symmetrical graphic UI ornaments.
    if not button:
        sakura_path=ROOT/"assets"/"img"/"scenery"/"prop_sakura.webp"
        if sakura_path.exists():
            sakura=Image.open(sakura_path).convert("RGBA")
            target_w=int(w*(.29 if spine else .25))
            target_h=int(h*.48)
            sakura.thumbnail((target_w,target_h),Image.Resampling.LANCZOS)
            faded=sakura.getchannel("A").point(lambda v:int(v*.13))
            sakura.putalpha(faded)
            layer=Image.new("RGBA",(w,h))
            layer.alpha_composite(sakura,(w-sakura.width-strength*2,h-sakura.height-strength))
            raw=Image.alpha_composite(raw,layer)
    if not button:
        marks=Image.new("RGBA",(w,h))
        brush=ImageDraw.Draw(marks,"RGBA")
        for idx,(ox,oy,radius) in enumerate([(.12,.17,.105),(.89,.79,.075),(.92,.14,.035)]):
            cx,cy=ox*w,oy*h
            pts=[]
            for i in range(55):
                t=(.18+i/54*.87)*math.pi
                r=radius*w*(1+math.sin(i*.83+idx)*.017)
                pts.append((cx+math.cos(t)*r,cy+math.sin(t)*r*.67))
            brush.line(pts,fill=(174,147,115,13),width=max(1,int(h*.006)))
        raw=Image.alpha_composite(raw,marks.filter(ImageFilter.GaussianBlur(1.2)))
    if spine:
        marks=Image.new("RGBA",(w,h))
        drawer=ImageDraw.Draw(marks,"RGBA")
        ox=w*.07
        pts=[(int(ox+math.sin(v*.057)*1.8),v) for v in range(strength+18,h-strength-18,3)]
        drawer.line(pts,fill=(175,142,103,65),width=2)
        for i in range(8):
            py=int((i+.55)*h/8);a=int(ox)
            drawer.arc((a-8,py-3,a+5,py+5),0,180,fill=(183,150,112,65),width=2)
        raw=Image.alpha_composite(raw,marks)
    return raw

def save(name,w,h,seed,palette,strength,spine=False,button=False):
    dest=OUT/name
    img=paper(w,h,seed,palette,strength,spine=spine,button=button)
    img.save(dest,format="WEBP",quality=88,method=6)
    check=Image.open(dest)
    assert check.size==(w,h) and check.getchannel("A").getextrema()[0]==0
    print(dest.relative_to(ROOT),img.size,dest.stat().st_size//1024,"KiB")

if __name__=="__main__":
    save("ledger_washi.webp",1304,860,4873,(50,45,49),24,spine=True)
    save("notice_washi.webp",960,1350,5141,(47,43,45),30,spine=True)
    save("ofuda_neutral.webp",920,164,1371,(80,64,57),12,button=True)
    save("ofuda_vermilion.webp",920,164,1392,(114,66,58),12,button=True)
    save("ofuda_cyan.webp",920,164,1413,(66,80,77),12,button=True)
