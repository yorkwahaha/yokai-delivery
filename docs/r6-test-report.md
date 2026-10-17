# R6 獨立驗收報告（第三輪：R4 第二關雨夜港町 ＋ 前兩輪複驗）

> 驗收人：OpenCode（Space Bunny Free Personal）｜時間：2026-10-13 第二輪
> 邊界：未 Commit／未 Push／未 Deploy。本報告只驗收，不修改任何 production。

---

## 0. 本輪結論

| 項目 | 結果 | exit code |
|---|---|---|
| 既有全回歸 baseline | **603/603 PASS** | 0 |
| R5 符咒黏貼延遲爆破（a–k 11 項） | **15/15 PASS** | 0 |
| R2 首次手勢解鎖音訊（a–g 7 項） | **8/8 PASS** | 0 |
| R3 手把 actuator（a–h 8 項） | **19/19 PASS** | 0 |
| R1 逐詞音檔／TTS／圖 | **7/8 PASS**（唯一 FAIL：單字圖缺口，進行中） | 1 |
| R5 探針校準 | **CALIBRATED**（15/15 + 7 故障注入全抓到 + 負控制一致） | 0 |
| R2／R3 探針校準 | **CALIBRATED**（R2 8/8、R3 19/19 + 13 故障注入全抓到 + 負控制一致） | 0 |
| R6 總 runner | 產出矩陣 | 0 |

**第一輪兩項 FAIL 的處置**

| 第一輪 FAIL | 本輪結果 | 說明 |
|---|---|---|
| R1 音檔未接線（175 mp3 / 39 映射） | **已修復 → PASS** | Cursor 補齊接線：`WORD_FILES` 現為 164 筆，164/164 詞皆有正式音檔，TTS 缺口 0，磁碟錄音 100% 已被引用 |
| R1 單字圖 158 缺 | **仍 FAIL，但屬進行中** | AGY 持續產出中，本輪 snapshot 為 35/164（缺 129）。這是**進度**不是結論，產出完成後需重跑 |

**新發現並已修復的 R2 缺口**（第二輪實測抓到的真缺陷）

`js/game.js` 的 pointerdown 處理器原本是
`if (artPending()) return;` 在前、`AUDIO.init()` 在後。
後果：**資產載入中的第一次觸碰會被整個吞掉，不解鎖音訊，玩家必須再點一次**。
這違反 R2 條文「首次觸碰同次啟動 BGM，不要求進遊戲再點一次」。
已回報協調者，Cursor 已修正為 `AUDIO.init()` 前置。本項已由「缺口量測」升級為**守門斷言**（R2-g）。

---

## 1. 可驗證 vs 不可驗證（必須分清楚）

### 1.1 R2 平板音訊解鎖

**可自動化驗證（本輪全 PASS）**——以可控 stub 模擬瀏覽器的 autoplay 拒絕：

| 條文 | 驗收內容 | 結果 |
|---|---|---|
| R2-a | `init()` 呼叫 `AudioContext.resume()`，被擋下的音軌在手勢後真的開始播放 | PASS |
| R2-b | 被 autoplay 拒絕時必須退避（60 幀內 ≤6 次嘗試），且解鎖後 `init()` 能繞過退避真的播 | PASS |
| R2-c | overworld 走 MAP_BGM、play 走 BGM，切換時不重疊 | PASS |
| R2-d | 音軌載入失敗（離線／缺檔）不拋錯、不無限重試 | PASS |
| R2-e | 靜音／切背景／回前景，音軌不得卡在暫停或爆音 | PASS |
| R2-f | 解鎖點存在性：pointerdown、手把選單、手把互動、resize→wakeAudio | PASS |
| R2-g | 守門：pointerdown 必須先 `AUDIO.init()` 再處理 `artPending` 擋下 | PASS（本輪新抓到缺口後修正） |

**真機不可驗證（一律 NOT_TESTED_ON_DEVICE，本檔不做任何此類斷言）**

- iPadOS Safari／Android Chrome 各自的 autoplay 政策細節
- 觸控是否真的被瀏覽器算成 user activation
- 靜音鍵／藍牙耳機／其他 App 搶音訊後的實際行為
- 旋轉裝置後的實際續播

Node 沙箱只能證明**程式面對 NotAllowedError 的處理正確**，不能證明任何瀏覽器政策。
技術依據：MDN Autoplay Guide。

### 1.2 R3 手把 actuator

**可自動化驗證（本輪 19/19 PASS，全部 deterministic mock）**

| 條文 | 驗收內容 |
|---|---|
| R3-a | 有 `vibrationActuator` 時走 `dual-rumble`，duration ≥16ms、weak/strong 夾在 0..1、startDelay=0 |
| R3-b | 只有舊式 `hapticActuators[].pulse` 時走 pulse |
| R3-b2 | `playEffect` 被拒 → 降級成 pulse |
| R3-b3 | `InvalidStateError` 不觸發多餘 pulse |
| R3-c | ★ **嚴守門**：`navigator.vibrate` 永遠不算手把成功 |
| R3-c2 | 沒有 actuator 的手把（只按鍵）不得被算成震動 |
| R3-d | 開關關閉時手把與機身都無回饋；持久化 |
| R3-e | 斷線後不回饋、重連後恢復 |
| R3-f | actuator 拋錯／Promise 拒絕時安靜降級 |
| R3-g | 隱藏頁面不得發新手把回饋；visibilitychange／blur／pagehide 必須停止 |
| R3-h | 十個事件都雙端驅動、參數夾制、crit 與一般命中參數不同 |

**★ 嚴守門的三道強制機制**（防止「拿機身震動冒充手把成功」）

1. `playEffects` / `pulses` / `bodyVibrations` 三個陣列分開記錄，互不干擾。
2. `gamepadSuccessCount()` 只數 actuator 呼叫，且只計幅度 > 0 的（幅度 0 是停止，不是震動）。
3. 校準腳本注入 `fault-vibrate-only-as-gamepad`（拿掉 playEffect 與 pulse 分支，
   只留 navigator.vibrate）→ R3 (c) 立刻紅。**證明這道守門真的有效。**

**真機不可驗證（NOT_TESTED_ON_DEVICE）**

- iPadOS/Safari、Android/Chrome 各自的實作支援
- Xbox Wireless Controller 藍牙**實際雙馬達手感**
- 使用者作業系統中的手把震動開關

必須記錄：平板 OS、瀏覽器、手把型號、連線方式。
**mock 全綠 ≠ 手把能震。** 手把能操作 ≠ 手把震動正常。

---

## 2. 探針校準（先證明量得到，再相信結果）

`tools/r6-calibration-r2-r3.cjs`（R2／R3）與 `tools/r6-calibration.cjs`（R5）
各跑三段控制組，兩者 exit code 皆為 0（CALIBRATED）。

| 控制組 | R5 | R2／R3 |
|---|---|---|
| 正控制（working tree 必須綠） | 15/15 | R2 8/8、R3 19/19 |
| 故障注入（每種真錯都要被抓到） | 7/7 抓到 | **13/13 抓到** |
| 負控制（校準未污染現場） | 首末輪一致 | 首末輪一致 |

### R2 注入的 6 種真錯

| 注入 | 抓到 |
|---|---|
| `fault-no-unlock-resume` 拿掉 `ctx.resume()` | R2 (a) |
| `fault-retry-storm` 拿掉 `bgmAttempts` 退避 | R2 (b) |
| `fault-bgm-overlap` 不暫停另一軌 | R2 (c) |
| `fault-stuck-after-background` 回到前景不清退避紀錄 | R2 (e) |
| `fault-remove-pointerdown-init` 移除觸控解鎖 | R2 (f)(g) |
| `fault-remove-resize-wake` 旋轉後不 wakeAudio | R2 (f) |

### R3 注入的 7 種真錯

| 注入 | 抓到 |
|---|---|
| `fault-no-dual-rumble` 改用非 dual-rumble 型別 | R3 (a) |
| `fault-drop-pulse-fallback` 移除 pulse 降級 | R3 (b) |
| `fault-ignore-toggle` 開關失效 | R3 (d) |
| `fault-ignore-disconnect` 不看 `connected` | R3 (e) |
| `fault-let-throw-escape` 讓錯誤逃出 | R3 (f) |
| `fault-ignore-hidden` 隱藏頁面仍發回饋 | R3 (g) |
| **`fault-vibrate-only-as-gamepad` 只剩 navigator.vibrate** | **R3 (c) 嚴守門** |

校準只改 `%TEMP%` 內的副本，並在結束時比對 `js/audio.js`、`js/game.js`、`js/haptics.js`
的 SHA-256。錨點失效時腳本**直接報錯**（不靜默放寬）——本輪實際發生 3 次錨點失效
（其他 Agent 改寫了 `game.js`／`haptics.js`），全部重新錨定後才通過。

---

## 3. R1 現況盤點（逐詞）

驗收腳本直接讀 `js/words.js`（164 詞）與 `js/audio.js`（`WORD_FILES`）比對磁碟：

| 項目 | 第一輪 | 第二輪 |
|---|---|---|
| 詞總數 | 164 | 164 |
| 有實體音檔（已接線） | 39 | **164** |
| 走 TTS fallback | 125 | **0** |
| 磁碟 mp3 總數 | 175 | 175 |
| **已錄音但未接線** | **136** | **0** ← 已修復 |
| 有單字圖 | 6 | **35**（進行中） |
| 缺單字圖 | 158 | **129**（進行中） |

- 164 詞全部實際播放 mp3，且**不**同時走 TTS（互斥已驗收）。
- `WORD_FILES` 全部映射都指向存在的檔案（無 404）。
- 磁碟上 175 個 mp3 **全部**已被引用（第一輪的 136 個孤兒檔已清零）。
- TTS fallback 仍保留為**安全網**：用不在 `WORD_FILES` 的合成詞驗證，缺檔時明確退
  `SpeechSynthesisUtterance`（`lang="ja-JP"`、唸詞本身）、不請求不存在的 mp3、靜音時不發聲。

**單字圖語意未經人工審核**：本輪只驗「檔案存在」與「圖檔鍵不跨詞重複」，
**沒有**驗證圖的內容是否真的對應該詞。需人工看圖，見 §5。

---

## 4. 明確未測（不得當作通過）

| 項目 | 狀態 | 原因 |
|---|---|---|
| **R2-device 真機 iPadOS／Android autoplay** | **NOT_TESTED_ON_DEVICE** | Node 沙箱只能驗程式面對 NotAllowedError 的處理，不能證明瀏覽器政策。 |
| **R3-device 真機 Xbox 藍牙手把 dual-rumble** | **NOT_TESTED_ON_DEVICE** | mock 證明程式會正確呼叫 actuator，**不代表實體馬達真的震**。 |
| **R4 第二關港町美術** | **NOT_STARTED** | 素材尚未產出，無可截圖驗收的對象。 |
| R1 單字圖語意 | 未測 | 需人工審圖，自動化做不到。 |
| R1 音檔聽感（164 筆 vs 既有 39 筆） | 未測 | 需真人實聽比對 voice／語言／速度。 |
| P7 硬體數據（FPS／P95／RAM／溫度） | 未測 | 無任何量測。 |
| B5 全 8 關 10 分鐘自然平衡 | 未測 | 需真人實機通關。 |

---

## 5. 待裁決

1. **R5 數值仍未定案**：`BOOM_FUSE = 1.5`（另一候選 2s 未選邊）、`BOOM_SPLASH = 0.2`、
   `BOOM_KNOCK = 72`、`BOOM_RADIUS = [78,92,108,122,135]` 在原始碼註解明寫「尚未定案」。
   本輪只驗比例關係不驗數值大小。**R5 15/15 不代表已定案或已放行。**
2. **R5 全階採黏貼**：實作讓 Lv1–Lv5 全部改為黏貼延遲爆破。若原意只改 MAX，需明確後我據以修正契約。
3. **R1 單字圖**：129 張缺圖待產出；完成後圖與詞的語意對應需人工審。
4. **R3 隱藏頁面策略**：目前 `pageHidden()` 直接不發回饋，並在 blur／pagehide 時 `stop()`。
   這是實作選擇（不是條文明定），若希望背景時保留短回饋需裁決。
5. **R2 載入中觸碰**：本輪實測缺口已修。載入中的第一次觸碰現在會解鎖音訊但仍不動作
   （`noteLoadingGesture`），此UX 是否可接受需使用者試玩。

---

## 6. 本輪變更（全部在 OC 邊界內）

**新增**
- `tests/r2-audio-unlock.acceptance.cjs` — R2 驗收 8 項
- `tests/r3-gamepad-haptics.acceptance.cjs` — R3 驗收 19 項
- `tools/r6-calibration-r2-r3.cjs` — R2／R3 探針校準（13 種故障注入）

**修改**
- `tools/r6-acceptance.cjs` — 納入 R2／R3 與第二份校準報告、詞庫盤點 snapshot
- `tests/r1-word-assets.acceptance.cjs` — 依 164/164 接線完成調整：
  移除「必須有詞走 TTS」的舊假設、改用合成詞驗證 fallback 安全網、
  新增「R1 完成目標：164 詞全部有正式音檔」
- `tests/r2-audio-unlock.acceptance.cjs` — R2-g 由缺口量測升級為守門斷言

**未動**：`js/**`、`index.html`、資產、`roadmap.md`、`docs/agent-handoff.md`。
未 Commit／未 Push／未 Deploy。

---

## 7. 重跑方式與證據

```powershell
node tools/r6-calibration.cjs        # R5 探針校準（exit 0 = CALIBRATED）
node tools/r6-calibration-r2-r3.cjs  # R2／R3 探針校準
node tools/r6-acceptance.cjs         # 總驗收（baseline + R5/R1/R2/R3 + 矩陣）

node --test tests/r5-talisman-blast.acceptance.cjs    # exit 0
node --test tests/r1-word-assets.acceptance.cjs      # exit 1（單字圖缺口，進行中）
node --test tests/r2-audio-unlock.acceptance.cjs     # exit 0
node --test tests/r3-gamepad-haptics.acceptance.cjs  # exit 0
node --test tests/*.test.cjs                         # exit 0，603/603
```

證據：`artifacts/validation/r6/`
- `r6-acceptance.{json,txt}` — 驗收矩陣 + 詞庫盤點 snapshot
- `r6-calibration.{json,txt}` — R5 校準
- `r6-calibration-r2-r3.{json,txt}` — R2／R3 校準
- `r6-{baseline,r1,r2,r3,r5}-output.txt` — 各階段原始 TAP 輸出
---

# 附錄：第三輪（R4 雨夜港町）

> 驗收人：OpenCode（Space Bunny Free Personal）｜時間：2026-10-13 第三輪
> 邊界：未 Commit／未 Push／未 Deploy。本輪同樣**未修改任何 production 檔案**。

## A. 本輪結論

| 項目 | 結果 | exit code |
|---|---|---|
| 既有全回歸 baseline（tests/*.test.cjs） | **603/603 PASS** | 0 |
| **R4 第二關驗收（19 項，A–F 六組）** | **19/19 PASS** | 0 |
| R5 符咒黏貼延遲爆破 | 15/15 PASS | 0 |
| R2 音訊解鎖 | 8/8 PASS | 0 |
| R3 手把 actuator | 19/19 PASS | 0 |
| R1 逐詞資產 | 7/8 PASS（**唯一紅燈：單字圖 129/164 缺，屬 AGY 進行中**） | 1 |
| **R4 探針校準（13 項故障注入）** | **CALIBRATED**（正控制 19/19 全綠、13 注入全抓到、負控制一致） | 0 |
| R5 探針校準 | CALIBRATED | 0 |
| R2／R3 探針校準 | CALIBRATED | 0 |
| R6 總 runner（含 R4 矩陣） | 產出矩陣 | 0 |
| 真實瀏覽器截圖佐證 | 6 張（Chrome headless 實際進入第二關） | 0 |

## B. R4 驗收矩陣（19 項，全部以行為／輸出驗收）

| 編號 | 驗收內容 | 狀態 | 故障注入（證明探針抓得到壞） |
|---|---|---|---|
| A1 | 第二關詞庫：6 pack／27 詞／無重複／不混第一關 | PASS | fault-wordpack-missing |
| A2 | 節奏契約：600 秒、6 配送、90 秒後百鬼、時間波次遞增 | PASS | fault-runseconds、fault-goal-deliveries |
| A3 | 港町 Port 風格 Boss 與射手配置 | PASS | fault-boss-theme |
| A4 | 第二關為雨關，且第一關不得被雨化 | PASS | fault-weather-leaks-to-stage1 |
| A5 | 地圖節點可進入、位置存在、解鎖鏈在第一關之後 | PASS | fault-node-locked |
| A6 | 續關：進度寫入 localStorage，重載一致 | PASS | fault-no-persist |
| B1 | ★ **行為驗收**：第二關真的畫出港口地表，第一關不被港口資產污染 | PASS | fault-shared-ground |
| B2 | 港町九個資產有明確對應、檔案真的存在、程式真的請求 | PASS | fault-no-port-assets |
| B3 | 第一關資產不得被港町資產取代 | PASS | 同 B2 |
| C1 | 第二關畫得出雨線，第一關不畫雨 | PASS | fault-rain-on-stage1 |
| C2 | ★ 雨滴自然隨機，不得整齊週期重複 | PASS | fault-perfectly-periodic-rain |
| C3 | ★ 雨有三個景深層，速度與透明度不同 | PASS | — |
| C4 | 雨畫出漣漪／水花，且非固定週期 | PASS | fault-no-ripple |
| C5 | 雨／漣漪在 2.5D 投影下正確貼地 | PASS | fault-weather-settransform |
| C6 | 雨／漣漪不得畫到 HUD 之上 | PASS | fault-weather-outside-viewbounds |
| E1 | R4 資產真的存在、格式正確、尺寸非零 | PASS | — |
| E2 | R4 資產已被程式引用（存在 ≠ 玩家看得到） | PASS | fault-no-port-assets |
| E3 | 冷啟動不得一口氣載入其他關巨大圖 | PASS | — |
| F1 | 手機橫向／直向／平板／桌機 HUD 不溢出 | PASS | — |

## C. B1 的 contract vs implementation 裁決（本輪最重要的一次修正）

第一版我把「`stage.visual.ground !== "ground"`」寫成硬性斷言，結果**紅燈**。裁決後改為**行為驗收**：

- 用**真 renderer**（`js/renderer.js` + `assets.js` + `viewport.js`）在沙箱跑 `drawGround()`，
  記錄**實際被繪製的影像**（含 `createPattern` 套用的基底地表，不只是 `drawImage`）。
- 現行實作：Cursor 讓 `js/renderer.js` 依 `stageId === "rain-port"` 另畫 `window.PORT_ART.stone / .dock`，
  `visual.ground` 仍維持通用鍵 `"ground"`。
- 判定：**通過**。實測 `rain-port` 畫到 `port-stone` + `port-dock`；`night-town` 只畫 `ground_dirt`，
  **完全沒有任何港口資產**（跨關保護乾淨）。
- 報告中把 `visual.ground` 欄位值降級為「資訊項（供裁決參考），非契約」。

> 結論：**欄位名不是契約，「第二關畫自己的港町地面且不污染第一關」才是契約。**
> 若日後有人改成 `visual.ground` 換鍵，B1 同樣會通過——這是刻意的，避免驗收綁死實作。

## D. 本輪抓到的真缺陷與處置

| # | 缺陷 | 影響 | 處置 |
|---|---|---|---|
| 1 | `js/assets.js` 的 `refreshPortArt()` 會同時呼叫**靜態九檔名對應**與**Markdown 反推**（`loadPortArt()`），後者會覆寫 `window.PORT_ART[role]` | Grok Build 已證實 Markdown 反推會把 dock／beacon／crate 配錯，港町會長出錯的道具 | **已回報 Cursor，Cursor 已移除 Markdown 反推路徑**；B2 現為 PASS，且故障注入 `fault-no-port-assets` 仍能抓到 |
| 2 | 冷啟動一次請求 15 張地表／建築圖（我的門檻是 ≤12） | 曾疑似回歸 | 查證後為**我的門檻過時**，非真缺陷：Cursor 改成九個靜態明確檔名後請求量正常。已重新校正 E3 門檻並記錄實測值 |
| 3 | 我自己的探針 bug（vm 沙箱、`Image` 類別、跨 realm `deepEqual`、`assets.js` 覆寫 `window.ART`／`window.PORT_ART`） | 假紅燈 | 已逐項修正，**未放寬任何斷言**；修正前後都用故障注入反證探針仍抓得到壞 |

## E. 真實瀏覽器佐證（新增，limitations 已寫入證據檔）

新增 `tools/r6-r4-screenshots.cjs`：用本機 Chrome + DevTools Protocol 起 `127.0.0.1` 靜態伺服器，
**播種存檔 → 重載 → 真實指標事件進入旅路地圖 → 移動到 2/8 雨夜港町 → 出發 → 進入第二關 → 截圖**。

實際截圖（`artifacts/validation/r6/screenshots/`）：

| 檔案 | 內容 |
|---|---|
| `r4-overworld-900x600.png` | 旅路地圖 |
| `r4-overworld-selected.png` | 已選 2/8 雨夜港町（最高 1,200 點＝播種成功） |
| `r4-rain-port-900x600.png` | **第二關實戰：雨線可見、HUD（雷達／符咒扇／衝刺／倒數 9:5x）、目標「港口交通」** |
| `r4-rain-port-844x390.png` | 手機橫向（844×390） |
| `r4-rain-port-390x844.png` | 手機直向：正確顯示「橫向遊玩」遮罩 |
| `screenshots.json` | 含 `PORT_ART` 實機載入結果 |

**實機載入佐證**：在真實瀏覽器、第二關進行中讀取 `window.PORT_ART`，
**九個港町資產（stone／dock／warehouse／beacon／mooring／crate／boat／anchor／ripple）全部 naturalWidth > 0**，
即「資產真的載進來並被繪製」，不是只有檔案躺在磁碟上。

### 邊界（不可誇大）

- 本機 Chrome headless **≠ iPad／手機真機**：無法證明平板 autoplay、觸控、效能、GPU 合成。
  因此 `R4-device` 維持 **NOT_TESTED_ON_DEVICE**，不計入通過。
- 圖像**語意與美感未人工審**（`R4-visual` = 未人工驗）。程式面（資產存在、確實被繪製、跨關乾淨）已驗收，
  但「青石／碼頭看起來像不像港町」需要人眼判斷。

### 自動化過程中值得記錄的三個坑

1. `spawnSync` 會堵住 Node event loop，同行程的 http server 永遠無法回應 → Chrome 只能等到 timeout。
   必須用非同步 `spawn`。
2. **播種 localStorage 後一定要 `Page.reload`**：`js/store.js` 在頁面載入時就把存檔讀進記憶體，
   事後寫入不會讓 `STORE` 知道第二關已解鎖（出發鍵會保持停用）。
3. 出發需要**點兩下**：`confirmOverworld()` 先比對 `selected.id === currentId`，
   不同時只會 `moveTo`（隊伍動畫移動），動畫走完再點才會 `start()`。

## F. R4 重跑方式與退出碼

```powershell
node --test tests/r4-rain-port.acceptance.cjs     # R4 19 項 → exit 0
node tools/r6-r4-calibration.cjs                   # R4 探針校準 → exit 0（CALIBRATED）
node tools/r6-r4-screenshots.cjs                   # 真實瀏覽器截圖 → exit 0
node tools/r6-acceptance.cjs                       # 總驗收（含 R4 矩陣）→ exit 0

# 前幾輪複驗
node tools/r6-calibration.cjs                      # exit 0
node tools/r6-calibration-r2-r3.cjs                # exit 0
node --test tests/r5-talisman-blast.acceptance.cjs    # exit 0，15/15
node --test tests/r2-audio-unlock.acceptance.cjs       # exit 0，8/8
node --test tests/r3-gamepad-haptics.acceptance.cjs    # exit 0，19/19
node --test tests/r1-word-assets.acceptance.cjs        # exit 1，7/8（單字圖缺口，進行中）
node --test tests/*.test.cjs                          # exit 0，603/603
```

證據：`artifacts/validation/r6/`
- `r6-acceptance.{json,txt}` — 總矩陣（含 R4 22 列）
- `r6-r4-calibration.json` — R4 校準（正控制／13 故障注入／負控制）
- `r4-acceptance.tap`、`r4-calibration.log` — 本輪原始輸出
- `r6-{baseline,r1,r2,r3,r4,r5}-output.txt` — 各階段 TAP 原始輸出
- `screenshots/` — 真實瀏覽器截圖與 `screenshots.json`

## G. 本輪異動檔案（全部在 OpenCode 授權範圍內）

- `tests/r4-rain-port.acceptance.cjs` — **新增**，R4 驗收 19 項（A–F）
- `tools/r6-r4-calibration.cjs` — **新增**，R4 探針校準（13 故障注入 + 負控制 + SHA-256 證明未污染 production）
- `tools/r6-r4-screenshots.cjs` — **新增**，真實瀏覽器截圖佐證
- `tools/r6-acceptance.cjs` — 擴充 R4 矩陣列與 R4 校準／截圖讀取
- `docs/r6-test-report.md` — 本檔案

**未動**：`js/**`、`index.html`、`assets/**`、`art/r4/**`、`roadmap.md`（SHA-256 已記錄於 `r6-acceptance.json`）。
未 Commit／未 Push／未 Deploy。

---

# 附錄：第四輪（Grok 接管 R6，四張核准圖接入後的獨立驗收）

> 驗收人：Grok Build｜時間：2026-10-13
> 原因：OpenCode Space Bunny 終端機 `Rate limit exceeded`，pane 已 Ctrl+C。倉庫內沒有這句 log。本輪不呼叫該 pane。
> Space Bunny 的 `art-shots/art-shots.json`（2026-10-13T09:04:01Z）與原始截圖目錄保留。新截圖在 `art-shots-grok/`。
> 邊界：未改 `js/`、`assets/`、`art/r4/`、`index.html`、`service-worker.js`、`AGENTS.md`、`roadmap.md`、`docs/stage-identity-standard.md`。未 Commit／未 Push／未 Deploy。

人可讀的分桶、截圖與 Cursor 差異見 [r6-art-only-qa.md](r6-art-only-qa.md)。

| 項目 | 結果 | exit |
|---|---|---|
| R4 19 項 | 19/19 | 0 |
| `tests/*.test.cjs` | 602/603。紅燈：`ground_stone.webp` 媒體修訂與磁碟不符 | 1 |
| art-only 13 項 | 12/13。紅燈：B10 `awaken_seal.svg` | 1 |
| 核准圖接線 10 項 | 7/10。紅燈：S1 缺圖色圓、S2 家紋與名牌底板、H1 合成畫面未核准 | 1 |
| R1 | 7/8。單字圖缺 129/164 | 1 |
| 兩份探針校準 | CALIBRATED | 0 |
| 瀏覽器截圖 | D2、D5、D6、H1 | 1 |

四張核准 WebP 與 `assets/img/rain-port/` 的倉庫、魚舖、青石、木棧位元組相同。橫向截圖同時看得到「港町倉庫」與「魚舖」。合成畫面人工閘門維持 OPEN。19/19 與截圖都不是部署許可。

---

# 附錄：第五輪（接 Kilo 未完成的互貼邊驗收）

> 驗收人：Grok Build｜時間：2026-10-13
> Kilo 沒有留下名為 Kilo 的半成品測試。留存的是 `art/r4/cross_edge_compatibility_matrix.json`（只讀，沒有當成本輪結果）與上一輪 fail-closed 紀錄。
> 本輪重算 runtime webp 的邊緣，並掃描 `portGroundPick` 的實際鄰接。未改 `js/`、`assets/`、Aoede 腳本與備份、`AGENTS.md`、`roadmap.md`。
> 未 Commit／未 Push／未 Deploy。

人可讀的數值與截圖見 [r6-mutual-edge-qa.md](r6-mutual-edge-qa.md)。

| 項目 | 結果 | exit |
|---|---|---|
| 互貼邊 `tests/r6-mutual-edge.acceptance.cjs` | 9/9。現場單張 var1 為 `NOTE_VISIBLE_REPEAT`，不是 FAIL | 0 |
| 舊式三圖混用政策 | FAIL。var1 自接約 2.09 不能把混用改成通過 | 含在上一列 |
| `tests/*.test.cjs` | 603/603。這一輪媒體修訂測試有過 | 0 |
| art-only 13 項 | 12/13。紅燈仍是 B10 | 1 |
| 核准圖接線 10 項 | 5/10。紅燈：W1、W3、S1、S2、H1。W1／W3 沒有刪 | 1 |
| R4 19 項 | 19/19 | 0 |
| Chrome 精修截圖 | 六張戰鬥畫面有拍到。人工閘門仍 OPEN | 0 |
| Aoede | BLOCKED，0 段錄音 | 不另稱完成 |

合成畫面 `compositeApproved` 仍是 false。

---

# 附錄：第六輪（石木世界接縫、旅路進雨港、語音暫停）

> 驗收人：Grok Build｜時間：2026-10-13
> 語音包暫停。沒有呼叫 TTS，沒有改音檔。
> 未改 `js/`、`assets/`、`art/`、`AGENTS.md`、`roadmap.md`、`service-worker.js`。
> 未 Commit／未 Push／未 Deploy。

人可讀的接縫、截圖與四態見 [r6-world-cross-qa.md](r6-world-cross-qa.md)。

| 項目 | 結果 | exit |
|---|---|---|
| 世界四向 `tests/r6-world-cross-edge.acceptance.cjs` | 7／7。木棧底對青石頂 45.16，判定 FAIL；畫面仍是 var1 | 含在最終驗收 |
| 敵 Boss 閘門 | 1 通過、1 失敗。失敗是未接入未核准，保留 | 1 |
| 互貼邊 9 項 | 9／9。語音斷言改為暫停 | 0 |
| `tests/*.test.cjs` | 603／603。既有媒體修訂沒有過期 | 0 |
| 七個 acceptance 合跑 | 60／68。紅燈是 B10、W1、W3、S1、S2、H1、單字圖 129、敵 Boss 未核准 | 1 |
| Chrome 旅路與冷啟 | 17 張。正方格與直線岸仍在。P0 有量，不關閉 | 工具 0 |

合成畫面 `compositeApproved` 仍是 false。
