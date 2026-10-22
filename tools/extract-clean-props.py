#!/usr/bin/env python3
"""
Re-extract Stage8 items using connected component analysis on alpha channel.
Extract only genuinely isolated opaque components (flower stalks, bone fragments, rocks)
with clean transparent borders. Reject rectangular soil patches.
"""
import os
import json
from PIL import Image

SOURCE = os.path.join(os.path.dirname(__file__), "..", "art", "stage8-yomi", "scene", "G_ground_boneflower_tilesheet_trial_v1.png")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "art", "stage8-yomi", "sliced_v2")
os.makedirs(OUT_DIR, exist_ok=True)

img = Image.open(SOURCE).convert('RGBA')
w, h = img.size
pixels = img.load()

print(f"Source: {w}x{h}")

# Find connected components of opaque pixels (alpha > 128)
visited = [[False] * w for _ in range(h)]
components = []

# Directions for 4-connectivity
dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]

for y in range(h):
    for x in range(w):
        if visited[y][x]:
            continue
        if pixels[x, y][3] <= 128:
            continue

        # Flood fill
        stack = [(x, y)]
        visited[y][x] = True
        min_x, max_x = x, x
        min_y, max_y = y, y
        pixel_count = 0
        pixels_list = []

        while stack:
            cx, cy = stack.pop()
            min_x = min(min_x, cx)
            max_x = max(max_x, cx)
            min_y = min(min_y, cy)
            max_y = max(max_y, cy)
            pixel_count += 1
            pixels_list.append((cx, cy))

            for dx, dy in dirs:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                    if pixels[nx, ny][3] > 128:
                        visited[ny][nx] = True
                        stack.append((nx, ny))

        comp_w = max_x - min_x + 1
        comp_h = max_y - min_y + 1
        bbox_area = comp_w * comp_h
        fill_ratio = pixel_count / bbox_area if bbox_area > 0 else 0

        components.append({
            'x': min_x, 'y': min_y, 'w': comp_w, 'h': comp_h,
            'pixel_count': pixel_count,
            'bbox_area': bbox_area,
            'fill_ratio': fill_ratio,
            'pixels': pixels_list
        })

print(f"Found {len(components)} connected components")

# Filter for genuinely small isolated items (props)
# Reject large rectangular components (ground tiles, path tiles)
# Keep: small components with reasonable fill ratio, not too rectangular
props = []
for i, comp in enumerate(components):
    cw, ch = comp['w'], comp['h']
    area = comp['pixel_count']
    fill = comp['fill_ratio']

    # Criteria for clean prop:
    # - Small enough to be a prop (not a ground tile)
    # - Not too rectangular (fill_ratio not too high for large bbox)
    # - Aspect ratio not extreme
    aspect = cw / ch if ch > 0 else 0

    # Reject large components (>150px in either dimension) - these are ground/path tiles
    is_large = cw > 150 or ch > 150

    # Reject very rectangular (fill > 0.85 for larger components)
    is_rectangular = fill > 0.85 and (cw > 80 or ch > 80)

    # Accept small isolated items
    is_small_prop = cw <= 150 and ch <= 150 and area > 50 and area < 8000

    if is_small_prop and not is_rectangular:
        props.append((i, comp))
        print(f"  PROP candidate {i}: ({comp['x']},{comp['y']}) {cw}x{ch} "
              f"area={area} fill={fill:.2f} aspect={aspect:.2f}")
    elif is_large:
        print(f"  REJECT large {i}: ({comp['x']},{comp['y']}) {cw}x{ch} area={area} fill={fill:.2f}")
    else:
        print(f"  REJECT rectangular {i}: ({comp['x']},{comp['y']}) {cw}x{ch} area={area} fill={fill:.2f}")

print(f"\nSelected {len(props)} clean prop components")

# Extract each prop with tight crop (add 2px padding)
for idx, (comp_idx, comp) in enumerate(props):
    x, y, cw, ch = comp['x'], comp['y'], comp['w'], comp['h']
    pad = 2
    crop_x = max(0, x - pad)
    crop_y = max(0, y - pad)
    crop_w = min(w - crop_x, cw + 2 * pad)
    crop_h = min(h - crop_y, ch + 2 * pad)

    crop = img.crop((crop_x, crop_y, crop_x + crop_w, crop_y + crop_h))

    # Verify clean borders
    crop_pixels = crop.load()
    cw2, ch2 = crop.size
    border_trans = 0
    border_total = 0
    for yy in [0, ch2-1]:
        for xx in range(cw2):
            border_total += 1
            if crop_pixels[xx, yy][3] == 0:
                border_trans += 1
    for xx in [0, cw2-1]:
        for yy in range(ch2):
            border_total += 1
            if crop_pixels[xx, yy][3] == 0:
                border_trans += 1

    border_pct = border_trans / border_total * 100 if border_total > 0 else 0

    out_path = os.path.join(OUT_DIR, f"clean_prop_{idx}.png")
    crop.save(out_path)
    print(f"  Extracted clean_prop_{idx}: {crop_w}x{crop_h} border_trans={border_pct:.1f}% -> {out_path}")

# Also save a visual map
viz = Image.new('RGBA', (w, h), (0, 0, 0, 0))
viz_pixels = viz.load()
for i, (comp_idx, comp) in enumerate(props):
    x, y, cw, ch = comp['x'], comp['y'], comp['w'], comp['h']
    for px, py in components[comp_idx]['pixels']:
        viz_pixels[px, py] = (255, 255, 0, 255)  # Yellow for selected props

viz_path = os.path.join(OUT_DIR, "selected_props_map.png")
viz.save(viz_path)
print(f"\nVisual map saved: {viz_path}")

# Save metadata
meta = {
    'source': SOURCE,
    'source_size': [w, h],
    'total_components': len(components),
    'selected_props': len(props),
    'props': [
        {
            'index': idx,
            'source_component': comp_idx,
            'bbox': [comp['x'], comp['y'], comp['w'], comp['h']],
            'pixel_count': comp['pixel_count'],
            'fill_ratio': comp['fill_ratio'],
            'output_file': f"clean_prop_{idx}.png"
        }
        for idx, (comp_idx, comp) in enumerate(props)
    ]
}
with open(os.path.join(OUT_DIR, "clean_props_meta.json"), 'w') as f:
    json.dump(meta, f, indent=2)
print(f"Metadata saved: {os.path.join(OUT_DIR, 'clean_props_meta.json')}")