#!/usr/bin/env python3
"""Select the visually reviewed traditional flute/medicine candidate variants.

Only updates Stage3 local trial WebPs; checks prior manifest SHA before writes.
"""
import hashlib, json, os, pathlib, shutil
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parent.parent
SRC=ROOT/'art/delivery-icons/sakura-pass'
STAGED=SRC/'final-selected-20261116'
RUNTIME=ROOT/'assets/img/delivery/sakura-pass'
MANIFEST=RUNTIME/'manifest.json'
STATUS='IN_GAME_TRIAL_PENDING_USER_REVIEW'
CHOICES={
  19:SRC/'refined-20261116/ふえ_candidate.webp',
  20:SRC/'refined-medicine-v3-20261116/くすり_candidate.webp'
}
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
def main():
    manifest=json.loads(MANIFEST.read_text(encoding='utf8'))
    assert manifest['status']==STATUS and manifest['version']=='20261116-final-word-set'
    for i,src in CHOICES.items():
        item=manifest['items'][i-1]
        assert item['index']==i and item['jp']==('ふえ' if i==19 else 'くすり')
        assert src.is_file(),src
        with Image.open(src) as img:
            assert img.size==(256,256) and img.mode=='RGBA'
            assert img.getchannel('A').getbbox()
        original=RUNTIME/f'{i:02}.webp'
        staged=STAGED/f'{i:02}.webp'
        assert original.is_file() and staged.is_file()
        if item['source']==src.relative_to(ROOT).as_posix():
            assert sha(original)==sha(staged)==sha(src)
            continue
        assert sha(original)==sha(staged)==item['sha256'],('staged image changed',i)
    for i,src in CHOICES.items():
        item=manifest['items'][i-1]
        if item['source']==src.relative_to(ROOT).as_posix():continue
        for dst in (STAGED/f'{i:02}.webp',RUNTIME/f'{i:02}.webp'):
            temp=dst.with_suffix('.webp.new')
            shutil.copy2(src,temp)
            assert sha(temp)==sha(src)
            os.replace(temp,dst)
        item['source']=src.relative_to(ROOT).as_posix()
        item['sha256']=sha(src)
        item['source_sha256']=sha(src)
        item['handling']='redrawn'
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('FINAL_ICON_SELECTION',[(n,str(f)) for n,f in CHOICES.items()])
if __name__=='__main__':main()
