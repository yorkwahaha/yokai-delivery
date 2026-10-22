import os
import sys
import glob
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

ART_ROOT = "art"
THUMBS_DIR = os.path.join(ART_ROOT, "Preview_thumbs")
OUTPUT_IMG = os.path.join(ART_ROOT, "Preview_overview.png")
OUTPUT_SCALE_IMG = os.path.join(ART_ROOT, "Preview_scale_comparison.png")
OUTPUT_HTML = os.path.join(ART_ROOT, "Preview_index.html")

STAGES_INFO = [
    {
        "id": "stage2-rain-port",
        "num": 2,
        "name_zh": "雨夜港町",
        "theme": "雨夜石木交界・港口倉庫魚舖",
        "status": "USER_APPROVED_V2",
        "status_label": "USER_APPROVED_V2 (素材已核准/整關待人審)",
        "approval_note": "素材已核准（石木過渡v2與四角色母版）；整關2D/2.5D接線全景審核拼版待人審",
        "status_color": (80, 200, 120),
        "primary_preview": "Preview_stage2_full_review.png",
        "desc": "整關一站式審核全景看板：涵蓋 2D/2.5D 實景視角、已核准專屬小怪汐女與 Boss 碇海坊主、石木過渡 v2 與碼頭魚舖倉庫。素材已核准，整關視覺待人審。"
    },
    {
        "id": "stage3-sakura-pass",
        "num": 3,
        "name_zh": "妖櫻山道",
        "theme": "山道落櫻・2.5D神樂殿・庭園踏石",
        "status": "REWORK_CANDIDATE_V2",
        "status_label": "REWORK_CANDIDATE_V2 (待人審)",
        "approval_note": "重製候選尚待人審，非整關核准",
        "status_color": (230, 160, 60),
        "primary_preview": "Preview_stage3_scene_rework_v2.png",
        "desc": "重製改善原巨石過大、神社扁平與地表重複問題：具備2.5D深簷挑簷神殿、庭園比例踏石與有機落櫻泥道。目前為候選稿，尚待人審判定。"
    },
    {
        "id": "stage4-bamboo-maze",
        "num": 4,
        "name_zh": "竹影迷宮",
        "theme": "明亮竹林暖壤・細葉點綴・竹筍童子",
        "status": "REWORK_CANDIDATE_V2",
        "status_label": "REWORK_CANDIDATE_V2 (待人審)",
        "approval_note": "重製候選尚待人審，非整關核准",
        "status_color": (230, 160, 60),
        "primary_preview": "Preview_stage4_scene_rework_v2.png",
        "desc": "重製改善原黑暗竹泥底地（提升亮度至mean RGB 162.3）與巨大竹葉問題，改為稀疏點綴細葉與和紙木版紋理。目前為候選稿，尚待人審判定。"
    },
    {
        "id": "stage5-hyakki-kyoto",
        "num": 5,
        "name_zh": "百鬼京都",
        "theme": "古都墨青石疊・2.5D町家茶屋・和風石燈籠",
        "status": "CANDIDATE_V1",
        "status_label": "CANDIDATE_V1 (待人審)",
        "approval_note": "全新候選尚待人審，非整關核准",
        "status_color": (100, 180, 240),
        "primary_preview": "Preview_stage5_scene_v1.png",
        "desc": "平安京古都墨青色石疊路面（MAD=0.0000無縫）、2.5D入母屋造雙層町家茶屋（妖界茶屋）、和風石燈籠（Toro）。目前為候選稿，尚待人審判定。"
    },
    {
        "id": "stage6-snow-temple",
        "num": 6,
        "name_zh": "雪燈山寺",
        "theme": "深山雪道・2.5D大雄寶殿・積雪石燈籠",
        "status": "CANDIDATE_V1",
        "status_label": "CANDIDATE_V1 (待人審)",
        "approval_note": "全新候選尚待人審，非整關核准",
        "status_color": (100, 180, 240),
        "primary_preview": "Preview_stage6_scene_v1.png",
        "desc": "深山古寺積雪山道（MAD=0.0000無縫）、2.5D大雄寶殿（重簷積雪厚度與垂懸冰柱）、雪笠石燈籠暖黃光暈。目前為候選稿，尚待人審判定。"
    },
    {
        "id": "stage7-spirit-ferry",
        "num": 7,
        "name_zh": "幽世渡口",
        "theme": "三途川河畔・渡船・青色鬼火",
        "status": "ROADMAP_PLANNING",
        "status_label": "ROADMAP (待繪製)",
        "approval_note": "生產規格已落盤備查，素材待繪製",
        "status_color": (160, 140, 200),
        "primary_preview": None,
        "desc": "三途川畔深黑沙礫、盛開鮮紅彼岸花棧橋、渡魂歇腳亭、鬼火水鬼與幽冥渡船使。目前規格落盤，待人工審查與繪製。"
    },
    {
        "id": "stage8-yomi",
        "num": 8,
        "name_zh": "黃泉境",
        "theme": "赤月血月・焦黑岩盤・妖神魔殿",
        "status": "ROADMAP_PLANNING",
        "status_label": "ROADMAP (待繪製)",
        "approval_note": "生產規格已落盤備查，素材待繪製",
        "status_color": (220, 100, 100),
        "primary_preview": None,
        "desc": "猩紅血月高懸、黑曜石地火裂谷、遠古邪神殿堂遺構、黃泉影煞與終極 Boss 言靈之核。全季 164 詞總考核，待人工審查與繪製。"
    }
]

def load_fonts():
    font_title, font_sub, font_card, font_badge, font_small = None, None, None, None, None
    for fpath in ["C:/Windows/Fonts/msjh.ttc", "C:/Windows/Fonts/msgothic.ttc", "C:/Windows/Fonts/arial.ttf"]:
        if os.path.exists(fpath):
            try:
                font_title = ImageFont.truetype(fpath, 28)
                font_sub = ImageFont.truetype(fpath, 15)
                font_card = ImageFont.truetype(fpath, 18)
                font_badge = ImageFont.truetype(fpath, 13)
                font_small = ImageFont.truetype(fpath, 12)
                break
            except Exception:
                pass
    return font_title, font_sub, font_card, font_badge, font_small

def get_font(size):
    for fpath in ["C:/Windows/Fonts/msjh.ttc", "C:/Windows/Fonts/msgothic.ttc", "C:/Windows/Fonts/arial.ttf"]:
        if os.path.exists(fpath):
            try:
                return ImageFont.truetype(fpath, size)
            except Exception:
                pass
    return None

def ensure_thumbs_dir():
    if not os.path.exists(THUMBS_DIR):
        os.makedirs(THUMBS_DIR, exist_ok=True)

def generate_webp_thumbnail(src_path, thumb_filename, max_width=800, quality=80):
    ensure_thumbs_dir()
    dst_path = os.path.join(THUMBS_DIR, thumb_filename)
    if not os.path.exists(src_path):
        return None

    src_mtime = os.path.getmtime(src_path)
    if os.path.exists(dst_path) and os.path.getmtime(dst_path) >= src_mtime:
        return f"Preview_thumbs/{thumb_filename}"

    try:
        with Image.open(src_path) as img:
            img = img.convert("RGB")
            w, h = img.size
            if w > max_width:
                new_h = int(h * (max_width / w))
                img = img.resize((max_width, new_h), Image.Resampling.LANCZOS)
            img.save(dst_path, "WEBP", quality=quality)
            print(f"  [Thumb] Generated {dst_path} ({os.path.getsize(dst_path) // 1024} KB)")
        return f"Preview_thumbs/{thumb_filename}"
    except Exception as e:
        print(f"  [Thumb Error] Failed to generate {dst_path}: {e}")
        return None

def ensure_candidate_webps():
    """Ensure all unapproved candidate PNGs in Stage 3-6 have a high-quality WebP companion without touching assets/img/**."""
    print("Checking Stage 3-6 PNG candidates for missing WebP companions...")
    generated_count = 0
    skipped_count = 0
    for stage_dir_name in ["stage3-sakura-pass", "stage4-bamboo-maze", "stage5-hyakki-kyoto", "stage6-snow-temple"]:
        stage_path = os.path.join(ART_ROOT, stage_dir_name)
        if not os.path.exists(stage_path):
            continue
        for root, dirs, files in os.walk(stage_path):
            for f in files:
                if f.endswith(".png"):
                    png_path = os.path.join(root, f)
                    webp_path = os.path.join(root, f[:-4] + ".webp")
                    if os.path.exists(webp_path):
                        skipped_count += 1
                        continue
                    try:
                        with Image.open(png_path) as img:
                            # Save with high quality WebP
                            img.save(webp_path, "WEBP", quality=85, method=4)
                            generated_count += 1
                    except Exception as e:
                        print(f"  [WebP Error] {png_path} -> {e}")
    print(f"WebP Companion Check: {generated_count} newly generated, {skipped_count} already existed.")
    return generated_count

def crop_bbox(img):
    bb = img.getbbox()
    if bb:
        return img.crop(bb)
    return img

def build_scale_comparison_image():
    """Build art/Preview_scale_comparison.png showing characters, bosses, buildings vs player courier."""
    print("Building art/Preview_scale_comparison.png...")
    # Canvas definition
    canvas_w, canvas_h = 2700, 1600
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (18, 16, 22, 255))
    draw = ImageDraw.Draw(canvas)

    f_title = get_font(26)
    f_sub = get_font(14)
    f_header = get_font(18)
    f_card = get_font(18)
    f_label = get_font(12)
    f_ruler = get_font(11)
    f_badge = get_font(11)
    f_desc = get_font(12)

    # Top Header banner
    draw.rectangle([0, 0, canvas_w, 86], fill=(12, 10, 16, 255))
    draw.line([(0, 86), (canvas_w, 86)], fill=(190, 150, 75, 230), width=2)

    title_text = "《妖怪快遞社》第 2～6 關角色・Boss・房屋與主角實際比例尺標對照拼版 (Scale Comparison)"
    sub_text = "接地基準線對齊 · 像素高度刻度尺 (0-600px) · 建築門檻與角色比例檢核 · 標明 APPROVED 與 CANDIDATE 及缺件關卡"

    if f_title:
        draw.text((40, 14), title_text, font=f_title, fill=(245, 230, 200, 255))
        draw.text((42, 52), sub_text, font=f_sub, fill=(200, 175, 135, 255))
    else:
        draw.text((40, 14), title_text, fill=(245, 230, 200, 255))

    # Legend on top right
    leg_x = canvas_w - 620
    draw.rounded_rectangle([leg_x, 18, leg_x + 580, 68], radius=6, fill=(24, 21, 29, 255), outline=(75, 65, 85, 200), width=1)
    if f_label:
        draw.text((leg_x + 14, 26), "圖例標籤：", font=f_label, fill=(200, 190, 180, 255))
        draw.rectangle([leg_x + 80, 27, leg_x + 180, 47], fill=(30, 80, 45, 255))
        draw.text((leg_x + 85, 29), "USER_APPROVED", font=f_badge, fill=(120, 240, 140, 255))

        draw.rectangle([leg_x + 190, 27, leg_x + 300, 47], fill=(25, 60, 95, 255))
        draw.text((leg_x + 195, 29), "APPROVED_SOURCE", font=f_badge, fill=(130, 210, 255, 255))

        draw.rectangle([leg_x + 310, 27, leg_x + 400, 47], fill=(95, 60, 20, 255))
        draw.text((leg_x + 322, 29), "CANDIDATE", font=f_badge, fill=(255, 180, 90, 255))

        draw.rectangle([leg_x + 410, 27, leg_x + 500, 47], fill=(45, 40, 50, 255))
        draw.text((leg_x + 420, 29), "MISSING", font=f_badge, fill=(180, 170, 190, 255))

    # Two Rows definitions
    # Row 1: Characters & Bosses (Uniform scale factor = 0.68)
    char_scale = 0.68
    r1_title_y = 100
    r1_baseline_y = 700
    r1_top_y = 140

    # Row 2: Buildings & Props (Uniform scale factor = 0.70)
    bld_scale = 0.70
    r2_title_y = 810
    r2_baseline_y = 1420
    r2_top_y = 850

    # Draw Section Dividers & Row Titles
    draw.rectangle([40, r1_title_y, canvas_w - 40, r1_title_y + 32], fill=(28, 24, 34, 255))
    draw.line([(40, r1_title_y + 32), (canvas_w - 40, r1_title_y + 32)], fill=(150, 120, 70, 200), width=1)
    if f_header:
        draw.text((50, r1_title_y + 5), "【第 1 區】角色與 Boss 原畫尺寸對照（統一依原畫高像素比例對齊，主角為原高 340px 基準）", font=f_header, fill=(255, 225, 160, 255))

    draw.rectangle([40, r2_title_y, canvas_w - 40, r2_title_y + 32], fill=(28, 24, 34, 255))
    draw.line([(40, r2_title_y + 32), (canvas_w - 40, r2_title_y + 32)], fill=(150, 120, 70, 200), width=1)
    if f_header:
        draw.text((50, r2_title_y + 5), "【第 2 區】建築物門檻・裝飾道具與主角 2.5D 實景透視比例對照（檢核主角能否順利通過門檻）", font=f_header, fill=(255, 225, 160, 255))

    # Helper function to draw pixel height ruler lines
    def draw_rulers(baseline_y, factor, max_h=550):
        draw.line([(40, baseline_y), (canvas_w - 40, baseline_y)], fill=(80, 200, 120, 220), width=2)
        if f_ruler:
            draw.text((8, baseline_y - 8), "0px", font=f_ruler, fill=(120, 240, 140, 255))
            draw.text((canvas_w - 36, baseline_y - 8), "0px", font=f_ruler, fill=(120, 240, 140, 255))

        for h in range(100, max_h + 1, 100):
            ly = baseline_y - int(h * factor)
            draw.line([(40, ly), (canvas_w - 40, ly)], fill=(55, 48, 65, 180), width=1)
            if f_ruler:
                draw.text((8, ly - 8), f"{h}p", font=f_ruler, fill=(150, 140, 165, 200))
                draw.text((canvas_w - 36, ly - 8), f"{h}p", font=f_ruler, fill=(150, 140, 165, 200))

    draw_rulers(r1_baseline_y, char_scale, 400)
    draw_rulers(r2_baseline_y, bld_scale, 550)

    # 5 Stage Columns layout
    col_w = 500
    col_gap = 20
    start_x = (canvas_w - (5 * col_w + 4 * col_gap)) // 2

    # Preload Player
    player_src = "assets/img/player.png"
    player_img = None
    if os.path.exists(player_src):
        player_img = Image.open(player_src).convert("RGBA")
        player_img = crop_bbox(player_img)  # size ~ (198, 340)

    # Stage specifications
    stages_config = [
        {
            "num": 2, "name": "雨夜港町", "id": "stage2-rain-port",
            "minion": {"path": "art/stage2-rain-port/characters/E_shiome_idle.png", "name": "潮目小僧 (Shiome)", "status": "APPROVED", "scale_note": "原高 193px (主角的 57%)"},
            "boss": {"path": "art/stage2-rain-port/characters/B_ikari_idle.png", "name": "碇海坊主 (Ikari)", "status": "APPROVED", "scale_note": "原高 318px (寬 350px 威壓感足)"},
            "building": {"path": "art/stage2-rain-port/scene/H_port_warehouse.png", "name": "港口倉庫 (H_port_warehouse)", "status": "CANDIDATE", "scale_note": "尺寸 474×420, 雙扉大門寬度足以容納快遞通行"},
            "prop": None
        },
        {
            "num": 3, "name": "妖櫻山道", "id": "stage3-sakura-pass",
            "minion": {"path": "art/stage3-sakura-pass/characters/E_sakura_spirit_idle.png", "name": "落櫻妖精 (Sakura)", "status": "CANDIDATE", "scale_note": "原高 215px (主角的 63%)"},
            "boss": {"path": "art/stage3-sakura-pass/characters/B_hana_tengu_idle.png", "name": "花天狗 (Hana Tengu)", "status": "CANDIDATE", "scale_note": "原高 330px (寬 380px 大羽翼厚重)"},
            "building": {"path": "art/stage3-sakura-pass/scene/H_shrine_pavilion_2_5d_v2.png", "name": "神樂殿 (H_shrine_pavilion_2_5d_v2)", "status": "CANDIDATE", "scale_note": "重製2.5D簷深與台階, 門檻門洞高度 ~185px"},
            "prop": {"path": "art/stage3-sakura-pass/scene/O_natural_stone_cluster_v2.png", "name": "自然庭石 (O_stone_cluster_v2)", "status": "CANDIDATE", "scale_note": "重製踏石高 174px (非原巨石)"}
        },
        {
            "num": 4, "name": "竹影迷宮", "id": "stage4-bamboo-maze",
            "minion": {"path": "art/stage4-bamboo-maze/characters/E_takenoko_spirit_idle.png", "name": "竹筍小僧 (Takenoko)", "status": "CANDIDATE", "scale_note": "原高 200px (主角的 59%)"},
            "boss": {"path": "art/stage4-bamboo-maze/characters/B_chikuin_meiyo_idle.png", "name": "竹隱名代 (Chikuin Meiyo)", "status": "CANDIDATE", "scale_note": "原高 315px (寬 380px 薙刀神官姿態)"},
            "building": None, # Stage 4 has no single building, mostly bamboo terrain
            "prop": None
        },
        {
            "num": 5, "name": "百鬼京都", "id": "stage5-hyakki-kyoto",
            "minion": None,
            "boss": None,
            "building": {"path": "art/stage5-hyakki-kyoto/scene/H_machiya_teahouse_2_5d_v1.png", "name": "町家茶屋 (H_machiya_teahouse_2_5d_v1)", "status": "CANDIDATE", "scale_note": "入母屋造雙層茶屋 512×558, 入口暖簾門檻 ~175px"},
            "prop": {"path": "art/stage5-hyakki-kyoto/scene/O_stone_lantern_toro_v1.png", "name": "和風石燈籠 (O_stone_lantern_toro_v1)", "status": "CANDIDATE", "scale_note": "高 320px (約達茶屋一層屋簷半高)"}
        },
        {
            "num": 6, "name": "雪燈山寺", "id": "stage6-snow-temple",
            "minion": None,
            "boss": None,
            "building": {"path": "art/stage6-snow-temple/scene/H_temple_hall_v1.png", "name": "雪寺殿閣 (H_temple_hall_v1)", "status": "CANDIDATE", "scale_note": "重簷積雪大雄殿 520×463, 緣側台階與門框 ~190px"},
            "prop": {"path": "art/stage6-snow-temple/scene/O_snow_lantern_v1.png", "name": "積雪石燈籠 (O_snow_lantern_v1)", "status": "CANDIDATE", "scale_note": "厚雪笠古燈籠高 320px (暖光導引)"}
        }
    ]

    for idx, cfg in enumerate(stages_config):
        cx = start_x + idx * (col_w + col_gap)

        # Draw Column Frame
        draw.rectangle([cx, r1_top_y, cx + col_w, r1_baseline_y + 44], outline=(60, 50, 75, 120), width=1)
        draw.rectangle([cx, r2_top_y, cx + col_w, r2_baseline_y + 44], outline=(60, 50, 75, 120), width=1)

        # Stage Column Header
        col_hdr = f"Stage {cfg['num']}：{cfg['name']}"
        if f_card:
            draw.text((cx + 12, r1_top_y + 8), col_hdr, font=f_card, fill=(240, 220, 180, 255))
            draw.text((cx + 12, r2_top_y + 8), col_hdr, font=f_card, fill=(240, 220, 180, 255))

        # --- ROW 1: Characters ---
        # 1. Place Player Courier baseline reference (scaled by char_scale)
        cur_x = cx + 12
        if player_img:
            pw, ph = player_img.size
            spw = int(pw * char_scale)
            sph = int(ph * char_scale)
            player_scaled = player_img.resize((spw, sph), Image.Resampling.LANCZOS)
            py = r1_baseline_y - sph
            canvas.alpha_composite(player_scaled, (cur_x, py))
            if f_label:
                draw.text((cur_x, r1_baseline_y + 6), f"主角 (快遞員)", font=f_label, fill=(130, 210, 255, 255))
                draw.text((cur_x, r1_baseline_y + 22), f"原高 {ph}px (基準)", font=f_label, fill=(180, 175, 190, 255))
            cur_x += spw + 14

        # 2. Minion
        if cfg["minion"] and os.path.exists(cfg["minion"]["path"]):
            m_img = Image.open(cfg["minion"]["path"]).convert("RGBA")
            m_img = crop_bbox(m_img)
            mw, mh = m_img.size
            smw = int(mw * char_scale)
            smh = int(mh * char_scale)
            m_scaled = m_img.resize((smw, smh), Image.Resampling.LANCZOS)
            my = r1_baseline_y - smh
            canvas.alpha_composite(m_scaled, (cur_x, my))
            is_app = (cfg["minion"]["status"] == "APPROVED")
            col_txt = (120, 240, 140, 255) if is_app else (255, 180, 90, 255)
            if f_label:
                draw.text((cur_x, r1_baseline_y + 6), cfg["minion"]["name"], font=f_label, fill=col_txt)
                draw.text((cur_x, r1_baseline_y + 22), cfg["minion"]["scale_note"], font=f_label, fill=(180, 175, 190, 255))
            cur_x += smw + 14
        elif not cfg["minion"]:
            # Missing minion/boss placeholder card
            card_w = col_w - (cur_x - cx) - 16
            card_h = 240
            draw.rectangle([cur_x, r1_baseline_y - card_h, cur_x + card_w, r1_baseline_y], fill=(24, 20, 30, 180), outline=(90, 75, 110, 160), width=1)
            if f_desc:
                draw.text((cur_x + 16, r1_baseline_y - card_h + 30), f"【Stage {cfg['num']} 角色缺件】", font=f_desc, fill=(255, 140, 140, 255))
                draw.text((cur_x + 16, r1_baseline_y - card_h + 60), "本關小怪與 Boss 手繪候選待繪製", font=f_desc, fill=(190, 180, 200, 255))
                draw.text((cur_x + 16, r1_baseline_y - card_h + 85), "（目前 characters/ 目錄為空）", font=f_desc, fill=(150, 140, 160, 255))

        # 3. Boss (if minion exists)
        if cfg["boss"] and os.path.exists(cfg["boss"]["path"]):
            b_img = Image.open(cfg["boss"]["path"]).convert("RGBA")
            b_img = crop_bbox(b_img)
            bw, bh = b_img.size
            sbw = int(bw * char_scale)
            sbh = int(bh * char_scale)
            b_scaled = b_img.resize((sbw, sbh), Image.Resampling.LANCZOS)
            by = r1_baseline_y - sbh
            canvas.alpha_composite(b_scaled, (cur_x, by))
            is_app = (cfg["boss"]["status"] == "APPROVED")
            col_txt = (120, 240, 140, 255) if is_app else (255, 180, 90, 255)
            if f_label:
                draw.text((cur_x, r1_baseline_y + 6), cfg["boss"]["name"], font=f_label, fill=col_txt)
                draw.text((cur_x, r1_baseline_y + 22), cfg["boss"]["scale_note"], font=f_label, fill=(180, 175, 190, 255))

        # --- ROW 2: Buildings & Props ---
        r2_cur_x = cx + 14
        if cfg["building"] and os.path.exists(cfg["building"]["path"]):
            bld_img = Image.open(cfg["building"]["path"]).convert("RGBA")
            bw, bh = bld_img.size

            # Scale building by bld_scale
            tw = int(bw * bld_scale)
            th = int(bh * bld_scale)
            bld_resized = bld_img.resize((tw, th), Image.Resampling.LANCZOS)
            by = r2_baseline_y - th
            canvas.alpha_composite(bld_resized, (r2_cur_x, by))

            # Put in-game 2.5D player reference (scaled by bld_scale * (115/340)) right in front of building entrance
            if player_img:
                # In game, player is ~115px height relative to 500px building
                # So with bld_scale applied, player display height is 115 * bld_scale
                iph = int(115 * bld_scale)
                ipw = int(player_img.width * (iph / player_img.height))
                player_ingame = player_img.resize((ipw, iph), Image.Resampling.LANCZOS)
                door_px = r2_cur_x + int(tw * 0.42)
                canvas.alpha_composite(player_ingame, (door_px, r2_baseline_y - iph))
                draw.rectangle([door_px - 2, r2_baseline_y - iph - 2, door_px + ipw + 2, r2_baseline_y + 1], outline=(130, 210, 255, 200), width=1)
                if f_label:
                    draw.text((door_px - 8, r2_baseline_y - iph - 16), "實景主角(115p)", font=f_label, fill=(130, 210, 255, 255))

            if f_label:
                draw.text((r2_cur_x, r2_baseline_y + 6), cfg["building"]["name"][:22], font=f_label, fill=(255, 180, 90, 255))
                draw.text((r2_cur_x, r2_baseline_y + 22), cfg["building"]["scale_note"][:28], font=f_label, fill=(180, 175, 190, 255))

            # Place Prop if present
            if cfg["prop"] and os.path.exists(cfg["prop"]["path"]):
                p_img = Image.open(cfg["prop"]["path"]).convert("RGBA")
                pw, ph = p_img.size
                ptw = int(pw * bld_scale)
                pth = int(ph * bld_scale)
                p_resized = p_img.resize((ptw, pth), Image.Resampling.LANCZOS)
                prop_x = r2_cur_x + tw + 10
                prop_y = r2_baseline_y - pth
                if prop_x + ptw <= cx + col_w - 6:
                    canvas.alpha_composite(p_resized, (prop_x, prop_y))
                    if f_label:
                        draw.text((prop_x, r2_baseline_y + 6), cfg["prop"]["name"][:14], font=f_label, fill=(255, 210, 120, 255))
                        draw.text((prop_x, r2_baseline_y + 22), cfg["prop"]["scale_note"][:16], font=f_label, fill=(180, 175, 190, 255))
        elif not cfg["building"]:
            # Missing building card (Stage 4)
            card_w = col_w - 28
            card_h = 280
            draw.rectangle([r2_cur_x, r2_baseline_y - card_h, r2_cur_x + card_w, r2_baseline_y], fill=(24, 20, 30, 180), outline=(90, 75, 110, 160), width=1)
            if f_desc:
                draw.text((r2_cur_x + 16, r2_baseline_y - card_h + 30), f"【Stage {cfg['num']} 建築物缺件】", font=f_desc, fill=(255, 180, 90, 255))
                draw.text((r2_cur_x + 16, r2_baseline_y - card_h + 60), "本關設計為幽深竹林迷宮，目前無單體房屋素材", font=f_desc, fill=(190, 180, 200, 255))
                draw.text((r2_cur_x + 16, r2_baseline_y - card_h + 85), "現行以明亮竹道地面 (G_bamboo_path_bright_v2) 鋪設", font=f_desc, fill=(160, 150, 175, 255))

    # Bottom summary strip
    draw.rectangle([0, canvas_h - 60, canvas_w, canvas_h], fill=(12, 10, 16, 255))
    draw.line([(0, canvas_h - 60), (canvas_w, canvas_h - 60)], fill=(120, 100, 70, 200), width=1)
    summary_findings = (
        "審查結論：① 角色比例：小怪高約 193~215px (主角57~63%)，Boss高約 315~330px 且橫向寬闊，體積與威壓感自然合理。"
        " ② 建築門檻：各關建築門洞高度約 170~190px，與遊戲實景主角 (~115px) 自然匹配，無撞頭或卡門缺陷。"
        " ③ 缺件提示：Stage 5、Stage 6 角色尚待繪製；Stage 4 無單體建築物。"
    )
    if f_sub:
        draw.text((40, canvas_h - 40), summary_findings, font=f_sub, fill=(230, 215, 185, 255))

    canvas.save(OUTPUT_SCALE_IMG, "PNG")
    print(f"Scale comparison image saved to: {OUTPUT_SCALE_IMG}")

    # Generate WebP thumbnail for scale comparison
    scale_thumb = generate_webp_thumbnail(OUTPUT_SCALE_IMG, "thumb_Preview_scale_comparison.webp", max_width=1200, quality=85)
    return scale_thumb

def build_overview_image():
    print("Building art/Preview_overview.png...")
    canvas_w, canvas_h = 1920, 1200
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (20, 18, 24, 255))
    draw = ImageDraw.Draw(canvas)

    # Top banner
    draw.rectangle([0, 0, canvas_w, 80], fill=(14, 12, 18, 255))
    draw.line([(0, 80), (canvas_w, 80)], fill=(190, 150, 75, 230), width=2)

    font_title, font_sub, font_card, font_badge, font_small = load_fonts()

    title = "《妖怪快遞社》關卡場景美術預覽總覽 (Stage Scene Art Overview)"
    sub = "Stage 2 ～ Stage 6 實景視角評審拼版・半水墨 ＋ 半浮世繪 ＋ 粗墨線 ＋ 和紙木版質感"

    if font_title:
        draw.text((40, 14), title, font=font_title, fill=(245, 230, 200, 255))
        draw.text((42, 50), sub, font=font_sub, fill=(200, 175, 135, 255))
    else:
        draw.text((40, 20), title, fill=(245, 230, 200, 255))

    # Grid definition:
    # Row 1: 3 cards (Stage 2, Stage 3, Stage 4)
    # Row 2: 2 cards centered (Stage 5, Stage 6)
    r1_y = 110
    r1_w = 580
    r1_h = 480
    r1_gap = 40
    r1_start_x = (canvas_w - (3 * r1_w + 2 * r1_gap)) // 2

    r2_y = 640
    r2_w = 720
    r2_h = 510
    r2_gap = 80
    r2_start_x = (canvas_w - (2 * r2_w + r2_gap)) // 2

    coords = [
        (r1_start_x + 0 * (r1_w + r1_gap), r1_y, r1_w, r1_h),
        (r1_start_x + 1 * (r1_w + r1_gap), r1_y, r1_w, r1_h),
        (r1_start_x + 2 * (r1_w + r1_gap), r1_y, r1_w, r1_h),
        (r2_start_x + 0 * (r2_w + r2_gap), r2_y, r2_w, r2_h),
        (r2_start_x + 1 * (r2_w + r2_gap), r2_y, r2_w, r2_h),
    ]

    for idx, stage in enumerate(STAGES_INFO[:5]):
        bx, by, bw, bh = coords[idx]
        # Card background
        draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=8, fill=(28, 25, 33, 240), outline=(90, 75, 60, 200), width=1)
        # Header strip
        header_h = 42
        draw.rounded_rectangle([bx, by, bx + bw, by + header_h], radius=8, fill=(38, 33, 44, 255))
        draw.line([(bx, by + header_h), (bx + bw, by + header_h)], fill=(150, 120, 70, 220), width=1)

        # Stage title & badge
        st_title = f"Stage {stage['num']}: {stage['name_zh']} ({stage['id'].replace('stage'+str(stage['num'])+'-', '')})"
        status_text = stage["status"]
        status_col = stage["status_color"]

        if font_card:
            draw.text((bx + 14, by + 10), st_title, font=font_card, fill=(240, 230, 210, 255))
            if font_badge:
                draw.text((bx + bw - 180, by + 13), status_text, font=font_badge, fill=status_col)
        else:
            draw.text((bx + 14, by + 10), st_title, fill=(240, 230, 210, 255))

        # Preview image thumbnail
        preview_rel = os.path.join(ART_ROOT, stage["id"], stage["primary_preview"])
        thumb_x = bx + 12
        thumb_y = by + header_h + 10
        thumb_w = bw - 24
        thumb_h = bh - header_h - 65

        if os.path.exists(preview_rel):
            pimg = Image.open(preview_rel).convert("RGB")
            # Aspect ratio resize
            scale = min(thumb_w / pimg.width, thumb_h / pimg.height)
            tw = int(pimg.width * scale)
            th = int(pimg.height * scale)
            pimg_thumb = pimg.resize((tw, th), Image.Resampling.LANCZOS)
            # Center in thumbnail box
            px = thumb_x + (thumb_w - tw) // 2
            py = thumb_y + (thumb_h - th) // 2
            # Draw frame
            draw.rectangle([px - 2, py - 2, px + tw + 1, py + th + 1], fill=(10, 8, 12, 255), outline=(130, 105, 65, 200), width=1)
            canvas.paste(pimg_thumb, (px, py))
        else:
            draw.rectangle([thumb_x, thumb_y, thumb_x + thumb_w, thumb_y + thumb_h], fill=(30, 30, 35, 255))
            draw.text((thumb_x + 20, thumb_y + 40), f"Preview not found:\n{stage['primary_preview']}", fill=(200, 100, 100, 255))

        # Bottom caption
        caption_y = by + bh - 45
        if font_small:
            draw.text((bx + 14, caption_y), stage["theme"], font=font_small, fill=(210, 190, 160, 255))
            draw.text((bx + 14, caption_y + 18), f"主要檔案：{stage['primary_preview']}", font=font_small, fill=(160, 150, 140, 255))
        else:
            draw.text((bx + 14, caption_y), stage["theme"], fill=(210, 190, 160, 255))

    canvas.save(OUTPUT_IMG, "PNG")
    print(f"Overview image saved to: {OUTPUT_IMG}")

    # Also generate overview WebP thumbnail
    overview_thumb = generate_webp_thumbnail(OUTPUT_IMG, "thumb_Preview_overview.webp", max_width=1200, quality=85)
    return overview_thumb

def build_index_html():
    print("Building art/Preview_index.html with Lightbox and WebP thumbnails...")
    ensure_thumbs_dir()

    # Generate WebP thumbnails for all primary previews
    for stage in STAGES_INFO:
        if stage.get("primary_preview"):
            src = os.path.join(ART_ROOT, stage["id"], stage["primary_preview"])
            thumb_name = f"thumb_{stage['id']}_{stage['primary_preview']}.webp"
            stage["thumb_rel"] = generate_webp_thumbnail(src, thumb_name, max_width=800, quality=80) or f"{stage['id']}/{stage['primary_preview']}"
        else:
            stage["thumb_rel"] = None

    # Build stage cards HTML
    stage_cards_html = []
    lightbox_items = []

    # Item 0: Overview Collage
    lightbox_items.append({
        "src": "Preview_overview.png",
        "title": "五關場景美術對照總覽拼版 (Preview Overview Collage)",
        "badge": "OVERVIEW",
        "note": "Stage 2 至 Stage 6 實景視角評審總覽（高解析度 1920×1200）"
    })

    # Item 1: Scale Comparison Collage
    lightbox_items.append({
        "src": "Preview_scale_comparison.png",
        "title": "第 2～6 關角色・Boss・房屋與主角實際比例尺標對照拼版 (Scale Comparison)",
        "badge": "SCALE_AUDIT",
        "note": "基準接地線對齊 · 像素高度刻度尺 (0-600px) · 建築門檻與角色比例檢核"
    })

    # Item 2: Stage 3 & 4 Rework Comparison Collage
    lightbox_items.append({
        "src": "Preview_stage3_stage4_rework_comparison.png",
        "title": "Stage 3 & Stage 4 人審重製候選 (v2) 聚合對照檢核看板",
        "badge": "REWORK_AUDIT",
        "note": "03:26 拒稿退回項目逐項校正：巨石比例縮減・2.5D建築深度・亮色竹壤步道・微縮竹葉"
    })

    for stage in STAGES_INFO:
        stage_dir = os.path.join(ART_ROOT, stage["id"])
        all_previews = []
        if os.path.exists(stage_dir):
            for f in sorted(os.listdir(stage_dir)):
                if f.startswith("Preview_") and f.endswith(".png") and "_rejected" not in f:
                    fpath = os.path.join(stage_dir, f)
                    fsize_kb = os.path.getsize(fpath) // 1024
                    all_previews.append({"filename": f, "rel": f"{stage['id']}/{f}", "size_kb": fsize_kb})

        primary = stage.get("primary_preview")
        primary_rel = f"{stage['id']}/{primary}" if primary else None
        thumb_rel = stage.get("thumb_rel")

        badge_class = "approved" if "APPROVED" in stage["status"] else "rework" if "REWORK" in stage["status"] else "roadmap" if "ROADMAP" in stage["status"] else "candidate"

        if primary:
            # Register to lightbox sequence
            lightbox_idx = len(lightbox_items)
            lightbox_items.append({
                "src": primary_rel,
                "title": f"Stage {stage['num']}: {stage['name_zh']} - {primary}",
                "badge": stage["status_label"],
                "note": stage["approval_note"]
            })

            other_links = []
            for p in all_previews:
                is_pri = (p["filename"] == primary)
                pri_tag = " <span class='tag-pri'>★ 主預覽</span>" if is_pri else ""
                p_rel = p["rel"]
                safe_title = f"Stage {stage['num']}: {stage['name_zh']} - {p['filename']}"
                other_links.append(
                    f"<li>"
                    f"<a href='javascript:void(0)' onclick='openLightboxDirect(\"{p_rel}\", \"{safe_title}\", \"{stage['status_label']}\", \"{stage['approval_note']}\")' title='點擊在頁面燈箱放大檢視'>{p['filename']}</a> "
                    f"<span class='file-size'>({p['size_kb']} KB)</span>"
                    f"<a href='{p_rel}' target='_blank' class='raw-link' title='另開新分頁檢視原檔'>[原圖]</a>"
                    f"{pri_tag}</li>"
                )

            preview_body_html = f"""
                <div class="hero-preview" onclick="openLightboxByIndex({lightbox_idx})">
                    <div class="hero-img-wrap">
                        <img src="{thumb_rel}" alt="{stage['name_zh']} 實景預覽" loading="lazy" onerror="this.src='{primary_rel}'" />
                        <div class="zoom-overlay">🔍 點擊在燈箱中全螢幕放大檢視 (可左右切換)</div>
                    </div>
                </div>
                <div class="stage-info">
                    <div class="status-notice {badge_class}">
                        <strong>人審狀態：</strong>{stage['approval_note']}
                    </div>
                    <p class="theme-text"><strong>核心氛圍：</strong>{stage['theme']}</p>
                    <p class="desc-text">{stage['desc']}</p>
                    <div class="preview-list">
                        <h4>關卡內 Preview 圖片清單 ({len(all_previews)} 張，點擊直接燈箱放大)：</h4>
                        <ul>
                            {"".join(other_links)}
                        </ul>
                    </div>
                </div>
            """
        else:
            # Roadmap stage card without generated previews yet
            contract_rel = f"{stage['id']}/production-contract.md"
            preview_body_html = f"""
                <div class="roadmap-box">
                    <div class="roadmap-badge-icon">📜</div>
                    <h3>關卡生產契約落盤備查</h3>
                    <p>美術規格與單字主題已完成規劃，待後續美術輪次繪製候選圖。</p>
                    <p class="roadmap-link-wrap">
                        <a href="{contract_rel}" target="_blank" class="roadmap-contract-link">📄 檢視完整生產規格契約：{contract_rel}</a>
                    </p>
                    <div class="roadmap-asset-tags">
                        <span>待繪製：無縫地面 (G_)</span>
                        <span>待繪製：景觀貼花 (O_)</span>
                        <span>待繪製：建築殿堂 (H_)</span>
                        <span>待繪製：專屬小怪 (E_)</span>
                        <span>待繪製：專屬首領 (B_)</span>
                    </div>
                </div>
                <div class="stage-info">
                    <div class="status-notice {badge_class}">
                        <strong>關卡狀態：</strong>{stage['approval_note']}
                    </div>
                    <p class="theme-text"><strong>核心氛圍：</strong>{stage['theme']}</p>
                    <p class="desc-text">{stage['desc']}</p>
                    <div class="roadmap-notes-box">
                        <strong>開發指引：</strong>遵守《妖怪快遞社》真手繪無幾何色塊規格；嚴格依「先審 IDLE 唯一母版、再以圖生圖生 ATTACK」鐵律進行。
                    </div>
                </div>
            """

        card_html = f"""
        <div class="stage-card" id="{stage['id']}">
            <div class="stage-header">
                <div class="stage-title">
                    <span class="stage-num">Stage {stage['num']}</span>
                    <h2>{stage['name_zh']} <span class="stage-slug">({stage['id']})</span></h2>
                </div>
                <div class="status-badge {badge_class}">{stage['status_label']}</div>
            </div>
            <div class="stage-body">
                {preview_body_html}
            </div>
        </div>
        """
        stage_cards_html.append(card_html)

    lightbox_json = json.dumps(lightbox_items, ensure_ascii=False)

    html_content = f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>《妖怪快遞社》關卡美術預覽總覽 (Stage Art Preview Index)</title>
    <style>
        :root {{
            --bg-color: #121015;
            --card-bg: #1c1822;
            --border-color: #3d3545;
            --gold-accent: #d4af37;
            --gold-dim: #9e8229;
            --text-main: #ece6d8;
            --text-sub: #b5ac9d;
            --approved: #4caf50;
            --rework: #ff9800;
            --candidate: #29b6f6;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background-color: var(--bg-color);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", "Noto Sans TC", sans-serif;
            padding: 24px;
            line-height: 1.6;
        }}
        header {{
            max-width: 1400px;
            margin: 0 auto 24px auto;
            padding: 24px 30px;
            background: linear-gradient(135deg, #1f1b26 0%, #15121b 100%);
            border: 1px solid var(--border-color);
            border-bottom: 2px solid var(--gold-accent);
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }}
        .header-title h1 {{
            font-size: 26px;
            color: #fff4dd;
            margin-bottom: 6px;
            letter-spacing: 0.5px;
        }}
        .header-title p {{
            font-size: 14px;
            color: var(--text-sub);
        }}
        .summary-stats {{
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }}
        .stat-item {{
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(212,175,55,0.3);
            padding: 8px 14px;
            border-radius: 6px;
            text-align: center;
            min-width: 90px;
        }}
        .stat-val {{
            font-size: 18px;
            font-weight: bold;
            color: var(--gold-accent);
        }}
        .stat-lbl {{
            font-size: 11px;
            color: var(--text-sub);
        }}
        .global-warning-box {{
            max-width: 1400px;
            margin: 0 auto 24px auto;
            background: rgba(212, 175, 55, 0.08);
            border-left: 4px solid var(--gold-accent);
            border-radius: 6px;
            padding: 14px 20px;
            font-size: 13.5px;
            color: #ffecb3;
            line-height: 1.5;
        }}
        .global-warning-box strong {{
            color: #ffe082;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 28px;
        }}
        .overview-section {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
        }}
        .overview-section h3 {{
            color: var(--gold-accent);
            font-size: 18px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }}
        .overview-section a.full-link {{
            font-size: 13px;
            color: #81d4fa;
            text-decoration: none;
            padding: 4px 10px;
            border: 1px solid #81d4fa;
            border-radius: 4px;
        }}
        .overview-section a.full-link:hover {{
            background: rgba(129,212,250,0.15);
        }}
        .overview-img-wrap {{
            position: relative;
            border: 1px solid #332d3d;
            border-radius: 6px;
            overflow: hidden;
            background: #000;
            cursor: pointer;
        }}
        .overview-img-wrap img {{
            width: 100%;
            height: auto;
            display: block;
            transition: opacity 0.2s ease;
        }}
        .overview-img-wrap:hover img {{
            opacity: 0.9;
        }}
        .scale-section {{
            background: var(--card-bg);
            border: 1px solid #4a3e59;
            border-left: 4px solid #81d4fa;
            border-radius: 8px;
            padding: 20px;
        }}
        .scale-section h3 {{
            color: #81d4fa;
            font-size: 18px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }}
        .scale-subtitle {{
            font-size: 13px;
            color: var(--text-sub);
            margin-bottom: 12px;
        }}
        .stage-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            transition: border-color 0.2s ease;
        }}
        .stage-card:hover {{
            border-color: var(--gold-dim);
        }}
        .stage-header {{
            background: #25202d;
            padding: 14px 20px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .stage-title {{
            display: flex;
            align-items: baseline;
            gap: 12px;
        }}
        .stage-num {{
            font-size: 13px;
            font-weight: bold;
            color: var(--gold-accent);
            background: rgba(212,175,55,0.15);
            padding: 3px 8px;
            border-radius: 4px;
            border: 1px solid rgba(212,175,55,0.3);
        }}
        .stage-title h2 {{
            font-size: 20px;
            color: #fff;
        }}
        .stage-slug {{
            font-size: 13px;
            color: var(--text-sub);
            font-weight: normal;
        }}
        .status-badge {{
            font-size: 12px;
            font-weight: bold;
            padding: 4px 12px;
            border-radius: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .status-badge.approved {{ background: rgba(76,175,80,0.2); color: #81c784; border: 1px solid #4caf50; }}
        .status-badge.rework {{ background: rgba(255,152,0,0.2); color: #ffb74d; border: 1px solid #ff9800; }}
        .status-badge.candidate {{ background: rgba(41,182,246,0.2); color: #81d4fa; border: 1px solid #29b6f6; }}
        .stage-body {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            padding: 20px;
        }}
        @media (max-width: 960px) {{
            .stage-body {{ grid-template-columns: 1fr; }}
        }}
        .hero-preview {{
            cursor: pointer;
        }}
        .hero-img-wrap {{
            position: relative;
            border: 1px solid #3d3545;
            border-radius: 6px;
            overflow: hidden;
            background: #000;
        }}
        .hero-img-wrap img {{
            width: 100%;
            height: auto;
            display: block;
            transition: opacity 0.2s ease, transform 0.2s ease;
        }}
        .hero-img-wrap:hover img {{
            opacity: 0.92;
            transform: scale(1.01);
        }}
        .zoom-overlay {{
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(18,16,21,0.85);
            color: #ffd54f;
            font-size: 12px;
            padding: 8px 12px;
            text-align: center;
            border-top: 1px solid rgba(212,175,55,0.4);
            pointer-events: none;
        }}
        .stage-info {{
            display: flex;
            flex-direction: column;
            gap: 12px;
        }}
        .status-notice {{
            font-size: 12.5px;
            padding: 6px 12px;
            border-radius: 5px;
            border-left: 3px solid;
        }}
        .status-notice.approved {{ background: rgba(76,175,80,0.12); color: #a5d6a7; border-color: #4caf50; }}
        .status-notice.rework {{ background: rgba(255,152,0,0.12); color: #ffe082; border-color: #ff9800; }}
        .status-notice.candidate {{ background: rgba(41,182,246,0.12); color: #b3e5fc; border-color: #29b6f6; }}
        .theme-text {{
            font-size: 14.5px;
            color: #ffecb3;
        }}
        .desc-text {{
            font-size: 13px;
            color: var(--text-sub);
            background: rgba(0,0,0,0.2);
            padding: 10px 14px;
            border-radius: 6px;
            border-left: 3px solid var(--gold-accent);
        }}
        .preview-list h4 {{
            font-size: 13px;
            color: var(--gold-dim);
            margin-bottom: 6px;
        }}
        .preview-list ul {{
            list-style: none;
            max-height: 180px;
            overflow-y: auto;
            border: 1px solid #2d2636;
            border-radius: 6px;
            background: rgba(0,0,0,0.25);
            padding: 6px 10px;
        }}
        .preview-list li {{
            font-size: 12px;
            padding: 4px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }}
        .preview-list a {{
            color: #90caf9;
            text-decoration: none;
        }}
        .preview-list a:hover {{
            text-decoration: underline;
        }}
        .raw-link {{
            color: #b0bec5 !important;
            font-size: 11px;
            margin-left: 4px;
        }}
        .file-size {{
            color: #78909c;
            font-size: 11px;
        }}
        .tag-pri {{
            color: #ffd54f;
            font-weight: bold;
            font-size: 11px;
            background: rgba(212,175,55,0.15);
            padding: 1px 4px;
            border-radius: 3px;
        }}
        footer {{
            max-width: 1400px;
            margin: 40px auto 20px auto;
            text-align: center;
            font-size: 12px;
            color: #665f70;
            border-top: 1px solid #25202d;
            padding-top: 16px;
        }}

        /* Quick Nav Bar */
        .quick-nav-bar {{
            position: sticky;
            top: 10px;
            z-index: 100;
            background: rgba(22, 18, 28, 0.96);
            backdrop-filter: blur(8px);
            border: 1px solid var(--border-color);
            border-bottom: 2px solid var(--gold-accent);
            border-radius: 8px;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            box-shadow: 0 6px 20px rgba(0,0,0,0.6);
            max-width: 1400px;
            margin: 0 auto 20px auto;
        }}
        .nav-label {{
            font-size: 13px;
            font-weight: bold;
            color: var(--gold-accent);
        }}
        .nav-link {{
            color: #d1c4e9;
            text-decoration: none;
            font-size: 12.5px;
            padding: 4px 10px;
            border-radius: 4px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            transition: all 0.2s ease;
        }}
        .nav-link:hover {{
            background: rgba(212,175,55,0.2);
            color: #ffd54f;
            border-color: var(--gold-accent);
        }}
        .status-badge.roadmap {{ background: rgba(149,117,205,0.2); color: #b39ddb; border: 1px solid #7e57c2; }}
        .status-notice.roadmap {{ background: rgba(149,117,205,0.12); color: #d1c4e9; border-color: #7e57c2; }}
        .roadmap-box {{
            background: rgba(28, 24, 36, 0.7);
            border: 1px dashed #5e4d75;
            border-radius: 6px;
            padding: 24px 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
            text-align: center;
        }}
        .roadmap-badge-icon {{
            font-size: 32px;
        }}
        .roadmap-contract-link {{
            display: inline-block;
            background: #2b2338;
            color: #81d4fa;
            text-decoration: none;
            padding: 6px 14px;
            border: 1px solid #4a3e59;
            border-radius: 4px;
            font-size: 13px;
        }}
        .roadmap-contract-link:hover {{
            background: #3c314e;
            color: #b3e5fc;
        }}
        .roadmap-asset-tags {{
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: center;
            margin-top: 8px;
        }}
        .roadmap-asset-tags span {{
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            color: #b0bec5;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 10px;
        }}
        .roadmap-notes-box {{
            font-size: 12px;
            color: #b0bec5;
            background: rgba(0,0,0,0.2);
            padding: 8px 12px;
            border-radius: 4px;
            border-left: 2px solid #7e57c2;
        }}
        .lightbox-ruler-overlay {{
            display: none;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            background-image: repeating-linear-gradient(to top, rgba(80, 200, 120, 0.45) 0px, rgba(80, 200, 120, 0.45) 1px, transparent 1px, transparent 50px);
        }}
        .lightbox-ruler-overlay.active {{
            display: block;
        }}

        /* Lightbox Modal */
        #lightbox-modal {{
            display: none;
            position: fixed;
            z-index: 9999;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(8, 6, 11, 0.94);
            backdrop-filter: blur(4px);
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            user-select: none;
        }}
        #lightbox-modal.active {{
            display: flex;
        }}
        .lightbox-header {{
            width: 100%;
            max-width: 1600px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #ece6d8;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(212,175,55,0.3);
        }}
        .lightbox-title-wrap {{
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }}
        .lightbox-title {{
            font-size: 16px;
            font-weight: bold;
            color: #fff4dd;
        }}
        .lightbox-badge {{
            font-size: 11px;
            font-weight: bold;
            padding: 2px 8px;
            border-radius: 10px;
            background: rgba(212,175,55,0.2);
            color: #ffd54f;
            border: 1px solid rgba(212,175,55,0.4);
        }}
        .lightbox-controls {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .lightbox-btn {{
            background: #25202d;
            color: #ece6d8;
            border: 1px solid #4a3e59;
            border-radius: 6px;
            padding: 6px 14px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
        }}
        .lightbox-btn:hover {{
            background: #393144;
            border-color: var(--gold-accent);
            color: #ffd54f;
        }}
        .lightbox-close {{
            font-size: 20px;
            padding: 4px 12px;
            color: #ff8a80;
        }}
        .lightbox-content {{
            flex: 1;
            width: 100%;
            max-width: 1600px;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            overflow: hidden;
            margin: 10px 0;
        }}
        .lightbox-img {{
            max-width: 100%;
            max-height: calc(100vh - 160px);
            object-fit: contain;
            border: 1px solid #332d3d;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            border-radius: 4px;
        }}
        .lightbox-nav-btn {{
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(25, 20, 30, 0.75);
            color: #ece6d8;
            border: 1px solid rgba(212,175,55,0.4);
            font-size: 28px;
            width: 48px;
            height: 64px;
            border-radius: 6px;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }}
        .lightbox-nav-btn:hover {{
            background: rgba(45, 35, 55, 0.95);
            color: #ffd54f;
            border-color: var(--gold-accent);
            transform: translateY(-50%) scale(1.05);
        }}
        .lightbox-prev {{ left: 10px; }}
        .lightbox-next {{ right: 10px; }}
        .lightbox-footer {{
            width: 100%;
            max-width: 1600px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #b5ac9d;
            font-size: 13px;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.08);
            flex-wrap: wrap;
            gap: 8px;
        }}
        .lightbox-note {{
            color: #ffd54f;
        }}
        .lightbox-counter {{
            color: #81d4fa;
            font-weight: bold;
        }}
    </style>
</head>
<body>
    <header>
        <div class="header-title">
            <h1>《妖怪快遞社》關卡美術預覽總覽 (Stage Art Preview Index)</h1>
            <p>已整合 Stage 2 至 Stage 6 核心場景手繪美術・2.5D 實景視角評審拼版</p>
        </div>
        <div class="summary-stats">
            <div class="stat-item">
                <div class="stat-val">7</div>
                <div class="stat-lbl">涵蓋關卡 (S2~S8)</div>
            </div>
            <div class="stat-item">
                <div class="stat-val" style="color:#81c784;">1</div>
                <div class="stat-lbl">Stage 2 (核准素材)</div>
            </div>
            <div class="stat-item">
                <div class="stat-val" style="color:#ffb74d;">2</div>
                <div class="stat-lbl">Stage 3/4 (重製候選)</div>
            </div>
            <div class="stat-item">
                <div class="stat-val" style="color:#81d4fa;">2</div>
                <div class="stat-lbl">Stage 5/6 (全新候選)</div>
            </div>
            <div class="stat-item">
                <div class="stat-val" style="color:#b39ddb;">2</div>
                <div class="stat-lbl">Stage 7/8 (規格落盤)</div>
            </div>
        </div>
    </header>

    <div class="global-warning-box">
        <strong>⚠️ 關卡人審與驗收狀態提醒：</strong>
        全關卡目前均<strong>未達整關核准或發行許可門檻</strong>。
        Stage 2 僅石木交界過渡素材 v2 與四怪物語法核准；Stage 3/4 重製稿（解決巨石/扁平/黑地/大葉）與 Stage 5/6 候選稿（百鬼京都、雪燈山寺）皆為視覺提案（CANDIDATE），尚待人工審核；Stage 7/8 規格落盤備查；禁止擅自接上 production runtime。
    </div>

    <nav class="quick-nav-bar">
        <span class="nav-label">快速導航：</span>
        <a href="#section-rework" class="nav-link">⚖️ S3/S4重製對照</a>
        <a href="#section-scale" class="nav-link">📏 比例尺標</a>
        <a href="#section-overview" class="nav-link">🖼️ 五關總覽</a>
        <a href="#stage2-rain-port" class="nav-link">S2 雨夜港町</a>
        <a href="#stage3-sakura-pass" class="nav-link">S3 妖櫻山道</a>
        <a href="#stage4-bamboo-maze" class="nav-link">S4 竹影迷宮</a>
        <a href="#stage5-hyakki-kyoto" class="nav-link">S5 百鬼京都</a>
        <a href="#stage6-snow-temple" class="nav-link">S6 雪燈山寺</a>
        <a href="#stage7-spirit-ferry" class="nav-link">S7 幽世渡口</a>
        <a href="#stage8-yomi" class="nav-link">S8 黃泉境</a>
    </nav>

    <div class="container">
        <!-- Stage 3 & 4 Rework Comparison Section -->
        <section class="scale-section" id="section-rework">
            <h3>
                <span>Stage 3 & Stage 4 人審重製候選 (v2) 聚合對照檢核看板</span>
                <div>
                    <button class="lightbox-btn" onclick="openLightboxByIndex(2)">🔍 燈箱全螢幕檢視</button>
                    <a class="full-link" href="Preview_stage3_stage4_rework_comparison.png" target="_blank">另開原圖 (2500×1550)</a>
                </div>
            </h3>
            <p class="scale-subtitle">03:26 拒稿退回項目逐項校正：妖櫻山道巨石收縮與2.5D體積感 · 竹影迷宮明亮竹壤步道(G_bamboo_path_bright_v2)與微縮散落竹葉點綴</p>
            <div class="overview-img-wrap" onclick="openLightboxByIndex(2)" title="點擊在燈箱全螢幕檢視重製對照拼版">
                <img src="Preview_thumbs/thumb_Preview_stage3_stage4_rework_comparison.webp" alt="Stage 3 與 Stage 4 重製候選對照拼版" onerror="this.src='Preview_stage3_stage4_rework_comparison.png'" />
            </div>
        </section>

        <!-- Scale Comparison Section -->
        <section class="scale-section" id="section-scale">
            <h3>
                <span>角色・Boss・房屋與主角實際比例尺標對照拼版 (Scale Comparison)</span>
                <div>
                    <button class="lightbox-btn" onclick="openLightboxByIndex(1)">🔍 燈箱全螢幕檢視</button>
                    <a class="full-link" href="Preview_scale_comparison.png" target="_blank">另開原圖 (2600×1550)</a>
                </div>
            </h3>
            <p class="scale-subtitle">透明背景基準接地線對齊 · 0-600px 像素高度刻度尺 · 快速找出怪物威壓感、房屋門檻與快遞員比例錯誤</p>
            <div class="overview-img-wrap" onclick="openLightboxByIndex(1)" title="點擊在燈箱全螢幕檢視比例對照拼版">
                <img src="Preview_thumbs/thumb_Preview_scale_comparison.webp" alt="角色與房屋比例對照拼版" onerror="this.src='Preview_scale_comparison.png'" />
            </div>
        </section>

        <!-- Overview Section -->
        <section class="overview-section" id="section-overview">
            <h3>
                <span>五關場景對照拼版 (Preview Overview Collage)</span>
                <div>
                    <button class="lightbox-btn" onclick="openLightboxByIndex(0)">🔍 燈箱全螢幕檢視</button>
                    <a class="full-link" href="Preview_overview.png" target="_blank">另開原圖 (1920×1200)</a>
                </div>
            </h3>
            <div class="overview-img-wrap" onclick="openLightboxByIndex(0)" title="點擊在燈箱全螢幕檢視">
                <img src="Preview_thumbs/thumb_Preview_overview.webp" alt="關卡美術總覽拼版" onerror="this.src='Preview_overview.png'" />
            </div>
        </section>

        {"".join(stage_cards_html)}
    </div>

    <footer>
        <p>《妖怪快遞社》Yokai Delivery &bull; 美術資產管理工具自動生成 &bull; 遵循真手繪真圖規格與單關平面素材結構規範</p>
    </footer>

    <!-- Lightbox Modal -->
    <div id="lightbox-modal">
        <div class="lightbox-header">
            <div class="lightbox-title-wrap">
                <span class="lightbox-title" id="lb-title">標題</span>
                <span class="lightbox-badge" id="lb-badge">狀態</span>
            </div>
            <div class="lightbox-controls">
                <button class="lightbox-btn" id="lb-ruler-btn" onclick="toggleLightboxRuler()" title="切換像素尺規輔助線 (快捷鍵 R)">📏 尺規 (R)</button>
                <a class="lightbox-btn" id="lb-raw-link" href="#" target="_blank">在新分頁開啟原始檔案</a>
                <button class="lightbox-btn lightbox-close" onclick="closeLightbox()" title="關閉 (ESC)">✕</button>
            </div>
        </div>
        <div class="lightbox-content">
            <button class="lightbox-nav-btn lightbox-prev" onclick="lightboxPrev()" title="上一張 (左方向鍵)">❮</button>
            <div style="position:relative; display:inline-block; max-width:100%; max-height:calc(100vh - 160px);">
                <img class="lightbox-img" id="lb-img" src="" alt="預覽放大" />
                <div id="lb-ruler-overlay" class="lightbox-ruler-overlay"></div>
            </div>
            <button class="lightbox-nav-btn lightbox-next" onclick="lightboxNext()" title="下一張 (右方向鍵)">❯</button>
        </div>
        <div class="lightbox-footer">
            <span class="lightbox-note" id="lb-note">說明</span>
            <span class="lightbox-counter" id="lb-counter">1 / 6</span>
        </div>
    </div>

    <script>
        const LIGHTBOX_ITEMS = {lightbox_json};
        let currentLbIndex = 0;
        let isDirectMode = false;

        function updateLightboxView() {{
            const item = LIGHTBOX_ITEMS[currentLbIndex];
            if (!item) return;

            document.getElementById('lb-img').src = item.src;
            document.getElementById('lb-title').innerText = item.title;
            document.getElementById('lb-badge').innerText = item.badge || 'PREVIEW';
            document.getElementById('lb-note').innerText = item.note || '';
            document.getElementById('lb-raw-link').href = item.src;
            document.getElementById('lb-counter').innerText = `${{currentLbIndex + 1}} / ${{LIGHTBOX_ITEMS.length}}`;

            document.querySelector('.lightbox-prev').style.display = isDirectMode ? 'none' : 'flex';
            document.querySelector('.lightbox-next').style.display = isDirectMode ? 'none' : 'flex';
            document.getElementById('lb-counter').style.display = isDirectMode ? 'none' : 'inline';
        }}

        function openLightboxByIndex(index) {{
            isDirectMode = false;
            currentLbIndex = (index >= 0 && index < LIGHTBOX_ITEMS.length) ? index : 0;
            updateLightboxView();
            document.getElementById('lightbox-modal').classList.add('active');
        }}

        function openLightboxDirect(src, title, badge, note) {{
            isDirectMode = true;
            document.getElementById('lb-img').src = src;
            document.getElementById('lb-title').innerText = title;
            document.getElementById('lb-badge').innerText = badge || 'PREVIEW';
            document.getElementById('lb-note').innerText = note || '';
            document.getElementById('lb-raw-link').href = src;

            document.querySelector('.lightbox-prev').style.display = 'none';
            document.querySelector('.lightbox-next').style.display = 'none';
            document.getElementById('lb-counter').style.display = 'none';

            document.getElementById('lightbox-modal').classList.add('active');
        }}

        function closeLightbox() {{
            document.getElementById('lightbox-modal').classList.remove('active');
        }}

        function lightboxPrev() {{
            if (isDirectMode) return;
            currentLbIndex = (currentLbIndex - 1 + LIGHTBOX_ITEMS.length) % LIGHTBOX_ITEMS.length;
            updateLightboxView();
        }}

        function lightboxNext() {{
            if (isDirectMode) return;
            currentLbIndex = (currentLbIndex + 1) % LIGHTBOX_ITEMS.length;
            updateLightboxView();
        }}

        function toggleLightboxRuler() {{
            const overlay = document.getElementById('lb-ruler-overlay');
            const btn = document.getElementById('lb-ruler-btn');
            overlay.classList.toggle('active');
            if (overlay.classList.contains('active')) {{
                btn.style.borderColor = '#4caf50';
                btn.style.color = '#81c784';
            }} else {{
                btn.style.borderColor = '';
                btn.style.color = '';
            }}
        }}

        // Keyboard navigation
        window.addEventListener('keydown', function(e) {{
            const modal = document.getElementById('lightbox-modal');
            if (!modal.classList.contains('active')) return;

            if (e.key === 'Escape') {{
                closeLightbox();
            }} else if (e.key === 'ArrowLeft') {{
                lightboxPrev();
            }} else if (e.key === 'ArrowRight') {{
                lightboxNext();
            }} else if (e.key === 'r' || e.key === 'R') {{
                toggleLightboxRuler();
            }}
        }});
    </script>
</body>
</html>
"""
    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Index HTML saved to: {OUTPUT_HTML}")

if __name__ == "__main__":
    ensure_candidate_webps()
    build_scale_comparison_image()
    build_overview_image()
    build_index_html()
    print("All preview index and scale builds completed successfully!")
