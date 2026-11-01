from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import importlib.util, json, random, shutil, time
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("comfy_dispatch",ROOT/"tools/comfy_dispatch.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
assets=ROOT/"assets/img/ui/b12";assets.mkdir(parents=True,exist_ok=True)
raw=ROOT/"art/night-town/b12-comfy";raw.mkdir(parents=True,exist_ok=True)
tasks=[
 ("surge","B12_handpainted_surge","Wide horizontal wooden ema warning banner, traditional Japanese ukiyo-e illustration with rough hand-inked outlines, asymmetrical old vermilion lacquer wood with carved wood grain, sumi ink brush texture, subtle gold foil flecks, tiny menacing spectral smoke and a few scattered red cherry petals at edges, very dark scarlet and aged burgundy with warm antique gold, natural painterly brush strokes. Crucially the CENTRAL 65 percent is clean and empty to add hand-lettered text later in postproduction. Original hand-illustrated background game UI asset, no typography, no characters, no words, no latin letters, no modern UI borders, no hard geometrical software outlines. One single wide rectangular wooden plaque with airy natural vignette, front view 2D, stretched broadly in frame, minimal noise, crisp art and professional video game asset."),
 ("passives","B12_sumi_accessories","ONE 3x3 contact sheet of exactly NINE equally sized distinct hand-painted Japanese Edo period fantasy accessories and talismans, each clearly separate in its own square with aged yellowish cream rice paper backgrounds. Clean strong individual silhouettes, no labels, no writing, no letters or numbers, organic black sumi-e ink brush edges, old woodblock print, warm sepia parchment with faded ochre pigment, restrained indigo, soot, faded vermillion, copper and brass accents, detailed but simple recognizable objects at tiny game UI icon size. Arrange left to right top row: protective amulet bronze mirror with a hexagonal ward; battle damage polished katana hilt on stand; attack rhythm small ritual hand bells. middle row: critical hit sharp eye-shaped gilded pendant; movement speed old straw sandals; dash swift windswept folded fan. bottom row: oil reserve antique ceramic oil flask; gem collection green carved magatama pendant; oil healing tiny medicine gourd. High resolution 3 by 3 precisely aligned square art atlas, each icon centered within its cell, clean illustrated game icons, no modern glossy plastic, no kawaii, no cartoons, no typography.")
]
for kind,prefix,prompt in tasks:
 try:
  paths,seed=m.run_ground_generation(prompt,
    "cute, kawaii, chibi, cartoon emoji, phone ui, flat digital vector, plastic, bevel button, neon, readable text, white title, lettering, grid borders connecting objects, blurry low resolution, watermark",
    seed=random.randint(1,999999999999),prefix=prefix)
  if not paths:print("EMPTY",kind,flush=True);continue
  src=Path(paths[0]);print("source",kind,str(src),src.exists(),flush=True)
  if not src.exists():continue
  im=Image.open(src).convert("RGB");im.save(raw/(kind+"_raw.png"))
  if kind=="surge":
    # crop center horizontal strip of hand-illustrated scenery, avoid scaling text
    w,h=im.size
    strip=im.crop((0,round(h*.20),w,round(h*.80))).resize((1250,350),Image.Resampling.LANCZOS)
    strip.save(assets/"surge_bg.webp","WEBP",quality=90,method=6)
  else:
    dim=min(im.size);side=dim//3
    ox=(im.width-side*3)//2;oy=(im.height-side*3)//2
    names=["shield","dmg","rate","crit","spd","dash","oil_max","mag","oil_heal"]
    for idx,name in enumerate(names):
      row,col=divmod(idx,3)
      rect=(ox+col*side+12,oy+row*side+12,ox+(col+1)*side-12,oy+(row+1)*side-12)
      piece=im.crop(rect).resize((384,384),Image.Resampling.LANCZOS)
      piece.save(assets/("passive_"+name+".webp"),"WEBP",quality=92,method=6)
  print("COMPLETE",kind,flush=True)
 except Exception as ex:
  print("ERROR",kind,type(ex).__name__,str(ex)[:450],flush=True)
