#!/usr/bin/env python3
"""
Generate Stage 8 Yomi ground candidates with distinct sumi-e ink wash style,
aligned with Stage 1's soft contrast and V5's bone-white stone & spider lily details.
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

def run_ground_generation(prompt_text, negative_text="", seed=None, prefix="Stage8_Yomi_Sumie"):
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
        "single vertical highway, straight parallel stripes, two parallel roads, "
        "perspective narrowing, vanishing point, tilted angle, oblique perspective, isometric, "
        "3D CGI render, photorealistic photo, plastic, shiny, characters, monsters, modern, UI, text, watermark, frame, borders, blurry."
    )

    # Style 1: Sumi-e Stepping Stones & Spider Lily Trail (V5 spirit + Sumi-e Ink + Top-down Seamless)
    prompt_style_v5 = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, "
        "flat 2D game floor, bird's-eye view looking perpendicularly straight down. "
        "Distinct traditional Japanese sumi-e ink wash painting and ukiyo-e woodblock print aesthetic, visible black ink brushwork and hand-drawn ink contours. "
        "Organic weathered bone-white flagstones (金骨白石板) and stepping stone slabs with delicate sumi ink crack lines, framed along their borders by small weathered rocks and border pebbles. "
        "Clusters of blooming deep crimson red spider lilies (higanbana, Lycoris radiata) and scattered red petals growing organically along the edges of the stone path. "
        "The ground between the stones is soft muted slate-grey sumi-e ink wash earth (淡墨灰和紙質感), NOT pitch black, NOT magma. "
        "Delicate pale ghostly mist drifting in stone crevices. "
        "Balanced organic winding path composition connecting across all edges, no rigid parallel stripes, seamless 4-way tileable pattern."
    )

    # Style 2: Sumi-e Flagstone Mosaic & Fallen Petal Ground (Stage 1 spirit + Sumi-e Ink + All-over Courtyard)
    prompt_style_mosaic = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, "
        "flat 2D game floor, bird's-eye view looking perpendicularly straight down. "
        "Distinct traditional Japanese sumi-e ink wash painting and ukiyo-e woodblock print style, visible sumi ink brush strokes and delicate washi paper bleed. "
        "Decentralized organic mosaic of weathered bone-white stone slabs and flagstones (金骨白) interspersed with small boundary pebbles and rocks. "
        "Scattered clusters of deep crimson red spider lilies (彼岸花) and delicate fallen red petals naturally resting in the stone crevices. "
        "Soft muted ash-grey and slate sumi-e ink wash earth, gentle low contrast game floor that does not distract the player, NOT pitch black, NOT molten lava. "
        "Subtle faint underworld mist, harmonious all-over composition, seamless 4-way repeating pattern on all four borders."
    )

    runs = [
        ("sumie_v5_A", prompt_style_v5, 555001),
        ("sumie_v5_B", prompt_style_v5, 555002),
        ("sumie_mosaic_A", prompt_style_mosaic, 777001),
        ("sumie_mosaic_B", prompt_style_mosaic, 777002)
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
