# 雨港互貼邊獨立驗收（2026-10-13，接 Kilo）

驗收者：Grok Build。Kilo Ultra 的 upstream idle timeout 沒有留下名為 Kilo 的半成品測試。磁碟上相關的舊紀錄是 `art/r4/cross_edge_compatibility_matrix.json` 與 `art/r4/handpainted-candidates/stage2-refine/variant_metrics.json`。這兩份都只讀，沒有拿來當這次的通過證明。`variant_metrics.json` 只記每張圖自己的接縫，大約 2～3，不能用來放行多變體混用。

**結論：【BLOCKED】。現場是同一材質只鋪一張 `var1`，數值守門不判 FAIL，但是畫面重複要人工看。合成畫面沒有核准。Aoede 仍是 BLOCKED、0 段錄音。不可 Commit／Push／Deploy。**

人工閘門：`artifacts/validation/r6/human-visual-gate.json`（`status: OPEN`，`compositeApproved: false`）。

## 1. 像素怎麼量

runtime webp 用本機 ffmpeg 解成 PNG，再量相鄰邊上每個像素的 `(|dR|+|dG|+|dB|)/3` 平均。horizontal 是左圖最右欄對右圖最左欄。vertical 是上圖最底列對下圖最頂列。不相容門檻是 25。報告在 `artifacts/validation/r6/ground-edge.json`。

| 配對 | 實測平均 |
|---|---|
| 青石 var1→var2／var2→var1，horizontal | 32.84／32.59 |
| 木板 var1→var2／var2→var1，horizontal | 39.80／39.64 |
| 青石原圖自接 horizontal／vertical | 45.58／52.74 |
| 木棧原圖自接 horizontal／vertical | 40.50／48.67 |
| 青石 var1 自接 horizontal／vertical | 2.09／2.60 |
| 木板 var1 自接 horizontal | 2.26 |
| 原圖對變體，八組雙向、橫縱 | 最低 32.24，最高 71.87，全部高於 25 |
| 岸線：青石 var1 底列對木板 var1 頂列 | 46.62 |

青石互貼約 33、木板互貼約 40，和交辦的數字同一帶。原圖自接也差。原圖對變體大多落在 35～65，少數超出這段：木棧 var2→原圖的 vertical 是 32.24，原圖木棧→木板 var1 的 vertical 是 71.87。它們都過不了 25 的門檻。

## 2. 實際渲染有沒有把不同貼圖排在一起

`js/renderer.js` 的 `portGroundPick` 在 var1 已載入時，青石每一格都回 `stoneVar1`，木棧每一格都回 `woodVar1`。掃描 tx、ty 從 -4 到 8，沒有一格換成 var2 或原圖。這是單張無縫 var1 的保守排法。

判定是 `NOTE_VISIBLE_REPEAT`，不是 FAIL。自接約 2，低於 25，但是同一張圖會在畫面上重複，必須看截圖。

同一套掃描若改回舊的三圖混用（原圖、var1、var2，索引 `tx * 3 + ty * 5`），青石與木板都是 `FAIL`／`MIXED_INCOMPATIBLE`。那種排法裡 var1 的自接仍然約 2，守門仍失敗。只鋪原圖則是 `FAIL`／`SELF_EDGE_INCOMPATIBLE`，因為原圖自己接不上。

岸線 46.62 是兩種材質相接，不是 var1 對 var2。單材質 var1 的政策不因此改判 FAIL。交界圖 `transH`／`transV` 沒有被 pick 用上。

Chrome 重畫地面之後，`drawImage` 記到 `ground_stone_var1.webp` 與 `ground_wood_dock_var1.webp`。沒有記到 var2、鳥居、神社石燈或櫻樹道具。底圖 `scenery/ground.webp` 仍會先畫一層，上面再蓋港町 var1。

## 3. 雨港精修與第一關

這些是讀現況，沒有重做。

- 雨港 chunk：`torii` 為 false，石燈陣列是空的，櫻樹陣列是空的。夜行町在起點附近的 chunk 裡仍有鳥居，而且每塊有一盞石燈。夜行町的六個詞包沒有 `sakura` 主題，所以第一關的櫻樹陣列也是空的；畫面上的花瓣來自關卡的 petal 設定。
- 房子密度與第一關相同：共用 `SPOTS` 四個位置、每塊留一個空位，實際每塊 3 棟，排位表也相同。
- 繪製寬度：港倉 187、魚舖 201、食堂 175、神社 158、町屋 166。187／220 與 201／236 都是少 15%。相對第一關，港倉仍比町屋寬（187 對 166），魚舖仍比食堂寬（201 對 175）。
- 缺倉庫或魚舖圖時不畫幾何房子。
- 雨港雨是三層，係數 `rainMul = 2`，基礎條數 12、10、7。`drawStageWeather` 用 `viewBounds()`，而且發生在 `UI.drawHud` 之前。`rainLoad > 1.4` 時條數係數會降到 0.55。

## 4. Chrome 截圖

目錄：`artifacts/validation/r6/stage2-refine-shots/`。本機 Chrome headless，視窗先是 900×600，再改成 1024×768。不是 iPad、手機或 Xbox。

| 檔案 | 看到的 |
|---|---|
| `stage1-desktop-2d-first.png` | 夜行町、宵待酒屋、石板路、場景石燈。按鈕寫 2.5D，所以當時是 2D。這張鏡頭裡沒有單獨點出鳥居。 |
| `stage2-desktop-2d-first.png` | 雨夜港町首幀。青石在上、木棧在下，港町倉庫，有雨。沒有鳥居。章名還在。 |
| `stage2-desktop-2d-moved.png` | 拖曳之後仍是港町倉庫與同一條石木分界。和首幀的區塊平均差 9.092；雨也在動，這個數字不是純鏡頭位移。 |
| `stage2-desktop-25d.png` | 按鈕改成 2D。傾斜量從 1 變成 0.6。倉庫與石木分界還在，雨還在。 |
| `stage2-tablet-25d.png` | 1024×768，仍是 2.5D。多看到右側木箱與另一棟倉庫。暫停、油燈、扇子、衝刺都在畫面內。 |
| `stage2-tablet-2d.png` | 同一平板尺寸切回 2D，按鈕恢復 2.5D。 |

地面重畫紀錄同時有倉庫與魚舖。桌機正中這幾張主要是倉庫。青石與木板的方格重複、岸線接縫都看得到。

重畫後約 1 秒有 8 個動畫幀（牆鐘 1049 ms）。這是 headless、而且剛重建地面快取的取樣，不是玩家裝置的 FPS，也不當成裝置通過。

畫面裡仍有 `ui/awaken_seal.svg`。這和既有 B10 是同一件事，這輪沒有把它從測試拿掉。

## 5. 測試

| 項目 | 結果 | exit |
|---|---|---|
| `node --test tests/r6-mutual-edge.acceptance.cjs` | 9/9 | 0 |
| `node --test tests/*.test.cjs` | 603/603 | 0 |
| `tests/art-only-qa.acceptance.cjs` | 12/13，B10 仍紅 | 含在下一列 |
| `tests/r6-approved-candidates.acceptance.cjs` | 5/10，W1、W3、S1、S2、H1 紅 | 1（三份一起跑） |
| `tests/r4-rain-port.acceptance.cjs` | 19/19 | 含在上一列的 exit 1 |

三份驗收一起跑是 42 項、36 過、6 紅，exit 1。log：`artifacts/validation/r6/r6-kilo-baseline.log`、`artifacts/validation/r6/r6-kilo-accept.log`。

W1 紅的直接原因是它要求 `refreshPortArt` 那一行出現 `fishmonger`。現在那一行是載入整個 `portCatalog()`。魚舖路徑仍在 `RAIN_PORT_FISH`，而且 `port_fishmonger.webp` 的 SHA-256 與核准圖相同。這條 assert 留著，沒有改成綠燈。

W3 紅是因為岸線改走 `portGroundPick("wood")`，不再寫 `PORT_ART?.dock`。畫面上的木板是 var1，不是核准的那張原圖。原圖檔 `ground_wood_dock.webp` 與核准圖位元組仍相同，只是 var1 在場時沒有被鋪上去。這條 assert 也留著。

S1、S2、H1、B10 維持原紅燈。H1 是合成畫面沒有使用者核准。

上一輪 baseline 曾是 602/603，卡在 `ground_stone.webp` 的媒體修訂。這一次工作樹裡「published worker content revisions match every local media file」有過，所以是 603/603。這輪沒有跑 `tools/build-media-cache.cjs`，也沒有改 `service-worker.js`。

倉庫、魚舖、青石原圖、木棧原圖與四張核准 webp 的 SHA-256 相同。兩張 var1 與核准原圖不同。

## 6. Aoede

`docs/voice-aoede-plan.md` 與 `art/audio/aoede-preview/dry-run-report.json` 仍是 `BLOCKED_NO_GEMINI_API_KEY`。`generatedSamples` 是空的，`network` 是 false。試錄目錄裡沒有 legacy-backup 以外的 mp3、wav、ogg。這次程序環境的 `GEMINI_API_KEY`、`GOOGLE_API_KEY`、`GOOGLE_GENAI_API_KEY`、`GOOGLE_APPLICATION_CREDENTIALS` 都是 UNSET。沒有生成音檔，也沒有用其他聲線代替。這不是音檔驗收完成。

## 7. 下一個要人看的項目

請看 `artifacts/validation/r6/stage2-refine-shots/` 裡雨港的六張圖，決定合成畫面能不能過。要看的是：同一張青石 var1、同一張木板 var1 的重複，石與木的岸線，港倉相對夜行町房子是否仍太大，雨是否夠，以及畫面裡有沒有不該出現的鳥居。測試全綠或這份數值都不是核准。

未 Commit。未 Push。未 Deploy。
