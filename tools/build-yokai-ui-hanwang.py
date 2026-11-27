"""Build the local UI HanWang YanKai web subset from the GPL-2.0 source.

Source/author/license provenance is documented in
assets/fonts/PHASE42_TRIAL_FONT_SOURCES.md and GPL-2.0-HanWang.txt.
The original trial subset is intentionally left untouched.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import string
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "assets" / "fonts"
ORIGINAL = "https://ftpmirror.your.org/pub/FreeBSD-Archive/ports/distfiles/zh-wangttf/wt064.ttf"
OUTPUT = FONTS / "YokaiUIHanWangYanKai.woff2"
TRIAL = FONTS / "YokaiTrialHanWangYanKai.woff2"
TEXT_SOURCES = [
    ROOT / "js" / name
    for name in ("ui.js", "game.js", "game-catalog.js", "story.js", "stories.js")
]
SAMPLE = (
    "夜已破曉 燈油已盡 送達 誤配 本局 最高 新紀錄 夜行賞金 "
    "夜行町的言靈恢復安寧，道路通往海霧瀰漫的碼頭。 "
    "繼續夜行 秘術卡片 單字圖鑑 夜行設定 回旅路地圖 返回主選單 "
    "0123456789:,・？！"
)

request = urllib.request.Request(ORIGINAL, headers={"User-Agent": "YokaiDelivery-Local-UI-Font"})
with urllib.request.urlopen(request, timeout=45) as response:
    binary = response.read(12_000_001)
if len(binary) > 12_000_000:
    raise RuntimeError("Unexpected oversized HanWang font")

font = TTFont(BytesIO(binary), lazy=False)
coverage = set(font.getBestCmap())
existing = TTFont(TRIAL)
old_chars = set(existing.getBestCmap())
existing.close()
text = SAMPLE + "".join(p.read_text(encoding="utf-8") for p in TEXT_SOURCES if p.exists())
needed = old_chars | {ord(ch) for ch in text + string.printable if ord(ch) < 128 or
                      0x2000 <= ord(ch) <= 0x206F or 0x2E80 <= ord(ch) <= 0xA000}
# The original GPL font lacks U+30FB (the Japanese interpunct). Let the
# fallback face supply punctuation while requiring every Chinese/number glyph.
required = {ord(ch) for ch in SAMPLE
            if 0x4E00 <= ord(ch) <= 0x9FFF or '0' <= ch <= '9'}
missing = required - coverage
if missing:
    raise RuntimeError("Missing original glyphs: " + "".join(map(chr, sorted(missing))))

opts = subset.Options()
opts.layout_features = ["*"]
opts.name_IDs = ["*"]
opts.name_languages = ["*"]
opts.notdef_glyph = True
subsetter = subset.Subsetter(options=opts)
subsetter.populate(unicodes=needed & coverage)
subsetter.subset(font)
font.flavor = "woff2"
font.save(OUTPUT)
font.close()

check = TTFont(OUTPUT)
actual = set(check.getBestCmap())
check.close()
assert required <= actual
print(f"{OUTPUT.relative_to(ROOT)}: {len(actual)} glyphs; {OUTPUT.stat().st_size} bytes")
