#!/usr/bin/env python3
"""Repaint user-selected icon candidates using the EXACT first batch art style.

Imports the original prompt factory and negative prompt. Keeps the original
20-cell 5x4 composition, Qwen 2.1 ComfyUI workflow and steps. Only subject
descriptions can be extended (fish shape differentiation). Never overwrite v1/v2.
"""
import argparse, hashlib, io, json, subprocess, time, urllib.parse, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_propagation, gaussian_filter
from generate_delivery_icons_local import build_original_prompt, ORIGINAL_NEGATIVE_PROMPT, WF, ROOT, HOST
SELECTED = {
  'night-town': ['しんぶん','えんぴつ','けしゴム','じょうぎ','かみ','はブラシ','せっけん'],
  'rain-port': ['さかな','さけ','まぐろ','さば','たい','いか','かい','すし','さしみ','やきざかな','おにぎり','てんぷら'],
}
# Additional item specificity only. Never rewrite the style, grid, or quality section.
FISH = {
  'さかな': 'generic small silver coastal fish with modest rounded body and small tail, not salmon or tuna',
  'さけ': 'salmon: long muscular torpedo body, silver-blue spotted back, salmon pink blush at belly',
  'まぐろ': 'bluefin tuna: massive thick streamlined body, dark indigo back, short yellow finlets and deeply forked tail',
  'さば': 'mackerel: very slim elongated body and distinctive dark zigzag tiger stripes along blue-green back',
  'たい': 'red sea bream: deep tall round scarlet-red body and tall pointy spiny dorsal fin',
  'いか': 'squid: pale elongated tubular mantle with triangular fins and multiple fine flowing tentacles, not octopus',
  'かい': 'clam and fan shaped scallop shells, one slightly open revealing inside, different from oyster',
  'すし': 'several sushi nigiri on wooden serving board showing rice bases and fish topping, not raw sashimi platter',
  'さしみ': 'thin sliced raw red tuna and orange salmon elegantly fanned on a ceramic plate, no rice',
  'やきざかな': 'one fully cooked whole grilled fish on ceramic plate with golden brown blistered skin',
  'おにぎり': 'triangular white rice ball with dark nori band and a dab of red umeboshi, no sushi',
  'てんぷら': 'one deep-fried battered shrimp with orange tail and fried vegetables, not sushi or grilled fish'
}
def http(route,data=None):
    req=urllib.request.Request(HOST+route,data=data,headers={'Content-Type':'application/json'} if data is not None else {})
    return urllib.request.urlopen(req,timeout=35).read()
def lexicon():
    expression="require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages))"
    return json.loads(subprocess.check_output(['node','-e',expression],cwd=ROOT,encoding='utf8'))
def alpha_matte(tile, threshold=218):
    pix=np.asarray(tile.convert('RGB'),dtype=np.uint8)
    rgb=pix.astype(np.int16)
    light=np.min(rgb,axis=2)>threshold
    chroma=(np.max(rgb,axis=2)-np.min(rgb,axis=2))<60
    background=light&chroma
    seeds=np.zeros(background.shape,dtype=bool)
    seeds[0,:]=background[0,:]
    seeds[-1,:]=background[-1,:]
    seeds[:,0]=background[:,0]
    seeds[:,-1]=background[:,-1]
    connected=binary_propagation(seeds,mask=background)
    alpha=gaussian_filter((~connected).astype(float),.75)*255
    result=Image.fromarray(np.concatenate([pix,np.uint8(np.clip(alpha,0,255))[:,:,None]],axis=2),'RGBA')
    bb=result.getbbox()
    if not bb:raise RuntimeError('empty image cell')
    cut=result.crop(bb)
    cut.thumbnail((232,232),Image.Resampling.LANCZOS)
    dest=Image.new('RGBA',(256,256))
    dest.alpha_composite(cut,((256-cut.width)//2,(256-cut.height)//2))
    return dest
def run(stage, steps=18, timeout=800):
    stages=lexicon()
    meta=next((st for st in stages if st['id']==stage),None)
    if not meta:raise ValueError(stage)
    if not WF.is_file():raise FileNotFoundError(WF)
    original_prompt=build_original_prompt(meta)
    # Important: the original text is shared verbatim. Add specificity to the
    # contents of the ONE 'Subject order by cell' field only for fish.
    text=build_original_prompt(meta, FISH if stage=='rain-port' else None)
    assert text.startswith(original_prompt.split('Subject order by cell: ')[0])
    assert text.split('Art direction: ',1)[1]==original_prompt.split('Art direction: ',1)[1]
    assert 'Exactly FIVE columns and FOUR rows' in text
    wf=json.loads(WF.read_text(encoding='utf8'))
    wf['459:474']['inputs']['switch']=False
    wf['459:474']['inputs']['on_false']=text
    wf['459:452']['inputs']['negative_prompt']=ORIGINAL_NEGATIVE_PROMPT
    seed=20261029+stages.index(meta)*1087+16493
    wf['459:458']['inputs']['seed']=seed
    wf['459:458']['inputs']['steps']=steps
    wf['461']['inputs']['filename_prefix']='YokaiDelivery/'+stage+'/same_style_v3'
    output=ROOT/'art'/'delivery-icons'/stage/'rerender-original-style-v3'
    if (output/'manifest.json').exists():
        raise RuntimeError('v3 already exists; prevent accidental overwrite')
    output.mkdir(parents=True,exist_ok=True)
    payload=json.dumps({'prompt':wf,'client_id':'yokai-delivery-original-style-v3'},ensure_ascii=False).encode('utf8')
    response=json.loads(http('/prompt',payload))
    id=response['prompt_id']
    print('Qwen local original style batch:',stage,id,'seed',seed,flush=True)
    until=time.monotonic()+timeout
    while time.monotonic()<until:
        result=json.loads(http('/history/'+id))
        if id in result:break
        time.sleep(4)
    else:raise TimeoutError(id)
    hist=result[id]
    if hist.get('status',{}).get('status_str')=='error':raise RuntimeError(str(hist.get('status')))
    imgs=[img for node in hist.get('outputs',{}).values() for img in node.get('images',[])]
    if not imgs:raise RuntimeError('No output '+id)
    first=imgs[0]
    q=urllib.parse.urlencode({'filename':first['filename'],'subfolder':first.get('subfolder',''),'type':first.get('type','output')})
    sheet=Image.open(io.BytesIO(http('/view?'+q))).convert('RGB')
    sheet.save(output/'contact_sheet_source.png')
    wanted=SELECTED[stage]
    for index,w in enumerate(meta['words']):
        if w['jp'] not in wanted:continue
        x=index%5;y=index//5
        bounds=(round(sheet.width*x/5),round(sheet.height*y/4),round(sheet.width*(x+1)/5),round(sheet.height*(y+1)/4))
        tile=sheet.crop(bounds)
        # Labels were hallucinated along the cell bottom in the first batch:
        # strip the footer band only when generating reviewed sprites, without
        # changing the original prompt. Tall-object candidates need human QA.
        cutoff=int(tile.height*0.71) if stage=='rain-port' else int(tile.height*.73)
        tile=tile.crop((0,0,tile.width,cutoff))
        icon=alpha_matte(tile)
        name=f'{index+1:02d}_{w["jp"]}_candidate.webp'
        icon.save(output/name,'WEBP',quality=91,method=6)
    manifest={
      'status':'ART_CANDIDATE_NOT_APPROVED',
      'art_style':'verbatim original first batch prompt art direction',
      'stage':stage,'model':'Qwen Image 2.1 in local ComfyUI',
      'source_script':'tools/generate_delivery_icons_local.py:build_original_prompt',
      'workflow':str(WF),'grid':'5x4 original first batch','steps':steps,'seed':seed,'prompt_id':id,
      'prompt_sha256':hashlib.sha256(text.encode('utf8')).hexdigest(),
      'base_style_tail_sha256':hashlib.sha256(original_prompt.split('Art direction: ',1)[1].encode('utf8')).hexdigest(),
      'negative_prompt_sha256':hashlib.sha256(ORIGINAL_NEGATIVE_PROMPT.encode('utf8')).hexdigest(),
      'selected':wanted,'preserves_prior_versions':True
    }
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    print('READY',stage,'saved',len(wanted),'unchanged other candidates',flush=True)
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--stage',required=True,choices=SELECTED)
    ap.add_argument('--steps',type=int,default=18)
    args=ap.parse_args()
    run(args.stage,args.steps)
if __name__=='__main__':main()
