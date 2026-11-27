#!/usr/bin/env python3
"""Safely remap Stage3 local trial assets to the user-approved final 20-word list.

Retain the original 20-word sources and manifests in art/; preserve the old
runtime bytes by verifying their checksums before replacing ONLY Stage3 trial
assets. Do not mark art/voice as user-approved. Never changes S1/S2 media.
"""
from __future__ import annotations
import hashlib, html, json, os, pathlib, shutil, subprocess
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parent.parent
STAGE='sakura-pass'
STATUS='IN_GAME_TRIAL_PENDING_USER_REVIEW'
VERSION='20261116-final-word-set'
OLD_IMG=ROOT/'art/delivery-icons/sakura-pass/selected'
OLD_AUDIO=ROOT/'art/audio/fish-sakura-pass/a-common-ja'
NEW_IMG=ROOT/'art/delivery-icons/sakura-pass/rewritten-20261116'
NEW_AUDIO=ROOT/'art/audio/fish-sakura-pass/new-six-20261116'
SELECTED_IMG=ROOT/'art/delivery-icons/sakura-pass/final-selected-20261116'
SELECTED_AUDIO=ROOT/'art/audio/fish-sakura-pass/final-selected-20261116'
RUNTIME_IMG=ROOT/'assets/img/delivery/sakura-pass'
RUNTIME_AUDIO=ROOT/'assets/audio/delivery/sakura-pass'
PREVIEW=ROOT/'art/delivery-icons/sakura-pass/preview.html'
NEW_WORDS={'き','かえる','あり','ほうき','ふえ','くすり'}
REPAINT=NEW_WORDS|{'うちわ'}
OLD_ORDER=['さくら','はな','はなたば','は','えだ','くさ','たね','うえきばち',
           'はちうえ','いし','すず','おまもり','くつ','かさ','だんご','おちゃ',
           'ちゃば','ゆのみ','せんす','うちわ']
FINAL_ORDER=['さくら','はな','は','えだ','くさ','たね','き','いし',
             'かえる','すず','おまもり','くつ','かさ','だんご',
             'おちゃ','うちわ','あり','ほうき','ふえ','くすり']

def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
def to_path(f):return f.relative_to(ROOT).as_posix()
def load(f):return json.loads(f.read_text(encoding='utf-8'))
def save_json(f, obj):f.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def mp3ok(f):
    b=f.read_bytes()
    return len(b)>1200 and (b[:3]==b'ID3' or (b[0]==255 and b[1]&224==224))
def validate_png(f):
    with Image.open(f) as img:
        assert img.size==(256,256) and img.mode=='RGBA',f
        bounds=img.getchannel('A').getbbox()
        assert bounds and bounds[0]>=3 and bounds[1]>=3 and bounds[2]<=253 and bounds[3]<=253,(f,bounds)
def words():
    js="require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages.find(s=>s.id==='sakura-pass').words))"
    result=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT,encoding='utf8'))
    assert [w['jp'] for w in result]==FINAL_ORDER
    return result
def write_preview(entries, audios):
    original=PREVIEW.read_text(encoding='utf-8')
    assert original.count('<tbody>')==original.count('</tbody>')==1
    rows=[]
    preview_audio=PREVIEW.parent/'review-audio'
    preview_audio.mkdir(parents=True,exist_ok=True)
    for i,w in enumerate(entries,1):
        num=f'{i:02}'
        icon=SELECTED_IMG/f'{num}.webp'
        voice=SELECTED_AUDIO/f'{num}.mp3'
        assert sha(icon)==sha(RUNTIME_IMG/f'{num}.webp')
        assert sha(voice)==sha(RUNTIME_AUDIO/f'{num}.mp3')
        audition=preview_audio/f'{num}.mp3'
        if not audition.exists() or sha(audition)!=sha(voice):
            shutil.copy2(voice,audition)
        icon_src=f'final-selected-20261116/{num}.webp?v={sha(icon)[:16]}'
        audio_src=f'review-audio/{num}.mp3?v={sha(voice)[:16]}'
        rows.append(
            f'<tr><td>{num}</td><td><img src="{icon_src}" alt="{html.escape(w["zh"])}" loading="lazy"></td>'
            f'<td><strong>{html.escape(w["jp"])}</strong><div>{html.escape(w["zh"])}</div></td>'
            f'<td>{html.escape(audios[i-1]["tts_text"])}</td>'
            f'<td><button data-src="{audio_src}">▶ 試聽</button></td></tr>')
    start=original.index('<tbody>')+len('<tbody>')
    end=original.index('</tbody>',start)
    page=original[:start]+'\n'.join(rows)+original[end:]
    page=page.replace('第三關 妖櫻山道｜20 個單字圖與 Fish Audio A',
                      '第三關 妖櫻山道｜最終 20 詞圖與 Fish Audio A')
    page=page.replace('圖片採原始水墨浮世繪候選，語音沿用前兩關 Fish A 聲線。',
                      '14 張舊圖沿用、6 張新圖＋圓形團扇重畫；14 段原音沿用、6 段新錄音；Fish A 聲線不變。')
    PREVIEW.write_text(page,encoding='utf-8')

def main():
    entries=words()
    old_im=load(RUNTIME_IMG/'manifest.json')
    old_au=load(RUNTIME_AUDIO/'manifest.json')
    assert old_im['status']==old_au['status']==STATUS
    assert old_im.get('version')!=VERSION and old_au.get('version')!=VERSION, 'Already installed; refuse re-application'
    assert [x['jp'] for x in old_im['items']]==OLD_ORDER
    assert [x['jp'] for x in old_au['items']]==OLD_ORDER
    new_voice=load(NEW_AUDIO/'manifest.json')
    assert new_voice['stage']==STAGE and new_voice['model']=='s2.1-pro-free'
    assert new_voice['voice_id']=='97eda32449cf443bbc4b8782853ca554'
    assert {w['jp'] for w in new_voice['words']}==NEW_WORDS
    assert len(new_voice['results'])==6 and all(r['status'] in ('generated','cached') for r in new_voice['results'])
    for index,(im,aud) in enumerate(zip(old_im['items'],old_au['items']),1):
        assert im['index']==aud['index']==index
        assert sha(RUNTIME_IMG/f'{index:02}.webp')==im['sha256']
        assert sha(RUNTIME_AUDIO/f'{index:02}.mp3')==aud['sha256']
        assert sha(OLD_IMG/f'{index:02}.webp')==im['sha256']
        assert sha(OLD_AUDIO/f'{index:02}.mp3')==aud['sha256']
    old_num={w:i for i,w in enumerate(OLD_ORDER,1)}
    new_num={w['jp']:w['index'] for w in new_voice['words']}
    selected=[];new_image_items=[];new_audio_items=[]
    for i,w in enumerate(entries,1):
        num=f'{i:02}';word=w['jp']
        image_source=(NEW_IMG/f'{word}_candidate.webp') if word in REPAINT else (OLD_IMG/f'{old_num[word]:02}.webp')
        audio_source=(NEW_AUDIO/f'{new_num[word]:02}.mp3') if word in NEW_WORDS else (OLD_AUDIO/f'{old_num[word]:02}.mp3')
        assert image_source.is_file(),image_source
        assert audio_source.is_file(),audio_source
        validate_png(image_source)
        assert mp3ok(audio_source),audio_source
        img_hash=sha(image_source);aud_hash=sha(audio_source)
        tts=(next(wv['tts_text'] for wv in new_voice['words'] if wv['jp']==word)
             if word in NEW_WORDS else old_au['items'][old_num[word]-1]['tts_text'])
        image_dest=SELECTED_IMG/f'{num}.webp'
        audio_dest=SELECTED_AUDIO/f'{num}.mp3'
        selected.extend([(image_source,image_dest),(audio_source,audio_dest)])
        new_image_items.append(dict(index=i,jp=word,kanji=w['kanji'],zh=w['zh'],
            file=f'{num}.webp',sha256=img_hash,source=to_path(image_source),
            source_sha256=img_hash,art_status=STATUS,
            handling=('redrawn' if word in REPAINT else 'reindexed-original')))
        new_audio_items.append(dict(index=i,jp=word,kanji=w['kanji'],zh=w['zh'],
            file=f'{num}.mp3',sha256=aud_hash,source=to_path(audio_source),
            source_sha256=aud_hash,tts_text=tts,review_status=STATUS,
            handling=('new-voice' if word in NEW_WORDS else 'reindexed-original')))
    # Prepare all source material safely before changing any runtime file.
    for src,dst in selected:
        if dst.is_file() and sha(dst)!=sha(src):raise RuntimeError('Unrecognized staged file: '+str(dst))
    for src,dst in selected:
        dst.parent.mkdir(parents=True,exist_ok=True)
        if not dst.is_file():shutil.copy2(src,dst)
        assert sha(src)==sha(dst)
    # Verified old runtime is saved in the original art/ selected and audio
    # directories; old manifests are copied as historical receipts.
    archive_img=ROOT/'art/delivery-icons/sakura-pass/archive/pre-final-20261116'
    archive_audio=ROOT/'art/audio/fish-sakura-pass/archive/pre-final-20261116'
    for archive,previous in ((archive_img,old_im),(archive_audio,old_au)):
        archive.mkdir(parents=True,exist_ok=True)
        manifest=archive/'manifest.json'
        if manifest.is_file():assert load(manifest)==previous
        else:save_json(manifest,previous)
    # Image/audio are runtime trial files explicitly requested to be revised;
    # never touch S1/S2. An atomic replace per file avoids partial writes.
    actions=[(SELECTED_IMG/f'{i:02}.webp',RUNTIME_IMG/f'{i:02}.webp') for i in range(1,21)]
    actions +=[(SELECTED_AUDIO/f'{i:02}.mp3',RUNTIME_AUDIO/f'{i:02}.mp3') for i in range(1,21)]
    for src,dst in actions:
        assert src.is_file() and dst.is_file()
        staging=dst.with_suffix(dst.suffix+'.new')
        shutil.copy2(src,staging)
        assert sha(staging)==sha(src)
        os.replace(staging,dst)
        assert sha(dst)==sha(src)
    image_manifest=dict(schema=1,stage=STAGE,kind='image',version=VERSION,
       status=STATUS,count=20,format='webp',
       source_style='original Stage1/2 sumi-e ukiyo-e washi Qwen Image21 prompt',
       note='14 original images retained by JP key; six new objects and corrected circular uchiwa generated in local ComfyUI; all require visual approval',
       items=new_image_items)
    audio_manifest=dict(schema=1,stage=STAGE,kind='audio',version=VERSION,
       status=STATUS,count=20,format='mp3',voice='A',
       voice_id='97eda32449cf443bbc4b8782853ca554',model_used='s2.1-pro-free',
       no_pitch_tags=True,language_normalization='ja-JP',
       note='14 original Fish Audio A clips retained by JP key; 6 new clips recorded with same voice; require listening approval',
       items=new_audio_items)
    save_json(RUNTIME_IMG/'manifest.json',image_manifest)
    save_json(RUNTIME_AUDIO/'manifest.json',audio_manifest)
    write_preview(entries,new_audio_items)
    print('FINAL STAGE3 TRIAL: 20/20 images, 20/20 audio, kept 14 original images, kept 14 original voices, replaced 7 art and 6 voices',flush=True)
    print('PREVIEW',PREVIEW,flush=True)
if __name__=='__main__':main()
