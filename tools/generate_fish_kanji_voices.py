#!/usr/bin/env python3
"""Generate approved-format kanji-input Fish Audio auditions with A and new C voice.

Only save to art/audio/fish-night-town/kanji-voices/. Never replace game MP3.
API keys are obtained from the environment, and never written to manifests.
"""
import argparse, concurrent.futures, json, os, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'art/audio/fish-night-town/kanji-voices'
URL='https://api.fish.audio/v1/tts'
MODEL='s2.1-pro-free'
VOICES={
  'a':'97eda32449cf443bbc4b8782853ca554',
  'c':'1ec6c6ee0833469e9f172dfc018dda1a',
}
def words():
    js="require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages[0].words))"
    lex=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT,encoding='utf8'))
    assert len(lex)==20
    result=[]
    for index,w in enumerate(lex,1):
        # 鋏 is the ordinary kanji for the noun はさみ, deliberately kept in
        # the synthesis text without changing the game's displayed spelling.
        sound=w['kanji'] or ('鋏' if w['jp']=='はさみ' else w['jp'])
        assert sound
        result.append({'index':index,'jp':w['jp'],'zh':w['zh'],'kanji':w['kanji'],
                       'tts_text':sound,'uses_kanji':any('\u3400'<=c<='\u9fff' for c in sound)})
    return result
def is_mp3(b):
    return len(b)>1000 and (b[:3]==b'ID3' or b[0]==255 and (b[1]&224)==224)
def synthesize(task):
    voice,id,w,key,attempts=task
    file=OUT/voice/(f"{w['index']:02}.mp3")
    file.parent.mkdir(parents=True,exist_ok=True)
    if file.exists() and is_mp3(file.read_bytes()):
        return (voice,w['index'],w['jp'],w['tts_text'],'cached',file.stat().st_size,'')
    request_body=json.dumps({'text':w['tts_text'],'reference_id':id,
                             'format':'mp3','latency':'balanced'},ensure_ascii=False).encode('utf8')
    error=''
    for attempt in range(attempts):
        try:
            req=urllib.request.Request(URL,request_body,method='POST',headers={
              'Authorization':'Bearer '+key,'Content-Type':'application/json',
              'Accept':'audio/mpeg','model':MODEL})
            with urllib.request.urlopen(req,timeout=100) as res:
                data=res.read()
            if not is_mp3(data):raise RuntimeError('not a valid MP3')
            tmp=file.with_suffix('.mp3.part')
            tmp.write_bytes(data);tmp.replace(file)
            return (voice,w['index'],w['jp'],w['tts_text'],'generated',len(data),'')
        except urllib.error.HTTPError as exc:
            error=f'HTTP {exc.code}: '+exc.read(200).decode('utf8','replace')
            if exc.code in (401,402,403,404,422):break
        except Exception as exc:error=f'{type(exc).__name__}: {exc}'
        if attempt+1<attempts:time.sleep(min(16,2**(attempt+1)*2))
    return (voice,w['index'],w['jp'],w['tts_text'],'failed',0,error[:160])
def make_html(rows,results):
    # file:// works without a preview server
    template='''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>妖怪配送｜漢字版本聲線試聽 A vs 新 C</title>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{background:#18232c;color:#f0e2cb;margin:0;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif}header{background:#27333a;border-bottom:2px solid #a99060;padding:18px max(16px,calc((100vw - 1000px)/2));position:sticky;top:0;z-index:3}h1{margin:0 0 6px;font-size:23px}header p{margin:4px 0;color:#cfc4b2;font-size:14px}main{max-width:1020px;margin:18px auto;padding:0 14px}table{width:100%;border-collapse:separate;border-spacing:0 6px;table-layout:fixed}td{background:#283740;border-top:1px solid #59645e;border-bottom:1px solid #59645e;padding:9px}td:first-child{border-radius:9px 0 0 9px;border-left:1px solid #59645e;width:58px;text-align:center}td:last-child{border-radius:0 9px 9px 0;border-right:1px solid #59645e}td:nth-child(2){width:29%}th{text-align:left;font-size:12px;color:#e1cfab;padding:6px 10px}.item{font-size:16px;font-weight:bold}.sub{color:#b8c4c9;font-size:12px;margin-top:4px}img{width:45px;height:45px;object-fit:contain}button{min-height:40px;padding:8px 10px;border:1px solid #a48760;border-radius:7px;background:#424239;color:#f8ead2;cursor:pointer;font-size:13px}button:hover,button.active{background:#986c40;color:#fff}.controls{display:flex;gap:8px;flex-wrap:wrap}.status{color:#e9c985;min-height:22px;font-size:13px}.note{margin:18px 0;padding:12px 14px;border:1px solid #665b44;border-radius:10px;background:#222e33;color:#d8c6ab;line-height:1.65;font-size:13px}@media(max-width:580px){header{position:static}td{padding:6px}td:nth-child(2){width:34%}button{min-height:35px;padding:6px}h1{font-size:19px}img{width:36px;height:36px}}</style>
</head><body><header><h1>夜行町｜漢字輸入版・官方聲線 A 與新 C</h1>
<p>20 個詞彙各兩組錄音，採漢字或日語常用正字法輸入。這是待審候選，尚未替換遊戲語音。</p>
<p>A：97eda32449cf443bbc4b8782853ca554｜新 C：1ec6c6ee0833469e9f172dfc018dda1a</p>
<div class="status" id="status" role="status">請逐字播放比較。試聽不消耗額外的 Fish Audio API 額度。</div></header>
<main><table><thead><tr><th>物件</th><th>詞彙／中文</th><th>漢字輸入與試聽</th></tr></thead><tbody id="words"></tbody></table>
<div class="note">原來聲線 B（44b6e5eeab214296bcfd73e767225229）的音檔全部保留，但本頁不再使用。少數無常用漢字的外來語仍用標準片假名。<strong>「はさみ」以「鋏」生成，請特別確認是否被正確念作「はさみ」。</strong></div></main>
<script>
const WORDS=__WORDS__;
const AUDIO_OK=__STATUS__;
const tbody=document.getElementById('words'),status=document.getElementById('status');
const player=new Audio();let previous=null;
function play(voice,w,button){
 player.pause();player.removeAttribute('src');player.load();
 if(previous)previous.classList.remove('active');
 previous=button;button.classList.add('active');
 player.src=voice+'/'+String(w.index).padStart(2,'0')+'.mp3';
 status.textContent='播放中：'+w.jp+'（'+w.tts_text+'）／聲線'+voice.toUpperCase();
 player.onerror=()=>{button.classList.remove('active');status.textContent='音檔無法載入：'+w.jp+'／'+voice.toUpperCase()};
 player.onended=()=>{button.classList.remove('active');status.textContent='播放完畢：'+w.jp+'／'+voice.toUpperCase()};
 player.play().catch(()=>{button.classList.remove('active');status.textContent='無法播放：'+w.jp+'／'+voice.toUpperCase()});
}
for(const w of WORDS){
 const tr=document.createElement('tr'),ico=document.createElement('td'),word=document.createElement('td'),actions=document.createElement('td');
 const img=document.createElement('img');img.src='../../../../assets/img/delivery/night-town/'+String(w.index).padStart(2,'0')+'.webp';img.alt=w.zh;ico.append(img);
 const main=document.createElement('div');main.className='item';main.textContent=w.kanji?w.kanji+'（'+w.jp+'）':w.jp;
 const zh=document.createElement('div');zh.className='sub';zh.textContent=w.zh;word.append(main,zh);
 const text=document.createElement('div');text.className='sub';text.textContent='輸入：'+w.tts_text;actions.append(text);
 const btns=document.createElement('div');btns.className='controls';
 for(const voice of ['a','c']){const b=document.createElement('button');b.textContent='▶ '+(voice==='a'?'聲線 A':'新聲線 C');b.disabled=!AUDIO_OK[voice+'-'+w.index];b.onclick=()=>play(voice,w,b);btns.append(b)}
 actions.append(btns);tr.append(ico,word,actions);tbody.append(tr);
}
</script></body></html>'''
    ok={f"{r['voice']}-{r['index']}":r['status']!='failed' for r in results}
    html=template.replace('__WORDS__',json.dumps(rows,ensure_ascii=False,separators=(',',':'))).replace('__STATUS__',json.dumps(ok,separators=(',',':')))
    (OUT/'preview.html').write_text(html,encoding='utf8')
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--workers',type=int,default=3)
    parser.add_argument('--attempts',type=int,default=3)
    parser.add_argument('--voice',choices=['a','c','all'],default='all')
    parser.add_argument('--limit',type=int,default=20)
    args=parser.parse_args()
    key=os.getenv('FISH_AUDIO_API_KEY') or os.getenv('FISH_API_KEY')
    if not key:raise SystemExit('No Fish Audio API key available; no requests sent')
    lex=words()
    assert len(lex)==20
    OUT.mkdir(parents=True,exist_ok=True)
    candidates=[(v,VOICES[v],w,key,args.attempts) for v in VOICES if args.voice in ('all',v) for w in lex[:args.limit]]
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(args.workers,4))) as pool:
        for r in concurrent.futures.as_completed([pool.submit(synthesize,c) for c in candidates]):
            voice,index,jp,spoken,state,size,error=r.result()
            print(f"{voice} {index:02d} {jp} / {spoken}: {state} {size} {error}",flush=True)
            results.append(dict(voice=voice,index=index,jp=jp,text=spoken,status=state,bytes=size,error=error))
    # Maintain earlier manifest entries if generation is staged and succeeded.
    man=OUT/'manifest.json'
    if man.exists():
        past=json.loads(man.read_text(encoding='utf8')).get('results',[])
        lookup={(r['voice'],r['index']):r for r in past}
        lookup.update({(r['voice'],r['index']):r for r in results})
        results=list(lookup.values())
    results.sort(key=lambda x:(x['voice'],x['index']))
    manifest={
      'stage':'night-town','status':'UNAPPROVED_VOICE_AUDITION','model':MODEL,
      'voice_ids':VOICES,'words':lex,'results':results,'api_key_included':False,
      'source_text':'kanji or standard Japanese orthography',
      'existing_original_recordings_unchanged':True
    }
    man.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    make_html(lex,results)
    print('RESULT',sum(r['status']!='failed' for r in results),'/',len(results),'preview:',OUT/'preview.html',flush=True)
    if any(r['status']=='failed' for r in results):raise SystemExit(2)
if __name__=='__main__':main()
