# R9 獨立 QA：第三關 sakura-pass 地板三圖接線（Space Bunny，2026-10-14）

> 作者：OpenCode Space Bunny Free Personal（Herdr w5:p4）｜獨立 QA，不沿用 Cursor 的 53/53
> 範圍限定：三張 ground WebP 的 hash／loader／版本、真 Chrome 的 A→H→B 過渡與視口、第一/二關污染抽查、石階方格線人審
> 不在範圍（未核准、未接入、本輪不測）：V 垂直過渡、神社、小怪、Boss
> 部署狀態：**未 Commit／未 Push／未 Deploy**
> **本輪已在協調要求下停止讀取固定版本 production JS，production 快照已釋放給 Cursor 接線。**

---

## 0. 結論先講

| 分類 | 項目 | 結果 |
| --- | --- | --- |
| **PASS** | 三張 runtime WebP 512×512、sha256 與候選圖**位元組相同**、service-worker revision 相符 | G1 |
| **PASS** | 進關才 lazyload、三張齊全才鋪、缺任一張維持原 ground_dirt、V 垂直過渡完全隔離 | G2（版本 tag 部分見下方快照漂移） |
| **PASS** | `sakuraTileRole` 契約：tx<3→dirt、tx=3→transH、tx>3→steps，512 對齊 | G3 |
| **PASS** | 第一關 night-town／第二關 rain-port 未引用新圖，0 次 sakura drawImage、SAKURA_ART_STATUS 空 | G4 / P |
| **PASS** | 三個視口（桌機 1280×800 2D／2.5D、iPad 模擬 1194×834）runtime 尺寸與角色對應一致 | T1 |
| **PASS** | chunk 邊界 900 前後色差 2.0–3.3，未高於同材質內部變化 → 沒跟 chunk 邊界斷裂 | T4 |
| **PASS** | 切到 0.60 傾斜後地面仍每幀 blit（114 次）→ 新地板可見 | T5（部分） |
| **PASS** | 音訊零位元組、Audio 只 stub、Chrome 無未捕捉例外 | G5 / G6 |
| **HUMAN_REVIEW** | **石階單材質 512px 自接線的方格線**（具體畫面與最小修正見 §4） | T6 |
| **HUMAN_REVIEW** | 缺圖／late-load 兩項需以 `--delay` 另跑才有意義 | L1/L2 |
| **HUMAN_REVIEW** | iPad 僅桌面模擬，不可宣稱真機 | G7 |
| **BLOCKED** | 「畫面上 dirt→transH→steps 真的在世界 X 1536／2048 換材質」「過渡帶跨 chunk 1800 不位移」——**harness 世界座標換算未打通**，不是產品失敗 | T2 / T3 / T5 |
| **HUMAN_REVIEW** | index.html script 版本在測試期間被改動（快照漂移） | G2 |

---

## 1. 靜態面（可信來源：我的離線盤點 + Cursor 文件）

| 檔案 | bytes | 尺寸 | sha256 前綴 | 與候選圖 | service-worker revision |
| --- | --- | --- | --- | --- | --- |
| `ground_mountain_dirt.webp` | 163666 | 512×512 | `882135a378a7d9c8…` | **位元組相同** | 相符（24 碼） |
| `ground_trans_dirt_to_steps_h.webp` | 147424 | 512×512 | `262462da95d8172e…` | **位元組相同** | 相符 |
| `ground_sakura_steps.webp` | 139996 | 512×512 | `6935c527db400bb5…` | **位元組相同** | 相符 |

候選來源：`art/stage3-sakura-pass/candidates/candidate_ground_{mountain_dirt,sakura_steps}.webp`、`candidates/transitions/candidate_trans_dirt_to_steps_h.webp`。
`ground_trans_dirt_to_steps_v.webp` **未被複製、未進 service-worker、未被任何 production 檔引用**（只有 Cursor 的測試檔在斷言它不存在）。

Loader／版本契約：
- `window.refreshSakuraArt()` 只在 `js/game.js:594` 的 `if (STAGE.id === "sakura-pass")` 被呼叫一次 → 進關才 lazyload。
- `js/renderer.js:445` 以 `stageId === "sakura-pass" && sakuraArtReady()` 把關，三張（dirt／transH／steps）`naturalWidth` 齊全才鋪；缺任一張就不鋪、不畫白塊、不畫漸層。
- terrain 快取鍵含 `sakuraStamp`（`js/renderer.js:476-480`）→ 資源 late-load 到位會觸發重畫。
- `?v=20261014-sakura-ground1` 在 `js/assets.js` 出現一次；`index.html` 的 assets.js／renderer.js 為同一版本。

## 2. 真 Chrome（headless，桌機 1280×800 與 iPad 模擬 1194×834，2D 與 0.60）

- **T1 PASS（3 視口）**：runtime 實測 512×512；`sakuraTileRole` 實測 tx0-2=dirt、tx3=transH、tx4+=steps。材質界線因此落在世界 X 1536／2048，**不對齊 chunk 邊界 900／1800**。
- **T4 PASS（3 視口）**：chunk 邊界 900 前後 4px 色差 2.0–3.3，未高於同材質內部變化 → 沒有跟 chunk 900×600 邊界斷裂。
- **T5 部分 PASS（3 視口）**：切到 0.60 傾斜後地面仍每幀 blit 114 次，玩家看得到新地板。傾斜只改 Y 投影、`pixelScale` 不變，terrain 快取**刻意不失效**（與第一/二關同一設計），所以切換後不會重新鋪磚——這是設計不是缺陷。
- **P PASS**：night-town 與 rain-port 全程 **0 次** sakura 圖 drawImage、`SAKURA_ART_STATUS` 為空（未觸發載入），外觀維持原圖。

### BLOCKED：我無法獨立證明「畫面上 1536／2048 換材質」

- 症狀：把玩家 `place()` 到 2040 後，我的 `view()` 回報視界仍是 −30–930；連沿用 `js/game.js:629` 的 `setCam(P.x - W/2, P.y - H/(2*tiltK()))` 也沒讓 `worldViewBounds()` 跟著動，於是世界座標換算的取樣點全部落在畫布外（回 null）。
- 為什麼不判失敗：這是我 harness 的世界↔螢幕換算與相機控制沒打通，**沒有任何證據指向產品缺陷**；靜態面（G3）已確認角色與 512 對齊契約成立。
- 最小修正（給下一輪 QA）：hook 改成回傳 renderer 當下 ground transform（`ctx.getTransform()` 的 `a`／`e`）搭配 `worldViewBounds()` 換算，並在強制相機跳動後**立即** `resetStats()` 再取樣（terrain 快取只在重建時鋪磚，統計窗口抓不到重建那一幀）。本檔 `tests/spacebunny-stage3-ground.acceptance.cjs` 已備好全部檢查點，修完換算直接重跑即可。

## 3. 缺圖／late-load

本輪以 `--delay=0` 執行，兩項無意義。要驗請跑：

```
node tests/spacebunny-stage3-ground.acceptance.cjs --port=9216 --delay=1500 --only=desktop-1280x800-2d
```

已實測過一次 `--delay=1500`：L1 報「延遲期間圖已 ready」、L2 報「late-load 後沒有重畫 {}」，兩者都是**我的取樣時機／統計窗口問題**（同一個 terrain 快取只重建一次的緣故，見 §2 BLOCKED），不是產品結論 → 維持 HUMAN_REVIEW，不引用為通過也不引用為失敗。

## 4. 人審重點：石階單材質 512px 自接線的方格線

**具體畫面**：`artifacts/validation/spacebunny-r9-stage3-ground-20261014/sg-desktop-1280x800-2d-steps-area.png`（2D、桌機 1280×800、玩家在石階區世界 X=2600）。

**我看到的**：整片地面是同一張 512×512 石階紋理反覆鋪滿，深綠苔線構成**完全正交、間距一致**的方格；同一塊石板的輪廓、苔蘚叢與粉色花瓣位置每 512 世界像素原樣重複一次。在沒有建築遮蔽的畫面左三分之一與右三分之一最明顯，視覺上像「機器排版的石板地」，和 dirt 側的有機土路質感落差明顯。**這不是 47 色差那種直切斷裂，是材質自身重複**，與 Cursor 報告一致。

**最小修正建議（依優先，我不自行改素材）**：
1. **首選**：AGY 出一張四邊可自接的石階變體（比照第一關 `ground_dirt` var1 的做法），程式端在 `sakuraTileRole` 的 steps 分支加一個 var2 選擇即可，屬 one-line 級改動。
2. **次選**：出兩張左右交錯的變體，程式端依 `(tx+ty)%2` 交替鋪，方格感立刻下降；同樣只動 `sakuraTileRole`。
3. **不建議**：只在 `tileImage` 加交錯偏移或縮放抖動去掩蓋——那是掩蓋不是修好，且會影響全關地面。

另外提醒：石階紋理本身已帶苔線，**若要走 (1) 需確認新圖邊緣不含苔線**，否則「苔線 + 磚縫」會變雙重格線。

## 5. 本輪沒做、也不宣稱的事

- 沒有跑全套 regression（依協調要求）；沒有沿用 Cursor 的 53/53 當我的結果。
- 沒有測 V 垂直過渡、神社、小怪、Boss（未核准、未接入）。
- 沒有宣稱實體 iPad 已驗；1194×834 只是桌面模擬視口。
- 沒有讀音檔、沒有 TTS／API 呼叫；HTTP 層 `/assets/audio/*` 全部 204。
- 沒有動 `js/dev-mode.js` 或任何 production／asset／協調檔。

## 6. 產出

- 新測試：`tests/spacebunny-stage3-ground.acceptance.cjs`（只讀 harness，HTTP 層注入）
- 證據：`artifacts/validation/spacebunny-r9-stage3-ground-20261014/`（evidence-9214.json、qa-log-9214.txt、各視口真截圖 sg-*.png、ground-asset-census.cjs 與輸出）
- 重跑：`node tests/spacebunny-stage3-ground.acceptance.cjs --port=9214 [--only=<label>] [--delay=1500]`