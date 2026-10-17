# C3／C4 runtime 準備（2026-10-14）

狀態：**PLAN_ONLY**。P4.2 的 Space Bunny R14 還在驗凍結的 Chrome，本輪沒有改 `js/`、`index.html` 或任何既有測試。下面的 diff 沒有套用。

未 Commit／未 Push／未 Deploy。沒有讀音檔、沒有呼叫 TTS。

## R13 的兩個 FAIL

來源：`docs/r13-spacebunny-c3-model-qa-20261014.md`。獨立測試 `tests/spacebunny-c3-model-independent.acceptance.cjs` 是 20/22，exit 1。現行 164 詞沒有重複的 NFC 日文，所以 A1 今天不會在正式詞庫爆；B5 只要存檔裡同一個字有兩種寫法就會爆。

### A1 圖鑑去重丟掉後面的關卡

`CARD_GALLERY.project` 看到同一個 NFC `jp` 就 `continue`，只留下第一筆的 `stageIds`。`が` 先出現在夜行町、再出現在黃泉時，依關卡分組只剩夜行町，`shared` 也是 false。

最小修在 `js/card-gallery-model.js` 的 `project`：同一把 key 把 `stageIds` 做聯集，再交給 `presentCard`。聯集寫進新陣列。不要 `push` 進原本的 `stageIds`。詞條若已凍結，改原陣列會丟例外，也違反 R13 E1。`shared` 用「原本就是 true，或聯集長度大於 1」。

`tests/card-gallery-model.test.cjs` 那個 NFC 例子現在斷言 `stages.length === 1`。修模型時要改成夜行町與黃泉都在，而且 `shared === true`。Space Bunny 的 A1 已經按這個期望寫好，不用放寬。

### B5 讀檔把 4 印蓋成 0

`CARD_COLLECTION.loadState` 對 `marks` 逐項寫入。`が: 4` 後面若再來分解形 `か\u3099: 0`，正規化後是同一把 key，後寫蓋掉，印記變成 0。反過來先 0 再 4 則碰巧留下 4。

最小修在 `js/card-collection.js` 的 `loadState`：同一把 key 取 `Math.max(已有, 新值)`，兩邊都先 `clampMark`。不要相加。`applyEvent` 本來就寫 NFC key，新對局不會再寫出兩種形；這是讀舊檔或髒檔的保護。C3 的 `readMark` 只是讀這個結果，所以修 C1 一處，圖鑑跟著對。

R13 B5 已經期望結果是 4。修完該項應轉綠，不必改那條測試。

真 UI 等這兩處修完再接。草案在 `artifacts/validation/c3-prep-20261014/NOT-APPLIED-a1-b5.diff`，尚未套上。

## 現成入口，不要新開一套畫面

| 現況 | 接 C3 時怎麼用 |
|---|---|
| `UI.drawCodex` | 暫停選「單字圖鑑」進的就是這個。`tab === "words"` 那一頁改吃圖鑑模型。`tab === "cards"` 仍是秘術卡，不要混進言靈印記。 |
| `UI.codexButtons` | 已有 cards／words／prev／next／back。篩選與翻頁沿用 prev／next 與 `codexPage`。關卡、詞包兩顆篩選鈕加在同一組，不要另做分頁框架。 |
| `game.activateMenu("codex")` | 暫停的「單字圖鑑」已走這條。鍵盤 C、手把檢視鍵在選單狀態也會開。返回寫回 `codexBack`。 |
| 結算 `won`／`lost` | 畫面上只有再踏夜行、回旅路、回首頁，沒有圖鑑鈕。手把檢視鍵在有選單時會開圖鑑。先不要為結算再加一層；若要可見入口，只在 `END_BTNS` 加一顆既有 `codex` id。 |

現在單字頁用 `STORE.get(w.jp).box` 和星號，那是熟練度，不是 C1 印記。改接時改讀 `CARD_DELIVERY.openCards(...).marks`，經 `CARD_GALLERY.project`。不要把 `m.box` 畫成印記。

`drawCodex` 的單字格現在是 `glassBox` 加「？」和 emoji `drawWordCue`。那是程式底板。C3 卡面主體改成下面的真圖 `drawImage`。鎖住時只畫「鎖」和 `n/4`，不要畫日文、中文、假名、詞性、例句、羅馬字、emoji。

## 紙札實檔

已在磁碟、且現有 loader 會 `drawImage` 的和紙圖：

| 檔 | 載入 |
|---|---|
| `assets/img/ui/illustrated/button_secondary.webp` | `js/ui.js` `illustratedArt.neutral`，`drawWoodTag` |
| `assets/img/ui/illustrated/button_primary.webp` | `illustratedArt.primary` |
| `assets/img/ui/illustrated/result_panel.webp` | `drawWashiBoard` 旅帳 |
| `assets/img/ui/illustrated/pause_panel.webp` | 告示板 |
| `assets/img/ui/illustrated/title_tag.webp` | 題籤 |

卡面先用 `button_secondary.webp`，經既有 `drawWoodTag`／`drawRibbonSlices`。這是選單用紙牌，不是專為圖鑑畫的單字卡，上線前要人看一張是否像單字札。

戰鬥符圖 `assets/img/vfx/ofuda_projectile.webp`、`assets/img/vfx/raster/ofuda.webp` 是陰陽符飛符，不拿來當圖鑑卡身。`assets/img/ui/awaken_seal.svg` 是 SVG，不用。沒有核准的單字插畫之前，滿四印的札面只放 jp、zh、kana，不寫「待解鎖插畫」以外的圖，也不要新畫假卡。

## 畫面契約（資料修好之後）

- 0／1／2／3：紙牌上只有「鎖」和 `0/4`…`3/4`。`jp` 欄維持 null，不要把內部 `key` 印出來。
- 4：同一張牌顯示 `jp`、`zh`、`kana`。不顯示 `pos`、`example`、`romaji`、`icon`。
- 全圖鑑先 `project(CONTENT.getAllWords(), bag)`，一張 NFC 卡。關卡篩選用合併後的 `stages`。詞包篩選用 `category.id`（就是 `packId`）。分頁仍用 `paginate`，預設 8。
- 重聽鈕畫成 disabled。不要呼叫 `AUDIO.speak`、`speechSynthesis` 或任何 TTS。`replayRequest` 先不要接到播放。
- 不改角色朝向、假名遮罩、封印技能。那些不在這張票。

## C4

詞包用 `CONTENT.WORD_PACKS` 的真實 `words`，去掉 `decoy`。一個包裡每個 NFC 字都是 4 印，該包才算齊。完成狀態由印記算出來，存在既有 `yokai-delivery-cards-v1`／`yokai-delivery-dev-cards-v1`，不新開鍵，不加攻擊、血量或速度。

獎勵圖還沒有核准檔。齊包之前只在資料裡記 `complete: true`，不畫新徽章，不加戰鬥效果。若以後要「只提示一次」，再在同一份卡檔加 `sets`，並且 `loadState` 要保留它；現在 `loadState` 會丟掉 marks／events 以外的欄位，所以這步不要跟 B5 的 max 混在同一行。

建議函式，仍放 `card-gallery-model.js`，不寫檔：

`packSets(packs, source) -> [{ packId, name, total, done, complete }]`

## C5（UI 接上之後才做）

- 長期抽：連續成功配送後重算 `deliveryWeights`，總和仍近 100，4 印不再上升。
- 同一 `event.id` 第二次 `applyEvent` 必須是 duplicate。
- `localStorage.setItem` 丟錯時，對局仍可玩，圖鑑讀到的是上次成功寫入的印記。
- 真 Chrome：暫停進單字圖鑑、0–3 只有鎖和分數、滿印才有三行字、切關卡／詞包與翻頁、dev 鍵與正式鍵分開、重聽鈕不能發出聲音。

## 實作順序（等 R14 交卷、凍結放開）

1. Cursor 只改 `loadState` 取 max。跑 B5 與 `tests/card-collection-c1c2.test.cjs`。
2. Cursor 只改 `project` 的關卡聯集，不改詞庫物件。改掉圖鑑測試裡那條 `stages.length === 1`。跑 A1 與 `tests/card-gallery-model.test.cjs`。
3. 兩項都綠之後，才改 `drawCodex` 的單字頁和必要的 `codexButtons`／`selectCodex`。卡面用既有 WebP。重聽保持 disabled。
4. 同一輪或下一輪加 `packSets`。不要接獎勵圖，不要改戰鬥。
5. C5 與真 Chrome 交給 Space Bunny，在 UI 已接上之後。

Owner：第 1、2 步是 Cursor 的資料修。第 3 步仍是 Cursor，但只限 `ui.js` 單字頁與 `game.js` 圖鑑狀態。紙牌好不好看要人審。Codex 不必為這張票重算。
