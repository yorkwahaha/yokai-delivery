#!/usr/bin/env python3
"""Safely materialize 20 rain-port existing art drafts and Fish A audio into trial runtime.

Trial assets are NOT user-approved final art. Preserve draft source hashes and
perform no writes when an existing target differs. Files use strict NN formats.
"""
import json,subprocess,hashlib,pathlib,shutil,html
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parent.parent
CAND=ROOT/'art/delivery-icons/rain-port'
SOURCE_AUDIO=ROOT/'art/audio/fish-rain-port/a-common-ja'
IMG=ROOT/'assets/img/delivery/rain-port'
AUDIO=ROOT/'assets/audio/delivery/rain-port'
REVIEW=ROOT/'art/delivery-icons/rain-port/preview.html'
V3={1,2,3,4,5,8,11,15,16,17,18,20}
STATUS='IN_GAME_TRIAL_PENDING_USER_REVIEW'
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
def loadwords():
 js="require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages.find(s=>s.id==='rain-port').words))"
 words=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT,encoding='utf8'))
 assert len(words)==20
 return words
def source_img(i,jp):
 version='rerender-original-style-v3' if i in V3 else 'rerender-qwen-v2'
 return CAND/version/f'{i:02}_{jp}_candidate.webp'
def mp3ok(f):
 b=f.read_bytes()
 return len(b)>1200 and (b.startswith(b'ID3') or (b[0]==255 and (b[1]&224)==224))
def create():
 words=loadwords()
 voice=json.loads((SOURCE_AUDIO/'manifest.json').read_text(encoding='utf8'))
 assert voice['stage']=='rain-port' and voice['model']=='s2.1-pro-free'
 assert voice['status']==STATUS and len(voice['results'])==20
 assert all(x['status'] in ('generated','cached') for x in voice['results'])
 actions=[];images=[];audios=[]
 for i,w in enumerate(words,1):
  src=source_img(i,w['jp'])
  target=IMG/f'{i:02}.webp'
  assert src.is_file(),src
  with Image.open(src) as im:
   assert im.size==(256,256) and im.mode=='RGBA',src
   a=im.getchannel('A');box=a.getbbox()
   assert box and box[0]>4 and box[1]>4 and box[2]<252 and box[3]<252,(src,box)
  record=dict(index=i,jp=w['jp'],kanji=w['kanji'],zh=w['zh'],file=target.name,sha256=sha(src),
    source=src.relative_to(ROOT).as_posix(),source_sha256=sha(src),art_status=STATUS)
  images.append(record);actions.append((src,target))
  sound=SOURCE_AUDIO/f'{i:02}.mp3'
  assert sound.is_file() and mp3ok(sound)
  dest=AUDIO/sound.name
  audios.append(dict(index=i,jp=w['jp'],kanji=w['kanji'],zh=w['zh'],file=dest.name,
    sha256=sha(sound),tts_text=voice['words'][i-1]['tts_text'],
    source=sound.relative_to(ROOT).as_posix(),source_sha256=sha(sound),
    review_status=STATUS))
  actions.append((sound,dest))
 for src,dest in actions:
  if dest.exists() and sha(src)!=sha(dest):
   raise RuntimeError('Refusing overwrite of preexisting approved/different file: '+str(dest))
 for src,dest in actions:
  dest.parent.mkdir(parents=True,exist_ok=True)
  if not dest.exists():shutil.copy2(src,dest)
  assert sha(src)==sha(dest)
 manifests=[
  (IMG/'manifest.json',dict(schema=1,stage='rain-port',kind='image',status=STATUS,
      count=20,format='webp',source_style='sumi-e ukiyo-e translucent wash',
      note='12 selected v3 candidates + 8 preserved v2; game integration for user visual review, not approved final yet',
      items=images)),
  (AUDIO/'manifest.json',dict(schema=1,stage='rain-port',kind='audio',status=STATUS,
      count=20,format='mp3',voice='A',voice_id=voice['voice_id'],model_used=voice['model'],
      no_pitch_tags=True,language_normalization='ja-JP',note='Voice/pronunciation awaits user listening approval',
      items=audios))
 ]
 for file,data in manifests:
  if file.exists():
   old=json.loads(file.read_text(encoding='utf8'))
   assert old==data,'Existing manifest not equal; do not overwrite '+str(file)
  else:file.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 # file:// trial preview; original reviewer can compare file numbers/words without app runtime
 rows=[]
 for i,w in enumerate(words,1):
  number=f'{i:02}'
  rows.append(f'<tr><td>{number}</td><td><img loading="lazy" src="../../../assets/img/delivery/rain-port/{number}.webp" alt="{html.escape(w["zh"])}"></td>'
    f'<td><strong>{html.escape(w["jp"])}</strong><div>{html.escape(w["zh"])}</div></td>'
    f'<td>{html.escape(audios[i-1]["tts_text"])}</td><td><button data-src="../../../assets/audio/delivery/rain-port/{number}.mp3">▶ 試聽 A</button></td></tr>')
 page='''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第二關雨夜港町 20詞 試玩待審</title><style>body{font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif;color:#f6e9d7;background:#1b2830;margin:0}main{max-width:910px;margin:20px auto;padding:16px}h1{font-size:23px}p{color:#d9c6aa}table{width:100%;border-spacing:0 6px}td{background:#2d3e47;padding:9px;border-block:1px solid #586562}td:first-child{border-radius:7px 0 0 7px}td:last-child{border-radius:0 7px 7px 0}img{width:70px;height:70px;object-fit:contain}button{background:#5d6e5e;color:#fff;border:1px solid #ad956c;padding:8px;border-radius:7px;cursor:pointer}button.active{background:#bc873d}#status{position:sticky;top:0;background:#34423f;padding:7px 12px;border-radius:7px}small{color:#e2b988}@media(max-width:520px){img{width:46px;height:46px}td{padding:4px}button{padding:5px}}</style></head><body><main><h1>雨夜港町：20 個貨物 icon + Fish Audio A 試聽</h1><p>圖片為前期已生成的 12 張 v3 + 8 張 v2 候選；語音為 S2.1 Pro Free A 聲線。<strong>這批已接入本機遊戲試玩，但仍需使用者確認美術及發音。</strong></p><div id="status">點選播放，注意鮭／鯛／蟹／貝等短詞發音。</div><table><thead><tr><th>#</th><th>圖</th><th>日文／中文</th><th>TTS輸入</th><th>聲音</th></tr></thead><tbody>__ROWS__</tbody></table><p>新檔案：<code>assets/img/delivery/rain-port/NN.webp</code>、<code>assets/audio/delivery/rain-port/NN.mp3</code>。不呼叫 Fish API。</p></main><script>const player=new Audio(),status=document.getElementById('status');let current;for(const b of document.querySelectorAll('button[data-src]')){b.onclick=()=>{player.pause();if(current)current.classList.remove('active');current=b;b.classList.add('active');player.src=b.dataset.src;status.textContent='播放中：'+b.closest('tr').cells[2].innerText;player.onended=()=>{status.textContent='播放完成';b.classList.remove('active')};player.onerror=()=>status.textContent='檔案載入失敗';player.play().catch(()=>status.textContent='無法播放')}};</script></body></html>'''.replace('__ROWS__','\n'.join(rows))
 REVIEW.write_text(page,encoding='utf8')
 print('PUBLISHED 20 trial image WebP + 20 A voice MP3, hashes verified')
 print('REVIEW',REVIEW)
 print('ART V3',sorted(V3),'V2',sorted(set(range(1,21))-V3))
if __name__=='__main__':create()
