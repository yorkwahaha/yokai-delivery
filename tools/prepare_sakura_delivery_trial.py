#!/usr/bin/env python3
"""Import Stage 3 existing sumi-e icon candidates and Fish A clips for local trial only.

Never overwrites an existing canonical file with different bytes. Keeps all
source drafts untouched and writes manifest provenance for per-word review.
"""
from __future__ import annotations
import hashlib
import html
import json
import pathlib
import shutil
import subprocess
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE_IMG = ROOT / "art/delivery-icons/sakura-pass"
STAGED_IMG = SOURCE_IMG / "selected"
SOURCE_AUDIO = ROOT / "art/audio/fish-sakura-pass/a-common-ja"
IMG = ROOT / "assets/img/delivery/sakura-pass"
AUDIO = ROOT / "assets/audio/delivery/sakura-pass"
PREVIEW = SOURCE_IMG / "preview.html"
STATUS = "IN_GAME_TRIAL_PENDING_USER_REVIEW"

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def words():
    js = "require('./js/delivery-lexicon.js');process.stdout.write(JSON.stringify(globalThis.DELIVERY_LEXICON.stages.find(s=>s.id==='sakura-pass').words))"
    entries = json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT, encoding="utf-8"))
    assert len(entries) == 20
    return entries

def good_mp3(file):
    data = file.read_bytes()
    return len(data) > 1200 and (data[:3] == b"ID3" or
            (len(data) > 2 and data[0] == 255 and (data[1] & 224) == 224))

def main():
    entries = words()
    voice = json.loads((SOURCE_AUDIO / "manifest.json").read_text(encoding="utf-8"))
    assert voice["stage"] == "sakura-pass" and voice["model"] == "s2.1-pro-free"
    assert voice["voice_id"] == "97eda32449cf443bbc4b8782853ca554"
    assert len(voice["words"]) == len(voice["results"]) == 20
    assert all(x["status"] in ("generated", "cached") for x in voice["results"])
    actions, images, audios = [], [], []
    STAGED_IMG.mkdir(parents=True, exist_ok=True)
    for i, word in enumerate(entries, 1):
        number = f"{i:02}"
        assert voice["words"][i - 1]["jp"] == word["jp"]
        src = SOURCE_IMG / f'{number}_{word["jp"]}_candidate.webp'
        assert src.is_file(), src
        with Image.open(src) as opened:
            original = opened.convert("RGBA")
        # Original 1024px 5x4 contact sheet created 204-205 x 256 cells.
        # Center each intact cell on a transparent 256x256 canvas; no stretch.
        assert 170 <= original.width <= 256 and original.height <= 256
        assert original.getchannel("A").getbbox(), src
        square = Image.new("RGBA", (256, 256))
        square.alpha_composite(original, ((256 - original.width) // 2,
                                           (256 - original.height) // 2))
        staged = STAGED_IMG / f"{number}.webp"
        if staged.exists():
            with Image.open(staged) as prior:
                assert prior.size == (256, 256) and prior.mode == "RGBA"
            # Existing staged candidate is authoritative; do not regenerate it.
        else:
            square.save(staged, "WEBP", quality=94, method=6)
        with Image.open(staged) as verified:
            assert verified.size == (256, 256) and verified.mode == "RGBA"
            box = verified.getchannel("A").getbbox()
            assert box and box[0] >= 4 and box[1] >= 4 and box[2] <= 252 and box[3] <= 252, (src, box)
        target_img = IMG / staged.name
        images.append(dict(index=i, jp=word["jp"], kanji=word["kanji"],
                           zh=word["zh"], file=staged.name, sha256=sha(staged),
                           source=src.relative_to(ROOT).as_posix(),
                           source_sha256=sha(src), art_status=STATUS))
        actions.append((staged, target_img))

        recording = SOURCE_AUDIO / f"{number}.mp3"
        assert recording.is_file() and good_mp3(recording), recording
        target_audio = AUDIO / recording.name
        audios.append(dict(index=i, jp=word["jp"], kanji=word["kanji"],
                           zh=word["zh"], file=recording.name, sha256=sha(recording),
                           tts_text=voice["words"][i - 1]["tts_text"],
                           source=recording.relative_to(ROOT).as_posix(),
                           source_sha256=sha(recording), review_status=STATUS))
        actions.append((recording, target_audio))
    for src, target in actions:
        if target.exists() and sha(target) != sha(src):
            raise RuntimeError("Refusing overwrite of existing runtime asset: " + str(target))
    for src, target in actions:
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            shutil.copy2(src, target)
        assert sha(src) == sha(target)
    manifests = [
        (IMG / "manifest.json", dict(schema=1, stage="sakura-pass", kind="image",
          status=STATUS, count=20, format="webp",
          source_style="original Stage 1/2 ukiyo-e sumi-e washi prompt",
          note="Original Stage 3 20 candidate sprites centered into 256x256 alpha images; awaiting visual review",
          items=images)),
        (AUDIO / "manifest.json", dict(schema=1, stage="sakura-pass", kind="audio",
          status=STATUS, count=20, format="mp3", voice="A",
          voice_id=voice["voice_id"], model_used=voice["model"],
          no_pitch_tags=True, language_normalization="ja-JP",
          note="Fish Audio A recordings generated for local test; awaiting listening approval",
          items=audios))
    ]
    for filename, data in manifests:
        if filename.exists():
            assert json.loads(filename.read_text(encoding="utf-8")) == data, filename
        else:
            filename.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    rows = []
    for i, word in enumerate(entries, 1):
        number = f"{i:02}"
        rows.append(
            f'<tr><td>{number}</td>'
            f'<td><img src="../../../assets/img/delivery/sakura-pass/{number}.webp" alt="{html.escape(word["zh"])}" loading="lazy"></td>'
            f'<td><strong>{html.escape(word["jp"])}</strong><div>{html.escape(word["zh"])}</div></td>'
            f'<td>{html.escape(audios[i-1]["tts_text"])}</td>'
            f'<td><button data-src="../../../assets/audio/delivery/sakura-pass/{number}.mp3">▶ 試聽</button></td></tr>')
    page = '''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第三關妖櫻山道 20詞圖音試聽</title><style>
body{font:15px/1.6 "Microsoft JhengHei",sans-serif;color:#f7e8d9;background:#1c292e;margin:0}
main{max-width:940px;margin:20px auto;padding:14px}h1{font-size:23px}p{color:#e5cdac}
table{width:100%;border-spacing:0 6px}td{padding:9px;background:#314044;border-block:1px solid #5b6862}
td:first-child{border-radius:7px 0 0 7px}td:last-child{border-radius:0 7px 7px 0}
img{width:76px;height:76px;object-fit:contain}button{border:1px solid #b6a26b;border-radius:6px;background:#536958;color:white;padding:9px;cursor:pointer}
#status{position:sticky;top:0;background:#45534b;padding:8px;border-radius:7px}
@media(max-width:540px){img{width:48px;height:48px}td{padding:4px}button{padding:5px}}
</style></head><body><main><h1>第三關 妖櫻山道｜20 個單字圖與 Fish Audio A</h1>
<p>圖片採原始水墨浮世繪候選，語音沿用前兩關 Fish A 聲線。<strong>已接本機試玩，未正式核准。</strong></p>
<div id="status">點選播放，逐字確認讀音與圖片；本頁不會呼叫 Fish API。</div>
<table><thead><tr><th>#</th><th>圖</th><th>日文／中文</th><th>TTS 文字</th><th>試聽</th></tr></thead><tbody>__ROWS__</tbody></table>
</main><script>
const player=new Audio(),status=document.getElementById("status");let current;
for(const button of document.querySelectorAll("button[data-src]"))button.onclick=()=>{
  player.pause();if(current)current.classList.remove("active");current=button;
  button.classList.add("active");player.src=button.dataset.src;
  status.textContent="播放中："+button.closest("tr").cells[2].innerText;
  player.onended=()=>{status.textContent="播放完成";button.classList.remove("active")};
  player.onerror=()=>status.textContent="音訊載入失敗";
  player.play().catch(()=>status.textContent="無法播放");
};
</script></body></html>'''.replace("__ROWS__", "\n".join(rows))
    PREVIEW.write_text(page, encoding="utf-8")
    print("STAGE3 TRIAL 20 transparent 256x256 WebP + 20 Fish A MP3: ALL CHECKED")
    print("PREVIEW", PREVIEW)

if __name__ == "__main__":
    main()
