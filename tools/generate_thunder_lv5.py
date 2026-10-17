#!/usr/bin/env python3
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

def build_composite_thunder_lv5():
    # Load the base AI-generated thunder VFX
    base_src = r'art\vfx\thunder_vfx.png'
    vfx_base = Image.open(base_src).convert('RGBA')

    W = H = 1024
    cx, cy = 512, 512
    TAU = math.pi * 2

    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # 1. Dual-rotation blend of the authentic sumi-e thundercloud and lightning storm
    # Rotate 0 and 180 degrees to form a full circular thunder tempest
    vfx_rot1 = vfx_base.resize((1024, 1024), Image.Resampling.LANCZOS)
    vfx_rot2 = vfx_base.rotate(180, resample=Image.Resampling.BICUBIC).resize((1024, 1024))

    # Blend them together
    canvas = Image.alpha_composite(canvas, vfx_rot1)
    canvas = Image.alpha_composite(canvas, vfx_rot2)

    draw = ImageDraw.Draw(canvas)

    # 2. Concentric Sacred Golden / Lavender Boundary Rings
    rings = [
        (460, (235, 195, 105, 230), 4),
        (448, (175, 160, 245, 200), 2),
        (370, (245, 215, 130, 240), 3),
        (362, (150, 140, 220, 180), 2),
        (260, (255, 225, 140, 240), 3),
        (150, (200, 190, 255, 220), 3)
    ]
    for r, col, w in rings:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=w)

    # 3. Eight Raijin Drums (雷神太鼓) at outer ring radius 455px
    r_drums = 455
    drum_rad = 42
    for i in range(8):
        ang = i * (TAU / 8)
        dx = cx + math.cos(ang) * r_drums
        dy = cy + math.sin(ang) * r_drums

        # Drum drop shadow / dark ink aura
        draw.ellipse([dx - drum_rad - 6, dy - drum_rad - 6, dx + drum_rad + 6, dy + drum_rad + 6],
                     fill=(18, 14, 28, 180))

        # Outer drum rim (lacquered bronze-wood)
        draw.ellipse([dx - drum_rad, dy - drum_rad, dx + drum_rad, dy + drum_rad],
                     fill=(38, 26, 44, 255), outline=(240, 195, 95, 255), width=4)

        # Inner drum head (aged parchment)
        head_rad = int(drum_rad * 0.78)
        draw.ellipse([dx - head_rad, dy - head_rad, dx + head_rad, dy + head_rad],
                     fill=(242, 234, 212, 255), outline=(180, 140, 70, 220), width=2)

        # Gold rivets
        for j in range(12):
            riv_ang = j * (TAU / 12)
            rx = dx + math.cos(riv_ang) * (drum_rad * 0.9)
            ry = dy + math.sin(riv_ang) * (drum_rad * 0.9)
            draw.ellipse([rx - 2, ry - 2, rx + 2, ry + 2], fill=(255, 225, 120, 255))

        # Mitsudomoe (三つ巴) emblem on drumhead
        for m in range(3):
            m_ang = ang + m * (TAU / 3)
            head_d = head_rad * 0.44
            hx = dx + math.cos(m_ang) * head_d
            hy = dy + math.sin(m_ang) * head_d
            hr = int(head_rad * 0.3)
            draw.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=(24, 20, 36, 255))
            tail_ang = m_ang + 1.25
            tx = dx + math.cos(tail_ang) * (head_d * 0.42)
            ty = dy + math.sin(tail_ang) * (head_d * 0.42)
            draw.ellipse([tx - hr*0.65, ty - hr*0.65, tx + hr*0.65, ty + hr*0.65], fill=(24, 20, 36, 255))

        draw.ellipse([dx - 3, dy - 3, dx + 3, dy + 3], fill=(240, 195, 95, 255))

    # 4. Crackling Golden & Cyan electric arcs linking adjacent drums
    for i in range(8):
        a1 = i * (TAU / 8)
        a2 = (i + 1) * (TAU / 8)
        p1 = (cx + math.cos(a1) * r_drums, cy + math.sin(a1) * r_drums)
        p2 = (cx + math.cos(a2) * r_drums, cy + math.sin(a2) * r_drums)
        steps = 8
        arc_pts = [p1]
        for s in range(1, steps):
            u = s / steps
            inter_a = a1 + (a2 - a1) * u
            jitter = (np.sin(s * 3.5 + i) * 14)
            curr_r = r_drums + jitter
            arc_pts.append((cx + math.cos(inter_a) * curr_r, cy + math.sin(inter_a) * curr_r))
        arc_pts.append(p2)
        draw.line(arc_pts, fill=(190, 220, 255, 230), width=3)
        draw.line(arc_pts, fill=(255, 255, 255, 255), width=1)

    # 5. Eight Bagua Zhen (震卦 ☳) Trigrams
    r_trigram = 315
    for i in range(8):
        ang = i * (TAU / 8) + (TAU / 16)
        cos_a = math.cos(ang)
        sin_a = math.sin(ang)
        perp_x = -sin_a
        perp_y = cos_a
        for row, is_broken in [(0, True), (1, True), (2, False)]:
            dist = r_trigram + (row - 1) * 12
            center_x = cx + cos_a * dist
            center_y = cy + sin_a * dist
            length = 24
            if not is_broken:
                p1 = (center_x - perp_x * (length / 2), center_y - perp_y * (length / 2))
                p2 = (center_x + perp_x * (length / 2), center_y + perp_y * (length / 2))
                draw.line([p1, p2], fill=(255, 235, 150, 240), width=3)
            else:
                gap = 3
                p1 = (center_x - perp_x * (length / 2), center_y - perp_y * (length / 2))
                p2 = (center_x - perp_x * gap, center_y - perp_y * gap)
                p3 = (center_x + perp_x * gap, center_y + perp_y * gap)
                p4 = (center_x + perp_x * (length / 2), center_y + perp_y * (length / 2))
                draw.line([p1, p2], fill=(205, 190, 255, 230), width=3)
                draw.line([p3, p4], fill=(205, 190, 255, 230), width=3)

    # 6. Smooth clear center hole for player standing
    r_hole = 120
    mask = Image.new('L', (W, H), 255)
    m_draw = ImageDraw.Draw(mask)
    for r_step in range(r_hole, 0, -1):
        if (r_hole - r_step) < 35:
            alpha_val = int(255 * (1.0 - (r_hole - r_step) / 35.0))
        else:
            alpha_val = 0
        m_draw.ellipse([cx - r_step, cy - r_step, cx + r_step, cy + r_step], fill=max(0, alpha_val))

    canvas.putalpha(Image.composite(canvas.split()[3], Image.new('L', (W, H), 0), mask))

    # Inner golden boundary ring
    draw = ImageDraw.Draw(canvas)
    draw.ellipse([cx - r_hole, cy - r_hole, cx + r_hole, cy + r_hole],
                 outline=(255, 235, 160, 220), width=3)

    target_art = r'i:\Projects\yokai-delivery\art\vfx\thunder_lv5_vfx.png'
    target_assets = r'i:\Projects\yokai-delivery\assets\img\vfx\thunder_lv5_vfx.png'
    canvas.save(target_art, format='PNG', optimize=True)
    canvas.save(target_assets, format='PNG', optimize=True)
    print("Successfully built composite Thunder Lv 5 VFX!")

if __name__ == '__main__':
    build_composite_thunder_lv5()
