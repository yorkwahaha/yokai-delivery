#!/usr/bin/env python3
"""Fish Japanese teaching pilot: phoneme pitch control vs kana/kanji/context + energetic C.
Only generates isolated review candidates. Does not touch any game audio assets or settings.
"""
import concurrent.futures,json,os,subprocess,time,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'art/audio/fish-night-town/ja-phoneme-trial'
OUT.mkdir(parents=True,exist_ok=True)
VOICES={'a':'97eda32449cf443bbc4b8782853ca554','c':'1ec6c6ee0833469e9f172dfc018dda1a'}
MODEL='s2.1-pro-free'
# Pitch digits reflect Tokyo style. はさみ is odaka [3]; 箸 high-low [1]; 皿 heiban [0].
# The pitch for some individual words needs human check; an isolated word's pitch cannot
# reveal heiban vs odaka without a following particle.
SPECS={
 'hasami':{'name':'はさみ（剪刀）','variants':{
    'kana':'はさみ',
    'pitch':'<|phoneme_start|>ha0sa1mi1<|phoneme_end|>',
    'japanese-context':'このはさみを使います。'
 }},
 'hashi':{'name':'はし（箸／筷子）','variants':{
    'kanji':'箸',
    'pitch':'<|phoneme_start|>ha1shi0<|phoneme_end|>',
 }},
 'sara':{'name':'さら（皿／盤子）','variants':{
    'kanji':'皿',
    'pitch':'<|phoneme_start|>sa0ra1<|phoneme_end|>',
 }},
 'kami':{'name':'かみ（紙／紙張）','variants':{
    'kanji':'紙',
    'japanese-context':'この紙を使います。'
 }},
}
# C voice may need an emotion cue; these are separate from the phoneme-only baseline.
C_EXTRA={
 ('hasami','happy-pitch'):'[happy] <|phoneme_start|>ha0sa1mi1<|phoneme_end|>',
 ('hasami','excited-pitch'):'[excited] <|phoneme_start|>ha0sa1mi1<|phoneme_end|>',
 ('hashi','happy-pitch'):'[happy] <|phoneme_start|>ha1shi0<|phoneme_end|>',
}
def valid_mp3(data):
 return len(data)>1200 and (data.startswith(b'ID3') or (data[0]==255 and (data[1]&224)==224))
def task(args):
 voice,word,variant,txt,key=args
 target=OUT/voice/(word+'_'+variant+'.mp3')
 target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists() and valid_mp3(target.read_bytes()):
  return {'voice':voice,'word':word,'variant':variant,'text':txt,'status':'cached','size':target.stat().st_size}
 body={'text':txt,'reference_id':VOICES[voice],'format':'mp3','latency':'normal','language':'ja-JP','normalize':True,'temperature':0.7,'top_p':0.7}
 if variant in ('happy-pitch','excited-pitch'):
  body['temperature']=0.82
 reqdata=json.dumps(body,ensure_ascii=False).encode('utf8')
 err=''
 for attempt in range(3):
  try:
   req=urllib.request.Request('https://api.fish.audio/v1/tts',reqdata,method='POST',headers={'Authorization':'Bearer '+key,'Content-Type':'application/json','Accept':'audio/mpeg','model':MODEL})
   with urllib.request.urlopen(req,timeout=100) as r:data=r.read()
   if not valid_mp3(data):raise RuntimeError('Not MP3 data')
   temp=target.with_suffix('.part')
   temp.write_bytes(data);temp.replace(target)
   return {'voice':voice,'word':word,'variant':variant,'text':txt,'status':'ok','size':len(data)}
  except urllib.error.HTTPError as e:
   err='HTTP '+str(e.code)+' '+e.read(250).decode('utf8','replace')
   if e.code in [401,402,403,404,422]:break
  except Exception as e:err=type(e).__name__+': '+str(e)
  if attempt<2:time.sleep(3*(attempt+1))
 return {'voice':voice,'word':word,'variant':variant,'text':txt,'status':'failed','error':err[:180]}
def write_html():
 wordnames={k:v['name'] for k,v in SPECS.items()}
 allrows=[]
 for w,info in SPECS.items():
  for voice in VOICES:
   for variant,txt in info['variants'].items():allrows.append({'word':w,'voice':voice,'variant':variant,'text':txt})
 for (w,v),txt in C_EXTRA.items():allrows.append({'word':w,'voice':'c','variant':v,'text':txt})
 # Names and candidate list are embedded so file:// is self-contained.
 html='''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fish Audio 日語發音修正：音素 × 語氣</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{font:15px/1.6 "Microsoft JhengHei","Noto Sans TC",sans-serif;background:#1e2931;color:#eee7db;margin:0}main{max-width:940px;margin:auto;padding:20px}h1{font-size:23px}p{color:#d3c2ab}section{background:#293943;border:1px solid #6a6858;border-radius:12px;padding:12px 16px;margin:16px 0}.line{padding:8px 0;border-bottom:1px solid #4c5a5b;display:flex;gap:9px;align-items:center;flex-wrap:wrap}.line:last-child{border:0}button{border:1px solid #a88e68;background:#40483d;border-radius:7px;padding:8px 12px;color:#f5ead3;cursor:pointer}button.active,button:hover{background:#946933}.word{font-size:19px;font-weight:700}.txt{font-family:Consolas,monospace;font-size:12px;flex:1;overflow-wrap:anywhere;color:#b6ced2}#status{position:sticky;top:0;background:#39443e;padding:7px 12px;border-radius:7px}.note{font-size:13px;color:#e2d1b7}</style></head><body><main><h1>夜行町｜日語發音與 C 聲線語氣小規模實驗</h1><p>使用 Fish Audio S2.1 Pro；每段都已生成，不再呼叫 API。比較「假名／漢字」、「日語音素與音高標記」及「完整日語句子」。C 聲線另外測試 [happy]、[excited]。所有錄音尚未接進正式遊戲。</p><div id="status" role="status">點選任一段播放</div><div id="rows"></div><p class="note">注意：日語句子版本會播放完整句子，不是單字錄音。ja-JP 只控制文字正規化，真正嘗試控制發音的是音素標記。標記仍可能偶發讀錯，請用耳朵審核。</p></main><script>const SPECS=__SPECS__,ROWS=__ROWS__;const root=document.getElementById('rows'),status=document.getElementById('status'),audio=new Audio();let previous;function play(row,button){audio.pause();audio.removeAttribute('src');audio.load();if(previous)previous.classList.remove('active');previous=button;button.classList.add('active');audio.src=row.voice+'/'+row.word+'_'+row.variant+'.mp3';status.textContent='播放 '+SPECS[row.word]+' '+row.voice.toUpperCase()+' '+row.variant;audio.onerror=()=>{button.classList.remove('active');status.textContent='音檔不存在／無法解碼'};audio.onended=()=>{button.classList.remove('active');status.textContent='播放完成'};audio.play().catch(()=>{button.classList.remove('active');status.textContent='瀏覽器播放失敗'})}for(const [word,name] of Object.entries(SPECS)){const group=document.createElement('section'),h=document.createElement('div');h.className='word';h.textContent=name;group.append(h);for(const row of ROWS.filter(x=>x.word===word)){const line=document.createElement('div');line.className='line';const b=document.createElement('button');b.textContent='▶ '+row.voice.toUpperCase()+' — '+row.variant;b.onclick=()=>play(row,b);const txt=document.createElement('div');txt.className='txt';txt.textContent=row.text;line.append(b,txt);group.append(line)}root.append(group)}</script></body></html>'''
 html=html.replace('__SPECS__',json.dumps(wordnames,ensure_ascii=False,separators=(',',':'))).replace('__ROWS__',json.dumps(allrows,ensure_ascii=False,separators=(',',':')))
 (OUT/'preview.html').write_text(html,encoding='utf8')
def main():
 key=os.getenv('FISH_AUDIO_API_KEY') or os.getenv('FISH_API_KEY')
 if not key:raise SystemExit('No Fish Audio API key configured')
 jobs=[(voice,w,variant,txt,key) for w,info in SPECS.items() for variant,txt in info['variants'].items() for voice in VOICES]
 jobs += [('c',w,var,text,key) for (w,var),text in C_EXTRA.items()]
 records=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for r in concurrent.futures.as_completed([pool.submit(task,j) for j in jobs]):
   result=r.result();records.append(result)
   print(result['voice'],result['word'],result['variant'],result['status'],result.get('size'),result.get('error',''),flush=True)
 records.sort(key=lambda x:(x['word'],x['voice'],x['variant']))
 (OUT/'manifest.json').write_text(json.dumps({'model':MODEL,'trial_only':True,'language_effect':'text_normalization_only','voices':VOICES,'records':records},ensure_ascii=False,indent=2),encoding='utf8')
 write_html()
 successes=sum(r['status']!='failed' for r in records)
 print('FINISHED',successes,'/',len(records),'preview',OUT/'preview.html',flush=True)
 if successes<len(records):raise SystemExit(2)
if __name__=='__main__': main()
