# 石木世界接縫與雨港畫面驗收

驗收時間：2026-10-13。量測檔 `artifacts/validation/r6/world-cross-edge.json`（14:51:40Z）。截圖在 `artifacts/validation/r6/journey-shots/`。合成畫面 `compositeApproved` 仍是 false。

語音包本輪暫停。沒有呼叫 TTS，沒有使用 API key，沒有生成、取代或刪除音檔。

未 Commit／未 Push／未 Deploy。

## 總判

| 項目 | 狀態 |
|---|---|
| 現在畫面上的雨港地板 | **REVIEW_BY_HUMAN**。仍是單張 var1 加岸線裁切。截圖裡正方十字格與濕石／木棧直線界都還在 |
| Cursor 正在接的上下相鄰 | **FAIL**。木棧母圖底列對青石母圖頂列 45.16，門檻 25 |
| 相容圖進遊戲 | **BLOCKED**。`assets/img/rain-port/` 沒有這 7 張，畫面接不到 |
| 第二關專屬敵與 Boss | **BLOCKED**。候選圖待視覺審，**REVIEW_BY_HUMAN**，沒有接入 |
| 第一關冷啟加切視角 | **REVIEW_BY_HUMAN**。headless 有量 t0／t3／t10 與 2D↔2.5D，沒有抓到錯誤拼接，P0 不關閉 |
| 第二關房子種類、每塊 3 棟、無鳥居石燈、雨 ×2 | 程式契約 **PASS**。房子與岸的美術仍是 **REVIEW_BY_HUMAN** |
| 正式 SVG、缺圖圓形、Boss 紋章名牌、129 張單字圖 | **FAIL**。斷言保留 |
| 既有 service worker 媒體修訂 | **PASS**。603／603。新路徑尚未登錄，見下方一鍵修法 |
| 語音 | **BLOCKED** |
| 部署 | **BLOCKED** |

沒有一項美術被標成通過。

## 現場實際相鄰的是什麼

`portGroundPick` 在母圖還沒載入時忽略 tx、ty。青石格全部是 `stoneVar1`，木棧格全部是 `woodVar1`。6×6 範圍內 120 條鄰居都是 **SELF_EDGE**，跨素材的貼圖外框相鄰是 0。self-edge 約 2.09／2.26，只表示同一張圖的外框能接上，不算兩張不同圖的 cross-edge 通過。

畫面上的石木交界不是貼圖外框。奇數 chunk 把岸線裁在 `chunk.y + chunk.h - 256`：

| Y 間距 | 岸線世界 Y | 石的列 | 木的列 | 材料列差 |
|---|---|---|---|---|
| 1（`?tilt=1`） | 944 | 431，貼圖內部 | 432，貼圖內部 | 39.00 |
| 1.2（預設 2.5D 冷啟） | 1184 | 159，貼圖內部 | 160，貼圖內部 | 54.53 |

兩列都在 512 貼圖的中段。石的下一列自己只有 17.72／14.93。直線是裁切造成的。var1 外框對接的 46.62 不是畫面上的那一刀。

Chrome 冷啟、移動、2D 與 2.5D 都看得到：青石正方十字格、木板垂直重複縫、以及貫穿畫面的石木直線。代表圖：

- `artifacts/validation/r6/journey-shots/stage2-cold-t0.png`（2D，鈕顯示 2.5D）
- `artifacts/validation/r6/journey-shots/stage2-25d.png`（鈕顯示 2D）
- `artifacts/validation/r6/journey-shots/stage2-walk.png`（持續移動後岸線仍是直線）
- `artifacts/validation/r6/journey-shots/overworld-rain-port.png`（旅路 2/8，第二次點擊才進關）

冷啟到走動，上下兩塊地面的像素差平均都是 28.9。2D 切到 2.5D 的全畫面差平均 25.6。視角數值：雨港 1→0.6，再 0.6→1。第一關同樣 1→0.6、0.6→1。

## 程式打算鋪、但檔案還不在的帶

`js/assets.js` 已指向 7 條 compat 路徑。`js/renderer.js` 在 `stoneMaster`、`woodMaster`、`transHCompat` 都有寬度時，按 `ty % 4` 鋪：

- 餘 0、1：青石母圖
- 餘 2：橫向過渡
- 餘 3：木棧母圖

水平鄰居永遠是同一張圖。真正換圖只在上下。用 art 候選像素量這三條（runtime 檔不存在，所以量的是候選，不是已上線位元組）：

| 世界裡會碰上的對 | 平均差 | 判定 |
|---|---|---|
| 青石母圖底 → 橫向過渡頂 | 3.17 | 數值緊，不是通過 |
| 橫向過渡底 → 木棧母圖頂 | 3.45 | 數值緊，不是通過 |
| 木棧母圖底 → 下一列青石母圖頂 | **45.16** | **FAIL** |

木棧列的下一列直接回到青石，中間沒有過渡。`stoneCompat1`、`woodCompat1`、`woodCompat2`、`transVCompat` 在目錄裡，這段迴圈沒有鋪它們。作者的 `compat_seam_metrics.json` 沒有拿來當結果。候選家族互貼約 2.9～3.5，只說明那些沒被鋪上的變體彼此外框很近。

候選圖 64×64 區塊的亮度標準差中位數約 35～39，平坦填色比例 0。不是大面積單色矩形。海港 4×4 預覽的 512 磚邊約 3.6～4.2，磚邊緊並不取消畫面裡的材料分界。這些圖仍待使用者看，QA 不定稿。

## 給 Cursor 的媒體修訂

現有 `service-worker.js` 登錄與磁碟一致。`node --test tests/*.test.cjs` 是 **603／603**，媒體修訂那項有過。沒有舊 revision 失效。

這 7 條還沒有檔，也還沒進 worker：

- `assets/img/rain-port/ground_stone_master.webp`
- `assets/img/rain-port/ground_stone_compat_v1.webp`
- `assets/img/rain-port/ground_wood_master.webp`
- `assets/img/rain-port/ground_wood_compat_v1.webp`
- `assets/img/rain-port/ground_wood_compat_v2.webp`
- `assets/img/rain-port/ground_trans_stone_wood_h_compat.webp`
- `assets/img/rain-port/ground_trans_stone_wood_v_compat.webp`

圖放進 `assets/img/rain-port/` 之後，執行一次：

```text
node tools/build-media-cache.cjs
```

QA 沒有執行。這支會改 `service-worker.js`。現在跑也補不上還不存在的檔。

2D／2.5D 快取：`js/game.js` 約 3701 行把主畫布設成 `viewport scale × dpr`，這個 scale 不含 tilt。`drawGroundBase` 用 `ctx.getTransform().a` 當快取鑰匙。headless 實測：900→901 之後地面貼圖重畫清單是空的；2D↔2.5D 之後也是空的。視角有切換，地面貼圖沒有因此重鋪。

## 第一關 P0

有量，沒有關閉。

- 2D 冷啟：`stage1-2d-t0.png`、`stage1-2d-t3.png`、`stage1-2d-t10.png`，再切到 2.5D（`stage1-2d-toggle-t0.png`）。t0→t3 上緣差平均 1.57。t0→t10 平均 10.95，畫面仍是同一條石板路，差來自角色、花瓣與石燈。
- 2.5D 冷啟另起一份文件：`stage1-25d-t0.png` 到 `stage1-25d-t10.png`，再切回 2D。t0→t10 上緣差平均 13.20。
- 進關是旅路第二次點擊（`attempts: 2`）。沒有改第一關已核准的視覺。

headless 這段沒有看到地板突然換接法。它不是 iPad、手機或 Xbox。P0 維持 **REVIEW_BY_HUMAN**。

## 第二關房子、雨、鳥居

程式測試仍綠：雨港 chunk 無鳥居、無石燈、無櫻樹；倉庫寬 187、魚舖寬 201；雨是三層且 `rainMul = 2`，畫在 HUD 之前。截圖看得到港町倉庫、魚舖、雨絲，戰鬥畫面沒有鳥居、地上石燈或櫻樹。

`journey-shots.json` 的 `S2-FORBIDDEN` 來自進關前的旅路圖畫過 `prop_sakura`。戰鬥截圖沒有櫻。工具已改成進關後清空觀測；這次 JSON 保留原始紅燈，並在 `visualReview` 寫明。

房子與地板的美術仍待使用者看。

## 敵與 Boss

`art/r4/handpainted-candidates/stage2-enemies/` 有潮子小僧與怒海坊主的待機、攻擊，metadata 四張 webp 的 sha256 與檔案一致。角色有透明底，32×32 區塊不是大面積平坦填色。

`js/renderer.js`、`js/assets.js`、`js/game.js`、`js/boss-ai.js` 沒有這些名字。Boss 仍畫 `window.ART.boss`。閘門：`artifacts/validation/r6/enemy-boss-gate.json`。狀態 **REVIEW_BY_HUMAN**，實作 **BLOCKED**。`tests/r6-enemy-boss-gate.acceptance.cjs` 的紅燈保留，禁止刪掉換綠。

## 維持的紅燈

| 測試 | 原因 |
|---|---|
| B10 | 正式 `awaken_seal.svg` |
| W1 | 載入行沒有逐一寫出四張核准圖的檔名；目錄仍是整包載入 |
| W3 | 岸線改走 `portGroundPick`，不是舊斷言要的 `PORT_ART.dock` |
| S1 | 角色與怪物缺圖仍畫圓 |
| S2 | Boss 紋章與名牌底板仍是程序幾何 |
| H1 | 合成畫面未經使用者核准 |
| R1 (c) | 單字圖缺 129／164 |
| 敵 Boss 未核准 | 候選圖未接入 |

## 語音

`artifacts/validation/r6/voice-deferred.json` 為 **BLOCKED**。本輪生成數 0，本進程四個 API 環境變數都是 UNSET。磁碟上既有的 Aoede dry-run 已是 `PREVIEW_RAN`（`generatedOk` 7）。那些檔與 Leda、Gemini 2.5、原本 175 個 mp3 都沒有動。試聽存在不是驗收通過。

## 測試計數

| 項目 | 結果 | exit |
|---|---|---|
| `node --test tests/*.test.cjs` | 603／603 | 0 |
| `tests/r6-world-cross-edge.acceptance.cjs` | 7／7。含木對石 FAIL 的事實，不是美術通過 | 含在最終驗收 |
| `tests/r6-enemy-boss-gate.acceptance.cjs` | 1 通過（閘門如實標待審）、1 失敗（未接入未核准，必須維持紅） | 1 |
| `tests/r6-mutual-edge.acceptance.cjs` | 9／9。單張 var1 仍是可視重複；語音改為暫停而非要求刪檔 | 0 |
| 七個 acceptance 合跑 | 68 項：60 通過、8 失敗。失敗是 B10、W1、W3、S1、S2、H1、單字圖 129、敵 Boss 未核准 | 1 |
| Chrome | 17 張。headless。人工閘門開啟 | 工具 0；`S2-FORBIDDEN` 已在 visualReview 說明 |

## 本輪修改

- `tools/r6-world-cross-edge.cjs`
- `tools/r6-journey-shots.cjs`
- `tests/r6-world-cross-edge.acceptance.cjs`
- `tests/r6-enemy-boss-gate.acceptance.cjs`
- `tests/r6-mutual-edge.acceptance.cjs`（語音斷言改為暫停，不再要求把試聽檔刪掉）
- `docs/r6-world-cross-qa.md`、`docs/r6-test-report.md`
- `artifacts/validation/r6/**`

沒有改 `js/`、`assets/`、`art/`、音檔、`tools/tts-*`、`AGENTS.md`、`roadmap.md`、`service-worker.js`。
