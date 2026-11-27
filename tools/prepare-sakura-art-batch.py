"""Normalize the generated Stage3 candidate art; preserve every original PNG."""
from pathlib import Path
from collections import Counter
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / 'docs/STAGE3_ART_BATCH_20261116.json'
OUT = ROOT / 'assets/img/stages/sakura-pass'
PAD = 24
SCENE = {
 'shrine': ('pavilion','scene','shrine-pavilion'),
 'tea-house': ('teaHouse','scene','tea-house'),
 'mountain-house': ('mountainHouse','scene','mountain-house'),
 'storehouse': ('storehouse','scene','storehouse'),
 'worship-hall': ('worshipHall','scene','worship-hall'),
 'stone-lantern': ('stoneLantern','props','stone-lantern'),
 'torii': ('torii','props','torii'),
 'wood-fence': ('fence','props','wood-fence'),
 'stone-marker': ('marker','props','stone-marker'),
 'moss-rocks': ('mossRocks','props','moss-rocks'),
 'ancient-sakura': ('ancientSakura','props','ancient-sakura'),
}
LABELS = {
 'shrine':'神社重繪','tea-house':'山道茶屋','mountain-house':'山宿','storehouse':'山倉',
 'worship-hall':'拜殿','stone-lantern':'古石燈','torii':'山道鳥居','wood-fence':'木柵',
 'stone-marker':'山道石標','moss-rocks':'苔石','ancient-sakura':'古櫻樹',
 'sakura-kodama':'落櫻小鬼','hanakage-fox':'花影狐','moss-tanuki':'苔甲狸',
 'stone-lantern-kid':'石燈童','paper-umbrella-spirit':'紙傘靈',
 'sakura-tengu':'櫻嶺天狗','ancient-sakura-guardian':'千年櫻守','night-sakura-princess':'夜櫻鬼姬'
}
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,obj): p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def mask(im): return im.getchannel('A').point(lambda x:255 if x>=16 else 0)
def record(path, source, **extra):
 return dict(path=path.relative_to(ROOT).as_posix(), source=source.relative_to(ROOT).as_posix(),
  sha256=sha(path),source_sha256=sha(source),status='ART_CANDIDATE_USER_REVIEW_PENDING',**extra)
def save(im,p):
 p.parent.mkdir(parents=True,exist_ok=True)
 im.save(p,'WEBP',quality=94,method=6,exact=True)
 assert im.mode=='RGBA' and im.getchannel('A').getextrema()==(0,255)
def scene_image(im,limit):
 box=mask(im).getbbox()
 assert box
 cropped=im.crop(box)
 scale=min(1,(limit-2*PAD)/max(cropped.size))
 size=tuple(max(1,round(n*scale)) for n in cropped.size)
 cropped=cropped.resize(size,Image.Resampling.LANCZOS)
 target=Image.new('RGBA',(size[0]+2*PAD,size[1]+2*PAD))
 target.alpha_composite(cropped,(PAD,PAD))
 return target,dict(sx=PAD,sy=PAD,sw=size[0],sh=size[1]),box
def split_poses(im):
 cols=mask(im).getprojection()[0]
 gaps=[];start=None
 for x in range(int(im.width*.3),int(im.width*.7)):
  if not cols[x] and start is None:start=x
  if cols[x] and start is not None:gaps.append((start,x));start=None
 if start is not None:gaps.append((start,int(im.width*.7)))
 assert gaps,'No transparent separation between poses'
 lo,hi=max(gaps,key=lambda p:p[1]-p[0])
 assert hi-lo>=24,'Pose separation too narrow'
 cut=(lo+hi)//2
 parts=[im.crop((0,0,cut,im.height)),im.crop((cut,0,im.width,im.height))]
 details=[]
 for part in parts:
  box=mask(part).getbbox();assert box
  crop=part.crop(box)
  # Estimate the body foot pivot from the bottom 10%, not weapon extents.
  band=mask(crop).crop((0,round(crop.height*.9),crop.width,crop.height))
  counts=[sum(1 for v in band.crop((x,0,x+1,band.height)).getdata() if v) for x in range(band.width)]
  total=sum(counts);assert total
  pivot=sum(x*n for x,n in enumerate(counts))/total
  details.append((crop,box,pivot))
 scale=min(464/max(x[0].height for x in details),
           224/max(max(pivot,crop.width-pivot) for crop,_,pivot in details))
 out=[]
 for crop,box,pivot in details:
  size=tuple(max(1,round(n*scale)) for n in crop.size)
  resized=crop.resize(size,Image.Resampling.LANCZOS)
  target=Image.new('RGBA',(512,512))
  x=round(256-pivot*scale);y=488-size[1]
  assert x>=PAD-1 and x+size[0]<=512-PAD+1 and y>=PAD-1
  target.alpha_composite(resized,(x,y))
  b=mask(target).getbbox();assert b
  frame=[b[0],b[1],b[2]-b[0],b[3]-b[1],256]
  out.append((target,frame,box))
 base_height=max(a[1][3] for a in out)
 return out,base_height,cut
def contact(cards,path,columns,cell=(320,310)):
 rows=(len(cards)+columns-1)//columns
 sheet=Image.new('RGB',(columns*cell[0],rows*cell[1]),'#e9dcc5')
 draw=ImageDraw.Draw(sheet)
 try:font=ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',18)
 except OSError:font=ImageFont.load_default()
 for i,(title,paths) in enumerate(cards):
  x=(i%columns)*cell[0];y=(i//columns)*cell[1]
  draw.rectangle((x+4,y+4,x+cell[0]-4,y+cell[1]-4),outline='#706254',width=2)
  count=len(paths);slot=(cell[0]-16)//count
  for j,p in enumerate(paths):
   with Image.open(p) as im:
    im.thumbnail((slot-12,cell[1]-52),Image.Resampling.LANCZOS)
    sheet.paste(im,(x+8+j*slot+(slot-im.width)//2,y+8+(cell[1]-52-im.height)//2),im)
  draw.text((x+12,y+cell[1]-32),title,fill='#2d2521',font=font)
 sheet.save(path)
def main():
 batch=json.loads(BATCH.read_text(encoding='utf-8'));assert len(batch['assets'])==19
 data=dict(status='ART_CANDIDATE_USER_REVIEW_PENDING',scene={},characters={})
 added=[];scene_cards=[];char_cards=[]
 for asset in batch['assets']:
  source=ROOT/asset['source']
  with Image.open(source) as original:
   im=original.convert('RGBA')
   assert im.getchannel('A').getextrema()[0]==0,'Opaque source'
   if asset['id'] in SCENE:
    role,folder,name=SCENE[asset['id']]
    image,rect,box=scene_image(im,768 if folder=='scene' or role=='ancientSakura' else 512)
    dest=OUT/folder/f'sakura-pass__{name}.webp';save(image,dest)
    item=record(dest,source,id=asset['id'],role=role,category=folder,size=list(image.size),
       source_rect=rect,source_crop=list(box),label=LABELS[asset['id']])
    data['scene'][role]=dict(path=item['path'],rect=rect)
    added.append(item);scene_cards.append((LABELS[asset['id']],[dest]))
   else:
    poses,base,cut=split_poses(im);paths=[];defs={}
    for pose,(image,frame,box) in zip(('idle','attack'),poses):
     dest=ROOT/f"assets/img/enemies/{asset['id']}/{asset['id']}__sprite__{pose}.webp"
     save(image,dest);paths.append(dest)
     key=asset['id'].replace('-','_')+'_'+pose
     item=record(dest,source,id=asset['id'],role=pose,category=asset['kind'],size=[512,512],
       frame=frame,base_height=base,source_crop=list(box),source_split=cut,label=LABELS[asset['id']])
     added.append(item);defs[pose]=dict(path=item['path'],key=key,frame=frame,baseHeight=base)
    data['characters'][asset['id']]=defs
    char_cards.append((LABELS[asset['id']]+'  待機 / 攻擊',paths))
 assert len(added)==27
 manifest_path=OUT/'manifest.json';manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
 old=[x for x in manifest['assets'] if x.get('role') in ('dirt','stoneStraight','stoneLeft','stoneRight','stoneBroken')]
 assert len(old)==5
 forest=[x for x in manifest['assets'] if x.get('category')=='forest']
 boss_vfx=[x for x in manifest['assets'] if x.get('category')=='boss_vfx']
 if forest:data['forest']={x['role']:dict(path=x['path'],rect=x['source_rect']) for x in forest}
 if boss_vfx:data['bossVfx']={x['role']:dict(path=x['path'],rect=x['source_rect']) for x in boss_vfx}
 if manifest.get('boss_waves'):data['bossWaves']=manifest['boss_waves']
 selected={(x['path'],x['sha256']) for x in manifest['assets'] if x.get('status')=='USER_SELECTED_RUNTIME'}
 for x in added:
  if (x['path'],x['sha256']) in selected:x['status']='USER_SELECTED_RUNTIME'
 manifest['assets']=old+added+forest+boss_vfx;manifest['art_batch']='docs/STAGE3_ART_BATCH_20261116.json'
 dump(manifest_path,manifest)
 dump(ROOT/'art/stage3-sakura-pass/scene/manifest-generated-20261116.json',dict(assets=[x for x in added if x['category'] in ('scene','props')]))
 dump(ROOT/'art/stage3-sakura-pass/characters/manifest.json',dict(assets=[x for x in added if x['category'] in ('enemy','boss')]))
 (ROOT/'js/sakura-art-data.js').write_text('// GENERATED by Stage3 art tools from the runtime art manifest.\nwindow.SAKURA_ART_DATA = Object.freeze('+json.dumps(data,ensure_ascii=False,separators=(',',':'))+');\n',encoding='utf-8')
 inv_path=ROOT/'docs/ASSET_INVENTORY.json';inv=json.loads(inv_path.read_text(encoding='utf-8'))
 by_path={x['path']:x for x in inv['files']}
 for x in added:
  old_record=by_path.get(x['path'],{})
  status=old_record.get('status','trial_pending_review') if old_record.get('sha256')==x['sha256'] else 'trial_pending_review'
  by_path[x['path']]=dict(path=x['path'],status=status,bytes=(ROOT/x['path']).stat().st_size,sha256=x['sha256'])
 inv['files']=list(by_path.values())
 inv['totals']=dict(files=len(inv['files']),by_status=dict(Counter(x['status'] for x in inv['files'])))
 dump(inv_path,inv)
 reg_path=ROOT/'docs/ASSET_REGISTRY.json';reg=json.loads(reg_path.read_text(encoding='utf-8'))
 if not manifest.get('runtime_status'):
  reg['trials']['stage3_character_manifest']='art/stage3-sakura-pass/characters/manifest.json';dump(reg_path,reg)
 batch['status']='ART_CANDIDATE_USER_REVIEW_PENDING';batch['runtime_count']=27
 batch['runtime_manifest']='assets/img/stages/sakura-pass/manifest.json'
 dump(BATCH,batch)
 contact(scene_cards,ROOT/'art/stage3-sakura-pass/scene/contact-sheet-20261116.png',4)
 contact(char_cards,ROOT/'art/stage3-sakura-pass/characters/contact-sheet-20261116.png',2,(520,320))
 print('Prepared 27 runtime rasters from 19 originals; all originals retained; floor unchanged.')
if __name__=='__main__':main()
