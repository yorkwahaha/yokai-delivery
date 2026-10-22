#!/usr/bin/env python3
"""Batch 1A Floor Triptych Serial Art Batch Runner.

Batch ID: batch1a-nb21-floor-triptych-20261020
Model: gemini-nano-banana-2.1
Target: 8 stages, 2K, 3:2, Group B floor triptych candidates.
Budgets: Total hard limit US$3.00, Internal stop line US$2.40.
Estimated per image: US$0.0704 (Image: $0.0504 + Input reserve: $0.02).
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PYTHON_EXE = "I:/Tools/NanoBanana21/.venv/Scripts/python.exe"
BRIDGE_SCRIPT = ROOT / "tools" / "nanobanana_generate.py"

BATCH_ID = "batch1a-nb21-floor-triptych-20261020"
LEDGER_DIR = ROOT / "scratch" / "batch1a-nb21-paid-20261020"
LEDGER_PATH = LEDGER_DIR / "ledger.json"

BUDGET_CEILING_USD = 3.00
INTERNAL_STOP_USD = 2.40
ESTIMATED_PER_IMAGE_2K_USD = 0.0704  # 0.0504 image + 0.02 input reserve

STAGES = [
    {
        "stage": "stage1-night-town",
        "prompt_file": "art/batch1a-nb21-prep-20261020/stage1_night_town_prompt.txt",
        "output_png": "art/stage1-night-town/scene/G_floor_triptych_candidate_nb21_v1.png",
        "manifest_json": "art/stage1-night-town/scene/G_floor_triptych_candidate_nb21_v1.json",
    },
    {
        "stage": "stage2-rain-port",
        "prompt_file": "art/batch1a-nb21-prep-20261020/stage2_rain_port_prompt.txt",
        "output_png": "art/stage2-rain-port/scene/G_floor_triptych_candidate_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/G_floor_triptych_candidate_nb21_v1.json",
    },
    {
        "stage": "stage3-sakura-pass",
        "prompt_file": "art/batch1a-nb21-prep-20261020/stage3_sakura_pass_prompt.txt",
        "output_png": "art/stage3-sakura-pass/scene/G_floor_triptych_candidate_nb21_v1.png",
        "manifest_json": "art/stage3-sakura-pass/scene/G_floor_triptych_candidate_nb21_v1.json",
    },
    {
        "stage": "stage4-bamboo-maze",
        "prompt_file": "art/batch1a-nb21-prep-20261020/stage4_bamboo_maze_prompt.txt",
        "output_png": "art/stage4-bamboo-maze/scene/G_floor_triptych_candidate_nb21_v1.png",
        "manifest_json": "art/stage4-bamboo-maze/scene/G_floor_triptych_candidate_nb21_v1.json",
    },
    {
        "stage": "stage5-hyakki-kyoto",
        "prompt_file": "art/batch1a-nb21-prep-20261020/stage5_hyakki_kyoto_prompt.txt",
        "output_png": "art/stage5-hyakki-kyoto/scene/G_floor_triptych_candidate_nb21_v1.png",
        "manifest_json": "art/stage5-hyakki-kyoto/scene/G_floor_triptych_candidate_nb21_v1.json",
    },
    {
        "stage": "stage6-snow-temple",
        "prompt_file": "art/batch1a-nb21-prep-20261020/stage6_snow_temple_prompt.txt",
        "output_png": "art/stage6-snow-temple/scene/G_floor_triptych_candidate_nb21_v1.png",
        "manifest_json": "art/stage6-snow-temple/scene/G_floor_triptych_candidate_nb21_v1.json",
    },
    {
        "stage": "stage7-spirit-ferry",
        "prompt_file": "art/batch1a-nb21-prep-20261020/stage7_spirit_ferry_prompt.txt",
        "output_png": "art/stage7-spirit-ferry/scene/G_floor_triptych_candidate_nb21_v1.png",
        "manifest_json": "art/stage7-spirit-ferry/scene/G_floor_triptych_candidate_nb21_v1.json",
    },
    {
        "stage": "stage8-yomi",
        "prompt_file": "art/batch1a-nb21-prep-20261020/stage8_yomi_prompt.txt",
        "output_png": "art/stage8-yomi/scene/G_floor_triptych_candidate_nb21_v1.png",
        "manifest_json": "art/stage8-yomi/scene/G_floor_triptych_candidate_nb21_v1.json",
    },
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def load_or_init_ledger() -> dict:
    LEDGER_DIR.mkdir(parents=True, exist_ok=True)
    if LEDGER_PATH.exists():
        try:
            return json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[WARN] Failed to parse existing ledger: {e}, backing up.")
            backup_path = LEDGER_DIR / f"ledger_backup_{int(datetime.now().timestamp())}.json"
            LEDGER_PATH.rename(backup_path)

    ledger = {
        "batch_id": BATCH_ID,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "model": "gemini-nano-banana-2.1",
        "size": "2K",
        "aspect_ratio": "3:2",
        "budget_ceiling_usd": BUDGET_CEILING_USD,
        "internal_stop_usd": INTERNAL_STOP_USD,
        "estimated_per_image_usd": ESTIMATED_PER_IMAGE_2K_USD,
        "total_images_planned": len(STAGES),
        "total_images_attempted": 0,
        "total_images_succeeded": 0,
        "total_reserved_cost_usd": 0.0,
        "actual_google_billing_usd": None,
        "status": "IN_PROGRESS",
        "items": [],
    }
    save_ledger(ledger)
    return ledger


def save_ledger(ledger: dict) -> None:
    ledger["updated_utc"] = datetime.now(timezone.utc).isoformat()
    LEDGER_PATH.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")


def get_current_reserved(ledger: dict) -> float:
    return round(sum(item.get("reserved_cost_usd", 0.0) for item in ledger.get("items", [])), 4)


def run_batch() -> int:
    print(f"=== Starting Batch 1A Floor Triptych Generation ===")
    print(f"Batch ID: {BATCH_ID}")
    print(f"Python: {PYTHON_EXE}")
    print(f"Bridge: {BRIDGE_SCRIPT}")
    print(f"Budget: Ceiling ${BUDGET_CEILING_USD:.2f}, Stop line ${INTERNAL_STOP_USD:.2f}")

    ledger = load_or_init_ledger()

    for idx, stage_info in enumerate(STAGES, start=1):
        stage_name = stage_info["stage"]
        prompt_rel = stage_info["prompt_file"]
        output_rel = stage_info["output_png"]
        manifest_rel = stage_info["manifest_json"]

        prompt_path = ROOT / prompt_rel
        output_path = ROOT / output_rel
        manifest_path = ROOT / manifest_rel

        print(f"\n[{idx}/{len(STAGES)}] Processing {stage_name}...")

        # Check if already completed and verified
        existing_item = next((item for item in ledger["items"] if item["stage"] == stage_name), None)
        if existing_item and existing_item.get("status") in ("ART_CANDIDATE", "CACHED"):
            if output_path.exists() and manifest_path.exists():
                print(f"  -> Already exists and recorded in ledger as {existing_item['status']}. Skipping.")
                continue

        # Check if target files exist on disk without ledger entry
        if output_path.exists() and manifest_path.exists():
            print(f"  -> Target files exist on disk. Inspecting existing artifact...")
            try:
                manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
                img_sha = sha256_file(output_path)
                prompt_sha = sha256_file(prompt_path)
                with Image.open(output_path) as img:
                    dims = {"width": img.width, "height": img.height}
                item_entry = {
                    "stage": stage_name,
                    "status": "CACHED",
                    "output_png": output_rel,
                    "manifest_json": manifest_rel,
                    "model": manifest_data.get("model", "gemini-nano-banana-2.1"),
                    "size": manifest_data.get("image_size", "2K"),
                    "aspect_ratio": manifest_data.get("aspect_ratio", "3:2"),
                    "prompt_file": prompt_rel,
                    "prompt_sha256": prompt_sha,
                    "image_sha256": img_sha,
                    "image_dimensions": dims,
                    "reserved_cost_usd": 0.0,
                    "estimated_cost_usd": ESTIMATED_PER_IMAGE_2K_USD,
                    "actual_billing_usd": None,
                    "command_exit_code": 0,
                    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                }
                if existing_item:
                    existing_item.update(item_entry)
                else:
                    ledger["items"].append(item_entry)
                ledger["total_images_succeeded"] = sum(1 for it in ledger["items"] if it.get("status") in ("ART_CANDIDATE", "CACHED"))
                save_ledger(ledger)
                print(f"  -> Successfully recorded pre-existing verified artifact.")
                continue
            except Exception as e:
                print(f"  -> Error validating pre-existing files: {e}")

        # Cost check before reservation
        current_reserved = get_current_reserved(ledger)
        projected_reserved = round(current_reserved + ESTIMATED_PER_IMAGE_2K_USD, 4)

        if projected_reserved > INTERNAL_STOP_USD or projected_reserved > BUDGET_CEILING_USD:
            print(f"[FATAL] Cost limit reached! Current reserved: ${current_reserved:.4f}, next would be ${projected_reserved:.4f} > stop line ${INTERNAL_STOP_USD:.2f}")
            ledger["status"] = "STOPPED_BUDGET_LIMIT"
            save_ledger(ledger)
            return 1

        print(f"  -> Budget check PASS: current reserved ${current_reserved:.4f} + ${ESTIMATED_PER_IMAGE_2K_USD:.4f} = ${projected_reserved:.4f} <= ${INTERNAL_STOP_USD:.2f}")

        # Atomic reservation entry
        item_entry = {
            "stage": stage_name,
            "status": "IN_PROGRESS",
            "output_png": output_rel,
            "manifest_json": manifest_rel,
            "model": "gemini-nano-banana-2.1",
            "size": "2K",
            "aspect_ratio": "3:2",
            "prompt_file": prompt_rel,
            "prompt_sha256": sha256_file(prompt_path),
            "reserved_cost_usd": ESTIMATED_PER_IMAGE_2K_USD,
            "estimated_cost_usd": ESTIMATED_PER_IMAGE_2K_USD,
            "actual_billing_usd": None,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        }
        if existing_item:
            existing_item.update(item_entry)
        else:
            ledger["items"].append(item_entry)
        ledger["total_images_attempted"] += 1
        ledger["total_reserved_cost_usd"] = get_current_reserved(ledger)
        save_ledger(ledger)

        # Build command
        cmd = [
            PYTHON_EXE,
            str(BRIDGE_SCRIPT),
            "--prompt-file", str(prompt_path),
            "--output", str(output_path),
            "--size", "2K",
            "--aspect-ratio", "3:2",
            "--execute",
            "--max-cost-usd", str(ESTIMATED_PER_IMAGE_2K_USD),
        ]

        sub_env = dict(os.environ)
        sub_env["NANOBANANA_APPROVED"] = "YES"

        print(f"  -> Invoking bridge with --execute, size 2K, max-cost-usd ${ESTIMATED_PER_IMAGE_2K_USD}...")
        proc = subprocess.run(cmd, env=sub_env, capture_output=True, text=True)

        exit_code = proc.returncode
        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()

        # Redact any key in logs
        key = os.getenv("GEMINI_API_KEY", "")
        if key:
            stdout = stdout.replace(key, "[REDACTED]")
            stderr = stderr.replace(key, "[REDACTED]")

        item_entry["command_exit_code"] = exit_code

        if exit_code != 0:
            print(f"  [ERROR] Subprocess failed with exit code {exit_code}")
            if stderr:
                print(f"  Stderr: {stderr}")
            if stdout:
                print(f"  Stdout: {stdout}")

            item_entry["status"] = "FAILED"
            item_entry["error"] = stderr or stdout or f"Exited with code {exit_code}"
            ledger["status"] = "HALTED_ON_ERROR"
            save_ledger(ledger)
            print(f"[HALT] Immediate halt on error. Preserved cost and state in ledger.")
            return 1

        # Success - verify output
        print(f"  -> Bridge execution completed with exit 0.")
        if not output_path.exists():
            print(f"  [ERROR] Output file does not exist after exit 0: {output_path}")
            item_entry["status"] = "FAILED"
            item_entry["error"] = "Output file missing after bridge exited 0"
            ledger["status"] = "HALTED_ON_ERROR"
            save_ledger(ledger)
            return 1

        img_sha = sha256_file(output_path)
        with Image.open(output_path) as img:
            dims = {"width": img.width, "height": img.height}

        item_entry["status"] = "ART_CANDIDATE"
        item_entry["image_sha256"] = img_sha
        item_entry["image_dimensions"] = dims
        item_entry["completed_utc"] = datetime.now(timezone.utc).isoformat()

        ledger["total_images_succeeded"] = sum(1 for it in ledger["items"] if it.get("status") in ("ART_CANDIDATE", "CACHED"))
        save_ledger(ledger)

        print(f"  -> SUCCESS! Image: {dims['width']}x{dims['height']}, SHA: {img_sha[:16]}...")

    ledger["status"] = "BATCH_COMPLETE"
    save_ledger(ledger)
    print("\n=== Batch Execution Completed Successfully ===")
    print(f"Total succeeded: {ledger['total_images_succeeded']}/{len(STAGES)}")
    print(f"Total reserved: ${ledger['total_reserved_cost_usd']:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(run_batch())
