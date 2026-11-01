#!/usr/bin/env python3
"""Generate two *local* Fish Audio voice auditions for Night Town vocabulary.

Reads FISH_AUDIO_API_KEY or FISH_API_KEY exclusively from the environment.
Never writes secrets, and only requests absent MP3s; retries rate limits.
No production deployment and no overwrite of preexisting recorded words.
"""
import argparse, concurrent.futures, json, os, pathlib, shutil, subprocess, time, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'art' / 'audio' / 'fish-night-town' / 'archive' / 'legacy'
SAMPLES = ROOT / 'art' / 'audio' / 'fish-night-town' / 'samples'
VOICES = {
    'a': '97eda32449cf443bbc4b8782853ca554',
    'b': '44b6e5eeab214296bcfd73e767225229',
}
MODEL = 's2.1-pro-free'
URL = 'https://api.fish.audio/v1/tts'

def vocabulary():
    js = "require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages[0].words))"
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT, encoding='utf8'))

def audio_signature(data):
    if len(data) < 1100: return False
    if data[:3] == b'ID3': return True
    return len(data)>4 and data[0] == 255 and (data[1] & 224) == 224

def make_clip(args):
    label, voice, index, word, key, attempts = args
    dest = OUT / label / f'{index:02}.mp3'
    dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.exists() and audio_signature(dest.read_bytes()):
        return label, index, word, 'cached', dest.stat().st_size, None
    if index == 1:
        probe = SAMPLES / f'{label}_01.mp3'
        if probe.exists():
            b = probe.read_bytes()
            if audio_signature(b):
                dest.write_bytes(b)
                return label, index, word, 'reused_probe', len(b), None
    payload = json.dumps({
        'text': word, 'reference_id': voice, 'format': 'mp3',
        'latency': 'balanced'
    }, ensure_ascii=False).encode('utf8')
    for attempt in range(attempts):
        request=urllib.request.Request(URL, payload, method='POST',
           headers={'Authorization':'Bearer '+key,'Content-Type':'application/json','Accept':'audio/mpeg','model':MODEL})
        try:
            with urllib.request.urlopen(request,timeout=100) as r:
                data=r.read()
                if not audio_signature(data):
                    raise RuntimeError('response was not valid MP3')
                tmp=dest.with_suffix('.mp3.part')
                tmp.write_bytes(data)
                tmp.replace(dest)
                return label,index,word,'generated',len(data),None
        except urllib.error.HTTPError as exc:
            body=exc.read(300).decode('utf8','replace')
            if exc.code in [401,402,403,404,422]:
                return label,index,word,'failed',0,f'HTTP {exc.code}: {body[:95]}'
            error=f'HTTP {exc.code}: {body[:95]}'
        except Exception as exc:
            error=type(exc).__name__+': '+str(exc)[:90]
        if attempt+1<attempts:time.sleep(min(16,2**(attempt+1)*2))
    return label,index,word,'failed',0,error

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--workers',type=int,default=3)
    ap.add_argument('--attempts',type=int,default=3)
    a=ap.parse_args()
    key=os.getenv('FISH_AUDIO_API_KEY') or os.getenv('FISH_API_KEY')
    if not key: raise SystemExit('Fish Audio API key not configured; will use existing TTS fallback')
    words=vocabulary()
    if len(words)!=20:raise SystemExit('night-town lexicon must contain 20 words')
    jobs=[(label,voice,index,w['jp'],key,a.attempts)
      for label,voice in VOICES.items() for index,w in enumerate(words,start=1)]
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(4,a.workers))) as pool:
        future_to_job={pool.submit(make_clip,entry):entry for entry in jobs}
        for future in concurrent.futures.as_completed(future_to_job):
            label,index,word,state,size,error=future.result()
            print(f'{label} {index:02d} {word}: {state} ({size} bytes)'+(f' error={error}' if error else ''),flush=True)
            results.append({'voice':label,'index':index,'jp':word,'status':state,'bytes':size,'error':error})
    results.sort(key=lambda item: (item['voice'],item['index']))
    manifest={
      'stage':'night-town','model':MODEL,'provider':'Fish Audio','voices':VOICES,
      'words':[{'index':i,'jp':w['jp'],'kanji':w['kanji'],'zh':w['zh']} for i,w in enumerate(words,start=1)],
      'audio':results,'api_key_included':False
    }
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    ok=sum(r['status']!='failed' for r in results)
    print('FINAL',ok,'/',len(results),'valid MP3 files',flush=True)
    if ok < len(results): raise SystemExit(2)
if __name__=='__main__':main()
