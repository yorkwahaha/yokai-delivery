#!/usr/bin/env python3
"""Generate seven Stage3 icon revisions locally with the ORIGINAL Qwen2.1 style.

Six new words + replacement for uchiwa, preserving all earlier originals.
No paid API or production writes; results remain review candidates in art/.
"""
from __future__ import annotations
import hashlib, io, json, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image
from generate_delivery_icons_local import (ROOT, WF, HOST, build_original_prompt,
                                           ORIGINAL_NEGATIVE_PROMPT)
from rerender_delivery_original_style_v3 import alpha_matte

OUT = ROOT / "art/delivery-icons/sakura-pass/rewritten-20261116"
ITEMS = {
  "き": ("whole deciduous TREE with a single stout trunk, full rounded leafy crown, exposed roots and many small green leaves, complete standalone tree, not a branch, not a bonsai tree in a pot", "木"),
  "かえる": ("one clearly recognizable green FROG amphibian with wide eyes, large bent hind legs and webbed toes, viewed three-quarters, natural creature not a frog person, no lily pad, no scenery", "青蛙"),
  "あり": ("ONE enlarged BLACK ANT insect, unmistakable three-segment body with pinched waist and exactly six legs, two curved feelers, ant anatomy seen three-quarters, not a spider, no colony, no scenery", "螞蟻"),
  "ほうき": ("ONE Japanese traditional straw BROOM for sweeping stone paths, tied golden straw bristles at the bottom and a long straight natural wooden handle above, complete full silhouette, not a brush or branch", "掃帚"),
  "ふえ": ("ONE short traditional Japanese bamboo transverse FLUTE, shinobue, placed diagonally, exactly several dark finger holes clearly visible, pale bamboo with subtle binding near its ends, musical instrument not a twig", "笛子"),
  "くすり": ("one traditional Japanese paper medicine packet with a small open folded paper sachet and two visible round pills beside it, unmistakable MEDICINE, no lettering, no medical cross, no logos", "藥"),
  "うちわ": ("one authentic Japanese UCHIWA fan with FULL ROUND OVAL paddle shape, a rigid solid unpleated circular ivory washi fan face on one short straight bamboo handle, painted cherry blossom twig on circular face, thin bamboo frame, NOT folding fan, NOT semicircular sensu, NOT wedge, NOT pleated, NO opening ribs", "團扇"),
}
def call(route, data=None):
    req=urllib.request.Request(HOST+route,data=data,headers={"Content-Type":"application/json"} if data is not None else {})
    with urllib.request.urlopen(req,timeout=45) as response:return response.read()

def prompt_for(word, description):
    dummy={"words":[{"zh":"傳統物品","jp":"き"}]}
    full=build_original_prompt(dummy)
    art=full.split("Art direction: ",1)[1]
    art=art.replace("every object fully within its own allotted 1/5 x 1/4 cell with ample whitespace.",
                    "entire object fully inside one central square frame with generous empty background margins.")
    return ("A precise ONE-OBJECT collectible miniature illustration for a Japanese historical fantasy video game. "
            "ONE CENTERED isolated real-life object, clear distinctive silhouette, no second inventory item. "
            f"Subject: {description}. "
            "Art direction: "+art)

def run():
    if not WF.is_file():raise FileNotFoundError(WF)
    if not OUT.exists():OUT.mkdir(parents=True)
    for n,(word,(description,label)) in enumerate(ITEMS.items(),1):
        filename=OUT/f"{word}_candidate.webp"
        if filename.is_file():
            with Image.open(filename) as im:
                assert im.size==(256,256) and im.mode=="RGBA" and im.getchannel('A').getbbox(),filename
            print("CACHED",n,word,flush=True)
            continue
        wf=json.loads(WF.read_text(encoding='utf8'))
        prompt=prompt_for(word,description)
        # Original BF16 base was removed locally; use the installed FP8
        # Qwen Image 2.1 base (not an unrelated style/model).
        wf["459:451"]["inputs"]["unet_name"]="qwen-image-2.1-step90000-FP8-comfy.safetensors"
        wf["459:474"]["inputs"]["switch"]=False
        wf["459:474"]["inputs"]["on_false"]=prompt
        negative=ORIGINAL_NEGATIVE_PROMPT
        if word=="うちわ":negative+=", folding pleated fan, sensu fan, semi-circle, fan spokes spreading radially from hinge, accordion fan"
        if word=="ふえ":negative+=", recorder mouthpiece, beak-shaped whistle, plastic recorder, extra musical instruments"
        if word=="くすり":negative+=", red cross, medical cross, first-aid kit, pharmacy logo, modern blister packs, modern medicine boxes"
        wf["459:452"]["inputs"]["negative_prompt"]=negative
        seed=20261116+n*1019
        wf["459:458"]["inputs"]["seed"]=seed
        wf["459:458"]["inputs"]["steps"]=22
        # The previous preview-only API workflow can end successfully without
        # evaluating the actual image graph. Force a standard image output node.
        wf.pop("459:472",None)
        wf["459:452"]["inputs"]["prompt"]=prompt
        wf["461"]={"class_type":"SaveImage","inputs":{
            "filename_prefix":"YokaiDelivery/sakura-pass/final-words-20261116/"+word,
            "images":["459:457",0]}}
        response=json.loads(call('/prompt',json.dumps({'prompt':wf,'client_id':'yokai-delivery-sakura-icon-revisions'},ensure_ascii=False).encode('utf8')))
        pid=response["prompt_id"];print("SUBMITTED",n,word,pid,flush=True)
        deadline=time.monotonic()+900
        while time.monotonic()<deadline:
            hist=json.loads(call('/history/'+pid))
            if pid in hist:break
            time.sleep(4)
        else:raise TimeoutError(pid)
        result=hist[pid]
        if result.get('status',{}).get('status_str')=='error':raise RuntimeError(str(result.get('status')))
        outputs=[item for node in result.get('outputs',{}).values() for item in node.get('images',[])]
        if not outputs:raise RuntimeError('No images for '+word)
        first=outputs[0]
        query=urllib.parse.urlencode({'filename':first['filename'],'subfolder':first.get('subfolder',''),'type':first.get('type','output')})
        raw=Image.open(io.BytesIO(call('/view?'+query))).convert('RGB')
        raw.save(OUT/f"{word}_source.png")
        icon=alpha_matte(raw)
        assert icon.mode=='RGBA' and icon.size==(256,256)
        rect=icon.getchannel('A').getbbox()
        if not rect or rect[0]<3 or rect[1]<3 or rect[2]>253 or rect[3]>253:
            raise RuntimeError('Invalid alpha border '+word+str(rect))
        icon.save(filename,'WEBP',quality=94,method=6)
        (OUT/f"{word}_metadata.json").write_text(json.dumps({
            'status':'ART_CANDIDATE_USER_REVIEW_PENDING','stage':'sakura-pass',
            'word':word,'zh':label,'model':'Qwen Image 2.1 local ComfyUI',
            'workflow':str(WF),'seed':seed,'steps':22,'prompt_id':pid,
            'prompt':prompt,'negative_prompt':negative,'alpha_method':'original v3 matte',
            'filename':filename.name,'source':f"{word}_source.png",
            'sha256':hashlib.sha256(filename.read_bytes()).hexdigest(),
            'user_approval':False
        },ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        print("SAVED",n,word,rect,filename,flush=True)
    for word in ITEMS:
        assert (OUT/f"{word}_candidate.webp").is_file(),word
    # Visual contact sheet for the user's manual review.
    w,h=256,256
    sheet=Image.new('RGBA',(4*w,2*h),(241,233,215,255))
    for i,word in enumerate(ITEMS):
        with Image.open(OUT/f"{word}_candidate.webp") as img:
            sheet.alpha_composite(img.convert('RGBA'),((i%4)*w,(i//4)*h))
    sheet.convert('RGB').save(OUT/'contact_sheet.png')
    print("COMPLETE",len(ITEMS),"ICON CANDIDATES",OUT,flush=True)

if __name__=='__main__':run()
