import os
import sys
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC_GROUND = r"C:\Users\York\.gemini\antigravity-cli\brain\1acc9737-f980-42b2-b32c-f84bed70dbec\stage5_kyoto_stone_road_1792021450627.jpg"
SRC_MACHIYA = r"C:\Users\York\.gemini\antigravity-cli\brain\1acc9737-f980-42b2-b32c-f84bed70dbec\stage5_machiya_teahouse_1792021470320.jpg"
SRC_LANTERN = r"C:\Users\York\.gemini\antigravity-cli\brain\1acc9737-f980-42b2-b32c-f84bed70dbec\stage5_stone_lantern_toro_1792021485239.jpg"

OUT_ROOT = "art/stage5-hyakki-kyoto"
SCENE_DIR = os.path.join(OUT_ROOT, "scene")
CHAR_DIR = os.path.join(OUT_ROOT, "characters")

os.makedirs(SCENE_DIR, exist_ok=True)
os.makedirs(CHAR_DIR, exist_ok=True)

def hash_file(filepath):
    sha = hashlib.sha256()
    md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        buf = f.read()
        sha.update(buf)
        md5.update(buf)
    return sha.hexdigest(), md5.hexdigest(), len(buf)

# 1. Process Ground Tile (Seamless 512x512)
print("Processing Ground Tile...")
img_g = Image.open(SRC_GROUND).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
arr_g = np.array(img_g, dtype=np.float32)

# Make seamlessly tileable by blending opposite borders
blend_w = 48
for i in range(blend_w):
    t = 0.5 * (1.0 - (i / blend_w))
    left_orig = arr_g[:, i, :].copy()
    right_orig = arr_g[:, 511 - i, :].copy()
    arr_g[:, i, :] = (1.0 - t) * left_orig + t * right_orig
    arr_g[:, 511 - i, :] = (1.0 - t) * right_orig + t * left_orig

for i in range(blend_w):
    t = 0.5 * (1.0 - (i / blend_w))
    top_orig = arr_g[i, :, :].copy()
    bot_orig = arr_g[511 - i, :, :].copy()
    arr_g[i, :, :] = (1.0 - t) * top_orig + t * bot_orig
    arr_g[511 - i, :] = (1.0 - t) * bot_orig + t * top_orig

arr_g = np.clip(arr_g, 0, 255).astype(np.uint8)
img_g_seamless = Image.fromarray(arr_g)

# Verify seamless tiling MAD
mad_h = np.mean(np.abs(arr_g[:, 0, :].astype(float) - arr_g[:, 511, :].astype(float)))
mad_v = np.mean(np.abs(arr_g[0, :, :].astype(float) - arr_g[511, :, :].astype(float)))
print(f"Ground tile seamless MAD: H={mad_h:.4f}, V={mad_v:.4f}")

g_png = os.path.join(SCENE_DIR, "G_kyoto_stone_road_v1.png")
g_webp = os.path.join(SCENE_DIR, "G_kyoto_stone_road_v1.webp")
img_g_seamless.save(g_png, "PNG")
img_g_seamless.save(g_webp, "WEBP", quality=95)

# 2. Process Machiya Teahouse (Cutout to RGBA)
print("Processing Machiya Teahouse...")
img_m = Image.open(SRC_MACHIYA).convert("RGB")
arr_m = np.array(img_m, dtype=np.float32)
# White background detection (high R, G, B with low saturation)
diff_white = np.maximum.reduce([np.abs(arr_m[:,:,0]-255), np.abs(arr_m[:,:,1]-255), np.abs(arr_m[:,:,2]-255)])
# Alpha ramp: diff_white <= 15 -> 0, diff_white >= 45 -> 255
alpha_m = np.clip((diff_white - 15.0) / 30.0 * 255.0, 0, 255).astype(np.uint8)

rgba_m = np.dstack([arr_m.astype(np.uint8), alpha_m])
img_m_rgba = Image.fromarray(rgba_m, "RGBA")
# Crop bounding box of non-zero alpha
bbox_m = img_m_rgba.getbbox()
if bbox_m:
    pad = 8
    bbox_m = (max(0, bbox_m[0]-pad), max(0, bbox_m[1]-pad), min(img_m_rgba.width, bbox_m[2]+pad), min(img_m_rgba.height, bbox_m[3]+pad))
    img_m_rgba = img_m_rgba.crop(bbox_m)

m_w = 512
m_h = int(img_m_rgba.height * (m_w / img_m_rgba.width))
img_m_rgba = img_m_rgba.resize((m_w, m_h), Image.Resampling.LANCZOS)

m_png = os.path.join(SCENE_DIR, "H_machiya_teahouse_2_5d_v1.png")
m_webp = os.path.join(SCENE_DIR, "H_machiya_teahouse_2_5d_v1.webp")
img_m_rgba.save(m_png, "PNG")
img_m_rgba.save(m_webp, "WEBP", quality=95)

# 3. Process Stone Lantern (Cutout to RGBA)
print("Processing Stone Lantern...")
img_l = Image.open(SRC_LANTERN).convert("RGB")
arr_l = np.array(img_l, dtype=np.float32)
diff_white_l = np.maximum.reduce([np.abs(arr_l[:,:,0]-255), np.abs(arr_l[:,:,1]-255), np.abs(arr_l[:,:,2]-255)])
alpha_l = np.clip((diff_white_l - 15.0) / 28.0 * 255.0, 0, 255).astype(np.uint8)

rgba_l = np.dstack([arr_l.astype(np.uint8), alpha_l])
img_l_rgba = Image.fromarray(rgba_l, "RGBA")
bbox_l = img_l_rgba.getbbox()
if bbox_l:
    pad = 6
    bbox_l = (max(0, bbox_l[0]-pad), max(0, bbox_l[1]-pad), min(img_l_rgba.width, bbox_l[2]+pad), min(img_l_rgba.height, bbox_l[3]+pad))
    img_l_rgba = img_l_rgba.crop(bbox_l)

l_h = 320
l_w = int(img_l_rgba.width * (l_h / img_l_rgba.height))
img_l_rgba = img_l_rgba.resize((l_w, l_h), Image.Resampling.LANCZOS)

l_png = os.path.join(SCENE_DIR, "O_stone_lantern_toro_v1.png")
l_webp = os.path.join(SCENE_DIR, "O_stone_lantern_toro_v1.webp")
img_l_rgba.save(l_png, "PNG")
img_l_rgba.save(l_webp, "WEBP", quality=95)

# 4. Generate 2.5D Player Perspective Preview (1600x900)
print("Generating Preview_stage5_scene_v1.png...")
pw, ph = 1600, 900
preview = Image.new("RGBA", (pw, ph), (18, 16, 24, 255))

# Tile ground
tile_w, tile_h = 512, 512
for y in range(0, ph, tile_h):
    for x in range(0, pw, tile_w):
        preview.paste(img_g_seamless, (x, y))

# Add atmospheric dusk lighting gradient & vignette
dusk_overlay = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
dusk_draw = ImageDraw.Draw(dusk_overlay)
for y in range(ph):
    ratio = y / ph
    r = int(15 * (1 - ratio) + 35 * ratio)
    g = int(12 * (1 - ratio) + 25 * ratio)
    b = int(28 * (1 - ratio) + 38 * ratio)
    alpha = int(90 * (1 - ratio) + 40 * ratio)
    dusk_draw.line([(0, y), (pw, y)], fill=(r, g, b, alpha))

preview = Image.alpha_composite(preview, dusk_overlay)

# Draw ground contact shadows for buildings and lanterns
shadow_layer = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
sdraw = ImageDraw.Draw(shadow_layer)

def add_shadow(x, y, w, h, opacity=140):
    sdraw.ellipse([x - w//2, y - h//2, x + w//2, y + h//2], fill=(8, 6, 12, opacity))

def add_lantern_glow(x, y, radius=120):
    for r in range(radius, 0, -8):
        alpha = int(45 * (1 - r / radius)**1.5)
        sdraw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 180, 80, alpha))

# Building 1: Left Machiya Teahouse (X: 60, Y: 80)
m1_x, m1_y = 60, 80
add_shadow(m1_x + m_w//2, m1_y + m_h - 20, m_w * 0.9, 80, 160)

# Building 2: Right Machiya Teahouse (X: 1040, Y: 110)
m2_w = int(m_w * 0.92)
m2_h = int(m_h * 0.92)
m2_img = img_m_rgba.resize((m2_w, m2_h), Image.Resampling.LANCZOS)
m2_x, m2_y = 1040, 110
add_shadow(m2_x + m2_w//2, m2_y + m2_h - 20, m2_w * 0.9, 75, 160)

# Lantern 1: Left roadside (X: 520, Y: 430)
l1_h = int(l_h * 0.75)
l1_w = int(l_w * 0.75)
l1_img = img_l_rgba.resize((l1_w, l1_h), Image.Resampling.LANCZOS)
l1_x, l1_y = 520, 430
add_shadow(l1_x + l1_w//2, l1_y + l1_h - 10, l1_w * 1.1, 28, 150)
add_lantern_glow(l1_x + l1_w//2, l1_y + int(l1_h * 0.38), 110)

# Lantern 2: Right roadside (X: 990, Y: 440)
l2_x, l2_y = 990, 440
add_shadow(l2_x + l1_w//2, l2_y + l1_h - 10, l1_w * 1.1, 28, 150)
add_lantern_glow(l2_x + l1_w//2, l2_y + int(l1_h * 0.38), 110)

# Lantern 3: Distant background (X: 780, Y: 230)
l3_h = int(l_h * 0.45)
l3_w = int(l_w * 0.45)
l3_img = img_l_rgba.resize((l3_w, l3_h), Image.Resampling.LANCZOS)
l3_x, l3_y = 780, 230
add_shadow(l3_x + l3_w//2, l3_y + l3_h - 6, l3_w * 1.1, 18, 130)
add_lantern_glow(l3_x + l3_w//2, l3_y + int(l3_h * 0.38), 70)

shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(8))
preview = Image.alpha_composite(preview, shadow_layer)

# Paste buildings and lanterns
preview.paste(l3_img, (l3_x, l3_y), l3_img)
preview.paste(img_m_rgba, (m1_x, m1_y), img_m_rgba)
preview.paste(m2_img, (m2_x, m2_y), m2_img)
preview.paste(l1_img, (l1_x, l1_y), l1_img)
preview.paste(l1_img, (l2_x, l2_y), l1_img)

# Load and place Player character in central street
player_path = "assets/img/player.png"
if os.path.exists(player_path):
    p_img = Image.open(player_path).convert("RGBA")
    p_h = 115
    p_w = int(p_img.width * (p_h / p_img.height))
    p_img = p_img.resize((p_w, p_h), Image.Resampling.LANCZOS)
    px = 750
    py = 560
    pshadow = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    psdraw = ImageDraw.Draw(pshadow)
    psdraw.ellipse([px + p_w//2 - 28, py + p_h - 10, px + p_w//2 + 28, py + p_h + 8], fill=(5, 5, 8, 170))
    pshadow = pshadow.filter(ImageFilter.GaussianBlur(4))
    preview = Image.alpha_composite(preview, pshadow)
    preview.paste(p_img, (px, py), p_img)

# Information UI overlay
ui_layer = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
uidraw = ImageDraw.Draw(ui_layer)

uidraw.rectangle([0, 0, pw, 74], fill=(16, 12, 22, 230))
uidraw.line([(0, 74), (pw, 74)], fill=(210, 160, 80, 220), width=2)

font_title = None
font_body = None
for fpath in ["C:/Windows/Fonts/msjh.ttc", "C:/Windows/Fonts/msgothic.ttc", "C:/Windows/Fonts/arial.ttf"]:
    if os.path.exists(fpath):
        try:
            font_title = ImageFont.truetype(fpath, 26)
            font_body = ImageFont.truetype(fpath, 15)
            break
        except Exception:
            pass

title_text = "【Stage 5 百鬼京都 (hyakki-kyoto) - 2.5D 場景候選 v1】"
sub_text = "風格：半水墨 ＋ 半浮世繪 ＋ 粗墨線 ＋ 和紙木版質感 | 視角：2.5D 俯視斜向街景"

if font_title:
    uidraw.text((40, 12), title_text, font=font_title, fill=(245, 230, 195, 255))
    uidraw.text((42, 45), sub_text, font=font_body, fill=(215, 185, 140, 255))
    uidraw.text((1340, 25), "STATUS: CANDIDATE", font=font_body, fill=(110, 225, 140, 255))
else:
    uidraw.text((40, 15), title_text, fill=(245, 230, 195, 255))

card_w, card_h = 1520, 110
card_x, card_y = 40, 755
uidraw.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], radius=10, fill=(20, 16, 26, 235), outline=(180, 140, 80, 200), width=2)

info_lines = [
    "① 地面素材 (G_kyoto_stone_road_v1)：古都暗青石疊路面，嵌合式青灰石磚、石縫苔痕、逢魔之時微光漫射（512x512 Seamless Tiling，MAD=0.0000）。",
    "② 建築素材 (H_machiya_teahouse_2_5d_v1)：傳統京都町家/妖怪茶屋（妖界茶屋），2.5D斜向深簷屋脊、層次陰影、木質格條窗與門口暖光燈籠，具備紮實體積感。",
    "③ 裝飾路燈 (O_stone_lantern_toro_v1)：古都和風石燈籠（Toro / 石灯籠），石造笠屋頂、青苔底座與火袋暖黃紙燈暈光，置於路側引導配送路徑。",
    "④ 角色比例尺：中央快遞員（高約 115px）與町家門楣高度（約 190px）具備自然 2.5D 縱深透視關係，不擋答題與行進視野。"
]

if font_body:
    for idx, line in enumerate(info_lines):
        uidraw.text((card_x + 20, card_y + 12 + idx * 23), line, font=font_body, fill=(235, 220, 195, 255))
else:
    for idx, line in enumerate(info_lines):
        uidraw.text((card_x + 20, card_y + 10 + idx * 24), line, fill=(235, 220, 195, 255))

preview = Image.alpha_composite(preview, ui_layer)
preview_path = os.path.join(OUT_ROOT, "Preview_stage5_scene_v1.png")
preview.save(preview_path, "PNG")
print(f"Saved preview: {preview_path}")

# 5. Build manifest.json
manifest = {
    "stage": "stage5-hyakki-kyoto",
    "stage_name_zh": "百鬼京都",
    "updated_at": "2026-10-15T07:45:00Z",
    "status": "CANDIDATE",
    "notes": "Stage 5 hyakki-kyoto scene candidates v1, waiting for user visual review.",
    "files": {}
}

for root_dir, _, filenames in os.walk(OUT_ROOT):
    for fn in filenames:
        if fn == "manifest.json" or not fn.lower().endswith((".png", ".webp", ".jpg", ".jpeg")):
            continue
        fpath = os.path.join(root_dir, fn)
        rel_path = os.path.relpath(fpath, OUT_ROOT).replace("\\", "/")
        sha, md5, size = hash_file(fpath)
        img = Image.open(fpath)
        manifest["files"][rel_path] = {
            "sha256": sha,
            "md5": md5,
            "bytes": size,
            "dimensions": f"{img.width}x{img.height}",
            "status": "CANDIDATE"
        }

manifest_path = os.path.join(OUT_ROOT, "manifest.json")
with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print("Manifest saved successfully:")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
