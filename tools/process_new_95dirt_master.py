#!/usr/bin/env python3
"""
Process and finalize the new Stage 8 Yomi 95% Trampled Dirt Ground candidates:
- S950201: Organic natural stepping stones + solitary lily + bottom-right cluster (~92% dirt)
- S950202: Rectangular tobi-ishi flagstones + solitary lily + cluster (~92% dirt)
- S950102: Ultra-sparse trampled earthen road (~97% dirt)
- Apply frequency-separation seamless processing (Edge diff = 0.000, 100% crisp sharpness)
- Export game assets (512 WebP, 1024 PNG, 2x2, 3x3) and comprehensive comparison board
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import shutil

artifact_dir = r"C:\Users\York\.gemini\antigravity\brain\fa1c8457-83da-4548-8d12-8cf54c19a2bc"
output_dir = r"art/stage8-yomi/scene"
os.makedirs(output_dir, exist_ok=True)

def make_frequency_seamless(img, blend_w=128, high_w=8):
    h, w, _ = img.shape
    low = cv2.GaussianBlur(img.astype(np.float32), (0, 0), 50)
    high = img.astype(np.float32) - low

    # Smooth cosine blending for low frequencies (lighting / brightness)
    mid_h = 0.5 * (low[0, :, :].copy() + low[-1, :, :].copy())
    for y in range(blend_w):
        alpha = 0.5 * (1.0 - np.cos(np.pi * y / blend_w))
        low[y, :, :] = (1.0 - alpha) * mid_h + alpha * low[y, :, :]
        low[h - 1 - y, :, :] = (1.0 - alpha) * mid_h + alpha * low[h - 1 - y, :, :]

    mid_v = 0.5 * (low[:, 0, :].copy() + low[:, -1, :].copy())
    for x in range(blend_w):
        alpha = 0.5 * (1.0 - np.cos(np.pi * x / blend_w))
        low[:, x, :] = (1.0 - alpha) * mid_v + alpha * low[:, x, :]
        low[:, w - 1 - x, :] = (1.0 - alpha) * mid_v + alpha * low[:, w - 1 - x, :]

    # Micro border blend for high frequencies
    for y in range(high_w):
        alpha = float(y) / float(high_w)
        mid_high = 0.5 * (high[y, :, :] + high[h - 1 - y, :, :])
        high[y, :, :] = (1.0 - alpha) * mid_high + alpha * high[y, :, :]
        high[h - 1 - y, :, :] = (1.0 - alpha) * mid_high + alpha * high[h - 1 - y, :, :]

    for x in range(high_w):
        alpha = float(x) / float(high_w)
        mid_high = 0.5 * (high[:, x, :] + high[:, w - 1 - x, :])
        high[:, x, :] = (1.0 - alpha) * mid_high + alpha * high[:, x, :]
        high[:, w - 1 - x, :] = (1.0 - alpha) * mid_high + alpha * high[:, w - 1 - x, :]

    return np.clip(low + high, 0, 255).astype(np.uint8)

def export_candidate(src_img_path, base_name, label):
    img = cv2.imread(src_img_path)
    seamless_img = make_frequency_seamless(img)

    raw_path = os.path.join(output_dir, f"G_ground_yomi_{base_name}.png")
    webp_path = os.path.join(output_dir, f"G_ground_yomi_512_{base_name}.webp")
    prev_2x2_path = f"art/stage8-yomi/Preview_tiled_2x2_ground_yomi_{base_name}.png"
    prev_3x3_path = f"art/stage8-yomi/Preview_tiled_3x3_ground_yomi_{base_name}.png"

    cv2.imwrite(raw_path, seamless_img)

    im_rgb = Image.fromarray(cv2.cvtColor(seamless_img, cv2.COLOR_BGR2RGB))
    im_512 = im_rgb.resize((512, 512), Image.Resampling.LANCZOS)
    im_512.save(webp_path, "WEBP", quality=95)

    # 2x2
    t2 = Image.new("RGB", (1024, 1024))
    t2.paste(im_512, (0, 0))
    t2.paste(im_512, (512, 0))
    t2.paste(im_512, (0, 512))
    t2.paste(im_512, (512, 512))
    t2.save(prev_2x2_path)

    # 3x3
    t3 = Image.new("RGB", (1536, 1536))
    for ty in range(3):
        for tx in range(3):
            t3.paste(im_512, (tx*512, ty*512))
    t3.save(prev_3x3_path)

    # Copy to artifacts
    shutil.copy2(raw_path, os.path.join(artifact_dir, f"stage8_{base_name}_raw.png"))
    shutil.copy2(webp_path, os.path.join(artifact_dir, f"stage8_{base_name}_512.webp"))
    shutil.copy2(prev_2x2_path, os.path.join(artifact_dir, f"stage8_{base_name}_2x2_preview.png"))
    shutil.copy2(prev_3x3_path, os.path.join(artifact_dir, f"stage8_{base_name}_3x3_preview.png"))

    # Compute dirt vs stone coverage
    hsv = cv2.cvtColor(seamless_img, cv2.COLOR_BGR2HSV)
    # Stones: grey (low S, high/mid V), Flowers: red
    diff_rg = np.abs(seamless_img[:,:,2].astype(float) - seamless_img[:,:,1].astype(float))
    diff_gb = np.abs(seamless_img[:,:,1].astype(float) - seamless_img[:,:,0].astype(float))
    stone_mask = (diff_rg < 18) & (diff_gb < 18) & (seamless_img[:,:,2] > 110) & (seamless_img[:,:,2] < 200)

    red1 = cv2.inRange(hsv, np.array([0, 70, 40]), np.array([14, 255, 255]))
    red2 = cv2.inRange(hsv, np.array([165, 70, 40]), np.array([180, 255, 255]))
    flower_mask = cv2.bitwise_or(red1, red2)

    feature_mask = (stone_mask | (flower_mask > 0))
    feature_cov = np.mean(feature_mask) * 100
    dirt_cov = 100.0 - feature_cov

    arr = np.array(im_rgb)
    top_diff = np.mean(np.abs(arr[0,:,:].astype(float) - arr[-1,:,:].astype(float)))
    left_diff = np.mean(np.abs(arr[:,0,:].astype(float) - arr[:,-1,:].astype(float)))
    sharp = cv2.Laplacian(cv2.cvtColor(seamless_img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()

    print(f"[{label}]")
    print(f"  Dirt Coverage:    {dirt_cov:.1f}%")
    print(f"  Feature Coverage: {feature_cov:.1f}%")
    print(f"  Seam Diff:        Top-Bot={top_diff:.3f}, Left-Right={left_diff:.3f}")
    print(f"  Laplacian Sharp:  {sharp:.1f}")

    return prev_2x2_path

# Export Candidates
p1 = export_candidate(r"G:\ComfyUI_Output\images\Stage8_95Dirt_New_S950201_00001.png", "trampled_92dirt_natural_s1", "Candidate 1 (Natural Stepping Stones)")
p2 = export_candidate(r"G:\ComfyUI_Output\images\Stage8_95Dirt_New_S950202_00001.png", "trampled_92dirt_tobiishi_s2", "Candidate 2 (Tobi-ishi Garden Slabs)")
p3 = export_candidate(r"C:\Users\York\.gemini\antigravity\brain\fa1c8457-83da-4548-8d12-8cf54c19a2bc\s950102_organic_seamless.png", "trampled_97dirt_ultra_sparse", "Candidate 3 (Ultra-Sparse 97% Dirt)")

# Build Unified 4-Panel Master Review Board
prev_old = Image.open(os.path.join(artifact_dir, "stage8_crisp_70dirt_authentic_2x2_preview.png"))
im1 = Image.open(p1)
im2 = Image.open(p2)
im3 = Image.open(p3)

board = Image.new("RGB", (1024 * 4, 1024 + 110), (25, 25, 25))
board.paste(prev_old, (0, 110))
board.paste(im1, (1024, 110))
board.paste(im2, (2048, 110))
board.paste(im3, (3072, 110))

draw = ImageDraw.Draw(board)
try:
    font = ImageFont.truetype("arial.ttf", 34)
    font_sub = ImageFont.truetype("arial.ttf", 22)
except:
    font = ImageFont.load_default()
    font_sub = font

draw.text((60, 25), "[OLD] crisp_70dirt (~50% stones)", fill=(255, 160, 160), font=font)
draw.text((60, 68), "Dense, diagonal tracks, trypophobia", fill=(200, 200, 200), font=font_sub)

draw.text((1024 + 60, 25), "[NEW 1] Natural Stepping Trail (~92% Dirt)", fill=(160, 255, 180), font=font)
draw.text((1024 + 60, 68), "Organic worn stones, solitary lily + cluster, 0.0 seam", fill=(200, 200, 200), font=font_sub)

draw.text((2048 + 60, 25), "[NEW 2] Tobi-ishi Slabs (~92% Dirt)", fill=(160, 230, 255), font=font)
draw.text((2048 + 60, 68), "Rectangular garden slabs, solitary lily + cluster", fill=(200, 200, 200), font=font_sub)

draw.text((3072 + 60, 25), "[NEW 3] Ultra-Sparse Road (~97% Dirt)", fill=(255, 230, 160), font=font)
draw.text((3072 + 60, 68), "Vast trodden earthen expanse, 1 solitary spider lily", fill=(200, 200, 200), font=font_sub)

board_path = os.path.join(artifact_dir, "stage8_trampled_dirt_master_comparison_board.png")
board.save(board_path)
print(f"[SUCCESS] Master comparison board saved: {board_path}")
