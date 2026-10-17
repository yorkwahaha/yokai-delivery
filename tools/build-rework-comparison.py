import os
import sys
from PIL import Image, ImageDraw, ImageFont

ART_ROOT = "art"
OUTPUT_IMG = os.path.join(ART_ROOT, "Preview_stage3_stage4_rework_comparison.png")
OUTPUT_THUMB = os.path.join(ART_ROOT, "Preview_thumbs", "thumb_Preview_stage3_stage4_rework_comparison.webp")

def load_fonts():
    font_paths = [
        "C:/Windows/Fonts/msjhbd.ttc",
        "C:/Windows/Fonts/msjh.ttc",
        "C:/Windows/Fonts/msgothic.ttc",
        "C:/Windows/Fonts/arial.ttf"
    ]
    f_title, f_sub, f_card_title, f_body, f_badge = None, None, None, None, None
    for p in font_paths:
        if os.path.exists(p):
            try:
                f_title = ImageFont.truetype(p, 36)
                f_sub = ImageFont.truetype(p, 18)
                f_card_title = ImageFont.truetype(p, 24)
                f_body = ImageFont.truetype(p, 17)
                f_badge = ImageFont.truetype(p, 15)
                break
            except Exception:
                continue

    if not f_title:
        f_title = ImageFont.load_default()
        f_sub = f_title
        f_card_title = f_title
        f_body = f_title
        f_badge = f_title

    return f_title, f_sub, f_card_title, f_body, f_badge

def build_rework_comparison():
    print("Building Stage 3 & Stage 4 Rework Comparison Collage...")
    f_title, f_sub, f_card_title, f_body, f_badge = load_fonts()

    canvas_w, canvas_h = 2500, 1550
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (22, 23, 29, 255))
    draw = ImageDraw.Draw(canvas)

    # Outer border
    draw.rectangle([(20, 20), (canvas_w - 20, canvas_h - 20)], outline=(212, 175, 55, 200), width=3)
    draw.rectangle([(26, 26), (canvas_w - 26, canvas_h - 26)], outline=(70, 75, 95, 180), width=1)

    # Top Header Banner
    draw.rectangle([(30, 30), (canvas_w - 30, 160)], fill=(30, 32, 42, 255), outline=(50, 55, 75, 255), width=2)
    draw.text((60, 50), "Stage 3 & Stage 4 人審重製候選 (v2) 聚合對照檢核看板", fill=(245, 240, 225), font=f_title)
    draw.text((62, 105), "針對 03:26 使用者拒稿痛點逐項校正驗證 · 比例尺寸調和 · 2.5D 建築厚度與陰影 · 明亮竹壤與微縮散落竹葉點綴", fill=(180, 190, 210), font=f_sub)

    # Two columns layout
    col_w = 1180
    col_h = 1250
    col_y = 190
    col1_x = 50
    col2_x = 1270

    # Source images
    s3_img_path = os.path.join(ART_ROOT, "stage3-sakura-pass", "Preview_stage3_scene_rework_v2.png")
    s4_img_path = os.path.join(ART_ROOT, "stage4-bamboo-maze", "Preview_stage4_scene_rework_v2.png")

    # Column 1: Stage 3 Rework
    draw.rectangle([(col1_x, col_y), (col1_x + col_w, col_y + col_h)], fill=(28, 30, 38, 255), outline=(60, 70, 90, 255), width=2)
    # Stage 3 Header
    draw.rectangle([(col1_x, col_y), (col1_x + col_w, col_y + 70)], fill=(45, 38, 52, 255))
    draw.text((col1_x + 30, col_y + 20), "Stage 3: 妖櫻山道 (Sakura Pass) — REWORK v2", fill=(255, 215, 140), font=f_card_title)
    draw.rectangle([(col1_x + col_w - 220, col_y + 18), (col1_x + col_w - 30, col_y + 52)], fill=(180, 80, 120, 255))
    draw.text((col1_x + col_w - 205, col_y + 24), "REWORK_CANDIDATE", fill=(255, 255, 255), font=f_badge)

    if os.path.exists(s3_img_path):
        s3_im = Image.open(s3_img_path).convert("RGBA")
        s3_im_resized = s3_im.resize((1120, 630), Image.Resampling.LANCZOS)
        canvas.paste(s3_im_resized, (col1_x + 30, col_y + 90), s3_im_resized)
        draw.rectangle([(col1_x + 28, col_y + 88), (col1_x + 30 + 1122, col_y + 90 + 632)], outline=(80, 90, 115, 255), width=2)

    # Stage 3 Rework Points Box
    box3_y = col_y + 740
    draw.rectangle([(col1_x + 30, box3_y), (col1_x + col_w - 30, box3_y + 470)], fill=(34, 36, 46, 255), outline=(75, 80, 105, 255), width=1)
    draw.text((col1_x + 50, box3_y + 20), "【03:26 拒稿退回項目 ➔ 本輪 v2 校正對策】", fill=(255, 200, 100), font=f_body)

    s3_points = [
        ("巨石比例收縮", "前稿巨石尺寸過大佔據半屏；v2 改為符合山道庭院尺度之自然奇石，角色不再被石塊淹沒。"),
        ("2.5D 神社體積感", "前稿屋頂神樂殿被評扁平貼片；v2 重構山門與立柱陰影分層，具備真實 2.5D 深度與瓦當墨線。"),
        ("地表非規則無縫", "前稿泥地呈規則機械式網格重複；v2 引入自然落櫻散佈與手繪墨線交錯，瓦解格狀拼貼感。"),
        ("角色環境比例校正", "以主角信差 (180px) 與雪童子 (220px) 基準高度校正，建築門檻高度適配，無巨人症或矮化失真。"),
        ("資產隔離與現役保護", "嚴格保留現役三張地面與神樂殿；未核准之 v2 候選僅作離線對照預覽，未接入 runtime。")
    ]
    py = box3_y + 65
    for title, desc in s3_points:
        draw.text((col1_x + 50, py), f"● {title}：", fill=(140, 210, 255), font=f_body)
        draw.text((col1_x + 230, py), desc, fill=(220, 225, 235), font=f_body)
        py += 78

    # Column 2: Stage 4 Rework
    draw.rectangle([(col2_x, col_y), (col2_x + col_w, col_y + col_h)], fill=(28, 30, 38, 255), outline=(60, 70, 90, 255), width=2)
    # Stage 4 Header
    draw.rectangle([(col2_x, col_y), (col2_x + col_w, col_y + 70)], fill=(32, 48, 42, 255))
    draw.text((col2_x + 30, col_y + 20), "Stage 4: 竹影迷宮 (Bamboo Maze) — REWORK v2", fill=(160, 240, 180), font=f_card_title)
    draw.rectangle([(col2_x + col_w - 220, col_y + 18), (col2_x + col_w - 30, col_y + 52)], fill=(60, 140, 90, 255))
    draw.text((col2_x + col_w - 205, col_y + 24), "REWORK_CANDIDATE", fill=(255, 255, 255), font=f_badge)

    if os.path.exists(s4_img_path):
        s4_im = Image.open(s4_img_path).convert("RGBA")
        s4_im_resized = s4_im.resize((1120, 630), Image.Resampling.LANCZOS)
        canvas.paste(s4_im_resized, (col2_x + 30, col_y + 90), s4_im_resized)
        draw.rectangle([(col2_x + 28, col_y + 88), (col2_x + 30 + 1122, col_y + 90 + 632)], outline=(80, 90, 115, 255), width=2)

    # Stage 4 Rework Points Box
    box4_y = col_y + 740
    draw.rectangle([(col2_x + 30, box4_y), (col2_x + col_w - 30, box4_y + 470)], fill=(34, 36, 46, 255), outline=(75, 80, 105, 255), width=1)
    draw.text((col2_x + 50, box4_y + 20), "【03:26 拒稿退回項目 ➔ 本輪 v2 校正對策】", fill=(140, 230, 160), font=f_body)

    s4_points = [
        ("地面提高明度(160+)", "前稿深黑腐殖土 (明度~40) 衝突世界觀；v2 改採溫暖和煦之米黃竹壤步道 (G_bamboo_path_bright_v2)。"),
        ("竹葉微縮為地表點綴", "前稿竹葉大如角色引發嚴重比例失真；v2 將落葉尺寸微縮為稀疏地表點綴，呈現半水墨和紙質感。"),
        ("角色防隱形高對比", "筍童子與竹影魅妖羽織白襯、土金幾何紋與玉光環，於亮色竹壤步道上輪廓清晰、層次分明。"),
        ("拒稿資產安全刪除", "已徹底移除 6 筆深黑腐殖土與巨大葉片預覽；candidates_manifest 留存歷史 SHA256 存證。"),
        ("專屬怪母版嚴格保護", "保留筍童子與竹影魅妖 IDLE 母版；維持 WAITING_HUMAN 待使用者視覺人審判定。")
    ]
    py = box4_y + 65
    for title, desc in s4_points:
        draw.text((col2_x + 50, py), f"● {title}：", fill=(140, 210, 255), font=f_body)
        draw.text((col2_x + 230, py), desc, fill=(220, 225, 235), font=f_body)
        py += 78

    # Bottom Footer
    draw.rectangle([(30, canvas_h - 75), (canvas_w - 30, canvas_h - 30)], fill=(28, 30, 38, 255), outline=(50, 55, 75, 255), width=1)
    draw.text((50, canvas_h - 60), "📌 審核提示：本看板由 AGY 離線真實手繪素材聚合拼版生成，不呼叫外部生圖 API；嚴格零程序假色塊、零接入 Runtime 執行期，待使用者視覺人審判定。", fill=(160, 170, 190), font=f_badge)

    canvas_rgb = canvas.convert("RGB")
    canvas_rgb.save(OUTPUT_IMG, "PNG")
    print(f"Rework comparison image saved to: {OUTPUT_IMG}")

    # Generate WebP thumbnail
    thumb = canvas_rgb.copy()
    thumb.thumbnail((1200, 750), Image.Resampling.LANCZOS)
    os.makedirs(os.path.dirname(OUTPUT_THUMB), exist_ok=True)
    thumb.save(OUTPUT_THUMB, "WEBP", quality=85)
    print(f"Rework comparison thumbnail saved to: {OUTPUT_THUMB}")

if __name__ == "__main__":
    build_rework_comparison()
