#!/usr/bin/env python3
"""Fish Audio three-way accent comparison for three first-stage Japanese words.

Run with the preconfigured FISH_AUDIO_API_KEY or FISH_API_KEY environment variable.
Creates 18 separate MP3 audition candidates. Never modifies game voice packs.
"""
from __future__ import annotations
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "art" / "audio" / "fish-night-town" / "accent-tests"
BASE = "https://api.fish.audio/v1/tts"
MODEL = "s2.1-pro-free"
VOICES = {
    "a": "97eda32449cf443bbc4b8782853ca554",
    "b": "44b6e5eeab214296bcfd73e767225229",
}
WORDS = [
    {"id": "sara", "jp": "さら", "kanji": "皿", "zh": "盤子",
     "original_index": 8, "variants": {
         "kana": "さら",
         "kanji": "皿",
         "sentence": "皿です。",
     }},
    {"id": "hashi", "jp": "はし", "kanji": "箸", "zh": "筷子",
     "original_index": 9, "variants": {
         "kana": "はし",
         "kanji": "箸",
         "sentence": "箸です。",
     }},
    {"id": "haburashi", "jp": "はぶらし", "kanji": "歯ブラシ", "zh": "牙刷",
     "original_index": 19, "variants": {
         "kana": "はぶらし",
         "kanji": "歯ブラシ",
         "sentence": "歯ブラシです。",
     }},
]
VARIANTS = ("kana", "kanji", "sentence")

def is_mp3(data: bytes) -> bool:
    return len(data) > 1000 and (data[:3] == b"ID3" or (data[0] == 255 and (data[1] & 224) == 224))

def request_one(item: tuple[str,str,dict,str,str]) -> dict:
    voice_name, reference_id, word, kind, key = item
    output = OUT / voice_name / f"{word['id']}_{kind}.mp3"
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.is_file() and is_mp3(output.read_bytes()):
        return dict(voice=voice_name, word=word["id"], kind=kind, text=word["variants"][kind], status="cached", bytes=output.stat().st_size)
    body=json.dumps({
        "text":word["variants"][kind],
        "reference_id":reference_id,
        "format":"mp3",
        "latency":"balanced",
    },ensure_ascii=False).encode("utf-8")
    error=""
    for attempt in range(4):
        try:
            req=urllib.request.Request(BASE,body,method="POST",headers={
                "Authorization":"Bearer "+key,
                "model":MODEL,
                "Content-Type":"application/json",
                "Accept":"audio/mpeg",
            })
            with urllib.request.urlopen(req,timeout=100) as response:
                data=response.read()
            if not is_mp3(data):
                raise ValueError("Fish Audio response is not an MP3")
            tmp=output.with_suffix(".mp3.part")
            tmp.write_bytes(data)
            tmp.replace(output)
            return dict(voice=voice_name,word=word["id"],kind=kind,text=word["variants"][kind],status="generated",bytes=len(data))
        except urllib.error.HTTPError as exc:
            error=f"HTTP {exc.code}: "+exc.read(160).decode("utf-8","replace")
            if exc.code in (401,402,403,404,422):break
        except Exception as exc:
            error=type(exc).__name__+": "+str(exc)[:140]
        if attempt<3:time.sleep(min(12,2**attempt*2))
    return dict(voice=voice_name,word=word["id"],kind=kind,text=word["variants"][kind],status="failed",error=error)

def write_preview(manifest: dict):
    # Embedded text/word data. Local file:// works without the HTTP dev server.
    html = """<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>夜行町日語高低音｜Fish Audio 兩組聲線×三種輸入</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;background:#19232b;color:#f4e9d9;font:15px/1.6 "Noto Sans TC","Microsoft JhengHei",sans-serif}
main{max-width:1060px;margin:auto;padding:20px}
h1{font-size:24px;margin:0 0 6px}
p{color:#d2c7b8;margin:5px 0 15px}
table{border-collapse:separate;border-spacing:0 6px;width:100%}
th{text-align:left;color:#d8bf98;padding:4px 10px;font-size:13px}
td{background:#283842;padding:12px 10px;vertical-align:middle}
td:first-child{border-radius:10px 0 0 10px}
td:last-child{border-radius:0 10px 10px 0}
.jp{font-size:19px;font-weight:700}
.zh{font-size:12px;color:#ced2d2}
small{color:#decaa2;display:block}
button{background:#46473d;border:1px solid #b29c73;border-radius:8px;padding:9px 12px;color:#f8edde;cursor:pointer;white-space:nowrap}
button:hover,button.active{background:#986a34;color:white}
audio{display:none}
.label{background:#37414b;border-radius:9px;padding:3px 8px;white-space:nowrap}
.note{padding:12px;border:1px solid #665942;border-radius:10px;margin-top:20px}
#status{position:sticky;top:0;background:#303941;padding:8px 14px;border-radius:7px;margin:10px 0}
@media(max-width:650px){main{padding:10px}th,td{padding:6px 4px;font-size:12px}button{padding:7px 8px}.jp{font-size:15px}}
</style></head><body><main>
<h1>夜行町｜日語重音三種輸入對照</h1>
<p>單字：さら（皿）、はし（箸）、はぶらし（歯ブラシ）。A、B 各有假名、漢字、短句版；原版錄音也保留可比較。所有按鈕播放已生成的 MP3，不會再次消耗 Fish Audio API。</p>
<div id="status" role="status">點按任一按鈕試聽。短句版會念出「です」，請比較單字部分的高低音。</div>
<table><thead><tr><th>單字</th><th>輸入方式</th><th>實際輸入 Fish Audio 的文字</th><th>官方聲線 A</th><th>官方聲線 B</th></tr></thead><tbody id="table"></tbody></table>
<p class="note">聲線 A：97eda32449cf443bbc4b8782853ca554　聲線 B：44b6e5eeab214296bcfd73e767225229。請著重聽詞內高低音，並留意「はし」此次目標是「箸（筷子）」而不是「橋」或「端」。本頁不會修改正式遊戲音訊。</p>
</main><script>
const words=__WORDS__;
const player=new Audio();
const status=document.getElementById('status');
let selected=null;
function listen(src,description,button){
 player.pause();player.removeAttribute('src');player.load();
 if(selected)selected.classList.remove('active');
 selected=button;button.classList.add('active');
 status.textContent='正在播放：'+description;
 player.src=src;
 player.onended=()=>{button.classList.remove('active');status.textContent='播放完畢：'+description};
 player.onerror=()=>{button.classList.remove('active');status.textContent='此段音檔無法載入：'+description};
 player.play().catch(()=>{button.classList.remove('active');status.textContent='瀏覽器阻擋或無法播放：'+description});
}
function createRow(w,kind,title,text,src){
 const tr=document.createElement('tr');
 const word=document.createElement('td');word.innerHTML='<div class="jp">'+w.kanji+'（'+w.jp+'）</div><div class="zh">'+w.zh+'</div>';
 const label=document.createElement('td');label.textContent=title;
 const actual=document.createElement('td');actual.textContent=text;
 tr.append(word,label,actual);
 for(const voice of ['a','b']){
  const td=document.createElement('td');const btn=document.createElement('button');
  btn.textContent='▶ '+voice.toUpperCase();
  const filename=kind==='original'?'../../../../assets/audio/fish/night-town/'+voice+'/'+String(w.original_index).padStart(2,'0')+'.mp3':voice+'/'+w.id+'_'+kind+'.mp3';
  btn.onclick=()=>listen(filename, w.kanji+' · '+title+' · 聲線'+voice.toUpperCase(),btn);
  td.append(btn);tr.append(td);
 }
 document.getElementById('table').append(tr);
}
for(const w of words){
 createRow(w,'original','原版（目前遊戲）','原本輸入 '+(w.id==='haburashi'?'はブラシ':w.jp));
 for(const kind of ['kana','kanji','sentence']){
  const title={kana:'純假名',kanji:'漢字',sentence:'短句'}[kind];
  createRow(w,kind,title,w.variants[kind]);
 }
}
</script></body></html>"""
    page=OUT/"preview.html"
    page.write_text(html.replace("__WORDS__",json.dumps(WORDS,ensure_ascii=False,separators=(",",":"))),encoding="utf-8")
    return page

def main():
    key=os.environ.get("FISH_AUDIO_API_KEY") or os.environ.get("FISH_API_KEY")
    if not key:raise SystemExit("No Fish Audio API key in environment; no audio generated")
    OUT.mkdir(parents=True,exist_ok=True)
    jobs=[(voice,reference_id,w,kind,key)
      for voice,reference_id in VOICES.items()
      for w in WORDS for kind in VARIANTS]
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        tasks=[pool.submit(request_one,item) for item in jobs]
        for task in concurrent.futures.as_completed(tasks):
            result=task.result()
            results.append(result)
            print(f"{result['voice']} {result['word']} {result['kind']}: {result['status']} {result.get('bytes','')} {result.get('error','')}",flush=True)
    results.sort(key=lambda row:(row["voice"],[w["id"] for w in WORDS].index(row["word"]),VARIANTS.index(row["kind"])))
    manifest={
        "status":"AUDITION_ONLY_NOT_GAME","model":MODEL,
        "reference_ids":VOICES,"words":WORDS,"results":results,
        "secrets_included":False,
    }
    (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    page=write_preview(manifest)
    successes=sum(row["status"] in ("generated","cached") for row in results)
    print(f"COMPLETE {successes}/{len(results)}; preview={page}",flush=True)
    if successes<len(results):raise SystemExit(2)

if __name__ == "__main__":main()
