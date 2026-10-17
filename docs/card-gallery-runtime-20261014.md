# 言靈圖鑑 C3 接線（2026-10-14）

狀態：**C3_LOADED**。單字頁已讀配送印記。未 Commit／未 Push／未 Deploy。沒有改世界、圖片、音訊。

## 這次接上的事

- 地板快取密度是 `Math.fround(邏輯縮放 × devicePixelRatio)`。它不含世界縮放 Z。覆蓋範圍仍用縮放 1 的世界邊界，畫面移動不會每幀重畫整張快取。
- 同一把 NFC 字在存檔裡出現兩次時，印記取較大的那個，不降級，也不把兩筆加起來。
- 圖鑑投影把同一個 NFC 字的 `stageIds` 聯集成新陣列，並標成共享。原本凍結的詞條不會被改寫。
- `index.html` 在 `game.js` 前載入 `card-gallery-model.js` 與 `card-gallery-ui.js`。快取版本是 `20261014-p42-c3`。
- 單字頁用 `CONTENT.getAllWords()` 和 `CARD_DELIVERY` 的正式袋或 dev 袋。熟練度 `STORE.box` 不會打開卡片。
- 0–3 印只畫鎖和 `n/4`。滿 4 印畫日文、中文、假名、`4/4`，以及未審插畫的中性字「待解鎖插畫」。不畫詞性、例句、羅馬字、emoji，也不用幾何色塊當牌面。有 `button_secondary.webp` 時用現成紙札。
- 可點範圍仍至少 44 CSS 像素。篩選文字是「關卡：全部／夜行町…」「詞包：全部／動物街…」。翻頁和篩選用同一個動態 pageSize。返回回到打開圖鑑時的 `codexBack`（選單或暫停）。暫停與圖鑑不推進遊戲時間，也不改碰撞或配送。再聽維持停用，不呼叫音訊或 TTS。秘術卡片頁維持原樣。
- 鏡頭切換的 0.8 秒裡如果已經打開本局圖鑑（`codexBack` 是 `play`、`pause` 或 `levelup`），tilt 與 zoom 繼續沿玩家做雙軸 reanchor。從首頁或旅路打開的圖鑑不移動鏡頭，也不重建世界。玩家坐標、速度、spacing 不變。

## 給 R15 的接口

不要猜別名。篩選真狀態是閉包裡的 `codexFilter`：`{ by: "all"|"stage"|"pack", id: null|字串 }`，頁碼是 `codexPage`。`CARD_GALLERY_UI.reduce` 的 `close: "pause"` 只表示離開圖鑑，目的地是 `codexBack`。

`menuButtons()` 在圖鑑中是 `null`。暫停與選單的「單字圖鑑」按鈕 id 是 `codex`，「秘術卡片」是 `cards`。單字頁自己的按鈕 id 是 `filter-stage`、`filter-pack`、`prev`、`next`、`back`、`replay`，文字在 `label`。

正式頁面沒有觀測用的全域物件。`tools/c3-gallery-chrome.cjs` 的 `window.__c3QA` 只存在於那個測試 HTTP，`act(id)` 回傳的 `filter` 就是 `codexFilter`。

C4 這輪不接。詞包以真 `WORD_PACKS` 的 32 包為準。`CONTENT.STAGES` 是 object，`stage.wordPacks` 是 array。

## 測試

R15 之後這輪做了紙札可讀性、手機熱區和存檔失敗回報。C4 套卡獎勵仍不接。

印記字畫在 `button_secondary.webp` 量到的亮紙帶（原圖 y 12–61／85）裡，行距彼此獨立。「待解鎖插畫」改成頁面上一句中性字，不畫在每張牌底。窄的圖鑑高度改成一列；手機 844×390 是 4 張。`show`、`reduce`、`draw` 用同一個 pageSize。

頁籤本體高 32，熱區仍按 44 CSS 往上下擴。圖鑑起點讓篩選鈕落在擴張下緣之下，不把 44 縮小，也不把負的邏輯 x 當成出界。

`openCards().record` 不再讓 `setItem` 的 quota 例外冒出。已收下的事件是 `applied: true`；寫入成功 `persisted: true`，失敗 `persisted: false` 並帶 `storageError: { name, message }`。沒收下的事件是 `persisted: null`，不會去寫。同一個 bag 留下記憶體印記與去重；下一次寫成功會把當時的完整狀態寫進去。重新讀檔只看真正寫入的內容。對局只多一句「印記尚未寫入本機」，不暫停。

真 Chrome 三張（注入印記，不是自然集齊）：`artifacts/validation/c3-cursor-20261014/read-1280x800.png`、`read-1194x834.png`、`read-844x390.png`。音訊仍是 stub／204。尚未在實體手機上看。G07 選單回暫停沒有改，那是 harness 沒進暫停。

```text
node --require ./tools/director-audio-freeze.cjs --test tests/card-gallery-runtime.test.cjs
node --test tests/card-gallery-ui.test.cjs tests/card-gallery-model.test.cjs tests/card-gallery-runtime.test.cjs tests/card-collection-c1c2.test.cjs tests/spacebunny-c3-model-independent.acceptance.cjs tests/renderer.test.cjs
node tools/c3-gallery-chrome.cjs
```

Chrome 畫面裡的滿印與半印是測試注入的存檔，不是玩家自然集齊。本輪 `tools/c3-gallery-chrome.cjs` 為 PASS，截圖在 `artifacts/validation/c3-cursor-20261014/`。正式鍵看到鎖與 `1/4`；dev 鍵看到「ねこ／貓／ねこ／待解鎖插畫／4/4」，以及另一張鎖住的 `2/4`。返回分別回到選單與暫停，暫停期間時間與座標不變，再聽沒有新增音訊呼叫。
