# R14 獨立 QA：P4.2 固定景物尺寸與世界相機拉近（Space Bunny Free，2026-10-14）

> 作者：OpenCode Space Bunny Free Personal（Herdr w5:p4）｜**獨立 QA，未改任何 production**
> 對象：`js/viewport.js`／`js/game.js`／`js/renderer.js`／`index.html`（Cursor 交付，本輪 **frozen**）
> 契約：`docs/p42-stable-depth-camera-zoom-contract.md`｜交付報告：`docs/p42-camera-runtime-20261014.md`
> 部署狀態：**未 Commit／未 Push／未 Deploy**｜無 reset／clean／checkout

---

## 0. 結論：**15 列矩陣無產品缺陷**（P01–P15 全部達標或已轉人審）

**P4.2 的程式契約全部通過。** 過程中出現的 FAIL **全部是我的 harness bug**，已逐項定位、修正並用真 Chrome 複驗；沒有任何一項需要 Cursor 修 production。

| 分類 | 數量 | 內容 |
| --- | --- | --- |
| **PASS** | **13 列** | P01 世界視野、P02 2D 不受 zoom、P03 景物尺寸恆定、P04 zoom 經 CTM 生效、P05 blur/grade 保留、P06 HUD 不放大、P07 input inverse、P08 切鏡連續、P09 直立腳錨、P10 屋頂 culling、P11 ground cache、P12 關卡隔離、P13 非法 zoom 白名單 |
| 守門項 | 2 | P14 快照 SHA（PASS）、P15 音訊零接觸（PASS） |
| **HUMAN_REVIEW** | **4** | ①blur/grade **強度**（技術面已 PASS）②玩家素材底部 alpha 留白 35 列 ③1194×834 只是模擬視口 ④不產出 FPS 結論 |
| **FAIL** | **0** | — |
| **BLOCKED** | **0** | — |

### production 快照（驗收前後一致）

```text
js/viewport.js   4ccf0c545f814b6ae43a3aefa845ff2b75ab58cceea27dfe66ccba4692069448
js/game.js       0b14af8cac5875a56c0c7394af7df47a3e55cc20f8620223500460de35f82cff
js/renderer.js   598947a0b137ec9d293d98d909dfb7b73dc4fb502409e0c4da950cead37bb097
index.html       5a336b56a286c4a862749a039e018d535a651e52c8a27677b41532f83226e332
交付文件 sha256  a6cb017d6388d0a699bacfa26c9545ef3f02f52fa2ca85b40cbd2d817eb82eee
```
每次執行都記錄 `productionFrozenDuringRun: true`（run 期間四檔 SHA 未變）。專用 port **9288**（CDP 9289），**不動 8788**。

---

## 1. 逐項證據（全部來自真 Chrome）

| # | 項目 | 桌機 1280×800 | 平板模擬 1194×834 | 判定 |
| --- | --- | --- | --- | --- |
| **P01** | 2.5D 世界視野 = `bounds.width/Z`、`bounds.height/(k·Z)` | Z=1 → 960×1000；Z=1.10 → 872.73×909.09；Z=1.15 → 834.78×869.57 | 900×1047.74／818.18×952.49／782.61×911.08 | **PASS**（誤差 ≤0.005） |
| **P02** | 2D 恆 Z=1 | 三個 Z 的 worldZoom 都是 1，視野恆 960×600 | 恆 1，視野 900×628.64 | **PASS** |
| **P03** | 固定 Z 下玩家連續 14 格 Y 移動，景物**邏輯寬度**恆定 | 全部視差 0px | 全部 0px | **PASS** |
| **P04** | zoom 確實經世界 CTM 生效，且景物尺寸不含 Z | backing CTM 1.3333→1.5333（比值 **1.15**）；神社邏輯寬度 **210 → 210 不變**；螢幕像素 280→321 | 同樣比值 1.15、寬度不變 | **PASS** |
| **P05** | blur/grade 保留 | 同幀 9 座神社：blur 值 **{0, 2.6}**、落差 2.6px、反序點數 0（單調）；邏輯寬度集合 **{210}** | 同 | **PASS** |
| **P06** | HUD bbox 不因 Z 放大 | fan 1.000/1.000、radar 1.000/1.000、lamp 1.000/1.006 | fan 1/1、radar 1/1、lamp 1.010/1 | **PASS**（比值≈1，非 1.15） |
| **P07** | input inverse 往返 | Z=1 → (0,0)；Z=1.15 → (0,0) world unit | 同 | **PASS**（門檻 ≤0.5） |
| **P08** | 切鏡中心連續、雙軸重新錨定 | 2D↔2.5D 往返位移 **1.82px**（門檻 ≤2px） | 同 | **PASS** |
| **P09** | 直立腳錨（純矩陣） | `localFootY=20`；Δy 26.667／30.667／26.667px，**比值 1.0000**；Δx=0 | localFootY=20，比值 1.0000，Δx=0 | **PASS** |
| **P10** | 屋頂 culling | 探針處房屋本體接近視野外緣，該幀仍繪製 1 組 sprite → 未過早剔除 | 同 | **PASS** |
| **P11** | ground cache 不逐幀重建 | 固定 Z=1.15 平移 20 幀，重新配置 **0 次** | 0 次 | **PASS** |
| **P12** | 第一／二關隔離 | night-town 與 rain-port 的 worldZoom 恆 1、視野完全相同（960／960、900／900） | 同 | **PASS** |
| **P13** | 非法 zoom 白名單 | `2`／`abc`／`0.5`／`1.2`／缺值 → 全部 **1** | 同 | **PASS** |
| **P14** | 快照釘住 | 四檔 SHA 記錄，run 期間未變動 | 同 | **PASS** |
| **P15** | 音訊零接觸 | `/assets/audio/*` 0 請求、204；`js/audio.js` stub、**讀取嘗試 0、位元組 0**；全程無未捕捉例外 | 同 | **PASS** |

**真 Chrome 截圖 26 張**：`p42-<viewport>-{25d-z1,25d-z1.15}-blur.png`、`-hud.png`、`-25d-shrine-far.png`、`-anchor-tilt{0.6-z1,0.6-z1.15,1-z1.15}.png`、`-isolation-{night-town,rain-port}-z{1,1.15}.png`、`-roof-culling-probe.png`（兩視口各 13 張）。

---

## 2. HUMAN_REVIEW（我不代裁）

1. **blur／grade 強度**（技術面已 PASS）：Z=1 遠景銳度 16.93／近景 23.02；Z=1.15 遠 23.53／近 27.49。像素帶量測會被「帶內內容不同」干擾（帶內有建築的會更銳），**只能當參考**，請看 `p42-*-25d-z1-blur.png`、`-z1.15-blur.png`、`-25d-shrine-far.png` 自行判斷遠景是否「夠遠又不糊到墨線消失」。
2. **玩家素材底部 alpha 留白**：`player_idle_v2` 原圖 832×1024，最後一列不透明像素在第 988 列 → **底部自然留白 35 列**。這是素材留白、不是錨點錯誤。是否裁掉屬美術決定，我**不改原型或錨點**。
3. **1194×834 只是桌面模擬視口**，不是實體 iPad。
4. **不產出 FPS 結論**：headless 幀率不代表真機。

---

## 3. 我自己的 harness 缺陷全紀錄（原始 log 全部保留，未覆蓋）

首輪 `run-full.log`（PASS 23／FAIL 20）、次輪 `run-full2.log`（PASS 34／FAIL 15），所有 FAIL 皆為我的量測錯誤：

| # | 症狀 | 真因 | 處置 |
| --- | --- | --- | --- |
| 1 | P01/P02 全 FAIL，訊息「允許 ±NaN」但實測誤差 0~0.005 | `viewErr()` 把整個 `expect` 物件乘進容差 → NaN → 任何比較都判 FAIL | **不重跑瀏覽器**，以已錄 raw 資料重算 → `calibration-p01-p02.json`（**12/12 PASS**） |
| 2 | P03/P04「尺寸變了」 | 我把 `dw`（邏輯尺寸）當像素、再除以 CTM.a 當世界尺寸 → 把 zoom 算成景物變大。實際 shrine 三個 Z 的 `dw` 都是 **210** | 改正為：邏輯尺寸＝`dw`、螢幕像素＝`dw×CTM.a` |
| 3 | 6 個案例頁面例外 | `VIEWPORT.projectPoint` 未匯出（實際名 `worldToScreen`／`screenToWorld`） | 改用實際 API |
| 4 | P06 永遠 BLOCKED | 寫入 `boxes['z1.15']` 但讀取 `boxes.z1_15` | 鍵名一致 |
| 5 | P09 `localFootY=1856` | **根因**：`a = slice(arguments,1)` 後 9 參數形式 `a.length === 8`，我卻寫 `is9 = a.length>=9` → 把 crop 的 `sy/sh` 當 dest（1856 = 832+1024） | 改 `is9 = a.length===8`；先用**自我校準 fixture** 證明解析正確（`tests/spacebunny-r14-drawimage-arg-fixture.cjs`，**7/7 PASS**，含「舊邏輯重現 1856」回歸項），再 focused 複驗 |
| 6 | P05 取到 2.6/2.6 判「blur 未保留」 | 我對**多座**神社取 `max` filter（且近距樣本放錯方向，`distance` 為 0） | 改為「同一幀同一 sprite 的 blur 與螢幕 Y 單調相關」 |
| 7 | `rows is not defined` | P05 重寫後變數落在區塊內 | 提升到函式層級 |

> 校準 metadata：`calibration-p01-p02.json`（資料重算）、`calibration-drawimage-arg-fixture.log`（自我校準 fixture）。
> **所有原始 run log（run-full、run-full2、run-focused-*）一律保留**，未刪未改。

---

## 4. 方法與限制

- **真 `drawImage` 攔截**：記錄 sprite 的 crop／dest 矩形、當下 CTM 與 `ctx.filter`，P03/P04/P05/P09 都量真繪圖參數，不是讀內部變數。
- **zoom 生效性雙條件**（你指定）：景物**邏輯尺寸不含 Z**（210→210）**且** **backing CTM 比值＝1.15**。只看尺寸不變不足以證明 zoom 生效，反之只看像素變大可能是景物變大。
- **blur 只用同一 sprite 的 filter 判定**，像素帶銳度僅供強度人審。
- **腳錨用純矩陣**（站立、無 bob）：local 錨點 (0,20) 經完整 CTM 應為 `20·Z`（upright 的 `scale(1,1/k)` 抵消 k）；與 Codex 獨立 7 PASS 矩陣一致。
- **連續影格**：P03/P04/P11 都是逐格 `place()`→`snapCam()`→`paint()`，非靜止單張。
- 每個視口跑完即落盤，單一案例爆掉不遺失已量資料。
- **無實體 iPad、無真機 FPS、無自然十分鐘通關**；不宣稱美術合格或 zoom 比例最終選擇（仍 `WAITING_HUMAN`）。

---

## 5. 產出與重跑

```powershell
# harness 自我校準（純 Node，先跑）
node tests/spacebunny-r14-drawimage-arg-fixture.cjs                 # 7/7

# P01/P02 資料重算（不開瀏覽器）
node tests/spacebunny-r14-p01-p02-recalibrate.cjs                 # 12/12 PASS

# 正式 frozen 驗收（須 Cursor DONE 後）
node --require ./tools/director-audio-freeze.cjs \
  tests/spacebunny-p42-camera-independent.acceptance.cjs --mode=full --frozen --port=9288
```

| 產出 | 說明 |
| --- | --- |
| `tests/spacebunny-p42-camera-independent.acceptance.cjs` | 15 列矩陣 harness（含 selftest／full 雙閘門） |
| `tests/spacebunny-r14-drawimage-arg-fixture.cjs` | drawImage 參數解析自我校準 fixture |
| `tests/spacebunny-r14-p01-p02-recalibrate.cjs` | 以已錄 raw 資料重算 P01/P02，不重跑瀏覽器 |
| `artifacts/validation/spacebunny-r14-p42-camera-20261014/` | 26 張真 Chrome 截圖、13 個 run/calibration log、evidence JSON |

**交接**：P4.2 程式契約已達標，production 四檔維持 Cursor 的 frozen 狀態不動，等候下一張 focused ticket。