"""Subset official Moon Stars Kai T v1.105 Regular/Bold for local Phase 42.

This file has no effect on any game code unless run explicitly.
Source and OFL attribution: assets/fonts/PHASE42_TRIAL_FONT_SOURCES.md
Requires Python 3.11+, py7zr, fontTools and brotli.
"""
from __future__ import annotations

from pathlib import Path
from shutil import rmtree
from tempfile import TemporaryDirectory
import json
import string
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
import py7zr

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "fonts"
ARCHIVE = ROOT / "art" / "phase42-qwen21-calibration" / "fonts-source" / "MoonStarsKaiTTF-1.105.7z"
RELEASE_URL = "https://github.com/GuiWonder/MoonStarsKai/releases/download/1.105/MoonStarsKaiTTF.7z"
SOURCES = {
    "Regular": "YokaiTrialMoonStarsKaiT-Regular.woff2",
    "Bold": "YokaiTrialMoonStarsKaiT-Bold.woff2",
}

FILES = [
    ROOT / "js" / "ui-upgrade-trial.js",
    ROOT / "js" / "game.js",
    ROOT / "js" / "game-catalog.js",
    ROOT / "js" / "ui.js",
    ROOT / "index.html",
]
SAMPLE = (
    "月星楷 繁 正體 能力提升 選卡 確認 重抽 覺醒印"
    "妖刀 十字交斬 破甲斬 狐火 纏足焰 靈針 穿透增額 冰魄封靈"
    "長明燈油 神樂疾奏 金剛結界 陰陽符 天狐雷 霜月"
    "三發靈針，貫穿前方妖怪 恢復燈油 第 1 / 3 層"
)

def include(c: str) -> bool:
    cp = ord(c)
    return cp <= 127 or 0x2000 <= cp <= 0x206F or 0x2E80 <= cp <= 0xA000 or 0xF900 <= cp <= 0xFAFF


text = SAMPLE + "\n" + "\n".join(p.read_text(encoding="utf-8") for p in FILES if p.exists())
chars = {ord(ch) for ch in text if include(ch)}
chars.update(map(ord, string.printable + "・★◆×→←…％（）「」"))
cjk = {ord(ch) for ch in text if 0x3400 <= ord(ch) <= 0x9FFF}

ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
DEST.mkdir(parents=True, exist_ok=True)
if not ARCHIVE.exists():
    request = urllib.request.Request(RELEASE_URL, headers={"User-Agent": "YokaiDelivery-Phase42"})
    with urllib.request.urlopen(request, timeout=90) as response:
        ARCHIVE.write_bytes(response.read(30_000_000))
print("ARCHIVE", ARCHIVE.stat().st_size, flush=True)

report = {
    "source": RELEASE_URL,
    "version": "1.105",
    "needed_codepoints": len(chars),
    "needed_cjk": len(cjk),
    "fonts": {},
}

with TemporaryDirectory(prefix="yokai-moonstars-") as temp:
    folder = Path(temp)
    requested = ["MoonStarsKaiT-Regular.ttf", "MoonStarsKaiT-Bold.ttf", "LICENSE.txt"]
    with py7zr.SevenZipFile(ARCHIVE, mode="r") as archive:
        archive.extract(path=folder, targets=requested)

    LICENSE = folder / "LICENSE.txt"
    license_data = LICENSE.read_bytes()
    if b"SIL OPEN FONT LICENSE" not in license_data and b"Open Font License" not in license_data:
        raise ValueError("Unexpected license in official release")
    (DEST / "OFL-MoonStarsKai.txt").write_bytes(license_data)

    for weight, dest in SOURCES.items():
        source = folder / f"MoonStarsKaiT-{weight}.ttf"
        original = TTFont(source, lazy=False)
        coverage = set(original.getBestCmap())
        missing = sorted(cjk - coverage)
        if missing:
            raise ValueError(f"Moon Stars Kai T {weight} missing CJK glyphs: {''.join(map(chr,missing[:60]))}")
        opts = subset.Options()
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.name_languages = ["*"]
        opts.notdef_glyph = True
        subs = subset.Subsetter(options=opts)
        subs.populate(unicodes=chars & coverage)
        subs.subset(original)
        original.flavor = "woff2"
        out = DEST / dest
        original.save(out)
        original.close()
        result = TTFont(out)
        remains = set(result.getBestCmap())
        result.close()
        assert not (cjk - remains), "Subset unexpectedly removed required CJK glyphs"
        report["fonts"][weight] = {
            "source_filename": source.name,
            "file": str(out.relative_to(ROOT)).replace("\\", "/"),
            "bytes": out.stat().st_size,
            "missing_cjk_count": len(cjk - remains),
        }
        print(weight, "bytes", out.stat().st_size, "missing CJK", 0, flush=True)

audit = ROOT / "art" / "phase42-qwen21-calibration" / "phase42-moonstars-glyph-audit.json"
audit.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("AUDIT", audit, flush=True)
