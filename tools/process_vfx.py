#!/usr/bin/env python3
import sys
import os
import numpy as np
from PIL import Image

def process_vfx(src_jpg_path, out_name):
    if not os.path.exists(src_jpg_path):
        print(f"Error: {src_jpg_path} does not exist")
        sys.exit(1)

    img = Image.open(src_jpg_path).convert('RGB')
    arr = np.array(img, dtype=np.float32)

    # Check corners to determine if background is black or white
    corners = np.array([arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]])
    corner_luma = np.mean(corners)

    h, w = arr.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)

    if corner_luma > 180:
        # White background deconvolution
        norm = arr / 255.0
        inv = 1.0 - norm
        alpha = np.max(inv, axis=2)
        noise = 0.04
        alpha = np.clip((alpha - noise) / (1.0 - noise), 0.0, 1.0)
        alpha = np.power(alpha, 0.85)

        denom = np.maximum(alpha[:, :, None], 0.001)
        c0 = 1.0 - np.clip(inv / denom, 0.0, 1.0)

        rgba[:, :, :3] = np.round(c0 * 255.0).astype(np.uint8)
        rgba[:, :, 3] = np.round(alpha * 255.0).astype(np.uint8)
    else:
        # Black background deconvolution
        v = np.max(arr, axis=2)
        noise_floor = 6.0
        alpha = np.clip((v - noise_floor) / (255.0 - noise_floor), 0.0, 1.0)
        alpha = np.power(alpha, 0.85)

        denom = np.maximum(alpha[:, :, None], 0.001)
        rgb_unmultiplied = np.clip(arr / denom, 0.0, 255.0)

        rgba[:, :, :3] = np.round(rgb_unmultiplied).astype(np.uint8)
        rgba[:, :, 3] = np.round(alpha * 255.0).astype(np.uint8)

    final_png = Image.fromarray(rgba, 'RGBA')

    target_art = os.path.join(r'i:\Projects\yokai-delivery\art\vfx', f"{out_name}.png")
    target_assets = os.path.join(r'i:\Projects\yokai-delivery\assets\img\vfx', f"{out_name}.png")

    os.makedirs(os.path.dirname(target_art), exist_ok=True)
    os.makedirs(os.path.dirname(target_assets), exist_ok=True)

    final_png.save(target_art, format='PNG', optimize=True)
    final_png.save(target_assets, format='PNG', optimize=True)

    print(f"Successfully processed {out_name} (bg={'white' if corner_luma > 180 else 'black'}): {w}x{h} -> {target_art} & {target_assets}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python process_vfx.py <src_jpg> <out_name>")
        sys.exit(1)
    process_vfx(sys.argv[1], sys.argv[2])
