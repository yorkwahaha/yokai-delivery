#!/usr/bin/env python3
"""
Assemble and export Stage 8 Yomi Ground Balanced Candidates & Comparison Board:
- Candidate A: S554502 (Balanced ~55% Dirt / ~45% Flat Stones & Spider Lilies, Winding Trail)
- Candidate B: S554504 (Balanced ~65% Dirt / ~35% Flat Stones & Spider Lilies, Single Diagonal Path)
- Master Review Board with original reference (too crowded) and previous extreme (too empty)
"""

import os
import shutil
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ARTIFACT_DIR = r"C:\Users\York\.gemini\antigravity\brain\fa1c8457-83da-4548-8d12-8cf54c19a2bc"
SCENE_DIR = "art/stage8-yomi/scene"
PREVIEW_DIR = "art/stage8-yomi"

os.makedirs(ARTIFACT_DIR, exist_ok=True)
os.makedirs(SCENE_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

# 1. Export Candidate A (S554502)
im_a = Image.open(os.path.join(ARTIFACT_DIR, "s554502_seamless.png")).convert("RGB")
im_a.save(os.path.join(SCENE_DIR, "G_ground_yomi_balanced_55dirt_s554502.png"))
im_a_512 = im_a.resize((512, 512), Image.Resampling.LANCZOS)
im_a_512.save(os.path.join(SCENE_DIR, "G_ground_yomi_512_balanced_55dirt_s554502.webp"), "WEBP", quality=95)

shutil.copy2(os.path.join(ARTIFACT_DIR, "s554502_seamless_2x2.png"), os.path.join(PREVIEW_DIR, "Preview_tiled_2x2_ground_yomi_balanced_55dirt_s554502.png"))
shutil.copy2(os.path.join(ARTIFACT_DIR, "s554502_seamless_3x3.png"), os.path.join(PREVIEW_DIR, "Preview_tiled_3x3_ground_yomi_balanced_55dirt_s554502.png"))

# 2. Export Candidate B (S554504)
im_b = Image.open(os.path.join(ARTIFACT_DIR, "s554504_seamless.png")).convert("RGB")
im_b.save(os.path.join(SCENE_DIR, "G_ground_yomi_balanced_65dirt_s554504.png"))
im_b_512 = im_b.resize((512, 512), Image.Resampling.LANCZOS)
im_b_512.save(os.path.join(SCENE_DIR, "G_ground_yomi_512_balanced_65dirt_s554504.webp"), "WEBP", quality=95)

shutil.copy2(os.path.join(ARTIFACT_DIR, "s554504_seamless_2x2.png"), os.path.join(PREVIEW_DIR, "Preview_tiled_2x2_ground_yomi_balanced_65dirt_s554504.png"))
shutil.copy2(os.path.join(ARTIFACT_DIR, "s554504_seamless_3x3.png"), os.path.join(PREVIEW_DIR, "Preview_tiled_3x3_ground_yomi_balanced_65dirt_s554504.png"))

# Also copy to artifacts directory with clean naming
im_a_512.save(os.path.join(ARTIFACT_DIR, "stage8_balanced_55dirt_s554502_512.webp"), "WEBP", quality=95)
im_b_512.save(os.path.join(ARTIFACT_DIR, "stage8_balanced_65dirt_s554504_512.webp"), "WEBP", quality=95)

# 3. Create Master Comparison Board (2x2 grid of 512x512 with titles)
# Panel 1: Original User Ref ("右邊：碎石太密集，約 80% 石頭")
user_ref_path = r"C:\Users\York\.gemini\antigravity\brain\fa1c8457-83da-4548-8d12-8cf54c19a2bc\.user_uploaded\media_1792128183978_6327dc38.jpg"
im_ref = Image.open(user_ref_path).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)

# Panel 2: Rejected Empty Candidate ("左邊：極端的空，約 95% 泥土")
empty_cand_path = os.path.join(ARTIFACT_DIR, "stage8_trampled_97dirt_ultra_sparse_raw.png")
if os.path.exists(empty_cand_path):
    im_empty = Image.open(empty_cand_path).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
else:
    im_empty = Image.open(os.path.join(SCENE_DIR, "G_ground_yomi_flat_moredirt_t2i.png")).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)

# Panel 3: Candidate A S554502 ("新候選 A：碎石減少 1/3，自然曲徑，約 55% 泥土")
# Panel 4: Candidate B S554504 ("新候選 B：單斜向踏石，開闊泥土，約 65% 泥土")

# Canvas size: 1160 x 1220 (2 cols x 2 rows + headers)
board_w = 1160
board_h = 1220
board = Image.new("RGB", (board_w, board_h), (28, 28, 30))
draw = ImageDraw.Draw(board)

# Draw Title
font_title = None
font_label = None
font_sub = None
try:
    font_title = ImageFont.truetype("msyh.ttc", 26)
    font_label = ImageFont.truetype("msyh.ttc", 15)
    font_sub = ImageFont.truetype("msyh.ttc", 14)
except:
    pass

draw.text((board_w // 2, 35), "第八關【黃泉境】地面碎石減少 1/3 對比審核看板", fill=(240, 240, 240), font=font_title, anchor="mm")
draw.text((board_w // 2, 68), "核心目標：去除兩極化（不極端空曠、不密集搶眼），保留平面青石板與宣紙水墨彼岸花", fill=(180, 180, 180), font=font_sub, anchor="mm")

# Positions for panels (512x512 each, separated by 40px)
p1_pos = (40, 115)
p2_pos = (600, 115)
p3_pos = (40, 675)
p4_pos = (600, 675)

board.paste(im_ref, p1_pos)
board.paste(im_empty, p2_pos)
board.paste(im_a_512, p3_pos)
board.paste(im_b_512, p4_pos)

# Labels
draw.text((p1_pos[0], p1_pos[1] - 22), "【基準原圖】碎石過度密集（約 80% 石頭，太搶眼眼花）", fill=(255, 120, 120), font=font_label)
draw.text((p2_pos[0], p2_pos[1] - 22), "【左側否決】極端的空（約 95% 泥土，過度荒涼空洞）", fill=(255, 180, 100), font=font_label)
draw.text((p3_pos[0], p3_pos[1] - 22), "【候選 A：S554502】碎石減 1/3（自然曲徑 / 55% 泥土 / 45% 踏石花叢）", fill=(120, 255, 150), font=font_label)
draw.text((p4_pos[0], p4_pos[1] - 22), "【候選 B：S554504】碎石減半（單斜向踏石 / 65% 泥土 / 35% 踏石花）", fill=(120, 220, 255), font=font_label)

board_path = os.path.join(ARTIFACT_DIR, "stage8_balanced_1_3_reduction_board.png")
board.save(board_path)
print(f"Master review board saved: {board_path}")

# 4. Also create a 2x2 Tiled In-Game Preview Board (A vs B)
tiled_board_w = 1160
tiled_board_h = 630
t_board = Image.new("RGB", (tiled_board_w, tiled_board_h), (28, 28, 30))
t_draw = ImageDraw.Draw(t_board)

t_draw.text((tiled_board_w // 2, 28), "候選 A 與 候選 B 在遊戲中 2x2 無縫平鋪實機視口對比", fill=(240, 240, 240), font=font_title, anchor="mm")

# Resize 2x2 previews to 512x512 each
t2_a = Image.open(os.path.join(ARTIFACT_DIR, "s554502_seamless_2x2.png")).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
t2_b = Image.open(os.path.join(ARTIFACT_DIR, "s554504_seamless_2x2.png")).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)

t_board.paste(t2_a, (40, 85))
t_board.paste(t2_b, (600, 85))

t_draw.text((40, 60), "【候選 A：2x2 平鋪】自然蜿蜒曲徑，無縫接縫 0.000，多組石簇與彼岸花", fill=(120, 255, 150), font=font_label)
t_draw.text((600, 60), "【候選 B：2x2 平鋪】平行斜向石徑，開闊泥土地，視線極度乾淨", fill=(120, 220, 255), font=font_label)

t_board_path = os.path.join(ARTIFACT_DIR, "stage8_balanced_tiled_2x2_comparison.png")
t_board.save(t_board_path)
print(f"Tiled 2x2 comparison board saved: {t_board_path}")

print("All exports and boards completed successfully!")
