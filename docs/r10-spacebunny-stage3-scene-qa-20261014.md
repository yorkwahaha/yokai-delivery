# R10 獨立 QA：第三關神樂殿＋腐化古櫻場景（Space Bunny Free，2026-10-14）

> 作者：OpenCode Space Bunny Free Personal（Herdr w5:p4）｜獨立 QA，**不沿用 Cursor 自測**（artifacts/validation/codex-lead-20261014-cursor/stage3-scene/ 只是參考，不算我的驗證）
> 工具：自架 `127.0.0.1:9218`（另 9238／9248／9258 跑破圖與晚載），**沒有動既有 8788**；沿用同一條 dev 路徑 `?dev=1&stage=sakura-pass` 但用**真按鈕點擊**（Input.dispatchMouseEvent 點「開發選關」→「直接進關」）
> 音訊：`/assets/audio/*` 全部 204 空回應、`js/audio.js` 靜音 stub → 零音檔位元組、零 TTS／API
> 部署狀態：**未 Commit／未 Push／未 Deploy**｜本輪未改任何 production／assets／art／Cursor 新檔

---

## 0. 總結

| 分類 | 數量 | 重點 |
| --- | --- | --- |
| **PASS** | 30（主跑）+ 6（破圖）+ 30（晚載） | 兩張 WebP hash／尺寸／service-worker revision 全對；4 視口真 Chrome 都觀測到 shrine_pavilion 與 ancientSakura 的**實際 drawImage**；第一/二關實戰畫面 0 次外洩；缺圖與晚載都不混用第一關屋型、不出幾何假屋 |
| **FAIL** | 0 | — |
| **BLOCKED** | 0 | — |
| **HUMAN_REVIEW** | 2 | ①**神社同圖大量重複**（最需要人審，見 §4）②古櫻與答題板的關係需實機答題狀態才能驗 |

---

## 1. 靜態（我的離線核對）

**S1 PASS — 兩張 WebP 與候選原圖位元組相同**

| 檔案 | bytes | 尺寸 | sha256 前綴 | 與候選圖 | service-worker revision |
| --- | --- | --- | --- | --- | --- |
| `shrine_pavilion.webp` | 82218 | 470×440（合交接文件） | `835fe17a73cf1af4…` | **相同**（`candidate_building_shrine_pavilion.webp`） | 相符 |
| `landmark_corrupted_sakura.webp` | 138578 | 460×460（合交接文件） | `7dd88ec821357769…` | **相同**（`candidate_landmark_corrupted_sakura.webp`） | 相符 |

→ revision 等於檔案 sha256 前綴，**離線快取不會拿到 stale 圖**（本輪未發現 stale）。

**S2 PASS — loader 契約**：`SAKURA_SCENE_ASSETS` 只有 `pavilion`／`ancientSakura` 兩角色；`refreshSakuraScene()` 在 `js/game.js` 只出現一次（進 `sakura-pass` 時）；`SAKURA_ART_STATUS` 有 ready/error；renderer 用 `SAKURA_ART?.pavilion`／`?.ancientSakura`；缺圖分支只畫「神社圖載入中／失敗」文字，**不改畫第一關町屋／稻荷社、也沒有幾何房子**。
`index.html` 版本：`world.js/assets.js/renderer.js/dev-mode.js` 同一版本字串（`game.js` 因 dev-mode 接線另有版本，屬進行中狀態）。

**S3 PASS — 第三關範圍**：`js/world.js` 只有 `sakura-pass` 產生 `bType:"shrine_pavilion"` 與 `decor.ancientSakura`（規則 `mod(cx*2+cy*3,5)===0`，腳點 `baseY+72` 在區塊北緣）；`sakura-terrain-plan.js` **沒有**接進 renderer → 地面仍是現役三圖。
**S3b HUMAN_REVIEW**：`world.js:142` 的 `sakuraTrees` 只排除 rain-port，所以第三關 chunk 資料裡**仍會生成 20 筆第一關 `prop_sakura`**；但 `js/game.js:2918` 在繪製層明確 `STAGE.id === "sakura-pass" ? [] : chunk.decor.sakuraTrees`，實測第三關 `prop_sakura` **draw 次數為 0** → 視覺無外洩。不過這是「資料生成、繪製排除」的雙重條件，哪天有人改到 `game.js:2918` 就會突然長出第一關櫻花樹。建議（低優先）：第三關直接不生成那 20 筆資料。

---

## 2. 真 Chrome（4 視口 × 進關／步行／鏡頭翻轉）

進入方式：**真按鈕**點「開發選關」→「直接進關」（`Input.dispatchMouseEvent`，非 JS `.click()`），dev 面板下拉選單確認 `sakura-pass` 後進關。

| 檢查 | 結果 | 實測 |
| --- | --- | --- |
| V1 真 drawImage（非 DOM／Image.complete） | **PASS ×4** | 桌機 2D 神社 40／古櫻 8；桌機 2.5D 80／8；平板模擬 2D 48／8；平板模擬 2.5D 80／8，**全部落在主畫布** |
| V2 資產與 chunk 範圍 | **PASS ×4** | 神社圖 470×440；視野 25 chunk 內神社 75 間、古櫻 5 棵（0.20/chunk，符合每 5 chunk 一棵）、鳥居關閉 |
| V3 古櫻稀疏、不壓玩家 | **PASS ×4** | 最近一棵離玩家 2485px 以上，沒有壓在玩家身上 |
| V4 古櫻不進碰撞 | **PASS** | 古櫻腳點 ±90px 取樣 49 點，碰撞實心 **0** → 不影響房屋互動／通行 |
| V5 步行／鏡頭翻轉／新 chunk | **PASS ×4** | 步行 760px 後神社仍 32–64 次 draw；2D↔0.60 翻轉後 24–48 次 draw，沒有漏畫。**誠實補充**：activeChunks 固定 25（視窗式 streaming），我用「步行後仍持續畫出新區塊內容」佐證，不是用 chunk 數量增加佐證 |
| V6 地面仍是現役三圖 | **PASS ×4** | `sakuraTileRole` 回 `["dirt","dirt","dirt","transH","steps","steps"]`，場景接入沒動地面，也沒有偷接 2D 自由區域 |

**接地／陰影／深度（我人工看圖確認）**：`ss-desktop-1280x800-2d-entry.png`、`ss-tablet-sim-1194x834-25d-walk.png` — 神社基座坐在地面、屋簷投影落在地面、地面有柔和陰影；前景神社正確畫在玩家之後、背景神社不會壓住玩家。古櫻樹冠稀疏、未壓住右下衝刺鈕。

---

## 3. 第一/二關與非 dev

| 檢查 | 結果 | 實測 |
| --- | --- | --- |
| V7 非 dev 不掛開發面板 | **PASS** | 沒有 `?dev=1` 時 `dev-stage-picker` 不存在、`window.DEV_TOOLS` 未定義 |
| V8 sakura-pass 非預設解鎖 | **PASS** | `CONTENT.getStage('sakura-pass').unlockedByDefault === false`（需由 rain-port 解鎖） |
| V9 night-town 實戰畫面 | **PASS** | 神社 0 次、古櫻 0 次；截圖 `ss-nondev-night-town.png` |
| V9 rain-port 實戰畫面 | **PASS** | 神社 0 次、古櫻 0 次；截圖 `ss-nondev-rain-port.png` |
| V12 iPad 聲明 | **HUMAN_REVIEW** | 1194×834 是 **桌面模擬視口（viewport simulation）**，本輪沒有實體 iPad |

---

## 4. 人審重點：神社同圖重複（**本輪最需要人審的畫面問題**）

**具體畫面**：`artifacts/validation/spacebunny-r10-stage3-scene-20261014/ss-tablet-sim-1194x834-25d-walk.png`（平板模擬 1194×834、2.5D、步行後）。

**我看到的**：同一個畫面裡同時有 **5–6 座外觀完全相同的神社**——屋頂形狀、柱子、門窗、白色基座一模一樣，只有大小因透視略有差異。`js/world.js:115-116` 讓第三關**每一間房子都是 `shrine_pavilion`**，沒有任何變體選擇，所以玩家往任何方向走都是同一張圖反覆出現。在 2.5D 遠景下特別明顯，觀感接近「貼圖重複」而不是「一整條神社參道」。這比上一輪地板 512 重複更顯眼（建築面積大、重複密度高）。

**最小修正建議（依優先，我不自行改素材）**：
1. **首選**：AGY 出 2–3 張變體（不同朝向／角度／附屬物，例如一張帶石燈籠、一張帶拜殿簷廊），程式端在 `world.js` 依 `mod(cx*2+cy,3)` 或 slot 選 `shrine_pavilion` 的 a/b/c → 只動一行分派。
2. **次選（不用新圖）**：沿用第一關町屋的做法，對同一張圖依座標做**左右翻轉 + 0.92–1.0 輕微縮放**，即可消除「整齊複製」的機械感。程式端在 `drawHouse` 的 shrine 分支加一個依 `h.id` 雜湊的 `scaleX/scale`，屬 one-line 級。
3. **不建議**：靠加深陰影或色調差異去掩蓋，建築輪廓仍然會重複。

另外：右上方雷達盤會遮住右上角神社的招牌，這是既有 HUD 位置，非本輪問題。

---

## 5. 缺圖與晚載（不混用第一關屋型、不出幾何假屋）

| 情境 | 結果 | 實測 |
| --- | --- | --- |
| 神社圖 404（`--breakAsset=shrine_pavilion`） | **PASS** | `SAKURA_ART_STATUS.pavilion === "error"`；**第一關屋型 draw 次數 0**；`whiteRatio 0.00222`（無白色幾何補圖）；畫面只留「神社圖載入失敗」文字。截圖 `ss-desktop-1280x800-2d-shrine_pavilion.png` |
| 圖延遲 1200ms（`--delay=1200`） | **PASS** | 延遲期間第一關屋型 draw **0** 次、無幾何假屋；圖到位後神社 60 次／古櫻 6 次**自動畫出，不需重啟**。截圖 `…-during-delay.png` → `…-after-ready.png` |

> 工具鏈：全程 0 個音檔位元組（`/assets/audio/*` 204）、Audio 只記錄事件名、Chrome 0 未捕捉例外。

---

## 6. 尚未能獨立驗收、需人審或下一步補的

1. **古櫻 vs 答題板**：本輪沒有進入「接單→答題」狀態，所以無法自動驗證樹冠不會壓住答題板。**最小 repro**：dev 進 `sakura-pass` → 走到任一神社（那就是委託屋）→ 接單並進入答題，觀察畫面下方中央的答題板是否被古櫻／神社遮住；重點看樹腳在區塊北緣（`baseY+72`）的排布是否真的遠離南側答題墊。
2. **古櫻稀疏的視覺印象**：量化是 0.20 棵/chunk（合規則），但「每 5 個 chunk 一棵、走 760px 只遇到 5 棵」是否讓山道顯得空曠，需人審（截圖裡古櫻只出現 1 棵）。
3. **神社重複**（§4）是本輪主要視覺建議。
4. 實體 iPad 未驗；V 垂直過渡、小怪、Boss 仍不在本輪範圍。
5. 第三關尚未做「自然十分鐘通關」與地板 P0 那種連續畫面人審，本輪只做場景層。

---

## 7. 產出與重跑

- 新測試：`tests/spacebunny-stage3-scene.acceptance.cjs`（只讀 harness，HTTP 層注入；不碰 production）
- 證據：`artifacts/validation/spacebunny-r10-stage3-scene-20261014/`（`evidence-9218-none.json` 主跑、`evidence-9248-shrine_pavilion.json` 破圖、`evidence-9258-none.json` 晚載、qa-log-*.txt、run-*-console.log、ss-*.png 真截圖）
- 重跑：

```
node tests/spacebunny-stage3-scene.acceptance.cjs --port=9218                     # 4 視口 + 非 dev + 污染抽查
node tests/spacebunny-stage3-scene.acceptance.cjs --port=9248 --breakAsset=shrine_pavilion   # 缺圖
node tests/spacebunny-stage3-scene.acceptance.cjs --port=9258 --delay=1200         # 晚載
node tests/spacebunny-stage3-scene.acceptance.cjs --port=9218 --only=desktop-1280x800-2d    # 單視口快跑
```