#!/usr/bin/env python3
"""Repair only Stage3 tree/ant transparency using preserved source art.

Tree: neutral parchment color-to-alpha, with soft pigment edges retained.
Ant: cached local ISNet model mask plus neutral background decontamination.
Writes review candidates first. --install checks trial hashes before replacing
07/17 and updates their provenance, preview revisions and asset inventory.
Does not change voices, other words, earlier stages or any approved assets.
"""
from __future__ import annotations
import argparse,hashlib,json,os,pathlib,re,shutil
import numpy as np
import cv2
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parent.parent
ART=ROOT/'art/delivery-icons/sakura-pass'
DEST=ART/'alpha-cleanup-20261116'
RUNTIME=ROOT/'assets/img/delivery/sakura-pass'
SELECTED=ART/'final-selected-20261116'
MANIFEST=RUNTIME/'manifest.json'
REVIEW=ART/'preview.html'
INVENTORY=ROOT/'docs/ASSET_INVENTORY.json'
WORDS={7:'き',17:'あり'}
STATUS='IN_GAME_TRIAL_PENDING_USER_REVIEW'
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
def repo(f):return f.relative_to(ROOT).as_posix()
def savejson(f,d):f.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')

def remove_dust(a,minimum):
    # Restrict to detached tiny flecks. Keep the ink-connected branch and all
    # insect legs; never apply morphological opening to their thin structure.
    count,labels,stats,_=cv2.connectedComponentsWithStats((a>8).astype('uint8'),8)
    for i in range(1,count):
        if int(stats[i,cv2.CC_STAT_AREA])<minimum:a[labels==i]=0
    return a

def decontaminate(rgb,background,alpha):
    fraction=np.maximum(alpha.astype(np.float32)[...,None]/255.,0.04)
    clean=(rgb.astype(np.float32)-(1-fraction)*background)/fraction
    return np.uint8(np.clip(clean,0,255))

def tree():
    source=ART/'rewritten-20261116/き_candidate.webp'
    rgba=np.asarray(Image.open(source).convert('RGBA')).copy()
    rgb=rgba[:,:,:3]
    alpha=rgba[:,:,3].astype(np.float32)
    # Pixel samples in the unpainted paper border; base remains stable even if
    # textured pigment changes elsewhere inside the tree illustration.
    y,x=np.ogrid[:256,:256]
    region=((x>=48)&(x<65)&(y>25)&(y<190))|((x>188)&(x<203)&(y>25)&(y<190))
    region=np.broadcast_to(region,(256,256)) & (alpha>200)
    background=np.median(rgb[region],axis=0).astype(np.float32)
    distance=np.max(np.abs(rgb.astype(np.float32)-background),axis=-1)
    result_alpha=np.uint8(np.rint(alpha*np.clip((distance-15)/42,0,1)))
    result_alpha[result_alpha<8]=0
    result_alpha=remove_dust(result_alpha,15)
    rgba[:,:,:3]=decontaminate(rgb,background,result_alpha)
    rgba[:,:,3]=result_alpha
    # The unpainted paper at x50/y100 must be gone, not an opaque rectangle.
    assert int(result_alpha[100,50])<15
    assert int(result_alpha[100,128])>40
    return Image.fromarray(rgba,'RGBA'),dict(method='paper-color-alpha',background_rgb=background.tolist(),threshold=15,falloff=42)

def ant():
    from rembg import new_session,remove
    source=ART/'rewritten-20261116/あり_source.png'
    original=Image.open(source).convert('RGB')
    rgb=np.asarray(original).astype(np.float32)
    # Inferred from pure background corners, not sampled from insect pigment.
    bg=np.median(np.concatenate([
        rgb[:60,:60].reshape(-1,3),rgb[:60,-60:].reshape(-1,3),
        rgb[-60:,:60].reshape(-1,3),rgb[-60:,-60:].reshape(-1,3)
    ]),axis=0).astype(np.float32)
    model=new_session('isnet-general-use',providers=['CPUExecutionProvider'])
    mask=np.asarray(remove(original,session=model,alpha_matting=False).getchannel('A')).astype(np.float32)
    distance=np.max(np.abs(rgb-bg),axis=-1)
    alpha=np.uint8(np.clip(mask*np.clip((distance-16)/55,0,1),0,255))
    alpha[alpha<8]=0
    output_rgb=decontaminate(rgb,bg,alpha)
    rgba=np.dstack([output_rgb,alpha]).astype(np.uint8)
    image=Image.fromarray(rgba,'RGBA').resize((232,232),Image.Resampling.LANCZOS)
    full=Image.new('RGBA',(256,256))
    full.alpha_composite(image,(12,12))
    a=np.asarray(full.getchannel('A')).copy()
    a=remove_dust(a,14)
    full.putalpha(Image.fromarray(a))
    return full,dict(method='isnet-general-use+paper-color-alpha',background_rgb=bg.tolist(),threshold=16,falloff=55,model='locally cached isnet-general-use.onnx')

def create():
    DEST.mkdir(parents=True,exist_ok=True)
    for number,word,make in [(7,'き',tree),(17,'あり',ant)]:
        icon,settings=make()
        assert icon.size==(256,256) and icon.mode=='RGBA'
        a=np.asarray(icon.getchannel('A'))
        rect=icon.getchannel('A').getbbox()
        assert rect and rect[0]>=3 and rect[1]>=3 and rect[2]<=253 and rect[3]<=253,(word,rect)
        dest=DEST/f'{number:02}_{word}_candidate.webp'
        if dest.exists() and sha(dest)!=sha(SELECTED/f'{number:02}.webp'):
            # Existing unapproved candidate may be overwritten only by an
            # explicit fresh preparation run; never touch approved variants.
            pass
        icon.save(dest,'WEBP',quality=95,method=6)
        metadata=dict(stage='sakura-pass',index=number,jp=word,status=STATUS,
          source=(f'art/delivery-icons/sakura-pass/rewritten-20261116/{word}_candidate.webp' if number==7 else 'art/delivery-icons/sakura-pass/rewritten-20261116/あり_source.png'),
          output=repo(dest),sha256=sha(dest),bounds=rect,
          original_user_feedback='Residual parchment square / light background halo',
          **settings)
        savejson(DEST/f'{number:02}_{word}_metadata.json',metadata)
        print('CLEANED',number,word,'alpha-0',int(np.count_nonzero(a==0)),
              'alpha255',int(np.count_nonzero(a==255)),'bbox',rect,'sha',sha(dest)[:16],flush=True)

def install():
    manifest=json.loads(MANIFEST.read_text(encoding='utf8'))
    assert manifest['status']==STATUS and manifest['version']=='20261116-final-word-set'
    actions=[]
    for number,word in WORDS.items():
        record=manifest['items'][number-1]
        assert record['index']==number and record['jp']==word,record
        src=DEST/f'{number:02}_{word}_candidate.webp'
        assert src.is_file()
        with Image.open(src) as im:
            assert im.size==(256,256) and im.mode=='RGBA' and im.getchannel('A').getbbox()
        target=RUNTIME/f'{number:02}.webp'
        selected=SELECTED/f'{number:02}.webp'
        assert sha(target)==sha(selected)==record['sha256'],('modified runtime icon',number)
        actions.append((number,word,src,target,selected))
    for number,word,source,target,selected in actions:
        for dst in (target,selected):
            temp=dst.with_suffix('.webp.new')
            shutil.copy2(source,temp)
            assert sha(temp)==sha(source)
            os.replace(temp,dst)
        record=manifest['items'][number-1]
        record['sha256']=sha(source)
        record['source_sha256']=sha(source)
        record['source']=repo(source)
        record['handling']='alpha-cleanup'
    savejson(MANIFEST,manifest)
    # Refresh only these two preview image URL revision tokens. Since preview
    # references art/final-selected, it cannot be served from old SW media cache.
    html=REVIEW.read_text(encoding='utf8')
    for number,word,src,target,selected in actions:
        url=f'final-selected-20261116/{number:02}.webp?v={sha(src)[:16]}'
        pattern=rf'final-selected-20261116/{number:02}\.webp\?v=[a-f0-9]{{16}}'
        html,count=re.subn(pattern,url,html)
        assert count==1,(word,count)
    REVIEW.write_text(html,encoding='utf8')
    # Only these two unapproved Stage3 source digest entries are changed.
    inv=json.loads(INVENTORY.read_text(encoding='utf8'))
    hits=[]
    for e in inv['files']:
        if e['path'] in {repo(item[3]) for item in actions}:
            e['sha256']=sha(ROOT/e['path'])
            e['bytes']=(ROOT/e['path']).stat().st_size
            assert e['status']=='trial_pending_review'
            hits.append(e['path'])
    assert len(hits)==2,hits
    inv['updated']='2026-11-16'
    savejson(INVENTORY,inv)
    print('INSTALLED',sorted(hits),'all other stage words and audio unchanged',flush=True)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--install',action='store_true')
    p.add_argument('--prepare',action='store_true')
    a=p.parse_args()
    if a.prepare or not a.install:create()
    if a.install:install()
if __name__=='__main__':main()
