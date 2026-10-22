#!/usr/bin/env python3
"""Controlled Nano Banana 2.1 art generation. Dry-run by default; no API call without --execute."""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import mimetypes
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = (ROOT / "art" / "fusion" / "candidates").resolve()
STAGE_SCENE_WHITELIST = {
    # Batch 1A Floor Triptychs (Completed)
    "art/stage1-night-town/scene/G_floor_triptych_candidate_nb21_v1.png",
    "art/stage2-rain-port/scene/G_floor_triptych_candidate_nb21_v1.png",
    "art/stage3-sakura-pass/scene/G_floor_triptych_candidate_nb21_v1.png",
    "art/stage4-bamboo-maze/scene/G_floor_triptych_candidate_nb21_v1.png",
    "art/stage5-hyakki-kyoto/scene/G_floor_triptych_candidate_nb21_v1.png",
    "art/stage6-snow-temple/scene/G_floor_triptych_candidate_nb21_v1.png",
    "art/stage7-spirit-ferry/scene/G_floor_triptych_candidate_nb21_v1.png",
    "art/stage8-yomi/scene/G_floor_triptych_candidate_nb21_v1.png",
    # Stage 2 Nano Production Candidates (Pending Budget Authorization - S2_NANO_ART_WAITING_BUDGET)
    "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.png",
    "art/stage2-rain-port/s2-ground-redraw-20261021/G_ground_stone_nano_nb21_v2.png",
    "art/stage2-rain-port/scene/G_ground_stone_var1_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/G_ground_wood_dock_var1_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/G_trans_stone_wood_h_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/G_trans_stone_wood_v_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/H_port_warehouse_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/H_fishmonger_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/H_port_tavern_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/H_wharf_shop_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/H_port_teahouse_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/G_port_sea_surface_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/O_port_north_cliff_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/O_prop_anchor_gear_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/O_prop_cargo_crates_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/O_prop_mooring_post_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/O_prop_port_boat_nano_nb21_v1.png",
    "art/stage2-rain-port/scene/O_prop_port_lighthouse_nano_nb21_v1.png",
}
MODEL = "gemini-nano-banana-2.1"
IMAGE_PRICES = {"1K": 0.0336, "2K": 0.0504, "4K": 0.113}
INPUT_RESERVE = 0.02  # Conservative planning reserve, NOT a billing hard cap.


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def project_path(value: str) -> Path:
    path = Path(value)
    return (path if path.is_absolute() else ROOT / path).resolve()


def fail(message: str) -> None:
    raise ValueError(message)


def prepare(args: argparse.Namespace) -> dict:
    prompt_path = project_path(args.prompt_file)
    if not prompt_path.is_file() or not prompt_path.is_relative_to(ROOT):
        fail("Prompt must be an existing text file inside the project.")
    raw_prompt = prompt_path.read_bytes()
    if not 20 <= len(raw_prompt) <= 16000:
        fail("Prompt must contain 20..16000 bytes.")
    prompt = raw_prompt.decode("utf-8-sig").strip()
    if not prompt:
        fail("Empty prompt.")

    target = project_path(args.output)
    if target.suffix.lower() != ".png":
        fail("Output must be .png file.")

    # Check fusion candidates path
    is_fusion = target.is_relative_to(CANDIDATES)
    if is_fusion:
        rel_target = target.relative_to(CANDIDATES)
        if len(rel_target.parts) != 2 or not rel_target.parts[0].startswith("fusion_"):
            fail("Use candidates/fusion_<id>/<name>_vNN.png.")
    else:
        # Check stage scene whitelist
        if not target.is_relative_to(ROOT):
            fail("Output must be inside the project root.")
        rel_output = target.relative_to(ROOT)
        normalized = str(rel_output).replace("\\", "/")
        if normalized not in STAGE_SCENE_WHITELIST:
            fail(f"Output path not in fusion candidates or stage scene whitelist: {normalized}")
    manifest = target.with_suffix(".json")
    refs = []
    if len(args.reference) > 4:
        fail("The first pilot allows at most four approved reference images.")
    for ref_arg in args.reference:
        path = project_path(ref_arg)
        if not path.is_file() or not path.is_relative_to(ROOT):
            fail("Reference file missing or outside project.")
        mime = mimetypes.guess_type(path.name)[0]
        if mime not in ("image/png", "image/jpeg", "image/webp"):
            fail("References must be PNG, JPEG or WebP.")
        raw = path.read_bytes()
        if not 100 <= len(raw) <= 8 * 1024 * 1024:
            fail("Reference must be between 100 bytes and 8 MiB.")
        refs.append({"path": str(path.relative_to(ROOT)), "sha256": sha256(raw),
                     "mime": mime, "bytes": raw})
    identity = {
        "model": MODEL,
        "prompt_sha256": sha256(raw_prompt),
        "references": [{"path": x["path"], "sha256": x["sha256"]} for x in refs],
        "image_size": args.size,
        "aspect_ratio": args.aspect_ratio,
    }
    request_sha = sha256(json.dumps(identity, sort_keys=True).encode())
    estimate = round(IMAGE_PRICES[args.size] + INPUT_RESERVE, 4)
    return {"prompt": prompt, "prompt_file": str(prompt_path.relative_to(ROOT)),
            "target": target, "manifest": manifest, "refs": refs,
            "identity": identity, "request_sha": request_sha, "estimate": estimate}


def generate(args: argparse.Namespace) -> int:
    job = prepare(args)
    target, manifest = job["target"], job["manifest"]
    public = {
        "status": "DRY_RUN" if not args.execute else "READY_TO_GENERATE",
        "model": MODEL,
        "output": str(target),
        "manifest": str(manifest),
        "request_sha256": job["request_sha"],
        "references": [x["path"] for x in job["refs"]],
        "size": args.size,
        "aspect_ratio": args.aspect_ratio,
        "estimated_usd_including_reserve": job["estimate"],
        "note": "Estimate only; not a guaranteed provider billing cap.",
    }
    # Never overwrite or charge again for an identical saved artifact.
    if target.exists() or manifest.exists():
        if target.exists() and manifest.exists():
            existing = json.loads(manifest.read_text(encoding="utf-8"))
            if existing.get("request_sha256") == job["request_sha"]:
                public["status"] = "CACHED"
                print(json.dumps(public, ensure_ascii=False, indent=2))
                return 0
        fail("Target already exists. Use a new _vNN filename; existing art is protected.")

    if not args.execute:
        public["status"] = "DRY_RUN_ONLY_NO_API_CALL"
        print(json.dumps(public, ensure_ascii=False, indent=2))
        return 0

    if args.max_cost_usd is None or args.max_cost_usd < job["estimate"]:
        fail("Paid calls require --max-cost-usd >= the conservative estimated cost.")
    if os.getenv("NANOBANANA_APPROVED") != "YES":
        fail("Paid calls disabled. A user must explicitly enable NANOBANANA_APPROVED=YES.")
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        fail("GEMINI_API_KEY not defined in this process. Never put the key in arguments or files.")

    # Google removed legacy Interactions in June 2026; prevent avoidable paid 400s.
    # These dependencies are intentionally optional when running --dry-run.
    from importlib.metadata import PackageNotFoundError, version
    try:
        sdk_version = version("google-genai")
    except PackageNotFoundError:
        fail("google-genai is missing. Use a dedicated Python 3.11 venv and install google-genai>=2.0.0 and Pillow.")
    try:
        sdk_major = int(sdk_version.split(".", 1)[0])
    except (ValueError, IndexError):
        sdk_major = 0
    if sdk_major < 2:
        fail(f"google-genai {sdk_version} uses the removed legacy Interactions API. Please run this bridge with a dedicated venv having google-genai>=2.0.0; do not upgrade shared Gemini TTS environments.")
    from google import genai
    from PIL import Image

    contents = [{"type": "text", "text": job["prompt"]}]
    contents += [{
        "type": "image",
        "data": base64.b64encode(x["bytes"]).decode("ascii"),
        "mime_type": x["mime"],
    } for x in job["refs"]]
    client = genai.Client(api_key=key)
    try:
        response = client.interactions.create(
            model=MODEL,
            input=contents if job["refs"] else job["prompt"],
            response_format={
                "type": "image",
                "mime_type": "image/jpeg",
                "aspect_ratio": args.aspect_ratio,
                "image_size": args.size,
            },
        )
        output_image = response.output_image
        if output_image is None or not output_image.data:
            fail("Model returned no image. Check the interaction response in the provider console.")
        raw = base64.b64decode(output_image.data)
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            dims = {"width": image.width, "height": image.height,
                    "has_alpha": "A" in image.getbands()}
            converted = io.BytesIO()
            image.save(converted, format="PNG")
            png = converted.getvalue()
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as f:
            f.write(png)
        metadata = {
            **job["identity"], "request_sha256": job["request_sha"],
            "prompt_file": job["prompt_file"],
            "reference_files": [x["path"] for x in job["refs"]],
            "image_sha256": sha256(png), "image_bytes": len(png),
            "image": dims, "status": "ART_CANDIDATE",
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "estimated_usd_including_reserve": job["estimate"],
            "note": "Alpha and final art approval require manual verification.",
        }
        with manifest.open("x", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        public.update({"status": "ART_CANDIDATE", "image": dims,
                       "image_sha256": sha256(png)})
        print(json.dumps(public, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        error = str(exc).replace(key, "[REDACTED]")
        print(json.dumps({"status": "FAILED", "message": error}, ensure_ascii=False),
              file=sys.stderr)
        return 1
    finally:
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt-file", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--reference", action="append", default=[])
    parser.add_argument("--size", choices=("1K", "2K", "4K"), default="1K")
    parser.add_argument("--aspect-ratio", choices=("1:1", "3:2", "2:3", "16:9", "9:16"), default="3:2")
    parser.add_argument("--execute", action="store_true",
                        help="Requires a user's separate spending approval and environment opt-in.")
    parser.add_argument("--max-cost-usd", type=float, default=None)
    args = parser.parse_args()
    try:
        return generate(args)
    except (ValueError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "BLOCKED", "reason": str(exc)}, ensure_ascii=False),
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
