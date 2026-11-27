"""Build local-only Phase 42 Traditional Chinese font trials.

Original project authors and OFL licensing are recorded in
assets/fonts/PHASE42_TRIAL_FONT_SOURCES.md.
Run from repository root with Python 3.11 + fonttools + brotli.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import json
import re
import string
import urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "fonts"
SOURCES = (
    ("bakudai", "https://cdn.jsdelivr.net/gh/max32002/bakudaifont@1.48/webfont/Bakudai-Regular.woff2", "YokaiTrialBakudaiTC.woff2"),
    ("masa", "https://cdn.jsdelivr.net/gh/max32002/masafont@2.1/webfont/MasaFont-Regular.woff2", "YokaiTrialMasaTC.woff2"),
    ("wenkai", "https://raw.githubusercontent.com/lxgw/LxgwWenkaiTC/main/fonts/TTF/LXGWWenKaiTC-Regular.ttf", "YokaiTrialWenKaiTC.woff2"),
)

SOURCE_TEXT = [
    ROOT / "js" / "ui-upgrade-trial.js",
    ROOT / "js" / "game.js",
    ROOT / "js" / "game-catalog.js",
    ROOT / "js" / "ui.js",
    ROOT / "index.html",
]
DISPLAY_EXAMPLES = (
    "能力提升 選擇一項技能 覺醒印 重抽 選卡 確認 第層 新解鎖"
    "莫大毛筆 正風毛筆 霞鶩文楷 TC 繁體楷筆 繁體行書 柔和手寫"
    "妖刀 狐火 天狐靈針 陰陽符 靈陣 天狐雷"
    "金剛結界 長明燈油 添燈香油 修羅破軍 神樂疾奏 心眼一閃"
    "神足草履 縮地瞬步 招財勾玉 妖刀・十字交斬 靈針・穿透增額"
    "恢復燈油 並震退周圍妖怪 三發靈針 貫穿前方妖怪"
)

def needed(ch: str) -> bool:
    cp = ord(ch)
    return (0x2E80 <= cp <= 0xA000 or 0xF900 <= cp <= 0xFAFF
            or 0x2000 <= cp <= 0x206F or cp <= 127)


def download(url: str, limit: int = 30_000_000) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "YokaiDelivery-Phase42-font-test"})
    with urllib.request.urlopen(req, timeout=65) as response:
        content = response.read(limit + 1)
        if len(content) > limit:
            raise RuntimeError("Source font exceeds expected maximum size")
        return content


all_text = DISPLAY_EXAMPLES + "\n" + "\n".join(
    f.read_text(encoding="utf-8") for f in SOURCE_TEXT if f.exists()
)
characters = {ord(c) for c in all_text if needed(c)}
characters.update(map(ord, string.printable + "・★◆×→←…％（）"))
core = {ord(c) for c in (DISPLAY_EXAMPLES + (ROOT / "js" / "ui-upgrade-trial.js").read_text(encoding="utf-8"))
        if 0x2E80 <= ord(c) <= 0xA000}
DEST.mkdir(parents=True, exist_ok=True)
result = {"subset_codepoints": len(characters), "core_codepoints": len(core), "fonts": {}}

for code, url, filename in SOURCES:
    print("Downloading", code, url, flush=True)
    data = download(url)
    font = TTFont(BytesIO(data), lazy=False)
    coverage = set(font.getBestCmap())
    missing = sorted(core - coverage)
    missing_text = "".join(chr(cp) for cp in missing)
    print(code, "source_bytes", len(data),
          "core_missing", len(missing), missing_text[:90], flush=True)
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.recalc_bounds = False
    options.notdef_glyph = True
    instance = subset.Subsetter(options=options)
    instance.populate(unicodes=characters & coverage)
    instance.subset(font)
    font.flavor = "woff2"
    out = DEST / filename
    if out.exists():
        print("Rebuilding trial font", str(out), flush=True)
    font.save(out)
    font.close()
    check = TTFont(out)
    actual = set(check.getBestCmap())
    check.close()
    assert all(cp in actual for cp in characters & coverage)
    result["fonts"][code] = {
        "source": url,
        "source_bytes": len(data),
        "output": str(out.relative_to(ROOT)).replace("\\", "/"),
        "output_bytes": out.stat().st_size,
        "core_missing_count": len(missing),
        "core_missing": missing_text,
        "sample_missing": "".join(chr(cp) for cp in sorted({ord(c) for c in DISPLAY_EXAMPLES}-coverage)),
    }
    print("OUTPUT", out.name, out.stat().st_size, "bytes", flush=True)

report = ROOT / "art" / "phase42-qwen21-calibration" / "phase42-font-glyph-audit.json"
report.parent.mkdir(exist_ok=True, parents=True)
report.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
print("AUDIT", str(report), flush=True)
