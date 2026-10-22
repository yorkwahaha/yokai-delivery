# Yokai Delivery｜統一生圖 Prompt 模板（版本 A）

版本 1.0｜2026-10-21｜遵守 `docs/ART_STYLE.md`、`docs/ART_STAGES.md`；**此為直接送圖模型的可複製文字，不是付費生成授權。**

## 0. 提交前讀與填變數
每張圖必須填：
- `STAGE`：八關 stageId、名稱、氛圍／主材與副材（見版本 B）
- `TYPE`：G 地板、T 過渡、D 地面貼花、H 建築、O 物件、E 小怪、B Boss、P QA
- `SUBJECT`：**單一**要畫的材質或物件；每張不超量
- `REFERENCE`：已核准／候選比照原圖的實際檔案與 SHA；**沒有來源標 MISSING，不得謊稱已帶圖**
- `LIGHT`、`PALETTE`、`SCALE`、`VIEW`、`OUTPUT`，皆需跟 Stage 對應
- `USER_APPROVED`、`WAITING_HUMAN` 只寫 manifest，不寫入檔名；沒有預算批准只能準備 prompt/dry-run。

**共用 style prefix**（每張 prompt 都要帶，不要只寫在規格外）：

> 2D hand-painted Japanese dark-fantasy game asset for Yokai Delivery. A consistent fusion of expressive sumi-e ink wash and ukiyo-e woodblock print, bold purposeful black ink outlines, visible washi paper grain and woodcut pigment, restrained saturation, painterly broad brushwork, subtle organic asymmetry, coherent scale and lighting across eight stages. Authentic illustration, not 3D, not photograph, not vector/SVG, not UI mockup.

**共用負向約束**：

> No text, captions, logos, border, panels, collage, concept-art poster, photorealism, 3D plastic gloss, thick Western oil painting, vector/SVG icon style, generic cartoon, geometric/procedural tile patterns, repeated identical decals, inconsistent lighting, arbitrary perspective. Do not replace missing artwork with geometric primitives.

## A1｜主地板 G：**平面／正投影，不要烘進攝影機 45°**
```text
Create one standalone hand-painted TOP-DOWN ORTHOGRAPHIC ground material texture for [STAGE] in Yokai Delivery. Subject: [SUBJECT]. Ground lies completely flat on a horizontal world plane; uniform physical scale everywhere; NO vanishing point, NO camera tilt, NO near/far size change, NO simulated isometric camera baked into the image. Flat overhead material view only. Its eventual Hades-like oblique 2.5D view will be applied by the GAME RENDERER (tilt 0.60), not painted here.

Texture: [PALETTE], [LIGHT], [MATERIAL DETAIL]. Compose naturally irregular [stone slabs/wood planks/earth etc] with bold expressive black hand-inked separations, large ink-wash brush patches, paper/woodblock grain and restrained contrast. Do not overemphasize a distinctive isolated hero rock or highlight. Avoid round cobblestones if making Stage2 flat flagstone. Surface illumination should be spatially even with small local weathering only; avoid giant bright/dark masses that repeat as checkerboard.

This is a single source material intended for later offline seam correction and 4–8 variants; DO NOT claim the output is perfectly seamless just because it was requested. Fill edge-to-edge with ground pixels. No buildings, figures, sky, horizon, shoreline wall, props, text, captions, UI, borders or triptych.
[SHARED STYLE PREFIX]
[SHARED NEGATIVE CONSTRAINTS]
```
**QA**：先看整體地面是否真正俯視、石板尺寸一致；再作 offset/互拼實測。不要把暫時漂亮但自帶斜透視的 stone_v3 直接拿來多次平鋪。

## A2｜地板過渡 T：雙材質交界，保持地表平面
```text
Single TOP-DOWN ORTHOGRAPHIC game-ground TRANSITION asset for [STAGE], from [MATERIAL_A] to [MATERIAL_B], transition direction [HORIZONTAL or VERTICAL] defined in world coordinates. Both surfaces have matching physical scale, lighting, washi ink texture and hand-drawn edge treatment. Irregular natural boundary, not a straight vector line, not a hard-edged framed panel. Leave enough area of both materials to blend into their separate neighboring base ground tiles. Overhead flat texture, no camera perspective baked in, no object protruding upward, no characters, no text.
[SHARED STYLE PREFIX]
[SHARED NEGATIVE CONSTRAINTS]
```
**QA**：對兩張 G 母材檢查雙邊和四角相容；記錄 h/v 實際使用方向。

## A3｜地表裝飾 D：俯視透明貼花
```text
One small isolated TOP-DOWN painted ground decal for [STAGE]: [MOSS / WET INK / PUDDLE / PETALS / LEAVES / FISSURE]. True transparent RGBA background, irregular organic silhouette with natural feathered alpha from real painted pixels, visually calm, no built-in scene floor and no white matte. No strong perspective or floating object, no text, no hard rectangular box. Scale to existing Stage ground tiles.
[SHARED STYLE PREFIX]
[SHARED NEGATIVE CONSTRAINTS]
```
**QA**：單件透明、無白暈，貼花稀疏分布；粒子只作輔助。

## A4｜建築 H：統一淺 3/4、單件透明
```text
Create ONE standalone building sprite for [STAGE]: [SUBJECT] in Yokai Delivery. Shallow elevated 3/4 view consistent with the already approved Stage1/Stage2 house camera, readable roof and two adjacent visible facades, uniform physical scale and natural Japanese architecture. It stands upright in world space, NOT an aerial top-down plan and NOT a flat frontal elevation. Do NOT exaggerate perspective with roof shrinking or giant front edge.

Hand-painted sumi-e and ukiyo-e with bold ink lines and washi print grain, [STAGE PALETTE], shared light from [LIGHT DIRECTION]. Isolate the ENTIRE building on real transparent RGBA, ample clean contour; bottom-center foot/ground anchor visible; no terrain tile, no baked large shadow, no character, no label, no panel, no alternate angle sheet.
[SHARED STYLE PREFIX]
[SHARED NEGATIVE CONSTRAINTS]
```
**QA**：α邊緣/接地點/視角/屋頂可讀性/同框比例/可Y-sort，2D與.60 都須驗。

## A5｜立體道具 O：跟建築共享方位
```text
One isolated environmental prop sprite for [STAGE]: [SUBJECT]. Slightly elevated 3/4 camera matching approved house and player sprite orientation; true transparent RGBA; a clear bottom contact point for Y-sorting, natural hand-drawn ink contours and washi woodblock texture. Scale [SIZE RELATIVE TO PLAYER], material [MATERIAL], light [LIGHT]. No ground floor, no extra decoration, no text, no props sheet, no photo/3D/vector style.
[SHARED STYLE PREFIX]
[SHARED NEGATIVE CONSTRAINTS]
```
**注意**：漁港主體不再用不合時宜的石燈籠；地面貼花改用 A3 而非 A5。

## A6｜小怪／Boss E/B（**目前 HOLD，不自動付費**）
```text
Single Japanese yokai character asset, [ENEMY OR BOSS] for [STAGE], with restrained super-deformed proportions about 2.5–3 heads tall, not toddler chibi and not realistic horror. Match approved player character's sumi-e/ukiyo-e strong ink outlines, washi print grain and consistent shallow 3/4 viewing direction. [UNIQUE SILHOUETTE], [ROLE], [ACTION: idle or attack or walk left/right], full body, readable facing and contact point. True transparent RGBA, no floor, no text, no pose grid unless specifically requested, no extra appendages. Keep identity, colors and body proportions consistent between sprite poses.
[SHARED STYLE PREFIX]
[SHARED NEGATIVE CONSTRAINTS]
```
**QA**：先定正確母版，再逐姿態畫，不把歷史場景三聯上的過度Q妖怪當核准角色。

## A7｜操作／儲存規格
1. 優先先做 **單張母圖** 並且人審，再做透視合規／無縫化／4–8 混鋪變體；勿一次批量重做八關全套。
2. 實際生成請附帶已知真參考 image input；`model`、`source SHA`、`prompt id`、`request id`、`output SHA`、實際尺寸、預留/實付費（unknown 記 null）、`review_status` 寫在 `art/sN/manifest.json`。
3. 新候選短檔名，例如 `art/s2/g_stone_01.png`、`art/s2/h_shop_01.png`；同一張 PNG 派生 WebP 可同基名。不要把模型名、日期、候選狀態寫進檔名。
4. 預覽可 `p_stone_3x3.png`、`p_stone_6x6.png`、`p_stone_10x10.png`，但不以任何色差閾值自動 ART_PASS。
5. 沒有獨立新費用批准、原始圖未確定或碰到 runtime owner 時停該條路；本文件**不授權**付費 API、production、git 發布。
