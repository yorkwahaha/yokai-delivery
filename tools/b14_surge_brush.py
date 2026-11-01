"""B14 independent hand-painted '百鬼夜行' game sprite. No scene/background/flowers."""
from pathlib import Path
from PIL import Image,ImageFilter
import numpy as np, cv2, importlib.util, random, json
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('comfy_dispatch',root/'tools/comfy_dispatch.py')
comfy=importlib.util.module_from_spec(spec);spec.loader.exec_module(comfy)
out=root/'art/night-town/b14-comfy';out.mkdir(parents=True,exist_ok=True)
target=root/'assets/img/ui/b14';target.mkdir(parents=True,exist_ok=True)
prompt=(
"GAME ART SPRITE, single isolated horizontal Japanese sumi-e calligraphy warning brushstroke and integrated title. "
"Traditional East Asian fantasy ink wash, ONE long wide vigorous irregular smear of rough dry vermilion-red and deep wine-crimson pigment with extremely ragged frayed hand-brushed bristle ends, torn sides, energetic direction sweeping fast from RIGHT to LEFT. "
"Rich dramatic black-burgundy ink at the core, bright ochre and aged ivory pigment scratched through its bristles and a subtle warm burnt-orange edge, enough contrast to stay visible against textured light brown cobblestone. "
"On the SAME brush-painted stroke, FOUR LARGE GOLD-BEIGE HAND-BRUSHED TRADITIONAL CHINESE CHARACTERS precisely '百鬼夜行', exactly those four characters and nothing else, centered, in real dramatic old calligrapher's dry brush handwriting, scratchy ink grain, legible even very small. No standard computer font. "
"The entire banner is one continuous artistic stroke, NO framing, NO rectangular plaque, no border, NO flowers and NO petals, NO sakura and NO floral decorations, no extra glyphs, no other words, no background illustration, no game screenshot. "
"ISOLATED SPRITE: brush occupies middle 28 percent of image height and spans 88 percent of image width; surrounding plain uniformly near-white pale ivory #fffaf0 background with no shadows/no grain, for transparency extraction. "
"Painted precise clean 2D game overlay asset, wide horizontal composition, high-resolution professional Japanese Ukiyo-e game production art."
)
negative=(
"flowers, blossom, petals, sakura, roses, plants, leaves, floral ornaments, borders, geometric box, plaque, framed logo, rectangular banner, gold frame, UI panel, dark full background, village, path, people, Japanese streets, buildings, sky, stones, screenshot, poster, logo watermark, latin letters, other text, duplicated words, typo, digital typed text, modern glossy vector, multiple brush strips, extra arrows, multiple strokes with words, several banners, pink flowers, black rectangular backdrop"
)
paths,seed=comfy.run_ground_generation(prompt,negative,seed=random.randint(1000000,1000000000),prefix='Yokai_B14_surge_warning')
if not paths:raise RuntimeError('ComfyUI returned no images')
img=Image.open(paths[0]).convert('RGB')
img.save(out/'surge_source.png')
a=np.asarray(img).astype(np.float32)
h,w=a.shape[:2]
# Segment a single pigment field (including transparent-to-be scratchy drybrush).
# Ivory is near (255,250,240). Warm pale letter interiors are filled only inside the stroke.
border=np.concatenate([a[:max(8,h//20)].reshape(-1,3),a[-max(8,h//20):].reshape(-1,3)],axis=0)
bg=np.median(border,axis=0)
# Dark ink threshold relative to near-white paper, biased to ink reds.
r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
diff=(np.linalg.norm(a-bg,axis=2))
saturation=np.max(a,axis=2)-np.min(a,axis=2)
color=(((r>g*1.18)&(r>b*1.03)&(diff>46)) | ((np.min(a,axis=2)<139)&(diff>75)) | ((saturation>54)&(diff>62))).astype('uint8')
mask=cv2.morphologyEx(color,cv2.MORPH_CLOSE,np.ones((17,17),np.uint8))
n,lbl,stats,centers=cv2.connectedComponentsWithStats(mask,8)
if n<2: raise RuntimeError('No pigment object segmented: generator failed isolated sprite')
largest=max(range(1,n),key=lambda i:stats[i,cv2.CC_STAT_AREA])
main=(lbl==largest).astype('uint8')*255
# Fill text and drybrush negative gaps within the main gesture, but preserve
# ragged edges by using original object plus morphologically closed silhouette.
closed=cv2.morphologyEx(main,cv2.MORPH_CLOSE,np.ones((43,43),np.uint8))
contours,_=cv2.findContours(closed,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
silhouette=np.zeros_like(main)
cv2.drawContours(silhouette,contours,-1,255,-1)
dist=np.clip((diff-12)/63,0,1)
alpha=np.uint8(np.clip((silhouette/255)*np.maximum(dist,.86)*255,0,255))
alpha=cv2.GaussianBlur(alpha,(3,3),.6)
ys,xs=np.where(alpha>25)
if not len(xs):raise RuntimeError('Extracted alpha blank')
marginx=int(w*.03);marginy=int(h*.025)
x0,x1=max(0,int(xs.min())-marginx),min(w,int(xs.max())+marginx+1)
y0,y1=max(0,int(ys.min())-marginy),min(h,int(ys.max())+marginy+1)
rgba=np.uint8(np.dstack([a,alpha]))
crop=Image.fromarray(rgba,'RGBA').crop((x0,y0,x1,y1))
# No hard stretching! Crop, maintain original artwork geometry.
if crop.width/crop.height<2.1:
    print('WARNING: crop ratio atypical',round(crop.width/crop.height,2),crop.size,flush=True)
crop.thumbnail((1450,450),Image.Resampling.LANCZOS)
# Add transparent air to the left/right to preserve authentic brush lettering
# proportions instead of squashing the characters to a generic UI rectangle.
w,h=crop.size
sprite=Image.new('RGBA',(max(w,round(h*3.25)),h),(0,0,0,0))
sprite.alpha_composite(crop,((sprite.width-w)//2,0))
sprite.save(target/'surge_brush.webp','WEBP',quality=94,method=6)
sprite.save(out/'surge_transparency_qa.png')
crop=sprite
(target/'manifest.json').write_text(json.dumps({'status':'TRIAL_PENDING_USER_PLAYTEST','src':'B14 ComfyUI handwritten ink warning','source_raw':str(paths[0]),'asset':'surge_brush.webp','transparency':True,'flowers':False,'duration_sec':2.4,'slide':'right-in then left-out'},ensure_ascii=False,indent=2),encoding='utf8')
print('DONE',crop.size,'ratio',round(crop.width/crop.height,2),'bg',bg.tolist(), 'seed',seed,'sizebytes',(target/'surge_brush.webp').stat().st_size,flush=True)
