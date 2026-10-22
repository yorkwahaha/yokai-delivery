#!/usr/bin/env python3
"""Batch 1A Preview_index.html Updater.

Integrates Batch 1A Floor Triptych A/B Comparison into art/Preview_index.html.
Preserves all existing preview sections and cards.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREVIEW_HTML_PATH = ROOT / "art" / "Preview_index.html"
REVIEW_MANIFEST_PATH = ROOT / "art" / "batch1a-nb21-review-20261020" / "review_manifest.json"

STAGES_INFO = [
    {
        "num": 1,
        "name": "夜行町",
        "slug": "stage1-night-town",
        "theme": "夜色石板主地板・泥土地巷道・自然過渡",
        "prompt_file": "batch1a-nb21-prep-20261020/stage1_night_town_prompt.txt",
    },
    {
        "num": 2,
        "name": "雨夜港町",
        "slug": "stage2-rain-port",
        "theme": "濕潤碼頭石地・舊木棧道・自然過渡",
        "prompt_file": "batch1a-nb21-prep-20261020/stage2_rain_port_prompt.txt",
    },
    {
        "num": 3,
        "name": "妖櫻山道",
        "slug": "stage3-sakura-pass",
        "theme": "落櫻泥土地表・櫻道石階神社參道・自然過渡",
        "prompt_file": "batch1a-nb21-prep-20261020/stage3_sakura_pass_prompt.txt",
    },
    {
        "num": 4,
        "name": "竹影迷宮",
        "slug": "stage4-bamboo-maze",
        "theme": "竹影青苔石徑・土徑苔地枯竹葉・自然過渡",
        "prompt_file": "batch1a-nb21-prep-20261020/stage4_bamboo_maze_prompt.txt",
    },
    {
        "num": 5,
        "name": "百鬼京都",
        "slug": "stage5-hyakki-kyoto",
        "theme": "古都京都石道・支路土石混合・自然過渡",
        "prompt_file": "batch1a-nb21-prep-20261020/stage5_hyakki_kyoto_prompt.txt",
    },
    {
        "num": 6,
        "name": "雪燈山寺",
        "slug": "stage6-snow-temple",
        "theme": "覆雪石板主地板・積雪步道雪地・自然過渡",
        "prompt_file": "batch1a-nb21-prep-20261020/stage6_snow_temple_prompt.txt",
    },
    {
        "num": 7,
        "name": "幽世渡口",
        "slug": "stage7-spirit-ferry",
        "theme": "潮濕岸地幽冥岸・木棧橋渡口木板・自然過渡",
        "prompt_file": "batch1a-nb21-prep-20261020/stage7_spirit_ferry_prompt.txt",
    },
    {
        "num": 8,
        "name": "黃泉境",
        "slug": "stage8-yomi",
        "theme": "暗紅發光裂紋石地・冥界荒地彼岸花・自然過渡",
        "prompt_file": "batch1a-nb21-prep-20261020/stage8_yomi_prompt.txt",
    },
]


def update_preview():
    html = PREVIEW_HTML_PATH.read_text(encoding="utf-8")
    review_manifest = json.loads(REVIEW_MANIFEST_PATH.read_text(encoding="utf-8"))
    items_by_slug = {it["stage_slug"]: it for it in review_manifest["items"]}

    # 1. Custom CSS
    css_addition = """
        /* Batch 1A A/B Comparison styles */
        .ab-stage-row {
            background: #191520;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            margin-bottom: 24px;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        }
        .ab-stage-header {
            background: #25202d;
            padding: 12px 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            flex-wrap: wrap;
            gap: 8px;
        }
        .ab-stage-title {
            font-size: 16px;
            font-weight: bold;
            color: #fff4dd;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .ab-stage-theme {
            font-size: 12.5px;
            color: var(--text-sub);
        }
        .ab-columns {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            padding: 18px;
        }
        @media (max-width: 900px) {
            .ab-columns { grid-template-columns: 1fr; }
        }
        .ab-card-a {
            background: rgba(28, 24, 36, 0.6);
            border: 1px dashed #7e57c2;
            border-radius: 6px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            min-height: 240px;
            gap: 10px;
        }
        .ab-card-a-icon {
            font-size: 32px;
            margin-bottom: 4px;
        }
        .ab-card-a h4 {
            color: #b39ddb;
            font-size: 15px;
        }
        .ab-card-a p {
            font-size: 12.5px;
            color: #b0bec5;
            line-height: 1.5;
            max-width: 480px;
        }
        .ab-card-b {
            background: rgba(28, 24, 36, 0.85);
            border: 1px solid #3d3545;
            border-radius: 6px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .ab-card-b-thumb {
            position: relative;
            cursor: pointer;
            background: #000;
            overflow: hidden;
            border-bottom: 1px solid #332d3d;
        }
        .ab-card-b-thumb img {
            width: 100%;
            height: auto;
            display: block;
            transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .ab-card-b-thumb:hover img {
            transform: scale(1.015);
            opacity: 0.92;
        }
        .ab-card-b-body {
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 12.5px;
        }
        .ab-badge-a {
            background: rgba(149, 117, 205, 0.2);
            color: #b39ddb;
            border: 1px solid #7e57c2;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
        }
        .ab-badge-b {
            background: rgba(41, 182, 246, 0.2);
            color: #81d4fa;
            border: 1px solid #29b6f6;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
        }
        .ab-meta-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 4px 10px;
            font-size: 12px;
            color: #b5ac9d;
            background: rgba(0,0,0,0.25);
            padding: 8px 12px;
            border-radius: 4px;
            border-left: 3px solid var(--candidate);
            margin: 4px 0;
        }
        .ab-meta-grid code {
            color: #ffd54f;
            font-family: monospace;
            word-break: break-all;
        }
        .ab-links {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 6px;
        }
        .ab-links a {
            color: #81d4fa;
            text-decoration: none;
            font-size: 11.5px;
            padding: 4px 10px;
            border: 1px solid rgba(129,212,250,0.3);
            border-radius: 4px;
            background: rgba(129,212,250,0.05);
            transition: all 0.2s ease;
        }
        .ab-links a:hover {
            background: rgba(129,212,250,0.2);
            border-color: #81d4fa;
            color: #b3e5fc;
        }
"""

    if "/* Batch 1A A/B Comparison styles */" not in html:
        html = html.replace("    </style>", css_addition + "\n    </style>")

    # 2. Add stat to header if not present
    stat_b1a = """            <div class="stat-item">
                <div class="stat-val" style="color:#d4af37;">8/8</div>
                <div class="stat-lbl">Batch 1A B組 (2K三聯已到貨)</div>
            </div>"""
    if "Batch 1A B組" not in html:
        html = html.replace('            <div class="stat-item">\n                <div class="stat-val">7</div>\n                <div class="stat-lbl">涵蓋關卡 (S2~S8)</div>\n            </div>',
                            '            <div class="stat-item">\n                <div class="stat-val">8</div>\n                <div class="stat-lbl">涵蓋關卡 (S1~S8)</div>\n            </div>\n' + stat_b1a)

    # 3. Add link to quick nav bar
    nav_link_b1a = '<a href="#section-batch1a-ab" class="nav-link" style="color:#ffd54f; font-weight:bold; border-color:rgba(212,175,55,0.4);">✨ Batch 1A 地板 A/B 對照</a>\n        '
    if 'href="#section-batch1a-ab"' not in html:
        html = html.replace('<nav class="quick-nav-bar">\n        <span class="nav-label">快速導航：</span>\n        ',
                            '<nav class="quick-nav-bar">\n        <span class="nav-label">快速導航：</span>\n        ' + nav_link_b1a)

    # 4. Build Section HTML
    section_rows = []
    for st in STAGES_INFO:
        slug = st["slug"]
        num = st["num"]
        name = st["name"]
        theme = st["theme"]
        item = items_by_slug.get(slug, {})

        orig_rel = f"{slug}/scene/G_floor_triptych_candidate_nb21_v1.png"
        manifest_rel = f"{slug}/scene/G_floor_triptych_candidate_nb21_v1.json"
        webp_rel = f"batch1a-nb21-review-20261020/thumb_stage{num}_floor_triptych_candidate_nb21_v1.webp"
        png_thumb_rel = f"batch1a-nb21-review-20261020/thumb_stage{num}_floor_triptych_candidate_nb21_v1.png"
        prompt_rel = st["prompt_file"]

        orig_sha = item.get("original_sha256", "UNKNOWN")
        orig_bytes = item.get("original_bytes", 0)
        orig_mb = f"{orig_bytes / 1024 / 1024:.2f} MB" if orig_bytes else "2K"

        row_html = f"""
            <div class="ab-stage-row" id="batch1a-stage{num}">
                <div class="ab-stage-header">
                    <div class="ab-stage-title">
                        <span class="stage-num">Stage {num}</span>
                        <span>{name}</span>
                        <span class="stage-slug">({slug})</span>
                    </div>
                    <div class="ab-stage-theme">構圖主題：{theme}</div>
                </div>
                <div class="ab-columns">
                    <!-- A 組：ChatGPT 第一批概念圖（待專案匯入） -->
                    <div class="ab-card-a">
                        <div class="ab-card-a-icon">📦</div>
                        <span class="ab-badge-a">A 組｜A_SOURCE_PENDING_IMPORT</span>
                        <h4>A 組母版：第一批 ChatGPT 概念三聯</h4>
                        <p>
                            此母版目前僅在先前使用者對話附件、尚未匯入專案檔案庫。<br>
                            <strong>規範保護：</strong>禁止杜撰假路徑、禁止拿舊單體 tile 或淘汰之第二批 4 張圖冒充 A 組。<br>
                            請使用者直接比對先前對話附件之 A 組原稿進行視覺評審。
                        </p>
                    </div>

                    <!-- B 組：Nano Banana 2.1 2K 生成候選 -->
                    <div class="ab-card-b">
                        <div class="ab-card-b-thumb" onclick="openLightboxDirect('{orig_rel}', 'Stage {num}: {name} - G_floor_triptych_candidate_nb21_v1.png (B組 2K)', 'ART_CANDIDATE', 'Nano Banana 2.1 2K (2528×1696) 地板三聯候選圖・WAITING_HUMAN')" title="點擊在燈箱全螢幕檢視 2K 候選原圖 (2528×1696)">
                            <img src="{webp_rel}" alt="Stage {num} {name} B組 地板三聯候選" loading="lazy" onerror="this.src='{png_thumb_rel}'" />
                            <div class="zoom-overlay">🔍 點擊在燈箱全螢幕檢視 2K 原圖 (2528×1696)</div>
                        </div>
                        <div class="ab-card-b-body">
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                                <span class="ab-badge-b">B 組｜ART_CANDIDATE (WAITING_HUMAN)</span>
                                <span style="font-size:11.5px; color:#81d4fa;">模型：gemini-nano-banana-2.1</span>
                            </div>
                            <div class="ab-meta-grid">
                                <div>真實尺寸：</div><div><strong>2528 × 1696 (2K, 3:2)</strong> ({orig_mb})</div>
                                <div>候選檔案：</div><div><code>art/{orig_rel}</code></div>
                                <div>SHA256：</div><div><code>{orig_sha}</code></div>
                                <div>費用預約：</div><div>US$0.0704 (實際帳單：null / unknown)</div>
                                <div>規格提醒：</div><div>橫向三聯材質概念圖（非無縫 tile，待裁切與拼接人審）</div>
                            </div>
                            <div class="ab-links">
                                <a href="{orig_rel}" target="_blank">🖼️ 另開 2K 原圖</a>
                                <a href="{manifest_rel}" target="_blank">📋 Manifest JSON</a>
                                <a href="{prompt_rel}" target="_blank">📝 Prompt 文本</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>"""
        section_rows.append(row_html)

    batch1a_section_html = f"""
        <!-- Batch 1A A/B Comparison Section -->
        <section class="scale-section" id="section-batch1a-ab" style="border-left-color: #d4af37;">
            <h3 style="color: #ffd54f;">
                <span>✨ Batch 1A 地板三聯 A/B 對照檢核看板 (Stage 1～8 八關對照)</span>
                <div>
                    <span class="ab-badge-b" style="margin-right:8px;">8/8 候選到齊</span>
                    <a class="full-link" href="../scratch/batch1a-nb21-paid-20261020/ledger.json" target="_blank">檢視 Paid 帳本 JSON</a>
                </div>
            </h3>
            <p class="scale-subtitle">
                <strong>比對目標：</strong>A 組為使用者滿意之第一批 ChatGPT 概念母版（尚未匯入專案檔案庫，標記 <code>A_SOURCE_PENDING_IMPORT</code>，不可杜撰假路徑、不可拿舊 tile 或淘汰 4 張冒充）；B 組為本次由 <code>gemini-nano-banana-2.1</code> 生成之 2K 3:2 三聯地板概念圖（狀態 <code>ART_CANDIDATE</code> / <code>WAITING_HUMAN</code>，非可直接上線之 512 無縫 tile，原圖保留）。<br>
                <strong>費用執行：</strong>Batch 1A 獨立預算 US$3.00，內部停止線 US$2.40；本次 8 張 2K 累計預約 US$0.5632，實付帳單未知（記 null）。嚴禁挪用 M2-FUSION 預算。
            </p>
            {''.join(section_rows)}
        </section>
"""

    if 'id="section-batch1a-ab"' in html:
        # Replace existing section
        import re
        html = re.sub(r'<!-- Batch 1A A/B Comparison Section -->.*?</section>', batch1a_section_html.strip(), html, flags=re.DOTALL)
    else:
        # Insert before rework comparison
        insert_marker = '        <!-- Stage 3 & 4 Rework Comparison Section -->'
        html = html.replace(insert_marker, batch1a_section_html + "\n" + insert_marker)

    # 5. Add items to LIGHTBOX_ITEMS if not present
    new_lightbox_entries = []
    for st in STAGES_INFO:
        slug = st["slug"]
        num = st["num"]
        name = st["name"]
        theme = st["theme"]
        orig_rel = f"{slug}/scene/G_floor_triptych_candidate_nb21_v1.png"
        new_lightbox_entries.append({
            "src": orig_rel,
            "title": f"Batch 1A B組 Stage {num}: {name} - G_floor_triptych_candidate_nb21_v1.png (2K)",
            "badge": "ART_CANDIDATE (WAITING_HUMAN)",
            "note": f"Nano Banana 2.1 2K (2528×1696) 地板三聯候選圖【{theme}】。非無縫 tile，待裁切與拼接驗收。",
        })

    # Check if first item is already in LIGHTBOX_ITEMS
    if "stage1-night-town/scene/G_floor_triptych_candidate_nb21_v1.png" not in html:
        # Extract existing LIGHTBOX_ITEMS
        import re
        match = re.search(r'const LIGHTBOX_ITEMS = (\[.*?\]);', html, re.DOTALL)
        if match:
            existing_items_json = match.group(1)
            try:
                existing_items = json.loads(existing_items_json)
                updated_items = existing_items + new_lightbox_entries
                new_json_str = json.dumps(updated_items, ensure_ascii=False)
                html = html[:match.start(1)] + new_json_str + html[match.end(1):]
            except Exception as e:
                print(f"[WARN] Failed to parse/update LIGHTBOX_ITEMS json: {e}")

    PREVIEW_HTML_PATH.write_text(html, encoding="utf-8")
    print("art/Preview_index.html updated successfully!")


if __name__ == "__main__":
    update_preview()
