from PIL import Image,ImageDraw,ImageFilter,ImageOps
from pathlib import Path
import random,math
random.seed(3191919)
OUT=Path('assets/img/vfx/boss-night-town');OUT.mkdir(parents=True,exist_ok=True)
W=1024
boss=Image.open('assets/img/yokai/boss.webp').convert('RGBA')
for kind in ('slam','charge','ring'):
  img=Image.new('RGBA',(W,W))
  glow=Image.new('RGBA',(W,W));g=ImageDraw.Draw(glow,'RGBA')
  ink=Image.new('RGBA',(W,W));d=ImageDraw.Draw(ink,'RGBA')
  c=(510,500)
  purple=(160,62,191);red=(243,97,130);gold=(250,184,128)
  if kind=='slam':
    # jagged eruption spreading from the boss' seal, with skull-like visage.
    for i in range(23):
      a=i*math.tau/23+random.uniform(-.12,.12)
      rr=random.randrange(240,435);inner=random.randrange(35,75)
      p=[(c[0]+math.cos(a)*inner,c[1]+math.sin(a)*inner),
         (c[0]+math.cos(a-.06)*rr,c[1]+math.sin(a-.06)*rr*.73),
         (c[0]+math.cos(a+.12)*(rr+85),c[1]+math.sin(a+.12)*(rr+85)*.73),
         (c[0]+math.cos(a+.17)*inner,c[1]+math.sin(a+.17)*inner)]
      d.polygon(p, fill=(random.randrange(20,66),11,47,random.randrange(135,210)),
                 outline=(*red,random.randrange(135,220)),width=7)
      g.line([p[0],p[2]],fill=(*purple,random.randrange(80,180)),width=random.randrange(20,35))
    for rad in [180,277,363]:
      d.arc((c[0]-rad,c[1]-rad*.74,c[0]+rad,c[1]+rad*.74),
            8,350,fill=(*gold,random.randrange(100,205)),width=random.randrange(6,15))
    portrait=ImageOps.contain(boss,(250,335),method=Image.Resampling.LANCZOS)
    portrait.putalpha(portrait.getchannel('A').point(lambda a:int(a*.42)))
    img.alpha_composite(portrait,(W//2-portrait.width//2,315))
  elif kind=='charge':
    # Diagonal purple oni-fang shockwave image, intentionally asymmetrical.
    for j in range(19):
      ofs=(j-9)*17
      start=(110,790+ofs)
      end=(930,130+ofs+random.randrange(-120,120))
      g.line([start,end],fill=(*purple,random.randrange(80,175)),width=random.randrange(26,75))
      d.line([start,end],fill=(random.randrange(35,80),12,70,random.randrange(110,235)),width=random.randrange(7,27))
    d.polygon([(200,805),(760,110),(635,540),(870,270),(365,910)],fill=(56,9,60,210),outline=(*red,238),width=15)
    d.line([(210,800),(795,125)],fill=(255,219,214,238),width=8)
    # stylized demonic serrated ivory teeth within the slash
    for i in range(11):
      x=320+i*42;y=730-i*51
      d.polygon([(x,y),(x+27,y+5),(x+8,y-65)],fill=(*gold,random.randrange(135,230)))
  else:
    # Dedicated fractured oni curse annulus with deliberate 70 degree escape gap at top.
    r=325
    for radius,width,alpha in [(365,38,124),(318,66,183),(295,7,235)]:
      d.arc((c[0]-radius,c[1]-radius*.83,c[0]+radius,c[1]+radius*.83),
          123,417,fill=(*purple,alpha),width=width)
      g.arc((c[0]-radius,c[1]-radius*.83,c[0]+radius,c[1]+radius*.83),
          123,417,fill=(*red,120),width=width+30)
    for i in range(15):
      a=math.radians(124+i*19.5)
      x=c[0]+math.cos(a)*318;y=c[1]+math.sin(a)*260
      d.polygon([(x,y-49),(x+23,y+15),(x,y+42),(x-23,y+16)],
                fill=(63,19,66,215),outline=(*gold,218),width=5)
      d.line([(x-8,y-7),(x+8,y+11)],fill=(245,182,219,250),width=4)
  # Ink splatter and brush flecks, shaped by kind rather than identical radial ornaments.
  for i in range(130):
    if kind=='ring':
      a=random.uniform(2.0,7.25);r=random.randrange(265,430)
      x=c[0]+math.cos(a)*r;y=c[1]+math.sin(a)*r*.84
    else:
      x=random.randint(120,905);y=random.randint(95,930)
    rad=random.randrange(1,10)
    d.ellipse((x-rad,y-rad,x+rad,y+rad),fill=(*random.choice([purple,red,gold]),random.randrange(70,205)))
  img=Image.alpha_composite(img,glow.filter(ImageFilter.GaussianBlur(19)))
  img=Image.alpha_composite(img,ink)
  img.save(OUT/(kind+'.webp'),'WEBP',quality=91,method=6)
print('boss art:',[(p.name,p.stat().st_size) for p in OUT.glob('*.webp')])
