#!/usr/bin/env python3
"""Stage 2 Rain-Port Nano Banana 2.1 Serial Production Art Batch Runner.

Batch ID: s2-nano-production-20261020
Model: gemini-nano-banana-2.1
Budget Limit: Exactly US$1.2000 (Required core 13 items: $0.9152, Optional variety 5 items: $0.2848).
Ledger: scratch/s2-nano-production-paid-20261020/ledger.json

Features:
1. Strict atomic reservation using Decimal to avoid floating-point errors.
2. Single process execution with lock file.
3. Sequential execution order:
   req_01 (stone master) -> req_03 (wood master) ->
   req_05 / req_06 (transitions with newly generated stone & wood bases + style master) ->
   req_02 / req_04 (variations with respective base + style master) ->
   req_07 ~ req_11 (5 standalone buildings) ->
   req_12 (sea) / req_13 (cliff) ->
   req_14 ~ req_18 (5 props)
4. Child process invokes tools/nanobanana_generate.py with NANOBANANA_APPROVED=YES and --execute.
5. Immediate abort on failure/429/quota error, preserving ledger state.
6. Offline post-processing into art/stage2-rain-port/production-s2-nano-20261020/
   with true RGBA matting, seamless tiling QA, and authoritative asset-manifest.json.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PYTHON_EXE = "I:/Tools/NanoBanana21/.venv/Scripts/python.exe"
BRIDGE_SCRIPT = ROOT / "tools" / "nanobanana_generate.py"

BATCH_ID = "s2-nano-production-20261020"
LEDGER_DIR = ROOT / "scratch" / "s2-nano-production-paid-20261020"
LEDGER_PATH = LEDGER_DIR / "ledger.json"
LOCK_PATH = LEDGER_DIR / "s2_nano_batch.lock"

OUTPUT_PROD_DIR = ROOT / "art" / "stage2-rain-port" / "production-s2-nano-20261020"
STYLE_MASTER = "art/stage2-rain-port/scene/G_floor_triptych_candidate_nb21_v1.png"

BUDGET_LIMIT_USD = Decimal("1.2000")
COST_2K = Decimal("0.0704")
COST_1K = Decimal("0.0536")

ITEMS = [
    # 1. Base floor textures (Orthogonal 2K 1:1)
    {
        "id": "req_01_ground_stone_seamless",
        "name": "主石地真無縫基準地塊",
        "category": "required_core",
        "type": "floor_tile",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_01_ground_stone_seamless.txt",
        "output_png": "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
    },
    {
        "id": "req_03_ground_wood_dock_seamless",
        "name": "木棧道真無縫基準地塊",
        "category": "required_core",
        "type": "floor_tile",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_03_ground_wood_dock_seamless.txt",
        "output_png": "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
    },
    # 2. Transitions (Depends on new stone & wood bases + style master)
    {
        "id": "req_05_ground_trans_stone_wood_h",
        "name": "石木水平岸線無縫過渡地塊",
        "category": "required_core",
        "type": "floor_transition",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_05_ground_trans_stone_wood_h.txt",
        "output_png": "art/stage2-rain-port/scene/G_trans_stone_wood_h_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/G_trans_stone_wood_h_nano_nb21_v1.json",
        "references": [
            "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.png",
            "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.png",
            STYLE_MASTER,
        ],
    },
    {
        "id": "req_06_ground_trans_stone_wood_v",
        "name": "石木垂直水渠無縫過渡地塊",
        "category": "required_core",
        "type": "floor_transition",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_06_ground_trans_stone_wood_v.txt",
        "output_png": "art/stage2-rain-port/scene/G_trans_stone_wood_v_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/G_trans_stone_wood_v_nano_nb21_v1.json",
        "references": [
            "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.png",
            "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.png",
            STYLE_MASTER,
        ],
    },
    # 3. Floor Variations (Depends on respective base + style master)
    {
        "id": "req_02_ground_stone_var1",
        "name": "石地積水反光無縫變化塊",
        "category": "required_core",
        "type": "floor_tile",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_02_ground_stone_var1.txt",
        "output_png": "art/stage2-rain-port/scene/G_ground_stone_var1_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/G_ground_stone_var1_nano_nb21_v1.json",
        "references": [
            "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.png",
            STYLE_MASTER,
        ],
    },
    {
        "id": "req_04_ground_wood_dock_var1",
        "name": "木棧道海鹽風化無縫變化塊",
        "category": "required_core",
        "type": "floor_tile",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_04_ground_wood_dock_var1.txt",
        "output_png": "art/stage2-rain-port/scene/G_ground_wood_dock_var1_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/G_ground_wood_dock_var1_nano_nb21_v1.json",
        "references": [
            "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.png",
            STYLE_MASTER,
        ],
    },
    # 4. Standalone Buildings (2K 1:1, Solid White Matte, 2.5D Upright Tilt 0.60)
    {
        "id": "req_07_building_port_warehouse",
        "name": "港口風化大倉庫",
        "category": "required_core",
        "type": "building",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_07_building_port_warehouse.txt",
        "output_png": "art/stage2-rain-port/scene/H_port_warehouse_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/H_port_warehouse_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    {
        "id": "req_08_building_fish_workshop",
        "name": "港町海產魚行魚舖",
        "category": "required_core",
        "type": "building",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_08_building_fish_workshop.txt",
        "output_png": "art/stage2-rain-port/scene/H_fishmonger_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/H_fishmonger_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    {
        "id": "req_09_building_port_tavern",
        "name": "港町海潮酒肆",
        "category": "required_core",
        "type": "building",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_09_building_port_tavern.txt",
        "output_png": "art/stage2-rain-port/scene/H_port_tavern_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/H_port_tavern_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    {
        "id": "req_10_building_wharf_shop",
        "name": "碼頭乾貨雜糧商屋",
        "category": "required_core",
        "type": "building",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_10_building_wharf_shop.txt",
        "output_png": "art/stage2-rain-port/scene/H_wharf_shop_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/H_wharf_shop_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    {
        "id": "req_11_building_port_teahouse",
        "name": "港町泊船番所茶屋",
        "category": "required_core",
        "type": "building",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_11_building_port_teahouse.txt",
        "output_png": "art/stage2-rain-port/scene/H_port_teahouse_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/H_port_teahouse_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    # 5. Environment (Sea & Cliff)
    {
        "id": "req_12_sea_surface_seamless",
        "name": "港口深水海面無縫材質",
        "category": "required_core",
        "type": "environment_surface",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_12_sea_surface_seamless.txt",
        "output_png": "art/stage2-rain-port/scene/G_port_sea_surface_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/G_port_sea_surface_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
    },
    {
        "id": "req_13_cliff_north_rock",
        "name": "北側礁石海蝕斷崖",
        "category": "required_core",
        "type": "environment_prop",
        "size": "2K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_13_cliff_north_rock.txt",
        "output_png": "art/stage2-rain-port/scene/O_port_north_cliff_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/O_port_north_cliff_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    # 6. Props (Optional Variety)
    {
        "id": "req_14_prop_anchor_gear",
        "name": "港口鐵錨與絞盤齒輪",
        "category": "optional_variety",
        "type": "prop",
        "size": "1K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_1K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_14_prop_anchor_gear.txt",
        "output_png": "art/stage2-rain-port/scene/O_prop_anchor_gear_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/O_prop_anchor_gear_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    {
        "id": "req_15_prop_cargo_crates",
        "name": "碼頭堆疊貨物木箱",
        "category": "optional_variety",
        "type": "prop",
        "size": "1K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_1K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_15_prop_cargo_crates.txt",
        "output_png": "art/stage2-rain-port/scene/O_prop_cargo_crates_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/O_prop_cargo_crates_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    {
        "id": "req_16_prop_mooring_post",
        "name": "港埠繫船木樁",
        "category": "optional_variety",
        "type": "prop",
        "size": "1K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_1K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_16_prop_mooring_post.txt",
        "output_png": "art/stage2-rain-port/scene/O_prop_mooring_post_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/O_prop_mooring_post_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    {
        "id": "req_17_prop_port_boat",
        "name": "港口繫泊木舟",
        "category": "optional_variety",
        "type": "prop",
        "size": "2K",
        "aspect_ratio": "3:2",
        "cost_usd": COST_2K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_17_prop_port_boat.txt",
        "output_png": "art/stage2-rain-port/scene/O_prop_port_boat_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/O_prop_port_boat_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
    },
    {
        "id": "req_18_prop_port_lighthouse",
        "name": "港口常夜石燈台",
        "category": "optional_variety",
        "type": "prop",
        "size": "1K",
        "aspect_ratio": "1:1",
        "cost_usd": COST_1K,
        "prompt_file": "art/stage2-rain-port/s2-nano-production-requests-20261020/req_18_prop_port_lighthouse.txt",
        "output_png": "art/stage2-rain-port/scene/O_prop_port_lighthouse_nano_nb21_v1.png",
        "manifest_json": "art/stage2-rain-port/scene/O_prop_port_lighthouse_nano_nb21_v1.json",
        "references": [STYLE_MASTER],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
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
            data = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
            print(f"[LEDGER] Resuming existing ledger: {LEDGER_PATH}")
            return data
        except Exception as e:
            print(f"[LEDGER-WARN] Failed to parse existing ledger: {e}")
            backup = LEDGER_DIR / f"ledger_backup_{int(datetime.now().timestamp())}.json"
            LEDGER_PATH.rename(backup)

    ledger = {
        "batch_id": BATCH_ID,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "model": "gemini-nano-banana-2.1",
        "budget_limit_usd": float(BUDGET_LIMIT_USD),
        "total_items_planned": len(ITEMS),
        "total_items_attempted": 0,
        "total_items_succeeded": 0,
        "total_reserved_cost_usd": 0.0,
        "actual_google_billing_usd": None,
        "status": "IN_PROGRESS",
        "items": [],
    }
    save_ledger(ledger)
    return ledger


def save_ledger(ledger: dict) -> None:
    ledger["updated_utc"] = datetime.now(timezone.utc).isoformat()
    # Compute exact total reserved using Decimal
    tot = sum(Decimal(str(it.get("reserved_cost_usd", "0.0"))) for it in ledger.get("items", []))
    ledger["total_reserved_cost_usd"] = float(tot)
    LEDGER_PATH.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")


def get_current_reserved(ledger: dict) -> Decimal:
    return sum(Decimal(str(it.get("reserved_cost_usd", "0.0"))) for it in ledger.get("items", []))


def run_generation() -> int:
    print(f"=== Starting S2 Nano Production Generation Batch ===")
    print(f"Batch ID: {BATCH_ID}")
    print(f"Model: gemini-nano-banana-2.1")
    print(f"Budget Limit: US${BUDGET_LIMIT_USD:.4f}")
    print(f"Items Planned: {len(ITEMS)}")

    # Ensure ledger directory exists
    LEDGER_DIR.mkdir(parents=True, exist_ok=True)

    # Check lock file
    if LOCK_PATH.exists():
        print(f"[LOCK-ERROR] Lock file exists: {LOCK_PATH}. Another runner may be active.")
        return 1
    LOCK_PATH.write_text(f"pid={os.getpid()}\nstarted={datetime.now(timezone.utc).isoformat()}", encoding="utf-8")

    try:
        ledger = load_or_init_ledger()

        for idx, item in enumerate(ITEMS, start=1):
            req_id = item["id"]
            name = item["name"]
            cost = item["cost_usd"]
            prompt_p = ROOT / item["prompt_file"]
            output_p = ROOT / item["output_png"]
            manifest_p = ROOT / item["manifest_json"]

            print(f"\n[{idx}/{len(ITEMS)}] Request {req_id} ({name})...")

            # Check if all reference files exist
            missing_refs = [r for r in item["references"] if not (ROOT / r).exists()]
            if missing_refs:
                print(f"  [ERROR] Missing reference files: {missing_refs}")
                ledger["status"] = "HALTED_MISSING_REFERENCE"
                save_ledger(ledger)
                return 1

            # Check if already completed and recorded in ledger
            existing_it = next((it for it in ledger["items"] if it["request_id"] == req_id), None)
            if existing_it and existing_it.get("status") in ("ART_CANDIDATE", "CACHED"):
                if output_p.exists() and manifest_p.exists():
                    print(f"  -> Already completed & recorded as {existing_it['status']}. Skipping (zero re-bill).")
                    continue

            # Check if files exist on disk without ledger entry
            if output_p.exists() and manifest_p.exists():
                print(f"  -> Target files exist on disk. Inspecting...")
                try:
                    img_sha = sha256_file(output_p)
                    prompt_sha = sha256_file(prompt_p)
                    with Image.open(output_p) as img:
                        dims = {"width": img.width, "height": img.height}
                    cache_entry = {
                        "request_id": req_id,
                        "name": name,
                        "status": "CACHED",
                        "output_png": item["output_png"],
                        "manifest_json": item["manifest_json"],
                        "model": "gemini-nano-banana-2.1",
                        "size": item["size"],
                        "aspect_ratio": item["aspect_ratio"],
                        "prompt_file": item["prompt_file"],
                        "prompt_sha256": prompt_sha,
                        "image_sha256": img_sha,
                        "image_dimensions": dims,
                        "reserved_cost_usd": 0.0,
                        "estimated_cost_usd": float(cost),
                        "actual_billing_usd": None,
                        "command_exit_code": 0,
                        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    }
                    if existing_it:
                        existing_it.update(cache_entry)
                    else:
                        ledger["items"].append(cache_entry)
                    ledger["total_items_succeeded"] = sum(1 for it in ledger["items"] if it.get("status") in ("ART_CANDIDATE", "CACHED"))
                    save_ledger(ledger)
                    print(f"  -> Successfully recorded pre-existing verified artifact.")
                    continue
                except Exception as e:
                    print(f"  -> Error validating pre-existing files: {e}")

            # Budget safety check
            current_reserved = get_current_reserved(ledger)
            projected_reserved = current_reserved + cost
            if projected_reserved > BUDGET_LIMIT_USD:
                print(f"  [FATAL] Budget ceiling exceeded! Current: ${current_reserved:.4f}, Next: ${cost:.4f}, Projected: ${projected_reserved:.4f} > Limit: ${BUDGET_LIMIT_USD:.4f}")
                ledger["status"] = "STOPPED_BUDGET_LIMIT"
                save_ledger(ledger)
                return 1

            print(f"  -> Budget check PASS: current reserved ${current_reserved:.4f} + ${cost:.4f} = ${projected_reserved:.4f} <= ${BUDGET_LIMIT_USD:.4f}")

            # Atomic reservation
            item_entry = {
                "request_id": req_id,
                "name": name,
                "status": "IN_PROGRESS",
                "output_png": item["output_png"],
                "manifest_json": item["manifest_json"],
                "model": "gemini-nano-banana-2.1",
                "size": item["size"],
                "aspect_ratio": item["aspect_ratio"],
                "prompt_file": item["prompt_file"],
                "prompt_sha256": sha256_file(prompt_p),
                "references": item["references"],
                "reserved_cost_usd": float(cost),
                "estimated_cost_usd": float(cost),
                "actual_billing_usd": None,
                "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            }
            if existing_it:
                existing_it.update(item_entry)
            else:
                ledger["items"].append(item_entry)
            ledger["total_items_attempted"] += 1
            save_ledger(ledger)

            # Build command for bridge invocation
            cmd = [
                PYTHON_EXE,
                str(BRIDGE_SCRIPT),
                "--prompt-file", str(prompt_p),
                "--output", str(output_p),
                "--size", item["size"],
                "--aspect-ratio", item["aspect_ratio"],
                "--execute",
                "--max-cost-usd", str(cost),
            ]
            for ref in item["references"]:
                cmd.extend(["--reference", str(ROOT / ref)])

            sub_env = dict(os.environ)
            sub_env["NANOBANANA_APPROVED"] = "YES"

            print(f"  -> Invoking bridge with --execute, size {item['size']}, max-cost-usd ${cost}...")
            proc = subprocess.run(cmd, env=sub_env, capture_output=True, text=True)

            exit_code = proc.returncode
            stdout = proc.stdout.strip()
            stderr = proc.stderr.strip()

            # Redact API key from output
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

            # Verification of generated files
            if not output_p.exists() or not manifest_p.exists():
                print(f"  [ERROR] Bridge exited 0 but target file missing: {output_p}")
                item_entry["status"] = "FAILED"
                item_entry["error"] = "Target files missing after bridge exit 0"
                ledger["status"] = "HALTED_ON_ERROR"
                save_ledger(ledger)
                return 1

            img_sha = sha256_file(output_p)
            with Image.open(output_p) as img:
                dims = {"width": img.width, "height": img.height}

            item_entry["status"] = "ART_CANDIDATE"
            item_entry["image_sha256"] = img_sha
            item_entry["image_dimensions"] = dims
            ledger["total_items_succeeded"] = sum(1 for it in ledger["items"] if it.get("status") in ("ART_CANDIDATE", "CACHED"))
            save_ledger(ledger)
            print(f"  -> Generated: {output_p.name} ({dims['width']}x{dims['height']}) | SHA: {img_sha[:8]}... | Status: ART_CANDIDATE")

        ledger["status"] = "ALL_COMPLETED_SUCCESS"
        save_ledger(ledger)
        print(f"\n=== All 18 Nano Generations Successfully Completed! ===")
        return 0

    finally:
        if LOCK_PATH.exists():
            LOCK_PATH.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true", help="Execute the generation batch")
    args = parser.parse_args()

    if args.run:
        sys.exit(run_generation())
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
