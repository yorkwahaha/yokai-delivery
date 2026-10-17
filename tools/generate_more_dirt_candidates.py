#!/usr/bin/env python3
"""
Generate Stage 8 ground candidates matching the user's second reference:
- Flat 2D flagstones (NOT 3D protruding rocks)
- Significantly MORE DIRT GROUND area, fewer stones (稀疏踏石，泥土佔比大，不搶角色視線)
- Seamless tileable, calm low-contrast game background
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

def run_edit(prompt_text, negative_text, seed, denoise, prefix):
    with open(WORKFLOW_TEMPLATE, "r", encoding="utf-8") as f:
        wf = json.load(f)

    wf['991'] = {
        'class_type': 'LoadImage',
        'inputs': {
            'image': 'user_ref2_yomi.png'
        }
    }
    wf['459:452']['inputs']['images.image_1'] = ['991', 0]
    wf['459:452']['inputs']['vae'] = ['459:454', 0]

    wf['459:458']['inputs']['latent_image'] = ['459:452', 2]
    wf['459:458']['inputs']['denoise'] = denoise
    wf['459:458']['inputs']['seed'] = seed

    if "459:474" in wf:
        wf["459:474"]["inputs"]["switch"] = False
        wf["459:474"]["inputs"]["on_false"] = prompt_text

    if "459:452" in wf:
        wf["459:452"]["inputs"]["negative_prompt"] = negative_text

    if "461" in wf:
        wf["461"]["inputs"]["filename_prefix"] = prefix

    print(f"[*] Submitting Edit (Seed: {seed}, Denoise: {denoise}, Prefix: {prefix})...")
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
        "dense crowded rocks, cluttered stones covering the entire screen, 3d protruding boulders, bumpy relief, "
        "rigid straight parallel tracks, railway lines, high contrast, pitch black, solid black void, glowing magma, blood puddle, "
        "neon, modern, text, ui, watermark"
    )

    # Prompt 1: T2I with Flat Stones + Vast Dirt Ground (平面的石塊，泥土面積大，平整開闊，不搶眼)
    p_t2i_dirt = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, looking straight down, flat 2D game floor. "
        "Traditional Japanese sumi-e watercolor ink wash and ukiyo-e woodblock style matching Stage 1 game floor. "
        "Wide open areas of calm warm ochre sandy dirt ground and soft aged washi paper earth, taking up 65 percent of the floor. "
        "Sparse, flat weathered bone-white stone slabs and flagstones naturally embedded flat into the dirt ground, flat stepping stones without 3D height. "
        "Gentle, calm background that does not distract from moving player character or enemies, subtle low contrast. "
        "Small natural clusters of blooming deep crimson red spider lilies (higanbana) and scattered red petals growing softly along the flat stone edges. "
        "Seamless 4-way tileable pattern."
    )

    # Prompt 2: Edit user_ref2 to expand dirt and reduce stone density
    p_edit_dirt = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, flat 2D game floor. "
        "Modify the texture to have significantly more open sandy dirt ground and soft earth. "
        "Remove dense excess stone clusters, leaving only a sparse, calm stepping stone trail of flat bone-white flagstones embedded into wide ochre dirt. "
        "Flat stone slabs without 3D extrusion, calm and readable game background, blooming deep crimson red spider lilies and delicate fallen petals. "
        "Traditional Japanese sumi-e washi paper watercolor style, seamless 4-way tileable pattern."
    )

    # 1. Run T2I with flat stones + wide dirt
    out1 = run_t2i(p_t2i_dirt, neg, seed=333001, prefix="Stage8_Flat_MoreDirt_T2I")
    if out1:
        process_and_tile(out1[0],
                         "art/stage8-yomi/scene/G_ground_yomi_flat_moredirt_t2i.png",
                         "art/stage8-yomi/scene/G_ground_yomi_512_flat_moredirt_t2i.webp",
                         "art/stage8-yomi/Preview_tiled_2x2_ground_yomi_flat_moredirt_t2i.png",
                         "art/stage8-yomi/Preview_tiled_3x3_ground_yomi_flat_moredirt_t2i.png",
                         "stage8_flat_moredirt_t2i")

    # 2. Run Edit on user_ref2 (Denoise 0.52)
    out2 = run_edit(p_edit_dirt, neg, seed=333002, denoise=0.52, prefix="Stage8_UserRef2_MoreDirt_Edit")
    if out2:
        process_and_tile(out2[0],
                         "art/stage8-yomi/scene/G_ground_yomi_user_ref2_moredirt_edit.png",
                         "art/stage8-yomi/scene/G_ground_yomi_512_user_ref2_moredirt_edit.webp",
                         "art/stage8-yomi/Preview_tiled_2x2_ground_yomi_user_ref2_moredirt_edit.png",
                         "art/stage8-yomi/Preview_tiled_3x3_ground_yomi_user_ref2_moredirt_edit.png",
                         "stage8_user_ref2_moredirt_edit")

    print("[ALL DONE] Generated more-dirt candidates!")
