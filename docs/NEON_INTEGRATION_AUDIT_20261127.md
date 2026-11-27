# Yokai Delivery — 八關十三招整合品質審查報告（2026-11-27）

> **審查定位**：本報告為 2026-11-27 獨立品質審查結果，完全依據實際磁碟程式碼、素材檔案、清冊、獨立腳本驗證、回歸測試與無頭 Chromium 實機截圖產出。
> **唯讀守門確認**：本輪未修改任何正式程式、正式素材、音訊、測試或清冊，未解除公開門禁，未提交／推送／部署，未刪除任何檔案，亦未呼叫付費 API 或 ComfyUI。

---

## 一、執行摘要與整體結論

截至 `2026-11-27`（Git 分支 `master`，領先 `origin/master` 4 筆提交，工作樹另含 71 支修改檔與 139 項未追蹤項目）：

1. **核心紅線（P0）零觸發**：未發現崩潰、正式存檔 `yokai-delivery-v1` 污染、公開門禁突破（第五至八關 `mapReleased: false`、新四招正式 `catalogIds = []`、融合停用、第五格鎖定）或關卡無法結算／無法勝利的阻斷性缺陷。
2. **新四招 41 份 ChatGPT 美術素材 100% 實線載入，零死接線**：`art/skill-expansion-10-13/manifest.json` 全數 41 項 `labUse: true` 皆通過檔案存在、SHA256、HTTP 200 與瀏覽器 `naturalWidth > 0` 驗證；但實機戰鬥截圖暴露 **4 項高優先級整合／效能／視覺問題**（風穴／妖絲週期傷害未節流粒子與浮字、地面層畫在 Boss 預警上方、`spider_silk` 收束範圍與長線反協同、以及部分特效 2.5D 雙重壓扁／裁切瑕疵／低對比 HUD 圖示）。
3. **兩項現行回歸測試失敗（其中 1 項為真實資料漂移，1 項為 Windows 測試腳本相容問題）**：
   - `tests/stage58-audio.test.cjs:143` **真實失敗**：使用者已替換後四關全數 10 首 BGM MP3（皆可正常解碼），但 `art/audio/stage58/production.json` 仍記錄舊檔案位元組數；其中 `yomi__ending.mp3` 由 27.55 秒（552 KB）變為 176.85 秒（3.88 MB），須確認是否為刻意長版。
   - `tests/asset-registry.test.cjs:70` **Windows 沙盒假失敗**：`python` 觸發 App Execution Alias 回傳 `EACCES` 而非 `ENOENT`，未回退至 `py -3`；直接執行 `py -3 tools/asset_registry.py --check` **全數通過（1,360 份素材登錄一致）**。
4. **多王錯峰規則僅實作一半**：第一至四關 `boss-ai.js`／`boss-sakura.js`／`bamboo-combat.js` 完全忽略 `game.js:5438` 傳入的 `options.stagger`，僅第五至八關真正執行 0.75 秒起手錯峰與 0.35 秒爆發錯峰。
5. **本機字型缺字實證**：`Yokai UI HanWang YanKai`（本機 GPL 子集）在 152 個核心技能／關卡／Boss／UI 測試字中缺少 **34 字（22.4%）**，實機截圖明顯出現粗黑體／明體混排；反觀正式預設的 `Yokai Trial MoonStars Kai T` 為 **0/152 缺字**。
6. **實體 iPad Air M4 Safari 仍待真人實測**：本輪所有瀏覽器與幀時驗證均在桌面無頭 Chromium 執行，僅能作為工程證據，不得宣稱實體 iPad 已驗收。

### 整體問題分布

| 嚴重度 | 數量 | 摘要 |
| --- | :---: | --- |
| **P0** | **0** | 無崩潰、無存檔污染、無公開門禁突破、無不可完成關卡 |
| **P1** | **4** | `P1-01` 風穴／妖絲週期傷害未節流（效能與遮擋）、`P1-02` 擴充地面特效蓋住 Boss 預警與送貨區、`P1-03` 前四關多王缺少錯峰實作、`P1-04` 後四關 10 首 BGM 漂移導致回歸失敗 |
| **P2** | **10** | 字型缺字混排、第八關重斬方向反向、妖絲收束反協同、2.5D 雙壓扁與碎冰裁切瑕疵、HUD 圖示低對比／卡名擠壓、擴充卡圖無 LRU 淘汰、新四招未入防抽空與介紹卡、雨港橫幅與手機 DEV 鈕遮擋、`assets/` 大圖 PNG 與重複檔膨脹、新四招／後四關／前四關 SFX 缺口 |
| **P3** | **6** | `asset-registry.test.cjs` Windows `EACCES` 回退缺失、冰球首幀旋轉跳變與典籍競態、擴充技能每幀物件配置、`art/` 重複解壓縮包與根目錄垃圾檔、`index.html` 舊 `?v=` 快取標籤、大型未提交工作樹與換行符號混用 |

---

## 二、完整獨立測試與驗證結果

本輪於 `2026-11-27` 獨立重新執行所有檢查（不沿用既有 Agent 統計）：

| 測試項目 | 指令／工具 | 結果 | 關鍵數據與備註 |
| --- | --- | :---: | --- |
| 素材登錄稽核 | `py -3 tools/asset_registry.py --check` | **PASS** | `1360 files 151 aliases/copies; 0 historical ignored local-only art sources absent; no missing shipped/modified/new unregistered media` |
| 聚焦新機能測試（5 支） | `node --test tests/active-skills-10-13.test.cjs tests/stage58-combat-polish-phase-a-20261126.test.cjs tests/stage58-combat-polish-phase-b-20261126.test.cjs tests/late-skill-mutations.test.cjs tests/unified-boss-schedule-no-delivery-gate-20261125.test.cjs` | **48 / 48 PASS** | 耗時 1.50s，0 FAIL |
| 完整現行回歸（195 支現行檔，排除 84 支已退役檔） | `npm run test:current` | **1,324 PASS / 2 FAIL / 1 TODO** | 總計 1,327 測試，耗時 16.5s。失敗項目：`tests/stage58-audio.test.cjs:143`（真實 BGM 漂移 `P1-04`）、`tests/asset-registry.test.cjs:70`（Windows `EACCES` `P3-01`）；既有 1 TODO 維持不變 |
| 新四招 41 份素材清單／SHA256／HTTP 實載 | 獨立腳本 + Chromium 實載（`scratch/neon-audit-20261127/report.json`） | **41 / 41 PASS** | 全數存在、SHA256 吻合、`labUse: true`、HTTP 200、`naturalWidth > 0`，0 錯誤／0 失敗請求 |
| 音訊解碼完整性（16 BGM + 57 S5–8 SFX） | `ffprobe` 批次解碼掃描 | **73 / 73 可解碼** | 前四關 6 首 BGM（含備援與共用 Boss 曲）與後四關 67 檔全數正常解碼；但 10 首 S5–8 BGM 與 `production.json` 位元組不符 |
| Service Worker 快取雜湊一致性 | 獨立 SHA256 比對 `service-worker.js` `MEDIA_REVISIONS` | **1,353 / 1,353 PASS** | 0 缺失、0 雜湊漂移 |
| 十三招抽卡池 2,000 局模擬 | 獨立蒙地卡羅腳本（`audit_balance.cjs`） | **完成** | 確認 13 主動／52 變異／4 槽上限／妖刀起手／0 雙招／0 御守入池／正式卡池零污染；揭示未保護新招開局出現率僅 40%–47% |
| 實機瀏覽器截圖視覺審查（20 張） | Playwright 無頭 Chromium 實機腳本（`scratch/neon-audit-20261127/audit_browser.cjs`） | **20 / 20 產出，0 Console Error** | 涵蓋四招戰鬥（2.5D、無診斷與診斷）、升級三選一、夜行典籍四招與 16 變異、S7/S8 BossLab、手機 844×390 HUD＋效能視窗，全部逐張人工視檢 |

> 獨立審查證據位置（均位於 `.gitignore` 忽略之 `scratch/`，不污染版本庫）：
> - 瀏覽器檢查報告：`scratch/neon-audit-20261127/report.json`
> - 20 張實機截圖：`scratch/neon-audit-20261127/screenshots/01_*.png` ～ `17_*.png`

---

## 三、分級問題清單（P0 / P1 / P2 / P3）

### P0（阻斷性問題）

**本輪獨立審查未發現 P0 問題。**
已明確驗證排除：
- 公開模式（無 DEV 旗標）下 `GAME_SKILL_EXPANSION.catalogIds()` 回傳 `[]`，新四招無法進入一般抽卡池，亦不寫入正式存檔鍵 `yokai-delivery-v1`（DEV Lab 隔離於獨立鍵 `yokai-delivery-skill-lab-v1`）。
- 第五至八關在 `js/words.js` 均維持 `mapReleased: false`，大世界公開入口無法進入；融合系統在 `js/fusion.js` 維持停用；HUD 第五主動格僅顯示鎖頭圖示（`js/ui.js:2581-2595`）。
- 八關統一四王排程（3:00／6:00／8:00／9:00、最多三王同場、尾王需擊殺任一前王且只出一次、零配送可通關、四王全滅勝利、第八關專屬終章）邏輯完整且 48 支聚焦測試全數通過。

---

### P1（重大戰鬥、接線、效能及功能錯誤）

#### `P1-01`（P1）`wind_hole` 與 `spider_silk` 週期傷害未套用粒子、震動與傷害浮字節流，造成 iPad 效能尖峰與玩家視覺遮擋
1. **問題 ID 與嚴重度**：`P1-01`｜**P1（效能／戰鬥可讀性）**
2. **實際位置**：`js/game.js:2369-2383`、`js/game.js:3364`、`js/game-skill-expansion.js:488-503`、`js/game-skill-expansion.js:542-558`
3. **預期與實際行為**：
   - **預期**：如 `js/game.js:2376-2377` 註解所規定，高頻群體週期傷害（如紫藤毒香 `ink_poison`）不應每跳觸發每怪震動、粒子爆發與大量傷害浮字，以免在 iPad 上造成卡頓與畫面遮蔽。
   - **實際**：`js/game.js:3364` 將新四招所有傷害一律以 `impactType = "expansion"` 傳入 `hurt()`。`hurt()` 僅對 `"ink_poison"` 跳過 `HAPTICS.hit`、`burst(..., 4)` 與 1 秒浮字節流，導致 `wind_hole` 每 `0.25s` 命中 12–16 隻（選取 `二重風穴` 時最高 24–32 隻）妖怪時，每跳瞬間產生 48–128 顆粒子、16–32 次震動呼叫與 16–32 個浮字，立即塞爆 `MAX_DAMAGE_LABELS` 並整片覆蓋玩家本體。
4. **重現方式及證據**：
   - 啟動 `?dev=1&skillLab=1`，裝備 `wind_hole`（Lv5）於怪群中央開啟風穴，觀察 0.25s 週期吸怪。
   - 實機截圖 `scratch/neon-audit-20261127/screenshots/10_wind_hole_compress_or_burst.png` 與 `11_wind_hole_field_diag.png` 清晰顯示玩家位置被密集的黃色 `2.2 2.2 2.2` 與白色 `10.3` 浮字完全淹沒，同時疊加受創字樣。
5. **根因或尚待確認的假設**：已確認根因 — `js/game.js:3364` 未區分新四招的「單次爆發／投射物命中」與「高頻持續場域（`wind_hole` 週期風壓、`spider_silk` 穿線跳傷）」，全部走 `impactType = "expansion"` 非節流分支。
6. **建議修復方式**：由 `game-skill-expansion.js` 傳遞事件細分類型（如 `"expansion_dot"` 給風穴週期與妖絲跳傷、`"expansion_hit"` 給神弓／冰球／爆發），於 `hurt()` 中對 `"expansion_dot"` 比照 `"ink_poison"` 關閉單體 `HAPTICS.hit` 與每怪 `burst(4)`，並以每敵 `0.5s–0.75s` 節流傷害數字（或改採聚合跳字）。
7. **影響範圍**：`wind_hole`、`spider_silk` 於高怪量波次（尤其 60–80 怪同場）之 iPad Air M4 Safari 幀率穩定性、震動馬達負荷及戰場可讀性。
8. **建議新增的回歸測試**：於 `tests/active-skills-10-13.test.cjs` 新增測試：16 敵同處 `wind_hole` 範圍 1 秒內，`hurt` 傳入的 `impactType` 區分週期跳傷與結尾爆發，且粒子／浮字呼叫次數低於上限門檻。

---

#### `P1-02`（P1）新四招地面特效繪製於 Boss 攻擊預警與地板送貨答題區之後，且缺少視口裁剪
1. **問題 ID 與嚴重度**：`P1-02`｜**P1（重大戰鬥接線／公平性）**
2. **實際位置**：`js/game.js:7053-7072`（Boss 地面預警）、`js/game.js:7073-7104`（S7 泥濘池）、`js/game.js:7114-7142`（送貨答題地板圈）、`js/game.js:7163-7166`（`expansionSkills` 繪製）
3. **預期與實際行為**：
   - **預期**：玩家技能地面特效（`wind_hole:field`、`wind_hole:compress`、`wind_hole:burst`、`spider_silk:thread/bind/collapse`）屬於友方輔助地效，應繪製在 Boss 致命攻擊預警與地板送貨答題文字之下（或至少不可遮蔽 Boss 預警與答題字樣），且超出視口時應裁剪。
   - **實際**：`js/game.js:7163-7164` 在 Boss 預警（7053–7072）與地板送貨圈（7114–7142）全部畫完之後，才直接呼叫 `expansionApi.paint(ctx, effect)` 繪製所有 `effect.ground === true` 特效。其中 `wind_hole:field`/`compress` 最大直徑達 `436.8px`（`radius = 218.4`），且 `wind-hole__compress__chatgpt.webp` 中心實心不透明（量測中心 alpha = `251.9/255`），`wind_hole:burst` 與 `spider_silk:collapse` 更是 `globalAlpha = 1.0`，會直接蓋住 Boss 危險紅區、第八關重斬警告與送貨答題圓圈。此外第 7164 行未呼叫 `nearView()`，離屏風穴／妖絲仍會完整提交 `drawImage`。
4. **重現方式及證據**：
   - 程式碼閱讀 `js/game.js:7053-7166` 可直接確認繪製順序（7053 Boss 預警 -> 7114 送貨圈 -> 7164 擴充地面特效）。
   - 貼圖透明通道分析：`wind-hole__compress__chatgpt.webp` 中心像素平均 alpha `251.9`，`wind-hole__field__chatgpt.webp` 繪製透明度 `0.68`、全寬達 `436.8px`；實機截圖 `09_wind_hole_field_nodiag.png`、`10_wind_hole_compress_or_burst.png`、`17_phone_landscape_844x390_hud_perf.png` 顯示風穴大片覆蓋場地中央。
5. **根因或尚待確認的假設**：已確認根因 — 接入擴充技能時將 `effect.ground` 直接附掛於角色 `actors` 蒐集迴圈內（第 7163 行），未拆回第 7050 行以前的地面基礎層，且遺漏 `nearView(effect.x, effect.y, ...)` 判斷。
6. **建議修復方式**：將 `effect.ground` 獨立迴圈移至 Boss 預警（`7053`）與地板送貨圈（`7114`）之前繪製，並加上 `nearView(effect.x, effect.y, (effect.radius || effect.length || 120) + 80)` 視口裁剪；另將 `wind_hole:compress` 繪製透明度上限壓低（如 `0.72`）確保不蓋黑場地。
7. **影響範圍**：所有關卡裝備 `wind_hole` 或 `spider_silk` 時之 Boss 閃避公平性、送貨地板可讀性與離屏繪圖開銷。
8. **建議新增的回歸測試**：新增繪製順序單元測試，斷言 `expansionSkills` 地面特效之 `paint` 呼叫順序嚴格早於 `drawBossHazard` 與地板答題繪製，且離屏座標不觸發 `paint`。

---

#### `P1-03`（P1）第一至四關 Boss AI 完全忽略多王錯峰（0.75s 起手／0.35s 爆發）排程器
1. **問題 ID 與嚴重度**：`P1-03`｜**P1（重大戰鬥公平性）**
2. **實際位置**：`js/game.js:5438-5439`、`js/boss-ai.js`（全檔無 `stagger` 參照）、`js/boss-sakura.js`（全檔無 `stagger` 參照）、`js/bamboo-combat.js`（全檔無 `stagger` 參照）；對照已實作之 `js/kyoto-procession.js`、`js/snow-temple-combat.js`、`js/late-stage-combat.js`
3. **預期與實際行為**：
   - **預期**：八關全面採用統一四王節奏（3:00／6:00／8:00／9:00，最多三王同場）後，多王同場時應遵守「起手至少間隔 0.75 秒、實際爆發至少間隔 0.35 秒」之錯峰規則，避免三王同幀重疊造成無解秒殺。
   - **實際**：`js/game.js:5438-5439` 雖對所有關卡傳入 `{ now: elapsed, stagger: bossCastStagger }` 給 `BOSS_AI.step`，但經全文檢索，僅第五關（`kyoto-procession.js`）、第六關（`snow-temple-combat.js`）與第七／八關（`late-stage-combat.js`）實際呼叫 `stagger.canTelegraph`／`stagger.reserve`／`stagger.delayActive`。第一關（夜行鎮）、第二關（雨港）、第三關（櫻峠）、第四關（竹林迷徑）的 Boss AI 完全未讀取 `options.stagger`，雙王或三王同場時仍可同幀起手與同幀爆發。
4. **重現方式及證據**：
   - `git grep -n "stagger" js/` 僅命中 `js/game.js`、`js/kyoto-procession.js`、`js/snow-temple-combat.js`、`js/late-stage-combat.js`，`js/boss-ai.js`、`js/boss-sakura.js`、`js/bamboo-combat.js` 命中數皆為 `0`。
   - 第一至四關在 `js/words.js` 皆已啟用 `bossTimes: [180, 360, 480, 540]` 與最多三王同場機制，玩家未在 6:00 前擊殺第一王即必定遭遇多王同場。
5. **根因或尚待確認的假設**：已確認根因 — 錯峰排程器是在 Phase A/B 針對第五至八關實作時建立並由 `game.js` 向下傳遞，但尚未回填至前四關各自獨立的 Boss AI 模組。
6. **建議修復方式**：將 `bossCastStagger` 的起手 0.75s／爆發 0.35s 檢查接入 `js/boss-ai.js`（涵蓋夜行鎮、雨港及共用基底）、`js/boss-sakura.js` 與 `js/bamboo-combat.js` 的起手與轉入 `active` 分支，與後四關維持一致介面。
7. **影響範圍**：已公開上線的第一至四關全體 16 波 Boss 戰公平性（尤以第二關雨港多海妖與第三關櫻峠雙天狗同場時最劇）。
8. **建議新增的回歸測試**：新增前四關多王同場錯峰測試（比照 `tests/stage58-combat-polish-phase-a-20261126.test.cjs`），同時配置 2–3 隻 S1–S4 Boss 連續步進 30 秒，斷言任兩次起手間隔 ≥ 0.75s、任兩次爆發間隔 ≥ 0.35s。

---

#### `P1-04`（P1）後四關 10 首 BGM 已替換但未同步 `production.json`，導致現行回歸失敗且 `yomi__ending.mp3` 時長異常增至 3 分鐘
1. **問題 ID 與嚴重度**：`P1-04`｜**P1（音訊治理／CI 回歸中斷）**
2. **實際位置**：`art/audio/stage58/production.json`、`tests/stage58-audio.test.cjs:143-155`、`tools/serve-tilt.cjs`（`/stage-audio-review/files.json`）、以及 `assets/audio/bgm/stages/{hyakki-kyoto,snow-temple,spirit-ferry,yomi-gate}/*.mp3` 共 10 檔
3. **預期與實際行為**：
   - **預期**：使用者替換後的正式 BGM 應與音訊清冊／製作表一致，`npm run test:current` 全綠，且審片頁可正確顯示每首曲目的時長與響度資訊；第八關終章配樂（`yomi__ending.mp3`）依規格為約 30 秒單次收尾曲。
   - **實際**：使用者已將後四關全部 10 首 BGM 替換為新版 MP3（`ffprobe` 驗證全數 48kHz 立體聲、161–189 kbps、可正常解碼，且 `ASSET_REGISTRY.json` 與 `service-worker.js` 已同步雜湊），但 `art/audio/stage58/production.json` 未更新，導致：
     1. `npm run test:current` 於 `tests/stage58-audio.test.cjs:153` 失敗（首個即報錯 `actual 3936357 !== expected 2108125`）。
     2. 開發審片端點 `/stage-audio-review/files.json` 因 `bytes` 不符而隱藏 10 首 BGM 的 `duration`/`peakDbfs` 中繼資料。
     3. **`yomi__ending.mp3`** 由原本 `27.55s`（`552 KB`）變更為 **`176.85s`（`3.88 MB`）**，作為單次終章演出配樂時長放大 6.4 倍，需與使用者確認是否為刻意長版或誤覆蓋。
4. **重現方式及證據**：
   - 執行 `npm run test:current`：`tests/stage58-audio.test.cjs:143` 報 `AssertionError [ERR_ASSERTION]: 3936357 !== 2108125`。
   - `ffprobe` 實測 10 首 BGM：全數可解碼，時長介於 `143.47s`～`182.16s`，其中 `yomi__ending.mp3` 實測 `176.85s`、`3,878,022 bytes`（`production.json` 原載 `27.55s`、`551,781 bytes`）。
5. **根因或尚待確認的假設**：已確認根因 — 使用者手動替換 10 首新編 BGM 並已跑過 `asset_registry`／SW 更新，但未重新產生或同步 `art/audio/stage58/production.json`。`yomi__ending.mp3` 是否故意拉長至 3 分鐘為**待使用者確認項目**。
6. **建議修復方式**：先向使用者確認 `yomi__ending.mp3` 176.85s 是否為預期終章長版；確認後以工具重新掃描更新 `art/audio/stage58/production.json`（僅更新真實磁碟 `bytes`/`sha256`/`duration`/`peakDbfs`，絕不覆蓋使用者音檔），再驗證 `tests/stage58-audio.test.cjs` 通過。
7. **影響範圍**：現行測試回歸健康度、後四關音訊審片工作台、以及第八關通關終章配樂體驗與載入流量（+3.3 MB）。
8. **建議新增的回歸測試**：既有 `tests/stage58-audio.test.cjs:143` 已能精準捕捉此漂移；建議補充明確列出「所有漂移曲目清單與新舊時長對照」的錯誤訊息，方便日後使用者替換曲目時快速定位。

---

### P2（明顯美術、音訊、UI 或平衡問題）

#### `P2-01`（P2）本機字型 `Yokai UI HanWang YanKai` 缺少 34/152 個核心中文常用字，實機造成明顯混字體排版
1. **問題 ID 與嚴重度**：`P2-01`｜**P2（UI／字型視覺一致度）**
2. **實際位置**：`assets/fonts/PHASE42_TRIAL_FONT_SOURCES.md`、`tools/build-yokai-ui-hanwang.py`、`js/ui-compendium.js:52`（`.local-font`）、`js/ui-compendium.css`、`index.html` 字型載入設定
3. **預期與實際行為**：
   - **預期**：全遊戲介面、夜行典籍、Boss 血條與登場橫幅應以統一楷體呈現，不應在同一個技能名或 Boss 名中出現筆劃粗細與字形風格迥異的系統回退字。
   - **實際**：在無頭 Chromium 針對 152 個遊戲核心字串（十三招名、變異名、八關名、32 波 Boss 名、典籍標題）進行逐字實測：
     - `Yokai UI HanWang YanKai`（本機 GPL 子集）缺少 **34 字（22.4%）**：`弓絡婦毬穴楊鎧矢鋒珠躍逆藤毒渡京山寺骸巖墓蛇錦幡伶嶺獅霜衣姬巫女船籍`。
     - `Yokai Trial MoonStars Kai T`（正式公開預設楷體）為 **0/152 缺字（100% 覆蓋）**。
4. **重現方式及證據**：
   - 見 `scratch/neon-audit-20261127/report.json` `checks.fontGlyphs`。
   - 實機截圖直接目視佐證：
     - `14_compendium_card_hamaya.png`～`14_compendium_card_wind_hole.png`：「破魔・神**弓**」、「**絡**新**婦**・妖絲」、「冰魄・妖**毬**」、「冥風・風**穴**」中粗體楷書與細明體／無襯線回退字交錯。
     - `15_stage7_bosslab.png`：「水鏡**巫女**出現！」、「靈河鎮岸**獅**」明顯跳出粗黑體回退字。
     - `16_stage8_bosslab.png`：「冥門**骸**武者」、「灰火祭**姬**」、「玄**巖墓蛇**」明顯跳字。
5. **根因或尚待確認的假設**：已確認根因 — `tools/build-yokai-ui-hanwang.py` 建置本機 WOFF2 子集時，字表早於第七至十三招與第五至八關 Boss 命名定案，未納入新增 34 字（且依 `AGENTS.md` 四個本機試作 WOFF2 目前授權尚待確認且排除於 Git）。
6. **建議修復方式**：若仍保留本機王漢宗顏楷體方案，應在授權釐清後改以自動掃描 `js/game-catalog.js`、`js/words.js`、`js/game-skill-expansion.js`、`js/story-dialogue.js` 全字表重新子集化，並確認原字庫是否缺罕字（如 `毬`、`骸`、`巖`、`幡`）；或直接統一改用 0 缺字且授權明確之字型方案。
7. **影響範圍**：所有本機／DEV 模式之夜行典籍、Boss 血條、Boss 登場橫幅、升級與結算介面（公開站改用 `MoonStars Kai T` 則無此 34 字缺失）。
8. **建議新增的回歸測試**：新增字型覆蓋檢查腳本（可於字型重編時執行），自動萃取所有技能、變異、關卡、Boss 與 UI 靜態中文字元，斷言目標字型覆蓋率為 100%。

---

#### `P2-02`（P2）第八關第一王重斬矩形特效未處理左／上攻擊方向，且玄巖墓蛇圓形爆裂邊緣硬切
1. **問題 ID 與嚴重度**：`P2-02`｜**P2（Boss 美術接線／預警正確性）**
2. **實際位置**：`js/late-stage-combat.js:248-251`、`js/renderer.js:2092-2106`；相關圖檔 `assets/img/yomi-gate/vfx/yomi-heavy-slash__warning.webp`、`yomi-heavy-slash__impact.webp`、`yomi-cinder-burst__warning.webp`、`yomi-cinder-burst__impact.webp`
3. **預期與實際行為**：
   - **預期**：第八關第一王 `yomi-grave-samurai` 之橫向／縱向重斬應讓預警箭頭與斬擊光束從 Boss 指向玩家方向；第三王 `yomi-grave-serpent` 保留圓形 `yomi-cinder-burst` 特效且邊緣柔和不硬切。
   - **實際**：
     - 確認第三王 `yomi-grave-serpent` 確實保留使用圓形 `yomi-cinder-burst`（`report.json`: `w3UsesCinder: true`），**未被誤替換**。
     - 但第一王重斬貼圖 `yomi-heavy-slash__warning.webp`（768×200）與 `impact.webp`（768×200）具明顯單向方向性（左端起手 -> 右端箭頭／刀氣尖端）。`js/late-stage-combat.js:248-251` 只記錄矩形半寬 `rx`／半高 `ry` 未記錄揮砍方向向量，`js/renderer.js:2092-2106` 僅依 `rx >= ry` 固定旋轉 `0` 或 `+Math.PI / 2`。當 Boss 位於玩家右側（向左斬）或下方（向上斬）時，預警箭頭與刀氣爆發反向指回 Boss 自身。
     - 另像素邊緣掃描顯示 `yomi-cinder-burst__warning.webp` 有 450 顆、`"impact.webp"` 有 716 顆不透明像素直接貼齊圖框邊緣，放大渲染時外緣呈方形硬裁切。
4. **重現方式及證據**：
   - `js/late-stage-combat.js:248-251` 僅設定 `rx`／`ry`；`js/renderer.js:2095` 僅判斷 `const vertical = (h.ry || 0) > (h.rx || 0); ctx.rotate(vertical ? Math.PI / 2 : 0);`。
   - 獨立視覺檢視與邊界 alpha 掃描確認 `yomi-heavy-slash` 具方向性箭頭、`yomi-cinder-burst` 四邊貼框。
5. **根因或尚待確認的假設**：已確認根因 — 矩形區域判定在數學上對稱（±x 與 ±y 相同），因此實作省略了方向角 `angle`，未配合具方向性的新繪重斬美術。
6. **建議修復方式**：在 `js/late-stage-combat.js` 生成重斬區域時依玩家相對 Boss 位置寫入 `angle`（`0`／`Math.PI`／`Math.PI / 2`／`-Math.PI / 2`），並在 `js/renderer.js:2095` 直接以 `h.angle` 旋轉繪製；另於美術修圖階段替 `yomi-cinder-burst` 四周加 8%–12% 羽化留白。
7. **影響範圍**：第八關第一王 `yomi-grave-samurai` 約 50% 攻向之視覺直覺性，及第三王 `yomi-grave-serpent` 圓爆邊緣觀感。
8. **建議新增的回歸測試**：於 `tests/stage58-combat-polish-phase-b-20261126.test.cjs` 新增測試，分別將玩家置於 Boss 四個象限，驗證 `yomi-grave-samurai` 重斬輸出 `angle` 與玩家方向一致（0／π／±π/2）。

---

#### `P2-03`（P2）`spider_silk` 收束引爆以質心為圓心且半徑固定，與長線／變異 `千絲延界` 產生反協同
1. **問題 ID 與嚴重度**：`P2-03`｜**P2（技能機制／變異平衡缺陷）**
2. **實際位置**：`js/game-skill-expansion.js:462-473`（`finishWeb`）、`js/game-attack-specs.js`（`spider_silk` `maxLen` 與 `mut_spider_silk_range`）
3. **預期與實際行為**：
   - **預期**：`spider_silk` Lv5 覺醒「百絲封界：結束時向中心收束切割」與變異 `斷絲回斬`（`mut_spider_silk_return`）應對被絲線綁定的目標或網內敵人造成可靠收尾傷害，且不應因裝備 `千絲延界`（提高最大線長）反而讓收束傷害落空。
   - **實際**：`finishWeb()` 以連線端點質心 `(cx, cy)` 為圓心、固定半徑 `95px`（Lv5）或 `70px`（Lv1–4 `斷絲回斬`）結算收束傷害。然而絲線最大線長於 Lv1–5 為 `175–255px`，搭配 `千絲延界`（×1.25）更高達 `318.75px`。只要兩個端點相距超過 `190px`（Lv5）或 `140px`（Lv1–4），**被絲線連住的兩隻端點本身距質心即超過半徑，收束爆炸對兩個端點造成 0 傷害**。
4. **重現方式及證據**：
   - 程式碼 `js/game-skill-expansion.js:464-467`：`const r = s.awakened ? 95 : 70;`；端點 A `(0,0)` 與 B `(220,0)` 之質心為 `(110,0)`，距 A、B 皆為 `110px > 95px`。
5. **根因或尚待確認的假設**：已確認根因 — 視覺特效 `spider_silk:collapse` 為單一質心圓爆（`176px`），傷害判定套用固定小圓半徑而非「沿各線段切割」或「依網面跨距縮放／保證命中端點」。
6. **建議修復方式**：收束時除了質心區域外，應至少同時對仍存活的連線端點與沿各條現存線段（寬度 `width`）內之敵人結算一次收束傷害（去重每敵一次），即可消除與 `千絲延界` 的反協同且符合「絲網收束」直覺。
7. **影響範圍**：`spider_silk` Lv5 覺醒與 `mut_spider_silk_return`、`mut_spider_silk_range` 雙變異組合的實戰效能。
8. **建議新增的回歸測試**：於 `tests/active-skills-10-13.test.cjs` 新增測試：相距 `240px` 之兩名敵人連上 Lv5 妖絲並持 `mut_spider_silk_range` 後，收束結束時兩端點均應受到收束傷害。

---

#### `P2-04`（P2）新四招四項場內特效存在 2.5D 雙重壓扁、裁切殘留或 Boss 腳底不可見瑕疵
1. **問題 ID 與嚴重度**：`P2-04`｜**P2（美術品質與 2.5D 呈現）**
2. **實際位置**：`js/game-skill-expansion.js:629-638`、`js/game-skill-expansion.js:670-688`、`js/game.js:7156,7163-7166`；對應圖檔：
   - `art/skill-expansion-10-13/vfx/wind-hole__burst__chatgpt.webp`
   - `art/skill-expansion-10-13/vfx/ice-ball__shard__chatgpt.webp`
   - `art/skill-expansion-10-13/vfx/hamaya__draw__chatgpt-final.webp`
   - `art/skill-expansion-10-13/vfx/spider-silk__bind__chatgpt.webp`
3. **預期與實際行為**：
   - **預期**：特效貼圖無裁切碎片、視覺範圍與實際傷害區大致一致、蓄力圖不遮擋玩家、單體束縛在 Boss 身上清晰可見。
   - **實際**（經獨立貼圖像素檢視 + 20 張實機截圖確認）：
     1. **`wind_hole:burst` 雙重壓扁**：原圖（384×384）僅在 `y=95..288`（50% 高度）有像素，已預烘焙成扁橢圓；繪製於 `ground: true` 層再套用 2.5D `scale(1, 0.60)` 後，視覺垂直半徑只剩實際圓形爆發傷害半徑的 **~30%**。
     2. **`ice-ball__shard__chatgpt.webp`（256×62）裁切瑕疵**：直接檢視原圖可見冰晶上方殘留一塊分離的矩形淡藍碎屑，且下緣被水平平切。
     3. **`spider_silk:bind` 於 Boss 腳底幾乎不可見**：`js/game-skill-expansion.js:634` 未給 `radius`，`paint()` 以 `spriteWidths.bind = 50` 畫在 `ground: true` 層，2.5D 壓扁後僅 50×30px，實機截圖 `06_spider_silk_solo_bind.png` 中在大型 Boss 腳下幾近消失。
     4. **`hamaya:draw` 層級與非地面 2.5D 壓扁**：`hamaya:draw` 與玩家同 `y = P.y` 並晚於玩家入列 `actors`（`js/game.js:7156,7165`），其中心為實心暗金圓（`ctrA=252.4`），於 0.25–0.42s 蓄力期間直接疊蓋於玩家腰身；且所有非地面擴充特效（`arrow`、`ball`、`shatter`、`draw`）皆在 `scale(1, 0.60)` 座標系下繪製而未呼叫 `upright()`，造成空中冰球與直立箭矢呈縱向壓扁（對照 `07_ice_ball_flight.png`、`08_ice_ball_shatter.png`）。
4. **重現方式及證據**：
   - 單圖檢視 `ice-ball__shard__chatgpt.webp`、`wind-hole__burst__chatgpt.webp`、`hamaya__draw__chatgpt-final.webp`。
   - 實機截圖 `01_hamaya_draw_nodiag.png`、`06_spider_silk_solo_bind.png`、`08_ice_ball_shatter.png`。
5. **根因或尚待確認的假設**：已確認根因 — `wind-hole__burst` 原圖非正圓俯視；`ice-ball__shard` 為多格裁切殘邊；`spider_silk:bind` 未依目標半徑縮放且放在地面層；`paint()` 未依 2.5D 傾斜係數補償非地面直立件。
6. **建議修復方式**：
   - 清除 `ice-ball__shard__chatgpt.webp` 上方雜屑與修圓底緣；將 `wind-hole__burst` 改為正圓俯視（或繪製時補償縱向縮放 `1/0.60` 使覆蓋區吻合傷害圓）。
   - `spider_silk:bind` 依目標體型（如 `Math.max(56, (target.r || 24) * 2.4)`）縮放並移至非地面層疊於目標腰部，或加外圍絲環。
   - `hamaya:draw` 向前偏移至拉弓方向（`x + cos(angle)*18, y + sin(angle)*14`）並降低中心不透明度，避免正蓋玩家軀幹。
7. **影響範圍**：新四招實戰視覺質感與命中／範圍直覺準確度。
8. **建議新增的回歸測試**：新增靜態貼圖邊界與非空率檢查（檢查碎屑孤島與四邊硬切），並於瀏覽器截圖基準清單加入 Boss 單體 `spider_silk:bind` 與 `wind_hole:burst` 診斷疊圖對照。

---

#### `P2-05`（P2）新四招 HUD 圓槽圖示暗色對比不足、升級卡「絡新婦・妖絲」雙行擠壓、典籍大卡底欄空白
1. **問題 ID 與嚴重度**：`P2-05`｜**P2（UI／美術可讀性）**
2. **實際位置**：`art/skill-expansion-10-13/icons/*.webp`、`js/ui.js:3332`（摺扇圓槽繪製）、`js/ui-upgrade-trial.js`（三選一升級卡名排版）、`js/ui-compendium.js:226-245`
3. **預期與實際行為**：
   - **預期**：左下角摺扇 HUD 四個技能槽在 PC、iPad 與手機橫向（844×390）都應一眼辨識；升級卡與夜行典籍的卡名、類型標籤應完整對齊且不留突兀空槽。
   - **實際**：
     - 實機截圖 `01`、`04`、`07`、`17` 顯示：`spider_silk`（深黑紅蛛網）與 `hamaya`（暗金弓）的 HUD 圖示畫在深藍摺扇圓槽內對比極低，於 `17_phone_landscape_844x390_hud_perf.png`（手機尺寸）幾乎融成黑圓，明顯不如妖刀清晰。
     - 實機截圖 `12_upgrade_cards_expansion.png` 顯示：中卡「絡新婦・妖絲」折成兩行後，上下緊貼金色捲軸邊界與下方藍色 `結網切割` 標籤。
     - 實機截圖 `14_compendium_card_*.png` 顯示：夜行典籍主卡畫框下方的藍色橢圓標籤格全數空白（`ui-compendium.js:228-236` 只填入了上方標題 `.yc-card-name`，未填入類型短籤如 `遠距狙擊`／`結網切割`，反而是把字放在卡片外下方）。
4. **重現方式及證據**：直接檢視截圖 `04_spider_silk_25d_nodiag.png`、`12_upgrade_cards_expansion.png`、`14_compendium_card_hamaya.png`～`14_compendium_card_wind_hole.png`、`17_phone_landscape_844x390_hud_perf.png`。
5. **根因或尚待確認的假設**：已確認根因 — 新四招 HUD 圖示底色過暗且主體未加亮色邊緣／反差光暈；升級卡名 6 字含中點未適當縮小字級；典籍卡框使用與升級卡相同的含藍橢圓空白框，但未將短標籤填入該橢圓內。
6. **建議修復方式**：調亮 `spider_silk`／`hamaya`／`ice_ball` HUD 圖示主體亮度與外發光（或為圓槽內圖示加亮色內襯）；升級卡名於字數 ≥ 6 時微降字級避免雙行頂邊；典籍大卡將角色定位短籤（`遠距狙擊` 等）填入卡框下方藍色橢圓。
7. **影響範圍**：戰鬥 HUD 技能冷卻辨識度（尤其手機／iPad）、升級三選一與夜行典籍視覺完成度。
8. **建議新增的回歸測試**：於 UI 截圖回歸中加入手機 844×390 摺扇區域裁切圖與四招典籍卡檢核。

---

#### `P2-06`（P2）`GAME_SKILL_EXPANSION.trialImages` 缺乏 LRU 淘汰上限，iPad 瀏覽典籍將常駐約 53 MiB 位圖記憶體
1. **問題 ID 與嚴重度**：`P2-06`｜**P2（iPad Safari 記憶體穩定性）**
2. **實際位置**：`js/game-skill-expansion.js:644,658-669`（對照 `js/ui-upgrade-trial.js:16-26` 之 LRU 實作）
3. **預期與實際行為**：
   - **預期**：比照 `js/ui-upgrade-trial.js`（觸控裝置上限 10 張、桌面 26 張）管理高解析卡面解碼快取，避免 iPad Safari 發生 Canvas／WebContent 記憶體壓力或背景閃退。
   - **實際**：`trialImages` 為無上限 `Map`，所有透過 `artImage()` 載入的新四招主卡（4 張）與變異卡（16 張，每張 `802×868` RGBA 約 `2.66 MiB`）連同 17 張特效與 4 張 HUD 圖示永不釋放；僅 20 張卡面即永久占用約 **53.1 MiB** 已解碼記憶體（含全部 41 張約 **62 MiB**），離關或關閉典籍後仍常駐。
4. **重現方式及證據**：檢視 `js/game-skill-expansion.js:644-669`，全程只有 `.set()` 無任何 `.delete()`、上限檢查或 `clear()`；於 `audit_browser.cjs` 瀏覽完典籍與四招後 `trialImages.size` 維持 41。
5. **根因或尚待確認的假設**：已確認根因 — DEV Lab 試作期採最簡快取實作，未區分「戰鬥常駐 VFX／HUD（小圖）」與「典籍／升級卡面（802×868 大圖）」。
6. **建議修復方式**：將卡面（`card:*` 與 `mut_*`）與場內 VFX／HUD 分開快取；卡面快取導入與 `ui-upgrade-trial.js` 相同的 LRU 上限（觸控裝置 8–10 張）並在關閉典籍／進入戰鬥時釋放離屏卡面引用。
7. **影響範圍**：未來新四招解鎖後在 iPad Air M4 Safari 開啟夜行典籍再切回高密度關卡（如雨港、京夜、黃泉）時的記憶體餘裕。
8. **建議新增的回歸測試**：於 `tests/active-skills-10-13.test.cjs` 驗證載入超過上限之卡面後快取大小不超過門檻，且場內 VFX 不受卡面淘汰影響。

---

#### `P2-07`（P2）新四招未納入防抽空保護與解鎖介紹卡機制，未來十三招全開時單招開局取得率僅 40%–47%
1. **問題 ID 與嚴重度**：`P2-07`｜**P2（抽卡池體驗／十三招平衡預警）**
2. **實際位置**：`js/game.js:2065`（`BAMBOO_STARTER_CHOICES`／`withNewSkillVisibility`）、`js/store.js:342`（`pendingSkillIntroduction`／`skillClearStage`）、`js/game-upgrade-choices.js`
3. **預期與實際行為**：
   - **預期**：玩家解鎖新主動技能（10–13 招）後，應與 7–9 招（紫藤毒香、封印釘、式神）一樣享有通關解鎖介紹卡及前期升級抽池可見度保護，避免 13 招全開時多局完全抽不到剛解鎖的新招。
   - **實際**：`BAMBOO_STARTER_CHOICES` 僅列出 `["ink_trail", "seal_nail", "shikigami"]`，`js/store.js:342` 之通關介紹卡對應亦未納入 `hamaya`、`spider_silk`、`ice_ball`、`wind_hole`。以獨立腳本 `audit_balance.cjs` 模擬 2,000 局（13 招全解鎖、正常 4 槽上限、妖刀起手、模擬玩家依一般策略補滿剩餘 3 主動槽），任一特定未持有技能於前 3 主動槽填滿前至少現身 1 次的機率僅 **40.2%–47.1%**（超過半數場次在 4 槽滿前根本見不到該招）。
4. **重現方式及證據**：
   - 程式碼檢視 `js/game.js:2065` 與 `js/store.js:342`。
   - 2,000 局蒙地卡羅模擬結果：13 招抽池合法（0 滿級入池、0 超槽新招、0 雙招／御守污染、每招嚴格 ≤ 2 變異），但 12 個非起手技能均分 3 個空槽時，單招缺席率高達 **53%–60%**。
5. **根因或尚待確認的假設**：已確認根因 — 新四招目前刻意停留在隔離 DEV Lab，尚未串接正式關卡解鎖序（預計 S4–S7 通關解鎖）與對應可見度加權。
6. **建議修復方式**：在正式開放新四招入池前，將 10–13 招納入 `skillClearStage`（四至七關通關解鎖）、`pendingSkillIntroduction` 介紹卡，並擴充 `withNewSkillVisibility` 為泛用「最近解鎖／本局尚未見過之新招保底露臉」規則（不破壞既有機率平衡）。
7. **影響範圍**：未來第五至八關公開後之十三招整體 Build 多樣性與玩家解鎖獲得感。
8. **建議新增的回歸測試**：於 `tests/active-skills-10-13.test.cjs` 預留解鎖序與首局可見度單元測試（於解除隔離時啟用）。

---

#### `P2-08`（P2）雨港暴雨提示與 Boss 登場橫幅於頂部中央座標重疊；手機 844×390 下 DEV 秘術按鈕蓋住暫停鍵
1. **問題 ID 與嚴重度**：`P2-08`｜**P2（HUD 排版衝突）**
2. **實際位置**：`js/game.js:8576-8610`（`bossBanners` 與 `bossCurseRemaining`）、`js/game.js:8706`（雨港暴雨增益提示）、`js/dev-active-skill-lab.css:1-6`（`#active-skill-lab`）
3. **預期與實際行為**：
   - **預期**：頂部中央狀態橫幅、Boss 登場橫幅與天氣提示應自動堆疊不互相覆蓋；手機橫向 844×390 下所有操作鈕（暫停、截圖、羅盤）不應被 DEV 面板收合鈕遮擋。
   - **實際**：
     - `bossBanners` 固定繪於 `y = 68` 起（每行 `+48px`，最多 3 行即 `68..164`，答錯反噬期間下移至 `116..212`），而 `rain-port` 暴雨提示固定繪於 `y = 144`（`js/game.js:8706`），多王登場與暴雨同現時文字直接疊在一起。
     - 實機截圖 `17_phone_landscape_844x390_hud_perf.png`（844×390）顯示，右上角 `▶ DEV 秘術演練`（`top: 8px; right: 8px`）完全蓋住遊戲暫停鍵（`||`）並切到羅盤外框右上角。
4. **重現方式及證據**：
   - 檢視 `js/game.js:8576-8706` 固定 `y` 座標。
   - 實機截圖 `17_phone_landscape_844x390_hud_perf.png` 右上角實況。
5. **根因或尚待確認的假設**：已確認根因 — 頂部中央多條提示各自寫死 `y` 座標而非共用游標累加；DEV 面板固定在右上角未避讓遊戲內右上角羅盤與暫停鈕區域。
6. **建議修復方式**：將頂部中央提示改由單一 `topBannerY` 游標依序往下排版；將 `#active-skill-lab` 改置於頂部中央偏左或底部左側非操作區（僅 DEV 模式有效，不影響正式玩家）。
7. **影響範圍**：第二關雨港多王戰 HUD 可讀性，以及手機橫向 DEV 演練操作便利性。
8. **建議新增的回歸測試**：新增 `844×390` 與 `1280×800` HUD 邊界盒不重疊檢查（檢查暫停鍵、羅盤、頂部橫幅與雨港狀態條）。

---

#### `P2-09`（P2）正式部署目錄 `assets/` 含 65.35 MiB 未轉檔大型 PNG 與 28.36 MiB 精確重複檔
1. **問題 ID 與嚴重度**：`P2-09`｜**P2（載入效能／部署體積與素材治理）**
2. **實際位置**：`assets/`（總計 223.82 MiB／1,421 檔），特別是 60 支 `.png` 檔（65.35 MiB）與 160 組精確重複雜湊檔（28.36 MiB，多為舊路徑相容副本及重複 `BGM.mp3`／`BOSS.mp3`／`MAP.mp3`）
3. **預期與實際行為**：
   - **預期**：正式上線的 `assets/` 應全面以壓縮率佳的 WebP 交付影像、舊路徑相容交由 `js/asset-paths.js` 映射而非實體複製重複檔，避免拖慢行動裝置首次下載與 Service Worker 快取空間。
   - **實際**：
     - `assets/` 仍有 60 支 `.png` 共占 **65.35 MiB**（例：`assets/img/overworld_night_v2.png` 2.96 MiB、`assets/img/ui/exit__blank.png` 2.76 MiB、`assets/img/ui/ui__upgrade-card-frame.png` 1.98 MiB、`assets/img/ui/ui__title-bg.png` 等）。
     - `assets/` 內存在 160 組位元組完全一致的重複檔，多餘占用 **28.36 MiB**（包含舊版 `BGM.mp3`／`BOSS.mp3`／`MAP.mp3` 與新目錄下音檔完全重複，以及多個舊圖路徑副本）。
     - **正面確認**：`art/`（1,506.25 MiB）與 `scratch/`（494.10 MiB）均在 `.gitignore` 內，不會隨 GitHub Pages 正式部署；`assets/` 無意外混入 1.5 GiB 原始圖。
4. **重現方式及證據**：獨立 Python 磁碟與 SHA256 重複掃描（詳見第四節 G 磁碟分類表）。
5. **根因或尚待確認的假設**：已確認根因 — 歷史遷移期間依 `AGENTS.md` 安全規則保留了未完全確認接線的舊 PNG 與別名副本；部分高解析 UI／大世界圖尚未完成 PNG → WebP 批次轉換。
6. **建議修復方式**：依 `docs/ASSET_CONVENTIONS.md` 分批確認舊路徑已全由 `js/asset-paths.js` 轉接後，將 60 支大型 PNG 轉為高品質 WebP（預估可省 45–55 MiB），並將 160 組確認不再直連的重複副本移除（預估可省 ~28 MiB），同步重跑 `asset_registry.py` 與 `build-media-cache.cjs`。
7. **影響範圍**：行動裝置與 iPad Safari 首次載入速度、Service Worker 離線快取容量（目前 1,353 檔）與部署體積。
8. **建議新增的回歸測試**：於素材治理腳本加入 `assets/` 單檔體積警告門檻（如圖片 > 1.5 MiB）與新增重複檔警示。

---

#### `P2-10`（P2）音訊缺檔、未節流備援疊音與第八／七關新攻擊缺專屬 SFX
1. **問題 ID 與嚴重度**：`P2-10`｜**P2（音訊完整度與混音風險）**
2. **實際位置**：`js/game-skill-expansion.js:704-708`、`js/game.js:3366`、`js/audio.js:517-521`（`unprovidedSfx`）、`js/stage58-audio.js`、`js/late-stage-combat.js`
3. **預期與實際行為**：
   - **預期**：新四招 14 支專屬 SFX（或暫用備援）皆應不疊音、無明顯音量突刺；第七關泥濘池踏泥與第八關重斬應有貼合音效。
   - **實際**：
     - **新四招 14 支專屬 SFX 均尚未建檔**，全部走 `playCue()` 備援：`release`/`open` 播 `boomerang.mp3`（無冷卻節流），其餘全部播合成 `AUDIO.impact()`（90ms 節流）。`js/game.js:3366` 傳入的第 4 參數 `elapsed` 被 `playCue(audio, id, event)` 忽略；裝備 `雙弦連射`（0.14s 連發兩箭）或 `二重風穴` 時會連續重疊播放兩次 `boomerang.mp3`，且 `wind_hole` 吸怪全程無持續風聲循環。
     - **後四關實裝缺口**：57 支新增 SFX 檔案全數存在且可解碼，但第八關第一王改用新重斬特效後仍沿用 `yomi-cinder-burst` 音效（無刀斬音效）；第七關泥濘池尚無減速／踏泥音效。
     - **前四關既缺清單**：`js/audio.js:517-521` 仍有 8 條 `unprovidedSfx`（`slashBase`、`needleBase`、`needleMax`、`inkTrailDrop`、`inkTrailHit`、`inkTrailEcho`、`rainPortWaterSlamWarn`、`rainPortWaterSlamImpact`）處於未提供音檔狀態。
4. **重現方式及證據**：檢視 `js/game-skill-expansion.js:704-708`、`js/audio.js:517-521`，並檢索 `assets/audio/sfx/skills/` 確認僅有 `ink-trail`、`seal-nail`、`shikigami` 目錄，無 `hamaya`／`spider-silk`／`ice-ball`／`wind-hole` 目錄。
5. **根因或尚待確認的假設**：已確認根因 — 新四招 14 支 SFX 尚在待產階段，暫用 `playCue` 未實作 `elapsed` 節流。
6. **建議修復方式**：在專屬 SFX 完成前，先於 `playCue(audio, id, event, elapsed)` 加入同事件 120ms 節流防止雙箭／雙風穴疊音；依規劃補齊新四招 14 支 SFX、第八關重斬 SFX 與第七關踏泥 SFX（注意絕不將 Sonniss 素材送入生成式 AI）。
7. **影響範圍**：新四招連發時之聽覺舒適度、第七／八關新機制回饋感與全作音效一致性。
8. **建議新增的回歸測試**：新增 `playCue` 節流單元測試，連續 50ms 內呼叫兩次 `release`/`open` 僅觸發一次外部音效播放。

---

### P3（整理、維護性及非必要改善）

#### `P3-01`（P3）`tests/asset-registry.test.cjs` 在 Windows 沙盒 `python` 回傳 `EACCES` 時未回退至 `py -3`
1. **問題 ID 與嚴重度**：`P3-01`｜**P3（測試可攜性）**
2. **實際位置**：`tests/asset-registry.test.cjs:70-77`
3. **預期與實際行為**：
   - **預期**：當環境中 `python` 無法執行時自動改用 `py -3`，使 `npm run test:current` 在 Windows 各終端與沙盒環境一致通過。
   - **實際**：第 74 行僅檢查 `scan.error?.code === "ENOENT"`，而 Windows Store App Execution Alias 無法存取時回傳 `EACCES`，導致未觸發 `py -3` 回退而讓測試失敗（手動執行 `py -3 tools/asset_registry.py --check` 1,360 檔全數 PASS）。
4. **重現方式及證據**：於 Windows 沙盒執行 `npm run test:current`，報 `asset-registry.test.cjs:70` `spawnSync python EACCES`；改跑 `py -3 tools/asset_registry.py --check` 回傳退出碼 0。
5. **根因或尚待確認的假設**：已確認根因 — 條件遺漏 `EACCES` 與 `EPERM`。
6. **建議修復方式**：將第 74 行改為 `["ENOENT", "EACCES", "EPERM"].includes(scan.error?.code)`。
7. **影響範圍**：Windows 本機／CI／沙盒執行 `npm run test:current` 的穩定性。
8. **建議新增的回歸測試**：以 mock `spawnSync` 驗證回傳 `EACCES` 時正確切換至 `py -3`。

---

#### `P3-02`（P3）`ice_ball:ball` 首幀旋轉跳變與夜行典籍提前開啟的 `loadArt()` 競態
1. **問題 ID 與嚴重度**：`P3-02`｜**P3（輕微視覺細節／邊界競態）**
2. **實際位置**：`js/game-skill-expansion.js:350,646-651,684`、`js/game.js:607`
3. **預期與實際行為**：
   - **預期**：冰球從發射首幀起平滑自轉；任何時刻開啟夜行典籍皆立即顯示新四招卡圖。
   - **實際**：
     - `ice_ball` 建立時 `spin: 0`，`paint()` 第 684 行寫 `ctx.rotate(effect.spin || angle || 0)`。因 JS 中 `0` 為 falsy，第 1 幀旋轉角套用飛行方向 `angle`，第 2 幀 `spin ≈ 0.13` 變成 truthy 而瞬間跳回 `0.13` rad。
     - `js/game.js:607` 開啟頁面時非同步呼叫 `loadArt()`，若在 `manifest.json` 尚未 fetch 完成前即開啟夜行典籍，新四招圖片路徑一時回傳 `null` 且完成後無主動重繪通知。
4. **重現方式及證據**：程式碼直讀 `js/game-skill-expansion.js:350,684` 與 `js/game.js:607`。
5. **根因或尚待確認的假設**：已確認根因 — truthy 運算子誤判 `spin === 0`；`loadArt()` 缺少載入完成事件或重繪鉤子。
6. **建議修復方式**：改為 `effect.spin ?? angle ?? 0`；於 `loadArt()` 解析完成後若典籍已開啟則觸發一次 `compendium.refresh?.()`。
7. **影響範圍**：冰球發射第 1 幀極短跳動與極慢網路下瞬間開典籍的邊界情境。
8. **建議新增的回歸測試**：於 `active-skills-10-13.test.cjs` 檢查 `spin: 0` 時旋轉值為 `0` 而非 `angle`。

---

#### `P3-03`（P3）`game-skill-expansion.js` 每幀陣列與空間網格物件配置可進一步池化
1. **問題 ID 與嚴重度**：`P3-03`｜**P3（微效能優化／GC 減壓）**
2. **實際位置**：`js/game-skill-expansion.js:116-126`（`grid.rebuild`）、`js/game-skill-expansion.js:628-639`（`visuals`）
3. **預期與實際行為**：
   - **預期**：在 iPad Safari 60fps 戰鬥中盡量減少每幀短期陣列／物件垃圾回收。
   - **實際**：每次執行 `visuals(P)` 皆配置新陣列 `[...draw, ...arrows, ...balls, ...shards, ...flashes]`，每幀 `grid.rebuild()` 清空並重建數十個 cell 陣列，另 `position()` 每次回傳新 `{x,y}` 物件。雖因技能上限受控（最多 2 箭、2 球、14 碎片、3 絲線、1 風穴、16 閃光、查詢上限 96）在桌面端影響極低，但與 80 怪疊加時仍增加 iPad 短期 GC 頻率。
4. **重現方式及證據**：程式碼檢視 `js/game-skill-expansion.js:116-126, 628-639`。
5. **根因或尚待確認的假設**：已確認根因 — 採函式式簡潔寫法優先，尚未做陣列複用。
6. **建議修復方式**：於 `create()` 閉包內預配 `visualBuf` 與 cell 陣列池，每幀改以 `.length = 0` 重用。
7. **影響範圍**：iPad Safari 長時間（10 分鐘滿局）95th 百分位幀時穩定性。
8. **建議新增的回歸測試**：確認重用緩衝後 `visuals()` 不互相污染前後幀狀態。

---

#### `P3-04`（P3）`art/` 重複解壓縮包、多份清冊備份、大型壓縮檔、根目錄殘留誤觸檔與已忽略檔案殘留 Git 索引
1. **問題 ID 與嚴重度**：`P3-04`｜**P3（倉儲與磁碟衛生）**
2. **實際位置**：
   - `art/skill-expansion-10-13/yokai-c1-c2-card-pack/`（62.66 MiB）與 `yokai-c3-c4-pack/`（17.01 MiB）
   - `art/skill-expansion-10-13/manifest.pre-chatgpt-*.json`（3 份備份）
   - `art/phase42-qwen21-calibration/.../*.7z,.zip`（77.10 MiB）與 `scratch/font-v2/sources/*.zip`（59.27 MiB）
   - 專案根目錄未追蹤檔 `-Destination`（0 bytes，明顯 PowerShell 指令拼錯殘留）與 `debug.log`
   - Git 索引仍追蹤 3 份已被 `.gitignore` 忽略之 `art/stage2-rain-port/archive/legacy-pebble-ground-20261101/*.webp`
3. **預期與實際行為**：
   - **預期**：開發區不應堆積近 216 MiB 重複解壓縮包與壓縮原檔，根目錄無誤建零位元組檔，Git 索引不含 `/art/` 舊封存圖。
   - **實際**：上述冗餘合計占約 **216 MiB** 本機磁碟空間，並使 `git status` 雜訊增加。
4. **重現方式及證據**：獨立目錄體積與 `git ls-files art/`、`git status --porcelain` 掃描（本輪依規未刪除任何檔案）。
5. **根因或尚待確認的假設**：已確認根因 — 多輪快速接圖、字型試驗與 PowerShell 腳本執行後尚未做收斂整理。
6. **建議修復方式**：待使用者確認後：(1) 移除根目錄 0-byte `-Destination` 與 `debug.log`；(2) 將 `yokai-c1-c2-card-pack`、`yokai-c3-c4-pack`、`manifest.pre-chatgpt-*.json` 與大型 `.7z/.zip` 移出工作樹至外部封存或清理；(3) `git rm --cached` 移除 3 筆殘留於索引的 `art/stage2-rain-port/archive/` 檔案。
7. **影響範圍**：本機磁碟空間、搜尋效能與未來提交乾淨度（不影響線上網站執行）。
8. **建議新增的回歸測試**：無需測試；提交前執行 `git status --short` 核對即可。

---

#### `P3-05`（P3）`index.html` 多支已修改 JS 檔案仍沿用舊版 `?v=` 快取查詢參數
1. **問題 ID 與嚴重度**：`P3-05`｜**P3（發版快取風險）**
2. **實際位置**：`index.html` 中多行 `<script src="js/...?..."></script>`，例如已修改但仍掛舊日期的 `js/kyoto-procession.js?v=20261121-kyoto-actors`、`js/words.js?v=20261125-boss-schedule-unified`、`js/config.js?v=20261125-boss-schedule-unified`、`js/game-combat-math.js?v=20261125-boss-schedule-unified`、`js/world.js?v=20261126-stage56`、`js/late-stage-combat.js?v=20261126-stage78` 等
3. **預期與實際行為**：
   - **預期**：發版前所有有實質改動的 JS／CSS 均應更新 `?v=` 與 `service-worker.js` 快取版本，避免 iPad Safari 混載新舊模組產生語法或介面不相容。
   - **實際**：工作樹 27 支修改 JS 中多數仍掛 `20261121`～`20261126` 標籤（目前尚未發版，因此屬發版前須同步項目）。
4. **重現方式及證據**：比對 `git diff --name-only` 與 `index.html` 全數 `?v=` 參數。
5. **根因或尚待確認的假設**：已確認根因 — 多日連續本機開發尚未進入發版收口步驟。
6. **建議修復方式**：下次發版前統一更新所有異動檔案的 `?v=` 並重跑 Service Worker 快取建置腳本。
7. **影響範圍**：下次正式部署至 GitHub Pages 後之舊裝置 Safari 客戶端快取刷新。
8. **建議新增的回歸測試**：於發版前檢查腳本比對 `git diff` 異動之 JS／CSS 是否皆已更新 `index.html` 對應 `?v=`。

---

#### `P3-06`（P3）未提交工作樹龐大且含大量 LF／CRLF 混用警告
1. **問題 ID 與嚴重度**：`P3-06`｜**P3（版本控管維護性）**
2. **實際位置**：整個工作樹（`master` 領先 `origin/master` 4 筆提交；目前 `M`: 71 檔、`??`: 139 項；35 支以上檔案觸發 Git `LF will be replaced by CRLF` 警告）
3. **預期與實際行為**：
   - **預期**：階段完成後應以清晰主題切分提交並統一換行符設定（`.gitattributes`），降低多 Agent 協作誤覆蓋與 diff 雜訊。
   - **實際**：目前單一 dirty 工作樹同時混合了後四關戰鬥打磨、後四關音訊、新四招 10–13 接線、夜行典籍改版、字型試作與數十支工具腳本。未發現已發生的檔案互相覆蓋或語法衝突，但持續疊加將提高回退難度。
4. **重現方式及證據**：`git status --porcelain` 與 `git diff --stat`。
5. **根因或尚待確認的假設**：已確認根因 — 近期多輪高密度實作均依守門規則暫緩提交。
6. **建議修復方式**：待本報告 P1／關鍵 P2 修復與使用者實機驗收後，依模組拆分為 3–4 筆乾淨提交（核心引擎／後四關打磨／音訊清冊／新四招隔離 Lab），並補上 `.gitattributes` 鎖定 LF。
7. **影響範圍**：版本歷史可追溯性與後續修復合併風險。
8. **建議新增的回歸測試**：無需測試。

---

## 四、重點專題審查總結（A～G 覆蓋明細）

### A. 新四招 41 份素材與戰鬥接線清查
- **41 / 41 全數實際載入且零死接線**：
  - 4 張主卡 + 16 張變異卡：透過 `ui-upgrade-trial.js` 與 `ui-compendium.js` 載入，升級三選一與典籍圖片／名稱完全一致。
  - 4 張 HUD 圖示：經 `js/ui.js:3332` `drawDiegeticSkillFan -> drawEmblem` 顯示於左下摺扇。
  - 17 張戰鬥 VFX：全數對應至 `js/game-skill-expansion.js:674-688`（含最新 `spider_silk:thread` 水平細絲與 `hamaya:draw` 蓄力圖）；`spider_silk:bind` 僅在單端點模式（`web.solo === true`）繪製，實測已驗證觸發。
- **生命週期清理確認**：`js/game.js` 於 `start()`（328）、重試／切換（1482、1689）、死亡（2528）、勝利（2595）、離開關卡（8266）均呼叫 `expansionSkills?.reset()`；暫停與答題期間 `update()` 不步進，且 `holdExpansion`（5167）正確呼叫 `expansionSkills?.suspend()`，**無殘留特效或延遲傷害洩漏**。
- **待修視覺／玩法點**：詳見 `P1-01`、`P1-02`、`P2-03`、`P2-04`、`P2-05`、`P3-02`。

### B. 十三招整體戰鬥系統與 Build 檢核
- **規則一致**：13 主動招 × 4 變異 = 52 變異資料完整一致；妖刀起手、4 槽上限、每招 Lv5 上限、每招每局最多 2 變異、0 雙招與 0 御守入池、融合停用、第五格鎖定全部通過驗證。
- **數值與 Build 觀察（不擅改數值）**：
  - `hamaya`（狙王型）與 `wind_hole`（聚怪型）職責清晰且互補，但 `wind_hole` Lv5 + `二重風穴` 對普通怪吸控極強（單局高怪潮時配合 `katana`／`seal_nail` 形成極高清怪效率），且因 `P1-01` 觸發大量粒子／浮字，建議實機驗證是否過強或過吵。
  - `spider_silk` 在 `P2-03` 未修前，與 `千絲延界` 存在負協同。
  - `shikigami`（第九招）：AI 追敵、普通怪仇恨（不嘲諷 Boss）、不可取送貨／代答、死亡重生與 Lv5 黑犬外觀邏輯均完整（回歸測試全過）。
  - 13 招全開時缺防抽空機制（見 `P2-07`）。

### C. 八關 32 波 Boss 與關卡流程（含 S5／S6 第三王獨立 ID 影響盤點）
- **統一四王排程**：全八關皆驗證通過 3:00／6:00／8:00／9:00 出場、最多三王同場、尾王需擊殺任一前王且只生成一次、四王全滅勝利、零配送可通關、第八關專屬終章。
- **已驗證實作正確之近工項目**：
  - 第七關沉鐘鬼將泥濘池：2.5 秒、0.78 倍移速、不疊加、不打斷衝刺、`ferry-mud-pool__impact.webp`（384×384）實載成功，繪製半徑與減速判定半徑一致。
  - 第八關第三王 `yomi-grave-serpent` 維持圓形 `yomi-cinder-burst`，未被重斬誤替換；黃泉偏心赤月與半血追加攻擊正常。
- **主要缺口**：前四關多王缺錯峰（`P1-03`）、第八關第一王重斬方向未翻轉（`P2-02`）。
- **【預先盤點】第五、六關第三王（已知未完成）未來接入獨立 ID 時之必改清單**：
  1. 美術資源表：`js/kyoto-scene-art.js`、`js/snow-temple-art.js`、`docs/stage-art-review/assets.json`、對應關卡 `manifest.json` 與 `docs/ASSET_REGISTRY.json`。
  2. 戰鬥模組：`js/kyoto-procession.js`、`js/snow-temple-combat.js`（特別注意第 6 關第三王目前靠 `attack === "frost-bell"` 分支辨識守門者，接入獨立 ID 後須同步調整判斷）。
  3. 音效路由：`js/stage58-audio.js`（`bosses` 對應表）與 `js/audio.js:991`（`<actor>-crossing` 事件路由）。
  4. **本機開發伺服器白名單**：`tools/serve-tilt.cjs:102,107` 具嚴格正規表達式白名單，新增第三王 ID 若未加入白名單將直接回傳 **HTTP 403**。
  5. 測試檔：至少 5 支現行測試檔（`stage5-hyakki-kyoto`、`stage58-combat-polish-phase-a/b`、`stage58-audio`、`stage-art-review` 等）需同步更新角色 ID 斷言。

### D. 美術與 UI
- 夜行典籍分組、固定排序與未解鎖防劇透（`？？？` + 封印卡背）正常。
- 字型缺字實證（`P2-01`）、卡名擠壓與典籍空藍欄（`P2-05`）、雨港橫幅與手機 DEV 鈕重疊（`P2-08`）。
- 殘留幾何／Canvas 繪圖盤點（區分合法備援與需留意項）：
  - `js/renderer.js:2114-2122`：S7 槳掃／潮湧高對比預警於 raster 上疊加 `strokeRect`（刻意對比補強）。
  - `js/game.js:6493-6520`、`7085-7103`：貼圖未載入或失敗時的安全幾何備援（符合 `AGENTS.md` 安全底線）。
  - `js/ui.js:2582-2595`：第五主動槽鎖頭為 Canvas 基本幾何（未來開放前維持可接受）。

### E. 音效與 BGM（含前四關改為獨立 Boss BGM 之修改範圍）
- **前四關 BGM**：4 首一般曲 + 第 1 關備援曲 + 共用最終 Boss 曲 `boss__encounter.mp3`（90.10s / 320 kbps）全數存在且 `ffprobe` 可解碼。
- **後四關 10 首 BGM + 57 支 SFX**：全數存在且可解碼；10 首 BGM 與 `production.json` 漂移（`P1-04`）。
- **答題／暫停音訊行為**：`js/audio.js` 正確處理答題降音／暫停淡出與回復；無明顯死循環。
- **新四招 14 支 SFX**：尚未建檔，暫走 `boomerang`／`impact` 備援（`P2-10`）。
- **【預先盤點】前四關改為獨立 Boss BGM 之必要修改範圍**（絕不自動覆蓋或生成音樂）：
  1. `js/audio.js`：擴充 `STAGE_BOSS_BGM_FILES`（為 `night-town`、`rain-port`、`sakura-pass`、`bamboo-maze` 各自映射專屬 Boss BGM，保留 `boss__encounter.mp3` 作缺檔備援），同步更新 `selectStageBgm`、`prepareBossMusic`、`startBossMusic`、`musicTracks`、`updateBgm`。
  2. `js/assets.js` 與 `js/asset-paths.js`：登錄 4 首新音檔鍵名與相容路徑。
  3. `docs/ASSET_REGISTRY.json` 與 `service-worker.js`（經 `tools/build-media-cache.cjs`）：補齊雜湊與離線快取清單。
  4. `tests/audio-events.test.cjs` 與 `tests/asset-registry.test.cjs`：補齊四關獨立 Boss 曲切換驗證。

### F. 效能與穩定性（聚焦 iPad Air M4 Safari）
- 桌面無頭 Chromium 驗證：41 份新圖與全關卡切換無背景消失、無 Canvas 狀態錯亂、無 Console Error；但桌面結果**不能取代實體 iPad Air M4 Safari 驗收**。
- 主要 iPad 風險集中於三處：
  1. `P1-01`：`wind_hole` 每 0.25s 觸發 16–32 敵之非節流粒子／震動／浮字尖峰。
  2. `P2-06`：`trialImages` 無 LRU 淘汰導致 20 張 802×868 新卡常駐 ~53 MiB 位圖記憶體。
  3. `P2-09` 與 `P3-03`：`assets/` 65 MiB 大圖 PNG 與 `game-skill-expansion.js` 每幀陣列配置。
- 2D 與 2.5D 模式差異：`wind_hole:burst` 在 2.5D 下雙重壓扁、非地面擴充特效未經 `upright()` 補償（`P2-04`）。

### G. 素材治理與磁碟占用估算

| 類別 | 路徑範圍 | 檔案數 | 磁碟占用 | 性質分類與建議 |
| --- | --- | ---: | ---: | --- |
| 正式必要素材（優化後主體） | `assets/`（扣除 PNG 膨脹與重複副本） | ~1,201 | ~130.11 MiB | **正式必留**（隨網站部署） |
| 正式區未壓縮 PNG | `assets/**/*.png` | 60 | 65.35 MiB | **建議轉 WebP**（`P2-09`） |
| 正式區精確重複副本 | `assets/` 內 160 組重複雜湊 | ~160+ | 28.36 MiB | **確認接線後可整併**（`P2-09`） |
| DEV 候選（新四招啟用 + 相關原稿） | `art/skill-expansion-10-13/`（扣除重複解包） | — | 100.83 MiB | **DEV 候選／原稿保留**（Git 忽略） |
| DEV 重複解壓縮包與舊備份清冊 | `yokai-c1-c2-card-pack` + `yokai-c3-c4-pack` + `manifest.pre-chatgpt-*` | — | 79.67 MiB | **可封存／清理候選**（`P3-04`） |
| 其他原始美術與歷史候選 | `art/` 其餘子目錄（含 77.10 MiB `.7z/.zip`） | ~3,500+ | 1,325.75 MiB | **原稿保留，`.7z/.zip` 可外移封存**（Git 忽略） |
| 暫存驗證／截圖／字型來源 | `scratch/`（含 59.27 MiB 字型 `.zip`） | 1,141 | 494.10 MiB | **可分批封存清理**（Git 忽略） |
| 程式／文件／測試／工具 | `js/` + `docs/` + `tests/` + `tools/` | — | 23.14 MiB | **正式開發區保留** |

---

## 五、已知未完成項目（不重複列為未知缺陷）

1. **第五、六關第三王獨立造型與獨立角色 ID**：目前仍與各該關第一王共用 ID；`art/yokai-late-boss-art-pack/` 與 `art/yokai-final-art-candidates/` 雖有待機／蓄力／攻擊候選圖，但造型前後不一致尚未核准接入（影響範圍已盤點於第四節 C）。
2. **新四招 14 支專屬 SFX**：目前未建檔，暫走 `boomerang`／`impact` 備援。
3. **前四關各自獨立 Boss BGM**：使用者正在自行製作 BGM，目前仍共用 `boss__encounter.mp3`（修改範圍已盤點於第四節 E）。
4. **第七、八、九、十～十三招卡面與場內美術真人最終審核**：目前 10–13 招全數隔離於 DEV Skill Lab，第七、八招暫用 WebP 已在線上但未經本人最終原畫定案，第九招式神仍在 DEV 旗標隔離。
5. **本機四支試作字型（WOFF2）授權釐清**：依 `assets/fonts/PHASE42_TRIAL_FONT_SOURCES.md` 仍排除於 Git。

---

## 六、無法自動驗證、必須真人實機試玩的項目

1. **實體 iPad Air M4 Safari 實機效能與穩定性**：
   - 雨港、京夜、黃泉三王同場 + 滿 80 怪 + 512 靈玉 + 裝備 `wind_hole`／`spider_silk` 時之真實 FPS（是否維持 ≥ 46 FPS 最低與 ≥ 51 FPS 平均）。
   - 開啟夜行典籍滑遍 13 招與 52 變異卡後再返回戰鬥，觀察是否出現記憶體警告、背景消失、貼圖閃爍或 Safari 標籤重整閃退。
2. **觸控／手把／鍵盤跨裝置手感**：
   - iPad 與手機橫向（844×390）下摺扇技能圖示辨識度、衝刺鈕誤觸率、答題面板觸控反應、以及手把巡覽夜行典籍與升級三選一的手感。
3. **主觀視覺、混音與戰鬥手感評定**：
   - 新四招 41 份 ChatGPT 美術在實戰動態下的風格一致性、節奏爽感與辨識清晰度。
   - 使用者新替換的 10 首後四關 BGM（特別是 176.85s 之 `yomi__ending.mp3`）與 57 支 SFX 之實際響度平衡與情緒銜接。
   - 第七關泥濘池減速體感與第八關重斬閃避公平性、終章破曉演出節奏。

---

## 七、建議修復順序

1. **第一批（立即修復 — 清除 CI 紅燈與高風險實戰缺陷）**：
   - `P1-04`：向使用者確認 `yomi__ending.mp3` 長度後同步 `art/audio/stage58/production.json`（並順手修 `P3-01` `asset-registry.test.cjs` `EACCES` 回退），讓 `npm run test:current` 恢復 **100% 全綠**。
   - `P1-02`：將新四招 `effect.ground` 移至 Boss 預警與送貨區下方繪製並補上 `nearView` 裁剪。
   - `P1-01`：將 `wind_hole`／`spider_silk` 週期傷害與單次爆發分流，套用粒子／震動／浮字節流。
2. **第二批（戰鬥公平性與技能體驗修正）**：
   - `P1-03`：為第一至四關 Boss AI（`boss-ai.js`、`boss-sakura.js`、`bamboo-combat.js`）補齊 0.75s／0.35s 多王錯峰。
   - `P2-02`：為第八關第一王重斬加入方向角並翻轉貼圖方向；修整 `yomi-cinder-burst` 邊緣羽化。
   - `P2-03`：修正 `spider_silk` 收束範圍使連線端點與線段必定吃滿傷害，解除與 `千絲延界` 反協同。
3. **第三批（美術細節、UI、字型與記憶體打磨）**：
   - `P2-04` + `P2-05` + `P3-02`：修補 `ice-ball__shard` 裁切、`wind_hole:burst` 縱向補償、`spider_silk:bind` Boss 尺寸縮放、`hamaya:draw` 偏移、HUD 圓槽圖示提亮、升級卡名微縮、典籍底欄補籤與冰球首幀旋轉。
   - `P2-06` + `P3-03`：為擴充卡面加 LRU 淘汰與熱路徑陣列複用。
   - `P2-08`：改為動態頂部橫幅游標避免雨港重疊，並移開手機端 DEV 秘術按鈕。
   - `P2-01`：解決本機字型 34 字缺失或統一改採 0 缺字正式楷體。
4. **第四批（公開前準備與倉儲整理）**：
   - `P2-07` + `P2-10`：公開新四招前接上解鎖序、介紹卡、防抽空保護與 14 支專屬 SFX（或先補 `playCue` 節流）。
   - `P2-09` + `P3-04` + `P3-05` + `P3-06`：大圖 PNG 轉 WebP、去重舊副本、清理重複壓縮包與根目錄垃圾檔、統一 `?v=` 與分批提交。

---

## 八、完成度評分總表

### 1. 八關各自完成度評分（滿分 100）

| 關卡 | ID | 評分 | 評分依據 |
| --- | --- | :---: | --- |
| 第一關・夜行鎮 | `night-town` | **87** | 核心流程、美術、音訊與 iPad 基準最成熟；扣分：多王缺錯峰（`-6`）、共用 Boss BGM（`-4`）、部分舊 SFX 未提供（`-3`） |
| 第二關・雨港 | `rain-port` | **84** | 正式美術／四支 Boss 語音／iPad 優化已完成；扣分：多王缺錯峰（`-6`）、暴雨提示與 Boss 橫幅重疊（`-4`）、共用 Boss BGM（`-4`）、水擊 SFX 缺口（`-2`） |
| 第三關・櫻峠 | `sakura-pass` | **83** | 路線森林、四王與交付循環完整；扣分：多王缺錯峰（`-6`）、共用 Boss BGM（`-4`）、共用／待補音效與未經最終實機驗收（`-7`） |
| 第四關・竹林迷徑 | `bamboo-maze` | **82** | 迷徑佈局與四王排程到位；扣分：多王缺錯峰（`-6`）、共用 Boss BGM（`-4`）、部分敵人／技能後續銜接與待真人驗收（`-8`） |
| 第五關・百鬼京夜 | `hyakki-kyoto` | **75** | 場景、錯峰、多區去重與專屬音檔到位；扣分：第三王尚與第一王共用 ID（`-10`）、BGM 清冊漂移（`-4`）、公開門禁鎖定與待 iPad 實測（`-11`） |
| 第六關・雪峰古寺 | `snow-temple` | **75** | 場景、錯峰與專屬音檔到位；扣分：第三王尚與第一王共用 ID（`-10`）、BGM 清冊漂移（`-4`）、公開門禁鎖定與待 iPad 實測（`-11`） |
| 第七關・靈河渡口 | `spirit-ferry` | **80** | 獨立四王、沉鐘鬼將泥濘池（2.5s／0.78×）與新特效接線完整；扣分：泥濘無踏泥 SFX（`-3`）、BGM 清冊漂移（`-4`）、部分預警仍疊幾何框線（`-3`）、未公開與待實測（`-10`） |
| 第八關・黃泉比良坂 | `yomi-gate` | **80** | 獨立四王、赤月、半血追加、重斬／玄巖墓蛇正確分流與破曉終章完整；扣分：重斬方向未翻轉＋墓蛇爆裂硬切（`-5`）、終章 176.85s BGM 與清冊漂移（`-5`）、重斬沿用舊音效（`-2`）、未公開與待實測（`-8`） |

### 2. 十三招各自完成度評分（滿分 100）

| # | 技能名 | ID | 評分 | 評分依據 |
| :-: | --- | --- | :---: | --- |
| 1 | 妖刀・斬 | `katana` | **94** | 固定起手、手感／命中頓幀／四變異／正式圖音最完整；扣分：少數基礎斬擊音檔在 `unprovidedSfx`（`-3`）、待全十三招平衡終驗（`-3`） |
| 2 | 靈符・護陣 | `barrier` | **92** | 護盾邏輯、四變異與正式圖音成熟；扣分：極端多王與 iPad 長局終驗待補（`-8`） |
| 3 | 狐火・鬼燈 | `fire` | **92** | 追蹤／灼燒與四變異穩定；扣分：終局平衡與跨裝置終驗待補（`-8`） |
| 4 | 爆裂・符咒 | `boom` | **91** | 範圍爆發與四變異穩定；扣分：高密度粒子與十三招整體數值對照待終驗（`-9`） |
| 5 | 陰陽・天雷 | `thunder` | **92** | 鎖定落雷與四變異完整；扣分：終局平衡與跨裝置終驗待補（`-8`） |
| 6 | 妖針・齊射 | `needle` | **89** | 彈幕邏輯與四變異穩定；扣分：`needleBase`／`needleMax` 在 `unprovidedSfx`（`-5`）、終驗待補（`-6`） |
| 7 | 紫藤毒香 | `ink_trail` | **82** | 玩法重製（拖尾毒香＋Lv5 混亂＋節流）程式扎實；扣分：暫用卡面待原畫定案（`-8`）、3 條 SFX 在 `unprovidedSfx`（`-5`）、待本人 iPad 實機終驗（`-5`） |
| 8 | 距爆・封印釘 | `seal_nail` | **84** | 自動離位引爆與四變異穩定且專屬 SFX 已建目錄；扣分：暫用衍生拼合卡面待原畫核准（`-10`）、待本人實機終驗（`-6`） |
| 9 | 靈獸・式神 | `shikigami` | **78** | AI、仇恨、四變異與黑犬素材已實作且測試通過；扣分：仍在 DEV 隔離未進正式卡池（`-10`）、正式卡面／完整音效／實機驗收待辦（`-12`） |
| 10 | 破魔・神弓 | `hamaya` | **74** | 核心狙王／貫穿／41 圖全接線；扣分：無專屬 SFX 與雙射疊音（`-7`）、`draw` 蓋玩家與 HUD 偏暗（`-5`）、未開放正式池與缺保底（`-10`）、字型缺「弓楊鎧矢」（`-4`） |
| 11 | 絡新婦・妖絲 | `spider_silk` | **68** | 連線／減速／水平細絲實載；扣分：收束反協同 `P2-03`（`-7`）、地面層蓋預警＋未節流 `P1-01/02`（`-7`）、Boss 單體 `bind` 不可見＋HUD 過暗＋卡名擠壓（`-6`）、無專屬 SFX（`-5`）、未開放正式池（`-7`） |
| 12 | 冰魄・妖毬 | `ice_ball` | **74** | 彈跳／碎裂傷害與特效明確；扣分：無專屬 SFX（`-7`）、`shard` 裁切瑕疵與首幀旋轉跳變（`-5`）、2.5D 未 `upright()`（`-4`）、未開放正式池與缺保底（`-10`） |
| 13 | 冥風・風穴 | `wind_hole` | **67** | 聚怪核心與主漩渦觀感佳；扣分：0.25s 未節流粒子／震動／浮字 `P1-01`（`-10`）、地面層蓋 Boss 預警與送貨區 `P1-02`（`-7`）、`burst` 雙重壓扁（`-5`）、無專屬 SFX／持續風聲（`-5`）、未開放正式池（`-6`） |

### 3. 專案整體完成度評分與扣分依據

> **專案整體完成度評分：79 / 100**

| 扣分面向 | 扣分 | 具體依據 |
| --- | :---: | --- |
| 戰鬥核心與多王整合缺陷（P1） | **-6** | `P1-01` 風穴／妖絲未節流（-2）、`P1-02` 地面層蓋 Boss 預警（-2）、`P1-03` 前四關缺多王錯峰（-2） |
| 音訊治理與缺口（P1 + P2） | **-4** | `P1-04` 後四關 10 首 BGM 清冊漂移致回歸紅燈（-2）、`P2-10` 新四招 14 支 SFX 缺檔＋前四關共用 Boss BGM 與 8 條靜音缺口（-2） |
| 已知未完成正式美術與門禁隔離 | **-5** | 第五至八關與第 9–13 招尚未正式公開（-2）、S5／S6 第三王尚缺一致造型與獨立 ID（-2）、第七／八招正式原畫待審核（-1） |
| UI／字型／特效精修與記憶體治理（P2） | **-4** | `P2-01` 本機字型缺 34 字（-1）、`P2-02/03/04/05` 重斬方向＋妖絲反協同＋特效裁切與 HUD 對比（-2）、`P2-06/09` 擴充卡圖無 LRU＋`assets/` 大圖 PNG 與重複檔（-1） |
| 實體裝置真人驗收尚未完成 | **-2** | 實體 iPad Air M4 Safari、手機橫向與手把尚未經真人完整跑關驗收（-2） |
| **合計** | **-21** | **100 - 21 = 79 / 100** |
