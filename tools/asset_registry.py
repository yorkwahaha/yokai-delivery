#!/usr/bin/env python3
"""Guarded asset promotion and inventory. --build copies, never deletes/overwrites."""
import argparse,hashlib,json,re,shutil
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parent.parent
REG=ROOT/'docs/ASSET_REGISTRY.json'; INV=ROOT/'docs/ASSET_INVENTORY.json'
JS=ROOT/'js/asset-paths.js'
MEDIA={'.webp','.png','.jpg','.jpeg','.svg','.mp3','.ogg','.wav'}
BAD=re.compile(r'(?:^|[_/.\\-])(candidate|trial|draft|new|final[0-9]*|seed[0-9]+|v[0-9]+|qwen|comfyui|nano)(?:[_/.\\-]|$)',re.I)
STAGES=['night-town','rain-port','sakura-pass','bamboo-maze','hyakki-kyoto','snow-temple','spirit-ferry','yomi']
# Seven historical locally reviewed image masters were inventoried while
# ignored by Git. They may exist in the owner's original checkout, but not in
# a clean clone / CI worktree. They are NOT shipped production dependencies.
# Keep their recorded hashes, so present local copies are still audited.
OPTIONAL_LOCAL_ONLY={
 'assets/img/vfx/boss-water-r8/rainVortex_v01.png',
 'assets/img/vfx/boss-water-r8/tidalFan_v01.png',
 'assets/img/vfx/boss-water-r8/tide_v03.png',
 'assets/img/vfx/shield/guard_crack.png',
 'assets/img/vfx/shield/guard_full.png',
 'assets/img/vfx/shield/ofuda_ward_crack.svg',
 'assets/img/vfx/shield/ofuda_ward_full.svg',
}
def digest(p):
 data=p.read_bytes()
 # Tracked SVG source blobs are LF; Windows autocrlf worktrees may hold CRLF.
 # Match the canonical bytes used in the service-worker media revision check.
 if p.suffix.lower()=='.svg':data=data.replace(b'\r\n',b'\n')
 return hashlib.sha256(data).hexdigest()
def stage2_approved_sources():
 """Only publish files explicitly selected by runtime or enemy manifests.

 Raw S2 art-manifest status=ART_CANDIDATE is provenance, not game approval;
 the later runtime-art-manifest marks a subset APPROVED_RUNTIME.
 """
 runtime=json.loads((ROOT/'assets/img/runtime-art-manifest.json').read_text(encoding='utf8'))
 stage=runtime['stages']['rain-port']
 assert stage['status']=='APPROVED'
 selected={}
 def scan(obj):
  if isinstance(obj,dict):
   if obj.get('runtime_status') in ('APPROVED_RUNTIME','USER_SELECTED_RUNTIME') and obj.get('path'):
    source=obj.get('legacy_source_path',obj['path'])
    assert source.startswith('assets/img/rain-port/s2-production/'),source
    f=ROOT/source
    assert f.is_file() and digest(f)==obj['sha256'],source
    selected[source]=obj['sha256']
   for value in obj.values():scan(value)
  elif isinstance(obj,list):
   for value in obj:scan(value)
 scan(stage)
 assert len(selected)==20,('Unexpected S2 runtime approval count',len(selected))
 enemy=json.loads((ROOT/'assets/img/rain-port/enemies/runtime-manifest-20261014.json').read_text(encoding='utf8'))
 assert enemy['status']=='USER_APPROVED_FOR_RUNTIME'
 assert len(enemy['runtime_sprites'])==4
 for record in enemy['runtime_sprites'].values():
  source=record.get('legacy_runtime_path',record['runtime_path'])
  assert source.startswith('assets/img/rain-port/enemies/')
  assert digest(ROOT/source)==record['sha256'],source
  selected[source]=record['sha256']
 assert len(selected)==24
 return selected

def plan():
 out=[]
 approved_s2=stage2_approved_sources()
 def add(s,t,category,route=True):
  a=ROOT/s
  if not a.is_file():raise ValueError('missing approved source '+s)
  assert not BAD.search(t),t
  if s in approved_s2:
   assert digest(a)==approved_s2[s],('Approval SHA mismatch',s)
   route=True
  out.append(dict(source=s,canonical=t,category=category,route=route,sha256=digest(a)))
 for name,folder,prefix,role in [('BGM','stages/night-town','night-town','battle'),('BOSS','boss','boss','encounter'),('MAP','menu','menu','journey')]:
  add(f'assets/audio/{name}.mp3',f'assets/audio/bgm/{folder}/{prefix}__{role}.mp3','bgm')
 sfx={
 'barrier-lv5':('skills/barrier','barrier__cast__lv05'),
 'boom-lv1-4':('skills/boom','boom__cast__tier01-04'),'boom-lv5':('skills/boom','boom__cast__lv05'),
 'boomerang':('skills/boomerang','boomerang__cast'),
 'boss-death':('enemies/boss','boss__death'),'break-shield':('system','system__shield-break'),
 'dash':('world','world__dash'),'delivery-success':('ui','ui__delivery-success'),
 'delivery-wrong':('ui','ui__delivery-wrong'),'fanfare':('system','system__fanfare'),
 'fire-lv1-4':('skills/fire','fire__cast__tier01-04'),'fire-lv5-ball':('skills/fire','fire__ball__lv05'),
 'fire-lv5-dragon':('skills/fire','fire__dragon__lv05'),'fire-lv5':('skills/fire','fire__cast__lv05'),
 'katana-lv5':('skills/katana','katana__slash__lv05'),'level-up':('system','system__level-up'),
 'lose':('system','system__lose'),'needle':('skills/needle','needle__cast'),
 'ofuda':('skills/ofuda','ofuda__cast'),'sanctuary':('skills/sanctuary','sanctuary__cast'),
 'slash':('world','world__slash'),'sword-slash5':('skills/katana','katana__slash__variation05'),
 'thunder-lv1-4':('skills/thunder','thunder__cast__tier01-04'),
 'thunder-lv5':('skills/thunder','thunder__cast__lv05'),
 'warning-pulse':('system','system__warning-pulse')}
 for name,(folder,stem) in sfx.items():add('assets/audio/sfx/'+name+'.mp3','assets/audio/sfx/'+folder+'/'+stem+'.mp3','sfx')
 for name,kind,role in [('ground','tiles','ground'),('ground_dirt','tiles','ground-dirt'),
   ('house_shop','scene','house-shop'),('house_shrine','scene','house-shrine'),
   ('house_tavern','scene','house-tavern'),('prop_torii','props','torii'),
   ('prop_lantern','props','lantern'),('prop_sakura','props','sakura')]:
  add(f'assets/img/scenery/{name}.webp',f'assets/img/stages/night-town/{kind}/night-town__{role}.webp','stage')
 for name in ('hud_lantern_oil','hud_radar_frame','hud_omamori_hint_listen','hud_skill_fan'):
  add(f'assets/img/ui/{name}.webp',
      'assets/img/ui/hud/ui__'+name[4:].replace('_','-')+'.webp','ui')
 base=ROOT/'assets/img/rain-port/s2-production'
 for f in sorted(base.rglob('*.webp')):
  # B17: user-selected irregular dark stone slabs, distinct from archived pebble ground.
  a=f.relative_to(base).parts
  kind='objects' if a[0]=='buildings' else 'props' if a[0]=='props' else 'scene' if a[0]=='environment' else 'tiles'
  add(f.relative_to(ROOT).as_posix(),
      f'assets/img/stages/rain-port/{kind}/rain-port__'+re.sub(r'_v[0-9]+$','',f.stem).replace('_','-')+'.webp','stage',False)
 # Currently selected baseline yokai art, migrated with exactly matching bytes.
 # Existing motion sheets stay sheets; do NOT split them into invented frames.
 for f in sorted((ROOT/'assets/img/yokai').glob('*.webp')):
  key=f.stem
  monster=key.removesuffix('_motion_v1')
  name='night-town-boss' if monster=='boss' else monster.replace('_','-')
  role='motion-sheet' if key.endswith('_motion_v1') else 'sprite__idle'
  add(f.relative_to(ROOT).as_posix(),
      f'assets/img/enemies/{name}/{name}__{role}.webp','enemy',True)
 # The existing 23 raster skill assets have known semantic IDs and roles.
 for f in sorted((ROOT/'assets/img/vfx/raster').glob('*.webp')):
  stem=f.stem
  m=re.match(r'^(fire)_(orbit|attack|dragon)_l([1-5])$',stem)
  k=re.match(r'^(katana)_l([1-5])$',stem)
  if m: id,role,level=m.groups();suffix=f'{id}__{role}__lv0{level}'
  elif k: id,level=k.groups();suffix=f'{id}__slash__lv0{level}'
  elif stem.startswith('dragon_'):
   id='fire';suffix='fire__'+stem.replace('dragon_','dragon-').replace('_l5','__lv05').replace('_','-')
  elif stem.startswith('barrier_'):
   id='barrier';suffix='barrier__'+stem.replace('barrier_','').replace('_','-')
  elif stem.startswith('thunder_'):
   id='thunder';suffix='thunder__'+stem.replace('thunder_','').replace('_','-')
  else:id=stem.split('_')[0];suffix=id+'__cast'
  add(f.relative_to(ROOT).as_posix(),
      f'assets/img/vfx/skills/{id}/{suffix}.webp','skill_vfx',True)
 # Stage2 enemy sprites: copy, but let existing boss/minion image loader use
 # its original URLs until independent renderer QA.
 for f in sorted((ROOT/'assets/img/rain-port/enemies').glob('*.webp')):
  name=f.stem
  role='attack' if name.endswith('_attack') else 'idle'
  base=name.rsplit('_',1)[0].replace('_','-')
  add(f.relative_to(ROOT).as_posix(),
      f'assets/img/enemies/{base}/{base}__sprite__{role}.webp','enemy',False)
 # Distinct Boss effect packs. Original version names are removed from the
 # canonical name but not from the original bytes or manifest.
 for base,boss in [('boss-night-town','night-town-boss'),('boss-water-r8','ikari-umibozu')]:
  for f in sorted((ROOT/'assets/img/vfx'/base).glob('*.webp')):
   role=re.sub(r'_v[0-9]+$','',f.stem).replace('_','-')
   role=re.sub(r'(?<=[a-z])(?=[A-Z])','-',role).lower()
   add(f.relative_to(ROOT).as_posix(),
       f'assets/img/vfx/enemies/{boss}/{boss}__{role}.webp','enemy_vfx',False)
 # User-facing skill and passive illustrations: source is currently a UI
 # upgrade sheet. No automated reroute: dimensions/crops have to be checked.
 for f in sorted((ROOT/'assets/img/ui/upgrade/illustrations').glob('*.webp')):
  stem=f.stem.replace('_','-')
  add(f.relative_to(ROOT).as_posix(),
      f'assets/img/skills/{stem}/cards/{stem}__card.webp','skill_card',False)
 for f in sorted((ROOT/'assets/img/ui/choice-art').glob('*.webp')):
  stem=f.stem.replace('_','-')
  add(f.relative_to(ROOT).as_posix(),
      f'assets/img/skills/{stem}/icons/{stem}__icon.webp','skill_icon',False)
 assert len({e['canonical'] for e in out})==len(out),'collision'
 return sorted(out,key=lambda e:e['source'])
def registry(entries):
 templates={
 'stage_scene':'assets/img/stages/{stage}/scene/{stage}__{role}.webp',
 'stage_tiles':'assets/img/stages/{stage}/tiles/{stage}__{role}.webp',
 'stage_props':'assets/img/stages/{stage}/props/{stage}__{role}.webp',
 'stage_objects':'assets/img/stages/{stage}/objects/{stage}__{role}.webp',
 'enemy':'assets/img/enemies/{enemy}/{enemy}__{role}[__{state}][__fNN].webp',
 'player':'assets/img/characters/{character}/{character}__{role}[__fNN].webp',
 'skill_cards':'assets/img/skills/{skill}/cards/{skill}__card[__lvNN].webp',
 'skill_icons':'assets/img/skills/{skill}/icons/{skill}__icon[__lvNN].webp',
 'skill_vfx':'assets/img/vfx/skills/{skill}/{skill}__{role}[__lvNN][__fNN].webp',
 'enemy_vfx':'assets/img/vfx/enemies/{effect}/{effect}__{role}[__fNN].webp',
 'ui':'assets/img/ui/{area}/ui__{role}.webp',
 'bgm':'assets/audio/bgm/{area}/{id}__{role}.mp3',
 'skill_sfx':'assets/audio/sfx/skills/{skill}/{skill}__{role}[__lvNN].mp3',
 'enemy_sfx':'assets/audio/sfx/enemies/{enemy}/{enemy}__{role}.mp3',
 'system_sfx':'assets/audio/sfx/{area}/{id}__{role}.mp3',
 'voice':'assets/audio/voice/{speaker}/{speaker}__{role}.mp3',
 'delivery_image':'assets/img/delivery/{stage}/NN.webp',
 'delivery_audio':'assets/audio/delivery/{stage}/NN.mp3'}
 return dict(schema=1,updated='2026-10-31',authority='docs/ASSET_CONVENTIONS.md',
   stage_ids=STAGES,templates=templates,
   approvals={'delivery_img':['night-town'],'delivery_audio':['night-town'],
              'stage_2_existing_bundle':'assets/img/rain-port/s2-production/'},
   trials={'delivery_img':['rain-port'],'delivery_audio':['rain-port']},
   policy='Stage2 delivery art/audio explicitly authorized for local playtest; not approved final. Source files retained.',
   aliases=entries)
def runtime(entries):
 pairs={e['source']:e['canonical'] for e in entries if e['route']}
 return ('// GENERATED by tools/asset_registry.py --build; immutable approved URL aliases.\n'
 '(()=>{const root=typeof window!=="undefined"?window:globalThis;\n'
 'const aliases=Object.freeze('+json.dumps(pairs,ensure_ascii=False,separators=(',',':'),sort_keys=True)+');\n'
 'function resolve(path){if(typeof path!=="string")return path;const i=path.search(/[?#]/);'
 'const base=i<0?path:path.slice(0,i);return (aliases[base]||base)+(i<0?"":path.slice(i))}\n'
 'root.ASSET_PATHS=Object.freeze({resolve,aliases});})();\n')
def inventory(entries):
 src={e['source']:e for e in entries};dest={e['canonical'] for e in entries}
 items=[]
 for base in ('assets/img','assets/audio'):
  for f in sorted((ROOT/base).rglob('*')):
   if not f.is_file() or f.suffix.lower() not in MEDIA:continue
   path=f.relative_to(ROOT).as_posix();e=src.get(path)
   if e:status='legacy_alias_active' if e['route'] else 'legacy_source_pending_renderer'
   elif path.startswith(('assets/img/delivery/rain-port/','assets/audio/delivery/rain-port/','assets/img/ui/charm-passive/b7/','assets/img/ui/charm-passive/b9/','assets/img/ui/charm-passive/b10/','assets/img/ui/charm-passive/b11/','assets/img/ui/b12/','assets/img/ui/b13/','assets/img/ui/b14/','assets/img/ui/passive/b9/','assets/img/ui/passive/washi-v2/')) or path in ('assets/img/ui/dash_medallion_b7.webp','assets/img/vfx/boss-night-town/seal_break_painted.webp'):status='trial_pending_review'
   elif path in ('assets/img/vfx/shield/ward_spirit_full.webp','assets/img/vfx/shield/ward_spirit_crack.webp','assets/img/vfx/shield/ward_bagua_full.webp','assets/img/vfx/shield/ward_bagua_break.webp','assets/img/vfx/boss-night-town/slam_earth_warning.webp','assets/img/vfx/boss-night-town/slam_earth_impact.webp','assets/img/vfx/boss-night-town/charge_aura.webp','assets/img/vfx/boss-night-town/charge_single_b13.webp'):status='trial_pending_review'
   elif path.startswith(('assets/img/ui/passive/warm/','assets/img/ui/charm-passive/clean/')) or path == 'assets/img/vfx/boss-night-town/charge_aligned.webp':status='canonical'
   elif path in dest or path.startswith(('assets/img/delivery/','assets/audio/delivery/')) or path in ('assets/img/vfx/shield/ofuda_ward_full.svg','assets/img/vfx/shield/ofuda_ward_crack.svg'):status='canonical'
   elif path in {
    'assets/img/ui/menu/pause__board.webp',
    'assets/img/ui/menu/exit__board.webp',
    'assets/img/ui/buttons/menu__button.webp',
    'assets/img/ui/buttons/menu__button__hover.webp',
    'assets/img/ui/buttons/menu__button__danger.webp',
    'assets/img/ui/buttons/menu__button__danger-hover.webp',
    'assets/img/ui/buttons/menu__button__disabled.webp',
   }:
    # Approved visual concept, local runtime trial until player accepts it in-game.
    status='trial_pending_review'
   elif re.fullmatch(r'assets/img/skills/[a-z0-9-]+/cards/[a-z0-9-]+__art\.webp',path) or path=='assets/img/ui/menu/ui__upgrade-card-frame.png':
    # Phase 42 raster card-center art: local user playtest, not shipped approval.
    status='trial_pending_review'
   elif BAD.search(path):status='legacy_review_required'
   else:status='legacy_unmigrated'
   items.append(dict(path=path,status=status,bytes=f.stat().st_size,sha256=digest(f)))
 return dict(schema=1,updated='2026-10-31',notes='Unmigrated paths are inventoried, not approved for new usage; never delete without reference audit.',
             totals=dict(files=len(items),by_status=dict(Counter(x['status'] for x in items))),files=items)
def dump(obj):return json.dumps(obj,ensure_ascii=False,indent=2)+'\n'
def build(entries):
 for e in entries:
  source=ROOT/e['source'];dest=ROOT/e['canonical']
  assert digest(source)==e['sha256']
  if dest.exists() and digest(dest)!=e['sha256']:raise RuntimeError('refusing overwrite '+str(dest))
 n=0
 for e in entries:
  src=ROOT/e['source'];dest=ROOT/e['canonical']
  if not dest.exists():
   dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest);n+=1
  assert digest(dest)==e['sha256']
 REG.write_text(dump(registry(entries)),encoding='utf8')
 JS.write_text(runtime(entries),encoding='utf8')
 doc=inventory(entries)
 INV.write_text(dump(doc),encoding='utf8')
 print('BUILD',len(entries),'mapped',n,'safe copies',sum(x['route'] for x in entries),'active aliases',len(doc['files']),'inventoried files')
def check():
 r=json.loads(REG.read_text(encoding='utf8'));entries=r['aliases']
 for e in entries:
  a=ROOT/e['source'];b=ROOT/e['canonical']
  assert a.is_file() and b.is_file(),(a,b)
  assert digest(a)==digest(b)==e['sha256'],e
  assert not BAD.search(e['canonical']),e
 assert JS.read_text(encoding='utf8')==runtime(entries),'stale JS resolver'
 old={e['path']:e['sha256'] for e in json.loads(INV.read_text(encoding='utf8'))['files']}
 now={e['path']:e['sha256'] for e in inventory(entries)['files']}
 absent=old.keys()-now.keys()
 assert absent <= OPTIONAL_LOCAL_ONLY,('disappeared',list(absent-OPTIONAL_LOCAL_ONLY)[:12])
 assert not (OPTIONAL_LOCAL_ONLY & {e['source'] for e in entries}), 'local candidates must not be approved aliases'
 assert not (OPTIONAL_LOCAL_ONLY & {e['canonical'] for e in entries}), 'local candidates must not be approved targets'
 assert not now.keys()-old.keys(),('new files not inventoried',list(now.keys()-old.keys())[:12])
 modified=[f for f in old if f in now and old[f]!=now[f]]
 assert not modified,('asset bytes changed without review: run --build only after approved change',modified[:12])
 print('PASS',len(now),'files',len(entries),'aliases/copies;',len(absent),
       'historical ignored local-only art sources absent; no missing shipped/modified/new unregistered media')
def main():
 ap=argparse.ArgumentParser();group=ap.add_mutually_exclusive_group(required=True)
 for name in ['build','check','plan']:group.add_argument('--'+name,action='store_true')
 args=ap.parse_args()
 if args.check:check();return
 entries=plan()
 if args.plan:
  print('PLAN',len(entries),dict(Counter((e['category'],e['route']) for e in entries)))
  for e in entries:print(e['source'],'->',e['canonical'],e['route'])
 else:build(entries)
if __name__=='__main__':main()
