#!/usr/bin/env python3
"""Prepare the specifically approved PURE Yokai Delivery overworld image.

No game code or scene coordinates are modified. Prefer the 4K image when present,
then encode a smaller WebP at assets/img/overworld_approved_v2.webp.

Usage:
  python tools/prepare-approved-overworld.py
  python tools/prepare-approved-overworld.py --source "artifacts/references/霧嵐之境_櫻花雪域幻境地圖.png"
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
INPUT_DIR = ROOT / "artifacts" / "references"
INPUT_NAMES = (
    ROOT / "assets" / "img" / "overworld_approved_v2_4k.webp",
    INPUT_DIR / "霧嵐之境_櫻花雪域幻境地圖.png",
    INPUT_DIR / "overworld-approved-v2.png",
)
WEBP_PATH = ROOT / "assets" / "img" / "overworld_approved_v2.webp"
MANIFEST_PATH = ROOT / "artifacts" / "references" / "overworld-approved-v2.manifest.json"


def prepare(source: Path, output: Path, manifest: Path) -> dict:
    source = source.resolve()
    if not source.is_file():
        raise FileNotFoundError(
            f"Approved PURE map not found: {source}\n"
            "Use the selected second image, NOT the subsequent eight-button overlay."
        )
    # The annotated A4 concept image is not a valid playable background.
    if "八關地圖" in source.name or "櫻花妖境" in source.name:
        raise ValueError("The annotated A4 UI overlay cannot be used as a game background.")
    with Image.open(source) as raw:
        raw.verify()
    with Image.open(source) as raw:
        img = ImageOps.exif_transpose(raw)
        width, height = img.size
        if width < 1400 or height < 750:
            raise ValueError(f"Unexpectedly small image {width}x{height}; check the source.")
        aspect = width / height
        if not 1.5 < aspect < 2.1:
            raise ValueError(f"Unexpected aspect ratio {aspect:.3f}; check the source.")
        # Preserve composition and original pixels, don't upscale/crop without A4 approval.
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        output.parent.mkdir(parents=True, exist_ok=True)
        # Preserve the 4K pixels, no cropping or rescaling; quality 94 gives ~2 MB.
        img.save(output, "WEBP", quality=94 if width >= 3800 else 84, method=6)
    info = {
        "status": "asset_prepared",
        "selected_artwork": "second PURE environment art (not A4 UI overlay)",
        "source_path": str(source.relative_to(ROOT)) if source.is_relative_to(ROOT) else str(source),
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "source_pixels": [width, height],
        "output_pixels": [width, height],
        "source_bytes": source.stat().st_size,
        "webp_path": str(output.relative_to(ROOT)) if output.is_relative_to(ROOT) else str(output),
        "webp_bytes": output.stat().st_size,
        "webp_savings_pct": round((1-output.stat().st_size/source.stat().st_size)*100, 1)
    }
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return info


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=None, help="source PNG, absolute or relative to project")
    parser.add_argument("--output", default=None, help="output WebP, relative to project by default")
    parser.add_argument("--manifest", default=None, help="manifest JSON, relative to project by default")
    args = parser.parse_args()
    if args.source:
        path = Path(args.source)
        source = path if path.is_absolute() else ROOT / path
    else:
        source = next((item for item in INPUT_NAMES if item.is_file()), INPUT_NAMES[0])
    output = ROOT / args.output if args.output else WEBP_PATH
    manifest = ROOT / args.manifest if args.manifest else MANIFEST_PATH
    try:
        result = prepare(source, output, manifest)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError) as exc:
        print(f"[overworld preparation] {exc}", file=sys.stderr)
        sys.exit(2)
