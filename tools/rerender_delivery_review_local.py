#!/usr/bin/env python3
"""Repaint only selected reviewed items using original local Qwen Image 2.1 workflow."""
import argparse, io, json, subprocess, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import binary_propagation, gaussian_filter
ROOT=Path(__file__).resolve().parent.parent
WF=Path(r"e:\Downloads\image_qwen_image_2_1_t2i.json")
HOST="http://127.0.0.1:8188"
TARGET={
  "night-town": [
    ("しんぶん","one folded old-fashioned newspaper with newsprint columns, no readable print, folded into a tidy rectangular bundle"),
    ("えんぴつ","one simple yellow-ochre wooden graphite pencil with sharpened dark graphite point"),
    ("けしゴム","one small rectangular white rubber pencil eraser, simple paper sleeve without any writing"),
    ("じょうぎ","one long straight pale wooden ruler, tiny black distance tick marks, no numbers"),
    ("かみ","one plain white sheet of folded writing paper, gently curling corners, absolutely blank"),
    ("はブラシ","one red-handled modern toothbrush with clean white bristles, side view"),
    ("せっけん","one oval ivory bar of soap, matte dry finish, rounded edges"),
  ],
  "rain-port": [
    ("さかな","one ordinary small silvery coastal fish, moderately deep oval body, simple grey blue scales, small fins"),
    ("さけ","one salmon fish, long muscular tapering body, pale silver-blue skin, noticeable sparse dark spots along the upper body, blush coral belly"),
    ("まぐろ","one large bluefin tuna, very thick streamlined torpedo-shaped blue body, broad head, deeply forked crescent tail, tiny yellow finlets near tail"),
    ("さば","one slender Atlantic mackerel, silver belly, distinct jagged dark navy tiger stripes across green-blue back, small pointed tail"),
    ("たい","one Japanese red sea bream, unmistakably deep tall round reddish-pink body, tall prickly dorsal fin and short fan tail"),
    ("いか","one whole squid, white elongated tapered mantle, broad triangular fins and thin trailing tentacles, not an octopus"),
    ("かい","two distinct natural shellfish: one open clam with pearly inner shell plus one closed ribbed fan scallop shell"),
    ("すし","three recognizable Japanese nigiri sushi pieces on a small plain wood board: tuna, salmon, tamago; rice bases clearly visible"),
    ("さしみ","a small Japanese sashimi serving of four raw fish slices fanned out, deep red tuna and orange salmon, green shiso leaf"),
    ("やきざかな","one whole grilled mackerel on a simple ceramic oval plate, lightly browned crispy charcoal grill marks, small slice of lemon"),
    ("おにぎり","one simple triangular white Japanese rice ball with a black nori seaweed rectangle and little red pickled plum"),
    ("てんぷら","a modest two-piece tempura assortment: one golden battered shrimp with red tail and one battered sweet potato slice"),
  ]
}
def fetch(route, data=None):
    req=urllib.request.Request(HOST+route,data=data,headers={"Content-Type":"application/json"} if data is not None else {})
    return urllib.request.urlopen(req,timeout=35).read()
def generate(stage,steps=18,timeout=780):
    stages=json.loads(subprocess.check_output(["node","-e","require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages));"],cwd=ROOT,text=True))
    catalog=next(x for x in stages if x["id"]==stage)
    wanted=TARGET[stage];cols,rows=(4,2) if stage=="night-town" else (4,3)
    order="; ".join(f"row {i//cols+1} column {i%cols+1}: {desc}" for i,(_,desc) in enumerate(wanted))
    if stage=="night-town":order+="; row 2 column 4: completely empty"
    prompt=(
      "One meticulously composed art sheet of "+str(len(wanted))+" distinct hand-painted MINIATURE ITEM ICONS on a solid uniform ivory white background. "
      +f"Exactly {cols} COLUMNS and {rows} ROWS on an invisible evenly spaced grid, objects in their own cells, with clear margins. "
      +"Each slot contains exactly the specified object and no other object; no accessory splashes. "
      +"Subject order: "+order+". "
      +"VERY IMPORTANT ORIGINAL MATCHED GAME STYLE: traditional gentle Japanese ukiyo-e woodblock print and restrained sumi-e ink wash, "
      +"soft subtle washi-paper grain, softly uneven watercolor pigments, elegant thin hand-drawn dark organic ink contours, "
      +"muted natural tones of indigo, grey, umber and soft vermilion; carefully outlined real-life silhouettes, "
      +"quiet antique Japanese item illustration in the same naturalistic art style as a Japanese watercolor picture dictionary. "
      +"Simple three-quarter perspective or neutral side view, consistent scale; entire silhouettes visible. "
      +"Absolutely NO text, NO Japanese glyphs, NO kanji, NO hiragana, NO katakana, NO roman letters, "
      +"NO titles or subtitles under objects, NO captions or numbered labels. No text on packaging. "
      +"No drawn grid, frame, magic, effects, glowing aura or dramatic waves. "
      +"No scenery, characters, photorealism or cartoon vector style. Square composition."
    )
    wf=json.loads(WF.read_text(encoding="utf-8"))
    wf["459:474"]["inputs"]["switch"]=False
    wf["459:474"]["inputs"]["on_false"]=prompt
    wf["459:452"]["inputs"]["negative_prompt"]="words, writing, text, Japanese labels, reading, furigana, romanization, captions, titles, list, numbers, typography, diagrams, grid, border, frame, halo, magical swirl, dramatic sea waves, graphic sticker design, photorealistic, 3D CGI, glossy plastic, emoji"
    seed=20261029+["night-town","rain-port"].index(stage)*1087+9117
    wf["459:458"]["inputs"]["seed"]=seed;wf["459:458"]["inputs"]["steps"]=steps
    wf["461"]["inputs"]["filename_prefix"]="YokaiDelivery/"+stage+"/delivery_redraw_qwen_v2"
    result=json.loads(fetch("/prompt",json.dumps({"prompt":wf,"client_id":"yokai-delivery-qwen-v2"}).encode("utf-8")))
    pid=result["prompt_id"];print("ComfyUI Qwen Image2.1 SUBMITTED",stage,pid,flush=True)
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        try:history=json.loads(fetch("/history/"+pid))
        except Exception:time.sleep(5);continue
        if pid in history:break
        time.sleep(4)
    else:raise RuntimeError("Qwen timed out for "+stage)
    done=history[pid]
    if done.get("status",{}).get("status_str")=="error":raise RuntimeError(str(done.get("status")))
    pictures=[im for node in done.get("outputs",{}).values() for im in node.get("images",[])]
    if not pictures:raise RuntimeError("No image output for "+stage)
    pic=pictures[0]
    route="/view?"+urllib.parse.urlencode({"filename":pic["filename"],"subfolder":pic.get("subfolder",""),"type":pic.get("type","output")})
    sheet=Image.open(io.BytesIO(fetch(route))).convert("RGB")
    dest=ROOT/"art"/"delivery-icons"/stage/"rerender-qwen-v2"
    dest.mkdir(parents=True,exist_ok=True)
    sheet.save(dest/"new_sheet_original.png")
    return dest,sheet,cols,rows,catalog,wanted,seed,pid
def clean_icon(tile):
    img=np.asarray(tile.convert("RGB"),dtype=np.uint8);vals=img.astype(np.int16)
    bright=np.min(vals,axis=2)>218
    near_bg=bright&((np.max(vals,axis=2)-np.min(vals,axis=2))<64)
    seeds=np.zeros(near_bg.shape,dtype=bool)
    seeds[0,:]=near_bg[0,:];seeds[-1,:]=near_bg[-1,:];seeds[:,0]=near_bg[:,0];seeds[:,-1]=near_bg[:,-1]
    bg=binary_propagation(seeds,mask=near_bg)
    alpha=gaussian_filter((~bg).astype(float),0.65)*255
    rgba=Image.fromarray(np.concatenate([img,np.clip(alpha,0,255).astype(np.uint8)[:,:,None]],axis=2),"RGBA")
    bbox=rgba.getbbox()
    if not bbox:return Image.new("RGBA",(256,256))
    rgba=rgba.crop(bbox);rgba.thumbnail((235,235),Image.Resampling.LANCZOS)
    out=Image.new("RGBA",(256,256));out.alpha_composite(rgba,((256-rgba.width)//2,(256-rgba.height)//2))
    return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--stage",choices=TARGET,required=True);ap.add_argument("--steps",type=int,default=18);args=ap.parse_args()
    d,im,cols,rows,catalog,wanted,seed,pid=generate(args.stage,args.steps)
    W,H=im.size
    for i,(jp,desc) in enumerate(wanted):
        x,y=i%cols,i//cols
        tile=im.crop((round(W*x/cols),round(H*y/rows),round(W*(x+1)/cols),round(H*(y+1)/rows)))
        index=next(z for z,w in enumerate(catalog["words"]) if w["jp"]==jp)
        icon=clean_icon(tile)
        icon.save(d/(f"{index+1:02d}_{jp}_candidate.webp"),"WEBP",quality=91,method=6)
    (d/"manifest.json").write_text(json.dumps({"status":"QWEN_V2_REVIEW_UNAPPROVED","stage":args.stage,"model":"local ComfyUI Qwen Image 2.1","original_workflow":str(WF),"steps":args.steps,"seed":seed,"prompt_id":pid,"redrawn_words":[w for w,_ in wanted],"prior_candidates_untouched":True},ensure_ascii=False,indent=2),encoding="utf8")
    print("SAVED",args.stage,len(wanted),"only selected",d,flush=True)
if __name__=="__main__":main()
