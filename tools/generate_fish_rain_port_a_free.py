#!/usr/bin/env python3
"""Generate rain-port 20-word trial audio, Fish Audio A voice, free S2.1 Pro ONLY.

Free-model API key from env. Writes preview candidates to art/audio/fish-rain-port/a-common-ja/
and does NOT overwrite already-published game assets. The output can then be
safely copied to assets/audio/delivery/rain-port/ after validating 20/20.
"""
from __future__ import annotations
import concurrent.futures,json,os,pathlib,subprocess,time,urllib.error,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=ROOT/'art/audio/fish-rain-port/a-common-ja'
REFERENCE_ID='97eda32449cf443bbc4b8782853ca554'
MODEL='s2.1-pro-free'
URL='https://api.fish.audio/v1/tts'
# Standard Japanese writing. Avoid unfamiliar/rare fish kanji which can turn
# into Mandarin or the wrong Japanese on isolated-word TTS.
READINGS={
 'さかな':'魚','さけ':'鮭','まぐろ':'まぐろ','さば':'さば','たい':'鯛',
 'うなぎ':'うなぎ','たこ':'たこ','いか':'いか','えび':'海老','かに':'蟹',
 'かい':'貝','のり':'海苔','こんぶ':'昆布','わかめ':'わかめ',
 'すし':'寿司','さしみ':'刺身','やきざかな':'焼き魚',
 'おにぎり':'おにぎり','みそしる':'味噌汁','てんぷら':'天ぷら'
}
def vocab():
 js="require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages.find(x=>x.id==='rain-port').words))"
 words=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT,encoding='utf8'))
 assert len(words)==20 and set(READINGS)=={x['jp'] for x in words}
 return [dict(index=i,jp=w['jp'],zh=w['zh'],kanji=w['kanji'],
   tts_text=READINGS[w['jp']]) for i,w in enumerate(words,1)]
def mp3(data):
 return len(data)>1200 and (data[:3]==b'ID3' or (data[0]==255 and (data[1]&224)==224))
def generate(task):
 w,key=task;f=OUT/f"{w['index']:02}.mp3"
 if f.exists():
  data=f.read_bytes()
  if mp3(data):return dict(index=w['index'],status='cached',bytes=len(data))
  raise RuntimeError('Invalid existing file, do not overwrite: '+str(f))
 body=json.dumps({'text':w['tts_text'],'reference_id':REFERENCE_ID,
     'format':'mp3','latency':'balanced','language':'ja-JP'},ensure_ascii=False).encode('utf8')
 error=''
 for attempt in range(4):
  try:
   req=urllib.request.Request(URL,data=body,method='POST',headers={
     'Authorization':'Bearer '+key,'Content-Type':'application/json',
     'Accept':'audio/mpeg','model':MODEL})
   with urllib.request.urlopen(req,timeout=95) as resp:
    data=resp.read()
   if not mp3(data):raise ValueError('not valid MP3')
   f.parent.mkdir(parents=True,exist_ok=True)
   tmp=f.with_suffix('.mp3.part')
   tmp.write_bytes(data);tmp.replace(f)
   return dict(index=w['index'],status='generated',bytes=len(data))
  except urllib.error.HTTPError as e:
   error='HTTP '+str(e.code)+' '+e.read(160).decode('utf8','replace')
   if e.code in (400,401,402,403,404,422):break
  except Exception as e:error=type(e).__name__+': '+str(e)[:140]
  if attempt<3:time.sleep(2**(attempt+1))
 return dict(index=w['index'],status='failed',error=error)
def main():
 key=os.getenv('FISH_AUDIO_API_KEY') or os.getenv('FISH_API_KEY')
 if not key:raise SystemExit('No Fish key in environment; no paid request attempted')
 words=vocab()
 OUT.mkdir(parents=True,exist_ok=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  res=list(pool.map(generate,[(w,key) for w in words]))
 for w,r in zip(words,res):print(f"{w['index']:02} {w['jp']} / {w['tts_text']}: {r['status']} {r.get('bytes','')} {r.get('error','')}",flush=True)
 result={'status':'IN_GAME_TRIAL_PENDING_USER_REVIEW','stage':'rain-port','model':MODEL,
   'voice_id':REFERENCE_ID,'language':'ja-JP','no_pitch_tags':True,
   'notice':'language only controls normalization; ear-check actual Japanese readings',
   'words':words,'results':res,'key_included':False}
 (OUT/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('RESULT',sum(r['status']!='failed' for r in res),'/',len(res),flush=True)
 if any(r['status']=='failed' for r in res):raise SystemExit(2)
if __name__=='__main__':main()
