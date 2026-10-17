#!/usr/bin/env python3
"""
Generate Stage 8 ground candidates strictly following the user's ratio and composition instructions:
- 70% calm dirt ground (wide open warm ochre sandy washi earth)
- 30% combined flat stones and red spider lilies
- Dispersed flowers: 1-2 single solitary stalks + 1 small natural cluster
- Natural landscape feel: NO rigid diagonal lines, organic random distribution
- Flat 2D stones (not 3D bumpy rocks), peaceful non-distracting game floor
"""

import sys
import json
import time
import random
import os
import shutil
import urllib.request
from PIL import Image

COMFY_HOST = "http://127.0.0.1:8188"
WORKFLOW_TEMPLATE = r"e:\Downloads\image_qwen_image_2_1_t2i.json"
OUTPUT_DIR = r"G:\ComfyUI_Output\images"
ARTIFACT_DIR = r"C:\Users\York\.gemini\antigravity\brain\fa1c8457-83da-4548-8d12-8cf54c19a2bc"

def send_prompt(workflow, client_id="yokai_agent"):
    data = json.dumps({"prompt": workflow, "client_id": client_id}).encode('utf-8')
    req = urllib.request.Request(f"{COMFY_HOST}/prompt", data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_history(prompt_id):
    with urllib.request.urlopen(f"{COMFY_HOST}/history/{prompt_id}") as resp:
        return json.loads(resp.read().decode('utf-8'))

def wait_for_completion(prompt_id, timeout=180):
    start = time.time()
    print(f"[*] Waiting for ComfyUI prompt {prompt_id} to complete...")
    while time.time() - start < timeout:
        hist = get_history(prompt_id)
        if prompt_id in hist:
            print("\n[+] Generation completed!")
            return hist[prompt_id]
        time.sleep(2)
        print(".", end="", flush=True)
    raise TimeoutError("ComfyUI prompt timed out")

def run_t2i(prompt_text, negative_text, seed, prefix):
    with open(WORKFLOW_TEMPLATE, "r", encoding="utf-8") as f:
        wf = json.load(f)

    if "459:474" in wf:
        wf["459:474"]["inputs"]["switch"] = False
        wf["459:474"]["inputs"]["on_false"] = prompt_text

    if "459:452" in wf:
        wf["459:452"]["inputs"]["negative_prompt"] = negative_text

    if "459:458" in wf:
        wf["459:458"]["inputs"]["seed"] = seed

    if "461" in wf:
        wf["461"]["inputs"]["filename_prefix"] = prefix

    print(f"[*] Submitting T2I (Seed: {seed}, Prefix: {prefix})...")
    res = send_prompt(wf)
    prompt_id = res["prompt_id"]
    hist_data = wait_for_completion(prompt_id)
    outputs = hist_data.get("outputs", {})

    found_files = []
    for node_id, node_out in outputs.items():
        if "images" in node_out:
            for img_info in node_out["images"]:
                fname = img_info["filename"]
                sub = img_info.get("subfolder", "")
                full_path = os.path.join(OUTPUT_DIR, sub, fname) if sub else os.path.join(OUTPUT_DIR, fname)
                found_files.append(full_path)
    return found_files

def process_and_tile(src_img_path, target_raw_path, target_512_webp, preview_2x2_path, preview_3x3_path, artifact_prefix):
    im = Image.open(src_img_path).convert("RGB")
    im.save(target_raw_path)

    im_512 = im.resize((512, 512), Image.Resampling.LANCZOS)
    im_512.save(target_512_webp, "WEBP", quality=95)

    tiled_2x2 = Image.new("RGB", (1024, 1024))
    tiled_2x2.paste(im_512, (0, 0))
    tiled_2x2.paste(im_512, (512, 0))
    tiled_2x2.paste(im_512, (0, 512))
    tiled_2x2.paste(im_512, (512, 512))
    tiled_2x2.save(preview_2x2_path)

    tiled_3x3 = Image.new("RGB", (1536, 1536))
    for ty in range(3):
        for tx in range(3):
            tiled_3x3.paste(im_512, (tx * 512, ty * 512))
    tiled_3x3.save(preview_3x3_path)

    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    shutil.copy2(target_raw_path, os.path.join(ARTIFACT_DIR, f"{artifact_prefix}_raw.png"))
    shutil.copy2(target_512_webp, os.path.join(ARTIFACT_DIR, f"{artifact_prefix}_512.webp"))
    shutil.copy2(preview_2x2_path, os.path.join(ARTIFACT_DIR, f"{artifact_prefix}_2x2_preview.png"))
    shutil.copy2(preview_3x3_path, os.path.join(ARTIFACT_DIR, f"{artifact_prefix}_3x3_preview.png"))
    print(f"[+] Saved & copied: {artifact_prefix}")

if __name__ == "__main__":
    os.makedirs("art/stage8-yomi/scene", exist_ok=True)

    neg = (
        "dense crowded rocks, cluttered stones covering the screen, trypophobia clusters, crowded dots, "
        "rigid diagonal line, diagonal stripe, railway tracks, highway, artificial straight line, "
        "3d protruding boulders, bumpy relief, high contrast, pitch black, solid black void, glowing magma, blood, "
        "modern, text, ui, watermark, blurry"
    )

    # Prompt 1: 70% Dirt + 30% Sparse Flat Stepping Stones (Organic Natural Courtyard)
    p1 = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, looking straight down, flat 2D game floor. "
        "Traditional Japanese sumi-e watercolor ink wash and ukiyo-e woodblock style matching Stage 1 game floor proportion. "
        "70 percent of the surface is calm, wide, open warm ochre sandy dirt ground and soft aged washi paper earth. "
        "Only 30 percent of the surface consists of sparse, flat weathered bone-white stone slabs and natural red spider lilies. "
        "Completely natural organic landscape distribution, NO diagonal line, NO straight path, natural sparse stepping stones scattered organically. "
        "Spider lilies (higanbana) are dispersed naturally: one or two solitary single blooming red flower stalks, and one small natural cluster of red spider lilies with scattered fallen petals. "
        "Gentle low-contrast, peaceful and non-distracting background for a 2D game, seamless 4-way tileable pattern."
    )

    # Prompt 2: Authentic Stage 1 Proportions (Calm Washi Earth + Sparse Flat Stepping Slabs & Solo Flowers)
    p2 = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, flat 2D game floor. "
        "Authentic Japanese sumi-e ink wash on aged washi paper, matching Stage 1 ground proportion. "
        "Vast open areas of calm warm sandy soil taking up 70 percent of the canvas, subtle paper grain, clean and peaceful. "
        "Sparse flat stone slabs and small weathered flagstones (25 percent) embedded into the dirt with soft ink outlines, flat surface without 3D extrusion. "
        "Random natural spider lilies (5 percent): 1 solitary isolated red spider lily stalk, and 1 small organic flower cluster with a few delicate red petals on the ground. "
        "Organic wilderness landscape, NO diagonal stripe, NO parallel lines, harmonious low-contrast game background, seamless 4-way tileable."
    )

    runs = [
        ("stage8_70dirt_30stone_v1", p1, 703001),
        ("stage8_70dirt_30stone_v2", p2, 703002)
    ]

    for name, p, s in runs:
        print(f"\n=======================================================")
        print(f"[*] Starting 70/30 Generation: {name} (Seed: {s})")
        out_files = run_t2i(p, neg, seed=s, prefix=f"Stage8_{name}")
        if out_files:
            raw_src = out_files[0]
            target_raw = f"art/stage8-yomi/scene/G_ground_yomi_{name}.png"
            target_webp = f"art/stage8-yomi/scene/G_ground_yomi_512_{name}.webp"
            preview_2x2 = f"art/stage8-yomi/Preview_tiled_2x2_ground_yomi_{name}.png"
            preview_3x3 = f"art/stage8-yomi/Preview_tiled_3x3_ground_yomi_{name}.png"
            process_and_tile(raw_src, target_raw, target_webp, preview_2x2, preview_3x3, name)
            print(f"[SUCCESS] {name} complete!")
