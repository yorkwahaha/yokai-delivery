#!/usr/bin/env python3
"""
Generate 95% Trampled Dirt Ground candidates for Stage 8 Yomi.
"""

import json
import urllib.request
import time
import os

COMFY_HOST = "http://127.0.0.1:8188"
WORKFLOW_TEMPLATE = r"e:\Downloads\image_qwen_image_2_1_t2i.json"

prompt_text = (
    "seamless tileable 2D game ground texture, strict 90-degree direct top-down orthographic overhead view, looking perpendicularly straight down. "
    "Traditional Japanese sumi-e ink wash painting on antique tea-stained washi paper, muted weathered clay and earthen dirt ground, desaturated warm grey-brown soil with subtle charcoal ink dry-brush texture. "
    "95 percent vast calm dirt road that has been trodden flat and compacted by centuries of foot traffic (被無數行者踏平的黃泉古道). "
    "Extremely calm, flat, low-contrast game floor background. "
    "Only two or three small flat weathered grey stone slabs (平面的青石板) embedded flush into the earth. "
    "One solitary single red spider lily stalk (彼岸花) standing quietly in the open dirt with a few fallen crimson petals. "
    "No dense clusters, no busy cobblestones, no diagonal tracks, no bright yellow, seamless repeating pattern on all four edges."
)

negative_text = (
    "bright yellow, saturated golden, mustard, vivid yellow, shiny, plastic, "
    "dense stones, cobblestone pavement, stone road, mosaic, rocky, crowded, cluttered, busy, messy, "
    "trypophobia, high contrast, steep rocks, 3D cubes, perspective, diagonal lines, road stripes, "
    "magma, lava, dark void, pitch black, modern, characters, UI, text, blur, blurry."
)

def run():
    with open(WORKFLOW_TEMPLATE, "r", encoding="utf-8") as f:
        wf = json.load(f)

    wf["459:474"]["inputs"]["switch"] = False
    wf["459:474"]["inputs"]["on_false"] = prompt_text
    wf["459:452"]["inputs"]["negative_prompt"] = negative_text

    seeds = [950101, 950102, 950103]
    pids = []
    for s in seeds:
        wf["459:458"]["inputs"]["seed"] = s
        wf["461"]["inputs"]["filename_prefix"] = f"Stage8_95Dirt_S{s}"
        data = json.dumps({"prompt": wf, "client_id": f"test_{s}"}).encode("utf-8")
        req = urllib.request.Request(f"{COMFY_HOST}/prompt", data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode("utf-8"))
        pids.append((s, res["prompt_id"]))
        print(f"Queued seed {s}: {res['prompt_id']}")

    for s, pid in pids:
        start = time.time()
        while time.time() - start < 120:
            with urllib.request.urlopen(f"{COMFY_HOST}/history/{pid}") as r:
                h = json.loads(r.read().decode("utf-8"))
            if pid in h:
                print(f"Seed {s} finished!")
                break
            time.sleep(2)

if __name__ == "__main__":
    run()
