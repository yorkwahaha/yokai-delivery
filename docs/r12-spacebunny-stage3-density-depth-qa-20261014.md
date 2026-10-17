# R12 獨立最終 QA：第三關建築密度 3→1 ＋ 2.5D 景深增強

> 作者：OpenCode Space Bunny Free Personal（Herdr w5:p4）｜**獨立驗收，未改任何 production**
> 執行時間：2026-10-14｜實作文件：`docs/stage3-density-depth-20261014.md`（已存在，閘門解除）
> 工具：專用伺服器 `127.0.0.1:9278`（CDP 9279，**未動既有 8788**）、音訊全 HTTP 204、`js/audio.js` 靜音 stub、零 TTS／API
> 部署狀態：**未 Commit／未 Push／未 Deploy**｜未改 js／art／assets／audio／index／既有 tests／AGENTS／roadmap／交接

---

## 0. 結論

| 分類 | 數量 | 內容 |
| --- | --- | --- |
| **PASS** | **24** | 靜態 4、密度 2、幽靈碰撞 2、切換不變性 2、配送 2、景深分層 2、閃爍 2、第三關維持 2、隔離 4、音訊／例外 2 |
| **FAIL** | **0** | — |
| **HUMAN_REVIEW** | **3** | ①遠景神社景深是否「足夠有感」（桌機）②同（平板模擬）③1194×834 只是模擬視口 |
| **BLOCKED** | **0** | — |

**程式面全部達標**：密度 3→1、世界層生效、2D↔2.5D 不重抽世界、無幽靈碰撞、配送點未消失、第一／二關隔離完好、C1／C2 未回退。

**視覺面我不代裁**：景深「夠不夠明顯」標 HUMAN_REVIEW，交使用者看第 4 節兩張圖決定。我不宣稱美術合格。

---

## 1. 用戶指定驗收項 → 實測結果

| 用戶要求 | 結果 | 可復現證據 |
| --- | --- | --- |
| Stage3 實體房屋每 chunk **3→1** | ✅ PASS | 固定 12 個 chunk 取樣，兩個視口都是 `[1,1,1,1,1,1,1,1,1,1,1,1]`，平均 **1.00**，12/12 命中 |
| Night-town／Rain-port **仍 3** | ✅ PASS | 兩關各 25 個 chunk 全為 `[3,3,3,…,3]`，平均 3.00；且自家地板圖仍在畫面上（`ground_dirt.webp` 276／279 次 draw、`ground_stone_var1.webp` 20 次） |
| 同一局房屋 ID／solids／job 完全一致 | ✅ PASS | 同一位置（cam 900,594.5）切 2D↔0.60：**房屋 ID 25↔25 完全相同**（如 `sakura-pass:-1,-1:0`）、碰撞網格逐點相同、委託狀態相同（`from 0,0:0 → to 0,-1:0`） |
| 無幽靈碰撞 | ✅ PASS | chunk(-1,0) 50px 網格 216 點、實心 6 點，其中「離最近房屋 >150px 的幽靈牆」**0 點** |
| 無配送點消失 | ✅ PASS | 往東走 6 個 chunk（x=2250→6750）後，真 `makeOrder()` 仍產得出委託（桌機 `sakura-pass:2,1:0 → 2,0:0` 詞「はる」；平板 `2,2:0 → 2,1:0` 詞「ひる」） |
| **C1／C2 新系統不回退** | ✅ PASS | 我**獨立**跑 `node --test tests/card-delivery-runtime.test.cjs`：**15 tests / 15 pass / 0 fail**（不採信 Cursor 自述） |
| 同 seed／相同 camera 2D vs 2.5D 對照 | ✅ PASS | A/B 同一 world 位置，cam 與 tilt 全記錄於 evidence（例：2D `cam 900,594.5 / tilt 1 / scale 1.333`；2.5D `cam 900,405.4 / tilt 0.6`，camY 差是投影高度 600→1000 的正常偏移，非重抽） |
| 遠近大小／blur／墨線 | ⚠️ **HUMAN_REVIEW** | 遠景帶銳度 15.0（桌機）／12.8（平板）< 近景 26.6／23.4，HUD 扇形 51.5／50.0 遠高於遠景。**是否足夠有感交使用者看圖**（第 4 節） |
| 玩家／HUD 字清晰 | ✅ PASS | HUD 扇形銳度 52.1／49.4、燈油 34.1／37.4，**都遠高於遠景帶** → HUD 沒被景深壓糊 |
| 初載／camera 橫移不閃爍 | ✅ PASS | 鏡頭連續平移 18 步（每步 22px），相鄰幀地面帶平均差：桌機 min 102.2／中位 106.8／**最大 114.4**；平板 104.7／107.3／**116.2** → **無尖峰** |
| 跨 chunk／其它關隔離 | ✅ PASS | 見上表；另第三關自身三圖地板與古櫻未受影響（見第 3 節 D8b） |
| 地板 H 方案未破壞 | ✅ PASS | 第三關地面三張仍在畫面：`ground_mountain_dirt` / `ground_trans_dirt_to_steps_h` / `ground_sakura_steps`；`sakuraTileRole(0..5)=["dirt","dirt","dirt","transH","steps","steps"]` 與改動前一致 |
| Chrome headless 7 幀不可當真機 FPS | ✅ 已遵守 | 我**沒有**記任何 FPS 數字；只量「相鄰幀差值有無尖峰」，不推論真機效能 |

---

## 2. 我自己 harness 的缺陷紀錄（不掩飾）

首輪跑出 **3 個 FAIL，全部是我 harness 的 bug，不是 production 缺陷**。已逐一修正，**沒有任何一次是放寬門檻來製造 PASS**（門檻 `平均 ≤1.15、每區 ≥1、命中 ≥8/12、far < near×0.95、HUD ≥ far、最大差 < max(24, 中位×4)` 全程未動）：

| # | 症狀 | 真因 | 修法 |
| --- | --- | --- | --- |
| 1 | D1 判 FAIL（明明量到 `[1,1,1,1]` 平均 1） | 我用「算 chunk 原點」比對，但 `chunkHeight` 會被 `spacingScaleY` 縮放（`world.js:64`），只命中 4/12 | 改用**包含關係**找 chunk（`c.x ≤ x < c.x+c.w`），命中 12/12 |
| 2 | D2 靜靜「略過」還報 PASS | `r.houses` 是數字，我寫成 `r.houses.length` → 永遠找不到樣本 | 修型別，並讓「找不到樣本」判 **FAIL** 而非略過 |
| 3 | S2 判 FAIL | 正則視窗 400 字元，但 Cursor 在 `houses=[]` 與 `houses.push` 間加了中文註解，實際 **448** 字元 | 視窗改 900，**語意不變**（仍要求：房屋在世界生成階段決定 + renderer 無 `houses.filter(` + `drawHouse` 仍在） |
| 4 | D5 拋 TypeError，連帶炸掉第二個視口 | `band2d.far.sharpness` 未防護，帶資料為 null 就 throw | 逐欄安全取值；缺欄位判 FAIL 不 throw |
| 5 | D6 開始 SyntaxError | 我把模板字串寫成**單引號**，`${}` 不展開 | 改回反引號（`grep` 全檔確認僅此一處） |
| 6 | 靜態檢查 ReferenceError | 訊息字串裡誤用瀏覽器全域 `stage.id` | 改為字面文字 |

另外兩項強化（不影響門檻）：每個視口獨立 `try/catch` 並**中途落盤 evidence**，單一視口爆掉不會吃掉另一個視口、也不會遺失已量到的資料。

---

## 3. 逐項證據摘要

**S2 密度是世界層，不是顯示篩選** ✅
房屋在 `js/world.js` 的 chunk 生成階段決定（`sakura-pass` 分支只 `push` 1 間，id 維持 `stage.id:cx,cy:slot` 格式）；`renderer.js` **沒有** `houses.filter(`。→ 世界資料與碰撞同步下降，實測 D2 幽靈牆 0 點。

**S3 景深實作路徑** ✅
`sceneryDepth()`（`renderer.js:142`）：山道且 tilt ≤0.97 且 `depthMode≠off` 才啟用；`scale = 1 − t×0.12`、`blur = t²×2.6`（`?depth=enhanced` 為 0.15／3.2、`reach` 440）；2D 一律 `scale 1 / blur 0`。

**D5 分層實測（桌機 1280×800）**
| 帶 | 銳度 | 飽和度 | 白塊比 |
| --- | --- | --- | --- |
| 2.5D 遠 | **17.13** | 0.130 | 0 |
| 2.5D 中 | 45.28 | 0.332 | 0.004 |
| 2.5D 近 | 23.21 | 0.171 | 0 |
| HUD 扇形 | **52.07** | 0.408 | 0.003 |
| HUD 燈油 | 34.18 | 0.408 | 0.024 |
| 2D 遠／近（對照） | 25.17／35.36 | — | — |

> ⚠️ **必須說明的混淆**：中景帶（45.28）比近景帶（23.21）更銳，**因為中景帶有神社建築、近景帶是地面**，不是深度反轉。所以「遠 17.13 < 近 23.21」只支持「遠景帶更平緩」，**不足以當成景深曲線**。飽和度倒是符合預期（遠 0.130 → 近 0.171 → HUD 0.408，HUD 最高、遠景最低）。這也是我把最終判定推到 HUMAN_REVIEW 的原因之一。

**D7 遠景神社探針（人審用）**
玩家置於神社正南方 **380 世界單位**（神社 -579,2622；玩家 -579,3002），讓神社確實落在遠景帶：
- 桌機：遠景帶銳度 **15.00** < 近景 **26.61**，HUD 扇形 **51.46**，cam 25D `-1029,2505`
- 平板模擬：遠景帶 **12.77** < 近景 **23.35**，HUD 扇形 **50.03**，cam 25D `-1029,2505`

**D8b 第三關自身維持** ✅
地面三圖仍在上畫面、`sakuraTileRole(0..5)=["dirt","dirt","dirt","transH","steps","steps"]`、本視野古櫻 5 棵、社祠 sprite 有 draw。

**D9 音訊守門** ✅
`/assets/audio/*` 請求 **0 個**（全程 49 個請求皆非音訊），`js/audio.js` 為 stub（只記錄呼叫名稱：`prepareMusic`／`restartMusic`／`init`／`updateBgm`），**零位元組、零 TTS／API**、未讀任何現役 MP3。

---

## 4. 交使用者裁決的畫面（景深是否足夠有感）

| 檔案 | 內容 |
| --- | --- |
| `sd-desktop-1280x800-25d-north-shrine.png` | **桌機 2.5D，遠景神社探針**（畫面上方遠神社 vs 右下近神社，同一張圖可直接比較） |
| `sd-desktop-1280x800-2d-north-shrine.png` | 同位置 2D 對照 |
| `sd-tablet-sim-1194x834-25d-north-shrine.png` | 平板模擬 2.5D 同場景 |
| `sd-*-2d-depth.png` / `sd-*-25d-depth.png` | 同位置 2D／2.5D 密度＋景深 A/B（4 張） |
| `sd-*-isolation-night-town.png` / `sd-*-isolation-rain-port.png` | 第一／二關隔離（4 張） |
| `sd-*-flicker-end.png`、`sd-*-stage3-continuity.png` | 閃爍末幀、第三關地板／古櫻維持（4 張） |

**我的觀察（僅陳述，不代替裁決）**：遠景神社確實**較小且墨線較軟**，近景神社木版紋理清晰，遠景偏冷偏暗、近景偏暖，HUD（提燈 98/100、拖曳移動扇、衝刺鈕、雷達、計時 105s）全部銳利。密度問題已明顯改善——畫面上不再出現 5–6 間同款神社。

**需要你裁決的三點**：
1. 遠景神社的柔化與縮小是否**足夠有感**，又不會讓墨線細節消失到看不出是神社？
2. **遠景神社的「神社」招牌是否仍可辨**？（我的畫面上遠景招牌跟著建物一起變軟，這點我無法用數值判定，需要你放大看。）
3. 古櫻與答題板的遮擋是否可接受（本輪只驗到樹沒有壓到房屋碰撞盒）。

---

## 5. 本輪未實測（明標，不當成通過）

1. **無實體 iPad**：1194×834 只是桌面模擬視口（viewport simulation）。
2. **無自然十分鐘通關**：本輪是受控取樣（固定 12 個 chunk 探針 + 走 6 個 chunk），不是自然遊玩。
3. **不記 FPS**：headless 的幀率不代表真機，我沒有產出任何 FPS 數字。
4. **未壓慢網路**：本輪沒做 late-load 壓測（第三關圖未新增，風險低）。
5. **畫面中的角色半透明是我 harness 的假象**：我設 `P.inv=600`（無敵）避免測量中被打死，無敵閃爍相位讓角色呈半透明。**不是美術缺陷**，請勿誤判。
6. **美術合格仍需圖片級人工審**：本報告的 PASS 全是程式／量測面，**不等於第三關美術合格**（依 `docs/art-asset-only-standard.md` 第 6 節第 4 條）。

---

## 6. 產出與重跑

- 測試：`tests/spacebunny-stage3-density-depth.acceptance.cjs`（唯一 owner：我的 harness）
- 證據：`artifacts/validation/spacebunny-r12-stage3-density-depth-20261014/`
  - `evidence-9278.json`（逐項數值、cam/tilt/時間戳、house ID、碰撞網格、委託、drawImage 來源統計）
  - `qa-log-9278.txt`、`run-final5.log`（最終 PASS 24／FAIL 0／HUMAN_REVIEW 3）
  - `run-final.log`～`run-final4.log`（**保留**，含我 harness 缺陷的失敗紀錄，不刪不改）
  - 16 張截圖（8 張／視口）
- 重跑：

```powershell
node tests/spacebunny-stage3-density-depth.acceptance.cjs --port=9278
```
（閘門仍有效：`docs/stage3-density-depth-20261014.md` 若被移除，腳本會拒絕判定並輸出 WAITING_FOR_CURSOR_IMPLEMENTATION）