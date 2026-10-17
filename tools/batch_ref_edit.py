#!/usr/bin/env python3
"""
Generate refined variations of the user's reference image via Qwen Image 2.1 Edit.
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

def run_edit_generation(prompt_text, negative_text="", seed=None, denoise=0.50, prefix="Stage8_Ref_Edit"):
    if seed is None:
        seed = random.randint(1, 10**14)

    with open(WORKFLOW_TEMPLATE, "r", encoding="utf-8") as f:
        wf = json.load(f)

    # Add LoadImage
    wf['991'] = {
        'class_type': 'LoadImage',
        'inputs': {
            'image': 'user_ref_yomi.png'
        }
    }

    # Connect LoadImage to 'images.image_1' in TextEncodeQwenImage21 (459:452)
    wf['459:452']['inputs']['images.image_1'] = ['991', 0]
    wf['459:452']['inputs']['vae'] = ['459:454', 0]

    # Connect latent output of 459:452 to KSampler (459:458)
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

    print(f"[*] Submitting Edit prompt (Seed: {seed}, Denoise: {denoise}, Prefix: {prefix})...")
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
    negative = (
        "noisy texture, stippling speckles, photorealistic 3d render, plastic, cluttered dots, "
        "rigid straight parallel tracks, railway lines, unnatural artificial symmetry, "
        "pitch black, solid black void, glowing magma, blood puddle, neon, modern, text, ui, watermark"
    )

    # Candidate 2: Organic Natural Distribution (Breaks the straight line)
    p_natural = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, "
        "traditional Japanese sumi-e watercolor ink wash painting and ukiyo-e woodcut style matching Stage 1 game ground. "
        "Break the rigid straight diagonal alignment into natural, organic, asymmetrical stepping stones and weathered boulders. "
        "Broad, smooth watercolor washes on aged washi paper, eliminating noisy speckles and granular clutter. "
        "Clusters of blooming deep crimson red spider lilies (higanbana) and scattered red petals growing naturally along stone crevices and sandy earth. "
        "Warm ochre washi paper dirt ground (#b89e6c), gentle low-contrast readable game background, seamless 4-way tileable pattern."
    )

    # Candidate 3: Strong Sumi-e Wash & Washi Fiber (Simplifies details, emphasizes brushwork)
    p_sumie = (
        "seamless tileable game ground texture, strict 90-degree direct top-down orthographic overhead view, "
        "authentic Japanese sumi-e ink painting on fibrous washi paper, visible hand-drawn black ink contour lines (墨線), "
        "soft watercolor ink bleeding, delicate washi paper grain, simplified clean surfaces with minimal clutter. "
        "Weathered bone-white and muted grey stone slabs smoothly embedded into warm ochre sandy dirt ground, "
        "organic clusters of deep crimson spider lilies and fallen petals, harmonious low-contrast game background, seamless 4-way tileable pattern."
    )

    runs = [
        ("user_ref_edit_v2_natural", p_natural, 0.58, 202601),
        ("user_ref_edit_v3_sumie", p_sumie, 0.46, 202602)
    ]

    for name, p, denoise, s in runs:
        print(f"\n=======================================================")
        print(f"[*] Starting Edit Run: {name} (Denoise: {denoise}, Seed: {s})")
        out_files, used_seed = run_edit_generation(p, negative, seed=s, denoise=denoise, prefix=name)
        if out_files:
            raw_src = out_files[0]
            target_raw = f"art/stage8-yomi/scene/G_ground_yomi_{name}.png"
            target_webp = f"art/stage8-yomi/scene/G_ground_yomi_512_{name}.webp"
            preview_2x2 = f"art/stage8-yomi/Preview_tiled_2x2_ground_yomi_{name}.png"
            preview_3x3 = f"art/stage8-yomi/Preview_tiled_3x3_ground_yomi_{name}.png"
            artifact_prefix = f"stage8_{name}"
            process_and_tile(raw_src, target_raw, target_webp, preview_2x2, preview_3x3, artifact_prefix)
            print(f"[SUCCESS] {name} complete!")
