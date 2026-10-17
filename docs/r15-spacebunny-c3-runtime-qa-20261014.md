# R15 獨立 QA：C3 言靈圖鑑 UI runtime（2026-10-14）

> 作者：OpenCode Space Bunny Free Personal（Herdr w5:p4）｜**獨立 QA，未改任何 production**
> 狀態：**R15 本輪 DONE**。最終判定 **PASS=32／FAIL=0／HUMAN_REVIEW=3／BLOCKED=3**（exit 0）
> **C3 產品狀態維持 `NOT_DONE`**（依 19:07 總監裁示；人審已親眼確認兩項視覺缺陷，交 Cursor 修）
> 部署狀態：**未 Commit／未 Push／未 Deploy**
> 依據：`docs/card-gallery-runtime-20261014.md`（Cursor 622 實際交付，介面以此為準）、R13 模型層 22/22

---

## 0. 最終結果一覽

| 項目 | 值 |
| --- | --- |
| 最終總結 | **PASS=32 FAIL=0 HUMAN_REVIEW=3 BLOCKED=3**（run-full6，exit 0） |
| 真 Chrome 截圖 | **12 張**（3 視口 × 4 張：A 進圖鑑／filter 過濾／返回首頁／B 暫停路徑） |
| 測試 URL | `http://127.0.0.1:9298/index.html`、進關路徑 `http://127.0.0.1:9298/index.html?dev=1`（**專用 port 9298／CDP 9299，避開 8788／9400**） |
| 視口 | `desktop-1280x800`、`tablet-sim-1194x834`、`mobile-landscape-844x390`（皆瀏覽器模擬，**非實體裝置**） |
| production hash 前後 | **完全一致，drift=[]**（見 §6） |
| 音訊接觸 | `audioRequests=0`（音檔 0 次讀取）、`js/audio.js` stub 9 次；**未呼叫 TTS／API、未讀金鑰** |
| 卡印記衛生 | 結束前 `testClearKeys()` → `official=false / dev=false / learning=false`；**全部是測試注入，非自然收集** |
| 未跑 | **無**（矩陣全列有結果；G07 為 BLOCKED 而非未執行） |

### 矩陣最終狀態

| 列 | 項目 | 最終 |
| --- | --- | --- |
| G00 | 介面發現（實測不猜別名） | 已執行，結果寫入各案例 `discovery` |
| G01 | 真滑鼠點擊 首頁→codex（words 分頁） | **PASS ×3 視口** ＋ G01b `menuButtons()` 在圖鑑中確為 `null` PASS ×3 |
| G02 | 0–3 印只畫鎖與 `n/4`，不洩漏日文 | **PASS ×3** |
| G03 | 4/4 才畫 jp/zh/kana＋4/4＋中性插畫字 | **PASS ×3**（scope 限制見 §4-B） |
| G04 | 紙札真的 `drawImage`（真圖非幾何） | **PASS ×3** |
| G05 | 關卡／詞包真過濾且內容改變 | **PASS ×3** |
| G06 | 重聽 disabled、無音訊／TTS／API | **PASS ×3** |
| G07 | 暫停→codex→返回的時間／油量／座標／房屋不變 | **BLOCKED ×3**（harness 限制，見 §4-C） |
| G08 | ≥44 CSS px、不重疊、在可見範圍 | **PASS ×3** ＋ G08b 舊分頁鈕 **HUMAN_REVIEW ×3**（已查明實際 hit 達標，見 §4-D） |
| G09 | 從首頁開圖鑑不動相機 | **PASS ×3** |
| S01/S02/S03 | 存檔全拋不中斷／鍵分離／事件去重 | **PASS ×3（node 層）** |

### 關鍵實測值（可複現）

- **G02** 該幀實際繪製字串含 `["鎖","0/4","1/4","2/4"]`，**未開卡日文 0 筆洩漏**。
- **G03** 滿卡呈現 `うさぎ / 兔子 / 待解鎖插畫 / 4/4`；詞性、例句、羅馬字、emoji **0 筆命中**。
- **G04** 紙札真圖來源：`assets/img/ui/illustrated/button_secondary.webp`、`title_tag.webp`。
- **G05** 真點 `filter-stage`：`codexFilter {"by":"all","id":null}` → `{"by":"stage","id":"night-town"}`，畫面字串同步改變。
- **G09** 首頁開圖鑑再返回：`state=menu`，相機 `{"x":0,"y":0}` → `{"x":0,"y":0}`（不動）。
- **S01/S02/S03** `openCards` 在 storage 全拋錯時不中斷；正式鍵讀「ねこ=3」、dev 鍵讀「いぬ=4」互不污染；同 `event.id` 第二次 `duplicate`、印記不重複累加。
- **內容基準** 8 關／`WORD_PACKS`=32／`PACK_ORDER`=32／`getAllWords()`=164 詞、`STAGES` 為 object、`stage.wordPacks` 為 array。

---

## 1. 真 BUG（交 Cursor 修，非我所能改）

### A1. 人審已親眼確認的兩項視覺缺陷（總監 19:07，R15 不再重測）

| # | 現象 | 視口 | 我的獨立佐證 |
| --- | --- | --- | --- |
| A1-1 | **`n/4` 深墨字落在暗底上**，對比不足 | 真 Chrome | 我在字串層確認 `0/4`／`1/4`／`2/4` 確實被繪製（行為正確），但**顏色／對比屬像素層，人審已判不合格**，不由我推翻 |
| A1-2 | **滿卡五行文字重疊** | mobile-landscape | 行為層 PASS（G03/G04），但 mobile 橫向排版疊字屬像素層，人審判不合格 |

**結論：C3 維持 `NOT_DONE`。** 這兩項是我的 harness 量不到的（`fillText` 攔截器看得到「畫了什麼字」，看不到「畫在哪、疊不疊」），我不宣稱它們已修好。

### A2. 舊分頁鈕的擴張熱區在 mobile 橫向與圖鑑篩選列相撞（新發現，量測明確）

`js/game.js:3546` 的 `hitButton` 會把每個鈕**對稱**擴張到至少 44 CSS px：

```js
const minimum = 44 / (window.VIEWPORT?.get().scale || 1);
const px = Math.max(0, (minimum - bt.w) / 2), py = Math.max(0, (minimum - bt.h) / 2);
```

以 run-full6 的真實按鈕幾何靜態重算（`artifacts/validation/spacebunny-r15-c3-runtime-20261014/g08-hotzone-analysis.json`）：

| 視口 | scale | 44 CSS 需 | 需被擴張的鈕 | 擴張後重疊 | 擴張後裁切 |
| --- | --- | --- | --- | --- | --- |
| desktop 1280×800 | 1.3333 | 33.00 px | `cards`／`words`（h32，上下各 +0.5） | 無 | 無 |
| tablet 1194×834 | 1.3267 | 33.17 px | `cards`／`words`（h32，上下各 +0.58） | 無 | 無 |
| **mobile 844×390** | **0.65** | **67.69 px** | `cards`／`words`（h32，**上下各 +17.85**） | **`cards`↔`filter-stage`、`words`↔`filter-pack`，垂直重疊 1.85 px（水平 160 px）** | 無 |

**性質**：圖鑑模組自己的鈕（`filter-*`／`prev`／`next`／`back`／`replay`）在三個視口**本來就已達 44 CSS**（`touchSize = ceil(44/scale)`），不需擴張、不重疊、不裁切。會被擴張的是 `UI.codexButtons` 的**既有**分頁鈕（raw h=32）；在 mobile 橫向（scale 0.65）擴張後其熱區邊緣與篩選列重疊 1.85 邏輯 px，代表**點在篩選鈕最上緣時可能被判成切換分頁**。

**處理**：只回報，**不降低 44、不改產品、不自行修**（我無 production 權）。是否要挪分頁鈕或濾掉交界，請 Cursor／你決定。桌面與平板無此問題。

---

## 2. 我自己的 harness 缺陷（全部已修，非產品問題）

最終結果是 **PASS=32／FAIL=0**，但這是靠**逐條分辨 harness 與產品**得來的，過程 6 次完整跑（原始 log 全留，見 §5）。全部 4 類誤報與我的處置：

| # | 誤報症狀（×3 視口） | 真因 | 處置 |
| --- | --- | --- | --- |
| H1 | G03 命中 `["10:00"]`、`["📦"]` 判違規 | 我的禁畫 regex 過寬（含 `:`、含 HUD 自己的貨物圖示 📦）。**HUD 時間與包數圖示不是圖鑑卡面欄位** | 改為只比詞性／例句／羅馬字／特定 emoji；並在 evidence 明寫掃描範圍（§4-B） |
| H2 | G08 判「按鈕過小／出界」 | ①我寫死可見範圍 `0..900/600`，但 `VIEWPORT.get()` 是以**視窗**尺寸算的（1280 寬 → logical 960、`offsetX=30`），可見範圍是 `bounds()` 的 **−30..930**；②我先把 scale 四捨五入到 4 位再算門檻，`44/1.3333` 被算成 **34**，誤判 33 px 的按鈕 | 改用 `VIEWPORT.bounds()` ＋ **未捨入**的 scale；`need` 正確為 33 |
| H3 | G06 判「音訊呼叫 144 次」 | 我量的是**整頁累計**，但遊戲自己的 BGM 初始化本來就會呼叫 Audio/TTS | 改為**同時段對照組**（700 ms 自然增量）比對 replay 增量。最終：對照組 29、replay 增量 2 → 不高於自然增量 → PASS。**這不是要求絕對為 0**，因為遊戲音訊層每幀都在動 |
| H4 | G07 全部 BLOCKED／誤判 | ①我以為首頁 `start` 會進關——實際 `activateMenu('start')` → `enterOverworld()` 只進旅路；②`clickLogical` 會做 viewport 座標換算，但 **dev 選擇器是 DOM overlay，要的是 client 座標**，我雙重換算點空；③我沒過濾隱藏按鈕；④合成按鍵需 `rawKeyDown` ＋ `windowsVirtualKeyCode` | 修完後**真點擊已成功進關（實測 `state=play`）**，但仍到不了 `pause` → 見 §4-C |

另有一個注入層 bug 值得記錄：`GAME_HOOK` 字串裡我誤把物件屬性寫成 `const` 宣告，導致注入後**整個 `game.js` 語法錯誤、頁面載入失敗**（run-full3 全部 `CASE-… QA hook timeout`）。現在加了 `I:/WinTemp/opencode/check-hook.cjs` 單獨語法檢查 hook 字串，避免再犯。**該錯誤只影響我的測試頁，正式頁未被改動。**

---

## 3. 我做過的「發現」而非假設（介面修正）

| # | 我原本（錯） | 實測（真） |
| --- | --- | --- |
| 1 | 交付文件 `docs/c3-runtime-20261014.md` | **`docs/card-gallery-runtime-20261014.md`** |
| 2 | 猜 `CARD_DELIVERY_BRIDGE`／`CARD_BRIDGE` | **`globalThis.CARD_DELIVERY`** |
| 3 | 猜圖鑑 UI 有 `show` | 實際 `{STATUS, PAGE_SIZE, visible, reduce, draw, hit}` |
| 4 | 猜 `CONTENT.STAGES` 是陣列 | **`STAGES` 是 object**、關卡用 `stage.wordPacks`、32 包／164 詞 |
| 5 | 猜 `codexButtons(tab,page,count)` | 實際 **第四參 `galleryState` 必填**，否則 ui 會用預設 filter/page |
| 6 | 猜圖鑑內能靠 `menuButtons()` 取鈕 | 實際**圖鑑中 `menuButtons()` 回 `null`**（G01b 已驗） |
| 7 | 猜點「codex」先進 cards 分頁 | 實際 `activateMenu('codex')` **直接切 words 分頁**（`id==='cards'` 才是秘術卡頁） |

---

## 4. 未測／限制（誠實揭露，不宣稱全 PASS）

### A. 44 CSS 熱區的實作位置已查明
舊分頁鈕 raw h=32 ≠ 實際可點高度；`hitButton` 會擴張到 ≥44 CSS。**不列為缺陷**，僅在 mobile 橫向有 §1-A2 的 1.85 px 相撞。

### B. G03 的掃描範圍限制（依總監指示記錄）
我的字串攔截器**只能看到「這幀畫了哪些字」，無法把字串歸因到「圖鑑卡面」或「HUD」**。因此 G03 的 PASS 精確意思是：
> 「該幀全域沒有出現詞性／例句／羅馬字／特定 emoji 字串」，**不是**「已逐字確認圖鑑卡面只畫三行」。

HUD 的 `10:00`、`📦`、`100/100`、`Lv.1` 等確實會混在結果裡（我曾因此兩次誤判）。**方向的錯誤是假陽性（把 HUD 當違規），不是漏放真正的卡面違規**——因為卡面若多畫了詞性字串，該字串一定會出現在全域集合中而被抓到。像素層的重疊與對比不由本列涵蓋（見 §1-A1）。

### C. G07 BLOCKED：暫停→codex→返回 未能驗證（**不是 pause 的 FAIL**）

- **已做到的**：用真滑鼠點擊 dev 選擇器的「開發選關」→「直接進關」，**成功進關**（實測 `state=play`，`devUrl=http://127.0.0.1:9298/index.html?dev=1`）。
- **卡在哪**：我的合成 `Escape`（已改 `rawKeyDown` ＋ `windowsVirtualKeyCode=27`）**無法把狀態推入 `pause`**，`state` 始終停在 `play`，`menuButtons()` 因此回 `null`、找不到 `codex` 鈕。
- **所以沒驗到的**：`codexBack === 'pause'`、返回後 `elapsed`／油量／玩家座標／房屋 IDs 是否不變、暫停中開圖鑑是否推進遊戲時間。
- **邊界**：**未改產品、未假稱 pause 失敗、未降低門檻。** 這是 harness 限制（我無法用真點擊到達 pause）。需要一個 harness 可驅動的暫停入口才能解除。

### D. 非實體裝置
三個視口皆為瀏覽器 `Emulation` 模擬，**844×390 不代表實體 iPhone 的實際 DPR／安全區／觸控手感**，本輪**不產出 FPS、幀率或實機手感結論**。

### E. 印記來源
所有卡印記由測試 hook 注入到**專用 chrome profile**（`chrome-profile-9298/`），報告中一律標示為**測試注入，不是自然遊玩收集**；結束前已清除。

### F. C4 不在本輪範圍
C4 未實作，**本輪不測、也沒有任何 C4 PASS**。C4 資料層現況是 **12 項 RED**（`docs/r16-spacebunny-c4-data-red-20261014.md`），**RED 不等於 PASS**。下一輪待驗收的是 `storage persisted:false` 時**不 throw** 的語義，屬另一張票。

---

## 5. 執行紀錄（原始 log 全留，未刪未覆寫）

| Log | 總結 | 說明 |
| --- | --- | --- |
| `run-full.log` | PASS=23 FAIL=12 | 首次真跑。12 個 FAIL **全部**是我判斷錯誤（H1/H2/H3/G07 路徑），無產品缺陷 |
| `run-full2.log` | PASS=24 FAIL=8 HR=3 BLOCKED=3 | 修 H1/H2 後；剩 G06 與 G07 |
| `run-full3.log` | PASS=3 FAIL=4 | **harness 自傷**：`GAME_HOOK` 語法錯誤致 game.js 載入失敗，全視口 `QA hook timeout` |
| `run-full4.log` | PASS=30 FAIL=2 HR=3 BLOCKED=3 | hook 修好；剩 G06 對照組時長未對齊、G07 |
| `run-full5.log` | PASS=32 FAIL=0 HR=3 BLOCKED=3 | dev 選擇器真點擊已通（`state=play`），G07 仍 BLOCKED |
| **`run-full6.log`** | **PASS=32 FAIL=0 HR=3 BLOCKED=3** | **最終權威結果**，G08 熱區重算與本報告均以此為基準 |

單一阻塞的實質方法數未超過 3（g07 依次：確認 `start` 語義 → 改用 dev 選擇器真點擊 → 修正 client 座標與按鍵派送），無法校準即標 BLOCKED 交卷，不無限重跑。

---

## 6. 方法、衛生與 hash

**重現指令（單次）**：

```powershell
node --require ./tools/director-audio-freeze.cjs `
  tests/spacebunny-c3-runtime-independent.acceptance.cjs --mode=full --frozen --port=9298
```

- **音訊零接觸**：HTTP 層在 `fs.readFile` **之前**攔截 `/assets/audio/*`（204）與 `/js/audio.js`（靜音 stub），另加進程級 guard。實測 `audioRequests=0`、`stubbed=9`。**未呼叫 TTS／API、未讀金鑰、未讀 `assets/audio/**` 原檔。**
- **觀察邊界**：私有 hook 只讀 `state/menu/paging/油量/座標/房屋 IDs` 並注入人工印記；**入口、分頁、過濾、返回一律由真 CDP `Input.dispatchMouseEvent` 點擊驅動**，未用 `activateMenu` 代替。
- **不冒充**：evidence 內保留 `selftestIsNotProductPass`；selftest 不啟動 Chrome。

**production SHA-256（run-full6 前 → 後，drift=[]）**：

| 檔案 | SHA-256（前 12 碼） |
| --- | --- |
| `js/card-gallery-ui.js` | `1a3123386a30` |
| `js/card-gallery-model.js` | `37d82cdf9657` |
| `js/card-delivery-bridge.js` | `fa281fbc42de` |
| `js/card-collection.js` | `9fe14e38a7e9` |
| `js/ui.js` | `5d0edc570bb3` |
| `js/game.js` | `4504d3446273` |
| `index.html` | `85a2351d79f2` |

**本輪未動**：`js/`、`index.html`、`assets/`、`art/`、他人 tests、`AGENTS.md`／`roadmap.md`／handoff／執行看板（Codex 獨占）、音訊檔與金鑰。無 commit／push／deploy／reset／clean／checkout。

---

## 7. 產出

| 產出 | 說明 |
| --- | --- |
| `tests/spacebunny-c3-runtime-independent.acceptance.cjs` | 10 列矩陣 harness（selftest／full 雙閘門、內建 drawImage fixture、注入 hook 語法自檢） |
| `docs/r15-spacebunny-c3-runtime-qa-20261014.md` | 本檔 |
| `artifacts/validation/spacebunny-r15-c3-runtime-20261014/evidence-full-9298.json` | 最終證據（含逐列 note、原始值、hash 前後、衛生記錄） |
| `.../g08-hotzone-analysis.json` | §1-A2 擴張熱區靜態重算（純資料，**非新的一次產品測試**） |
| `.../qa-log-full-9298.txt` | 最終 QA log |
| `.../run-full{,2,3,4,5,6}.log` | 六次原始跑 log，**全留未刪** |
| `.../c3-*.png` | **12 張真 Chrome 截圖**（3 視口 × A-codex／filter／back-home／B-codex-from-pause） |
| `.../chrome-profile-9298/` | 專用測試 profile（印記已清除） |

---

## 8. 交卷狀態

- **R15 本輪：DONE。** PASS=32／FAIL=0／HUMAN_REVIEW=3／BLOCKED=3，evidence 與截圖齊備，production hash 全程一致。
- **C3：`NOT_DONE`**，待 Cursor 修 §1-A1 兩項人審視覺缺陷與（由 Cursor／你決定是否處理）§1-A2。
- **待你派 focused 票**：我不再自行重測、不再整套重跑；C4 下一輪驗收 `persisted:false` 不 throw 語義。