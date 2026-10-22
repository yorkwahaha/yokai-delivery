#!/usr/bin/env python3
"""
ComfyUI Dispatcher for Yokai Delivery Stage Art
Connects to local ComfyUI instance (http://127.0.0.1:8188) and executes Qwen Image 2.1 workflow.
"""

import sys
import json
import time
import random
import os
import urllib.request
import urllib.parse
from PIL import Image

COMFY_HOST = "http://127.0.0.1:8188"
WORKFLOW_TEMPLATE = r"e:\Downloads\image_qwen_image_2_1_t2i.json"
OUTPUT_DIR = r"G:\ComfyUI_Output\images"

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
            print("[+] Generation completed!")
            return hist[prompt_id]
        time.sleep(2)
        print(".", end="", flush=True)
    raise TimeoutError("ComfyUI prompt timed out")

def run_ground_generation(prompt_text, negative_text="", seed=None, prefix="Stage8_Yomi_Ground"):
    if seed is None:
        seed = random.randint(1, 10**14)

    print(f"[*] Loading workflow template from: {WORKFLOW_TEMPLATE}")
    with open(WORKFLOW_TEMPLATE, "r", encoding="utf-8") as f:
        wf = json.load(f)

    # Configure direct prompt bypassing LLM rewrite for exact game texture control
    if "459:474" in wf:
        wf["459:474"]["inputs"]["switch"] = False
        wf["459:474"]["inputs"]["on_false"] = prompt_text

    if "459:452" in wf:
        wf["459:452"]["inputs"]["negative_prompt"] = negative_text

    if "459:458" in wf:
        wf["459:458"]["inputs"]["seed"] = seed

    if "461" in wf:
        wf["461"]["inputs"]["filename_prefix"] = prefix

    print(f"[*] Submitting prompt to ComfyUI (Seed: {seed})...")
    res = send_prompt(wf)
    prompt_id = res["prompt_id"]
    print(f"[*] Prompt queued, ID: {prompt_id}")

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

    return found_files, seed

def process_and_tile_preview(src_img_path, target_raw_path, target_512_webp, preview_2x2_path):
    print(f"[*] Processing image: {src_img_path}")
    im = Image.open(src_img_path).convert("RGBA")
    w, h = im.size
    print(f"    Raw dimensions: {w}x{h}")

    # 1. Save raw candidate
    im.save(target_raw_path)
    print(f"[+] Saved candidate raw: {target_raw_path}")

    # 2. Downscale to 512x512 WebP (Game standard specification)
    im_512 = im.resize((512, 512), Image.Resampling.LANCZOS)
    im_512.save(target_512_webp, "WEBP", quality=95)
    print(f"[+] Saved game-ready 512x512 WebP: {target_512_webp}")

    # 3. Create 2x2 tiled preview (1024x1024) to visually verify seamlessness
    tiled_2x2 = Image.new("RGBA", (1024, 1024))
    tiled_2x2.paste(im_512, (0, 0))
    tiled_2x2.paste(im_512, (512, 0))
    tiled_2x2.paste(im_512, (0, 512))
    tiled_2x2.paste(im_512, (512, 512))
    tiled_2x2.save(preview_2x2_path)
    print(f"[+] Saved 2x2 tiled seam preview: {preview_2x2_path}")

if __name__ == "__main__":
    prompt = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, "
        "flat 2D game floor, bird's-eye view looking perpendicularly straight down onto the ground. "
        "Traditional Japanese ukiyo-e woodblock print and sumi-e ink wash style, inspired by Stage 1 game ground composition. "
        "An organic, natural mosaic of large chunky weathered bone-white flagstones and stone slabs with delicate black sumi ink contour lines and surface cracks. "
        "The stone slabs are framed by small weathered border pebbles and rocks, intermingled organically with clusters of blooming deep crimson red spider lilies (higanbana, Lycoris radiata) and scattered fallen red petals. "
        "Soft pale underworld mist drifting among muted dark slate crevices between the stone patches. "
        "Completely decentralized all-over organic composition, no single road, no stripes, no parallel lines, no focal point. "
        "Subtle, clean, and balanced texture that does not distract the player, seamless repeating 4-way tileable pattern on all four edges."
    )
    negative = (
        "road line, single road, highway, stripe, parallel lines, directional path, river, "
        "perspective narrowing, vanishing point, angled view, tilted, oblique, horizon, sky, bridge, tower, building, "
        "tiny cracked porcelain, mosaic noise, chaotic clutter, "
        "pitch black, solid black void, blood, bloody, red pool, red liquid, red mud, lava, neon orange, bright yellow desert, "
        "photorealistic photo, 3d cgi render, plastic, character, monster, ui, text, watermark, border, blurry."
    )

    seeds_to_test = [random.randint(1, 10**14), random.randint(1, 10**14)]
    labels = ["allover_1", "allover_2"]
    for i, s in enumerate(seeds_to_test):
        lbl = labels[i]
        prefix = f"Stage8_Yomi_Allover_{lbl}"
        print(f"\n==========================================")
        print(f"[*] Generating Stage 1 Style Decentralized Ground {lbl} (Seed: {s})...")
        out_files, used_seed = run_ground_generation(prompt, negative, seed=s, prefix=prefix)
        if out_files:
            raw_src = out_files[0]
            os.makedirs("art/stage8-yomi/scene", exist_ok=True)
            target_raw = f"art/stage8-yomi/scene/G_ground_yomi_allover_{lbl}.png"
            target_webp = f"art/stage8-yomi/scene/G_ground_yomi_allover_512_{lbl}.webp"
            preview_2x2 = f"art/stage8-yomi/Preview_tiled_2x2_ground_yomi_allover_{lbl}.png"
            process_and_tile_preview(raw_src, target_raw, target_webp, preview_2x2)
            print(f"[SUCCESS] Candidate {lbl} ready!")
