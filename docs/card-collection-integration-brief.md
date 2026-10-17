# 言靈圖鑑 C1／C2 接線說明

狀態：**RUNTIME_WIRED_20261014**。正式頁已載入圖鑑腳本，`makeOrder` 走 `CARD_DELIVERY.choose`。C3–C5 圖鑑 UI 仍未做，Roadmap 核取方塊本輪沒有改。實測見 [card-collection-runtime-20261014.md](card-collection-runtime-20261014.md)。

模組：`js/card-collection.js`、`js/card-delivery-bridge.js`。

測試：

- `node --test tests/card-collection-c1c2.test.cjs`
- `node --test tests/card-delivery-bridge.test.cjs`

## 舊接線說明是錯的

`makeOrder` 在約第 496 行先呼叫 `study.pick`。若 `study.pick` 存在但沒選到詞，第 497 行直接 `return`。`priorityMissed` 和 `STORE.pick` 幾乎不會執行。只替換第三層 `STORE.pick`，C2 權重在真遊戲裡不會生效。

收藏權重只負責新的配送委託。Boss 問答、護符聽題、熟練度 `missBoost` 仍走原本的 `study.pick`／`STORE.recRecall`，不要拿來決定下一張配送單。

## 正式 hook

2026-10-14 已接上。`makeOrder` 在圖鑑腳本存在時呼叫 `window.CARD_DELIVERY.choose`。沒有載入圖鑑腳本的舊 Node 沙箱才保留原來的 `study.pick`。

在 `makeOrder` 算出 `livingMisWords` 與 `activeOrderWords` 之後，配送詞由這一段決定：

```js
const picked = CARD_DELIVERY.choose(ALL, [...livingMisWords, ...activeOrderWords], Math.random);
if (!picked.word) return;
const chosenWord = picked.word;
```

`chosenWord` 是詞池裡的原物件，不是 `jp` 字串。函式不改 `orders` 裡已經存在的委託。排除後的詞池會重算 C、U 與權重，總和仍是 100%；這是條件機率，不是把被排除詞的舊權重按比例攤回去。池子空了就這張單不發，不要退回 `study.pick`，也不要丟例外。

`resolve` 裡 `w === j.word` 的獨立成功與 `j.assisted` 成功各記一筆 `kind:"delivery", ok:true`。失敗分支不要加印記。不要在 `rememberWord`、`STORE.rec`、`STORE.recAssisted`、`STORE.recRecall` 裡加印記。

## 存檔

| 鍵 | 用途 |
|---|---|
| `yokai-delivery-cards-v1` | 正式印記 |
| `yokai-delivery-dev-cards-v1` | 只在 loopback 且 `dev=1`，或明確 `{ dev:true }` |
| `yokai-delivery-v1` | 舊熟練度。`m.ok`／`m.box` 不是印記，不讀來回填 |

成功配送加 1，含輔助成功，4 封頂。同一個 event id 只生效一次。跨關同一 NFC `jp` 共用一張卡。

瀏覽器與 Node 都能 `require` 或使用 `globalThis.CARD_COLLECTION`／`CARD_DELIVERY`。`index.html` 在 `game.js` 之前載入這兩個腳本。兩個檔案都包在函式裡，避免和 `dev-mode.js` 的頂層 `const api` 撞名。
