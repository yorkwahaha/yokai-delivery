#!/usr/bin/env python3
"""
Generate Stage 8 Yomi ground candidates with V5's lush spider lily flower field
faintly submerging a diagonal, soft-blended dirt-and-stone pathway (Stage 1 inspired).
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

def run_ground_generation(prompt_text, negative_text="", seed=None, prefix="Stage8_Yomi_FlowerSea"):
    if seed is None:
        seed = random.randint(1, 10**14)

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

    print(f"[*] Submitting prompt (Seed: {seed}, Prefix: {prefix})...")
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

def process_and_tile_preview(src_img_path, target_raw_path, target_512_webp, preview_2x2_path, preview_3x3_path, artifact_prefix):
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

    # 3. Create 2x2 tiled preview (1024x1024)
    tiled_2x2 = Image.new("RGBA", (1024, 1024))
    tiled_2x2.paste(im_512, (0, 0))
    tiled_2x2.paste(im_512, (512, 0))
    tiled_2x2.paste(im_512, (0, 512))
    tiled_2x2.paste(im_512, (512, 512))
    tiled_2x2.save(preview_2x2_path)
    print(f"[+] Saved 2x2 tiled seam preview: {preview_2x2_path}")

    # 4. Create 3x3 tiled preview (1536x1536)
    tiled_3x3 = Image.new("RGBA", (1536, 1536))
    for ty in range(3):
        for tx in range(3):
            tiled_3x3.paste(im_512, (tx * 512, ty * 512))
    tiled_3x3.save(preview_3x3_path)
    print(f"[+] Saved 3x3 tiled preview: {preview_3x3_path}")

    # 5. Copy all to Artifact directory for Antigravity chat viewing
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    shutil.copy2(target_raw_path, os.path.join(ARTIFACT_DIR, f"{artifact_prefix}_raw.png"))
    shutil.copy2(target_512_webp, os.path.join(ARTIFACT_DIR, f"{artifact_prefix}_512.webp"))
    shutil.copy2(preview_2x2_path, os.path.join(ARTIFACT_DIR, f"{artifact_prefix}_2x2_preview.png"))
    shutil.copy2(preview_3x3_path, os.path.join(ARTIFACT_DIR, f"{artifact_prefix}_3x3_preview.png"))
    print(f"[+] Copied all assets to artifact directory under prefix: {artifact_prefix}")

if __name__ == "__main__":
    negative = (
        "pitch black, solid black void, pitch dark, pure black background, pure white void, "
        "bright neon, glowing magma, molten lava, red puddle, pool of blood, bloody mud, gore, "
        "single vertical highway, straight parallel stripes, two parallel roads, rigid grid, "
        "sparse isolated single flower stalks, sparse individual flowers, "
        "perspective narrowing, vanishing point, tilted angle, oblique perspective, isometric, "
        "3D CGI render, photorealistic photo, plastic, shiny, characters, monsters, modern, UI, text, watermark, frame, borders, blurry."
    )

    # Formula 1: Lush Spider Lily Flower Field Submerging Diagonal Path (花田隱約埋沒斜向石徑)
    prompt_submerged_diag = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, "
        "flat 2D game floor, bird's-eye view looking perpendicularly straight down. "
        "Traditional Japanese sumi-e ink wash painting and ukiyo-e woodblock print aesthetic, visible sumi ink brushwork and soft washi paper bleed. "
        "A lush, dense flower field of blooming deep crimson red spider lilies (higanbana, Lycoris radiata) forming rich floral beds that naturally encroach upon and partially bury the edges of an ancient pathway. "
        "The pathway flows organically in a gentle 45-degree diagonal curve across the tile, inspired by Stage 1 ground layout. "
        "The road surface is composed of weathered bone-white flagstones softly embedded into sandy soil, dirt ground, and small border pebbles; "
        "the stone slabs are not sharply defined or rigid blocks, but seamlessly blended with the muted slate-grey earth and dirt path. "
        "Dense red spider lilies and scattered red petals spilling onto the edges of the dirt and stone road. "
        "Harmonious low-contrast earthy palette, soft faint mist, seamless 4-way repeating tileable pattern on all four edges."
    )

    # Formula 2: Dense Higanbana Meadow with Soft-edged Winding Stepping Trail (彼岸花海漫漫・水墨泥石古徑)
    prompt_meadow_trail = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, "
        "flat 2D game floor. "
        "Authentic Japanese sumi-e watercolor and ukiyo-e woodblock style, hand-painted ink wash on fibrous washi paper. "
        "A dense sea of deep crimson red spider lilies (彼岸花海) covering large organic sections, faintly submerging a meandering ancient trail. "
        "The trail is a natural mixture of weathered bone-white stepping stones, soft earth, fine gravel, and sand, with gentle blurred organic contours rather than sharp rectangular borders, exactly matching the spirit of Stage 1 ground. "
        "Abundant blooming red spider lilies, lush flower clusters, and scattered petals overflowing into the stone crevices and dirt borders. "
        "Soft muted slate-grey sumi-e wash earth, NOT pitch black, gentle contrast, organic diagonal composition without parallel stripes, seamless 4-way tileable pattern."
    )

    runs = [
        ("v5_flowersea_diag_1", prompt_submerged_diag, 911001),
        ("v5_flowersea_diag_2", prompt_submerged_diag, 911002),
        ("v5_flowersea_meadow_1", prompt_meadow_trail, 922001),
        ("v5_flowersea_meadow_2", prompt_meadow_trail, 922002)
    ]

    os.makedirs("art/stage8-yomi/scene", exist_ok=True)

    for name, p, s in runs:
        print(f"\n=======================================================")
        print(f"[*] Starting Generation: {name} (Seed: {s})")
        out_files, used_seed = run_ground_generation(p, negative, seed=s, prefix=f"Stage8_Yomi_{name}")
        if out_files:
            raw_src = out_files[0]
            target_raw = f"art/stage8-yomi/scene/G_ground_yomi_{name}.png"
            target_webp = f"art/stage8-yomi/scene/G_ground_yomi_512_{name}.webp"
            preview_2x2 = f"art/stage8-yomi/Preview_tiled_2x2_ground_yomi_{name}.png"
            preview_3x3 = f"art/stage8-yomi/Preview_tiled_3x3_ground_yomi_{name}.png"
            artifact_prefix = f"stage8_{name}"
            process_and_tile_preview(raw_src, target_raw, target_webp, preview_2x2, preview_3x3, artifact_prefix)
            print(f"[SUCCESS] {name} complete and copied to artifacts!")
