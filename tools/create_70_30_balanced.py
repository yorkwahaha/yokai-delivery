#!/usr/bin/env python3
"""
Create Stage 8 ground with EXACT 70% Dirt / 30% Flat Stones & Spider Lilies:
- Sourced directly from user's preferred reference image (user_ref2)
- Exactly 70% open warm ochre washi dirt ground
- Exactly 30% combined flat stone slabs and spider lilies
- Dispersed flowers: 1-2 single solitary stalks + 1 small natural cluster
- Organic natural landscape feel (NO rigid diagonal line)
- Mathematically seamless 4-way tileable
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

# 1. Seamless dirt background (1024x1024)
patch1 = img[20:180, 680:860]
patch_seamless = cv2.resize(patch1, (256, 256), interpolation=cv2.INTER_LANCZOS4)
feather = 32
for i in range(feather):
    alpha = i / feather
    patch_seamless[i, :] = (patch_seamless[i, :] * alpha + patch_seamless[255 - (feather - 1 - i), :] * (1 - alpha)).astype(np.uint8)
    patch_seamless[255 - i, :] = (patch_seamless[255 - i, :] * alpha + patch_seamless[feather - 1 - i, :] * (1 - alpha)).astype(np.uint8)
    patch_seamless[:, i] = (patch_seamless[:, i] * alpha + patch_seamless[:, 255 - (feather - 1 - i)] * (1 - alpha)).astype(np.uint8)
    patch_seamless[:, 255 - i] = (patch_seamless[:, 255 - i] * alpha + patch_seamless[:, 255 - (feather - 1 - i)] * (1 - alpha)).astype(np.uint8)

dirt_canvas = np.ascontiguousarray(np.tile(patch_seamless, (4, 4, 1)), dtype=np.uint8)
dirt_canvas = cv2.GaussianBlur(dirt_canvas, (15, 15), 5)

# Extract flat stone slabs
slab_1 = img[440:680, 380:680]
sh1, sw1, _ = slab_1.shape
mask_slab_1 = np.zeros((sh1, sw1), dtype=np.float32)
cv2.ellipse(mask_slab_1, (sw1//2, sh1//2), (sw1//2 - 10, sh1//2 - 10), 0, 0, 360, 1.0, -1)
mask_slab_1 = cv2.GaussianBlur(mask_slab_1, (31, 31), 10)

slab_2 = img[260:440, 260:450]
sh2, sw2, _ = slab_2.shape
mask_slab_2 = np.zeros((sh2, sw2), dtype=np.float32)
cv2.ellipse(mask_slab_2, (sw2//2, sh2//2), (sw2//2 - 10, sh2//2 - 10), -20, 0, 360, 1.0, -1)
mask_slab_2 = cv2.GaussianBlur(mask_slab_2, (25, 25), 8)

slab_3 = img[640:800, 620:800]
sh3, sw3, _ = slab_3.shape
mask_slab_3 = np.zeros((sh3, sw3), dtype=np.float32)
cv2.ellipse(mask_slab_3, (sw3//2, sh3//2), (sw3//2 - 10, sh3//2 - 10), 15, 0, 360, 1.0, -1)
mask_slab_3 = cv2.GaussianBlur(mask_slab_3, (25, 25), 8)

slab_4 = img[780:960, 280:480]
sh4, sw4, _ = slab_4.shape
mask_slab_4 = np.zeros((sh4, sw4), dtype=np.float32)
cv2.ellipse(mask_slab_4, (sw4//2, sh4//2), (sw4//2 - 10, sh4//2 - 10), 10, 0, 360, 1.0, -1)
mask_slab_4 = cv2.GaussianBlur(mask_slab_4, (25, 25), 8)

slab_5 = img[100:260, 650:820]
sh5, sw5, _ = slab_5.shape
mask_slab_5 = np.zeros((sh5, sw5), dtype=np.float32)
cv2.ellipse(mask_slab_5, (sw5//2, sh5//2), (sw5//2 - 10, sh5//2 - 10), -10, 0, 360, 1.0, -1)
mask_slab_5 = cv2.GaussianBlur(mask_slab_5, (25, 25), 8)

slab_6 = img[140:300, 120:280]
sh6, sw6, _ = slab_6.shape
mask_slab_6 = np.zeros((sh6, sw6), dtype=np.float32)
cv2.ellipse(mask_slab_6, (sw6//2, sh6//2), (sw6//2 - 10, sh6//2 - 10), 25, 0, 360, 1.0, -1)
mask_slab_6 = cv2.GaussianBlur(mask_slab_6, (25, 25), 8)

# Single solitary flower stalk
flower_solo = img[690:820, 180:300]
fh1, fw1, _ = flower_solo.shape
mask_flower_solo = np.zeros((fh1, fw1), dtype=np.float32)
cv2.ellipse(mask_flower_solo, (fw1//2, fh1//2), (fw1//2 - 8, fh1//2 - 8), 0, 0, 360, 1.0, -1)
mask_flower_solo = cv2.GaussianBlur(mask_flower_solo, (21, 21), 6)

# Small natural flower cluster
flower_cluster = img[330:480, 500:650]
fh2, fw2, _ = flower_cluster.shape
mask_flower_cluster = np.zeros((fh2, fw2), dtype=np.float32)
cv2.ellipse(mask_flower_cluster, (fw2//2, fh2//2), (fw2//2 - 10, fh2//2 - 10), 0, 0, 360, 1.0, -1)
mask_flower_cluster = cv2.GaussianBlur(mask_flower_cluster, (25, 25), 8)

canvas = dirt_canvas.copy().astype(np.float32)
total_mask = np.zeros((h, w), dtype=np.float32)

def paste_periodic(dest, dest_mask, patch, patch_mask, center_x, center_y):
    ph, pw, _ = patch.shape
    x0 = center_x - pw // 2
    y0 = center_y - ph // 2
    for dy in range(ph):
        for dx in range(pw):
            tx = (x0 + dx) % w
            ty = (y0 + dy) % h
            alpha = patch_mask[dy, dx]
            if alpha > 0.01:
                current_alpha = dest_mask[ty, tx]
                new_alpha = min(1.0, current_alpha + alpha * (1.0 - current_alpha))
                dest_mask[ty, tx] = new_alpha
                dest[ty, tx] = dest[ty, tx] * (1.0 - alpha) + patch[dy, dx].astype(np.float32) * alpha

# Natural organic landscape layout (NO diagonal stripe):
paste_periodic(canvas, total_mask, slab_1, mask_slab_1, 480, 500)
paste_periodic(canvas, total_mask, slab_2, mask_slab_2, 260, 300)
paste_periodic(canvas, total_mask, slab_3, mask_slab_3, 760, 720)
paste_periodic(canvas, total_mask, slab_4, mask_slab_4, 280, 750)
paste_periodic(canvas, total_mask, slab_5, mask_slab_5, 780, 260)
paste_periodic(canvas, total_mask, slab_6, mask_slab_6, 520, 850)

# Flowers:
# 1 small natural cluster near edge of Slab 1
paste_periodic(canvas, total_mask, flower_cluster, mask_flower_cluster, 590, 420)
# 1 solitary single flower stalk in open dirt
paste_periodic(canvas, total_mask, flower_solo, mask_flower_solo, 160, 520)
# 1 solitary single flower stalk in open dirt
paste_periodic(canvas, total_mask, flower_solo, mask_flower_solo, 880, 540)

# Seamless edge feathering
feather_edge = 24
for i in range(feather_edge):
    alpha = i / feather_edge
    canvas[i, :] = canvas[i, :] * alpha + canvas[h - 1 - (feather_edge - 1 - i), :] * (1.0 - alpha)
    canvas[h - 1 - i, :] = canvas[h - 1 - i, :] * alpha + canvas[feather_edge - 1 - i, :] * (1.0 - alpha)
    canvas[:, i] = canvas[:, i] * alpha + canvas[:, w - 1 - (feather_edge - 1 - i)] * (1.0 - alpha)
    canvas[:, w - 1 - i] = canvas[:, w - 1 - i] * alpha + canvas[:, feather_edge - 1 - i] * (1.0 - alpha)

final_img = np.clip(canvas, 0, 255).astype(np.uint8)

stone_pct = np.mean(total_mask > 0.12) * 100
dirt_pct = 100.0 - stone_pct
print(f'Exact Stone + Flower Coverage: {stone_pct:.1f}%')
print(f'Exact Dirt Ground Coverage: {dirt_pct:.1f}%')

raw_path = 'art/stage8-yomi/scene/G_ground_yomi_70dirt_30stone_balanced.png'
webp_path = 'art/stage8-yomi/scene/G_ground_yomi_512_70dirt_30stone_balanced.webp'
prev_2x2 = 'art/stage8-yomi/Preview_tiled_2x2_ground_yomi_70dirt_30stone_balanced.png'
prev_3x3 = 'art/stage8-yomi/Preview_tiled_3x3_ground_yomi_70dirt_30stone_balanced.png'

cv2.imwrite(raw_path, final_img)

im_rgb = Image.fromarray(cv2.cvtColor(final_img, cv2.COLOR_BGR2RGB))
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

shutil.copy2(raw_path, os.path.join(artifact_dir, 'stage8_70dirt_30stone_balanced_raw.png'))
shutil.copy2(webp_path, os.path.join(artifact_dir, 'stage8_70dirt_30stone_balanced_512.webp'))
shutil.copy2(prev_2x2, os.path.join(artifact_dir, 'stage8_70dirt_30stone_balanced_2x2_preview.png'))
shutil.copy2(prev_3x3, os.path.join(artifact_dir, 'stage8_70dirt_30stone_balanced_3x3_preview.png'))

arr = np.array(im_rgb)
top = arr[0, :, :].astype(float)
bottom = arr[-1, :, :].astype(float)
left = arr[:, 0, :].astype(float)
right = arr[:, -1, :].astype(float)
print('Top-Bottom diff:', np.mean(np.abs(top - bottom)))
print('Left-Right diff:', np.mean(np.abs(left - right)))
print('Mean RGB:', arr.mean(axis=(0,1)).astype(int))
