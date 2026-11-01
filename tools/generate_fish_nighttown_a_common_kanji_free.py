#!/usr/bin/env python3
"""Night Town: A voice, readable/common Japanese orthography, free S2.1 Pro API ONLY.

No pitch tags, no rare-kanji forced spellings, no paid API fallback.
Uses Fish API credentials from environment. Writes separate files under
art/audio/fish-night-town/archive/legacy/a-kanji. Does NOT replace approved production files.
"""
from __future__ import annotations
import concurrent.futures,json,os,pathlib,subprocess,time,urllib.error,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=ROOT/'art/audio/fish-night-town/archive/legacy/a-kanji'
REF='97eda32449cf443bbc4b8782853ca554'
MODEL='s2.1-pro-free'
URL='https://api.fish.audio/v1/tts'
# User prefers common kanji but rejects uncommon 鋏 and 石鹸. Kana is
# appropriate for ordinary words without common kanji; loanwords use katakana.
OVERRIDES={'はさみ':'はさみ','せっけん':'せっけん'}
def get_words():
 source="require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages[0].words))"
 vocab=json.loads(subprocess.check_output(['node','-e',source],cwd=ROOT,encoding='utf8'))
 assert len(vocab)==20
 return [dict(index=i,jp=w['jp'],kanji=w['kanji'],zh=w['zh'],text=OVERRIDES.get(w['jp'],w['kanji'] or w['jp']))
         for i,w in enumerate(vocab,1)]
def valid(data):
 return len(data)>1200 and (data[:3]==b'ID3' or (data[0]==255 and (data[1]&224)==224))
def make(args):
 w,key=args
 dest=OUT/f"{w['index']:02}.mp3"
 dest.parent.mkdir(parents=True,exist_ok=True)
 if dest.is_file() and valid(dest.read_bytes()):
  return {'index':w['index'],'jp':w['jp'],'text':w['text'],'status':'cached','bytes':dest.stat().st_size}
 body=json.dumps({'text':w['text'],'reference_id':REF,'format':'mp3','latency':'balanced','language':'ja-JP'},ensure_ascii=False).encode('utf8')
 error=''
 for attempt in range(4):
  try:
   req=urllib.request.Request(URL,data=body,method='POST',headers={'Authorization':'Bearer '+key,'Content-Type':'application/json','Accept':'audio/mpeg','model':MODEL})
   with urllib.request.urlopen(req,timeout=100) as resp:
    audio=resp.read()
   if not valid(audio):raise ValueError('Not MP3')
   tmp=dest.with_suffix('.part')
   tmp.write_bytes(audio);tmp.replace(dest)
   return {'index':w['index'],'jp':w['jp'],'text':w['text'],'status':'generated','bytes':len(audio)}
  except urllib.error.HTTPError as exc:
   error=f'HTTP {exc.code}: '+exc.read(160).decode('utf8','replace')
   if exc.code in (400,401,402,403,404,422):break
  except Exception as exc:error=f'{type(exc).__name__}: {str(exc)[:120]}'
  if attempt<3:time.sleep(min(12,2**(attempt+1)))
 return {'index':w['index'],'jp':w['jp'],'text':w['text'],'status':'failed','error':error}
def preview(words):
 # Standalone file:// audition; relative media paths from a-kanji/ root
 html='''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>妖怪配送｜夜行町A聲線正式字形試聽</title>
<style>:root{color-scheme:dark}body{margin:0;background:#1a2730;color:#f7e9d4;font:15px/1.6 "Microsoft JhengHei","Noto Sans TC",sans-serif}main{max-width:900px;margin:auto;padding:18px}h1{font-size:23px}p{color:#d3c6b4}table{border-collapse:separate;border-spacing:0 6px;width:100%}td{padding:10px;background:#2c3b42;border-top:1px solid #626c6b;border-bottom:1px solid #626c6b}td:first-child{border-left:1px solid #626c6b;border-radius:10px 0 0 10px;width:56px;text-align:center}td:last-child{border-radius:0 10px 10px 0;border-right:1px solid #626c6b}img{width:44px;height:44px;object-fit:contain}button{background:#465243;border:1px solid #b49a72;border-radius:7px;padding:7px 10px;color:#f8ead3;cursor:pointer}button:hover,button.active{background:#a77738}small{color:#bdd0d0}#status{position:sticky;top:0;background:#363e3f;padding:8px;border-radius:8px}.note{border:1px solid #6b634e;padding:12px;border-radius:9px;margin:15px 0}th{text-align:left;color:#ecd3a3;font-size:13px}</style></head><body><main>
<h1>夜行町｜A 聲線 × 常用漢字版</h1><p>Fish Audio S2.1 Pro Free／聲線 A。優先常用漢字，冷僻字用假名，不加 pitch。原來的日文讀音／中文提示和生成文字並列，便於確認是否誤念中文。</p>
<div id="status" role="status">點選單字試聽。全部 MP3 已生成，本頁不會再呼叫付費 API。</div>
<table><thead><tr><th>圖示</th><th>詞彙</th><th>輸入模型的文字</th><th>播放</th></tr></thead><tbody id="vocab"></tbody></table>
<div class="note">「はさみ」使用假名而不是「鋏」；「せっけん」使用假名而不是「石鹸」。外來語如「コップ、ノート、タオル」保持標準片假名。ja-JP 正規化不保證模型一定不出中文讀音，最終請以試聽為準。</div>
</main><script>const WORDS=__WORDS__;const rows=document.getElementById('vocab'),audio=new Audio(),status=document.getElementById('status');let current;
for(const w of WORDS){const tr=document.createElement('tr'),icon=document.createElement('td'),name=document.createElement('td'),input=document.createElement('td'),play=document.createElement('td');const img=document.createElement('img');img.src='../../../../../../assets/img/delivery/night-town/'+String(w.index).padStart(2,'0')+'.webp';img.alt=w.zh;icon.append(img);name.textContent=w.jp+'／'+w.zh;const note=document.createElement('small');note.textContent=w.kanji?'（'+w.kanji+'）':'';name.append(note);input.textContent=w.text;const button=document.createElement('button');button.textContent='▶ 播放';button.onclick=()=>{audio.pause();if(current)current.classList.remove('active');current=button;button.classList.add('active');audio.src=String(w.index).padStart(2,'0')+'.mp3';status.textContent='播放中：'+w.text+'（'+w.jp+'）';audio.onended=()=>{button.classList.remove('active');status.textContent='播放完成：'+w.jp};audio.onerror=()=>{button.classList.remove('active');status.textContent='無法讀取音檔：'+w.jp};audio.play().catch(()=>status.textContent='播放失敗：'+w.jp)};play.append(button);tr.append(icon,name,input,play);rows.append(tr)}
</script></body></html>'''
 (OUT/'preview.html').write_text(html.replace('__WORDS__',json.dumps(words,ensure_ascii=False,separators=(',',':'))),encoding='utf8')
def main():
 key=os.getenv('FISH_AUDIO_API_KEY') or os.getenv('FISH_API_KEY')
 if not key:raise SystemExit('No Fish API key; no requests made')
 words=get_words()
 assert next(x for x in words if x['jp']=='はさみ')['text']=='はさみ'
 assert next(x for x in words if x['jp']=='せっけん')['text']=='せっけん'
 if not OUT.is_dir(): OUT.mkdir(parents=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  results=list(pool.map(make,[(w,key) for w in words]))
 results.sort(key=lambda x:x['index'])
 for r in results:print(f"{r['index']:02} {r['jp']} / {r['text']}: {r['status']} {r.get('bytes','')} {r.get('error','')}",flush=True)
 manifest={'status':'USER_REQUESTED_A_COMMON_KANJI','model':MODEL,'language_field_note':'Japanese text normalization only, not a forced speech language','voice_id':REF,'count':len(words),'input_words':words,'results':results,'key_included':False,'no_pitch_tags':True,'prior_recordings_untouched':True}
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
 preview(words)
 success=sum(x['status'] in ('generated','cached') for x in results)
 print('TOTAL',success,'/',len(results),'MODEL',MODEL,'PREVIEW',OUT/'preview.html',flush=True)
 if success!=len(results):raise SystemExit(2)
if __name__=='__main__':main()
