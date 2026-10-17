# R6 美術接線驗收（2026-10-13，Grok 接管）

驗收者：Grok Build。OpenCode Space Bunny 於終端機出現 `Rate limit exceeded` 後被 Ctrl+C。倉庫檔案裡沒有這句錯誤字，本輪沒有再呼叫該 pane。既有 `tests/art-only-qa.acceptance.cjs` 與 `artifacts/validation/r6/art-shots/` 保留，新結果寫在旁邊。

**結論：【BLOCKED】。四張來源圖已核准，而且執行檔位元組與它們相同；遊戲合成畫面仍未核准。不可宣稱通關，不可 Commit／Push／Deploy。**

人工閘門檔：`artifacts/validation/r6/human-visual-gate.json`（`status: OPEN`，`compositeApproved: false`）。

---

## 1. 這輪實際看到的畫面

截圖目錄：`artifacts/validation/r6/art-shots-grok/`。流程是播種存檔後，從旅路地圖進到面板「2/8　雨夜港町」再出發。本機是 Chrome headless，不是 iPad、手機或 Xbox。

| 檔案 | 這張圖裡看得到的 |
|---|---|
| `stage2-desktop-900x600.png` | 章名「雨夜港町」。青石牆與木棧分帶。正中房子標「倉庫」。有雨。沒有程序白房子。 |
| `stage2-desktop-t9s.png` | 同上，章名已淡出。計時約 9:55。畫面中沒有妖怪。 |
| `stage2-mobile-landscape.png` | 左上標「港町倉庫」，右上標「魚舖」（暖簾、魚形）。兩棟外形不同。石牆與木棧的重複接縫都看得到。 |
| `stage2-tablet.png` | 暫停選單，不是戰鬥畫面。這張不能算戰鬥驗收。 |
| `stage2-mobile-portrait.png` | 7209 bytes，轉向遮罩，不是戰鬥畫面。 |
| `stage1-t0s.png`、`stage1-t10s.png` | 夜行町、宵待酒屋、石板路。0 秒有章名，10 秒章名已淡。取樣裡沒有港町圖。 |
| `stage1-25d.png` | 視角切換後畫面有變。按鈕顯示可切回 2D。 |

觀測層在第二關 `drawImage` 裡對上四張核准圖的位元組：`port_warehouse.webp`、`port_fishmonger.webp`、`ground_stone.webp`、`ground_wood_dock.webp`。第一關取樣沒有畫到這些路徑。

自動指標：第一關地面帶 t0→t3 亮度差 1.447、t3→t10 差 0.906，判 `STABLE`。2D→2.5D 區塊差 36.302，來回切回後差 0.866。拼接自相關是 `INCONCLUSIVE_REVIEW_BY_HUMAN`。這些數字不能宣布第一關地板 P0 已修好。

請人看的重點：青石與木棧都有明顯重複接縫；倉庫在桌機正中，魚舖要到橫向畫面才同時看全；平板那張是暫停頁。

---

## 2. 失敗分桶

### 本輪阻塞

- 合成畫面人工閘門開著。H1 紅。截圖只供人看，不是核准。
- 第二關取樣約 9 秒，桌機與橫向畫面都沒有妖怪圖（D2）。不能把它說成怪物系統已壞，也不能算戰鬥怪物通過。
- 燈台 `beacon` 已載入，取樣窗沒有 `drawImage`（D5）。世界只在偶數 chunk 放燈台，這次鏡頭可能沒走到。不把它定成缺圖缺陷，也不算通過。
- `tests/media-cache.test.cjs`：`assets/img/rain-port/ground_stone.webp` 的媒體修訂仍是 `a5daf4e6ae78a462504b30f7`，磁碟前綴已是 `ceca034d36049b00`（與核准濕石磚相同）。測試在第一個不一致就停。本輪不跑 `tools/build-media-cache.cjs`，因為那會改 `service-worker.js`。
- 缺料時 `drawPlayer` 仍畫橘色圓、`drawMonster` 仍畫色圓（S1）。Boss 護盾家紋仍是多邊形，誤配名牌仍是 `roundRect` 底板（S2）。
- 第二關小怪造型、專屬 Boss 造型、每關 BGM 仍無使用者交付。這次只核准四張場景圖。

### 先前未完成單字圖

R1：164 詞裡 35 張有圖，**缺 129 張**。音檔 164/164，TTS 缺口 0。這是先前進度，不是這次四張場景圖的結果。

### 正式 SVG 殘留

`assets/img/ui/awaken_seal.svg` 仍在。美術掃描 B10 紅。第二關實戰 `drawImage` 畫了 `ui/awaken_seal.svg?v=20261010-seal1`（D6）。`candidate_awaken_seal` 不在四張核准名單裡，程式也沒有引用它。

### 硬體不可實測

沒有 iPad、手機、Xbox。Headless 的橫向／直向／平板是模擬尺寸。直向是轉向遮罩。DPR=2 的高頻能量 3.93，低於 DPR=1 的 14.253，只記注意，不判畫質通過。R2 音訊解鎖與 R3 手把震動沿用既有結論：程式契約可測，裝置成功未宣稱。

---

## 3. 這輪重跑的數字

| 套件 | 結果 | 退出碼 | 證據 |
|---|---|---|---|
| R4 `tests/r4-rain-port.acceptance.cjs` | 19/19 | 0 | `artifacts/validation/r6/r6-grok-r4.tap` |
| 主要回歸 `tests/*.test.cjs` | 602/603 | 1 | `r6-grok-baseline.tap`。唯一紅燈是媒體修訂 |
| 美術掃描 `tests/art-only-qa.acceptance.cjs` | 12/13 | 1 | `r6-grok-art-only.tap`。唯一紅燈 B10 |
| 核准圖接線 `tests/r6-approved-candidates.acceptance.cjs` | 7/10 | 1 | `r6-grok-approved.tap`。紅燈 S1、S2、H1 |
| R1 單字資產 | 7/8 | 1 | `r6-grok-r1.tap`。缺圖 129/164 |
| 美術掃描校準 | CALIBRATED | 0 | `r6-grok-art-qa-calibration.log` |
| 接線校準 | CALIBRATED | 0 | `r6-grok-approved-calibration.log` |
| 瀏覽器截圖 | RED 4（D2、D5、D6、H1） | 1 | `r6-grok-art-shots.log` |

舊的 B1、B3、C8 這次轉綠，是因為 `renderer.js` 裡原先被掃描的房屋色塊、程序石紋、招牌底板已經不在。綠燈只代表那些舊錨點沒再出現。S1、S2 仍抓到另外的幾何替身。

四張核准 WebP 與 `assets/img/rain-port/` 對應檔的 SHA-256 相同：

| 角色 | 執行檔 | 雜湊前綴 |
|---|---|---|
| 倉庫 | `port_warehouse.webp` | `d64d8a678af0af6c` |
| 魚舖 | `port_fishmonger.webp` | `acf2f337a628680f` |
| 濕石磚 | `ground_stone.webp` | `ceca034d36049b00` |
| 濕木棧 | `ground_wood_dock.webp` | `6652519e84da76f7` |

`candidates_meta.json` 的 WebP 雜湊與磁碟一致。`art/r4/handpainted-candidates/README.md` 裡的雜湊字串與磁碟不同，而且標題仍寫著待視覺核准。該目錄本輪禁止改，所以沒有更正 README。

PNG 可完整解壓。尺寸：倉庫 474×420、魚舖 467×420、兩張地面 512×512。四張 WebP 彼此雜湊不同。

---

## 4. 與 Cursor 現況的差異（QA 沒有改這些檔）

這輪讀檔期間，`js/assets.js`、`js/world.js`、`js/renderer.js` 還在被改。下面是截圖與最後一次測試時的程式，不是更早的空目錄描述。

- `js/assets.js` 約 318–356 行：`RAIN_PORT_ASSETS` 與 `RAIN_PORT_FISH` 指向 `assets/img/rain-port/`。`refreshPortArt` 會一併載入 `fishmonger`。過程中曾短暫指向 `art/r4/handpainted-candidates/`，截圖當下已經改回 runtime 路徑。位元組仍是核准圖。
- `js/world.js` 約 113–115 行：雨夜港町房屋以 `(cx + slot) % 2` 分成 `port_warehouse` 與 `port_fishmonger`。其他關走 `buildingType`。道具約 155–156 行同樣交替倉庫與魚舖。
- `js/renderer.js`：`drawHouse` 按 `portRole` 貼 `PORT_ART`，缺圖不畫矩形。青石鋪在木棧帶上方，木棧帶是 `chunk.h - 256`（同一天較早讀到的是 92）。招牌是文字，沒有圓角底板。
- `js/game.js` 約 593 行：只有 `STAGE.id === "rain-port"` 才呼叫 `refreshPortArt`。
- 仍留著、這輪不代修：玩家與妖怪的缺圖色圓、Boss 多邊形家紋、誤配名牌底板、正式 SVG 印章、地面快取裡的 `fillRect`（約 468 行，畫在貼圖之下）、媒體修訂未重建。
- 橫向截圖看得到兩棟不同的房子與上下兩種地面。石牆與木板的接縫要由畫面審，不由測試綠燈結案。

`docs/agent-handoff.md`、`AGENTS.md`、`roadmap.md` 仍寫四張圖目錄是空的、R6 由 OpenCode 獨占。那些檔本輪依指示沒改。以這份 QA 與磁碟為準。

---

## 5. 部署

未 Commit。未 Push。未 Deploy。部署門維持【BLOCKED】。
