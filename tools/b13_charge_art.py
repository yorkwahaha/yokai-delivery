from pathlib import Path
from PIL import Image,ImageFilter
import importlib.util,random
import numpy as np,cv2
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("comfy_dispatch",ROOT/"tools/comfy_dispatch.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
out=ROOT/"art/night-town/b13-comfy"
out.mkdir(parents=True,exist_ok=True)
prompt=("ONE and ONLY ONE single horizontal long straight attack-warning trail, a long narrow hand-painted Japanese yokai ink-brush magical dash lane. Flat overhead view, perspective-neutral, oriented perfectly HORIZONTALLY from LEFT to RIGHT with NO angle or tilt at all. A SINGLE uninterrupted straight horizontal band, left edge x=5 percent and right edge x=95 percent, occupying about 25 percent of vertical canvas height, centered at y=50 percent. Interior is deep dark indigo-violet with handmade Japanese sumi-e brush graining. Its outer two long edges are organic dark-magenta and pink ink flame strokes: no sharp rectangular border. Along the center of the ONE band three subtle large forward-facing brushed golden arrowhead markings that point RIGHT, drawn as natural aged-gold ink on the same lane surface. Clear start and finish ends, no second band, no overlapping band, no crossed direction lines, no polygon triangles, no digital geometry, no neon vector drawings. Every shape is already integrated into the single painted texture. Rest of canvas OUTSIDE the band is PERFECT UNIFORM PALE IVORY background so it can be extracted into transparency. A clean truly painted 2D game VFX asset; traditional Ukiyo-e watercolor quality; no characters, no text, no screen UI.")
paths,seed=m.run_ground_generation(prompt,
  "two lanes, triple lanes, parallel stripes, diagonal path, skewed path, multiple ribbons, double borders, chevrons outside the band, big hand drawn cross lines, arrows outside, rectangle outline, pink transparent overlay, typography, Japanese words, game screen, yokai monster, character, roads, buildings, horizon, trees, scenery",
  seed=random.randint(1000000,900000000),prefix="B13_charge_clean_single")
if not paths:raise RuntimeError("No ComfyUI output")
raw=Image.open(paths[0]).convert("RGB");raw.save(out/"charge_clean_raw.png")
a=np.array(raw).astype(np.float32)
# Background from source is pure ivory. Extract dark-violet and magenta ink
# irrespective of paper brightness; matte antialiasing is feathered.
r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
dark=np.minimum.reduce((r,g,b))<150
purple=(b>g*1.14)&(r>g*1.09)
sat=(np.maximum.reduce((r,g,b))-np.minimum.reduce((r,g,b)))>42
score=np.uint8((dark|purple)&(sat|(r<135)))
kernel=np.ones((9,9),np.uint8)
score=cv2.morphologyEx(score,cv2.MORPH_CLOSE,kernel,iterations=2)
count,components,stats,centroids=cv2.connectedComponentsWithStats(score,8)
if count>1:
 idx=max(range(1,count),key=lambda i:stats[i,cv2.CC_STAT_AREA])
 # broad brush may be feathered; dilate a single unified ink region.
 mask=np.uint8(components==idx)*255
else:mask=score*255
mask=cv2.dilate(mask,np.ones((13,13),np.uint8),iterations=1)
mask=cv2.GaussianBlur(mask,(11,11),2.8)
ys,xs=np.where(mask>30)
if len(xs)<100:raise RuntimeError("No clear violet lane found")
x0,x1=max(0,int(xs.min())-8),min(raw.width,int(xs.max())+9)
y0,y1=max(0,int(ys.min())-8),min(raw.height,int(ys.max())+9)
crop=raw.crop((x0,y0,x1,y1));al=Image.fromarray(mask).crop((x0,y0,x1,y1))
# Keep actual painted proportions rather than stretching to the corridor.
# On screen a stable UV crop is used with the 2.5D collision geometry.
if crop.width/crop.height<2.2:
 # Make transparent margins; allow only moderate uniform scale.
 print('WARNING: generated lane not sufficiently horizontal:',crop.size,flush=True)
target=Image.new("RGBA",crop.size,(0,0,0,0));target.paste(crop,(0,0));target.putalpha(al)
target.thumbnail((1200,400),Image.Resampling.LANCZOS)
target.save(out/"charge_single_clean.webp","WEBP",quality=94,method=6)
print('B13 charge generated',paths[0], 'source',raw.size,'crop',crop.size,'output',target.size,'ratio',round(target.width/target.height,3),flush=True)
