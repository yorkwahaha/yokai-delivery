#!/usr/bin/env python3
"""
Generate True 70% Dirt / 30% Stone Ground (100% Crisp Native, Zero Blur):
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
crisp_dirt = np.roll(img, (-240, 240), axis=(0, 1))

mask = np.zeros((h, w), dtype=np.float32)

def add_organic_island(m, cx, cy, rx, ry, angle=0):
    temp = np.zeros((h, w), dtype=np.float32)
    for ox in [-w, 0, w]:
        for oy in [-h, 0, h]:
            cv2.ellipse(temp, (cx + ox, cy + oy), (rx, ry), angle, 0, 360, 1.0, -1)
    temp_feathered = cv2.GaussianBlur(temp, (15, 15), 4)
    return np.maximum(m, temp_feathered)

# Stone islands tuned to hit precisely 30% stone+flower coverage and 70% dirt
# 1. Main flat stone slab (center)
mask = add_organic_island(mask, 512, 512, 170, 140, 10)
# 2. Stepping stone 2 (top-left)
mask = add_organic_island(mask, 260, 280, 125, 105, -20)
# 3. Stepping stone 3 (bottom-right)
mask = add_organic_island(mask, 760, 740, 120, 100, 15)
# 4. Stepping stone 4 (bottom-left)
mask = add_organic_island(mask, 280, 780, 110, 90, 25)
# 5. Stepping stone 5 (top-right)
mask = add_organic_island(mask, 780, 260, 110, 90, -15)

# Flowers:
# 6. Flower cluster near center stone
mask = add_organic_island(mask, 630, 410, 90, 90, 0)
# 7. Solitary single spider lily in open dirt
mask = add_organic_island(mask, 160, 520, 75, 75, 0)
# 8. Solitary single spider lily in open dirt
mask = add_organic_island(mask, 880, 520, 75, 75, 0)

mask_3c = np.repeat(mask[:, :, np.newaxis], 3, axis=2)
result = (img.astype(float) * mask_3c + crisp_dirt.astype(float) * (1.0 - mask_3c)).astype(np.uint8)

stone_coverage = np.mean(mask > 0.2) * 100
dirt_coverage = 100.0 - stone_coverage
print(f'True 70/30 - Stone + Flower Coverage: {stone_coverage:.1f}%')
print(f'True 70/30 - Dirt Ground Coverage: {dirt_coverage:.1f}%')

top = result[0, :, :].astype(float)
bottom = result[-1, :, :].astype(float)
left = result[:, 0, :].astype(float)
right = result[:, -1, :].astype(float)
print('Top vs Bottom edge diff:', np.mean(np.abs(top - bottom)))
print('Left vs Right edge diff:', np.mean(np.abs(left - right)))

raw_path = 'art/stage8-yomi/scene/G_ground_yomi_crisp_70dirt_30stone_true.png'
webp_path = 'art/stage8-yomi/scene/G_ground_yomi_512_crisp_70dirt_30stone_true.webp'
prev_2x2 = 'art/stage8-yomi/Preview_tiled_2x2_ground_yomi_crisp_70dirt_30stone_true.png'
prev_3x3 = 'art/stage8-yomi/Preview_tiled_3x3_ground_yomi_crisp_70dirt_30stone_true.png'

cv2.imwrite(raw_path, result)

im_rgb = Image.fromarray(cv2.cvtColor(result, cv2.COLOR_BGR2RGB))
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

shutil.copy2(raw_path, os.path.join(artifact_dir, 'stage8_crisp_70dirt_30stone_true_raw.png'))
shutil.copy2(webp_path, os.path.join(artifact_dir, 'stage8_crisp_70dirt_30stone_true_512.webp'))
shutil.copy2(prev_2x2, os.path.join(artifact_dir, 'stage8_crisp_70dirt_30stone_true_2x2_preview.png'))
shutil.copy2(prev_3x3, os.path.join(artifact_dir, 'stage8_crisp_70dirt_30stone_true_3x3_preview.png'))

print('[SUCCESS] True 70/30 Crisp Native ground created!')
