"""Independent HUD icon candidates using existing local ComfyUI, no paid API."""
import json, time, hashlib, sys
QWEN='--qwen' in sys.argv
SUFFIX='f9-qwen' if QWEN else 'f9-independent'
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/"art/skill-expansion-10-13"
API="http://127.0.0.1:8188"
def req(path,data=None):
    with urlopen(Request(API+path,json.dumps(data).encode() if data is not None else None,{"Content-Type":"application/json"}),timeout=15) as f:
        return f.read()
def node(kind,**inputs): return {"class_type":kind,"inputs":inputs}
common="single isolated hand-painted Japanese yokai action game inventory icon, traditional ukiyo-e sumi-e style, bold dark ink contour, warm ivory and vermilion details, readable silhouette at 96 pixels, centered whole object, large clear shape, flat uniform bright saturated green chroma key background, no green on object, generous empty margin, no text, no frame"
negative="letters, text, logo, border, character, person, hands, scenery, gradient background, green object, photorealistic, 3d render, multiple icons, collage, cropped, excessive tiny detail"
rows=[("hamaya",26112710,"one Japanese sacred asymmetric yumi bow of ivory and amber gold, diagonal single shining arrow crossing the bow, vermilion wrapping and tassel"),("spider-silk",26112711,"one distinct triangular web of thick white ivory silk threads attached to three vermilion knotted talismans, a sweeping loop of silk, bold dark indigo contour, no spider body")]
q=json.loads(req("/queue"))
if q["queue_running"] or q["queue_pending"]: raise RuntimeError("ComfyUI busy; not disturbing existing work")
out=[]
for key,seed,subject in rows:
    raw=ART/"raw"/f"{key}__{SUFFIX}.png"
    target=ART/"icons"/f"{key}__icon__{SUFFIX}.webp"
    if raw.exists() or target.exists(): raise FileExistsError(key)
    graph={"1":node("CheckpointLoaderSimple",ckpt_name="reedIllustrationIL_v80IL_s30c5e.safetensors"),"2":node("CLIPTextEncode",clip=["1",1],text=subject+", "+common),"3":node("CLIPTextEncode",clip=["1",1],text=negative),"4":node("EmptyLatentImage",width=768,height=768,batch_size=1),"5":node("KSampler",model=["1",0],positive=["2",0],negative=["3",0],latent_image=["4",0],seed=seed,steps=16,cfg=5.2,sampler_name="dpmpp_2m",scheduler="karras",denoise=1.0),"6":node("VAEDecode",samples=["5",0],vae=["1",2]),"7":node("SaveImage",images=["6",0],filename_prefix=f"yokai-f9/{key}-{seed}")}
    if QWEN:
        seed+=100
        prompt="A single game ability object only, no person. "+subject+". Clean, bold ink outlines and hand-painted bright colors, subtle paper texture ONLY within the object. Place it centrally, isolated on absolutely flat pure neon green (#00FF00) background. No parchment, no shadows on background, no words, no letters, no borders, no symbols except the object, no panel, no card, no page, no characters. The object fills 80 percent of the square. High contrast at tiny thumbnail size."
        graph={"1":node("UNETLoader",unet_name="qwen-image-2.1-UC-int8_convrot.safetensors",weight_dtype="default"),"2":node("CLIPLoader",clip_name="qwen3vl_8b_int8_convrot.safetensors",type="qwen_image",device="default"),"3":node("TextEncodeQwenImage21",clip=["2",0],prompt=prompt,negative_prompt=negative,resolution=768),"4":node("EmptyLatentImage",width=768,height=768,batch_size=1),"5":node("KSampler",model=["9",0],positive=["3",0],negative=["3",1],latent_image=["4",0],seed=seed,steps=20,cfg=1,sampler_name="euler",scheduler="simple",denoise=1.0),"6":node("VAEDecode",samples=["5",0],vae=["8",0]),"7":node("SaveImage",images=["6",0],filename_prefix=f"yokai-f9/{key}-{seed}"),"8":node("VAELoader",vae_name="qwen_image_2.1_vae_bf16.safetensors"),"9":node("QwenImage21Cache",model=["1",0],device="auto",dtype="default")}
    raw.with_suffix(".json").write_text(json.dumps(graph,indent=2),encoding="utf-8")
    pid=json.loads(req("/prompt",{"prompt":graph,"client_id":"yokai-f9-independent"}))["prompt_id"]
    print(key,pid,flush=True)
    until=time.monotonic()+150
    while time.monotonic()<until:
        hist=json.loads(req("/history/"+pid)).get(pid)
        if hist:
            images=hist.get("outputs",{}).get("7",{}).get("images",[])
            if not images: raise RuntimeError(hist.get("status"))
            raw.write_bytes(req("/view?"+urlencode(images[0])))
            break
        time.sleep(2)
    else: raise TimeoutError(pid)
    im=Image.open(raw).convert("RGBA")
    px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            excess=g-max(r,b)
            if excess>20 and g>70:
                a=round(255*max(0,min(1,(95-excess)/75)))
                px[x,y]=(r,min(g,max(r,b)+8),b,a)
    bbox=im.getbbox()
    if not bbox: raise ValueError("empty alpha")
    im=im.crop(bbox)
    im.thumbnail((86,86),Image.Resampling.LANCZOS)
    canvas=Image.new("RGBA",(96,96))
    canvas.paste(im,((96-im.width)//2,(96-im.height)//2))
    canvas.save(target,"WEBP",lossless=True,quality=100,exact=True)
    out.append({"key":key,"path":str(target.relative_to(ROOT)),"raw":str(raw.relative_to(ROOT)),"seed":seed,"sha256":hashlib.sha256(target.read_bytes()).hexdigest(),"alpha_bounds":canvas.getbbox()})
    print(out[-1],flush=True)
print(json.dumps(out),flush=True)
