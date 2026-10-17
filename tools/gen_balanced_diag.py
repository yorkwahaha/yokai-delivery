#!/usr/bin/env python3
import json
import urllib.request
import time
import os

COMFY_HOST = "http://127.0.0.1:8188"
WORKFLOW_TEMPLATE = r"e:\Downloads\image_qwen_image_2_1_t2i.json"

prompt = (
    "seamless tileable 2D game ground texture, strict 90-degree direct top-down orthographic overhead view, looking perpendicularly straight down. "
    "Traditional Japanese sumi-e watercolor ink wash and ukiyo-e woodblock print on antique tea-stained washi paper, warm ochre and tan sandy earth. "
    "Balanced game ground composition: 60 percent open trampled sandy dirt ground and 40 percent weathered flat stone slabs (平面的青石板), border pebbles, and deep crimson red spider lilies (彼岸花). "
    "A single diagonal trail of flat stepping stones meandering across the screen from top-left to bottom-right, embedded naturally into wide open dirt, surrounded by organic clusters of blooming spider lilies and scattered red petals. "
    "Calm, comfortable, readable game floor, flat stepping stones, no bumpy 3D boulders, no rigid parallel stripes, seamless 4-way repeating pattern on all four edges."
)
neg = (
    "completely empty dirt, barren desert, plain sand, "
    "overcrowded cobblestone, dense rocks covering screen, bumpy 3D boulders, straight vertical highway, straight horizontal road, "
    "high contrast, bright yellow, modern, characters, UI, text, watermark, blurry."
)

with open(WORKFLOW_TEMPLATE, "r", encoding="utf-8") as f:
    wf = json.load(f)

wf["459:474"]["inputs"]["switch"] = False
wf["459:474"]["inputs"]["on_false"] = prompt
wf["459:452"]["inputs"]["negative_prompt"] = neg

seeds = [554503, 554504]
pids = []
for s in seeds:
    wf["459:458"]["inputs"]["seed"] = s
    wf["461"]["inputs"]["filename_prefix"] = f"Stage8_BalancedDiag_S{s}"
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
            print(f"Seed {s} finished in {round(time.time() - start, 1)}s!")
            break
        time.sleep(2)
