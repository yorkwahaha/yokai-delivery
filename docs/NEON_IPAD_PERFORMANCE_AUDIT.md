# Yokai Delivery — iPad Safari 效能瓶頸獨立審查報告

- **審查日期**：2026-11-24
- **專案根目錄**：`I:\Projects\yokai-delivery`
- **審查基準**：Git HEAD `704cf72`（`fix(ipad): bound card bitmaps and restore lost terrain canvas`）及現行未提交工作樹（包含 `js/fx.js` 2026-11-23 `ImageBitmap` 粒子候選、`js/port-performance.js`、`js/renderer.js`、`js/game.js`、`js/game-weather.js`、`js/skillfx.js` 等未提交改動）
- **目標裝置與效能目標**：iPad Air 11-inch (M4)，Safari；在不犧牲和紙／半水墨／浮世繪畫風、技能演出與遊戲玩法的前提下，穩定維持 **≥ 45 FPS**，理想目標 **60 FPS**，並消除畫面閃爍與背景消失異常。

> **證據邊界聲明**
> 1. 本文所有「iPad 實機數據」皆引自專案現存機台回傳紀錄（[`docs/RAIN_PORT_IPAD_PERFORMANCE_20261122.md`](../docs/RAIN_PORT_IPAD_PERFORMANCE_20261122.md)）。
> 2. 本輪新增的獨立基準測試（Canvas 2D API 單幀盤點、記憶體審計、純模擬 `update(dt)` 隔離、渲染隔離矩陣、20 秒走動 Soak 與 `measure-port-performance.cjs` 基準）皆於 **Windows Headless Chromium 156（Playwright + SwiftShader 軟體光柵化）** 上執行。
> 3. 桌面／軟體光柵化數據僅用於隔離 CPU 模擬耗時、量化 Canvas 2D 指令次數／狀態切換與像素填充趨勢，**不可也不得宣稱為 iPad 實機驗收結果**；所有涉及 WebKit／Metal／CoreAnimation 行為但尚未於真機單獨切換開關驗證之推論，均明確標註為「合理推測」或「尚待實機驗證」。

---

## 一、效能瓶頸總結及根因排序

### 核心結論

**JavaScript 遊戲邏輯與物理模擬（`update(dt)`）絕非本專案的效能瓶頸。**
在 Windows Chromium V8 上實測，即使同時開啟 **60 隻怪物＋1 隻雨港 Boss＋512 顆未吸收靈玉＋8 招全滿 Lv5 主動技能**，純模擬 `update(1/60)` 平均僅耗時 **0.359 ms**（P50 **0.3 ms**、P95 **0.9 ms**）；在 iPad Air M4 Safari 實機第 744～824 秒掉幀視窗中，整個 JS rAF callback（模擬＋所有 Canvas API 呼叫）P50 亦僅 **4～6 ms**，而 **真正吞噬每幀時間的是 `outsideCallbackMs`（22～29 ms）**——也就是 **WebKit GPU Process 的 Canvas 2D 指令重播、未加速表面上傳、全畫布／局部高斯模糊、大量混色切換與合成層記憶體壓力**。

這也解釋了一個看似矛盾的現象：**為何「站在原地」與「後期戰鬥」皆掉幀，且即便隔離空中粒子後（`P` 模式），iPad 實機的 `outsideCallbackMs` 仍高居 15～16 ms？** 本次獨立審查發現了先前回報未觸及的結構性問題：除了已知的空中粒子外，**後期 HUD 每幀高達 50 次 `shadowBlur` 高斯模糊 Pass**、**大量小於 WebKit GPU 加速門檻（128×129）的未加速離屏畫布**、**每幀 284 次混色狀態切換**，以及 **239.8 MiB 基礎已解碼影像（含多份重複 1254×1254 圖資）＋ 5.39M px `terrainCv` 每秒 2.3～3.2 次自我複製（self-blit）**，共同構成了 iPad Safari 的 FPS 天花板與背景消失根因。

### 根因排序總覽

| 優先級 | 問題根因 | 實證嚴重度與影響 | 先前審查是否涵蓋 |
| :---: | :--- | :--- | :--- |
| **P0** | **空中粒子管線三重病理**：`<128×129` 未加速離屏畫布 ＋ 每幀 **150～262 次** `source-over ↔ lighter` 混色切換 ＋ 2026-11-23 `ImageBitmap` 補丁僅限 `rain-port` 且存 WebKit IPC 風險 | iPad 實機第 763s：關閉空中粒子貼圖後 **35.6–37.8 → 55.2–58.1 FPS**（`outsideCallbackMs` 22–24 → 15–16 ms） | 部分涵蓋（僅算貼圖數與面積，**遺漏加速面積門檻與 262 次混色切換**） |
| **P0** | **後期 HUD 與 Boss 每幀 50–54 次 `shadowBlur` 高斯模糊 ＋ 17 次 `matchMedia` ＋ 54–105 次 `strokeText`** | 單幀實測 **54 次 `shadowDraws`**（**UI 佔 50 次**）；解釋為何「前期 ~57 FPS、後期（滿被動/御守/Boss/委託）大幅掉幀」及 `P` 模式 `outsideCallbackMs` 仍達 15–16 ms | **完全遺漏** |
| **P0** | **圖形記憶體逼近 iPadOS 上限（總計 ~350–400+ MiB）＋ 5.39M px `terrainCv` 過大與頻繁自我複製 ＋ 靜默驅逐無感測** | 實測雨港進關即駐留 **239.80 MiB** 影像＋**29.53 MiB** 畫布（含重複解碼與 31.7 MiB 世界地圖）；走動每秒觸發 2.3–3.2 次 `21.5 MiB` `terrainCv` self-blit；直接造成「畫面閃爍後背景消失」 | 部分涵蓋（僅做卡圖 LRU 與 `contextlost` 監聽，**未發現重複解碼、5.39M px 過採樣與前景靜默驅逐盲區**） |
| **P1** | **512 顆靈玉狀態風暴**：1,024 次未加速 96×96 `drawImage` ＋ 1,024 次 `save/restore` ＋ 512 次 `upright()` 閉包與逐顆 `globalAlpha` 變更 | 實機 819s（512 顆）33 FPS；Chromium 0→512 顆使 `save` 151→1,175、`drawImage(Canvas)` 14→1,038，耗時 +32.96 ms | 部分涵蓋（已裁透明框，**未解狀態切換、未加速小畫布與閉包問題**） |
| **P1** | **雨港多重全螢幕 Overdraw（7×–9×）＋ 逐筆雨絲描線 ＋ Boss 水柱／潮扇／海嘯濾鏡與即時遮罩尖峰** | 主畫布 2.07M px 上疊加地面 2.16M＋Lv5 靈陣雙圖 2.95M＋光罩 2.07M＋粒子 3.49M＋512 靈玉 2.78M＋霧與雨；Boss 施法期間額外觸發 `tideCrestMask` 重繪、3 層 1254×1254 水柱與 `shadowBlur=14`+`ctx.filter` | 部分涵蓋（已隔離靈陣面積，**未處理光罩冗餘、雨絲合批與 Boss 尖峰**） |
| **P1** | **`G 75%` 降解析度在 iPad M4 反而暴跌（32→19 FPS）** | 與 SwiftShader（228→139→80 ms）完全相反；疑似 `imageSmoothingQuality="medium"` 全面落入非整數取樣、雙重 `cv.width/height` 重設與 CoreAnimation 合成退化 | 已知現象但**尚未歸因與建立隔離測試** |
| **P2** | **高頻每幀短命陣列／閉包配置與逐幀 `ctx.filter`** | `actors` 每幀建 ~12 個陣列並 `.sort()`、多處 `.filter()` 重建陣列、非冰靈針逐幀開關 `ctx.filter`、`__s2HouseMap` 無上限累積 | 僅部分標註 |

---

## 二、具體檔案、函式、行號及呼叫鏈

### 2.1 遊戲主迴圈與渲染呼叫鏈

```
requestAnimationFrame(frame)                                [js/game.js:7793, 8480]
 └─ runFrame(now)                                           [js/game.js:7860]
     ├─ menuButtons()                                       [js/game.js:7861]
     ├─ VIEWPORT.advanceTilt(dt)                            [js/game.js:7870 -> js/viewport.js:52]
     ├─ RENDERER.updateEffects(dt)                          [js/game.js:7898 -> js/renderer.js:397]
     │   └─ dmgNumbers/ghostTrails/slashArcs .filter()      [js/renderer.js:427, 430, 433]
     ├─ update(stepDt, hitStopped)  (至多 4 次 50ms substep) [js/game.js:7921 -> 4749]
     │   ├─ FX.update(dt)                                   [js/game.js:4866 -> js/fx.js:346] (swap-and-pop 打亂混色)
     │   ├─ SKILLFX.update(dt)                              [js/game.js:4867]
     │   ├─ syncWorld() -> WORLD_STATE.update()             [js/game.js:4910 -> 597 -> js/world.js:527]
     │   ├─ weapons(dt)                                     [js/game.js:4958 -> 3038]
     │   ├─ enemies loop + blocked()                        [js/game.js:5032-5322, 198]
     │   └─ gems loop + gems.filter(g => !g.done)           [js/game.js:5509-5524]
     ├─ drawWorld()                                         [js/game.js:8044 -> 6256]
     │   ├─ Pass 1: RENDERER.drawGround()                   [js/game.js:6309 -> js/renderer.js:1912]
     │   │   ├─ drawGroundBase()                            [js/renderer.js:1754]
     │   │   │   ├─ getTerrainContext()                     [js/renderer.js:185]
     │   │   │   ├─ blitTerrain(c, dx, dy)  <-- self-blit   [js/renderer.js:1867 -> 206]
     │   │   │   ├─ paintTerrainRegion()                    [js/renderer.js:1688]
     │   │   │   └─ blitTerrain(ctx, t.left, t.top, ...)    [js/renderer.js:1907 -> 206]
     │   │   └─ drawPortSceneLayers() -> drawS2BuildingsAndProps() [js/renderer.js:1402 -> 1315]
     │   ├─ Pass 2: 地面雨滴水花 (14*strength drawImage)    [js/game.js:6311-6330]
     │   │          drawGroundParallax()                    [js/game.js:6337 -> js/renderer.js:3178]
     │   │          GAME_WEATHER.drawStageWeather()         [js/game.js:6342 -> js/game-weather.js:49]
     │   ├─ Pass 3: 靈玉 (最多 512 顆 × 2 draw + upright)   [js/game.js:6469-6474]
     │   │          RENDERER.drawGemShadow()                [js/renderer.js:2851 -> 2794]
     │   │          VIEWPORT.upright() -> drawSpiritGem()   [js/viewport.js:143 -> js/renderer.js:2863]
     │   ├─ Pass 4: 地面技能與 Boss 危險區
     │   │   ├─ sanctuaryFloor (barrier_core_lv5 1024²)    [js/game.js:6483-6594]
     │   │   ├─ FX.drawGround()                             [js/game.js:6597 -> js/fx.js:441]
     │   │   ├─ inkTrail.paint() / sealNail.paint()         [js/game.js:6602-6603]
     │   │   ├─ SKILLFX.drawArtFx(ctx, true)                [js/game.js:6641 -> js/skillfx.js:161]
     │   │   └─ drawBossHazard()                            [js/game.js:6660 -> js/renderer.js:3524,3699,3805,4157]
     │   ├─ Pass 5: Y-Sort 角色與建築
     │   │   ├─ 建立 actors 複合陣列 + actors.sort()        [js/game.js:6702-6727]
     │   │   ├─ drawHouse()                                 [js/game.js:6740 -> js/renderer.js:2059]
     │   │   ├─ drawMonster() / drawStage2Actor()           [js/game.js:6746 -> js/renderer.js:2574, 2448]
     │   │   └─ drawPlayer()                                [js/game.js:6796 -> js/renderer.js:2244]
     │   ├─ Pass 6: 投射物 / 靈針(ctx.filter) / 委託氣泡    [js/game.js:6805-7027]
     │   ├─ Pass 7: RENDERER.renderLighting() (lightCv)     [js/game.js:7033 -> js/renderer.js:2881]
     │   ├─ Pass 8: 發光前景
     │   │   ├─ FX.draw() -> drawLayer(false) -> paint()    [js/game.js:7040 -> js/fx.js:445 -> 421 -> 379]
     │   │   ├─ SKILLFX.drawArtFx(ctx, false)               [js/game.js:7042 -> js/skillfx.js:161]
     │   │   ├─ YOKAI_SANCTUARY_ARC.draw() (shadowBlur=17)  [js/game.js:6276 -> js/game-sanctuary-arc.js:6]
     │   │   ├─ drawPortTsunamiCrest() (tideCrestMask)      [js/game.js:7085 -> js/renderer.js:3628]
     │   │   └─ drawPortBossTelegraphOverlay() (shadow+flt) [js/game.js:7087 -> js/renderer.js:3568]
     │   └─ Pass 9: 中景霧 / 大氣雨絲 / 傷害數字 (max 96)   [js/game.js:7127-7209 -> js/renderer.js:3204,3301,3236,2983]
     └─ UI 疊層                                             [js/game.js:8065-8144]
         ├─ UI.drawHud() -> drawHudBase()                   [js/ui.js:3257 -> 2778]
         │   ├─ drawDiegeticOilLantern()                    [js/ui.js:2799 -> 1549]
         │   ├─ drawDiegeticMinimap() + glow()              [js/ui.js:2857 -> 2067]
         │   ├─ drawOrderList() (shadowBlur=6)              [js/ui.js:2894 -> 2675]
         │   ├─ drawDiegeticSkillFan() (shadowBlur=4..12)   [js/ui.js:3054 -> 2433 -> 2497]
         │   └─ passive pips loop (最多 28x shadowBlur=4)   [js/ui.js:3107-3134]
         ├─ UI.drawCharmHud() (至多 12x shadowBlur=4..7)    [js/game.js:8113 -> js/ui.js:1760]
         └─ UI.drawBossQuiz() -> drawBossBar() (shadowBlur) [js/game.js:8142 -> js/ui.js:4421 -> 2702]
```

### 2.2 圖片與資產重複載入呼叫鏈

```
start("rain-port") -> loadStageAssets("rain-port")          [js/assets.js:2839]
 ├─ loadBossHazardArt()                                     [js/assets.js:2850 -> 2518]
 │   └─ 依 BOSS_HAZARD_ART_DEFS 建立 6 個 Image (含重複 tide/tidalFan) [2440-2497]
 ├─ loadS2ArtProdAssets()                                   [js/assets.js:2992 -> 291]
 │   └─ 讀 runtime-art-manifest.json，不帶 ?v= 載入 tiles/buildings/props [391-528]
 └─ refreshPortArt()                                        [js/assets.js:2994 -> 2690]
     ├─ loadPortSprites(portCatalog())                      [js/assets.js:2601]
     │   ├─ 帶 ?v=20261101-s2-stone1 再次請求同一批 1254² 石/木圖 [2687]
     │   └─ transH / transV / stoneWoodV2 三鍵指向同一 WebP 分別解碼 [2565-2567]
     └─ loadPortEnemies()                                   [js/assets.js:2657]
```

---

## 三、每項問題的程式證據與測試數據

### 3.1 iPad Air M4 Safari 實機數據總表（既有回傳資料彙整）

以下為使用者實機 iPad Air 11-inch (M4) Safari 於 `rain-port` 錄得之真實數據（來源：[`docs/RAIN_PORT_IPAD_PERFORMANCE_20261122.md`](../docs/RAIN_PORT_IPAD_PERFORMANCE_20261122.md)）：

| 實機情境／時間點 | 條件 | rAF FPS | rAF P95 | JS callback P50 | 回呼外 `outsideCallbackMs` P50 | 場景狀態與關鍵備註 |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| 前期（約第 3 分鐘） | H 完整畫質 | 中位 **57.4** | — | — | — | 前期怪物、靈玉、被動與粒子皆少 |
| 466 秒定格 | A 完整 / B 隔靈陣 / G 75% / 回 A | 52–53 / 55–56 / **40–42** / 51–52 | — | — | — | 降解析度 G 75% 即出現明顯退步 |
| 554 秒定格 | A / B·D / G 75% / 回 A | 56–57 / 60 / **45.4** / 58 | — | — | — | 切回 A 立刻回彈至 ~58 FPS |
| 664 秒靈玉對照 | E 53 顆 / E 512 顆 | ~27.7 / ~23–25 | — | — | — | 少量靈玉時已低於 30 FPS，512 顆更重 |
| 744 秒定格 | A / B·D / G 75% / 回 A | 32–33 / 33–34 / **19–20** / 32.1 | — | ~4 ms (A & G) | A ~27 ms / G **~46–48 ms** | 58 敵、22 靈玉、365 粒子、Lv5 靈陣；G 的 rAF P50 31→50 ms 全增在回呼外 |
| 763 秒（A vs P） | **A 完整畫面** | **35.6–37.8** | 29–32 ms | **4 ms** | **22–24 ms** | 47 敵、84 靈玉、380 粒子（333 次空中貼圖、121 次混色）；地面重畫累計 **2,441 次**；Safari 三畫布皆無原生 `filter` |
| 763 秒（A vs P） | **P 隔離空中粒子** | **55.2–58.1** | 18–20 ms | **2 ms** | **15–16 ms** | 空中貼圖 333→0；但回呼外仍佔 **15–16 ms** |
| 819 秒實玩（HUD） | H（36 敵／512 顆） | **33** | — | sim+draw 5.5 ms | 差額 24.8 ms | 原地累積至 512 顆 |
| 824 秒最差視窗 | H 實玩 | **26.25** | — | **6 ms**（P95 **21 ms**） | **29 ms** | 通關後敵人歸零回升至 55–59 FPS |
| 951 秒實玩（HUD） | H（20 敵／53 顆） | **36** | — | sim+draw 4.2 ms | 差額 23.6 ms | 僅 53 顆靈玉仍低於 45 FPS |

### 3.2 雨夜港町進關記憶體審計（本機實測）

於 Playwright 載入 `/?perf=1&dev=1&s3play=1&stage=rain-port` 並進入雨港後（尚未觸發升級抽卡中心圖與多組配送圖），對所有已就緒（`naturalWidth > 0`）的獨立影像與 Canvas backing store 進行實際掃描：

| 資源分類 | 數量 | 總像素數（px） | 未壓縮 RGBA 估算（MiB） | 最大單張尺寸與發現問題 |
| :--- | ---: | ---: | ---: | :--- |
| `window.ART` | 63 張 | 28,467,118 | **108.59 MiB** | `overworld_approved_v2.webp`（`3840×2166` = **31.73 MiB**）進關後仍常駐；`katana__slash__lv01` 等技能圖達 `1254×1254`（6.0 MiB/張） |
| `S2_ART_PROD_CACHE` | 8 張 | 12,580,128 | **47.99 MiB** | 地磚與接縫圖為 `1254×1254`；不帶 `?v=` 版本字串載入 |
| `window.PORT_ART` | 23 張 | 12,039,192 | **45.93 MiB** | 帶 `?v=20261101-s2-stone1` 重複解碼多張 `1254×1254` 地磚；`transH`/`transV`/`stoneWoodV2` 指向同檔卻建 3 份 `Image` |
| `BOSS_HAZARD_ART_IMG` | 6 鍵 | 9,435,096 | **35.99 MiB** | `?dev=1` 下 `tide_v03.webp` 與 `tidalFan_v01.webp` 各重複解碼 2 份（`1254×1254` × 6） |
| `PORT_ENEMIES` | 4 張 | 341,000 | **1.30 MiB** | `350×330`（Boss）與 `250×220`（潮目），尺寸極克制 |
| **已追蹤影像小計** | **104 張** | **62,862,534** | **239.80 MiB** | 尚未計入 UI 圖素、`__YOKAI_UPGRADE_PHASE42` 卡圖與配送單字圖 |
| `main` Canvas (`alpha:false`) | 1 張 | 2,072,400 (`1727×1200`) | **7.91 MiB** | DPR 被限縮至 ~1.44（1180×820 視口） |
| `lightCv` Canvas | 1 張 | 280,035 (`635×441`) | **1.07 MiB** | 固定 ~280k px 預算 |
| `terrainCv` Canvas | 1 張 | **5,389,318** (`2189×2462`) | **20.56 MiB** | **異常過大**：2.5D 高度未乘 `tilt`，且 `alpha:true`；self-blit 時另需暫存副本 |
| **Canvas backing store 小計** | **3 張** | **7,741,753** | **29.53 MiB** | 若加上 `terrainCv` scroll copy 暫存與升級卡中心圖（觸控上限 10 張×3.8 MiB = 38.5 MiB）、UI 圖與瀏覽器合成緩衝，總圖形記憶體輕易突破 **330～400+ MiB** |

此外，盤點 `assets/img/` 磁碟現況共 **871 檔（172.11 MB WebP/PNG）**，單 `assets/img/vfx/` 即達 161 檔（65.70 MB），多數特效圖原稿為 `1254×1254`（每張解碼即佔 **6.0 MiB GPU texture**），但在螢幕上通常僅繪製為 `100～300 CSS px` 寬。

### 3.3 後期單幀 Canvas 2D API 指令完整盤點（本機實測）

在 `rain-port` 模擬後期戰鬥情境（50 敵＋1 港霧大妖 Boss＋512 顆靈玉＋380 顆空中粒子＋45 個傷害數字＋Lv5 8 技能＋完整 Diegetic HUD＋3 枚御守），攔截主畫布 `ctx` 單幀所有 2D API 呼叫：

| Canvas 2D API 操作 | 單幀次數 | 來源與熱點分佈 |
| :--- | ---: | :--- |
| `drawImage` 總計 | **1,465** | `HTMLCanvasElement`: **1,039**（主要為 512×2 靈玉＋地形貼圖） / `ImageBitmap`: **380**（空中粒子） / `HTMLImageElement`: **46** |
| `save` / `restore` | **1,497 / 1,497** | 512 靈玉（~1,024 次）＋ 粒子旋轉/upright ＋ 敵人與傷害字 ＋ HUD |
| `translate` / `scale` / `transform` | **1,168 / 585 / 307** | `VIEWPORT.upright` 與世界矩陣套用 |
| `shadowBlur > 0` 繪製次數 | **54** | **UI 層佔 50 次**（被動格至多 28、技能扇 8、御守 12、委託 6–12、Boss 血條 3–4）；**World 層佔 4 次**（靈陣罩層／Boss 預警／台詞） |
| `globalCompositeOperation` 切換 | **284** | **World 層佔 262 次**（`FX.drawLayer` 粒子混色 `source-over ↔ lighter` 頻繁跳轉） / UI 層 22 次（提燈 `multiply`/`screen` ＋ `FX.glow`） |
| `stroke` / `fill` | **125 / 146** | 大氣雨絲 51–71 次、天候水花、Boss 邊框與 HUD 弧線／點陣 |
| `strokeText` / `fillText` | **54 / 58** | 45 個傷害字（每字 1 次 `strokeText` + 1 次 `fillText`）＋ 房屋看板 ＋ HUD 數值（滿 96 傷害字時 `strokeText` 達 **105 次**） |
| `createLinearGradient` / `createRadialGradient` | **12 / 10** | 天候霧氣放射漸層、主角／護盾／提燈／雷達漸層每幀重建 |
| `clip()` | **7** | 提燈窗洞／紙罩、雷達圓框、雨港 Boss 潮扇／漩渦 |
| `window.matchMedia(...)` | **17** | `js/ui.js:158` `calm()` 未快取，在 `UI.drawHud` 單幀重覆查詢 17 次 |

### 3.4 純模擬 `update(dt)` 隔離基準（本機實測）

隔離渲染與 DOM，連續呼叫 `update(1/60, false)` 180 步（鎖定等級與血量避免跳出升級視窗，玩家持續移動）：

| 測試案例 | 平均耗時 (ms/step) | P50 (ms) | P95 (ms) | P99 (ms) | 結束時活體數量 |
| :--- | ---: | ---: | ---: | ---: | :--- |
| `empty` (0 敵, 0 靈玉, 無技能) | **0.016** | 0.0 | 0.1 | 0.1 | 0 敵 / 0 玉 |
| `gems_128` | **0.061** | 0.0 | 0.2 | 1.3 | 50 玉（磁吸消耗部分） |
| `gems_256` | **0.089** | 0.1 | 0.3 | 0.7 | 118 玉 |
| `gems_512` | **0.108** | 0.1 | 0.3 | 0.4 | 321 玉 |
| `enemies_20` | **0.040** | 0.0 | 0.1 | 0.3 | 21 敵 |
| `enemies_40` | **0.050** | 0.0 | 0.1 | 0.3 | 41 敵 |
| `enemies_60` | **0.057** | 0.1 | 0.1 | 0.2 | 61 敵 |
| `enemies_80` | **0.051** | 0.0 | 0.1 | 0.2 | 82 敵 |
| `full_combat_60e_512g_8skillsLv5` | **0.359** | **0.3** | **0.9** | **2.3** | 62 敵 / 322 玉 / 440 粒子 |

**數據判讀**：純模擬在最重情境下僅佔 16.67 ms 預算的 **2.15%**。`gems_512` 比 `empty` 僅多 **0.092 ms**，**512 顆靈玉在模擬層（`game.js:5509-5524`）沒有 O(n²) 瓶頸**；真正造成 512 顆靈玉降幀的是渲染層的 **1,024 次繪製＋狀態切換**。

### 3.5 渲染隔離對照矩陣（Windows Headless Chromium SwiftShader 實測）

> 注意：SwiftShader 為純 CPU 軟體光柵化，絕對毫秒數遠慢於 M4 GPU，此表僅供比較各因素造成的「相對增量」與 API 次數差異。

| 隔離情境 | 平均幀時間 (ms) | `drawImage` (Canvas/Bitmap/Img) | `save` | World `shadow` | UI `shadow` | `blendSw` | `strokes` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `empty_2.5D_rainOff` *(含後期 HUD 狀態)* | **63.88** | 47 (14 / 0 / 33) | 149 | 0 | **46** | 28 | 48 |
| `empty_2.5D_rainOn` | **70.62** (+6.74) | 61 (14 / 0 / 47) | 151 | 0 | 46 | 28 | 106 (+58) |
| `empty_2D_rainOn` | **71.82** | 63 (14 / 0 / 49) | 139 | 0 | 46 | 28 | 113 |
| `gems_128_2.5D` | **76.32** (+5.70) | 317 (270 / 0 / 47) | 407 | 0 | 46 | 28 | 106 |
| `gems_256_2.5D` | **88.92** (+18.30) | 574 (526 / 0 / 48) | 665 | 0 | 46 | 28 | 106 |
| `gems_512_2.5D` | **103.58** (+32.96) | **1,085** (1,038 / 0 / 47) | **1,175** | 0 | 46 | 28 | 104 |
| `benchVisibleEnemies(0)` *(清空 build HUD)* | **33.73** | — | — | — | — | — | — |
| `benchVisibleEnemies(20)` | **32.78** | — | — | — | — | — | — |
| `benchVisibleEnemies(40)` | **34.57** | — | — | — | — | — | — |
| `benchVisibleEnemies(60)` | **47.97** (+14.24) | — | — | — | — | — | — |
| `late_full_2.5D_100pct` | **228.36** | 1,470 (1,039 / 380 / 51) | **1,543** | 4 | **50** | **284** | 113 |
| `late_full_2D_100pct` | **188.86** (−39.50) | 1,473 (1,039 / 380 / 54) | 1,025 (−518) | 4 | 50 | 284 | 118 |
| `late_full_2.5D_75pct` | **138.71** | 1,471 (1,039 / 380 / 52) | 1,528 | 4 | 50 | 284 | 115 |
| `late_full_2.5D_50pct` | **79.59** | 1,470 (1,039 / 380 / 51) | 1,549 | 4 | 50 | 284 | 112 |

同場執行現有 [`tools/measure-port-performance.cjs`](../tools/measure-port-performance.cjs)（`--brief A B C D E53 E200 E512 F1 F5 G0.75 G0.5 P`，1194×834 DPR 2）亦呈現一致趨勢：
- `A`（完整畫面）：`intervalMs p50 = 133.3 ms`，`worldMs p50 = 34.9 ms`
- `B`（隔離 Lv5 靈陣）：`worldMs` 由 **34.9 → 23.0 ms**（−11.9 ms），`intervalMs p50` 133.3 → 83.4 ms
- `D`（僅隔離靈陣罩層與施法脈衝）：`worldMs` 由 **34.9 → 28.9 ms**（−6.0 ms）
- `E512`（512 顆靈玉）：`worldMs` 飆升至 **61.2 ms**（較 `E53` 35.8 ms 增加 **+25.4 ms**）
- `F1` vs `F5`（Lv1 vs Lv5 靈陣）：`worldMs` **23.8 ms** vs **35.2 ms**（差 **11.4 ms**，但 iPad 實機 744s `B/D` 僅改善 1 FPS，說明 iPad 當下主要受限於粒子＋HUD＋記憶體合成而非單一靈陣）

### 3.6 持續走動＋戰鬥 20 秒 Soak 實測（本機實測）

模擬玩家以 `300 px/s` 在雨港向東持續走動 20 秒（總移動 `6,000 px`，40 敵＋Boss＋300 靈玉＋Lv5 全技能）：

| 模擬秒數 | 玩家 X 座標 | `enemies` | `gems` | `particles` | `chunkCache` | `terrainPaints` 累計 | `terrainScrollCopies` 累計 | JS Heap (MB) |
| :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 s | 750 | 41 | 300 | 62 | 16 | 2 | 2 | 9.46 |
| 5 s | 1950 | 41 | 300 | 62 | 16 | 11 | 11 | 8.63 |
| 10 s | 3450 | 41 | 300 | 62 | 16 | 23 | 23 | 8.72 |
| 15 s | 4950 | 41 | 300 | 62 | 16 | 34 | 34 | 9.81 |
| 20 s | 6450 | 41 | 300 | 62 | 16 | **46** | **46** | 9.94 |

**關鍵發現**：
1. `chunkCache` 穩定鎖定在 16、JS heap 維持 8.6～9.9 MB（沒有 JS 記憶體洩漏）。
2. **`terrainPaints` 與 `terrainScrollCopies` 以每秒 2.3 次的頻率穩定觸發**（因為 `drawGroundBase` 僅保留 ±120 世界 px 邊距，走動 `300 px/s` 即每 `0.4s` 越界一次），完全重現 iPad 實機第 763 秒紀錄 **2,441 次地面重繪（平均 ~3.2 次/秒）** 的機制。每一次都對 `2189×2462`（20.56 MiB）畫布做 `c.drawImage(terrainCv, dx, dy)` 自我複製！

---

## 四、已確認的問題、合理推測及尚未驗證的假設

| 狀態分類 | 具體發現與證據歸屬 |
| :--- | :--- |
| **已確認**<br>*(實機數據＋程式碼＋本機測試證實)* | 1. **空中粒子是實機最大可隔離單一瓶頸**：iPad 第 763s `A → P` 關閉空中粒子貼圖後 FPS 由 **35.6–37.8 跳升至 55.2–58.1**，JS callback 由 4→2 ms，`outsideCallbackMs` 由 22–24→15–16 ms。<br>2. **JS 模擬邏輯極輕**：最重全技能戰鬥 `update(dt)` 僅 **0.359 ms**；512 靈玉模擬僅 **0.108 ms**（無 O(n²) 迴圈）。<br>3. **後期 UI 存在 50 次 `shadowBlur`/幀 ＋ 17 次 `matchMedia`/幀**：`ui.js` 被動點陣（≤28）、技能扇（8）、御守（12）、委託（6–12）、Boss 條（3–4）每幀強制執行高斯模糊，並於 `ui.js:158` 重複查詢 `matchMedia`。<br>4. **512 靈玉製造大量無謂狀態切換與複製**：每幀 1,024 次 `drawImage(96×96 canvas)`、1,024 次 `save/restore`、512 個 `upright()` 閉包，使 Chromium `worldMs` 增加 +25.4 ms。<br>5. **粒子混色每幀亂序切換 ~262 次**：`fx.js:360` swap-and-pop 打亂 `ps` 順序，`drawLayer`（`fx.js:427-436`）在 `source-over` 與 `lighter` 間頻繁跳切。<br>6. **基礎圖資重複解碼與未釋放**：實測雨港進關已就緒 **104 張圖（239.80 MiB RGBA）**，含 `overworld_approved_v2`（31.7 MiB）、`PORT_ART` vs `S2_ART_PROD_CACHE` 重複、`transH`/`transV`/`stoneWoodV2` 三開以及 `BOSS_HAZARD_ART_IMG` 重複。<br>7. **`terrainCv` 尺寸過大（20.56 MiB）且持續 self-blit**：高度未乘 `tilt=0.6` 導致 5.39M px，移動時每秒 2.3～3.2 次自我複製（實機 763s 達 2,441 次）。<br>8. **`G 75%` 在 iPad M4 上明顯降速**：466s 52→41、554s 57→45、744s 32→19 FPS，切回 `A` 立即恢復；與 Chromium 行為完全相反。 |
| **高度合理推測**<br>*(符合 WebKit/CoreGraphics 公開實作與實機數據，待 iPad 分項開關證實)* | 1. **未加速 `<128×129` 離屏畫布拖慢 GPU Process**：`FX` 粒子畫布（48² / 64² / 128²）與 `gemTile`（96²）均小於 WebKit `minimumAccelerated2DContextArea`（`128×129 = 16,512 px`），會落入 CPU `CGBitmapContext` 並在每幀繪製時觸發 CPU→GPU 上傳／IPC 同步。<br>2. **50 次 HUD `shadowBlur` 是 `P` 模式下 `outsideCallbackMs` 仍高居 15–16 ms 的主因之一**：前段關卡被動/御守/Boss 少時 `shadowBlur` 僅 ~10–15 次，後期增至 ~50 次，對應實機前期 57 FPS、後期即使無靈玉/無空中粒子仍降幀的軌跡。<br>3. **背景閃爍後消失＝高記憶體壓力下的前景靜默 backing store 驅逐 ＋ `terrainCv` self-blit 盲區**：總圖形記憶體突破 350–400 MiB 時，`20.56 MiB` `terrainCv` 自我複製需暫存副本，觸發 WebKit 回收其底層 IOSurface；因前景未觸發 `contextlost` / `isContextLost()`，`terrainState` 誤認快取仍有效，主畫布又未清底色，導致整片地面變黑且後續移動繼續複製空白。<br>4. **2026-11-23 `ImageBitmap` 粒子補丁在 iPad 未必為正收益**：WebKit iOS 上對由 `<canvas>` 建立的 `ImageBitmap` 跨行程繪製曾有 `RemoteRenderingBackendProxy::getShareableBitmap` 序列化與同步瓶頸，必須實機 A/B 實測才能確認。 |
| **尚未驗證的假設**<br>*(需 iPad 實機＋Mac Web Inspector Timelines 確診)* | 1. **`G 75%` 降速的精確機制**：究竟主因是 ① `imageSmoothingQuality="medium"`（`kCGInterpolationMedium`）在 `pixelScale` 從 `~1.96` 降至 `~1.47` 時使 1,400+ 張圖失去近似整數/1:1 取樣而觸發昂貴多抽頭縮放＋CoreAnimation 雙重放大；還是 ② `resize()` 同時重設 `cv.width` 與 `cv.height` 搭配 `index.html:169` `<canvas>` 的 `box-shadow: 0 0 50px` 改變合成路徑；抑或 ③ 60 Hz VSync 跨過 33.3 ms 閾值造成 30→20 FPS 量化落差。<br>2. **12–20 分鐘熱降頻貢獻比例**：M4 iPad Air 無風扇，在 20 分鐘高 GPU 負載（7×–9× overdraw + 54× blur）下是否觸發 GPU 降頻。 |

---

## 五、現有優化方案的有效性及可能副作用

| 既有方案與位置 | 有效性評估 | 盲區與潛在副作用 |
| :--- | :--- | :--- |
| **1. 升級卡中心圖 LRU 上限 10 張**<br>(`704cf72`, `js/ui-upgrade-trial.js:16-27`) | **有效（高價值）**：避免整局累積 40+ 張 `820×1230` 卡圖吃掉 >150 MiB，將其壓在 **~38.5 MiB**。 | 僅靠 `delete cache[oldest]` 依賴 JS GC 回收 decoded bitmap，Safari 可能延遲釋放 GPU texture；且未解決主戰場 **239.8 MiB** 基礎圖資重複載入。 |
| **2. `terrainCv` `contextlost` 與切頁恢復**<br>(`704cf72` + `js/renderer.js:168-216, 309-315`) | **防禦方向正確**：捕捉了標準 `contextlost` 及切出分頁後的 `visibilitychange` 恢復。 | **存在嚴重盲區**：① 前景遊玩時 Safari 靜默清空 backing store 不會觸發兩個事件，且 `scrollReuse` 會把「空白」繼續複製下去；② `TERRAIN_MAX_ATTEMPTS = 3` 若失敗三次會永久退回 `paintFallback()`（每幀直繪整個地形，FPS 進一步雪崩）；③ `canvas.width = 0`（line 195）不如 `1` 穩定觸發 WebKit 立即釋放，且該路徑未清 `terrainCtx`。 |
| **3. 靈玉裁切透明外框 (`drawGemTile`)**<br>(`js/renderer.js:2794-2799`) | **局部有效**：512 顆靈玉繪製矩形像素由 6.92M 降至 **2.78M px（−60%）**，在 SwiftShader 節省了填充時間。 | ① 沒有減少 `drawImage` 次數（仍為 **1,024 次**）；② 兩張 `gemTile` 畫布僅 `96×96`（`9,216 px < 16,512 px`），在 WebKit 屬於**未加速小畫布**；③ 保留 1,024 次 `save/restore` 與 512 個 `upright()` 閉包。 |
| **4. 2026-11-23 `FX` `createImageBitmap` + 合併變換**<br>(`js/fx.js:218-235, 400-416`) | **合併變換有效，Bitmap 待驗**：將粒子變換與 `save/restore` 指令數由 3,145 降至 989，且未旋轉粒子直接直貼，對 JS 與 CPU 狀態追蹤有實質幫助。 | ① `createImageBitmap` **僅套用在 `!o.ground && rain-port`**（`FX.glow()` 與地面粒子沒用），且尚未在 iPad 實測，WebKit iOS 上 `createImageBitmap(canvas)` 可能有跨行程複製成本；② **完全沒有消除每幀 262 次 `source-over ↔ lighter` 混色切換**。 |
| **5. 南岸物件與雨絲視口裁切**<br>(`js/renderer.js:1381`, `js/game-weather.js:43-62`) | **乾淨有效**：消除了 4 張畫布外海港物件與 12 張畫布外水花圖，無副作用。 | `drawPortAtmosphereRain`（`js/renderer.js:3255-3275`）與 `drawStageWeather`（`js/game-weather.js:61-69`）仍以「每條雨絲一次 `beginPath()+stroke()`」送出 51–71 個 draw calls，未做同樣式批次合併。 |
| **6. `G 75%` 解析度縮減實驗**<br>(`js/renderer.js:277-284`) | **在 iPad 實機證實無效且有害**（466s 掉 11 FPS、554s 掉 12 FPS、744s 掉 13 FPS）。 | 若未先修正取樣品質與畫布重配機制而貿然套用「低幀率自動降解析度」，會造成 iPad 上出現 **越降越卡的死亡螺旋**。 |

---

## 六、新的改善方案（涵蓋先前忽略之關鍵方向）

所有方案均嚴守美術與玩法限制：**不降低 512 靈玉上限、不減少怪數或攻速、不取消天氣與半水墨和紙質感、不改寫遊戲引擎。**

### 方案 1：消滅 HUD 與場景 50+ 次 `shadowBlur` ＋ 快取 `matchMedia` ＋ 移除全螢幕 Canvas `box-shadow`【最高 CP 值・P0】
- **問題定位**：
  - `js/ui.js:3129`（被動欄至多 28 次 `shadowBlur=4`）、`2498`（技能扇 8 次 `shadowBlur=4..12`）、`1784/1789/1793`（御守 12 次 `shadowBlur=4..7`）、`2687`（委託清單 6–12 次 `shadowBlur=6`）、`2708/2715`（Boss 血條 3–4 次）、`js/game.js:8076`（暴雨字 `shadowBlur=7`）、`js/game-sanctuary-arc.js:54`（`shadowBlur=17`）。
  - `js/ui.js:158` `calm()` 每幀呼叫 `window.matchMedia` 17 次。
  - `index.html:169` 全螢幕 `<canvas>` 套用 `box-shadow: 0 0 50px rgba(0, 0, 0, 0.9)`（佔滿 100vw×100dvh 根本看不見，卻迫使 CoreAnimation 維護陰影合成邊界）。
  - `js/ui.js:1549-1669`（提燈）與 `2067-2174`（雷達）每幀執行 `clip()`、新建放射漸層、`multiply`/`screen` 混合與多次未加速 `FX.glow()`。
- **具體做法**：
  1. `js/ui.js` 比照 `renderer.js:266` 改用 `addEventListener("change")` 快取 `calm` 布林值。
  2. **HUD 全面零 `shadowBlur`**：
     - 被動點陣（`3129`）：拿掉 `shadowBlur=4`，在亮格底下加繪 1px 淺金色半透明外框或單張 `24×24` 預烘焙發光點。
     - 技能扇弧線（`2498`）：拿掉 `shadowBlur`，改以「先畫一條寬 `6px`、`alpha 0.24` 的外弧，再畫一條寬 `2.5px` 的實色內弧」模擬柔和和紙發光。
     - 御守／委託／Boss 血條：改用預繪暗底襯框（`glassBox` 本身已有偏移投影）或 1.5–2px 實色描邊／+1px 偏移暗影取代 `shadowBlur`。
  3. **快取提燈背景與雷達靜態底盤**：將雷達玻璃底盤（`createRadialGradient`＋同心圓網格＋外框裁切）快取至單張 `256×256` 離屏畫布（`65,536 px > 16,512 px`，GPU 加速！），每幀只 `drawImage` 貼上再畫動態指標與掃描線；提燈靜態漸層同步快取。
  4. 移除 `index.html:169` `canvas { box-shadow: ... }`。

### 方案 2：單一 GPU 加速共用圖集（Shared Atlas）＋ 雙 Pass 混色批次（`FX` 與 傷害數字）【P0】
- **問題定位**：
  - `js/fx.js:208` 建了 ~20+ 張獨立小畫布（`48²`、`64²`、`128²`，全低於 WebKit `16,512 px` 加速門檻），且 `ps` 因 swap-and-pop 導致 `drawLayer`（`js/fx.js:428-438`）每幀切換 `source-over ↔ lighter` 達 **262 次**。
  - `js/fx.js:480` `FX.glow()` 仍直讀 64×64 未加速畫布。
- **具體做法**：
  1. **單一 GPU 加速靜態圖集（例如 `512×512` 或 `1024×512`）**：將常用粒子（`glow`、`spark`、`shard`、`stroke`、`ring`、`flame`、`seal` 等同色或可重用色塊）與 `gemTile`（大小靈玉本體＋陰影）**打包進同一張 ≥512×512 的畫布**（面積 ≥262,144 px 遠超 WebKit 加速門檻，且建立後永不修改內容）。同步實測以 `atlasCanvas.toBlob() -> HTMLImageElement` 作為對照，確認在 Safari GPU Process 中「單一大 Canvas」vs「單一 `HTMLImageElement`」vs「單一 `ImageBitmap`」何者最快，避免 20 張小圖各自走 `ShareableBitmap` IPC。
  2. **雙 Pass 混色零切換**：在 `FX.drawLayer` 內不依 `ps` 單一迴圈亂序切換，而是 **Pass 1 僅設一次 `ctx.globalCompositeOperation = "source-over"` 畫所有普通粒子；Pass 2 僅設一次 `ctx.globalCompositeOperation = "lighter"` 畫所有加法粒子**（兩層之間互不影響視覺，或於 `FX` 內部直接維護 `psNormal` / `psAdditive` 兩組陣列）。可將 `FX` 混色切換由 **~262 次/幀 降至 1 次/幀**！
  3. 同一張圖集同時供 `FX.glow()`（含 UI 與路燈）使用，徹底消滅 64×64 CPU 畫布上傳。

### 方案 3：512 顆靈玉零 `save/restore`・零閉包批次繪製（不降 512 上限）【P1】
- **問題定位**：`js/game.js:6469-6474` 每顆靈玉呼叫 `drawGemShadow` + `upright(g.x, g.y, () => drawSpiritGem(g, elapsed))`，產生 1,024 次 `save/restore`、512 個閉包物件、512 次浮點 `globalAlpha` 變更與 1,024 次小畫布繪製。
- **具體做法**：
  1. 在 `renderer.js` 新增批次函式 `drawSpiritGems(gems, elapsed, cam, view, tilt)`，由 `drawWorld` 單次呼叫：
     - **零閉包、零逐顆 `save/restore`**：利用 2.5D 矩陣下 `y` 軸已被壓縮 `tilt` 倍之特性，直接以 `dh = 34 / tilt`、`dy = g.y - rise - 17 / tilt`（`drawImage(atlas, sx, sy, sw, sh, g.x - 19, dy, 38, dh)`）達成與 `upright()` 完全等價的直立投影，**省去全部 1,024 次 `save/restore` 與 512 個閉包**！
     - **兩趟合批**：先以單次 `globalAlpha = 1` 畫完所有可見靈玉陰影（512 次連續同狀態 `drawImage`），再畫所有靈玉本體；將 `gleam` 閃爍微調（原本 0.92..1.00，實際視覺差 <8%）改為不改變 `globalAlpha`（或僅分兩段 alpha 桶繪製），消除 512 次狀態變更。
     - **終極減半選項**：若將「陰影＋靈玉」預合成 2 格微動離屏圖（或靜止影子與本體合繪為一張 `40×46` sprite 區），512 顆靈玉可直接降為 **512 次 `drawImage`**（−50% draw calls）。
  2. **純視覺重疊剔除（不改遊戲邏輯）**：當 512 顆靈玉大量堆疊在玩家周圍或畫面一角時，以世界 `16×16` 粗格（僅渲染期使用一個可重用 `Uint8Array`）限制同一格最多繪製 2 顆高價靈玉；邏輯陣列與經驗值拾取 100% 保留。

### 方案 4：`terrainCv` 徹底瘦身、消滅 Self-Blit 與防止前景靜默黑屏【P0】
- **問題定位**：
  - `js/renderer.js:1844-1845` `ph = Math.ceil((area.height + 240) * pixelScale)` 在 `tilt=0.6` 時把 `terrainCv` 建為 **`2189×2462`（20.56 MiB）**，垂直解析度為實際螢幕的 **1.67 倍**，且 `alpha: true`。
  - `js/renderer.js:1867` `blitTerrain(c, dx, dy)` 對自己做全尺寸複製，加上 ±120px margin 過小，走動每秒觸發 2.3–3.2 次。
  - Safari 在前景因記憶體壓力靜默回收 `terrainCv` 後，未觸發 `contextlost`，`drawWorld` 無清底色而貼出全黑背景。
- **具體做法**：
  1. **修正 2.5D 垂直取樣比例＋去 Alpha**：`terrainCv` 高度乘以 `pixelScale * tilt`（`2189×2462` → `~2189×1480`，記憶體由 **20.56 MiB 降至 ~12.3 MiB，−40%**），並以 `terrainCv.getContext("2d", { alpha: false })` 建立，省去每幀全螢幕透明混色。
  2. **加大邊距＋消滅自我複製（Self-Blit）**：將 cache margin 由 `120` 放寬至 `360px`（使重畫頻率從每 0.4s 降至每 ~1.2s），並以 **雙緩衝交換（`terrainCvA` ↔ `terrainCvB`，各自 `width` 更新時才複製重疊區到另一張）或 2×2 分塊環形池** 完全消滅 `c.drawImage(terrainCv, dx, dy)` 自我複製；若使用單畫布，則在偵測到 `scrollReuse` 時僅從另一張已分配的輪替表面拷貝或改採 512px world tile cache（可選對照）。
  3. **前景靜默驅逐主動偵測與安全底色**：
     - 在 `paintTerrainRegion` 結尾於快取角落寫入一個 1×1 標記像素（或於移動/每 N 秒低頻檢查），或直接在 `drawWorld()` 開頭以極輕量 `ctx.fillStyle = baseColor; ctx.fillRect(...)` 確保永遠不會黑洞，並在 `TERRAIN_MAX_ATTEMPTS` 重試時改採指數退避而非永久停機；丟棄舊 `terrainCv` 時一律設 `previous.width = previous.height = 1` 強制 WebKit 立刻釋放 IOSurface。
  4. **釋放無用暫存畫布**：`groundAtlasFor`（`js/renderer.js:107`）建完 1024² atlas 後立刻將 `sourceCanvas.width = sourceCanvas.height = 1`。

### 方案 5：圖片記憶體大瘦身（由 ~350–400+ MiB 壓至 <140 MiB，釋放 >200 MiB）【P0】
- **問題定位**：雨港進關即駐留 239.80 MiB 基礎圖片＋29.53 MiB 畫布＋卡圖／UI，其中大量為**跨載入器重複解碼**、**過場大地圖常駐**與 **1254×1254 超大來源圖**。
- **具體做法**：
  1. **統一正規化 URL 去重快取**（`js/assets.js`）：所有 loader（`loadArt`、`loadPortSprites`、`loadS2ArtProdAssets`、`loadBossHazardArt`）共用一個依「去除 `?v=` 後之正規化路徑」索引的 `Image` 註冊表。僅此一項即可立即消除 `PORT_ART` vs `S2_ART_PROD_CACHE`、`transH/transV/stoneWoodV2` 三鍵及 `BOSS_HAZARD_ART_IMG` 的重複解碼（**立省 ~60–70 MiB**）。
  2. **關卡／大地圖互斥生命週期**：進入關卡戰鬥時釋放 `ART.overworld_approved_v2`（`3840×2166` = **31.73 MiB**）與 `ART.cover`（`1376×768` = **4.0 MiB**）（設為 `null` 並允許 GC，返回大地圖時再依需求重載），並將未選關的靜態資源（如 `player_win_v1`、`player_kneel_v1` 合計 **8.2 MiB**）延後到結算前才載入；離開關卡時清空 `hitSilhouettes`、`tideBank`、`tideCrestMask`。
  3. **行動端資產貼圖分級降採樣（維持視覺無損）**：檢查並對實際螢幕繪製寬度 ≤ 260 px 卻以 `1254×1254`（6.0 MiB）載入的技能／雨港物件圖（例如地磚、石燈／貨物、部分技能幀），於離線建置流程產出行動端 `512×512`（1.0 MiB，縮小至 1/6 顯存）或 `640×640` WebP（或在觸控裝置請求對應級距），在不損視網膜清晰度下再砍 **80～100+ MiB**。

### 方案 6：雨港專屬 Overdraw 瘦身與 Boss 尖峰消減（保留全特效與天氣）【P1】
1. **雨港免 `lightCv` 快速夜色路徑**（`js/renderer.js:2881-2981`）：在 `rain-port`（沒有路燈 `LAMPS`）或當視野內無可見路燈時，完全跳過 `lightCv` 的 `clearRect + fillRect + destination-out + 全螢幕放大 blit`（省去 ~280k + 2.07M px 合成與畫布切換），直接在主畫布以單一預烘焙或快取的多段徑向漸層（中央透明、四周呈夜色 alpha）疊加，可再結合 `globalAlpha` 隨黎明平滑淡出！
2. **雨絲合批（51–71 draw calls → 3–4 draw calls）**：`drawPortAtmosphereRain`（`js/renderer.js:3255-3275`）與 `drawStageWeather`（`js/game-weather.js:61-69`）內各層同色同線寬的雨絲改為單一 `beginPath()` 累積全部 `moveTo/lineTo` 後僅呼叫一次 `stroke()`；霧層放射漸層（`game-weather.js:151`）於視口尺寸變更時才重建。
3. **Lv5 靈陣雙圖合一 ＋ 無 `shadowBlur` 穹頂**：`drawWorld` 中不要同時疊繪兩張 1024×1024（`sanctuaryFloor` + `skillGround` pulse 合計 2.95M px），改在施法前 0.35s 脈衝直接調節既有靈陣之縮放／不透明度，省下 **1.31M px/幀**；`game-sanctuary-arc.js:54` 拿掉 `shadowBlur=17`，改畫兩層實色漸變弧線。
4. **雨港 Boss 招式去濾鏡去重繪**：
   - `drawPortBossTelegraphOverlay`（`js/renderer.js:3568-3623`）：預烘焙一張增亮版 `rippleBright` 取代每幀 `ctx.filter="brightness(2.1) saturate(1.7)"`，並以雙層寬細亮邊取代 `shadowBlur=14`。
   - `paintHarborWaterSlam`（`js/renderer.js:4184, 4201`）：移除 `shadowBlur=10/12`。
   - `paintRainVortex`（`js/renderer.js:3881-3894`）：目前每個水柱對 1254×1254 原圖畫了 3 次（同一位置疊塗 2 次補透明度＋1 次噴沫），5 根水柱共 **15 次大圖 `drawImage` ＋ 5 次 `clip()`**；應預烘焙「實心不透明水柱條」單次繪製，並將 `drawImage` 降至每個水柱 1–2 次。
   - `drawPortTsunamiCrest`（`js/renderer.js:3665-3691`）：對 4 片海嘯重複清除並重新繪製 `520×540` `tideCrestMask`；可改用 `ctx.clip()` 配合預烘焙單張帶漸層邊緣的水牆圖，或只在 `emerge` 階段快取，消除每幀 4 次離屏 `clearRect + destination-in`。
   - `skillfx.js:36`：啟動時預烘焙一張去色暖銀靈針圖片，徹底移除非冰靈針每幀 `ctx.filter` 開關。

### 方案 7：傷害數字 Sprite Atlas ＋ 零 GC 迴圈整理【P2】
- 將 `0–9`、`-`、`+` 數字以 `Zen Maru Gothic`＋暗墨描邊預先烘焙進共用 GPU 圖集（普通白字＋暴擊金字兩排，各約 `18×24 px`），使最多 96 個浮動傷害數字免除每幀 `save + upright + font + strokeText + fillText + restore`，改為單純的貼圖繪製。
- `js/game.js:6702` 的 `actors` 改用模組級預配置陣列（每幀 `actors.length = 0` 重塞物件或雙索引排序），並將 `texts` / `rings` / `enemyBullets` / `gems` / `dmgNumbers` 等每幀 `.filter()` 改為原地 swap-and-pop 或雙指標壓縮；刪除或加上限保護 `js/renderer.js:2154` `window.__s2HouseMap`。

### 方案 8：補齊 `?perf=1` 診斷隔離旗標，讓下輪 iPad 測試一針見血【P0・前置工具】
在 [`js/port-performance.js`](../js/port-performance.js) 新增 5 個不影響正式版面的隔離旗標：
- `uiShadows: false`：一鍵驗證「50 次 HUD `shadowBlur`」在 iPad M4 上實佔多少 ms。
- `lighting: false`：一鍵驗證 `lightCv` 挖洞＋全螢幕合成實佔成本。
- `damageText: false`：一鍵驗證描邊傷害字成本。
- `fxBatch: true`：比較 `FX` 雙 Pass 混色批次＋共用 GPU 圖集前後差異。
- `smoothQuality: "low" | "medium"`：搭配 `G 75%` 直接在 iPad 實機證實是否為 `kCGInterpolationMedium` 縮放取樣陷阱。

---

## 七、預期效益、修改成本、回歸風險與實施優先級

| 優先級 | 方案 | 預估 iPad M4 收益（推測範圍） | 記憶體收益 | 修改檔案與成本 | 回歸風險與防護 |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **P0** | 方案 8：診斷隔離旗標 | 診斷定位工具（無直接 FPS 變動） | 0 MiB | `port-performance.js`、`ui.js`、`game.js` 少數開關（**0.5 天**） | 極低（僅 `?perf=1` 啟用） |
| **P0** | 方案 1：HUD 零 `shadowBlur`＋`matchMedia` 快取＋去 Canvas `box-shadow` | **−4 ~ −9 ms/幀**（直擊 `P` 模式剩餘 15–16 ms） | ~1–2 MiB | `ui.js`、`game.js`、`game-sanctuary-arc.js`、`index.html`（**1 天**） | **低**：字體與光環邊緣改用描邊／雙弧模擬，須目視對照截圖微調亮度 |
| **P0** | 方案 2：`FX` 雙 Pass 混色批次＋單一 GPU 加速圖集 | **−5 ~ −9 ms/幀**（直擊 35→57 FPS 粒子瓶頸且無 WebKit IPC 疑慮） | ~2–4 MiB | `fx.js`（**1～1.5 天**） | **低～中**：粒子間前後遮擋微調（先畫正常、後畫加法本就更合理），須跑 `--verify-particle-pixels` 驗證 |
| **P0** | 方案 5：URL 正規化去重＋進關卸載 `overworld`/`cover` | 減少長時間卡頓／GC 與背景驅逐機率 | **−90 ~ −110 MiB**（分級資產後可達 **−180 MiB**） | `assets.js`、`game.js`（**1～2 天**） | **中**：須確保 `ART_READY` 與返回大地圖重載順序無 race condition |
| **P0** | 方案 4：`terrainCv` 2.5D 高度修正＋`alpha:false`＋去 self-blit＋防黑屏 | **−1 ~ −3 ms/幀**＋**根治背景閃爍消失** | **−8 ~ −20 MiB**（省掉過採樣與 self-blit 副本） | `renderer.js`（**1.5 天**） | **中**：須回歸測試 2D/2.5D 切換、捲動接縫與 iPad 切換分頁恢復 |
| **P1** | 方案 3：512 顆靈玉零閉包・零 `save` 批次繪製 | **−2 ~ −4 ms/幀**（512 顆情境） | 共用圖集合併省去小畫布 | `renderer.js`、`game.js`（**0.5～1 天**） | **低**：須用 `--verify-pixels` 比對 2D/2.5D 靈玉位置與高度誤差 ≤ 1px |
| **P1** | 方案 6：雨港免 `lightCv`、雨絲合批、靈陣單圖化與 Boss 去濾鏡 | 常駐 **−2 ~ −3 ms/幀**；Boss 施法尖峰 **−4 ~ −7 ms/幀** | 省 `lightCv` 1.1 MiB ＋ 減少暫存遮罩 | `renderer.js`、`game-weather.js`、`game.js`、`skillfx.js`（**1.5 天**） | **中**：雨港 Boss 預警亮邊、靈針去色與夜色過渡須跑視覺對照 |
| **P2** | 方案 7：傷害數字圖集＋`actors`/`.filter()` 零 GC 整理 | **−0.5 ~ −1.5 ms/幀**（大團戰 AOE 尖峰） | 減少每幀短命配置與 Minor GC | `renderer.js`、`game.js`（**1 天**） | **低**：保留「燈油」御札警示條走原本路徑，僅數字走圖集 |

> **合計預估**：在 iPad Air M4（基線 `outsideCallbackMs` 22–29 ms + JS 4–6 ms = **26–35 ms / 28–38 FPS**）上，完成 P0＋P1 後預期可將單幀總時間壓低至 **~11–18 ms（穩定 50–60 FPS，最低尖峰 ≥ 45 FPS）**，同時將總圖形記憶體壓回 **<150 MiB** 安全區間。

---

## 八、分階段修復計畫及明確驗收標準

### Phase 0：診斷擴充與 `G 75%` 謎團實機隔離（建議 0.5 天）
- **工作內容**：實施方案 8（`port-performance.js` 新增 `uiShadows`、`lighting`、`damageText`、`fxBatch`、`smoothQuality`）。
- **實機量測**：請使用者於 iPad Air M4 Safari 在後期場景執行一輪 2 分鐘短測：`A → uiShadows:false → lighting:false → G 75% (medium vs low)`，取得實機毫秒差作為後續對照基準。

### Phase 1：零風險結構大勝（預計 2.5～3 天）
- **工作內容**：
  1. 方案 1：移除 HUD 50 次 `shadowBlur`、快取 `ui.js` `matchMedia`、快取雷達靜態底盤、移除 `index.html` `<canvas>` `box-shadow`。
  2. 方案 2：`FX` 改用單一 ≥512×512 GPU 加速共用圖集＋雙 Pass 混色批次（`source-over` 後再 `lighter`），並實測比較 `HTMLCanvasElement` vs `HTMLImageElement` 圖集在 iPad 的速度，決定是否撤回 2026-11-23 每種形狀獨立的 `createImageBitmap`。
  3. 方案 5（第一波）：`assets.js` URL 正規化去重＋進關卸載 `overworld_approved_v2` 與 `cover`。
- **自動化自檢標準**：
  - 所有修改檔案通過 `node --check`。
  - 既有聚焦測試與 `node tools/measure-port-performance.cjs --verify-particle-pixels` 全數通過。
  - Chromium 盤點：`shadowDrawsUI` 由 50 → **0**、`blendSwitchesWorld` 由 262 → **≤ 10**、`matchMediaCalls` 由 17 → **0**、重複 1254² 影像解碼 **0 件**。
- **iPad 實機驗收標準**：
  - 15 分鐘實玩（含 512 靈玉與大量怪物），`particlesAir` 開啟狀態下中位 FPS 達 **≥ 48 FPS**，P95 frame time < 26 ms；無視覺破圖與 UI 辨識度下降。

### Phase 2：`terrainCv` 根治與靈玉／雨港 Overdraw 瘦身（預計 2.5～3 天）
- **工作內容**：
  1. 方案 4：修正 `terrainCv` 2.5D 高度比例、改 `alpha:false`、擴大 margin 至 360px、以雙緩衝或分塊快取消滅 self-blit、加入前景靜默失效偵測與主畫布安全底色。
  2. 方案 3：實作 `RENDERER.drawSpiritGems` 批次繪製（零閉包、零 `save/restore`、使用共用圖集）。
  3. 方案 6：雨港免 `lightCv` 快速夜色、雨絲合批、Lv5 靈陣單圖化與 Boss 水柱／預警去濾鏡與去 `shadowBlur`。
- **自動化自檢標準**：
  - `node tools/measure-port-performance.cjs --verify-pixels` 通過，2D／2.5D 與 53／512 靈玉的畫面差異維持在既定容許值內。
  - 20 秒走動 Soak 測試：`terrainCv` 面積降為 ≤ 3.3M px、自我複製次數 **0**、`rain` 單幀 `stroke()` 次數 ≤ 5。
- **iPad 實機驗收標準**：
  - 完整跑完 15–20 分鐘 `rain-port`（含 4 場 Boss 戰與終王海嘯／潮扇／漩渦、512 靈玉累積、持續走動送貨與觸控/2D-2.5D 切換）：**全場平均 ≥ 50 FPS、1% Low ≥ 45 FPS**，**0 次畫面閃爍或背景消失**。

### Phase 3：尖峰拋光與選配資產尺寸最佳化（預計 1～2 天）
- **工作內容**：
  1. 方案 5（第二波）：視需求對過度龐大的 `1254×1254` 技能／場景圖做離線行動端規格縮放（維持視網膜 2× 清晰度，不犧牲畫風）。
  2. 方案 7：傷害數字圖集與 `actors`/`.filter()` 零 GC 整理。
- **驗收標準**：目標達 **穩定 55–60 FPS**，全程無可感 GC 微卡頓。

---

## 九、架構評估：是否值得導入 WebGL 2／PixiJS 及替代方案比較

依據實機與程式碼分析，針對六種常見進階架構方向評估如下：

| 架構／技術方案 | 預期效益 | 導入成本與工時 | iPad Safari 相容性 | 美術保真度 | 維護與回歸風險 | 本輪建議 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. 原生 Canvas 2D 深度優化** *(去 `shadowBlur`、GPU 圖集、混色合批、靈玉/雨絲合批、去重減負)* | **高**（預估足以突破 45–60 FPS 且根治記憶體問題） | **低（1～1.5 週）** | 極佳（純標準 2D API） | **100% 保留** | **極低**：不改渲染器架構，現有 1,180+ 測試與 `measure-port-performance` 完全相容 | **首選（Phase 1–2）** |
| **2. 局部混合 WebGL 2（僅世界 Sprite/靈玉/粒子層，保留 2D HUD）** | **極高**（數千 Sprite 僅數次 Instanced Draw Call；完全消除 2D 狀態切換與 CPU 上傳） | **高（3～4 週）**：須寫 Sprite Atlas Packer、Shader、2.5D 矩陣、Context Loss 與獨立測試 | 良好（iPadOS 15+ 完整支援 WebGL 2），但多一個 WebGL Context 會額外佔用顯存與增加 iOS Context Lost 風險 | **100% 可重現**（甚至更滑順），但須重寫光罩與 `lighter` 混合 | **高**：破壞 `RENDERER`/`FX`/`SKILLFX` 現有 2D `ctx` 單元測試與 `PORT_PERF` 攔截器 | **Plan B（僅當 Phase 1–2 實測仍 <45 FPS 才啟動）** |
| **3. 全面導入 PixiJS（違反現有不裝大型依賴原則）** | 同 WebGL 2 | **極高（5～8 週）**：須重寫 `renderer.js`(6,301 行)、`ui.js`(6,357 行)、`fx.js`、`skillfx.js` | 同 WebGL 2，但框架本身增加包體積與黑盒除錯成本 | 須重新調整文字與和紙細節 | **極高**：違反專案規範且近乎重寫 | **明確不建議** |
| **4. Texture Atlas（不改引擎，於 Canvas 2D 內建靜態合併圖集）** | **高**（解決 `<128×129` 未加速畫布與切換圖源問題） | **低（1 天）** | 極佳 | **100% 保留** | **低** | **強烈建議（納入 Phase 1）** |
| **5. 分層渲染（固定背景靜態 Canvas ＋ 前景動態 Canvas ＋ UI 層）** | **中**（將偶發變動的 HUD 與背景分離，減少重繪面積） | **中（1～2 週）**：需處理雙層觸控座標、同步與 iPad 多大畫布額外顯存 | **注意陷阱**：在 iPad 上多一張全螢幕透明 `<canvas>` 會多佔 ~8–16 MiB IOSurface 且增加 CoreAnimation 跨層合成成本！ | 100% 保留 | 中 | **謹慎評估**：只有在 HUD 徹底無法壓低於 1ms 時才考量以低頻更新小畫布，**不可再盲目新增全螢幕透明 Canvas** |
| **6. 固定時間步長 / 降頻視覺更新** | 對 CPU 僅 **0.36 ms** 的現況**幾乎無收益** | 低 | 相容 | 降頻（如靈玉/粒子 30Hz）在 60Hz 螢幕會有明顯畫面撕裂/不流暢感 | 低 | **不建議**（瓶頸不在模擬 CPU） |
| **7. 自適應解析度 / 動態品質調節** | **風險極高**：`G 75%` 在 iPad M4 已實測 **反降 12–13 FPS** | 低 | iPad Safari 下因 `imageSmoothingQuality="medium"` 與 CoreAnimation 縮放存在未知退化 | 降低清晰度 | 高 | **暫停導入**，必須先透過 Phase 0 `smoothQuality` 實機查明 `G 75%` 退化原因 |
| **8. Web Workers / `OffscreenCanvas`** | **無實質收益甚至負收益** | 高 | Safari 16.4+ 雖支援 `OffscreenCanvas` 2D，但粒子/精靈仍在同一 GPU Process 排隊，Worker 還要承擔每幀狀態序列化的 `postMessage` 延遲 | 100% 保留 | 高（狀態同步複雜） | **明確不建議**（瓶頸在 GPU Process 指令與記憶體，不在 JS 主執行緒） |

### 最終架構建議

1. **不要引入 PixiJS，也不要急著把整個遊戲重寫為 WebGL 2。** 目前的 `update(dt)` 僅耗時 **0.359 ms**，而 iPad M4 在關閉空中粒子後（`P` 模式）已能立刻跑出 **55.2–58.1 FPS**，證明 **M4 裝置上的 WebKit Canvas 2D 本身絕對具備跑滿 60 FPS 的硬體算力**，只是被「未加速小畫布 + 262 次粒子混色切換 + 50 次 HUD `shadowBlur` + 240+ MiB 圖資重複解碼與 `20.56 MiB` 地面畫布自我複製」卡住。
2. 先以 **Phase 0 → Phase 1 → Phase 2** 的零依賴 Canvas 2D 結構優化將狀態切換、高斯模糊、Overdraw 與記憶體一次清乾淨，並以實機數據驗證是否達成「全場穩定 ≥ 45–60 FPS 且零黑屏」。
3. 若已完成 Phase 1–2 且記憶體已壓至 150 MiB 以下，但 iPad 實機在最重 Boss 混戰仍無法穩守 45 FPS，則啟動 **Plan B**：僅將「地面磚塊、512 靈玉、怪物精靈與粒子層」抽換為一個輕量、零外部依賴的 **原生 WebGL 2 Instanced Texture-Atlas Renderer**（約 600～800 行，共用 2.5D 矩陣與完全相同的 PNG/WebP 原圖），HUD、字型渲染與遊戲邏輯全數保留於既有 Canvas 2D 層之上，達成最低風險的徹底突破。
