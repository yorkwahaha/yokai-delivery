#!/usr/bin/env python3
"""Stage 2 Rain-Port Nano Banana 2.1 Production Asset Request Builder & Dry-Run Suite.

Prepares:
1. Complete, individual, production-ready prompts with contractual corrections:
   - Floor / Sea textures: 90° orthogonal flat top-down surface (0° tilt), runtime projects tilt .60.
   - Transitions: North Stone / South Wood, depends_on master stone/wood, marked WAITING_BASE_TEXTURES.
   - Buildings / Props: 2.5D tilt .60 upright, solid white matte background with padding margin,
     mandatory offline RGBA matting / edge-alpha QA pipeline.
2. Authoritative request manifest in art/stage2-rain-port/s2-nano-production-requests-20261020/.
3. Zero-cost dry-run validation via tools/nanobanana_generate.py.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON_EXE = Path("I:/Tools/NanoBanana21/.venv/Scripts/python.exe")
GEN_SCRIPT = ROOT / "tools" / "nanobanana_generate.py"
REQ_DIR = ROOT / "art" / "stage2-rain-port" / "s2-nano-production-requests-20261020"
STYLE_REF = "art/stage2-rain-port/scene/G_floor_triptych_candidate_nb21_v1.png"

REQ_DIR.mkdir(parents=True, exist_ok=True)

REQUESTS = [
    # === 1. Required Core Floor Textures (Orthogonal Flat Top-Down, 0° Tilt, Runtime Projects Canvas2D Tilt .60) ===
    {
        "id": "req_01_ground_stone_seamless",
        "name": "主石地真無縫基準地塊 (Ground Stone Seamless Master)",
        "category": "required_core",
        "type": "floor_tile",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "正交頂視平面 (Orthogonal Top-Down Flat Surface, 0° Tilt, 運行時由遊戲引擎執行 Canvas2D tilt .60 投影)",
        "alpha_requirement": "RGB 滿版無縫平鋪 (無透明通道，四邊可平鋪)",
        "foot_anchor": None,
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一張可用於2D/2.5D遊戲地表的正交無縫平鋪（orthogonal seamless tileable texture）雨夜石板路材質。"
            "風格嚴格遵循和風半水墨＋半浮世繪、強墨線勾勒、和紙木版木刻版畫質感。"
            "深青灰與冷調靛藍墨色石材，石板排列緊密自然，表面帶雨後潮濕微光與冷色夜雨水氣反光。"
            "視角為嚴格90度正交頂視垂直俯視平面（flat orthogonal top-down view），無任何斜角傾斜、無梯形透視形變、無地平線，由遊戲運行時進行tilt 0.60傾斜投影。"
            "上下左右四邊邊界紋理完全自然連續可無縫平鋪，滿版材質，單一地表。"
            "嚴禁三聯、嚴禁多格分屏、嚴禁文字、嚴禁標題、嚴禁UI、嚴禁人物、嚴禁怪物、嚴禁建築主體、嚴禁海報邊框。"
        )
    },
    {
        "id": "req_02_ground_stone_var1",
        "name": "石地積水反光無縫變化塊 (Ground Stone Var Puddle)",
        "category": "required_core",
        "type": "floor_tile",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/G_ground_stone_var1_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "正交頂視平面 (Orthogonal Top-Down Flat Surface, 0° Tilt, 運行時由遊戲引擎執行 Canvas2D tilt .60 投影)",
        "alpha_requirement": "RGB 滿版無縫平鋪 (無透明通道，四邊可平鋪)",
        "foot_anchor": None,
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一張與主石板路相同幾何尺度與墨線密度的正交無縫平鋪（orthogonal seamless tileable texture）雨夜石板路變化塊。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版質感。包含中心深色積水反光與青苔墨漬滲透，冷調雨港氛圍。"
            "視角為嚴格90度正交頂視垂直俯視平面（flat orthogonal top-down view），無透視形變與傾角，四邊接縫與主石板路無縫接合。單一地表材質。"
            "嚴禁三聯、嚴禁多屏、嚴禁文字、嚴禁人物、嚴禁建築、嚴禁邊框。"
        )
    },
    {
        "id": "req_03_ground_wood_dock_seamless",
        "name": "木棧道真無縫基準地塊 (Ground Wood Dock Seamless Master)",
        "category": "required_core",
        "type": "floor_tile",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "正交頂視平面 (Orthogonal Top-Down Flat Surface, 0° Tilt, 運行時由遊戲引擎執行 Canvas2D tilt .60 投影)",
        "alpha_requirement": "RGB 滿版無縫平鋪 (無透明通道，四邊可平鋪)",
        "foot_anchor": None,
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一張可用於2D/2.5D遊戲地表的正交無縫平鋪（orthogonal seamless tileable texture）港口浸水木棧道材質。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版版畫質感。深褐風化厚木板水平橫向排列，板面帶濕潤水漬、木紋斑駁與鐵釘孔痕跡。"
            "視角為嚴格90度正交頂視垂直俯視平面（flat orthogonal top-down view），無傾斜透視，左右上下四邊邊界紋理連續可平鋪。單一地表材質。"
            "嚴禁三聯、嚴禁多屏、嚴禁文字、嚴禁人物、嚴禁建築、嚴禁邊框。"
        )
    },
    {
        "id": "req_04_ground_wood_dock_var1",
        "name": "木棧道海鹽風化無縫變化塊 (Ground Wood Dock Var Weathered)",
        "category": "required_core",
        "type": "floor_tile",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/G_ground_wood_dock_var1_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "正交頂視平面 (Orthogonal Top-Down Flat Surface, 0° Tilt, 運行時由遊戲引擎執行 Canvas2D tilt .60 投影)",
        "alpha_requirement": "RGB 滿版無縫平鋪 (無透明通道，四邊可平鋪)",
        "foot_anchor": None,
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一張與木棧道基準相同板寬與接縫尺度的正交無縫平鋪（orthogonal seamless tileable texture）浸水木棧道變化塊。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版質感。帶海鹽風化淺痕與深層潮濕浸水色澤差異。"
            "視角為嚴格90度正交頂視垂直俯視平面（flat orthogonal top-down view），無透視形變，四邊無縫接合。單一地表材質。"
            "嚴禁三聯、嚴禁多屏、嚴禁文字或邊框。"
        )
    },
    {
        "id": "req_05_ground_trans_stone_wood_h",
        "name": "石木水平岸線無縫過渡地塊 (Horizontal Shoreline Transition: North Stone / South Wood)",
        "category": "required_core",
        "type": "floor_transition",
        "status": "WAITING_BASE_TEXTURES",
        "output": "art/stage2-rain-port/scene/G_trans_stone_wood_h_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "正交頂視平面 (Orthogonal Top-Down Flat Surface, 0° Tilt, 運行時由遊戲引擎執行 Canvas2D tilt .60 投影)",
        "alpha_requirement": "RGB 滿版過渡 (橫向連續可平鋪，北緣接石南緣接木)",
        "foot_anchor": None,
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "depends_on": ["req_01_ground_stone_seamless", "req_03_ground_wood_dock_seamless"],
        "future_reference_slots": {
            "north_edge_reference": "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.png",
            "south_edge_reference": "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.png"
        },
        "seam_contract_note": "過渡地塊接縫依賴主石地與主木棧道之真正生成圖，不能僅靠風格三聯承諾精確接邊；主材質生成後方可進行真參考圖對齊",
        "prompt": (
            "一張可用於2D/2.5D遊戲水岸交界的正交水平過渡地表材質（orthogonal seamless horizontal transition tile）。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版質感。上半部（北側）為深青灰濕石板路，下半部（南側）為浸水深褐木棧道，"
            "二者尺度、墨線粗細與紋理密度與主石板及主木棧道完全同尺度一體化；中間為自然的石材砌岸與木質加固岸線銜接，石塊與木板在此自然交會咬合。"
            "視角為嚴格90度正交頂視垂直俯視平面（flat orthogonal top-down view），無斜角透視。左右邊界連續可橫向平鋪（seamless horizontally）。"
            "頂緣（北緣）與主石板路無縫接合，底緣（南緣）與主木棧道無縫接合。嚴禁三聯、嚴禁多屏、嚴禁文字、嚴禁人物或UI。"
        )
    },
    {
        "id": "req_06_ground_trans_stone_wood_v",
        "name": "石木垂直水渠無縫過渡地塊 (Vertical Canal Transition: West Stone / East Wood)",
        "category": "required_core",
        "type": "floor_transition",
        "status": "WAITING_BASE_TEXTURES",
        "output": "art/stage2-rain-port/scene/G_trans_stone_wood_v_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "正交頂視平面 (Orthogonal Top-Down Flat Surface, 0° Tilt, 運行時由遊戲引擎執行 Canvas2D tilt .60 投影)",
        "alpha_requirement": "RGB 滿版過渡 (縱向連續可平鋪，西緣接石東緣接木)",
        "foot_anchor": None,
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "depends_on": ["req_01_ground_stone_seamless", "req_03_ground_wood_dock_seamless"],
        "future_reference_slots": {
            "west_edge_reference": "art/stage2-rain-port/scene/G_ground_stone_nano_nb21_v1.png",
            "east_edge_reference": "art/stage2-rain-port/scene/G_ground_wood_dock_nano_nb21_v1.png"
        },
        "seam_contract_note": "過渡地塊接縫依賴主石地與主木棧道之真正生成圖，不能僅靠風格三聯承諾精確接邊；主材質生成後方可進行真參考圖對齊",
        "prompt": (
            "一張可用於2D/2.5D遊戲水渠交界的正交縱向過渡地表材質（orthogonal seamless vertical transition tile）。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版質感。左側（西側）為深青灰濕石板路，右側（東側）為浸水深褐木棧道，"
            "二者尺度與主石板及主木棧道完全同尺度；中間為縱向延伸的木樁砌石駁岸過渡。"
            "視角為嚴格90度正交頂視垂直俯視平面（flat orthogonal top-down view），無斜角透視。上下邊界連續可縱向平鋪（seamless vertically）。"
            "左緣與主石板路接合，右緣與主木棧道接合。嚴禁三聯、嚴禁多屏、嚴禁文字或人物。"
        )
    },

    # === 2. Required Core Standalone Buildings (2.5D Tilt 0.60 Upright, Solid White Matte, Offline RGBA Matting) ===
    {
        "id": "req_07_building_port_warehouse",
        "name": "港口風化大倉庫 (Port Weathered Warehouse)",
        "category": "required_core",
        "type": "building",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/H_port_warehouse_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright (直立Y排序，底邊中心接地腳點 footAnchor)",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；Raw輸出為RGB/JPEG，必須經離線RGBA去背與Edge-Alpha QA方為正式透明資產",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一座獨立單體和風雨港風化大倉庫（isolated standalone harbor warehouse）。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版版畫質感。雙層斜頂木造倉庫，深青墨色瓦當大屋頂，"
            "雨淋風化深褐木板牆面，大木門與懸吊麻繩滑輪，屋簷低垂。視角為2.5D斜俯視（tilt 0.60透視，底邊中心為接地腳點）。"
            "單一純白去背啞光背景（solid white matte background for chroma/segmentation keying），建築主體四周保留完整均勻邊距留白（padding margin），"
            "建築物輪廓完整無裁切、邊界無溢出，無任何地面影子或地表雜物，單一獨立建築主體。"
            "嚴禁三聯、嚴禁拼貼板面、嚴禁背景雜物、嚴禁文字、嚴禁人物。"
        )
    },
    {
        "id": "req_08_building_fish_workshop",
        "name": "港町海產魚行魚舖 (Port Fishmonger Workshop)",
        "category": "required_core",
        "type": "building",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/H_fishmonger_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright (直立Y排序，底邊中心接地腳點 footAnchor)",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；Raw輸出為RGB/JPEG，必須經離線RGBA去背與Edge-Alpha QA方為正式透明資產",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一座獨立單體和風碼頭海產魚行魚舖（isolated standalone fishmonger workshop）。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版版畫質感。前沿開放式木造店面，木瓦屋頂，懸掛魚乾木架，"
            "門前擺放竹簍與木桶，深藍染織布暖簾。視角為2.5D斜俯視（tilt 0.60，底邊中心為接地腳點）。"
            "單一純白去背啞光背景（solid white matte background for chroma/segmentation keying），建築主體四周保留完整均勻邊距留白（padding margin），"
            "建築輪廓完整無切邊、周圍完全留白無地面與雜物，單一獨立主體。"
            "嚴禁三聯、嚴禁拼貼、嚴禁文字或人物。"
        )
    },
    {
        "id": "req_09_building_port_tavern",
        "name": "港町海潮居酒屋酒肆 (Port Sailors' Tavern)",
        "category": "required_core",
        "type": "building",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/H_port_tavern_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright (直立Y排序，底邊中心接地腳點 footAnchor)",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；Raw輸出為RGB/JPEG，必須經離線RGBA去背與Edge-Alpha QA方為正式透明資產",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一座獨立單體和風港町海潮居酒屋酒肆（isolated standalone port tavern）。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版質感。雙層和風木造酒館，深色松木立柱，"
            "屋簷下懸掛圓形杉玉草球與暖色紅紙燈籠，和風格子推拉門。視角為2.5D斜俯視（tilt 0.60，底邊接地腳點）。"
            "單一純白去背啞光背景（solid white matte background for chroma/segmentation keying），建築主體四周保留完整均勻邊距留白（padding margin），"
            "輪廓完整無裁切，無地面影子與雜物，單一獨立主體。"
            "嚴禁三聯、嚴禁文字、嚴禁人物。"
        )
    },
    {
        "id": "req_10_building_wharf_shop",
        "name": "碼頭乾貨雜糧商屋 (Wharf Merchant Shop)",
        "category": "required_core",
        "type": "building",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/H_wharf_shop_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright (直立Y排序，底邊中心接地腳點 footAnchor)",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；Raw輸出為RGB/JPEG，必須經離線RGBA去背與Edge-Alpha QA方為正式透明資產",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一座獨立單體和風碼頭乾貨雜糧商屋（isolated standalone merchant wharf shop）。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版質感。港町老字號町屋商號，重簷青瓦，木造格子窗，"
            "門楣掛深灰麻布暖簾，木箱貨物靠牆。視角為2.5D斜俯視（tilt 0.60，底邊接地）。"
            "單一純白去背啞光背景（solid white matte background for chroma/segmentation keying），建築主體四周保留完整均勻邊距留白（padding margin），"
            "輪廓完整無裁切無溢出，周圍完全留白無地面，單一獨立主體。"
            "嚴禁三聯、嚴禁文字、嚴禁人物。"
        )
    },
    {
        "id": "req_11_building_port_teahouse",
        "name": "港町泊船番所茶屋 (Port Guardhouse & Teahouse)",
        "category": "required_core",
        "type": "building",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/H_port_teahouse_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright (直立Y排序，底邊中心接地腳點 footAnchor)",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；Raw輸出為RGB/JPEG，必須經離線RGBA去背與Edge-Alpha QA方為正式透明資產",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一座獨立單體和風港町泊船番所茶屋（isolated standalone port teahouse / guardhouse）。"
            "風格為和風半水墨＋半浮世繪、強墨線、和紙木版質感。高挑飛簷歇山頂，和風木柱回廊，"
            "門前設有迎客哨所與茶水木座，深青瓦頂。視角為2.5D斜俯視（tilt 0.60，底邊接地）。"
            "單一純白去背啞光背景（solid white matte background for chroma/segmentation keying），建築主體四周保留完整均勻邊距留白（padding margin），"
            "輪廓完整無裁切，周圍完全留白無地面雜物，單一獨立主體。"
            "嚴禁三聯、嚴禁文字、嚴禁人物。"
        )
    },

    # === 3. Required Core Environmental Surfaces (Sea: Orthogonal Flat / Cliff: Upright 2.5D) ===
    {
        "id": "req_12_sea_surface_seamless",
        "name": "港口深水海面無縫材質 (Harbor Sea Surface Seamless)",
        "category": "required_core",
        "type": "environment_surface",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/G_port_sea_surface_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "正交頂視平面 (Orthogonal Top-Down Flat Surface, 0° Tilt, 運行時由遊戲引擎執行投影)",
        "alpha_requirement": "RGB 滿版無縫平鋪",
        "foot_anchor": None,
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一張可用於2D遊戲下沿海面的正交無縫平鋪（orthogonal seamless tileable ocean surface）港口深水海面。"
            "風格為和風半水墨＋浮世繪波浪紋理、強墨線波浪水紋、和紙質感。夜色深青黑海面，帶微泛月光與波浪白沫。"
            "視角為嚴格90度正交頂視垂直俯視平面（flat orthogonal top-down view），無地平線傾角，四邊無縫。"
            "嚴禁文字、嚴禁船隻、嚴禁人物。"
        )
    },
    {
        "id": "req_13_cliff_north_rock",
        "name": "北側礁石海蝕斷崖 (North Harbor Sea Cliff)",
        "category": "required_core",
        "type": "environment_prop",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/O_port_north_cliff_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright (直立Y排序，底邊中心接地)",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；必須經離線RGBA去背與Edge-Alpha QA方為正式透明資產",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一座獨立單體和風港口北側礁石斷崖岩壁（isolated standalone sea cliff rocks）。"
            "風格為和風半水墨＋半浮世繪、斧劈皴墨線、和紙木版質感。黑灰色嶙峋海蝕礁石岩壁，下緣帶海浪拍打碎沫。"
            "視角為2.5D斜俯視（tilt 0.60）。"
            "單一純白去背啞光背景（solid white matte background for chroma keying），主體四周保留完整邊距留白（padding margin），無裁切無溢出，單一岩石主體。"
            "嚴禁文字、嚴禁人物。"
        )
    },

    # === 4. Optional Variety Harbor Props (Only If Authorized, Upright 2.5D, Solid White Matte) ===
    {
        "id": "req_14_prop_anchor_gear",
        "name": "港口鐵錨與絞盤齒輪 (Anchor & Winch Gear)",
        "category": "optional_variety",
        "type": "prop",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/O_prop_anchor_gear_nano_nb21_v1.png",
        "size": "1K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；必須經離線RGBA去背與Edge-Alpha QA",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0336,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0536,
        "prompt": (
            "一個獨立單體和風港口生鏽鐵錨與絞盤齒輪（isolated standalone anchor and winch gear）。"
            "半水墨＋浮世繪、強墨線、視角為2.5D斜俯視tilt 0.60。"
            "單一純白去背啞光背景（solid white matte background for keying），道具四周保留完整邊距留白（padding margin），輪廓完整無裁切、無背景雜物，單一獨立道具主體。"
            "嚴禁文字、嚴禁人物。"
        )
    },
    {
        "id": "req_15_prop_cargo_crates",
        "name": "碼頭堆疊貨物木箱 (Cargo Crates Pile)",
        "category": "optional_variety",
        "type": "prop",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/O_prop_cargo_crates_nano_nb21_v1.png",
        "size": "1K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；必須經離線RGBA去背與Edge-Alpha QA",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0336,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0536,
        "prompt": (
            "一堆獨立單體和風碼頭堆疊貨物木箱（isolated standalone cargo crates pile）。"
            "半水墨＋浮世繪、強墨線、麻繩捆綁、斜俯視tilt 0.60。"
            "單一純白去背啞光背景（solid white matte background for keying），道具四周保留完整邊距留白（padding margin），輪廓完整無裁切，單一獨立道具主體。"
            "嚴禁文字、嚴禁人物。"
        )
    },
    {
        "id": "req_16_prop_mooring_post",
        "name": "港埠繫船木樁 (Mooring Post with Rope)",
        "category": "optional_variety",
        "type": "prop",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/O_prop_mooring_post_nano_nb21_v1.png",
        "size": "1K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；必須經離線RGBA去背與Edge-Alpha QA",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0336,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0536,
        "prompt": (
            "一個獨立單體和風港埠繫船木樁（isolated standalone mooring post with rope）。"
            "半水墨＋浮世繪、強墨線、斜俯視tilt 0.60。"
            "單一純白去背啞光背景（solid white matte background for keying），四周保留完整邊距留白（padding margin），輪廓完整無裁切，單一獨立道具主體。"
            "嚴禁文字、嚴禁人物。"
        )
    },
    {
        "id": "req_17_prop_port_boat",
        "name": "港口繫泊木舟 (Moored Harbor Boat)",
        "category": "optional_variety",
        "type": "prop",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/O_prop_port_boat_nano_nb21_v1.png",
        "size": "2K",
        "aspect_ratio": "3:2",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；必須經離線RGBA去背與Edge-Alpha QA",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0504,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0704,
        "prompt": (
            "一艘獨立單體和風繫泊木舟（isolated standalone wooden harbor boat）。"
            "半水墨＋浮世繪、強墨線、帶木櫓與空艙、斜俯視tilt 0.60。"
            "單一純白去背啞光背景（solid white matte background for keying），舟體四周保留完整邊距留白（padding margin），輪廓完整無裁切，單一獨立道具主體。"
            "嚴禁文字、嚴禁人物。"
        )
    },
    {
        "id": "req_18_prop_port_lighthouse",
        "name": "港口常夜石燈台 (Port Beacon Stone Lighthouse)",
        "category": "optional_variety",
        "type": "prop",
        "status": "READY_FOR_BUDGET_DRY_RUN_PASSED",
        "output": "art/stage2-rain-port/scene/O_prop_port_lighthouse_nano_nb21_v1.png",
        "size": "1K",
        "aspect_ratio": "1:1",
        "perspective": "2.5D 斜俯視 Tilt 0.60 Upright",
        "alpha_requirement": "單一純白啞光Matte背景 (Solid White Matte)；必須經離線RGBA去背與Edge-Alpha QA",
        "offline_matting_required": True,
        "post_process_pipeline": ["nano_banana_raw_rgb_generation", "offline_rgba_matting_despill", "edge_alpha_qa_and_foot_anchor_calibration"],
        "foot_anchor": {"x_ratio": 0.5, "y_ratio": 1.0},
        "style_reference": STYLE_REF,
        "base_cost_usd": 0.0336,
        "input_reserve_usd": 0.02,
        "estimated_cost_usd": 0.0536,
        "prompt": (
            "一座獨立單體和風港口常夜石燈台（isolated standalone stone beacon lighthouse）。"
            "半水墨＋浮世繪、強墨線、石質燈柱與微光石燈籠、斜俯視tilt 0.60。"
            "單一純白去背啞光背景（solid white matte background for keying），燈台四周保留完整邊距留白（padding margin），輪廓完整無裁切，單一獨立道具主體。"
            "嚴禁文字、嚴禁人物。"
        )
    }
]


def build_prompt_files():
    print(f"=== Writing Individual Prompt Files to {REQ_DIR} ===")
    for req in REQUESTS:
        prompt_file = REQ_DIR / f"{req['id']}.txt"
        prompt_file.write_text(req["prompt"].strip(), encoding="utf-8")
        req["prompt_file"] = str(prompt_file.relative_to(ROOT)).replace("\\", "/")
        req["prompt_sha256"] = hashlib.sha256(req["prompt"].strip().encode("utf-8")).hexdigest()
        print(f"  Prompt written: {req['id']} ({len(req['prompt'])} chars) -> {prompt_file.name}")


def run_dry_runs():
    print(f"\n=== Executing Controlled Zero-Cost Dry-Runs via {GEN_SCRIPT.name} ===")
    dry_run_results = []
    required_cost = 0.0
    optional_cost = 0.0

    for req in REQUESTS:
        prompt_file = ROOT / req["prompt_file"]
        cmd = [
            str(PYTHON_EXE),
            str(GEN_SCRIPT),
            "--prompt-file", str(prompt_file),
            "--output", req["output"],
            "--size", req["size"],
            "--aspect-ratio", req["aspect_ratio"],
            "--reference", req["style_reference"],
        ]
        # Pure dry run! NO --execute, NO NANOBANANA_APPROVED!
        res = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
        if res.returncode != 0:
            print(f"  FAILED dry-run for {req['id']}: code {res.returncode}")
            print(f"  Stderr: {res.stderr}")
            sys.exit(1)

        payload = json.loads(res.stdout)
        dry_run_status = (
            "WAITING_BASE_TEXTURES (Dry-run path/param validated)"
            if req.get("status") == "WAITING_BASE_TEXTURES"
            else "DRY_RUN_PASSED_WAITING_BUDGET"
        )
        dry_run_results.append({
            "request_id": req["id"],
            "category": req["category"],
            "prompt_file": req["prompt_file"],
            "prompt_sha256": req["prompt_sha256"],
            "exit_code": res.returncode,
            "status": dry_run_status,
            "bridge_payload": payload,
        })
        if req["category"] == "required_core":
            required_cost += req["estimated_cost_usd"]
        else:
            optional_cost += req["estimated_cost_usd"]
        print(f"  Dry-run PASS: {req['id']:<35} | Exit: 0 | SHA: {req['prompt_sha256'][:8]}... | Status: {dry_run_status}")

    dry_run_summary_path = REQ_DIR / "dry_run_results.json"
    dry_run_summary_path.write_text(json.dumps(dry_run_results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nDry-run results written to {dry_run_summary_path}")

    return {
        "required_core_items_count": len([r for r in REQUESTS if r["category"] == "required_core"]),
        "required_core_estimate_total_usd": round(required_cost, 4),
        "optional_variety_items_count": len([r for r in REQUESTS if r["category"] == "optional_variety"]),
        "optional_variety_estimate_total_usd": round(optional_cost, 4),
        "total_items_count": len(REQUESTS),
        "grand_total_estimate_usd": round(required_cost + optional_cost, 4),
        "actual_billed_usd": None
    }


def build_manifest(cost_summary):
    manifest = {
        "schema_version": "1.1.0",
        "stage_id": "rain-port",
        "stage_name": "雨夜港町",
        "purpose": "S2 全新正式美術素材 Nano Banana 2.1 生圖請求名單 (契約校正版：正交平面地板／單一Matte留邊建築去背／過渡依賴契約)",
        "status": "S2_NANO_ART_WAITING_BUDGET",
        "authorization_state": "UNAUTHORIZED_NO_API_CALLS_MADE",
        "actual_cost_usd": None,
        "floor_perspective_contract": "正式地表與海面採 90° 正交頂視平面輸出 (0° Tilt)，不得預烘 Canvas tilt .60 或地平線透視，由遊戲運行時進行投影；建築與道具則維持一致之 2.5D 斜俯視 Upright。",
        "matting_contract_warning": "Nano Banana bridge 當前 image/jpeg / raw RGB 無法保證真 alpha 通道。所有建築與道具生圖請求皆指定單一純白 Matte 背景與邊距留白，嚴禁將 raw RGB 直接當作透明正式圖；真 RGBA 去背與 Edge-Alpha QA 列為離線必要後製步驟。",
        "transition_dependency_contract": "石木過渡地塊標註 WAITING_BASE_TEXTURES，其邊界接縫依賴主石地與主木棧道之真正生成圖，不得僅憑風格三聯承諾接邊；主材質生成後方可進行真參考圖對齊。",
        "style_master_reference": {
            "path": STYLE_REF,
            "status": "STYLE_REFERENCE_ONLY_NOT_A_TILE",
            "note": "Batch1A S2 地板三聯候選圖，僅供畫風與氛圍對齊參考，絕不可直接裁切冒充地塊"
        },
        "cost_summary": cost_summary,
        "requests": REQUESTS
    }
    manifest_path = REQ_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nAuthoritative requests manifest written to {manifest_path}")


def main():
    build_prompt_files()
    cost_summary = run_dry_runs()
    build_manifest(cost_summary)
    print("\n=== S2 Nano Production Requests & Dry-Runs Complete ===")


if __name__ == "__main__":
    main()
