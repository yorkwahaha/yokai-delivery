#!/usr/bin/env python3
"""Publish user-approved delivery vocabulary images/audio into canonical paths.

Only accepts 20 numbered staged assets, verifies matching lexicon entries and
never publishes a stage without explicit --approved. Does not alter art drafts.
Usage:
  python tools/publish_delivery_media.py --stage night-town --kind audio \\
      --source assets/audio/delivery/night-town --dry-run
  python tools/publish_delivery_media.py --stage rain-port --kind audio \\
      --source art/audio/delivery-candidates/rain-port/selected --approved
Run: node tools/build-media-cache.cjs after any approved media change.
"""
import argparse, hashlib, json, shutil, subprocess, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
KIND={'image':('img','webp'),'audio':('audio','mp3')}
STAGES=('night-town','rain-port','sakura-pass','bamboo-maze',
        'hyakki-kyoto','snow-temple','spirit-ferry')
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def words(stage):
    js="require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages))"
    stages=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT,encoding='utf8'))
    lex=next(x for x in stages if x['id']==stage)
    assert len(lex['words'])==20
    return lex['words']
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--stage',required=True,choices=STAGES)
    ap.add_argument('--kind',required=True,choices=KIND)
    ap.add_argument('--source',required=True,help='Folder with 01..20 filenames and the matching extension')
    ap.add_argument('--approved',action='store_true',help='Confirm the user reviewed and approved all 20 assets')
    ap.add_argument('--dry-run',action='store_true')
    ap.add_argument('--voice-id',default='',help='Optional metadata, never part of the URL')
    ap.add_argument('--model',default='',help='Optional generation metadata, never part of the URL')
    args=ap.parse_args()
    source=(ROOT/args.source).resolve()
    folder,ext=KIND[args.kind]
    destination=ROOT/'assets'/folder/'delivery'/args.stage
    word_list=words(args.stage)
    files=[]
    for i,word in enumerate(word_list,1):
        filename=f'{i:02}.{ext}'
        file=source/filename
        if not file.is_file():ap.error('Missing reviewed file: '+str(file))
        data=file.read_bytes()
        if args.kind=='image' and (data[:4]!=b'RIFF' or data[8:12]!=b'WEBP'):
            ap.error('Invalid WebP: '+str(file))
        if args.kind=='audio' and not (data.startswith(b'ID3') or (len(data)>2 and data[0]==255 and data[1]&224==224)):
            ap.error('Invalid MP3: '+str(file))
        files.append((file,filename,word,sha(file)))
    for file,filename,word,digest in files:
        target=destination/filename
        if target.is_file() and sha(target)!=digest:
            ap.error('Existing official file differs. Stop and manually review before replacement: '+str(target))
    print('VERIFIED',args.stage,args.kind,'20 matching indexed assets')
    print('TARGET',destination)
    if args.dry_run:return
    if not args.approved:ap.error('--approved required for publishing; use --dry-run to check safely')
    destination.mkdir(parents=True,exist_ok=True)
    for file,filename,word,digest in files:
        target=destination/filename
        if not target.exists():shutil.copy2(file,target)
        if sha(target)!=digest:raise RuntimeError('copy hash mismatch '+str(target))
    manifest_file=destination/'manifest.json'
    if manifest_file.exists():
        # Retain provenance/metadata of an already-reviewed manifest.
        manifest=json.loads(manifest_file.read_text(encoding='utf8'))
        assert manifest.get('status')=='APPROVED_BY_USER' and manifest.get('count')==20
        print('Already approved; did not replace existing manifest',manifest_file)
    else:
        items=[dict(index=i,jp=w['jp'],kanji=w['kanji'],zh=w['zh'],file=name,sha256=digest)
               for i,(file,name,w,digest) in enumerate(files,1)]
        data={'schema':1,'stage':args.stage,'status':'APPROVED_BY_USER','count':20,'kind':args.kind,
              'voice_id':args.voice_id or None,'generation_model':args.model or None,'items':items}
        manifest_file.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('PUBLISHED',args.stage,args.kind,20,'files; update js/delivery-media.js approved list and rebuild media SW cache')
if __name__=='__main__':main()
