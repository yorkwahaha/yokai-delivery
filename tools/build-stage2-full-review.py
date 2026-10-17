import os
import sys
from PIL import Image, ImageDraw, ImageFont

ART_ROOT = "art"
STAGE2_DIR = os.path.join(ART_ROOT, "stage2-rain-port")
OUTPUT_IMG = os.path.join(STAGE2_DIR, "Preview_stage2_full_review.png")
OUTPUT_WEBP = os.path.join(STAGE2_DIR, "Preview_stage2_full_review.webp")
OUTPUT_THUMB = os.path.join(ART_ROOT, "Preview_thumbs", "thumb_Preview_stage2_full_review.webp")

def load_fonts():
    font_paths = [
        "C:/Windows/Fonts/msjhbd.ttc",
        "C:/Windows/Fonts/msjh.ttc",
        "C:/Windows/Fonts/msgothic.ttc",
        "C:/Windows/Fonts/arial.ttf"
    ]
    f_title, f_sub, f_card_title, f_body, f_badge, f_small = None, None, None, None, None, None
    for p in font_paths:
        if os.path.exists(p):
            try:
                f_title = ImageFont.truetype(p, 36)
                f_sub = ImageFont.truetype(p, 18)
                f_card_title = ImageFont.truetype(p, 22)
                f_body = ImageFont.truetype(p, 16)
                f_badge = ImageFont.truetype(p, 14)
                f_small = ImageFont.truetype(p, 12)
                break
            except Exception:
                continue

    if not f_title:
        f_title = ImageFont.load_default()
        f_sub = f_title
        f_card_title = f_title
        f_body = f_title
        f_badge = f_title
        f_small = f_title

    return f_title, f_sub, f_card_title, f_body, f_badge, f_small

def build_stage2_full_review():
    print("Building Stage 2 Full Art Review Board (Preview_stage2_full_review.png)...")
    f_title, f_sub, f_card_title, f_body, f_badge, f_small = load_fonts()

    canvas_w, canvas_h = 2600, 1700
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (20, 22, 28, 255))
    draw = ImageDraw.Draw(canvas)

    # Outer decorative borders
    draw.rectangle([(20, 20), (canvas_w - 20, canvas_h - 20)], outline=(212, 175, 55, 220), width=3)
    draw.rectangle([(26, 26), (canvas_w - 26, canvas_h - 26)], outline=(60, 70, 90, 180), width=1)

    # Top Header
    draw.rectangle([(30, 30), (canvas_w - 30, 150)], fill=(28, 32, 44, 255), outline=(50, 60, 80, 255), width=2)
    draw.text((60, 48), "Stage 2: 雨夜港町 (Rain Port) — 整關美術一站式審核全景看板", fill=(245, 240, 225), font=f_title)
    draw.text((62, 102), "【離線手繪素材聚合檢核看板 · 嚴格未接入遊戲 Runtime · 包含 2D / 2.5D 視角、專用怪、Boss、石木過渡與碼頭建築】", fill=(170, 190, 215), font=f_sub)

    # Two Status Badges
    # Approved Badge
    draw.rectangle([(canvas_w - 1100, 45), (canvas_w - 600, 125)], fill=(25, 55, 40, 255), outline=(50, 160, 90, 255), width=2)
    draw.text((canvas_w - 1080, 58), "✔ 素材已核准 (USER_APPROVED)", fill=(140, 240, 170), font=f_badge)
    draw.text((canvas_w - 1080, 88), "石木過渡 v2 · 汐女/碇海坊主 4 母版", fill=(210, 235, 220), font=f_small)

    # Waiting Human Badge
    draw.rectangle([(canvas_w - 580, 45), (canvas_w - 50, 125)], fill=(65, 45, 20, 255), outline=(220, 140, 40, 255), width=2)
    draw.text((canvas_w - 560, 58), "⏳ 整關待人審 (WAITING_HUMAN)", fill=(255, 200, 100), font=f_badge)
    draw.text((canvas_w - 560, 88), "2D/2.5D 實景接線合成 · 建築透視與雨霧對比", fill=(240, 220, 190), font=f_small)

    # Top Row: 2D vs 2.5D Live View Panels
    panel_y = 170
    p_w = 1220
    p_h = 740

    # Panel 1: 2D View
    p1_x = 50
    draw.rectangle([(p1_x, panel_y), (p1_x + p_w, panel_y + p_h)], fill=(25, 27, 35, 255), outline=(60, 70, 90, 255), width=2)
    draw.rectangle([(p1_x, panel_y), (p1_x + p_w, panel_y + 55)], fill=(35, 40, 55, 255))
    draw.text((p1_x + 25, panel_y + 15), "【視角 A】2D 正俯視實景視角 (Preview_live_2d.png)", fill=(230, 235, 245), font=f_card_title)
    draw.text((p1_x + p_w - 280, panel_y + 18), "1280×800 正俯角佈局", fill=(160, 180, 210), font=f_badge)

    im_2d_path = os.path.join(STAGE2_DIR, "Preview_live_2d.png")
    if os.path.exists(im_2d_path):
        im_2d = Image.open(im_2d_path).convert("RGBA")
        im_2d_resized = im_2d.resize((1170, 650), Image.Resampling.LANCZOS)
        canvas.paste(im_2d_resized, (p1_x + 25, panel_y + 70), im_2d_resized)
        draw.rectangle([(p1_x + 23, panel_y + 68), (p1_x + 25 + 1172, panel_y + 70 + 652)], outline=(70, 80, 105, 255), width=2)

    # Panel 2: 2.5D View
    p2_x = 1330
    draw.rectangle([(p2_x, panel_y), (p2_x + p_w, panel_y + p_h)], fill=(25, 27, 35, 255), outline=(60, 70, 90, 255), width=2)
    draw.rectangle([(p2_x, panel_y), (p2_x + p_w, panel_y + 55)], fill=(35, 45, 55, 255))
    draw.text((p2_x + 25, panel_y + 15), "【視角 B】2.5D 透視實景視角 (Preview_live_25d.png)", fill=(230, 235, 245), font=f_card_title)
    draw.text((p2_x + p_w - 300, panel_y + 18), "1280×800 2.5D建築厚度", fill=(160, 180, 210), font=f_badge)

    im_25d_path = os.path.join(STAGE2_DIR, "Preview_live_25d.png")
    if os.path.exists(im_25d_path):
        im_25d = Image.open(im_25d_path).convert("RGBA")
        im_25d_resized = im_25d.resize((1170, 650), Image.Resampling.LANCZOS)
        canvas.paste(im_25d_resized, (p2_x + 25, panel_y + 70), im_25d_resized)
        draw.rectangle([(p2_x + 23, panel_y + 68), (p2_x + 25 + 1172, panel_y + 70 + 652)], outline=(70, 80, 105, 255), width=2)

    # Bottom Row: 3 Detail Asset Review Panels
    bot_y = 930
    b_h = 670

    # Detail 1: Ground & Transition (Left, 800w)
    d1_w = 780
    d1_x = 50
    draw.rectangle([(d1_x, bot_y), (d1_x + d1_w, bot_y + b_h)], fill=(26, 28, 36, 255), outline=(60, 70, 90, 255), width=2)
    draw.rectangle([(d1_x, bot_y), (d1_x + d1_w, bot_y + 48)], fill=(32, 42, 52, 255))
    draw.text((d1_x + 20, bot_y + 12), "1. 已核准石木過渡接縫 v2 與地表", fill=(240, 220, 160), font=f_card_title)

    # Ground image pastes
    trans_v2_path = os.path.join(STAGE2_DIR, "scene", "G_stone_wood_transition_v2.png")
    if os.path.exists(trans_v2_path):
        im_trans = Image.open(trans_v2_path).convert("RGBA")
        im_trans_s = im_trans.resize((340, 340), Image.Resampling.LANCZOS)
        canvas.paste(im_trans_s, (d1_x + 30, bot_y + 65), im_trans_s)
        draw.rectangle([(d1_x + 28, bot_y + 63), (d1_x + 372, bot_y + 407)], outline=(80, 90, 110, 255), width=2)
        draw.text((d1_x + 30, bot_y + 415), "G_stone_wood_transition_v2", fill=(180, 200, 230), font=f_small)
        draw.text((d1_x + 30, bot_y + 435), "✔ USER_APPROVED (水木過渡)", fill=(120, 220, 150), font=f_small)

    dock_path = os.path.join(STAGE2_DIR, "scene", "G_ground_wood_dock_seamless.png")
    if os.path.exists(dock_path):
        im_dock = Image.open(dock_path).convert("RGBA")
        im_dock_s = im_dock.resize((340, 340), Image.Resampling.LANCZOS)
        canvas.paste(im_dock_s, (d1_x + 400, bot_y + 65), im_dock_s)
        draw.rectangle([(d1_x + 398, bot_y + 63), (d1_x + 742, bot_y + 407)], outline=(80, 90, 110, 255), width=2)
        draw.text((d1_x + 400, bot_y + 415), "G_ground_wood_dock_seamless", fill=(180, 200, 230), font=f_small)
        draw.text((d1_x + 400, bot_y + 435), "濕木棧道底板 (512×512 無縫)", fill=(200, 210, 225), font=f_small)

    # Notes under ground
    draw.rectangle([(d1_x + 20, bot_y + 465), (d1_x + d1_w - 20, bot_y + b_h - 20)], fill=(32, 35, 46, 255), outline=(50, 60, 80, 255), width=1)
    draw.text((d1_x + 35, bot_y + 480), "● 石板到木棧道過渡 v2 已獲人審核准，解決 v1 錯位。", fill=(220, 225, 235), font=f_small)
    draw.text((d1_x + 35, bot_y + 510), "● 採用半浮世繪木版與深色潮濕墨線，強化雨夜港口反光。", fill=(220, 225, 235), font=f_small)
    draw.text((d1_x + 35, bot_y + 540), "● 連續四向拼接時具備非對稱破紋，避免視覺瓷磚化。", fill=(220, 225, 235), font=f_small)
    draw.text((d1_x + 35, bot_y + 580), "🔍 審查確認點 1：連續大面積鋪設時石木反差與過渡是否舒適？", fill=(255, 210, 120), font=f_small)

    # Detail 2: Enemies & Boss Scale (Center, 880w)
    d2_w = 860
    d2_x = 860
    draw.rectangle([(d2_x, bot_y), (d2_x + d2_w, bot_y + b_h)], fill=(26, 28, 36, 255), outline=(60, 70, 90, 255), width=2)
    draw.rectangle([(d2_x, bot_y), (d2_x + d2_w, bot_y + 48)], fill=(42, 35, 52, 255))
    draw.text((d2_x + 20, bot_y + 12), "2. 已核准專屬小怪汐女與 Boss 碇海坊主", fill=(240, 220, 160), font=f_card_title)

    # Ground baseline line
    baseline_y = bot_y + 400
    draw.line([(d2_x + 30, baseline_y), (d2_x + d2_w - 30, baseline_y)], fill=(212, 175, 55, 200), width=2)
    draw.text((d2_x + 40, baseline_y + 5), "▲ 基準接地線 (Ground Anchor Baseline)", fill=(212, 175, 55, 255), font=f_small)

    # Paste Shiome
    shiome_path = os.path.join(STAGE2_DIR, "characters", "E_shiome_idle.png")
    if os.path.exists(shiome_path):
        im_sh = Image.open(shiome_path).convert("RGBA")
        sh_w, sh_h = 240, 240
        im_sh_s = im_sh.resize((sh_w, sh_h), Image.Resampling.LANCZOS)
        canvas.paste(im_sh_s, (d2_x + 80, baseline_y - sh_h), im_sh_s)
        draw.text((d2_x + 80, baseline_y + 25), "專屬小怪：汐女 (Shiome)", fill=(160, 230, 200), font=f_badge)
        draw.text((d2_x + 80, baseline_y + 48), "250×240 px · 錨點(125,225)", fill=(180, 190, 210), font=f_small)
        draw.text((d2_x + 80, baseline_y + 68), "✔ USER_APPROVED (四怪母版)", fill=(120, 220, 150), font=f_small)

    # Paste Ikari
    ikari_path = os.path.join(STAGE2_DIR, "characters", "B_ikari_idle.png")
    if os.path.exists(ikari_path):
        im_ik = Image.open(ikari_path).convert("RGBA")
        ik_w, ik_h = 360, 360
        im_ik_s = im_ik.resize((ik_w, ik_h), Image.Resampling.LANCZOS)
        canvas.paste(im_ik_s, (d2_x + 420, baseline_y - ik_h), im_ik_s)
        draw.text((d2_x + 420, baseline_y + 25), "專屬 Boss：碇海坊主 (Ikari)", fill=(160, 210, 255), font=f_badge)
        draw.text((d2_x + 420, baseline_y + 48), "380×360 px · 錨點(190,335)", fill=(180, 190, 210), font=f_small)
        draw.text((d2_x + 420, baseline_y + 68), "✔ USER_APPROVED (四怪母版)", fill=(120, 220, 150), font=f_small)

    # Notes under monsters
    draw.rectangle([(d2_x + 20, bot_y + 490), (d2_x + d2_w - 20, bot_y + b_h - 20)], fill=(32, 35, 46, 255), outline=(50, 60, 80, 255), width=1)
    draw.text((d2_x + 35, bot_y + 510), "● 汐女與碇海坊主四張 idle/attack 已經使用者人審正式核准。", fill=(220, 225, 235), font=f_small)
    draw.text((d2_x + 35, bot_y + 540), "● 碇海坊主體量 1.5x 於小怪，巨大黑碇具備極高剪影辨識度。", fill=(220, 225, 235), font=f_small)
    draw.text((d2_x + 35, bot_y + 580), "🔍 審查確認點 2：怪物在雨霧粒子與暗色木棧道上對比輪廓是否足夠分明？", fill=(255, 210, 120), font=f_small)

    # Detail 3: Buildings & Props (Right, 800w)
    d3_w = 780
    d3_x = 1750
    draw.rectangle([(d3_x, bot_y), (d3_x + d3_w, bot_y + b_h)], fill=(26, 28, 36, 255), outline=(60, 70, 90, 255), width=2)
    draw.rectangle([(d3_x, bot_y), (d3_x + d3_w, bot_y + 48)], fill=(35, 45, 40, 255))
    draw.text((d3_x + 20, bot_y + 12), "3. 港口建築 (魚舖 / 倉庫) 與地標道具", fill=(240, 220, 160), font=f_card_title)

    # Paste Fishmonger
    fish_path = os.path.join(STAGE2_DIR, "scene", "H_fishmonger.png")
    if os.path.exists(fish_path):
        im_fish = Image.open(fish_path).convert("RGBA")
        im_fish_s = im_fish.resize((320, 300), Image.Resampling.LANCZOS)
        canvas.paste(im_fish_s, (d3_x + 30, bot_y + 65), im_fish_s)
        draw.text((d3_x + 30, bot_y + 375), "H_fishmonger (魚舖)", fill=(180, 210, 230), font=f_small)
        draw.text((d3_x + 30, bot_y + 395), "正面 2.5D 町屋形制", fill=(160, 170, 185), font=f_small)

    # Paste Warehouse
    wh_path = os.path.join(STAGE2_DIR, "scene", "H_port_warehouse.png")
    if os.path.exists(wh_path):
        im_wh = Image.open(wh_path).convert("RGBA")
        im_wh_s = im_wh.resize((340, 300), Image.Resampling.LANCZOS)
        canvas.paste(im_wh_s, (d3_x + 380, bot_y + 65), im_wh_s)
        draw.text((d3_x + 380, bot_y + 375), "H_port_warehouse (倉庫)", fill=(180, 210, 230), font=f_small)
        draw.text((d3_x + 380, bot_y + 395), "厚重土藏白壁與黑瓦", fill=(160, 170, 185), font=f_small)

    # Notes under buildings
    draw.rectangle([(d3_x + 20, bot_y + 430), (d3_x + d3_w - 20, bot_y + b_h - 20)], fill=(32, 35, 46, 255), outline=(50, 60, 80, 255), width=1)
    draw.text((d3_x + 35, bot_y + 450), "● 嚴格遵守手繪真圖規格，無 Canvas/SVG 程序假白盒。", fill=(220, 225, 235), font=f_small)
    draw.text((d3_x + 35, bot_y + 480), "● 魚舖藍色和紙暖簾、乾魚串、燈火與倉庫海潮侵蝕墨線分明。", fill=(220, 225, 235), font=f_small)
    draw.text((d3_x + 35, bot_y + 510), "● 繫船柱、木舟與錨纜機等散落道具提供港口停泊自然感。", fill=(220, 225, 235), font=f_small)
    draw.text((d3_x + 35, bot_y + 560), "🔍 審查確認點 3：2.5D 建築屋頂傾角與信差及怪物的透視比例是否協調？", fill=(255, 210, 120), font=f_small)

    # Convert to RGB and save
    canvas_rgb = canvas.convert("RGB")
    canvas_rgb.save(OUTPUT_IMG, "PNG")
    print(f"Full review board saved to: {OUTPUT_IMG}")

    # Export WebP
    canvas_rgb.save(OUTPUT_WEBP, "WEBP", quality=90)
    print(f"Full review WebP saved to: {OUTPUT_WEBP}")

    # Generate WebP thumbnail
    thumb = canvas_rgb.copy()
    thumb.thumbnail((1200, 785), Image.Resampling.LANCZOS)
    os.makedirs(os.path.dirname(OUTPUT_THUMB), exist_ok=True)
    thumb.save(OUTPUT_THUMB, "WEBP", quality=85)
    print(f"Full review thumbnail saved to: {OUTPUT_THUMB}")

if __name__ == "__main__":
    build_stage2_full_review()
