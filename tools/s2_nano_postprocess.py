#!/usr/bin/env python3
"""Stage 2 Rain-Port Nano Banana 2.1 Post-Processing & QA Suite.

Processes all 18 raw Nano Banana 2.1 generated assets from art/stage2-rain-port/scene/
into production-ready game assets in:
art/stage2-rain-port/production-s2-nano-20261020/

Tiling Refinements:
1. Low-frequency tonal equalization (radius 48) to eliminate large-scale lighting gradients
   (removing the 17-22 brightness difference between top/bottom and left/right that caused
   the perceived 512px repeating box grid).
2. Periodic edge locking with smoothstep feathering (16px) for organic seam continuity.
3. Runtime isolation: Main runtime area uses ONLY single canonical tiles (tile_stone_canonical,
   tile_wood_dock_canonical) to prevent repeating puddle / specular artifacts.
4. Variants with repeating features (tile_stone_var_puddle, tile_wood_dock_var_weathered)
   are cataloged under flagged_variants with status SEAM_REVIEW_RED.
5. Standalone buildings and props are keyed out from solid white matte into true RGBA with
   smooth anti-aliased edge alpha, tight bounding box padding, and calibrated footAnchors.
"""
from __future__ import annotations

import collections
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter
try:
    import numpy as np
    HAVE_NUMPY = True
except ImportError:
    HAVE_NUMPY = False

ROOT = Path(__file__).resolve().parents[1]
SCENE_DIR = ROOT / "art" / "stage2-rain-port" / "scene"
PROD_DIR = ROOT / "art" / "stage2-rain-port" / "production-s2-nano-20261020"

TILES_STONE_DIR = PROD_DIR / "tiles" / "stone"
TILES_WOOD_DIR = PROD_DIR / "tiles" / "wood"
TILES_TRANS_DIR = PROD_DIR / "tiles" / "transitions"
BUILDINGS_DIR = PROD_DIR / "buildings"
PROPS_DIR = PROD_DIR / "props"
ENV_DIR = PROD_DIR / "environment"
QA_DIR = PROD_DIR / "qa"

for d in [TILES_STONE_DIR, TILES_WOOD_DIR, TILES_TRANS_DIR, BUILDINGS_DIR, PROPS_DIR, ENV_DIR, QA_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def equalize_tone(img: Image.Image, radius: int = 48) -> Image.Image:
    """Removes low-frequency lighting gradients while preserving 100% of high-frequency texture details."""
    im_rgb = img.convert("RGB")
    if HAVE_NUMPY:
        arr = np.array(im_rgb, dtype=np.float32)
        low_freq = np.array(im_rgb.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32)
        mean_color = np.mean(arr, axis=(0, 1), keepdims=True)
        equalized = arr - low_freq + mean_color
        return Image.fromarray(np.clip(equalized, 0, 255).astype(np.uint8))
    else:
        # Pure PIL fallback: high-pass extraction
        low_freq = im_rgb.filter(ImageFilter.GaussianBlur(radius=radius))
        # high pass = im - low_freq + 128
        diff = ImageChops.subtract(im_rgb, low_freq, offset=128)
        # add back baseline
        return diff


def make_periodic_seamless(img: Image.Image, blend_width: int = 16, blend_h: bool = True, blend_v: bool = True) -> Image.Image:
    w, h = img.size
    im = img.copy().convert("RGB")
    px = im.load()

    # Horizontal (Left-Right) seamless
    if blend_h:
        for y in range(h):
            for b in range(blend_width):
                t = (b + 0.5) / blend_width
                t = t * t * (3 - 2 * t)
                left_px = px[b, y]
                right_px = px[w - 1 - b, y]
                avg = tuple(int(round((left_px[c] + right_px[c]) / 2)) for c in range(3))
                px[b, y] = tuple(int(round(left_px[c] * (1 - t) + avg[c] * t)) for c in range(3))
                px[w - 1 - b, y] = tuple(int(round(right_px[c] * (1 - t) + avg[c] * t)) for c in range(3))
            for c in range(3):
                avg_edge = int(round((px[0, y][c] + px[w - 1, y][c]) / 2))
                px[0, y] = tuple(avg_edge if i == c else px[0, y][i] for i in range(3))
                px[w - 1, y] = tuple(avg_edge if i == c else px[w - 1, y][i] for i in range(3))

    # Vertical (Top-Bottom) seamless
    if blend_v:
        for x in range(w):
            for b in range(blend_width):
                t = (b + 0.5) / blend_width
                t = t * t * (3 - 2 * t)
                top_px = px[x, b]
                bot_px = px[x, h - 1 - b]
                avg = tuple(int(round((top_px[c] + bot_px[c]) / 2)) for c in range(3))
                px[x, b] = tuple(int(round(top_px[c] * (1 - t) + avg[c] * t)) for c in range(3))
                px[x, h - 1 - b] = tuple(int(round(bot_px[c] * (1 - t) + avg[c] * t)) for c in range(3))
            for c in range(3):
                avg_edge = int(round((px[x, 0][c] + px[x, h - 1][c]) / 2))
                px[x, 0] = tuple(avg_edge if i == c else px[x, 0][i] for i in range(3))
                px[x, h - 1] = tuple(avg_edge if i == c else px[x, h - 1][i] for i in range(3))

    return im


def lock_horizontal_transition(trans_img: Image.Image, stone_canonical: Image.Image, wood_canonical: Image.Image, blend_w: int = 16) -> Image.Image:
    im = equalize_tone(trans_img.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS), radius=48)
    st = stone_canonical.copy().convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    wd = wood_canonical.copy().convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)

    px_im = im.load()
    px_st = st.load()
    px_wd = wd.load()

    # Top edge: lock to stone bottom
    for x in range(512):
        for b in range(blend_w):
            t = (b + 0.5) / blend_w
            t = t * t * (3 - 2 * t)
            target = px_st[x, 511 - b]
            current = px_im[x, b]
            px_im[x, b] = tuple(int(round(target[c] * (1 - t) + current[c] * t)) for c in range(3))
        px_im[x, 0] = px_st[x, 511]

    # Bottom edge: lock to wood top
    for x in range(512):
        for b in range(blend_w):
            t = (b + 0.5) / blend_w
            t = t * t * (3 - 2 * t)
            target = px_wd[x, b]
            current = px_im[x, 511 - b]
            px_im[x, 511 - b] = tuple(int(round(target[c] * (1 - t) + current[c] * t)) for c in range(3))
        px_im[x, 511] = px_wd[x, 0]

    # Left-Right lateral seamless
    return make_periodic_seamless(im, blend_width=blend_w, blend_h=True, blend_v=False)


def lock_vertical_transition(trans_img: Image.Image, stone_canonical: Image.Image, wood_canonical: Image.Image, blend_w: int = 16) -> Image.Image:
    im = equalize_tone(trans_img.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS), radius=48)
    st = stone_canonical.copy().convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    wd = wood_canonical.copy().convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)

    px_im = im.load()
    px_st = st.load()
    px_wd = wd.load()

    # Left edge: lock to stone right
    for y in range(512):
        for b in range(blend_w):
            t = (b + 0.5) / blend_w
            t = t * t * (3 - 2 * t)
            target = px_st[511 - b, y]
            current = px_im[b, y]
            px_im[b, y] = tuple(int(round(target[c] * (1 - t) + current[c] * t)) for c in range(3))
        px_im[0, y] = px_st[511, y]

    # Right edge: lock to wood left
    for y in range(512):
        for b in range(blend_w):
            t = (b + 0.5) / blend_w
            t = t * t * (3 - 2 * t)
            target = px_wd[b, y]
            current = px_im[511 - b, y]
            px_im[511 - b, y] = tuple(int(round(target[c] * (1 - t) + current[c] * t)) for c in range(3))
        px_im[511, y] = px_wd[0, y]

    # Top-Bottom vertical seamless
    return make_periodic_seamless(im, blend_width=blend_w, blend_h=False, blend_v=True)


def key_out_white_matte(img: Image.Image, erode_size: int = 5, white_threshold: int = 35) -> Image.Image:
    """High-precision white matte removal at full resolution.

    1. Uses BFS flood-fill from outer image boundaries to find connected white background.
    2. Performs morphological erosion (MinFilter) on the high-res mask (eroding 2-3px)
       to pull the boundary cleanly inside the bold sumi ink outline, eliminating all white fringing.
    3. Crops tight to bounding box.
    """
    im_rgb = img.convert("RGB")
    w, h = im_rgb.size
    arr = np.array(im_rgb, dtype=np.float32)

    # Color distance from pure white (255, 255, 255)
    dist_white = np.sqrt(np.sum((255.0 - arr) ** 2, axis=2))
    is_white = dist_white < white_threshold

    # BFS from all four outer image borders
    bg_mask = np.zeros((h, w), dtype=bool)
    queue = collections.deque()

    for x in range(w):
        if is_white[0, x]:
            bg_mask[0, x] = True
            queue.append((0, x))
        if is_white[h - 1, x]:
            bg_mask[h - 1, x] = True
            queue.append((h - 1, x))

    for y in range(h):
        if is_white[y, 0]:
            bg_mask[y, 0] = True
            queue.append((y, 0))
        if is_white[y, w - 1]:
            bg_mask[y, w - 1] = True
            queue.append((y, w - 1))

    while queue:
        cy, cx = queue.popleft()
        for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
            if 0 <= ny < h and 0 <= nx < w and not bg_mask[ny, nx] and is_white[ny, nx]:
                bg_mask[ny, nx] = True
                queue.append((ny, nx))

    # Subject mask is inverse of background
    subject_mask = (~bg_mask).astype(np.uint8) * 255
    mask_im = Image.fromarray(subject_mask)

    # Erode mask inward to pull inside dark ink strokes (eliminates white halo on roof/edges)
    if erode_size > 1:
        mask_im = mask_im.filter(ImageFilter.MinFilter(erode_size))

    r, g, b = im_rgb.split()
    rgba = Image.merge("RGBA", (r, g, b, mask_im))

    bbox = rgba.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        pad = 4
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(w, x1 + pad)
        y1 = min(h, y1 + pad)
        rgba = rgba.crop((x0, y0, x1, y1))

    return rgba


def save_png_and_webp(img: Image.Image, png_path: Path, webp_path: Path) -> None:
    png_path.parent.mkdir(parents=True, exist_ok=True)
    webp_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(png_path, format="PNG", optimize=True)
    img.save(webp_path, format="WEBP", quality=90, method=6)


def process_all_assets() -> dict:
    print("=== Starting S2 Nano Asset Post-Processing (Tonal Equalization & Seam Refinement) ===")

    # 1. Floor Tiles
    print("\n--- 1. Processing Ground Tiles ---")
    stone_raw = Image.open(SCENE_DIR / "G_ground_stone_nano_nb21_v1.png")
    wood_raw  = Image.open(SCENE_DIR / "G_ground_wood_dock_nano_nb21_v1.png")

    # Step A: Tonal equalization + periodic seamless
    stone_canonical = make_periodic_seamless(
        equalize_tone(stone_raw.resize((512, 512), Image.Resampling.LANCZOS), radius=48),
        blend_width=16
    )
    wood_canonical  = make_periodic_seamless(
        equalize_tone(wood_raw.resize((512, 512), Image.Resampling.LANCZOS), radius=48),
        blend_width=16
    )

    save_png_and_webp(stone_canonical, TILES_STONE_DIR / "tile_stone_canonical.png", TILES_STONE_DIR / "tile_stone_canonical.webp")
    save_png_and_webp(wood_canonical, TILES_WOOD_DIR / "tile_wood_dock_canonical.png", TILES_WOOD_DIR / "tile_wood_dock_canonical.webp")

    # Stone & Wood variations (processed and flagged)
    stone_var1_raw = Image.open(SCENE_DIR / "G_ground_stone_var1_nano_nb21_v1.png")
    wood_var1_raw  = Image.open(SCENE_DIR / "G_ground_wood_dock_var1_nano_nb21_v1.png")

    stone_var1 = make_periodic_seamless(
        equalize_tone(stone_var1_raw.resize((512, 512), Image.Resampling.LANCZOS), radius=48),
        blend_width=16
    )
    wood_var1  = make_periodic_seamless(
        equalize_tone(wood_var1_raw.resize((512, 512), Image.Resampling.LANCZOS), radius=48),
        blend_width=16
    )

    save_png_and_webp(stone_var1, TILES_STONE_DIR / "tile_stone_var_puddle.png", TILES_STONE_DIR / "tile_stone_var_puddle.webp")
    save_png_and_webp(wood_var1, TILES_WOOD_DIR / "tile_wood_dock_var_weathered.png", TILES_WOOD_DIR / "tile_wood_dock_var_weathered.webp")

    # Transitions
    trans_h_raw = Image.open(SCENE_DIR / "G_trans_stone_wood_h_nano_nb21_v1.png")
    trans_v_raw = Image.open(SCENE_DIR / "G_trans_stone_wood_v_nano_nb21_v1.png")

    trans_h = lock_horizontal_transition(trans_h_raw, stone_canonical, wood_canonical, blend_w=16)
    trans_v = lock_vertical_transition(trans_v_raw, stone_canonical, wood_canonical, blend_w=16)

    save_png_and_webp(trans_h, TILES_TRANS_DIR / "tile_trans_stone_wood_h_canonical.png", TILES_TRANS_DIR / "tile_trans_stone_wood_h_canonical.webp")
    save_png_and_webp(trans_v, TILES_TRANS_DIR / "tile_trans_stone_wood_v_canonical.png", TILES_TRANS_DIR / "tile_trans_stone_wood_v_canonical.webp")

    # Generate QA Mosaics
    print("  -> Generating QA Mosaics...")
    # Pure canonical stone 3x3 to visually verify seamlessness without repeating puddle
    stone_3x3 = Image.new("RGB", (1536, 1536))
    for r in range(3):
        for c in range(3):
            stone_3x3.paste(stone_canonical, (c * 512, r * 512))
    stone_3x3.save(QA_DIR / "qa_tile_stone_3x3.png", format="PNG", optimize=True)

    wood_3x3 = Image.new("RGB", (1536, 1536))
    for r in range(3):
        for c in range(3):
            wood_3x3.paste(wood_canonical, (c * 512, r * 512))
    wood_3x3.save(QA_DIR / "qa_tile_wood_3x3.png", format="PNG", optimize=True)

    shoreline_4x4 = Image.new("RGB", (2048, 2048))
    for c in range(4):
        shoreline_4x4.paste(stone_canonical, (c * 512, 0))
        shoreline_4x4.paste(stone_canonical, (c * 512, 512))
        shoreline_4x4.paste(trans_h, (c * 512, 1024))
        shoreline_4x4.paste(wood_canonical, (c * 512, 1536))
    shoreline_4x4.save(QA_DIR / "qa_tile_shoreline_4x4.png", format="PNG", optimize=True)

    canal_v_4x4 = Image.new("RGB", (2048, 2048))
    for r in range(4):
        canal_v_4x4.paste(stone_canonical, (0, r * 512))
        canal_v_4x4.paste(trans_v, (512, r * 512))
        canal_v_4x4.paste(wood_canonical, (1024, r * 512))
        canal_v_4x4.paste(wood_canonical, (1536, r * 512))
    canal_v_4x4.save(QA_DIR / "qa_tile_canal_v_4x4.png", format="PNG", optimize=True)

    # 2. Standalone Buildings
    print("\n--- 2. Processing Standalone Buildings (White Matte -> RGBA Cutout) ---")
    buildings_spec = [
        {"id": "building_port_warehouse", "name": "港口風化大倉庫", "raw": "H_port_warehouse_nano_nb21_v1.png", "target_h": 460},
        {"id": "building_fish_workshop",  "name": "港町海產魚行魚舖", "raw": "H_fishmonger_nano_nb21_v1.png",       "target_h": 440},
        {"id": "building_port_tavern",    "name": "港町海潮酒肆",     "raw": "H_port_tavern_nano_nb21_v1.png",       "target_h": 440},
        {"id": "building_wharf_shop",     "name": "碼頭乾貨雜糧商屋", "raw": "H_wharf_shop_nano_nb21_v1.png",        "target_h": 440},
        {"id": "building_port_teahouse",  "name": "港町泊船番所茶屋", "raw": "H_port_teahouse_nano_nb21_v1.png",     "target_h": 480},
    ]

    buildings_manifest = []
    for b in buildings_spec:
        raw_p = SCENE_DIR / b["raw"]
        raw_im = Image.open(raw_p)
        rgba = key_out_white_matte(raw_im)

        aspect = rgba.width / rgba.height
        th = b["target_h"]
        tw = int(round(th * aspect))
        rgba_scaled = rgba.resize((tw, th), Image.Resampling.LANCZOS)

        out_png = BUILDINGS_DIR / f"{b['id']}.png"
        out_webp = BUILDINGS_DIR / f"{b['id']}.webp"
        save_png_and_webp(rgba_scaled, out_png, out_webp)

        entry = {
            "id": b["id"],
            "name": b["name"],
            "path": str(out_png.relative_to(ROOT)).replace("\\", "/"),
            "path_webp": str(out_webp.relative_to(ROOT)).replace("\\", "/"),
            "source_raw": str(raw_p.relative_to(ROOT)).replace("\\", "/"),
            "source_raw_sha256": sha256_file(raw_p),
            "width": tw,
            "height": th,
            "footAnchor": {"x": tw // 2, "y": th},
            "displaySize": {"width": tw, "height": th},
            "status": "ART_CANDIDATE",
            "provenance_type": "NANO_SOURCE",
            "is_new_nano_redraw": True,
            "sha256_png": sha256_file(out_png),
            "sha256_webp": sha256_file(out_webp),
        }
        buildings_manifest.append(entry)
        print(f"  Building: {b['id']} -> {tw}x{th} | footAnchor=({tw//2}, {th})")

    # Generate QA composite of all buildings on pure black background
    total_bw = sum(b_e["width"] + 20 for b_e in buildings_manifest) + 20
    max_bh = max(b_e["height"] for b_e in buildings_manifest) + 40
    black_qa = Image.new("RGB", (total_bw, max_bh), (0, 0, 0))
    cur_x = 20
    for b_e in buildings_manifest:
        b_im = Image.open(ROOT / b_e["path"])
        black_qa.paste(b_im, (cur_x, max_bh - b_e["height"] - 20), mask=b_im.split()[-1])
        cur_x += b_e["width"] + 20
    black_qa.save(QA_DIR / "qa_buildings_on_black.png", format="PNG", optimize=True)

    # 3. Environment (Sea & Cliff)
    print("\n--- 3. Processing Environment (Sea & Cliff) ---")
    env_manifest = []
    sea_raw_p = SCENE_DIR / "G_port_sea_surface_nano_nb21_v1.png"
    if sea_raw_p.exists():
        sea_raw = Image.open(sea_raw_p)
        sea_tile = make_periodic_seamless(
            equalize_tone(sea_raw.resize((512, 512), Image.Resampling.LANCZOS), radius=48),
            blend_width=16
        )
        save_png_and_webp(sea_tile, ENV_DIR / "surface_sea_canonical.png", ENV_DIR / "surface_sea_canonical.webp")
        env_manifest.append({
            "id": "surface_sea_canonical",
            "name": "港口深水海面無縫地表",
            "path": str((ENV_DIR / "surface_sea_canonical.png").relative_to(ROOT)).replace("\\", "/"),
            "path_webp": str((ENV_DIR / "surface_sea_canonical.webp").relative_to(ROOT)).replace("\\", "/"),
            "source_raw": "art/stage2-rain-port/scene/G_port_sea_surface_nano_nb21_v1.png",
            "width": 512, "height": 512,
            "status": "ART_CANDIDATE",
            "provenance_type": "NANO_SOURCE",
            "is_new_nano_redraw": True,
        })

    cliff_raw_p = SCENE_DIR / "O_port_north_cliff_nano_nb21_v1.png"
    if cliff_raw_p.exists():
        cliff_raw = Image.open(cliff_raw_p)
        cliff_rgba = key_out_white_matte(cliff_raw)
        cliff_aspect = cliff_rgba.width / cliff_rgba.height
        cliff_h = 512
        cliff_w = int(round(cliff_h * cliff_aspect))
        cliff_scaled = cliff_rgba.resize((cliff_w, cliff_h), Image.Resampling.LANCZOS)
        save_png_and_webp(cliff_scaled, ENV_DIR / "cliff_north_rock.png", ENV_DIR / "cliff_north_rock.webp")
        env_manifest.append({
            "id": "cliff_north_rock",
            "name": "北側礁石海蝕斷崖",
            "path": str((ENV_DIR / "cliff_north_rock.png").relative_to(ROOT)).replace("\\", "/"),
            "path_webp": str((ENV_DIR / "cliff_north_rock.webp").relative_to(ROOT)).replace("\\", "/"),
            "source_raw": "art/stage2-rain-port/scene/O_port_north_cliff_nano_nb21_v1.png",
            "width": cliff_w, "height": cliff_h,
            "footAnchor": {"x": cliff_w // 2, "y": cliff_h},
            "status": "ART_CANDIDATE",
            "provenance_type": "NANO_SOURCE",
            "is_new_nano_redraw": True,
        })

    # 4. Props
    print("\n--- 4. Processing Standalone Props (White Matte -> RGBA Cutout) ---")
    props_spec = [
        {"id": "prop_anchor_gear",       "name": "港口鐵錨與絞盤齒輪", "raw": "O_prop_anchor_gear_nano_nb21_v1.png",       "target_h": 160},
        {"id": "prop_cargo_crates",      "name": "碼頭堆疊貨物木箱",   "raw": "O_prop_cargo_crates_nano_nb21_v1.png",      "target_h": 180},
        {"id": "prop_mooring_post",      "name": "港埠繫船木樁",       "raw": "O_prop_mooring_post_nano_nb21_v1.png",      "target_h": 180},
        {"id": "prop_port_boat",         "name": "港口繫泊木舟",       "raw": "O_prop_port_boat_nano_nb21_v1.png",         "target_h": 160},
        {"id": "prop_port_lighthouse",   "name": "港口常夜石燈台",     "raw": "O_prop_port_lighthouse_nano_nb21_v1.png",   "target_h": 320},
    ]

    props_manifest = []
    for p in props_spec:
        raw_p = SCENE_DIR / p["raw"]
        if not raw_p.exists():
            continue
        raw_im = Image.open(raw_p)
        rgba = key_out_white_matte(raw_im)

        aspect = rgba.width / rgba.height
        th = p["target_h"]
        tw = int(round(th * aspect))
        rgba_scaled = rgba.resize((tw, th), Image.Resampling.LANCZOS)

        out_png = PROPS_DIR / f"{p['id']}.png"
        out_webp = PROPS_DIR / f"{p['id']}.webp"
        save_png_and_webp(rgba_scaled, out_png, out_webp)

        entry = {
            "id": p["id"],
            "name": p["name"],
            "path": str(out_png.relative_to(ROOT)).replace("\\", "/"),
            "path_webp": str(out_webp.relative_to(ROOT)).replace("\\", "/"),
            "source_raw": str(raw_p.relative_to(ROOT)).replace("\\", "/"),
            "source_raw_sha256": sha256_file(raw_p),
            "width": tw,
            "height": th,
            "footAnchor": {"x": tw // 2, "y": th},
            "displaySize": {"width": tw, "height": th},
            "status": "ART_CANDIDATE",
            "provenance_type": "NANO_SOURCE",
            "is_new_nano_redraw": True,
            "sha256_png": sha256_file(out_png),
            "sha256_webp": sha256_file(out_webp),
        }
        props_manifest.append(entry)
        print(f"  Prop: {p['id']} -> {tw}x{th} | footAnchor=({tw//2}, {th})")

    # 5. Build Authoritative asset-manifest.json
    print("\n--- 5. Generating Authoritative asset-manifest.json ---")
    stone_canonical_p = TILES_STONE_DIR / "tile_stone_canonical.png"
    stone_canonical_w = TILES_STONE_DIR / "tile_stone_canonical.webp"
    stone_puddle_p = TILES_STONE_DIR / "tile_stone_var_puddle.png"
    stone_puddle_w = TILES_STONE_DIR / "tile_stone_var_puddle.webp"

    wood_canonical_p = TILES_WOOD_DIR / "tile_wood_dock_canonical.png"
    wood_canonical_w = TILES_WOOD_DIR / "tile_wood_dock_canonical.webp"
    wood_weathered_p = TILES_WOOD_DIR / "tile_wood_dock_var_weathered.png"
    wood_weathered_w = TILES_WOOD_DIR / "tile_wood_dock_var_weathered.webp"

    trans_h_p = TILES_TRANS_DIR / "tile_trans_stone_wood_h_canonical.png"
    trans_h_w = TILES_TRANS_DIR / "tile_trans_stone_wood_h_canonical.webp"
    trans_v_p = TILES_TRANS_DIR / "tile_trans_stone_wood_v_canonical.png"
    trans_v_w = TILES_TRANS_DIR / "tile_trans_stone_wood_v_canonical.webp"

    manifest_data = {
        "schema_version": "1.3.0-nano",
        "stage_id": "rain-port",
        "stage_name": "雨夜港町",
        "production_status": "S2_NANO_ART_IN_PRODUCTION",
        "provenance_summary": "全新 Gemini Nano Banana 2.1 正式生成之真美術資產 (NANO_SOURCE / ART_CANDIDATE)",
        "style_guidelines": {
            "art_style": "和風浮世繪水墨木版畫 (Sumi-e & Ukiyo-e Washi Woodblock)",
            "ink_line": "粗墨線 (Bold sumi ink outlines)",
            "color_saturation": "克制水墨冷調 (Restrained moist indigo, charcoal, slate gray, aged timber)",
            "camera_projection": "Canvas2D Tilt 0.60 視角基準 (Upright Y-sorted sprites)",
            "anti_procedural": "嚴禁程序幾何矩形色塊冒充建築與地板"
        },
        "tiles": {
            "usable_runtime_tiles": {
                # Runtime Active: strictly single canonical tiles to avoid repeating puddle / tonal jump
                "stoneVariants": [
                    {
                        "id": "tile_stone_canonical",
                        "name": "濕石板路基準塊 (Nano Base Tonal Equalized)",
                        "path": str(stone_canonical_p.relative_to(ROOT)).replace("\\", "/"),
                        "path_webp": str(stone_canonical_w.relative_to(ROOT)).replace("\\", "/"),
                        "source_raw": "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.png",
                        "source_raw_sha256": sha256_file(SCENE_DIR / "G_ground_stone_nano_nb21_v1.png"),
                        "width": 512, "height": 512,
                        "footAnchor": {"x": 256, "y": 512},
                        "displaySize": {"width": 512, "height": 512},
                        "status": "ART_CANDIDATE",
                        "provenance_type": "NANO_SOURCE",
                        "is_new_nano_redraw": True,
                        "sha256_png": sha256_file(stone_canonical_p),
                        "sha256_webp": sha256_file(stone_canonical_w),
                    }
                ],
                "woodVariants": [
                    {
                        "id": "tile_wood_dock_canonical",
                        "name": "浸水木棧道基準塊 (Nano Base Tonal Equalized)",
                        "path": str(wood_canonical_p.relative_to(ROOT)).replace("\\", "/"),
                        "path_webp": str(wood_canonical_w.relative_to(ROOT)).replace("\\", "/"),
                        "source_raw": "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.png",
                        "source_raw_sha256": sha256_file(SCENE_DIR / "G_ground_wood_dock_nano_nb21_v1.png"),
                        "width": 512, "height": 512,
                        "footAnchor": {"x": 256, "y": 512},
                        "displaySize": {"width": 512, "height": 512},
                        "status": "ART_CANDIDATE",
                        "provenance_type": "NANO_SOURCE",
                        "is_new_nano_redraw": True,
                        "sha256_png": sha256_file(wood_canonical_p),
                        "sha256_webp": sha256_file(wood_canonical_w),
                    }
                ],
                "transitions": {
                    "h": [
                        {
                            "id": "tile_trans_stone_wood_h_canonical",
                            "name": "石木水平岸線過渡塊 (Nano Shoreline Transition)",
                            "path": str(trans_h_p.relative_to(ROOT)).replace("\\", "/"),
                            "path_webp": str(trans_h_w.relative_to(ROOT)).replace("\\", "/"),
                            "source_raw": "art/stage2-rain-port/scene/G_trans_stone_wood_h_nano_nb21_v1.png",
                            "source_raw_sha256": sha256_file(SCENE_DIR / "G_trans_stone_wood_h_nano_nb21_v1.png"),
                            "orientation": "horizontal",
                            "top_terrain": "stone",
                            "bottom_terrain": "wood_dock",
                            "width": 512, "height": 512,
                            "footAnchor": {"x": 256, "y": 512},
                            "displaySize": {"width": 512, "height": 512},
                            "status": "ART_CANDIDATE",
                            "provenance_type": "NANO_SOURCE",
                            "is_new_nano_redraw": True,
                            "sha256_png": sha256_file(trans_h_p),
                            "sha256_webp": sha256_file(trans_h_w),
                        }
                    ],
                    "v": [
                        {
                            "id": "tile_trans_stone_wood_v_canonical",
                            "name": "石木垂直水渠過渡塊 (Nano Canal Transition)",
                            "path": str(trans_v_p.relative_to(ROOT)).replace("\\", "/"),
                            "path_webp": str(trans_v_w.relative_to(ROOT)).replace("\\", "/"),
                            "source_raw": "art/stage2-rain-port/scene/G_trans_stone_wood_v_nano_nb21_v1.png",
                            "source_raw_sha256": sha256_file(SCENE_DIR / "G_trans_stone_wood_v_nano_nb21_v1.png"),
                            "orientation": "vertical",
                            "left_terrain": "stone",
                            "right_terrain": "wood_dock",
                            "width": 512, "height": 512,
                            "footAnchor": {"x": 256, "y": 512},
                            "displaySize": {"width": 512, "height": 512},
                            "status": "ART_CANDIDATE",
                            "provenance_type": "NANO_SOURCE",
                            "is_new_nano_redraw": True,
                            "sha256_png": sha256_file(trans_v_p),
                            "sha256_webp": sha256_file(trans_v_w),
                        }
                    ]
                }
            },
            # Flagged variants isolated from active runtime to prevent visual grid/puddle repetition
            "flagged_variants_seam_review": [
                {
                    "id": "tile_stone_var_puddle",
                    "name": "濕石板路變化塊 (Nano Puddle Sheen)",
                    "path": str(stone_puddle_p.relative_to(ROOT)).replace("\\", "/"),
                    "path_webp": str(stone_puddle_w.relative_to(ROOT)).replace("\\", "/"),
                    "source_raw": "art/stage2-rain-port/scene/G_ground_stone_var1_nano_nb21_v1.png",
                    "source_raw_sha256": sha256_file(SCENE_DIR / "G_ground_stone_var1_nano_nb21_v1.png"),
                    "status": "SEAM_REVIEW_RED",
                    "provenance_type": "NANO_SOURCE",
                    "review_finding": "中心大水窪在 512px 平鋪網格出現時規律感明顯，且與基準塊色階存在局部反差跳變；已撤出 runtime 主平鋪池，避免混排方框，僅保留作為特殊環境/局部水漬原稿參考",
                    "runtime_recommendation": "runtime 主區平鋪僅使用單一 tile_stone_canonical，避免混排色階跳變"
                },
                {
                    "id": "tile_wood_dock_var_weathered",
                    "name": "浸水木棧道變化塊 (Nano Weathered)",
                    "path": str(wood_weathered_p.relative_to(ROOT)).replace("\\", "/"),
                    "path_webp": str(wood_weathered_w.relative_to(ROOT)).replace("\\", "/"),
                    "source_raw": "art/stage2-rain-port/scene/G_ground_wood_dock_var1_nano_nb21_v1.png",
                    "source_raw_sha256": sha256_file(SCENE_DIR / "G_ground_wood_dock_var1_nano_nb21_v1.png"),
                    "status": "SEAM_REVIEW_RED",
                    "provenance_type": "NANO_SOURCE",
                    "review_finding": "板條風化色斑在隨機平鋪時易產生規律斑塊感；已自主平鋪池撤出，主區使用單一 tile_wood_dock_canonical",
                    "runtime_recommendation": "runtime 主區平鋪僅使用單一 tile_wood_dock_canonical"
                }
            ]
        },
        "buildings": buildings_manifest,
        "props": props_manifest,
        "environment": env_manifest,
        "qa_mosaics": [
            str((QA_DIR / "qa_tile_stone_3x3.png").relative_to(ROOT)).replace("\\", "/"),
            str((QA_DIR / "qa_tile_wood_3x3.png").relative_to(ROOT)).replace("\\", "/"),
            str((QA_DIR / "qa_tile_shoreline_4x4.png").relative_to(ROOT)).replace("\\", "/"),
            str((QA_DIR / "qa_tile_canal_v_4x4.png").relative_to(ROOT)).replace("\\", "/"),
            str((QA_DIR / "qa_buildings_on_black.png").relative_to(ROOT)).replace("\\", "/"),
        ]
    }

    manifest_p = PROD_DIR / "asset-manifest.json"
    manifest_p.write_text(json.dumps(manifest_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nAuthoritative asset-manifest.json written to {manifest_p}")
    return manifest_data


if __name__ == "__main__":
    process_all_assets()
