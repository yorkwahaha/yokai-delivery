"""Report cmap coverage for in-repo UI, eight stages and thirteen skills."""
from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess

from fontTools.ttLib import TTFont
from fontTools.ttLib import woff2

# Node is already a project dependency. It can provide the read-only Brotli
# decoder when the Python environment has fontTools without the optional wheel.
if not woff2.haveBrotli:
    def decode_brotli(data, expected_size, label):
        raw = subprocess.run(
            ["node", "-e", "process.stdout.write(require('node:zlib').brotliDecompressSync(require('node:fs').readFileSync(0)))"],
            input=data, stdout=subprocess.PIPE, check=True,
        ).stdout
        if len(raw) != expected_size:
            raise ValueError(f"Incorrect decompressed size for {label}")
        return raw

    woff2._brotliDecompress = decode_brotli
    woff2.haveBrotli = True

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "skills": ("game-catalog.js", "game-skill-expansion.js", "evolutions.js", "ui-upgrade-trial.js"),
    "stages_bosses": ("words.js", "story-dialogue.js", "boss-roster-trial.js", "kyoto-scene-art.js",
                     "snow-temple-art.js", "late-stage-art.js", "stage58-audio.js"),
    "ui": ("ui.js", "ui-compendium.js", "ui-compendium-model.js", "game.js", "controls.js",
           "overworld.js", "dev-active-skill-lab.js", "dev-mode.js", "../index.html"),
}
FILES = {
    "hanwang_local": "YokaiUIHanWangYanKai.woff2",
    "moonstars": "YokaiTrialMoonStarsKaiT-Regular.woff2",
    "cargo_tc": "YokaiCargoTC.woff2",
    "noto_jp": "YokaiNotoSansJP.woff2",
}
TEXT = re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`')
GLYPH = re.compile(r"[\u2e80-\u2fff\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef\U00020000-\U000323af]")


def glyphs(name):
    content = (ROOT/"js"/name).read_text(encoding="utf-8-sig")
    if name.endswith(".html"):
        return set(GLYPH.findall(re.sub(r"<!--[\s\S]*?-->", "", content)))
    return {ch for word in TEXT.findall(content) if word.startswith(('"', "'", chr(96))) for ch in GLYPH.findall(word)}


def audit():
    coverage = {}
    missing_files = []
    for name, file in FILES.items():
        path = ROOT/"assets/fonts"/file
        if not path.is_file():
            missing_files.append(file)
            continue
        with TTFont(path) as font:
            coverage[name] = {chr(code) for code in font.getBestCmap()}
    coverage["shipped_union"] = set().union(*(coverage.get(key, set()) for key in ("moonstars","cargo_tc","noto_jp")))
    groups = {group: set().union(*(glyphs(name) for name in names)) for group,names in SOURCES.items()}
    groups["all"] = set().union(*groups.values())
    return {"missing_files": missing_files, "groups": {
        name: {"characters": len(chars), "missing": {font: "".join(sorted(chars - known))
                 for font,known in coverage.items()}} for name, chars in groups.items()}}


if __name__ == "__main__":
    print(json.dumps(audit(), ensure_ascii=False, indent=2))
