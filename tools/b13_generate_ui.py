from pathlib import Path
from PIL import Image,ImageEnhance,ImageDraw
import importlib.util,random
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("comfy_dispatch",ROOT/"tools/comfy_dispatch.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
out=ROOT/"assets/img/ui/b13"
out.mkdir(parents=True,exist_ok=True)
source=ROOT/"art/night-town/b13-comfy"
source.mkdir(parents=True,exist_ok=True)
STYLE="Premium genuinely hand-painted Edo Japan yokai fantasy game UI prop art. Warm cream aged rice paper, antique indigo ink, restrained matte gold leaf, cherry blossom and deep vermilion lacquer, hand-painted decorative edges with brush grain. Museum-quality watercolor and traditional woodblock print, credible 2.5D Japanese fantasy game visual language. NO modern digital rectangles or obvious vector graphic UI."
jobs=[
 ("board","A completely NEW single refined ornate ancient Japanese hanging manuscript board without any text or buttons. Rectangular wide wooden plaque with organically distressed thin lacquered wood border and delicate tiny gold sakura and cloud-ink corner ornaments. Center is a generous wide continuous clean aged ivory washi parchment WITHOUT gray overlays, no gray rectangle, no shape on top. Sumi-e cherry branch far top-left; traditional pale blue-grey distant hills along bottom right but leave 75 percent of center free for menu elements. Straight on flat frontal view, centered in frame, exact balanced symmetrical outline, richly painted, no text, no words, no labels, no buttons. "+STYLE),
 ("button","ONE SINGLE traditional Japanese carved hanging button blank plaque of finely brushed warm ivory aged wood with elegant subtle gold corners, tiny hand-painted sakura and cloud wisps, tied red silk knot on one side, modest matte varnish, centered horizontally and flat front view, clean light beige center completely EMPTY to add live button labels later. One large wide horizontal plate filling frame, its shape is wide and shallow with ornamental taper at tips, dark brown woodgrain and authentic ink-brush detail, transparent-looking plain backdrop outside plate. No typography, no text, no letters, no symbols. "+STYLE),
 ("surge","One single Japanese hand-painted rectangular warning ema wooden plaque with very dark maroon weathered wood and deeply integrated old gold calligraphy written in traditional Chinese characters EXACTLY '百鬼夜行' (FOUR characters) centered. Each of the four characters large and painted with organic calligrapher's gold ink brush, same paint and wear as background wood, hand-applied gold pigment rubbed into antique vermilion lacquer. No separate digital font, absolutely no typed modern text. Fine torn gold foil and delicate eerie dark purple flame and wisps to the edges only. Clear and legible FOUR Chinese characters '百鬼夜行' exactly, no other text. Centered full plaque, frontal view, composition very wide horizontal. "+STYLE)
]
for name,prompt in jobs:
 try:
  paths,seed=m.run_ground_generation(prompt,
    "modern flat vector UI, large black box, grey overlay, blue glass window, western shield, pixels, screenshots, phone, photos, neon software borders, extra letters, English words, 3D rounded buttons, blurry, clipart, watermark, logo",
    seed=random.randint(100000,999999999),prefix="B13_"+name)
  if not paths:print("EMPTY",name,flush=True);continue
  im=Image.open(paths[0]).convert("RGB")
  im.save(source/(name+"_raw.png"))
  w,h=im.size
  if name=="board":
   im=im.crop((int(w*.04),int(h*.07),int(w*.96),int(h*.93))).resize((1200,800),Image.Resampling.LANCZOS)
   im.save(out/"menu_board.webp","WEBP",quality=94,method=6)
  elif name=="button":
   im=im.crop((int(w*.04),int(h*.30),int(w*.96),int(h*.71))).resize((1100,290),Image.Resampling.LANCZOS)
   im.save(out/"menu_button.webp","WEBP",quality=93,method=6)
   # The danger button uses the SAME handmade plaque, tinted with a restrained
   # vermilion glaze so its texture and ornamental edges remain identical.
   image=im.convert("RGB")
   r,g,b=image.split()
   from PIL import ImageChops
   glaze=Image.new("RGB",image.size,(140,52,44))
   tinted=Image.blend(image,glaze,.46)
   tinted.save(out/"menu_button_danger.webp","WEBP",quality=94,method=6)
  else:
   im=im.crop((int(w*.035),int(h*.3),int(w*.965),int(h*.72))).resize((1200,330),Image.Resampling.LANCZOS)
   im.save(out/"surge_warning.webp","WEBP",quality=94,method=6)
  print("DONE",name,"source",paths[0],"dims",(w,h),flush=True)
 except Exception as e:
  print("ERROR",name,type(e).__name__,str(e)[:400],flush=True)
