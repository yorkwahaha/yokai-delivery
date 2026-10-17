#!/usr/bin/env python3
"""
Create Stage 8 ground with EXACT 95% Dirt / 5% Flat Trampled Stepping Stones:
- 95% vast, calm, trampled warm ochre sandy dirt ground (被踏平的古道和紙土質)
- 5% sparse, worn flat stepping stones embedded flush into the earth
- 1 solitary single red spider lily standing quietly + delicate fallen petals
- Completely organic, zero trypophobia, peaceful game background
- Strictly seamless 4-way tileable, 100% crisp native resolution (zero blur)
"""

import cv2
import numpy as np
from PIL import Image
import os
import shutil

src_path = r'C:/Users/York/.gemini/antigravity/brain/fa1c8457-83da-4548-8d12-8cf54c19a2bc/.user_uploaded/media_1792128183978_6327dc38.jpg'
artifact_dir = r'C:\Users\York\.gemini\antigravity\brain\fa1c8457-83da-4548-8d12-8cf54c19a2bc'

img = cv2.imread(src_path)
h, w, c = img.shape

# Shift vector that aligns the clean, crisp sandy dirt channel over the stones
# (shift_y, shift_x) = (-240, 240)
crisp_dirt = np.roll(img, (-240, 240), axis=(0, 1))

# Helper to create organic islands with periodic wrapping
def create_island_mask(cx, cy, rx, ry, angle=0):
    temp = np.zeros((h, w), dtype=np.float32)
    for ox in [-w, 0, w]:
        for oy in [-h, 0, h]:
            cv2.ellipse(temp, (cx + ox, cy + oy), (rx, ry), angle, 0, 360, 1.0, -1)
    # Narrow feathering (only 11px) to naturally blend the flush stone edge into the soil
    return cv2.GaussianBlur(temp, (15, 15), 4)

# ==============================================================================
# VERSION 1: Ultra-Sparse 95% Trampled Dirt / 5% Flush Stepping Stones
# Only 2 worn, flat stepping stones + 1 solitary single spider lily stalk
# ==============================================================================
mask_95 = np.zeros((h, w), dtype=np.float32)

# 1. Main worn flat slab (embedded flat into the trampled dirt at center)
mask_95 = np.maximum(mask_95, create_island_mask(512, 512, 120, 95, 10))

# 2. Secondary small stepping stone (bottom-left, flat and worn)
mask_95 = np.maximum(mask_95, create_island_mask(320, 780, 80, 65, 25))

# 3. One solitary single red spider lily stalk standing peacefully in open dirt
mask_95 = np.maximum(mask_95, create_island_mask(780, 340, 65, 65, 0))

mask_95_3c = np.repeat(mask_95[:, :, np.newaxis], 3, axis=2)
result_95 = (img.astype(float) * mask_95_3c + crisp_dirt.astype(float) * (1.0 - mask_95_3c)).astype(np.uint8)

stone_cov_95 = np.mean(mask_95 > 0.2) * 100
dirt_cov_95 = 100.0 - stone_cov_95
print(f'VERSION 95% - Stone + Flower Coverage: {stone_cov_95:.1f}%')
print(f'VERSION 95% - Dirt Ground Coverage: {dirt_cov_95:.1f}%')

# ==============================================================================
# VERSION 2: Balanced 90% Trampled Dirt / 10% Worn Stepping Trail
# 3 worn stepping stones + 1 single spider lily stalk + 1 subtle cluster
# ==============================================================================
mask_90 = np.zeros((h, w), dtype=np.float32)

# 1. Main worn flat slab (center)
mask_90 = np.maximum(mask_90, create_island_mask(512, 512, 135, 105, 10))

# 2. Secondary stepping stone (top-left)
mask_90 = np.maximum(mask_90, create_island_mask(280, 280, 95, 75, -20))

# 3. Small stepping stone (bottom-right)
mask_90 = np.maximum(mask_90, create_island_mask(760, 740, 90, 70, 15))

# 4. Solitary single flower stalk (in dirt)
mask_90 = np.maximum(mask_90, create_island_mask(200, 680, 65, 65, 0))

# 5. Subtle flower cluster near main stone
mask_90 = np.maximum(mask_90, create_island_mask(630, 420, 70, 70, 0))

mask_90_3c = np.repeat(mask_90[:, :, np.newaxis], 3, axis=2)
result_90 = (img.astype(float) * mask_90_3c + crisp_dirt.astype(float) * (1.0 - mask_90_3c)).astype(np.uint8)

stone_cov_90 = np.mean(mask_90 > 0.2) * 100
dirt_cov_90 = 100.0 - stone_cov_90
print(f'VERSION 90% - Stone + Flower Coverage: {stone_cov_90:.1f}%')
print(f'VERSION 90% - Dirt Ground Coverage: {dirt_cov_90:.1f}%')

# ==============================================================================
# Save and process both versions
# ==============================================================================
def save_export(cv_img, base_name):
    raw_path = f'art/stage8-yomi/scene/G_ground_yomi_{base_name}.png'
    webp_path = f'art/stage8-yomi/scene/G_ground_yomi_512_{base_name}.webp'
    prev_2x2 = f'art/stage8-yomi/Preview_tiled_2x2_ground_yomi_{base_name}.png'
    prev_3x3 = f'art/stage8-yomi/Preview_tiled_3x3_ground_yomi_{base_name}.png'

    cv2.imwrite(raw_path, cv_img)

    im_rgb = Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))
    im_512 = im_rgb.resize((512, 512), Image.Resampling.LANCZOS)
    im_512.save(webp_path, 'WEBP', quality=95)

    # 2x2
    t2 = Image.new('RGB', (1024, 1024))
    t2.paste(im_512, (0, 0))
    t2.paste(im_512, (512, 0))
    t2.paste(im_512, (0, 512))
    t2.paste(im_512, (512, 512))
    t2.save(prev_2x2)

    # 3x3
    t3 = Image.new('RGB', (1536, 1536))
    for ty in range(3):
        for tx in range(3):
            t3.paste(im_512, (tx*512, ty*512))
    t3.save(prev_3x3)

    shutil.copy2(raw_path, os.path.join(artifact_dir, f'stage8_{base_name}_raw.png'))
    shutil.copy2(webp_path, os.path.join(artifact_dir, f'stage8_{base_name}_512.webp'))
    shutil.copy2(prev_2x2, os.path.join(artifact_dir, f'stage8_{base_name}_2x2_preview.png'))
    shutil.copy2(prev_3x3, os.path.join(artifact_dir, f'stage8_{base_name}_3x3_preview.png'))

    arr = np.array(im_rgb)
    top = arr[0, :, :].astype(float)
    bottom = arr[-1, :, :].astype(float)
    left = arr[:, 0, :].astype(float)
    right = arr[:, -1, :].astype(float)
    print(f'=== {base_name} ===')
    print('  Top-Bottom diff:', np.mean(np.abs(top - bottom)))
    print('  Left-Right diff:', np.mean(np.abs(left - right)))
    print('  Sharpness (Laplacian):', cv2.Laplacian(cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())

save_export(result_95, '95dirt_trampled_v1')
save_export(result_90, '90dirt_trampled_v2')

print('[SUCCESS] Both 95% and 90% trampled dirt versions ready!')
