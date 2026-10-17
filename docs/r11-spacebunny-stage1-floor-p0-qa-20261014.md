# R11 獨立 QA：第一關 night-town 初載地板 P0（Space Bunny Free，2026-10-14）

> 作者：OpenCode Space Bunny Free Personal（Herdr w5:p4）｜獨立 QA，未改任何 production
> 工具：專用伺服器 `127.0.0.1:9268`（CDP 9269，**未動既有 8788**）、音訊全部 HTTP 204、`js/audio.js` 靜音 stub、零 TTS／API
> 部署狀態：**未 Commit／未 Push／未 Deploy**｜未改 js／assets／art／index／既有 tests／AGENTS／roadmap／交接

---

## 0. 結論：**NOT_REPRODUCED**（在桌面 Chrome + 模擬視口下未能重現「先錯數秒再變對」）

| 分類 | 數量 | 內容 |
| --- | --- | --- |
| **PASS** | 17 | 靜態 1、冷啟 4 視口 ×3 項、screencast 連續幀 2 視口、音訊 0 位元組、無未捕捉例外 |
| **FAIL** | 0 | — |
| **BLOCKED** | 0 | — |
| **HUMAN_REVIEW** | 2 | ①靜態讀碼看到的三個 terrain 快取風險點（未觸發）②1194×834 只是模擬視口 |

> **我不宣稱使用者核准**。以下只是「在我這個環境、用可重現的方式沒有重現」，且第 5 節列出仍不能關閉的缺口。

---

## 1. 量測方法（先說清楚，因為這決定結論可信度）

1. **真冷啟動**：`Network.setCacheDisabled(true)`＋全新 chrome profile，導航後不熱身。
2. **真 rAF**：不進 `?mode=det`（det 模式會把 `requestAnimationFrame` 打成空，畫面根本沒渲染，量到的會是空白畫布）。
3. **兩套取樣**：
   - **點狀取樣**（`Page.captureScreenshot` + 畫布 `getImageData`）：用來算接縫剖面。**誠實聲明：每次取樣往返成本 1–3 秒**，所以標稱 0/3/10 秒實際拿到的是 **約 1.0s／9.8s／12.8s**（桌機 2D）、**0.48s／18.5s／24.2s**（桌機 2.5D）。我沒有偽稱 0ms。
   - **CDP screencast 連續幀**：`Page.startScreencast(everyNthFrame:1)`，由瀏覽器在**每幀產生時**推送，才能拿到真正的開場。**進關後第一幀落在 startStage 後 22ms（桌機 2D）／29ms（平板模擬 2.5D）**。
4. **接縫判準（螢幕空間，不需要世界座標換算）**：取一段以地板為主的水平帶，算相鄰欄平均色的差值序列，再比較「落在磚週期（含 ±2px）的差值中位數」與「磚內差值中位數」的**比值**。**比值 ≈1 代表磚界線在畫面上不可辨（無縫）**；比值 ≫1 才是拼接線。自動偵測到的「週期」常是紋理裡的花瓣／碎石小重複（32/48px），不是磚縫，所以只當參考。

---

## 2. 靜態（F1 PASS）

- 第一關地板圖 `assets/img/scenery/ground_dirt.webp`：**512×512、134446 bytes**，service-worker revision 等於檔案 sha256 前綴 → 無 stale。
- `js/words.js` 第一關 `visual.ground = "ground_dirt"`。
- **F2 HUMAN_REVIEW（讀碼所得的三個風險點，本輪皆未觸發）**：
  1. `drawGroundBase` 的 **`scrollReuse`** 路徑：鏡頭移動時把舊 `terrainCv` 以 `dx,dy` 位移重用、只補新露出的邊帶。若位移與繪製邊界的整數取整錯位，會短暫錯拼。
  2. 每次重繪區域前的 `c.fillRect` 底色：若磚圖覆蓋不滿會露出底色。
  3. 快取鍵含 `image/imageWidth/portStamp/sakuraStamp`：圖晚到會整塊重畫（晚載路徑本輪未壓測，見缺口）。

---

## 3. 真 Chrome 結果（4 視口 × 冷啟／切鏡／傾斜）

| 檢查 | 桌機 1280×800 2D | 桌機 1280×800 2.5D | 平板模擬 1194×834 2D | 平板模擬 1194×834 2.5D |
| --- | --- | --- | --- | --- |
| P0a 冷啟接縫比（磚邊／磚內） | 0.95／0.96／1.03 | 1.06 | 0.97／0.97／0.88 | 0.99／0.77／1.05 |
| P0b 鏡頭跳 1400px 後（700ms 起） | 0.91 | 1.09／1.02／0.94 | 1.39／1.40／1.37 | 0.95／0.97／1.00 |
| P0c 2D↔0.60 切換後 | 0.79 | 0.90 | 0.97 | 0.96 |
| 背景色佔比（最低幀） | 0.156 | 0.473※ | 0.159 | 0.173※ |
| 白塊／大面積純色比例最高 | 0.0016／0.0015 | 0.0015／0.0004 | 0.0015／0.0015 | 0.0016／0.0014 |

※ 2.5D 的高背景佔比出現在**開場前 0.5 秒**，那時畫面還在主選單／封面，不是空白地板；點狀取樣的第一幀實際在 424–1254ms。

**結論**：所有比值落在 **0.77–1.41**，也就是**磚界線與磚內紋理在畫面上不可區分**；沒有任何視窗出現「先錯、幾秒後才對」的轉變；白塊與大面積純色比例都在 0.16% 以下，**沒有色塊／幾何替代物**。

**關鍵視覺證據（進關後第一個遊戲畫面）**：`f1-desktop-1280x800-2d-cast-cast-001-enter+415ms.png` —— 那一幀地板已經是完整的手繪石板＋土路，**沒有空白、沒有幾何替代、看不到拼接線**；畫面偏暗是標題卡的進場壓暗（`fadeT`／標題卡），不是地板沒畫。

---

## 4. 代表性畫面（最多 8 張，NOT_REPRODUCED 證據）

| # | 檔案 | 情境（**實際時間**） |
| --- | --- | --- |
| 1 | `f1-desktop-1280x800-2d-cast-cast-001-enter+415ms.png` | **桌機 2D 進關後第一個遊戲畫面**（enter+415ms）— 地板已完整 |
| 2 | `f1-desktop-1280x800-2d-cast-cast-003-enter+800ms.png` | 同上，標題卡淡出中（enter+800ms） |
| 3 | `f1-desktop-1280x800-2d-cold-10s.png` | 桌機 2D 穩態（**實際 12.8s**） |
| 4 | `f1-desktop-1280x800-2d-camera-jump-0000ms.png` | 鏡頭一次跳 1400px 後瞬間（scrollReuse 路徑） |
| 5 | `f1-desktop-1280x800-2d-tilt-flip.png` | 2D→0.60 切換後 |
| 6 | `f1-tablet-sim-1194x834-25d-cast-cast-002-enter+418ms.png` | **平板模擬 2.5D 進關後第一個遊戲畫面**（enter+418ms） |
| 7 | `f1-tablet-sim-1194x834-25d-cold-10s.png` | 平板模擬 2.5D 穩態 |
| 8 | `f1-desktop-1280x800-25d-camera-jump-0000ms.png` | 桌機 2.5D 鏡頭跳轉瞬間 |

（完整 91 張與每幀時間戳都在 `artifacts/validation/spacebunny-r11-stage1-floor-20261014/`，`evidence-9268.json` 有逐幀數值。）

---

## 5. 這不代表什麼（缺口，請勿當成通過）

1. **沒有實體 iPad／手機**：1194×834 只是桌面模擬（viewport simulation）。
2. **沒有壓慢速網路的 late-load**：`ground_dirt` 晚到時 terrain 快取會整塊重畫（快取鍵含 `image/imageWidth`），但我本輪**沒有**用 `--delay` 實測過晚載瞬間，建議下一輪補（harness 已支援 `--delay=`）。
3. **沒有長時間／自然十分鐘通關**：本輪是靜止與受控移動，沒有跑完整場。
4. **環境差異**：使用者當初回報的機器（GPU、視窗縮放、實體裝置、慢磁碟）與我的 headless 桌面 Chrome 不同；**「我這邊沒重現」不等於「使用者那邊已好」**。
5. **不能由這份報告關閉 P0 門**：`docs/art-asset-only-standard.md` 第 6 節要求連續畫面從第一幀就正確；我提供了 screencast 連續幀與量化數據，但**是否正式關門仍需使用者看圖並裁決**。

---

## 6. 若之後真的重現，最小可查修位置（給 Cursor 的方向，本輪未動）

| 徵狀 | 最可能位置 | 分類 |
| --- | --- | --- |
| 切鏡後幾秒錯拼、之後自己對 | `js/renderer.js drawGroundBase` 的 `scrollReuse` 分支（`dx,dy` 位移與四邊補繪的整數取整） | **JS 資產時序／變換缺陷 → Cursor** |
| 某一塊區域露出底色／色塊 | `paint()` 的 `c.fillRect` 底色在磚圖覆蓋不滿時外露 | **JS 資產時序缺陷 → Cursor**（禁止改成幾何假地板） |
| 磚界線在畫面上成一條亮／暗線 | 素材本身四邊不對縫（`ground_dirt.webp`） | **視覺資產缺陷 → 需 AGY 真圖**（本輪量到比值 ≈1，未觸發） |

重現步驟（若再遇到）：`http://127.0.0.1:<port>/index.html` 冷啟進 `night-town` → 立刻**左右方向鍵連續跑**（觸發 scrollReuse）→ 同時用 `Page.startScreencast` 錄 5 秒；把 screencast 幀與 `__f1Cols` 的接縫比一起交回。

---

## 7. 產出與重跑

- 新測試：`tests/spacebunny-stage1-floor.acceptance.cjs`（只讀 harness；HTTP 層注入，不碰 production）
- 證據：`artifacts/validation/spacebunny-r11-stage1-floor-20261014/`（`evidence-9268.json`、`qa-log-9268.txt`、`run-final.log`、91 張真截圖）
- 重跑：

```
node tests/spacebunny-stage1-floor.acceptance.cjs --port=9268                       # 4 視口 + screencast
node tests/spacebunny-stage1-floor.acceptance.cjs --port=9268 --only=desktop-1280x800-2d
node tests/spacebunny-stage1-floor.acceptance.cjs --port=9268 --delay=1500          # 晚載（下一輪建議補）
```