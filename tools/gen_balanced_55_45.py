#!/usr/bin/env python3
"""
Generate Balanced (55% Dirt / 45% Flat Stones & Spider Lilies) Stage 8 Yomi Ground:
- Neither extremely empty (not like Candidate 1)
- Nor overcrowded (reduce rocks by 1/3 compared to user_ref)
- Balanced winding earthen path with clusters of flat worn stones & crimson spider lilies
"""

import json
import urllib.request
import time
import os

COMFY_HOST = "http://127.0.0.1:8188"
WORKFLOW_TEMPLATE = r"e:\Downloads\image_qwen_image_2_1_t2i.json"

prompt_text = (
    "seamless tileable 2D game ground texture, strict 90-degree direct top-down orthographic overhead view, looking perpendicularly straight down. "
    "Traditional Japanese sumi-e ink wash painting on antique tea-stained washi paper, warm ochre and tan sandy earth. "
    "Balanced game ground composition: about 55 to 60 percent open sandy dirt path and 40 to 45 percent weathered flat stone slabs (平面的青石板), border pebbles, and deep crimson red spider lilies (彼岸花). "
    "An organic, natural earthen trail meandering between clusters of worn flat stepping stones, framed by natural clusters of blooming spider lilies and delicate fallen red petals. "
    "Natural wilderness garden aesthetic, neither empty nor overcrowded, comfortable and peaceful game background, no rigid diagonal tracks, no parallel stripes, seamless 4-way repeating pattern on all four edges."
)

negative_text = (
    "completely empty dirt, barren desert, plain sand, "
    "overcrowded cobblestone, wall-to-wall rocks, dense claustrophobic rocks, high contrast, steep 3D boulders, perspective, straight diagonal railway lines, "
    "bright yellow, modern, characters, UI, text, watermark, blurry."
)

with open(WORKFLOW_TEMPLATE, "r", encoding="utf-8") as f:
    wf = json.load(f)

wf["459:474"]["inputs"]["switch"] = False
wf["459:474"]["inputs"]["on_false"] = prompt_text
wf["459:452"]["inputs"]["negative_prompt"] = negative_text

seeds = [554501, 554502]
pids = []
for s in seeds:
    wf["459:458"]["inputs"]["seed"] = s
    wf["461"]["inputs"]["filename_prefix"] = f"Stage8_Balanced55_S{s}"
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
