#!/usr/bin/env python3
"""Local-only ComfyUI QwenImage21 contact-sheet icon drafts. NO paid provider.
Outputs candidates in art/delivery-icons/, never publishes unapproved art.
Usage: python tools/generate_delivery_icons_local.py --stage night-town
"""
import argparse, json, io, os, random, time, urllib.request, urllib.parse
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
HOST='http://127.0.0.1:8188'
WF=Path(r'e:\Downloads\image_qwen_image_2_1_t2i.json')
def fetch(uri,body=None):
    req=urllib.request.Request(HOST+uri,data=body,headers={'Content-Type':'application/json'} if body else {})
    return urllib.request.urlopen(req,timeout=30).read()
# Single authoritative original-generation prompt: all subsequent repaint scripts import
# this exact factory. Art direction, composition and negative prompt are never rewritten.
def build_original_prompt(stage, subject_descriptions=None):
    items=', '.join(f'{i+1}: {w["zh"]} ({w["jp"]})' +
        (f': {subject_descriptions[w["jp"]]}' if subject_descriptions and w["jp"] in subject_descriptions else '')
        for i,w in enumerate(stage['words']))
    return (
        'A precise visual inventory of TWENTY DISTINCT SINGLE-OBJECT miniature collectible illustrations for an elegant Japanese historical fantasy game. '
        'Exactly FIVE columns and FOUR rows, ordered left to right top to bottom, equal-size cells with generous separation. '
        'Every cell holds ONE CENTERED iconic real-life object clearly distinguishable by its distinctive silhouette, color and material. '
        'Subject order by cell: '+items+'. '
        'Art direction: traditional Japanese ukiyo-e woodblock illustration blended with delicate sumi-e wash, handmade washi texture, '
        'strong dark organic ink outlines, dry brush strokes, subtle pigment irregularities and restrained deep vermilion, indigo and old gold accents. '
        'Highly readable expressive miniature object sprites, hand-painted Japanese game item inventory art, consistent angle at three-quarter view, '
        'coherent lighting, no perspective landscape, NO PEOPLE, no scenery, NO LETTERS, no captions, NO NUMBER LABELS, no logos, '
        'no frames and no grid lines. Uniform pure warm light ivory backdrop for easy subsequent matte removal, '
        'every object fully within its own allotted 1/5 x 1/4 cell with ample whitespace. Square 1:1 image.'
    )

ORIGINAL_NEGATIVE_PROMPT='photorealistic, modern flat vector icon, emoji art, Western cartoon, 3D render, thick plastic shine, text, writing, letters, watermark, border, grid lines, collage overlaps, multiple objects per cell, cropped objects, black background, glossy badge'
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--stage',default='night-town');ap.add_argument('--steps',type=int,default=22);ap.add_argument('--timeout',type=int,default=900)
    a=ap.parse_args()
    # lexicon JS is pure JSON after the marker; read with a tiny JS child invocation, no node-side file writes.
    import subprocess
    js="require('./js/delivery-lexicon.js');console.log(JSON.stringify(globalThis.DELIVERY_LEXICON.stages))"
    stages=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT,encoding='utf8'))
    stage=next((x for x in stages if x['id']==a.stage),None)
    if not stage:raise SystemExit('unknown stage '+a.stage)
    if not WF.is_file():raise SystemExit('local workflow missing')
    wf=json.loads(WF.read_text(encoding='utf8'))
    prompt=build_original_prompt(stage)
    wf['459:474']['inputs']['switch']=False
    wf['459:474']['inputs']['on_false']=prompt
    wf['459:452']['inputs']['negative_prompt']=ORIGINAL_NEGATIVE_PROMPT
    wf['459:458']['inputs']['seed']=20261029+stages.index(stage)*1087
    wf['459:458']['inputs']['steps']=a.steps
    wf['461']['inputs']['filename_prefix']='YokaiDelivery/'+a.stage+'/deliver_icons_candidate'
    res=json.loads(fetch('/prompt',json.dumps({'prompt':wf,'client_id':'yokai-delivery-draft'}).encode('utf8')))
    prompt_id=res['prompt_id'];print('submitted',a.stage,prompt_id,flush=True)
    until=time.monotonic()+a.timeout;history=None
    while time.monotonic()<until:
        value=json.loads(fetch('/history/'+prompt_id))
        if prompt_id in value:
            history=value[prompt_id];break
        time.sleep(5)
    if not history:raise TimeoutError('no completion '+prompt_id)
    if history.get('status',{}).get('status_str')=='error':raise RuntimeError('ComfyUI error '+str(history.get('status')))
    imgs=[img for node in history.get('outputs',{}).values() for img in node.get('images',[])]
    if not imgs:raise RuntimeError('no image output '+str(history.get('status')))
    item=imgs[0]
    q=urllib.parse.urlencode({'filename':item['filename'],'subfolder':item.get('subfolder',''),'type':item.get('type','output')})
    im=Image.open(io.BytesIO(fetch('/view?'+q))).convert('RGB')
    output=ROOT/'art'/'delivery-icons'/a.stage
    output.mkdir(parents=True,exist_ok=True)
    im.save(output/'contact_sheet_candidate.png')
    # Crop only into review candidates. A rasterization pipeline cannot certify semantic correctness.
    width,height=im.size
    for i,w in enumerate(stage['words']):
        x=i%5;y=i//5
        crop=im.crop((round(x*width/5),round(y*height/4),round((x+1)*width/5),round((y+1)*height/4)))
        crop.thumbnail((256,256),Image.Resampling.LANCZOS)
        crop.save(output/(str(i+1).zfill(2)+'_'+w['jp']+'_candidate.webp'),'WEBP',quality=91)
    metadata={'status':'ART_CANDIDATE_NOT_APPROVED','stage':a.stage,'prompt_id':prompt_id,'seed':wf['459:458']['inputs']['seed'],'size':im.size,'tile_count':20,'words':stage['words'],'art_direction':'sumi-e ukiyo-e washi and ink','editorial_note':'Review each crop. Do not import to production without human approval.'}
    (output/'manifest_candidate.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf8')
    print('saved',output,'dimensions',im.size,'candidates',len(stage['words']),flush=True)
if __name__=='__main__':main()
