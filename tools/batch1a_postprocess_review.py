#!/usr/bin/env python3
"""Batch 1A Review Post-Processing.

Non-destructive thumbnail and WebP generation for Preview_index.html.
Preserves original 2K PNG candidates intact.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "art" / "batch1a-nb21-review-20261020"
REVIEW_DIR.mkdir(parents=True, exist_ok=True)

STAGES = [
    {"num": 1, "name": "夜行町", "slug": "stage1-night-town"},
    {"num": 2, "name": "雨夜港町", "slug": "stage2-rain-port"},
    {"num": 3, "name": "妖櫻山道", "slug": "stage3-sakura-pass"},
    {"num": 4, "name": "竹影迷宮", "slug": "stage4-bamboo-maze"},
    {"num": 5, "name": "百鬼京都", "slug": "stage5-hyakki-kyoto"},
    {"num": 6, "name": "雪燈山寺", "slug": "stage6-snow-temple"},
    {"num": 7, "name": "幽世渡口", "slug": "stage7-spirit-ferry"},
    {"num": 8, "name": "黃泉境", "slug": "stage8-yomi"},
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def postprocess():
    results = []
    print(f"Creating review assets in {REVIEW_DIR}...")

    for st in STAGES:
        num = st["num"]
        slug = st["slug"]
        name = st["name"]
        orig_rel = f"art/{slug}/scene/G_floor_triptych_candidate_nb21_v1.png"
        orig_path = ROOT / orig_rel

        if not orig_path.exists():
            print(f"[WARN] Original missing: {orig_rel}")
            continue

        orig_sha = sha256_file(orig_path)
        orig_bytes = orig_path.stat().st_size

        with Image.open(orig_path) as img:
            w, h = img.size
            # Generate 800px width thumbnail maintaining aspect ratio
            thumb_w = 800
            thumb_h = int(h * (thumb_w / w))
            thumb_img = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)

            webp_name = f"thumb_stage{num}_floor_triptych_candidate_nb21_v1.webp"
            webp_path = REVIEW_DIR / webp_name
            thumb_img.save(webp_path, format="WEBP", quality=85)

            png_thumb_name = f"thumb_stage{num}_floor_triptych_candidate_nb21_v1.png"
            png_thumb_path = REVIEW_DIR / png_thumb_name
            thumb_img.save(png_thumb_path, format="PNG", optimize=True)

        webp_sha = sha256_file(webp_path)
        png_thumb_sha = sha256_file(png_thumb_path)

        item = {
            "stage_number": num,
            "stage_name": name,
            "stage_slug": slug,
            "original_png": orig_rel,
            "original_sha256": orig_sha,
            "original_bytes": orig_bytes,
            "original_dimensions": {"width": w, "height": h},
            "thumbnail_webp": f"art/batch1a-nb21-review-20261020/{webp_name}",
            "thumbnail_webp_sha256": webp_sha,
            "thumbnail_webp_bytes": webp_path.stat().st_size,
            "thumbnail_png": f"art/batch1a-nb21-review-20261020/{png_thumb_name}",
            "thumbnail_png_sha256": png_thumb_sha,
            "thumbnail_png_bytes": png_thumb_path.stat().st_size,
            "thumbnail_dimensions": {"width": thumb_w, "height": thumb_h},
            "status": "ART_CANDIDATE",
            "approval_state": "WAITING_HUMAN",
            "model": "gemini-nano-banana-2.1",
            "note": "Floor triptych concept art; not a seamless 512 tile.",
        }
        results.append(item)
        print(f"  Stage {num} ({slug}): 2K {w}x{h} ({orig_bytes/1024/1024:.2f}MB) -> WebP ({webp_path.stat().st_size/1024:.1f}KB), PNG thumb ({png_thumb_path.stat().st_size/1024:.1f}KB)")

    manifest_path = REVIEW_DIR / "review_manifest.json"
    manifest_data = {
        "batch_id": "batch1a-nb21-floor-triptych-20261020",
        "created_utc": "2026-10-20T09:08:00Z",
        "total_stages": len(results),
        "items": results,
    }
    manifest_path.write_text(json.dumps(manifest_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Review post-processing complete. Manifest saved to {manifest_path}")


if __name__ == "__main__":
    postprocess()
